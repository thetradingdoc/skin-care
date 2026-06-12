'use strict';

let redisClient = null;
let redisUnavailable = false;

function isRedisEnabled() {
  return Boolean(process.env.REDIS_URL);
}

async function getRedisClient() {
  if (redisUnavailable || !isRedisEnabled()) return null;
  if (redisClient) return redisClient;
  try {
    const Redis = require('ioredis');
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      tls: String(process.env.REDIS_URL || '').startsWith('rediss://') ? {} : undefined,
    });
    await redisClient.connect();
    return redisClient;
  } catch (e) {
    redisUnavailable = true;
    console.warn('[redis-client] Redis unavailable:', e.message);
    return null;
  }
}

async function redisGet(key) {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

async function redisSet(key, value, ttlSeconds) {
  const client = await getRedisClient();
  if (!client) return false;
  try {
    if (ttlSeconds > 0) {
      await client.set(key, value, 'EX', ttlSeconds);
    } else {
      await client.set(key, value);
    }
    return true;
  } catch {
    return false;
  }
}

async function redisDel(key) {
  const client = await getRedisClient();
  if (!client) return false;
  try {
    await client.del(key);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  isRedisEnabled,
  getRedisClient,
  redisGet,
  redisSet,
  redisDel,
};
