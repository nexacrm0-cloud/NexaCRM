import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistryService } from '../tool-registry/tool-registry.service';
import { IntentDetectionService } from '../intent-detection/intent-detection.service';
import { ToolContext } from '../tool-registry/tool.interface';

export interface CommandResult {
  intent: string;
  action: string;
  parameters: Record<string, unknown>;
  naturalLanguage: string;
  success: boolean;
  data?: unknown;
  error?: string;
  navigation?: { path: string; label: string };
  executionTimeMs?: number;
  detectionMethod?: 'fast' | 'slow';
  confidence?: number;
}

@Injectable()
export class CommandCenterService {
  private readonly logger = new Logger(CommandCenterService.name);

  private readonly navigationMap: Record<string, { path: string; label: string }> = {
    clientes: { path: '/clients', label: 'Clientes' },
    client: { path: '/clients', label: 'Clientes' },
    dashboard: { path: '/dashboard', label: 'Dashboard' },
    inicio: { path: '/dashboard', label: 'Inicio' },
    tareas: { path: '/tasks', label: 'Tareas' },
    tasks: { path: '/tasks', label: 'Tareas' },
    pipeline: { path: '/pipeline', label: 'Pipeline' },
    deals: { path: '/pipeline', label: 'Pipeline' },
    cotizaciones: { path: '/quotes', label: 'Cotizaciones' },
    quotes: { path: '/quotes', label: 'Cotizaciones' },
    usuarios: { path: '/settings/users', label: 'Usuarios' },
    configuracion: { path: '/settings', label: 'Configuración' },
    settings: { path: '/settings', label: 'Settings' },
  };

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly intentDetection: IntentDetectionService,
  ) {}

  async execute(command: string, context: ToolContext): Promise<CommandResult> {
    const start = Date.now();

    try {
      const intent = this.intentDetection.detect(command);

      if (intent.confidence < 0.15) {
        return {
          intent: 'unknown',
          action: 'noop',
          parameters: {},
          naturalLanguage: `No entendí el comando: "${command}"`,
          success: false,
          error: `No se encontró una herramienta para: "${command}"`,
          executionTimeMs: Date.now() - start,
          detectionMethod: intent.detectionMethod,
          confidence: intent.confidence,
        };
      }

      if (intent.intent === 'navigate') {
        return this.handleNavigation(intent.params.destination as string, command, start);
      }

      if (!intent.toolName) {
        return {
          intent: intent.intent,
          action: 'noop',
          parameters: intent.params,
          naturalLanguage: `No pude determinar qué herramienta usar para: "${command}"`,
          success: false,
          error: 'No tool mapped to intent',
          executionTimeMs: Date.now() - start,
          detectionMethod: intent.detectionMethod,
          confidence: intent.confidence,
        };
      }

      const result = await this.toolRegistry.execute(intent.toolName, intent.params, context);

      return {
        intent: intent.intent,
        action: intent.toolName,
        parameters: intent.params,
        naturalLanguage: result.naturalLanguage || `Ejecutado correctamente`,
        success: result.success,
        data: result.data,
        error: result.error,
        navigation: result.navigation,
        executionTimeMs: result.executionTimeMs,
        detectionMethod: intent.detectionMethod,
        confidence: intent.confidence,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Command execution failed: ${command}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        intent: 'error',
        action: 'error',
        parameters: {},
        naturalLanguage: 'Ocurrió un error al procesar el comando',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: Date.now() - start,
      };
    }
  }

  private handleNavigation(destination: string, command: string, start: number): CommandResult {
    const key = destination.toLowerCase().trim();
    const nav = this.navigationMap[key];

    if (nav) {
      return {
        intent: 'navigate',
        action: 'navigate',
        parameters: { destination: key },
        naturalLanguage: `Navegando a ${nav.label}`,
        success: true,
        navigation: nav,
        executionTimeMs: Date.now() - start,
        detectionMethod: 'fast',
        confidence: 1.0,
      };
    }

    return {
      intent: 'navigate',
      action: 'noop',
      parameters: { destination: key },
      naturalLanguage: `No conozco la sección "${destination}"`,
      success: false,
      error: `Unknown navigation destination: ${destination}`,
      executionTimeMs: Date.now() - start,
      detectionMethod: 'fast',
      confidence: 1.0,
    };
  }
}
