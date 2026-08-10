const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ORG_ID = 'cmqyf39c5000048dsxtw8sma6';

async function main() {
  const allDeals = await prisma.deal.findMany({
    where: { organizationId: ORG_ID },
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true, createdAt: true },
  });
  const titles = [
    'Enterprise Software License',
    'Consultoria Digital Transformation',
    'Migracion Cloud AWS',
    'Auditoria de Seguridad',
    'Desarrollo App Movil',
    'Soporte IT Managed',
    'Licencias Microsoft 365',
    'Capacitacion Cloud',
    'Implementacion ERP',
    'Rediseño Web Corporativo',
  ];
  // Keep first 10 from the seed (excluding old seed data)
  const toDelete = allDeals.filter(
    (d) =>
      !titles.includes(d.title) &&
      !d.title.startsWith('Oportunidad') &&
      d.title !== 'a' &&
      d.title !== 'Venta-Vera Shoes',
  );
  if (toDelete.length > 0) {
    await prisma.deal.deleteMany({ where: { id: { in: toDelete.map((d) => d.id) } } });
    console.log('Deleted ' + toDelete.length + ' duplicate deals');
  } else {
    console.log('No duplicate deals to delete');
  }

  const allTasks = await prisma.task.findMany({
    where: { organizationId: ORG_ID },
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true },
  });
  const taskTitles = [
    'Enviar propuesta a Enterprise Corp',
    'Seguimiento llamada con Juan SA',
    'Preparar demo de Cloud Migration',
    'Revisar contrato de Soporte IT',
    'Actualizar base de datos de clientes',
    'Facturar licencias Microsoft',
    'Configurar entorno de QA',
    'Cotizar servicios de auditoria',
    'Reunion de planificacion mensual',
    'Migrar datos de cliente legacy',
    'Documentar API interna',
    'Resolver ticket #1234 - Login error',
  ];
  const taskToDelete = allTasks.filter((t) => !taskTitles.includes(t.title));
  if (taskToDelete.length > 0) {
    await prisma.task.deleteMany({ where: { id: { in: taskToDelete.map((t) => t.id) } } });
    console.log('Deleted ' + taskToDelete.length + ' duplicate tasks');
  } else {
    console.log('No duplicate tasks to delete');
  }

  const deals = await prisma.deal.count({ where: { organizationId: ORG_ID } });
  const tasks = await prisma.task.count({ where: { organizationId: ORG_ID } });
  const clients = await prisma.client.count({ where: { organizationId: ORG_ID } });
  console.log('Final counts - Deals: ' + deals + ', Tasks: ' + tasks + ', Clients: ' + clients);

  await prisma.agentExecution.deleteMany({ where: { organizationId: ORG_ID } });
  console.log('Cleared execution logs');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
