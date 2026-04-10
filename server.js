import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir os arquivos estáticos do React (quando em produção)
app.use(express.static(path.join(__dirname, 'dist')));

// Banco de Dados na VPS (Armazenamento Permanente)
const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Erro ao conectar no banco SQLite: ", err);
    else console.log("SQLite conectado com sucesso na VPS!");
});

// Inicialização Básica das Tabelas
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS data_store (key TEXT PRIMARY KEY, value JSON)`);
});

// Rota coringa: Envia o React App para qualquer URL acessada
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Azione App rodando na porta ${PORT}`);
});
