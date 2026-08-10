import { ZodType } from 'zod';
import { WorkflowActionType } from './enums';

export type WorkflowTrigger = {
  event: string;
  config: Record<string, any>;
};

export type WorkflowCondition = {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'exists';
  value: any;
};

export type WorkflowAction = {
  type: WorkflowActionType;
  config: Record<string, any>;
};

export type WorkflowDefinition = {
  name: string;
  description: string;
  trigger: string;
  triggerConfig: Record<string, any>;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
};

export type WorkflowExecutionResult = {
  actionType: WorkflowActionType;
  status: 'SUCCESS' | 'FAILED';
  output: any;
  error?: string;
};
