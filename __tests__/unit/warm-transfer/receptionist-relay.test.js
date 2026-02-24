// ABOUTME: Unit tests for the receptionist-relay warm transfer function.
// ABOUTME: Tests ConversationRelay TwiML generation with conference name parameter.

const Twilio = require('twilio');

global.Twilio = Twilio;

const { handler } = require('../../../functions/warm-transfer/receptionist-relay');

describe('receptionist-relay handler', () => {
  let context;
  let callback;

  beforeEach(() => {
    context = {
      ...global.createTestContext(),
      WT_RECEPTIONIST_RELAY_URL: 'wss://test-server.ngrok.dev/receptionist',
    };
    callback = jest.fn();
  });

  it('should return valid TwiML response', async () => {
    const event = global.createTestEvent({ ConferenceName: 'wt-1234-abc' });

    await handler(context, event, callback);

    expect(callback).toHaveBeenCalledTimes(1);
    const [error, response] = callback.mock.calls[0];
    expect(error).toBeNull();
    expect(response).toBeDefined();
  });

  it('should include Connect element', async () => {
    const event = global.createTestEvent({ ConferenceName: 'wt-1234-abc' });

    await handler(context, event, callback);

    const [, response] = callback.mock.calls[0];
    const twiml = response.toString();
    expect(twiml).toContain('<Connect>');
  });

  it('should include ConversationRelay element', async () => {
    const event = global.createTestEvent({ ConferenceName: 'wt-1234-abc' });

    await handler(context, event, callback);

    const [, response] = callback.mock.calls[0];
    const twiml = response.toString();
    expect(twiml).toContain('<ConversationRelay');
  });

  it('should use Google Neural voice', async () => {
    const event = global.createTestEvent({ ConferenceName: 'wt-1234-abc' });

    await handler(context, event, callback);

    const [, response] = callback.mock.calls[0];
    const twiml = response.toString();
    expect(twiml).toContain('voice="Google.en-US-Neural2-F"');
  });

  it('should include ConferenceName as query param in WebSocket URL', async () => {
    const event = global.createTestEvent({ ConferenceName: 'wt-1234-abc' });

    await handler(context, event, callback);

    const [, response] = callback.mock.calls[0];
    const twiml = response.toString();
    expect(twiml).toContain('wss://test-server.ngrok.dev/receptionist');
    expect(twiml).toContain('ConferenceName=wt-1234-abc');
  });

  it('should use configured WT_RECEPTIONIST_RELAY_URL', async () => {
    context.WT_RECEPTIONIST_RELAY_URL = 'wss://custom-server.ngrok.dev/receptionist';
    const event = global.createTestEvent({ ConferenceName: 'wt-1234-abc' });

    await handler(context, event, callback);

    const [, response] = callback.mock.calls[0];
    const twiml = response.toString();
    expect(twiml).toContain('wss://custom-server.ngrok.dev/receptionist');
  });
});
