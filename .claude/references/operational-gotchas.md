# Operational Gotchas

Cross-cutting gotchas discovered through real debugging sessions. Domain-specific gotchas live in their respective CLAUDE.md files; these are the ones that span multiple domains or have no single home.

## Testing

- **Coverage summary JSON is cached** — `pre-bash-validate.sh` reads `coverage/coverage-summary.json` and considers it fresh if newer than `package.json`. After adding test files, must regenerate: `npx jest --coverage --coverageReporters=json-summary`.

- **`jest.doMock` for Runtime.getFunctions()** — Callback handlers use `Runtime.getFunctions()` at require-time. Use `jest.doMock(path, factory)` + `jest.resetModules()` in `beforeEach()`, not `jest.mock()` (which hoists before variable assignments).

- **`toContainEqual` for asymmetric matchers in arrays** — `toContain(expect.stringContaining())` uses `===` reference equality. Use `toContainEqual()` for deep equality with asymmetric matchers.

- **Newman E2E needs local server** — `npm run test:e2e` hits `localhost:3000`. Start `npx twilio-run start` first. Use `--timeout-request 5000` to avoid relay-handler hang.

## Deployment

- **CLI `--value` flag double-escapes JSON strings** — `twilio api:...:variables:create --value '{"k":"v"}'` stores escaped JSON. Use `.env` file + redeploy instead for JSON env vars.

- **Inbound leg CallSid differs from outbound API call SID** — When initiating outbound to a tracking number, the function sees a different CallSid (inbound child). Sync docs keyed by inbound SID, recordings on outbound SID.

- **Deploy overwrites runtime env vars with `.env` values** — Every `twilio serverless:deploy` resets env vars to `.env` file values. Keep `.env` up to date with real values (including `DOMAIN_NAME` after first deploy). If you use `serverless:env:set` at runtime, update `.env` too or the change is lost on next deploy.

- **Read ngrok domain from `.env`, don't use shell env vars** — Claude Code's bash commands don't inherit direnv-loaded env vars. When starting ngrok, read `NGROK_DOMAIN_A` from the `.env` file directly (e.g., `--domain=mhughan.ngrok.dev`) instead of using `$NGROK_DOMAIN_A`. Same applies to any `.env` variable not exported in the shell.

- **Verify CLI profile matches `.env` account before deploying** — `twilio profiles:list` shows the active profile's Account SID. Compare against `TWILIO_ACCOUNT_SID` in `.env`. Deploying with a mismatched profile deploys to the wrong account.

## ConversationRelay & Voice Intelligence

- **`record: true` on make_call is ignored with ConversationRelay** — REST API recording param silently produces no recording when TwiML handler uses `<Connect><ConversationRelay>`. Always use `<Start><Recording>` in TwiML before ConversationRelay.

- **Agent-to-agent ConversationRelay setup is not optional** — It produces the multi-turn transcripts needed to validate topic keywords and conversation quality. Using a generic IVR handler produces meaningless transcripts.

- **Language Operators run automatically on VI transcripts** — Conversation Summary and Sentiment Analysis produce results without explicit invocation if configured as default operators on the Intelligence service.

## Voice SDK / WebRTC

- **Voice SDK 2.x has no CDN** — Must serve `node_modules/@twilio/voice-sdk/dist/twilio.min.js` from own Express server. The 1.x CDN was deprecated April 2025.

- **SDK 2.x API changes from 1.x** — `device.register()` required (no auto-register), events are `'registered'`/`'unregistered'` (not `'ready'`/`'offline'`), `device.connect({ params: { To } })` returns Promise.

- **`Twilio.Response` is serverless-runtime-only** — Not in npm `twilio` package. Tests need MockResponse class. `jwt.AccessToken` IS in npm package.

- **TwiML App SID** (`APxxx`) stored as `TWILIO_VOICE_SDK_APP_SID` in `.env` and serverless env vars.

- **Playwright + Chromium handles WebRTC** — Use `--use-fake-device-for-media-stream` + `--use-fake-ui-for-media-stream`. Server-side validation covers what browser-side can't.

- **CRITICAL: Voice SDK `connected` fires at A-leg, not B-leg bridge** — `device.connect()` reports `connected` when the browser connects to Twilio's WebRTC gateway, BEFORE the TwiML App dials the B-leg and it answers. A test completing in <2s for an outbound PSTN call is a false positive — real bridged calls take 3-5s minimum. Always sanity-check test durations against real-world call setup latency.

- **Never report Twilio E2E test results without checking timing** — Green tests with suspiciously fast durations are likely testing signaling only, not actual media/audio bridging. Verify call duration via REST API or add explicit post-bridge waits + duration assertions.

## Hooks & Documentation Flywheel

- **Hooks receive tool input on stdin as JSON, not env vars** — `CLAUDE_TOOL_INPUT_FILE_PATH`, `CLAUDE_TOOL_INPUT_COMMAND`, `CLAUDE_TOOL_INPUT_CONTENT` don't exist. Parse stdin with `jq`: `FILE_PATH="$(cat | jq -r '.tool_input.file_path // empty')"`. All 4 hooks (pre-bash-validate, pre-write-validate, post-write, post-bash) were silently broken until fixed.

- **Flywheel must exclude its own output files** — Editing `pending-actions.md` triggers post-write, which tracks it in `.session-files`, which the next flywheel run picks up, generating infinite recursive suggestions. Filter out `pending-actions.md`, `.session-files`, `.session-start`, `.last-doc-check` from the file collection.

- **Pending actions auto-clear only works for concrete paths** — Entries with vague targets ("Relevant CLAUDE.md") or gitignored paths (`.meta/todo.md`) never match staged files and accumulate forever. Always use specific file paths in suggestions.

- **Flywheel has 4 sources** — git status (uncommitted), recent commits (since session start), session-tracked files (.session-files), validation failure patterns (pattern-db.json). Source 3 was broken until the stdin fix.

- **Meta-mode hook blocks writes outside project root** — `pre-write-validate.sh` prefix-strips `PROJECT_ROOT/` from `FILE_PATH`. When path is outside the project (e.g., `~/.claude/plans/`), the strip is a no-op, leaving an absolute path that matches no allowed patterns. Fixed: wrapped case block in `if [[ "$RELATIVE_PATH" != "$FILE_PATH" ]]`.
