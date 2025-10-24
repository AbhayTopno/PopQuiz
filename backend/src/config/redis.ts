import { Redis, type RedisOptions } from 'ioredis';

let redisClient: Redis | null = null;

/**
 * Initialize Redis connection
 * Supports both cloud Redis and local Redis instances
 */
export const connectRedis = async (): Promise<Redis> => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Create Redis client using URL
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err: Error) {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
      lazyConnect: false,
    } as RedisOptions);

    // Handle connection events
    redisClient.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis ready to accept commands');
    });

    redisClient.on('error', (err: Error) => {
      console.error('❌ Redis error:', err);
    });

    redisClient.on('close', () => {
      console.log('⚠️  Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    // Wait for connection to be ready
    await redisClient.ping();
    console.log('✅ Redis ping successful');

    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    throw error;
  }
};

/**
 * Get the Redis client instance
 */
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

/**
 * Close Redis connection gracefully
 */
export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('✅ Redis disconnected');
  }
};

/**
 * Check if Redis is connected
 */
export const isRedisConnected = (): boolean => {
  return redisClient !== null && redisClient.status === 'ready';
};

/**
 * Flush all Redis data (use with caution - mainly for testing)
 */
export const flushRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.flushall();
    console.log('🗑️  Redis data flushed');
  }
};
