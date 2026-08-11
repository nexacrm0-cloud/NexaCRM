FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma
COPY packages/shared/package.json ./packages/shared/
COPY packages/domain/package.json ./packages/domain/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/config-eslint/package.json ./packages/config-eslint/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/database/prisma ./packages/database/prisma
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/domain/node_modules ./packages/domain/node_modules
COPY . .
RUN pnpm --filter @nexa/database db:generate
RUN pnpm --filter @nexa/database build
# @nexa/api imports @nexa/shared, which resolves to dist/index.js — it must
# be compiled before the API build. dist/ is gitignored/excluded from context.
RUN pnpm --filter @nexa/shared build
# @nexa/api also imports @nexa/domain (DomainEvent etc), same dist requirement.
RUN pnpm --filter @nexa/domain build
RUN pnpm --filter @nexa/api build

FROM base AS prod-deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/database/prisma ./packages/database/prisma
COPY packages/shared/package.json ./packages/shared/
COPY packages/domain/package.json ./packages/domain/
COPY packages/config-typescript/package.json ./packages/config-typescript/
COPY packages/config-eslint/package.json ./packages/config-eslint/
RUN npm install -g prisma@6.19.3
# --ignore-scripts: --prod skips devDeps, so the root 'prepare' (husky)
# would fail (husky is a devDep). db:generate below handles Prisma client.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts
RUN pnpm --filter @nexa/database db:generate

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g prisma@6.19.3
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/database/dist ./packages/database/
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/database/src ./packages/database/src
COPY --from=builder /app/packages/shared/dist ./packages/shared/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/domain/dist ./packages/domain/
COPY --from=builder /app/packages/domain/package.json ./packages/domain/
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=prod-deps /app/packages/domain/node_modules ./packages/domain/node_modules

EXPOSE 4000
CMD ["node", "apps/api/dist/main"]
