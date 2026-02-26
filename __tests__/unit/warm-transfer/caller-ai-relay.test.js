// ABOUTME: Unit tests for the caller-ai-relay warm transfer function.
// ABOUTME: Tests ConversationRelay TwiML generation for simulated test caller.

const Twilio = require('twilio');

global.Twilio = Twilio;

const { handler } = require('../../../functions/warm-transfer/caller-ai-relay');

describe('caller-ai-relay handler', () => {
  let context;
  let callback;

  beforeEach(() => {
    context = {
      ...global.createTestContext(),
      WT_CALLER_AI_RELAY_URL: 'wss://test-server.ngrok.dev/caller',
    };
    callback = jest.fn();
  });

  it('should return valid TwiML response', async () => {
    const event = global.createTestEvent({});

    await handler(context, event, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const [error, response] = callback.mock.calls[0];
    expect(error).toBeNull();
    const twiml = response.toString();
    expect(twiml).toContain('<Response>');
  });

  it('should include Connect and ConversationRelay elements', async () => {
    const event = global.createTestEvent({});

    await handler(context, event, callback);

    const [, response] = callback.mock.calls[0];
    const twiml = response.toString();
    expect(twiml).toContain('<Connect>');
    expect(twiml).toContain('<ConversationRelay');
  });

  it('should use Google Neural voice', async () => {
    const event = global.createTestEvent({});

    await handler(context, event, callback);

    const [, response] = callback.mock.calls[0];
    const twiml = response.toString();
    expect(twiml).toContain('voice="Google.en-US-Neural2-F"');
  });

  it('should use configured WT_CALLER_AI_RELAY_URL', async () => {
    const event = global.createTestEvent({});

    await handler(context, event, callback);

    const [, response] = callback.mock.calls[0];
    const twiml = response.toString();
    expect(twiml).toContain('wss://test-server.ngrok.dev/caller');
  });
});
