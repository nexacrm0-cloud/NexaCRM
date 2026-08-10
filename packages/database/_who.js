const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const inv = await p.invitation.findMany({ where: { email: 'nexacrm0@gmail.com' } });
  console.log('invitations:', JSON.stringify(inv, null, 2));
  const u = await p.user.findUnique({ where: { email: 'nexacrm0@gmail.com' } });
  console.log('user:', u);
  await p.$disconnect();
})();
