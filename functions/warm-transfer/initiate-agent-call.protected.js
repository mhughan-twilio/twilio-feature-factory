// ABOUTME: Initiates an outbound call to the requested agent and writes transfer context to Sync.
// ABOUTME: Maps agent names case-insensitively and validates all required parameters.

exports.handler = async (context, event, callback) => {
  const client = context.getTwilioClient();

  // Validate required parameters
  const required = ['ConferenceName', 'AgentName'];
  for (const param of required) {
    if (!event[param]) {
      const response = new Twilio.Response();
      response.setStatusCode(400);
      response.appendHeader('Content-Type', 'application/json');
      response.setBody(JSON.stringify({
        success: false,
        error: `Missing required parameter: ${param}`,
      }));
      return callback(null, response);
    }
  }

  const { ConferenceName, AgentName, CallerIssue, CallerCallSid } = event;

  // Map agent name to phone number (case-insensitive)
  const agentMap = {
    alice: context.WT_AGENT_ALICE_NUMBER,
    bob: context.WT_AGENT_BOB_NUMBER,
  };
  const agentNumber = agentMap[AgentName.toLowerCase()];

  if (!agentNumber) {
    const response = new Twilio.Response();
    response.setStatusCode(400);
    response.appendHeader('Content-Type', 'application/json');
    response.setBody(JSON.stringify({
      success: false,
      error: `Unknown agent: ${AgentName}`,
    }));
    return callback(null, response);
  }

  // Write transfer context to Sync document
  try {
    await client.sync.v1
      .services(context.TWILIO_SYNC_SERVICE_SID)
      .documents.create({
        uniqueName: `warm-transfer-${ConferenceName}`,
        ttl: 86400,
        data: {
          conferenceName: ConferenceName,
          agentName: AgentName,
          callerIssue: CallerIssue,
          callerCallSid: CallerCallSid,
          status: 'initiated',
        },
      });
  } catch (err) {
    // Handle 54301 (doc already exists) gracefully — proceed with call
    if (err.code !== 54301) {
      console.log('Sync doc creation error:', err.message);
    }
  }

  // Call the agent. Parent leg runs briefing CR (url param), child leg runs
  // agent's voice URL (simulated agent in test, real person in production).
  // They're bridged — the briefing AI and agent talk directly.
  try {
    const briefingUrl = `https://${context.DOMAIN_NAME}/warm-transfer/agent-briefing-relay?ConferenceName=${encodeURIComponent(ConferenceName)}`;

    const call = await client.calls.create({
      to: agentNumber,
      from: context.TWILIO_PHONE_NUMBER,
      url: briefingUrl,
    });

    const response = new Twilio.Response();
    response.setStatusCode(200);
    response.appendHeader('Content-Type', 'application/json');
    response.setBody(JSON.stringify({
      success: true,
      agentCallSid: call.sid,
    }));
    return callback(null, response);
  } catch (err) {
    console.log('Agent call creation error:', err.message);
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
