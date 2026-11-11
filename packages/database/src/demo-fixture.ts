import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Prisma, PrismaClient, TaskPriority, TaskStatus } from '@prisma/client';
import { DEMO_DURATION_MS } from '@nexa/shared';

/**
 * Narrowing helper for indexed lookups: `noUncheckedIndexedAccess` makes
 * every record access `T | undefined`, and a missing record here is a
 * programming error, not a runtime condition worth degrading gracefully.
 */
function must<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(`Demo fixture incompleto: ${message}`);
  }
  return value;
}

/**
 * Reusable sales-demo fixture.
 *
 * The very same data set is used by:
 *   - `pnpm db:seed`                     (local development seed)
 *   - `pnpm db:seed:demo-user`           (creates/refreshes the demo tenant)
 *   - the API demo cron                  (resets the tenant when the week ends)
 *
 * Keeping it in one place guarantees the demo a prospect sees after a reset
 * is byte-for-byte the demo the sales team demos.
 */

export const DEMO_ORG_SLUG = 'nexa-demo';
export const DEMO_ORG_NAME = 'Nexa Demo';

export type DemoAccount = {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'seed-user-demo',
    email: 'demo@nexacrm.com',
    password: 'demo123',
    firstName: 'Demo',
    lastName: 'Nexa',
    role: 'OWNER',
  },
  {
    id: 'seed-user-admin',
    email: 'admin@nexacrm.com',
    password: 'admin123',
    firstName: 'Admin',
    lastName: 'Nexa',
    role: 'OWNER',
  },
  {
    id: 'seed-user-maria',
    email: 'maria@nexacrm.com',
    password: 'maria123',
    firstName: 'María',
    lastName: 'García',
    role: 'MEMBER',
  },
];

export type DemoFixtureOptions = {
  slug?: string;
  name?: string;
  plan?: string;
  /** Marks the tenant as time-boxed. Defaults to true. */
  isDemo?: boolean;
  /** Absolute deadline of the demo window. Defaults to now + 7 days. */
  demoExpiresAt?: Date | null;
  /**
   * Accounts to seed in this tenant.
   *
   * Defaults to the shared {@link DEMO_ACCOUNTS}. A per-prospect demo passes
   * its own accounts so the prospect logs in with THEIR email, in THEIR own
   * organization (each one is a separate tenant, isolated by RLS).
   */
  accounts?: DemoAccount[];
};

export type DemoFixtureResult = {
  organizationId: string;
  slug: string;
  name: string;
  plan: string;
  isDemo: boolean;
  demoExpiresAt: Date | null;
  accounts: Array<{ id: string; email: string; password: string }>;
};

export function demoExpiryFromNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + DEMO_DURATION_MS);
}

/**
 * Wipes every tenant-scoped row of the demo organization.
 *
 * The delete order is not arbitrary: Postgres refuses to delete a parent row
 * while a child row still references it (default ON DELETE RESTRICT for the
 * required relations in the schema). The tables that carry those RESTRICT
 * foreign keys — `invoices`/`quotes` -> `clients`, `deals` -> `pipeline_stages`
 * and `events`/`workflows`/`plugins`/`api_keys`/`invitations` -> `users` — are
 * therefore removed before their parents.
 *
 * The organization row itself is intentionally kept: the demo login (email,
 * password and organization id) stays stable across resets.
 */
export async function wipeDemoTenant(
  tx: Prisma.TransactionClient,
  organizationId: string,
  /** Accounts that survive the wipe (the demo logins of THIS tenant). */
  keepEmails: string[] = DEMO_ACCOUNTS.map((account) => account.email),
): Promise<void> {
  // RLS: bind the tenant session variable so the deletes below are visible
  // to (and allowed by) the tenant_isolation policies of the runtime role.
  await tx.$executeRawUnsafe(`SELECT set_config('app.organization_id', $1, true)`, organizationId);

  await tx.invoice.deleteMany({ where: { organizationId } });
  await tx.quote.deleteMany({ where: { organizationId } });
  await tx.deal.deleteMany({ where: { organizationId } });
  await tx.task.deleteMany({ where: { organizationId } });
  await tx.event.deleteMany({ where: { organizationId } });
  await tx.activityLog.deleteMany({ where: { organizationId } });
  await tx.auditLog.deleteMany({ where: { organizationId } });
  await tx.notification.deleteMany({ where: { organizationId } });
  await tx.searchIndex.deleteMany({ where: { organizationId } });
  await tx.dashboardProjection.deleteMany({ where: { organizationId } });
  await tx.usageRecord.deleteMany({ where: { organizationId } });
  await tx.apiKey.deleteMany({ where: { organizationId } });
  await tx.plugin.deleteMany({ where: { organizationId } });
  await tx.invitation.deleteMany({ where: { organizationId } });
  await tx.workflowExecutionLog.deleteMany({ where: { organizationId } });
  await tx.workflow.deleteMany({ where: { organizationId } });
  await tx.agentExecution.deleteMany({ where: { organizationId } });
  await tx.agentSubscription.deleteMany({ where: { organizationId } });
  await tx.automationSubscription.deleteMany({ where: { organizationId } });
  await tx.stockMovement.deleteMany({ where: { organizationId } });
  await tx.product.deleteMany({ where: { organizationId } });
  await tx.category.deleteMany({ where: { organizationId } });
  await tx.organizationFeatureOverride.deleteMany({ where: { organizationId } });
  await tx.subscription.deleteMany({ where: { organizationId } });
  await tx.otpCode.deleteMany({ where: { organizationId } });
  await tx.whatsappProcessedMessage.deleteMany({ where: { organizationId } });
  await tx.client.deleteMany({ where: { organizationId } });
  await tx.pipelineStage.deleteMany({ where: { organizationId } });

  // Extra accounts created by a prospect during the demo are removed so the
  // next one starts from the exact same three logins.
  await tx.user.deleteMany({
    where: {
      organizationId,
      email: { notIn: keepEmails },
    },
  });
}

/**
 * Seeds (or re-seeds) the demo tenant inside an existing transaction.
 */
export async function seedDemoTenantTx(
  tx: Prisma.TransactionClient,
  options: DemoFixtureOptions = {},
): Promise<DemoFixtureResult> {
  const slug = options.slug ?? DEMO_ORG_SLUG;
  const name = options.name ?? DEMO_ORG_NAME;
  const plan = options.plan ?? 'pro';
  const isDemo = options.isDemo ?? true;
  const demoExpiresAt =
    options.demoExpiresAt === undefined ? demoExpiryFromNow() : options.demoExpiresAt;
  // A per-prospect demo seeds its own accounts (the prospect's own email);
  // the shared demo keeps the three public logins.
  const accounts = options.accounts ?? DEMO_ACCOUNTS;

  // The fixture uses FIXED primary keys ("seed-client-ecopack", ...). Those
  // keys are global, so two demo tenants would collide on them: the second
  // seed would find the rows of the first one and silently reuse them
  // (the new tenant would end up empty).
  //
  // Every tenant OTHER than the shared one therefore gets its own namespace
  // prefix, so the very same fixture can seed as many isolated demos as the
  // sales team needs.
  const tenantKey =
    slug === DEMO_ORG_SLUG
      ? ''
      : `${slug
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40)}--`;
  const ns = (id: string): string =>
    tenantKey && id.startsWith('seed-') ? `${tenantKey}${id}` : id;

  // The demo tenant is always "already set up": the prospect must land
  // straight on the dashboard with data, never on the onboarding wizard.
  const onboardingCompletedAt = new Date();

  const org = await tx.organization.upsert({
    where: { slug },
    update: { name, plan, isDemo, demoExpiresAt, onboardingCompletedAt },
    create: { name, slug, plan, isDemo, demoExpiresAt, onboardingCompletedAt },
  });

  // RLS: the tenant session variable has to be bound before any tenant-scoped
  // insert, otherwise the WITH CHECK policies of the runtime role reject it.
  await tx.$executeRawUnsafe(`SELECT set_config('app.organization_id', $1, true)`, org.id);

  const passwordHashes = await Promise.all(
    accounts.map((account) => bcrypt.hash(account.password, 12)),
  );

  const seededUsers = new Map<string, { id: string }>();
  for (const [index, account] of accounts.entries()) {
    const passwordHash = must(passwordHashes[index], `hash de ${account.email} ausente`);

    // The demo emails are public, so one of them may belong to a real
    // customer account. Re-seeding must never move that account into the
    // demo tenant: fail loudly instead.
    const existingAccount = await tx.user.findUnique({
      where: { email: account.email },
      select: { id: true, organizationId: true },
    });
    if (existingAccount && existingAccount.organizationId !== org.id) {
      throw new Error(
        `Demo fixture: la cuenta ${account.email} ya existe en otra organización. ` +
          'Cambiá el email del demo antes de correr el seed.',
      );
    }

    const user = await tx.user.upsert({
      where: { email: account.email },
      update: {
        passwordHash,
        firstName: account.firstName,
        lastName: account.lastName,
        role: account.role,
        organizationId: org.id,
        isActive: true,
        emailVerifiedAt: new Date(),
        refreshToken: null,
      },
      create: {
        id: account.id,
        email: account.email,
        passwordHash,
        firstName: account.firstName,
        lastName: account.lastName,
        role: account.role,
        organizationId: org.id,
        emailVerifiedAt: new Date(),
      },
    });
    seededUsers.set(account.email, user);
  }

  // The fixture assigns the seeded records to two "people": the owner (who
  // creates the opportunities) and a second member (who follows up). They are
  // resolved by ROLE, not by a hardcoded email, so a per-prospect demo with
  // its own accounts works the same way.
  const ownerAccount = accounts.find((account) => account.role === 'OWNER');
  const secondAccount = accounts.find((account) => account.id !== ownerAccount?.id);

  const admin = must(
    ownerAccount && seededUsers.get(ownerAccount.email),
    'cuenta owner del demo ausente',
  );
  const maria = must(
    secondAccount && seededUsers.get(secondAccount.email),
    'cuenta secundaria del demo ausente',
  );

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
    const stage = await tx.pipelineStage.upsert({
      where: { organizationId_position: { organizationId: org.id, position: s.position } },
      update: {},
      create: { ...s, organizationId: org.id },
    });
    stageIds[s.name] = stage.id;
  }

  const stageId = (name: string): string => must(stageIds[name], `etapa "${name}" ausente`);

  const clientsData = [
    {
      id: ns('seed-client-techcorp'),
      companyName: 'TechCorp S.A.',
      contactName: 'Juan Pérez',
      email: 'juan@techcorp.com',
      phone: '+54 11 5555-0101',
      address: 'Av. Corrientes 1234, CABA',
      tags: ['tech', 'prioritario'],
    },
    {
      id: ns('seed-client-globalsoft'),
      companyName: 'GlobalSoft Argentina',
      contactName: 'Laura Martínez',
      email: 'laura@globalsoft.com.ar',
      phone: '+54 11 5555-0202',
      address: 'Leandro Alem 850, CABA',
      tags: ['software', 'outsourcing'],
    },
    {
      id: ns('seed-client-muebles'),
      companyName: 'Muebles del Sur',
      contactName: 'Carlos Rodríguez',
      email: 'carlos@mueblessur.com',
      phone: '+54 291 5555-0303',
      address: 'Av. Alem 500, Bahía Blanca',
      tags: ['manufactura', 'pyme'],
    },
    {
      id: ns('seed-client-freshfoods'),
      companyName: 'FreshFoods Distribuidora',
      contactName: 'Ana Gómez',
      email: 'ana@freshfoods.com.ar',
      phone: '+54 341 5555-0404',
      address: 'Bv. Oroño 1200, Rosario',
      tags: ['alimentos', 'logística'],
    },
    {
      id: ns('seed-client-clinica'),
      companyName: 'Clínica del Plata',
      contactName: 'Dr. Roberto Fernández',
      email: 'rfernandez@clinicadelplata.com',
      phone: '+54 221 5555-0505',
      address: 'Calle 50 789, La Plata',
      tags: ['salud', 'privado'],
    },
    {
      id: ns('seed-client-horizonte'),
      companyName: 'Constructora Horizonte',
      contactName: 'Martín Díaz',
      email: 'mdiaz@horizonteconstruye.com',
      phone: '+54 351 5555-0606',
      address: 'Av. Colón 300, Córdoba',
      tags: ['construcción', 'inmobiliario'],
    },
    {
      id: ns('seed-client-bluewave'),
      companyName: 'BlueWave Consulting',
      contactName: 'Sofía López',
      email: 'sofia@bluewaveconsulting.com',
      phone: '+54 11 5555-0707',
      address: 'Av. del Libertador 2500, CABA',
      tags: ['consultoría', 'fintech'],
    },
    {
      id: ns('seed-client-ecopack'),
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
    const client = await tx.client.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, organizationId: org.id },
    });
    clientMap[c.id] = client;
  }

  const seededClientId = (id: string): string => must(clientMap[id]?.id, `cliente "${id}" ausente`);

  const pastMonth = new Date();
  pastMonth.setMonth(pastMonth.getMonth() - 1);

  const daysBefore = (n: number) => new Date(Date.now() - n * 86400000);

  const dealsData = [
    {
      id: ns('seed-deal-lead-1'),
      title: 'Implementación CRM Premium',
      value: 15000,
      probability: 20,
      stageName: 'Lead',
      clientId: ns('seed-client-techcorp'),
      assignedTo: admin.id,
      position: 0,
    },
    {
      id: ns('seed-deal-lead-2'),
      title: 'Consultoría de Digitalización',
      value: 8500,
      probability: 15,
      stageName: 'Lead',
      clientId: ns('seed-client-globalsoft'),
      assignedTo: maria.id,
      position: 1,
    },
    {
      id: ns('seed-deal-contact-1'),
      title: 'ERP + CRM Integrado',
      value: 12000,
      probability: 25,
      stageName: 'Contactado',
      clientId: ns('seed-client-muebles'),
      assignedTo: admin.id,
      position: 0,
    },
    {
      id: ns('seed-deal-contact-2'),
      title: 'Plataforma Gestión de Pedidos',
      value: 22000,
      probability: 30,
      stageName: 'Contactado',
      clientId: ns('seed-client-freshfoods'),
      assignedTo: maria.id,
      position: 0,
    },
    {
      id: ns('seed-deal-meeting-1'),
      title: 'Sistema de Gestión de Pacientes',
      value: 45000,
      probability: 40,
      stageName: 'Reunión',
      clientId: ns('seed-client-clinica'),
      assignedTo: admin.id,
      position: 0,
    },
    {
      id: ns('seed-deal-proposal-1'),
      title: 'Software de Gestión de Obras',
      value: 35000,
      probability: 60,
      stageName: 'Propuesta',
      clientId: ns('seed-client-horizonte'),
      assignedTo: maria.id,
      position: 0,
    },
    {
      id: ns('seed-deal-nego-1'),
      title: 'Suite de Consultoría Financiera',
      value: 18000,
      probability: 75,
      stageName: 'Negociación',
      clientId: ns('seed-client-bluewave'),
      assignedTo: admin.id,
      position: 0,
    },
    {
      id: ns('seed-deal-won-1'),
      title: 'Sistema de Gestión Sustentable',
      value: 28500,
      probability: 100,
      stageName: 'Ganado',
      clientId: ns('seed-client-ecopack'),
      assignedTo: admin.id,
      closeDate: pastMonth,
      position: 0,
    },
    {
      // Closed ~135 days ago (June): gives the "últimos 6 meses" sales trend
      // a real history instead of a single spike in the current month.
      id: ns('seed-deal-won-2'),
      title: 'Migración de CRM legacy',
      value: 9000,
      probability: 100,
      stageName: 'Ganado',
      clientId: ns('seed-client-globalsoft'),
      assignedTo: maria.id,
      closeDate: daysBefore(135),
      position: 1,
      closedDaysAgo: 135,
    },
    {
      // Closed ~105 days ago (July).
      id: ns('seed-deal-won-3'),
      title: 'Portal de autogestión de pacientes',
      value: 6500,
      probability: 100,
      stageName: 'Ganado',
      clientId: ns('seed-client-clinica'),
      assignedTo: admin.id,
      closeDate: daysBefore(105),
      position: 2,
      closedDaysAgo: 105,
    },
    {
      // Closed ~70 days ago (August).
      id: ns('seed-deal-won-4'),
      title: 'Suite deDatos y BI',
      value: 15500,
      probability: 100,
      stageName: 'Ganado',
      clientId: ns('seed-client-freshfoods'),
      assignedTo: maria.id,
      closeDate: daysBefore(70),
      position: 3,
      closedDaysAgo: 70,
    },
    {
      // Closed ~20 days ago (October).
      id: ns('seed-deal-won-5'),
      title: 'Automatización de ventas',
      value: 12000,
      probability: 100,
      stageName: 'Ganado',
      clientId: ns('seed-client-techcorp'),
      assignedTo: admin.id,
      closeDate: daysBefore(20),
      position: 4,
      closedDaysAgo: 20,
    },
    {
      id: ns('seed-deal-lost-1'),
      title: 'Plataforma de Data Analytics',
      value: 9500,
      probability: 0,
      stageName: 'Perdido',
      clientId: ns('seed-client-globalsoft'),
      assignedTo: maria.id,
      lostReason: 'Presupuesto insuficiente',
      position: 0,
    },
  ];

  const dealMap: Record<string, { id: string }> = {};
  for (const d of dealsData) {
    const { stageName, closedDaysAgo, ...dealFields } = d as typeof d & {
      closedDaysAgo?: number;
    };
    const deal = await tx.deal.upsert({
      where: { id: d.id },
      update: {},
      create: {
        ...dealFields,
        currency: 'USD',
        organizationId: org.id,
        stageId: stageId(stageName),
      },
    });
    dealMap[d.id] = deal;

    // `updatedAt` is an @updatedAt column: Prisma always writes "now" on
    // create, so the historical close date has to be applied with raw SQL.
    // The sales-trend endpoint reads `updatedAt` to bucket the revenue by
    // month — without this the whole history would land on the current month.
    if (closedDaysAgo) {
      const closedAt = daysBefore(closedDaysAgo);
      await tx.$executeRawUnsafe(
        `UPDATE "public"."deals"
            SET "createdAt" = $2, "updatedAt" = $2
          WHERE "id" = $1 AND "organizationId" = $3`,
        d.id,
        closedAt,
        org.id,
      );
    }
  }

  const seededDealId = (id: string): string => must(dealMap[id]?.id, `oportunidad "${id}" ausente`);

  const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

  const tasksData: Array<{
    id: string;
    title: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate: Date;
    completedAt?: Date;
    createdById: string;
    assignedTo: string;
    clientId?: string;
    dealId?: string;
  }> = [
    {
      id: ns('seed-task-1'),
      title: 'Preparar propuesta comercial para Horizonte',
      priority: 'HIGH',
      status: 'PENDING',
      dueDate: daysFromNow(3),
      createdById: admin.id,
      assignedTo: admin.id,
      clientId: ns('seed-client-horizonte'),
      dealId: ns('seed-deal-proposal-1'),
    },
    {
      id: ns('seed-task-2'),
      title: 'Enviar documentación a FreshFoods',
      priority: 'MEDIUM',
      status: 'PENDING',
      dueDate: daysFromNow(7),
      createdById: admin.id,
      assignedTo: maria.id,
      clientId: ns('seed-client-freshfoods'),
    },
    {
      id: ns('seed-task-3'),
      title: 'Seguimiento llamada Clínica del Plata',
      priority: 'URGENT',
      status: 'PENDING',
      dueDate: daysFromNow(1),
      createdById: maria.id,
      assignedTo: admin.id,
      clientId: ns('seed-client-clinica'),
    },
    {
      id: ns('seed-task-4'),
      title: 'Revisar contrato con BlueWave Consulting',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: daysFromNow(5),
      createdById: admin.id,
      assignedTo: admin.id,
      dealId: ns('seed-deal-nego-1'),
    },
    {
      id: ns('seed-task-5'),
      title: 'Llamada inicial con EcoPack Sustentable',
      priority: 'MEDIUM',
      status: 'COMPLETED',
      dueDate: daysAgo(10),
      completedAt: daysAgo(5),
      createdById: admin.id,
      assignedTo: admin.id,
      clientId: ns('seed-client-ecopack'),
    },
    {
      id: ns('seed-task-6'),
      title: 'Demo CRM con Muebles del Sur',
      priority: 'HIGH',
      status: 'COMPLETED',
      dueDate: daysAgo(7),
      completedAt: daysAgo(3),
      createdById: maria.id,
      assignedTo: maria.id,
      clientId: ns('seed-client-muebles'),
      dealId: ns('seed-deal-contact-1'),
    },
  ];

  for (const t of tasksData) {
    await tx.task.upsert({
      where: { id: t.id },
      update: {},
      create: { ...t, organizationId: org.id },
    });
  }

  // --- Calendar ---
  // The events are spread around "today" so the calendar view shows a real
  // agenda instead of an empty month.
  const atHour = (base: Date, hour: number, minutes = 0) => {
    const d = new Date(base);
    d.setHours(hour, minutes, 0, 0);
    return d;
  };

  const eventsData = [
    {
      id: ns('seed-event-1'),
      title: 'Reunión de avance - TechCorp S.A.',
      type: 'MEETING' as const,
      startDate: atHour(daysFromNow(1), 10, 0),
      endDate: atHour(daysFromNow(1), 11, 0),
      location: 'Sala de reuniones · Office',
      clientId: ns('seed-client-techcorp'),
      createdById: admin.id,
    },
    {
      id: ns('seed-event-2'),
      title: 'Demo del CRM - GlobalSoft Argentina',
      description: 'Presentamos la propuesta Enterprise y el plan de despliegue.',
      type: 'MEETING' as const,
      startDate: atHour(daysFromNow(2), 15, 30),
      endDate: atHour(daysFromNow(2), 16, 30),
      location: 'Google Meet',
      clientId: ns('seed-client-globalsoft'),
      createdById: maria.id,
    },
    {
      id: ns('seed-event-3'),
      title: 'Llamada de seguimiento - EcoPack Sustentable',
      type: 'CALL' as const,
      startDate: atHour(daysAgo(1), 9, 0),
      endDate: atHour(daysAgo(1), 9, 30),
      clientId: ns('seed-client-ecopack'),
      createdById: admin.id,
    },
    {
      id: ns('seed-event-4'),
      title: 'Revisión de pipeline - equipo comercial',
      description: 'Revisamos oportunidades estancadas y forecast del trimestre.',
      type: 'TASK' as const,
      startDate: atHour(daysFromNow(4), 9, 0),
      endDate: atHour(daysFromNow(4), 10, 0),
      createdById: admin.id,
    },
    {
      id: ns('seed-event-5'),
      title: 'Entrega de propuesta - Horizonte',
      type: 'REMINDER' as const,
      startDate: atHour(daysFromNow(3), 11, 0),
      endDate: atHour(daysFromNow(3), 11, 30),
      dealId: ns('seed-deal-proposal-1'),
      createdById: maria.id,
    },
    {
      id: ns('seed-event-6'),
      title: 'Capacitación: uso de CRM',
      type: 'OTHER' as const,
      startDate: atHour(daysFromNow(7), 14, 0),
      endDate: atHour(daysFromNow(7), 16, 0),
      allDay: false,
      createdById: admin.id,
    },
  ];

  for (const e of eventsData) {
    await tx.event.upsert({
      where: { id: e.id },
      update: {},
      create: { ...e, organizationId: org.id },
    });
  }

  const getNextQuoteNumber = async (): Promise<string> => {
    const result = await tx.$queryRawUnsafe<{ nextval: bigint }[]>(
      "SELECT nextval('quote_number_seq') as nextval",
    );
    const row = must(result[0], 'secuencia de números de presupuesto vacía');
    const num = Number(row.nextval);
    return `Q-${String(num).padStart(6, '0')}`;
  };

  const draftQuoteNumber = await getNextQuoteNumber();
  await tx.quote.upsert({
    where: { id: ns('seed-quote-draft') },
    update: {},
    create: {
      id: ns('seed-quote-draft'),
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
      clientId: seededClientId(ns('seed-client-techcorp')),
      createdById: admin.id,
    },
  });

  const sentQuoteNumber = await getNextQuoteNumber();
  await tx.quote.upsert({
    where: { id: ns('seed-quote-sent') },
    update: {},
    create: {
      id: ns('seed-quote-sent'),
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
      clientId: seededClientId(ns('seed-client-globalsoft')),
      dealId: seededDealId(ns('seed-deal-lead-2')),
      createdById: admin.id,
    },
  });

  const acceptedQuoteNumber = await getNextQuoteNumber();
  await tx.quote.upsert({
    where: { id: ns('seed-quote-accepted') },
    update: {},
    create: {
      id: ns('seed-quote-accepted'),
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
      clientId: seededClientId(ns('seed-client-muebles')),
      dealId: seededDealId(ns('seed-deal-contact-1')),
      createdById: maria.id,
    },
  });

  const quoteItems = [
    {
      id: ns('seed-qi-draft-1'),
      description: 'Suscripción CRM Premium - Anual',
      quantity: 1,
      unitPrice: 12000,
      total: 12000,
      quoteId: ns('seed-quote-draft'),
    },
    {
      id: ns('seed-qi-draft-2'),
      description: 'Servicio de Implementación y Configuración',
      quantity: 1,
      unitPrice: 3500,
      total: 3500,
      quoteId: ns('seed-quote-draft'),
    },
    {
      id: ns('seed-qi-sent-1'),
      description: 'Licencia CRM Enterprise - 25 usuarios',
      quantity: 1,
      unitPrice: 18000,
      total: 18000,
      quoteId: ns('seed-quote-sent'),
    },
    {
      id: ns('seed-qi-sent-2'),
      description: 'Módulo de Reporting Avanzado',
      quantity: 1,
      unitPrice: 4500,
      total: 4500,
      quoteId: ns('seed-quote-sent'),
    },
    {
      id: ns('seed-qi-sent-3'),
      description: 'Capacitación inicial (8 horas presenciales)',
      quantity: 1,
      unitPrice: 2400,
      total: 2400,
      quoteId: ns('seed-quote-sent'),
    },
    {
      id: ns('seed-qi-accepted-1'),
      description: 'Suscripción CRM Pro - 10 usuarios',
      quantity: 1,
      unitPrice: 8400,
      total: 8400,
      quoteId: ns('seed-quote-accepted'),
    },
    {
      id: ns('seed-qi-accepted-2'),
      description: 'Migración de datos desde sistema legacy',
      quantity: 1,
      unitPrice: 2800,
      total: 2800,
      quoteId: ns('seed-quote-accepted'),
    },
  ];

  for (const item of quoteItems) {
    await tx.quoteItem.upsert({
      where: { id: item.id },
      update: {},
      create: item,
    });
  }

  const activitiesData = [
    {
      id: ns('seed-act-1'),
      type: 'CREATED' as const,
      description: 'Nuevo cliente: TechCorp S.A.',
      userId: admin.id,
      clientId: ns('seed-client-techcorp'),
      createdAt: daysAgo(30),
    },
    {
      id: ns('seed-act-2'),
      type: 'DEAL_WON' as const,
      description: 'Deal ganado: Sistema de Gestión Sustentable - $28,500',
      userId: admin.id,
      dealId: ns('seed-deal-won-1'),
      createdAt: daysAgo(25),
    },
    {
      id: ns('seed-act-3'),
      type: 'DEAL_LOST' as const,
      description: 'Deal perdido: Plataforma de Data Analytics - $9,500 (Presupuesto insuficiente)',
      userId: maria.id,
      dealId: ns('seed-deal-lost-1'),
      createdAt: daysAgo(20),
    },
    {
      id: ns('seed-act-4'),
      type: 'QUOTE_GENERATED' as const,
      description: 'Presupuesto enviado: CRM Enterprise - GlobalSoft Argentina - $30,129',
      userId: admin.id,
      clientId: ns('seed-client-globalsoft'),
      createdAt: daysAgo(12),
    },
    {
      id: ns('seed-act-5'),
      type: 'MEETING_SCHEDULED' as const,
      description: 'Reunión agendada con Clínica del Plata para demo de CRM',
      userId: admin.id,
      clientId: ns('seed-client-clinica'),
      createdAt: daysAgo(8),
    },
    {
      id: ns('seed-act-6'),
      type: 'NOTE_ADDED' as const,
      description: 'Nota agregada a oportunidad: Suite Financiera BlueWave',
      userId: admin.id,
      dealId: ns('seed-deal-nego-1'),
      createdAt: daysAgo(5),
    },
    {
      id: ns('seed-act-7'),
      type: 'STATUS_CHANGED' as const,
      description: 'Oportunidad movida a Propuesta: Software de Gestión de Obras',
      userId: maria.id,
      clientId: ns('seed-client-horizonte'),
      createdAt: daysAgo(4),
    },
    {
      id: ns('seed-act-8'),
      type: 'CREATED' as const,
      description: 'Tarea creada: Preparar propuesta comercial para Horizonte',
      userId: admin.id,
      taskId: ns('seed-task-1'),
      createdAt: daysAgo(3),
    },
    {
      id: ns('seed-act-9'),
      type: 'EMAIL_SENT' as const,
      description: 'Email enviado a FreshFoods con documentación adjunta',
      userId: maria.id,
      clientId: ns('seed-client-freshfoods'),
      createdAt: daysAgo(2),
    },
    {
      id: ns('seed-act-10'),
      type: 'CALL_MADE' as const,
      description: 'Llamada de seguimiento con Juan Pérez (TechCorp)',
      userId: admin.id,
      clientId: ns('seed-client-techcorp'),
      createdAt: daysAgo(1),
    },
    {
      id: ns('seed-act-11'),
      type: 'CREATED' as const,
      description: 'Nuevo cliente: BlueWave Consulting',
      userId: admin.id,
      clientId: ns('seed-client-bluewave'),
      createdAt: daysAgo(15),
    },
    {
      id: ns('seed-act-12'),
      type: 'CREATED' as const,
      description: 'Nuevo cliente: EcoPack Sustentable',
      userId: admin.id,
      clientId: ns('seed-client-ecopack'),
      createdAt: daysAgo(35),
    },
  ];

  for (const a of activitiesData) {
    await tx.activityLog.upsert({
      where: { id: a.id },
      update: {},
      create: { ...a, organizationId: org.id, createdAt: a.createdAt },
    });
  }

  await tx.dashboardProjection.upsert({
    where: { organizationId: org.id },
    update: {
      monthlySales: 28500,
      newClients: 3,
      openOpportunities: 7,
      pendingTasks: 4,
      // `wonDeals` is a Prisma `Json` column: the value must be the ARRAY
      // itself. JSON.stringify() would store a JSON *string* and the API
      // would render an empty "deals ganados" list.
      // The shape mirrors the API response (`client` / `stage` / `assignee`
      // are objects), so the dashboard can render it as a fallback.
      wonDeals: [
        {
          id: ns('seed-deal-won-1'),
          title: 'Sistema de Gestión Sustentable',
          value: 28500,
          date: daysAgo(25).toISOString(),
          client: { companyName: 'EcoPack Sustentable' },
          stage: { name: 'Ganado' },
          assignee: { firstName: 'Admin', lastName: 'Nexa' },
        },
      ],
    },
    create: {
      organizationId: org.id,
      monthlySales: 28500,
      newClients: 3,
      openOpportunities: 7,
      pendingTasks: 4,
      wonDeals: [
        {
          id: ns('seed-deal-won-1'),
          title: 'Sistema de Gestión Sustentable',
          value: 28500,
          date: daysAgo(25).toISOString(),
          client: { companyName: 'EcoPack Sustentable' },
          stage: { name: 'Ganado' },
          assignee: { firstName: 'Admin', lastName: 'Nexa' },
        },
      ],
    },
  });

  const notificationsData = [
    {
      id: ns('seed-notif-1'),
      type: 'deal_won',
      title: 'Deal ganado! 🎉',
      message: 'EcoPack Sustentable aceptó propuesta por $28,500',
      link: '/pipeline',
      // Org-wide (userId = null) so every demo account sees it in the bell —
      // the notifications endpoint filters `userId = me OR userId IS NULL`.
      userId: null,
      createdAt: daysAgo(25),
    },
    {
      id: ns('seed-notif-2'),
      type: 'task_due',
      title: 'Tarea urgente vence mañana',
      message: 'Seguimiento llamada Clínica del Plata',
      link: '/tasks',
      userId: null,
      createdAt: daysAgo(1),
    },
    {
      id: ns('seed-notif-3'),
      type: 'quote_sent',
      title: 'Presupuesto enviado',
      message: 'CRM Enterprise - GlobalSoft Argentina por $30,129',
      link: '/quotes',
      userId: null,
      createdAt: daysAgo(12),
    },
    {
      id: ns('seed-notif-4'),
      type: 'new_client',
      title: 'Nuevo cliente registrado',
      message: 'BlueWave Consulting',
      link: '/clients',
      userId: null,
      createdAt: daysAgo(15),
    },
    {
      id: ns('seed-notif-5'),
      type: 'deal_stale',
      title: 'Oportunidad estancada',
      message: 'ERP + CRM Integrado - Muebles del Sur lleva 20+ días sin actividad',
      link: '/pipeline',
      userId: null,
      createdAt: daysAgo(1),
    },
    {
      id: ns('seed-notif-6'),
      type: 'welcome',
      title: 'Bienvenido a Nexa CRM!',
      message: 'Completa tu perfil y explora el panel de control',
      link: '/dashboard',
      userId: null,
      createdAt: daysAgo(45),
    },
  ];

  for (const n of notificationsData) {
    await tx.notification.upsert({
      where: { id: n.id },
      update: { userId: n.userId },
      create: { ...n, organizationId: org.id, createdAt: n.createdAt },
    });
  }

  const searchIndexData = [
    {
      id: ns('seed-si-client-1'),
      entityType: 'client',
      entityId: ns('seed-client-techcorp'),
      title: 'TechCorp S.A.',
      content: 'TechCorp S.A. Juan Pérez juan@techcorp.com +54 11 5555-0101',
    },
    {
      id: ns('seed-si-client-2'),
      entityType: 'client',
      entityId: ns('seed-client-globalsoft'),
      title: 'GlobalSoft Argentina',
      content: 'GlobalSoft Argentina Laura Martínez laura@globalsoft.com.ar +54 11 5555-0202',
    },
    {
      id: ns('seed-si-client-3'),
      entityType: 'client',
      entityId: ns('seed-client-muebles'),
      title: 'Muebles del Sur',
      content: 'Muebles del Sur Carlos Rodríguez carlos@mueblessur.com +54 291 5555-0303',
    },
    {
      id: ns('seed-si-client-4'),
      entityType: 'client',
      entityId: ns('seed-client-clinica'),
      title: 'Clínica del Plata',
      content:
        'Clínica del Plata Dr. Roberto Fernández rfernandez@clinicadelplata.com +54 221 5555-0505',
    },
    {
      id: ns('seed-si-deal-1'),
      entityType: 'deal',
      entityId: ns('seed-deal-nego-1'),
      title: 'Suite de Consultoría Financiera',
      content: 'Suite de Consultoría Financiera BlueWave Consulting $18,000 Negociación',
    },
    {
      id: ns('seed-si-deal-2'),
      entityType: 'deal',
      entityId: ns('seed-deal-proposal-1'),
      title: 'Software de Gestión de Obras',
      content: 'Software de Gestión de Obras Constructora Horizonte $35,000 Propuesta',
    },
    {
      id: ns('seed-si-task-1'),
      entityType: 'task',
      entityId: ns('seed-task-1'),
      title: 'Preparar propuesta comercial para Horizonte',
      content: 'Preparar propuesta comercial para Horizonte HIGH PENDING',
    },
    {
      id: ns('seed-si-task-3'),
      entityType: 'task',
      entityId: ns('seed-task-3'),
      title: 'Seguimiento llamada Clínica del Plata',
      content: 'Seguimiento llamada Clínica del Plata URGENT PENDING',
    },
  ];

  for (const si of searchIndexData) {
    await tx.searchIndex.upsert({
      where: { id: si.id },
      update: {},
      create: { ...si, organizationId: org.id },
    });
  }

  const oldQuoteNumber = await getNextQuoteNumber();
  await tx.quote.upsert({
    where: { id: ns('seed-quote-old-sent') },
    update: {},
    create: {
      id: ns('seed-quote-old-sent'),
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
      clientId: seededClientId(ns('seed-client-clinica')),
      dealId: seededDealId(ns('seed-deal-meeting-1')),
      createdById: admin.id,
    },
  });

  await tx.quoteItem.upsert({
    where: { id: ns('seed-qi-old-1') },
    update: {},
    create: {
      id: ns('seed-qi-old-1'),
      description: 'Suscripción CRM Premium - 15 usuarios - Anual',
      quantity: 1,
      unitPrice: 18000,
      total: 18000,
      quoteId: ns('seed-quote-old-sent'),
    },
  });

  await tx.quoteItem.upsert({
    where: { id: ns('seed-qi-old-2') },
    update: {},
    create: {
      id: ns('seed-qi-old-2'),
      description: 'Módulo de Historias Clínicas Digitales',
      quantity: 1,
      unitPrice: 4000,
      total: 4000,
      quoteId: ns('seed-quote-old-sent'),
    },
  });

  await tx.deal.update({
    where: { id: ns('seed-deal-contact-1') },
    data: { updatedAt: daysAgo(22) },
  });
  await tx.deal.update({
    where: { id: ns('seed-deal-meeting-1') },
    data: { updatedAt: daysAgo(15) },
  });

  await tx.task.update({
    where: { id: ns('seed-task-2') },
    data: { dueDate: daysAgo(3), status: 'PENDING' },
  });

  await tx.agent.upsert({
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

  await tx.agent.upsert({
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

  await tx.agent.upsert({
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
        'lead_qualification',
        'auto_reply',
        'meeting_scheduling',
        'sentiment_analysis',
      ],
      isActive: true,
    },
  });

  return {
    organizationId: org.id,
    slug: org.slug,
    name: org.name,
    plan: org.plan,
    isDemo: org.isDemo,
    demoExpiresAt: org.demoExpiresAt,
    accounts: accounts.map((account) => ({
      id: account.id,
      email: account.email,
      password: account.password,
    })),
  };
}

/**
 * Seeds the demo tenant in its own transaction.
 */
export async function seedDemoTenant(
  client: PrismaClient,
  options: DemoFixtureOptions = {},
): Promise<DemoFixtureResult> {
  return client.$transaction((tx) => seedDemoTenantTx(tx, options), {
    timeout: 120_000,
    maxWait: 20_000,
  });
}

/**
 * Wipes the tenant data and re-seeds it from the fixture, opening a brand new
 * demo window. The organization row (and therefore the demo login) survives.
 *
 * Returns null when another process (e.g. a second API replica running the
 * same cron) already holds the reset lock — the reset is then skipped.
 */
export async function resetDemoTenant(
  client: PrismaClient,
  options: DemoFixtureOptions = {},
): Promise<DemoFixtureResult | null> {
  return client.$transaction(
    async (tx) => {
      const slug = options.slug ?? DEMO_ORG_SLUG;
      const existing = await tx.organization.findUnique({ where: { slug } });
      if (!existing) {
        return seedDemoTenantTx(tx, options);
      }

      // A per-prospect demo has its OWN accounts (the prospect's email). The
      // hourly cron resets expired demos without knowing them, so they are
      // read back from the tenant itself: the emails (and the ids) are kept,
      // only the password is rotated (access is through the one-click link,
      // not through a password).
      let effectiveOptions = options;
      if (!options.accounts && slug !== DEMO_ORG_SLUG) {
        const tenantUsers = await tx.user.findMany({
          where: { organizationId: existing.id },
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
          orderBy: { createdAt: 'asc' },
        });

        if (tenantUsers.length > 0) {
          effectiveOptions = {
            ...options,
            accounts: tenantUsers.map((user) => ({
              id: user.id,
              email: user.email,
              password: randomBytes(12).toString('base64url'),
              firstName: user.firstName,
              lastName: user.lastName,
              // The schema also knows SUPER_ADMIN, which is not a valid
              // demo account role: fall back to MEMBER.
              role: (['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(user.role)
                ? user.role
                : 'MEMBER') as DemoAccount['role'],
            })),
          };
        }
      }

      // Postgres advisory lock: the cron runs in every API replica, so two of
      // them could otherwise reset the same tenant at the same time.
      const lockRows = await tx.$queryRawUnsafe<{ locked: boolean }[]>(
        `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked`,
        `nexa:demo:reset:${existing.id}`,
      );
      if (!lockRows[0]?.locked) {
        return null;
      }

      await wipeDemoTenant(
        tx,
        existing.id,
        (effectiveOptions.accounts ?? DEMO_ACCOUNTS).map((account) => account.email),
      );
      return seedDemoTenantTx(tx, effectiveOptions);
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
}
