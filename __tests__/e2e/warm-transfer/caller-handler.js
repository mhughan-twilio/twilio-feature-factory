// ABOUTME: WebSocket handler for the simulated caller AI in warm transfer E2E tests.
// ABOUTME: Randomly picks Alice or Bob, describes an issue, responds naturally via Claude LLM.

const ISSUES = [
  'a billing discrepancy on my last invoice',
  'a delayed delivery for order number 5847',
  'trouble accessing my account after a password reset',
  'returning a product that arrived damaged',
  'rescheduling my appointment from Thursday',
];

const AGENTS = ['Alice', 'Bob'];

function buildCallerSystemPrompt() {
  const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
  const issue = ISSUES[Math.floor(Math.random() * ISSUES.length)];

  return {
    agent,
    issue,
    prompt: `You are a customer calling a company. You want to speak with ${agent} about ${issue}.

Your behavior:
1. When greeted by the receptionist, tell them you'd like to speak with ${agent}
2. If asked what it's about, explain: ${issue}
3. When told to hold, say "Sure, no problem" and wait
4. If the receptionist makes small talk while you wait, engage briefly
5. When the agent joins the call, greet them and explain your issue
6. Be friendly and natural — you're a real person calling for help

Keep responses SHORT (1-2 sentences). This is a phone conversation.
Don't volunteer all information at once — let the conversation flow naturally.`,
  };
}

/**
 * Send a prompt to Claude and return the response text.
 */
async function sendToLLM(openai, systemPrompt, messages) {
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
    console.log(`[caller] LLM error: ${error.message}`);
    return 'Sorry, could you repeat that?';
  }
}

function handleCaller(ws, params, ctx) {
  const { agent, issue, prompt: systemPrompt } = buildCallerSystemPrompt();

  const session = {
    callSid: null,
    agent,
    issue,
    messages: [],
    startTime: Date.now(),
  };

  console.log(`[caller] Session started: wants=${agent}, issue="${issue}"`);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      const ts = new Date().toISOString().slice(11, 23);

      switch (message.type) {
        case 'setup': {
          session.callSid = message.callSid;
          console.log(`[${ts}] [caller] SETUP: callSid=${message.callSid}`);
          // Don't send a greeting — the receptionist greets first
          break;
        }

        case 'prompt': {
          if (!message.last || !message.voicePrompt) { break; }

          console.log(`[${ts}] [caller] HEARD: "${message.voicePrompt}"`);
          session.messages.push({ role: 'user', content: message.voicePrompt });

          const response = await sendToLLM(ctx.openai, systemPrompt, session.messages);
          session.messages.push({ role: 'assistant', content: response });

          console.log(`[${ts}] [caller] RESPONSE: "${response}"`);
          ws.send(JSON.stringify({ type: 'text', token: response }));
          break;
        }

        case 'interrupt':
          console.log(`[${ts}] [caller] INTERRUPT`);
          break;

        case 'dtmf':
          console.log(`[${ts}] [caller] DTMF: ${message.digit}`);
          break;

        default:
          console.log(`[${ts}] [caller] UNKNOWN: ${message.type}`);
      }
    } catch (error) {
      console.log(`[caller] Error: ${error.message}`);
    }
  });

  ws.on('close', () => {
    const duration = ((Date.now() - session.startTime) / 1000).toFixed(1);
    console.log(`[caller] Session closed: duration=${duration}s, agent=${agent}`);
  });

  ws.on('error', (error) => {
    console.log(`[caller] WS error: ${error.message}`);
  });
}

module.exports = { handleCaller };
