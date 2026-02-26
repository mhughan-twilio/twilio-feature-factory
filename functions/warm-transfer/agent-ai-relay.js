// ABOUTME: Returns ConversationRelay TwiML for the simulated test agent in warm transfer E2E tests.
// ABOUTME: Passes ConferenceName as a query param to the WebSocket URL for session tracking.

exports.handler = async (context, event, callback) => {
  const twiml = new Twilio.twiml.VoiceResponse();
  const conferenceName = event.ConferenceName || '';

  const baseUrl = context.WT_AGENT_AI_RELAY_URL;
  const wsUrl = conferenceName
    ? `${baseUrl}?ConferenceName=${conferenceName}`
    : baseUrl;

  const connect = twiml.connect();
  connect.conversationRelay({
    url: wsUrl,
    voice: 'Google.en-US-Neural2-D',
    language: 'en-US',
    dtmfDetection: 'true',
    interruptible: 'true',
  });

  return callback(null, twiml);
};
