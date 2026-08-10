FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/config-eslint/package.json ./packages/config-eslint/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @nexa/database db:generate
RUN pnpm --filter @nexa/api build

FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma
COPY packages/shared/package.json ./packages/shared/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/config-eslint/package.json ./packages/config-eslint/
RUN pnpm install --frozen-lockfile --prod
RUN pnpm --filter @nexa/database db:generate

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/database/dist ./packages/database/
COPY --from=builder /app/packages/shared/dist ./packages/shared/
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=prod-deps /app/packages/database/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4000
CMD ["node", "apps/api/dist/main"]
