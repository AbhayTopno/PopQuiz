# frontend/Dockerfile

# --------------------
# Builder Stage
# --------------------
FROM node:22-alpine AS builder
RUN apk add --no-cache git && npm install -g pnpm@latest
WORKDIR /usr/src/app

# Install deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm run build

# --------------------
# Runtime Stage
# --------------------
FROM node:22-alpine AS production
WORKDIR /usr/src/app
RUN apk add --no-cache ca-certificates bash
ENV NODE_ENV=production

# Copy built app
COPY --from=builder /usr/src/app/.next/standalone ./
COPY --from=builder /usr/src/app/.next/static ./.next/static
COPY --from=builder /usr/src/app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
