# 🎯 DEMO SCRIPT - NEXA CRM

**Duración:** 15-20 min | **Objetivo:** Cerrar venta mostrando valor inmediato

---

## 📋 PREPARACIÓN (2 min antes)

```bash
# 1. Levantar la app
cd "C:\Users\mateo\Documents\Nexa CRM"
pnpm run dev

# 2. Abrir 2 pestañas
# - http://localhost:3002 (Web App)
# - http://localhost:4000/api/v1 (API docs si existe)
```

**Datos de prueba listos:**

- Usuario: `demo@nexa.com` / `demo123`
- Org: "Demo Corp" (ya seedada con deals, clients, products, tasks)

---

## 🎬 SCENE 1: DASHBOARD EJECUTIVO (2 min)

> **"Esto es lo que ves al entrar. Un pulso del negocio en 3 segundos."**

| Acción                     | Qué decir                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| Abrir `/dashboard`         | "KPIs reales: facturación del mes, pipeline ponderado, oportunidades abiertas, tareas vencidas" |
| Señalar tarjetas           | "Todo calculado en tiempo real desde tus deals, no datos estáticos"                             |
| Click en "Ver análisis IA" | "Aquí entra el **Business Copilot** — probémoslo ahora"                                         |

---

## 🎬 SCENE 2: AI BUSINESS COPILOT - EL DIFERENCIADOR (5 min)

> **"Tu analista de negocios 24/7. No dashboards, respuestas."**

### Demo commands (copiar/pegar en el chat 💬):

| Comando                         | Qué muestra                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `resumen ejecutivo`             | **Health score 0-100**, KPIs, alertas, top 3 acciones priorizadas                                   |
| `alertas proactivas`            | Tareas vencidas, deals estancados 20+ días, presupuestos sin respuesta, clientes inactivos 90+ días |
| `cómo va el pipeline`           | Salud por etapa, win rate, velocidad, riesgos con severidad                                         |
| `salud de clientes`             | Scoring churn risk: EXCELENTE/BUENO/REGULAR/RIESGO/CRÍTICO por cliente                              |
| `pronóstico financiero 6 meses` | Proyección mensual con confianza decreciente, pipeline ponderado, assumptions                       |
| `cuánto stock tengo`            | Valor inventario (costo), ingreso potencial (precio), sin stock, stock bajo, top movidos            |
| `productos con stock bajo`      | Lista con déficit y qty sugerida de reorden                                                         |
| `stock de MacBook Pro`          | Lookup fuzzy por SKU/nombre con stock, min/max, unidad                                              |

**Pitch:** _"Un gerente hace estas preguntas en Slack/Email y espera horas. Acá la respuesta es instantánea, con datos VIVOS de tu CRM."_

---

## 🎬 SCENE 3: PIPELINE VISUAL (3 min)

> **"Kanban real, no Trello. Arrastra y suelta = dato actualizado."**

| Acción              | Qué decir                                                                        |
| ------------------- | -------------------------------------------------------------------------------- |
| Ir a `/pipeline`    | "Etapas configurables, colores, win/lose stages"                                 |
| Drag & drop un deal | "Un movimiento = stage actualizado + activity log + event emitido para webhooks" |
| Click en deal       | "Contexto completo: client, quotes, tasks, activity log, emails"                 |
| Botón "Pronóstico"  | "Forecast ponderado por probabilidad + historical win rate"                      |
| Filtros avanzados   | "Por stage, valor, fecha cierre, assigned, cliente, search"                      |

---

## 🎬 SCENE 4: CALENDARIO INTELIGENTE (2 min)

> **"Tu agenda + CRM. Eventos recurrentes = set & forget."**

| Acción                     | Qué decir                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Ir a `/calendar`           | "Mes/Semana/Día/Agenda. Click en slot = crear evento"                                     |
| Crear evento recurrente    | "Tipo: Reunión/Llamada/Tarea. **Repetir: Semanal/Mensual**. EXDATE para excepciones"      |
| Indicador visual           | "Borde punteado + rayas = recurrente. Se expande en backend (rrule) hasta 200 instancias" |
| Click en evento recurrente | "Edita la serie o solo una instancia"                                                     |

---

## 🎬 SCENE 5: INVENTARIO + VENTAS (2 min)

> **"Stock real, no planillas. Factura = stock descuenta automático."**

| Acción                           | Qué decir                                                               |
| -------------------------------- | ----------------------------------------------------------------------- |
| Ir a `/inventory`                | "Dashboard: valor stock, potencial revenue, low stock, top movidos 30d" |
| Crear producto con variantes     | "SKU, precio, costo, min/max stock, trackStock ON/OFF"                  |
| Movimiento IN/OUT/ADJUST         | "Trazabilidad completa: quién, cuándo, motivo, qty"                     |
| Crear Quote → Convert to Invoice | "Invoice emite → **stock se descuenta atómico** (transacción)"          |

---

## 🎬 SCENE 6: AI AGENTS - AUTOMATIZACIÓN 24/7 (2 min)

> **"Agentes que trabajan mientras vos dormís. Se activan con un click."**

| Acción                     | Qué decir                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------ |
| Ir a `/agents`             | "Catálogo: Sales, Follow-up, **Business Analyst**, Operations, WhatsApp AI"          |
| Activar "Business Analyst" | "Corre cada mañana: health score, forecast, alerts → te manda resumen a Slack/Email" |
| Mostrar API Key            | "n8n usa esta key para escribir en TU CRM como el agente"                            |
| Logs en vivo               | "Ver cada ejecución: input/output/error/duración"                                    |

---

## 🎬 SCENE 7: CLIENTES 360° (1 min)

> **"Todo el historial en una vista. Cero context switching."**

| Acción                          | Qué decir                                                             |
| ------------------------------- | --------------------------------------------------------------------- |
| Click en cliente desde pipeline | "Deals, Quotes, Tasks, Activity Log, Invoices, Emails — todo linkado" |
| Botón "Preguntar a IA"          | "`¿Cómo va la oportunidad de Acme Corp?` → respuesta contextual"      |

---

## 🎯 CIERRE COMERCIAL (2 min)

### Objections handling:

| Objeción                       | Respuesta                                                                                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Ya tenemos Pipedrive/HubSpot" | "Esos son **CRM pasivos** (guardar datos). Nexa es **activo**: IA analiza, alerta, pronostica, automatiza. El Copilot responde preguntas de negocio, no solo muestra listas." |
| "Es muy complejo"              | "El onboarding es guiado. El Copilot te dice **qué hacer hoy** (prioridades). Los agentes corren solos. Menos clicks, más insights."                                          |
| "Precio"                       | "Compará: 1 analista junior = $1.500/mes. Nexa Pro = fracción de eso, 24/7, sin vacaciones, sin onboarding. ROI inmediato."                                                   |
| "Migración de datos"           | "Importamos CSV/Excel en minutos. API abierta para sync con tu stack actual."                                                                                                 |

### Call to Action:

> **"Probemos 14 días gratis con tus datos reales. Si en la semana 1 el Copilot no te ahorra 5hs/semana o no detecta al menos 1 riesgo real, no pagás."**

---

## 📱 DEMO MOBILE (bonus)

> Abrir `http://localhost:3002` en celu — **responsive nativo**, Copilot flotante funciona igual.

---

## 🔧 TROUBLESHOOTING RÁPIDO

| Problema         | Solución                                                             |
| ---------------- | -------------------------------------------------------------------- |
| Chat no responde | Verificar API en puerto 4000 (`curl localhost:4000/api/v1/ai/query`) |
| Sin datos        | Ejecutar `pnpm --filter @nexa/database run seed`                     |
| Puerto ocupado   | `netstat -ano \| findstr :3002` → kill PID                           |
| Build error      | `pnpm run build` en apps/api y apps/web por separado                 |

---

## 📞 CONTACTO POST-DEMO

Enviar mail con:

1. Link a trial sandbox (sus datos, 14 días)
2. Video 5 min "First steps"
3. Doc: "10 preguntas que el Copilot responde por vos"
4. Calendly para onboarding call

---

**¡A vender! 🚀**

_El demo habla solo. El Copilot es el "wow moment". Los agents cierran el deal._
