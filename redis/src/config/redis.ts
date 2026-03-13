import { Redis, type RedisOptions } from 'ioredis';

let redisClient: Redis | null = null;

/**
 * Initialize and return the Redis client singleton.
 * Reads REDIS_URL from environment (default: redis://localhost:6379).
 */
export const connectRedis = async (): Promise<Redis> => {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      return Math.min(times * 50, 2000);
    },
    reconnectOnError(err: Error) {
      return err.message.includes('READONLY');
    },
    lazyConnect: false,
  } as RedisOptions);

  redisClient.on('connect', () => console.log('✅ [Redis MS] Connected to Redis'));
  redisClient.on('ready', () => console.log('✅ [Redis MS] Redis ready'));
  redisClient.on('error', (err: Error) => console.error('❌ [Redis MS] Redis error:', err));
  redisClient.on('close', () => console.log('⚠️  [Redis MS] Redis connection closed'));
  redisClient.on('reconnecting', () => console.log('🔄 [Redis MS] Redis reconnecting…'));

  await redisClient.ping();
  console.log('✅ [Redis MS] Ping successful');
  return redisClient;
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error('[Redis MS] Redis client not initialised. Call connectRedis() first.');
  }
  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('✅ [Redis MS] Disconnected');
  }
};
