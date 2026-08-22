import { redisConnection } from '../config/redis';
import { RateLimitResult } from '../types';

const RATE_LIMIT_LUA_SCRIPT = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])

  local current = redis.call('INCR', key)
  if current == 1 then
    redis.call('EXPIRE', key, ttl)
  end

  return current
`;

export async function checkRateLimit(
  senderEmail: string,
  maxPerHour: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const hourWindow = Math.floor(now / 3600000);
  const key = `ratelimit:${senderEmail}:${hourWindow}`;

  const windowEndMs = (hourWindow + 1) * 3600000;
  const ttlSeconds = Math.ceil((windowEndMs - now) / 1000) + 1;

  const currentCount = await redisConnection.eval(
    RATE_LIMIT_LUA_SCRIPT,
    1,
    key,
    maxPerHour.toString(),
    ttlSeconds.toString()
  ) as number;

  if (currentCount > maxPerHour) {

    const retryAfterMs = windowEndMs - now + 1000;

    return {
      allowed: false,
      currentCount,
      maxAllowed: maxPerHour,
      retryAfterMs,
    };
  }

  return {
    allowed: true,
    currentCount,
    maxAllowed: maxPerHour,
  };
}

export async function getCurrentSendCount(senderEmail: string): Promise<number> {
  const hourWindow = Math.floor(Date.now() / 3600000);
  const key = `ratelimit:${senderEmail}:${hourWindow}`;
  const count = await redisConnection.get(key);
  return count ? parseInt(count, 10) : 0;
}

export async function decrementRateLimit(senderEmail: string): Promise<void> {
  const hourWindow = Math.floor(Date.now() / 3600000);
  const key = `ratelimit:${senderEmail}:${hourWindow}`;
  await redisConnection.decr(key);
}
