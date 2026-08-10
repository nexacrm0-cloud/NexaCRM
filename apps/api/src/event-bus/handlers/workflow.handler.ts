import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@nexa/database';
import type { DomainEvent } from '@nexa/domain';
import { WorkflowExecutor } from '../../modules/automation/workflow-executor.service';

@Injectable()
export class WorkflowHandler {
  private readonly logger = new Logger(WorkflowHandler.name);
  private readonly workflowsEnabled: boolean;

  constructor(
    private prisma: PrismaService,
    private workflowExecutor: WorkflowExecutor,
  ) {
    this.workflowsEnabled = process.env.WORKFLOWS_ENABLED === 'true';
    if (!this.workflowsEnabled) {
      this.logger.warn(
        'Workflows ejecucion deshabilitada (WORKFLOWS_ENABLED!="true"). ' +
          'Deteccion de ciclos pendiente; handler en short-circuit.',
      );
    }
  }

  @OnEvent('**')
  async evaluateWorkflows(event: DomainEvent) {
    if (!this.workflowsEnabled) return;

    try {
      const workflows = await this.prisma.workflow.findMany({
        where: {
          organizationId: event.metadata.organizationId,
          isActive: true,
          trigger: event.eventName,
        },
      });

      if (workflows.length === 0) return;

      for (const workflow of workflows) {
        const log = await this.prisma.workflowExecutionLog.create({
          data: {
            status: 'PENDING',
            triggerType: event.eventName,
            input: JSON.parse(
              JSON.stringify({
                event: event.eventName,
                aggregateType: event.aggregateType,
                aggregateId: event.aggregateId,
                payload: event.payload,
                metadata: event.metadata,
              }),
            ),
            startedAt: new Date(),
            organizationId: event.metadata.organizationId,
            workflowId: workflow.id,
          },
        });

        await this.prisma.workflowExecutionLog.update({
          where: { id: log.id },
          data: { status: 'RUNNING' },
        });

        try {
          const result = await this.workflowExecutor.execute(workflow.id, event);

          await this.prisma.workflowExecutionLog.update({
            where: { id: log.id },
            data: {
              status: result.success ? 'COMPLETED' : 'FAILED',
              output: result.output ?? undefined,
              error: result.error ?? undefined,
              completedAt: new Date(),
            },
          });

          this.logger.debug(
            `Workflow ${workflow.name} (${workflow.id}) ${result.success ? 'completed' : 'failed'} for ${event.eventName}`,
          );
        } catch (execError: unknown) {
          await this.prisma.workflowExecutionLog.update({
            where: { id: log.id },
            data: {
              status: 'FAILED',
              error: execError instanceof Error ? execError.message : 'Unknown execution error',
              completedAt: new Date(),
            },
          });
          this.logger.error(
            `Workflow ${workflow.name} (${workflow.id}) execution crashed`,
            execError instanceof Error ? execError.stack : undefined,
          );
        }
      }
    } catch (error: unknown) {
      this.logger.error(
        `Error evaluating workflows for ${event.eventName}:${event.aggregateId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
