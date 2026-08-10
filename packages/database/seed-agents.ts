import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const agents = [
  {
    name: 'sales',
    displayName: 'Agente de Ventas',
    description:
      'Atiende consultas de clientes, genera presupuestos automáticos, califica leads y crea oportunidades en el pipeline. Disponible 24/7 para capturar leads cuando vos dormís.',
    type: 'sales',
    icon: 'target',
    webhookUrl: process.env.N8N_SALES_WEBHOOK || '',
    workflowUrl: process.env.N8N_SALES_WORKFLOW_URL || '',
    requiredPlan: 'pro',
    features: [
      'Responder consultas de clientes',
      'Generar presupuestos automáticos',
      'Calificar leads entrantes',
      'Crear oportunidades en pipeline',
      'Seguimiento automático',
    ],
  },
  {
    name: 'follow_up',
    displayName: 'Agente de Seguimiento',
    description:
      'Revisa clientes inactivos, presupuestos vencidos y tareas pendientes. Envía recordatorios automáticos y crea tareas de seguimiento para que nunca se te escape una venta.',
    type: 'follow_up',
    icon: 'clock',
    webhookUrl: process.env.N8N_FOLLOWUP_WEBHOOK || '',
    workflowUrl: process.env.N8N_FOLLOWUP_WORKFLOW_URL || '',
    requiredPlan: 'starter',
    features: [
      'Detectar clientes inactivos',
      'Seguimiento de presupuestos vencidos',
      'Enviar recordatorios automáticos',
      'Crear tareas de seguimiento',
      'Reporte semanal de seguimiento',
    ],
  },
  {
    name: 'business_analyst',
    displayName: 'Analista de Negocios',
    description:
      'Analiza tus ventas, detecta tendencias, identifica riesgos y genera recomendaciones accionables. Te ayuda a tomar mejores decisiones con datos.',
    type: 'business_analyst',
    icon: 'bar-chart',
    webhookUrl: process.env.N8N_ANALYST_WEBHOOK || '',
    workflowUrl: process.env.N8N_ANALYST_WORKFLOW_URL || '',
    requiredPlan: 'pro',
    features: [
      'Análisis de ventas mensual',
      'Detección de tendencias',
      'Identificación de riesgos',
      'Recomendaciones accionables',
      'Resumen ejecutivo semanal',
    ],
  },
  {
    name: 'operations',
    displayName: 'Agente de Operaciones',
    description:
      'Organiza tareas, detecta cuellos de botella en el pipeline, coordina procesos entre equipos y optimiza la eficiencia operativa de tu negocio.',
    type: 'operations',
    icon: 'settings',
    webhookUrl: process.env.N8N_OPERATIONS_WEBHOOK || '',
    workflowUrl: process.env.N8N_OPERATIONS_WORKFLOW_URL || '',
    requiredPlan: 'enterprise',
    features: [
      'Organización automática de tareas',
      'Detección de cuellos de botella',
      'Coordinación entre equipos',
      'Optimización de procesos',
      'Métricas de eficiencia',
    ],
  },
];

async function main() {
  console.log('Seeding agents catalog...');

  for (const agent of agents) {
    const existing = await prisma.agent.findFirst({
      where: { name: agent.name },
    });

    if (existing) {
      console.log(`Agent ${agent.name} already exists, skipping...`);
      continue;
    }

    await prisma.agent.create({
      data: {
        name: agent.name,
        displayName: agent.displayName,
        description: agent.description,
        type: agent.type,
        icon: agent.icon,
        webhookUrl: agent.webhookUrl,
        workflowUrl: agent.workflowUrl,
        requiredPlan: agent.requiredPlan,
        features: JSON.parse(JSON.stringify(agent.features)),
        isActive: true,
      },
    });

    console.log(`Created agent: ${agent.displayName}`);
  }

  console.log('Agents catalog seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
