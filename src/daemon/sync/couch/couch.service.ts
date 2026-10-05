// src/daemon/sync/couch/couch.service.ts
import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import { Readable } from "stream";
import { config } from "../../../config";

@Injectable()
export class CouchService {
  private readonly logger = new Logger(CouchService.name);
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.couchDB.host,
      auth: {
        username: config.couchDB.user,
        password: config.couchDB.password,
      },
    });
  }

  async getAllDatabases(): Promise<string[]> {
    const res = await this.client.get<string[]>("/_all_dbs");
    return res.data.filter((db) => !db.startsWith("_"));
  }

  async getAllDocsFromDb(dbName: string): Promise<any[]> {
    const res = await this.client.get(
      `/${encodeURIComponent(dbName)}/_all_docs`,
      {
        params: { include_docs: true },
      },
    );
    return res.data.rows.map((row: any) => row.doc);
  }

  async listenToChanges(
    dbName: string,
    onChange: (change: {
      id: string;
      doc?: any;
      deleted?: boolean;
    }) => Promise<void>,
  ): Promise<void> {
    try {
      const res = await this.client.get<Readable>(
        `/${encodeURIComponent(dbName)}/_changes`,
        {
          params: {
            feed: "continuous",
            since: "now",
            include_docs: true,
            heartbeat: 30000,
          },
          responseType: "stream",
          timeout: 0,
        },
      );

      const stream = res.data;
      let buffer = "";

      stream.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const change = JSON.parse(line);
            onChange({
              id: change.id,
              doc: change.doc,
              deleted: change.deleted,
            }).catch((err) =>
              this.logger.error(`Error en callback de ${dbName}:`, err),
            );
          } catch {
            this.logger.warn(
              `No se pudo parsear el cambio en ${dbName}: ${line}`,
            );
          }
        }
      });

      stream.on("end", () =>
        this.logger.log(`Stream de cambios finalizado para ${dbName}`),
      );
      stream.on("error", (err) =>
        this.logger.error(`Error en el stream de ${dbName}:`, err),
      );
    } catch (err) {
      this.logger.error(
        `No fue posible conectar al feed de cambios en ${dbName}:`,
        err,
      );
    }
  }

  async queryView(
    db: string,
    design: string,
    view: string,
    params: Record<string, any> = {},
  ): Promise<any[]> {
    const url = `/${encodeURIComponent(db)}/_design/${encodeURIComponent(design)}/_view/${encodeURIComponent(view)}`;
    const serialized: Record<string, any> = {};
    for (const [k, v] of Object.entries(params)) {
      serialized[k] = ["key", "startkey", "endkey", "keys"].includes(k)
        ? JSON.stringify(v)
        : v;
    }

    try {
      const resp = await this.client.get<{ rows: any[] }>(url, {
        params: serialized,
      });
      return resp.data.rows;
    } catch (err) {
      this.logger.error(
        `Error en queryView ${design}/${view} sobre ${db}:`,
        err,
      );
      return [];
    }
  }
}
