// src/daemon/sync/sync.module.ts
import { Module } from "@nestjs/common";
import { SyncService } from "./sync.service";
import { RedisService } from "../redis/redis.service";
import { CouchService } from "./couch/couch.service";
import { AuthService } from "./auth.service";
import { SearchSyncService } from "./search-sync/search-sync.service";

@Module({
  providers: [
    SyncService,
    RedisService,
    CouchService,
    AuthService,
    SearchSyncService,
  ],
  exports: [RedisService, SyncService],
})
export class SyncModule {}
