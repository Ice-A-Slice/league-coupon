import { NextResponse } from 'next/server';

/**
 * Standard API response format interface
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  pagination?: PaginationMetadata;
  query_info?: Record<string, unknown>;
  metadata?: {
    requestId?: string;
    timestamp?: string;
    processingTime?: number;
    [key: string]: unknown;
  };
}

/**
 * Pagination metadata interface
 */
export interface PaginationMetadata {
  total_items?: number;
  total_pages?: number;
  current_page?: number;
  page_size?: number;
  has_more?: boolean;
  offset?: number;
  limit?: number;
  total?: number;
  count?: number;
}

/**
 * Success response options
 */
export interface SuccessResponseOptions {
  requestId?: string;
  processingTime?: number;
  cacheHeaders?: {
    maxAge?: number;
    staleWhileRevalidate?: number;
    public?: boolean;
  };
  pagination?: PaginationMetadata;
  queryInfo?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Error response options
 */
export interface ErrorResponseOptions {
  requestId?: string;
  details?: string;
  statusCode?: number;
  logError?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  options: SuccessResponseOptions = {}
): NextResponse {
  const {
    requestId,
    processingTime,
    cacheHeaders,
    pagination,
    queryInfo,
    metadata
  } = options;

  const response: APIResponse<T> = {
    success: true,
    data,
    ...(pagination && { pagination }),
    ...(queryInfo && { query_info: queryInfo }),
    ...(metadata || requestId || processingTime) && {
      metadata: {
        ...(requestId && { requestId }),
        ...(processingTime && { processingTime }),
        timestamp: new Date().toISOString(),
        ...metadata
      }
    }
  };

  // Build headers
  const headers: Record<string, string> = {};
  
  if (cacheHeaders) {
    const { maxAge = 300, staleWhileRevalidate = 600, public: isPublic = true } = cacheHeaders;
    const visibility = isPublic ? 'public' : 'private';
    headers['Cache-Control'] = `${visibility}, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
  }

  return NextResponse.json(response, {
    status: 200,
    headers: Object.keys(headers).length > 0 ? headers : undefined
  });
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  options: ErrorResponseOptions = {}
): NextResponse {
  const {
    requestId,
    details,
    statusCode = 500,
    metadata
  } = options;

  const response: APIResponse = {
    success: false,
    error,
    ...(details && { details }),
    ...(metadata || requestId) && {
      metadata: {
        ...(requestId && { requestId }),
        timestamp: new Date().toISOString(),
        ...metadata
      }
    }
  };

  return NextResponse.json(response, {
    status: statusCode
  });
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(
  message: string,
  validationErrors: Record<string, string[]>,
  options: ErrorResponseOptions = {}
): NextResponse {
  const details = Object.entries(validationErrors)
    .map(([field, errors]) => `${field}: ${errors.join(', ')}`)
    .join('; ');

  return createErrorResponse(message, {
    ...options,
    details,
    statusCode: 400
  });
}

/**
 * Create an unauthorized error response
 */
export function createUnauthorizedResponse(
  message: string = 'Unauthorized',
  options: ErrorResponseOptions = {}
): NextResponse {
  return createErrorResponse(message, {
    ...options,
    statusCode: 401
  });
}

/**
 * Create a not found error response
 */
export function createNotFoundResponse(
  message: string = 'Resource not found',
  options: ErrorResponseOptions = {}
): NextResponse {
  return createErrorResponse(message, {
    ...options,
    statusCode: 404
  });
}

/**
 * Create a conflict error response
 */
export function createConflictResponse(
  message: string = 'Resource conflict',
  options: ErrorResponseOptions = {}
): NextResponse {
  return createErrorResponse(message, {
    ...options,
    statusCode: 409
  });
}

/**
 * Create a server error response
 */
export function createServerErrorResponse(
  message: string = 'Internal server error',
  options: ErrorResponseOptions = {}
): NextResponse {
  return createErrorResponse(message, {
    ...options,
    statusCode: 500
  });
}

/**
 * Wrapper function for handling API routes with consistent error handling
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      return await handler(...args);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.error('API Error:', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        processingTime
      });

      return createServerErrorResponse('Internal server error', {
        requestId,
        metadata: { processingTime }
      });
    }
  };
}

/**
 * Format timestamps to ISO format consistently
 */
export function formatTimestamp(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toISOString();
  } catch {
    return null;
  }
}

/**
 * Clean response data by removing null/undefined values and formatting dates
 */
export function cleanResponseData<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => cleanResponseData(item)) as T;
  }

  if (typeof data === 'object' && data !== null) {
    const cleaned = {} as T;
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        // Format timestamp fields
        if (typeof value === 'string' && (
          key.includes('_at') || 
          key.includes('_date') || 
          key.endsWith('Date')
        )) {
          const formatted = formatTimestamp(value);
          if (formatted) {
            (cleaned as Record<string, unknown>)[key] = formatted;
          }
        } else {
          (cleaned as Record<string, unknown>)[key] = cleanResponseData(value);
        }
      }
    }
    
    return cleaned;
  }

  return data;
} 