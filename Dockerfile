# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
RUN npm install && npm cache clean --force

COPY . .
COPY prisma ./prisma

RUN npx prisma generate

RUN npm run build 2>&1; test -f dist/src/main.js || (echo "ERROR: dist/src/main.js no fue generado. El build falló." && exit 1)

# Asegurar explícitamente que los templates se copien a dist (por si nest-cli.json falla)
RUN mkdir -p dist/src/infrastructure/mailer/templates && cp -r src/infrastructure/mailer/templates/* dist/src/infrastructure/mailer/templates/
# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat openssl netcat-openbsd bash postgresql-client

COPY package.json package-lock.json* ./
# Evitar que Prisma descargue engines gigantes en producción (los copiaremos del builder)
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
# Copiar cliente generado y binarios de prisma directamente del builder para ahorrar espacio
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
COPY public ./public

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
