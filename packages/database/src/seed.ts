import { PrismaClient } from '@prisma/client';
import { DEMO_ACCOUNTS, seedDemoTenant } from './demo-fixture';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_IN_PROD !== '1') {
    console.warn(
      '⚠️  seed.ts crea datos demo con credenciales conocidas (demo@nexacrm.com / demo123, admin@nexacrm.com / admin123, maria@nexacrm.com / maria123).',
    );
    console.warn('⚠️  Bloqueado en NODE_ENV=production. Para forzar, setear SEED_DEMO_IN_PROD=1.');
    return;
  }

  // The development seed is NOT a demo tenant: local developers keep access
  // forever. Use `pnpm db:seed:demo-user` to create the time-boxed sales demo.
  const result = await seedDemoTenant(prisma, { isDemo: false, demoExpiresAt: null });

  const [
    userCount,
    clientCount,
    dealCount,
    taskCount,
    quoteCount,
    activityCount,
    notificationCount,
  ] = await Promise.all([
    prisma.user.count({ where: { organizationId: result.organizationId } }),
    prisma.client.count({ where: { organizationId: result.organizationId } }),
    prisma.deal.count({ where: { organizationId: result.organizationId } }),
    prisma.task.count({ where: { organizationId: result.organizationId } }),
    prisma.quote.count({ where: { organizationId: result.organizationId } }),
    prisma.activityLog.count({ where: { organizationId: result.organizationId } }),
    prisma.notification.count({ where: { organizationId: result.organizationId } }),
  ]);

  console.log('Seed completed successfully');
  console.log(`  Organization: ${result.name} (${result.slug})`);
  console.log(
    `  Users: ${userCount} (${DEMO_ACCOUNTS.map((a) => `${a.email} / ${a.password}`).join(', ')})`,
  );
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
