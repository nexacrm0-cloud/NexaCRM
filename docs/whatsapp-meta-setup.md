# WhatsApp Cloud API — Setup Guide (Meta Sandbox → Production)

> Paso a paso para obtener tokens, configurar el webhook correctly, y validar el handshake end-to-end con la app en cualquier ambiente.

---

## 1. Crear la app en Meta for Developers

1. Ir a [developers.facebook.com](https://developers.facebook.com) → Apps → **Create App**.
2. Tipo: **Business** (lo más flexible para WhatsApp).
3. En tu app, en "Add a Product", agregar **WhatsApp**.
4. Production vs Development: Meta te da 5 números de test sandbox de entrada (los administradores) y 1 número de salida de test.

## 2. Obtener tokens y phone_number_id

Una vez instalado el SDK de WhatsApp en la app:

```bash
# Variables de entorno permanentes → apps/api/.env
WHATSAPP_TOKEN=<permanent_access_token_64_chars>   # WhatsApp → API Setup → Temporary access token (regenerate cada 23h en Sandbox)
WHATSAPP_PHONE_NUMBER_ID=<el_wamid>               # WhatsApp → API Setup → Phone Number ID
WHATSAPP_VERIFY_TOKEN=<32_bytes_hex>              # Cualquier valor, lo que pongas aca tiene que coincidir con lo que Meta verifica
WHATSAPP_APP_SECRET=<app_secret_32_hex>            # Settings → Basic → App Secret (copy+reveal)
```

En Meta Developers: **WhatsApp → Configuration → API Setup**:

- Seleccionar `whatsapp_business_account` y darle permisos.
- Click "Regenerate" para obtener el access token.
- Phone number ID está arriba a la izquierda.

> ⚠️ En environment de Sandbox, Meta SOLO envía webhooks para los 5 números de admin (los que tienen 2FA activado en sus cuentas personales Meta). Para producción real: **WhatsApp → Configuration → Phone Numbers → Add phone number** + verificación business de Meta.

## 3. Configurar el Webhook (HUBS)

En **WhatsApp → Configuration → Webhook**:

| Campo         | Valor                                                           |
| ------------- | --------------------------------------------------------------- |
| Callback URL  | `https://api.<tu-dominio>/api/v1/webhooks/whatsapp/incoming`    |
| Verify token  | EL MISMO `WHATSAPP_VERIFY_TOKEN`                                |
| Suscribirse a | `messages`, `message_template_quality_update`, `account_alerts` |

Meta dispara un handshake GET automático al guardar. La API de Nexa ya lo responde:

```
GET /api/v1/webhooks/whatsapp/incoming?hub.mode=subscribe&hub.verify_token=...&hub.challenge=12345
→ 200 OK body=12345
```

**Test manual desde shell**:

```bash
TOKEN=$(grep WHATSAPP_VERIFY_TOKEN apps/api/.env | cut -d= -f2)
curl "https://api.<tu-dominio>/api/v1/webhooks/whatsapp/incoming?hub.mode=subscribe&hub.verify_token=$TOKEN&hub.challenge=test_12345"
# Esperado: 200 OK, body "test_12345"
```

## 4. Configurar el n8n workflow

El workflow `n8n-workflows/whatsapp-ai-agent.json` espera 2 cosas del entorno de n8n:

### 4.1 Token de Groq (obligatorio)

En el container n8n setear la env var:

```yaml
# docker-compose.yml
services:
  n8n:
    environment:
      - GROQ_API_KEY=gsk_...
```

O secret vía docker secrets.

### 4.2 Token de Meta (opcional, producción)

El workflow tiene dos formas configurables:

a) **Container env var** (recomendado): editar `docker-compose.yml`:

```yaml
services:
  n8n:
    environment:
      - WHATSAPP_TOKEN=EAAJBxxxxxxx... # 64 chars de Meta
```

El nodo `Send WhatsApp Response` en n8n referenciará via `process.env.WHATSAPP_TOKEN` automáticamente. Sin modificaciones de UI.

b) **Credencial dentro de n8n**: Crear en n8n credencial `httpHeaderAuth` con header `Authorization=Bearer <token>`. Modificar el nodo para usarla. (No recomendado: se ve el token dentro del workflow; se pierde al reimportar desde JSON.)

## 5. Sandbox → Production checklist

| Paso                                                                                    | Sandbox (test)        | Producción                                                      |
| --------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------- |
| Crear app + Add Product WhatsApp                                                        | ✓                     | ✓                                                               |
| Obtener `Temporary access token` (regenerate cada 23h) o `Permanent token` (long-lived) | Temporary only        | **Permanent token** (Enterprise tier)                           |
| App secret (HMAC)                                                                       | opcional              | **obligatorio** (siempre)                                       |
| Webhook URL configurado                                                                 | ✓                     | ✓                                                               |
| Phone numbers de admin (test sandbox)                                                   | ✓ (5 max)             | N/A                                                             |
| Numero commercial real verificado por Meta                                              | no                    | **sí** (requiere business verification + payment setup en Meta) |
| Suscripción al webhook de varios tipos de eventos                                       | solo `messages`       | `messages + account_alerts + message_template_quality`          |
| Rate limits                                                                             | 1k conversaciones/día | según tier / plan de facturación                                |
| Apparition en WhatsApp Business Manager                                                 | test                  | **published**                                                   |

## 6. Probar end-to-end en sandbox

```bash
# 1. Mensaje de prueba al número sandbox → te llega la conversación
# 2. Mira el webhook → cat apps/api/dist/main.log
# 3. flower:  -- se dispara el workflow desde n8n
docker exec nexa-n8n sh -c "tail -f /home/node/.n8n/logs/*"
# 4. Logs del workflow execution en n8n → Executions
# 5. Resultado en DB:
docker exec nexa-postgres psql -U nexa -d nexacrm -c "SELECT id, status FROM agent_executions ORDER BY \"startedAt\" DESC LIMIT 5;"
```

## 7. Checklist de troubleshooting

| Síntoma                                            | Causa probable                                                   | Fix                                                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 403 al guardar webhook                             | TLS/self-signed / Meta exige HTTPS válido                        | Cert Let's Encrypt                                                                                       |
| `invalid verification token` desde Meta            | El `WHATSAPP_VERIFY_TOKEN` no coincide                           | Verificar config Meta y API                                                                              |
| Webhook se recibe pero no se dispara el workflow   | `WHATSAPP_VERIFY_TOKEN` no está en `.env`                        | Reiniciar API                                                                                            |
| Workflow activa pero agent_execution queda RUNNING | `host.docker.internal` no resuelve desde container `nexa-n8n`    | Sí en Docker Desktop; en Linux prod: red `host` o IP del API gateway                                     |
| Groq responde 429                                  | Free tier 30 req/min                                             | Workflow tiene `retryOnFail=3, waitBetweenTries=2000`, pero si continúa, considerar Plan de pago de Groq |
| `Cant read properties of undefined` en n8n         | n8n v2.28.3 + bug del Function node                              | El Function node usa `this.helpers.httpRequest` (no `fetch`); ya corregido en este proyecto              |
| El cliente se crea duplicado                       | Replay de Meta webhook en otra suscripción con mismo `messageId` | Idempotency check por `messageId` (en `whatsapp_processed_messages`) ya activo                           |

## 8. Sanity matrix

| URL                                                                                                    | Test happy path                                             | Test wrong/missing config                                                         |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `GET /api/v1/webhooks/whatsapp/incoming?hub.mode=subscribe&hub.verify_token=$TOKEN&hub.challenge=test` | `200 OK`, body `test`                                       | `400` con mensaje "Verification failed"                                           |
| `POST /api/v1/webhooks/whatsapp/incoming` (estructura válida, HMAC verificar=ON)                       | `200 {status:dispatched, executionId:...}`                  | `401` si HMAC falta; `400` si payload shape OK pero no conectado a config de Meta |
| Mismo POST enviado 2 veces con el mismo `messages[*].id`                                               | 1 × `dispatched`, 2 × `duplicate` (status 200 OK en ambos)  | Idempotency garantiza 1 dispatch por messageId                                    |
| `POST /api/v1/webhooks/whatsapp/incoming` con `messages[].type=image` (no es "text")                   | `200 {status:unsupported_message_type}`                     | Status 200 OK, no dispara workflow                                                |
| Workflow activo con credenciales Meta reales + número real                                             | LLM detecta intent, crea cliente CRM, devuelve msg via Meta | agent_execution=COMPLETED en DB                                                   |

---

### References

- [Meta WhatsApp Cloud API - Quickstart](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Meta WhatsApp Webhook Setup](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [HMAC Signature Validation](https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads)
- [Rate Limits](https://developers.facebook.com/docs/whatsapp/cloud-api/overview#limits)
- [Groq Pricing & Rate Limits](https://console.groq.com/docs/rate-limits)
