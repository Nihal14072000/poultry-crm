import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';
import { SessionAuthService } from './session-auth.service';

describe('SessionAuthService', () => {
  let auth: SessionAuthService;
  let http: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    window.sessionStorage.clear();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router }
      ]
    });
    auth = TestBed.inject(SessionAuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    window.sessionStorage.clear();
  });

  it('authenticates and restores the session after a service reload', () => {
    let signedIn = false;
    auth.signIn('admin', 'admin').subscribe(() => signedIn = true);

    const loginRequest = http.expectOne(`${environment.apiUrl}/auth/me`);
    expect(loginRequest.request.headers.get('Authorization')).toBe('Basic YWRtaW46YWRtaW4=');
    loginRequest.flush({ name: 'admin', role: 'ADMIN' });

    expect(signedIn).toBeTrue();
    expect(auth.currentUser?.name).toBe('admin');
    expect(auth.currentUser?.role).toBe('Organization Admin');
    expect(auth.authorization).toBe('Basic YWRtaW46YWRtaW4=');

    const restoredAuth = new SessionAuthService(TestBed.inject(HttpClient), router);
    expect(restoredAuth.currentUser).toEqual(auth.currentUser);
    expect(restoredAuth.authorization).toBe(auth.authorization);

    auth.signOut();
    expect(auth.isAuthenticated).toBeFalse();
    expect(auth.authorization).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('discards an invalid stored session', () => {
    window.sessionStorage.setItem('flockwise.auth.session', '{');

    const restoredAuth = new SessionAuthService(TestBed.inject(HttpClient), router);

    expect(restoredAuth.isAuthenticated).toBeFalse();
    expect(restoredAuth.authorization).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('clears authentication and returns to login after an API 401', () => {
    auth.signIn('admin', 'admin').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/me`).flush({ name: 'admin', role: 'ADMIN' });

    TestBed.inject(HttpClient).get(`${environment.apiUrl}/employees`).subscribe({ error: () => undefined });
    const request = http.expectOne(`${environment.apiUrl}/employees`);
    expect(request.request.headers.get('Authorization')).toBe('Basic YWRtaW46YWRtaW4=');
    request.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated).toBeFalse();
    expect(auth.authorization).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('keeps authentication and shows access denied after an API 403', () => {
    auth.signIn('admin', 'admin').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/me`).flush({ name: 'admin', role: 'ADMIN' });

    TestBed.inject(HttpClient).get(`${environment.apiUrl}/employees`).subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/employees`).flush({}, { status: 403, statusText: 'Forbidden' });

    expect(auth.isAuthenticated).toBeTrue();
    expect(auth.authorization).toBe('Basic YWRtaW46YWRtaW4=');
    expect(router.navigate).toHaveBeenCalledWith(['/access-denied']);
  });
});
