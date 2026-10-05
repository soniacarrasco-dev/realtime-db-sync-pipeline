// src/daemon/sync/sync.service.ts
import { Injectable, Logger } from "@nestjs/common";
import * as cliProgress from "cli-progress";
import { RedisService } from "../redis/redis.service";
import { CouchService } from "./couch/couch.service";
import { AuthService, ProjectDefinition } from "./auth.service";
import { SearchSyncService } from "./search-sync/search-sync.service";

@Injectable()
export class SyncService {
  private readonly processLogger = new Logger(`${SyncService.name}:Process`);
  private readonly changeLogger = new Logger(`${SyncService.name}:Change`);

  private readonly designDoc = "views";
  private readonly mapViewName = "maps";

  constructor(
    private readonly couchService: CouchService,
    private readonly redisService: RedisService,
    private readonly authService: AuthService,
    private readonly searchSyncService: SearchSyncService,
  ) {}

  async start(): Promise<void> {
    const searchReady = await this.searchSyncService.healthCheck();
    if (searchReady) {
      this.processLogger.log("🔍 Motor de búsqueda indexador disponible");
    } else {
      this.processLogger.warn(
        "⚠️ Motor de búsqueda no disponible - sincronización local continua activa",
      );
    }

    const projects = await this.authService.findAllProjects();
    await this.redisService.jsonSet("projects", projects);

    this.processLogger.log(
      "🚀 Iniciando listeners de cambios en tiempo real...",
    );
    await this.escucharCambiosMapas(projects);
    await this.escucharCambiosServicios(projects);

    this.processLogger.log(
      "📦 Iniciando precarga masiva de documentos iniciales...",
    );
    await this.precargarDocumentos(projects);

    this.processLogger.log("🔄 Precargando vistas indexadas en memoria...");
    await this.precargarMapsPorProyecto(projects);
    await this.precargarServicesPorProyecto(projects);

    this.processLogger.log(
      "✅ Worker de sincronización en ejecución y escuchando mutaciones",
    );
  }

  private async precargarDocumentos(
    projects: ProjectDefinition[],
  ): Promise<void> {
    const dbs = await this.couchService.getAllDatabases();

    for (const dbName of dbs) {
      if (dbName.startsWith("_")) continue;
      const docs = await this.couchService.getAllDocsFromDb(dbName);
      if (!docs.length) continue;

      const currentProject = projects.find(
        (p) =>
          p.data_lake.service_database === dbName ||
          p.data_lake.map_database === dbName,
      );
      const projectId = currentProject?._id || dbName;

      const bar = new cliProgress.SingleBar(
        {
          format: `📦 ${dbName.padEnd(25)} |{bar}| {value}/{total} docs sincronizados`,
          hideCursor: true,
        },
        cliProgress.Presets.shades_classic,
      );

      bar.start(docs.length, 0);

      for (const doc of docs) {
        if (!doc._id || doc._id.startsWith("_design/")) {
          bar.increment();
          continue;
        }

        const key = `db:${dbName}:doc:${doc._id}`;
        await this.redisService.jsonSetNx(key, doc);

        await this.searchSyncService
          .indexDocument({
            project_name: projectId,
            doc_id: doc._id,
            content: doc,
          })
          .catch((err) => {
            this.processLogger.warn(
              `Error indexando ${doc._id} en Elastic: ${err.message}`,
            );
          });

        bar.increment();
      }

      bar.stop();
      this.processLogger.log(
        `📦 Procesados ${docs.length} documentos de la base ${dbName}`,
      );
    }
  }

  private async escucharCambiosServicios(
    projects: ProjectDefinition[],
  ): Promise<void> {
    for (const project of projects) {
      const dbName = project.data_lake.service_database;
      const zsetKey = `changes:${dbName}`;
      const pubChannel = `changes:${dbName}`;

      this.couchService.listenToChanges(dbName, async (change) => {
        const { id, doc, deleted } = change;
        const docKey = `db:${dbName}:doc:${id}`;

        if (deleted) {
          await this.redisService.jsonDel(docKey);
        } else {
          await this.redisService.jsonSet(docKey, doc);
          await this.searchSyncService.indexDocument({
            project_name: project._id,
            doc_id: id,
            content: doc,
          });
        }

        const payload = deleted
          ? { id, status: "deleted", BD: dbName, project: project._id }
          : { ...doc, id, BD: dbName, project: project._id };

        const now = Date.now();
        await this.redisService.zAdd(zsetKey, now, id);
        await this.redisService.zRemRangeByScore(zsetKey, 0, now - 300_000);
        await this.redisService.publish(pubChannel, JSON.stringify(payload));
      });

      this.processLogger.log(`👀 Escuchando feed continuo en ${dbName}`);
    }
  }

  private async escucharCambiosMapas(
    projects: ProjectDefinition[],
  ): Promise<void> {
    for (const project of projects) {
      const dbName = project.data_lake.map_database;
      const zsetKey = `changes:${dbName}`;
      const pubChannel = `changes:${dbName}`;

      this.couchService.listenToChanges(dbName, async (change) => {
        const { id, doc, deleted } = change;
        const docKey = `db:${dbName}:doc:${id}`;

        await this.updateMapsEntry(dbName, id);

        if (deleted) {
          await this.redisService.jsonDel(docKey);
        } else {
          await this.redisService.jsonSet(docKey, doc);
          await this.searchSyncService.indexDocument({
            project_name: project._id,
            doc_id: id,
            content: doc,
          });
        }

        const payload = deleted
          ? { id, status: "deleted", BD: dbName, project: project._id }
          : { ...doc, id, BD: dbName, project: project._id };

        const now = Date.now();
        await this.redisService.zAdd(zsetKey, now, id);
        await this.redisService.zRemRangeByScore(zsetKey, 0, now - 300_000);
        await this.redisService.publish(pubChannel, JSON.stringify(payload));
      });

      this.processLogger.log(`👀 Escuchando feed de mapas en ${dbName}`);
    }
  }

  private async precargarServicesPorProyecto(
    projects: ProjectDefinition[],
  ): Promise<void> {
    for (const project of projects) {
      const dbName = project.data_lake.service_database;
      const servicesKey = `services:${dbName}`;

      await this.redisService.del(servicesKey);
      const rows = await this.couchService.queryView(
        dbName,
        "services",
        "services_id",
        { reduce: false },
      );
      const ids = rows.map((r) => r.id);

      if (ids.length) {
        await this.redisService.sAdd(servicesKey, ...ids);
      }
      this.processLogger.log(
        `📦 Vista services precargada en ${dbName} (${ids.length} items)`,
      );
    }
  }

  private async precargarMapsPorProyecto(
    projects: ProjectDefinition[],
  ): Promise<void> {
    for (const project of projects) {
      const dbName = project.data_lake.map_database;
      const mapsKey = `maps:${dbName}`;

      await this.redisService.del(mapsKey);
      const rows = await this.couchService.queryView(
        dbName,
        this.designDoc,
        this.mapViewName,
        { reduce: false },
      );
      const ids = rows.map((r) => r.id);

      if (ids.length) {
        await this.redisService.sAdd(mapsKey, ...ids);
      }
      this.processLogger.log(
        `📦 Vista maps precargada en ${dbName} (${ids.length} items)`,
      );
    }
  }

  private async updateMapsEntry(dbName: string, id: string): Promise<void> {
    const mapsKey = `maps:${dbName}`;
    const rows = await this.couchService.queryView(
      dbName,
      this.designDoc,
      this.mapViewName,
      {
        key: id,
        include_docs: false,
      },
    );

    if (rows.length > 0) {
      await this.redisService.sAdd(mapsKey, id);
      this.changeLogger.log(`➕ Nodo añadido a vista mapa: ${id}`);
    } else {
      await this.redisService.sRem(mapsKey, id);
      this.changeLogger.log(`➖ Nodo retirado de vista mapa: ${id}`);
    }
  }
}
