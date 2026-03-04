---
archived: 2026-02-24T14:21:13-08:00
branch: main
project: twilio-feature-factory
source: ~/.claude/plans/floofy-bouncing-feigenbaum.md
title: Voice AI Warm Transfer — Implementation Plan
---


# Voice AI Warm Transfer — Implementation Plan

## Context

Build a voice AI receptionist that handles incoming calls, determines which human agent the caller wants (Alice or Bob), briefs that agent via a separate ConversationRelay call, then bridges everyone into a conference for a warm handoff. The AI stays in the conference until the human agent dismisses it naturally. For testing, all participants are AI agents.

**Critical open question**: Can a ConversationRelay call leg function as a conference participant (audio flows both ways)? The entire architecture depends on this. We'll run a spike test first.

## Step 0: Spike — Test ConversationRelay in Conference

Build a minimal test to determine if a Participants API call with ConversationRelay TwiML has its audio mixed into the conference.

### Files

**`functions/voice/warm-transfer/spike-conference.js`** (public)
- Creates a conference, puts the inbound caller in it
- Uses Participants API to add a second leg to a TwiML endpoint that returns ConversationRelay
- If the caller can hear the AI and the AI can hear the caller → CR-in-conference works

**`functions/voice/warm-transfer/spike-cr-participant.js`** (public)
- Returns ConversationRelay TwiML pointing to a simple WS echo server

**`__tests__/e2e/warm-transfer/spike-server.js`**
- Minimal WS server: on `setup`, sends greeting; on `prompt`, echoes back what it heard
- If the greeting is heard by the caller AND the echo confirms it heard the caller → success

### Test procedure
1. Start spike-server.js locally, ngrok it
2. Deploy spike functions, set env var `SPIKE_RELAY_URL`
3. Call the spike-conference number
4. Listen: do you hear the AI greeting? Say something — does it echo back?

### Outcome
- **Works** → proceed with Plan A (conference-first architecture)
- **Doesn't work** → proceed with Plan B (CR-first, then move to conference)

---

## Plan A: Conference-First Architecture (if spike succeeds)

### Architecture

```
Phase 1 — Intake:
  Caller ──► Conference
  Receptionist AI ──► CR participant in same conference
  (Caller and AI talk through conference)

Phase 2 — Hold + Briefing:
  Caller still in conference (receptionist keeps chatting / small talk)
  Agent ◄──CR──► Briefing AI (separate call, NOT in conference)

Phase 3 — Bridge:
  Agent's call updated to join conference
  Conference: Caller + Receptionist AI + Agent (all talking)

Phase 4 — Dismissal:
  Agent says "Thanks [name], I've got it"
  Receptionist AI detects phrase → removes itself from conference
  Conference: Caller + Agent
```

### Twilio Functions — `functions/voice/warm-transfer/`

| File | Access | Role |
|------|--------|------|
| `welcome.js` | Public | Inbound: puts caller in conference, adds AI participant via Participants API |
| `receptionist-relay.js` | Public | TwiML for AI participant: returns ConversationRelay |
| `initiate-agent-call.protected.js` | Protected | Writes Sync context, creates outbound call to agent PSTN |
| `agent-briefing-relay.js` | Public | TwiML for agent call: returns ConversationRelay for briefing |
| `bridge-agent.protected.js` | Protected | Updates agent call with `<Say>` intro + `<Dial><Conference>` |
| `remove-receptionist.protected.js` | Protected | Removes AI participant from conference |
| `caller-ai-relay.js` | Public | Test only: TwiML for simulated caller's ConversationRelay |
| `agent-ai-relay.js` | Public | Test only: TwiML for simulated agent's ConversationRelay |
| `start-test.protected.js` | Protected | Test orchestrator: creates outbound call from caller AI to receptionist |

### WebSocket Server — `__tests__/e2e/warm-transfer/`

Single Express + WS server with path-based routing (one ngrok tunnel):

| File | WS Path | Role |
|------|---------|------|
| `server.js` | — | Express+WS scaffold, path routing to handlers |
| `receptionist-handler.js` | `/receptionist` | Intake conversation, intent extraction, triggers agent call, detects dismissal |
| `briefing-handler.js` | `/briefing` | Reads Sync context, briefs agent, detects DTMF 1 / speech trigger |
| `caller-handler.js` | `/caller` | Test: simulates caller, randomly asks for Alice or Bob |
| `agent-handler.js` | `/agent` | Test: simulates human agent, listens to briefing, signals ready |

### Detailed Function Specs

#### `welcome.js`
1. Generate conference name: `wt-{timestamp}-{random}`
2. Put caller in conference: `<Dial><Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">{name}</Conference></Dial>`
3. Use Participants API to add AI leg: `client.conferences(name).participants.create({ from: TWILIO_PHONE_NUMBER, to: RECEPTIONIST_TWIML_NUMBER, ... })` — OR use `client.calls.create()` with `url` pointing to `receptionist-relay.js?ConferenceName={name}`

**Decision needed at impl time**: Participants API vs `calls.create()` depends on spike results. If Participants API auto-joins to conference AND ConversationRelay TwiML works on that leg, use Participants API. Otherwise use `calls.create()` where the TwiML explicitly does `<Dial><Conference>` before `<Connect><ConversationRelay>` (if that sequencing works).

#### `receptionist-relay.js`
- Receives `ConferenceName` as query param
- Returns ConversationRelay TwiML: `<Connect><ConversationRelay url="wss://.../receptionist?ConferenceName=..." voice="Google.en-US-Neural2-F" />`

#### `initiate-agent-call.protected.js`
Receives from WS server: `ConferenceName`, `AgentName`, `CallerIssue`, `CallerCallSid`

1. Write Sync doc `warm-transfer-{ConferenceName}` with context (create w/ TTL 3600, handle 54301)
2. Map agent name to number: Alice → `AGENT_ALICE_NUMBER`, Bob → `AGENT_BOB_NUMBER`
3. Create outbound call: `client.calls.create({ to: agentNumber, from: TWILIO_PHONE_NUMBER, url: '.../agent-briefing-relay?ConferenceName=...' })`
4. Return `{ success: true, agentCallSid }`

#### `bridge-agent.protected.js`
Receives: `AgentCallSid`, `ConferenceName`

1. Read Sync doc for context
2. Update agent's call: `client.calls(AgentCallSid).update({ twiml })` where TwiML is `<Say>` intro + `<Dial><Conference>{name}</Conference></Dial>`

#### `remove-receptionist.protected.js`
Receives: `ConferenceName`, `ReceptionistCallSid`

1. Find conference by name: `client.conferences.list({ friendlyName, status: 'in-progress' })`
2. Remove participant: `client.conferences(sid).participants(ReceptionistCallSid).update({ status: 'completed' })`

### WebSocket Handler Details

#### Receptionist Handler — State Machine
```
INTAKE → TRANSFERRING → HOLD_CHAT → CONFERENCE → DISMISSED
```

- **INTAKE**: Greets caller, extracts agent name + issue via LLM. System prompt instructs AI to say "Please hold while I connect you with [name]" when it has both.
- **TRANSFERRING**: Detects trigger phrase in own response → HTTP POST to `initiate-agent-call` with context. Stores `agentCallSid` from response.
- **HOLD_CHAT**: Keeps chatting with caller (small talk, "Alice will be right with you"). The WS server tracks this phase.
- **CONFERENCE**: Agent has joined. AI does introduction. Listens for dismissal phrase ("thanks", "I've got it", agent name + dismissal keywords).
- **DISMISSED**: Detected dismissal → HTTP POST to `remove-receptionist` → sends `{ type: "end" }`.

#### Briefing Handler
- On `setup`: reads `ConferenceName` from URL params, fetches Sync doc, briefs agent
- On `dtmf` digit `1` (real agent) OR speech trigger "ready" / "connect me" (AI agent): calls `bridge-agent` function
- Note: AI agents on ConversationRelay can't send DTMF — use speech trigger for test mode

#### Caller Handler (test only)
- System prompt: randomly picks Alice or Bob, picks random issue (billing, delivery, account access, product return, appointment)
- Behaves like a natural caller: answers questions, waits when told to hold, talks to agent in conference

#### Agent Handler (test only)
- System prompt: plays the role of Alice or Bob, listens to briefing, asks one clarifying question, then says "I'm ready, connect me"
- In conference phase: greets caller, helps with issue, eventually says "Thanks [receptionist name], I've got it from here"

### Protected Function Auth from WS Server

Use `twilio.getExpectedTwilioSignature()` to compute valid signatures:

```javascript
const twilio = require('twilio');
function callProtectedFunction(url, params) {
  const sig = twilio.getExpectedTwilioSignature(AUTH_TOKEN, url, params);
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': sig },
    body: new URLSearchParams(params),
  });
}
```

### Environment Variables (new)

```bash
# Warm Transfer - Relay URLs (set after starting ngrok)
RECEPTIONIST_RELAY_URL=wss://{ngrok-domain}/receptionist
BRIEFING_RELAY_URL=wss://{ngrok-domain}/briefing
CALLER_AI_RELAY_URL=wss://{ngrok-domain}/caller
AGENT_AI_RELAY_URL=wss://{ngrok-domain}/agent

# Warm Transfer - Agent numbers
AGENT_ALICE_NUMBER=+1XXXXXXXXXX
AGENT_BOB_NUMBER=+1XXXXXXXXXX

# Warm Transfer - Test numbers
RECEPTIONIST_NUMBER=+1XXXXXXXXXX
CALLER_AI_NUMBER=+1XXXXXXXXXX
```

---

## Plan B: CR-First Fallback (if spike fails)

If ConversationRelay can't work as a conference participant:

### Changes from Plan A

1. **`welcome.js`** returns ConversationRelay TwiML directly (no conference). Caller talks to receptionist via CR.
2. **`initiate-agent-call.protected.js`** also updates caller's call to conference TwiML: `client.calls(CallerCallSid).update({ twiml: conferenceJoinTwiml })`. This ends the receptionist's CR session.
3. **No receptionist in conference phase** — intro is `<Say>` whisper on agent's leg before joining conference.
4. **No dismissal detection** — agent and caller just talk. Receptionist AI is already gone.
5. **Simpler WS server** — no HOLD_CHAT or CONFERENCE states for receptionist handler.

This loses the warm transfer's "three-way conversation" and natural dismissal, but the core flow still works.

---

## Implementation Order

| Step | What | Dependencies |
|------|------|-------------|
| 1 | Spike test (3 files) | None |
| 2 | Evaluate spike results | Step 1 |
| 3 | `server.js` scaffold | None |
| 4 | `welcome.js` + `receptionist-relay.js` | Step 2 (architecture choice) |
| 5 | `receptionist-handler.js` | Steps 3, 4 |
| 6 | `initiate-agent-call.protected.js` | Step 5 |
| 7 | `agent-briefing-relay.js` + `briefing-handler.js` | Step 6 |
| 8 | `bridge-agent.protected.js` | Step 7 |
| 9 | `remove-receptionist.protected.js` | Step 8 |
| 10 | `caller-handler.js` + `agent-handler.js` (test) | Steps 5, 7 |
| 11 | `caller-ai-relay.js` + `agent-ai-relay.js` (test) | Step 10 |
| 12 | `start-test.protected.js` | All above |
| 13 | Manual integration test | Steps 4-9 deployed |
| 14 | Automated E2E test | All deployed |

Deploy functions after steps 4, 6, 8, 9, 11.

## Verification

### Manual test
1. Start WS server + ngrok tunnel
2. Deploy, set env vars for relay URLs
3. Call receptionist number from real phone
4. Talk to AI, ask for Alice
5. Verify: hold phase, agent call, briefing, bridge, conference, dismissal

### Automated E2E
- `start-test.protected.js` orchestrates full flow with all AI agents
- Validate via Sync docs: intent extracted, context passed, bridge completed
- Validate via call status: all calls completed without errors
- Validate via `validate_debugger`: no Twilio errors

### Key patterns reused
- ConversationRelay TwiML: `functions/conversation-relay/agent-a-inbound.protected.js`
- WS server + LLM: `__tests__/e2e/agent-server-template.js`
- Sync doc create/update: `functions/conversation-relay/recording-complete.protected.js`
- Conference management: `functions/voice/create-conference.protected.js`, `end-conference.protected.js`
- Outbound call creation: `functions/voice/outbound-dialer.js`
