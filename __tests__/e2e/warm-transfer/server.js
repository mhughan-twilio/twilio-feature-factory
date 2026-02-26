#!/usr/bin/env node
// ABOUTME: Express + WebSocket server for warm transfer E2E testing with path-based routing.
// ABOUTME: Routes WS connections by URL path to handler modules for receptionist, briefing, caller, and agent.

require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const OpenAI = require('openai');
const twilio = require('twilio');

const { ReceptionistStateMachine, detectDismissalPhrase, detectTransferTrigger } = require('./receptionist-handler');
const { detectReadySignal } = require('./briefing-handler');
const { handleCaller } = require('./caller-handler');
const { handleAgent } = require('./agent-handler');

// Configuration
const PORT = process.env.PORT || 8080;

// Initialize OpenAI client
let openai;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log('OpenAI client initialized');
} catch (_error) {
  console.log('Failed to initialize OpenAI client. Set OPENAI_API_KEY.');
  process.exit(1);
}

// Initialize Twilio client for Sync and protected function calls
let twilioClient;
try {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  console.log('Twilio client initialized');
} catch (_error) {
  console.log('Twilio client not available');
}

// Shared context accessible by all handlers
const sharedContext = {
  openai,
  twilioClient,
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  syncServiceSid: process.env.TWILIO_SYNC_SERVICE_SID,
  domainName: process.env.DOMAIN_NAME,
  // Track active sessions for cross-handler coordination
  sessions: new Map(),
};

// System prompts
const RECEPTIONIST_PROMPT = `You are a friendly, professional AI receptionist named Taylor for a small company.

Your job:
1. Greet the caller warmly
2. Find out which agent they need (Alice or Bob) and what their issue is about
3. When you have BOTH the agent name AND a brief issue summary, say:
   "Please hold while I connect you with [Agent Name]."
4. After saying that, make small talk to keep the caller engaged while they wait
5. When the agent joins, briefly introduce: "[Agent], the caller is asking about [issue]."
6. When the agent says something like "Thanks Taylor, I've got it", say goodbye and stop talking.

RULES:
- Determine which agent (Alice or Bob) the caller wants
- Get at least a brief description of their issue
- Only say the hold phrase ONCE you have both pieces of information
- Keep all responses SHORT (1-2 sentences). This is a voice conversation.`;

const BRIEFING_PROMPT = `You are a briefing AI for a warm transfer system. An agent is about to join a call with a customer.

Your job:
1. Quickly brief the agent on who is calling and what their issue is
2. Ask if they're ready to be connected
3. When they say "ready" or "connect me", say "Connecting you now."

Keep everything VERY SHORT (1-2 sentences). The agent wants to get on the call quickly.`;

/**
 * Send a prompt to OpenAI and return the response text.
 */
async function sendToLLM(systemPrompt, messages) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 150,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.log(`LLM error: ${error.message}`);
    return "I'm sorry, I'm having a moment. Could you repeat that?";
  }
}

/**
 * Call a protected Twilio Function with a valid signature.
 */
async function callProtectedFunction(url, params) {
  const sig = twilio.getExpectedTwilioSignature(sharedContext.authToken, url, params);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Twilio-Signature': sig,
    },
    body: new URLSearchParams(params),
  });
  return response.json();
}

/**
 * Handle the /receptionist WebSocket path — full LLM-powered receptionist.
 */
function handleReceptionist(ws, params, ctx) {
  const conferenceName = params.ConferenceName || 'unknown';
  const stateMachine = new ReceptionistStateMachine();
  const messages = [];
  let callSid = null;
  let agentName = null;
  let callerIssue = null;
  const startTime = Date.now();

  // Register session
  ctx.sessions.set(conferenceName, { conferenceName, state: 'INTAKE', startTime });

  console.log(`[receptionist] Session started: conference=${conferenceName}`);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      const ts = new Date().toISOString().slice(11, 23);

      switch (message.type) {
        case 'setup': {
          callSid = message.callSid;
          console.log(`[${ts}] [receptionist] SETUP: callSid=${callSid}, from=${message.from}`);

          // Generate greeting via LLM
          messages.push({ role: 'user', content: 'A new caller has connected. Greet them and ask how you can help.' });
          const greeting = await sendToLLM(RECEPTIONIST_PROMPT, messages);
          messages.push({ role: 'assistant', content: greeting });

          console.log(`[${ts}] [receptionist] GREETING: "${greeting}"`);
          ws.send(JSON.stringify({ type: 'text', token: greeting }));
          break;
        }

        case 'prompt': {
          if (!message.last || !message.voicePrompt) {break;}

          const state = stateMachine.state;
          console.log(`[${ts}] [receptionist] [${state}] HEARD: "${message.voicePrompt}"`);
          messages.push({ role: 'user', content: message.voicePrompt });

          // In CONFERENCE state, stay quiet — only listen for dismissal
          if (state === 'CONFERENCE') {
            if (detectDismissalPhrase(message.voicePrompt)) {
              console.log(`[${ts}] [receptionist] DISMISSAL DETECTED`);
              stateMachine.transition('DISMISSED');
              ctx.sessions.set(conferenceName, { conferenceName, state: 'DISMISSED', startTime });

              ws.send(JSON.stringify({
                type: 'text',
                token: "You're welcome! I'll leave you to it. Have a great conversation!",
              }));

              if (ctx.domainName && callSid) {
                const removeUrl = `https://${ctx.domainName}/warm-transfer/remove-receptionist`;
                try {
                  await callProtectedFunction(removeUrl, {
                    ConferenceName: conferenceName,
                    ReceptionistCallSid: callSid,
                  });
                  console.log(`[${ts}] [receptionist] Removed from conference`);
                } catch (removeError) {
                  console.log(`[${ts}] [receptionist] Remove failed: ${removeError.message}`);
                }
              }

              setTimeout(() => {
                ws.send(JSON.stringify({ type: 'end' }));
              }, 3000);
            } else {
              console.log(`[${ts}] [receptionist] [CONFERENCE] Staying quiet, waiting for dismissal`);
            }
            break;
          }

          // For INTAKE and HOLD_CHAT states, respond via LLM
          const response = await sendToLLM(RECEPTIONIST_PROMPT, messages);
          messages.push({ role: 'assistant', content: response });
          console.log(`[${ts}] [receptionist] [${state}] RESPONSE: "${response}"`);
          ws.send(JSON.stringify({ type: 'text', token: response }));

          if (state === 'INTAKE') {
            const trigger = detectTransferTrigger(response);
            if (trigger.triggered) {
              agentName = trigger.agentName;
              // Extract issue from conversation
              const userMessages = messages.filter((m) => m.role === 'user');
              callerIssue = userMessages.map((m) => m.content).join(' ').substring(0, 200);

              console.log(`[${ts}] [receptionist] TRANSFER: agent=${agentName}, issue="${callerIssue}"`);
              stateMachine.transition('TRANSFERRING', { agentName, callerIssue });
              ctx.sessions.set(conferenceName, { conferenceName, state: 'TRANSFERRING', startTime });

              // Call the protected function to initiate agent call
              if (ctx.domainName) {
                const functionUrl = `https://${ctx.domainName}/warm-transfer/initiate-agent-call`;
                const functionParams = {
                  ConferenceName: conferenceName,
                  AgentName: agentName,
                  CallerIssue: callerIssue,
                  CallerCallSid: '',
                  ReceptionistCallSid: callSid || '',
                };

                try {
                  const result = await callProtectedFunction(functionUrl, functionParams);
                  if (result.success) {
                    console.log(`[${ts}] [receptionist] Agent call initiated: ${result.agentCallSid}`);
                    stateMachine.transition('HOLD_CHAT');
                    ctx.sessions.set(conferenceName, { conferenceName, state: 'HOLD_CHAT', startTime });
                  } else {
                    console.log(`[${ts}] [receptionist] Agent call failed: ${result.error}`);
                  }
                } catch (fetchError) {
                  console.log(`[${ts}] [receptionist] Fetch error: ${fetchError.message}`);
                }
              } else {
                console.log(`[${ts}] [receptionist] DOMAIN_NAME not set, skipping agent call`);
                stateMachine.transition('HOLD_CHAT');
                ctx.sessions.set(conferenceName, { conferenceName, state: 'HOLD_CHAT', startTime });
              }
            }
          }
          break;
        }

        case 'interrupt':
          console.log(`[${ts}] [receptionist] INTERRUPT`);
          break;

        case 'dtmf':
          console.log(`[${ts}] [receptionist] DTMF: ${message.digit}`);
          break;

        default:
          console.log(`[${ts}] [receptionist] UNKNOWN: ${message.type}`);
      }
    } catch (error) {
      console.log(`[receptionist] Error: ${error.message}`);
    }
  });

  ws.on('close', () => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[receptionist] Session closed: conference=${conferenceName}, duration=${duration}s, state=${stateMachine.state}`);
    ctx.sessions.delete(conferenceName);
  });

  ws.on('error', (error) => {
    console.log(`[receptionist] WS error: ${error.message}`);
  });
}

/**
 * Handle the /briefing WebSocket path — briefs agent, triggers bridge on ready.
 */
function handleBriefing(ws, params, ctx) {
  const conferenceName = params.ConferenceName || 'unknown';
  const messages = [];
  let callSid = null;
  let bridged = false;
  const startTime = Date.now();

  console.log(`[briefing] Session started: conference=${conferenceName}`);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      const ts = new Date().toISOString().slice(11, 23);

      switch (message.type) {
        case 'setup': {
          callSid = message.callSid;
          console.log(`[${ts}] [briefing] SETUP: callSid=${callSid}, from=${message.from}`);

          // Fetch caller context from Sync
          let briefingText;
          if (ctx.twilioClient && ctx.syncServiceSid) {
            try {
              const doc = await ctx.twilioClient.sync.v1
                .services(ctx.syncServiceSid)
                .documents(`warm-transfer-${conferenceName}`)
                .fetch();
              const agentDisplayName = (doc.data.agentName || 'there').charAt(0).toUpperCase() + (doc.data.agentName || 'there').slice(1);
              briefingText = `Hi ${agentDisplayName}, you have a caller waiting. They're calling about: ${doc.data.callerIssue}. Are you ready to be connected?`;
            } catch (syncErr) {
              console.log(`[${ts}] [briefing] Sync fetch failed: ${syncErr.message}`);
              briefingText = 'Hi, you have a caller waiting. Are you ready to be connected?';
            }
          } else {
            briefingText = 'Hi, you have a caller waiting. Are you ready to be connected?';
          }

          messages.push({ role: 'assistant', content: briefingText });
          console.log(`[${ts}] [briefing] BRIEFING: "${briefingText}"`);
          ws.send(JSON.stringify({ type: 'text', token: briefingText }));
          break;
        }

        case 'prompt': {
          if (!message.last || !message.voicePrompt) {break;}
          if (bridged) {break;}

          console.log(`[${ts}] [briefing] HEARD: "${message.voicePrompt}"`);
          messages.push({ role: 'user', content: message.voicePrompt });

          // Check for ready signal
          if (detectReadySignal(message)) {
            bridged = true;
            console.log(`[${ts}] [briefing] READY SIGNAL DETECTED`);
            ws.send(JSON.stringify({ type: 'text', token: 'Connecting you now.' }));

            // callSid is the PARENT leg (briefing CR). We need the CHILD leg
            // (the agent's actual call) to move into the conference.
            if (ctx.domainName && callSid && ctx.twilioClient) {
              try {
                // Look up child call SID from parent
                const childCalls = await ctx.twilioClient.calls.list({
                  parentCallSid: callSid,
                  limit: 1,
                });
                const agentCallSid = childCalls.length > 0 ? childCalls[0].sid : callSid;
                console.log(`[${ts}] [briefing] Parent=${callSid}, Child (agent)=${agentCallSid}`);

                const bridgeUrl = `https://${ctx.domainName}/warm-transfer/bridge-agent`;
                const result = await callProtectedFunction(bridgeUrl, {
                  AgentCallSid: agentCallSid,
                  ConferenceName: conferenceName,
                  AgentName: '',
                });
                if (result.success) {
                  console.log(`[${ts}] [briefing] Bridge successful — agent child leg moved to conference`);
                  // Notify receptionist that agent joined
                  const session = ctx.sessions.get(conferenceName);
                  if (session && session.state === 'HOLD_CHAT') {
                    session.state = 'CONFERENCE';
                  }
                } else {
                  console.log(`[${ts}] [briefing] Bridge failed: ${result.error}`);
                }
              } catch (fetchError) {
                console.log(`[${ts}] [briefing] Bridge error: ${fetchError.message}`);
              }
            }
          } else {
            const response = await sendToLLM(BRIEFING_PROMPT, messages);
            messages.push({ role: 'assistant', content: response });
            console.log(`[${ts}] [briefing] RESPONSE: "${response}"`);
            ws.send(JSON.stringify({ type: 'text', token: response }));
          }
          break;
        }

        case 'dtmf': {
          console.log(`[${ts}] [briefing] DTMF: ${message.digit}`);
          if (message.digit === '1' && !bridged) {
            bridged = true;
            console.log(`[${ts}] [briefing] DTMF READY SIGNAL`);
            ws.send(JSON.stringify({ type: 'text', token: 'Connecting you now.' }));

            if (ctx.domainName && callSid && ctx.twilioClient) {
              try {
                const childCalls = await ctx.twilioClient.calls.list({
                  parentCallSid: callSid,
                  limit: 1,
                });
                const agentCallSid = childCalls.length > 0 ? childCalls[0].sid : callSid;
                console.log(`[${ts}] [briefing] DTMF: Parent=${callSid}, Child (agent)=${agentCallSid}`);

                const bridgeUrl = `https://${ctx.domainName}/warm-transfer/bridge-agent`;
                await callProtectedFunction(bridgeUrl, {
                  AgentCallSid: agentCallSid,
                  ConferenceName: conferenceName,
                  AgentName: '',
                });
              } catch (fetchError) {
                console.log(`[${ts}] [briefing] DTMF bridge error: ${fetchError.message}`);
              }
            }
          }
          break;
        }

        case 'interrupt':
          console.log(`[${ts}] [briefing] INTERRUPT`);
          break;

        default:
          console.log(`[${ts}] [briefing] UNKNOWN: ${message.type}`);
      }
    } catch (error) {
      console.log(`[briefing] Error: ${error.message}`);
    }
  });

  ws.on('close', () => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[briefing] Session closed: conference=${conferenceName}, duration=${duration}s, bridged=${bridged}`);
  });

  ws.on('error', (error) => {
    console.log(`[briefing] WS error: ${error.message}`);
  });
}

// Express app for HTTP endpoints
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  const sessions = {};
  for (const [key, session] of sharedContext.sessions) {
    sessions[key] = {
      conferenceName: session.conferenceName,
      state: session.state,
      startTime: session.startTime,
    };
  }
  res.json({
    status: 'ok',
    activeSessions: sharedContext.sessions.size,
    sessions,
  });
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

// Route WebSocket connections by path
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const params = Object.fromEntries(url.searchParams);
  const ts = new Date().toISOString().slice(11, 23);

  console.log(`[${ts}] WS connection: path=${path}, params=${JSON.stringify(params)}`);

  switch (path) {
    case '/receptionist':
      handleReceptionist(ws, params, sharedContext);
      break;
    case '/briefing':
      handleBriefing(ws, params, sharedContext);
      break;
    case '/caller':
      handleCaller(ws, params, sharedContext);
      break;
    case '/agent':
      handleAgent(ws, params, sharedContext);
      break;
    default:
      console.log(`[${ts}] Unknown WS path: ${path}`);
      ws.send(JSON.stringify({
        type: 'text',
        token: 'Unknown handler path. Valid paths: /receptionist, /briefing, /caller, /agent',
      }));
      ws.close();
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`
=================================================
  Warm Transfer WebSocket Server
=================================================
  Port: ${PORT}
  OpenAI: ${openai ? 'Ready' : 'NOT CONFIGURED'}
  Twilio: ${twilioClient ? 'Ready' : 'NOT CONFIGURED'}
  Sync SID: ${sharedContext.syncServiceSid || 'NOT SET'}
  Domain: ${sharedContext.domainName || 'NOT SET'}

  WebSocket paths:
    /receptionist  - Receptionist AI (LLM-powered)
    /briefing      - Agent briefing (LLM-powered)
    /caller        - Test: simulated caller
    /agent         - Test: simulated agent

  HTTP endpoints:
    GET /health    - Health check

  Ready for connections...
=================================================
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down warm transfer server...');
  wss.clients.forEach((ws) => {
    ws.send(JSON.stringify({ type: 'end' }));
    ws.close();
  });
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
