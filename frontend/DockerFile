# frontend/Dockerfile (production - standalone)
FROM node:22-alpine AS builder
RUN apk add --no-cache git && npm install -g pnpm@latest
WORKDIR /usr/src/app

# Install deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
# build should create .next/standalone when next.config.output = 'standalone'
RUN pnpm run build

# runtime image
FROM node:22-alpine AS production
WORKDIR /usr/src/app
RUN apk add --no-cache ca-certificates
ENV NODE_ENV=production

# Copy standalone output produced by Next
COPY --from=builder /usr/src/app/.next/standalone ./
COPY --from=builder /usr/src/app/.next/static ./.next/static
COPY --from=builder /usr/src/app/public ./public

EXPOSE 3000
# server.js is created in standalone output by Next
CMD ["node", "server.js"]
