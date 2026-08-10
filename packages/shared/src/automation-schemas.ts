import { z } from 'zod';
import { WorkflowActionType } from './enums';

export const WorkflowConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'contains', 'greaterThan', 'lessThan', 'exists']),
  value: z.any(),
});

export const WorkflowActionSchema = z.object({
  type: z.nativeEnum(WorkflowActionType),
  config: z.record(z.any()),
});

export const WorkflowSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  trigger: z.string().min(1, 'El disparador es requerido'),
  triggerConfig: z.record(z.any()).optional(),
  conditions: z.array(WorkflowConditionSchema).optional(),
  actions: z.array(WorkflowActionSchema).min(1, 'Al menos una acción es requerida'),
  isActive: z.boolean().optional(),
});
