import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Field = {
  key: string;
  label: string;
  type: 'text' | 'url' | 'longtext' | 'select';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
};

type SeedTemplate = {
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  icon: string;
  trigger: string;
  plan: 'starter' | 'pro';
  priceCents: number;
  paramSchema: { fields: Field[] };
  defaultConfig: Record<string, unknown>;
  isFeatured: boolean;
};

const TEMPLATES: SeedTemplate[] = [
  {
    slug: 'whatsapp-first-response',
    name: 'Agente WhatsApp — Primer mensaje automático',
    shortDescription:
      'Cuando llega un cliente nuevo, mandale el primer mensaje de WhatsApp desde tu agente.',
    longDescription:
      'Conecta la llegada de un cliente nuevo con tu agente de WhatsApp configurado en n8n. El flujo dispara un POST con el cliente y la organización, y tu agente responde con el primer mensaje plantilla.',
    category: 'Atención al cliente',
    icon: 'MessageCircle',
    trigger: 'client.created',
    plan: 'starter',
    priceCents: 4900,
    paramSchema: {
      fields: [
        {
          key: 'webhookUrl',
          label: 'Webhook URL de tu agente n8n',
          type: 'url',
          required: true,
          placeholder: 'https://n8n.example.com/webhook/whatsapp-agent/...',
          helpText: 'URL del webhook que arranca el flujo conversacional en n8n.',
        },
        {
          key: 'n8n_workflow_url',
          label: 'URL del workflow en n8n',
          type: 'url',
          required: false,
          placeholder: 'https://n8n.example.com/workflow/abcdef',
          helpText: 'Se usa para abrir el workflow original desde el Centro de automatización.',
        },
        {
          key: 'greetingMessage',
          label: 'Mensaje de bienvenida (opcional)',
          type: 'longtext',
          required: false,
          placeholder: '¡Hola {{name}}! Gracias por contactarnos...',
          helpText: 'Texto que se enviará como primer mensaje del agente.',
        },
      ],
    },
    defaultConfig: {},
    isFeatured: true,
  },
  {
    slug: 'whatsapp-quote-notification',
    name: 'Agente WhatsApp — Avisar presupuesto enviado',
    shortDescription: 'Notifica al cliente por WhatsApp cuando le envías un presupuesto.',
    longDescription:
      'Cada vez que se envía un presupuesto, esta automatización dispara un webhook a n8n para que tu agente de WhatsApp confirme al cliente con el número, el monto y el link.',
    category: 'Atención al cliente',
    icon: 'MessageCircle',
    trigger: 'quote.sent',
    plan: 'starter',
    priceCents: 3900,
    paramSchema: {
      fields: [
        {
          key: 'webhookUrl',
          label: 'Webhook URL de tu agente n8n',
          type: 'url',
          required: true,
          placeholder: 'https://n8n.example.com/webhook/quote-notify/...',
        },
      ],
    },
    defaultConfig: {},
    isFeatured: true,
  },
  {
    slug: 'slack-new-deal',
    name: 'Slack — Aviso de oportunidad nueva',
    shortDescription: 'Posteá en Slack cada nueva oportunidad creada en el pipeline.',
    longDescription:
      'Cuando se crea una oportunidad, Nexa hace POST al webhook entrante de Slack (Incoming Webhook). Incluí título, monto, etapa y responsable.',
    category: 'Notificaciones internas',
    icon: 'Bell',
    trigger: 'deal.created',
    plan: 'starter',
    priceCents: 2900,
    paramSchema: {
      fields: [
        {
          key: 'webhookUrl',
          label: 'Slack Incoming Webhook URL',
          type: 'url',
          required: true,
          placeholder: 'https://hooks.slack.com/services/T.../B.../...',
        },
        {
          key: 'channel',
          label: 'Canal',
          type: 'text',
          required: false,
          placeholder: '#ventas',
        },
      ],
    },
    defaultConfig: {},
    isFeatured: false,
  },
  {
    slug: 'mailchimp-new-client',
    name: 'Mailchimp — Suscribir cliente nuevo',
    shortDescription: 'Sumá cada cliente nuevo a tu lista de Mailchimp.',
    longDescription:
      'Cuando se crea un cliente, dispara un webhook a n8n que llama a la API de Mailchimp para agregar el contacto a una lista definida.',
    category: 'Marketing',
    icon: 'Mail',
    trigger: 'client.created',
    plan: 'starter',
    priceCents: 2900,
    paramSchema: {
      fields: [
        {
          key: 'webhookUrl',
          label: 'Webhook URL de n8n (Mailchimp)',
          type: 'url',
          required: true,
          placeholder: 'https://n8n.example.com/webhook/mailchimp/...',
        },
        {
          key: 'listId',
          label: 'Mailchimp List ID',
          type: 'text',
          required: true,
          placeholder: 'abc123def4',
        },
      ],
    },
    defaultConfig: {},
    isFeatured: false,
  },
  {
    slug: 'invoice-finance-alert',
    name: 'Equipo Financiero — Alerta de factura emitida',
    shortDescription: 'Aviso interno al área financiera cuando emitís una factura.',
    longDescription:
      'Cada `invoice.issued` dispara un POST al sistema interno para que Finanzas registre la factura en su planilla o ERP.',
    category: 'Notificaciones internas',
    icon: 'Receipt',
    trigger: 'invoice.issued',
    plan: 'pro',
    priceCents: 6900,
    paramSchema: {
      fields: [
        {
          key: 'webhookUrl',
          label: 'Webhook URL interno',
          type: 'url',
          required: true,
          placeholder: 'https://finanzas.example.com/api/invoices/...',
        },
      ],
    },
    defaultConfig: {},
    isFeatured: false,
  },
  {
    slug: 'task-overdue-reminder',
    name: 'Recordatorio de tareas vencidas',
    shortDescription: 'Cuando una tarea vence, mandale un recordatorio al responsable.',
    longDescription:
      'Al dispararse `task.created`, Nexa adjunta el responsable y la fecha de vencimiento. Tu agente de IA puede mandar el recordatorio en el horario que definas.',
    category: 'Productividad',
    icon: 'Clock',
    trigger: 'task.created',
    plan: 'starter',
    priceCents: 2900,
    paramSchema: {
      fields: [
        {
          key: 'webhookUrl',
          label: 'Webhook URL del agente n8n',
          type: 'url',
          required: true,
          placeholder: 'https://n8n.example.com/webhook/task-reminder/...',
        },
        {
          key: 'reminderHoursBefore',
          label: 'Horas antes del vencimiento',
          type: 'text',
          required: false,
          placeholder: '24',
        },
      ],
    },
    defaultConfig: { reminderHoursBefore: '24' },
    isFeatured: false,
  },
];

async function main() {
  for (const t of TEMPLATES) {
    await prisma.workflowTemplate.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        shortDescription: t.shortDescription,
        longDescription: t.longDescription,
        category: t.category,
        icon: t.icon,
        trigger: t.trigger,
        plan: t.plan,
        priceCents: t.priceCents,
        paramSchema: t.paramSchema as any,
        defaultConfig: t.defaultConfig as any,
        isFeatured: t.isFeatured,
        isPublished: true,
      },
      create: {
        slug: t.slug,
        name: t.name,
        shortDescription: t.shortDescription,
        longDescription: t.longDescription,
        category: t.category,
        icon: t.icon,
        trigger: t.trigger,
        plan: t.plan,
        priceCents: t.priceCents,
        paramSchema: t.paramSchema as any,
        defaultConfig: t.defaultConfig as any,
        isFeatured: t.isFeatured,
        isPublished: true,
      },
    });
  }
  console.log(`Seeded ${TEMPLATES.length} workflow templates.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
