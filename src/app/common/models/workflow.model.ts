export interface WorkflowAction {
  label: string;
  nextStatus: string;
}

export interface WorkflowTransition {
  from: string;
  action: string;
  to: string;
}

export interface ModuleWorkflow {
  transitions: WorkflowTransition[];
  uniqueFields?: string[];
}
