# =============================================================
# Stage 1: Build React 19 + Vite Frontend
# =============================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
ARG VITE_API_URL=/api/v1
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

RUN npm run build

# =============================================================
# Stage 2: Install & Prepare Backend Engine
# =============================================================
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend

COPY taskflow-mcp/package*.json ./
RUN npm install

COPY taskflow-mcp/prisma ./prisma
RUN npx prisma generate

COPY taskflow-mcp/ ./

# =============================================================
# Stage 3: Unified Production Runtime Container
# =============================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install OpenSSL for Prisma engine compatibility on Alpine
RUN apk add --no-cache openssl libc6-compat

# Copy backend dependencies, code and Prisma client
COPY --from=backend-builder /app/backend /app

# Copy compiled React frontend build into static directory
COPY --from=frontend-builder /app/frontend/dist /app/dist-frontend
COPY --from=frontend-builder /app/frontend/dist /app/public

EXPOSE 3000

# Auto-sync Prisma schema with Supabase cloud DB on startup, then start SSE server
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx tsx src/index.ts --sse"]
