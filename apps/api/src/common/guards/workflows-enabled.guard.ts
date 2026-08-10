import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

@Injectable()
export class WorkflowsEnabledGuard implements CanActivate {
  private readonly logger = new Logger(WorkflowsEnabledGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const enabled = process.env.WORKFLOWS_ENABLED === 'true';
    if (!enabled) {
      this.logger.debug('Workflows disabled via WORKFLOWS_ENABLED env var');
      throw new ServiceUnavailableException(
        'El motor de automatizaciones esta temporalmente deshabilitado.',
      );
    }
    return true;
  }
}
