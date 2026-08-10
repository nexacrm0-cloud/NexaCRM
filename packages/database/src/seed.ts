import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_IN_PROD !== '1') {
    console.warn(
      '⚠️  seed.ts crea datos demo con credenciales conocidas (admin@nexacrm.com / admin123).',
    );
    console.warn('⚠️  Bloqueado en NODE_ENV=production. Para forzar, setear SEED_DEMO_IN_PROD=1.');
    return;
  }

  const adminHash = await bcrypt.hash('admin123', 12);
  const mariaHash = await bcrypt.hash('maria123', 12);

  const org = await prisma.organization.upsert({
    where: { slug: 'nexa-demo' },
    update: {},
    create: {
      name: 'Nexa Demo',
      slug: 'nexa-demo',
      plan: 'professional',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@nexacrm.com' },
    update: {},
    create: {
      id: 'seed-user-admin',
      email: 'admin@nexacrm.com',
      passwordHash: adminHash,
      firstName: 'Admin',
      lastName: 'Nexa',
      role: 'OWNER',
      organizationId: org.id,
    },
  });

  const maria = await prisma.user.upsert({
    where: { email: 'maria@nexacrm.com' },
    update: {},
    create: {
      id: 'seed-user-maria',
      email: 'maria@nexacrm.com',
      passwordHash: mariaHash,
      firstName: 'María',
      lastName: 'García',
      role: 'MEMBER',
      organizationId: org.id,
    },
  });

  const stageDefs = [
    { name: 'Lead', position: 0, color: '#94a3b8', isWinStage: false, isLoseStage: false },
    { name: 'Contactado', position: 1, color: '#3b82f6', isWinStage: false, isLoseStage: false },
    { name: 'Reunión', position: 2, color: '#8b5cf6', isWinStage: false, isLoseStage: false },
    { name: 'Propuesta', position: 3, color: '#f59e0b', isWinStage: false, isLoseStage: false },
    { name: 'Negociación', position: 4, color: '#ef4444', isWinStage: false, isLoseStage: false },
    { name: 'Ganado', position: 5, color: '#22c55e', isWinStage: true, isLoseStage: false },
    { name: 'Perdido', position: 6, color: '#6b7280', isWinStage: false, isLoseStage: true },
  ];

  const stageIds: Record<string, string> = {};
  for (const s of stageDefs) {
    const stage = await prisma.pipelineStage.upsert({
      where: { organizationId_position: { organizationId: org.id, position: s.position } },
      update: {},
      create: { ...s, organizationId: org.id },
    });
    stageIds[s.name] = stage.id;
  }

  const clientsData = [
    {
      id: 'seed-client-techcorp',
      companyName: 'TechCorp S.A.',
      contactName: 'Juan Pérez',
      email: 'juan@techcorp.com',
      phone: '+54 11 5555-0101',
      address: 'Av. Corrientes 1234, CABA',
      tags: ['tech', 'prioritario'],
    },
    {
      id: 'seed-client-globalsoft',
      companyName: 'GlobalSoft Argentina',
      contactName: 'Laura Martínez',
      email: 'laura@globalsoft.com.ar',
      phone: '+54 11 5555-0202',
      address: 'Leandro Alem 850, CABA',
      tags: ['software', 'outsourcing'],
    },
    {
      id: 'seed-client-muebles',
      companyName: 'Muebles del Sur',
      contactName: 'Carlos Rodríguez',
      email: 'carlos@mueblessur.com',
      phone: '+54 291 5555-0303',
      address: 'Av. Alem 500, Bahía Blanca',
      tags: ['manufactura', 'pyme'],
    },
    {
      id: 'seed-client-freshfoods',
      companyName: 'FreshFoods Distribuidora',
      contactName: 'Ana Gómez',
      email: 'ana@freshfoods.com.ar',
      phone: '+54 341 5555-0404',
      address: 'Bv. Oroño 1200, Rosario',
      tags: ['alimentos', 'logística'],
    },
    {
      id: 'seed-client-clinica',
      companyName: 'Clínica del Plata',
      contactName: 'Dr. Roberto Fernández',
      email: 'rfernandez@clinicadelplata.com',
      phone: '+54 221 5555-0505',
      address: 'Calle 50 789, La Plata',
      tags: ['salud', 'privado'],
    },
    {
      id: 'seed-client-horizonte',
      companyName: 'Constructora Horizonte',
      contactName: 'Martín Díaz',
      email: 'mdiaz@horizonteconstruye.com',
      phone: '+54 351 5555-0606',
      address: 'Av. Colón 300, Córdoba',
      tags: ['construcción', 'inmobiliario'],
    },
    {
      id: 'seed-client-bluewave',
      companyName: 'BlueWave Consulting',
      contactName: 'Sofía López',
      email: 'sofia@bluewaveconsulting.com',
      phone: '+54 11 5555-0707',
      address: 'Av. del Libertador 2500, CABA',
      tags: ['consultoría', 'fintech'],
    },
    {
      id: 'seed-client-ecopack',
      companyName: 'EcoPack Sustentable',
      contactName: 'Pablo Torres',
      email: 'ptorres@ecopack.com.ar',
      phone: '+54 11 5555-0808',
      address: 'Av. San Martín 4500, San Martín',
      tags: ['sustentabilidad', 'packaging'],
    },
  ];

  const clientMap: Record<string, { id: string }> = {};
  for (const c of clientsData) {
    const client = await prisma.client.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, organizationId: org.id },
    });
    clientMap[c.id] = client;
  }

  const pastMonth = new Date();
  pastMonth.setMonth(pastMonth.getMonth() - 1);

  const dealsData = [
    {
      id: 'seed-deal-lead-1',
      title: 'Implementación CRM Premium',
      value: 15000,
      probability: 20,
      stageName: 'Lead',
      clientId: 'seed-client-techcorp',
      assignedTo: admin.id,
      position: 0,
    },
    {
      id: 'seed-deal-lead-2',
      title: 'Consultoría de Digitalización',
      value: 8500,
      probability: 15,
      stageName: 'Lead',
      clientId: 'seed-client-globalsoft',
      assignedTo: maria.id,
      position: 1,
    },
    {
      id: 'seed-deal-contact-1',
      title: 'ERP + CRM Integrado',
      value: 12000,
      probability: 25,
      stageName: 'Contactado',
      clientId: 'seed-client-muebles',
      assignedTo: admin.id,
      position: 0,
    },
    {
      id: 'seed-deal-contact-2',
      title: 'Plataforma Gestión de Pedidos',
      value: 22000,
      probability: 30,
      stageName: 'Contactado',
      clientId: 'seed-client-freshfoods',
      assignedTo: maria.id,
      position: 1,
    },
    {
      id: 'seed-deal-meeting-1',
      title: 'Sistema de Gestión de Pacientes',
      value: 45000,
      probability: 40,
      stageName: 'Reunión',
      clientId: 'seed-client-clinica',
      assignedTo: admin.id,
      position: 0,
    },
    {
      id: 'seed-deal-proposal-1',
      title: 'Software de Gestión de Obras',
      value: 35000,
      probability: 60,
      stageName: 'Propuesta',
      clientId: 'seed-client-horizonte',
      assignedTo: maria.id,
      position: 0,
    },
    {
      id: 'seed-deal-nego-1',
      title: 'Suite de Consultoría Financiera',
      value: 18000,
      probability: 75,
      stageName: 'Negociación',
      clientId: 'seed-client-bluewave',
      assignedTo: admin.id,
      position: 0,
    },
    {
      id: 'seed-deal-won-1',
      title: 'Sistema de Gestión Sustentable',
      value: 28500,
      probability: 100,
      stageName: 'Ganado',
      clientId: 'seed-client-ecopack',
      assignedTo: admin.id,
      closeDate: pastMonth,
      position: 0,
    },
    {
      id: 'seed-deal-lost-1',
      title: 'Plataforma de Data Analytics',
      value: 9500,
      probability: 0,
      stageName: 'Perdido',
      clientId: 'seed-client-globalsoft',
      assignedTo: maria.id,
      lostReason: 'Presupuesto insuficiente',
      position: 0,
    },
  ];

  const dealMap: Record<string, { id: string }> = {};
  for (const d of dealsData) {
    const { stageName, ...dealFields } = d;
    const deal = await prisma.deal.upsert({
      where: { id: d.id },
      update: {},
      create: {
        ...dealFields,
        currency: 'USD',
        organizationId: org.id,
        stageId: stageIds[stageName],
      },
    });
    dealMap[d.id] = deal;
  }

  const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

  const tasksData = [
    {
      id: 'seed-task-1',
      title: 'Preparar propuesta comercial para Horizonte',
      priority: 'HIGH',
      status: 'PENDING',
      dueDate: daysFromNow(3),
      createdById: admin.id,
      assignedTo: admin.id,
      clientId: 'seed-client-horizonte',
      dealId: 'seed-deal-proposal-1',
    },
    {
      id: 'seed-task-2',
      title: 'Enviar documentación a FreshFoods',
      priority: 'MEDIUM',
      status: 'PENDING',
      dueDate: daysFromNow(7),
      createdById: admin.id,
      assignedTo: maria.id,
      clientId: 'seed-client-freshfoods',
    },
    {
      id: 'seed-task-3',
      title: 'Seguimiento llamada Clínica del Plata',
      priority: 'URGENT',
      status: 'PENDING',
      dueDate: daysFromNow(1),
      createdById: maria.id,
      assignedTo: admin.id,
      clientId: 'seed-client-clinica',
    },
    {
      id: 'seed-task-4',
      title: 'Revisar contrato con BlueWave Consulting',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: daysFromNow(5),
      createdById: admin.id,
      assignedTo: admin.id,
      dealId: 'seed-deal-nego-1',
    },
    {
      id: 'seed-task-5',
      title: 'Llamada inicial con EcoPack Sustentable',
      priority: 'MEDIUM',
      status: 'COMPLETED',
      dueDate: daysAgo(10),
      completedAt: daysAgo(5),
      createdById: admin.id,
      assignedTo: admin.id,
      clientId: 'seed-client-ecopack',
    },
    {
      id: 'seed-task-6',
      title: 'Demo CRM con Muebles del Sur',
      priority: 'HIGH',
      status: 'COMPLETED',
      dueDate: daysAgo(7),
      completedAt: daysAgo(3),
      createdById: maria.id,
      assignedTo: maria.id,
      clientId: 'seed-client-muebles',
      dealId: 'seed-deal-contact-1',
    },
  ];

  for (const t of tasksData) {
    await prisma.task.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, organizationId: org.id },
    });
  }

  const getNextQuoteNumber = async (): Promise<string> => {
    const result = await prisma.$queryRawUnsafe<{ nextval: bigint }[]>(
      "SELECT nextval('quote_number_seq') as nextval",
    );
    const num = Number(result[0].nextval);
    return `Q-${String(num).padStart(6, '0')}`;
  };

  const draftQuoteNumber = await getNextQuoteNumber();
  await prisma.quote.upsert({
    where: { id: 'seed-quote-draft' },
    update: {},
    create: {
      id: 'seed-quote-draft',
      number: draftQuoteNumber,
      title: 'CRM Premium - TechCorp S.A.',
      status: 'DRAFT',
      subtotal: 15500,
      taxRate: 21,
      taxAmount: 3255,
      total: 18755,
      terms: 'Pago a 30 días',
      validUntil: daysFromNow(30),
      organizationId: org.id,
      clientId: clientMap['seed-client-techcorp'].id,
      createdById: admin.id,
    },
  });

  const sentQuoteNumber = await getNextQuoteNumber();
  await prisma.quote.upsert({
    where: { id: 'seed-quote-sent' },
    update: {},
    create: {
      id: 'seed-quote-sent',
      number: sentQuoteNumber,
      title: 'CRM Enterprise - GlobalSoft Argentina',
      status: 'SENT',
      subtotal: 24900,
      taxRate: 21,
      taxAmount: 5229,
      total: 30129,
      notes: 'Incluye 25 licencias y capacitación inicial.',
      terms: '50% al inicio, 50% contra entrega',
      validUntil: daysFromNow(15),
      sentAt: daysAgo(2),
      organizationId: org.id,
      clientId: clientMap['seed-client-globalsoft'].id,
      dealId: dealMap['seed-deal-lead-2'].id,
      createdById: admin.id,
    },
  });

  const acceptedQuoteNumber = await getNextQuoteNumber();
  await prisma.quote.upsert({
    where: { id: 'seed-quote-accepted' },
    update: {},
    create: {
      id: 'seed-quote-accepted',
      number: acceptedQuoteNumber,
      title: 'CRM Pro - Muebles del Sur',
      status: 'ACCEPTED',
      subtotal: 11200,
      taxRate: 21,
      taxAmount: 2352,
      total: 13552,
      notes: 'Incluye migración de datos desde sistema legacy.',
      terms: 'Factura A - Pago 100% a 15 días',
      sentAt: daysAgo(20),
      acceptedAt: daysAgo(15),
      organizationId: org.id,
      clientId: clientMap['seed-client-muebles'].id,
      dealId: dealMap['seed-deal-contact-1'].id,
      createdById: maria.id,
    },
  });

  const draftQuoteItems = [
    {
      id: 'seed-qi-draft-1',
      description: 'Suscripción CRM Premium - Anual',
      quantity: 1,
      unitPrice: 12000,
      total: 12000,
      quoteId: 'seed-quote-draft',
    },
    {
      id: 'seed-qi-draft-2',
      description: 'Servicio de Implementación y Configuración',
      quantity: 1,
      unitPrice: 3500,
      total: 3500,
      quoteId: 'seed-quote-draft',
    },
  ];

  const sentQuoteItems = [
    {
      id: 'seed-qi-sent-1',
      description: 'Licencia CRM Enterprise - 25 usuarios',
      quantity: 1,
      unitPrice: 18000,
      total: 18000,
      quoteId: 'seed-quote-sent',
    },
    {
      id: 'seed-qi-sent-2',
      description: 'Módulo de Reporting Avanzado',
      quantity: 1,
      unitPrice: 4500,
      total: 4500,
      quoteId: 'seed-quote-sent',
    },
    {
      id: 'seed-qi-sent-3',
      description: 'Capacitación inicial (8 horas presenciales)',
      quantity: 1,
      unitPrice: 2400,
      total: 2400,
      quoteId: 'seed-quote-sent',
    },
  ];

  const acceptedQuoteItems = [
    {
      id: 'seed-qi-accepted-1',
      description: 'Suscripción CRM Pro - 10 usuarios',
      quantity: 1,
      unitPrice: 8400,
      total: 8400,
      quoteId: 'seed-quote-accepted',
    },
    {
      id: 'seed-qi-accepted-2',
      description: 'Migración de datos desde sistema legacy',
      quantity: 1,
      unitPrice: 2800,
      total: 2800,
      quoteId: 'seed-quote-accepted',
    },
  ];

  const allItems = [...draftQuoteItems, ...sentQuoteItems, ...acceptedQuoteItems];
  for (const item of allItems) {
    await prisma.quoteItem.upsert({
      where: { id: item.id },
      update: {},
      create: item,
    });
  }

  // ──────────────────────────────────────────────
  //  ACTIVITY LOGS (para dashboard y AI context)
  // ──────────────────────────────────────────────
  const activitiesData = [
    {
      id: 'seed-act-1',
      type: 'CREATED' as const,
      description: 'Nuevo cliente: TechCorp S.A.',
      userId: admin.id,
      clientId: 'seed-client-techcorp',
      createdAt: daysAgo(30),
    },
    {
      id: 'seed-act-2',
      type: 'DEAL_WON' as const,
      description: 'Deal ganado: Sistema de Gestión Sustentable - $28,500',
      userId: admin.id,
      dealId: 'seed-deal-won-1',
      createdAt: daysAgo(25),
    },
    {
      id: 'seed-act-3',
      type: 'DEAL_LOST' as const,
      description: 'Deal perdido: Plataforma de Data Analytics - $9,500 (Presupuesto insuficiente)',
      userId: maria.id,
      dealId: 'seed-deal-lost-1',
      createdAt: daysAgo(20),
    },
    {
      id: 'seed-act-4',
      type: 'QUOTE_GENERATED' as const,
      description: 'Presupuesto enviado: CRM Enterprise - GlobalSoft Argentina - $30,129',
      userId: admin.id,
      createdAt: daysAgo(12),
    },
    {
      id: 'seed-act-5',
      type: 'MEETING_SCHEDULED' as const,
      description: 'Reunión agendada con Clínica del Plata para demo de CRM',
      userId: admin.id,
      clientId: 'seed-client-clinica',
      createdAt: daysAgo(8),
    },
    {
      id: 'seed-act-6',
      type: 'NOTE_ADDED' as const,
      description: 'Nota agregada a oportunidad: Suite Financiera BlueWave',
      userId: admin.id,
      dealId: 'seed-deal-nego-1',
      createdAt: daysAgo(5),
    },
    {
      id: 'seed-act-7',
      type: 'STATUS_CHANGED' as const,
      description: 'Oportunidad movida a Propuesta: Software de Gestión de Obras',
      userId: maria.id,
      dealId: 'seed-deal-proposal-1',
      createdAt: daysAgo(4),
    },
    {
      id: 'seed-act-8',
      type: 'CREATED' as const,
      description: 'Tarea creada: Preparar propuesta comercial para Horizonte',
      userId: admin.id,
      taskId: 'seed-task-1',
      createdAt: daysAgo(3),
    },
    {
      id: 'seed-act-9',
      type: 'EMAIL_SENT' as const,
      description: 'Email enviado a FreshFoods con documentación adjunta',
      userId: maria.id,
      createdAt: daysAgo(2),
    },
    {
      id: 'seed-act-10',
      type: 'CALL_MADE' as const,
      description: 'Llamada de seguimiento con Juan Pérez (TechCorp)',
      userId: admin.id,
      clientId: 'seed-client-techcorp',
      createdAt: daysAgo(1),
    },
    {
      id: 'seed-act-11',
      type: 'CREATED' as const,
      description: 'Nuevo cliente: BlueWave Consulting',
      userId: admin.id,
      clientId: 'seed-client-bluewave',
      createdAt: daysAgo(15),
    },
    {
      id: 'seed-act-12',
      type: 'CREATED' as const,
      description: 'Nuevo cliente: EcoPack Sustentable',
      userId: admin.id,
      clientId: 'seed-client-ecopack',
      createdAt: daysAgo(35),
    },
  ];

  for (const a of activitiesData) {
    await prisma.activityLog.upsert({
      where: { id: a.id },
      update: {},
      create: { ...a, organizationId: org.id, createdAt: a.createdAt },
    });
  }

  // ──────────────────────────────────────────────
  //  DASHBOARD PROJECTION
  // ──────────────────────────────────────────────
  await prisma.dashboardProjection.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      monthlySales: 28500,
      newClients: 3,
      openOpportunities: 7,
      pendingTasks: 4,
      wonDeals: JSON.stringify([
        {
          id: 'seed-deal-won-1',
          title: 'Sistema de Gestión Sustentable',
          value: 28500,
          client: 'EcoPack Sustentable',
          date: daysAgo(25).toISOString(),
        },
      ]),
    },
  });

  // ──────────────────────────────────────────────
  //  NOTIFICACIONES IN-APP
  // ──────────────────────────────────────────────
  const notificationsData = [
    {
      id: 'seed-notif-1',
      type: 'deal_won',
      title: 'Deal ganado! 🎉',
      message: 'EcoPack Sustentable aceptó propuesta por $28,500',
      link: '/pipeline',
      userId: admin.id,
      createdAt: daysAgo(25),
    },
    {
      id: 'seed-notif-2',
      type: 'task_due',
      title: 'Tarea urgente vence mañana',
      message: 'Seguimiento llamada Clínica del Plata',
      link: '/tasks',
      userId: admin.id,
      createdAt: daysAgo(1),
    },
    {
      id: 'seed-notif-3',
      type: 'quote_sent',
      title: 'Presupuesto enviado',
      message: 'CRM Enterprise - GlobalSoft Argentina por $30,129',
      link: '/quotes',
      userId: admin.id,
      createdAt: daysAgo(12),
    },
    {
      id: 'seed-notif-4',
      type: 'new_client',
      title: 'Nuevo cliente registrado',
      message: 'BlueWave Consulting',
      link: '/clients',
      userId: admin.id,
      createdAt: daysAgo(15),
    },
    {
      id: 'seed-notif-5',
      type: 'deal_stale',
      title: 'Oportunidad estancada',
      message: 'ERP + CRM Integrado - Muebles del Sur lleva 20+ días sin actividad',
      link: '/pipeline',
      userId: admin.id,
      createdAt: daysAgo(1),
    },
    {
      id: 'seed-notif-6',
      type: 'welcome',
      title: 'Bienvenido a Nexa CRM!',
      message: 'Completa tu perfil y explora el panel de control',
      userId: admin.id,
      createdAt: daysAgo(45),
    },
  ];

  for (const n of notificationsData) {
    await prisma.notification.upsert({
      where: { id: n.id },
      update: {},
      create: { ...n, organizationId: org.id, createdAt: n.createdAt },
    });
  }

  // ──────────────────────────────────────────────
  //  SEARCH INDEX
  // ──────────────────────────────────────────────
  const searchIndexData = [
    {
      id: 'seed-si-client-1',
      entityType: 'client',
      entityId: 'seed-client-techcorp',
      title: 'TechCorp S.A.',
      content: 'TechCorp S.A. Juan Pérez juan@techcorp.com +54 11 5555-0101',
    },
    {
      id: 'seed-si-client-2',
      entityType: 'client',
      entityId: 'seed-client-globalsoft',
      title: 'GlobalSoft Argentina',
      content: 'GlobalSoft Argentina Laura Martínez laura@globalsoft.com.ar +54 11 5555-0202',
    },
    {
      id: 'seed-si-client-3',
      entityType: 'client',
      entityId: 'seed-client-muebles',
      title: 'Muebles del Sur',
      content: 'Muebles del Sur Carlos Rodríguez carlos@mueblessur.com +54 291 5555-0303',
    },
    {
      id: 'seed-si-client-4',
      entityType: 'client',
      entityId: 'seed-client-clinica',
      title: 'Clínica del Plata',
      content:
        'Clínica del Plata Dr. Roberto Fernández rfernandez@clinicadelplata.com +54 221 5555-0505',
    },
    {
      id: 'seed-si-deal-1',
      entityType: 'deal',
      entityId: 'seed-deal-nego-1',
      title: 'Suite de Consultoría Financiera',
      content: 'Suite de Consultoría Financiera BlueWave Consulting $18,000 Negociación',
    },
    {
      id: 'seed-si-deal-2',
      entityType: 'deal',
      entityId: 'seed-deal-proposal-1',
      title: 'Software de Gestión de Obras',
      content: 'Software de Gestión de Obras Constructora Horizonte $35,000 Propuesta',
    },
    {
      id: 'seed-si-task-1',
      entityType: 'task',
      entityId: 'seed-task-1',
      title: 'Preparar propuesta comercial para Horizonte',
      content: 'Preparar propuesta comercial para Horizonte HIGH PENDING',
    },
    {
      id: 'seed-si-task-3',
      entityType: 'task',
      entityId: 'seed-task-3',
      title: 'Seguimiento llamada Clínica del Plata',
      content: 'Seguimiento llamada Clínica del Plata URGENT PENDING',
    },
  ];

  for (const si of searchIndexData) {
    await prisma.searchIndex.upsert({
      where: { id: si.id },
      update: {},
      create: { ...si, organizationId: org.id },
    });
  }

  // ──────────────────────────────────────────────
  //  AGREGAR PRESUPUESTO VIEJO (>7 días, sin respuesta)
  //  para que la herramienta unanswered_quotes funcione
  // ──────────────────────────────────────────────
  const oldQuoteNumber = await getNextQuoteNumber();
  await prisma.quote.upsert({
    where: { id: 'seed-quote-old-sent' },
    update: {},
    create: {
      id: 'seed-quote-old-sent',
      number: oldQuoteNumber,
      title: 'CRM Premium - Clínica del Plata',
      status: 'SENT',
      subtotal: 22000,
      taxRate: 21,
      taxAmount: 4620,
      total: 26620,
      notes: 'Incluye módulo de historias clínicas digitales.',
      terms: 'Pago a 30 días',
      validUntil: daysAgo(5),
      sentAt: daysAgo(15),
      organizationId: org.id,
      clientId: clientMap['seed-client-clinica'].id,
      dealId: dealMap['seed-deal-meeting-1'].id,
      createdById: admin.id,
    },
  });

  await prisma.quoteItem.upsert({
    where: { id: 'seed-qi-old-1' },
    update: {},
    create: {
      id: 'seed-qi-old-1',
      description: 'Suscripción CRM Premium - 15 usuarios - Anual',
      quantity: 1,
      unitPrice: 18000,
      total: 18000,
      quoteId: 'seed-quote-old-sent',
    },
  });

  await prisma.quoteItem.upsert({
    where: { id: 'seed-qi-old-2' },
    update: {},
    create: {
      id: 'seed-qi-old-2',
      description: 'Módulo de Historias Clínicas Digitales',
      quantity: 1,
      unitPrice: 4000,
      total: 4000,
      quoteId: 'seed-quote-old-sent',
    },
  });

  // ──────────────────────────────────────────────
  //  MODIFICAR FECHAS para que algunos deals y
  //  tasks sirvan para las herramientas de análisis
  // ──────────────────────────────────────────────
  // Deal estancado (>20 días sin actividad)
  await prisma.deal.update({
    where: { id: 'seed-deal-contact-1' },
    data: { updatedAt: daysAgo(22) },
  });
  await prisma.deal.update({
    where: { id: 'seed-deal-meeting-1' },
    data: { updatedAt: daysAgo(15) },
  });

  // Tarea vencida (pasó la fecha)
  await prisma.task.update({
    where: { id: 'seed-task-2' },
    data: { dueDate: daysAgo(3), status: 'PENDING' },
  });

  // ──────────────────────────────────────────────
  //  BUSINESS COPILOT AGENT
  // ──────────────────────────────────────────────
  await prisma.agent.upsert({
    where: { id: 'agent-business-copilot' },
    update: {},
    create: {
      id: 'agent-business-copilot',
      name: 'business_copilot',
      displayName: 'Business Copilot',
      description:
        'Tu analista de negocios IA: analiza ventas, pipeline, clientes y tareas para darte insights proactivos, alertas y recomendaciones accionables.',
      type: 'business_copilot',
      icon: 'Brain',
      webhookUrl: '',
      workflowUrl: '',
      requiredPlan: 'pro',
      features: [
        'proactive_insights',
        'financial_forecasting',
        'pipeline_health',
        'client_health_scoring',
        'recommended_actions',
        'proactive_alerts',
        'pipeline_forecasting',
        'client_health_scoring',
      ],
      isActive: true,
    },
  });

  // ──────────────────────────────────────────────
  //  BUSINESS ANALYST AGENT
  // ──────────────────────────────────────────────
  await prisma.agent.upsert({
    where: { id: 'agent-business-analyst' },
    update: {},
    create: {
      id: 'agent-business-analyst',
      name: 'business_analyst',
      displayName: 'Analista de Negocios',
      description:
        'Analista de negocios IA que analiza métricas, pipeline, clientes y tareas para generar insights, pronósticos y recomendaciones estratégicas.',
      type: 'business_analyst',
      icon: 'BarChart3',
      webhookUrl: '',
      workflowUrl: '',
      requiredPlan: 'pro',
      features: [
        'business_insights',
        'financial_forecasting',
        'pipeline_health_analysis',
        'client_health_scoring',
        'recommended_actions',
        'proactive_alerts',
      ],
      isActive: true,
    },
  });

  // ──────────────────────────────────────────────
  //  AGENTE WHATSAPP AI
  // ──────────────────────────────────────────────
  await prisma.agent.upsert({
    where: { id: 'agent-whatsapp-ai' },
    update: {},
    create: {
      id: 'agent-whatsapp-ai',
      name: 'whatsapp_ai',
      displayName: 'Asistente WhatsApp',
      description:
        'Agente IA que gestiona conversaciones de WhatsApp: responde consultas, califica leads, agenda reuniones y da seguimiento automático.',
      type: 'whatsapp_ai',
      icon: 'MessageSquare',
      webhookUrl: '',
      workflowUrl: '',
      requiredPlan: 'pro',
      features: [
        'chat_inteligente',
        'lead_calification',
        'auto_reply',
        'meeting_scheduling',
        'sentiment_analysis',
      ],
      isActive: true,
    },
  });

  // ──────────────────────────────────────────────
  //  REPORTE FINAL
  // ──────────────────────────────────────────────
  const userCount = await prisma.user.count({ where: { organizationId: org.id } });
  const clientCount = await prisma.client.count({ where: { organizationId: org.id } });
  const dealCount = await prisma.deal.count({ where: { organizationId: org.id } });
  const taskCount = await prisma.task.count({ where: { organizationId: org.id } });
  const quoteCount = await prisma.quote.count({ where: { organizationId: org.id } });
  const activityCount = await prisma.activityLog.count({ where: { organizationId: org.id } });
  const notificationCount = await prisma.notification.count({ where: { organizationId: org.id } });

  console.log('Seed completed successfully');
  console.log(`  Organization: ${org.name}`);
  console.log(`  Users: ${userCount} (admin@nexacrm.com / admin123, maria@nexacrm.com / maria123)`);
  console.log(`  Clients: ${clientCount}`);
  console.log(`  Deals: ${dealCount}`);
  console.log(`  Tasks: ${taskCount}`);
  console.log(`  Quotes: ${quoteCount}`);
  console.log(`  Activity Logs: ${activityCount}`);
  console.log(`  Notifications: ${notificationCount}`);
  console.log('');
  console.log('✨ Datos de muestra listos!');
  console.log('   - Incluye actividades, notificaciones y proyecciones del dashboard');
  console.log('   - Hay deals estancados (+20 días), tareas vencidas y quotes sin respuesta');
  console.log('   - El AI Copilot puede analizar todo esto');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
