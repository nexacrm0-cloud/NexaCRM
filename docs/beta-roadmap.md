# Nexa CRM — Beta Roadmap

> Funcionalidades pendientes para una versión Beta pública, priorizadas por impacto.

---

## Prioridad Alta (Core funcional)

- [ ] **Exportación de presupuestos en PDF** ✅ COMPLETADO (Alpha)
- [ ] **Envío de presupuestos por email** ✅ COMPLETADO (Alpha — requiere configurar `RESEND_API_KEY`)
- [ ] **Notificaciones in-app** ✅ COMPLETADO (Alpha)
- [ ] **Onboarding interactivo** ✅ COMPLETADO (Alpha)
- [ ] **Dashboard con gráficos** ✅ COMPLETADO (Alpha)
- [ ] **Estados vacíos consistentes** ✅ COMPLETADO (Alpha)
- [ ] **Toast de operaciones** ✅ COMPLETADO (Alpha)
- [ ] **Edición de clientes** (actualmente solo creación)
- [ ] **Edición de tareas** (actualmente solo creación y completado)
- [ ] **Edición de presupuestos** (solo DRAFT)
- [ ] **Edición de perfil de usuario** (actualmente solo lectura)
- [ ] **Cambio de contraseña**

## Prioridad Media (Colaboración)

- [ ] **Roles y permisos**: invitar miembros con roles (ADMIN, MEMBER, VIEWER)
- [ ] **Asignación de tareas**: selector de usuario en creación/edición
- [ ] **Comentarios en deals**: feed de notas internas por oportunidad
- [ ] **Adjuntar archivos**: a deals, tareas y presupuestos
- [ ] **Historial de cambios**: auditoría visible desde la UI
- [ ] **Pipeline personalizable**: crear/quitar etapas desde settings

## Prioridad Baja (Escalamiento)

- [ ] **API keys**: para integraciones externas
- [ ] **Webhooks**: eventos salientes hacia sistemas del cliente
- [ ] **Importación masiva**: CSV/Excel de clientes y deals
- [ ] **Exportación de reportes**: CSV de pipeline, clientes, tareas
- [ ] **Modo offline**: PWA con service worker
- [ ] **SSO**: OAuth2 con Google/Microsoft

## UX y Calidad de Vida

- [ ] **Búsqueda global**: barra de búsqueda unificada (clientes, deals, tasks, quotes)
- [ ] **Filtros avanzados**: por fecha, tags, responsable, estado
- [ ] **Vista calendario**: tareas y eventos en calendario mensual/semanal
- [ ] **Atajos de teclado**: más allá de Ctrl+K (ej: `G + D` → Dashboard)
- [ ] **Personalización de columnas**: qué mostrar en tablas/listas
- [ ] **Tema claro**: además del actual tema oscuro
- [ ] **Responsive mobile**: layouts adaptados a pantallas pequeñas

## Infraestructura

- [ ] **Modo producción**: Docker Compose con API + Web + PostgreSQL + Redis
- [ ] **Migraciones automáticas**: prisma migrate deploy en startup
- [ ] **Logs centralizados**: estructura para integración con herramientas de observabilidad
- [ ] **Rate limiting**: protección de endpoints públicos
- [ ] **Tests E2E**: Playwright/Cypress para flujos críticos
- [ ] **CI/CD completo**: deploy automático a staging/producción

## Integraciones (Post-Beta)

- [ ] **Email real**: conectar con proveedor de email transaccional (Resend configurado)
- [ ] **Calendario**: Google Calendar / Outlook para reuniones
- [ ] **WhatsApp**: notificaciones y recordatorios
- [ ] **Slack**: notificaciones de deals y tareas
- [ ] **Mercado Pago / Stripe**: cobros integrados
- [ ] **AFIP / facturación electrónica**: Argentina

---

## Estado Actual

| Área                   | Completitud                                                   |
| ---------------------- | ------------------------------------------------------------- |
| **Alpha (Sprint 0-6)** | ✅ 100% — Arquitectura, CRM core, AI Copilot, demo            |
| **Beta core**          | ~40% — Falta edición de entidades, roles, permisos            |
| **UX**                 | ~50% — Animaciones, empty states, toasts listos; falta mobile |
| **Integraciones**      | ~5% — Esqueleto de email listo                                |
| **Infraestructura**    | ~30% — Falta Docker, E2E, CI/CD completo                      |
