# Nexa CRM — WhatsApp AI Agent

> Agente de IA que responde automáticamente mensajes de WhatsApp, analiza intención con LLM (Groq), crea clientes/oportunidades en el CRM y responde por el canal.

---

## 1. Arquitectura General

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  Meta Cloud  │ POST  │   Nexa API   │ HTTP  │     n8n      │  LLM  │  Groq API    │
│  WhatsApp    │──────▶│  NestJS 4000 │──────▶│  (Docker)    │──────▶│  llama-3.3   │
│  API webhook │       │  Dispatcher  │       │  Workflow    │       │  70b-versatile│
└──────────────┘       └──────┬───────┘       └──────┬───────┘       └──────────────┘
                              │                      │
                              │   ┌──────────────────┘
                              ▼   ▼
                       ┌──────────────┐       ┌──────────────┐
                       │  PostgreSQL  │       │  Meta Cloud  │
                       │  CRM data    │       │  Outbound    │
                       │              │       │  Send API    │
                       └──────────────┘       └──────────────┘
```

### Componentes clave

| Componente              | Tecnología                                                | Función                                             |
| ----------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| CRM dispatch            | `apps/api/src/modules/agents/agents.service.ts`           | Recibe eventos y los envía al webhook del agente    |
| Webhook del agente      | `apps/api/src/modules/whatsapp/whatsapp.controller.ts`    | Recibe mensajes de Meta y los inyecta al EventBus   |
| Workflow automatización | n8n (Docker: `nexa-n8n`)                                  | Orquesta: busqueda → LLM → acciones CRM → respuesta |
| LLM                     | Groq API (OpenAI-compatible)                              | Analiza la intención y propone acción               |
| Escritura al CRM        | `apps/api/src/modules/agents/agent-actions.controller.ts` | Endpoint POST `/api/v1/agent-actions/*`             |

---

## 2. Activar el WhatsApp AI Agent en una organización

### 2.1 Requisitos previos

- Plan **pro** activo en la organización (campo `requiredPlan` = `pro`)
- Plugin `whatsapp` instalado y activo en la organización
- Suscripción de agente del tipo `whatsapp_ai` con un `apiKey` emitido

### 2.2 Flujo de activación

```sql
-- Crear plugin whatsapp
INSERT INTO plugins (id, "organizationId", name, "displayName", version, source, "installedById", "isActive")
VALUES ('plug-whatsapp-xxxx', 'org_xxx', 'whatsapp', 'WhatsApp', '1.0.0', 'core', 'user_xxx', true);

-- Crear suscripción de agente + API key
INSERT INTO agent_subscriptions (id, "organizationId", "agentId", "apiKey", "isActive")
VALUES ('sub_xxx', 'org_xxx', 'agent-whatsapp-ai', 'ag_xxxxxxxxxxxx', true);
```

El `apiKey` se muestra **una sola vez** al administrador y debe guardarse de forma segura (se usa en los headers de cada llamada n8n → Nexa).

### 2.3 Configurar el canal en Meta

1. Crear cuenta Meta for Developers y app de WhatsApp Business.
2. Obtener `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_TOKEN`.
3. Configurar el webhook de Meta apuntando a:
   ```
   https://<tu-dominio>/api/v1/webhooks/whatsapp/incoming
   ```
4. Configurar el verify token:
   ```
   WHATSAPP_VERIFY_TOKEN=<valor-seguro>
   ```
   (este valor se comparte entre Meta y la variable de entorno de la API)

---

## 3. Workflow de n8n

Workflow ID actual: `ykbla0BS1HY0Uauh` (exportado en `n8n-workflows/whatsapp-ai-agent.json`).

### 3.1 Estructura del flujo

```
1. Webhook (from Nexa)            Recibe POST de Nexa API
2. Extract Data (Function)        Normaliza payload
3. Search Client by Phone (HTTP)   Busca si el cliente ya existe (→ GET /agent-actions/clients/search)
4a. LLM: Analyze Message (Function)     Prepara body para Groq
4b. LLM Call (HTTP)                     POST a Groq (llama-3.3-70b-versatile)
4c. Parse Groq Response (Function)      Recupera datos originales + análisis
5. Generate WhatsApp Response (Function) Genera respuesta contextualizada
6. Send WhatsApp Response (HTTP)        POST a graph.facebook.com (sólo con credenciales Meta reales)
7. Report to Nexa (HTTP)                Callback al CRM (ejecución completada)
```

### 3.2 Campos del payload enviado por Nexa a n8n

```json
{
  "executionId": "<agent_executions.id>",
  "agentId": "agent-whatsapp-ai",
  "organizationId": "<org.id>",
  "event": "whatsapp.message_received",
  "payload": {
    "phoneNumberId": "<de_meta>",
    "from": "<teléfono_remitente>",
    "messageBody": "<texto>",
    "messageId": "<wamid>",
    "receivedAt": "<ISO8601>",
    "organizationId": "<org.id>"
  }
}
```

### 3.3 Headers + auth

Todas las llamadas HTTP del workflow a la API de Nexa usan:

```
x-agent-api-key: <agent_subscriptions.apiKey>
Content-Type: application/json
```

La llamada a Groq usa:

```
Authorization: Bearer <GROQ_API_KEY>
Content-Type: application/json
```

> **Importante**: Las credenciales se almacenan dentro del workflow como headers directos, no como `n8n-nodes-base.httpRequest` con `credentials` anidadas (la versión 3 del nodo presenta incompatibilidades con `genericCredential` en este release de n8n).

### 3.4 Activar / desactivar

```bash
PATCH  /rest/workflows/<id>   # actualizar definición
POST   /rest/workflows/<id>/activate   body: {"versionId":"<uuid>"}
POST   /rest/workflows/<id>/deactivate body: {"versionId":"<uuid>"}
```

---

## 4. Endpoints relevantes en la API

| Endpoint                               | Método   | Auth                   | Uso                         |
| -------------------------------------- | -------- | ---------------------- | --------------------------- |
| `/api/v1/webhooks/whatsapp/incoming`   | GET/POST | ninguno (verify token) | Webhook entrante de Meta    |
| `/api/v1/agent-actions/clients`        | POST     | `x-agent-api-key`      | Crear cliente               |
| `/api/v1/agent-actions/clients/search` | GET      | `x-agent-api-key`      | Buscar por phone/email      |
| `/api/v1/agent-actions/deals`          | POST     | `x-agent-api-key`      | Crear oportunidad           |
| `/api/v1/agent-actions/tasks`          | POST     | `x-agent-api-key`      | Crear tarea                 |
| `/api/v1/webhooks/agents/callback`     | POST     | `x-agent-api-key`      | Callback de n8n al terminar |

### CSRF

Los endpoints `/api/v1/agent-actions/**` están exentos del CSRF middleware (ver `csrf.middleware.ts`).

---

## 5. Variables de entorno necesarias (API)

```bash
GROQ_API_KEY=<gsk_...>               # Se usa para el workflow, opcional en API
WHATSAPP_VERIFY_TOKEN=<verify-token> # Webhook de Meta
WHATSAPP_PHONE_NUMBER_ID=<id>        # ID del número comercial (post-deploy)
```

---

## 6. Local dev (cómo se probó)

1. Iniciar infra: `docker start nexa-postgres nexa-n8n`
2. Iniciar API: `cd apps/api && node dist/main`
3. Crear plugin y suscripción (SQL arriba)
4. Activar workflow con `POST /rest/workflows/<id>/activate`
5. Disparar webhook de prueba:
   ```bash
   curl -X POST -H 'Content-Type: application/json' \
     -d '{"object":"whatsapp_business_account","entry":[{"id":"waba","changes":[{"value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"15551234567","phone_number_id":"test-phone-nid"},"contacts":[{"profile":{"name":"Test"},"wa_id":"5491133221100"}],"messages":[{"from":"5491133221100","id":"wamid-1","timestamp":"1720123456","text":{"body":"Quiero info"},"type":"text"}]},"field":"messages"}]}]}' \
     http://localhost:4000/api/v1/webhooks/whatsapp/incoming
   ```
6. Ver ejecuciones en n8n: `GET /rest/executions?workflowId=<id>`

---

## 7. Pendientes de producción

| Item                                                                                                                   | Estado           | Notas                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credenciales reales de Meta WhatsApp Cloud API en n8n                                                                  | 👈 operador      | Setear `WHATSAPP_TOKEN` dentro del container `nexa-n8n` como variable de entorno, o reemplazarlo por una credencial httpHeaderAuth en los nodos `Send WhatsApp Response`.                                 |
| HTTPS válido para que Meta acepte el webhook                                                                           | 👈 deploy        | Debe ser HTTPS (no self-signed ni en `:4000` directo). Opción recomendada: Reverse proxy Caddy/Nginx frente al API/Frontend con cert emitido por Let's Encrypt.                                           |
| Configurar `WHATSAPP_VERIFY_TOKEN` en Meta Dev Console                                                                 | 👈 deploy        | El API usa `process.env.WHATSAPP_VERIFY_TOKEN ?? 'nexa_whatsapp_verify_2026'` por default — reemplazá la variable de entorno en prod con un valor de alta entropía.                                       |
| Frontend entrega/rotación de `apiKey` por org                                                                          | ✅ hecho         | `GET /api/v1/agents/:id/api-key` y `POST /api/v1/agents/:id/api-key/regenerate`. El modal `ApiKeyDialog` en `apps/web/src/app/(dashboard)/agents/page.tsx` se muestra automáticamente después de activar. |
| Rate limiting de Groq (Free Tier: 30 req/min, 14.4k req/día)                                                           | 👀 monitoring    | Logica de back-off se puede agregar en el Function node antes de invocar Groq. Plan de pago ($) elimina el límite.                                                                                        |
| Refactor de la conexión n8n → Nexa para usar `this.helpers.httpRequest` (Function node) en vez de nodos HTTP múltiples | 💤 mejora futura | El patrón actual (Function + HTTPRequest) es válido y testeado. Solo vale la pena refactorizar cuando crece a >3-4 round-trips por evento.                                                                |

### 7.1 Paso a paso del HTTPS + Meta verify (deploy checklist)

1. **Exponer `https://api.<tu-dominio>/api/v1`** apuntando al NestJS del cluster (puerto 4000).
   - Cert válido de Let's Encrypt (DNS-01 challenge evita exponer el `:80` público si lo configurás manualmente).
   - TLS 1.2+ obligatorio; Meta rechaza TLS 1.0/1.1.
2. **Exponer `https://api.<tu-dominio>/api/v1/webhooks/whatsapp/incoming`** con `Content-Type: application/json`.
3. En **Meta for Developers → App → WhatsApp → Configuration → Webhook**:
   - Callback URL: `https://api.<tu-dominio>/api/v1/webhooks/whatsapp/incoming`
   - Verify Token: el mismo valor en `WHATSAPP_VERIFY_TOKEN` del API
   - Suscribirse a `messages`
4. Probar el handshake GET (Meta lo dispara una sola vez al guardar el webhook):
   ```bash
   curl "https://api.<tu-dominio>/api/v1/webhooks/whatsapp/incoming?hub.mode=subscribe&hub.verify_token=$WHATSAPP_VERIFY_TOKEN&hub.challenge=12345"
   # Esperado: 12345 (texto plano), status 200
   ```
5. En el workflow n8n, configurar `WHATSAPP_TOKEN` real (en el container n8n como env var, **o** mover la autorización al header dinámico `={{ 'Bearer ' + $env.WHATSAPP_TOKEN }}`).
6. **Lanzar la primera conversación real**: desde tu WhatsApp enviar un mensaje al número comercial Meta asociado. Debe crear un cliente al instante en el pipeline. Vé al Dashboard → Agents → logs de `whatsapp_ai` para ver el `COMPLETED` o `FAILED`.
