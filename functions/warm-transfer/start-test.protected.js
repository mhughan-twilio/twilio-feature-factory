// ABOUTME: Test orchestrator that initiates a warm transfer E2E test with all AI agents.
// ABOUTME: Validates required env vars and creates an outbound call to the receptionist number.

exports.handler = async (context, event, callback) => {
  const client = context.getTwilioClient();

  // Validate required environment variables
  const requiredEnvVars = ['WT_RECEPTIONIST_NUMBER', 'WT_CALLER_AI_RELAY_URL'];
  for (const envVar of requiredEnvVars) {
    if (!context[envVar]) {
      const response = new Twilio.Response();
      response.setStatusCode(400);
      response.appendHeader('Content-Type', 'application/json');
      response.setBody(JSON.stringify({
        success: false,
        error: `Missing required environment variable: ${envVar}`,
      }));
      return callback(null, response);
    }
  }

  try {
    // Create outbound call to the receptionist number
    // The URL points to caller-ai-relay, which creates two independent TwiML legs:
    // - Parent leg runs caller-ai-relay TwiML (simulated caller)
    // - Child leg runs the receptionist number's voice webhook (welcome.js)
    const callerAiUrl = `https://${context.DOMAIN_NAME}/warm-transfer/caller-ai-relay`;

    const call = await client.calls.create({
      to: context.WT_RECEPTIONIST_NUMBER,
      from: context.TWILIO_PHONE_NUMBER,
      url: callerAiUrl,
    });

    console.log(`Warm transfer test call created: ${call.sid}`);

    const response = new Twilio.Response();
    response.setStatusCode(200);
    response.appendHeader('Content-Type', 'application/json');
    response.setBody(JSON.stringify({
      success: true,
      callSid: call.sid,
    }));
    return callback(null, response);
  } catch (err) {
    console.log('Start test error:', err.message);
    const response = new Twilio.Response();
    response.setStatusCode(500);
    response.appendHeader('Content-Type', 'application/json');
    response.setBody(JSON.stringify({
      success: false,
      error: err.message,
    }));
    return callback(null, response);
  }
};
