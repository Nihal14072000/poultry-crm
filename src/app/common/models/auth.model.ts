export interface DemoUser {
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
}

export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'transition' | 'approve' | 'export' | 'manage';
