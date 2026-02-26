// ABOUTME: WebSocket handler for the simulated human agent AI in warm transfer E2E tests.
// ABOUTME: Listens to briefing, signals readiness, then in conference dismisses the receptionist.

const AGENT_SYSTEM_PROMPT = `You are a human agent at a company. You've been called by the company's AI receptionist system to brief you on a waiting caller.

Your behavior during BRIEFING:
1. Listen to the briefing about who is calling and their issue
2. You may ask one brief clarifying question
3. When ready, say "I'm ready, connect me" clearly

Your behavior during CONFERENCE (after being connected to the caller):
1. Greet the caller warmly: "Hi, this is [your name]. I understand you're calling about [issue]."
2. Help them with their issue (improvise appropriate responses)
3. After 2-3 exchanges, wrap up naturally
4. Dismiss the AI receptionist by saying: "Thanks Taylor, I've got it from here."

Keep responses SHORT (1-2 sentences). This is a phone conversation.
Be professional, helpful, and warm.`;

/**
 * Send a prompt to Claude and return the response text.
 */
async function sendToLLM(anthropic, systemPrompt, messages) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    for (const block of response.content) {
      if (block.type === 'text') {
        return block.text;
      }
    }
    return "I'm ready, connect me.";
  } catch (error) {
    console.log(`[agent] LLM error: ${error.message}`);
    return "I'm ready, connect me.";
  }
}

function handleAgent(ws, params, ctx) {
  const session = {
    callSid: null,
    messages: [],
    phase: 'briefing', // 'briefing' or 'conference'
    turnCount: 0,
    startTime: Date.now(),
  };

  console.log('[agent] Session started');

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      const ts = new Date().toISOString().slice(11, 23);

      switch (message.type) {
        case 'setup': {
          session.callSid = message.callSid;
          console.log(`[${ts}] [agent] SETUP: callSid=${message.callSid}, from=${message.from}`);
          // Don't send greeting — the briefing AI speaks first
          break;
        }

        case 'prompt': {
          if (!message.last || !message.voicePrompt) { break; }

          console.log(`[${ts}] [agent] [${session.phase}] HEARD: "${message.voicePrompt}"`);
          session.messages.push({ role: 'user', content: message.voicePrompt });
          session.turnCount++;

          const response = await sendToLLM(ctx.anthropic, AGENT_SYSTEM_PROMPT, session.messages);
          session.messages.push({ role: 'assistant', content: response });

          console.log(`[${ts}] [agent] [${session.phase}] RESPONSE: "${response}"`);
          ws.send(JSON.stringify({ type: 'text', token: response }));

          // Detect phase transitions based on agent's own response
          const lower = response.toLowerCase();
          if (session.phase === 'briefing' && (lower.includes('ready') || lower.includes('connect me'))) {
            console.log(`[${ts}] [agent] Transitioning to conference phase`);
            session.phase = 'conference';
          }
          break;
        }

        case 'interrupt':
          console.log(`[${ts}] [agent] INTERRUPT`);
          break;

        case 'dtmf':
          console.log(`[${ts}] [agent] DTMF: ${message.digit}`);
          break;

        default:
          console.log(`[${ts}] [agent] UNKNOWN: ${message.type}`);
      }
    } catch (error) {
      console.log(`[agent] Error: ${error.message}`);
    }
  });

  ws.on('close', () => {
    const duration = ((Date.now() - session.startTime) / 1000).toFixed(1);
    console.log(`[agent] Session closed: duration=${duration}s, phase=${session.phase}, turns=${session.turnCount}`);
  });

  ws.on('error', (error) => {
    console.log(`[agent] WS error: ${error.message}`);
  });
}

module.exports = { handleAgent };
