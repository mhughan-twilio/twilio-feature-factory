// ABOUTME: Handles inbound calls by placing the caller in a conference and adding an AI receptionist.
// ABOUTME: Uses Participants API to add a ConversationRelay participant with audio bridged at transport level.

/**
 * Generate a unique conference name with wt- prefix, timestamp, and random suffix.
 */
function generateConferenceName() {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `wt-${timestamp}-${randomSuffix}`;
}

exports.handler = async (context, event, callback) => {
  const client = context.getTwilioClient();
  const twiml = new Twilio.twiml.VoiceResponse();

  const conferenceName = generateConferenceName();
  const domainName = context.DOMAIN_NAME;
  const receptionistNumber = context.WT_RECEPTIONIST_NUMBER;

  // Add AI receptionist via Participants API. The Participants API bridges audio
  // into the conference at the transport level regardless of what TwiML the called
  // number returns. We update the number's voice URL to include ConferenceName so
  // receptionist-relay can pass it to the WS handler.
  try {
    // Look up the phone number SID for WT_RECEPTIONIST_NUMBER
    const numbers = await client.incomingPhoneNumbers.list({
      phoneNumber: receptionistNumber,
      limit: 1,
    });

    if (numbers.length > 0) {
      // Set voice URL to receptionist-relay with ConferenceName query param
      const relayUrl = `https://${domainName}/warm-transfer/receptionist-relay?ConferenceName=${encodeURIComponent(conferenceName)}`;
      await client.incomingPhoneNumbers(numbers[0].sid).update({
        voiceUrl: relayUrl,
      });
    }

    // Add as conference participant — audio bridges regardless of TwiML
    await client.conferences(conferenceName)
      .participants
      .create({
        from: context.TWILIO_PHONE_NUMBER,
        to: receptionistNumber,
        startConferenceOnEnter: true,
        endConferenceOnExit: false,
        beep: false,
        timeout: 15,
      });
  } catch (err) {
    console.log('Failed to add AI receptionist participant:', err.message);
  }

  // Start background recording for debugging
  const start = twiml.start();
  start.recording({
    recordingStatusCallback: `https://${domainName}/callbacks/call-status`,
    recordingStatusCallbackEvent: 'completed',
  });

  // Put the caller into the conference
  const dial = twiml.dial({ timeLimit: 1800 });
  dial.conference({
    startConferenceOnEnter: true,
    endConferenceOnExit: true,
    beep: false,
  }, conferenceName);

  return callback(null, twiml);
};
