import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { DomainEvent } from '@nexa/domain';
import axios from 'axios';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { resolveWebhookTarget } from '../../common/utils/ssrf-validator';

// Builds an HTTP(S) agent whose DNS lookup returns ONLY the addresses already
// validated as public by resolveWebhookTarget. This binds the connection to the
// validated IPs, closing the DNS-rebinding (TOCTOU) window between validation
// and connect. TLS SNI and the Host header still use the original hostname.
function createPinnedAgent(protocol: string, addresses: string[]): http.Agent | https.Agent {
  const pinnedLookup = ((_hostname: string, options: any, callback: any) => {
    const cb = typeof options === 'function' ? options : callback;
    const wantAll = options && typeof options === 'object' && options.all;
    const entries = addresses.map((address) => ({
      address,
      family: net.isIPv6(address) ? 6 : 4,
    }));
    if (wantAll) cb(null, entries);
    else if (entries.length > 0) cb(null, entries[0].address, entries[0].family);
    else cb(new Error('No validated address available'));
  }) as unknown as net.LookupFunction;

  return protocol === 'https:'
    ? new https.Agent({ lookup: pinnedLookup, keepAlive: false })
    : new http.Agent({ lookup: pinnedLookup, keepAlive: false });
}

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

      // SECURITY: resolve the hostname and reject private/loopback/link-local
      // destinations before connecting, then pin the validated addresses to the
      // actual socket so a DNS rebind between validation and connection cannot
      // redirect the request to an internal endpoint.
      const { url: targetUrl, addresses } = await resolveWebhookTarget(webhookUrl);
      const pinnedAgent = createPinnedAgent(targetUrl.protocol, addresses);
      const response = await axios.post(
        targetUrl.href,
        {
          event: event.eventName,
          payload: event.payload,
          metadata: event.metadata,
          workflowId: workflow.id,
          organizationId: organizationId,
        },
        {
          // SECURITY: never follow 30x redirects to SSRF targets. A redirect could
          // pivot to an internal endpoint that the original URL didn't expose.
          maxRedirects: 0,
          httpAgent: pinnedAgent,
          httpsAgent: pinnedAgent,
        },
      );

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
