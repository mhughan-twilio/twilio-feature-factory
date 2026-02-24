# Voice Functions Context

This directory contains Twilio Voice API functions for handling phone calls.

## Files

### Basic Call Handling
| File | Access | Description |
|------|--------|-------------|
| `incoming-call.js` | Public | Handles incoming voice calls with a greeting and gathers user input |
| `gather-input.protected.js` | Protected | Processes gathered DTMF or speech input from incoming calls |

### IVR / Self-Service
| File | Access | Description |
|------|--------|-------------|
| `ivr-welcome.js` | Public | Welcome handler for a dental office IVR self-service menu |
| `ivr-menu.protected.js` | Protected | Routes callers to appointments, billing, or hours based on DTMF/speech |

### Outbound Contact Center (UC5)
| File | Access | Description |
|------|--------|-------------|
| `outbound-dialer.js` | Public | Initiates outbound calls with conference bridge and AMD |
| `outbound-customer-leg.js` | Public | TwiML for the customer leg — starts recording, joins conference |
| `outbound-agent-leg.js` | Public | TwiML for the agent leg — whispers context, joins conference |

### Sales Dialer (UC7)
| File | Access | Description |
|------|--------|-------------|
| `sales-dialer-prospect.js` | Public | TwiML for the prospect leg — starts recording, joins conference |
| `sales-dialer-agent.js` | Public | TwiML for the agent leg — whispers prospect context, joins conference |

### Call Tracking (UC8)
| File | Access | Description |
|------|--------|-------------|
| `call-tracking-inbound.js` | Public | Inbound call tracking with campaign attribution, whisper, and Sync logging |

### Conference Management
| File | Access | Description |
|------|--------|-------------|
| `create-conference.protected.js` | Protected | Creates a conference and adds the first participant via REST API |
| `add-conference-participant.protected.js` | Protected | Adds a participant to an existing conference |
| `end-conference.protected.js` | Protected | Ends an active conference by updating status to completed |

### Notification / Outbound
| File | Access | Description |
|------|--------|-------------|
| `notification-outbound.js` | Public | Outbound appointment reminder calls with recording and confirmation |
| `notification-confirm.protected.js` | Protected | Processes appointment confirmation/denial via DTMF or speech |

### Voice AI / ConversationRelay
| File | Access | Description |
|------|--------|-------------|
| `pizza-agent-connect.js` | Public | Connects incoming calls to the pizza-ordering AI agent via ConversationRelay |

**See also**: `functions/warm-transfer/` — AI-powered warm call transfer with conference-first architecture and ConversationRelay participants. Documented in [functions/warm-transfer/CLAUDE.md](/functions/warm-transfer/CLAUDE.md).

### Media Streams (UC6)
| File | Access | Description |
|------|--------|-------------|
| `stream-connect.js` | Public | Connects call audio to a WebSocket via bidirectional Media Streams |

### Voice SDK / WebRTC
| File | Access | Description |
|------|--------|-------------|
| `token.js` | Public | Generates Twilio Voice SDK access tokens (JWTs) with VoiceGrant |
| `sdk-handler.js` | Public | Routes browser-originated Voice SDK calls to PSTN or other clients |

## TwiML Voice Verbs

### Common Verbs
- `<Say>` - Text-to-speech output
- `<Play>` - Play audio file
- `<Gather>` - Collect DTMF or speech input
- `<Dial>` - Connect to another party
- `<Record>` - Record caller audio
- `<Conference>` - Join a conference call
- `<Hangup>` - End the call
- `<Redirect>` - Transfer to another TwiML endpoint
- `<Pause>` - Add silence

### Say Verb Options
```javascript
twiml.say({
  voice: 'Polly.Amy',      // Amazon Polly voice
  language: 'en-GB',       // Language code
  loop: 1                  // Number of times to repeat
}, 'Your message here');
```

### Gather Verb Options
```javascript
twiml.gather({
  input: 'dtmf speech',    // Input types to accept
  timeout: 5,              // Seconds to wait for input
  numDigits: 4,            // Expected DTMF digits
  finishOnKey: '#',        // Key to finish input
  action: '/next-handler', // URL to POST results
  method: 'POST',          // HTTP method
  speechTimeout: 'auto',   // Auto-detect end of speech
  hints: 'yes, no, help'   // Speech recognition hints
});
```

### Dial Verb Options
```javascript
twiml.dial({
  callerId: '+1234567890', // Caller ID to display
  timeout: 30,             // Ring timeout in seconds
  action: '/dial-complete',// Callback URL
  record: 'record-from-answer' // Recording option
}).number('+1987654321');
```

## Voice Webhook Parameters

When Twilio makes a request to your voice webhook, these parameters are included:

| Parameter | Description |
|-----------|-------------|
| `CallSid` | Unique identifier for the call |
| `AccountSid` | Your Twilio Account SID |
| `From` | Caller's phone number (E.164) |
| `To` | Called phone number (E.164) |
| `CallStatus` | Current call status |
| `Direction` | `inbound` or `outbound-api` |
| `CallerName` | Caller name (if available) |
| `FromCity` | Caller's city |
| `FromState` | Caller's state |
| `FromCountry` | Caller's country |

### Gather Callback Parameters
| Parameter | Description |
|-----------|-------------|
| `Digits` | DTMF digits pressed |
| `SpeechResult` | Transcribed speech |
| `Confidence` | Speech recognition confidence (0-1) |

## Common Patterns

### IVR Menu
```javascript
const twiml = new Twilio.twiml.VoiceResponse();
twiml.say('Press 1 for sales, 2 for support.');
twiml.gather({
  numDigits: 1,
  action: '/ivr-handler'
});
twiml.redirect('/voice/incoming-call'); // No input, restart
```

### Call Forwarding
```javascript
const twiml = new Twilio.twiml.VoiceResponse();
twiml.dial({
  callerId: event.To,
  timeout: 20
}).number('+1234567890');
twiml.say('The person you called is unavailable.');
```

### Voicemail
```javascript
const twiml = new Twilio.twiml.VoiceResponse();
twiml.say('Please leave a message after the beep.');
twiml.record({
  maxLength: 60,
  action: '/recording-complete',
  transcribe: true,
  transcribeCallback: '/transcription-ready'
});
```

### Conference via REST API (Preferred)
Use the Conferences Participants API for programmatic control:

```javascript
// Create conference by adding first participant
const participant = await client.conferences('my-conference')
  .participants
  .create({
    from: context.TWILIO_PHONE_NUMBER,
    to: participantNumber,
    timeout: 30,           // Ring timeout
    timeLimit: 600,        // Max call duration (prevent runaway)
    startConferenceOnEnter: true,
    endConferenceOnExit: false,
    muted: false,
    beep: true
  });

// Add additional participants
await client.conferences('my-conference')
  .participants
  .create({
    from: context.TWILIO_PHONE_NUMBER,
    to: anotherParticipant,
    timeout: 30,
    timeLimit: 600
  });

// End conference
await client.conferences(conferenceSid)
  .update({ status: 'completed' });
```

### Conference Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `startConferenceOnEnter` | boolean | true | Start when participant joins |
| `endConferenceOnExit` | boolean | false | End when participant leaves (moderator) |
| `muted` | boolean | false | Join muted |
| `beep` | boolean | true | Play beep on join/leave |
| `timeout` | number | 30 | Ring timeout in seconds |
| `timeLimit` | number | 14400 | Max call duration in seconds |

### Finding Conferences by Name
```javascript
// List in-progress conferences by friendly name
const conferences = await client.conferences.list({
  friendlyName: 'my-conference',
  status: 'in-progress',
  limit: 1
});

if (conferences.length > 0) {
  const conference = conferences[0];
  console.log(`SID: ${conference.sid}`);
}
```

## TwiML Control Model

**Critical**: In almost all cases, only ONE TwiML document controls a call at any given time.

### Exception: Background Operations

Some TwiML verbs start background processes that continue running even after the call moves to subsequent TwiML documents:

- **`<Start><Stream>`** - Media streaming continues in the background
- **`<Start><Recording>`** - Recording continues until explicitly stopped
- **`<Start><Siprec>`** - SIPREC streaming continues in the background

These operations "fork off" and run concurrently with whatever TwiML executes next. The call can proceed through multiple TwiML documents while the stream/recording remains active.

```javascript
// Recording starts and continues through subsequent TwiML
const start = twiml.start();
start.recording({
  recordingStatusCallback: '/recording-complete',
  recordingStatusCallbackEvent: 'completed',
});
twiml.say('This is being recorded...');
twiml.redirect('/next-handler'); // Recording continues!
```

### Key Implications

1. **Updating participant TwiML exits current state**: If a participant is in a conference and you update their call with new TwiML, they immediately exit the conference and execute the new TwiML.

2. **Conference teardown risk**: If the exiting participant had `endConferenceOnExit=true`, the entire conference tears down - appearing as a "dropped call" to other participants.

3. **Call transfer in conference context**: "Transfer" means adding a new participant to the existing conference, NOT replacing TwiML. The original parties stay in the conference.

### Safe Conference Transfer Pattern

```javascript
// "Transfer" a call by adding a new party to the conference
// Original caller and agent stay in conference with the new party

// 1. Agent is on call with customer in conference "support-12345"
// 2. Agent wants to bring in specialist

// Add specialist to existing conference (they join, nobody leaves)
await client.conferences('support-12345')
  .participants
  .create({
    from: context.TWILIO_PHONE_NUMBER,
    to: specialistNumber,
    startConferenceOnEnter: true,  // Start immediately
    endConferenceOnExit: false     // Don't end when they leave
  });

// 3. All three parties now in conference
// 4. Agent can drop off by having their participant removed:
await client.conferences('support-12345')
  .participants(agentCallSid)
  .update({ status: 'completed' });
```

### Dangerous Pattern (Avoid)

```javascript
// DON'T: Update participant with new TwiML - exits them from conference
await client.calls(participantCallSid)
  .update({
    twiml: '<Response><Dial>+15551234567</Dial></Response>'
  });
// This removes them from conference and may tear it down!
```

## Logging and Response Rules

Twilio Functions generate debugger alerts based on log level:

| Log Level | Alert Code | Effect |
|-----------|------------|--------|
| `console.log` | None | Silent — use for all operational logging |
| `console.warn` | 82004 | Generates warning alert — **never use** |
| `console.error` | 82005 | Generates error alert — **never use** |

Use `console.log` for **all** logging, including error conditions and catch blocks.

**Response bodies**: Always pass a string to `Twilio.Response.setBody()`, not a plain object. Use `JSON.stringify()` and set `Content-Type: application/json`. Passing an object causes `Buffer.from(object)` TypeError in the runtime.

```javascript
// WRONG — triggers Buffer TypeError
response.setBody({ success: true });

// RIGHT — explicit JSON serialization
response.appendHeader('Content-Type', 'application/json');
response.setBody(JSON.stringify({ success: true }));
```

## Gotchas

### Conference Participants API vs TwiML `<Conference>`

The Participants API and TwiML `<Conference>` verb have different parameter formats:

| Parameter | Participants API | TwiML `<Conference>` |
|-----------|-----------------|---------------------|
| `Record` / `record` | Boolean: `true` or `false` | String: `record-from-start`, `record-from-answer`, etc. |

Passing TwiML values to the Participants API (e.g., `Record: 'record-from-start'`) returns HTTP 400.

### Recording Callback URLs Must Be Absolute

`<Start><Recording>` requires absolute callback URLs. Relative paths like `/callbacks/call-status` trigger error 11200. The recording completes, but the status callback never fires.

```javascript
// WRONG — generates 11200
start.recording({
  recordingStatusCallback: '/callbacks/call-status',
});

// RIGHT — absolute URL
start.recording({
  recordingStatusCallback: `https://${context.DOMAIN_NAME}/callbacks/call-status`,
});
```

Note: `<Gather action>` and `<Dial action>` resolve relative URLs correctly against the function domain. This inconsistency only affects `<Start><Recording>`.

### Dial `action` URL Should Not Be the Inbound Handler

When `<Dial action="/voice/my-handler">` is set, the handler fires again after the Dial completes. If the handler creates one-time resources (e.g., Sync documents with unique names), the second invocation produces "Unique name already exists" errors (54302). Use a dedicated Dial-complete handler, or make the resource creation idempotent.

### Deployment Resets Phone Number Webhooks

`twilio serverless:deploy` can reset phone number voice URLs to previous values. Always verify and re-set webhooks after every deployment:

```bash
twilio phone-numbers:update PNxxxx --voice-url https://your-service-dev.twil.io/voice/your-handler
```

### Conference Recording Captures Hold Music

When using `Record=true` on the Conference Participants API, recording starts from conference creation. If AMD classification takes time before the agent joins, the recording captures minutes of hold music. Transcripts get dominated by `[music]` tags, reducing topic keyword coverage.

### Avoid Duplicate Recordings

Don't combine `--record` CLI flag (or `Record=true` API param) with `<Start><Recording>` TwiML — this creates two recordings (one OutboundAPI 1-channel, one TwiML 2-channel). Pick one method.

### Participants API Bridges Audio Regardless of TwiML

When the Participants API adds a call to a conference, the platform bridges audio into the conference mixer at the transport level. If the `to` number is a Twilio number, its voice URL fires and the returned TwiML executes on that call leg — but the audio is bridged into the conference regardless of what the TwiML does. This means a participant can run `<Connect><ConversationRelay>` or any other TwiML while still having its audio mixed into the conference. The conference name is NOT passed in the webhook params — use query params on the voice URL if the handler needs it.

### `make_call(To=TwilioNumber)` Creates Two Independent TwiML Legs

When `make_call` targets a Twilio number, two separate call legs are created with independent TwiML execution:

- **Parent leg** (outbound-api): Runs the `Url` parameter's TwiML
- **Child leg** (inbound): Runs the number's configured voice webhook TwiML

Both execute simultaneously and are bridged together. A single `make_call` produces TWO TwiML documents on TWO call SIDs. This means the `Url` handler and the number's webhook both fire — they don't replace each other.

For conference-based patterns (contact center, sales dialer), call each participant separately with their own `Url` TwiML rather than relying on the bridge from a single call.

### Pre-E2E: Verify ALL Phone Numbers Have Voice URLs

Before running E2E tests, verify every phone number in the call flow has a voice URL — not just the inbound/tracking numbers, but Dial destinations, agent numbers, and business lines. A number with `voiceUrl: null` causes `<Dial>` to fail immediately with no useful error.

## File Naming Conventions

- `*.js` - Public endpoints (no signature validation)
- `*.protected.js` - Protected endpoints (require valid Twilio signature)
- `*.private.js` - Private functions (not accessible via HTTP)

## Testing Voice Functions

Tests should use real Twilio APIs. Test TwiML generation by:
1. Calling the handler with test context/event
2. Verifying the TwiML string contains expected elements
3. For integration tests, use Twilio's API to make test calls
