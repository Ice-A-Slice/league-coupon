import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { retroactivePointsService, type RetroactivePointsResult, type BulkRetroactivePointsResult } from '@/lib/retroactivePointsService';
import { calculateStandings } from '@/services/standingsService';
import { logger } from '@/utils/logger';

interface CheckResult {
  needsRetroactivePoints: boolean;
  missedRounds: number;
  estimatedPointsToAward: number;
  competitionContext?: {
    competitionId: number;
    competitionName: string;
    seasonId: number;
  };
}

/**
 * Validation schema for retroactive points request
 */
const retroactivePointsRequestSchema = z.object({
  action: z.enum(['apply_user', 'apply_competition', 'apply_bulk', 'preview_user', 'preview_competition', 'check_user']),
  userId: z.string().uuid().optional(),
  competitionId: z.number().optional(),
  afterDate: z.string().optional(), // ISO date string for bulk processing
  fromRoundId: z.number().optional(),
  dryRun: z.boolean().optional().default(false),
  triggerStandingsRefresh: z.boolean().optional().default(true)
});

type RetroactivePointsRequest = z.infer<typeof retroactivePointsRequestSchema>;

/**
 * POST /api/admin/retroactive-points
 * 
 * Admin endpoint for manually processing retroactive points allocation
 * 
 * Actions:
 * - apply_user: Apply retroactive points for specific user
 * - apply_competition: Apply retroactive points for user in specific competition
 * - apply_bulk: Apply retroactive points for all users created after date
 * - preview_user: Preview what would happen for specific user (always dry-run)
 * - preview_competition: Preview for user in specific competition (always dry-run)  
 * - check_user: Check if user needs retroactive points
 * 
 * Authentication: Requires admin-level access
 * 
 * Returns:
 * - 200: Success with operation results
 * - 400: Invalid request parameters
 * - 401: Unauthorized (not admin)
 * - 500: Server error
 */
export async function POST(request: Request) {
  const startTime = Date.now();
  const operationId = `retroactive-${startTime}-${Math.random().toString(36).substring(7)}`;

  logger.info({ operationId }, 'RetroactivePointsAPI: Starting request processing');

  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = retroactivePointsRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = 'Invalid request parameters for retroactive points';
      logger.error({ operationId, errors: validationResult.error.errors }, errorMessage);

      return NextResponse.json(
        { 
          success: false,
          error: errorMessage,
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const payload: RetroactivePointsRequest = validationResult.data;
    
    logger.info({ operationId, action: payload.action, userId: payload.userId }, 'RetroactivePointsAPI: Processing request');

    // Authentication: Check for admin access
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      const errorMessage = 'Authentication required';
      logger.warn({ operationId, authError: authError?.message }, errorMessage);

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 401 }
      );
    }

    // TODO: Add admin role check here
    // For now, we assume authenticated users have admin access
    // In production, check user roles/permissions
    logger.info({ operationId, userId: user.id }, 'User authenticated for admin endpoint');

    // Process different actions
    let result: RetroactivePointsResult | BulkRetroactivePointsResult | CheckResult;
    let operationName: string;

    switch (payload.action) {
      case 'check_user':
        if (!payload.userId) {
          return NextResponse.json(
            { success: false, error: 'userId required for check_user action' },
            { status: 400 }
          );
        }
        
        operationName = 'Check User';
        result = await retroactivePointsService.checkIfUserNeedsRetroactivePoints(payload.userId);
        break;

      case 'preview_user':
        if (!payload.userId) {
          return NextResponse.json(
            { success: false, error: 'userId required for preview_user action' },
            { status: 400 }
          );
        }
        
        operationName = 'Preview User';
        result = await retroactivePointsService.previewRetroactivePoints(
          payload.userId, 
          payload.fromRoundId
        );
        break;

      case 'preview_competition':
        if (!payload.userId || !payload.competitionId) {
          return NextResponse.json(
            { success: false, error: 'userId and competitionId required for preview_competition action' },
            { status: 400 }
          );
        }
        
        operationName = 'Preview Competition';
        result = await retroactivePointsService.previewRetroactivePointsForCompetition(
          payload.userId,
          payload.competitionId,
          payload.fromRoundId
        );
        break;

      case 'apply_user':
        if (!payload.userId) {
          return NextResponse.json(
            { success: false, error: 'userId required for apply_user action' },
            { status: 400 }
          );
        }
        
        operationName = 'Apply User';
        result = await retroactivePointsService.applyRetroactivePointsForUser(
          payload.userId,
          payload.fromRoundId,
          payload.dryRun
        );
        
        // Trigger standings refresh if requested and not dry-run
        if (!payload.dryRun && payload.triggerStandingsRefresh && result.roundsProcessed > 0) {
          logger.info({ operationId }, 'Triggering standings recalculation after retroactive points');
          try {
            await calculateStandings();
            logger.info({ operationId }, 'Successfully triggered standings recalculation');
          } catch (standingsError) {
            logger.warn({ operationId, error: standingsError }, 'Failed to trigger standings recalculation (non-critical)');
            result.warnings = result.warnings || [];
            result.warnings.push('Failed to trigger standings recalculation - standings will update on next round scoring');
          }
        }
        break;

      case 'apply_competition':
        if (!payload.userId || !payload.competitionId) {
          return NextResponse.json(
            { success: false, error: 'userId and competitionId required for apply_competition action' },
            { status: 400 }
          );
        }
        
        operationName = 'Apply Competition';
        result = await retroactivePointsService.applyRetroactivePointsForCompetition(
          payload.userId,
          payload.competitionId,
          payload.fromRoundId,
          payload.dryRun
        );
        
        // Trigger standings refresh if requested and not dry-run
        if (!payload.dryRun && payload.triggerStandingsRefresh && result.roundsProcessed > 0) {
          try {
            await calculateStandings();
          } catch (standingsError) {
            logger.warn({ operationId, error: standingsError }, 'Failed to trigger standings recalculation');
            result.warnings = result.warnings || [];
            result.warnings.push('Failed to trigger standings recalculation');
          }
        }
        break;

      case 'apply_bulk':
        if (!payload.afterDate) {
          return NextResponse.json(
            { success: false, error: 'afterDate required for apply_bulk action' },
            { status: 400 }
          );
        }
        
        operationName = 'Apply Bulk';
        result = await retroactivePointsService.applyRetroactivePointsForNewUsers(
          payload.afterDate,
          payload.competitionId,
          payload.fromRoundId,
          payload.dryRun
        );
        
        // Trigger standings refresh if requested and not dry-run
        if (!payload.dryRun && payload.triggerStandingsRefresh && result.totalPointsAwarded > 0) {
          try {
            await calculateStandings();
          } catch (standingsError) {
            logger.warn({ operationId, error: standingsError }, 'Failed to trigger standings recalculation');
            result.warnings = result.warnings || [];
            result.warnings.push('Failed to trigger standings recalculation');
          }
        }
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${payload.action}` },
          { status: 400 }
        );
    }

    const duration = Date.now() - startTime;
    
    logger.info({ 
      operationId, 
      action: payload.action, 
      duration,
      success: true,
      ...('roundsProcessed' in result && result.roundsProcessed !== undefined && { roundsProcessed: result.roundsProcessed }),
      ...('totalPointsAwarded' in result && result.totalPointsAwarded !== undefined && { pointsAwarded: result.totalPointsAwarded })
    }, `RetroactivePointsAPI: ${operationName} completed successfully`);

    const response = {
      success: true,
      operation: operationName,
      action: payload.action,
      operationId,
      duration,
      dryRun: payload.dryRun || payload.action.includes('preview'),
      result,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const duration = Date.now() - startTime;
    
    logger.error({ 
      operationId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      duration
    }, 'RetroactivePointsAPI: Unexpected error');

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        operationId,
        duration,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/retroactive-points
 * 
 * Get status and help information for retroactive points endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/admin/retroactive-points',
    description: 'Admin endpoint for retroactive points allocation',
    methods: ['POST'],
    actions: {
      check_user: {
        description: 'Check if a user needs retroactive points',
        requiredParams: ['userId'],
        example: { action: 'check_user', userId: 'user-uuid' }
      },
      preview_user: {
        description: 'Preview retroactive points for a user (dry-run)',
        requiredParams: ['userId'],
        optionalParams: ['fromRoundId'],
        example: { action: 'preview_user', userId: 'user-uuid', fromRoundId: 1 }
      },
      preview_competition: {
        description: 'Preview retroactive points for user in specific competition',
        requiredParams: ['userId', 'competitionId'],
        optionalParams: ['fromRoundId'],
        example: { action: 'preview_competition', userId: 'user-uuid', competitionId: 1 }
      },
      apply_user: {
        description: 'Apply retroactive points for a user',
        requiredParams: ['userId'],
        optionalParams: ['fromRoundId', 'dryRun', 'triggerStandingsRefresh'],
        example: { action: 'apply_user', userId: 'user-uuid', dryRun: false }
      },
      apply_competition: {
        description: 'Apply retroactive points for user in specific competition',
        requiredParams: ['userId', 'competitionId'],
        optionalParams: ['fromRoundId', 'dryRun', 'triggerStandingsRefresh'],
        example: { action: 'apply_competition', userId: 'user-uuid', competitionId: 1 }
      },
      apply_bulk: {
        description: 'Apply retroactive points for all users created after date',
        requiredParams: ['afterDate'],
        optionalParams: ['competitionId', 'fromRoundId', 'dryRun', 'triggerStandingsRefresh'],
        example: { action: 'apply_bulk', afterDate: '2025-08-20T00:00:00Z' }
      }
    },
    authentication: 'Required - Admin level access',
    timestamp: new Date().toISOString()
  });
}