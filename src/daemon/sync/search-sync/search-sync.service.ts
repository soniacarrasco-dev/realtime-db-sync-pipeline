// src/daemon/sync/search-sync/search-sync.service.ts
import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import { config } from "../../../config";

export interface SearchIndexData {
  template_id?: string;
  project_name: string;
  doc_id?: string;
  content: Record<string, any>;
}

export interface SearchSyncResult {
  success: boolean;
  message: string;
  error?: string;
}

@Injectable()
export class SearchSyncService {
  private readonly logger = new Logger(SearchSyncService.name);
  private readonly searchEngineUrl = config.searchEngine.url;
  private readonly endpoints = config.searchEngine.endpoints;
  private readonly defaultTemplate = config.searchEngine.templateId;

  constructor() {
    this.logger.log(
      `🔍 SearchSyncService inicializado en: ${this.searchEngineUrl}`,
    );
  }

  async indexDocument(data: SearchIndexData): Promise<SearchSyncResult> {
    try {
      const template = data.template_id || this.defaultTemplate;
      if (!data.project_name) {
        throw new Error("project_name es obligatorio");
      }

      const url = data.doc_id
        ? `${this.searchEngineUrl}/telemetry_index/_doc/${encodeURIComponent(data.doc_id)}`
        : `${this.searchEngineUrl}${this.endpoints.search}`;

      const payload = {
        template_id: template,
        project_name: data.project_name,
        doc_id: data.doc_id || null,
        content: data.content,
        timestamp: new Date().toISOString(),
      };

      await axios.post(url, payload, {
        timeout: 10000,
        headers: { "Content-Type": "application/json" },
      });

      this.logger.log(
        `✅ Documento indexado en Elasticsearch: ${template}/${data.project_name}`,
      );

      return { success: true, message: "Documento indexado con éxito" };
    } catch (error) {
      const errorMsg = this.extractErrorMessage(error);
      this.logger.error(`❌ Error indexando documento: ${errorMsg}`);
      return {
        success: false,
        message: "Error al indexar documento",
        error: errorMsg,
      };
    }
  }

  async indexDocumentsBatch(
    dataList: SearchIndexData[],
  ): Promise<SearchSyncResult> {
    if (!dataList || dataList.length === 0) {
      return { success: true, message: "Lote vacío" };
    }

    const results = await Promise.allSettled(
      dataList.map((item) => this.indexDocument(item)),
    );
    const successCount = results.filter(
      (r) => r.status === "fulfilled" && (r.value as SearchSyncResult).success,
    ).length;

    return {
      success: successCount === dataList.length,
      message: `${successCount}/${dataList.length} documentos indexados correctamente`,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.searchEngineUrl}${this.endpoints.init}`;
      await axios.get(url, { timeout: 5000 });
      this.logger.log("✅ Conexión con motor de búsqueda validada");
      return true;
    } catch (error) {
      this.logger.warn(
        `⚠️️ Motor de búsqueda inaccesible: ${this.extractErrorMessage(error)}`,
      );
      return false;
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return error.response?.data?.message || error.message;
    }
    return error instanceof Error ? error.message : "Error desconocido";
  }
}
