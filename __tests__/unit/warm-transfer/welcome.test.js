// ABOUTME: Unit tests for the welcome warm transfer function.
// ABOUTME: Tests conference TwiML generation and AI participant addition for inbound calls.

const mockCallsCreate = jest.fn();

jest.mock('twilio', () => {
  const TwilioMock = jest.fn(() => ({
    calls: {
      create: mockCallsCreate,
    },
  }));

  // Keep twiml namespace from real Twilio for TwiML generation
  const realTwilio = jest.requireActual('twilio');
  TwilioMock.twiml = realTwilio.twiml;

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

describe('welcome handler', () => {
  let context;
  let callback;
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCallsCreate.mockResolvedValue({
      sid: 'CA1234567890abcdef1234567890abcdef',
      status: 'queued',
    });

    context = {
      TWILIO_PHONE_NUMBER: '+15551234567',
      DOMAIN_NAME: 'test-dev.twil.io',
      WT_RECEPTIONIST_RELAY_URL: 'wss://test-server.ngrok.dev/receptionist',
      getTwilioClient: () => new Twilio(),
    };
    callback = jest.fn();

    handler = require('../../../functions/warm-transfer/welcome').handler;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should return valid TwiML with Conference', async () => {
    const event = global.createTestEvent({
      CallSid: 'CA_caller_123',
      From: '+15559876543',
    });

    await handler(context, event, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const [error, response] = callback.mock.calls[0];
    expect(error).toBeNull();

    const twiml = response.toString();
    expect(twiml).toContain('<Dial>');
    expect(twiml).toContain('<Conference');
  });

  it('should generate conference name with wt- prefix', async () => {
    const event = global.createTestEvent({
      CallSid: 'CA_caller_123',
      From: '+15559876543',
    });

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1].toString();
    expect(twiml).toMatch(/wt-\d+-[a-z0-9]+/);
  });

  it('should set conference attributes correctly', async () => {
    const event = global.createTestEvent({
      CallSid: 'CA_caller_123',
      From: '+15559876543',
    });

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1].toString();
    expect(twiml).toContain('startConferenceOnEnter="true"');
    expect(twiml).toContain('endConferenceOnExit="true"');
    expect(twiml).toContain('beep="false"');
  });

  it('should add AI participant via calls.create', async () => {
    const event = global.createTestEvent({
      CallSid: 'CA_caller_123',
      From: '+15559876543',
    });

    await handler(context, event, callback);

    expect(mockCallsCreate).toHaveBeenCalledTimes(1);
    const params = mockCallsCreate.mock.calls[0][0];
    expect(params.from).toBe('+15551234567');
    expect(params.url).toContain('receptionist-relay');
    expect(params.url).toContain('ConferenceName=');
  });

  it('should include timeLimit on conference', async () => {
    const event = global.createTestEvent({
      CallSid: 'CA_caller_123',
      From: '+15559876543',
    });

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1].toString();
    // Conference should have a time limit to prevent runaway calls
    expect(twiml).toContain('timeLimit=');
  });

  it('should handle calls.create failure gracefully', async () => {
    mockCallsCreate.mockRejectedValue(new Error('API error'));
    const event = global.createTestEvent({
      CallSid: 'CA_caller_123',
      From: '+15559876543',
    });

    await handler(context, event, callback);

    // Should still return TwiML (caller is already in conference)
    expect(callback).toHaveBeenCalledTimes(1);
    const [error] = callback.mock.calls[0];
    expect(error).toBeNull();
  });
});
