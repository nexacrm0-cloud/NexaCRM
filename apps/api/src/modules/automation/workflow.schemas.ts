import { z } from 'zod';

// SECURITY: workflow configs can be transferred between organizations and are
// later rendered as clickable links in the CRM UI. Reject non-HTTP(S) schemes
// such as `javascript:` or `data:` at the persistence boundary so a stored
// value can never become a stored-XSS sink, even after a workflow transfer.
const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:']);

function isSafeHttpUrl(value: string): boolean {
  try {
    return SAFE_URL_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

const triggerConfigSchema = z.record(z.unknown()).superRefine((config, ctx) => {
  for (const key of ['webhookUrl', 'n8n_workflow_url'] as const) {
    const value = config[key];
    // Empty/absent URLs keep the previous behavior (the dispatcher already
    // refuses to send to a missing webhook URL).
    if (typeof value !== 'string' || value.trim() === '') continue;
    if (!isSafeHttpUrl(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: 'Debe ser una URL http(s) válida',
      });
    }
  }
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  trigger: z.string().min(1),
  triggerConfig: triggerConfigSchema.optional(),
  actions: z.array(z.record(z.unknown())).optional(),
  conditions: z.array(z.record(z.unknown())).optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  trigger: z.string().min(1).optional(),
  triggerConfig: triggerConfigSchema.optional(),
  actions: z.array(z.record(z.unknown())).optional(),
  conditions: z.array(z.record(z.unknown())).optional(),
});

// SECURITY ALTA-5: `targetOrganizationId` is intentionally absent. The
// destination is always resolved from `targetEmail` (existing user's org or
// a freshly provisioned one). Allowing callers to pick any org id let an
// ADMIN clone a workflow into arbitrary tenants.
export const transferSchema = z.object({
  targetEmail: z.string().email(),
});
