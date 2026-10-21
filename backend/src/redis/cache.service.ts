import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Bộ nhớ đệm dùng Redis. Nếu không cấu hình REDIS_URL (hoặc Redis mất kết nối)
 * thì tự chuyển sang bộ nhớ trong tiến trình để API vẫn chạy được.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger('Cache');
  private redis: Redis | null = null;
  private ready = false;
  private memory = new Map<string, { value: string; expires: number }>();
  private prefix = 'giatot:';

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn('REDIS_URL chưa cấu hình, dùng cache trong bộ nhớ');
      return;
    }
    this.redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: false });
    this.redis.on('ready', () => {
      this.ready = true;
      this.logger.log('Đã kết nối Redis');
    });
    this.redis.on('error', (e) => {
      if (this.ready) this.logger.error(`Redis lỗi: ${e.message}`);
      this.ready = false;
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const k = this.prefix + key;
    if (this.redis && this.ready) {
      const v = await this.redis.get(k).catch(() => null);
      return v ? (JSON.parse(v) as T) : null;
    }
    const m = this.memory.get(k);
    if (!m || m.expires < Date.now()) return null;
    return JSON.parse(m.value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds = 60) {
    const k = this.prefix + key;
    const v = JSON.stringify(value);
    if (this.redis && this.ready) {
      await this.redis.set(k, v, 'EX', ttlSeconds).catch(() => undefined);
      return;
    }
    this.memory.set(k, { value: v, expires: Date.now() + ttlSeconds * 1000 });
  }

  async wrap<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const value = await fn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async delByPrefix(prefix: string) {
    const p = this.prefix + prefix;
    if (this.redis && this.ready) {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', p + '*', 'COUNT', 200);
        cursor = next;
        if (keys.length) await this.redis.del(...keys);
      } while (cursor !== '0');
      return;
    }
    for (const k of this.memory.keys()) if (k.startsWith(p)) this.memory.delete(k);
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }
}

@Global()
@Module({ providers: [CacheService], exports: [CacheService] })
export class CacheModule {}
