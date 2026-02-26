// ABOUTME: Unit tests for the bridge-agent warm transfer function.
// ABOUTME: Tests call update with conference TwiML and Sync status update to bridged.

const mockCallUpdate = jest.fn();
const mockSyncFetch = jest.fn();
const mockSyncUpdate = jest.fn();

jest.mock('twilio', () => {
  const TwilioMock = jest.fn(() => ({
    calls: jest.fn(() => ({
      update: mockCallUpdate,
    })),
    sync: {
      v1: {
        services: jest.fn(() => ({
          documents: jest.fn(() => ({
            fetch: mockSyncFetch,
            update: mockSyncUpdate,
          })),
        })),
      },
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

  TwilioMock.twiml = {
    VoiceResponse: class {
      constructor() { this._parts = []; }
      say(attrs, text) { this._parts.push(`<Say voice="${attrs.voice}">${text}</Say>`); }
      dial() {
        const dialParts = this._parts;
        const dialObj = {
          conference(attrs, name) {
            const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
            dialParts.push(`<Dial><Conference ${attrStr}>${name}</Conference></Dial>`);
          },
        };
        return dialObj;
      }
      toString() {
        return `<?xml version="1.0" encoding="UTF-8"?><Response>${this._parts.join('')}</Response>`;
      }
    },
  };

  return TwilioMock;
});

const Twilio = require('twilio');

global.Twilio = Twilio;

describe('bridge-agent handler', () => {
  let context;
  let callback;
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCallUpdate.mockResolvedValue({ sid: 'CA_agent_123' });
    mockSyncFetch.mockResolvedValue({
      data: {
        conferenceName: 'wt-1234-abc',
        agentName: 'Alice',
        callerIssue: 'billing question',
      },
    });
    mockSyncUpdate.mockResolvedValue({ sid: 'ET1234' });

    context = {
      TWILIO_SYNC_SERVICE_SID: 'IS1234567890',
      getTwilioClient: () => new Twilio(),
    };
    callback = jest.fn();

    handler = require('../../../functions/warm-transfer/bridge-agent.protected').handler;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('parameter validation', () => {
    it('should return 400 when AgentCallSid is missing', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
      });

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('AgentCallSid');
    });

    it('should return 400 when ConferenceName is missing', async () => {
      const event = global.createTestEvent({
        AgentCallSid: 'CA_agent_123',
      });

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('ConferenceName');
    });
  });

  describe('call update', () => {
    it('should update agent call with TwiML containing Say and Conference', async () => {
      const event = global.createTestEvent({
        AgentCallSid: 'CA_agent_123',
        ConferenceName: 'wt-1234-abc',
      });

      await handler(context, event, callback);

      expect(mockCallUpdate).toHaveBeenCalledTimes(1);
      const updateParams = mockCallUpdate.mock.calls[0][0];
      expect(updateParams.twiml).toContain('<Say');
      expect(updateParams.twiml).toContain('<Dial>');
      expect(updateParams.twiml).toContain('<Conference');
      expect(updateParams.twiml).toContain('wt-1234-abc');
    });

    it('should set endConferenceOnExit to false for agent', async () => {
      const event = global.createTestEvent({
        AgentCallSid: 'CA_agent_123',
        ConferenceName: 'wt-1234-abc',
      });

      await handler(context, event, callback);

      const updateParams = mockCallUpdate.mock.calls[0][0];
      expect(updateParams.twiml).toContain('endConferenceOnExit="false"');
    });

    it('should return success on valid request', async () => {
      const event = global.createTestEvent({
        AgentCallSid: 'CA_agent_123',
        ConferenceName: 'wt-1234-abc',
      });

      await handler(context, event, callback);

      const [error, response] = callback.mock.calls[0];
      expect(error).toBeNull();
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('Sync status update', () => {
    it('should update Sync doc status to bridged', async () => {
      const event = global.createTestEvent({
        AgentCallSid: 'CA_agent_123',
        ConferenceName: 'wt-1234-abc',
      });

      await handler(context, event, callback);

      expect(mockSyncFetch).toHaveBeenCalledTimes(1);
      expect(mockSyncUpdate).toHaveBeenCalledTimes(1);
      const updateParams = mockSyncUpdate.mock.calls[0][0];
      expect(updateParams.data.status).toBe('bridged');
      // Verify existing fields are preserved (fetch-then-merge)
      expect(updateParams.data.agentName).toBe('Alice');
      expect(updateParams.data.callerIssue).toBe('billing question');
      expect(updateParams.data.bridgedAt).toBeDefined();
    });

    it('should still return success when Sync fetch fails (non-fatal)', async () => {
      mockSyncFetch.mockRejectedValue(new Error('Sync service unavailable'));

      const event = global.createTestEvent({
        AgentCallSid: 'CA_agent_123',
        ConferenceName: 'wt-1234-abc',
      });

      await handler(context, event, callback);

      const [error, response] = callback.mock.calls[0];
      expect(error).toBeNull();
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle call update failure', async () => {
      mockCallUpdate.mockRejectedValue(new Error('Call not found'));

      const event = global.createTestEvent({
        AgentCallSid: 'CA_agent_123',
        ConferenceName: 'wt-1234-abc',
      });

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Call not found');
    });
  });
});
