export type ToolCategory = 'CRUD' | 'NAVIGATION' | 'AI' | 'WORKFLOW' | 'PLUGIN';

export interface ToolContext {
  userId: string;
  organizationId: string;
  role: string;
  permissions: string[];
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs?: number;
  navigation?: { path: string; label: string };
  naturalLanguage?: string;
}

export interface ToolDefinition {
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  keywords: string[];
  permissions: string[];
  inputSchema: Record<string, unknown>;
  handler: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}
