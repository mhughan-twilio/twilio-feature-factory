# Build Twilio Apps with AI Agents

A step-by-step guide to building Twilio applications using Claude Code and autonomous AI agents.

## What You'll Build

In this walkthrough, you'll build a **Voice AI Assistant with Call Summary** - a comprehensive application that:

1. **Receives an incoming call** via a Twilio phone number
2. **Connects to a ConversationRelay-powered AI agent** for real-time voice conversation
3. **Records the call** for quality and compliance
4. **Transcribes the recording** after the call ends
5. **Stores conversation data in Sync** for real-time state tracking
6. **Sends an SMS summary** to the caller after the call

This demonstrates how multiple Twilio products work together and shows the full power of the AI agent pipeline.

**Twilio Products Used**:
- Voice API (incoming calls, TwiML)
- ConversationRelay (real-time voice AI with LLM)
- Recordings & Transcriptions
- Sync (real-time state storage)
- Messaging (SMS summary)

**Time estimate**: 30-45 minutes

## The Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  1. BRAINSTORM                                              │
│     Develop your concept with Claude Code                   │
│     Save as concept.md                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. PLAN                                                    │
│     Claude Code enters plan mode                            │
│     Creates implementation plan, you approve                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. EXECUTE                                                 │
│     Autonomous agents run:                                  │
│     /architect → /spec → /test-gen → /dev → /review → /docs│
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. VERIFY & DEPLOY                                         │
│     Deep validation, test coverage, deployment              │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before starting, make sure you have:

- [ ] **Node.js 20 or 22** installed
- [ ] **Twilio CLI** installed (`npm install -g twilio-cli`)
- [ ] **Twilio Serverless plugin** installed (`twilio plugins:install @twilio-labs/plugin-serverless`)
- [ ] **Twilio account** with Account SID and Auth Token
- [ ] **Claude Code** installed and configured
- [ ] This repository cloned locally
- [ ] **Twilio Sync Service** (created automatically by setup script)
- [ ] **ngrok** installed for E2E testing (`brew install ngrok` or https://ngrok.com/download)
- [ ] **Twilio CLI profile** configured for the correct account (`twilio profiles:list`)

### Verify Your Setup

```bash
# Check Node.js version (need 20 or 22)
node --version

# Check Twilio CLI
twilio --version

# Check Twilio CLI profile (important: use correct account!)
twilio profiles:list
# If you need to switch: twilio profiles:use <profile-name>

# Check ngrok
ngrok --version

# Check Claude Code
claude --version
```

### Project Setup

```bash
# Navigate to your project
cd twilio-feature-factory

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Twilio credentials
# TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_AUTH_TOKEN=your_auth_token
# TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# Run the setup script to provision Twilio resources
npm run setup
```

The setup script provisions:
- Verify Service
- Sync Service
- Messaging Service
- TaskRouter Workspace

---

## Phase 1: Brainstorm

### Start Claude Code

```bash
cd twilio-feature-factory
claude
```

### Reference the Brainstorm Template

In Claude Code, reference the brainstorm template:

```
Using .claude/references/brainstorm.md, help me brainstorm
a voice AI assistant that records calls, transcribes them,
stores data in Sync, and sends an SMS summary to the caller
```

### Iterative Concept Development

Claude Code will ask questions one at a time to develop your concept:

1. **Problem Statement**: What problem are you solving?
2. **Target Users**: Who will use this?
3. **Key Features**: What must it do?
4. **Twilio APIs**: Which services are needed?
5. **Success Criteria**: How will you know it works?

### Example Output

After the brainstorming session, you'll have a concept like:

```markdown
### Concept: Voice AI Assistant with Call Summary

**Problem**: Businesses need to capture, transcribe, and summarize
customer calls for follow-up and compliance.

**Solution**: A Twilio-powered voice AI that handles calls,
records and transcribes them, stores state, and sends summaries.

**Twilio APIs Used**:
- Voice API: Incoming calls, TwiML routing
- ConversationRelay: Real-time LLM-powered voice AI
- Recordings: Call recording with transcription
- Sync: Store call state and conversation data
- Messaging: Send SMS summary to caller

**Key Features**:
1. Answer calls and connect to AI agent via ConversationRelay
2. Record the entire conversation
3. On call end, transcribe the recording
4. Store conversation data in Sync Document
5. Send SMS to caller with call summary

**Technical Considerations**:
- WebSocket server for ConversationRelay protocol
- Status callbacks for recording completion
- Async transcription handling
- Sync Document for state persistence
- SMS rate limiting considerations

**Data Flow**:
1. Call → TwiML handler → <Connect><ConversationRelay>
2. ConversationRelay ↔ WebSocket server ↔ LLM
3. Call ends → Recording status callback
4. Transcription completes → Store in Sync
5. Send SMS summary
```

### Save Your Concept

Ask Claude Code to save the output:

```
Please save this concept to concept.md
```

---

## Phase 2: Plan

### Automatic Plan Mode

After brainstorming, describe the implementation task:

```
Implement the Voice AI Assistant with Call Summary from concept.md
```

Claude Code automatically enters plan mode for complex tasks. It will:

1. **Explore the codebase** - Find relevant patterns in `functions/voice/`, `functions/conversation-relay/`, `functions/sync/`, `functions/messaging/`
2. **Design the approach** - Determine file locations, webhook chains, callback handlers
3. **Create the plan** - Detailed implementation steps

### Review the Plan

Claude Code will present a plan covering:

**Files to create**:
- `functions/voice/ai-assistant.js` - TwiML handler for incoming calls
- `functions/conversation-relay/ai-assistant-ws.js` - WebSocket server
- `functions/conversation-relay/recording-complete.protected.js` - Recording callback
- `functions/callbacks/transcription-complete.protected.js` - Transcription callback
- `functions/helpers/send-summary.private.js` - SMS summary helper

**Architecture decisions**:
- Why ConversationRelay vs Gather/Say
- Recording configuration options
- Sync Document structure
- SMS timing and content

### Approve

When satisfied with the plan, approve it. Claude Code will then hand off to the autonomous agent pipeline.

---

## Phase 3: Execute

### The Agent Pipeline

Once approved, autonomous agents execute in sequence:

```
/architect    Review architecture, select patterns
      ↓
/spec         Create detailed specification
      ↓
/test-gen     Write failing tests (TDD Red Phase)
      ↓
/dev          Implement code to pass tests (TDD Green Phase)
      ↓
/review       Code review and security audit
      ↓
/docs         Update documentation
```

### What You'll See

#### Architect Phase

```
## Architecture Review: Voice AI Assistant

### Recommendation: PROCEED

### Domain Placement
- Voice handlers: functions/voice/
- WebSocket server: functions/conversation-relay/
- Callbacks: functions/callbacks/
- Helpers: functions/helpers/

### Patterns to Use
- ConversationRelay WebSocket protocol (see functions/conversation-relay/CLAUDE.md)
- Recording status callbacks (see functions/callbacks/CLAUDE.md)
- Sync Document for state (see functions/sync/CLAUDE.md)

### Integration Points
- Voice → ConversationRelay (TwiML <Connect>)
- Recording → Transcription (automatic after recordingCompleted)
- Transcription → Sync (store)
- Sync → SMS (trigger summary)

### Next Step: /spec
```

#### Spec Phase

```
## Specification: Voice AI Assistant

### Function: ai-assistant.js (public)
- Handles incoming calls
- Returns TwiML with <Connect><ConversationRelay>
- Configures recording on the call
- Passes caller info to WebSocket via URL params

### Function: ai-assistant-ws.js (WebSocket)
- Implements ConversationRelay protocol
- Handles setup, prompt, interrupt messages
- Integrates with LLM for responses
- Tracks conversation state

### Function: recording-complete.protected.js
- Receives recordingCompleted callback
- Initiates transcription request
- Updates Sync Document with recording SID

### Function: transcription-complete.protected.js
- Receives transcriptionCompleted callback
- Stores transcript in Sync Document
- Triggers SMS summary

### Function: send-summary.private.js
- Generates call summary from transcript
- Sends SMS to caller
- Updates Sync Document with SMS status

### Test Requirements
- Unit: TwiML structure, WebSocket message handling
- Integration: Full call flow with mocked callbacks
- E2E: ConversationRelay protocol validation
```

#### Test-Gen Phase (TDD Red)

```
## Tests Generated

### Files Created
- __tests__/unit/voice/ai-assistant.test.js
- __tests__/unit/conversation-relay/ai-assistant-ws.test.js
- __tests__/unit/conversation-relay/recording-complete.test.js
- __tests__/unit/callbacks/transcription-complete.test.js
- __tests__/integration/voice/ai-assistant-flow.test.js

### Test Count: 28 tests

### Status: All tests FAIL (expected - code doesn't exist yet)
```

#### Dev Phase (TDD Green)

```
## Implementation Complete

### Files Created
- functions/voice/ai-assistant.js
- functions/conversation-relay/ai-assistant-ws.js
- functions/conversation-relay/recording-complete.protected.js
- functions/callbacks/transcription-complete.protected.js
- functions/helpers/send-summary.private.js

### Test Results: 28 passed, 0 failed
```

#### Review Phase

```
## Code Review: Voice AI Assistant

### Verdict: APPROVED

### Checklists
- [x] ABOUTME comments present
- [x] ConversationRelay protocol correctly implemented
- [x] Recording configured with proper options
- [x] Callbacks handle errors gracefully
- [x] Sync operations use correct document structure
- [x] SMS content is appropriate length
- [x] No hardcoded credentials
```

### Human Approval Gates

The pipeline pauses for human approval at:

1. **After /architect** - Confirm the multi-product integration approach
2. **After /spec** - Confirm the webhook chain and data flow
3. **After /review** - Confirm code quality and security

---

## Phase 4: Verify & Deploy

### Run Tests

```bash
npm test
```

Expected output:

```
PASS  __tests__/unit/voice/ai-assistant.test.js
PASS  __tests__/unit/conversation-relay/ai-assistant-ws.test.js
PASS  __tests__/unit/conversation-relay/recording-complete.test.js
PASS  __tests__/unit/callbacks/transcription-complete.test.js
PASS  __tests__/integration/voice/ai-assistant-flow.test.js

Test Suites: 5 passed, 5 total
Tests:       28 passed, 28 total
```

### Deploy to Twilio Serverless

```bash
npm run deploy:dev
```

Your webhook URLs:
- Voice: `https://your-service-dev.twil.io/voice/ai-assistant`
- Callbacks are automatically configured

> **Important: WebSocket Server Hosting**
>
> Twilio serverless functions are HTTP request/response handlers - they **cannot** host WebSocket servers. ConversationRelay requires a WebSocket endpoint, which must be hosted externally.
>
> For E2E testing, use the local WebSocket server with ngrok (see below).
> For production, host the WebSocket server on Railway, Fly.io, Render, or AWS.

### Set Up Local WebSocket Server for E2E Testing

ConversationRelay requires a WebSocket server to handle the AI conversation. For testing, run the server locally and expose it via ngrok.

**Terminal 1 - Start the WebSocket server:**

```bash
# The E2E test server is included in the repo
node __tests__/e2e/conversation-relay-server.js
```

You should see:
```
=================================================
  ConversationRelay E2E Test Server
=================================================
  Port: 8080
  Finalize URL: (not configured)
```

**Terminal 2 - Start ngrok tunnel:**

```bash
ngrok http 8080
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.dev`)

**Terminal 3 - Update Twilio environment:**

```bash
# Convert https:// to wss:// for WebSocket URL
twilio serverless:env:set \
  --key CONVERSATION_RELAY_URL \
  --value "wss://abc123.ngrok-free.dev" \
  --environment dev-environment \
  --service-sid <your-service-sid>
```

To find your service SID: `twilio serverless:list services`

**Optional: Enable SMS Summary**

To test the full flow with SMS summaries after calls:

```bash
# Restart WebSocket server with finalize URL
FINALIZE_URL="https://your-service-dev.twil.io/conversation-relay/finalize-demo" \
  node __tests__/e2e/conversation-relay-server.js
```

### Configure Your Phone Number

1. Log into [Twilio Console](https://console.twilio.com)
2. Navigate to Phone Numbers > Manage > Active Numbers
3. Select your phone number
4. Under "Voice & Fax", set "A Call Comes In" to your voice webhook URL

Or via CLI:
```bash
twilio api:core:incoming-phone-numbers:update \
  --sid <phone-number-sid> \
  --voice-url "https://your-service-dev.twil.io/conversation-relay/ai-assistant-inbound"
```

### Test It!

1. Call your Twilio phone number
2. Talk to the AI assistant
3. Have a short conversation
4. Hang up
5. Wait a few seconds for transcription
6. Receive an SMS summary of your call!

### Verify in Twilio Console

- **Recordings**: Check Console > Monitor > Recordings
- **Sync**: Check Console > Sync > Services > Documents
- **Messages**: Check Console > Monitor > Messaging

---

## Understanding the Agent Pipeline

### What Each Agent Does

| Agent | Role | Output |
|-------|------|--------|
| `/architect` | Evaluates multi-product integration, selects patterns | Design recommendation |
| `/spec` | Creates detailed specs for each function | Function specs, data flow, test requirements |
| `/test-gen` | Writes failing tests (TDD Red Phase) | Test files across all components |
| `/dev` | Implements code to pass tests (TDD Green Phase) | Implementation code |
| `/review` | Code review, security audit, integration review | Approval verdict |
| `/docs` | Updates documentation | CLAUDE.md updates |

### What Agents Use

Agents have access to:

- **MCP Tools**: Twilio APIs (send SMS, create Sync docs, query recordings)
- **Skills**: Domain knowledge for Voice, ConversationRelay, Sync, Messaging
- **Hooks**: Quality enforcement (TDD, security, credentials)
- **CLAUDE.md Hierarchy**: Context for each domain (`functions/voice/CLAUDE.md`, etc.)

### Deep Validation

The agent pipeline uses **deep validation** - verification beyond HTTP 200:

- Check recording status (completed, not failed)
- Verify transcription success
- Confirm Sync document created
- Verify SMS delivered

---

## Quick Reference

### Starting a New Feature

```
Using .claude/references/brainstorm.md, help me brainstorm [your idea]
```

Then:

```
Implement the [concept name] from concept.md
```

### Utility Commands

| Command | Purpose |
|---------|---------|
| `/twilio-docs [topic]` | Search Twilio documentation |
| `/twilio-logs` | Analyze Twilio debugger logs |
| `/deploy [env]` | Deploy with validation checks |

### Troubleshooting

**Q: Tests fail after /test-gen - is something wrong?**

A: No! Tests are supposed to fail at this stage. This is TDD - you write tests first, then make them pass with `/dev`.

**Q: /review says NEEDS_CHANGES - what now?**

A: Address the feedback. Claude Code will continue with the fixes, then review again.

**Q: Recording callback not received?**

A: Check that the callback URL is publicly accessible and correctly configured. Use `/twilio-logs` to check for errors.

**Q: SMS not received?**

A: Verify the phone number is SMS-capable and check the Messaging logs in Twilio Console.

**Q: Call connects but immediately says "application error"?**

A: This usually means the TwiML handler failed. Check:
1. Is the WebSocket server running? (`lsof -i :8080`)
2. Is ngrok running? (`curl http://localhost:4040/api/tunnels`)
3. Is `CONVERSATION_RELAY_URL` set correctly? (must be `wss://` not `https://`)
4. Check Twilio debugger logs: `/twilio-logs` or Console > Monitor > Errors

**Q: WebSocket server not receiving connections?**

A: Common issues:
1. ngrok URL expired (free tier URLs change each session)
2. Firewall blocking WebSocket upgrade
3. Wrong URL format in environment variable
4. Test with: `wscat -c wss://your-ngrok-url.ngrok-free.dev`

**Q: Deployed to wrong Twilio account?**

A: Check your Twilio CLI profile: `twilio profiles:list`. Switch with `twilio profiles:use <name>`.

---

## Next Steps

Now that you understand the workflow:

1. **Try a real feature**: Use brainstorm.md to develop your own idea
2. **Explore capabilities**: Check `functions/` for examples of all Twilio products
3. **Read domain docs**: Each `functions/*/CLAUDE.md` has domain-specific patterns

## Resources

- [README.md](README.md) - Project overview
- [CLAUDE.md](CLAUDE.md) - Development standards
- [agents/README.md](agents/README.md) - Agent architecture
- [functions/conversation-relay/CLAUDE.md](functions/conversation-relay/CLAUDE.md) - ConversationRelay patterns
- [functions/voice/CLAUDE.md](functions/voice/CLAUDE.md) - Voice/TwiML patterns
- [Twilio ConversationRelay Docs](https://www.twilio.com/docs/voice/conversationrelay)
