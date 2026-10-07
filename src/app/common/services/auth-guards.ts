import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RolePermissionService } from './role-permission.service';
import { SessionAuthService } from './session-auth.service';

export const requireSessionGuard: CanActivateFn = (_route, state) => {
  const auth = inject(SessionAuthService);
  const router = inject(Router);
  return auth.isAuthenticated
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const requirePermissionGuard: CanActivateFn = (route) => {
  const permissions = inject(RolePermissionService);
  const router = inject(Router);
  const resource = String(route.data['resource'] ?? '');
  return resource && permissions.canAccessRoute(resource)
    ? true
    : router.createUrlTree(['/access-denied']);
};

export const signedOutOnlyGuard: CanActivateFn = () => {
  const auth = inject(SessionAuthService);
  const router = inject(Router);
  return auth.isAuthenticated ? router.createUrlTree(['/workspace/overview']) : true;
};
