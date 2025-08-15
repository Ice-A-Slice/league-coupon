/**
 * Rate limiter for Resend API
 * Ensures we don't exceed 2 requests per second
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private processing = false;
  private lastRequestTime = 0;
  
  // Resend allows 2 requests per second
  // We'll be conservative and do 1.8 per second to avoid edge cases
  private readonly minDelayMs = 550; // ~1.8 requests per second
  
  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      // Wait if we need to respect rate limit
      if (timeSinceLastRequest < this.minDelayMs) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minDelayMs - timeSinceLastRequest)
        );
      }
      
      const task = this.queue.shift();
      if (task) {
        this.lastRequestTime = Date.now();
        await task();
      }
    }
    
    this.processing = false;
  }
  
  /**
   * Process multiple items with rate limiting
   * Returns results in the same order as input
   */
  async processWithRateLimit<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options?: {
      onProgress?: (completed: number, total: number) => void;
    }
  ): Promise<R[]> {
    const results: R[] = [];
    let completed = 0;
    
    for (const item of items) {
      const result = await this.execute(() => processor(item));
      results.push(result);
      completed++;
      
      if (options?.onProgress) {
        options.onProgress(completed, items.length);
      }
    }
    
    return results;
  }
}

// Create a singleton instance for email sending
export const emailRateLimiter = new RateLimiter();