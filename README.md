# JMD Leads

CRM interno para gestão de leads da JMD Advocacia. A aplicação inclui autenticação real, perfis de acesso, pipeline, follow-ups, histórico de contatos, relatórios, importação do Excel e armazenamento persistente em SQLite.

## Implantação no Coolify

1. Crie um recurso `Docker Compose` apontando para este repositório.
2. Cadastre as variáveis `ADMIN_EMAIL` e `ADMIN_PASSWORD`. A senha inicial precisa ter pelo menos 12 caracteres, letras e números.
3. Mantenha `COOKIE_SECURE=true` quando o domínio estiver com HTTPS.
4. Configure o domínio no Coolify apontando para a porta interna `3000`.
5. Preserve o volume `jmd_leads_data`. Ele contém o banco de dados.

O primeiro boot cria somente o administrador definido nas variáveis. Nenhuma senha padrão fica no código.

## Planilha inicial

Há duas formas seguras de carregar `Controle de leads 2026.xlsx`:

- Depois do deploy, acesse **Administração > Dados** e envie o arquivo pela interface.
- Em uma implantação local, coloque o arquivo em `imports/Controle de leads 2026.xlsx`. Se a base estiver vazia, o container fará a importação uma única vez.

Arquivos em `imports/` e o banco em `data/` não entram no Git. Isso evita publicar dados pessoais dos leads no repositório ou no bundle do frontend.

## Desenvolvimento local

Copie `.env.example` para `.env`, ajuste as credenciais e execute:

```bash
npm ci
npm run build
docker compose --env-file .env up --build
```

O Compose expõe a porta `3000` apenas para a rede interna do Docker. Em produção, o proxy do Coolify publica o domínio; para testes locais, prefira `npm start` ou acrescente temporariamente um mapeamento de porta.

Para usar HTTP local, deixe `COOKIE_SECURE=false`. Em produção com HTTPS, use `true`.

## Operação e segurança

- Senhas com `scrypt` e salt individual.
- Sessão em cookie `HttpOnly`, `SameSite=Lax` e expiração em sete dias.
- Proteção CSRF em toda alteração.
- Autorização verificada no backend para administrador, gestor, atendimento e visualizador.
- Importação XLSX com validação, detecção de duplicados e alertas de qualidade.
- Banco SQLite em WAL, `busy_timeout`, volume persistente e encerramento seguro.
- Exportação CSV autenticada para backup operacional.

Faça backup periódico do volume do banco pelo mecanismo de backups do Coolify.
