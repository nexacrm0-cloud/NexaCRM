# Architecture Review Gate — Nexa Blueprint v1.0

> **Revisor:** Principal Engineer (autocrítica)
> **Objetivo:** Encontrar problemas activamente, no defender decisiones.
> **Frase guía:** Suficientemente bueno para un MVP, no perfecto.

---

## Resumen ejecutivo

| Categoría                       | Críticos | Altos | Medios | Bajos | Aceptar |
| ------------------------------- | -------- | ----- | ------ | ----- | ------- |
| **Bloquear Sprint 1**           | 1        | 3     | 0      | 0     | 0       |
| **Resolver en sprint temprano** | 0        | 2     | 4      | 0     | 0       |
| **Aceptar para MVP**            | 0        | 0     | 0      | 0     | 20+     |

**Veredicto:** 0 riesgos críticos sin resolver. 1 riesgo crítico con solución clara antes del Sprint 1. 3 riesgos altos con solución temprana. **Blueprint aprobable condicionalmente.**

---

## 1. Cuellos de botella de escalabilidad

### 1.1 Event Bus en memoria (NestJS EventEmitter)

**Descripción:** El `EventBusService` usa `EventEmitter2` in-process. Con 2+ instancias de API, un evento emitido en la instancia A no llega a los handlers en la instancia B. Las proyecciones de dashboard, search index y audit trail se vuelven inconsistentes entre instancias.

**Impacto:** Data inconsistente en dashboards, búsqueda y auditoría al escalar horizontalmente.

**Probabilidad:** Alta al escalar (>1 instancia)  
**Severidad:** Alta

**Recomendación:** Migrar a Redis pub/sub desde el inicio. La interfaz ya está definida. El cambio es simple: en lugar de `EventEmitter2.emit()`, usar `Redis.publish()`. Todos los handlers escuchan en el mismo canal. La implementación de prueba puede seguir siendo in-memory, pero la configuración de producción debe usar Redis desde el Sprint 1.

**¿Resolución antes del Sprint 1?** No. Para MVP con 1 instancia, in-memory es correcto. Documentar que la migración a Redis pub/sub es requisito antes del primer deploy multi-instancia.

### 1.2 Dashboard projections por eventos

**Descripción:** Las proyecciones se actualizan secuencialmente por handlers de eventos. Si los eventos llegan fuera de orden (ej: `deal.moved` antes que `deal.created`), las proyecciones pueden quedar inconsistentes.

**Impacto:** Dashboard muestra datos incorrectos temporal o permanentemente.

**Probabilidad:** Baja (con 1 instancia y handlers síncronos, el orden se conserva)  
**Severidad:** Media

**Recomendación:** Aceptar para MVP. Si ocurren problemas de orden, implementar actualizaciones idempotentes con version stamp.

### 1.3 Tabla `activity_logs` sin particionamiento

**Descripción:** `activity_logs` recibe un registro por cada mutación. Con uso moderado (~500 ops/día) son 15,000 registros/mes. En 2 años: 360,000+ registros por organización. Sin índices compuestos optimizados para las queries más comunes.

**Impacto:** Las queries de actividad (usadas en dashboard + detalle de cliente) se vuelven lentas.

**Probabilidad:** Alta (segura, crecimiento predecible)  
**Severidad:** Media

**Recomendación:** Agregar particionamiento por mes en `activity_logs` (espejo de `audit_logs`). Además, política de retención: mantener 6 meses en tabla activa, archivar el resto. Esto debe hacerse antes de que la BD tenga datos significativos (>10,000 registros).

**¿Resolución antes del Sprint 1?** Sí. El particionamiento es más fácil de implementar antes de tener datos. Agregarlo al Sprint 1.

---

## 2. Riesgos de acoplamiento entre módulos

### 2.1 Domain Layer ↔ Prisma — capa de mapeo ausente

**Descripción:** El blueprint define un Domain Layer con entidades puras (sin dependencias de NestJS/Prisma), pero los Services actuales usan Prisma directamente. No hay un mapper (ClienteEntity → Prisma.Client, etc.) ni repositorios implementados que usen las entidades de dominio. Esto crea dos jerarquías de modelos paralelas que inevitablemente divergirán.

**Impacto:** O el Domain Layer se vuelve dead code, o cada cambio en Prisma requiere actualizar entidades de dominio manualmente. La promesa de "Clean Architecture" no se materializa.

**Probabilidad:** Alta (es el estado actual del código)  
**Severidad:** Alta

**Recomendación:** El Sprint 1 debe resolver esto. Estrategia concreta:

1. Implementar repositorios (`ClientRepository implements IClientRepository`) que internamente usan Prisma pero devuelven `ClientEntity`
2. Los Services existentes se refactorizan gradualmente para usar repositorios en lugar de Prisma directo
3. Los new modules (Search, Workflows, Billing) DEBEN usar repositorios desde el día 1

**Alternativa más pragmática:** Reducir el alcance del Domain Layer. En lugar de entidades con métodos de negocio complejos, usar Value Objects tipados y dejar los modelos de Prisma como entidades "anémicas". El Domain Event + Repository interfaces son suficientes para el desacoplamiento real. Esto evita la duplicación de modelos y el mapper costoso.

**Decisión final:** Usar Value Objects + Domain Events + Repository interfaces. NO crear entidades de dominio duplicadas de los modelos de Prisma. Los modelos de Prisma SON las entidades en esta etapa. Esto elimina la necesidad de un mapper, reduce el código, y mantiene los beneficios del patrón (eventos, VO, interfaces).

### 2.2 Command Center — 4 servicios acoplados en un flujo lineal

**Descripción:** El flujo `IntentDetection → PermissionLayer → ToolRegistry → ResponseFormatter` es un pipeline secuencial. Si cualquiera falla, todo el comando falla. No hay circuit breaker ni fallback parcial.

**Impacto:** Una falla en IntentDetection (ej: timeout de LLM) bloquea incluso comandos simples como "ir a pipeline" que no necesitan LLM.

**Probabilidad:** Media (timeouts de LLM son comunes)  
**Severidad:** Media

**Recomendación:** Dos caminos separados:

- **Fast path (síncrono):** Comandos que matchean regex (navegación, acciones exactas). No pasan por LLM. Tiempo de respuesta < 10ms.
- **Slow path (asíncrono):** Comandos que requieren LLM. Con timeout de 30s, indicador de carga en UI.

El `IntentDetectionService` debe decidir el path ANTES de llamar al LLM.

**¿Resolución antes del Sprint 1?** No. Incluir en Sprint 2 (Command Center) desde el diseño inicial.

---

## 3. Componentes sobreingenierizados para MVP

### 3.1 Multi-LLM con fallback automático, routing por tarea, cost-based selection

**Descripción:** El diseño incluye 3 proveedores (OpenAI, Claude, Gemini), registro con capacidades, selección por tipo de tarea, y fallback automático. Para un MVP donde el 100% de los usuarios usarán OpenAI porque es el único configurado, esto es complejidad innecesaria.

**Impacto:** 200+ líneas de interfaz + registry + providers que nadie usa. Código que testear y mantener.

**Probabilidad:** 100% (no hay duda)  
**Severidad:** Baja (el código existe pero no duele)

**Recomendación:** En Sprint 4, implementar solo OpenAI provider con `LLMProvider` interface. La interfaz deja la puerta abierta para Claude/Gemini sin implementarlos. Agregar otros providers solo cuando un cliente los solicite o cuando OpenAI tenga un outage prolongado.

**Decisión final:** Aceptar para MVP. La interfaz es simple (~5 métodos) y no representa carga de mantenimiento significativa.

### 3.2 ABAC con permisos granulares en User

**Descripción:** El campo `users.permissions: string[]`, el decorador `@RequirePermission()`, y la preparación para ABAC agregan complejidad a la autorización. Para un MVP con 4 roles (OWNER, ADMIN, MEMBER, VIEWER), RBAC es más que suficiente.

**Impacto:** 50+ líneas de decoradores + lógica de permisos que no se usa. Confusión entre "rol" y "permiso".

**Probabilidad:** 100%  
**Severidad:** Baja

**Recomendación:** Eliminar `permissions` del modelo User en Sprint 1. RBAC puro con los 4 roles. ABAC se agrega cuando haya requirements concretos (ej: "el MEMBER del equipo A no puede ver los clients del equipo B").

**Decisión final:** Eliminar del Sprint 1. Agregar solo cuando sea necesario.

### 3.3 Plugin System con 9 puntos de extensión

**Descripción:** El sistema de plugins permite registrar tools, events, routes, permissions, commands, pages, context, workflow steps y config. Para un MVP donde los plugins son inexistentes, esto es mucha especulación.

**Impacto:** El diseño de plugins influencia decisiones en Tool Registry, Workflow Engine, Command Center y Context Builder antes de saber si los plugins serán necesarios.

**Probabilidad:** Alta (estamos diseñando para algo que no existe)  
**Severidad:** Media (puede causar over-engineering en componentes base)

**Recomendación:** Congelar el diseño de plugins. NO diseñar componentes base (Tool Registry, Command Center, etc.) pensando en plugins. Diseñarlos para el caso de uso actual. Cuando llegue el primer plugin real, se adapta. La interfaz `NexaPlugin` y `PluginLoaderService` se implementan en Sprint 10 sin modificar los componentes base.

**Decisión final:** Aceptar. Los componentes base no se contaminan con "plugin hooks" prematuros.

---

## 4. Componentes insuficientemente diseñados para SaaS

### 4.1 API Versioning — sin estrategia de migración

**Descripción:** El blueprint define versionado por URL + header, pero no hay:

- Controladores versionados
- DTOs versionados
- Procedimiento de deprecación implementado
- Test de compatibilidad backward

**Impacto:** Cuando llegue el primer breaking change, no hay infraestructura para manejarlo sin romper clientes.

**Probabilidad:** Media (el primer breaking change llegará)  
**Severidad:** Alta

**Recomendación:** Agregar un middleware de versionado mínimo en Sprint 1 que:

1. Lee version header o URL prefix
2. (Opcional) Rutea a controladores versionados
3. Agrega headers `Deprecation` y `Sunset` a respuestas de versiones deprecadas

Para MVP, todo vive en `/api/v1/`. El middleware es boilerplate que no hace nada hasta que se necesite v2.

**¿Resolución antes del Sprint 1?** No. Pero documentar en Sprint 1 como tech debt.

### 4.2 Sin estrategia de backup/disaster recovery

**Descripción:** No hay mención de backups, point-in-time recovery, o disaster recovery en el blueprint.

**Impacto:** Pérdida total de datos en caso de corrupción o desastre.

**Probabilidad:** Baja  
**Severidad:** Crítica

**Recomendación:** Agregar al roadmap: configurar backups automáticos de PostgreSQL (pg_dump diario + WAL archiving para PITR) en el primer deploy a producción. No es código, es configuración.

**¿Resolución antes del Sprint 1?** No, pero documentar como requisito de producción.

---

## 5. Riesgos de rendimiento

### 5.1 ActivityLogs y AuditLogs — crecimiento acelerado

**Descripción:** `activity_logs` + `audit_logs` reciben 2 registros por cada mutación. Sin política de retención ni archive, el tamaño crece indefinidamente.

**Rendimiento estimado:**

- ~100 ops/día por organización = ~6,000 registros/mes
- 100 organizaciones = 600,000 registros/mes
- En 1 año: 7.2M registros

**Impacto:** Queries con `ORDER BY createdAt DESC LIMIT 50` se degradan significativamente sin índices compuestos correctos y particionamiento.

**Probabilidad:** Alta  
**Severidad:** Alta

**Recomendación (consolidada del punto 1.3):**

1. Particionar `activity_logs` por mes (igual que `audit_logs`)
2. Índice compuesto `(organizationId, createdAt DESC)` en ambas tablas
3. Política de retención: activity_logs = 6 meses, audit_logs = 2 años
4. Job programado (via `@nestjs/schedule`) para archive/limpieza

**¿Resolución antes del Sprint 1?** Agregar particionamiento e índices al schema inicial. La política de retención y el job de limpieza pueden ser Sprint 4.

---

## 6. Riesgos de seguridad

### 6.1 Multi-tenancy por convención — sin enforcement en BD

**Descripción:** Todas las tablas tienen `organizationId`, pero no hay mecanismo que fuerce el filtro. Si un developer olvida `WHERE organizationId = ?` en una query, los datos se filtran a otro tenant.

**Impacto:** DATA BREACH. El peor escenario para un SaaS multi-tenant.

**Probabilidad:** Media (error humano)  
**Severidad:** **CRÍTICA**

**Recomendación:** Implementar Row-Level Security (RLS) en PostgreSQL. Es el estándar de la industria para multi-tenancy.

```sql
-- Para cada tabla con organizationId:
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clients
  USING (organizationId = current_setting('app.organization_id')::text);
```

En NestJS, un middleware/interceptor setea `app.organization_id` al inicio de cada request basado en el JWT. Prisma usa `$queryRaw` para `SELECT set_config('app.organization_id', $1, true)`.

**Esto es adicional a los filtros en código (defense in depth).**

**¿Resolución antes del Sprint 1?** **SÍ.** Es el riesgo más grave identificado. Implementar RLS policies para todas las tablas existentes y futuras. El middleware de NestJS es trivial (~10 líneas).

### 6.2 Token theft detection — UX agresiva

**Descripción:** Si se detecta reutilización de refresh token, se invalidan TODOS los tokens del usuario. Esto puede ocurrir por causas legítimas (2 pestañas abiertas, navegador que no limpia cookies correctamente, redirección OAuth).

**Impacto:** Usuarios legítimos forzados a login repetidamente. Tickets de soporte.

**Probabilidad:** Media  
**Severidad:** Media

**Recomendación:** Estrategia menos agresiva:

1. Primera detección: invalidar token, permitir refresh con nuevo login, notificar por email
2. Segunda detección en < 24h: bloquear cuenta, notificar, requerir cambio de password

**¿Resolución antes del Sprint 1?** No. Implementar la versión actual y mejorar si hay reports de falsos positivos.

### 6.3 Rate limiting sin fallback para Redis offline

**Descripción:** El rate limiting por organización usa Redis (ThrottlerGuard con store en Redis). Si Redis falla, el rate limiting podría fallar abierto (permitir todo) o cerrar (bloquear todo).

**Impacto:** Sin Redis: o DoS o denegación de servicio a usuarios legítimos.

**Probabilidad:** Baja  
**Severidad:** Media

**Recomendación:** El ThrottlerGuard global (60 req/min) usa memoria, no Redis. Es el fallback. Los rate limiters adicionales (org, AI, login) son complementarios. Documentar que sin Redis, solo el rate limit global está activo.

**¿Resolución antes del Sprint 1?** No. El ThrottlerGuard global en memoria es suficiente para MVP.

---

## 7. Riesgos para multi-tenancy

### 7.1 Organization slug único global

**Descripción:** `organizations.slug` es `@unique`. Dos organizaciones no pueden tener slugs similares. Esto puede ser frustrante (ej: "nexa", "nexacrm", "nexa-crm" tomados).

**Impacto:** Fricción en registro.

**Probabilidad:** Alta a medida que crece el número de organizaciones  
**Severidad:** Baja

**Recomendación:** Aceptar para MVP. Cuando sea un problema, implementar slugs con sufijo numérico automático ("nexa-2", "nexa-3") o permitir slugs personalizados solo en planes pagos.

### 7.2 Soft delete solo en clients — orphaned records en otras entidades

**Descripción:** `clients` tiene soft delete. El resto usa hard delete con `onDelete: SetNull`. Si se elimina un deal, sus tasks asociadas quedan con `dealId = null`. Si se elimina un user, sus tasks assigned quedan con `assignedTo = null`.

**Impacto:** Datos huérfanos que confunden al usuario (tasks sin deal, tasks sin asignado).

**Probabilidad:** Alta (soft delete es común)  
**Severidad:** Baja

**Recomendación:** Aceptar para MVP. El comportamiento es correcto (los datos no se pierden). Mejorar la UI para manejar gracefully los campos nulos.

---

## 8. Riesgos de mantenibilidad

### 8.1 Duplicación Zod ↔ Prisma

**Descripción:** Los schemas de validación en `@nexa/shared/schemas.ts` duplican la estructura de los modelos de Prisma. Cualquier cambio en el schema de BD requiere actualizar ambos archivos.

**Impacto:** Schemas de validación desactualizados, errores en producción cuando el frontend envía datos que el backend rechaza o viceversa.

**Probabilidad:** Alta (ocurrirá en cada migration de BD)  
**Severidad:** Media

**Recomendación:** Generar automáticamente los Zod schemas desde Prisma. Usar herramientas como:

- `zod-prisma-types` — genera schemas Zod directamente del schema Prisma
- `@anatine/zod-nestjs` — para integración con NestJS

Si la generación automática no es viable, aceptar la duplicación con un checklist de release que incluya "actualizar schemas Zod".

**¿Resolución antes del Sprint 1?** Idealmente sí. Evaluar `zod-prisma-types` en Sprint 1.

### 8.2 16+ módulos en apps/api

**Descripción:** El número de módulos crece rápidamente. Sin naming conventions y estructura consistente, la navegación se vuelve compleja.

**Impacto:** Onboarding lento, developers perdidos.

**Probabilidad:** Alta  
**Severidad:** Baja

**Recomendación:** Aceptar. La estructura de módulos NestJS es predecible (cada uno es controller + module + service). Agregar `CONTRIBUTING.md` con mapa de módulos en Sprint 1.

---

## 9. Riesgos para futuras integraciones

### 9.1 Plugin System con dynamic import — incompatible con serverless

**Descripción:** `import(pluginPath)` de Node.js no funciona en todos los entornos serverless (Vercel Edge Functions, Cloudflare Workers) donde el código se bundlea estáticamente.

**Impacto:** El Plugin System no funcionará en despliegues serverless sin modificación significativa.

**Probabilidad:** Baja (usamos Docker, no serverless)  
**Severidad:** Alta (cambio arquitectónico si se requiere serverless)

**Recomendación:** Aceptar para MVP. Si se requiere serverless en el futuro, los plugins se compilan/bundlean estáticamente como parte del build, no se cargan dinámicamente.

### 9.2 Sin webhooks entrantes (incoming integrations)

**Descripción:** El sistema tiene webhooks como acción de salida (workflow action), pero no como entrada (recibir datos de sistemas externos).

**Impacto:** Cada integración externa requiere desarrollo custom.

**Probabilidad:** Media (eventualmente se necesitarán)  
**Severidad:** Media

**Recomendación:** Aceptar para MVP. Cuando surja la necesidad, implementar un `WebhooksModule` simple que valida secretos y emite eventos al Event Bus.

---

## 10. Riesgos para la IA y Command Center

### 10.1 Regex en IntentDetection — alta tasa de no-match

**Descripción:** Detectar intención por regex requiere mantener patrones para cada frase que un usuario pueda escribir. Los usuarios escriben "crea cliente X", "nuevo cliente X", "dar de alta a X", "agregar empresa X", etc. El regex fallará frecuentemente y caerá en LLM (lento + caro).

**Impacto:** Usuarios frustrados cuando su frase natural no funciona. La alternativa (LLM siempre) es lenta para comandos simples.

**Probabilidad:** Alta  
**Severidad:** Media

**Recomendación:** En Sprint 2, implementar un sistema de patrones entrenable:

1. Almacenar comandos exitosos (vía LLM → tool) como "alias"
2. Próxima vez que alguien escriba "dar de alta", el regex lo reconoce
3. Esto mejora con el uso sin mantenimiento manual

**Alternativa más simple:** Usar embedding similarity (vector search local) en lugar de regex. Comando del usuario → embedding → nearest neighbor entre tools registradas. Sin LLM, sin regex. Más preciso y escalable.

**¿Resolución antes del Sprint 1?** No. Incluir en Sprint 2.

### 10.2 Command Center es SPOF funcional

**Descripción:** Todo comando pasa por `POST /api/v1/commands`. Si este endpoint tiene un bug, todo el Command Center, AI Copilot y Command Palette dejan de funcionar.

**Impacto:** Las 3 features más innovadoras del producto caen simultáneamente.

**Probabilidad:** Baja  
**Severidad:** Alta

**Recomendación:**

1. Separar endpoints: `POST /api/v1/commands/navigate`, `POST /api/v1/commands/action`, `POST /api/v1/ai/query`. Cada uno con su propio pipeline reducido.
2. El endpoint unificado `POST /api/v1/commands` es un router que delega a los específicos.

Esto además permite que la navegación (que debe ser instantánea) no compita por recursos con AI queries.

**¿Resolución antes del Sprint 1?** No. Incluir en Sprint 2.

---

## 11. Riesgos del Event Bus

### 11.1 Handlers síncronos pueden crashar la request

**Descripción:** NestJS EventEmitter ejecuta handlers en el mismo contexto que el emitter. Si un handler lanza una excepción no capturada, la request principal falla.

**Ejemplo:** `ClientsService.create()` → emite `ClientCreated` → `WorkflowHandler.evaluate()` lanza error por regla inválida → `ClientsService.create()` retorna 500.

**Impacto:** Una regla de workflow inválida puede impedir crear clientes.

**Probabilidad:** Media  
**Severidad:** Alta

**Recomendación:** Implementar un wrapper en el Event Bus que:

```typescript
class SafeEventBus {
  emit(event: DomainEvent): void {
    try {
      this.emitter.emit(event.eventName, event);
    } catch (error) {
      this.logger.error(`Event handler failed for ${event.eventName}`, error);
      // NO relanzar la excepción
    }
  }
}
```

**¿Resolución antes del Sprint 1?** **SÍ.** Es trivial implementar (15 líneas) y previene una clase entera de bugs.

### 11.2 Sin Outbox Pattern — eventos perdidos en crash

**Descripción:** Si el servidor crashea entre `prisma.client.create()` y `eventBus.emit()`, el evento se pierde. La entidad se crea en BD pero no hay activity log, audit trail, proyección de dashboard, ni trigger de workflow.

**Impacto:** Datos inconsistentes silenciosamente.

**Probabilidad:** Baja (crashes de servidor son raros)  
**Severidad:** Alta

**Recomendación:** Para MVP, aceptar el riesgo. Para producción multi-instancia, implementar Outbox Pattern:

```typescript
// En la misma transacción:
await prisma.$transaction([
  prisma.client.create({ data }),
  prisma.outboxEvent.create({ data: { type: 'client.created', payload, organizationId } }),
]);

// Background job:
// 1. Leer outbox_events NO procesados (ORDER BY createdAt)
// 2. Emitir al Event Bus
// 3. Marcar como procesados
```

**¿Resolución antes del Sprint 1?** No. Solo si el equipo anticipa alta criticidad de datos desde el día 1.

---

## 12. Riesgos del Tool Registry

### 12.1 Sin handler timeout

**Descripción:** Un tool handler puede ejecutarse indefinidamente (ej: consulta externa lenta, loop infinito). No hay timeout configurado.

**Impacto:** Request bloqueada, recursos del servidor agotados.

**Probabilidad:** Media  
**Severidad:** Alta

**Recomendación:** Agregar timeout a la ejecución de tools:

```typescript
async execute(name: string, params: unknown, context: ToolContext): Promise<ToolResult> {
  const tool = this.findByName(name);
  const result = await Promise.race([
    tool.handler(params, context),
    new Promise((_, reject) => setTimeout(() => reject(new TimeoutException()), 30000)),
  ]);
  return result;
}
```

**¿Resolución antes del Sprint 1?** No. Incluir en Sprint 2 (Tool Registry) desde el diseño inicial.

### 12.2 Descubrimiento O(n) con 100+ tools

**Descripción:** `findByIntent` itera linealmente todas las herramientas registradas. Con docenas de plugins registrando múltiples tools, la latencia de descubrimiento crece linealmente.

**Impacto:** Latencia en respuesta de comandos.

**Probabilidad:** Baja para MVP  
**Severidad:** Baja

**Recomendación:** Aceptar para MVP. Si es necesario, indexar por nombre + keywords usando un Map o Trie.

---

## 13. Riesgos del Workflow Engine

### 13.1 Sin detección de ciclos

**(Riesgo más grave del Workflow Engine)**

**Descripción:** Un workflow que emite un evento que dispara otro workflow que emite el mismo evento... ciclo infinito.

**Ejemplo concreto:**

1. Workflow A: trigger = `task.created`, action = `create_task` (crea tarea X)
2. Workflow A crea tarea X → emite `task.created` → Workflow A se dispara de nuevo → crea tarea Y → emite `task.created` → ad infinitum

**Impacto:** Bucle infinito, CPU al 100%, BD llena de tareas basura, costo de infraestructura, denial of service.

**Probabilidad:** Media (fácil de crear accidentalmente)  
**Severidad:** **CRÍTICA**

**Recomendación:** Implementar en Sprint 6 desde el día 1:

1. **Profundidad máxima:** Máximo 3 niveles de ejecución anidada. El workflow evaluador lleva un contador `executionDepth` que se incrementa en cada nivel. Si > 3, se rechaza la ejecución.
2. **Detección de ciclos:** Workflow IDs en el path de ejecución. Si el mismo workflow ID aparece 2 veces en el stack, se rechaza.
3. **Rate limit por workflow:** Máximo 100 ejecuciones por hora por workflow.

**¿Resolución antes del Sprint 1?** No. Especificar como requisito obligatorio de Sprint 6.

### 13.2 Sin paralelismo en acciones

**Descripción:** Las acciones se ejecutan secuencialmente. Un delay de 1 hora en la acción 3 bloquea las acciones 4 y 5.

**Impacto:** Workflows lentos, poor UX.

**Probabilidad:** Baja  
**Severidad:** Baja

**Recomendación:** Aceptar para MVP. En futura versión, agregar `parallel: true` en grupos de acciones.

---

## 14. Riesgos del Plugin System

### 14.1 Plugins tienen acceso completo a Node.js

**Descripción:** `import(pluginPath)` ejecuta el código del plugin en el mismo proceso de Node.js que el core. El plugin puede acceder a `process.env`, `fs`, network, y cualquier dependencia instalada.

**Impacto:** Un plugin malicioso puede leer todos los secrets, toda la BD (si logra importar Prisma), y enviar datos a un servidor externo.

**Probabilidad:** Baja (plugins propios/confiables en MVP)  
**Severidad:** **CRÍTICA** (para marketplace público)

**Recomendación:**

- **MVP:** Solo plugins propios o de confianza. El OWNER debe aprobar la instalación. Documentar el riesgo.
- **Marketplace público (futuro):** Ejecutar plugins en VM2 o contenedor Docker separado con API como único punto de acceso.

**¿Resolución antes del Sprint 1?** No. Especificar como "critical" en Sprint 10.

### 14.2 Plugin puede importar Prisma directamente

**Descripción:** El blueprint dice "el plugin no tiene acceso directo a BD, solo a través de tools registradas". Pero el plugin corre en el mismo proceso y puede hacer `import { PrismaService } from '@nexa/database'`.

**Impacto:** Bypass total del sistema de permisos y herramientas.

**Probabilidad:** Baja (plugins internos/confiables)  
**Severidad:** Alta

**Recomendación:** Para MVP, documentar como convención: "Los plugins acceden a BD exclusivamente a través de ToolRegistry.execute()". No hay enforcement técnico práctico sin sandboxing (que es excesivo para MVP).

---

## 15. Riesgos del esquema de base de datos

### 15.1 Quote number no atómico

**Descripción:** El formato `Q-{YYYY}-{XXXX}` requiere un contador secuencial. Si se implementa con `SELECT COUNT(*) + 1`, dos requests simultáneas pueden obtener el mismo número.

**Impacto:** Quote numbers duplicados (viola la constraint UNIQUE).

**Probabilidad:** Baja para MVP (< 10 quotes simultáneas)  
**Severidad:** Media

**Recomendación:** Usar PostgreSQL SEQUENCE:

```sql
CREATE SEQUENCE quote_number_seq START 1;
-- En la app: number = `Q-${year}-${String(nextval('quote_number_seq')).padStart(4, '0')}`
```

O usar UUID como identificador único interno y mantener el formato solo para display.

**¿Resolución antes del Sprint 1?** Corregir el generador de quote numbers en el QuotesService existente. Es un cambio pequeño.

### 15.2 Sin cascade delete para Organization en tablas nuevas

**Descripción:** La Organization actual tiene `onDelete: Cascade` en el schema Prisma. Las tablas nuevas (workflows, audit_logs, subscriptions, etc.) deben tener la misma política.

**Impacto:** Si se elimina una Organization, quedan datos huérfanos en tablas nuevas.

**Probabilidad:** Baja  
**Severidad:** Media

**Recomendación:** Agregar `onDelete: Cascade` a todas las tablas nuevas que referencien Organization. Esto es parte del schema design.

**¿Resolución antes del Sprint 1?** **SÍ.** Es parte de la generación del schema Prisma definitivo.

### 15.3 GIN index en search_vector de search_index puede ser lento en writes

**Descripción:** El índice GIN en `searchVector` (tsvector) acelera búsquedas pero ralentiza inserts/updates porque reindexa el vector. En tablas con altos writes, el overhead es significativo.

**Impacto:** Writes lentos en cualquier entidad que se indexa para búsqueda.

**Probabilidad:** Baja (no tenemos altos writes en MVP)  
**Severidad:** Baja

**Recomendación:** Aceptar para MVP. Si los writes se vuelven un problema, evaluar:

1. Batching de actualizaciones de search index
2. Migration a Elasticsearch/Meilisearch para search dedicado

---

## Resumen de acciones requeridas

### 🔴 Bloqueantes antes del Sprint 1

| #    | Riesgo                             | Acción                                              |
| ---- | ---------------------------------- | --------------------------------------------------- |
| 6.1  | Multi-tenancy sin enforcement      | Implementar RLS en PostgreSQL para todas las tablas |
| 11.1 | Handlers síncronos crashan request | Implementar SafeEventBus con try/catch              |
| 15.1 | Quote number no atómico            | Usar SEQUENCE de PostgreSQL                         |
| 15.2 | Sin cascade en tablas nuevas       | Agregar onDelete: Cascade a nuevas FKs              |

### 🟡 Resolver en sprint temprano

| #       | Riesgo                                | Sprint   | Acción                                                                     |
| ------- | ------------------------------------- | -------- | -------------------------------------------------------------------------- |
| 1.3/5.1 | ActivityLogs sin partición            | Sprint 1 | Agregar particionamiento por mes                                           |
| 2.1     | Domain Layer ↔ Prisma divergencia     | Sprint 1 | Usar VO + Domain Events, no entidades duplicadas. Implementar repositorios |
| 8.1     | Zod ↔ Prisma duplicación              | Sprint 1 | Evaluar zod-prisma-types                                                   |
| 10.1    | Regex IntentDetection falla frecuente | Sprint 2 | Implementar sistema de embeddings o alias entrenables                      |
| 10.2    | Command Center SPOF                   | Sprint 2 | Separar endpoints por tipo de comando                                      |
| 12.1    | Tool handler sin timeout              | Sprint 2 | Agregar Promise.race con timeout                                           |
| 13.1    | Workflow cycle detection              | Sprint 6 | Implementar executionDepth + rate limit como requisito obligatorio         |

### 🟢 Aceptar para MVP (no modificar)

| #         | Decisión                         | Motivo                                                        |
| --------- | -------------------------------- | ------------------------------------------------------------- |
| 1.1       | Event Bus in-memory              | Suficiente para 1 instancia. Interfaz ya preparada para Redis |
| 3.1       | Multi-LLM con 3 providers        | Implementar solo OpenAI. La interfaz no es cara de mantener   |
| 3.2       | ABAC con permisos                | Eliminar permissions de User. RBAC puro es suficiente         |
| 3.3       | Plugin System completo           | Congelar diseño. No contaminar componentes base               |
| 6.2       | Token theft detection agresiva   | Aceptar. Mejorar si hay falsos positivos                      |
| 6.3       | Rate limiting sin fallback Redis | ThrottlerGuard global es suficiente backup                    |
| 7.1       | Organization slug único          | Aceptar. Solución futura con sufijos numéricos                |
| 7.2       | Hard delete con orphaned records | Aceptar. Manejar nulos en UI                                  |
| 8.2       | 16+ módulos                      | Aceptar. Estructura predecible de NestJS                      |
| 9.1       | Plugin System + serverless       | Aceptar. No es el target de deploy                            |
| 9.2       | Sin webhooks entrantes           | Aceptar. Agregar cuando sea necesario                         |
| 11.2      | Sin Outbox Pattern               | Aceptar. Agregar cuando haya alta criticidad de datos         |
| 12.2      | Tool discovery O(n)              | Aceptar. Indexar si hay 100+ tools                            |
| 13.2      | Sin paralelismo en acciones      | Aceptar. Agregar parallel:true en futuro                      |
| 14.1/14.2 | Plugin seguridad                 | Aceptar para MVP (plugins propios). Sandboxing en marketplace |
| 15.3      | GIN index slow writes            | Aceptar. Migrar a Elasticsearch si escala                     |

---

## Veredicto final

**0 riesgos críticos sin solución.**

El único riesgo crítico (6.1 — Multi-tenancy sin enforcement) tiene solución clara y simple (RLS + middleware de 10 líneas).

**El Blueprint v1.0 queda APROBADO condicionalmente**, sujeto a:

1. Implementar RLS en PostgreSQL (Sprint 1, día 1)
2. SafeEventBus con try/catch (Sprint 1, día 1)
3. Quote number con SEQUENCE (Sprint 1, día 1)
4. Cascade delete para nuevas tablas (Sprint 1, día 1)
5. No crear entidades de dominio duplicadas — usar VO + eventos + repositorios (Sprint 1)
6. Particionar activity_logs por mes (Sprint 1)

Todo lo demás se acepta como "suficientemente bueno para MVP" con tracking para mejora futura.

**Comience Sprint 1.**
