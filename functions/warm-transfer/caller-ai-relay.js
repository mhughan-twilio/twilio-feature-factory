// ABOUTME: Returns ConversationRelay TwiML for the simulated test caller in warm transfer E2E tests.
// ABOUTME: Connects the caller AI agent to its WebSocket handler for automated testing.

exports.handler = async (context, event, callback) => {
  const twiml = new Twilio.twiml.VoiceResponse();

  const connect = twiml.connect();
  connect.conversationRelay({
    url: context.WT_CALLER_AI_RELAY_URL,
    voice: 'Google.en-US-Neural2-J',
    language: 'en-US',
    dtmfDetection: 'true',
    interruptible: 'true',
  });

  return callback(null, twiml);
};
