# Dockerfile

# -------------------------
# Backend Production Build
# -------------------------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat=1.2.4-r0 && npm install -g pnpm@latest
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
RUN apk add --no-cache ca-certificates=20230506-r0

ENV NODE_ENV=production

# Only copy necessary production files
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 5000
CMD ["node", "dist/index.js"]