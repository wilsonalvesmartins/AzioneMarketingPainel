import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { hashPassword, isStrongPassword, normalizeEmail } from './security.js';

export class SqliteDatabase {
  constructor(filename) {
    this.filename = filename;
    this.connection = null;
  }

  async open() {
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    this.connection = await new Promise((resolve, reject) => {
      const connection = new sqlite3.Database(this.filename, (error) => {
        if (error) reject(error);
        else resolve(connection);
      });
    });
    await this.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    return this;
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.connection.run(sql, params, function onRun(error) {
        if (error) reject(error);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.connection.get(sql, params, (error, row) => {
        if (error) reject(error);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.connection.all(sql, params, (error, rows) => {
        if (error) reject(error);
        else resolve(rows);
      });
    });
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.connection.exec(sql, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async transaction(callback) {
    await this.exec('BEGIN IMMEDIATE');
    try {
      const result = await callback();
      await this.exec('COMMIT');
      return result;
    } catch (error) {
      await this.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    if (!this.connection) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.connection.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'gestor', 'atendimento', 'visualizador')),
  active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_date TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT,
  practice_area TEXT,
  viability TEXT,
  proposal_status TEXT,
  contract_status TEXT,
  objection TEXT,
  proposal_value_cents INTEGER,
  payment_terms TEXT,
  last_action TEXT,
  next_action TEXT,
  notes TEXT,
  responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'novo' CHECK (stage IN ('novo', 'triagem', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa', 'normal', 'alta', 'urgente')),
  follow_up_at TEXT,
  last_contact_at TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('nota', 'whatsapp', 'ligacao', 'email', 'reuniao', 'follow_up', 'status')),
  description TEXT NOT NULL,
  due_at TEXT,
  completed_at TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  sheet_name TEXT,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  warnings_json TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage, archived_at);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads(follow_up_at, archived_at);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_due ON activities(completed_at, due_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
`;

export async function initializeDatabase({ filename, adminName, adminEmail, adminPassword }) {
  const db = await new SqliteDatabase(filename).open();
  await db.exec(schema);
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('office_name', 'JMD Advocacia')");
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('office_subtitle', 'Gestão de leads jurídicos')");
  await db.run("DELETE FROM sessions WHERE expires_at <= datetime('now')");

  const count = await db.get('SELECT COUNT(*) AS count FROM users');
  if (Number(count?.count || 0) === 0) {
    const email = normalizeEmail(adminEmail);
    if (!email || !isStrongPassword(adminPassword)) {
      await db.close();
      throw new Error('Primeiro acesso: defina ADMIN_EMAIL e uma ADMIN_PASSWORD com pelo menos 12 caracteres, letras e números.');
    }
    await db.run(
      `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')`,
      [String(adminName || 'Administrador JMD').trim(), email, hashPassword(adminPassword)]
    );
  }
  return db;
}
