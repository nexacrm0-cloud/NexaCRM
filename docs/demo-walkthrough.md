# Nexa CRM — Demo Walkthrough (5-10 min)

## Prerequisitos

1. Base de datos PostgreSQL corriendo
2. `pnpm seed` ejecutado (datos de demo)
3. Servidor API: `pnpm --filter @nexa/api dev`
4. Frontend: `pnpm --filter @nexa/web dev`
5. Navegador en `http://localhost:3000`

---

## Recorrido (5-10 minutos)

### 1. Login (30s)

- Abrir `http://localhost:3000`
- Ingresar: `admin@nexacrm.com` / `admin123`
- **Observar**: redirección al dashboard con KPIs y gráficos

### 2. Dashboard (1 min)

- **4 KPI cards**: Ventas del mes, Clientes nuevos, Oportunidades abiertas, Tareas pendientes
- **Gráfico de tendencia**: Área chart con ventas de últimos 6 meses
- **Pipeline funnel**: Barras horizontales por etapa
- **Negocios ganados**: Lista de deals cerrados este mes
- **Actividad reciente**: Feed con últimos eventos

### 3. Command Center — CTRL+K (1 min)

- Presionar `Ctrl+K` (o `Cmd+K`)
- **Navegación**: escribir "ir a clientes" → Enter
- **AI query**: escribir "¿cuántos clientes tengo?" → Enter
- **Clientes**: escribir "qué sabes del cliente TechCorp" → Enter
- **Dashboard**: escribir "métricas del dashboard" → Enter

### 4. Gestión de Clientes (1 min)

- Navegar a `/clients` desde la sidebar
- Ver 8 clientes con datos realistas
- Click en "TechCorp S.A." → detalle con deals, tasks, quotes
- Click en "Nuevo cliente" → crear cliente rápido

### 5. Pipeline de Ventas (1 min)

- Navegar a `/pipeline`
- Ver deals organizados por etapa (Kanban)
- Arrastrar un deal de "Lead" a "Contactado"
- **Nota**: ver toast de éxito "Oportunidad movida"

### 6. Presupuestos (1 min)

- Navegar a `/quotes`
- Ver 3 presupuestos (DRAFT, SENT, ACCEPTED)
- Click "PDF" en un presupuesto → descarga PDF
- Click "Enviar" en DRAFT → cambia a SENT (toast + email si configurado)

### 7. Tareas (30s)

- Navegar a `/tasks`
- Ver 6 tareas con diferentes estados y prioridades
- Completar una tarea → toast "Tarea completada"
- Crear nueva tarea

### 8. Business Copilot (1 min)

- Abrir copiloto (icono Sparkle abajo a la derecha)
- Preguntar: "¿Qué oportunidades están abiertas?"
- Preguntar: "¿Cuáles son las tareas pendientes?"
- Preguntar: "Resumime la actividad de esta semana"

### 9. Notificaciones (30s)

- Ver campana en el header con badge de notificaciones
- Click para abrir panel de notificaciones
- Marcar como leídas

### 10. Perfil y Configuración (30s)

- Click en avatar → Profile → ver datos de usuario
- Settings → ver configuración de organización

---

## Resumen

| Sección        | Tiempo     | Highlights                    |
| -------------- | ---------- | ----------------------------- |
| Login          | 30s        | Auth con cookies HttpOnly     |
| Dashboard      | 1 min      | KPIs, charts, actividad       |
| Command Center | 1 min      | AI + navegación por voz/texto |
| Clientes       | 1 min      | CRUD completo con relaciones  |
| Pipeline       | 1 min      | Kanban drag & drop            |
| Presupuestos   | 1 min      | PDF, email, estados           |
| Tareas         | 30s        | CRUD + completion             |
| Copilot        | 1 min      | AI conversacional             |
| Notificaciones | 30s        | In-app + badge                |
| Perfil         | 30s        | User + org settings           |
| **Total**      | **~8 min** |                               |
