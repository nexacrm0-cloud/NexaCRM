# PROMPT — Presentación comercial de Nexa CRM

Rol: sos el director creativo y copywriter senior de Nexa CRM. Vas a armar una presentación comercial en formato slide deck (HTML) dirigida a PyMEs latinoamericanas. Objetivo: el cliente cierre en el próximo call. Pública, franca, sin humo.

La presentación se construye con la skill `slides` del assistente (HTML + Chart.js + design tokens). Cargá primero esa skill para respetar las convenciones de diseño.

---

## 1. Audiencia y tono

- **Audiencia**: dueño / gerente comercial / CFO de una PyME argentina (8 a 80 empleados) que hoy usa Pipedrive, HubSpot, planillas de Excel, o WhatsApp suelto. Facturan en AFIP (Argentina) — aunque también les habla a México/Colombia/Chile/PerúUrugu/Brasil por soporte de monedas MXN/COP/CLP/PEN/UYU/BRL.
- **Audiencia secundaria**: estudios contables, agencias digitales, e-commerce (Shopify/WooCommerce), servicios profesionales con reuniones recurrentes.
- **Tono editorial**: directo, conciso, en español rioplatense (vos, imperativos en -á: cotizá, facturá, cancelás). Estética "recibo / sello postal", no "SaaS dashboard genérico".
- **Voz de marca**: Fraunces tipográfica, eyebrows con punto naranja (·), numerales liminares (01·, 02·, 03·), sellos uppercase con `tracking-[0.18em]`. No usar emojis.
- **Regla crítica**: frases basadas en claim reales. No inventar features. Todo lo que se venda tiene que existir en el código.

---

## 2. Propuesta de valor rectora

**Tagline principal (de layout.tsx)**:

> "Nexa — CRM y facturación para PyMEs latinoamericanas"

**Promise editorial (de layout.tsx)**:

> "Cotizá, facturá y cobrá sin fricción."

**Posicionamiento diferencial (de DEMO_SCRIPT.md)**:
Hicks: pasá de un CRM pasivo (donde guardás datos) a un CRM activo: la IA analiza, alerta, pronostica y automatiza. El Copilot responde preguntas de negocio en segundos, no listas muertas.

**Cierre de presentation (basado en DEMO_SCRIPT.md línea 134)**:

> "Proba 14 días gratis con tus datos reales. Si en la semana 1 el Copilot no te ahorra 5 hs/semana o no detecta al menos 1 riesgo real, no pagás."

---

## 3. Estructura obligatoria (slides)

Mín. 12 slides, máx. 16. Estructura:

1. **Portada** — Logo "Nexa" tipográfico (N inversa) + eyebrow "NEXA · CRM & Facturación" + tagline "Cotizá, facturá y cobrá sin fricción." + cofre ctual con "Presentación · 2026".

2. **El problema** — un solo claim crítico: _"Un CRM pasivo es una planilla cara."_ 3 viñetas con `.eyebrow` numeradas: `01·` Tu CRM recuerda pero no actúa · `02·` Tu equipo pierde 1 día/semana armando reportes · `03·` Los presupuestos se pierden si nadie los persigue. Footer con sello `alizarin`: "Crm dormant = dinero dormido".

3. **Nexa en una frase** — una sola frase Fraunces 56pt, centrada: _"El CRM que analiza, alerta y automatiza mientras vos dormís."_ Subtítulo copy muted: "Dejar de guardar datos. Empezar a cobrar." Eyebrow unrefernced: "Qué es Nexa".

4. **3 pilares (grid de 3 tarjetas)**:
   - **01· CRM completo** — clientas 360°, pipeline drag&drop con forecast ponderado, presupuestos → facturas automáticas, inventario trazable, calendario con recurrencias. Sello `cobalt`: "OperacIoNAL".
   - **02· IA Copilot** — escribí _"resumen ejecutivo"_ o _"cómo va la oportunidad de Acme"_ y recibí insights, alertas y forecast. Sello `naranja`: "AUTO".
   - **03· Automatizaciones** — plantillas de WhatsApp / Slack / Mailchimp que se disparan solas. Activás en 1 click, prendé n8n en la punta. Sello `verde`: "24/7".

5. **Cómo se ve el CRM activo** — mockup-style card con copia editorial de un diálogo Copilot:
   - User: _"¿Cuánto vendo este mes?"_ → Nexa: "$487.200, +18% vs mes anterior, 2 deals a punto de cerrar por $124.000."
   - User: _"Presupuestos sin responder"_ → Nexa: "6 presupuestos sin respuesta hace 7+ días. Top prioridad: Acme ($47.000) — lo recupero yo si querés."
     Sello `naranja` con "COPILOT".

6. **17 módulos en una sola lámina** — tabla compacta numerada con todas las features (de `01-Dashboard` a `17-Soporte`). Cada fila con eyebrow + nombre + 2 palabras. No abrímeytter aquí; solo mostrar volumen real. Sello `cobalt`: "Cobertura".

7. **IA Tools — los 28 tools que el Copilot ejecuta** — grid Cheng. Cada tool con su descripción corta. Agrupar por categoría:
   - **Resumen ejecutivo** (`get_executive_summary`): health score 0-100 + KPIs + top 3 acciones.
   - **Insights** (`get_business_insights`, `get_recommended_actions`, `get_proactive_alerts`).
   - **Forecast** (`get_financial_forecast`, `get_pipeline_health`).
   - **Client health / churn** (`get_client_health`).
   - **Operaciones** (`get_inventory_summary`, `get_low_stock_products`, `get_product_stock`).
   - **Busquedas** (`global_search`, `search_clients`, `get_client_full_profile`).
   - **Acciones** (`create_client`, `create_task`).
   - **Dashboards & follow-up** (`get_dashboard_summary`, `get_dashboard_metrics`, `get_due_tasks`, `get_pending_tasks`, `get_overdue_tasks`, `get_unanswered_quotes`, `get_stale_opportunities`, `get_inactive_clients`, `get_monthly_sales`, `get_open_opportunities`, `get_activity_week`, `get_client_deals`, `get_client_quotes`, `get_client_tasks`, `get_client_count`).
     Footer con sello `naranja`: "No lista muertas".

8. **6 agentes IA activables** — 6 tarjetas con iconos. Para cada uno: nombre, plan requerido, copy de 1 línea + 3 features con bullets.
   - **Business Copilot** (`pro`): tu analista IA. Features: insights proactivos, forecast financiero, salud del pipeline.
   - **Agente de Ventas** (`pro`): atiende consultas 24/7. Features: responde consultas, califica leads, crea oportunidades.
   - **Asistente WhatsApp** (`pro`): gestiona WhatsApp Business. Features: chat inteligente, lead qualification, auto-reply.
   - **Agente de Seguimiento** (`starter`): recupera ventas perdidas. Features: detecta inactivos, comments recordatorios, reporte semanal.
   - **Analista de Negocios** (`pro`): reporte de métricas en Slack/email cada lunes. Features: tendencias, riesgos, executive summary.
   - **Agente de Operaciones** (`enterprise`): coordina equipos. Features: detección de cuellos de botella, optimización de procesos.

9. **6 plantillas de automatización** — cards con trigger y precio ARS/mes. Hero destacado = `whatsapp-first-response` ($4.900). After: `$2.900–$6.900/mes`, **14 días de trial sin tarjeta**.
   - `whatsapp-first-response` (client.created) — $4.900 — _WhatsApp primer mensaje._
   - `whatsapp-quote-notification` (quote.sent) — $3.900 — _WhatsApp factura enviada._
   - `slack-new-deal` (deal.created) — $2.900 — _Slack postea nueva oportunidad._
   - `mailchimp-new-client` (client.created) — $2.900 — _Mailchimp suma cliente._
   - `invoice-finance-alert` (invoice.issued) — $6.900 — _Aviso interno a finanzas._
   - `task-overdue-reminder` (task.created) — $2.900 — _Recordar tareas vencidas._
     CTA largo: "Activás. Probás. Si no te queda, cancelás."

10. **11 conectores out-of-the-box** — grid con badges. **WhatsApp Business** (API oficial con idempotencia), **Mercado Pago** ("Pagos para Argentina y LATAM"), **Stripe**, **Shopify**, **WooCommerce**, **Slack**, **Microsoft Teams**, **Google Calendar**, **Google Sheets**, **Email (SMTP)**, **Webhook custom**. Eyebrow: "Plag-and-play. Sin infra extra."

11. **Diferencial AFIP / Argentina** — slide dedicada. Salientes:
    - Facturas A/B/C/E/M con `pointOfSale`, `cuit`, `ivaCondition`, `cae`, `caeExpiresAt` ya en el schema.
    - PDF generado con sello + tipo + CAE receptado, listo para imprimir.
    - Moneda default ARS, `Intl.NumberFormat('es-AR')`.
    - Mercado Pago LATAM (versión Argentina).
    - Sello `naranja`: "Hecho en Argentina".

12. **Multi-tenant + seguridad real** — bullet list:
    - Row-Level Security (RLS) en PostgreSQL. Cada organizations aísla datos en runtime (`set_config('app.organization_id', $orgId, true)`).
    - JWT con HttpOnly cookies + rotación y detección de robo de refresh token.
    - 2FA con QR (TOTP) configur行事amente.
    - Rate-limiting global + blacklist Redis.
    - Throttler por organization y por endpoint IA.
    - Audit logs particionados por mes, retención declarada (activity 6m / audit 2a).
    - Logs de inventario: "Cada alta, baja o ajuste queda registrado. Trazabilidad para auditoría."
      Sello `verde`: "Listo para cumplir."

13. **Planes y precios** — tabla de 4 columnas con sellos:
    - **Básico** (free): hasta 3 usuarios, 100 clientes. "CRM completo, pipeline, tareas, presupuestos, facturación." Sin sello.
    - **Starter** ($29/mes): sello `cobalt` "POPULAR". 10 usuarios, 1.000 clientes, + Automatizaciones + Agente de Seguimiento IA, soporte email.
    - **Pro** ($79/mes): sello `naranja` "MÁS ELEGIDO". 25 usuarios, 10.000 clientes, + Agente de Ventas + Analista Negocios IA, conectores premium, soporte prioritario.
    - **Enterprise** ($199/mes): sello `verde` "MÁXIMO". Usuarios ilimitados, + Agente de Operaciones IA, API completa, soporte dedicado, SLA 99.9%, onboarding personalizado.
      Footer: "Todos los planes incluyen soporte, actualizaciones y sin permanencia." + "Automatizaciones: 14 días gratis, sin tarjeta."

14. **ROI — comparativa** — lámina con un solo cuadro (de DEMO_SCRIPT.md):

    > 1 analista junior = $1.500/mes · Nexa Pro = fracción de eso · 24/7 · sin vacaciones · sin onboarding · ROI inmediato.
    > Eyebrow: "ROI inmediato." Sello `naranja`: "MATEMÁTICA SIMPLE".

15. **Casos de objection handling** — tabla 3x con 3 filas (de DEMO_SCRIPT.md):
    - _"Ya tenemos Pipedrive/HubSpot"_ → _Esos son CRM pasivos: guardan datos. Nexa es activo: analiza, alerta, pronostica, automatiza._
    - _"Es caro"_ → _Comparerá con 1 analista junior. ROI en menos de 1 mes._
    - _"Mi equipo no lo va a usar"_ → _Tienen ChatGPT en el teléfono. La curva de adopción es la misma._

16. **Cierre / CTA** — Fraunces 64pt, centrado: _"Proba 14 días con tus datos reales."_ Subtítulo: _"Si en la semana 1 el Copilot no te ahorra 5 hs/semana o no detecta al menos 1 riesgo real, no pagás."_ Sello grande `naranja`: "EMPEZÁ HOY". Footer con mailto: **nexacrm0@gmail.com**.

---

## 4. Tokens de diseño (validados de `globals.css`)

```
--paper:    hsl(41  35% 89%)  /* fondo hueso */
--paper-2:  hsl(41  32% 84%)
--receipt:  hsl(0   0%  100%) /* blancos card */
--ink:      hsl(0   0%  10%)  /* tinta */
--ink-2:    hsl(0   0%  22%)
--ink-3:    hsl(30  5%  38%)  /* muted */
--cobalt:   hsl(227 70% 46%)
--naranja:  hsl(17  100% 56%) /* ACENTO PRINCIPAL */
--verde:    hsl(142 50% 22%)
--alizarin: hsl(4   65% 47%)
```

- `--font-display`: Fraunces (convariable optical size).
- `--font-sans`: Inter.
- `--font-mono`: JetBrains Mono.
- Patrones: `.eyebrow` con cuadrado naranja antepuesto, `.stamped` = sello con `border-2 border-double` + rotate -1deg, `.numeral` + `.tabular` + `.fade-up` con delay.
- Esquinas: `rounded-[2px]` (casi a 0), no redondas tradicionales.
- Estética: **recibo / boleta / sello postal editorial**. Sin sombras grandes. Bordes `1px` finos con `ink/14`.

---

## 5. Charts sugeridos (Chart.js)

- **Slide 4 (cómo se ve el CRM activo)**: NO chart, es mockup texto.
- **Slide 11 (planes)**: NO chart, es pricing.
- **Slide 14 (ROI)**: bar chart comparativo horizontal: "Analista junior $1.500/mes" vs "Nexa Pro $79/mes" (la barra verde cortando al alizares). Mismo con "horas/semana" — "5h manual" vs "0h automatizado".
- **Slide 6 (17 módulos)**: tabla no chart.

Tonalidad de los charts: `--naranja` (accionable), `--verde` (ganancia), `--alizarin` (costo), `--ink/3` (mute). Sin gradientes grands. Background: `--paper`.

---

## 6. Reglas críticas

1. **Todo lo que se venda tiene que existir en el código.** Si no estás seguro de una feature, no la menciones. Es preferible una lámina más austera que una promesa inventada.
2. **0 emojis, 0 borneras genéricas SaaS** ("unleash", "supercharge", "10x"). Tono editorial argentino.
3. **Cada slide tiene un sello** (Stamp) con su categoría. 6 tonos disponibles: ink, cobalt, naranja, verde, alizarin, mute.
4. **El Copilot habla en primera persona** ("analice", "te recomiendo", "lo recupero yo"). El producto siempre en segunda persona argentina ("vos tenés", "activás", "cancelás").
5. **Nunca mentir**: no prometé AFIP conectado al WSFE — explainá que el schema está listo (A/B/C/E/M, CAE, punto de venta) y la integración con WSFE es post-beta. Si mencionás WhatsApp, aclará WhatsApp Business API oficial con idempotencia.
6. **Pricing en USD/mes** ($29/$79/$199). Automatizaciones en **ARS/mes** ($2.900–$6.900) — esto es real, porque los templates se cobran en ARS vía Mercado Pago.
7. **Si una modalidad de claim no se sostiene en la evidencia del paso previo, NO incluyas el claim.** Cita exacta siempre > adorno.
8. **No uses jerga meramente comercial.** Usá vocabulario concreto del producto: "pipeline", "presupuesto", "factura A/B/C", "CAE", "Workflow", "Copilot", "agentes IA", "conectores".

---

## 7. Entrega

- Una sola página HTML standalone con todos los slides (scroll vertical), navegación lateral con dots.
- Chart.js incluido vía CDN.
- Design system inline con los tokens arriba.
- Responsive — mobile sin scroll lateral.
- Botón "Pedir demo" bottom-right fijo → `mailto:hola@nexa.com.ar?subject=Demo de Nexa CRM`.
- Meta title: "Nexa CRM — Presentación comercial".

Al generar cada slide, ejecutá la skill `slides` para respetar el patrón estratégico y los tokens. No improvisar el CSS.

---

## 8. Vocabulario de marque "para citar" — usar textualmente

Frases de branding reales verificadas (de `(public)/pricing`, `(public)/automation/pro`, `DEMO_SCRIPT.md`, `layout.tsx`):

- "Cotizá, facturá y cobrá sin fricción."
- "Elegí el plan que se ajusta a tu negocio."
- "Desde un CRM básico hasta agentes de IA que operan 24/7."
- "Cambiás de plan cuando quieras, sin letra chica."
- "Todos los planes incluyen soporte, actualizaciones y sin permanencia mínima."
- "Agentes y automatizaciones que trabajan mientras dormís."
- "Activás. Probás. Si no te queda, cancelás."
- "Sin permanencia, sin llamada comercial. La activación toma menos de un minuto."
- "Esos son CRM pasivos (guardar datos). Nexa es activo: IA analiza, alerta, pronostica, automatiza."
- "Un gerente hace estas preguntas en Slack/Email y espera horas. Acá la respuesta es instantánea, con datos VIVOS de tu CRM."
- "ROI inmediato. Compará: 1 analista junior = $1.500/mes. Nexa Pro = fracción de eso."
- "Agentes que corren tareas por vos, 24/7. Activá los que ya pagás."
- "Cada alta, baja o ajuste queda registrado. Trazabilidad para auditoría."
- "14 días de prueba gratis, sin tarjeta."
- "Si en la semana 1 el Copilot no te ahorra 5 hs/semana o no detecta al menos 1 riesgo real, no pagás."
- "¿Algo especial? Contactanos — nexacrm0@gmail.com".

Listo. Construí la presentación completa.
