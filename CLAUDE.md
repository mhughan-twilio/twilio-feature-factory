# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains two distinct but complementary concerns:

### Core Twilio Prototyping (`functions/`)

Production-ready Twilio serverless functions for voice, messaging, verification, and more. Built on Node.js, deployed via Twilio CLI and Serverless Toolkit.

- `functions/voice/` — Voice call handlers (TwiML)
- `functions/messaging/` — SMS/MMS handlers
- `functions/verify/` — Phone verification
- `functions/sync/` — Real-time state synchronization
- `functions/taskrouter/` — Skills-based routing
- `functions/conversation-relay/` — Real-time voice AI
- `functions/warm-transfer/` — AI-powered warm call transfer
- `functions/callbacks/` — Status callback handlers
- `functions/helpers/` — Shared private utilities

### AI Development Tooling (`agents/`)

Autonomous agent infrastructure built on Claude Agent SDK and MCP. These are AI-assisted development tools, not production Twilio serverless code.

- `agents/mcp-servers/twilio/` — MCP server wrapping Twilio APIs as 261+ tools
- `agents/feature-factory/` — Orchestrated development workflows
- `agents/voice-ai-builder/` — Voice AI application generator

### Architecture Separation

**Critical**: These two concerns are intentionally decoupled.

- **Functions do NOT import from agents/** — Serverless functions are standalone
- **Agents do NOT call function webhooks** — Agents use Twilio APIs directly
- **Integration via Twilio services only** — Functions write to Sync, agents read from Sync
- **Independent package.json files** — Each has its own dependencies

See [DESIGN_DECISIONS.md](/DESIGN_DECISIONS.md) for architectural rationale and [.claude/references/tool-boundaries.md](/.claude/references/tool-boundaries.md) for MCP vs CLI vs Functions guidance.

### Meta-Development Mode

When `.meta/` exists at the project root, this is a meta-development environment (gitignored, never ships). You are developing the factory itself, not using it as a shipped product.

**File routing in meta-development mode:** Session-specific files live under `.meta/` instead of at root or `.claude/`:

- **Todo / roadmap**: `.meta/todo.md` in meta-development, `todo.md` otherwise
- **Session learnings**: `.meta/learnings.md` in meta-development, `.claude/learnings.md` otherwise
- **Pending actions**: `.meta/pending-actions.md` in meta-development, `.claude/pending-actions.md` otherwise
- **Archived plans**: `.meta/plans/` in meta-development, `.claude/archive/plans/` otherwise
- **Active plans**: `~/.claude/plans/*.md` — Claude Code writes plan mode plans here. When the user asks about "the plan", check this directory (most recently modified file). The `archive-plan.sh` hook copies the latest plan to the project archive directory on session end.

The hooks in `.claude/hooks/` auto-detect the environment. Claude must also follow this routing — when the user says "todo" or "learnings", use the meta-development paths if `.meta/` exists. See `.meta/CLAUDE.md` for full meta-development documentation.

**NEVER rename or move `.meta/` to bypass hook enforcement.** If a hook is blocking legitimate work, fix the hook in a separate session. Renaming `.meta/` disables all meta-mode routing and leaves session state in the wrong locations.

## MCP Validation Tools (USE THESE!)

**IMPORTANT**: Use MCP validation tools instead of CLI commands for Twilio validation. They provide deep validation beyond HTTP 200 — automatic polling, content quality checks, forbidden pattern detection, and unified error reporting.

Available tools: `validate_call`, `validate_message`, `validate_recording`, `validate_transcript`, `validate_debugger`, `validate_voice_ai_flow`, `validate_two_way`, `validate_language_operator`. See `agents/mcp-servers/twilio/src/tools/validation.ts` for full documentation.

## Agent Teams

Agent Teams coordinate multiple Claude Code instances for parallel work. Use `/team [workflow] [task]` to launch. See the `agent-teams-guide` skill for configurations, comparison with subagents, and enable/disable instructions.

## Documentation Navigator

| Looking for... | Location |
|----------------|----------|
| Project-wide standards | This file (CLAUDE.md) |
| Architectural decisions | [DESIGN_DECISIONS.md](/DESIGN_DECISIONS.md) |
| MCP server patterns | [agents/mcp-servers/twilio/CLAUDE.md](/agents/mcp-servers/twilio/CLAUDE.md) |
| Tool boundaries | [.claude/references/tool-boundaries.md](/.claude/references/tool-boundaries.md) |
| Voice/TwiML patterns | [functions/voice/CLAUDE.md](/functions/voice/CLAUDE.md) |
| Voice use case product map | `.claude/skills/voice-use-case-map.md` (load on demand) |
| SMS/MMS patterns | [functions/messaging/CLAUDE.md](/functions/messaging/CLAUDE.md) |
| Real-time voice AI | [functions/conversation-relay/CLAUDE.md](/functions/conversation-relay/CLAUDE.md) |
| Warm transfer (voice AI) | [functions/warm-transfer/CLAUDE.md](/functions/warm-transfer/CLAUDE.md) |
| Verification patterns | [functions/verify/CLAUDE.md](/functions/verify/CLAUDE.md) |
| State synchronization | [functions/sync/CLAUDE.md](/functions/sync/CLAUDE.md) |
| Task routing | [functions/taskrouter/CLAUDE.md](/functions/taskrouter/CLAUDE.md) |
| Messaging services | [functions/messaging-services/CLAUDE.md](/functions/messaging-services/CLAUDE.md) |
| Callback handlers | [functions/callbacks/CLAUDE.md](/functions/callbacks/CLAUDE.md) |
| Deep validation | [agents/mcp-servers/twilio/src/validation/CLAUDE.md](/agents/mcp-servers/twilio/src/validation/CLAUDE.md) |
| Autonomous worker | [agents/feature-factory/CLAUDE.md](/agents/feature-factory/CLAUDE.md#autonomous-worker) |
| Setup scripts | [scripts/CLAUDE.md](/scripts/CLAUDE.md) |
| API changes/drift | [.claude/references/twilio-api-changes.md](/.claude/references/twilio-api-changes.md) |
| Twilio CLI reference | [.claude/references/twilio-cli.md](/.claude/references/twilio-cli.md) |
| Operational gotchas (testing, deploy, SDK) | [.claude/references/operational-gotchas.md](/.claude/references/operational-gotchas.md) |
| Hooks reference | `.claude/skills/hooks-reference.md` (load on demand) |
| Autonomous mode | `.claude/skills/autonomous-guide.md` (load on demand) |
| Headless runner | `scripts/run-headless.sh --help` (CI/CD, `claude -p` wrapper) |
| Agent teams details | `.claude/skills/agent-teams-guide.md` (load on demand) |
| Doc flywheel | `.claude/skills/doc-flywheel.md` (load on demand) |
| Learning exercises | `.claude/commands/learn.md`, `.meta/learning/` |
| Implementation progress | Todo file (see [Meta-Development Mode](#meta-development-mode)) |
| Session learnings | Learnings file (see [Meta-Development Mode](#meta-development-mode)) |

## Your Role as Primary Agent

You are an **orchestrator**, not a solo implementer. Your job is to coordinate subagents and agent teams — not to write all the code yourself.

- **Architecture & Planning**: Lead on system design and specification creation
- **Test-Driven Development**: Primary responsibility for comprehensive test coverage
- **Code Review**: Final validation of complex logic and architectural decisions
- **Documentation**: Maintain and update technical documentation

### Implementation Workflow (MANDATORY)

When implementing a plan or any non-trivial feature, you MUST delegate to subagents. Never implement plans solo.

**Standard workflow**: `/architect` → `/spec` → `/test-gen` → `/dev` → `/review` → `/test`

**For parallelizable work**: Use `TeamCreate` to spin up agent teams. If the plan says tasks can be parallelized, use a team — don't serialize the work yourself.

**When to use which**:
- **Single-track work** (sequential steps): Use `/orchestrate` or invoke subagents one at a time
- **Multi-track work** (independent tasks): Use `/team` to run agents in parallel
- **Quick fixes** (typos, single-line changes): You may act directly — subagents are overkill

If you catch yourself writing more than ~20 lines of implementation code directly, stop and delegate to `/dev` instead.

## Documentation Protocol

This project uses a **doc-first approach**: Check → Act → Record.

### Before CLI Operations

**ALWAYS read `.claude/references/twilio-cli.md` before running `twilio` commands.**

```bash
# WRONG: Guessing at CLI flags
twilio api:core:available-phone-numbers:local:list --voice-enabled=true

# RIGHT: Check docs first, flags are presence-based
twilio api:core:available-phone-numbers:local:list --voice-enabled --sms-enabled
```

Also check:
- `.claude/references/tool-boundaries.md` before deployment decisions
- `.claude/references/doc-map.md` to find which doc covers your operation

### Before Code Changes

Read the relevant `CLAUDE.md` file for the domain you're modifying. See Documentation Navigator table above for full list.

### Discovery Capture

When you learn something unexpected, add it to the learnings file **IMMEDIATELY** (see [Meta-Development Mode](#meta-development-mode) for path). Don't wait until the end of a task — capture inline as you discover.

### Before Committing

1. Check the pending actions file for doc update suggestions (see [Meta-Development Mode](#meta-development-mode) for path)
2. Address suggestions or consciously defer them
3. Verify you recorded any learnings from this session

For the full capture-promote-clear documentation workflow, see the `doc-flywheel` skill.

# Interaction

- When you first work with a new user, ask for their preferred name and update this file.
- Preferred name: Gogo

## Working Together

- We are collaborators working together on technical problems.
- Communication should be direct, professional, and collegial.
- Mutual respect: neither party is infallible, and we learn from each other.
- It's encouraged to push back with evidence when you disagree.
- Ask questions when something is unclear rather than making assumptions.

## Communication style

- Get straight to the point. Skip the preamble phrases like "Great idea!", "Good question!", "Absolutely!", "That's a great point!", etc.
- Be direct without being cold. Friendly and professional, not effusive.
- You don't need to validate or congratulate me. Just engage with the content.
- It's fine to disagree, express uncertainty, or say "I don't know" - that's more useful than false confidence or hollow agreement.
- Keep responses concise. If something can be said in fewer words, do that.
- Save enthusiasm for when something is genuinely interesting or well-done, so it means something when you express it.

# Writing code

- CRITICAL: NEVER USE --no-verify WHEN COMMITTING CODE
- We prefer simple, clean, maintainable solutions over clever or complex ones, even if the latter are more concise or performant. Readability and maintainability are primary concerns.
- Make the smallest reasonable changes to get to the desired outcome. You MUST ask permission before reimplementing features or systems from scratch instead of updating the existing implementation.
- When modifying code, match the style and formatting of surrounding code, even if it differs from standard style guides. Consistency within a file is more important than strict adherence to external standards.
- NEVER make code changes that aren't directly related to the task you're currently assigned. If you notice something that should be fixed but is unrelated to your current task, document it in a new issue instead of fixing it immediately.
- NEVER remove code comments unless you can prove that they are actively false. Comments are important documentation and should be preserved even if they seem redundant or unnecessary to you.
- All code files should start with a brief 2 line comment explaining what the file does. Each line of the comment should start with the string "ABOUTME: " commented out in whatever the file's comment syntax is to make it easy to grep for.
- When writing comments, avoid referring to temporal context about refactors or recent changes. Comments should be evergreen and describe the code as it is, not how it evolved or was recently changed.
- NEVER implement a mock mode for testing or for any purpose. We always use real data and real APIs, never mock implementations.
- When you are trying to fix a bug or compilation error or any other issue, YOU MUST NEVER throw away the old implementation and rewrite without explicit permission from the user. If you are going to do this, YOU MUST STOP and get explicit permission from the user.
- NEVER name things as 'improved' or 'new' or 'enhanced', etc. Code naming should be evergreen. What is new today will be "old" someday.
- Commit your work regularly using git. Commit whenever you complete an atomic unit of functionality — a discrete feature, bug fix, or substantial logical chunk — regardless of how many files changed. Each commit should represent a coherent, working state. Write clear, descriptive commit messages in imperative mood. Don't wait until everything is done; commit incrementally as you complete meaningful pieces.

# Getting help

- ALWAYS ask for clarification rather than making assumptions.
- If you're having trouble with something, it's ok to stop and ask for help. Especially if it's something your human might be better at.

# Debugging

- Form a hypothesis and verify it with actual data BEFORE attempting fixes. Do not shotgun-debug by trying random changes.
- Do not switch approaches (e.g., `<Record>` vs `<Dial record>`, polling vs webhooks) without confirming with the user first. The current approach usually exists for a reason.
- When debugging Twilio calls, use the Call Notifications API or MCP `validate_call` tool for deep validation — surface-level debugger checks miss most issues.
- Before deploying Twilio Functions, verify the active CLI profile with `twilio profiles:list`. Multi-account setups are common and deploying to the wrong account is hard to detect.
- Twilio phone number direction matters:
  - **Outbound** (API-initiated): FROM = your Twilio number, TO = the destination
  - **Inbound** (webhook-triggered): FROM = the external caller/sender, TO = your Twilio number
- When a multi-step validation or implementation plan exists, NEVER silently skip steps. If a step cannot be completed, explicitly report it as skipped with the reason. Report completion status for every step, not just the ones that succeeded.
- If authentication or credentials expire mid-session, surface it to the user immediately rather than attempting workarounds or continuing with degraded access.

## Architectural Invariants

Rules that have each caused real debugging time loss. These exist in domain-specific CLAUDE.md files — this index ensures they're loaded every session.

- **`Twilio.Response.setBody()` requires strings** — Passing objects causes `Buffer.from(object)` TypeError. Always `JSON.stringify()` + Content-Type header. (~29 latent instances across voice/ and conversation-relay/)
- **`console.error()` → 82005 alerts** — Use `console.log()` for operational logging. Only `console.error()` in catch blocks. `console.warn()` → 82004.
- **ConversationRelay uses `last`, not `isFinal`** — Protocol sends `{ last: true }`. Checking `isFinal` silently drops all follow-up utterances.
- **Env vars can reset on deploy** — `twilio serverless:deploy` doesn't preserve runtime env vars. Always verify after deployment.
- **CLI profile and `.env` are independent** — CLI profile can point to main account while `.env` has subaccount SID. Check both before operations.
- **TwiML: one document controls a call at a time** — Updating a participant's TwiML exits their current state (conference, queue). Exception: `<Start><Stream>`, `<Start><Recording>`, `<Start><Siprec>` fork background processes.
- **Voice Intelligence: `source_sid`, not `media_url`** — Use Recording SID for transcript creation. `media_url` requires auth the Intelligence API can't provide.
- **Google Neural voices for ConversationRelay** — Polly voices may be blocked (error 64101). Use `Google.en-US-Neural2-F` as default.
- **`<Start><Recording>` syntax is `.recording()`, not `.record()`** — `twiml.start().recording({...})` is correct.

# Session discipline

- Prioritize implementation over planning. If a session has a concrete task, produce working code — not just plans, outlines, or analysis documents. Keep planning to a short preamble before coding.
- Do not convert lazy/conditional `require()` calls to static `import` statements without verifying the conditional logic still works. Node.js conditional requires exist for a reason (optional dependencies, environment-specific loading).
- Run the full relevant test suite before presenting work as complete. A passing subset is not sufficient — regressions in unrelated tests still need to be caught.
- After modifying TypeScript files, run `tsc --noEmit` in the relevant package to verify compilation before committing.

# Testing

- Tests MUST cover the functionality being implemented.
- NEVER ignore the output of the system or the tests - Logs and messages often contain CRITICAL information.
- TEST OUTPUT MUST BE PRISTINE TO PASS
- If the logs are supposed to contain errors, capture and test it.
- NO EXCEPTIONS POLICY: Under no circumstances should you mark any test type as "not applicable". Every project, regardless of size or complexity, MUST have unit tests, integration tests, AND end-to-end tests. If you believe a test type doesn't apply, you need the human to say exactly "I AUTHORIZE YOU TO SKIP WRITING TESTS THIS TIME"
- We practice TDD: write tests first, make them pass, refactor. The `/dev` subagent verifies failing tests exist before implementing.

# Package Management

## Node.js Development
- Use `npm` for Node.js package management
- Install packages with: `npm install <package>`
- Packages are managed in `package.json`
- Install test dependencies: `npm install --save-dev jest ts-jest @types/jest supertest newman`

# Workflow Requirements

- **Testing**: Make sure all tests pass before marking tasks as done
- **Linting**: Ensure linting passes before completing tasks
- **Todo Management**: Check off completed work in the todo file (see [Meta-Development Mode](#meta-development-mode))
- **GitHub Integration**: Use agent scripts to create issues and sync with todo tasks

## Build and Development Commands

```bash
# Install dependencies
npm install

# Run local development server
npm start                    # Start on port 3000
npm run start:ngrok          # Start with ngrok tunnel

# Testing
npm test                     # Run unit and integration tests
npm run test:watch           # Run tests in watch mode
npm run test:coverage        # Run tests with coverage report
npm run test:e2e             # Run Newman E2E tests
npm run test:all             # Run all tests

# Linting
npm run lint                 # Check for linting errors
npm run lint:fix             # Auto-fix linting errors

# Deployment
npm run deploy:dev           # Deploy to dev environment
npm run deploy:prod          # Deploy to production
```

## Function Access Levels

- `*.js` - **Public**: Anyone can call these endpoints
- `*.protected.js` - **Protected**: Require valid Twilio request signature
- `*.private.js` - **Private**: Only callable from other functions

## Custom Slash Commands

The following slash commands are available for specialized tasks:

### Workflow Commands

| Command | Description |
|---------|-------------|
| `/orchestrate [workflow] [task]` | Workflow coordinator - runs full development pipelines |
| `/team [workflow] [task]` | Agent team coordinator - parallel multi-agent workflows |

### Development Subagents

| Command | Description |
|---------|-------------|
| `/architect [topic]` | Architect - design review, pattern selection, CLAUDE.md maintenance |
| `/spec [feature]` | Specification writer - creates detailed technical specifications |
| `/test-gen [feature]` | Test generator - TDD Red Phase, writes failing tests first |
| `/dev [task]` | Developer - TDD Green Phase, implements to pass tests |
| `/review [target]` | Senior developer - code review, security audit, approval authority |
| `/test [scope]` | Test runner - executes and validates test suites |
| `/docs [scope]` | Technical writer - documentation updates and maintenance |

### Utility Commands

| Command | Description |
|---------|-------------|
| `/commit [scope]` | Git commit with pre-commit checks, conventional messages, todo tracking |
| `/push` | Push to remote with test verification and branch tracking |
| `/preflight` | Environment verification — CLI profile, env vars, auth validity |
| `/twilio-docs [topic]` | Searches Twilio documentation |
| `/twilio-logs` | Fetches and analyzes Twilio debugger logs |
| `/deploy [env]` | Deployment helper with pre/post checks |
| `/e2e-test [scope]` | E2E tests against live Twilio — real numbers, deep validation |
| `/validate [type] [SID]` | Deep validation of individual Twilio resources |
| `/context [action]` | Context optimization - summarize, load, or analyze context |
| `/wrap-up [scope]` | End-of-session doc updates — learnings, CLAUDE.md, todo, pending actions |
| `/learn [action]` | Interactive learning exercises on autonomous work |
| `/plugin-sync` | Detect and reconcile drift between factory source and plugin distribution |
