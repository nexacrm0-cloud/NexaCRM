const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ORG_ID = 'cmqyf39c5000048dsxtw8sma6';

async function main() {
  await prisma.deal.deleteMany({
    where: {
      organizationId: ORG_ID,
      NOT: [{ title: 'Oportunidad - Vera Shoes' }, { title: 'Venta-Vera Shoes' }, { title: 'a' }],
    },
  });
  await prisma.task.deleteMany({ where: { organizationId: ORG_ID } });
  await prisma.quote.deleteMany({
    where: { organizationId: ORG_ID, number: { startsWith: 'COT-3' } },
  });
  await prisma.invoice.deleteMany({
    where: { organizationId: ORG_ID, number: { startsWith: 'INV-2' } },
  });
  await prisma.agentExecution.deleteMany({ where: { organizationId: ORG_ID } });
  console.log('Deleted all seeded data');
  console.log('Deals remain: ' + (await prisma.deal.count({ where: { organizationId: ORG_ID } })));
  console.log('Tasks remain: ' + (await prisma.task.count({ where: { organizationId: ORG_ID } })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
