// ABOUTME: Integration tests for transfer trigger phrase detection in the receptionist handler.
// ABOUTME: Tests detection of transfer intent phrases in the receptionist AI's own responses.

const { detectTransferTrigger } = require('../../../__tests__/e2e/warm-transfer/receptionist-handler');

describe('Transfer Trigger Phrase Detection', () => {
  describe('standard transfer phrases', () => {
    it('should detect "Please hold while I connect you with Alice"', () => {
      const result = detectTransferTrigger('Please hold while I connect you with Alice');
      expect(result.triggered).toBe(true);
      expect(result.agentName.toLowerCase()).toBe('alice');
    });

    it('should detect "Let me transfer you to Bob"', () => {
      const result = detectTransferTrigger('Let me transfer you to Bob');
      expect(result.triggered).toBe(true);
      expect(result.agentName.toLowerCase()).toBe('bob');
    });

    it('should detect "I\'ll connect you with Alice right away"', () => {
      const result = detectTransferTrigger("I'll connect you with Alice right away");
      expect(result.triggered).toBe(true);
      expect(result.agentName.toLowerCase()).toBe('alice');
    });
  });

  describe('agent name extraction', () => {
    it('should extract Alice from transfer phrase', () => {
      const result = detectTransferTrigger('Please hold while I connect you with Alice');
      expect(result.agentName.toLowerCase()).toBe('alice');
    });

    it('should extract Bob from transfer phrase', () => {
      const result = detectTransferTrigger('Let me transfer you to Bob');
      expect(result.agentName.toLowerCase()).toBe('bob');
    });
  });

  describe('case insensitivity', () => {
    it('should detect transfer phrases case-insensitively', () => {
      const result = detectTransferTrigger('PLEASE HOLD WHILE I CONNECT YOU WITH ALICE');
      expect(result.triggered).toBe(true);
    });
  });

  describe('non-transfer phrases', () => {
    it('should not detect greeting phrases', () => {
      const result = detectTransferTrigger('Hello! Welcome to our service. How can I help you today?');
      expect(result.triggered).toBe(false);
    });

    it('should not detect general hold phrases without agent name', () => {
      const result = detectTransferTrigger('Please hold for a moment');
      expect(result.triggered).toBe(false);
    });

    it('should not detect questions about agents', () => {
      const result = detectTransferTrigger('Would you like me to connect you with someone?');
      expect(result.triggered).toBe(false);
    });
  });
});
