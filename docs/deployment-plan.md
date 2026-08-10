# Nexa CRM — Plan de Despliegue Alpha

> Documento de infraestructura, configuración y procedimientos para desplegar Nexa CRM en un entorno accesible para empresas piloto.

---

## 1. Arquitectura Recomendada

### Opción 1 — VPS Único (Recomendado para Alpha)

Costo estimado: **$15–25 USD/mes**

```
Internet → Nginx (HTTPS) → Frontend (Next.js :3000)
                         → API (NestJS :4000)
                         → PostgreSQL (:5432)
                         → Redis (:6379)
```

**Proveedor recomendado**: Hetzner CX22 ($15/mes) o DigitalOcean Basic Droplet ($20/mes)
**Especificaciones**: 2 vCPU, 4 GB RAM, 80 GB SSD

### Opción 2 — PaaS (Alternativa)

- **Backend**: Railway o Fly.io — aprox $15–30/mes
- **Frontend**: Vercel (plan Pro, $20/mes)
- **Base de datos**: Neon (Serverless PostgreSQL, free tier hasta 500 MB)
- **Redis**: Upstash (Serverless Redis, free tier)

  > **Ventaja**: Escalamiento individual, menos mantenimiento de SO.
  > **Desventaja**: Costo combinado mayor ($40–60/mes), más proveedores.

---

## 2. Docker Compose para Producción

Crear archivo `docker-compose.yml` en la raíz del proyecto:

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init.sql:/docker-entrypoint-initdb.d/init.sql
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-nexa}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      POSTGRES_DB: ${POSTGRES_DB:-nexa_crm}
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-nexa}']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD is required}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', '--raw', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      args:
        NODE_ENV: production
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER:-nexa}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-nexa_crm}?schema=public
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?JWT_REFRESH_SECRET is required}
      RESEND_API_KEY: ${RESEND_API_KEY:-}
      EMAIL_FROM: ${EMAIL_FROM:-noreply@nexacrm.com}
      CORS_ORIGIN: ${CORS_ORIGIN:-https://app.nexacrm.com}
      PORT: 4000
    ports:
      - '127.0.0.1:4000:4000'

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        NODE_ENV: production
        NEXT_PUBLIC_API_URL: https://api.nexacrm.com/api/v1
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NODE_ENV: production
      API_URL: http://api:4000
    ports:
      - '127.0.0.1:3000:3000'

  nginx:
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./docker/ssl:/etc/nginx/ssl:ro
      - certbot_data:/var/www/letsencrypt
    depends_on:
      - web
      - api

  certbot:
    image: certbot/certbot
    volumes:
      - ./docker/ssl:/etc/letsencrypt
      - certbot_data:/var/www/letsencrypt
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h; done'"

  backup:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - ./docker/backups:/backups
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    entrypoint: |
      /bin/sh -c '
        while true; do
          PGPASSWORD=$$POSTGRES_PASSWORD pg_dump -h postgres -U nexa -d nexa_crm -F c -f /backups/nexa_$$(date +%Y%m%d_%H%M%S).dump
          find /backups -name "*.dump" -mtime +7 -delete
          sleep 86400
        done
      '

volumes:
  postgres_data:
  redis_data:
  certbot_data:
```

---

## 3. Dockerfile para API

`apps/api/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate
COPY pnpm-lock.yaml ./
COPY package.json ./

COPY apps/api ./apps/api
COPY packages ./packages
COPY tsconfig.json turbo.json ./

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @nexa/database exec prisma generate
RUN pnpm --filter @nexa/api build

FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate
COPY --from=builder /app/pnpm-lock.yaml ./
COPY package.json ./

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages ./packages

RUN pnpm install --frozen-lockfile --prod

EXPOSE 4000
CMD ["node", "apps/api/dist/main"]
```

## 4. Dockerfile para Web

`apps/web/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate
COPY pnpm-lock.yaml ./
COPY package.json ./

COPY apps/web ./apps/web
COPY packages ./packages
COPY tsconfig.json turbo.json ./

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @nexa/web build

FROM node:20-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate
COPY --from=builder /app/pnpm-lock.yaml ./
COPY package.json ./

COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/next.config.js ./apps/web/next.config.js
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["pnpm", "--filter", "@nexa/web", "start"]
```

---

## 5. Variables de Entorno

### Obligatorias

| Variable             | Descripción                 | Ejemplo                       |
| -------------------- | --------------------------- | ----------------------------- |
| `POSTGRES_PASSWORD`  | Contraseña de base de datos | `generar-con-openssl-rand-32` |
| `REDIS_PASSWORD`     | Contraseña de Redis         | `generar-con-openssl-rand-32` |
| `JWT_SECRET`         | Secreto para firmar JWT     | `openssl rand -hex 64`        |
| `JWT_REFRESH_SECRET` | Secreto para refresh tokens | `openssl rand -hex 64`        |
| `CORS_ORIGIN`        | Origen permitido para CORS  | `https://app.nexacrm.com`     |

### Opcionales

| Variable              | Descripción                   | Default                          |
| --------------------- | ----------------------------- | -------------------------------- |
| `POSTGRES_USER`       | Usuario de base de datos      | `nexa`                           |
| `POSTGRES_DB`         | Nombre de base de datos       | `nexa_crm`                       |
| `RESEND_API_KEY`      | API key para envío de emails  | _(sin email)_                    |
| `EMAIL_FROM`          | Dirección remitente de emails | `noreply@nexacrm.com`            |
| `NEXT_PUBLIC_API_URL` | URL pública de la API         | `https://api.nexacrm.com/api/v1` |

### Generación de secretos

```bash
# Generar todos los secretos necesarios
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -hex 64)
JWT_REFRESH_SECRET=$(openssl rand -hex 64)

echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo "REDIS_PASSWORD=$REDIS_PASSWORD"
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
```

---

## 6. Nginx Reverse Proxy

`docker/nginx.conf`:

```nginx
upstream api {
    server api:4000;
}

upstream web {
    server web:3000;
}

server {
    listen 80;
    server_name app.nexacrm.com api.nexacrm.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.nexacrm.com;

    ssl_certificate /etc/nginx/ssl/live/app.nexacrm.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/live/app.nexacrm.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 10M;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://web;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 443 ssl http2;
    server_name api.nexacrm.com;

    ssl_certificate /etc/nginx/ssl/live/api.nexacrm.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/live/api.nexacrm.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 10M;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 7. Configuración de Dominio y HTTPS

### Opción A — Certbot (Automático, recomendado)

```bash
# Instalar certbot en el host
apt-get install certbot

# Obtener certificados (primera vez con nginx detenido o en standalone)
certbot certonly --standalone -d app.nexacrm.com -d api.nexacrm.com --email admin@nexacrm.com --agree-tos

# Los certificados quedan en /etc/letsencrypt/live/
# El contenedor certbot en docker-compose renueva automáticamente cada 12h
```

### Opción B — Caddy (Alternativa más simple)

Reemplazar nginx + certbot por Caddy, que maneja HTTPS automáticamente:

```yaml
# En docker-compose, reemplazar servicio nginx con:
caddy:
  image: caddy:2-alpine
  restart: unless-stopped
  ports:
    - '80:80'
    - '443:443'
  volumes:
    - ./docker/Caddyfile:/etc/caddy/Caddyfile:ro
    - caddy_data:/data
```

`docker/Caddyfile`:

```
app.nexacrm.com {
    reverse_proxy web:3000
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options "DENY"
    }
}

api.nexacrm.com {
    reverse_proxy api:4000
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Frame-Options "DENY"
    }
}
```

---

## 8. Backups de PostgreSQL

### Estrategia

| Tipo     | Frecuencia | Retención | Método                    |
| -------- | ---------- | --------- | ------------------------- |
| Completo | Diario     | 7 días    | pg_dump (custom format)   |
| Lógico   | Semanal    | 30 días   | pg_dump (SQL)             |
| WAL      | Continuo   | 24h       | Archivo de WAL (opcional) |

### Restauración

```bash
# Listar backups disponibles
ls -la docker/backups/

# Restaurar backup diario
pg_restore -h localhost -U nexa -d nexa_crm --clean docker/backups/nexa_20260626_030000.dump

# Restaurar desde archivo SQL
psql -h localhost -U nexa -d nexa_crm < backup_semanal.sql
```

### Backup externo (off-site)

Agregar un cron job en el host para sincronizar backups a S3-compatible:

```bash
# Instalar rclone o aws-cli
# Cron diario a las 3 AM
0 3 * * * /usr/bin/rclone sync /opt/nexa/docker/backups/ s3:nexa-backups/alpha/ --progress
```

---

## 9. Monitoreo

### Health Checks

| Servicio   | Endpoint             | Intervalo |
| ---------- | -------------------- | --------- |
| API Health | `GET /api/v1/health` | 30s       |
| Web Health | `GET /` → 200        | 30s       |
| PostgreSQL | pg_isready           | 10s       |
| Redis      | redis-cli ping       | 10s       |

### Endpoint de Health (API)

Crear health check básico en la API (`apps/api/src/modules/health/health.controller.ts`):

```typescript
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '@nexa/database';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    const db = await this.prisma.$queryRaw`SELECT 1 as alive`;
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: db ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    };
  }
}
```

### Uptime Monitoring (Gratuito)

| Proveedor     | Plan gratis        | URL                      |
| ------------- | ------------------ | ------------------------ |
| HetrixTools   | 5 monitores, 1 min | https://hetrixtools.com  |
| UptimeRobot   | 5 monitores, 5 min | https://uptimerobot.com  |
| Better Uptime | 1 monitor          | https://betteruptime.com |

### Error Tracking

**Sentry** (plan Developer, gratis):

1. Crear proyecto en https://sentry.io
2. Instalar SDK en API:

```bash
cd apps/api && pnpm add @sentry/node
```

3. Configurar en `main.ts`:

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
});
```

---

## 10. Logs

### Formato de logs (JSON estructurado)

Configurar NestJS para logs JSON en producción:

```typescript
// apps/api/src/main.ts
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

const logger = WinstonModule.createLogger({
  format: winston.format.json(),
  defaultMeta: { service: 'nexa-api' },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? winston.format.json() : winston.format.cli(),
    }),
  ],
});
```

### Docker logs

```bash
# Ver logs en tiempo real
docker compose logs -f api web

# Filtrar errores
docker compose logs api | grep ERROR

# Exportar logs a archivo
docker compose logs --timestamps api > api_logs_$(date +%Y%m%d).txt
```

### Loki + Grafana (Opcional para Alpha)

Para equipos que ya usan Grafana, agregar Docker Compose:

```yaml
loki:
  image: grafana/loki:3.0
  volumes:
    - ./docker/loki-config.yml:/etc/loki/local-config.yaml

promtail:
  image: grafana/promtail:3.0
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
    - ./docker/promtail-config.yml:/etc/promtail/config.yml

grafana:
  image: grafana/grafana:latest
  ports:
    - '127.0.0.1:3001:3000'
```

---

## 11. Manejo de Errores

### API — Filtro global de excepciones

Ya existe `HttpExceptionFilter` en el código. Verificar en producción:

```typescript
// apps/api/src/common/filters/http-exception.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = 500;
    let message = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || message;
    }

    // En producción, ocultar detalles de errores internos
    if (process.env.NODE_ENV === 'production' && status === 500) {
      message = 'Error interno del servidor';
    }

    response.status(status).json({
      error: {
        status,
        message,
        timestamp: new Date().toISOString(),
        path: ctx.getRequest().url,
      },
    });
  }
}
```

### Frontend — Error Boundary

Agregar un error boundary global en el layout de dashboard:

```tsx
// src/components/ui/error-boundary.tsx
'use client';

import { Component, ReactNode } from 'react';
import { Button } from './button';

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false, error: undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-[400px] flex-col items-center justify-center">
            <h2 className="mb-2 text-xl font-semibold">Algo salió mal</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Ocurrió un error inesperado. Intenta recargar la página.
            </p>
            <Button onClick={() => window.location.reload()}>Recargar</Button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
```

---

## 12. Checklist de Lanzamiento

### Pre-despliegue

- [ ] Migraciones de base de datos verificadas (`prisma migrate deploy`)
- [ ] Seed data ejecutado en entorno de staging
- [ ] Variables de entorno documentadas y configuradas
- [ ] Secretos generados (JWT_SECRET, JWT_REFRESH_SECRET, DB password)
- [ ] Docker Compose probado localmente
- [ ] Health check endpoint funcionando
- [ ] CORS configurado para el dominio correcto
- [ ] SSL certificate obtenido y funcionando
- [ ] Backups configurados y probados (restauración verificada)
- [ ] Monitoreo de uptime configurado

### Seguridad

- [ ] Firewall configurado (solo puertos 80, 443, SSH)
- [ ] PostgreSQL no expuesto públicamente (solo red interna Docker)
- [ ] Redis no expuesto públicamente (solo red interna Docker)
- [ ] Headers de seguridad configurados en nginx
- [ ] Rate limiting activado en API endpoints
- [ ] JWT secrets rotados (no usar valores por defecto)
- [ ] Logs de acceso habilitados

### Post-despliegue

- [ ] Smoke test de todos los flujos críticos:
  - [ ] Login y registro
  - [ ] Dashboard carga correctamente
  - [ ] CRUD de clientes
  - [ ] Pipeline drag & drop
  - [ ] Creación y descarga de PDF de presupuesto
  - [ ] Command Center (Ctrl+K)
  - [ ] Business Copilot
- [ ] Monitoreo de errores en Sentry
- [ ] Verificar que los backups se están ejecutando
- [ ] Prueba de restauración desde backup
- [ ] Documentar URLs de acceso y credenciales de admin
- [ ] Enviar instrucciones de acceso a empresas piloto

### Para cada empresa piloto

- [ ] Crear organización y usuario administrador
- [ ] Verificar acceso HTTPS
- [ ] Ejecutar seed data específico para demo
- [ ] Compartir walkthrough de demo
- [ ] Entregar checklist de validación
- [ ] Acordar canal de feedback (Slack, email, issue tracker)
- [ ] Programar reunión de seguimiento a los 7 días

---

## 13. Comandos Rápidos de Operación

```bash
# Desplegar
git pull origin main
docker compose build --no-cache api web
docker compose up -d

# Migraciones
docker compose exec api npx prisma migrate deploy

# Seed
docker compose exec api npx prisma db seed

# Ver logs
docker compose logs -f api web

# Backup manual
docker compose exec backup /bin/sh -c 'PGPASSWORD=$POSTGRES_PASSWORD pg_dump -h postgres -U nexa -d nexa_crm -F c -f /backups/manual_$(date +%Y%m%d_%H%M%S).dump'

# Restaurar backup
docker compose exec -T postgres pg_restore -U nexa -d nexa_crm --clean < backup_file.dump

# Ver estado
docker compose ps

# Reiniciar servicio
docker compose restart api

# Actualizar seed (vuelve a ejecutar con upsert)
docker compose exec api npx prisma db seed
```

---

## 14. Costos Mensuales Estimados

| Recurso            | Proveedor                      | Costo           |
| ------------------ | ------------------------------ | --------------- |
| VPS (2 vCPU, 4 GB) | Hetzner / DigitalOcean         | $15–20          |
| Dominio (.com)     | Namecheap / Cloudflare         | ~$1             |
| SSL                | Let's Encrypt                  | Gratis          |
| Uptime monitoring  | HetrixTools (gratis)           | $0              |
| Error tracking     | Sentry (Developer)             | $0              |
| Email (opcional)   | Resend (100 emails/día gratis) | $0              |
| **Total**          |                                | **~$16–21/mes** |

---

## 15. CI/CD — Pipelines GitHub Actions

### CI (`.github/workflows/ci.yml`)

Se ejecuta en cada push a `main`/`develop` y pull request:

- Lint (ESLint)
- Type check (`tsc --noEmit` en API + build de web)
- Tests (`jest` con Postgres + Redis services)
- Build de todos los packages

### CD (`.github/workflows/cd.yml`)

Se ejecuta en push a `main` y en cualquier tag `v*` (release):

1. **build-api + build-web**: Buildan las imágenes Docker multi-stage y las publican a `ghcr.io/<repo>/api` y `ghcr.io/<repo>/web`. Taggeo automático:
   - `:v1.2.3` (tag exacto), `:1.2`, `:1` (semver), `:latest` (solo en main)
   - `:sha-abc1234` (cada build)
   - `:main` (rama default)
   - Build cache con `actions/cache` (modo max)

2. **deploy** (opcional): Solo corre si `vars.ENABLE_SSH_DEPLOY = 'true'` y en tag `v*`. Hace SSH al VPS, copia el bundle (compose + nginx config), pull imágenes nuevas con un PAT (no el token default porque el VPS necesita leer paquetes private), y recrea los containers. Si falla, envía Telegram notification (si `TELEGRAM_*` secrets están configurados).

3. **release-notes**: Crea un GitHub Release auto-generado. Las versiones con sufijo `-` (ej `v1.2.3-rc1`) se marcan como prerelease.

### Secrets requeridos (Settings → Secrets and variables → Actions)

**Para push de imágenes automáticamente** (sin setup extra):

- `GITHUB_TOKEN` (provisto por GitHub, no hace falta crearlo)

**Para deploy por SSH al VPS** (opcional, solo si activás `vars.ENABLE_SSH_DEPLOY = 'true'`):

- `SSH_HOST` — IP o dominio del VPS
- `SSH_USER` — usuario SSH (recomendado: `deploy`)
- `SSH_PRIVATE_KEY` — clave privada SSH (sin passphrase para automatización)
- `SSH_PORT` — (opcional, default 22)
- `GHCR_USER` — usuario de GitHub para hacer pull en el VPS
- `GHCR_PULL_TOKEN` — PAT con scope `read:packages` (crear en https://github.com/settings/tokens)
- `TELEGRAM_CHAT_ID` — (opcional) chat ID para notificaciones
- `TELEGRAM_BOT_TOKEN` — (opcional) bot token de BotFather

### Variables de repositorio (Settings → Secrets and variables → Actions → Variables)

- `ENABLE_SSH_DEPLOY` — `true` para activar el job de deploy (default: desactivado)

### Cómo disparar un release

```bash
# Version patch (1.0.0 → 1.0.1)
git tag v1.0.1
git push origin v1.0.1

# Version minor (1.0.x → 1.1.0)
git tag v1.1.0
git push origin v1.1.0

# Release candidate (se marca como prerelease en GitHub)
git tag v1.1.0-rc1
git push origin v1.1.0-rc1
```

El workflow `CD` arranca automáticamente tras el tag push. Las imágenes aparecerán en `https://github.com/<repositorio>/packages`.

### Errores comunes

| Síntoma                          | Causa                                     | Solución                                                     |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| `docker: denied` en el VPS       | PAT sin `read:packages`                   | Regenerar PAT con scope correcto                             |
| `template not found` en workflow | Workflow YAML con indentación incorrecta  | Validar con `act -W` localmente                              |
| Images no aparecen en GHCR       | `permissions: packages: write` no seteado | Ya está en el job; revisar fork vs repo principal            |
| SSH timeout                      | Firewall en el VPS                        | Abrir puerto 22 a la IP de Actions runner (rangos de GitHub) |
| Deploy marca fail pero app OK    | Post-deploy script legacy                 | Revisar `script:` del step SSH                               |

---

## 16. Sentry — Error Tracking

Nexa CRM integra Sentry en ambos extremos:

- **API (NestJS)** — `apps/api/src/common/sentry.config.ts` + hooks en `main.ts`:
  - `Sentry.setupExpressErrorHandler(app)` captura errores no manejados en el pipeline Express
  - Handlers para `uncaughtException` y `unhandledRejection` reportan antes de crashear
  - `beforeSend` filtra eventos en dev (no mandar ruido a Sentry en local)

- **Web (Next.js)** — `sentry.client.config.ts` y `sentry.server.config.ts`, wraper `withSentryConfig` en `next.config.js`:
  - Captura errores del browser (clientes React) y del SSR (server-side render)
  - El CSP se actualiza automaticamente para permitir `connect-src https://sentry.io`
  - Tree-shaking via `disableLogger: true` cuando no hay DSN seteado
  - Source maps upload desde CI cuando `SENTRY_AUTH_TOKEN` esta configurado

### Configuracion inicial

1. **Crear proyecto en Sentry**:
   - Ir a https://sentry.io/signup/ (plan Developer free: 5K errors/mes)
   - Crear organizacion y dos proyectos:
     - `nexa-api` (platform: Node.js)
     - `nexa-web` (platform: Next.js)
   - Anotar los DSN de cada uno

2. **Configurar secrets en GitHub** (Settings → Secrets → Actions):
   - `SENTRY_DSN` — DSN del proyecto `nexa-api` (tambien se usa como fallback en web)
   - `SENTRY_AUTH_TOKEN` — Auth token de https://sentry.io/settings/auth-tokens/ para upload de sourcemaps
   - Opcional: variable `SENTRY_HOST` si usas self-hosted Sentry (default: `sentry.io`)

3. **Setear en `.env.prod` del VPS**:

   ```
   SENTRY_DSN=https://<key>@sentry.io/<project_id>
   NEXT_PUBLIC_SENTRY_DSN=https://<key>@sentry.io/<project_id_web>
   NEXT_PUBLIC_SENTRY_HOST=sentry.io
   SENTRY_TRACES_SAMPLE_RATE=0.1
   ```

   Reiniciar api y web: `docker compose -f docker-compose.prod.yml restart api web`

4. **Verificar**:
   - Hacer un error de prueba: en el browser console `throw new Error('sentry test')` y confirmar que aparece en Sentry
   - Para API: `curl -X POST http://localhost:4000/api/v1/test-error` o crear un endpoint que lanza
   - En https://sentry.io/issues/ deberian aparecer los eventos en menos de 30s

### Sample rates recomendados

| Etapa      | Traces | Profiles | Notas                               |
| ---------- | ------ | -------- | ----------------------------------- |
| Dev local  | 0      | 0        | `beforeSend` filtra todo igualmente |
| Alpha      | 0.1    | 0.1      | Captura 10% de traces para perf     |
| Beta       | 0.05   | 0.0      | Reduce perf overhead                |
| Produccion | 0.05   | 0.0      | Igual que beta                      |

Ajustar via `SENTRY_TRACES_SAMPLE_RATE` y `SENTRY_PROFILES_SAMPLE_RATE`.

### PII y privacidad

Sentry captura stack traces y metadata del error. Para cumplir con la Ley 25.326 y GDPR:

- **No enviar PII automaticamente**: el SDK por default attaching de IP del usuario viene deshabilitado. Las integraciones de Sentry tienen `defaultIntegrations: false` si necesitas apagarlas todas.
- **Scrubbing de headers sensibles**: si capturas peticiones HTTP (httpIntegration), los headers Authorization, Cookie y X-API-Key son automaticamente scrubbeados por @sentry/node.
- **Server-side scrubbing**: tambien podes configurar un `beforeSend` que remueva campos custom sensibles (ej: `payload.clientEmail`). Ya esta hook en `sentry.config.ts` para extension futura.
