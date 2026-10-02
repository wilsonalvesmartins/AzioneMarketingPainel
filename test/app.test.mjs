import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../server/app.js';
import { initializeDatabase } from '../server/database.js';

let db;
let server;
let baseUrl;
let tempDir;
let adminCookie;
let adminCsrf;

async function request(endpoint, options = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, options);
  const body = await response.json();
  return { response, body };
}

before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jmd-leads-test-'));
  db = await initializeDatabase({
    filename: path.join(tempDir, 'test.sqlite'),
    adminName: 'Admin Teste',
    adminEmail: 'admin@teste.local',
    adminPassword: 'SenhaForte12345'
  });
  const app = createApp({ db, production: false, cookieSecure: false, trustProxy: false });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
  if (tempDir.startsWith(os.tmpdir())) fs.rmSync(tempDir, { recursive: true, force: true });
});

test('protege a API sem sessão', async () => {
  const { response } = await request('/api/leads');
  assert.equal(response.status, 401);
});

test('autentica, exige CSRF e cria um lead', async () => {
  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@teste.local', password: 'SenhaForte12345' })
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.body.user.role, 'admin');
  adminCookie = login.response.headers.get('set-cookie').split(';')[0];
  adminCsrf = login.body.csrfToken;

  const blocked = await request('/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ name: 'Lead bloqueado' })
  });
  assert.equal(blocked.response.status, 403);

  const created = await request('/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: adminCookie, 'x-csrf-token': adminCsrf },
    body: JSON.stringify({ name: 'Maria Teste', phone: '16999999999', contactDate: '2026-10-02', stage: 'novo', priority: 'alta' })
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.lead.name, 'Maria Teste');
  assert.equal(created.body.lead.priority, 'alta');
});

test('visualizador não altera registros', async () => {
  const createdUser = await request('/api/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: adminCookie, 'x-csrf-token': adminCsrf },
    body: JSON.stringify({ name: 'Consulta', email: 'consulta@teste.local', password: 'ConsultaSegura123', role: 'visualizador' })
  });
  assert.equal(createdUser.response.status, 201);

  const viewerLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'consulta@teste.local', password: 'ConsultaSegura123' })
  });
  const viewerCookie = viewerLogin.response.headers.get('set-cookie').split(';')[0];
  const list = await request('/api/leads', { headers: { cookie: viewerCookie } });
  assert.equal(list.response.status, 200);
  const leadId = list.body.items[0].id;

  const forbidden = await request(`/api/leads/${leadId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: viewerCookie, 'x-csrf-token': viewerLogin.body.csrfToken },
    body: JSON.stringify({ stage: 'ganho' })
  });
  assert.equal(forbidden.response.status, 403);
});

test('agenda e conclui follow-up com atualização do painel', async () => {
  const list = await request('/api/leads', { headers: { cookie: adminCookie } });
  const leadId = list.body.items[0].id;
  const dueAt = new Date(Date.now() + 86400000).toISOString();
  const scheduled = await request(`/api/leads/${leadId}/activities`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: adminCookie, 'x-csrf-token': adminCsrf },
    body: JSON.stringify({ type: 'follow_up', description: 'Retornar com documentos', dueAt })
  });
  assert.equal(scheduled.response.status, 201);

  const followups = await request('/api/followups?scope=all', { headers: { cookie: adminCookie } });
  assert.equal(followups.body.length, 1);
  assert.equal(followups.body[0].description, 'Retornar com documentos');

  const completed = await request(`/api/activities/${scheduled.body.activity.id}/complete`, {
    method: 'PATCH',
    headers: { cookie: adminCookie, 'x-csrf-token': adminCsrf }
  });
  assert.equal(completed.response.status, 200);

  const dashboard = await request('/api/dashboard', { headers: { cookie: adminCookie } });
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.body.summary.total, 1);
});
