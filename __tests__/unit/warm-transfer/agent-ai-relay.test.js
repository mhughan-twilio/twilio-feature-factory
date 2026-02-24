// ABOUTME: Unit tests for the agent-ai-relay warm transfer function.
// ABOUTME: Tests ConversationRelay TwiML generation for simulated test agent with conference name.

const Twilio = require('twilio');

global.Twilio = Twilio;

const { handler } = require('../../../functions/warm-transfer/agent-ai-relay');

describe('agent-ai-relay handler', () => {
  let context;
  let callback;

  beforeEach(() => {
    context = {
      ...global.createTestContext(),
      WT_AGENT_AI_RELAY_URL: 'wss://test-server.ngrok.dev/agent',
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

  it('should include Connect and ConversationRelay elements', async () => {
    const event = global.createTestEvent({ ConferenceName: 'wt-1234-abc' });

    await handler(context, event, callback);

    const [, response] = callback.mock.calls[0];
    const twiml = response.toString();
    expect(twiml).toContain('<Connect>');
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
    expect(twiml).toContain('wss://test-server.ngrok.dev/agent');
    expect(twiml).toContain('ConferenceName=wt-1234-abc');
  });

  it('should use configured WT_AGENT_AI_RELAY_URL', async () => {
    context.WT_AGENT_AI_RELAY_URL = 'wss://custom-server.ngrok.dev/agent';
    const event = global.createTestEvent({ ConferenceName: 'wt-1234-abc' });

    await handler(context, event, callback);

    const [, response] = callback.mock.calls[0];
    const twiml = response.toString();
    expect(twiml).toContain('wss://custom-server.ngrok.dev/agent');
  });
});
