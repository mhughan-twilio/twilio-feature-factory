// ABOUTME: Unit tests for the welcome warm transfer function.
// ABOUTME: Tests conference TwiML generation and AI participant addition via Participants API.

const mockNumbersList = jest.fn();
const mockNumberUpdate = jest.fn();
const mockParticipantsCreate = jest.fn();

jest.mock('twilio', () => {
  const mockConferences = jest.fn(() => ({
    participants: {
      create: mockParticipantsCreate,
    },
  }));

  const TwilioMock = jest.fn(() => ({
    incomingPhoneNumbers: {
      list: mockNumbersList,
    },
    conferences: mockConferences,
  }));

  // Attach update to the return of incomingPhoneNumbers()
  TwilioMock._mockNumberUpdate = mockNumberUpdate;
  const origTwilio = TwilioMock;
  const wrappedTwilio = jest.fn((...args) => {
    const instance = new origTwilio(...args);
    instance.incomingPhoneNumbers = jest.fn((_sid) => ({
      update: mockNumberUpdate,
    }));
    instance.incomingPhoneNumbers.list = mockNumbersList;
    return instance;
  });

  // Keep twiml namespace from real Twilio for TwiML generation
  const realTwilio = jest.requireActual('twilio');
  wrappedTwilio.twiml = realTwilio.twiml;

  wrappedTwilio.Response = class {
    constructor() {
      this.statusCode = 200;
      this.body = '';
      this.headers = {};
    }
    setStatusCode(code) { this.statusCode = code; }
    setBody(body) { this.body = typeof body === 'object' ? JSON.stringify(body) : body; }
    appendHeader(key, value) { this.headers[key] = value; }
  };

  return wrappedTwilio;
});

const Twilio = require('twilio');

global.Twilio = Twilio;

describe('welcome handler', () => {
  let context;
  let callback;
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNumbersList.mockResolvedValue([{ sid: 'PN_receptionist_123' }]);
    mockNumberUpdate.mockResolvedValue({});
    mockParticipantsCreate.mockResolvedValue({
      callSid: 'CA_ai_123',
      status: 'queued',
    });

    context = {
      TWILIO_PHONE_NUMBER: '+15551234567',
      WT_RECEPTIONIST_NUMBER: '+15559999999',
      DOMAIN_NAME: 'test-dev.twil.io',
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
    expect(twiml).toContain('<Dial');
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

  it('should add AI participant via Participants API', async () => {
    const event = global.createTestEvent({
      CallSid: 'CA_caller_123',
      From: '+15559876543',
    });

    await handler(context, event, callback);

    // Should update the number's voice URL with ConferenceName
    expect(mockNumberUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = mockNumberUpdate.mock.calls[0][0];
    expect(updateArgs.voiceUrl).toContain('receptionist-relay');
    expect(updateArgs.voiceUrl).toContain('ConferenceName=');

    // Should add participant via Participants API
    expect(mockParticipantsCreate).toHaveBeenCalledTimes(1);
    const params = mockParticipantsCreate.mock.calls[0][0];
    expect(params.from).toBe('+15551234567');
    expect(params.to).toBe('+15559999999');
  });

  it('should include timeLimit on Dial element', async () => {
    const event = global.createTestEvent({
      CallSid: 'CA_caller_123',
      From: '+15559876543',
    });

    await handler(context, event, callback);

    const twiml = callback.mock.calls[0][1].toString();
    expect(twiml).toContain('timeLimit=');
  });

  it('should handle participant creation failure gracefully', async () => {
    mockParticipantsCreate.mockRejectedValue(new Error('API error'));
    const event = global.createTestEvent({
      CallSid: 'CA_caller_123',
      From: '+15559876543',
    });

    await handler(context, event, callback);

    // Should still return TwiML (caller gets conference even if AI fails)
    expect(callback).toHaveBeenCalledTimes(1);
    const [error] = callback.mock.calls[0];
    expect(error).toBeNull();
  });
});
