import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const webhookUrls = {
  sales: 'http://localhost:5678/webhook/sales-agent',
  follow_up: 'http://localhost:5678/webhook/followup-agent',
  business_analyst: 'http://localhost:5678/webhook/analyst-agent',
  operations: 'http://localhost:5678/webhook/operations-agent',
};

const workflowUrls = {
  sales: 'http://localhost:5678/workflow/ZZQC7jSpjpeVCs2C',
  follow_up: 'http://localhost:5678/workflow/mWwfl08BcLvYVJg0',
  business_analyst: 'http://localhost:5678/workflow/2sLirkDfJbyjlsRL',
  operations: 'http://localhost:5678/workflow/q3eWPG1FOxHAXHBX',
};

async function main() {
  for (const [type, webhookUrl] of Object.entries(webhookUrls)) {
    const agent = await prisma.agent.findFirst({ where: { type } });
    if (agent) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { webhookUrl, workflowUrl: workflowUrls[type] },
      });
      console.log(`Updated ${type}: webhook=${webhookUrl}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
