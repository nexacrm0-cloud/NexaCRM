import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORG_ID = 'cmqyf39c5000048dsxtw8sma6';

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_IN_PROD !== '1') {
    console.warn('⚠️  seed-demo-data.ts crea datos de ejemplo. Bloqueado en produccion.');
    return;
  }

  console.log('Seeding rich demo data...');

  // Get existing users
  const users = await prisma.user.findMany({
    where: { organizationId: ORG_ID },
    select: { id: true, firstName: true },
  });
  const user1 = users[0]?.id;
  const user2 = users[1]?.id;

  // Get pipeline stages
  const stages = await prisma.pipelineStage.findMany({
    where: { organizationId: ORG_ID },
    orderBy: { position: 'asc' },
  });
  const leadStage = stages.find((s) => s.name.toLowerCase().includes('lead')) || stages[0];
  const proposalStage = stages.find((s) => s.name.toLowerCase().includes('proposal')) || stages[2];
  const wonStage = stages.find((s) => s.isWinStage);
  const lostStage = stages.find((s) => s.isLoseStage);

  // Get clients
  const clients = await prisma.client.findMany({ where: { organizationId: ORG_ID } });
  const client1 = clients[0];

  // Create 8 more deals across stages
  const dealData = [
    {
      title: 'Enterprise Software License',
      value: 15000,
      stageId: proposalStage?.id,
      probability: 60,
      clientId: client1?.id,
      assignedTo: user1,
      closeDate: new Date('2026-07-15'),
    },
    {
      title: 'Consultoria Digital Transformation',
      value: 28000,
      stageId: leadStage?.id,
      probability: 20,
      assignedTo: user2,
      closeDate: new Date('2026-08-01'),
    },
    {
      title: 'Migracion Cloud AWS',
      value: 45000,
      stageId: proposalStage?.id,
      probability: 75,
      clientId: client1?.id,
      assignedTo: user1,
      closeDate: new Date('2026-07-20'),
    },
    {
      title: 'Auditoria de Seguridad',
      value: 8500,
      stageId: leadStage?.id,
      probability: 30,
      assignedTo: user2,
      closeDate: new Date('2026-08-10'),
    },
    {
      title: 'Desarrollo App Movil',
      value: 32000,
      stageId: leadStage?.id,
      probability: 15,
      assignedTo: user1,
      closeDate: new Date('2026-09-01'),
    },
    {
      title: 'Soporte IT Managed',
      value: 12000,
      stageId: wonStage?.id,
      probability: 100,
      clientId: client1?.id,
      assignedTo: user2,
    },
    {
      title: 'Licencias Microsoft 365',
      value: 6500,
      stageId: wonStage?.id,
      probability: 100,
      assignedTo: user1,
    },
    {
      title: 'Capacitacion Cloud',
      value: 4200,
      stageId: lostStage?.id,
      probability: 0,
      assignedTo: user2,
      lostReason: 'Presupuesto excedido',
    },
    {
      title: 'Implementacion ERP',
      value: 55000,
      stageId: leadStage?.id,
      probability: 10,
      assignedTo: user1,
      closeDate: new Date('2026-09-15'),
    },
    {
      title: 'Rediseño Web Corporativo',
      value: 9800,
      stageId: proposalStage?.id,
      probability: 50,
      assignedTo: user2,
      closeDate: new Date('2026-07-25'),
    },
  ];

  for (const d of dealData) {
    if (d.stageId) {
      await prisma.deal.create({ data: { ...d, organizationId: ORG_ID, currency: 'USD' } });
    }
  }
  console.log('Created ' + dealData.length + ' deals');

  // Create tasks with various statuses and priorities
  const taskData = [
    {
      title: 'Enviar propuesta a Enterprise Corp',
      priority: 'URGENT',
      status: 'PENDING',
      dueDate: new Date('2026-07-02'),
      assignedTo: user1,
      clientId: client1?.id,
    },
    {
      title: 'Seguimiento llamada con Juan SA',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: new Date('2026-07-01'),
      assignedTo: user2,
      clientId: client1?.id,
    },
    {
      title: 'Preparar demo de Cloud Migration',
      priority: 'HIGH',
      status: 'PENDING',
      dueDate: new Date('2026-07-05'),
      assignedTo: user1,
    },
    {
      title: 'Revisar contrato de Soporte IT',
      priority: 'MEDIUM',
      status: 'COMPLETED',
      completedAt: new Date('2026-06-28'),
      assignedTo: user2,
      clientId: client1?.id,
    },
    {
      title: 'Actualizar base de datos de clientes',
      priority: 'LOW',
      status: 'PENDING',
      dueDate: new Date('2026-07-10'),
      assignedTo: user1,
    },
    {
      title: 'Facturar licencias Microsoft',
      priority: 'HIGH',
      status: 'PENDING',
      dueDate: new Date('2026-06-30'),
      assignedTo: user2,
    },
    {
      title: 'Configurar entorno de QA',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      dueDate: new Date('2026-07-08'),
      assignedTo: user1,
    },
    {
      title: 'Cotizar servicios de auditoria',
      priority: 'URGENT',
      status: 'PENDING',
      dueDate: new Date('2026-07-01'),
      assignedTo: user2,
    },
    {
      title: 'Reunion de planificacion mensual',
      priority: 'MEDIUM',
      status: 'COMPLETED',
      completedAt: new Date('2026-06-27'),
      assignedTo: user1,
    },
    {
      title: 'Migrar datos de cliente legacy',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: new Date('2026-07-12'),
      assignedTo: user2,
    },
    {
      title: 'Documentar API interna',
      priority: 'LOW',
      status: 'PENDING',
      dueDate: new Date('2026-07-20'),
      assignedTo: user1,
    },
    {
      title: 'Resolver ticket #1234 - Login error',
      priority: 'URGENT',
      status: 'PENDING',
      dueDate: new Date('2026-06-30'),
      assignedTo: user1,
      clientId: client1?.id,
    },
  ];

  for (const t of taskData) {
    await prisma.task.create({
      data: { ...t, organizationId: ORG_ID, createdById: user1 || users[0].id },
    });
  }
  console.log('Created ' + taskData.length + ' tasks');

  // Create quotes
  const quoteData = [
    {
      title: 'Propuesta Enterprise Software',
      status: 'SENT',
      total: 15000,
      subtotal: 15000,
      clientId: client1?.id,
      sentAt: new Date('2026-06-25'),
    },
    {
      title: 'Cotizacion Cloud Migration',
      status: 'DRAFT',
      total: 45000,
      subtotal: 45000,
      clientId: client1?.id,
    },
    {
      title: 'Presupuesto Rediseño Web',
      status: 'SENT',
      total: 9800,
      subtotal: 9800,
      sentAt: new Date('2026-06-20'),
    },
  ];

  for (let i = 0; i < quoteData.length; i++) {
    const q = quoteData[i];
    await prisma.quote.create({
      data: {
        ...q,
        number: 'COT-' + String(10005 + i).padStart(5, '0'),
        organizationId: ORG_ID,
        createdById: user1 || users[0].id,
      },
    });
  }
  console.log('Created ' + quoteData.length + ' quotes');

  // Create invoices
  const invoiceData = [
    {
      title: 'Factura Soporte IT',
      status: 'PAID',
      total: 12000,
      subtotal: 12000,
      clientId: client1?.id,
      paidAt: new Date('2026-06-20'),
      invoiceType: 'B',
    },
    {
      title: 'Factura Licencias M365',
      status: 'ISSUED',
      total: 6500,
      subtotal: 6500,
      clientId: client1?.id,
      issuedAt: new Date('2026-06-25'),
      invoiceType: 'B',
    },
    {
      title: 'Factura Capacitacion (Perdida)',
      status: 'CANCELLED',
      total: 4200,
      subtotal: 4200,
      clientId: client1?.id,
      invoiceType: 'B',
    },
  ];

  for (let i = 0; i < invoiceData.length; i++) {
    const inv = invoiceData[i];
    await prisma.invoice.create({
      data: {
        ...inv,
        number: 'INV-' + String(10001 + i).padStart(5, '0'),
        organizationId: ORG_ID,
        createdById: user1 || users[0].id,
      },
    });
  }
  console.log('Created ' + invoiceData.length + ' invoices');

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
