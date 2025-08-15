import { EmailSchedulerService, emailSchedulerService, runEmailSchedulingCheck } from '../emailScheduler';
import { roundCompletionDetectorService } from '@/services/roundCompletionDetectorService';
import { createSupabaseServiceRoleClient } from '@/utils/supabase/service';
// Removed unused logger import

// Mock dependencies
jest.mock('@/services/roundCompletionDetectorService');
jest.mock('@/utils/supabase/service');
jest.mock('@/utils/logger');

// Mock fetch for API calls
global.fetch = jest.fn();

// Create a mock Supabase client for testing
interface MockSupabaseClient {
  from: jest.MockedFunction<(table: string) => unknown>;
}

const mockSupabaseClient: MockSupabaseClient = {
  from: jest.fn(),
};

const mockRoundCompletionDetectorService = roundCompletionDetectorService as jest.Mocked<typeof roundCompletionDetectorService>;
const mockGetSupabaseServiceRoleClient = createSupabaseServiceRoleClient as jest.MockedFunction<typeof createSupabaseServiceRoleClient>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('EmailSchedulerService', () => {
  let schedulerService: EmailSchedulerService;

  beforeEach(() => {
    jest.clearAllMocks();
    schedulerService = new EmailSchedulerService();
    
    // Setup default mock implementations
    mockGetSupabaseServiceRoleClient.mockReturnValue(mockSupabaseClient as unknown as ReturnType<typeof createSupabaseServiceRoleClient>);
    
    // Mock environment variables
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.CRON_SECRET = 'test-secret';
    process.env.EMAIL_TEST_MODE = 'false';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.CRON_SECRET;
    delete process.env.EMAIL_TEST_MODE;
  });

  describe('checkAndScheduleEmails', () => {
    it('should check both summary and reminder emails successfully', async () => {
      // Mock successful responses for both checks
      mockRoundCompletionDetectorService.detectAndMarkCompletedRounds.mockResolvedValue({
        completedRoundIds: [1],
        errors: []
      });

      // Mock open rounds query
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      });

      // Mock successful summary email trigger
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, emails_sent: 5 })
        } as Response)
        // Mock successful admin summary email trigger  
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, recipients: ['admin1@test.com', 'admin2@test.com'] })
        } as Response);

      const results = await schedulerService.checkAndScheduleEmails();

      expect(results).toHaveLength(2);
      expect(results[0].emailType).toBe('summary');
      expect(results[0].success).toBe(true);
      expect(results[1].emailType).toBe('admin-summary');
      expect(results[1].success).toBe(true);
      expect(mockRoundCompletionDetectorService.detectAndMarkCompletedRounds).toHaveBeenCalled();
    });

    it('should handle errors gracefully and return error results', async () => {
      // Mock error in round completion detection
      mockRoundCompletionDetectorService.detectAndMarkCompletedRounds.mockRejectedValue(
        new Error('Database connection failed')
      );

      const results = await schedulerService.checkAndScheduleEmails();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].message).toContain('Summary email check failed');
      expect(results[0].errors).toContain('Database connection failed');
    });
  });

  describe('checkForSummaryEmails', () => {
    it('should process newly completed rounds and trigger summary emails', async () => {
      // Mock round completion detection
      mockRoundCompletionDetectorService.detectAndMarkCompletedRounds.mockResolvedValue({
        completedRoundIds: [1, 2],
        errors: []
      });

      // Mock successful API calls - now includes admin summary emails
      mockFetch
        // Round 1: summary email
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, emails_sent: 5 })
        } as Response)
        // Round 1: admin summary email
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, recipients: ['admin1@test.com', 'admin2@test.com'] })
        } as Response)
        // Round 2: summary email
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, emails_sent: 5 })
        } as Response)
        // Round 2: admin summary email
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, recipients: ['admin1@test.com', 'admin2@test.com'] })
        } as Response);

      const results = await schedulerService.checkForSummaryEmails();

      expect(results).toHaveLength(4);
      expect(results[0].roundId).toBe(1);
      expect(results[0].emailType).toBe('summary');
      expect(results[1].roundId).toBe(1);
      expect(results[1].emailType).toBe('admin-summary');
      expect(results[2].roundId).toBe(2);
      expect(results[2].emailType).toBe('summary');
      expect(results[3].roundId).toBe(2);
      expect(results[3].emailType).toBe('admin-summary');
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should handle no completed rounds gracefully', async () => {
      mockRoundCompletionDetectorService.detectAndMarkCompletedRounds.mockResolvedValue({
        completedRoundIds: [],
        errors: []
      });

      const results = await schedulerService.checkForSummaryEmails();

      expect(results).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should continue processing other rounds if one fails', async () => {
      mockRoundCompletionDetectorService.detectAndMarkCompletedRounds.mockResolvedValue({
        completedRoundIds: [1, 2],
        errors: []
      });

      // Round 1 summary fails, admin summary succeeds; Round 2 summary succeeds, admin summary fails
      mockFetch
        // Round 1: summary email fails
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error'
        } as Response)
        // Round 1: admin summary email succeeds (now runs regardless of summary result)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, recipients: ['admin1@test.com', 'admin2@test.com'] })
        } as Response)
        // Round 2: summary email succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, emails_sent: 5 })
        } as Response)
        // Round 2: admin summary email fails
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Admin API Error'
        } as Response);

      const results = await schedulerService.checkForSummaryEmails();

      expect(results).toHaveLength(4);
      expect(results[0].success).toBe(false); // Round 1 summary failed
      expect(results[0].emailType).toBe('summary');
      expect(results[1].success).toBe(true);  // Round 1 admin summary succeeded
      expect(results[1].emailType).toBe('admin-summary');
      expect(results[2].success).toBe(true);  // Round 2 summary succeeded
      expect(results[2].emailType).toBe('summary');
      expect(results[3].success).toBe(false); // Round 2 admin summary failed
      expect(results[3].emailType).toBe('admin-summary');
    });
  });

  describe('checkForReminderEmails', () => {
    it('should process rounds due for reminder emails', async () => {
      const now = new Date();
      const _pastTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago (prefixed with _ to indicate intentionally unused)
      const futureTime = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours from now (so reminder is due 1 hour ago)

      // Mock the complete Supabase call chain for getting open rounds
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'betting_rounds') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 1,
                      name: 'Round 1',
                      status: 'open',
                      earliest_fixture_kickoff: futureTime.toISOString(),
                      latest_fixture_kickoff: futureTime.toISOString()
                    }
                  ],
                  error: null
                }),
                single: jest.fn().mockResolvedValue({
                  data: { reminder_sent_at: null },
                  error: null
                })
              }),
              single: jest.fn().mockResolvedValue({
                data: { reminder_sent_at: null },
                error: null
              })
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          };
        }
        return {};
      });

      // Mock successful reminder email trigger
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, emails_sent: 5 })
      } as Response);

      const results = await schedulerService.checkForReminderEmails();
      
      expect(results).toHaveLength(1);
      expect(results[0].emailType).toBe('reminder');
      expect(results[0].success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/send-reminder'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-secret'
          })
        })
      );
    });

    it('should skip rounds where reminder was already sent', async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours from now (so reminder is due)

      // Mock the complete Supabase call chain
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'betting_rounds') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: 1,
                      name: 'Round 1',
                      status: 'open',
                      earliest_fixture_kickoff: futureTime.toISOString(),
                      latest_fixture_kickoff: futureTime.toISOString()
                    }
                  ],
                  error: null
                }),
                single: jest.fn().mockResolvedValue({
                  data: { reminder_sent_at: now.toISOString() }, // Already sent
                  error: null
                })
              })
            })
          };
        }
        return {};
      });

      const results = await schedulerService.checkForReminderEmails();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].message).toContain('already sent');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not process rounds that are not due for reminders yet', async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 30 * 60 * 60 * 1000); // 30 hours from now

      // Mock open rounds query
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 1,
              name: 'Round 1',
              status: 'open',
              earliest_fixture_kickoff: futureTime.toISOString(),
              latest_fixture_kickoff: futureTime.toISOString()
            }
          ],
          error: null
        })
      });

      const results = await schedulerService.checkForReminderEmails();

      expect(results).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('getOpenRoundTimings', () => {
    it('should calculate correct timing information for open rounds', async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours from now (so reminder is due)
      const expectedReminderTime = new Date(futureTime.getTime() - 24 * 60 * 60 * 1000);

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 1,
                  name: 'Round 1',
                  status: 'open',
                  earliest_fixture_kickoff: futureTime.toISOString(),
                  latest_fixture_kickoff: futureTime.toISOString()
                }
              ],
              error: null
            })
          })
        })
      });

      const timings = await schedulerService.getOpenRoundTimings();

      expect(timings).toHaveLength(1);
      expect(timings[0].roundId).toBe(1);
      expect(timings[0].roundName).toBe('Round 1');
      expect(timings[0].isReminderDue).toBe(true); // 23 hours from now means reminder is due (1 hour ago)
      expect(timings[0].isSummaryDue).toBe(false);
      expect(new Date(timings[0].reminderSendTime)).toEqual(expectedReminderTime);
    });

    it('should return empty array when no open rounds exist', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [],
          error: null
        })
      });

      const timings = await schedulerService.getOpenRoundTimings();

      expect(timings).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' }
        })
      });

      await expect(schedulerService.getOpenRoundTimings()).rejects.toThrow('Failed to fetch open rounds');
    });
  });

  describe('triggerSummaryEmail', () => {
    it('should successfully trigger summary email API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, emails_sent: 5 })
      } as Response);

      const result = await schedulerService.triggerSummaryEmail(1);

      expect(result.success).toBe(true);
      expect(result.emailsSent).toBe(5);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/send-summary',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-secret'
          }),
          body: JSON.stringify({
            round_id: 1,
            test_mode: false
          })
        })
      );
    });

    it('should handle API failures gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      } as Response);

      const result = await schedulerService.triggerSummaryEmail(1);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Summary email API call failed: 500 Internal Server Error');
    });

    it('should respect EMAIL_TEST_MODE environment variable', async () => {
      process.env.EMAIL_TEST_MODE = 'true';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, emails_sent: 0 })
      } as Response);

      await schedulerService.triggerSummaryEmail(1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            round_id: 1,
            test_mode: true
          })
        })
      );
    });
  });

  describe('triggerAdminSummaryEmail', () => {
    it('should successfully trigger admin summary email API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, recipients: ['admin1@test.com', 'admin2@test.com'] })
      } as Response);

      const result = await schedulerService.triggerAdminSummaryEmail(1);

      expect(result.success).toBe(true);
      expect(result.emailsSent).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/send-admin-summary',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-secret'
          }),
          body: JSON.stringify({
            roundId: 1
          })
        })
      );
    });

    it('should handle API failures gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      } as Response);

      const result = await schedulerService.triggerAdminSummaryEmail(1);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Admin summary email API call failed: 500 Internal Server Error');
    });
  });

  describe('triggerReminderEmail', () => {
    it('should successfully trigger reminder email API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, emails_sent: 5 })
      } as Response);

      const result = await schedulerService.triggerReminderEmail(1);

      expect(result.success).toBe(true);
      expect(result.emailsSent).toBe(5);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/send-reminder',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-secret'
          }),
          body: JSON.stringify({
            round_id: 1,
            test_mode: false,
            deadline_hours: 24
          })
        })
      );
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await schedulerService.triggerReminderEmail(1);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Network error');
    });
  });

  describe('wasReminderAlreadySent', () => {
    it('should return true when reminder was already sent', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { reminder_sent_at: new Date().toISOString() },
          error: null
        })
      });

      const result = await schedulerService.wasReminderAlreadySent(1);

      expect(result).toBe(true);
    });

    it('should return false when reminder was not sent yet', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { reminder_sent_at: null },
          error: null
        })
      });

      const result = await schedulerService.wasReminderAlreadySent(1);

      expect(result).toBe(false);
    });

    it('should return false on database errors', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      });

      const result = await schedulerService.wasReminderAlreadySent(1);

      expect(result).toBe(false);
    });
  });

  describe('markReminderAsSent', () => {
    it('should successfully mark reminder as sent', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      await expect(schedulerService.markReminderAsSent(1)).resolves.not.toThrow();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('betting_rounds');
    });

    it('should throw error on database update failure', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Update failed' }
        })
      });

      await expect(schedulerService.markReminderAsSent(1)).rejects.toThrow('Failed to mark reminder as sent');
    });
  });

  describe('getUpcomingEmailSchedule', () => {
    it('should return upcoming email events only', async () => {
      const now = new Date();
      const pastTime = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
      const futureTime = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25 hours from now

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 1,
              name: 'Past Round',
              status: 'open',
              earliest_fixture_kickoff: pastTime.toISOString(),
              latest_fixture_kickoff: pastTime.toISOString()
            },
            {
              id: 2,
              name: 'Future Round',
              status: 'open',
              earliest_fixture_kickoff: futureTime.toISOString(),
              latest_fixture_kickoff: futureTime.toISOString()
            }
          ],
          error: null
        })
      });

      const upcoming = await schedulerService.getUpcomingEmailSchedule();

      expect(upcoming).toHaveLength(1);
      expect(upcoming[0].roundId).toBe(2);
      expect(upcoming[0].roundName).toBe('Future Round');
    });
  });
});

describe('Module exports', () => {
  it('should export emailSchedulerService singleton', () => {
    expect(emailSchedulerService).toBeInstanceOf(EmailSchedulerService);
  });

  it('should export runEmailSchedulingCheck function', async () => {
    mockRoundCompletionDetectorService.detectAndMarkCompletedRounds.mockResolvedValue({
      completedRoundIds: [],
      errors: []
    });

    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [],
        error: null
      })
    });

    const results = await runEmailSchedulingCheck();

    expect(Array.isArray(results)).toBe(true);
    expect(mockRoundCompletionDetectorService.detectAndMarkCompletedRounds).toHaveBeenCalled();
  });
}); 