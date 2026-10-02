/**
 * SECURITY TESTS — stored XSS via workflow editor URL.
 *
 * Workflow `triggerConfig` can be transferred between organizations and is
 * later rendered as a clickable link. These tests assert the persistence
 * boundary rejects non-HTTP(S) schemes (e.g. `javascript:`, `data:`) so a
 * stored value can never become a same-origin script sink.
 */
import { createWorkflowSchema, updateWorkflowSchema } from '../workflow.schemas';

const base = { name: 'Workflow', trigger: 'client.created' };

describe('workflow schemas — URL scheme validation', () => {
  it.each([
    'javascript:void(document.body.dataset.proof="xss")',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://example.com/x',
    'not a url',
  ])('rejects %s in n8n_workflow_url', (url) => {
    const result = createWorkflowSchema.safeParse({
      ...base,
      triggerConfig: { n8n_workflow_url: url },
    });
    expect(result.success).toBe(false);
  });

  it('rejects dangerous schemes in webhookUrl too', () => {
    const result = createWorkflowSchema.safeParse({
      ...base,
      triggerConfig: { webhookUrl: 'javascript:alert(1)' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts http and https URLs', () => {
    const result = createWorkflowSchema.safeParse({
      ...base,
      triggerConfig: {
        webhookUrl: 'https://hooks.example.com/services/AAA',
        n8n_workflow_url: 'http://n8n.internal:5678/workflow/1',
      },
    });
    expect(result.success).toBe(true);
  });

  it('keeps empty and absent URLs valid (no behavior change)', () => {
    expect(
      createWorkflowSchema.safeParse({ ...base, triggerConfig: { webhookUrl: '' } }).success,
    ).toBe(true);
    expect(createWorkflowSchema.safeParse(base).success).toBe(true);
    expect(createWorkflowSchema.safeParse({ ...base, triggerConfig: {} }).success).toBe(true);
  });

  it('enforces the same rule on update', () => {
    const result = updateWorkflowSchema.safeParse({
      triggerConfig: { n8n_workflow_url: 'javascript:alert(1)' },
    });
    expect(result.success).toBe(false);
  });
});
