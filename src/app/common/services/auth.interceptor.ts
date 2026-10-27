import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionAuthService } from './session-auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(SessionAuthService);
  const router = inject(Router);
  const isApiRequest = request.url.startsWith(`${environment.apiUrl}/`);
  const authenticatedRequest = isApiRequest && auth.authorization
    ? request.clone({ setHeaders: { Authorization: auth.authorization } })
    : request;

  return next(authenticatedRequest).pipe(catchError((error: unknown) => {
    if (isApiRequest && error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        auth.clearAuthentication();
        void router.navigate(['/login']);
      } else if (error.status === 403 && auth.isAuthenticated) {
        void router.navigate(['/access-denied']);
      }
    }
    return throwError(() => error);
  }));
};
