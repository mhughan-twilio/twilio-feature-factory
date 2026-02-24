// ABOUTME: Unit tests for the start-test warm transfer function.
// ABOUTME: Tests env var validation, outbound call creation for end-to-end test orchestration.

const mockCallsCreate = jest.fn();

jest.mock('twilio', () => {
  const TwilioMock = jest.fn(() => ({
    calls: {
      create: mockCallsCreate,
    },
  }));

  TwilioMock.Response = class {
    constructor() {
      this.statusCode = 200;
      this.body = '';
      this.headers = {};
    }
    setStatusCode(code) { this.statusCode = code; }
    setBody(body) { this.body = typeof body === 'object' ? JSON.stringify(body) : body; }
    appendHeader(key, value) { this.headers[key] = value; }
  };

  return TwilioMock;
});

const Twilio = require('twilio');

global.Twilio = Twilio;

describe('start-test handler', () => {
  let context;
  let callback;
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCallsCreate.mockResolvedValue({
      sid: 'CA_test_call_123',
      status: 'queued',
    });

    context = {
      TWILIO_PHONE_NUMBER: '+15551234567',
      DOMAIN_NAME: 'test-dev.twil.io',
      WT_RECEPTIONIST_NUMBER: '+15553333333',
      WT_CALLER_AI_RELAY_URL: 'wss://test-server.ngrok.dev/caller',
      WT_RECEPTIONIST_RELAY_URL: 'wss://test-server.ngrok.dev/receptionist',
      WT_BRIEFING_RELAY_URL: 'wss://test-server.ngrok.dev/briefing',
      WT_AGENT_AI_RELAY_URL: 'wss://test-server.ngrok.dev/agent',
      WT_AGENT_ALICE_NUMBER: '+15551111111',
      WT_AGENT_BOB_NUMBER: '+15552222222',
      getTwilioClient: () => new Twilio(),
    };
    callback = jest.fn();

    handler = require('../../../functions/warm-transfer/start-test.protected').handler;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('env var validation', () => {
    it('should return error when WT_RECEPTIONIST_NUMBER is missing', async () => {
      delete context.WT_RECEPTIONIST_NUMBER;
      const event = global.createTestEvent({});

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('WT_RECEPTIONIST_NUMBER');
    });

    it('should return error when WT_CALLER_AI_RELAY_URL is missing', async () => {
      delete context.WT_CALLER_AI_RELAY_URL;
      const event = global.createTestEvent({});

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('outbound call creation', () => {
    it('should create outbound call to receptionist number', async () => {
      const event = global.createTestEvent({});

      await handler(context, event, callback);

      expect(mockCallsCreate).toHaveBeenCalledTimes(1);
      const params = mockCallsCreate.mock.calls[0][0];
      expect(params.to).toBe('+15553333333');
      expect(params.from).toBe('+15551234567');
    });

    it('should point call URL to caller-ai-relay for two independent TwiML legs', async () => {
      const event = global.createTestEvent({});

      await handler(context, event, callback);

      const params = mockCallsCreate.mock.calls[0][0];
      expect(params.url).toContain('caller-ai-relay');
    });

    it('should return success with callSid', async () => {
      const event = global.createTestEvent({});

      await handler(context, event, callback);

      const [error, response] = callback.mock.calls[0];
      expect(error).toBeNull();
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.callSid).toBe('CA_test_call_123');
    });
  });

  describe('error handling', () => {
    it('should handle call creation failure', async () => {
      mockCallsCreate.mockRejectedValue(new Error('Rate limited'));

      const event = global.createTestEvent({});

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Rate limited');
    });
  });
});
