// src/main.sync.ts
import { NestFactory } from "@nestjs/core";
import { SyncModule } from "./daemon/sync/sync.module";
import { SyncService } from "./daemon/sync/sync.service";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SyncModule);
  const syncService = app.get(SyncService);
  await syncService.start();
}

bootstrap().catch((err) => {
  console.error("Error fatal al iniciar Sync Worker:", err);
  process.exit(1);
});
