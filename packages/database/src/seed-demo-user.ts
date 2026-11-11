import { PrismaClient } from '@prisma/client';
import { DEMO_ACCOUNTS, demoExpiryFromNow, resetDemoTenant } from './demo-fixture';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_IN_PROD !== '1') {
    console.warn(
      '⚠️  seed-demo-user.ts crea un usuario demo con credenciales públicas (demo@nexacrm.com / demo123).',
    );
    console.warn('⚠️  Bloqueado en NODE_ENV=production. Para forzar, setear SEED_DEMO_IN_PROD=1.');
    return;
  }

  const demoExpiresAt = demoExpiryFromNow();
  const result = await resetDemoTenant(prisma, {
    isDemo: true,
    demoExpiresAt,
  });

  if (!result) {
    console.warn('⚠️  Otro proceso está reseteando el demo. Reintentá en un momento.');
    return;
  }

  console.log('✅ Demo creado');
  console.log(`  Organización: ${result.name} (${result.slug})`);
  console.log(`  Plan: ${result.plan}`);
  console.log(`  Expira: ${result.demoExpiresAt?.toISOString()}`);
  console.log('');
  console.log('  Credenciales:');
  for (const account of DEMO_ACCOUNTS) {
    console.log(`    ${account.email} / ${account.password}`);
  }
  console.log('');
  console.log('  El acceso se corta exactamente al vencer la fecha de expiración.');
  console.log(
    '  Cuando vence, el cron resetea el tenant a los datos semilla y abre una nueva ventana.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
