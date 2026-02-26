# Conversation Relay Functions Context

This directory contains Twilio Conversation Relay functions for building real-time voice AI applications.

## Files

### Public Handlers
| File | Access | Description |
|------|--------|-------------|
| `ai-assistant-inbound.js` | Public | Connects incoming calls to ConversationRelay AI agent |
| `relay-handler.js` | Public | Entry point for connecting phone calls to LLM-powered voice agents |
| `transcript-complete.js` | Public | Handles Voice Intelligence transcript completion callback; sends SMS summary |

### Demo Flow
| File | Access | Description |
|------|--------|-------------|
| `start-ai-demo.protected.js` | Protected | Initiates outbound AI demo call with recording and ConversationRelay |
| `finalize-demo.protected.js` | Protected | Processes completed demo call — stores transcript in Sync, sends SMS |

### Agent-to-Agent Testing Infrastructure
| File | Access | Description |
|------|--------|-------------|
| `agent-a-inbound.protected.js` | Protected | Inbound call handler for Agent A (questioner) in agent-to-agent testing |
| `agent-b-inbound.protected.js` | Protected | Inbound call handler for Agent B (answerer) in agent-to-agent testing |
| `start-agent-test.protected.js` | Protected | Test orchestrator that initiates agent-to-agent calls and validates results |
| `validate-agent-test.protected.js` | Protected | Validates agent-to-agent test results by retrieving transcripts from Sync |

### Callbacks
| File | Access | Description |
|------|--------|-------------|
| `recording-complete.protected.js` | Protected | Handles recording completion — updates Sync, triggers Voice Intelligence transcription |

## What is Conversation Relay?

Conversation Relay enables real-time, bidirectional communication between phone calls and AI/LLM backends via WebSockets. It handles:
- Real-time speech transcription
- Text-to-speech synthesis
- Audio streaming
- DTMF detection
- Interruption handling

**Not to be confused with Media Streams** (`<Connect><Stream>`): Media Streams sends raw audio (mulaw 8kHz base64 frames) and requires a completely different WebSocket protocol. A ConversationRelay WebSocket handler cannot be used with `<Stream>` — they will disconnect immediately. ConversationRelay sends structured JSON messages (`type: "prompt"`, `type: "text"`), while Media Streams sends binary audio frames.

## TwiML Setup

### Basic Connection
```javascript
const twiml = new Twilio.twiml.VoiceResponse();
const connect = twiml.connect();

connect.conversationRelay({
  url: 'wss://your-server.com/relay',
  voice: 'Google.en-US-Neural2-F',
  language: 'en-US'
});

return callback(null, twiml);
```

### Full Configuration
```javascript
connect.conversationRelay({
  url: 'wss://your-server.com/relay',        // WebSocket endpoint
  voice: 'Google.en-US-Neural2-F',                        // TTS voice
  language: 'en-US',                         // Language code
  transcriptionProvider: 'google',           // 'google' or 'deepgram'
  speechModel: 'telephony',                  // Speech recognition model
  profanityFilter: 'true',                   // Filter profanity
  dtmfDetection: 'true',                     // Detect DTMF tones
  interruptible: 'true',                     // Allow interruptions
  welcomeGreeting: 'Hello, how can I help?', // Initial greeting
  partialPrompts: 'true'                     // Enable partial transcripts
});
```

**Note**: `interruptByDtmf` is NOT a valid ConversationRelay attribute. DTMF detection is controlled by `dtmfDetection`, and interruption behavior is controlled by `interruptible`.

## WebSocket Message Protocol

### Incoming Messages (from Twilio)

#### Setup Message
```json
{
  "type": "setup",
  "callSid": "CA...",
  "streamSid": "MZ...",
  "from": "+1234567890",
  "to": "+0987654321"
}
```

#### Prompt Message (User Speech)
```json
{
  "type": "prompt",
  "voicePrompt": "Hello, I need help with my account",
  "confidence": 0.95,
  "last": true
}
```

#### DTMF Message
```json
{
  "type": "dtmf",
  "digit": "1"
}
```

#### Interrupt Message
```json
{
  "type": "interrupt"
}
```

### Outgoing Messages (to Twilio)

#### Text Response (TTS)
```json
{
  "type": "text",
  "token": "Hello! I'd be happy to help you with your account.",
  "last": false,
  "interruptible": false,
  "preemptible": false
}
```
Only `type` and `token` are required. Optional fields: `last` (final token in response), `interruptible`, `preemptible`, `lang`.

#### Play Media
```json
{
  "type": "play",
  "source": "https://example.com/audio.mp3",
  "loop": 1,
  "preemptible": false,
  "interruptible": true
}
```

#### Send Digits (DTMF)
```json
{
  "type": "sendDigits",
  "digits": "9www4085551212"
}
```
Transmits DTMF tones to the caller. Supports 0-9, `w` (500ms pause), `#`, `*`.

#### Switch Language
```json
{
  "type": "language",
  "ttsLanguage": "sv-SE",
  "transcriptionLanguage": "en-US"
}
```

#### End Session
```json
{
  "type": "end",
  "handoffData": "{\"reasonCode\":\"live-agent-handoff\"}"
}
```
`handoffData` is optional — passed to subsequent TwiML execution after CR ends.

## WebSocket Server Implementation Pattern

```javascript
// Example WebSocket handler (Node.js with ws library)
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  let callContext = {};

  ws.on('message', async (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'setup':
        callContext = {
          callSid: message.callSid,
          from: message.from,
          to: message.to
        };
        break;

      case 'prompt':
        if (message.last) {
          // Process with your LLM
          const response = await processWithLLM(message.voicePrompt);
          ws.send(JSON.stringify({
            type: 'text',
            token: response
          }));
        }
        break;

      case 'dtmf':
        // Handle DTMF digit
        break;

      case 'interrupt':
        // User interrupted, stop current response
        break;
    }
  });

  ws.on('close', () => {
    // Cleanup
  });
});
```

## Integration with Claude/LLMs

### Anthropic Claude Integration (Streaming — Recommended for Voice)

Streaming delivers tokens as they're generated, enabling natural real-time voice:

```javascript
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic();

async function processWithLLM(systemPrompt, messages, ws) {
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages,
  });

  stream.on('text', (text) => {
    ws.send(JSON.stringify({ type: 'text', token: text }));
  });

  const finalMessage = await stream.finalMessage();
  return finalMessage.content[0].text;
}
```

### Anthropic Claude Integration (Non-Streaming)

```javascript
async function processWithLLM(userMessage) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: userMessage }
    ]
  });

  return response.content[0].text;
}
```

**Anthropic Message Format Gotcha**: When passing conversation history to Anthropic's API, only `role` and `content` are allowed. Extra fields like `timestamp` will cause "Extra inputs are not permitted" errors:

```javascript
// WRONG - will fail if messages have extra fields
messages: conversationHistory

// CORRECT - strip to only role and content
messages: conversationHistory.map(m => ({
  role: m.role,
  content: m.content
}))
```

### OpenAI Integration
```javascript
const OpenAI = require('openai');
const openai = new OpenAI();

async function processWithLLM(userMessage) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: userMessage }
    ]
  });

  return response.choices[0].message.content;
}
```

### Recommended Models

| Provider | Model | Best For |
|----------|-------|----------|
| Anthropic | `claude-sonnet-4-20250514` | Best balance of quality and latency |
| Anthropic | `claude-haiku-4-5-20251001` | Fastest, good for simple interactions |
| OpenAI | `gpt-4o` | Best quality |
| OpenAI | `gpt-4o-mini` | Faster, lower cost |

## Voice Options

**Important**: Some voice/provider combinations may cause error 64101 "Invalid TTS settings". Google Neural voices are recommended for reliability. Polly voices may be blocked.

### Google Voices (Recommended)
- `Google.en-US-Neural2-F` - US English, Female (default for Voice AI Builder)
- `Google.en-US-Neural2-J` - US English, Male
- `Google.en-US-Neural2-A` - US English Neural
- `Google.en-GB-Neural2-B` - British English Neural

### Amazon Polly Voices (May Be Blocked)
- `Polly.Amy` - British English, Female
- `Polly.Brian` - British English, Male
- `Polly.Joanna` - US English, Female
- `Polly.Matthew` - US English, Male

### Transcription Providers

| Provider | Best For |
|----------|----------|
| `google` | Default, good accuracy, wide language support |
| `deepgram` | Noisy environments, faster latency |

### Speech Models

| Model | Best For |
|-------|----------|
| `telephony` | Phone calls (recommended — optimized for 8kHz audio) |
| `default` | General purpose |

## Context Management Strategies

Voice calls can last many turns. Without context management, LLM context windows overflow on long calls.

### Sliding Window (Recommended for Voice)

Keep only the last N messages:

```javascript
function manageContext(messages) {
  const WINDOW_SIZE = 20;
  return messages.length > WINDOW_SIZE
    ? messages.slice(-WINDOW_SIZE)
    : messages;
}
```

### Summary

Periodically summarize older messages and replace history:

```javascript
async function manageContext(messages) {
  if (messages.length > 30) {
    const summary = await summarizeConversation(messages.slice(0, -10));
    return [
      { role: 'user', content: `Previous conversation summary: ${summary}` },
      ...messages.slice(-10),
    ];
  }
  return messages;
}
```

### Full History

Keep all messages. Risk of context overflow on long calls — only use for short interactions.

## Best Practices

1. **Handle Interruptions**: Users may interrupt the AI mid-sentence. Handle the `interrupt` message to stop current output.

2. **Use Streaming**: For long responses, stream text tokens individually for natural conversation flow.

3. **Manage Latency**: Keep LLM response times low for natural conversation. Consider using faster models for time-sensitive responses.

4. **Handle Silence**: Implement timeout handling for long silences.

5. **Graceful Endings**: Send the `end` message when the conversation should conclude.

## Local Development with ngrok

For local WebSocket development, use ngrok to expose your local server:

### Setup ngrok

1. **Install ngrok**

   ```bash
   # macOS
   brew install ngrok

   # Or download from https://ngrok.com/download
   ```

2. **Configure ngrok auth token**

   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

3. **Start your WebSocket server locally**

   ```bash
   node websocket-server.js  # Runs on port 8080
   ```

4. **Expose with ngrok**

   ```bash
   ngrok http 8080
   ```

5. **Use the ngrok URL in your function**

   ```javascript
   connect.conversationRelay({
     url: 'wss://abc123.ngrok.io/relay',  // Use the ngrok URL
     voice: 'Polly.Amy'
   });
   ```

### ngrok Configuration for WebSockets

For a stable development URL, use a custom domain (requires paid ngrok):

```bash
ngrok http 8080 --domain=your-domain.ngrok.dev
```

This gives you a consistent URL: `wss://your-domain.ngrok.dev`

### Agent-to-Agent Testing (Dual Tunnel Setup)

Agent-to-agent testing requires **two separate ngrok tunnels** — one per agent. Each tunnel needs its own domain since ngrok only allows one endpoint per domain.

```bash
# Terminal A: Agent A (questioner) on port 8080
ngrok http 8080 --domain=zembla.ngrok.dev

# Terminal B: Agent B (answerer) on port 8081
ngrok http 8081 --domain=submariner.ngrok.io
```

Then set the relay URLs on the deployed Twilio service:
```bash
twilio serverless:env:set --key AGENT_A_RELAY_URL \
  --value "wss://zembla.ngrok.dev" \
  --environment dev-environment \
  --service-sid ZS93c4fa9720063ebf10a70ffca19d8f8a

twilio serverless:env:set --key AGENT_B_RELAY_URL \
  --value "wss://submariner.ngrok.io" \
  --environment dev-environment \
  --service-sid ZS93c4fa9720063ebf10a70ffca19d8f8a
```

The ngrok domains and auth token are stored in the root `.env` file as `NGROK_DOMAIN_A`, `NGROK_DOMAIN_B`, and `NGROK_AUTHTOKEN`.

### Development Workflow

1. Start WebSocket server locally (port 8080)
2. Start ngrok tunnel: `ngrok http 8080 --domain=your-domain.ngrok.dev`
3. Update `CONVERSATION_RELAY_URL` in `.env` with ngrok URL
4. Start Twilio serverless: `npm run start:ngrok`
5. Call your Twilio number to test

### Debugging WebSocket Traffic

ngrok provides a web interface at `http://localhost:4040` to inspect WebSocket traffic in real-time.

## Prerequisites

### Conversational Intelligence (Voice Intelligence)

To use transcript storage and analysis features, you must create a Conversational Intelligence (CI) Service in the Twilio Console. **There is no API for creating CI Services** (as of February 2026).

1. Go to [Twilio Console → Voice → Voice Intelligence](https://console.twilio.com/us1/develop/voice-intelligence/services)
2. Click "Create new Service"
3. Name your service (e.g., "twilio-agent-factory")
4. Copy the Service SID (starts with `GA...`)
5. Add to `.env`: `TWILIO_INTELLIGENCE_SERVICE_SID=GA...`

Without this, transcript creation via the Intelligence API will fail with 404 errors.

### Creating Transcripts from Recordings

When creating transcripts from Twilio recordings, use `source_sid` instead of `media_url`:

```javascript
// WRONG - Intelligence API can't authenticate to api.twilio.com
const channel = {
  media_properties: {
    media_url: `https://api.twilio.com/.../Recordings/${recordingSid}.mp3`,
  },
  participants: [...]
};

// CORRECT - Use source_sid for Twilio recordings
const channel = {
  media_properties: {
    source_sid: recordingSid,  // e.g., "RE1234567890abcdef"
  },
  participants: [
    { channel_participant: 1, user_id: 'caller' },
    { channel_participant: 2, user_id: 'agent' },
  ],
};

const transcript = await client.intelligence.v2.transcripts.create({
  serviceSid: intelligenceServiceSid,
  channel,
  customerKey: callSid,  // For correlation
});
```

**Language Operators run automatically**: When operators (e.g., Conversation Summary, Sentiment Analysis) are configured on the Intelligence service in the Twilio Console, they automatically run on every transcript created via that service. No per-transcript operator invocation is needed.

## Testing Conversation Relay

1. Set up a WebSocket server (locally or deployed)
2. Use ngrok to expose local WebSocket server
3. Configure the relay URL in your function
4. Make test calls to verify the flow
5. Test interruption scenarios
6. Test DTMF handling if enabled

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| AI greets but doesn't respond to speech | Using `isFinal` instead of `last` in prompt handler | Check for `message.last` instead of `message.isFinal` |
| "Extra inputs are not permitted" from Anthropic | Passing extra fields (timestamp, etc.) in messages array | Strip messages to only `role` and `content` fields |
| WebSocket doesn't connect | URL not HTTPS/WSS | Use ngrok HTTPS URL, convert to `wss://` |
| No transcript created after call | Missing Sync Service SID | Ensure `TWILIO_SYNC_SERVICE_SID` is set in environment |
| Call connects but no audio | WebSocket server not responding | Check WebSocket server logs, verify connection |
| Interruption not working | `interruptible` not set to `'true'` | Add `interruptible: 'true'` to ConversationRelay config |
| DTMF not detected | `dtmfDetection` not enabled | Add `dtmfDetection: 'true'` to ConversationRelay config |
| Partial transcripts missing | `partialPrompts` not enabled | Add `partialPrompts: 'true'` for streaming transcripts |
| Transcript status "error" | Using media_url for Twilio recordings | Use `source_sid: RecordingSid` instead of `media_url` - Intelligence API can't authenticate to api.twilio.com |
| Call says "not configured" (8s) | CONVERSATION_RELAY_URL not set after deploy | Redeploy with correct env var or set in Twilio Console |
| Transcript callback skipping | Checking for `status === 'completed'` | Voice Intelligence sends `event_type: voice_intelligence_transcript_available`, not `status` |
| "Unique name already exists" on callback | Twilio sends duplicate callbacks | Handle error 54301 gracefully - document was created on first callback |
| Error 82005 in notifications | Function has a stray `console.error()` call | Replace with `console.log()` — never use `console.error()` in Twilio Functions |
| ngrok tunnel dies during long session | Tunnel expires or disconnects, WebSocket URL becomes unreachable | Verify tunnel is alive (`curl localhost:4040`) before each agent-to-agent call; kill and restart if dead |

## Logging and Response Rules

Use `console.log` for **all** logging in Twilio Functions, including error conditions and catch blocks. `console.error()` generates 82005 alerts and `console.warn()` generates 82004 alerts — never use either.

Always pass a string to `Twilio.Response.setBody()`:

```javascript
// WRONG — triggers Buffer TypeError
response.setBody({ success: true });

// RIGHT — explicit JSON serialization
response.setBody(JSON.stringify({ success: true }));
```

## Environment Variables

```text
CONVERSATION_RELAY_URL=wss://your-server.com/relay
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```
