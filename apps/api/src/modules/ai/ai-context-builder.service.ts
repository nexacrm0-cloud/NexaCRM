import { Injectable, Logger } from '@nestjs/common';
import { IntentDetectionService } from '../../intent-detection/intent-detection.service';
import { ToolRegistryService } from '../../tool-registry/tool-registry.service';
import { ToolContext } from '../../tool-registry/tool.interface';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';

export interface ContextBundle {
  query: string;
  intent: string;
  confidence: number;
  data: Record<string, unknown>;
  naturalLanguage: string;
  executionTimeMs: number;
}

@Injectable()
export class AiContextBuilderService {
  private readonly logger = new Logger(AiContextBuilderService.name);

  constructor(
    private readonly intentDetection: IntentDetectionService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  async buildContext(query: string, user: AuthenticatedUser): Promise<ContextBundle> {
    const start = Date.now();
    const toolContext: ToolContext = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      permissions: [],
    };

    const intent = this.intentDetection.detect(query);
    const data: Record<string, unknown> = {};
    const toolResults: string[] = [];

    if (intent.toolName) {
      const result = await this.toolRegistry.execute(intent.toolName, intent.params, toolContext);
      data.toolResult = result.data;
      data.toolName = intent.toolName;
      if (result.naturalLanguage) toolResults.push(result.naturalLanguage);
    }

    const dashboardIntent = this.intentDetection.detect('dashboard metrics');
    if (
      dashboardIntent.confidence >= 0.15 &&
      dashboardIntent.toolName &&
      dashboardIntent.toolName !== intent.toolName
    ) {
      const dashResult = await this.toolRegistry.execute(dashboardIntent.toolName, {}, toolContext);
      data.dashboardMetrics = dashResult.data;
      if (dashResult.naturalLanguage) toolResults.push(dashResult.naturalLanguage);
    }

    const naturalLanguage =
      toolResults.length > 0
        ? toolResults.join('. ')
        : 'No se encontró información para tu consulta.';

    return {
      query,
      intent: intent.intent,
      confidence: intent.confidence,
      data,
      naturalLanguage,
      executionTimeMs: Date.now() - start,
    };
  }
}
