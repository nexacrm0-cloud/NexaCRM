import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { DomainEvent } from '@nexa/domain';
import { WorkflowExecutionStatus } from '@nexa/shared';
import axios from 'axios';
import { validateWebhookUrl } from '../../common/utils/ssrf-validator';

@Injectable()
export class WorkflowExecutor {
  private readonly logger = new Logger(WorkflowExecutor.name);

  constructor(private prisma: PrismaService) {}

  async execute(
    workflowId: string,
    event: DomainEvent,
  ): Promise<{ success: boolean; output: any; error?: string }> {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new Error('Workflow not found');

    const { organizationId } = event.metadata;

    try {
      // 1. Evaluate Conditions (still handled in Nexa for fast filtering)
      if (workflow.conditions) {
        const conditions = JSON.parse(JSON.stringify(workflow.conditions)) as any[];
        const allPassed = conditions.every((cond) => this.evaluateCondition(cond, event.payload));
        if (!allPassed) {
          return { success: true, output: { skipped: true, reason: 'Conditions not met' } };
        }
      }

      // 2. Trigger n8n Webhook
      // We expect the triggerConfig to contain the n8n webhook URL
      const config = workflow.triggerConfig as Record<string, any>;
      const webhookUrl = config?.webhookUrl;
      if (!webhookUrl) {
        throw new Error('No n8n webhook URL configured for this workflow');
      }

      validateWebhookUrl(webhookUrl);
      const response = await axios.post(webhookUrl, {
        event: event.eventName,
        payload: event.payload,
        metadata: event.metadata,
        workflowId: workflow.id,
        organizationId: organizationId,
      }, {
        // SECURITY: never follow 30x redirects to SSRF targets. The URL was
        // validated against the private-IP blocklist above; a redirect could
        // pivot to an internal endpoint that the original URL didn't expose.
        maxRedirects: 0,
      });

      return {
        success: true,
        output: {
          n8nResponse: response.data,
          status: 'DISPATCHED',
        },
      };
    } catch (error: unknown) {
      this.logger.error(
        `n8n dispatch failed for workflow ${workflowId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : 'Unknown error during n8n dispatch',
      };
    }
  }

  private evaluateCondition(condition: any, payload: any): boolean {
    const value = payload[condition.field];
    const target = condition.value;

    switch (condition.operator) {
      case 'equals':
        return value === target;
      case 'contains':
        return String(value).toLowerCase().includes(String(target).toLowerCase());
      case 'greaterThan':
        return value > target;
      case 'lessThan':
        return value < target;
      case 'exists':
        return value !== undefined && value !== null;
      default:
        return false;
    }
  }
}
