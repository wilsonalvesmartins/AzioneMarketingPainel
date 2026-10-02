import express from 'express';
import path from 'path';
import fs from 'fs';
import {
  hashPassword,
  isStrongPassword,
  maskPhone,
  normalizeEmail,
  normalizePhone,
  nullableText,
  parseCookies,
  randomToken,
  safeText,
  tokenDigest,
  verifyPassword
} from './security.js';
import { parseLeadWorkbook } from './xlsx.js';

const SESSION_COOKIE = 'jmd_session';
const SESSION_DAYS = 7;
const EDIT_ROLES = new Set(['admin', 'gestor', 'atendimento']);
const ROLES = new Set(['admin', 'gestor', 'atendimento', 'visualizador']);
const STAGES = new Set(['novo', 'triagem', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido']);
const PRIORITIES = new Set(['baixa', 'normal', 'alta', 'urgente']);
const ACTIVITY_TYPES = new Set(['nota', 'whatsapp', 'ligacao', 'email', 'reuniao', 'follow_up', 'status']);

const LEAD_SELECT = `
  SELECT l.*, u.name AS responsible_name
  FROM leads l
  LEFT JOIN users u ON u.id = l.responsible_user_id
`;

function asIsoDate(value, fallback = null) {
  const text = safeText(value, 30);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return fallback;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? fallback : text;
}

function asIsoDateTime(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function asId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function leadFromRow(row, includePrivate = true) {
  if (!row) return null;
  const lead = {
    id: row.id,
    contactDate: row.contact_date,
    name: row.name,
    phone: row.phone || '',
    email: row.email || '',
    source: row.source || '',
    practiceArea: row.practice_area || '',
    viability: row.viability || '',
    proposalStatus: row.proposal_status || '',
    contractStatus: row.contract_status || '',
    objection: row.objection || '',
    proposalValueCents: row.proposal_value_cents,
    paymentTerms: row.payment_terms || '',
    lastAction: row.last_action || '',
    nextAction: row.next_action || '',
    notes: row.notes || '',
    responsibleUserId: row.responsible_user_id,
    responsibleName: row.responsible_name || '',
    stage: row.stage,
    priority: row.priority,
    followUpAt: row.follow_up_at,
    lastContactAt: row.last_contact_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  if (!includePrivate) {
    lead.phone = maskPhone(lead.phone);
    lead.email = lead.email ? lead.email.replace(/^(.{1,2}).*(@.*)$/, '$1***$2') : '';
  }
  return lead;
}

function userFromRow(row) {
  return row ? {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: Boolean(row.active),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at
  } : null;
}

function activityFromRow(row) {
  return {
    id: row.id,
    leadId: row.lead_id,
    type: row.type,
    description: row.description,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    createdByName: row.created_by_name || ''
  };
}

function csvCell(value) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

function roleCanEdit(role) {
  return EDIT_ROLES.has(role);
}

async function audit(db, userId, action, entityType, entityId, details = null) {
  await db.run(
    'INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?)',
    [userId || null, action, entityType, entityId == null ? null : String(entityId), details ? JSON.stringify(details) : null]
  );
}

function stageForImportedLead(lead) {
  if (STAGES.has(lead.stage)) return lead.stage;
  return 'novo';
}

export async function importLeadRecords(db, { leads, warnings = [], sheetName, fileName, userId }) {
  let imported = 0;
  let skipped = 0;
  await db.transaction(async () => {
    for (const lead of leads) {
      const phone = normalizePhone(lead.phone);
      const duplicate = await db.get(
        `SELECT id FROM leads
         WHERE archived_at IS NULL AND contact_date = ? AND lower(trim(name)) = lower(trim(?))
           AND ((? <> '' AND phone = ?) OR (? = '' AND COALESCE(phone, '') = ''))
         LIMIT 1`,
        [lead.contactDate, lead.name, phone, phone, phone]
      );
      if (duplicate) {
        skipped += 1;
        continue;
      }
      const result = await db.run(
        `INSERT INTO leads (
          contact_date, name, phone, source, practice_area, viability, proposal_status,
          contract_status, objection, proposal_value_cents, payment_terms, last_action,
          next_action, notes, stage, priority, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          lead.contactDate,
          safeText(lead.name, 180),
          phone,
          nullableText(lead.source, 100),
          nullableText(lead.practiceArea, 140),
          nullableText(lead.viability, 160),
          nullableText(lead.proposalStatus, 160),
          nullableText(lead.contractStatus, 160),
          nullableText(lead.objection, 1000),
          Number.isInteger(lead.proposalValueCents) ? lead.proposalValueCents : null,
          nullableText(lead.paymentTerms, 500),
          nullableText(lead.lastAction, 1000),
          nullableText(lead.nextAction, 1000),
          nullableText(lead.notes, 4000),
          stageForImportedLead(lead),
          PRIORITIES.has(lead.priority) ? lead.priority : 'normal',
          userId || null,
          userId || null
        ]
      );
      await db.run(
        `INSERT INTO activities (lead_id, type, description, completed_at, created_by)
         VALUES (?, 'status', ?, datetime('now'), ?)`,
        [result.lastID, `Lead importado da aba ${sheetName || 'principal'}.`, userId || null]
      );
      imported += 1;
    }
    await db.run(
      `INSERT INTO imports (file_name, sheet_name, imported_count, skipped_count, warnings_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [safeText(fileName, 255) || 'planilha.xlsx', sheetName || null, imported, skipped, JSON.stringify(warnings.slice(0, 100)), userId || null]
    );
  });
  await audit(db, userId, 'import', 'lead', null, { imported, skipped, sheetName, warnings: warnings.length });
  return { imported, skipped, warnings };
}

export function createApp({ db, distDir, production = false, cookieSecure = production, trustProxy = true }) {
  const app = express();
  if (trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
    if (production && cookieSecure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use('/api/import/xlsx', express.raw({
    type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
    limit: '15mb'
  }));
  app.use(express.json({ limit: '1mb' }));

  app.use(async (req, _res, next) => {
    try {
      req.currentUser = null;
      req.currentSession = null;
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      if (!token) return next();
      const session = await db.get(
        `SELECT s.token_hash, s.csrf_token, s.expires_at, u.*
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND u.active = 1`,
        [tokenDigest(token)]
      );
      if (session) {
        req.currentUser = userFromRow(session);
        req.currentSession = { tokenHash: session.token_hash, csrfToken: session.csrf_token, expiresAt: session.expires_at };
        db.run('UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?', [session.token_hash]).catch(() => {});
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  const requireAuth = (req, res, next) => {
    if (!req.currentUser) return res.status(401).json({ message: 'Sessão expirada. Entre novamente.' });
    next();
  };
  const requireEdit = (req, res, next) => {
    if (!req.currentUser) return res.status(401).json({ message: 'Sessão expirada. Entre novamente.' });
    if (!roleCanEdit(req.currentUser.role)) return res.status(403).json({ message: 'Seu perfil possui acesso somente para consulta.' });
    next();
  };
  const requireAdmin = (req, res, next) => {
    if (!req.currentUser) return res.status(401).json({ message: 'Sessão expirada. Entre novamente.' });
    if (req.currentUser.role !== 'admin') return res.status(403).json({ message: 'Apenas administradores podem realizar esta ação.' });
    next();
  };

  app.use('/api', (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (req.path === '/auth/login') return next();
    if (!req.currentSession || req.headers['x-csrf-token'] !== req.currentSession.csrfToken) {
      return res.status(403).json({ message: 'A verificação de segurança expirou. Atualize a página e tente novamente.' });
    }
    next();
  });

  const loginAttempts = new Map();
  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const address = req.ip || req.socket.remoteAddress || 'unknown';
      const attempt = loginAttempts.get(address) || { count: 0, since: Date.now() };
      if (Date.now() - attempt.since > 15 * 60 * 1000) {
        attempt.count = 0;
        attempt.since = Date.now();
      }
      if (attempt.count >= 10) return res.status(429).json({ message: 'Muitas tentativas. Aguarde alguns minutos.' });
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || '');
      const user = await db.get('SELECT * FROM users WHERE email = ? AND active = 1', [email]);
      if (!user || !verifyPassword(password, user.password_hash)) {
        attempt.count += 1;
        loginAttempts.set(address, attempt);
        return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
      }
      loginAttempts.delete(address);
      const token = randomToken();
      const csrfToken = randomToken(24);
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
      await db.run(
        'INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)',
        [tokenDigest(token), user.id, csrfToken, expiresAt]
      );
      await db.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      await audit(db, user.id, 'login', 'session', null);
      res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: Boolean(cookieSecure),
        maxAge: SESSION_DAYS * 86400000,
        path: '/'
      });
      const settings = await db.all('SELECT key, value FROM settings');
      res.json({ user: userFromRow(user), csrfToken, settings: Object.fromEntries(settings.map((item) => [item.key, item.value])) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/me', requireAuth, async (req, res, next) => {
    try {
      const settings = await db.all('SELECT key, value FROM settings');
      res.json({
        user: req.currentUser,
        csrfToken: req.currentSession.csrfToken,
        settings: Object.fromEntries(settings.map((item) => [item.key, item.value]))
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout', requireAuth, async (req, res, next) => {
    try {
      await db.run('DELETE FROM sessions WHERE token_hash = ?', [req.currentSession.tokenHash]);
      res.clearCookie(SESSION_COOKIE, { path: '/', sameSite: 'lax', secure: Boolean(cookieSecure) });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/change-password', requireAuth, async (req, res, next) => {
    try {
      const currentPassword = String(req.body?.currentPassword || '');
      const newPassword = String(req.body?.newPassword || '');
      const user = await db.get('SELECT * FROM users WHERE id = ?', [req.currentUser.id]);
      if (!verifyPassword(currentPassword, user.password_hash)) return res.status(400).json({ message: 'Senha atual incorreta.' });
      if (!isStrongPassword(newPassword)) return res.status(400).json({ message: 'Use pelo menos 12 caracteres, com letras e números.' });
      await db.transaction(async () => {
        await db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashPassword(newPassword), user.id]);
        await db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [user.id, req.currentSession.tokenHash]);
      });
      await audit(db, user.id, 'change_password', 'user', user.id);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/health', async (_req, res) => {
    try {
      await db.get('SELECT 1 AS ok');
      res.json({ ok: true, service: 'jmd-leads' });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  app.get('/api/team', requireAuth, async (_req, res, next) => {
    try {
      const users = await db.all('SELECT id, name, email, role, active, last_login_at, created_at FROM users WHERE active = 1 ORDER BY name');
      res.json(users.map(userFromRow));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/dashboard', requireAuth, async (req, res, next) => {
    try {
      const [summary, stageCounts, sourceCounts, monthly, recent, upcoming] = await Promise.all([
        db.get(`SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN contact_date >= date('now', 'start of month') THEN 1 ELSE 0 END) AS month_new,
          SUM(CASE WHEN stage = 'ganho' THEN 1 ELSE 0 END) AS won,
          SUM(CASE WHEN stage = 'perdido' THEN 1 ELSE 0 END) AS lost,
          SUM(CASE WHEN stage IN ('proposta', 'negociacao') THEN 1 ELSE 0 END) AS opportunities,
          SUM(CASE WHEN follow_up_at IS NOT NULL AND datetime(follow_up_at) < datetime('now') THEN 1 ELSE 0 END) AS overdue
          FROM leads WHERE archived_at IS NULL`),
        db.all('SELECT stage, COUNT(*) AS count FROM leads WHERE archived_at IS NULL GROUP BY stage'),
        db.all("SELECT COALESCE(NULLIF(trim(source), ''), 'Não informado') AS source, COUNT(*) AS count FROM leads WHERE archived_at IS NULL GROUP BY source ORDER BY count DESC"),
        db.all(`SELECT substr(contact_date, 1, 7) AS month,
          COUNT(*) AS leads,
          SUM(CASE WHEN stage = 'ganho' THEN 1 ELSE 0 END) AS won
          FROM leads WHERE archived_at IS NULL AND contact_date >= date('now', '-11 months', 'start of month')
          GROUP BY month ORDER BY month`),
        db.all(`${LEAD_SELECT} WHERE l.archived_at IS NULL ORDER BY l.created_at DESC, l.id DESC LIMIT 6`),
        db.all(`SELECT a.*, l.name AS lead_name, l.phone, u.name AS created_by_name
          FROM activities a JOIN leads l ON l.id = a.lead_id
          LEFT JOIN users u ON u.id = a.created_by
          WHERE a.type = 'follow_up' AND a.completed_at IS NULL AND l.archived_at IS NULL
          ORDER BY datetime(a.due_at) ASC LIMIT 8`)
      ]);
      const decided = Number(summary.won || 0) + Number(summary.lost || 0);
      res.json({
        summary: {
          total: Number(summary.total || 0),
          monthNew: Number(summary.month_new || 0),
          won: Number(summary.won || 0),
          lost: Number(summary.lost || 0),
          opportunities: Number(summary.opportunities || 0),
          overdue: Number(summary.overdue || 0),
          conversionRate: decided ? Math.round((Number(summary.won || 0) / decided) * 1000) / 10 : 0
        },
        stageCounts: stageCounts.map((item) => ({ stage: item.stage, count: Number(item.count) })),
        sourceCounts: sourceCounts.map((item) => ({ source: item.source, count: Number(item.count) })),
        monthly: monthly.map((item) => ({ month: item.month, leads: Number(item.leads), won: Number(item.won) })),
        recent: recent.map((item) => leadFromRow(item, req.currentUser.role !== 'visualizador')),
        upcoming: upcoming.map((item) => ({ ...activityFromRow(item), leadName: item.lead_name, phone: item.phone || '' }))
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/leads', requireAuth, async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(500, Math.max(10, Number(req.query.limit) || 50));
      const filters = ['l.archived_at IS NULL'];
      const params = [];
      if (req.query.search) {
        filters.push(`(lower(l.name) LIKE ? OR l.phone LIKE ? OR lower(COALESCE(l.email, '')) LIKE ? OR lower(COALESCE(l.practice_area, '')) LIKE ?)`);
        const search = `%${safeText(req.query.search, 100).toLowerCase()}%`;
        params.push(search, `%${normalizePhone(req.query.search)}%`, search, search);
      }
      if (req.query.stage && STAGES.has(req.query.stage)) {
        filters.push('l.stage = ?');
        params.push(req.query.stage);
      }
      if (req.query.source) {
        filters.push('l.source = ?');
        params.push(safeText(req.query.source, 100));
      }
      if (req.query.responsible === 'unassigned') filters.push('l.responsible_user_id IS NULL');
      else if (asId(req.query.responsible)) {
        filters.push('l.responsible_user_id = ?');
        params.push(asId(req.query.responsible));
      }
      if (req.query.followup === 'overdue') filters.push("l.follow_up_at IS NOT NULL AND datetime(l.follow_up_at) < datetime('now')");
      if (req.query.followup === 'today') filters.push("date(l.follow_up_at, 'localtime') = date('now', 'localtime')");
      const where = `WHERE ${filters.join(' AND ')}`;
      const count = await db.get(`SELECT COUNT(*) AS count FROM leads l ${where}`, params);
      const items = await db.all(
        `${LEAD_SELECT} ${where} ORDER BY
          CASE l.priority WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
          CASE WHEN l.follow_up_at IS NULL THEN 1 ELSE 0 END,
          datetime(l.follow_up_at) ASC,
          l.contact_date DESC, l.id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, (page - 1) * limit]
      );
      res.json({
        items: items.map((item) => leadFromRow(item, req.currentUser.role !== 'visualizador')),
        total: Number(count.count || 0),
        page,
        pages: Math.max(1, Math.ceil(Number(count.count || 0) / limit))
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/leads/:id', requireAuth, async (req, res, next) => {
    try {
      const id = asId(req.params.id);
      const row = id ? await db.get(`${LEAD_SELECT} WHERE l.id = ? AND l.archived_at IS NULL`, [id]) : null;
      if (!row) return res.status(404).json({ message: 'Lead não encontrado.' });
      const activities = await db.all(
        `SELECT a.*, u.name AS created_by_name FROM activities a
         LEFT JOIN users u ON u.id = a.created_by
         WHERE a.lead_id = ? ORDER BY a.created_at DESC, a.id DESC`,
        [id]
      );
      res.json({ lead: leadFromRow(row, req.currentUser.role !== 'visualizador'), activities: activities.map(activityFromRow) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/leads', requireEdit, async (req, res, next) => {
    try {
      const body = req.body || {};
      const name = safeText(body.name, 180);
      const contactDate = asIsoDate(body.contactDate, new Date().toISOString().slice(0, 10));
      const stage = STAGES.has(body.stage) ? body.stage : 'novo';
      const priority = PRIORITIES.has(body.priority) ? body.priority : 'normal';
      if (!name) return res.status(400).json({ message: 'Informe o nome do lead.' });
      const responsibleUserId = asId(body.responsibleUserId);
      if (responsibleUserId && !(await db.get('SELECT id FROM users WHERE id = ? AND active = 1', [responsibleUserId]))) {
        return res.status(400).json({ message: 'Responsável inválido.' });
      }
      const followUpAt = asIsoDateTime(body.followUpAt);
      const result = await db.run(
        `INSERT INTO leads (
          contact_date, name, phone, email, source, practice_area, viability, proposal_status,
          contract_status, objection, proposal_value_cents, payment_terms, last_action, next_action,
          notes, responsible_user_id, stage, priority, follow_up_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          contactDate, name, normalizePhone(body.phone), nullableText(normalizeEmail(body.email), 180),
          nullableText(body.source, 100), nullableText(body.practiceArea, 140), nullableText(body.viability, 160),
          nullableText(body.proposalStatus, 160), nullableText(body.contractStatus, 160), nullableText(body.objection, 1000),
          Number.isInteger(Number(body.proposalValueCents)) ? Number(body.proposalValueCents) : null,
          nullableText(body.paymentTerms, 500), nullableText(body.lastAction, 1000), nullableText(body.nextAction, 1000),
          nullableText(body.notes, 4000), responsibleUserId, stage, priority, followUpAt, req.currentUser.id, req.currentUser.id
        ]
      );
      await db.run(
        `INSERT INTO activities (lead_id, type, description, completed_at, created_by)
         VALUES (?, 'status', 'Lead cadastrado.', datetime('now'), ?)`,
        [result.lastID, req.currentUser.id]
      );
      if (followUpAt) {
        await db.run(
          `INSERT INTO activities (lead_id, type, description, due_at, created_by) VALUES (?, 'follow_up', ?, ?, ?)`,
          [result.lastID, nullableText(body.nextAction, 1000) || 'Realizar follow-up', followUpAt, req.currentUser.id]
        );
      }
      await audit(db, req.currentUser.id, 'create', 'lead', result.lastID, { name, stage });
      const created = await db.get(`${LEAD_SELECT} WHERE l.id = ?`, [result.lastID]);
      res.status(201).json({ lead: leadFromRow(created) });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/leads/:id', requireEdit, async (req, res, next) => {
    try {
      const id = asId(req.params.id);
      const current = id ? await db.get('SELECT * FROM leads WHERE id = ? AND archived_at IS NULL', [id]) : null;
      if (!current) return res.status(404).json({ message: 'Lead não encontrado.' });
      const body = req.body || {};
      const mapping = {
        contactDate: ['contact_date', (value) => asIsoDate(value)],
        name: ['name', (value) => safeText(value, 180)],
        phone: ['phone', normalizePhone],
        email: ['email', (value) => nullableText(normalizeEmail(value), 180)],
        source: ['source', (value) => nullableText(value, 100)],
        practiceArea: ['practice_area', (value) => nullableText(value, 140)],
        viability: ['viability', (value) => nullableText(value, 160)],
        proposalStatus: ['proposal_status', (value) => nullableText(value, 160)],
        contractStatus: ['contract_status', (value) => nullableText(value, 160)],
        objection: ['objection', (value) => nullableText(value, 1000)],
        proposalValueCents: ['proposal_value_cents', (value) => Number.isInteger(Number(value)) ? Number(value) : null],
        paymentTerms: ['payment_terms', (value) => nullableText(value, 500)],
        lastAction: ['last_action', (value) => nullableText(value, 1000)],
        nextAction: ['next_action', (value) => nullableText(value, 1000)],
        notes: ['notes', (value) => nullableText(value, 4000)],
        responsibleUserId: ['responsible_user_id', asId],
        stage: ['stage', (value) => STAGES.has(value) ? value : null],
        priority: ['priority', (value) => PRIORITIES.has(value) ? value : null],
        followUpAt: ['follow_up_at', (value) => asIsoDateTime(value)]
      };
      const updates = [];
      const params = [];
      for (const [key, [column, transform]] of Object.entries(mapping)) {
        if (!(key in body)) continue;
        const value = transform(body[key]);
        if ((key === 'name' || key === 'contactDate' || key === 'stage' || key === 'priority') && !value) {
          return res.status(400).json({ message: `Valor inválido para ${key}.` });
        }
        updates.push(`${column} = ?`);
        params.push(value);
      }
      if (!updates.length) return res.status(400).json({ message: 'Nenhuma alteração válida foi enviada.' });
      updates.push('updated_by = ?', 'updated_at = CURRENT_TIMESTAMP');
      params.push(req.currentUser.id, id);
      await db.run(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`, params);
      if (body.stage && body.stage !== current.stage) {
        await db.run(
          `INSERT INTO activities (lead_id, type, description, completed_at, created_by) VALUES (?, 'status', ?, datetime('now'), ?)`,
          [id, `Etapa alterada de ${current.stage} para ${body.stage}.`, req.currentUser.id]
        );
      }
      if ('followUpAt' in body) {
        const nextDueAt = asIsoDateTime(body.followUpAt);
        const currentDueAt = current.follow_up_at ? asIsoDateTime(current.follow_up_at) : null;
        if (nextDueAt !== currentDueAt) {
          const pending = await db.get(
            `SELECT id FROM activities WHERE lead_id = ? AND type = 'follow_up' AND completed_at IS NULL
             ORDER BY datetime(due_at) ASC LIMIT 1`,
            [id]
          );
          if (nextDueAt && pending) {
            await db.run(
              'UPDATE activities SET due_at = ?, description = ? WHERE id = ?',
              [nextDueAt, nullableText(body.nextAction, 1000) || current.next_action || 'Realizar follow-up', pending.id]
            );
          } else if (nextDueAt) {
            await db.run(
              `INSERT INTO activities (lead_id, type, description, due_at, created_by) VALUES (?, 'follow_up', ?, ?, ?)`,
              [id, nullableText(body.nextAction, 1000) || current.next_action || 'Realizar follow-up', nextDueAt, req.currentUser.id]
            );
          } else if (pending) {
            await db.run("UPDATE activities SET completed_at = datetime('now') WHERE id = ?", [pending.id]);
          }
        }
      }
      await audit(db, req.currentUser.id, 'update', 'lead', id, { fields: Object.keys(body) });
      const updated = await db.get(`${LEAD_SELECT} WHERE l.id = ?`, [id]);
      res.json({ lead: leadFromRow(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/leads/:id', requireAdmin, async (req, res, next) => {
    try {
      const id = asId(req.params.id);
      const result = id ? await db.run(
        'UPDATE leads SET archived_at = CURRENT_TIMESTAMP, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND archived_at IS NULL',
        [req.currentUser.id, id]
      ) : { changes: 0 };
      if (!result.changes) return res.status(404).json({ message: 'Lead não encontrado.' });
      await audit(db, req.currentUser.id, 'archive', 'lead', id);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/leads/:id/activities', requireEdit, async (req, res, next) => {
    try {
      const leadId = asId(req.params.id);
      if (!leadId || !(await db.get('SELECT id FROM leads WHERE id = ? AND archived_at IS NULL', [leadId]))) {
        return res.status(404).json({ message: 'Lead não encontrado.' });
      }
      const type = ACTIVITY_TYPES.has(req.body?.type) ? req.body.type : 'nota';
      const description = safeText(req.body?.description, 1000);
      const dueAt = asIsoDateTime(req.body?.dueAt);
      const completedAt = req.body?.completed ? new Date().toISOString() : null;
      if (!description) return res.status(400).json({ message: 'Descreva a atividade.' });
      if (type === 'follow_up' && !dueAt) return res.status(400).json({ message: 'Informe a data do follow-up.' });
      const result = await db.run(
        `INSERT INTO activities (lead_id, type, description, due_at, completed_at, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [leadId, type, description, dueAt, completedAt, req.currentUser.id]
      );
      if (type === 'follow_up' && !completedAt) {
        await db.run(
          `UPDATE leads SET follow_up_at = ?, next_action = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [dueAt, description, req.currentUser.id, leadId]
        );
      } else if (completedAt && ['whatsapp', 'ligacao', 'email', 'reuniao'].includes(type)) {
        await db.run(
          `UPDATE leads SET last_action = ?, last_contact_at = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [description, completedAt, req.currentUser.id, leadId]
        );
      }
      await audit(db, req.currentUser.id, 'create', 'activity', result.lastID, { leadId, type });
      const activity = await db.get(
        `SELECT a.*, u.name AS created_by_name FROM activities a LEFT JOIN users u ON u.id = a.created_by WHERE a.id = ?`,
        [result.lastID]
      );
      res.status(201).json({ activity: activityFromRow(activity) });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/activities/:id/complete', requireEdit, async (req, res, next) => {
    try {
      const id = asId(req.params.id);
      const activity = id ? await db.get('SELECT * FROM activities WHERE id = ?', [id]) : null;
      if (!activity) return res.status(404).json({ message: 'Atividade não encontrada.' });
      await db.transaction(async () => {
        await db.run("UPDATE activities SET completed_at = COALESCE(completed_at, datetime('now')) WHERE id = ?", [id]);
        const nextFollowUp = await db.get(
          `SELECT due_at, description FROM activities
           WHERE lead_id = ? AND type = 'follow_up' AND completed_at IS NULL
           ORDER BY datetime(due_at) ASC LIMIT 1`,
          [activity.lead_id]
        );
        await db.run(
          `UPDATE leads SET follow_up_at = ?, next_action = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [nextFollowUp?.due_at || null, nextFollowUp?.description || null, req.currentUser.id, activity.lead_id]
        );
      });
      await audit(db, req.currentUser.id, 'complete', 'activity', id, { leadId: activity.lead_id });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/followups', requireAuth, async (req, res, next) => {
    try {
      const scope = ['overdue', 'today', 'upcoming', 'all'].includes(req.query.scope) ? req.query.scope : 'all';
      const filters = ["a.type = 'follow_up'", 'a.completed_at IS NULL', 'l.archived_at IS NULL'];
      if (scope === 'overdue') filters.push("datetime(a.due_at) < datetime('now')");
      if (scope === 'today') filters.push("date(a.due_at, 'localtime') = date('now', 'localtime')");
      if (scope === 'upcoming') filters.push("datetime(a.due_at) > datetime('now')");
      const rows = await db.all(
        `SELECT a.*, l.name AS lead_name, l.phone, l.stage, l.priority, u.name AS created_by_name
         FROM activities a JOIN leads l ON l.id = a.lead_id
         LEFT JOIN users u ON u.id = a.created_by
         WHERE ${filters.join(' AND ')}
         ORDER BY datetime(a.due_at) ASC LIMIT 300`
      );
      res.json(rows.map((item) => ({
        ...activityFromRow(item),
        leadName: item.lead_name,
        phone: req.currentUser.role === 'visualizador' ? maskPhone(item.phone) : item.phone,
        stage: item.stage,
        priority: item.priority
      })));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/import/xlsx', requireAdmin, async (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body)) return res.status(400).json({ message: 'Envie o arquivo XLSX no corpo da requisição.' });
      const parsed = parseLeadWorkbook(req.body);
      const result = await importLeadRecords(db, {
        ...parsed,
        fileName: safeText(req.headers['x-file-name'], 255) || 'Controle de leads 2026.xlsx',
        userId: req.currentUser.id
      });
      res.json({ ...result, sheetName: parsed.sheetName, detected: parsed.leads.length });
    } catch (error) {
      if (/XLSX|planilha|arquivo|colunas|lead/i.test(error.message)) return res.status(400).json({ message: error.message });
      next(error);
    }
  });

  app.get('/api/imports', requireAdmin, async (_req, res, next) => {
    try {
      const imports = await db.all('SELECT * FROM imports ORDER BY created_at DESC LIMIT 20');
      res.json(imports.map((item) => ({
        id: item.id,
        fileName: item.file_name,
        sheetName: item.sheet_name,
        imported: item.imported_count,
        skipped: item.skipped_count,
        warnings: JSON.parse(item.warnings_json || '[]'),
        createdAt: item.created_at
      })));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/export/leads.csv', requireAuth, async (req, res, next) => {
    try {
      const rows = await db.all(`${LEAD_SELECT} WHERE l.archived_at IS NULL ORDER BY l.contact_date DESC, l.id DESC`);
      const headers = ['Data do contato', 'Nome', 'Telefone', 'E-mail', 'Plataforma', 'Tese / Demanda', 'Viabilidade jurídica', 'Status da proposta', 'Fechamento', 'Objeção', 'Valor da proposta', 'Condições de pagamento', 'Última ação', 'Próxima ação', 'Responsável', 'Etapa', 'Prioridade', 'Follow-up', 'Observações'];
      const data = rows.map((row) => {
        const lead = leadFromRow(row, req.currentUser.role !== 'visualizador');
        return [lead.contactDate, lead.name, lead.phone, lead.email, lead.source, lead.practiceArea, lead.viability, lead.proposalStatus, lead.contractStatus, lead.objection, lead.proposalValueCents == null ? '' : (lead.proposalValueCents / 100).toFixed(2), lead.paymentTerms, lead.lastAction, lead.nextAction, lead.responsibleName, lead.stage, lead.priority, lead.followUpAt || '', lead.notes];
      });
      const csv = `\uFEFF${[headers, ...data].map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="jmd-leads-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/users', requireAdmin, async (_req, res, next) => {
    try {
      const users = await db.all('SELECT id, name, email, role, active, last_login_at, created_at FROM users ORDER BY active DESC, name');
      res.json(users.map(userFromRow));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/users', requireAdmin, async (req, res, next) => {
    try {
      const name = safeText(req.body?.name, 120);
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || '');
      const role = ROLES.has(req.body?.role) ? req.body.role : null;
      if (!name || !/^\S+@\S+\.\S+$/.test(email) || !role) return res.status(400).json({ message: 'Preencha nome, e-mail e perfil válidos.' });
      if (!isStrongPassword(password)) return res.status(400).json({ message: 'A senha deve ter pelo menos 12 caracteres, com letras e números.' });
      try {
        const result = await db.run(
          'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
          [name, email, hashPassword(password), role]
        );
        await audit(db, req.currentUser.id, 'create', 'user', result.lastID, { email, role });
        const created = await db.get('SELECT id, name, email, role, active, last_login_at, created_at FROM users WHERE id = ?', [result.lastID]);
        res.status(201).json({ user: userFromRow(created) });
      } catch (error) {
        if (String(error.message).includes('UNIQUE')) return res.status(409).json({ message: 'Já existe um usuário com este e-mail.' });
        throw error;
      }
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/users/:id', requireAdmin, async (req, res, next) => {
    try {
      const id = asId(req.params.id);
      const user = id ? await db.get('SELECT * FROM users WHERE id = ?', [id]) : null;
      if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
      const updates = [];
      const params = [];
      if ('name' in req.body) {
        const name = safeText(req.body.name, 120);
        if (!name) return res.status(400).json({ message: 'Nome inválido.' });
        updates.push('name = ?'); params.push(name);
      }
      if ('role' in req.body) {
        if (!ROLES.has(req.body.role)) return res.status(400).json({ message: 'Perfil inválido.' });
        updates.push('role = ?'); params.push(req.body.role);
      }
      if ('active' in req.body) {
        if (id === req.currentUser.id && req.body.active === false) return res.status(400).json({ message: 'Você não pode desativar seu próprio usuário.' });
        updates.push('active = ?'); params.push(req.body.active ? 1 : 0);
      }
      if (req.body.password) {
        if (!isStrongPassword(req.body.password)) return res.status(400).json({ message: 'A senha deve ter pelo menos 12 caracteres, com letras e números.' });
        updates.push('password_hash = ?'); params.push(hashPassword(req.body.password));
      }
      if (!updates.length) return res.status(400).json({ message: 'Nenhuma alteração válida foi enviada.' });
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      await db.transaction(async () => {
        await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        if (req.body.password || req.body.active === false) await db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [id, req.currentSession.tokenHash]);
      });
      await audit(db, req.currentUser.id, 'update', 'user', id, { fields: Object.keys(req.body) });
      const updated = await db.get('SELECT id, name, email, role, active, last_login_at, created_at FROM users WHERE id = ?', [id]);
      res.json({ user: userFromRow(updated) });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/settings', requireAdmin, async (req, res, next) => {
    try {
      const allowed = ['office_name', 'office_subtitle'];
      const changed = {};
      for (const key of allowed) {
        if (!(key in (req.body || {}))) continue;
        const value = safeText(req.body[key], key === 'office_name' ? 100 : 160);
        if (!value) return res.status(400).json({ message: 'Os campos de identidade não podem ficar vazios.' });
        await db.run(
          `INSERT INTO settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
          [key, value, req.currentUser.id]
        );
        changed[key] = value;
      }
      await audit(db, req.currentUser.id, 'update', 'settings', null, changed);
      res.json({ settings: changed });
    } catch (error) {
      next(error);
    }
  });

  if (distDir && fs.existsSync(distDir)) {
    app.use(express.static(distDir, { maxAge: production ? '1h' : 0, index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  app.use((error, _req, res, _next) => {
    console.error(error);
    if (error?.type === 'entity.too.large') return res.status(413).json({ message: 'Arquivo ou requisição acima do limite permitido.' });
    res.status(500).json({ message: 'Ocorreu um erro interno. Tente novamente.' });
  });

  return app;
}
