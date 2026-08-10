import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { sanitizeInput } from '../utils/sanitize';

@Injectable()
export class ZodPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      throw new BadRequestException({
        message: 'Error de validación',
        errors,
      });
    }
    return sanitizeInput(result.data);
  }
}
