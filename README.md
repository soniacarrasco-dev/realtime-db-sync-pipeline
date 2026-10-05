# Realtime Distributed Database Sync Pipeline 🚀

A high-throughput, event-driven synchronization daemon built with **NestJS**, **TypeScript**, and **Docker**.

The worker establishes continuous HTTP stream listeners over **CouchDB `_changes` feeds**, capturing mutations in real-time, executing transformation logic, and replicating state asynchronously into **Redis (RedisJSON)** for low-latency memory caching and **Elasticsearch** for full-text search and analytical querying.

---

## Architecture Overview

```text
               +-----------------------------+
               |      CouchDB Cluster        |
               |  (_changes continuous feed) |
               +--------------+--------------+
                              |
                              | HTTP Streaming Chunk Events
                              v
               +-----------------------------+
               |    NestJS Sync Pipeline     |
               |   (Event-Driven Daemon)     |
               +--------------+--------------+
                              |
             +----------------+----------------+
             |                                 |
             v                                 v
+------------------------+        +------------------------+
|      Redis Stack       |        |     Elasticsearch      |
|    (RedisJSON / KV)    |        |   (Telemetry Indices)  |
|  Low-latency State     |        |   Full-Text & Analytics|
+------------------------+        +------------------------+
```

### Key Technical Highlights

- **Reactive Streaming Ingestion:** Consumes continuous HTTP long-polling and chunked streams without polling overhead.
- **Resilient State Cache:** Stores dynamic JSON documents in memory utilizing Redis Stack (`JSON.SET`).
- **Distributed Search Indexing:** Translates operational mutations into structured search documents in Elasticsearch.
- **Failover & Isolation:** Decoupled services structured with NestJS modular architecture and dependency injection.
- **Zero-Config Synthetic Seeding:** Automated data generation script creating distributed databases, map/reduce design documents, and telemetry datasets.

---

## Tech Stack

- **Runtime & Language:** Node.js, TypeScript
- **Framework:** NestJS
- **Data Stores:** CouchDB 3.3, Redis Stack (RedisJSON), Elasticsearch 8.11
- **Orchestration:** Docker Compose
- **Tooling:** Axios, ts-node-dev, dotenv

---

## Project Structure

```text
realtime-db-sync-pipeline/
├── scripts/
│   └── seed.ts                  # Synthetic dataset & MapReduce view generator
├── src/
│   ├── config/
│   │   └── index.ts             # Centralized config & environment loader
│   ├── daemon/
│   │   └── sync/
│   │       ├── auth.service.ts  # Workspace authentication & isolation
│   │       ├── couch.service.ts # CouchDB continuous feed handler (_changes)
│   │       ├── redis.service.ts # Memory persistence with RedisJSON
│   │       ├── search-sync/     # Elasticsearch indexer service
│   │       └── sync.service.ts  # Event pipeline orchestrator
│   └── main.sync.ts             # Worker bootstrap entrypoint
├── docker-compose.yml           # Infrastructure orchestration (CouchDB, Redis, Elasticsearch)
├── tsconfig.json                # TypeScript compilation config
└── tsconfig.build.json          # Production build config
```

---

## Getting Started

### 1. Prerequisites

- [Docker Desktop](https://www.docker.com/) (with WSL 2 enabled on Windows)
- [Node.js](https://nodejs.org/) (v18+)
- npm

### 2. Environment Setup

Clone the repository and copy the environment template:

```bash
git clone https://github.com/<your-username>/realtime-db-sync-pipeline.git
cd realtime-db-sync-pipeline
cp .env.example .env
```

Install application dependencies:

```bash
npm install
```

### 3. Start Infrastructure

Launch CouchDB, Redis, and Elasticsearch containers:

```bash
docker compose up -d
```

Verify service availability:

- **CouchDB:** `http://localhost:5984`
- **Redis Server:** `localhost:6379` (RedisInsight GUI available at `http://localhost:8001`)
- **Elasticsearch:** `http://localhost:9200`

### 4. Seed Synthetic Data

Generate mock telemetry databases, spatial coordinates, and design views:

```bash
npm run seed
```

### 5. Run the Worker

#### Development Mode (with hot-reload):

```bash
npm run start:dev
```

#### Production Build:

```bash
npm run build
npm run start:prod
```

---

<details>
<summary>🇪🇸 <b>Documentación en Español</b></summary>

### Pipeline de Sincronización Reactiva de Bases de Datos en Tiempo Real

Worker asíncrono y desacoplado de alto rendimiento basado en eventos, construido con **NestJS**, **TypeScript** y **Docker**.

El servicio establece listeners sobre los feeds continuos `_changes` de **CouchDB** mediante streaming HTTP, detecta mutaciones en tiempo real y replica el estado de forma asíncrona hacia **Redis (RedisJSON)** para acceso en memoria de ultra baja latencia y hacia **Elasticsearch** para indexación y búsqueda avanzada.

#### Características Principales

- Ingesta reactiva en streaming sin consumo recurrente por sondeo (polling).
- Caché de estado estructurado en memoria con comandos nativos de RedisJSON.
- Indexación distribuida y balanceada en índices de Elasticsearch.
- Script de población sintética incluido para pruebas locales sin datos reales de producción.

#### Flujo Rápido de Ejecución

```bash
docker compose up -d
npm install
npm run seed
npm run start:dev
```

</details>

---

## License

MIT
