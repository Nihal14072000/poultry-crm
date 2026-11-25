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
    loginRequest.flush({ id: 7, name: 'admin', username: 'admin', role: 'Organization Admin' });

    expect(signedIn).toBeTrue();
    expect(auth.currentUser?.name).toBe('admin');
    expect(auth.currentUser?.id).toBe(7);
    expect(auth.currentUser?.role).toBe('Organization Admin');
    expect(auth.authorization).toBe('Basic YWRtaW46YWRtaW4=');
    expect(JSON.parse(window.sessionStorage.getItem('flockwise.auth.session') ?? '{}').session.id).toBe(7);

    const restoredAuth = new SessionAuthService(TestBed.inject(HttpClient), router);
    expect(restoredAuth.currentUser).toEqual(auth.currentUser);
    expect(restoredAuth.currentUser?.id).toBe(7);
    expect(restoredAuth.authorization).toBe(auth.authorization);

    auth.signOut();
    expect(auth.isAuthenticated).toBeFalse();
    expect(auth.authorization).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('uses configured employee role names returned by the authentication API', () => {
    auth.signIn('manager', 'password').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/me`).flush({ name: 'manager', role: 'Farm Manager' });

    expect(auth.currentUser?.role).toBe('Farm Manager');
  });

  it('uses the server-resolved role and employee id from /auth/me', () => {
    auth.signIn('driver', 'password').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/me`).flush({ id: 12, name: 'driver', username: 'driver', role: 'Supervisor' });

    expect(auth.currentUser?.role).toBe('Supervisor');
    expect(auth.currentUser?.id).toBe(12);
  });

  it('normalizes login username by removing spaces and ignoring case', () => {
    auth.signIn(' John  Doe ', 'johndoe').subscribe();
    const loginRequest = http.expectOne(`${environment.apiUrl}/auth/me`);
    expect(loginRequest.request.headers.get('Authorization')).toBe('Basic am9obmRvZTpqb2huZG9l');
    loginRequest.flush({ id: 15, name: 'John Doe', username: 'johndoe', role: 'Driver' });

    expect(auth.currentUser?.role).toBe('Driver');
    expect(auth.currentUser?.id).toBe(15);
    expect(auth.currentUser?.email).toBe('johndoe');
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
    http.expectOne(`${environment.apiUrl}/auth/me`).flush({ name: 'admin', role: 'Organization Admin' });

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
    http.expectOne(`${environment.apiUrl}/auth/me`).flush({ name: 'admin', role: 'Organization Admin' });

    TestBed.inject(HttpClient).get(`${environment.apiUrl}/employees`).subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/employees`).flush({}, { status: 403, statusText: 'Forbidden' });

    expect(auth.isAuthenticated).toBeTrue();
    expect(auth.authorization).toBe('Basic YWRtaW46YWRtaW4=');
    expect(router.navigate).toHaveBeenCalledWith(['/access-denied']);
  });
});
