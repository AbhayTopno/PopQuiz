# Dockerfile

# -------------------------
# Backend Production Build
# -------------------------
FROM node:22-alpine AS builder
RUN apk upgrade --no-cache && apk add --no-cache libc6-compat && npm install -g npm@11.11.1 pnpm@10.32.1
WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# This will now correctly generate the /dist folder
RUN pnpm run build

# -------------------------
# Production Runtime
# -------------------------
FROM node:22-alpine AS production
WORKDIR /usr/src/app
RUN apk upgrade --no-cache && apk add --no-cache ca-certificates && npm install -g npm@11.11.1 pnpm@10.32.1

ENV NODE_ENV=production

# Copy only what's needed for a clean prod install (excludes devDependencies like esbuild/tsx)
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --prod && rm -rf /root/.local/share/pnpm /root/.npm /tmp/*

# Copy compiled output
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 5000
CMD ["node", "dist/index.js"]