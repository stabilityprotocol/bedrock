# ---- Stage 1: Build frontend ------------------------------------------------
FROM node:20-alpine AS frontend-build

WORKDIR /app
# Copy root workspace config + lockfile (npm workspaces puts lockfile at root)
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
RUN npm ci --workspace=frontend --ignore-scripts
COPY frontend/ ./frontend/

# Build-time env vars — baked into the Vite bundle at compile time.
# Pass these via --build-env-vars in gcloud run deploy (or --build-arg in docker build).
ARG VITE_AWS_REGION
ARG VITE_COGNITO_IDENTITY_POOL_ID
ARG VITE_SEG_SIZE_BYTES=1310720
ENV VITE_AWS_REGION=$VITE_AWS_REGION
ENV VITE_COGNITO_IDENTITY_POOL_ID=$VITE_COGNITO_IDENTITY_POOL_ID
ENV VITE_SEG_SIZE_BYTES=$VITE_SEG_SIZE_BYTES

RUN npm run build --workspace=frontend

# ---- Stage 2: Install backend deps -----------------------------------------
FROM node:20-alpine AS backend-deps

WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --workspace=backend --omit=dev

# ---- Stage 3: Production runtime -------------------------------------------
FROM node:20-alpine

WORKDIR /app

# Copy backend source + production dependencies
COPY backend/src/ ./backend/src/
COPY backend/package.json ./backend/
COPY --from=backend-deps /app/node_modules ./node_modules

# Copy built frontend static files
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
# PORT is injected by Cloud Run at runtime (defaults to 8080).
# The backend reads process.env.PORT so no hardcoding is needed here.
EXPOSE 8080

CMD ["node", "backend/src/index.js"]
