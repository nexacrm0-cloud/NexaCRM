# Nexa Technical Blueprint v1.0

> **Fecha:** 26 de junio de 2026
> **Estado:** Aprobado — fuente de verdad única del proyecto Nexa
> **Principio rector:** Decisiones definitivas, no alternativas. Cada elección está justificada.

---

## Índice

1. [Arquitectura final](#1-arquitectura-final)
2. [Estructura definitiva del monorepo](#2-estructura-definitiva-del-monorepo)
3. [Modelo de dominio](#3-modelo-de-dominio)
4. [Base de datos](#4-base-de-datos)
5. [API](#5-api)
6. [Eventos](#6-eventos)
7. [Tool Registry](#7-tool-registry)
8. [Command Center](#8-command-center)
9. [IA](#9-ia)
10. [Workflow Engine](#10-workflow-engine)
11. [Plugin System](#11-plugin-system)
12. [Seguridad](#12-seguridad)
13. [Testing](#13-testing)
14. [Convenciones](#14-convenciones)
15. [Roadmap](#15-roadmap)

---

## 1. Arquitectura final

### 1.1 Diagrama general

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Nexa Platform                                   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐    │
│   │                        Frontend (Next.js 14)                         │    │
│   │  ┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌───────────────┐ │    │
│   │  │ Dashboard │  │ Command     │  │ AI Copilot    │  │ Pipeline      │ │    │
│   │  │ Pages     │  │ Palette     │  │ Chat Bubble   │  │ Kanban        │ │    │
│   │  └──────────┘  └────────────┘  └──────────────┘  └───────────────┘ │    │
│   │  ┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌───────────────┐ │    │
│   │  │ Clients   │  │ Tasks      │  │ Quotes        │  │ Settings      │ │    │
│   │  └──────────┘  └────────────┘  └──────────────┘  └───────────────┘ │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                         │ API Calls (REST)                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐    │
│   │                     API Gateway (api/v1)                             │    │
│   │  ┌────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────────┐   │    │
│   │  │ Helmet │  │ Rate     │  │ JWT Auth   │  │ Versioning       │   │    │
│   │  │ CORS   │  │ Limiter  │  │ Guard      │  │ (URL + Header)   │   │    │
│   │  └────────┘  └──────────┘  └────────────┘  └──────────────────┘   │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                         │                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐    │
│   │                     Command Center (Router)                          │    │
│   │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │    │
│   │  │ Intent Detection │→│ Permission Layer │→│ Tool Registry    │  │    │
│   │  │ (regex + LLM)    │  │ (RBAC + ABAC)    │  │ (execution)      │  │    │
│   │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │    │
│   │         ↓                       ↓                      ↓           │    │
│   │  ┌────────────────────────────────────────────────────────────┐    │    │
│   │  │                  Response Formatter                        │    │    │
│   │  └────────────────────────────────────────────────────────────┘    │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                         │                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐    │
│   │                  Application Modules (NestJS)                        │    │
│   │                                                                      │    │
│   │  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │    │
│   │  │ Auth     │ │ Users     │ │ Clients  │ │ Pipeline │ │ Tasks    │ │    │
│   │  └──────────┘ └───────────┘ └──────────┘ └──────────┘ └──────────┘ │    │
│   │  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │    │
│   │  │ Quotes   │ │ Dashboard │ │ Activity │ │ Settings │ │ Search   │ │    │
│   │  └──────────┘ └───────────┘ └──────────┘ └──────────┘ └──────────┘ │    │
│   │  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐             │    │
│   │  │ Notifica │ │ Workflows │ │ Billing  │ │ Ai       │             │    │
│   │  └──────────┘ └───────────┘ └──────────┘ └──────────┘             │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                         │                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐    │
│   │                     Domain Layer (Pure TypeScript)                   │    │
│   │  ┌──────────┐  ┌───────────┐  ┌──────────────┐  ┌────────────────┐│    │
│   │  │ Value     │  │ Entities  │  │ Domain        │  │ Repository    ││    │
│   │  │ Objects   │  │           │  │ Events        │  │ Interfaces    ││    │
│   │  └──────────┘  └───────────┘  └──────────────┘  └────────────────┘│    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                         │                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐    │
│   │                      Event Bus (NestJS EventEmitter)                 │    │
│   │  ┌──────────┐  ┌───────────┐  ┌──────────────┐  ┌────────────────┐│    │
│   │  │ Emitters │→│ Event Bus │→│ Handlers      │→│ Projections    ││    │
│   │  │ (modules)│  │ (in-mem)  │  │ (consumers)   │  │ (dashboard,    ││    │
│   │  └──────────┘  └───────────┘  └──────────────┘  │ audit, search) ││    │
│   │                                                  └────────────────┘│    │
│   └─────────────────────────────────────────────────────────────────────┘    │
│                         │                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐    │
│   │                  Infrastructure Layer                                 │    │
│   │  ┌──────────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐ │    │
│   │  │ Prisma ORM   │  │ Redis    │  │ Email      │  │ File Storage │ │    │
│   │  │ (PostgreSQL) │  │ (Cache)  │  │ (Resend)   │  │ (S3/Local)   │ │    │
│   │  └──────────────┘  └──────────┘  └────────────┘  └──────────────┘ │    │
│   └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Responsabilidad de cada módulo

| Módulo             | Responsabilidad                                                                           | Capa            |
| ------------------ | ----------------------------------------------------------------------------------------- | --------------- |
| **Auth**           | Login, registro, JWT emisión/rotación, refresh tokens, detección de robo                  | Aplicación      |
| **Users**          | CRUD de usuarios, perfil, roles, estado activo/inactivo                                   | Aplicación      |
| **Organizations**  | Creación/gestión de organizaciones, planes, slug                                          | Aplicación      |
| **Clients**        | CRUD de clientes, tags, búsqueda, actividad vinculada                                     | Aplicación      |
| **Pipeline**       | Etapas del pipeline, movimiento de deals (DnD), probabilidad, cierre                      | Aplicación      |
| **Tasks**          | CRUD de tareas, prioridad, estado, vencimiento, recordatorios                             | Aplicación      |
| **Quotes**         | CRUD de cotizaciones, items, PDF, estados (draft→sent→accepted/rejected)                  | Aplicación      |
| **Dashboard**      | KPIs, gráficos, actividad reciente — **vía proyecciones** (no queries directas)           | Aplicación      |
| **Activity**       | Log polimórfico de actividad, consulta por entidad                                        | Aplicación      |
| **Notifications**  | Envío de emails (transaccionales), preparado para notificaciones in-app                   | Aplicación      |
| **Settings**       | Configuración de organización (preferencias, defaults)                                    | Aplicación      |
| **Search**         | Búsqueda global vía tsvector de PostgreSQL                                                | Aplicación      |
| **AI**             | Business Copilot: detección de intención, ejecución de herramientas, formato de respuesta | Aplicación      |
| **Workflows**      | Motor de automatización: triggers → condiciones → acciones                                | Aplicación      |
| **Billing**        | Planes, suscripciones, uso, créditos, límites                                             | Aplicación      |
| **Command Center** | Router unificado de comandos (UX, herramientas, IA, navegación)                           | Aplicación      |
| **Event Bus**      | Desacoplamiento de módulos vía eventos en memoria                                         | Infraestructura |
| **Tool Registry**  | Registro, descubrimiento y ejecución de herramientas                                      | Infraestructura |
| **Domain Layer**   | Value Objects, Entities, Domain Events, Repository interfaces                             | Dominio         |
| **Plugins**        | Carga dinámica, registro de herramientas/eventos/rutas/páginas                            | Infraestructura |
| **Feature Flags**  | Gating de funcionalidades por plan y por organización                                     | Infraestructura |

### 1.3 Flujo completo de una request

```
Request HTTP
    ↓
1. Helmet (seguridad headers)
2. Cookie Parser
3. CORS validation
4. Rate Limiter (ThrottlerGuard)
    ↓
5. JWT Auth Guard (extrae token de cookie o header)
   └→ Si no es válido → 401 Unauthorized
    ↓
6. Roles Guard (si aplica)
   └→ Si no tiene rol → 403 Forbidden
    ↓
7. Zod Pipe (valida body/params/query contra esquema)
   └→ Si no es válido → 400 Bad Request
    ↓
8. Controller (rutea al servicio)
    ↓
9. Service (lógica de negocio)
   └→ Query/CUD vía PrismaService
   └→ Emite Domain Event via EventBus
    ↓
10. Response (ApiResponse<T> estándar)
```

### 1.4 Flujo del Command Center

```
Request POST /api/v1/commands
    ↓
1. IntentDetectionService
   ├→ Regex: detecta comandos conocidos ("crear cliente", "pipeline")
   └→ LLM: si regex no coincide, usa IA para interpretar
    ↓
2. PermissionLayerService
   └→ Verifica que el usuario tenga permiso para ejecutar la intención
   └→ Basado en rol + características de la entidad (ABAC preparado)
    ↓
3. ToolRegistry
   └→ Busca herramienta registrada que coincida con la intención
   └→ Ejecuta la herramienta con los parámetros extraídos
    ↓
4. ResponseFormatterService
   └→ Convierte resultado crudo en:
       ├→ Texto natural (para AI Copilot)
       ├→ Acción de navegación (para Command Palette)
       └→ Data estructurada (para la UI)
    ↓
Response unificada { intent, action, parameters, naturalLanguage, data }
```

### 1.5 Flujo del Event Bus

```
Módulo fuente
    ↓
1. Servicio ejecuta acción (ej: crear cliente)
2. Servicio emite evento: this.eventBus.emit(new ClientCreatedEvent(payload))
    ↓
EventBus (NestJS EventEmitter)
    ↓
Handlers suscritos reciben el evento:

┌─────────────────┬──────────────────────────────┐
│ Handler         │ Acción                       │
├─────────────────┼──────────────────────────────┤
│ ActivityHandler │ Crea ActivityLog             │
│ SearchHandler   │ Indexa en tsvector            │
│ DashboardHandler│ Actualiza proyección          │
│ WorkflowHandler │ Evalúa triggers de workflows  │
│ AuditHandler    │ Registra en audit_logs        │
│ BillingHandler  │ Actualiza contador de uso     │
│ NotifyHandler   │ Envía notificación si aplica  │
└─────────────────┴──────────────────────────────┘
```

### 1.6 Flujo del Tool Registry

```
Registro (al iniciar módulo o cargar plugin)
    ↓
ToolRegistry.register(ToolDefinition)
   ├→ Valida que el nombre sea único
   ├→ Almacena metadata + handler
   └→ Notifica al Command Center
    ↓
Descubrimiento (en ejecución)
    ↓
ToolRegistry.findByIntent(intent)
   ├→ Busca por nombre exacto
   ├→ Busca por keywords/alias
   └→ Busca por similitud semántica (LLM)
    ↓
Ejecución
    ↓
ToolRegistry.execute(toolName, params, context)
   ├→ Crea execution context (usuario, org, metadata)
   ├→ Ejecuta handler con params validados
   ├→ Captura resultado o error
   └→ Retorna ToolResult { success, data, error, executionTime }
```

---

## 2. Estructura definitiva del monorepo

```
nexa/
├── .github/
│   └── workflows/
│       └── ci.yml                    # CI/CD pipeline
│
├── .vscode/
│   └── settings.json                 # Configuración compartida del editor
│
├── apps/
│   ├── api/                          # Backend NestJS
│   │   ├── src/
│   │   │   ├── main.ts               # Entry point, bootstrap
│   │   │   ├── app.module.ts         # Módulo raíz
│   │   │   │
│   │   │   ├── common/               # Capa compartida del backend
│   │   │   │   ├── decorators/       # @CurrentUser, @Roles
│   │   │   │   ├── filters/          # HttpExceptionFilter
│   │   │   │   ├── guards/           # JwtAuthGuard, RolesGuard, JwtStrategy
│   │   │   │   ├── interceptors/     # LoggingInterceptor
│   │   │   │   ├── interfaces/       # AuthInterface, ToolResult, etc.
│   │   │   │   └── pipes/            # ZodPipe
│   │   │   │
│   │   │   ├── config/               # Módulos de configuración
│   │   │   │   ├── prisma.module.ts  # Prisma global module
│   │   │   │   ├── event-bus.module.ts  # EventBus module
│   │   │   │   ├── feature-flags.module.ts
│   │   │   │   └── plugin-loader.module.ts
│   │   │   │
│   │   │   ├── domain/               # 🌟 NUEVO: Domain Layer
│   │   │   │   ├── value-objects/        # Email, Phone, Money, Address
│   │   │   │   ├── entities/             # ClientEntity, DealEntity, etc.
│   │   │   │   ├── events/               # ClientCreatedEvent, DealMovedEvent
│   │   │   │   └── repositories/         # IClientRepository, IDealRepository
│   │   │   │
│   │   │   ├── modules/              # Módulos de aplicación
│   │   │   │   ├── auth/             # Auth (controller, module, service)
│   │   │   │   ├── users/
│   │   │   │   ├── organizations/
│   │   │   │   ├── clients/
│   │   │   │   ├── pipeline/
│   │   │   │   ├── tasks/
│   │   │   │   ├── quotes/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── activity/
│   │   │   │   ├── notifications/
│   │   │   │   ├── settings/
│   │   │   │   ├── search/           # 🌟 NUEVO
│   │   │   │   ├── ai/               # Refactorizado con Command Center
│   │   │   │   ├── workflows/        # 🌟 NUEVO
│   │   │   │   ├── billing/          # 🌟 NUEVO
│   │   │   │   └── plugins/          # 🌟 NUEVO
│   │   │   │
│   │   │   ├── command-center/       # 🌟 NUEVO: Router de comandos
│   │   │   │   ├── command-center.module.ts
│   │   │   │   ├── command-center.controller.ts  # POST /commands
│   │   │   │   ├── intent-detection.service.ts
│   │   │   │   ├── permission-layer.service.ts
│   │   │   │   ├── response-formatter.service.ts
│   │   │   │   └── commands/         # Comandos individuales
│   │   │   │       ├── command.interface.ts
│   │   │   │       └── *.command.ts
│   │   │   │
│   │   │   ├── tool-registry/        # 🌟 NUEVO: Registro de herramientas
│   │   │   │   ├── tool-registry.module.ts
│   │   │   │   ├── tool-registry.service.ts
│   │   │   │   ├── tool.interface.ts
│   │   │   │   └── tools/            # Herramientas individuales
│   │   │   │       ├── create-client.tool.ts
│   │   │   │       ├── create-task.tool.ts
│   │   │   │       ├── move-deal.tool.ts
│   │   │   │       └── ...
│   │   │   │
│   │   │   ├── event-bus/           # 🌟 NUEVO: Event Bus core
│   │   │   │   ├── event-bus.module.ts
│   │   │   │   ├── event-bus.service.ts
│   │   │   │   └── handlers/        # Manejadores de eventos
│   │   │   │       ├── activity.handler.ts
│   │   │   │       ├── dashboard.handler.ts
│   │   │   │       ├── search.handler.ts
│   │   │   │       ├── audit.handler.ts
│   │   │   │       └── workflow.handler.ts
│   │   │   │
│   │   │   ├── ai/                   # 🌟 NUEVO: Multi-LLM
│   │   │   │   ├── ai.module.ts
│   │   │   │   ├── llm-provider.interface.ts
│   │   │   │   ├── providers/
│   │   │   │   │   ├── openai.provider.ts
│   │   │   │   │   ├── claude.provider.ts
│   │   │   │   │   └── gemini.provider.ts
│   │   │   │   ├── llm-registry.service.ts
│   │   │   │   ├── context-builder.service.ts
│   │   │   │   └── memory.service.ts
│   │   │   │
│   │   │   └── common/               # (ya existe)
│   │   │
│   │   ├── test/                     # Tests de integración
│   │   ├── Dockerfile
│   │   ├── .env
│   │   ├── .env.example
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                          # Frontend Next.js 14
│       ├── src/
│       │   ├── app/
│       │   │   ├── globals.css
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx
│       │   │   ├── (auth)/
│       │   │   │   ├── layout.tsx
│       │   │   │   ├── login/page.tsx
│       │   │   │   └── register/page.tsx
│       │   │   └── (dashboard)/
│       │   │       ├── layout.tsx
│       │   │       ├── dashboard/page.tsx
│       │   │       ├── clients/
│       │   │       │   ├── page.tsx
│       │   │       │   └── [id]/page.tsx
│       │   │       ├── pipeline/page.tsx
│       │   │       ├── tasks/page.tsx
│       │   │       ├── quotes/page.tsx
│       │   │       ├── profile/page.tsx
│       │   │       ├── settings/page.tsx
│       │   │       ├── search/page.tsx      # 🌟 NUEVO
│       │   │       ├── workflows/page.tsx   # 🌟 NUEVO
│       │   │       └── billing/page.tsx     # 🌟 NUEVO
│       │   │
│       │   ├── components/
│       │   │   ├── ui/               # shadcn/ui components
│       │   │   │   ├── avatar.tsx
│       │   │   │   ├── badge.tsx
│       │   │   │   ├── button.tsx
│       │   │   │   ├── card.tsx
│       │   │   │   ├── dialog.tsx
│       │   │   │   ├── dropdown-menu.tsx
│       │   │   │   ├── input.tsx
│       │   │   │   ├── label.tsx
│       │   │   │   ├── select.tsx
│       │   │   │   ├── separator.tsx
│       │   │   │   ├── skeleton.tsx
│       │   │   │   └── toast.tsx
│       │   │   │
│       │   │   ├── layout/
│       │   │   │   ├── dashboard-layout.tsx
│       │   │   │   ├── header.tsx
│       │   │   │   └── sidebar.tsx
│       │   │   │
│       │   │   ├── command-palette/
│       │   │   │   └── command-palette.tsx   # V2 con ranking, historial, favoritos
│       │   │   │
│       │   │   ├── ai-copilot/
│       │   │   │   └── ai-copilot.tsx
│       │   │   │
│       │   │   ├── clients/
│       │   │   ├── dashboard/
│       │   │   ├── pipeline/
│       │   │   ├── quotes/
│       │   │   ├── search/           # 🌟 NUEVO
│       │   │   └── workflows/        # 🌟 NUEVO
│       │   │
│       │   ├── hooks/
│       │   │   ├── use-auth.ts
│       │   │   ├── use-command-palette.ts   # 🌟 NUEVO
│       │   │   └── use-search.ts            # 🌟 NUEVO
│       │   │
│       │   ├── lib/
│       │   │   ├── api-client.ts
│       │   │   └── utils.ts
│       │   │
│       │   ├── providers/
│       │   │   └── providers.tsx
│       │   │
│       │   └── types/                # Tipos específicos del frontend
│       │
│       ├── public/
│       ├── .env.local
│       ├── .env.example
│       ├── next.config.js
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── database/                     # Prisma ORM + seed
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── prisma.service.ts
│   │   │   └── seed.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── shared/                       # Tipos, schemas Zod, enums compartidos
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   ├── enums.ts
│   │   │   └── schemas.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── domain/                       # 🌟 NUEVO: Domain Layer puro
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── email.ts
│   │   │   │   ├── phone.ts
│   │   │   │   ├── money.ts
│   │   │   │   └── address.ts
│   │   │   ├── entities/
│   │   │   │   ├── client.entity.ts
│   │   │   │   ├── deal.entity.ts
│   │   │   │   ├── task.entity.ts
│   │   │   │   └── quote.entity.ts
│   │   │   ├── events/
│   │   │   │   ├── domain-event.base.ts
│   │   │   │   ├── client-created.event.ts
│   │   │   │   ├── client-updated.event.ts
│   │   │   │   ├── deal-moved.event.ts
│   │   │   │   ├── task-completed.event.ts
│   │   │   │   ├── quote-sent.event.ts
│   │   │   │   └── ...
│   │   │   └── repositories/
│   │   │       ├── client.repository.ts
│   │   │       ├── deal.repository.ts
│   │   │       ├── task.repository.ts
│   │   │       └── quote.repository.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── config-eslint/                # ESLint compartido
│   │   ├── index.js
│   │   └── package.json
│   │
│   └── config-typescript/            # TypeScript configs compartidos
│       ├── base.json
│       ├── nestjs.json
│       ├── nextjs.json
│       └── package.json
│
├── docker-compose.yml               # PostgreSQL + Redis (dev)
├── docker-compose.prod.yml          # Todos los servicios (prod)
├── Dockerfile                        # Build multi-stage del monorepo
├── package.json                      # Root package.json
├── pnpm-workspace.yaml              # Workspace definition
├── turbo.json                        # Turborepo pipeline
├── .npmrc
├── .env
├── .env.example
├── .gitignore
├── .prettierrc
├── .prettierignore
└── NEXA_TECHNICAL_BLUEPRINT_v1.0.md # Este documento
```

### Propósito de cada directorio nuevo

| Directorio                                  | Propósito                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `apps/api/src/domain/`                      | Value Objects, Entities, Domain Events, Repository interfaces — cero dependencias de NestJS/Prisma |
| `apps/api/src/command-center/`              | Router de comandos unificado: detección de intención, permisos, ejecución, formato                 |
| `apps/api/src/tool-registry/`               | Registro, descubrimiento y ejecución de herramientas (cada herramienta es un archivo individual)   |
| `apps/api/src/event-bus/`                   | Core del Event Bus + todos los handlers suscritos                                                  |
| `apps/api/src/ai/providers/`                | Implementaciones de proveedores LLM (OpenAI, Claude, Gemini)                                       |
| `packages/domain/`                          | Domain Layer como paquete independiente para tests sin infraestructura                             |
| `apps/web/src/app/(dashboard)/search/`      | Página de búsqueda global                                                                          |
| `apps/web/src/app/(dashboard)/workflows/`   | Página de gestión de workflows                                                                     |
| `apps/web/src/app/(dashboard)/billing/`     | Página de facturación y plan                                                                       |
| `apps/web/src/hooks/use-command-palette.ts` | Hook para la command palette (historial, favoritos, recientes)                                     |

---

## 3. Modelo de dominio

### 3.1 Entidades principales

#### Organization

```
Organization {
  id: string (cuid)
  name: string
  slug: string (único)
  logo: string? (URL)
  plan: Plan (free | starter | professional | enterprise)
  features: FeatureFlag[]     // Feature flags específicas
  settings: Json?             // Configuración general
  subscriptions: Subscription[]
  createdAt: DateTime
  updatedAt: DateTime
}
```

- **Responsabilidad:** Contenedor multi-tenancy. Cada entidad pertenece a una organización.
- **Relaciones:** 1:N → Users, Clients, Deals, Tasks, Quotes, PipelineStages, ActivityLogs, Workflows, Subscriptions
- **Plan:** Gestiona límites y características disponibles.

#### User

```
User {
  id: string (cuid)
  email: string (único global)
  passwordHash: string
  firstName: string
  lastName: string
  avatarUrl: string?
  phone: string?
  role: UserRole (OWNER | ADMIN | MEMBER | VIEWER)
  isActive: boolean
  refreshToken: string? (hashed)
  lastLoginAt: DateTime?
  permissions: string[]              // Permisos granulares (futuro ABAC)
  organizationId: string (FK)
  preferences: Json?                 // Preferencias del usuario
  createdAt: DateTime
  updatedAt: DateTime
}
```

- **Responsabilidad:** Identidad, autenticación y autorización.
- **Roles:** OWNER (dueño de la org, control total), ADMIN (gestión), MEMBER (operaciones), VIEWER (solo lectura).
- **Relaciones:** N:1 → Organization; 1:N → assignedDeals, assignedTasks, createdTasks, createdQuotes, activityLogs

#### Client

```
Client {
  id: string (cuid)
  companyName: string
  contactName: string
  email: string?
  phone: string?
  address: string?
  tags: string[]
  notes: string?
  isDeleted: boolean (soft delete)
  deletedAt: DateTime?
  organizationId: string (FK)
  createdAt: DateTime
  updatedAt: DateTime
}
```

- **Responsabilidad:** Representa un cliente/empresa. Es el centro de las relaciones comerciales.
- **Relaciones:** N:1 → Organization; 1:N → deals, tasks, quotes, activityLogs
- **Soft delete:** Nunca se elimina físicamente. `isDeleted = true` + `deletedAt`.

#### Deal (Oportunidad)

```
Deal {
  id: string (cuid)
  title: string
  value: Money (decimal + currency)
  probability: int (0-100)
  notes: string?
  closeDate: DateTime?
  lostReason: string?
  position: int (orden dentro de la etapa)
  organizationId: string (FK)
  stageId: string (FK → PipelineStage)
  clientId: string? (FK → Client)
  assignedTo: string? (FK → User)
  createdAt: DateTime
  updatedAt: DateTime
}
```

- **Responsabilidad:** Representa una oportunidad de venta en el pipeline.
- **Relaciones:** N:1 → Organization; N:1 → PipelineStage; N:1 → Client; N:1 → User; 1:N → tasks, quotes, activityLogs

#### PipelineStage

```
PipelineStage {
  id: string (cuid)
  name: string
  position: int
  color: string (hex)
  isWinStage: boolean
  isLoseStage: boolean
  organizationId: string (FK)
  createdAt: DateTime
  updatedAt: DateTime
}
```

- **Responsabilidad:** Define las columnas del Kanban de ventas.
- **Relaciones:** N:1 → Organization; 1:N → deals
- **Restricción:** Unique(organizationId, position)
- **isWinStage/isLoseStage:** Etapas terminales que cierran el deal.

#### Task

```
Task {
  id: string (cuid)
  title: string
  description: string?
  priority: TaskPriority (LOW | MEDIUM | HIGH | URGENT)
  status: TaskStatus (PENDING | IN_PROGRESS | COMPLETED | CANCELLED)
  dueDate: DateTime?
  reminderAt: DateTime?
  completedAt: DateTime?
  organizationId: string (FK)
  createdById: string (FK → User)
  assignedTo: string? (FK → User)
  clientId: string? (FK → Client)
  dealId: string? (FK → Deal)
  createdAt: DateTime
  updatedAt: DateTime
}
```

- **Responsabilidad:** Gestión de tareas vinculables a cualquier entidad.
- **Relaciones:** N:1 → Organization, CreatedBy, Assignee, Client, Deal

#### Quote

```
Quote {
  id: string (cuid)
  number: string (único, formato automático: Q-{YYYY}-{XXXX})
  title: string
  status: QuoteStatus (DRAFT | SENT | ACCEPTED | REJECTED | EXPIRED)
  subtotal: Money
  taxRate: decimal
  taxAmount: Money
  total: Money
  notes: string?
  terms: string?
  validUntil: DateTime?
  pdfUrl: string?
  sentAt: DateTime?
  acceptedAt: DateTime?
  rejectedAt: DateTime?
  rejectionReason: string?
  organizationId: string (FK)
  clientId: string (FK → Client)
  dealId: string? (FK → Deal)
  createdById: string (FK → User)
  createdAt: DateTime
  updatedAt: DateTime
}
```

- **Responsabilidad:** Cotizaciones con items, generación de PDF, ciclo de vida completo.
- **Relaciones:** N:1 → Organization, Client, Deal, CreatedBy; 1:N → QuoteItems, ActivityLogs

#### QuoteItem

```
QuoteItem {
  id: string (cuid)
  description: string
  quantity: decimal
  unitPrice: Money
  total: Money
  quoteId: string (FK → Quote)
}
```

#### ActivityLog

```
ActivityLog {
  id: string (cuid)
  type: ActivityType
  description: string
  metadata: Json? (datos contextuales variables)
  organizationId: string (FK)
  userId: string (FK → User)
  clientId: string? (FK → Client)
  dealId: string? (FK → Deal)
  taskId: string? (FK → Task)
  quoteId: string? (FK → Quote)
  createdAt: DateTime
}
```

- **Responsabilidad:** Auditoría de actividad polimórfica.
- **Polimorfismo:** Los campos `*Id` opcionales permiten vincular el log a cualquier entidad.

#### Workflow

```
Workflow {
  id: string (cuid)
  name: string
  description: string?
  trigger: WorkflowTrigger (event | schedule | webhook)
  triggerConfig: Json     // Configuración del trigger
  conditions: Json?       // Array de condiciones
  actions: Json           // Array de acciones (secuencia)
  isActive: boolean
  lastRunAt: DateTime?
  organizationId: string (FK)
  createdById: string (FK → User)
  createdAt: DateTime
  updatedAt: DateTime
}
```

- **Responsabilidad:** Automatización de procesos de negocio.
- **trigger:** event (reacciona a evento), schedule (cron), webhook (endpoint público)

#### WorkflowExecutionLog

```
WorkflowExecutionLog {
  id: string (cuid)
  workflowId: string (FK)
  status: ExecutionStatus (SUCCESS | FAILED | PARTIAL)
  triggerType: string
  input: Json
  output: Json
  error: string?
  startedAt: DateTime
  completedAt: DateTime?
  organizationId: string (FK)
}
```

#### Subscription (Billing)

```
Subscription {
  id: string (cuid)
  organizationId: string (FK, unique)
  plan: Plan (free | starter | professional | enterprise)
  status: SubscriptionStatus (ACTIVE | PAST_DUE | CANCELED | EXPIRED)
  currentPeriodStart: DateTime
  currentPeriodEnd: DateTime
  trialEndsAt: DateTime?
  canceledAt: DateTime?
  paymentProviderId: string?     // ID en Stripe/Paddle
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### UsageRecord

```
UsageRecord {
  id: string (cuid)
  organizationId: string (FK)
  metric: string          // Ej: "clients", "deals", "ai_queries"
  value: int
  periodStart: DateTime
  periodEnd: DateTime
}
```

#### FeatureFlag

```
FeatureFlag {
  id: string (cuid)
  key: string              // Ej: "workflows", "ai_copilot", "bulk_import"
  name: string
  description: string?
  enabledByDefault: boolean
  minPlan: Plan            // Plan mínimo requerido
  isActive: boolean
  organizationOverrides: OrganizationFeatureOverride[]
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### OrganizationFeatureOverride

```
OrganizationFeatureOverride {
  id: string (cuid)
  organizationId: string (FK)
  featureFlagId: string (FK)
  enabled: boolean
}
```

#### Plugin

```
Plugin {
  id: string (cuid)
  name: string (único)
  displayName: string
  description: string?
  version: string
  source: PluginSource (npm | filesystem | marketplace)
  isActive: boolean
  config: Json?             // Configuración del plugin por organización
  permissions: string[]     // Permisos que solicita el plugin
  organizationId: string (FK)
  installedById: string (FK → User)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### AuditLog

```
AuditLog {
  id: string (cuid)
  eventType: string         // Nombre del dominio evento
  entityType: string        // "client", "deal", "task", etc.
  entityId: string
  organizationId: string (FK)
  userId: string (FK → User)
  action: string            // "created", "updated", "deleted", "moved"
  changes: Json?            // { before: {}, after: {} }
  metadata: Json?
  ipAddress: string?
  userAgent: string?
  createdAt: DateTime
}
// PARTITIONED BY RANGE (createdAt)
```

### 3.2 Value Objects

| Value Object | Propiedades                                | Validación                             |
| ------------ | ------------------------------------------ | -------------------------------------- |
| `Email`      | `value: string`                            | RFC 5322, normalizado a lowercase      |
| `Phone`      | `value: string`                            | E.164, +525512345678                   |
| `Money`      | `amount: number, currency: string`         | amount ≥ 0, currency ISO 4217          |
| `Address`    | `line1, line2?, city, state, zip, country` | country ISO 3166-1 alpha-2             |
| `Slug`       | `value: string`                            | lowercase, sin espacios, max 100 chars |
| `Percentage` | `value: number`                            | 0-100                                  |

### 3.3 Domain Events

Definidos en la [Sección 6 — Eventos](#6-eventos).

---

## 4. Base de datos

### 4.1 Diseño del schema definitivo

**Motor:** PostgreSQL 16+
**ORM:** Prisma 6.x
**Convención:** snake_case para tablas y columnas. IDs tipo CUID.

### 4.2 Tablas

#### organizations

| Columna   | Tipo        | Restricciones            |
| --------- | ----------- | ------------------------ |
| id        | TEXT        | PK, CUID                 |
| name      | TEXT        | NOT NULL                 |
| slug      | TEXT        | UNIQUE, NOT NULL         |
| logo      | TEXT        | NULL                     |
| plan      | TEXT        | NOT NULL, DEFAULT 'free' |
| createdAt | TIMESTAMPTZ | NOT NULL, DEFAULT now()  |
| updatedAt | TIMESTAMPTZ | NOT NULL, auto-update    |

#### users

| Columna        | Tipo           | Restricciones                   |
| -------------- | -------------- | ------------------------------- |
| id             | TEXT           | PK, CUID                        |
| email          | TEXT           | UNIQUE, NOT NULL                |
| passwordHash   | TEXT           | NOT NULL                        |
| firstName      | TEXT           | NOT NULL                        |
| lastName       | TEXT           | NOT NULL                        |
| avatarUrl      | TEXT           | NULL                            |
| phone          | TEXT           | NULL                            |
| role           | ENUM(UserRole) | NOT NULL, DEFAULT 'MEMBER'      |
| isActive       | BOOLEAN        | NOT NULL, DEFAULT true          |
| refreshToken   | TEXT           | NULL                            |
| lastLoginAt    | TIMESTAMPTZ    | NULL                            |
| organizationId | TEXT           | NOT NULL, FK → organizations.id |
| createdAt      | TIMESTAMPTZ    | NOT NULL                        |
| updatedAt      | TIMESTAMPTZ    | NOT NULL                        |

**Índices:** `(organizationId)`, `(email)`, `(organizationId, role)`

#### clients

| Columna        | Tipo        | Restricciones                   |
| -------------- | ----------- | ------------------------------- |
| id             | TEXT        | PK, CUID                        |
| companyName    | TEXT        | NOT NULL                        |
| contactName    | TEXT        | NOT NULL                        |
| email          | TEXT        | NULL                            |
| phone          | TEXT        | NULL                            |
| address        | TEXT        | NULL                            |
| tags           | TEXT[]      | NOT NULL, DEFAULT []            |
| notes          | TEXT        | NULL                            |
| isDeleted      | BOOLEAN     | NOT NULL, DEFAULT false         |
| deletedAt      | TIMESTAMPTZ | NULL                            |
| organizationId | TEXT        | NOT NULL, FK → organizations.id |
| createdAt      | TIMESTAMPTZ | NOT NULL                        |
| updatedAt      | TIMESTAMPTZ | NOT NULL                        |

**Índices:** `(organizationId)`, `(email)`, `(companyName)`, `(organizationId, isDeleted)`

#### pipeline_stages

| Columna        | Tipo        | Restricciones                   |
| -------------- | ----------- | ------------------------------- |
| id             | TEXT        | PK, CUID                        |
| name           | TEXT        | NOT NULL                        |
| position       | INTEGER     | NOT NULL                        |
| color          | TEXT        | NOT NULL, DEFAULT '#6366f1'     |
| isWinStage     | BOOLEAN     | NOT NULL, DEFAULT false         |
| isLoseStage    | BOOLEAN     | NOT NULL, DEFAULT false         |
| organizationId | TEXT        | NOT NULL, FK → organizations.id |
| createdAt      | TIMESTAMPTZ | NOT NULL                        |
| updatedAt      | TIMESTAMPTZ | NOT NULL                        |

**Restricciones:** UNIQUE(organizationId, position)
**Índices:** `(organizationId)`

#### deals

| Columna        | Tipo          | Restricciones                             |
| -------------- | ------------- | ----------------------------------------- |
| id             | TEXT          | PK, CUID                                  |
| title          | TEXT          | NOT NULL                                  |
| value          | DECIMAL(12,2) | NOT NULL, DEFAULT 0                       |
| currency       | TEXT          | NOT NULL, DEFAULT 'USD'                   |
| probability    | INTEGER       | NOT NULL, DEFAULT 0, CHECK(0-100)         |
| notes          | TEXT          | NULL                                      |
| closeDate      | TIMESTAMPTZ   | NULL                                      |
| lostReason     | TEXT          | NULL                                      |
| position       | INTEGER       | NOT NULL, DEFAULT 0                       |
| organizationId | TEXT          | NOT NULL, FK → organizations.id           |
| stageId        | TEXT          | NOT NULL, FK → pipeline_stages.id         |
| clientId       | TEXT          | NULL, FK → clients.id, ON DELETE SET NULL |
| assignedTo     | TEXT          | NULL, FK → users.id, ON DELETE SET NULL   |
| createdAt      | TIMESTAMPTZ   | NOT NULL                                  |
| updatedAt      | TIMESTAMPTZ   | NOT NULL                                  |

**Índices:** `(organizationId)`, `(stageId)`, `(clientId)`, `(assignedTo)`, `(organizationId, stageId, position)`

#### tasks

| Columna        | Tipo               | Restricciones                             |
| -------------- | ------------------ | ----------------------------------------- |
| id             | TEXT               | PK, CUID                                  |
| title          | TEXT               | NOT NULL                                  |
| description    | TEXT               | NULL                                      |
| priority       | ENUM(TaskPriority) | NOT NULL, DEFAULT 'MEDIUM'                |
| status         | ENUM(TaskStatus)   | NOT NULL, DEFAULT 'PENDING'               |
| dueDate        | TIMESTAMPTZ        | NULL                                      |
| reminderAt     | TIMESTAMPTZ        | NULL                                      |
| completedAt    | TIMESTAMPTZ        | NULL                                      |
| organizationId | TEXT               | NOT NULL, FK → organizations.id           |
| createdById    | TEXT               | NOT NULL, FK → users.id                   |
| assignedTo     | TEXT               | NULL, FK → users.id, ON DELETE SET NULL   |
| clientId       | TEXT               | NULL, FK → clients.id, ON DELETE SET NULL |
| dealId         | TEXT               | NULL, FK → deals.id, ON DELETE SET NULL   |
| createdAt      | TIMESTAMPTZ        | NOT NULL                                  |
| updatedAt      | TIMESTAMPTZ        | NOT NULL                                  |

**Índices:** `(organizationId)`, `(assignedTo)`, `(clientId)`, `(dealId)`, `(status)`, `(organizationId, status, priority)`

#### quotes

| Columna         | Tipo              | Restricciones                           |
| --------------- | ----------------- | --------------------------------------- |
| id              | TEXT              | PK, CUID                                |
| number          | TEXT              | UNIQUE, NOT NULL                        |
| title           | TEXT              | NOT NULL                                |
| status          | ENUM(QuoteStatus) | NOT NULL, DEFAULT 'DRAFT'               |
| subtotal        | DECIMAL(12,2)     | NOT NULL, DEFAULT 0                     |
| taxRate         | DECIMAL(5,2)      | NOT NULL, DEFAULT 0                     |
| taxAmount       | DECIMAL(12,2)     | NOT NULL, DEFAULT 0                     |
| total           | DECIMAL(12,2)     | NOT NULL, DEFAULT 0                     |
| notes           | TEXT              | NULL                                    |
| terms           | TEXT              | NULL                                    |
| validUntil      | TIMESTAMPTZ       | NULL                                    |
| pdfUrl          | TEXT              | NULL                                    |
| sentAt          | TIMESTAMPTZ       | NULL                                    |
| acceptedAt      | TIMESTAMPTZ       | NULL                                    |
| rejectedAt      | TIMESTAMPTZ       | NULL                                    |
| rejectionReason | TEXT              | NULL                                    |
| organizationId  | TEXT              | NOT NULL, FK → organizations.id         |
| clientId        | TEXT              | NOT NULL, FK → clients.id               |
| dealId          | TEXT              | NULL, FK → deals.id, ON DELETE SET NULL |
| createdById     | TEXT              | NOT NULL, FK → users.id                 |
| createdAt       | TIMESTAMPTZ       | NOT NULL                                |
| updatedAt       | TIMESTAMPTZ       | NOT NULL                                |

**Índices:** `(organizationId)`, `(clientId)`, `(dealId)`, `(number)`, `(organizationId, status)`

#### quote_items

| Columna     | Tipo          | Restricciones                               |
| ----------- | ------------- | ------------------------------------------- |
| id          | TEXT          | PK, CUID                                    |
| description | TEXT          | NOT NULL                                    |
| quantity    | DECIMAL(10,2) | NOT NULL, DEFAULT 1                         |
| unitPrice   | DECIMAL(12,2) | NOT NULL, DEFAULT 0                         |
| total       | DECIMAL(12,2) | NOT NULL, DEFAULT 0                         |
| quoteId     | TEXT          | NOT NULL, FK → quotes.id, ON DELETE CASCADE |

**Índices:** `(quoteId)`

#### activity_logs

| Columna        | Tipo               | Restricciones                   |
| -------------- | ------------------ | ------------------------------- |
| id             | TEXT               | PK, CUID                        |
| type           | ENUM(ActivityType) | NOT NULL                        |
| description    | TEXT               | NOT NULL                        |
| metadata       | JSONB              | NULL                            |
| organizationId | TEXT               | NOT NULL, FK → organizations.id |
| userId         | TEXT               | NOT NULL, FK → users.id         |
| clientId       | TEXT               | NULL, FK → clients.id           |
| dealId         | TEXT               | NULL, FK → deals.id             |
| taskId         | TEXT               | NULL, FK → tasks.id             |
| quoteId        | TEXT               | NULL, FK → quotes.id            |
| createdAt      | TIMESTAMPTZ        | NOT NULL                        |

**Índices:** `(organizationId, createdAt DESC)`, `(userId)`, `(clientId)`, `(dealId)`, `(taskId)`, `(quoteId)`, `(type)`

#### audit_logs 🌟 NUEVO

| Columna        | Tipo        | Restricciones                   |
| -------------- | ----------- | ------------------------------- |
| id             | TEXT        | PK, CUID                        |
| eventType      | TEXT        | NOT NULL                        |
| entityType     | TEXT        | NOT NULL                        |
| entityId       | TEXT        | NOT NULL                        |
| organizationId | TEXT        | NOT NULL, FK → organizations.id |
| userId         | TEXT        | NOT NULL, FK → users.id         |
| action         | TEXT        | NOT NULL                        |
| changes        | JSONB       | NULL                            |
| metadata       | JSONB       | NULL                            |
| ipAddress      | TEXT        | NULL                            |
| userAgent      | TEXT        | NULL                            |
| createdAt      | TIMESTAMPTZ | NOT NULL                        |

**Índices:** `(organizationId, createdAt DESC)`, `(entityType, entityId)`, `(eventType)`, `(userId)`
**Particionamiento:** BY RANGE (createdAt), particiones mensuales

#### search_index 🌟 NUEVO

| Columna        | Tipo        | Restricciones                   |
| -------------- | ----------- | ------------------------------- |
| id             | TEXT        | PK, CUID                        |
| entityType     | TEXT        | NOT NULL                        |
| entityId       | TEXT        | NOT NULL, UNIQUE                |
| organizationId | TEXT        | NOT NULL, FK → organizations.id |
| title          | TEXT        | NOT NULL                        |
| content        | TEXT        | NOT NULL                        |
| searchVector   | TSVECTOR    | NOT NULL (generated)            |
| metadata       | JSONB       | NULL                            |
| createdAt      | TIMESTAMPTZ | NOT NULL                        |
| updatedAt      | TIMESTAMPTZ | NOT NULL                        |

**Índices:** `(organizationId)`, GIN `(searchVector)`, UNIQUE `(entityType, entityId)`

#### workflows 🌟 NUEVO

| Columna        | Tipo        | Restricciones                             |
| -------------- | ----------- | ----------------------------------------- |
| id             | TEXT        | PK, CUID                                  |
| name           | TEXT        | NOT NULL                                  |
| description    | TEXT        | NULL                                      |
| trigger        | TEXT        | NOT NULL ('event', 'schedule', 'webhook') |
| triggerConfig  | JSONB       | NOT NULL                                  |
| conditions     | JSONB       | NULL                                      |
| actions        | JSONB       | NOT NULL                                  |
| isActive       | BOOLEAN     | NOT NULL, DEFAULT true                    |
| lastRunAt      | TIMESTAMPTZ | NULL                                      |
| organizationId | TEXT        | NOT NULL, FK → organizations.id           |
| createdById    | TEXT        | NOT NULL, FK → users.id                   |
| createdAt      | TIMESTAMPTZ | NOT NULL                                  |
| updatedAt      | TIMESTAMPTZ | NOT NULL                                  |

**Índices:** `(organizationId)`, `(organizationId, isActive)`

#### workflow_execution_logs 🌟 NUEVO

| Columna        | Tipo        | Restricciones                             |
| -------------- | ----------- | ----------------------------------------- |
| id             | TEXT        | PK, CUID                                  |
| workflowId     | TEXT        | NOT NULL, FK → workflows.id               |
| status         | TEXT        | NOT NULL ('SUCCESS', 'FAILED', 'PARTIAL') |
| triggerType    | TEXT        | NOT NULL                                  |
| input          | JSONB       | NOT NULL                                  |
| output         | JSONB       | NULL                                      |
| error          | TEXT        | NULL                                      |
| startedAt      | TIMESTAMPTZ | NOT NULL                                  |
| completedAt    | TIMESTAMPTZ | NULL                                      |
| organizationId | TEXT        | NOT NULL, FK → organizations.id           |

**Índices:** `(workflowId)`, `(organizationId, startedAt DESC)`, `(status)`

#### subscriptions 🌟 NUEVO

| Columna            | Tipo        | Restricciones                           |
| ------------------ | ----------- | --------------------------------------- |
| id                 | TEXT        | PK, CUID                                |
| organizationId     | TEXT        | UNIQUE, NOT NULL, FK → organizations.id |
| plan               | TEXT        | NOT NULL                                |
| status             | TEXT        | NOT NULL                                |
| currentPeriodStart | TIMESTAMPTZ | NOT NULL                                |
| currentPeriodEnd   | TIMESTAMPTZ | NOT NULL                                |
| trialEndsAt        | TIMESTAMPTZ | NULL                                    |
| canceledAt         | TIMESTAMPTZ | NULL                                    |
| paymentProviderId  | TEXT        | NULL                                    |
| createdAt          | TIMESTAMPTZ | NOT NULL                                |
| updatedAt          | TIMESTAMPTZ | NOT NULL                                |

#### usage_records 🌟 NUEVO

| Columna        | Tipo        | Restricciones                   |
| -------------- | ----------- | ------------------------------- |
| id             | TEXT        | PK, CUID                        |
| organizationId | TEXT        | NOT NULL, FK → organizations.id |
| metric         | TEXT        | NOT NULL                        |
| value          | INTEGER     | NOT NULL                        |
| periodStart    | TIMESTAMPTZ | NOT NULL                        |
| periodEnd      | TIMESTAMPTZ | NOT NULL                        |

**Índices:** `(organizationId, metric, periodStart)`, `(organizationId, periodStart)`

#### feature_flags 🌟 NUEVO

| Columna          | Tipo        | Restricciones           |
| ---------------- | ----------- | ----------------------- |
| id               | TEXT        | PK, CUID                |
| key              | TEXT        | UNIQUE, NOT NULL        |
| name             | TEXT        | NOT NULL                |
| description      | TEXT        | NULL                    |
| enabledByDefault | BOOLEAN     | NOT NULL, DEFAULT false |
| minPlan          | TEXT        | NOT NULL                |
| isActive         | BOOLEAN     | NOT NULL, DEFAULT true  |
| createdAt        | TIMESTAMPTZ | NOT NULL                |
| updatedAt        | TIMESTAMPTZ | NOT NULL                |

#### organization_feature_overrides 🌟 NUEVO

| Columna        | Tipo    | Restricciones                   |
| -------------- | ------- | ------------------------------- |
| id             | TEXT    | PK, CUID                        |
| organizationId | TEXT    | NOT NULL, FK → organizations.id |
| featureFlagId  | TEXT    | NOT NULL, FK → feature_flags.id |
| enabled        | BOOLEAN | NOT NULL                        |

**Restricciones:** UNIQUE(organizationId, featureFlagId)

#### plugins 🌟 NUEVO

| Columna        | Tipo        | Restricciones                   |
| -------------- | ----------- | ------------------------------- |
| id             | TEXT        | PK, CUID                        |
| name           | TEXT        | UNIQUE, NOT NULL                |
| displayName    | TEXT        | NOT NULL                        |
| description    | TEXT        | NULL                            |
| version        | TEXT        | NOT NULL                        |
| source         | TEXT        | NOT NULL                        |
| isActive       | BOOLEAN     | NOT NULL, DEFAULT false         |
| config         | JSONB       | NULL                            |
| permissions    | TEXT[]      | NOT NULL, DEFAULT []            |
| organizationId | TEXT        | NOT NULL, FK → organizations.id |
| installedById  | TEXT        | NOT NULL, FK → users.id         |
| createdAt      | TIMESTAMPTZ | NOT NULL                        |
| updatedAt      | TIMESTAMPTZ | NOT NULL                        |

**Índices:** `(organizationId)`, `(name)`

#### dashboard_projections 🌟 NUEVO

| Columna           | Tipo          | Restricciones                           |
| ----------------- | ------------- | --------------------------------------- |
| id                | TEXT          | PK, CUID                                |
| organizationId    | TEXT          | UNIQUE, NOT NULL, FK → organizations.id |
| monthlySales      | DECIMAL(14,2) | NOT NULL, DEFAULT 0                     |
| newClients        | INTEGER       | NOT NULL, DEFAULT 0                     |
| openOpportunities | INTEGER       | NOT NULL, DEFAULT 0                     |
| pendingTasks      | INTEGER       | NOT NULL, DEFAULT 0                     |
| wonDeals          | JSONB         | NOT NULL, DEFAULT '[]'                  |
| updatedAt         | TIMESTAMPTZ   | NOT NULL                                |

### 4.3 Principios de diseño

1. **Multi-tenancy por fila (Row-Level Security):** Cada tabla tiene `organizationId`. Todas las queries filtran por este campo. No usamos schemas separados por tenant.
2. **Soft Delete:** Solo en `clients`. Las demás entidades se eliminan físicamente (cascada controlada por la aplicación).
3. **Auditoría:** `activity_logs` para actividad visible al usuario; `audit_logs` particionada para cumplimiento/seguridad.
4. **Search:** Tabla `search_index` con `tsvector` y índice GIN. Actualizada por eventos. Preparada para migrar a Elasticsearch si escala.
5. **Dashboard:** Tabla `dashboard_projections` actualizada por handlers de eventos. Nunca se agregan millones de registros en tiempo real.
6. **JSONB:** Solo para metadata variable (cambios en audit_logs, config de workflows, metadata de activity). Las columnas críticas tienen tipos fijos.
7. **Índices compuestos:** Preferir índices compuestos sobre índices individuales cuando las queries siempre filtran por organización.

---

## 5. API

### 5.1 Versionado

| Tipo                    | Método     | Ejemplo                |
| ----------------------- | ---------- | ---------------------- |
| **Major (breaking)**    | URL prefix | `/api/v1/`, `/api/v2/` |
| **Minor (no-breaking)** | Header     | `Accept-Version: 1.2`  |

- **Política:** Breaking changes → nuevo version major. Non-breaking → minor version.
- **Deprecación:** Headers `Sunset: Sat, 01 Jan 2027 00:00:00 GMT` y `Deprecation: true` en respuestas de versiones deprecadas.
- **Soporte mínimo:** 6 meses desde el anuncio de deprecación.

### 5.2 Endpoints

#### Auth

| Método | Ruta                    | Descripción                             | Auth   |
| ------ | ----------------------- | --------------------------------------- | ------ |
| POST   | `/api/v1/auth/register` | Registro nueva org + usuario owner      | No     |
| POST   | `/api/v1/auth/login`    | Login, devuelve tokens en cookie y body | No     |
| POST   | `/api/v1/auth/logout`   | Logout, limpia refresh token            | Sí     |
| POST   | `/api/v1/auth/refresh`  | Refresh access token                    | Cookie |
| GET    | `/api/v1/auth/me`       | Perfil del usuario actual               | Sí     |

#### Users

| Método | Ruta                     | Descripción               | Permiso |
| ------ | ------------------------ | ------------------------- | ------- |
| GET    | `/api/v1/users`          | Listar usuarios de la org | ADMIN+  |
| GET    | `/api/v1/users/:id`      | Obtener usuario           | ADMIN+  |
| PATCH  | `/api/v1/users/:id`      | Actualizar usuario        | ADMIN+  |
| PATCH  | `/api/v1/users/:id/role` | Cambiar rol               | OWNER   |
| DELETE | `/api/v1/users/:id`      | Desactivar usuario        | ADMIN+  |

#### Organizations

| Método | Ruta                              | Descripción    | Permiso     |
| ------ | --------------------------------- | -------------- | ----------- |
| GET    | `/api/v1/organizations/:id`       | Obtener org    | OWNER/ADMIN |
| PATCH  | `/api/v1/organizations/:id`       | Actualizar org | OWNER       |
| GET    | `/api/v1/organizations/:id/usage` | Uso actual     | ADMIN+      |

#### Clients

| Método | Ruta                           | Descripción                        | Permiso |
| ------ | ------------------------------ | ---------------------------------- | ------- |
| GET    | `/api/v1/clients`              | Listar (paginado, filtro por tags) | MEMBER+ |
| GET    | `/api/v1/clients/search`       | Búsqueda                           | MEMBER+ |
| GET    | `/api/v1/clients/:id`          | Obtener cliente                    | MEMBER+ |
| POST   | `/api/v1/clients`              | Crear cliente                      | MEMBER+ |
| PATCH  | `/api/v1/clients/:id`          | Actualizar cliente                 | MEMBER+ |
| DELETE | `/api/v1/clients/:id`          | Soft delete                        | ADMIN+  |
| GET    | `/api/v1/clients/:id/deals`    | Deals del cliente                  | MEMBER+ |
| GET    | `/api/v1/clients/:id/tasks`    | Tareas del cliente                 | MEMBER+ |
| GET    | `/api/v1/clients/:id/activity` | Actividad del cliente              | MEMBER+ |

#### Pipeline

| Método | Ruta                              | Descripción      | Permiso |
| ------ | --------------------------------- | ---------------- | ------- |
| GET    | `/api/v1/pipeline/stages`         | Listar etapas    | MEMBER+ |
| POST   | `/api/v1/pipeline/stages`         | Crear etapa      | ADMIN+  |
| PATCH  | `/api/v1/pipeline/stages/:id`     | Actualizar etapa | ADMIN+  |
| DELETE | `/api/v1/pipeline/stages/:id`     | Eliminar etapa   | ADMIN+  |
| PATCH  | `/api/v1/pipeline/stages/reorder` | Reordenar etapas | ADMIN+  |

#### Deals

| Método | Ruta                     | Descripción                  | Permiso |
| ------ | ------------------------ | ---------------------------- | ------- |
| GET    | `/api/v1/deals`          | Listar (por etapa, paginado) | MEMBER+ |
| GET    | `/api/v1/deals/:id`      | Obtener deal                 | MEMBER+ |
| POST   | `/api/v1/deals`          | Crear deal                   | MEMBER+ |
| PATCH  | `/api/v1/deals/:id`      | Actualizar deal              | MEMBER+ |
| PATCH  | `/api/v1/deals/:id/move` | Mover de etapa (DnD)         | MEMBER+ |
| DELETE | `/api/v1/deals/:id`      | Eliminar deal                | ADMIN+  |

#### Tasks

| Método | Ruta                         | Descripción                                   | Permiso |
| ------ | ---------------------------- | --------------------------------------------- | ------- |
| GET    | `/api/v1/tasks`              | Listar (filtro: status, priority, assignedTo) | MEMBER+ |
| GET    | `/api/v1/tasks/:id`          | Obtener tarea                                 | MEMBER+ |
| POST   | `/api/v1/tasks`              | Crear tarea                                   | MEMBER+ |
| PATCH  | `/api/v1/tasks/:id`          | Actualizar tarea                              | MEMBER+ |
| PATCH  | `/api/v1/tasks/:id/complete` | Completar tarea                               | MEMBER+ |
| DELETE | `/api/v1/tasks/:id`          | Eliminar tarea                                | ADMIN+  |

#### Quotes

| Método | Ruta                        | Descripción                       | Permiso |
| ------ | --------------------------- | --------------------------------- | ------- |
| GET    | `/api/v1/quotes`            | Listar (filtro: status, clientId) | MEMBER+ |
| GET    | `/api/v1/quotes/:id`        | Obtener cotización + items        | MEMBER+ |
| POST   | `/api/v1/quotes`            | Crear cotización con items        | MEMBER+ |
| PATCH  | `/api/v1/quotes/:id`        | Actualizar cotización             | MEMBER+ |
| PATCH  | `/api/v1/quotes/:id/send`   | Marcar como enviada               | MEMBER+ |
| PATCH  | `/api/v1/quotes/:id/accept` | Aceptar cotización                | ADMIN+  |
| PATCH  | `/api/v1/quotes/:id/reject` | Rechazar cotización               | ADMIN+  |
| GET    | `/api/v1/quotes/:id/pdf`    | Descargar PDF                     | MEMBER+ |
| DELETE | `/api/v1/quotes/:id`        | Eliminar cotización (solo DRAFT)  | ADMIN+  |

#### Dashboard

| Método | Ruta                          | Descripción             | Permiso |
| ------ | ----------------------------- | ----------------------- | ------- |
| GET    | `/api/v1/dashboard`           | KPIs principales        | MEMBER+ |
| GET    | `/api/v1/dashboard/activity`  | Actividad reciente      | MEMBER+ |
| GET    | `/api/v1/dashboard/won-deals` | Deals ganados (gráfico) | MEMBER+ |

#### Activity

| Método | Ruta               | Descripción                          | Permiso |
| ------ | ------------------ | ------------------------------------ | ------- |
| GET    | `/api/v1/activity` | Listar actividad (paginado, filtros) | MEMBER+ |

#### Search 🌟 NUEVO

| Método | Ruta             | Descripción                      | Permiso |
| ------ | ---------------- | -------------------------------- | ------- |
| GET    | `/api/v1/search` | Búsqueda global (q, type filter) | MEMBER+ |

#### AI

| Método | Ruta                 | Descripción                             | Permiso |
| ------ | -------------------- | --------------------------------------- | ------- |
| POST   | `/api/v1/ai/query`   | Query directa al AI Copilot (historial) | MEMBER+ |
| POST   | `/api/v1/ai/summary` | Resumen del pipeline/dashboard          | MEMBER+ |

#### Commands 🌟 NUEVO

| Método | Ruta                            | Descripción                       | Permiso |
| ------ | ------------------------------- | --------------------------------- | ------- |
| POST   | `/api/v1/commands`              | Ejecutar comando (Command Center) | MEMBER+ |
| GET    | `/api/v1/commands/history`      | Historial de comandos del usuario | MEMBER+ |
| GET    | `/api/v1/commands/favorites`    | Favoritos del usuario             | MEMBER+ |
| POST   | `/api/v1/commands/:id/favorite` | Marcar/desmarcar favorito         | MEMBER+ |

#### Workflows 🌟 NUEVO

| Método | Ruta                           | Descripción            | Permiso |
| ------ | ------------------------------ | ---------------------- | ------- |
| GET    | `/api/v1/workflows`            | Listar workflows       | ADMIN+  |
| POST   | `/api/v1/workflows`            | Crear workflow         | ADMIN+  |
| PATCH  | `/api/v1/workflows/:id`        | Actualizar workflow    | ADMIN+  |
| PATCH  | `/api/v1/workflows/:id/toggle` | Activar/desactivar     | ADMIN+  |
| DELETE | `/api/v1/workflows/:id`        | Eliminar workflow      | ADMIN+  |
| GET    | `/api/v1/workflows/:id/logs`   | Historial de ejecución | ADMIN+  |
| POST   | `/api/v1/workflows/:id/test`   | Testear workflow       | ADMIN+  |

#### Billing 🌟 NUEVO

| Método | Ruta                          | Descripción            | Permiso |
| ------ | ----------------------------- | ---------------------- | ------- |
| GET    | `/api/v1/billing`             | Suscripción actual     | ADMIN+  |
| GET    | `/api/v1/billing/usage`       | Uso actual del período | MEMBER+ |
| POST   | `/api/v1/billing/change-plan` | Cambiar plan           | OWNER   |
| POST   | `/api/v1/billing/portal`      | Link al portal de pago | OWNER   |

#### Settings

| Método | Ruta               | Descripción              | Permiso |
| ------ | ------------------ | ------------------------ | ------- |
| GET    | `/api/v1/settings` | Obtener configuración    | MEMBER+ |
| PATCH  | `/api/v1/settings` | Actualizar configuración | ADMIN+  |

#### Plugin 🌟 NUEVO

| Método | Ruta                         | Descripción               | Permiso |
| ------ | ---------------------------- | ------------------------- | ------- |
| GET    | `/api/v1/plugins`            | Listar plugins instalados | ADMIN+  |
| POST   | `/api/v1/plugins`            | Instalar plugin           | OWNER   |
| PATCH  | `/api/v1/plugins/:id/toggle` | Activar/desactivar        | ADMIN+  |
| PATCH  | `/api/v1/plugins/:id/config` | Actualizar configuración  | ADMIN+  |
| DELETE | `/api/v1/plugins/:id`        | Desinstalar plugin        | OWNER   |

### 5.3 Errores

Formato unificado de error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Error de validación",
    "details": [{ "field": "email", "message": "Email inválido", "code": "invalid_string" }]
  }
}
```

| Código HTTP | Código interno        | Significado                              |
| ----------- | --------------------- | ---------------------------------------- |
| 400         | `VALIDATION_ERROR`    | Error de validación Zod                  |
| 401         | `UNAUTHORIZED`        | Token faltante o inválido                |
| 401         | `TOKEN_EXPIRED`       | Access token expirado                    |
| 401         | `TOKEN_STOLEN`        | Refresh token reutilizado (posible robo) |
| 403         | `FORBIDDEN`           | No tiene permiso                         |
| 404         | `NOT_FOUND`           | Recurso no existe                        |
| 409         | `CONFLICT`            | Conflicto (ej: email duplicado)          |
| 429         | `RATE_LIMIT_EXCEEDED` | Demasiadas requests                      |
| 500         | `INTERNAL_ERROR`      | Error interno del servidor               |

### 5.4 Convenciones

1. **Respuesta exitosa:** `{ success: true, data: T }`
2. **Paginación:** Params `?page=1&limit=20`. Response: `{ success: true, data: T[], meta: { total, page, limit, totalPages } }`
3. **Fechas:** ISO 8601 en UTC (`2026-06-26T14:30:00Z`)
4. **Moneda:** Números (enteros o decimales según campo), no strings formateados
5. **IDs:** Strings (CUID), no números autoincrementales
6. **Snake case en queries:** `?created_at=2026-06-26` (Zod pipe transforma a camelCase internamente)
7. **Idempotencia:** POST `/api/v1/clients` con header `Idempotency-Key` (futuro)

### 5.5 Autenticación y Permisos

- **Access Token:** JWT, 15 minutos, en cookie HttpOnly + header Authorization
- **Refresh Token:** JWT, 7 días, en cookie HttpOnly, hasheado en BD
- **Rotación:** Cada refresh emite nuevo par. El anterior expira inmediatamente.
- **Detección de robo:** Si un refresh token reutilizado es detectado, se invalidan todos los tokens del usuario.
- **Roles:** Los guards verifican rol mínimo según decorador `@Roles(UserRole.ADMIN)`
- **Permisos granulares (futuro):** `@RequirePermission('clients:delete')`

---

## 6. Eventos

### 6.1 Formato de evento

```typescript
interface DomainEvent {
  eventName: string; // Ej: "client.created"
  aggregateType: string; // Ej: "client"
  aggregateId: string; // ID de la entidad
  payload: Record<string, unknown>;
  metadata: {
    organizationId: string;
    userId: string;
    correlationId: string;
    timestamp: Date;
  };
}
```

### 6.2 Catálogo oficial

| Evento                 | Payload                                                     | Emisor               | Consumidores                                                                                                 |
| ---------------------- | ----------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `organization.created` | `{ organizationId, name, slug, ownerId }`                   | AuthService          | ActivityHandler, AuditHandler                                                                                |
| `user.invited`         | `{ userId, email, role, invitedBy }`                        | UsersService         | NotifyHandler (email invite)                                                                                 |
| `user.joined`          | `{ userId, organizationId }`                                | AuthService          | ActivityHandler, AuditHandler                                                                                |
| `user.role.changed`    | `{ userId, oldRole, newRole, changedBy }`                   | UsersService         | ActivityHandler, AuditHandler                                                                                |
| `client.created`       | `{ clientId, companyName, tags }`                           | ClientsService       | ActivityHandler, DashboardHandler, SearchHandler, AuditHandler, WorkflowHandler                              |
| `client.updated`       | `{ clientId, changes }`                                     | ClientsService       | ActivityHandler, SearchHandler, AuditHandler, WorkflowHandler                                                |
| `client.deleted`       | `{ clientId, companyName }`                                 | ClientsService       | ActivityHandler, SearchHandler, AuditHandler                                                                 |
| `deal.created`         | `{ dealId, title, value, stageId, clientId }`               | PipelineService      | ActivityHandler, DashboardHandler, SearchHandler, AuditHandler, WorkflowHandler                              |
| `deal.moved`           | `{ dealId, fromStageId, toStageId, position }`              | PipelineService      | ActivityHandler, DashboardHandler, AuditHandler, WorkflowHandler                                             |
| `deal.won`             | `{ dealId, value, clientId }`                               | PipelineService      | ActivityHandler, DashboardHandler (increment monthlySales), AuditHandler, WorkflowHandler                    |
| `deal.lost`            | `{ dealId, lostReason, stageId }`                           | PipelineService      | ActivityHandler, DashboardHandler, AuditHandler, WorkflowHandler                                             |
| `deal.updated`         | `{ dealId, changes }`                                       | PipelineService      | ActivityHandler, SearchHandler, AuditHandler                                                                 |
| `task.created`         | `{ taskId, title, priority, assignedTo, clientId, dealId }` | TasksService         | ActivityHandler, DashboardHandler, SearchHandler, AuditHandler, NotifyHandler (if assigned), WorkflowHandler |
| `task.completed`       | `{ taskId, completedBy, completedAt }`                      | TasksService         | ActivityHandler, DashboardHandler, AuditHandler, WorkflowHandler                                             |
| `task.updated`         | `{ taskId, changes }`                                       | TasksService         | ActivityHandler, SearchHandler, AuditHandler                                                                 |
| `quote.created`        | `{ quoteId, number, clientId, total }`                      | QuotesService        | ActivityHandler, SearchHandler, AuditHandler, WorkflowHandler                                                |
| `quote.sent`           | `{ quoteId, clientId, total, sentAt }`                      | QuotesService        | ActivityHandler, AuditHandler, NotifyHandler (email to client), WorkflowHandler                              |
| `quote.accepted`       | `{ quoteId, clientId, total }`                              | QuotesService        | ActivityHandler, DashboardHandler, AuditHandler, NotifyHandler, WorkflowHandler                              |
| `quote.rejected`       | `{ quoteId, reason }`                                       | QuotesService        | ActivityHandler, AuditHandler, WorkflowHandler                                                               |
| `notification.sent`    | `{ notificationId, type, recipientId }`                     | NotificationsService | AuditHandler                                                                                                 |

---

## 7. Tool Registry

### 7.1 Interfaz definitiva

```typescript
// tool.interface.ts
interface ToolDefinition {
  name: string; // Identificador único: "create-client"
  displayName: string; // "Crear cliente"
  description: string; // "Crea un nuevo cliente en el CRM"
  category: ToolCategory; // CRUD | NAVIGATION | AI | WORKFLOW | PLUGIN
  keywords: string[]; // ["crear", "cliente", "nuevo", "alta"]
  permissions: string[]; // ["clients:create"]
  inputSchema: Record<string, unknown>; // JSON Schema de los parámetros
  handler: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

interface ToolContext {
  userId: string;
  organizationId: string;
  role: UserRole;
  permissions: string[];
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
  navigation?: { path: string; label: string }; // Para Command Palette
  naturalLanguage?: string; // Para AI Copilot
}
```

### 7.2 Cómo registrar herramientas

```typescript
// En el módulo correspondiente
@Module({})
export class ClientsModule implements OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly createClientTool: CreateClientTool,
  ) {}

  onModuleInit() {
    this.toolRegistry.register(this.createClientTool);
  }
}
```

**Alternativa vía decorador (futuro):**

```typescript
@Tool({
  name: 'create-client',
  description: 'Crea un nuevo cliente',
  permissions: ['clients:create'],
  keywords: ['crear cliente', 'nuevo cliente', 'alta cliente'],
})
export class CreateClientTool implements Tool { ... }
```

### 7.3 Cómo descubrirlas

```typescript
class ToolRegistryService {
  // Todos los registros
  getAll(): ToolDefinition[];

  // Por nombre exacto
  findByName(name: string): ToolDefinition | undefined;

  // Por intención (keywords + fuzzy match)
  findByIntent(intent: string): ToolDefinition[];

  // Por categoría
  findByCategory(category: ToolCategory): ToolDefinition[];

  // Búsqueda con scoring
  search(query: string): ScoredTool[];
}
```

### 7.4 Cómo ejecutar comandos

```typescript
class CommandCenterService {
  async execute(command: string, context: ToolContext): Promise<CommandResult> {
    // 1. Detectar intención
    const intent = await this.intentDetection.detect(command, context);

    // 2. Verificar permisos
    await this.permissionLayer.verify(intent, context);

    // 3. Encontrar herramienta
    const tool = this.toolRegistry.findByName(intent.toolName);
    if (!tool) throw new ToolNotFoundException(intent.toolName);

    // 4. Validar parámetros contra inputSchema
    const params = this.validateParams(intent.params, tool.inputSchema);

    // 5. Ejecutar
    const result = await tool.handler(params, context);

    // 6. Formatear respuesta
    return this.responseFormatter.format(result, context);
  }
}
```

### 7.5 Cómo validar permisos

```typescript
class PermissionLayerService {
  async verify(intent: IntentResult, context: ToolContext): Promise<void> {
    // 1. Obtener herramienta
    const tool = this.toolRegistry.findByName(intent.toolName);

    // 2. Verificar rol mínimo via feature flags
    const hasPlan = await this.featureFlags.hasAccess(tool.name, context.organizationId);
    if (!hasPlan) throw new PlanLimitException(tool.name);

    // 3. Verificar permisos del rol
    const requiredPermissions = tool.permissions;
    const userPermissions = this.getPermissionsForRole(context.role);
    const hasPermission = requiredPermissions.every((p) => userPermissions.includes(p));
    if (!hasPermission) throw new ForbiddenException(tool.name);

    // 4. ABAC preparado (future): evaluar políticas sobre la entidad
    // await this.abacEvaluator.evaluate(tool, intent, context);
  }
}
```

### 7.6 Cómo manejar errores

| Caso                 | Comportamiento                                                      |
| -------------------- | ------------------------------------------------------------------- |
| Tool no encontrada   | `ToolNotFoundException` → 404, sugerir herramientas similares       |
| Permiso denegado     | `ForbiddenException` → 403, mensaje claro                           |
| Parámetros inválidos | `ValidationException` → 400, detalles de validación                 |
| Error en handler     | Capturar excepción, retornar `ToolResult { success: false, error }` |
| Timeout              | Cancelar después de 30 segundos, retornar error                     |
| Rate limit           | ThrottlerGuard antes de llegar al handler                           |

---

## 8. Command Center

### 8.1 UX completa

La Command Palette es el corazón del sistema. Se activa con `CTRL+K` (Windows/Linux) o `CMD+K` (Mac) desde cualquier pantalla.

#### 8.1.1 Tipos de comandos

| Tipo           | Descripción                  | Ejemplo                                                   |
| -------------- | ---------------------------- | --------------------------------------------------------- |
| **Navegación** | Ir a una página              | "Ir a pipeline", "Abrir clientes"                         |
| **Acción**     | Ejecutar operación CRM       | "Crear cliente TechCorp", "Mover deal a negociación"      |
| **IA**         | Consulta al Business Copilot | "Cuántos deals ganamos este mes?", "Resumen del pipeline" |
| **Búsqueda**   | Buscar entidades             | Buscar "TechCorp", "Maria"                                |

#### 8.1.2 Componentes de la UI

```
┌─────────────────────────────────────────────────────┐
│  CTRL+K  Buscar comandos, clientes, deals...        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─── COMANDOS RECIENTES ──────────────────────┐    │
│  │  📄 Crear cliente                          │    │
│  │  📊 Ir a pipeline                          │    │
│  │  🤖 Resumen del pipeline                   │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─── RESULTADOS ─────────────────────────────┐     │
│  │  🔍 TechCorp S.A. (Cliente)               │     │
│  │  📊 Deal TechCorp (Deal, $50,000)         │     │
│  │  📋 Cotización TC-2024-001 (Quote)        │     │
│  │  📄 Crear cliente "TechCorp" (Acción)     │     │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  [Favoritos] [Historial] [Comandos rápidos]         │
└─────────────────────────────────────────────────────┘
```

#### 8.1.3 Ranking de resultados

El orden de resultados se calcula con un score basado en:

1. **Exactitud de match** (40%): Coincidencia exacta > prefijo > substring > fuzzy
2. **Frecuencia de uso** (25%): Comandos más usados por el usuario
3. **Relevancia temporal** (20%): Comandos usados recientemente
4. **Favoritos del usuario** (10%): Comandos marcados como favoritos
5. **Permisos** (5%): Priorizar comandos que el usuario puede ejecutar

#### 8.1.4 Atajos de teclado

| Atajo          | Acción                                      |
| -------------- | ------------------------------------------- |
| `CTRL+K`       | Abrir/cerrar Command Palette                |
| `CTRL+SHIFT+K` | AI Query directa (modo "pregúntale a Nexa") |
| `↑ ↓`          | Navegar resultados                          |
| `Enter`        | Ejecutar/Elegir                             |
| `Esc`          | Cerrar                                      |
| `Tab`          | Completar sugerencia                        |
| `@`            | Filtrar por tipo (@client, @deal, @task)    |
| `/`            | Modo búsqueda global                        |

#### 8.1.5 Historial y favoritos

- **Historial:** Los últimos 50 comandos ejecutados se almacenan localmente (localStorage) y en el servidor (tabla `command_history`).
- **Favoritos:** El usuario puede marcar comandos como favoritos (star icon). Persistidos en el servidor.
- **Comandos recientes:** Se muestran al abrir la palette sin escribir nada.

#### 8.1.6 Integración con IA

- Si el comando no coincide con ninguna herramienta conocida, se envía al AI Copilot.
- El AI Copilot puede devolver:
  - Respuesta directa (texto)
  - Acción a ejecutar (si detecta intención)
  - Navegación (si sugiere ir a una página)
  - Data formateada (gráfico, tabla)

---

## 9. IA

### 9.1 Arquitectura del AI Business Copilot

```
Query del usuario
    ↓
┌────────────────────────────────────────┐
│         Context Builder                │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ System    │ │ Org      │ │ User    │ │
│  │ Prompt    │ │ Context  │ │ Context │ │
│  └──────────┘ └──────────┘ └────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Permission│ │ Current  │ │ Plugin  │ │
│  │ Context   │ │ Page Ctx │ │ Context │ │
│  └──────────┘ └──────────┘ └────────┘ │
└────────────────┬───────────────────────┘
                 ↓
┌────────────────────────────────────────┐
│         Intent Detection               │
│  ┌──────────────────┐                  │
│  │  Regex (rápido)  │──→ Match: acción directa  │
│  │  + LLM (fallback)│──→ No match: interpretar  │
│  └──────────────────┘                              │
└────────────────┬───────────────────────┘
                 ↓
┌────────────────────────────────────────┐
│         Permission Layer               │
│  └── Verifica rol + feature flag ──→   │
└────────────────┬───────────────────────┘
                 ↓
┌────────────────────────────────────────┐
│         Tool Selection                 │
│  ┌────────────────────────────────┐    │
│  │  ToolRegistry.findByIntent()   │    │
│  │  + LLM decide si no hay match  │    │
│  └────────────────────────────────┘    │
└────────────────┬───────────────────────┘
                 ↓
┌────────────────────────────────────────┐
│         Execution                      │
│  └── Tool.handler(params, context) ──→ │
└────────────────┬───────────────────────┘
                 ↓
┌────────────────────────────────────────┐
│         Response Formatter             │
│  ┌──────────────┐ ┌───────────────┐    │
│  │ Natural      │ │ Structured    │    │
│  │ Language     │ │ Data + Actions│    │
│  └──────────────┘ └───────────────┘    │
└────────────────┬───────────────────────┘
                 ↓
         Respuesta al usuario
```

### 9.2 Context Builder (pipeline de contexto)

```typescript
interface ContextPipeline {
  name: string;
  build(context: AiContext): Promise<string>;
  tokenCount: number; // auto-reportado
}

class ContextBuilderService {
  private pipelines: ContextPipeline[] = [
    new SystemPromptPipeline(),
    new OrganizationContextPipeline(),
    new UserContextPipeline(),
    new PermissionContextPipeline(),
    new CurrentPageContextPipeline(),
    new PluginContextPipeline(), // Plugins agregan su propio contexto
    new ConversationHistoryPipeline(),
    new RelevantDataPipeline(), // Datos relevantes a la query
  ];

  async build(query: string, context: AiContext): Promise<BuiltContext> {
    const parts = await Promise.all(this.pipelines.map((p) => p.build(context)));
    return {
      systemPrompt: parts[0],
      contextParts: parts.slice(1),
      totalTokens: parts.reduce((sum, p) => sum + p.tokenCount, 0),
    };
  }
}
```

### 9.3 Memory

```typescript
interface AiMemory {
  // Session memory (in-memory, volátil)
  getSessionHistory(userId: string): Message[];
  addToSession(userId: string, message: Message): void;
  clearSession(userId: string): void;

  // Persistent memory (Redis)
  getConversationHistory(userId: string, limit: number): Message[];
  saveConversation(userId: string, message: Message): Promise<void>;
}
```

- **Session:** Viva mientras el usuario tenga la página abierta. Almacena el contexto inmediato.
- **Persistente:** 7 días en Redis. Últimos 50 mensajes por usuario.

### 9.4 Intent Detection

```typescript
class IntentDetectionService {
  async detect(query: string, context: AiContext): Promise<IntentResult> {
    // 1. Fast path: regex contra herramientas registradas
    const regexMatch = this.tryRegexMatch(query);
    if (regexMatch) return regexMatch;

    // 2. Slow path: LLM interpreta
    return this.llmInterpret(query, context);
  }

  private tryRegexMatch(query: string): IntentResult | null {
    // Patrones conocidos:
    // "crear cliente X" → tool: create-client, params: { companyName: X }
    // "mover deal X a Y" → tool: move-deal, params: { dealTitle: X, stageName: Y }
    // "ir a pipeline" → navigation: /pipeline
    // "resumen del pipeline" → ai: summary
    return null; // si no hay match
  }
}
```

### 9.5 Tool Selection

```typescript
class ToolSelectionService {
  async select(intent: IntentResult, context: AiContext): Promise<SelectedTool> {
    // 1. Buscar por nombre exacto
    const exact = this.toolRegistry.findByName(intent.toolName);
    if (exact) return { tool: exact, confidence: 1.0 };

    // 2. Buscar por keywords
    const byKeywords = this.toolRegistry.findByIntent(intent.naturalLanguage);
    if (byKeywords.length > 0) return { tool: byKeywords[0], confidence: 0.8 };

    // 3. Dejar que el LLM decida
    return this.llmSelectTool(intent, context);
  }
}
```

### 9.6 Response Formatter

```typescript
interface FormattedResponse {
  type: 'text' | 'action' | 'navigation' | 'data' | 'error';
  content: string; // Texto natural
  data?: Record<string, unknown>; // Datos estructurados
  action?: {
    // Acción a ejecutar
    toolName: string;
    params: Record<string, unknown>;
  };
  navigation?: {
    // Navegación
    path: string;
    label: string;
  };
  suggestions?: string[]; // Preguntas de seguimiento sugeridas
  metadata?: {
    executionTimeMs: number;
    tokensUsed: number;
    source: 'regex' | 'llm';
  };
}
```

### 9.7 Multi-LLM providers

```typescript
interface LLMProvider {
  name: string; // "openai", "claude", "gemini"
  capabilities: LLMCapability[]; // ["chat", "function_calling", "vision"]
  costPerToken: { input: number; output: number };
  maxTokens: number;
  isAvailable(): boolean;
  complete(messages: Message[], options?: LLMOptions): Promise<LLMResponse>;
  stream?(messages: Message[], options?: LLMOptions): AsyncIterable<LLMResponse>;
}

class LLMRegistryService {
  private providers: LLMProvider[] = [];

  getPreferred(taskType: TaskType): LLMProvider {
    // Routing por tipo de tarea:
    // - simple_query → Gemini (barato, rápido)
    // - complex_reasoning → Claude (mejor razonamiento)
    // - function_calling → OpenAI (mejor soporte)
    // Fallback automático si el preferido falla
  }
}
```

| Tipo de tarea                        | Provider preferido | Motivo                       |
| ------------------------------------ | ------------------ | ---------------------------- |
| `simple_query` (saludo, info básica) | Gemini 2.0 Flash   | Barato, rápido               |
| `intent_detection`                   | OpenAI GPT-4o Mini | Buen balance costo/precisión |
| `complex_reasoning`                  | Claude Sonnet 4    | Mejor razonamiento           |
| `function_calling`                   | OpenAI GPT-4o      | Mejor soporte para tools     |
| `summary`                            | Gemini 2.0 Flash   | Barato para mucho texto      |

---

## 10. Workflow Engine

### 10.1 Arquitectura

```
Evento del Event Bus
    ↓
┌──────────────────────────────────────┐
│        Workflow Evaluator            │
│  ┌────────────────────────────────┐  │
│  │  Busca workflows con trigger   │  │
│  │  "event" que coincidan con     │  │
│  │  el tipo de evento             │  │
│  └────────────────────────────────┘  │
└────────────────┬─────────────────────┘
                 ↓
┌──────────────────────────────────────┐
│        Condition Evaluator           │
│  ┌────────────────────────────────┐  │
│  │  Evalúa condiciones del        │  │
│  │  workflow contra el payload    │  │
│  └────────────────────────────────┘  │
└────────────────┬─────────────────────┘
                 ↓ (si condiciones pasan)
┌──────────────────────────────────────┐
│        Action Executor                │
│  ┌────────────────────────────────┐  │
│  │  Ejecuta acciones en secuencia │  │
│  │  con reintentos y delays       │  │
│  └────────────────────────────────┘  │
└────────────────┬─────────────────────┘
                 ↓
┌──────────────────────────────────────┐
│        Execution Logger               │
│  └── Guarda resultado en BD ────→   │
└──────────────────────────────────────┘
```

### 10.2 Triggers

| Tipo         | Formato                                                | Ejemplo                                                        |
| ------------ | ------------------------------------------------------ | -------------------------------------------------------------- |
| **Event**    | `{ event: string, filters?: Record<string, unknown> }` | `{ event: "deal.moved", filters: { toStageId: "stage_won" } }` |
| **Schedule** | `{ cron: string, timezone?: string }`                  | `{ cron: "0 9 * * 1", timezone: "America/Mexico_City" }`       |
| **Webhook**  | `{ secret?: string }`                                  | Expone `POST /api/v1/webhooks/:workflowId`                     |

### 10.3 Conditions

```typescript
interface WorkflowCondition {
  type: 'field' | 'and' | 'or' | 'not' | 'expression';
  config: Record<string, unknown>;
}

// Ejemplo:
[
  { type: 'field', config: { field: 'value', operator: 'gt', value: 10000 } },
  { type: 'field', config: { field: 'clientId', operator: 'exists' } },
];
```

### 10.4 Actions

| Action          | Config                                                                          | Descripción                    |
| --------------- | ------------------------------------------------------------------------------- | ------------------------------ | --------- | -------------------------------- |
| `create_task`   | `{ title, description?, priority?, assignedTo?, dueDate?, clientId?, dealId? }` | Crea una tarea                 |
| `send_email`    | `{ to, subject, template, data }`                                               | Envía email transaccional      |
| `move_deal`     | `{ dealId?, stageId?, filter? }`                                                | Mueve deal(s) a otra etapa     |
| `update_deal`   | `{ dealId?, changes, filter? }`                                                 | Actualiza campo(s) del deal    |
| `update_client` | `{ clientId?, changes, filter? }`                                               | Actualiza campo(s) del cliente |
| `notify_user`   | `{ userId?, role?, message }`                                                   | Notificación in-app            |
| `webhook`       | `{ url, method, headers, body }`                                                | Callback HTTP externo          |
| `delay`         | `{ duration: number, unit: 'minutes'                                            | 'hours'                        | 'days' }` | Espera antes de siguiente acción |
| `condition`     | `{ conditions, then: Action[], else?: Action[] }`                               | Branching condicional          |
| `ai_query`      | `{ prompt, context? }`                                                          | Consulta al AI Copilot         |

### 10.5 Variables

```typescript
// Variables disponibles en acciones y condiciones:
// {{ trigger.event }}         → "deal.moved"
// {{ trigger.payload.* }}     → Campos del payload del evento
// {{ workflow.id }}           → ID del workflow
// {{ workflow.name }}         → Nombre del workflow
// {{ organization.id }}       → ID de la org
// {{ now }}                   → Fecha/hora actual
// {{ actions.0.output }}      → Output de la primera acción
```

### 10.6 Errores y reintentos

| Config              | Default     | Descripción                 |
| ------------------- | ----------- | --------------------------- | ---------- | -------- |
| `retry.maxAttempts` | 3           | Número máximo de reintentos |
| `retry.delay`       | 5 minutes   | Espera entre reintentos     |
| `retry.backoff`     | exponential | Estrategia de backoff       |
| `onFailure`         | stop        | `stop`                      | `continue` | `notify` |

- Si una acción falla después de todos los reintentos, el workflow se marca como `PARTIAL` (si continuó) o `FAILED` (si se detuvo).
- Se notifica al creador del workflow si `onFailure` incluye `notify`.

---

## 11. Plugin System

### 11.1 Interfaz del plugin

```typescript
interface NexaPlugin {
  // Metadata
  name: string;
  displayName: string;
  version: string;
  description: string;
  author: string;

  // Lifecycle
  onInstall(config: Record<string, unknown>): Promise<void>;
  onUninstall(): Promise<void>;
  onActivate(): Promise<void>;
  onDeactivate(): Promise<void>;
  onConfigChange(config: Record<string, unknown>): Promise<void>;

  // Registry methods
  registerTools(registry: ToolRegistryService): void;
  registerEvents(eventBus: EventBusService): void;
  registerRoutes(router: RouteRegistrar): void;
  registerPermissions(permissionRegistry: PermissionRegistryService): void;
  registerCommands(commandRegistry: CommandRegistryService): void;
  registerContextProviders(contextBuilder: ContextBuilderService): void;
  registerWorkflowSteps(stepRegistry: WorkflowStepRegistry): void;
}
```

### 11.2 Carga dinámica

```typescript
class PluginLoaderService {
  async loadPlugin(plugin: Plugin): Promise<NexaPlugin> {
    // 1. Determinar source
    if (plugin.source === 'filesystem') {
      const modulePath = path.join(PLUGINS_DIR, plugin.name, 'index.js');
      const mod = await import(modulePath);
      return mod.default as NexaPlugin;
    }

    if (plugin.source === 'npm') {
      const mod = await import(plugin.name);
      return mod.default as NexaPlugin;
    }

    throw new UnsupportedPluginSourceException(plugin.source);
  }
}
```

### 11.3 Lo que un plugin puede registrar

| Registro           | Método                              | Ejemplo                                     |
| ------------------ | ----------------------------------- | ------------------------------------------- |
| **Tools**          | `registerTools(registry)`           | Tool para crear productos en el inventario  |
| **Events**         | `registerEvents(eventBus)`          | Emitir evento `invoice.created`             |
| **Routes**         | `registerRoutes(router)`            | `GET /api/v1/inventory/products`            |
| **Permissions**    | `registerPermissions(registry)`     | `inventory:create`, `inventory:read`        |
| **Commands**       | `registerCommands(registry)`        | Comando "crear producto" en Command Palette |
| **Pages**          | `registerCommands(registry)`        | Comando de navegación a página del plugin   |
| **Context**        | `registerContextProviders(builder)` | Proveer contexto de inventario al AI        |
| **Workflow Steps** | `registerWorkflowSteps(registry)`   | Step "crear producto en inventario"         |
| **Config**         | `onConfigChange(config)`            | UI de configuración del plugin en Settings  |

### 11.4 Seguridad de plugins

- **Aislamiento:** El plugin no tiene acceso directo a la BD. Solo a través de la API de herramientas registradas.
- **Permisos:** El plugin declara los permisos que necesita. El OWNER debe aprobarlos al instalar.
- **Límites:** Timeout de 30s por ejecución de tool. Cuotas de uso.
- **Sandbox (futuro):** Ejecución en VM2 o contenedor separado para plugins de terceros.

---

## 12. Seguridad

### 12.1 JWT (Access Token)

| Propiedad      | Valor                                                           |
| -------------- | --------------------------------------------------------------- |
| Algoritmo      | HS256                                                           |
| Expiración     | 15 minutos                                                      |
| Claims         | `sub` (userId), `email`, `organizationId`, `role`, `iat`, `exp` |
| Transporte     | Cookie HttpOnly + Header `Authorization: Bearer`                |
| Almacenamiento | No se almacena en BD                                            |

### 12.2 Refresh Token

| Propiedad      | Valor                                                         |
| -------------- | ------------------------------------------------------------- |
| Algoritmo      | HS256                                                         |
| Expiración     | 7 días                                                        |
| Claims         | `sub` (userId), `tokenId` (random), `iat`, `exp`              |
| Transporte     | Cookie HttpOnly, Path: `/api/v1/auth/refresh`                 |
| Almacenamiento | Hasheado (SHA-256) en `users.refreshToken`                    |
| Rotación       | Cada refresh emite nuevo par. Anterior expira inmediatamente. |

### 12.3 Detección de robo

```
1. Usuario legítimo usa refresh token → se rota normalmente.
2. Atacante usa refresh token robado → se rota normalmente.
3. Usuario legítimo usa refresh token original (ahora reutilizado).
4. Sistema detecta reutilización → invalida TODOS los tokens del usuario.
5. Usuario debe hacer login de nuevo.
```

### 12.4 RBAC

| Rol        | Permisos                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| **OWNER**  | Todo. Puede eliminar la organización, cambiar plan, gestionar facturación.                                         |
| **ADMIN**  | CRUD completo en todas las entidades. Gestiona usuarios y configuración. No puede cambiar plan ni eliminar la org. |
| **MEMBER** | CRUD en clientes, deals, tareas, cotizaciones. No puede eliminar ni gestionar usuarios/configuración.              |
| **VIEWER** | Solo lectura en todas las entidades. No puede crear, editar ni eliminar.                                           |

### 12.5 Preparación para ABAC (Attribute-Based Access Control)

El sistema está preparado para ABAC mediante:

- `users.permissions: string[]` — lista de permisos granulares (ej: `clients:delete`, `deals:move`)
- `PermissionLayerService` — punto único de evaluación de permisos
- Políticas ABAC futuras se evaluarían contra: usuario (rol, permisos), recurso (tipo, propietario, estado), contexto (hora, IP, organización)

### 12.6 Rate Limiting

| Capa                 | Límite                          | Duración | Implementación       |
| -------------------- | ------------------------------- | -------- | -------------------- |
| **Global**           | 100 requests                    | 1 minuto | ThrottlerGuard       |
| **Por organización** | 1000 requests                   | 1 minuto | Redis + custom guard |
| **Por endpoint**     | 30 requests (POST/PATCH/DELETE) | 1 minuto | ThrottlerModule      |
| **Por usuario**      | 60 requests (AI queries)        | 1 minuto | Custom guard         |
| **Por IP**           | 10 requests (login/register)    | 1 minuto | ThrottlerGuard       |

### 12.7 CSRF

- Las cookies de autenticación tienen `SameSite=Lax`
- Los endpoints mutantes requieren `Content-Type: application/json` (no form-encoded simple)
- Para futuros endpoints con cookies cross-site: token CSRF en header `X-CSRF-Token`

### 12.8 XSS

- Helmet activado con defaults seguros
- React escapa toda interpolación por defecto
- CSP headers configurados en producción
- No se renderiza HTML del servidor sin sanitización

### 12.9 SQL Injection

- Prisma ORM parametriza todas las queries
- No se permite SQL raw en módulos de aplicación
- Si se necesita SQL raw (ej: search tsvector), se usa `Prisma.$queryRaw` con parámetros tipados

### 12.10 Secrets

- `.env` en `.gitignore` — nunca se commitean
- Variables de entorno en CI/CD desde secrets del proveedor
- En producción, secrets desde variables de entorno del contenedor o servicio gestionado (AWS Secrets Manager, Vault)

### 12.11 Auditoría

- `audit_logs` registra toda operación que modifique datos: quién, qué, cuándo, desde dónde, cambios
- `activity_logs` registra actividad visible para el usuario en la UI
- `audit_logs` particionada por mes para rendimiento
- Retención: 2 años en BD activa, luego archive

---

## 13. Testing

### 13.1 Estrategia

| Nivel           | Objetivo                                                       | Coverage esperado | Herramienta                |
| --------------- | -------------------------------------------------------------- | ----------------- | -------------------------- |
| **Unit**        | Domain Layer (value objects, entities)                         | 95%+              | Jest                       |
| **Unit**        | Services (lógica de negocio pura)                              | 90%+              | Jest                       |
| **Integration** | Module endpoints (controlador + servicio + Prisma)             | 80%+              | Jest + Supertest           |
| **Integration** | Event Bus handlers                                             | 85%+              | Jest                       |
| **E2E**         | Flujos críticos completos (login → crear cliente → crear deal) | 70%+              | Jest + Supertest + test DB |
| **E2E**         | Frontend (Puppeteer/Cypress)                                   | 60%+              | Cypress                    |
| **Static**      | TypeScript strict                                              | N/A               | tsc --noEmit               |
| **Lint**        | ESLint + Prettier                                              | N/A               | ESLint                     |

### 13.2 Unit tests (Domain Layer)

```typescript
// Ejemplo: packages/domain/src/__tests__/email.spec.ts
describe('Email', () => {
  it('should create valid email', () => {
    const email = new Email('test@example.com');
    expect(email.value).toBe('test@example.com');
  });

  it('should reject invalid email', () => {
    expect(() => new Email('not-an-email')).toThrow('Email inválido');
  });
});
```

- Tests sin dependencias externas
- Sin NestJS, sin BD
- Rápidos (< 5ms por test)

### 13.3 Integration tests

```typescript
// Ejemplo: apps/api/test/clients.e2e-spec.ts
describe('POST /api/v1/clients', () => {
  it('should create a client', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyName: 'Test Corp', contactName: 'John' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.companyName).toBe('Test Corp');
  });
});
```

- Usa base de datos de test (PostgreSQL separada o en memoria)
- Seed mínimo por test
- Prisma cleanDatabase() entre tests

### 13.4 E2E tests

- Flujos críticos:
  1. Registro → Login → Dashboard
  2. Crear cliente → Crear deal → Mover deal → Ganar deal
  3. Crear tarea → Asignar → Completar
  4. Crear cotización → Enviar → Aceptar
  5. Command Palette: "crear cliente X" → verifica creación
  6. AI Copilot: "resumen del pipeline" → verifica respuesta

### 13.5 Configuración de Jest

```json
{
  "projects": [
    {
      "displayName": "domain",
      "rootDir": "packages/domain",
      "testMatch": ["<rootDir>/src/**/*.spec.ts"]
    },
    {
      "displayName": "api-unit",
      "rootDir": "apps/api",
      "testMatch": ["<rootDir>/src/**/*.spec.ts"]
    },
    {
      "displayName": "api-integration",
      "rootDir": "apps/api",
      "testMatch": ["<rootDir>/test/**/*.e2e-spec.ts"]
    }
  ]
}
```

---

## 14. Convenciones

### 14.1 Naming

| Elemento        | Convención                      | Ejemplo                                      |
| --------------- | ------------------------------- | -------------------------------------------- |
| **Archivos**    | kebab-case                      | `client.service.ts`, `create-client.tool.ts` |
| **Clases**      | PascalCase                      | `ClientsService`, `CreateClientTool`         |
| **Métodos**     | camelCase                       | `findAll()`, `createClient()`                |
| **Variables**   | camelCase                       | `const clientData`                           |
| **Constantes**  | UPPER_SNAKE                     | `MAX_RETRY_ATTEMPTS`, `JWT_EXPIRATION`       |
| **Enums**       | PascalCase, valores UPPER       | `enum TaskPriority { HIGH = 'HIGH' }`        |
| **Interfaces**  | PascalCase, prefijo I en domain | `IClientRepository`, `ToolDefinition`        |
| **DTOs**        | PascalCase, sufijo Input/Output | `CreateClientInput`, `ClientOutput`          |
| **Tablas BD**   | snake_case                      | `pipeline_stages`, `activity_logs`           |
| **Columnas BD** | snake_case                      | `company_name`, `is_deleted`                 |
| **Rutas API**   | kebab-case, plural              | `/api/v1/clients`, `/api/v1/pipeline/stages` |
| **Eventos**     | dot.case                        | `client.created`, `deal.moved`               |

### 14.2 Imports

```typescript
// Orden (separados por línea en blanco):
// 1. Node built-in
// 2. Third-party (NestJS, Prisma, etc.)
// 3. Internal packages (@nexa/*)
// 4. Relative imports

import { join } from 'path';

import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { PrismaService } from '@nexa/database';
import { Email } from '@nexa/domain';

import { ClientsService } from './clients.service';
```

### 14.3 Commits

Formato: [Conventional Commits](https://www.conventionalcommits.org/)

```
<type>(<scope>): <description>

feat(clients): add soft delete to clients
fix(pipeline): correct deal position after move
refactor(ai): extract intent detection into separate service
test(domain): add email value object tests
docs: update API endpoints in blueprint
```

| Type       | Uso                                  |
| ---------- | ------------------------------------ |
| `feat`     | Nueva funcionalidad                  |
| `fix`      | Corrección de bug                    |
| `refactor` | Refactorización sin cambio funcional |
| `test`     | Tests                                |
| `docs`     | Documentación                        |
| `chore`    | Configuración, tooling               |

### 14.4 Branches

| Branch              | Propósito                   | Desde              |
| ------------------- | --------------------------- | ------------------ |
| `main`              | Producción, estable         | -                  |
| `develop`           | Integración, pre-producción | `main`             |
| `feature/<name>`    | Nueva funcionalidad         | `develop`          |
| `fix/<name>`        | Bugfix                      | `develop`          |
| `release/<version>` | Preparación de release      | `develop` → `main` |

### 14.5 PRs

1. Título descriptivo en inglés
2. Template con: qué, por qué, cómo testear, screenshot (si aplica)
3. Mínimo 1 approver antes de merge
4. Merge a `develop` (no directo a `main`)
5. Squash merge para features, merge commit para releases

### 14.6 Code Style

- TypeScript strict mode en todos los paquetes
- ESLint + Prettier (configuración compartida en `packages/config-eslint`)
- Prettier plugin para Tailwind CSS en clases
- No `any` explícito — usar `unknown` si es necesario
- No `console.log` en producción (usar Logger de NestJS)
- Funciones puras donde sea posible
- Tipos exportados desde `@nexa/shared` para uso compartido frontend/backend

### 14.7 Documentación

- El código debe ser auto-documentado (nombres claros, tipos fuertes)
- Comentarios JSDoc solo para interfaces públicas y lógica no obvia
- README en cada paquete con propósito y cómo usarlo
- Este blueprint es la única fuente de verdad arquitectónica

---

## 15. Roadmap

### Principios del roadmap

1. **Primero infraestructura, luego features.** Los sprints iniciales construyen la base (Domain, EventBus, ToolRegistry, CommandCenter).
2. **Backward compatibility.** Cada sprint mantiene funcionando lo existente mientras se migra.
3. **Cada sprint produce valor.** Al final de cada sprint, `main` debe compilar y pasar tests.
4. **Priorización por dependencias.** Un sprint no comienza si sus dependencias no están completas.

---

### Sprint 1: Domain Layer + Event Bus

**Duración:** 2 semanas
**Dependencias:** Ninguna
**Objetivos:**

- Crear `packages/domain/` con Value Objects (Email, Phone, Money, Address, Slug, Percentage)
- Crear entidades de dominio (ClientEntity, DealEntity, TaskEntity, QuoteEntity) con métodos de negocio
- Crear interfaces de repositorio (`IClientRepository`, `IDealRepository`, `ITaskRepository`, `IQuoteRepository`)
- Crear Domain Event base y eventos iniciales (ClientCreated, DealMoved, TaskCompleted, QuoteSent)
- Implementar Event Bus en memoria (`EventBusService` + `@nexa/event-bus` module)
- Implementar handlers: ActivityHandler, DashboardHandler, SearchHandler (esqueleto), AuditHandler
- Migrar `ClientsService` para emitir eventos al crear/actualizar/eliminar
- Migrar `PipelineService` para emitir eventos al mover/ganar/perder deals
- Migrar `TasksService` para emitir eventos al crear/completar
- Migrar `QuotesService` para emitir eventos al crear/enviar/aceptar/rechazar
- Escribir tests unitarios del Domain Layer (95% coverage)
- Escribir tests de integración de Event Bus handlers (85% coverage)
- **Criterio de aceptación:** Al crear un cliente vía API, se genera ActivityLog automáticamente.

### Sprint 2: Tool Registry + Command Center (Backend)

**Duración:** 2 semanas
**Dependencias:** Sprint 1
**Objetivos:**

- Implementar `ToolRegistryService` con interfaz `ToolDefinition`
- Implementar `IntentDetectionService` (regex + LLM fallback)
- Implementar `PermissionLayerService` (RBAC + preparación ABAC)
- Implementar `ResponseFormatterService`
- Implementar `CommandCenterController` (`POST /api/v1/commands`)
- Migrar `ai-tools.service.ts` → herramientas individuales:
  - `create-client.tool.ts`
  - `create-task.tool.ts`
  - `move-deal.tool.ts`
  - `pipeline-summary.tool.ts`
  - `dashboard-summary.tool.ts`
- Registrar herramientas en `ToolRegistry` desde cada módulo
- Implementar `GET /api/v1/commands/history` y endpoints de favoritos
- Escribir tests de integración del Command Center
- **Criterio de aceptación:** `POST /api/v1/commands` con texto "crear cliente Test" crea un cliente y devuelve respuesta formateada.

### Sprint 3: Global Search + Audit Trail

**Duración:** 2 semanas
**Dependencias:** Sprint 1
**Objetivos:**

- Crear `SearchModule` con tabla `search_index` (tsvector + índice GIN)
- Implementar `SearchService` con query parameterizada (`Prisma.$queryRaw`)
- Implementar `SearchHandler` (Event Bus) que indexa entidades automáticamente
- Implementar `GET /api/v1/search?q=&type=` con filtros por tipo de entidad
- Implementar tabla `audit_logs` particionada por mes
- Implementar `AuditHandler` que registra toda mutación
- Implementar middleware que captura IP y User-Agent para audit
- Frontend: Página de búsqueda global (`/search`) con resultados agrupados
- Frontend: Integrar búsqueda en Command Palette
- Escribir tests de SearchHandler y AuditHandler
- **Criterio de aceptación:** Buscar "Tech" encuentra clientes, deals y tareas relacionadas en < 200ms.

### Sprint 4: Dashboard Projections + Multi-LLM + Context Builder

**Duración:** 2 semanas
**Dependencias:** Sprint 1
**Objetivos:**

- Crear tabla `dashboard_projections` y migrar datos existentes
- Implementar `DashboardHandler` que actualiza proyecciones vía eventos
- Refactorizar `DashboardService` para leer de proyecciones (no queries agregadas)
- Implementar interfaz `LLMProvider` y `LLMRegistryService`
- Implementar providers: OpenAI, Claude (preparado), Gemini (preparado)
- Implementar `ContextBuilderService` con pipeline de contexto
- Implementar `AiMemoryService` (session + Redis)
- Refactorizar `AiService` para usar Command Center + Multi-LLM
- Implementar Feature Flags Service (simple, ~100 líneas)
- Feature flags iniciales: `workflows`, `ai_copilot`, `bulk_import`, `advanced_search`, `api_access`
- Escribir tests de dashboard projections
- **Criterio de aceptación:** Dashboard carga sin queries agregadas a tablas grandes. AI Copilot funciona con OpenAI. Feature flags controlan visibilidad de funcionalidades.

### Sprint 5: Command Palette V2 (Frontend)

**Duración:** 2 semanas
**Dependencias:** Sprint 2
**Objetivos:**

- Rediseñar Command Palette con ranking de resultados
- Implementar historial local (localStorage) + servidor
- Implementar favoritos (star toggle)
- Implementar atajos de teclado avanzados (CTRL+SHIFT+K, @filtros, /modo búsqueda)
- Implementar modo "navegación" (resultados de páginas)
- Implementar modo "acción" (ejecutar tools)
- Implementar modo "IA" (query al AI Copilot)
- Integrar búsqueda global en Command Palette
- Implementar "comandos recientes" al abrir palette sin texto
- Hook `useCommandPalette` con estado compartido
- Escribir tests de componentes
- **Criterio de aceptación:** CTRL+K muestra comandos recientes. Escribir "crear cliente" ofrece la acción y al ejecutarla abre el diálogo de creación.

### Sprint 6: Workflow Engine

**Duración:** 3 semanas
**Dependencias:** Sprint 1 (Event Bus)
**Objetivos:**

- Tablas: `workflows`, `workflow_execution_logs`
- Implementar `WorkflowEvaluator` (busca workflows por trigger de evento)
- Implementar `ConditionEvaluator` (evalúa condiciones tipo field/and/or/not)
- Implementar `ActionExecutor` con steps registrables
- Steps iniciales: `create_task`, `send_email`, `move_deal`, `update_deal`, `update_client`, `notify_user`, `webhook`, `delay`, `condition`, `ai_query`
- Implementar reintentos con backoff exponencial
- Implementar logging de ejecución
- Frontend: Página de gestión de workflows (`/workflows`)
- Frontend: Editor visual básico de workflows (trigger → conditions → actions)
- Frontend: Log de ejecuciones con estado y errores
- Escribir tests del evaluador y ejecutor
- **Criterio de aceptación:** Crear workflow "Cuando un deal se mueva a WON, crear tarea de seguimiento" funciona end-to-end.

### Sprint 7: AI Copilot V2 + Multi-LLM Integration

**Duración:** 2 semanas
**Dependencias:** Sprint 4 (Multi-LLM), Sprint 2 (Command Center)
**Objetivos:**

- Refactorizar AI Copilot frontend para usar Command Center como backend
- Streaming de respuestas (SSE)
- Memory persistente (Redis) con resumen automático
- Detección de intención vía LLM como fallback del regex
- Selección inteligente de proveedor LLM según tipo de tarea
- Fallback automático entre proveedores
- Context Builder v1 (system prompt + org context + user context + permissions)
- "Preguntas sugeridas" contextuales
- Frontend: Indicador de proveedor activo y tokens usados
- Frontend: Historial de conversaciones (últimos 7 días)
- **Criterio de aceptación:** "Cuántos deals ganamos este mes?" funciona con OpenAI. Si OpenAI falla, cae a Gemini automáticamente.

### Sprint 8: Multi-tenant hardening + Rate Limiting + ABAC preparación

**Duración:** 1 semana
**Dependencias:** Ninguna (puede correr en paralelo)
**Objetivos:**

- Auditoría de seguridad: verificar que toda query filtra por `organizationId`
- Rate limiting por organización (Redis)
- Rate limiting por endpoint AI
- Rate limiting por IP en login/register
- Implementar `user.permissions` array (granular permissions)
- Implementar decorador `@RequirePermission()` que evaluará permisos además del rol
- Preparar estructura de datos para políticas ABAC
- Revisar helmet headers y CSP
- Implementar logging de seguridad (intentos de acceso denegados)
- **Criterio de aceptación:** Una org no puede ver datos de otra. Rate limiter bloquea después de 60 queries AI/min.

### Sprint 9: Billing + Feature Flags

**Duración:** 2 semanas
**Dependencias:** Sprint 4 (Feature Flags)
**Objetivos:**

- Tablas: `subscriptions`, `usage_records`
- Integrar con proveedor de pagos (Stripe)
- Planes: Free (hasta 10 clients, 1 user), Starter ($29/mes, 50 clients, 5 users), Professional ($99/mes, ilimitado), Enterprise (custom)
- Feature flags gated por plan
- Usage tracking vía Event Bus
- Límites: verificar en PermissionLayer antes de ejecutar tools
- Frontend: Página de billing (`/billing`) con plan actual, uso, cambio de plan
- Frontend: Upgrade prompts cuando se alcanza un límite
- Notificaciones de límite (email cuando se alcanza 80% del límite)
- **Criterio de aceptación:** Si una org free intenta crear el cliente #11, recibe error "Plan limit reached".

### Sprint 10: Plugin System + Marketplace MVP

**Duración:** 3 semanas
**Dependencias:** Sprint 2 (Tool Registry)
**Objetivos:**

- Interfaz `NexaPlugin` completa
- `PluginLoaderService` (carga desde filesystem)
- Plugin lifecycle: install, activate, deactivate, uninstall
- Plugin registry: tools, events, routes, permissions, commands, context, workflow steps
- Tabla `plugins`
- Aislamiento: plugins solo acceden a BD vía tools registradas
- Plugin de ejemplo: "Webhook Notifier" (envía eventos a webhook externo)
- Frontend: Página de plugins (`/plugins`) con listado, instalar, configurar
- Frontend: Permissions screen al instalar (el OWNER aprueba permisos)
- Documentación: API de plugins
- **Criterio de aceptación:** Instalar plugin "Webhook Notifier", activarlo, y verificar que los eventos se envían al webhook configurado.

---

### Resumen del roadmap

| Sprint   | Duración  | Sprint    | Duración  |
| -------- | --------- | --------- | --------- |
| Sprint 1 | 2 semanas | Sprint 6  | 3 semanas |
| Sprint 2 | 2 semanas | Sprint 7  | 2 semanas |
| Sprint 3 | 2 semanas | Sprint 8  | 1 semana  |
| Sprint 4 | 2 semanas | Sprint 9  | 2 semanas |
| Sprint 5 | 2 semanas | Sprint 10 | 3 semanas |

**Total estimado:** 21 semanas (~5 meses)

---

> **Este documento es la fuente de verdad definitiva del proyecto Nexa.**
>
> Cualquier modificación debe ser aprobada por el equipo y documentada con fecha, motivo y aprobación.
>
> _Próximo paso: Implementación Sprint 1._
