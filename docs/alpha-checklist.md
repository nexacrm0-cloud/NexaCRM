# Nexa CRM — Alpha Validation Checklist

> Checklist para empresas piloto que evaluarán la versión Alpha de Nexa CRM.

---

## 1. Autenticación y Organización

- [ ] Registro de nuevo usuario con organización
- [ ] Login con email y contraseña
- [ ] Recuperación de sesión (cookie HttpOnly)
- [ ] Logout
- [ ] Redirección a onboarding en primer login
- [ ] Onboarding guiado completado (creación de primer cliente)
- [ ] Visualización de perfil de usuario

## 2. Dashboard

- [ ] KPIs cargan correctamente (ventas, clientes, oportunidades, tareas)
- [ ] Gráfico de tendencia de ventas (últimos 6 meses)
- [ ] Pipeline funnel por etapa
- [ ] Lista de negocios ganados
- [ ] Feed de actividad reciente
- [ ] Animaciones suaves en carga de datos
- [ ] Estados vacíos informativos cuando no hay datos

## 3. Clientes

- [ ] Lista de clientes con búsqueda
- [ ] Creación de nuevo cliente
- [ ] Edición de cliente existente
- [ ] Eliminación de cliente
- [ ] Detalle de cliente con relaciones (deals, tasks, quotes)
- [ ] Toast de éxito/error en cada operación
- [ ] Estados vacíos cuando no hay clientes

## 4. Pipeline de Ventas

- [ ] Visualización Kanban por etapa
- [ ] Creación de nueva oportunidad (deal)
- [ ] Arrastrar y soltar entre etapas
- [ ] Actualización de probabilidad y valor
- [ ] Toast de éxito/error en cada operación
- [ ] Estados vacíos por etapa

## 5. Tareas

- [ ] Lista de tareas con filtros (All, Pending, In Progress, Completed)
- [ ] Creación de nueva tarea
- [ ] Completar tarea (toggle)
- [ ] Visualización de prioridad y vencimiento
- [ ] Asignación a usuario
- [ ] Toast de éxito/error en cada operación
- [ ] Estados vacíos

## 6. Presupuestos

- [ ] Lista de presupuestos con estados
- [ ] Creación de presupuesto con items
- [ ] Cálculo automático de subtotal, IVA, total
- [ ] Envío de presupuesto (cambio a estado SENT)
- [ ] Descarga de PDF
- [ ] Aceptar/Rechazar presupuesto
- [ ] Toast de éxito/error en cada operación
- [ ] Estados vacíos

## 7. Command Center (CTRL+K)

- [ ] Apertura con Ctrl+K / Cmd+K
- [ ] Navegación rápida a secciones
- [ ] Consultas AI (Business Copilot)
- [ ] Detección de intenciones en español
- [ ] Resultados con lenguaje natural
- [ ] Manejo de errores con mensajes amigables

## 8. Business Copilot

- [ ] Apertura desde icono flotante
- [ ] Consultas sobre clientes, ventas, tareas
- [ Respuestas en lenguaje natural
- [ ] Datos estructurados cuando corresponde
- [ ] Manejo de errores gracefully

## 9. Notificaciones

- [ ] Campana muestra badge con count no leídas
- [ ] Panel desplegable con lista de notificaciones
- [ ] Marcar individual como leída
- [ ] Marcar todas como leídas
- [ ] Auto-actualización cada 30 segundos

## 10. Experiencia General

- [ ] Diseño responsive (escritorio / tablet)
- [ ] Tema oscuro consistente
- [ ] Tiempo de carga aceptable (< 2s por página)
- [ ] Sin errores en consola del navegador
- [ ] Sin errores 500 en API
- [ ] Mensajes de error son claros y en español
- [ ] Tooltips y labels descriptivos

---

## Resultado

| Criterio                     | Estado                          |
| ---------------------------- | ------------------------------- |
| **Checklist completado por** |                                 |
| **Fecha**                    |                                 |
| **Empresa**                  |                                 |
| **Rol del evaluador**        |                                 |
| **Items OK**                 | / 50                            |
| **Bloqueantes**              |                                 |
| **Recomendación**            | Pasar a Beta / Requiere cambios |

## Feedback Abierto

¿Qué funcionalidad te gustaría que agreguemos antes de la Beta?

1.
2.
3.
