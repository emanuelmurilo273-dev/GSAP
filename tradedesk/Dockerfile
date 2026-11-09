# Imagem única com 2 alvos: `web` (Next.js) e `worker` (BullMQ). Contexto de build = raiz do monorepo.
FROM node:22-slim AS base
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci --no-audit --no-fund

FROM base AS web
# variáveis NEXT_PUBLIC_* são embutidas no build do front
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_NAME=HEXADESK
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL SUPABASE_KEY=build npm run build -w @desk/web
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@desk/web"]

FROM base AS worker
ENV NODE_ENV=production
CMD ["npm", "run", "start", "-w", "@desk/worker"]
