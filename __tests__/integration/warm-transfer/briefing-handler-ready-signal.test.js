// ABOUTME: Integration tests for briefing handler ready signal detection.
// ABOUTME: Tests detection of speech and DTMF ready signals from the agent during briefing.

const { detectReadySignal } = require('../../../__tests__/e2e/warm-transfer/briefing-handler');

describe('Briefing Handler Ready Signal Detection', () => {
  describe('speech-based ready signals', () => {
    it('should detect "ready" as a ready signal', () => {
      expect(detectReadySignal({ type: 'prompt', voicePrompt: 'ready', last: true })).toBe(true);
    });

    it('should detect "connect me" as a ready signal', () => {
      expect(detectReadySignal({ type: 'prompt', voicePrompt: 'connect me', last: true })).toBe(true);
    });

    it('should detect "I\'m ready" as a ready signal', () => {
      expect(detectReadySignal({ type: 'prompt', voicePrompt: "I'm ready", last: true })).toBe(true);
    });

    it('should detect ready signal case-insensitively', () => {
      expect(detectReadySignal({ type: 'prompt', voicePrompt: 'READY', last: true })).toBe(true);
      expect(detectReadySignal({ type: 'prompt', voicePrompt: 'Connect Me', last: true })).toBe(true);
      expect(detectReadySignal({ type: 'prompt', voicePrompt: "I'M READY", last: true })).toBe(true);
    });

    it('should detect partial phrase match', () => {
      expect(detectReadySignal({
        type: 'prompt',
        voicePrompt: "I'm ready, connect me now",
        last: true,
      })).toBe(true);
    });

    it('should detect "I\'m ready, connect me" as a compound ready signal', () => {
      expect(detectReadySignal({
        type: 'prompt',
        voicePrompt: "Yes, I'm ready. Please connect me to the caller.",
        last: true,
      })).toBe(true);
    });

    it('should not detect random speech as ready signal', () => {
      expect(detectReadySignal({
        type: 'prompt',
        voicePrompt: 'Tell me more about the issue',
        last: true,
      })).toBe(false);
    });

    it('should not detect partial utterances (last=false) as ready signals', () => {
      expect(detectReadySignal({
        type: 'prompt',
        voicePrompt: 'ready',
        last: false,
      })).toBe(false);
    });
  });

  describe('DTMF-based ready signals', () => {
    it('should detect DTMF digit 1 as ready signal', () => {
      expect(detectReadySignal({ type: 'dtmf', digit: '1' })).toBe(true);
    });

    it('should not detect other DTMF digits as ready signal', () => {
      expect(detectReadySignal({ type: 'dtmf', digit: '2' })).toBe(false);
      expect(detectReadySignal({ type: 'dtmf', digit: '0' })).toBe(false);
      expect(detectReadySignal({ type: 'dtmf', digit: '#' })).toBe(false);
    });
  });

  describe('non-signal messages', () => {
    it('should not treat setup messages as ready signals', () => {
      expect(detectReadySignal({ type: 'setup', callSid: 'CA123' })).toBe(false);
    });

    it('should not treat interrupt messages as ready signals', () => {
      expect(detectReadySignal({ type: 'interrupt' })).toBe(false);
    });
  });
});
