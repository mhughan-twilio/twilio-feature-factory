// ABOUTME: Unit tests for the initiate-agent-call warm transfer function.
// ABOUTME: Tests parameter validation, Sync doc creation, agent name mapping, and outbound call creation.

const mockCallsCreate = jest.fn();
const mockSyncCreate = jest.fn();
const mockSyncUpdate = jest.fn();
const mockSyncFetch = jest.fn();

jest.mock('twilio', () => {
  const TwilioMock = jest.fn(() => ({
    calls: {
      create: mockCallsCreate,
    },
    sync: {
      v1: {
        services: jest.fn(() => ({
          documents: Object.assign(
            jest.fn(() => ({
              fetch: mockSyncFetch,
              update: mockSyncUpdate,
            })),
            {
              create: mockSyncCreate,
            }
          ),
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

  return TwilioMock;
});

const Twilio = require('twilio');

global.Twilio = Twilio;

describe('initiate-agent-call handler', () => {
  let context;
  let callback;
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCallsCreate.mockResolvedValue({
      sid: 'CA_agent_call_123',
      status: 'queued',
    });

    mockSyncCreate.mockResolvedValue({
      sid: 'ET1234',
      uniqueName: 'warm-transfer-wt-1234-abc',
    });

    context = {
      TWILIO_PHONE_NUMBER: '+15551234567',
      TWILIO_SYNC_SERVICE_SID: 'IS1234567890',
      DOMAIN_NAME: 'test-dev.twil.io',
      WT_AGENT_ALICE_NUMBER: '+15551111111',
      WT_AGENT_BOB_NUMBER: '+15552222222',
      WT_BRIEFING_RELAY_URL: 'wss://test-server.ngrok.dev/briefing',
      getTwilioClient: () => new Twilio(),
    };
    callback = jest.fn();

    handler = require('../../../functions/warm-transfer/initiate-agent-call.protected').handler;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('parameter validation', () => {
    it('should return 400 when ConferenceName is missing', async () => {
      const event = global.createTestEvent({
        AgentName: 'Alice',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('ConferenceName');
    });

    it('should return 400 when AgentName is missing', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('AgentName');
    });

    it('should return 400 when CallerIssue is missing', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'Alice',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('CallerIssue');
    });

    it('should return 400 when CallerCallSid is missing', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'Alice',
        CallerIssue: 'billing question',
      });

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('CallerCallSid');
    });
  });

  describe('agent name mapping', () => {
    it('should map "Alice" to WT_AGENT_ALICE_NUMBER', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'Alice',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      const params = mockCallsCreate.mock.calls[0][0];
      expect(params.to).toBe('+15551111111');
    });

    it('should map "Bob" to WT_AGENT_BOB_NUMBER', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'Bob',
        CallerIssue: 'delivery issue',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      const params = mockCallsCreate.mock.calls[0][0];
      expect(params.to).toBe('+15552222222');
    });

    it('should handle agent names case-insensitively', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'alice',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      const params = mockCallsCreate.mock.calls[0][0];
      expect(params.to).toBe('+15551111111');
    });

    it('should handle uppercase agent names', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'ALICE',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      const params = mockCallsCreate.mock.calls[0][0];
      expect(params.to).toBe('+15551111111');
    });

    it('should return 400 for unknown agent name', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'Charlie',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Unknown agent');
    });
  });

  describe('Sync document creation', () => {
    it('should create Sync doc with warm-transfer- prefix and conference name', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'Alice',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      expect(mockSyncCreate).toHaveBeenCalledTimes(1);
      const createParams = mockSyncCreate.mock.calls[0][0];
      expect(createParams.uniqueName).toBe('warm-transfer-wt-1234-abc');
    });

    it('should set Sync doc TTL to 86400', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'Alice',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      const createParams = mockSyncCreate.mock.calls[0][0];
      expect(createParams.ttl).toBe(86400);
    });

    it('should include caller context in Sync doc data', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'Alice',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      const createParams = mockSyncCreate.mock.calls[0][0];
      const data = createParams.data;
      expect(data.conferenceName).toBe('wt-1234-abc');
      expect(data.agentName).toBe('Alice');
      expect(data.callerIssue).toBe('billing question');
      expect(data.callerCallSid).toBe('CA_caller_123');
    });

    it('should handle Sync 54301 error gracefully (doc already exists)', async () => {
      const syncError = new Error('Unique name already exists');
      syncError.code = 54301;
      mockSyncCreate.mockRejectedValue(syncError);

      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'Alice',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      // Should still proceed to create the outbound call
      expect(mockCallsCreate).toHaveBeenCalledTimes(1);
      const [error] = callback.mock.calls[0];
      expect(error).toBeNull();
    });
  });

  describe('outbound call creation', () => {
    it('should create outbound call to agent number', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'Alice',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      expect(mockCallsCreate).toHaveBeenCalledTimes(1);
      const params = mockCallsCreate.mock.calls[0][0];
      expect(params.to).toBe('+15551111111');
      expect(params.from).toBe('+15551234567');
    });

    it('should point call URL to agent-briefing-relay with ConferenceName', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'Alice',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      const params = mockCallsCreate.mock.calls[0][0];
      expect(params.url).toContain('agent-briefing-relay');
      expect(params.url).toContain('ConferenceName=wt-1234-abc');
    });

    it('should return success with agentCallSid', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'Alice',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      const [error, response] = callback.mock.calls[0];
      expect(error).toBeNull();
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.agentCallSid).toBe('CA_agent_call_123');
    });

    it('should handle call creation failure', async () => {
      mockCallsCreate.mockRejectedValue(new Error('Invalid number'));

      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        AgentName: 'Alice',
        CallerIssue: 'billing question',
        CallerCallSid: 'CA_caller_123',
      });

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid number');
    });
  });
});
