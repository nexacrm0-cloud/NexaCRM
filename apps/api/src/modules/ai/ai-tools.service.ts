import { Injectable } from '@nestjs/common';
import { ToolRegistryService } from '../../tool-registry/tool-registry.service';
import { AuthenticatedUser } from '../../common/interfaces/auth.interface';
import { ToolContext } from '../../tool-registry/tool.interface';

export interface AiToolResult {
  success: boolean;
  data: unknown;
  message: string;
}

@Injectable()
export class AiToolsService {
  constructor(private readonly toolRegistry: ToolRegistryService) {}

  async executeTool(
    toolName: string,
    parameters: Record<string, unknown>,
    user: AuthenticatedUser,
  ): Promise<AiToolResult> {
    const context: ToolContext = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      permissions: [],
    };

    const result = await this.toolRegistry.execute(toolName, parameters, context);

    return {
      success: result.success,
      data: result.data,
      message:
        result.naturalLanguage ||
        (result.success ? 'Ejecutado correctamente' : result.error || 'Error desconocido'),
    };
  }

  get toolDefinitions() {
    return this.toolRegistry.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    }));
  }
}
