// src/daemon/sync/auth.service.ts
import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import * as http from "http";
import { config } from "../../config";

export interface ProjectDefinition {
  _id: string;
  name: string;
  data_lake: {
    service_database: string;
    map_database: string;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Proyectos por defecto para desarrollo/portfolio si no hay servicio de auth externo
  private readonly defaultProjects: ProjectDefinition[] = [
    {
      _id: "iot_network_madrid",
      name: "Smart Grid Madrid",
      data_lake: {
        service_database: "telemetry_services_madrid",
        map_database: "telemetry_maps_madrid",
      },
    },
    {
      _id: "iot_network_barcelona",
      name: "Smart Grid Barcelona",
      data_lake: {
        service_database: "telemetry_services_barcelona",
        map_database: "telemetry_maps_barcelona",
      },
    },
  ];

  async findAllProjects(): Promise<ProjectDefinition[]> {
    const authUrl = process.env.AUTH_SERVICE_URL;

    // Si no hay URL configurada, opera con los proyectos mock del portfolio
    if (!authUrl) {
      this.logger.log(
        "ℹ️ Operando con proyectos simulados en memoria para el entorno local",
      );
      return this.defaultProjects;
    }

    try {
      const url = `${authUrl.replace(/\/$/, "")}/proyectos`;
      const res = await axios.get<ProjectDefinition[]>(url, {
        timeout: 5000,
        httpAgent: new http.Agent({ family: 4 }),
      });
      return res.data;
    } catch (err: any) {
      this.logger.warn(
        `⚠️ Falló la conexión con ${authUrl}, usando configuración fallback local: ${err.message}`,
      );
      return this.defaultProjects;
    }
  }
}
