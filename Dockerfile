FROM node:20-bookworm-slim AS deps
WORKDIR /app
ENV npm_config_audit=false \
    npm_config_fund=false
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=512
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    npm_config_audit=false \
    npm_config_fund=false

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
