# backend/Dockerfile (production)
FROM node:22-alpine AS base
RUN apk add --no-cache bash git && npm install -g pnpm@latest
WORKDIR /usr/src/app

# Install deps
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build (if you have a build step, otherwise this just copies source)
FROM deps AS builder
COPY . .
# If TS/compilation exists, build it. If not, this step is harmless.
RUN pnpm run build || true

# Production runtime image: install production deps
FROM node:22-alpine AS production
RUN apk add --no-cache bash
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@latest && pnpm install --frozen-lockfile --prod

# Copy built output (prefer dist) or source
COPY --from=builder /usr/src/app ./

ENV NODE_ENV=production
EXPOSE 5000

# Use your production start command. Adjust if your start script differs.
# Common: "node dist/index.js" for compiled code, or "pnpm start" if defined.
CMD ["pnpm", "run", "start"]
