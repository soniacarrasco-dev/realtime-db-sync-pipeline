// src/daemon/redis/redis.service.ts
import { Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { config } from "../../config";

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor() {
    this.client = new Redis({
      host: config.redisDB.host,
      port: config.redisDB.port,
    });

    this.client.on("connect", () => {
      this.logger.log("✅ Conexión con Redis establecida con éxito");
    });

    this.client.on("error", (err) => {
      this.logger.error("❌ Error de conexión en cliente Redis:", err);
    });
  }

  async setnx(key: string, value: any): Promise<boolean> {
    try {
      const result = await this.client.setnx(key, JSON.stringify(value));
      return result === 1;
    } catch (err) {
      this.logger.error(`❌ Error en setnx ${key}`, err);
      return false;
    }
  }

  async set(key: string, value: any): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value));
    } catch (err) {
      this.logger.error(`❌ Error en set ${key}`, err);
    }
  }

  async setex(key: string, seconds: number, value: any): Promise<void> {
    try {
      await this.client.setex(key, seconds, JSON.stringify(value));
    } catch (err) {
      this.logger.error(`❌ Error en setex ${key}`, err);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      this.logger.error(`❌ Error en get ${key}`, err);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.error(`❌ Error en del ${key}`, err);
    }
  }

  // --- MÉTODOS NATIVOS DE REDIS JSON ---

  async jsonSet(key: string, value: any): Promise<void> {
    try {
      await this.client.call("JSON.SET", key, ".", JSON.stringify(value));
    } catch (err) {
      this.logger.error(`❌ Error JSON.SET en ${key}`, err);
    }
  }

  async jsonSetEx(key: string, seconds: number, value: any): Promise<void> {
    try {
      const payload = JSON.stringify(value);
      await this.client
        .multi()
        .call("JSON.SET", key, ".", payload)
        .expire(key, seconds)
        .exec();
    } catch (err) {
      this.logger.error(`❌ Error JSON.SETEX en ${key}`, err);
    }
  }

  async jsonSetNx(key: string, value: any): Promise<boolean> {
    try {
      const result = await this.client.call(
        "JSON.SET",
        key,
        ".",
        JSON.stringify(value),
        "NX",
      );
      return result === "OK";
    } catch (err) {
      this.logger.error(`❌ Error JSON.SETNX en ${key}`, err);
      return false;
    }
  }

  async jsonGet<T = any>(key: string, path = "."): Promise<T | null> {
    try {
      const res = await this.client.call("JSON.GET", key, path);
      return res ? JSON.parse(res as string) : null;
    } catch (err) {
      this.logger.error(`❌ Error JSON.GET en ${key}`, err);
      return null;
    }
  }

  async jsonDel(key: string, path = "."): Promise<number> {
    try {
      return (await this.client.call("JSON.DEL", key, path)) as number;
    } catch (err) {
      this.logger.error(`❌ Error JSON.DEL en ${key}`, err);
      return 0;
    }
  }

  // --- SORTED SETS (ZSET) PARA AUDITORÍA Y VENTANA TEMPORAL ---

  async zAdd(key: string, score: number, member: string): Promise<number> {
    return this.client.zadd(key, score, member);
  }

  async zRemRangeByScore(
    key: string,
    min: number,
    max: number,
  ): Promise<number> {
    return this.client.zremrangebyscore(key, min, max);
  }

  // --- PUB/SUB EN TIEMPO REAL ---

  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  // --- SETS CONVENCIONALES ---

  async sAdd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.sadd(key, ...members);
    } catch (err) {
      this.logger.error(`❌ Error en sAdd ${key}`, err);
      return 0;
    }
  }

  async sRem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.srem(key, ...members);
    } catch (err) {
      this.logger.error(`❌ Error en sRem ${key}`, err);
      return 0;
    }
  }

  async sMembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (err) {
      this.logger.error(`❌ Error en sMembers ${key}`, err);
      return [];
    }
  }
}
