# Deploy de Nexa CRM en un VPS propio (con demos de 7 días)

Guía para servir la app (web + API + base) en un servidor propio con Docker,
usando tu propio dominio, y para generar links de demo de un click.

El blueprint de Render (`render.yaml`) cubre el mismo stack; esta guía es la
variante self-hosted, con la diferencia clave de que **la API y la base viven
en tu servidor** (Render queda como opción, no como dependencia).

---

## 0. Setup con Coolify + Traefik (el que ya tenés)

`docker-compose.coolify.yml` es el compose de producción para Coolify:
Traefik termina el TLS y enruta por el host, la red externa es `coolify` y
no hay nginx/certbot (los maneja Coolify).

En el panel de Coolify, en las **variables de entorno** de la app:

| Variable                     | Valor                            | Por qué                                                                                                                                             |
| ---------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FRONTEND_URL`               | `https://nexa.nexacrm.dpdns.org` | es la base de los links de demo                                                                                                                     |
| `NEXT_PUBLIC_API_URL`        | `/api/v1`                        | **relativo**: el browser usa el proxy del mismo origen. Si queda apuntando a un dominio viejo (ej. Render), el web sigue llamando ahí y no a tu API |
| `JWT_DEMO_ACCESS_SECRET`     | `openssl rand -base64 64`        | secret de los links de demo (opcional: cae en `JWT_SECRET`)                                                                                         |
| `ALLOW_STUB_PAYMENT_IN_PROD` | `1`                              | la demo **no debe cobrar de verdad**; sin este flag la API se niega a arrancar en producción                                                        |
| `INTERNAL_API_KEY`           | `openssl rand -hex 32`           | habilita `POST /demo/access` (crear demos)                                                                                                          |

Después: **redeploy del web** (el bundle lleva la API_URL adentro, así que
cambiar `NEXT_PUBLIC_API_URL` requiere reconstruir la imagen).

Con `NEXT_PUBLIC_API_URL=/api/v1` el browser pide `/api/v1/*` al mismo origen
y el rewrite interno de Next (`next.config.js`) lo reenvía a
`http://api:4000` → sin CORS y con las cookies de sesión funcionando.

## 1. Requisitos (deploy manual, sin Coolify)

- Docker + Docker Compose v2 en el VPS
- El dominio apuntando al VPS (si usás Cloudflare por delante: proxy activado,
  modo **Full**, y un _Origin Certificate_ o un cert de Let's Encrypt en el
  origin)
- Puertos 80/443 abiertos (Cloudflare los conecta al origin)

## 2. Variables de entorno

```bash
git clone https://github.com/nexacrm0-cloud/NexaCRM.git
cd NexaCRM
cp .env.prod.example .env.prod
```

Editá `.env.prod`. Lo **imprescindible**:

| Variable                                                     | Valor                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `FRONTEND_URL`                                               | `https://tu-dominio.com` → es la base de los links de demo     |
| `NEXT_PUBLIC_API_URL`                                        | `/api/v1` (relativo: el browser usa el proxy del mismo origen) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`        | credenciales de la base                                        |
| `REDIS_PASSWORD`                                             | password de Redis                                              |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_2FA_PENDING_SECRET` | `openssl rand -base64 64` (distintos)                          |
| `JWT_DEMO_ACCESS_SECRET`                                     | `openssl rand -base64 64` (o vacío → usa `JWT_SECRET`)         |
| `INTERNAL_API_KEY`                                           | `openssl rand -hex 32` → habilita `POST /demo/access`          |

Generá los secretos de una:

```bash
for v in JWT_SECRET JWT_REFRESH_SECRET JWT_2FA_PENDING_SECRET JWT_DEMO_ACCESS_SECRET; do
  echo "$v=$(openssl rand -base64 64)"
done
echo "INTERNAL_API_KEY=$(openssl rand -hex 32)"
```

> `NEXT_PUBLIC_API_URL` se **inlinea en el bundle al compilar**: si queda
> apuntando a un dominio viejo, el browser sigue llamando a ese host aunque
> cambies el proxy. Es el motivo #1 de "el web da 503".

## 3. Backend (Postgres + Redis + API)

```bash
docker compose -f docker-compose.backend.yml --env-file .env.prod up -d --build
```

Eso deja la API en `127.0.0.1:4000` (solo loopback) y corre las migraciones
automáticamente (`prisma migrate deploy` en el servicio `migrate`).

Notas de diseño (importantes si tocás el compose):

- La API conecta como **owner** de la base (`POSTGRES_USER`), no como
  `nexa_app`/`nexa_admin`: esos roles se crean `NOLOGIN` (son _switches_, no
  usuarios de login) y la API hace `SET LOCAL ROLE nexa_app` en cada request
  para que el RLS sea efectivo (fail-closed).
- `RLS_APP_ROLE=nexa_app` es el rol por defecto.

## 4. Web

El web ya existe: reconstruilo con la URL de API **relativa**.

```bash
docker compose -f docker-compose.web.yml --env-file .env.prod up -d --build
```

o, si tu web corre con tu propio compose, asegurate de que el build arg sea:

```yaml
build:
  args:
    NEXT_PUBLIC_API_URL: /api/v1 # relativo -> mismo origen, sin CORS
environment:
  API_URL: http://api:4000 # o http://host.docker.internal:4000
```

## 5. Proxy `/api/*`

El navegador llama a `/api/*` en el **mismo origen** (tu dominio) y el
reverse proxy lo reenvía a la API. Pegá el snippet
`docker/nginx-api-proxy.conf` dentro del `server {}` que atiende tu dominio:

```nginx
location /api/ { proxy_pass http://127.0.0.1:4000; ... }
location /uploads/ { proxy_pass http://127.0.0.1:4000; ... }
```

Si el proxy corre en Docker: `proxy_pass http://api:4000` (misma red) o
`http://host.docker.internal:4000` (con `extra_hosts:
["host.docker.internal:host-gateway"]`).

## 6. Verificar

```bash
curl -s http://127.0.0.1:4000/api/v1/health          # {"status":"ok",...}
curl -s https://tu-dominio.com/api/v1/health         # el proxy funciona
open https://tu-dominio.com/login                    # el web carga
```

Si `/api/v1/health` en el dominio devuelve 503 → el proxy no está
reeenviando a la API.

## 7. Crear la demo y sacar el link

Con la API viva, se crea la demo (tenant propio + datos semilla + ventana de
7 días) y se devuelve el link de un click:

```bash
curl -X POST https://tu-dominio.com/api/v1/demo/access \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $INTERNAL_API_KEY" \
  -d '{"email":"prospecto@acme.com","name":"Acme S.A.","contactName":"Juan Pérez"}'
```

```json
{
  "success": true,
  "data": {
    "url": "https://tu-dominio.com/demo/eyJhbGciOiJIUzI1NiIs...",
    "email": "prospecto@acme.com",
    "expiresAt": "2026-11-18T17:55:14.194Z"
  }
}
```

El link:

- abre la web, canjea el token por una sesión y entra **directo al dashboard**
- expira **con la ventana de demo** (no sirvePassed)
- apunta a una **organización propia**: el prospecto solo ve sus datos (RLS)

Mismo resultado desde el repo (necesita la API corriendo):

```bash
INTERNAL_API_KEY=... pnpm demo:create --email=... --name=...
```

## 8. Después de los 7 días

El cron horario de la API (`DemoExpiryService`) detecta las demos vencidas,
borra los datos del tenant y abre una ventana nueva de 7 días. No hay que
hacer nada a mano.

---

## Troubleshooting

| Síntoma                                                     | Causa probable                                                                                                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/health` → 503 en el dominio                        | el proxy no reenvía a la API                                                                                               |
| el login da error de red                                    | `NEXT_PUBLIC_API_URL` quedó apuntando a otro host (rebuild)                                                                |
| `FALTAN variables de entorno críticas: WHATSAPP_APP_SECRET` | la API exige las 3 variables de WhatsApp si configuras **alguna**. Si no usás WhatsApp, dejalas vacías (ya es condicional) |
| `REFUSANDO arrancar con StubPaymentProvider en produccion`  | falta `ALLOW_STUB_PAYMENT_IN_PROD=1` (la demo no debe cobrar de verdad)                                                    |
| `relation "quote_number_seq" does not exist`                | faltó la migración `20261107000000_ensure_quote_number_seq` (corré `prisma migrate deploy`)                                |
| el login muestra el 404 de Prisma                           | `DATABASE_URL` apunta a un rol `NOLOGIN` (usá el owner)                                                                    |
| la demo no muestra datos                                    | el tenant quedó vacío: el seed no corrió sobre esa base                                                                    |
| `Cannot find module '@nexa/shared'` al construir la imagen  | orden de compilación en el Dockerfile: `@nexa/shared` y `@nexa/domain` van **antes** de `@nexa/database` y `@nexa/api`     |
