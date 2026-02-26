#!/usr/bin/env node
// ABOUTME: Express + WebSocket server for warm transfer E2E testing with path-based routing.
// ABOUTME: Routes WS connections by URL path to handler modules for receptionist, briefing, caller, and agent.

require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const Anthropic = require('@anthropic-ai/sdk');

const { handleCaller } = require('./caller-handler');
const { handleAgent } = require('./agent-handler');

// Configuration
const PORT = process.env.PORT || 8080;

// Initialize Anthropic client
let anthropic;
try {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  console.log('Anthropic client initialized');
} catch (_error) {
  console.log('Failed to initialize Anthropic client. Set ANTHROPIC_API_KEY.');
  process.exit(1);
}

// Shared context accessible by all handlers
const sharedContext = {
  anthropic,
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  syncServiceSid: process.env.TWILIO_SYNC_SERVICE_SID,
  domainName: process.env.DOMAIN_NAME,
  // Track active sessions for cross-handler coordination
  sessions: new Map(),
};

// Express app for HTTP endpoints
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  const sessions = {};
  for (const [key, session] of sharedContext.sessions) {
    sessions[key] = {
      conferenceName: session.conferenceName,
      state: session.state,
      startTime: session.startTime,
    };
  }
  res.json({
    status: 'ok',
    activeSessions: sharedContext.sessions.size,
    sessions,
  });
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

// Route WebSocket connections by path
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const params = Object.fromEntries(url.searchParams);
  const ts = new Date().toISOString().slice(11, 23);

  console.log(`[${ts}] WS connection: path=${path}, params=${JSON.stringify(params)}`);

  switch (path) {
    case '/receptionist':
      // Receptionist handler uses exported state machine and detection functions
      // from receptionist-handler.js; the WS message loop is wired up here
      console.log(`[${ts}] Receptionist handler connected`);
      ws.send(JSON.stringify({
        type: 'text',
        token: 'Hello! Thank you for calling. How can I help you today?',
      }));
      break;
    case '/briefing':
      console.log(`[${ts}] Briefing handler connected`);
      break;
    case '/caller':
      handleCaller(ws, params, sharedContext);
      break;
    case '/agent':
      handleAgent(ws, params, sharedContext);
      break;
    default:
      console.log(`[${ts}] Unknown WS path: ${path}`);
      ws.send(JSON.stringify({
        type: 'text',
        token: 'Unknown handler path. Valid paths: /receptionist, /briefing, /caller, /agent',
      }));
      ws.close();
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`
=================================================
  Warm Transfer WebSocket Server
=================================================
  Port: ${PORT}
  Anthropic: ${anthropic ? 'Ready' : 'NOT CONFIGURED'}
  Sync SID: ${sharedContext.syncServiceSid || 'NOT SET'}
  Domain: ${sharedContext.domainName || 'NOT SET'}

  WebSocket paths:
    /receptionist  - Receptionist AI handler
    /briefing      - Agent briefing handler
    /caller        - Test: simulated caller
    /agent         - Test: simulated agent

  HTTP endpoints:
    GET /health    - Health check

  Ready for connections...
=================================================
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down warm transfer server...');
  wss.clients.forEach((ws) => {
    ws.send(JSON.stringify({ type: 'end' }));
    ws.close();
  });
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
