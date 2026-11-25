export interface DemoUser {
  id?: string | number;
  name: string;
  email: string;
  role: string;
  permissions: string;
  businessUnit?: string;
  status: string;
  _demoId?: string | number;
}

export interface UserSession extends DemoUser {
  authenticatedAt: string;
  tenantName?: string;
  resources?: string[];
  actions?: Record<string, string[]>;
}

export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'transition' | 'approve' | 'export' | 'manage';
