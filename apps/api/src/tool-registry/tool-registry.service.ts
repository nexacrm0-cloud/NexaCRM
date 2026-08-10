import { Injectable, Logger } from '@nestjs/common';
import { ToolDefinition, ToolContext, ToolResult } from './tool.interface';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool already registered: ${tool.name}. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
    this.logger.log(`Tool registered: ${tool.name} (${tool.category})`);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  findByName(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  findByIntent(intent: string): ToolDefinition[] {
    const query = intent.toLowerCase();
    return this.getAll().filter((tool) => {
      if (tool.name.toLowerCase().includes(query)) return true;
      return tool.keywords.some((kw) => kw.toLowerCase().includes(query));
    });
  }

  findByCategory(category: string): ToolDefinition[] {
    return this.getAll().filter((t) => t.category === category);
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${name}`,
        executionTimeMs: 0,
      };
    }

    const start = Date.now();
    try {
      const timeout = 30000;
      const result = await Promise.race([
        tool.handler(params, context),
        new Promise<ToolResult>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Tool execution timed out after ${timeout}ms`)),
            timeout,
          ),
        ),
      ]);
      return { ...result, executionTimeMs: Date.now() - start };
    } catch (error: unknown) {
      this.logger.error(
        `Tool execution failed: ${name}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: Date.now() - start,
      };
    }
  }
}
