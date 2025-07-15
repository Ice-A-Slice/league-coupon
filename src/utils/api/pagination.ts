import { NextRequest } from 'next/server';
import { PaginationMetadata } from './response';

/**
 * Pagination configuration interface
 */
export interface PaginationConfig {
  defaultLimit?: number;
  maxLimit?: number;
  defaultOffset?: number;
}

/**
 * Parsed pagination parameters
 */
export interface PaginationParams {
  limit: number;
  offset: number;
  page?: number;
}

/**
 * Sort configuration
 */
export interface SortConfig {
  defaultSort?: string;
  validSorts?: string[];
}

/**
 * Parsed query parameters
 */
export interface ParsedQueryParams {
  pagination: PaginationParams;
  sort?: string;
  filters: Record<string, string | number | boolean>;
}

/**
 * Default pagination configuration
 */
const DEFAULT_PAGINATION_CONFIG: Required<PaginationConfig> = {
  defaultLimit: 20,
  maxLimit: 100,
  defaultOffset: 0
};

/**
 * Parse pagination parameters from request URL
 */
export function parsePaginationParams(
  request: NextRequest,
  config: PaginationConfig = {}
): PaginationParams {
  const { searchParams } = new URL(request.url);
  const {
    defaultLimit,
    maxLimit,
    defaultOffset
  } = { ...DEFAULT_PAGINATION_CONFIG, ...config };

  // Parse limit
  const limitParam = searchParams.get('limit');
  const limit = limitParam 
    ? Math.min(Math.max(parseInt(limitParam), 1), maxLimit)
    : defaultLimit;

  // Parse offset
  const offsetParam = searchParams.get('offset');
  const offset = offsetParam 
    ? Math.max(parseInt(offsetParam), 0)
    : defaultOffset;

  // Parse page (alternative to offset)
  const pageParam = searchParams.get('page');
  const page = pageParam ? Math.max(parseInt(pageParam), 1) : undefined;

  // If page is provided, calculate offset from page
  const finalOffset = page ? (page - 1) * limit : offset;

  return {
    limit,
    offset: finalOffset,
    page
  };
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMetadata(
  params: PaginationParams,
  totalItems: number
): PaginationMetadata {
  const { limit, offset } = params;
  const totalPages = Math.ceil(totalItems / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const hasMore = offset + limit < totalItems;

  return {
    total_items: totalItems,
    total_pages: totalPages,
    current_page: currentPage,
    page_size: limit,
    has_more: hasMore,
    offset,
    limit
  };
}

/**
 * Create pagination metadata for admin endpoints (different format)
 */
export function createAdminPaginationMetadata(
  params: PaginationParams,
  totalItems: number,
  returnedCount: number
): PaginationMetadata {
  const { limit, offset } = params;

  return {
    offset,
    limit,
    total: totalItems,
    count: returnedCount
  };
}

/**
 * Parse sort parameters with validation
 */
export function parseSortParams(
  request: NextRequest,
  config: SortConfig = {}
): string {
  const { searchParams } = new URL(request.url);
  const { defaultSort = 'newest', validSorts = [] } = config;

  const sort = searchParams.get('sort') || defaultSort;

  // Validate sort parameter if validSorts is provided
  if (validSorts.length > 0 && !validSorts.includes(sort)) {
    throw new Error(`Invalid sort parameter. Must be one of: ${validSorts.join(', ')}`);
  }

  return sort;
}

/**
 * Parse filter parameters from request
 */
export function parseFilterParams(
  request: NextRequest,
  allowedFilters: string[] = []
): Record<string, string | number | boolean> {
  const { searchParams } = new URL(request.url);
  const filters: Record<string, string | number | boolean> = {};

  // Extract only allowed filters
  for (const filter of allowedFilters) {
    const value = searchParams.get(filter);
    if (value !== null) {
      // Try to parse as number
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        filters[filter] = numValue;
      } 
      // Try to parse as boolean
      else if (value === 'true' || value === 'false') {
        filters[filter] = value === 'true';
      }
      // Keep as string
      else {
        filters[filter] = value;
      }
    }
  }

  return filters;
}

/**
 * Parse all query parameters (pagination, sort, filters)
 */
export function parseQueryParams(
  request: NextRequest,
  options: {
    pagination?: PaginationConfig;
    sort?: SortConfig;
    filters?: string[];
  } = {}
): ParsedQueryParams {
  const { pagination = {}, sort = {}, filters = [] } = options;

  return {
    pagination: parsePaginationParams(request, pagination),
    sort: parseSortParams(request, sort),
    filters: parseFilterParams(request, filters)
  };
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(params: PaginationParams): string[] {
  const errors: string[] = [];

  if (params.limit < 1) {
    errors.push('Limit must be at least 1');
  }

  if (params.offset < 0) {
    errors.push('Offset must be non-negative');
  }

  if (params.page && params.page < 1) {
    errors.push('Page must be at least 1');
  }

  return errors;
}

/**
 * Apply pagination to a Supabase query
 */
export function applyPagination<T extends { range?: (start: number, end: number) => T }>(
  query: T,
  params: PaginationParams
): T {
  const { limit, offset } = params;
  
  // Assuming the query object has a range method (Supabase pattern)
  if (query && query.range && typeof query.range === 'function') {
    return query.range(offset, offset + limit - 1);
  }
  
  return query;
}

/**
 * Build query string from pagination parameters
 */
export function buildPaginationQueryString(params: PaginationParams): string {
  const queryParams = new URLSearchParams();
  
  queryParams.set('limit', params.limit.toString());
  queryParams.set('offset', params.offset.toString());
  
  if (params.page) {
    queryParams.set('page', params.page.toString());
  }
  
  return queryParams.toString();
}

/**
 * Get next page URL
 */
export function getNextPageUrl(
  baseUrl: string,
  params: PaginationParams,
  totalItems: number
): string | null {
  const { limit, offset } = params;
  
  if (offset + limit >= totalItems) {
    return null; // No next page
  }
  
  const nextOffset = offset + limit;
  const nextPage = Math.floor(nextOffset / limit) + 1;
  
  const url = new URL(baseUrl);
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('offset', nextOffset.toString());
  url.searchParams.set('page', nextPage.toString());
  
  return url.toString();
}

/**
 * Get previous page URL
 */
export function getPreviousPageUrl(
  baseUrl: string,
  params: PaginationParams
): string | null {
  const { limit, offset } = params;
  
  if (offset <= 0) {
    return null; // No previous page
  }
  
  const prevOffset = Math.max(0, offset - limit);
  const prevPage = Math.floor(prevOffset / limit) + 1;
  
  const url = new URL(baseUrl);
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('offset', prevOffset.toString());
  url.searchParams.set('page', prevPage.toString());
  
  return url.toString();
}

/**
 * Create pagination links object
 */
export function createPaginationLinks(
  baseUrl: string,
  params: PaginationParams,
  totalItems: number
): {
  next?: string;
  previous?: string;
  first?: string;
  last?: string;
} {
  const { limit } = params;
  const totalPages = Math.ceil(totalItems / limit);
  
  const links: Record<string, string> = {};
  
  // First page
  const firstUrl = new URL(baseUrl);
  firstUrl.searchParams.set('limit', limit.toString());
  firstUrl.searchParams.set('offset', '0');
  firstUrl.searchParams.set('page', '1');
  links.first = firstUrl.toString();
  
  // Last page
  const lastOffset = (totalPages - 1) * limit;
  const lastUrl = new URL(baseUrl);
  lastUrl.searchParams.set('limit', limit.toString());
  lastUrl.searchParams.set('offset', lastOffset.toString());
  lastUrl.searchParams.set('page', totalPages.toString());
  links.last = lastUrl.toString();
  
  // Next page
  const nextUrl = getNextPageUrl(baseUrl, params, totalItems);
  if (nextUrl) {
    links.next = nextUrl;
  }
  
  // Previous page
  const prevUrl = getPreviousPageUrl(baseUrl, params);
  if (prevUrl) {
    links.previous = prevUrl;
  }
  
  return links;
} 