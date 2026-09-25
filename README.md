# Nexa CRM

**Cotizá, facturá y cobrá sin fricción.**

Nexa es un CRM y facturador inteligente para PyMEs latinoamericanas. A diferencia de los CRM tradicionales (pasivos, que solo guardan datos), Nexa es **activo**: la IA analiza, alerta, pronostica y automatiza. Vos preguntás, Nexa responde — con datos vivos de tu negocio.

---

## Qué hace

- **Dashboard ejecutivo** — KPIs en vivo: ventas del mes, pipeline ponderado, oportunidades abiertas, tareas vencidas.
- **Clientes 360°** — historial completo: deals, tareas, presupuestos, facturas y actividad en una sola vista.
- **Pipeline Kanban** — drag & drop, etapas configurables con probabilidad, forecast ponderado.
- **Presupuestos y facturación** — cotizaciones con numeración automática, PDF descargable, factura electrónica A/B/C/E/M con CUIT, condición de IVA y CAE (listo para AFIP).
- **Inventario** — productos con SKU, variantes, stock mínimo/máximo y descuento atómico al facturar.
- **Calendario** — vistas Mes/Semana/Día/Agenda, eventos recurrentes vinculados a clientes y oportunidades.
- **Automatizaciones** — webhooks a n8n con plantillas de un click (WhatsApp, Slack, Mailchimp, alertas financieras).
- **11 conectores** — WhatsApp Business, Email, Google Calendar, Slack, Teams, Stripe, Mercado Pago, Shopify, WooCommerce, Google Sheets y webhook genérico.

## IA: el corazón del producto

### Business Copilot

Asistente IA dentro del CRM que responde preguntas de negocio en lenguaje natural, consultando la base de datos en tiempo real:

- `resumen ejecutivo` → health score 0-100, KPIs, alertas y top 3 acciones
- `alertas proactivas` → tareas vencidas, deals estancados, presupuestos sin responder
- `salud de clientes` → scoring de churn risk por cliente
- `pronóstico financiero 6 meses` → proyección con pipeline ponderado
- `cuánto stock tengo` → valor de inventario, sin stock, stock bajo

### 6 agentes IA 24/7

Agentes que corren en background y escriben en el CRM como un empleado más:

| Agente                | Plan       | Qué hace                                                        |
| --------------------- | ---------- | --------------------------------------------------------------- |
| Business Copilot      | Pro        | Análisis general, insights y acciones recomendadas              |
| Agente de Ventas      | Pro        | Atiende consultas, califica leads, genera presupuestos          |
| Asistente WhatsApp    | Pro        | Responde, califica y da seguimiento en WhatsApp Business        |
| Agente de Seguimiento | Starter    | Recordatorios, presupuestos vencidos, nunca se escapa una venta |
| Analista de Negocios  | Pro        | Resumen ejecutivo cada lunes en Slack o email                   |
| Agente de Operaciones | Enterprise | Detecta cuellos de botella y optimiza procesos                  |

## Stack técnico

- **Backend:** NestJS 10, Prisma 6, PostgreSQL 16, Redis, OpenAI SDK, Zod, pdfkit, Resend
- **Frontend:** Next.js 14 (App Router), Tailwind 3, Radix UI + shadcn/ui, TanStack Query 5, recharts
- **Infra:** Monorepo pnpm + Turborepo, Docker Compose (Postgres + Redis + n8n), 84 tests

## Seguridad

- Multi-tenant aislado con **Row-Level Security** en PostgreSQL (filtrado a nivel de motor, no de código)
- JWT en cookies HttpOnly con rotación de refresh token
- 2FA (TOTP) con código QR
- Rate limiting global y por organización
- Audit logs particionados por mes

## Planes

| Plan       | Precio         | Usuarios   |
| ---------- | -------------- | ---------- |
| Básico     | Gratis         | 3          |
| Starter    | USD 29/mes     | 10         |
| **Pro**    | **USD 79/mes** | **25**     |
| Enterprise | USD 199/mes    | Ilimitados |

Todos los planes incluyen soporte, actualizaciones y sin permanencia mínima. **14 días de prueba gratis, sin tarjeta.**

## Desarrollo local

```bash
# Requisitos: Node 20+, pnpm, Docker
pnpm install
docker compose up -d      # Postgres + Redis + n8n
pnpm --filter @nexa/database run seed
pnpm run dev              # Web: http://localhost:3002 · API: http://localhost:4000
```

Usuario demo: `demo@nexa.com` / `demo123`

## Contacto

**nexacrm0@gmail.com**

> _Nexa — CRM y facturación para PyMEs latinoamericanas._
