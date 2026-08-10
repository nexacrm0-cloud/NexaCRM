import { whatsappWebhookSchema } from '@nexa/shared';

// Unit tests for the WhatsApp webhook Zod schema (Meta Cloud API shape).
// These run without a DB or Redis — they only exercise the schema, which is
// the contract Meta signs. Adding a regression here catches a future schema
// drift (e.g. someone loosening `object: z.literal('whatsapp_business_account')`
// to `z.string()`) before the webhook starts accepting forged events.

const validTextMessage = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123456789',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              phone_number_id: '12345',
              display_phone_number: '15550175508',
            },
            contacts: [{ profile: { name: 'John Doe' }, wa_id: '5491133221100' }],
            messages: [
              {
                id: 'wamid.HBgL',
                type: 'text',
                from: '5491133221100',
                timestamp: '1700000000',
                text: { body: 'Hola, quiero info' },
              },
            ],
          },
        },
      ],
    },
  ],
};

const validStatus = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123456789',
      changes: [
        {
          field: 'messages',
          value: {
            statuses: [
              {
                id: 'wamid.HBgL',
                status: 'delivered',
                recipient_id: '5491133221100',
                timestamp: '1700000000',
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('whatsappWebhookSchema', () => {
  it('accepts a well-formed text message payload produced by Meta', () => {
    const result = whatsappWebhookSchema.safeParse(validTextMessage);
    expect(result.success).toBe(true);
  });

  it('accepts a status-only payload (no messages but with statuses)', () => {
    const result = whatsappWebhookSchema.safeParse(validStatus);
    expect(result.success).toBe(true);
  });

  it('rejects a payload whose root `object` is not the WhatsApp literal', () => {
    const tampered = {
      ...validTextMessage,
      object: 'instagram', // pretend a different Meta product payload sneaks in
    };
    const result = whatsappWebhookSchema.safeParse(tampered);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.join('.') === 'object')).toBe(true);
    }
  });

  it('rejects a payload with no entry array', () => {
    const tampered = { object: 'whatsapp_business_account' };
    const result = whatsappWebhookSchema.safeParse(tampered);
    expect(result.success).toBe(false);
  });

  it('rejects an empty entry array (cannot route without at least one)', () => {
    const tampered = { object: 'whatsapp_business_account', entry: [] };
    const result = whatsappWebhookSchema.safeParse(tampered);
    expect(result.success).toBe(false);
  });

  it('rejects an entry with no changes (denies senders forging a thin envelope)', () => {
    const tampered = {
      object: 'whatsapp_business_account',
      entry: [{ id: 'x', changes: [] }],
    };
    const result = whatsappWebhookSchema.safeParse(tampered);
    expect(result.success).toBe(false);
  });

  it('rejects an unknown status enum value', () => {
    const tampered = {
      ...validStatus,
      entry: [
        {
          id: 'x',
          changes: [
            {
              field: 'messages',
              value: {
                statuses: [{ id: 'wamid.HBgL', status: 'totally_real_status' }],
              },
            },
          ],
        },
      ],
    };
    const result = whatsappWebhookSchema.safeParse(tampered);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.join('.').includes('status'))).toBe(true);
    }
  });

  it('rejects a message with no id (cannot dedupe without it)', () => {
    const tampered = {
      ...validTextMessage,
      entry: [
        {
          id: 'x',
          changes: [
            {
              field: 'messages',
              value: {
                messages: [{ type: 'text', from: '5491133221100', text: { body: 'hi' } }],
              },
            },
          ],
        },
      ],
    };
    const result = whatsappWebhookSchema.safeParse(tampered);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors.some((e) => e.path.join('.').includes('id'))).toBe(true);
    }
  });

  it('rejects a text body longer than 4096 chars (denies giant payloads)', () => {
    const tampered = {
      ...validTextMessage,
      entry: [
        {
          id: 'x',
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    id: 'wamid.HBgL',
                    type: 'text',
                    from: '5491133221100',
                    timestamp: '1700000000',
                    text: { body: 'x'.repeat(4097) },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const result = whatsappWebhookSchema.safeParse(tampered);
    expect(result.success).toBe(false);
  });

  it('allows extra unknown fields (passthrough) — Meta augments the payload over time', () => {
    const augmented = {
      ...validTextMessage,
      entry: [
        {
          ...validTextMessage.entry[0],
          new_meta_field_we_dont_understand_yet: true,
        },
      ],
    };
    const result = whatsappWebhookSchema.safeParse(augmented);
    expect(result.success).toBe(true);
  });

  it('rejects an auth payload with a completely wrong shape (not an object envelope)', () => {
    const tampered = 'just a string';
    const result = whatsappWebhookSchema.safeParse(tampered);
    expect(result.success).toBe(false);
  });

  it('rejects null', () => {
    const result = whatsappWebhookSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('caps arrays (e.g. >20 entries is rejected) to bound worst-case work', () => {
    const huge = {
      object: 'whatsapp_business_account',
      entry: Array.from({ length: 21 }, () => validTextMessage.entry[0]),
    };
    const result = whatsappWebhookSchema.safeParse(huge);
    expect(result.success).toBe(false);
  });
});
