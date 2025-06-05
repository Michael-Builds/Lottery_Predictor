import { redisClient } from '../config/db.config';

const ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

export const cacheData = async (key: string, data: any, ttl: number = ONE_WEEK_IN_SECONDS) => {
    await redisClient.setEx(key, ttl, JSON.stringify(data));
};

export const getCachedData = async (key: string) => {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
};