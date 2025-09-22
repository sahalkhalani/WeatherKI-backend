export interface CachedItem<T> {
  data: T;
  timestamp: number;
  key: string;
}

export class CacheService<T> {
  private cache: Map<string, CachedItem<T>> = new Map();
  private cacheDuration: number;

  constructor(cacheDurationMs: number = 5 * 60 * 1000) { // 5 minutes default
    this.cacheDuration = cacheDurationMs;
    
    // Clean up expired items every minute
    setInterval(() => {
      this.clearExpired();
    }, 60 * 1000);
  }

  set(key: string, data: T): void {
    const item: CachedItem<T> = {
      data,
      timestamp: Date.now(),
      key,
    };
    
    this.cache.set(key, item);
    console.log(`Cache set for key: ${key}`);
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if item has expired
    if (this.isExpired(item)) {
      this.cache.delete(key);
      console.log(`Cache expired and removed for key: ${key}`);
      return null;
    }

    return item.data;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    if (this.isExpired(item)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`Cache deleted for key: ${key}`);
    }
    return deleted;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`Cache cleared, removed ${size} items`);
  }

  clearExpired(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (this.isExpired(item)) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`Cache cleanup: removed ${expiredCount} expired items`);
    }
  }

  private isExpired(item: CachedItem<T>): boolean {
    return (Date.now() - item.timestamp) > this.cacheDuration;
  }

  getStats(): any {
    const now = Date.now();
    let expiredCount = 0;
    let validCount = 0;

    for (const item of this.cache.values()) {
      if (this.isExpired(item)) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      totalItems: this.cache.size,
      validItems: validCount,
      expiredItems: expiredCount,
      cacheDurationMs: this.cacheDuration,
      cacheDurationMinutes: this.cacheDuration / (60 * 1000),
      timestamp: new Date().toISOString(),
    };
  }

  getAllValid(): Array<{ key: string; data: T; age: number }> {
    const now = Date.now();
    const validItems: Array<{ key: string; data: T; age: number }> = [];

    for (const [key, item] of this.cache.entries()) {
      if (!this.isExpired(item)) {
        validItems.push({
          key,
          data: item.data,
          age: now - item.timestamp,
        });
      }
    }

    return validItems;
  }
}