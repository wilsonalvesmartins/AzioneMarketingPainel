import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp, importLeadRecords } from './server/app.js';
import { initializeDatabase } from './server/database.js';
import { parseLeadWorkbook } from './server/xlsx.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const databaseFile = process.env.DATABASE_FILE ? path.resolve(process.env.DATABASE_FILE) : path.join(dataDir, 'jmd-leads.sqlite');

const db = await initializeDatabase({
  filename: databaseFile,
  adminName: process.env.ADMIN_NAME || 'Administrador JMD',
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD
});

async function importInitialWorkbook() {
  const importPath = process.env.IMPORT_XLSX_PATH ? path.resolve(process.env.IMPORT_XLSX_PATH) : null;
  if (!importPath || !fs.existsSync(importPath)) return;
  const count = await db.get('SELECT COUNT(*) AS count FROM leads WHERE archived_at IS NULL');
  if (Number(count?.count || 0) > 0) return;
  const admin = await db.get("SELECT id FROM users WHERE role = 'admin' AND active = 1 ORDER BY id LIMIT 1");
  const parsed = parseLeadWorkbook(fs.readFileSync(importPath));
  const result = await importLeadRecords(db, {
    ...parsed,
    fileName: path.basename(importPath),
    userId: admin?.id || null
  });
  console.log(`Importação inicial concluída: ${result.imported} leads, ${result.skipped} duplicados, ${result.warnings.length} alertas.`);
}

await importInitialWorkbook();

const production = process.env.NODE_ENV === 'production';
const cookieSecure = process.env.COOKIE_SECURE == null ? production : process.env.COOKIE_SECURE !== 'false';
const app = createApp({
  db,
  distDir: path.join(__dirname, 'dist'),
  production,
  cookieSecure,
  trustProxy: process.env.TRUST_PROXY !== 'false'
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`JMD Leads disponível na porta ${PORT}. Banco: ${databaseFile}`);
});

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal} recebido. Encerrando com segurança...`);
  const forceTimer = setTimeout(() => process.exit(1), 10000);
  forceTimer.unref();
  server.close(async () => {
    try {
      await db.close();
      clearTimeout(forceTimer);
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
