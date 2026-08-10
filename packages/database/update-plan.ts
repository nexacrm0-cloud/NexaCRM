import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.organization.update({ where: { slug: 'mi-empresa' }, data: { plan: 'pro' } });
  const org = await prisma.organization.findUnique({
    where: { slug: 'mi-empresa' },
    select: { plan: true },
  });
  console.log('Plan set to:', org?.plan);
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
