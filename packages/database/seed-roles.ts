import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_IN_PROD !== '1') {
    console.warn(
      '⚠️  seed-roles.ts crea usuarios demo con credenciales conocidas. Bloqueado en produccion.',
    );
    return;
  }

  const testOrg = await prisma.organization.findUnique({ where: { slug: 'mi-empresa' } });
  if (!testOrg) {
    console.log('Organization "mi-empresa" not found');
    return;
  }

  const users = [
    {
      email: 'member@nexacrm.com',
      firstName: 'Maria',
      lastName: 'Garcia',
      role: 'MEMBER',
      password: 'Member123!',
    },
    {
      email: 'viewer@nexacrm.com',
      firstName: 'Carlos',
      lastName: 'Lopez',
      role: 'VIEWER',
      password: 'Viewer123!',
    },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`${u.email} already exists (role: ${existing.role}), skipping...`);
      continue;
    }
    await prisma.user.create({
      data: {
        email: u.email,
        passwordHash: hashSync(u.password, 10),
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role as any,
        organizationId: testOrg.id,
      },
    });
    console.log(`Created: ${u.email} | role: ${u.role} | password: ${u.password}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
