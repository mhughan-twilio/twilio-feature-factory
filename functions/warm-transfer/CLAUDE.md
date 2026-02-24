# Warm Transfer Functions Context

This directory contains Twilio serverless functions for AI-powered warm call transfers. An AI receptionist handles incoming calls, determines routing, briefs the human agent via a separate call, then bridges everyone into a conference for handoff.

## Files

### Core Call Flow
| File | Access | Description |
|------|--------|-------------|
| `welcome.js` | Public | Inbound call handler — places caller in conference, adds AI receptionist via `calls.create` |
| `receptionist-relay.js` | Public | ConversationRelay TwiML for the AI receptionist conference participant |
| `initiate-agent-call.protected.js` | Protected | Writes transfer context to Sync, creates outbound call to the human agent |
| `agent-briefing-relay.js` | Public | ConversationRelay TwiML for the agent briefing call (separate from conference) |
| `bridge-agent.protected.js` | Protected | Updates agent's call with conference-joining TwiML after briefing completes |
| `remove-receptionist.protected.js` | Protected | Removes AI receptionist from conference after agent dismissal |

### E2E Test Infrastructure
| File | Access | Description |
|------|--------|-------------|
| `start-test.protected.js` | Protected | Test orchestrator — creates outbound call from simulated caller to receptionist number |
| `caller-ai-relay.js` | Public | ConversationRelay TwiML for the simulated test caller |
| `agent-ai-relay.js` | Public | ConversationRelay TwiML for the simulated test agent |

## Architecture: Conference-First with CR Participant

The warm transfer uses a four-phase, conference-first architecture. The Participants API bridges audio into the conference at the transport level regardless of what TwiML the participant runs, so a ConversationRelay call leg functions as a conference participant with bidirectional audio.

```
Phase 1 — INTAKE:
  Caller ──► Conference ◄── Receptionist AI (CR participant)
  Caller and AI talk through the conference.
  AI determines which agent the caller needs (Alice or Bob).

Phase 2 — TRANSFERRING → HOLD_CHAT:
  Caller + Receptionist AI still in conference (small talk / hold chat).
  Agent ◄──CR──► Briefing AI (separate call, NOT in conference).
  Briefing AI reads transfer context from Sync and briefs the agent.

Phase 3 — CONFERENCE:
  Agent's call updated with conference-joining TwiML.
  Conference: Caller + Receptionist AI + Agent (three-way).

Phase 4 — DISMISSED:
  Agent says natural dismissal phrase ("Thanks, I've got it from here").
  Receptionist AI detects dismissal → removes itself from conference.
  Conference: Caller + Agent (two-way).
```

### Call Leg Topology

```
welcome.js
  └── Caller → <Dial><Conference>{name}</Conference></Dial>
  └── calls.create → receptionist-relay.js
       └── Receptionist AI → <Connect><ConversationRelay url="wss://.../receptionist"/>

initiate-agent-call.protected.js  (called by receptionist WS handler)
  └── Sync doc: warm-transfer-{conferenceName}
  └── calls.create → agent-briefing-relay.js
       └── Agent → <Connect><ConversationRelay url="wss://.../briefing"/>

bridge-agent.protected.js  (called by briefing WS handler when agent signals ready)
  └── calls(AgentCallSid).update({ twiml: <Say> + <Dial><Conference>{name}</Conference> })
  └── Three-way conference: Caller + AI + Agent

remove-receptionist.protected.js  (called by receptionist WS handler on dismissal)
  └── conferences(sid).participants(ReceptionistCallSid).update({ status: 'completed' })
  └── Two-way conference: Caller + Agent
```

## Receptionist State Machine

The receptionist WebSocket handler follows a strict state machine:

```
INTAKE ──► TRANSFERRING ──► HOLD_CHAT ──► CONFERENCE ──► DISMISSED
  │              │                │              │              │
  │  AI chats    │  Agent call    │  Small talk  │  Three-way   │  AI removed
  │  with caller │  initiated     │  with caller │  with agent  │  from conf.
```

- **INTAKE**: AI greets caller, determines intent and target agent.
- **TRANSFERRING**: AI has triggered transfer; agent call is being created.
- **HOLD_CHAT**: Agent is on briefing call; AI makes small talk with caller.
- **CONFERENCE**: Agent has joined the conference; three-way conversation.
- **DISMISSED**: Agent used dismissal phrase; AI removed from conference.

Invalid transitions throw an error. See `__tests__/e2e/warm-transfer/receptionist-handler.js` for the `ReceptionistStateMachine` class.

### Transfer Detection

The receptionist AI's response is scanned for transfer trigger phrases:
- "connect you with {AgentName}"
- "transfer you to {AgentName}"

Only declarative statements trigger (not questions like "would you like me to connect you with...").

### Dismissal Detection

The agent's speech is scanned for dismissal phrases:
- "I've got it" / "I'll take it from here" / "I can take it from here"
- "got it from here"
- "thank" + "take it from here"

See `__tests__/e2e/warm-transfer/receptionist-handler.js` for `detectTransferTrigger` and `detectDismissalPhrase`.

### Briefing Ready Signal

The agent signals readiness to join the conference via:
- **Speech**: "ready", "connect me", "I'm ready"
- **DTMF**: Digit `1`

See `__tests__/e2e/warm-transfer/briefing-handler.js` for `detectReadySignal`.

## Environment Variables

All warm transfer env vars use the `WT_` prefix:

| Variable | Description |
|----------|-------------|
| `WT_RECEPTIONIST_RELAY_URL` | WebSocket URL for the receptionist AI handler (e.g., `wss://domain/receptionist`) |
| `WT_BRIEFING_RELAY_URL` | WebSocket URL for the agent briefing AI handler (e.g., `wss://domain/briefing`) |
| `WT_AGENT_ALICE_NUMBER` | Phone number for agent "Alice" (E.164) |
| `WT_AGENT_BOB_NUMBER` | Phone number for agent "Bob" (E.164) |
| `WT_RECEPTIONIST_NUMBER` | Twilio number configured with `welcome.js` as voice URL (E2E tests) |
| `WT_CALLER_AI_RELAY_URL` | WebSocket URL for the simulated test caller (E2E tests) |
| `WT_AGENT_AI_RELAY_URL` | WebSocket URL for the simulated test agent (E2E tests) |
Also requires the standard `TWILIO_PHONE_NUMBER`, `TWILIO_SYNC_SERVICE_SID`, and `DOMAIN_NAME` variables.

## Testing

### Unit Tests

```bash
npm test -- __tests__/unit/warm-transfer/
```

Unit tests cover each serverless function in isolation: TwiML generation, parameter validation, error responses.

### Integration Tests

```bash
npm test -- __tests__/integration/warm-transfer/
```

Integration tests cover cross-function behavior: receptionist state machine transitions, briefing ready signal detection, dismissal phrase detection, and transfer trigger phrase extraction.

### E2E Tests (Agent-to-Agent)

The E2E test infrastructure uses four AI agents (all via ConversationRelay) to simulate a complete warm transfer:

1. **Caller AI** — Simulates a customer calling in
2. **Receptionist AI** — The AI receptionist being tested
3. **Briefing AI** — Briefs the human agent (also AI in test mode)
4. **Agent AI** — Simulates the human agent

#### Full E2E Procedure

1. Start the E2E WebSocket server (`__tests__/e2e/warm-transfer/`)
2. Expose via ngrok
3. Set all `WT_*` relay URLs to the ngrok domain with appropriate paths
4. Set `WT_RECEPTIONIST_NUMBER` to a Twilio number with `welcome.js` as voice URL
5. Deploy functions
6. Trigger via: `curl -X POST https://{domain}/warm-transfer/start-test`
7. Monitor logs for state transitions and verify the full flow completes

### WebSocket Handlers (Test Infrastructure)

| File | WS Path | Role |
|------|---------|------|
| `receptionist-handler.js` | `/receptionist` | Intake conversation, intent extraction, triggers agent call, detects dismissal |
| `briefing-handler.js` | `/briefing` | Reads Sync context, briefs agent, detects ready signal |

These are in `__tests__/e2e/warm-transfer/` and are NOT deployed as Twilio Functions.

## Gotchas

| Symptom | Cause | Fix |
|---------|-------|-----|
| AI receptionist not audible in conference | CR leg not joining conference correctly | Verify Participants API is used (bridges audio at transport level regardless of TwiML) |
| Agent never joins conference | Briefing handler not detecting ready signal | Check that `last: true` is used (not `isFinal`) and DTMF digit `1` is handled |
| "Unknown agent" error from initiate-agent-call | Agent name not in agent map | Agent names are case-insensitive; only "alice" and "bob" are configured |
| Sync doc "already exists" (54301) | Duplicate call to initiate-agent-call | Handled gracefully — error is caught and call proceeds |
| Receptionist stays in conference after dismissal | Dismissal phrase not detected | Check exact phrasing patterns in `detectDismissalPhrase`; must match a known pattern |
| Conference tears down when receptionist removed | Caller has `endConferenceOnExit: true` but wrong participant exited | Only the caller's leg should have `endConferenceOnExit: true` |
| Briefing call connects but no context | Sync doc not found | Verify `TWILIO_SYNC_SERVICE_SID` is set and `initiate-agent-call` was called first |
| E2E test call doesn't connect | Missing `WT_RECEPTIONIST_NUMBER` or `WT_CALLER_AI_RELAY_URL` | `start-test` validates these env vars; check error response |

## Logging and Response Rules

Use `console.log` for **all** logging — never `console.error()` (82005 alerts) or `console.warn()` (82004 alerts).

Always `JSON.stringify()` response bodies and set `Content-Type: application/json`:

```javascript
response.appendHeader('Content-Type', 'application/json');
response.setBody(JSON.stringify({ success: true }));
```
