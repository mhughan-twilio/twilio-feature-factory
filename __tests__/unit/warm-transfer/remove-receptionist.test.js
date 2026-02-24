// ABOUTME: Unit tests for the remove-receptionist warm transfer function.
// ABOUTME: Tests conference participant removal and Sync status update to dismissed.

const mockConferencesList = jest.fn();
const mockParticipantUpdate = jest.fn();
const mockSyncFetch = jest.fn();
const mockSyncUpdate = jest.fn();

jest.mock('twilio', () => {
  const mockConferences = jest.fn((_sid) => ({
    participants: jest.fn(() => ({
      update: mockParticipantUpdate,
    })),
  }));
  mockConferences.list = mockConferencesList;

  const TwilioMock = jest.fn(() => ({
    conferences: mockConferences,
    sync: {
      v1: {
        services: jest.fn(() => ({
          documents: jest.fn(() => ({
            fetch: mockSyncFetch,
            update: mockSyncUpdate,
          })),
        })),
      },
    },
  }));

  TwilioMock.mockConferences = mockConferences;

  TwilioMock.Response = class {
    constructor() {
      this.statusCode = 200;
      this.body = '';
      this.headers = {};
    }
    setStatusCode(code) { this.statusCode = code; }
    setBody(body) { this.body = typeof body === 'object' ? JSON.stringify(body) : body; }
    appendHeader(key, value) { this.headers[key] = value; }
  };

  return TwilioMock;
});

const Twilio = require('twilio');

global.Twilio = Twilio;

describe('remove-receptionist handler', () => {
  let context;
  let callback;
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConferencesList.mockResolvedValue([{
      sid: 'CF_conf_123',
      friendlyName: 'wt-1234-abc',
      status: 'in-progress',
    }]);

    mockParticipantUpdate.mockResolvedValue({
      callSid: 'CA_receptionist_123',
      status: 'completed',
    });

    mockSyncFetch.mockResolvedValue({
      data: {
        conferenceName: 'wt-1234-abc',
        agentName: 'Alice',
        callerIssue: 'billing question',
        status: 'bridged',
      },
    });
    mockSyncUpdate.mockResolvedValue({ sid: 'ET1234' });

    context = {
      TWILIO_SYNC_SERVICE_SID: 'IS1234567890',
      getTwilioClient: () => new Twilio(),
    };
    callback = jest.fn();

    handler = require('../../../functions/warm-transfer/remove-receptionist.protected').handler;
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('parameter validation', () => {
    it('should return 400 when ConferenceName is missing', async () => {
      const event = global.createTestEvent({
        ReceptionistCallSid: 'CA_receptionist_123',
      });

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('ConferenceName');
    });

    it('should return 400 when ReceptionistCallSid is missing', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
      });

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('ReceptionistCallSid');
    });
  });

  describe('conference lookup', () => {
    it('should find conference by friendly name with in-progress status', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        ReceptionistCallSid: 'CA_receptionist_123',
      });

      await handler(context, event, callback);

      expect(mockConferencesList).toHaveBeenCalledWith({
        friendlyName: 'wt-1234-abc',
        status: 'in-progress',
        limit: 1,
      });
    });

    it('should return 404 if no conference found', async () => {
      mockConferencesList.mockResolvedValue([]);

      const event = global.createTestEvent({
        ConferenceName: 'wt-nonexistent',
        ReceptionistCallSid: 'CA_receptionist_123',
      });

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body).error).toContain('not found');
    });
  });

  describe('participant removal', () => {
    it('should remove participant by updating status to completed', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        ReceptionistCallSid: 'CA_receptionist_123',
      });

      await handler(context, event, callback);

      expect(mockParticipantUpdate).toHaveBeenCalledTimes(1);
      expect(mockParticipantUpdate).toHaveBeenCalledWith({
        status: 'completed',
      });
    });

    it('should return success after removing participant', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        ReceptionistCallSid: 'CA_receptionist_123',
      });

      await handler(context, event, callback);

      const [error, response] = callback.mock.calls[0];
      expect(error).toBeNull();
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('Sync status update', () => {
    it('should update Sync doc status to dismissed', async () => {
      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        ReceptionistCallSid: 'CA_receptionist_123',
      });

      await handler(context, event, callback);

      expect(mockSyncFetch).toHaveBeenCalledTimes(1);
      expect(mockSyncUpdate).toHaveBeenCalledTimes(1);
      const updateParams = mockSyncUpdate.mock.calls[0][0];
      expect(updateParams.data.status).toBe('dismissed');
      // Verify existing fields are preserved (fetch-then-merge)
      expect(updateParams.data.agentName).toBe('Alice');
      expect(updateParams.data.dismissedAt).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle participant removal failure', async () => {
      mockParticipantUpdate.mockRejectedValue(new Error('Participant not found'));

      const event = global.createTestEvent({
        ConferenceName: 'wt-1234-abc',
        ReceptionistCallSid: 'CA_receptionist_123',
      });

      await handler(context, event, callback);

      const [, response] = callback.mock.calls[0];
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });
});
