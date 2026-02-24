// ABOUTME: Integration tests for the receptionist state machine in the warm transfer flow.
// ABOUTME: Tests state transitions from INTAKE through DISMISSED with valid and invalid transitions.

const { ReceptionistStateMachine } = require('../../../__tests__/e2e/warm-transfer/receptionist-handler');

describe('Receptionist State Machine', () => {
  let stateMachine;

  beforeEach(() => {
    stateMachine = new ReceptionistStateMachine();
  });

  describe('initial state', () => {
    it('should start in INTAKE state', () => {
      expect(stateMachine.state).toBe('INTAKE');
    });
  });

  describe('INTAKE → TRANSFERRING', () => {
    it('should transition to TRANSFERRING when transfer is triggered', () => {
      stateMachine.transition('TRANSFERRING');
      expect(stateMachine.state).toBe('TRANSFERRING');
    });

    it('should record the agent name on transition', () => {
      stateMachine.transition('TRANSFERRING', { agentName: 'Alice' });
      expect(stateMachine.context.agentName).toBe('Alice');
    });
  });

  describe('TRANSFERRING → HOLD_CHAT', () => {
    it('should transition to HOLD_CHAT after agent call is initiated', () => {
      stateMachine.transition('TRANSFERRING');
      stateMachine.transition('HOLD_CHAT');
      expect(stateMachine.state).toBe('HOLD_CHAT');
    });
  });

  describe('HOLD_CHAT → CONFERENCE', () => {
    it('should transition to CONFERENCE when agent joins', () => {
      stateMachine.transition('TRANSFERRING');
      stateMachine.transition('HOLD_CHAT');
      stateMachine.transition('CONFERENCE');
      expect(stateMachine.state).toBe('CONFERENCE');
    });
  });

  describe('CONFERENCE → DISMISSED', () => {
    it('should transition to DISMISSED on dismissal phrase', () => {
      stateMachine.transition('TRANSFERRING');
      stateMachine.transition('HOLD_CHAT');
      stateMachine.transition('CONFERENCE');
      stateMachine.transition('DISMISSED');
      expect(stateMachine.state).toBe('DISMISSED');
    });
  });

  describe('invalid transitions', () => {
    it('should reject transition from INTAKE to CONFERENCE', () => {
      expect(() => stateMachine.transition('CONFERENCE')).toThrow();
      expect(stateMachine.state).toBe('INTAKE');
    });

    it('should reject transition from INTAKE to DISMISSED', () => {
      expect(() => stateMachine.transition('DISMISSED')).toThrow();
      expect(stateMachine.state).toBe('INTAKE');
    });

    it('should reject transition from HOLD_CHAT to INTAKE', () => {
      stateMachine.transition('TRANSFERRING');
      stateMachine.transition('HOLD_CHAT');
      expect(() => stateMachine.transition('INTAKE')).toThrow();
      expect(stateMachine.state).toBe('HOLD_CHAT');
    });

    it('should reject transition from DISMISSED to any state', () => {
      stateMachine.transition('TRANSFERRING');
      stateMachine.transition('HOLD_CHAT');
      stateMachine.transition('CONFERENCE');
      stateMachine.transition('DISMISSED');
      expect(() => stateMachine.transition('INTAKE')).toThrow();
      expect(stateMachine.state).toBe('DISMISSED');
    });
  });

  describe('full lifecycle', () => {
    it('should complete full INTAKE → TRANSFERRING → HOLD_CHAT → CONFERENCE → DISMISSED', () => {
      expect(stateMachine.state).toBe('INTAKE');

      stateMachine.transition('TRANSFERRING', { agentName: 'Alice', callerIssue: 'billing' });
      expect(stateMachine.state).toBe('TRANSFERRING');

      stateMachine.transition('HOLD_CHAT', { agentCallSid: 'CA_agent_123' });
      expect(stateMachine.state).toBe('HOLD_CHAT');

      stateMachine.transition('CONFERENCE');
      expect(stateMachine.state).toBe('CONFERENCE');

      stateMachine.transition('DISMISSED');
      expect(stateMachine.state).toBe('DISMISSED');
    });
  });
});
