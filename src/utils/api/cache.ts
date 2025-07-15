/**
 * Cache utilities for API endpoints
 */

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  maxAge: number;
  staleWhileRevalidate?: number;
  public?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
  immutable?: boolean;
}

/**
 * Predefined cache strategies for different types of content
 */
export const CacheStrategies = {
  /**
   * Public data that changes infrequently (Hall of Fame listings)
   * Cache for 5 minutes, allow stale for 10 minutes
   */
  PUBLIC_DATA: {
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 600, // 10 minutes
    public: true
  } as CacheConfig,

  /**
   * Statistics data that can be cached longer
   * Cache for 3 minutes, allow stale for 6 minutes
   */
  STATISTICS: {
    maxAge: 180, // 3 minutes
    staleWhileRevalidate: 360, // 6 minutes
    public: true
  } as CacheConfig,

  /**
   * Season-specific data that rarely changes once completed
   * Cache for 10 minutes, allow stale for 20 minutes
   */
  SEASON_DATA: {
    maxAge: 600, // 10 minutes
    staleWhileRevalidate: 1200, // 20 minutes
    public: true
  } as CacheConfig,

  /**
   * Live/dynamic data that changes frequently
   * Cache for 1 minute, allow stale for 2 minutes
   */
  LIVE_DATA: {
    maxAge: 60, // 1 minute
    staleWhileRevalidate: 120, // 2 minutes
    public: true
  } as CacheConfig,

  /**
   * Admin data that should not be cached publicly
   * Private cache for 30 seconds only
   */
  ADMIN_DATA: {
    maxAge: 30, // 30 seconds
    public: false
  } as CacheConfig,

  /**
   * No cache for sensitive or highly dynamic data
   */
  NO_CACHE: {
    maxAge: 0,
    noCache: true,
    noStore: true,
    mustRevalidate: true,
    public: false
  } as CacheConfig,

  /**
   * Immutable data that never changes (historical records)
   * Cache for 1 hour, allow stale for 2 hours
   */
  IMMUTABLE: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 7200, // 2 hours
    public: true,
    immutable: true
  } as CacheConfig
} as const;

/**
 * Build Cache-Control header value from configuration
 */
export function buildCacheControlHeader(config: CacheConfig): string {
  const directives: string[] = [];

  // Visibility
  if (config.public) {
    directives.push('public');
  } else if (config.public === false) {
    directives.push('private');
  }

  // No cache directives
  if (config.noCache) {
    directives.push('no-cache');
  }

  if (config.noStore) {
    directives.push('no-store');
  }

  if (config.mustRevalidate) {
    directives.push('must-revalidate');
  }

  // Max age
  if (config.maxAge >= 0) {
    directives.push(`max-age=${config.maxAge}`);
  }

  // Stale while revalidate
  if (config.staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  // Immutable
  if (config.immutable) {
    directives.push('immutable');
  }

  return directives.join(', ');
}

/**
 * Create cache headers object for Next.js Response
 */
export function createCacheHeaders(config: CacheConfig): Record<string, string> {
  const headers: Record<string, string> = {};

  // Cache-Control header
  const cacheControl = buildCacheControlHeader(config);
  if (cacheControl) {
    headers['Cache-Control'] = cacheControl;
  }

  // Add Vary header for public caches to respect different request types
  if (config.public) {
    headers['Vary'] = 'Accept, Accept-Encoding';
  }

  // Add ETag support for immutable content
  if (config.immutable && config.maxAge > 0) {
    // Note: ETag would need to be generated based on content
    // This is a placeholder - actual implementation would hash the response
    headers['ETag'] = `"${Date.now()}"`;
  }

  return headers;
}

/**
 * Create headers for different cache strategies
 */
export function getPublicDataCacheHeaders(): Record<string, string> {
  return createCacheHeaders(CacheStrategies.PUBLIC_DATA);
}

export function getStatisticsCacheHeaders(): Record<string, string> {
  return createCacheHeaders(CacheStrategies.STATISTICS);
}

export function getSeasonDataCacheHeaders(): Record<string, string> {
  return createCacheHeaders(CacheStrategies.SEASON_DATA);
}

export function getLiveDataCacheHeaders(): Record<string, string> {
  return createCacheHeaders(CacheStrategies.LIVE_DATA);
}

export function getAdminDataCacheHeaders(): Record<string, string> {
  return createCacheHeaders(CacheStrategies.ADMIN_DATA);
}

export function getNoCacheHeaders(): Record<string, string> {
  return createCacheHeaders(CacheStrategies.NO_CACHE);
}

export function getImmutableCacheHeaders(): Record<string, string> {
  return createCacheHeaders(CacheStrategies.IMMUTABLE);
}

/**
 * Determine appropriate cache strategy based on endpoint characteristics
 */
export function determineCacheStrategy(
  isPublic: boolean,
  dataType: 'list' | 'detail' | 'stats' | 'live' | 'admin',
  isHistorical: boolean = false
): CacheConfig {
  // Admin endpoints get restricted caching
  if (!isPublic || dataType === 'admin') {
    return CacheStrategies.ADMIN_DATA;
  }

  // Historical data can be cached longer
  if (isHistorical) {
    return CacheStrategies.IMMUTABLE;
  }

  // Determine strategy based on data type
  switch (dataType) {
    case 'stats':
      return CacheStrategies.STATISTICS;
    case 'detail':
      return CacheStrategies.SEASON_DATA;
    case 'live':
      return CacheStrategies.LIVE_DATA;
    case 'list':
    default:
      return CacheStrategies.PUBLIC_DATA;
  }
}

/**
 * Get cache headers based on automatic strategy determination
 */
export function getAutoCacheHeaders(
  isPublic: boolean,
  dataType: 'list' | 'detail' | 'stats' | 'live' | 'admin',
  isHistorical: boolean = false
): Record<string, string> {
  const strategy = determineCacheStrategy(isPublic, dataType, isHistorical);
  return createCacheHeaders(strategy);
}

/**
 * Validate cache configuration
 */
export function validateCacheConfig(config: CacheConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check conflicting directives
  if (config.noCache && config.maxAge > 0) {
    errors.push('Cannot set maxAge when noCache is true');
  }

  if (config.noStore && config.staleWhileRevalidate) {
    errors.push('Cannot use staleWhileRevalidate when noStore is true');
  }

  if (config.immutable && config.maxAge === 0) {
    errors.push('Immutable content should have a positive maxAge');
  }

  // Check reasonable values
  if (config.maxAge < 0) {
    errors.push('maxAge cannot be negative');
  }

  if (config.staleWhileRevalidate && config.staleWhileRevalidate < config.maxAge) {
    errors.push('staleWhileRevalidate should be greater than or equal to maxAge');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create conditional cache headers based on request characteristics
 */
export function createConditionalCacheHeaders(
  request: {
    method: string;
    headers: Headers;
  },
  baseConfig: CacheConfig
): Record<string, string> {
  // Don't cache non-GET requests
  if (request.method !== 'GET') {
    return createCacheHeaders(CacheStrategies.NO_CACHE);
  }

  // Check for cache control request headers
  const requestCacheControl = request.headers.get('cache-control');
  if (requestCacheControl?.includes('no-cache')) {
    return createCacheHeaders({
      ...baseConfig,
      maxAge: 0,
      mustRevalidate: true
    });
  }

  return createCacheHeaders(baseConfig);
}

/**
 * Generate ETag for response content
 */
export function generateETag(content: unknown): string {
  let contentString: string;
  
  if (typeof content === 'string') {
    contentString = content;
  } else if (content !== null && content !== undefined) {
    contentString = JSON.stringify(content);
  } else {
    contentString = '';
  }
  
  // Simple hash function for ETag (in production, use crypto.createHash)
  let hash = 0;
  for (let i = 0; i < contentString.length; i++) {
    const char = contentString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `"${Math.abs(hash).toString(16)}"`;
}

/**
 * Check if request has matching ETag
 */
export function hasMatchingETag(
  request: { headers: Headers },
  etag: string
): boolean {
  const ifNoneMatch = request.headers.get('if-none-match');
  return ifNoneMatch === etag;
}

/**
 * Create cache-aware response headers including ETag
 */
export function createCacheAwareHeaders(
  content: unknown,
  config: CacheConfig,
  request?: { method: string; headers: Headers }
): {
  headers: Record<string, string>;
  shouldReturn304: boolean;
} {
  const headers = request 
    ? createConditionalCacheHeaders(request, config)
    : createCacheHeaders(config);

  let shouldReturn304 = false;

  // Add ETag for cacheable content
  if (config.maxAge > 0 && !config.noCache && !config.noStore) {
    const etag = generateETag(content);
    headers['ETag'] = etag;

    // Check for 304 Not Modified
    if (request && hasMatchingETag(request, etag)) {
      shouldReturn304 = true;
    }
  }

  return { headers, shouldReturn304 };
} 