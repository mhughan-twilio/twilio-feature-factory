// ABOUTME: Handles inbound calls by placing the caller in a conference and adding an AI receptionist.
// ABOUTME: Generates a unique conference name and adds a ConversationRelay participant via calls.create.

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

  // Put the caller into the conference
  const dial = twiml.dial();
  dial.conference({
    startConferenceOnEnter: true,
    endConferenceOnExit: true,
    beep: false,
    timeLimit: 1800,
  }, conferenceName);

  // Add AI receptionist as a separate call leg pointing to receptionist-relay
  const receptionistUrl = `https://${context.DOMAIN_NAME}/warm-transfer/receptionist-relay?ConferenceName=${encodeURIComponent(conferenceName)}`;

  try {
    await client.calls.create({
      from: context.TWILIO_PHONE_NUMBER,
      to: context.TWILIO_PHONE_NUMBER,
      url: receptionistUrl,
    });
  } catch (err) {
    console.log('Failed to add AI receptionist participant:', err.message);
  }

  return callback(null, twiml);
};
