import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Servir os arquivos estáticos do React (quando em produção)

// Banco de Dados na VPS (Armazenamento Permanente)
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Erro ao conectar no banco SQLite: ", err);
    else console.log("SQLite conectado com sucesso na VPS!");
});

// Inicialização Básica das Tabelas
db.serialize(() => {
    db.run(`PRAGMA journal_mode = WAL`);
    db.run(`PRAGMA synchronous = NORMAL`);
    db.run(`PRAGMA busy_timeout = 5000`);
    db.run(`CREATE TABLE IF NOT EXISTS data_store (key TEXT PRIMARY KEY, value JSON)`);
});

// --- ROTAS DA API PARA PERSISTÊNCIA DE DADOS ---

app.get('/api/health', (req, res) => {
    db.get("SELECT 1 AS ok", (err) => {
        if (err) return res.status(500).json({ ok: false, error: err.message });
        res.json({ ok: true });
    });
});

// Rota para buscar dados do banco
app.get('/api/data/:key', (req, res) => {
    db.get("SELECT value FROM data_store WHERE key = ?", [req.params.key], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row ? JSON.parse(row.value) : null);
    });
});

// Rota para salvar ou atualizar dados no banco
app.post('/api/data/:key', (req, res) => {
    db.run(`INSERT OR REPLACE INTO data_store (key, value) VALUES (?, ?)`, 
    [req.params.key, JSON.stringify(req.body)], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Proxy seguro para webhooks do Disparador UNO.
// Mantem o navegador longe de problemas de CORS e centraliza o POST no servidor.
app.post('/api/disparador/webhook', async (req, res) => {
    const { webhookUrl, payload } = req.body || {};
    const targetUrl = typeof webhookUrl === 'string' ? webhookUrl.trim() : '';

    if (!targetUrl) {
        return res.status(400).json({ message: 'Webhook nao configurado.' });
    }

    try {
        const parsedUrl = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).json({ message: 'URL de webhook invalida.' });
        }

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {})
        });

        const responseText = await response.text();
        if (!response.ok) {
            return res.status(502).json({
                message: 'O webhook recusou o disparo.',
                status: response.status,
                responseText: responseText.slice(0, 2000)
            });
        }

        return res.json({
            ok: true,
            status: response.status,
            responseText: responseText.slice(0, 2000)
        });
    } catch (error) {
        return res.status(502).json({
            message: `Falha ao chamar webhook: ${error.message}`
        });
    }
});

// Servir os arquivos estaticos do React (quando em producao)
app.use(express.static(path.join(__dirname, 'dist')));

// --- ROTA CORINGA PARA O REACT (SPA) ---
// Qualquer rota não reconhecida acima será direcionada para o index.html do React
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Azione App rodando na porta ${PORT}`);
});

const shutdown = (signal) => {
    console.log(`${signal} recebido. Encerrando servidor com segurança...`);
    server.close(() => {
        db.close(() => {
            process.exit(0);
        });
    });

    setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
