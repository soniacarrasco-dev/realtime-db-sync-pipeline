// scripts/seed.ts
import axios from "axios";

const COUCH_HOST = process.env.COUCHDB_HOST || "http://127.0.0.1:5984";
const AUTH = {
  username: process.env.COUCHDB_USER || "admin",
  password: process.env.COUCHDB_PASSWORD || "adminpassword",
};

const DATABASES = [
  "telemetry_services_madrid",
  "telemetry_maps_madrid",
  "telemetry_services_barcelona",
  "telemetry_maps_barcelona",
];

async function putDesignDoc(
  db: string,
  ddocId: string,
  views: Record<string, any>,
) {
  const url = `${COUCH_HOST}/${db}/${ddocId}`;
  let rev: string | undefined;

  try {
    const existing = await axios.get(url, { auth: AUTH });
    rev = existing.data._rev;
  } catch {}

  const body = {
    _id: ddocId,
    ...(rev ? { _rev: rev } : {}),
    views,
  };

  await axios.put(url, body, { auth: AUTH });
}

async function runSeed() {
  console.log("🌱 Inicializando bases de datos sintéticas en CouchDB...");

  for (const db of DATABASES) {
    // 1. Crear base de datos si no existe
    try {
      await axios.put(`${COUCH_HOST}/${db}`, {}, { auth: AUTH });
      console.log(`✅ Base de datos creada: ${db}`);
    } catch (err: any) {
      if (err.response?.status === 412) {
        console.log(`ℹ️ La base de datos ya existía: ${db}`);
      } else {
        console.error(`Error creando ${db}: ${err.message}`);
      }
    }

    // 2. Crear Design Document _design/views (requerido para mapas)
    await putDesignDoc(db, "_design/views", {
      maps: {
        map: "function (doc) { if (doc.coordinates) { emit(doc._id, doc.coordinates); } }",
      },
    });
    console.log(`📐 Vista _design/views (maps) configurada en ${db}`);

    // 3. Crear Design Document _design/services (requerido para servicios)
    await putDesignDoc(db, "_design/services", {
      services_id: {
        map: "function (doc) { if (doc._id) { emit(doc._id, doc.name || doc._id); } }",
      },
    });
    console.log(`📐 Vista _design/services (services_id) configurada en ${db}`);

    // 4. Insertar documentos simulados con coordenadas y telemetría
    const docs = Array.from({ length: 50 }, (_, i) => ({
      _id: `node_sensor_${i + 1}`,
      name: `Sensor Node #${i + 1}`,
      status: Math.random() > 0.1 ? "ONLINE" : "ALERT",
      coordinates: {
        lat: 40.4168 + (Math.random() - 0.5) * 0.1,
        lng: -3.7038 + (Math.random() - 0.5) * 0.1,
      },
      batteryLevel: Math.floor(Math.random() * 100),
      metrics: {
        cpuUsage: Math.floor(Math.random() * 80),
        temperature: 20 + Math.floor(Math.random() * 15),
      },
      updatedAt: new Date().toISOString(),
    }));

    await axios.post(
      `${COUCH_HOST}/${db}/_bulk_docs`,
      { docs },
      { auth: AUTH },
    );
    console.log(`🚀 Insertados 50 nodos simulados en ${db}`);
  }

  console.log("\n✨ Población de datos sintéticos completada con éxito.");
}

runSeed().catch(console.error);
