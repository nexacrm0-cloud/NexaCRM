import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_IN_PROD !== '1') {
    console.warn(
      '⚠️  seed-support.ts crea un SUPER_ADMIN con credencial conocida. Bloqueado en produccion.',
    );
    return;
  }

  let org = await prisma.organization.findUnique({ where: { slug: 'nexa-support' } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'Nexa Support', slug: 'nexa-support', plan: 'enterprise' },
    });
  }

  const existing = await prisma.user.findUnique({ where: { email: 'soporte@nexacrm.com' } });
  if (existing) {
    console.log('User already exists:', existing.email, '| role:', existing.role);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: 'soporte@nexacrm.com',
      passwordHash: hashSync('Soporte123!', 10),
      firstName: 'Soporte',
      lastName: 'Nexa',
      role: 'SUPER_ADMIN',
      organizationId: org.id,
    },
  });

  console.log('Created support user:', user.email, '| role:', user.role);
  console.log('Org ID:', org.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
