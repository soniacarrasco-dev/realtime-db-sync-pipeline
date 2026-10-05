// src/config/index.ts
import * as dotenv from "dotenv";
dotenv.config();

export const config = {
  couchDB: {
    host: process.env.COUCHDB_HOST || "http://127.0.0.1:5984",
    user: process.env.COUCHDB_USER || "admin",
    password: process.env.COUCHDB_PASSWORD || "adminpassword",
  },
  redisDB: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  },
  searchEngine: {
    url: process.env.SEARCH_ENGINE_URL || "http://127.0.0.1:9200",
    templateId: process.env.SEARCH_DEFAULT_TEMPLATE || "network_nodes",
    endpoints: {
      search: "/telemetry_index/_doc",
      setup: "/telemetry_index",
      init: "/",
    },
  },
};
