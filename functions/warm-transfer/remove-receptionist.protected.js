// ABOUTME: Removes the AI receptionist from the warm transfer conference after agent dismissal.
// ABOUTME: Finds the conference by name, removes the participant, and updates Sync status to dismissed.

exports.handler = async (context, event, callback) => {
  const client = context.getTwilioClient();

  // Validate required parameters
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

  if (!event.ReceptionistCallSid) {
    const response = new Twilio.Response();
    response.setStatusCode(400);
    response.appendHeader('Content-Type', 'application/json');
    response.setBody(JSON.stringify({
      success: false,
      error: 'Missing required parameter: ReceptionistCallSid',
    }));
    return callback(null, response);
  }

  const { ConferenceName, ReceptionistCallSid } = event;

  try {
    // Find the conference by friendly name
    const conferences = await client.conferences.list({
      friendlyName: ConferenceName,
      status: 'in-progress',
      limit: 1,
    });

    if (conferences.length === 0) {
      const response = new Twilio.Response();
      response.setStatusCode(404);
      response.appendHeader('Content-Type', 'application/json');
      response.setBody(JSON.stringify({
        success: false,
        error: 'Conference not found or not in progress',
      }));
      return callback(null, response);
    }

    const conferenceSid = conferences[0].sid;

    // Remove the receptionist participant
    await client.conferences(conferenceSid)
      .participants(ReceptionistCallSid)
      .update({ status: 'completed' });

    // Update Sync doc status to dismissed (fetch-then-merge to preserve existing fields)
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
          data: { ...doc.data, status: 'dismissed', dismissedAt: new Date().toISOString() },
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
    console.log('Remove receptionist error:', err.message);
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
