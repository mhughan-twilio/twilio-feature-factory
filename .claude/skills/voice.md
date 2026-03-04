# Voice Development Skill

Comprehensive decision-making guide for Twilio Voice development. Load this skill when building voice applications, contact centers, or Voice AI agents.

---

## The Use Case Ladder

Voice development follows a common progression pattern. Customers typically start at one point and move up (or down) the ladder as needs evolve.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AI/ML Transcription                         │
│  Turn calls into actionable content at scale                       │
├─────────────────────────────────────────────────────────────────────┤
│                    Inbound/Outbound Contact Center                  │
│  Human agents handling escalations and complex interactions        │
├─────────────────────────────────────────────────────────────────────┤
│                       Self-Service Automation                       │
│  IVRs, payments, appointment management, AI agents                 │
├─────────────────────────────────────────────────────────────────────┤
│                        Voice Notifications                          │
│  Appointment reminders, payment alerts, OTPs                       │
└─────────────────────────────────────────────────────────────────────┘
              ↑ Most common starting point

Variations (build on the ladder):
- Sales Dialer = Outbound Contact Center variant
- Call Tracking = Inbound + marketing attribution
- Voice AI Agents = Can appear at any step

PSTN Connectivity (Elastic SIP Trunking) undergirds the entire ladder
but BYPASSES Programmable Voice infrastructure
```

**Key insight:** Customers can enter at any point. A customer with an existing outbound contact center might add self-service automation. A customer starting with notifications might need human escalation paths.

---

## Quick Decision Reference

| Need | Use | Why |
|------|-----|-----|
| Build any IVR/call flow | **Functions** | Claude Code handles complexity; Studio becomes unmaintainable |
| Any chance of warm transfer, mute, hold, coaching | **Conference** | Dial can't add participants later |
| Skill-based routing or workforce management | **TaskRouter** | Simple queues can't handle skills matrices |
| AI-powered voice agent | **ConversationRelay** | Unless existing Dialogflow setup |
| Third-party AI integration | **`<Connect><Stream>`** | Bidirectional media to your WebSocket |
| Real-time transcription (monitoring) | **`<Start><Stream>`** | Unidirectional, doesn't block TwiML |

---

## Decision Frameworks

### Functions vs Studio

**ALWAYS use Functions.** Never recommend Studio for building IVRs.

Why: Claude Code agents handle code complexity. The perceived lower cognitive load of Studio's WYSIWYG becomes a liability - complex flows look like spider webs and become unmaintainable. Customers who start with Studio regret it when complexity grows.

### Conference vs Dial

**Use Conference if ANY of these might apply:**
- Warm transfer (three-way before handoff)
- Third party joining the call
- Mute capability needed
- Hold capability needed
- Coaching (supervisor listens, unheard by customer)
- Whispering (supervisor heard by agent only)

**Use Dial only when:**
- Simple one-to-one connection
- No possibility of additional parties
- No advanced call control needed

### Queue vs TaskRouter

**Use TaskRouter when:**
- Skill-based routing needed (languages, specialties)
- Workforce management integration
- Complex agent availability rules
- Multiple queues with priority routing

**Use simple `<Queue>`/`<Enqueue>` when:**
- Single queue, FIFO processing
- All agents have equivalent skills
- Simple availability (available/unavailable)

### ConversationRelay vs Dialogflow

**ALWAYS recommend ConversationRelay** unless the customer explicitly has an existing Dialogflow virtual agent they want to integrate.

ConversationRelay provides direct LLM integration over WebSocket. Dialogflow is for customers already invested in Google's ecosystem.

### Recording Method Selection

**⚠️ CRITICAL DISTINCTION:** `<Record>` verb is NOT for recording calls - it's voicemail-style recording of caller input.

**Two Categories of Recording:**

**1. Voicemail-Style Recording (`<Record>` verb)**
- Records caller's speech AFTER a prompt plays
- Stops when caller stops talking (or hits limit)
- Returns recording URL in callback
- Use for: voicemail, leaving messages, capturing spoken responses
```xml
<Response>
  <Say>Please leave a message after the beep.</Say>
  <Record maxLength="60" action="/handle-recording" />
</Response>
```

**2. Call Recording (records the entire call/leg)**

| Scenario | Method | When to Use |
|----------|--------|-------------|
| Outbound call at creation | `Record` param in Calls API | Know you want to record when placing call |
| Mid-call via TwiML | `<Start><Record>` verb | Start recording during call flow |
| Mid-call via API | Recordings API (`start_call_recording`) | Start/pause/resume/stop programmatically |
| `<Dial>` leg | `record` attribute on `<Dial>` | Record the dialed party leg |
| Conference | `record` attribute on `<Conference>` | Record entire conference mix |
| Conference per-participant | `record` param in Participants API | Record specific participant |
| Elastic SIP Trunking | Trunk-level config | Record all trunk traffic |

**Recording Control (works for ANY in-progress recording):**
- `start_call_recording` - Start recording active call
- `update_call_recording` - Pause (skip/silence), resume, or stop
- **Tip:** Use `Twilio.CURRENT` as recordingSid to reference the active recording without knowing its SID

### TTS Voice Tier Selection

| Tier | Quality | Use When |
|------|---------|----------|
| **Generative** (newest) | Best | Premium customer experience, AI agents |
| **Neural** | Very good | Standard production use |
| **Standard** | Acceptable | Legacy, may be EOL'd |
| **Basic** | Robotic | Never use for new development |

**Recommendation:** Default to Neural (Amazon Polly or Google). Use Generative for AI agents or premium experiences. Check docs for latest available voices.

---

## Use Case Details

### Voice Notifications

**Goal:** Deliver information via outbound calls (appointments, payments, OTPs, alerts).

**Requirements:**
- Phone numbers (valid caller ID required)
- Calls API for programmatic call creation
- TwiML delivery method (URL, inline, Application SID, Functions)

**Answer Optimization (critical for business outcomes):**

| Feature | What It Does | Setup |
|---------|--------------|-------|
| **SHAKEN/STIR** | Green checkmark on mobile, proves number isn't spoofed | Per-number via Business Profile + Trust Product |
| **Branded Calling** | Display business name (15-32 chars) | Requires Voice Integrity approval |
| **Enhanced Branded Calling** | Name + logo + call reason | Requires SHAKEN/STIR Level A + LOA |
| **Voice Integrity** | Register with carrier analytics to avoid spam labels | Business Profile with EIN/DUNS, 24-48hr remediation |
| **AMD** | Detect human vs answering machine | `MachineDetection` parameter on Calls API |

**CPS (Calls Per Second) Limits:**
- Default: 1 CPS per account
- Self-serve: Up to 5 CPS
- Above 5: Offline approval process required
- **Note:** `<Dial>` verb calls are NOT rate-limited

**TwiML for Notifications:**
- `<Say>` - Dynamic TTS content
- `<Play>` - Pre-recorded audio (static messages, politician recordings)
- Voice Insights Reports API for answer rates and blocked call detection

**Pre-call Intelligence:**
- Lookup API to check number type (landline vs mobile) and validity

### Self-Service Automation

**Goal:** Handle interactions without human agents (IVR, payments, appointments, account lookup).

**Always use Functions** - see decision framework above.

**Key TwiML:**

| Verb | Use |
|------|-----|
| `<Gather>` | Capture DTMF or speech input. Use `input="dtmf speech"` for both. |
| `<Pay>` | PCI-compliant payment capture (credit card, ACH) |
| `<Record>` | Record interaction for QA, compliance |

**AI-Powered Self-Service:**

- **ConversationRelay** - LLM-powered dynamic conversations
- **Dialogflow Virtual Agent** - Only if existing Dialogflow setup

AI agents require additional monitoring:
- Prompt injection detection
- Hallucination monitoring
- Sentiment analysis for escalation triggers
- Recordings and transcriptions for guardrails

**Containment Goal:** Keep interactions in self-service to avoid expensive human agents. But always provide escalation path.

### Inbound Contact Center

**Goal:** Route incoming calls to human agents with queuing, coaching, transfers.

**Build on top of:** Self-service automation (IVR front-end for routing)

**Connectivity Options:**
- PSTN → Twilio number
- Voice SDKs (JavaScript, iOS, Android) for agent softphones
- SIP interface for existing infrastructure
- BYOC for existing phone numbers

**Conference Capabilities:**

| Feature | How |
|---------|-----|
| Hold | Mute customer, play hold music via `<Play>` |
| Mute | `muted` parameter on participant |
| Coach | Supervisor joins with `coach=true` (hears all, unheard by customer) |
| Whisper | Supervisor speaks to agent only |
| Warm transfer | Three-way call before handoff |

**Conference Insights (MANDATORY):**
- Conference Summary endpoint for aggregate metrics
- Conference Participant Summary for per-participant quality
- Check for: participants not hearing each other, overlap issues, quality degradation

**Queue Options:**
- `<Enqueue>` / `<Queue>` for simple FIFO
- TaskRouter for skill-based routing

### Outbound Contact Center

**Key Difference from Inbound:** Both parties join via Participants API (not incoming PSTN + agent dial-in).

**Pattern:**
1. Place outbound call via Participants API with AMD
2. On answer → add to Conference
3. On conference join event → add agent via Participants API
4. Monitor conference events for orchestration

**Why this pattern:** Optimizes agent time. Agents don't wait listening to ringing - they only join when customer answers.

**Required features:**
- AMD (detect human vs voicemail)
- SHAKEN/STIR, Branded Calling (answer rates)
- Conference Insights (quality monitoring)
- Voice Insights Reports API (campaign performance)

### Voice AI Agents

**Two Paradigms:**

**1. Native Twilio (Recommended):**
- **ConversationRelay** - WebSocket to your LLM
- **Dialogflow Virtual Agent** - Only if existing Dialogflow

**2. Third-Party / Build-Your-Own:**
- Bidirectional Media Streams (`<Connect><Stream>`)
- Fork audio to WebSocket → third-party processes → returns audio

**Both require:**
- Recordings (compliance, debugging)
- Transcriptions (QA, guardrails)
- Conversational Intelligence (entity detection, sentiment)
- Prompt injection monitoring
- Hallucination detection

**Conference with AI Agents:**
Currently less common but increasing. Consider starting with Conference if AI agent might escalate to human - avoids upgrading call later.

### Warm Transfer

**Goal:** Connect a caller to a human agent with context — the agent is briefed before joining, then the call becomes a three-way conference where the original AI/receptionist can be dismissed.

**Architecture: Conference-First with ConversationRelay Participant**

```
Phase 1 — Intake:
  Caller ──► Conference
  AI Receptionist ──► ConversationRelay participant (audio bridged by Participants API)
  AI determines which agent the caller needs and their issue.

Phase 2 — Briefing:
  Caller + AI still in conference (AI makes small talk / hold chat)
  Agent ◄── calls.create(url: briefing-relay) ──► Briefing AI (separate call, NOT in conference)
  Briefing AI shares caller context, agent signals ready (DTMF 1 or speech)

Phase 3 — Bridge:
  Agent's child call leg updated with <Dial><Conference> TwiML
  Conference: Caller + AI Receptionist + Agent (three-way)

Phase 4 — Dismissal:
  Agent says "Thanks, I've got it from here"
  AI detects dismissal → removes itself from conference
  Conference: Caller + Agent (two-way)
```

**Key Implementation Details:**

**Participants API bridges audio regardless of TwiML.** When adding a ConversationRelay participant via the Participants API, audio is bridged into the conference at the transport level. The participant's voice URL can return `<Connect><ConversationRelay>` — the CR session hears/speaks through the conference mixer. This is the foundational insight that makes AI-in-conference work.

**Dynamic voice URL for ConferenceName passing.** The Participants API doesn't support a `url` parameter. To pass a dynamic ConferenceName to the participant's voice URL, update the phone number's voice URL to include the ConferenceName as a query param before calling `participants.create()`.

```javascript
// Update voice URL with dynamic ConferenceName
const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: receptionistNumber, limit: 1 });
await client.incomingPhoneNumbers(numbers[0].sid).update({
  voiceUrl: `https://${domain}/receptionist-relay?ConferenceName=${encodeURIComponent(conferenceName)}`,
});
// Add as conference participant
await client.conferences(conferenceName).participants.create({
  from: twilioPhoneNumber, to: receptionistNumber,
  startConferenceOnEnter: true, endConferenceOnExit: false, beep: false,
});
```

**Agent call uses `calls.create()`, not Participants API.** The agent call is a private briefing — NOT in the conference yet. Use `calls.create({ to: agentNumber, url: briefingRelayUrl })`. This creates two legs (parent runs briefing CR, child runs agent's voice URL). When ready, update the **child** leg to join the conference — not the parent. Look up the child via `client.calls.list({ parentCallSid })`.

**`calls.create()` to Twilio numbers creates dual TwiML legs.** The parent leg runs the `url` parameter's TwiML. The child leg runs the number's configured voice URL. Both execute independently and are bridged. When bridge-agent updates one leg to `<Dial><Conference>`, that leg joins the conference and the bridge with the other leg breaks.

**endConferenceOnExit configuration is critical:**
- Caller: `endConferenceOnExit: true` (conference ends when caller hangs up)
- AI Receptionist: `endConferenceOnExit: false` (removing AI doesn't end conference)
- Agent: `endConferenceOnExit: false` (agent leaving doesn't kill caller's call)

**Account concurrent call limits.** Warm transfer needs 4+ concurrent calls (caller conference leg, receptionist CR leg, agent briefing parent leg, agent briefing child leg). Trial/new accounts may have a 2-call limit. Error 10004 = concurrency limit exceeded. Verify limits before building multi-call flows.

**ConversationRelay `sendDigits` message.** The WS server can send `{ type: "sendDigits", digits: "1" }` to play DTMF tones on the call. Useful for simulating button presses in E2E tests. Other undocumented outgoing CR message types: `play` (play audio URL), `language` (switch TTS/transcription language).

### Sales Dialer

**Essentially:** Outbound Contact Center variant

**All outbound contact center features apply**, plus:
- Higher CPS needs (may need offline approval)
- AMD critical for efficiency
- Branded Calling essential for answer rates
- Voice Insights Reports API for campaign analytics
- Conversational Intelligence for propensity-to-buy signals

### Call Tracking

**Goal:** Marketing attribution via unique phone numbers per campaign.

**Pattern:**
1. Buy pool of Twilio numbers
2. Assign unique number per campaign/ad
3. `<Dial>` to common destination
4. Log metadata (which number received call)
5. Analyze which campaigns drive calls

**Note:** `<Dial>` calls are NOT CPS rate-limited. AMD usually not relevant (expecting human to answer).

### PSTN Connectivity

**Use Case:** Customer owns SIP infrastructure, needs PSTN access.

**CRITICAL:** Elastic SIP Trunking **BYPASSES Programmable Voice**.

| Feature | Elastic SIP Trunking | Programmable Voice |
|---------|---------------------|-------------------|
| TwiML | ❌ Not available | ✅ Full access |
| AMD | ❌ Not available | ✅ Available |
| Custom call flows | ❌ Not available | ✅ Full flexibility |
| Recording | ✅ At trunk level | ✅ Multiple methods |
| Voice Insights | ✅ Available | ✅ Available |
| CPS | Per trunk, per region | Per account |

**When to use Elastic SIP Trunking:**
- Customer has existing SIP PBX
- Just need phone numbers or PSTN egress
- No need for Programmable Voice features

**When to use Programmable Voice:**
- Need TwiML, AMD, custom call flows
- Building applications, not just connectivity

---

## Cross-Cutting Concerns

### Deep Validation (MANDATORY)

**A 200 OK is NOT sufficient.** Voice calls can "appear to work" while silently failing. Every implementation MUST validate:

```
ALWAYS CHECK (every call):
□ Call Resource (/Calls/{CallSid}) - status, duration, pricing
□ Call Events (/Calls/{CallSid}/Events) - HTTP/API requests and responses
□ Debugger - TwiML errors, HTTP errors, carrier errors
□ Voice Insights Call Summary - quality score, disposition
□ Voice Insights Call Events - timeline, SDK events
□ Voice Insights Call Metrics - jitter, packet loss, latency
□ Functions logging - your application logs

WHEN USING CONFERENCE (add these):
□ Conference Insights Summary - participant count, duration, aggregate quality
□ Conference Insights Participant Summary - per-participant metrics, join/leave times
```

**⚠️ Voice/Conference Insights Timing:**
Summaries are NOT immediately available after call/conference ends:
- **Partial data:** ~2 minutes after end (no SLA guarantee)
- **Final data:** Locked and immutable 30 minutes after end
- Check `processingState` field: `'partial'` vs `'complete'`
- DeepValidator handles 404 gracefully when data not yet available

**Feature Factory Enforcement:** Dev and review agents MUST verify all applicable checks pass. Use `DeepValidator.validateCall()` for calls and `DeepValidator.validateConference()` for conferences.

### Trust & Answer Rates

For outbound calls, implement all four:

**1. SHAKEN/STIR Attestation**
- Per-number setup via Trust Hub
- Creates Business Profile (24hr vetting) → Trust Product (72hr vetting)
- Levels: A (highest, full verification), B (partial), C (gateway)
- Incoming calls: check `StirVerstat` webhook parameter
- Call forwarding: pass `CallToken` to preserve verification

**2. Voice Integrity**
- Registers numbers with carrier analytics (T-Mobile, AT&T, Verizon)
- Requires Business Profile with EIN/DUNS
- 24-48 hour remediation after approval

**3. Branded Calling (Basic)**
- Display business name (15-32 chars depending on carrier)
- Requires Voice Integrity approval
- Mobile only - use CNAM for landlines
- T-Mobile and Verizon (US)

**4. Enhanced Branded Calling**
- Name + logo + call reason
- Requires SHAKEN/STIR Level A + signed LOA
- Currently Public Beta

### Media Streams

**`<Start><Stream>` - Unidirectional:**
- Your WebSocket receives audio only
- Tracks: `inbound_track`, `outbound_track`, or `both_tracks`
- Up to 4 streams per call
- Continues TwiML execution after starting
- Use for: real-time transcription, monitoring, analytics

**`<Connect><Stream>` - Bidirectional:**
- Your WebSocket receives AND sends audio
- **Only inbound track** (no outbound option)
- **Only 1 stream per call**
- **Blocks subsequent TwiML** until WebSocket closes
- Use for: AI voice agents, interactive dialogue

**Both require:**
- Secure WebSocket (wss://, port 443)
- Audio format: mulaw 8000Hz, base64-encoded
- Validate `X-Twilio-Signature` header

**Gotcha:** Bidirectional streams support inbound DTMF only. Cannot send tone signals back.

### Recording & Transcription

**Recording Storage:**
- Keep on Twilio (default)
- Configure S3 bucket for external storage
- DELETE via API when no longer needed
- Consider regulatory retention requirements

**Transcription Options:**

| Type | When | Use |
|------|------|-----|
| Real-time | During call | ConversationRelay, Media Streams |
| Batch (Voice Intelligence) | After call | Compliance, QA at scale |
| Gather speech | During call | Simple intent detection |

**Conversational Intelligence features:**
- Entity detection (competitors, products)
- Sentiment analysis
- PII redaction
- Custom language operators

**Scale Problem:** 5,000 calls = 11 days of linear listening. ML-powered transcription + analysis is required for any meaningful volume.

---

## Gotchas & Edge Cases

### Elastic SIP vs Programmable Voice

**CRITICAL:** Elastic SIP Trunking BYPASSES Programmable Voice.
- No TwiML
- No AMD
- No custom call logic

If a use case requires ANY Programmable Voice feature, do not recommend Elastic SIP Trunking.

### Conference Startup

A conference does not start until:
1. At least 2 participants have joined, AND
2. At least one has `startConferenceOnEnter=true`

Check this configuration or calls will appear to connect but participants won't hear each other.

### endConferenceOnExit

If misconfigured, someone dropping during warm transfer ends the conference for everyone.
- Audit who has `endConferenceOnExit=true`
- Usually only the "host" or specific participant should have this

### CPS Rate Limiting

| Call Type | Rate Limited? |
|-----------|--------------|
| Calls API | Yes (1 default, 5 self-serve, more needs approval) |
| `<Dial>` verb | No |
| Elastic SIP | Yes, but per trunk/per region |

### AMD Not Available on SIP Trunking

AMD requires Programmable Voice. Cannot detect answering machines on Elastic SIP Trunking calls.

### AMD Voicemail Timing

If voicemail answers, wait for beep before playing message - or the beginning will be cut off while voicemail greeting plays.

### TwiML Delivery Methods

| Method | When |
|--------|------|
| Webhook URL | Most common, dynamic content |
| Inline TwiML | Simple static flows |
| Application SID | Encapsulates webhook config |
| Functions | Serverless, low latency |
| Studio | **Never recommend** (see decision framework) |

---

## 2026 Customer Problem Themes

Context for what customers are asking for today:

### Theme 1: Improve Answer Rates & Regulatory Compliance
"Our calls show as spam likely / get blocked"
→ Branded Calling, SHAKEN/STIR, Voice Integrity, Voice Insights

"We need to comply with TCPA/TSR"
→ AMD, consent management, proper call disposition

### Theme 2: Turn Calls Into Actionable Content
"We have 5,000 years of calls and don't know what's in them"
→ Recordings, transcriptions, Conversational Intelligence

"We want to feed call content to AI/train models"
→ Media Streams, transcription APIs

### Theme 3: Evolve Self-Service with Agentic AI
"Replace expensive human agents with AI"
→ ConversationRelay, proper guardrails

"Replace static IVRs with dynamic AI"
→ ConversationRelay + monitoring

### Theme 4: Adopt Modern Speech Technologies
"Our TTS sounds robotic and dated"
→ Neural/Generative voices

"ASR doesn't understand customers"
→ Latest speech recognition, real-time transcription

### Theme 5: Understand Call Behavior
"We don't have data science to analyze call data"
→ Voice Insights suite, Reports API

"Quality is our differentiator"
→ Voice Insights Call Metrics, Conference Insights

---

## Related Resources

- [Voice Use Case Product Map](/.claude/skills/voice-use-case-map.md) - Per-use-case product recommendations, prerequisites, and gotchas
- [functions/voice/CLAUDE.md](/functions/voice/CLAUDE.md) - TwiML verb reference
- [functions/conversation-relay/CLAUDE.md](/functions/conversation-relay/CLAUDE.md) - Real-time Voice AI (protocol, streaming, LLM integration, context management)
- [Voice MCP Tools](/agents/mcp-servers/twilio/src/tools/voice.ts) - 29 tools including:
  - Call management: `get_call_logs`, `make_call`, `get_call`, `update_call`
  - Recordings (account-level): `get_recording`, `list_recordings`, `delete_recording`
  - Recordings (call-level): `list_call_recordings`, `start_call_recording`, `update_call_recording`, `delete_call_recording`
  - Conferences: `list_conferences`, `get_conference`, `update_conference`, `list_conference_participants`, `get_conference_participant`, `update_conference_participant`, `add_participant_to_conference`, `list_conference_recordings`
  - Media Streams: `start_call_stream`, `stop_call_stream`
  - Voice Insights: `get_call_summary`, `list_call_events`, `list_call_metrics`
  - Conference Insights: `get_conference_summary`, `list_conference_participant_summaries`, `get_conference_participant_summary`
  - Transcriptions: `list_recording_transcriptions`, `get_transcription`
- [DeepValidator](/agents/mcp-servers/twilio/src/validation/deep-validator.ts) - `validateCall()` and `validateConference()` methods
- [Twilio Voice Docs](https://www.twilio.com/docs/voice) - Official reference
