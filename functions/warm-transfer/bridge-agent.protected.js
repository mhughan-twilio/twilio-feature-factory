// ABOUTME: Bridges an agent into the warm transfer conference by updating their call with conference TwiML.
// ABOUTME: Updates Sync doc status to bridged after successfully joining the agent to the conference.

exports.handler = async (context, event, callback) => {
  const client = context.getTwilioClient();

  // Validate required parameters
  if (!event.AgentCallSid) {
    const response = new Twilio.Response();
    response.setStatusCode(400);
    response.appendHeader('Content-Type', 'application/json');
    response.setBody(JSON.stringify({
      success: false,
      error: 'Missing required parameter: AgentCallSid',
    }));
    return callback(null, response);
  }

  if (!event.ConferenceName) {
    const response = new Twilio.Response();
    response.setStatusCode(400);
    response.appendHeader('Content-Type', 'application/json');
    response.setBody(JSON.stringify({
      success: false,
      error: 'Missing required parameter: ConferenceName',
    }));
    return callback(null, response);
  }

  const { AgentCallSid, ConferenceName } = event;

  try {
    // Build TwiML to join the conference with a brief intro
    const voiceResponse = new Twilio.twiml.VoiceResponse();
    voiceResponse.say({ voice: 'Google.en-US-Neural2-C' }, 'Connecting you to the caller now.');
    const dial = voiceResponse.dial({ timeLimit: 1800 });
    dial.conference({
      endConferenceOnExit: false,
      beep: false,
    }, ConferenceName);

    // Update the agent's call with conference-joining TwiML
    await client.calls(AgentCallSid).update({ twiml: voiceResponse.toString() });

    // Update Sync doc status to bridged (fetch-then-merge to preserve existing fields)
    try {
      const syncDocName = `warm-transfer-${ConferenceName}`;
      const doc = await client.sync.v1
        .services(context.TWILIO_SYNC_SERVICE_SID)
        .documents(syncDocName)
        .fetch();
      await client.sync.v1
        .services(context.TWILIO_SYNC_SERVICE_SID)
        .documents(syncDocName)
        .update({
          data: { ...doc.data, status: 'bridged', bridgedAt: new Date().toISOString() },
        });
    } catch (syncErr) {
      console.log('Sync update error (non-fatal):', syncErr.message);
    }

    const response = new Twilio.Response();
    response.setStatusCode(200);
    response.appendHeader('Content-Type', 'application/json');
    response.setBody(JSON.stringify({ success: true }));
    return callback(null, response);
  } catch (err) {
    console.log('Bridge agent error:', err.message);
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
