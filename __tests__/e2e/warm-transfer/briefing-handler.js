// ABOUTME: WebSocket handler for the agent briefing call in the warm transfer flow.
// ABOUTME: Exports detectReadySignal for detecting when the agent is ready to join the conference.

/**
 * Speech patterns that indicate the agent is ready to be bridged into the conference.
 */
const READY_PHRASES = [
  /\bready\b/i,
  /\bconnect me\b/i,
  /\bi['']m ready\b/i,
];

/**
 * Detect if a WebSocket message contains a ready signal from the agent.
 * Supports both speech (prompt with last=true) and DTMF (digit 1) signals.
 */
function detectReadySignal(message) {
  // DTMF: digit 1 means ready
  if (message.type === 'dtmf') {
    return message.digit === '1';
  }

  // Speech: only final utterances (last=true) count
  if (message.type === 'prompt' && message.last === true) {
    const text = (message.voicePrompt || '').toLowerCase();
    return READY_PHRASES.some(pattern => pattern.test(text));
  }

  return false;
}

module.exports = {
  detectReadySignal,
};
