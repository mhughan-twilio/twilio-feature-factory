// ABOUTME: Integration tests for dismissal phrase detection in the receptionist handler.
// ABOUTME: Tests detection of agent dismissal phrases during the conference phase.

const { detectDismissalPhrase } = require('../../../__tests__/e2e/warm-transfer/receptionist-handler');

describe('Dismissal Phrase Detection', () => {
  describe('standard dismissal phrases', () => {
    it('should detect "thanks, I\'ve got it"', () => {
      expect(detectDismissalPhrase("Thanks, I've got it")).toBe(true);
    });

    it('should detect "I\'ll take it from here"', () => {
      expect(detectDismissalPhrase("I'll take it from here")).toBe(true);
    });

    it('should detect "thanks, I can take it from here"', () => {
      expect(detectDismissalPhrase('Thanks, I can take it from here')).toBe(true);
    });

    it('should detect "I\'ve got it from here"', () => {
      expect(detectDismissalPhrase("I've got it from here")).toBe(true);
    });
  });

  describe('case insensitivity', () => {
    it('should detect dismissal phrases case-insensitively', () => {
      expect(detectDismissalPhrase("THANKS, I'VE GOT IT")).toBe(true);
      expect(detectDismissalPhrase("i'll take it from here")).toBe(true);
    });
  });

  describe('phrases with agent/receptionist name', () => {
    it('should detect "Thanks Sarah, I\'ve got it" with receptionist name', () => {
      expect(detectDismissalPhrase("Thanks Sarah, I've got it")).toBe(true);
    });

    it('should detect "Thank you, I\'ll take it from here"', () => {
      expect(detectDismissalPhrase("Thank you, I'll take it from here")).toBe(true);
    });
  });

  describe('non-dismissal phrases', () => {
    it('should not detect casual thanks', () => {
      expect(detectDismissalPhrase('Thanks for the context')).toBe(false);
    });

    it('should not detect unrelated phrases', () => {
      expect(detectDismissalPhrase('Can you tell me more about the billing issue?')).toBe(false);
    });

    it('should not detect partial phrases without dismissal keywords', () => {
      expect(detectDismissalPhrase("I've got a question about that")).toBe(false);
    });
  });
});
