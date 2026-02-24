// ABOUTME: WebSocket handler for the AI receptionist in the warm transfer flow.
// ABOUTME: Exports ReceptionistStateMachine, detectDismissalPhrase, and detectTransferTrigger.

/**
 * Valid state transitions for the receptionist state machine.
 */
const VALID_TRANSITIONS = {
  INTAKE: ['TRANSFERRING'],
  TRANSFERRING: ['HOLD_CHAT'],
  HOLD_CHAT: ['CONFERENCE'],
  CONFERENCE: ['DISMISSED'],
  DISMISSED: [],
};

/**
 * State machine for the receptionist's lifecycle during a warm transfer call.
 * States: INTAKE → TRANSFERRING → HOLD_CHAT → CONFERENCE → DISMISSED
 */
class ReceptionistStateMachine {
  constructor() {
    this.state = 'INTAKE';
    this.context = {};
  }

  /**
   * Transition to a new state, optionally merging context data.
   * Throws if the transition is invalid.
   */
  transition(newState, contextData = {}) {
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed || !allowed.includes(newState)) {
      throw new Error(`Invalid transition from ${this.state} to ${newState}`);
    }
    this.state = newState;
    this.context = { ...this.context, ...contextData };
  }
}

/**
 * Detect if the agent has used a dismissal phrase indicating the receptionist should leave.
 * Looks for patterns like "I've got it", "take it from here" combined with gratitude.
 */
function detectDismissalPhrase(text) {
  const lower = text.toLowerCase();

  // Dismissal patterns: must contain a "got it" or "take it from here" variant
  const dismissalPatterns = [
    /i['']ve got it/i,
    /i['']ll take it from here/i,
    /i can take it from here/i,
    /got it from here/i,
  ];

  for (const pattern of dismissalPatterns) {
    if (pattern.test(lower)) {
      return true;
    }
  }

  // Combined thanks + take from here
  if (/thank/i.test(lower) && /take it from here/i.test(lower)) {
    return true;
  }

  return false;
}

/**
 * Detect if the receptionist AI's response contains a transfer trigger phrase,
 * and extract the agent name.
 * Returns { triggered: boolean, agentName?: string }
 */
function detectTransferTrigger(text) {
  const lower = text.toLowerCase();

  // Patterns that indicate the AI is initiating a transfer, with agent name capture
  const patterns = [
    /connect you with\s+(\w+)/i,
    /transfer you to\s+(\w+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Verify this is in a transfer context (not a question)
      if (/hold|transfer|connect/i.test(lower) && !/would you like|do you want/i.test(lower)) {
        return { triggered: true, agentName: match[1] };
      }
    }
  }

  return { triggered: false };
}

module.exports = {
  ReceptionistStateMachine,
  detectDismissalPhrase,
  detectTransferTrigger,
};
