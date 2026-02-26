// ABOUTME: Returns ConversationRelay TwiML for the AI receptionist participant in a warm transfer.
// ABOUTME: Passes ConferenceName as a query param to the WebSocket URL for session tracking.

exports.handler = async (context, event, callback) => {
  const twiml = new Twilio.twiml.VoiceResponse();
  const conferenceName = event.ConferenceName || '';

  const baseUrl = context.WT_RECEPTIONIST_RELAY_URL;
  const wsUrl = conferenceName
    ? `${baseUrl}?ConferenceName=${conferenceName}`
    : baseUrl;

  // Start background recording for debugging
  const domainName = context.DOMAIN_NAME;
  if (domainName) {
    const start = twiml.start();
    start.recording({
      recordingStatusCallback: `https://${domainName}/callbacks/call-status`,
      recordingStatusCallbackEvent: 'completed',
    });
  }

  const connect = twiml.connect();
  connect.conversationRelay({
    url: wsUrl,
    voice: 'Google.en-US-Neural2-F',
    language: 'en-US',
    dtmfDetection: 'true',
    interruptible: 'true',
  });

  return callback(null, twiml);
};
