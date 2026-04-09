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
# Keep only production dependencies so runtime image does not need pnpm/npm.
RUN pnpm prune --prod

# -------------------------
# Production Runtime
# -------------------------
FROM node:22-alpine AS production
WORKDIR /usr/src/app
RUN apk upgrade --no-cache && apk add --no-cache ca-certificates
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

ENV NODE_ENV=production

# Copy only the runtime artifacts.
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy compiled output
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 5000
CMD ["node", "dist/index.js"]