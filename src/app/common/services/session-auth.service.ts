import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, map, Observable, switchMap } from 'rxjs';
import { UserSession } from '../models/auth.model';
import { environment } from '../../../environments/environment';
import { resolveAccountRole } from '../config/screen-visibility.config';

interface StoredAuthentication {
  authorization: string;
  session: UserSession;
}

@Injectable({ providedIn: 'root' })
export class SessionAuthService {
  private static readonly storageKey = 'flockwise.auth.session';
  private authorizationHeader: string | null = null;
  private readonly sessionSubject: BehaviorSubject<UserSession | null>;
  readonly session$: Observable<UserSession | null>;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    const storedAuthentication = this.restoreAuthentication();
    this.authorizationHeader = storedAuthentication?.authorization ?? null;
    this.sessionSubject = new BehaviorSubject<UserSession | null>(storedAuthentication?.session ?? null);
    this.session$ = this.sessionSubject.asObservable();
  }

  get currentUser(): UserSession | null {
    return this.sessionSubject.value;
  }

  get isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  get authorization(): string | null {
    return this.authorizationHeader;
  }

  signIn(username: string, password: string): Observable<UserSession> {
    const header = `Basic ${this.encodeCredentials(username, password)}`;
    return this.http.get<{ id?: string | number; _demoId?: string | number; name: string; role: string }>(`${environment.apiUrl}/auth/me`, {
      headers: { Authorization: header }
    }).pipe(switchMap(account => this.http.get<{ id?: string | number; _demoId?: string | number; name: string; type: string }[]>(
      `${environment.apiUrl}/employees`,
      { headers: { Authorization: header } }
    ).pipe(map(employees => {
      const employee = employees.find((item) => item.name === account.name);
      const session: UserSession = {
        id: employee?.id ?? employee?._demoId ?? account.id ?? account._demoId,
        name: account.name,
        email: account.name,
        role: resolveAccountRole(account.name.toLowerCase().includes('admin') ? 'ADMIN' : employee?.type ?? account.role),
        permissions: '',
        businessUnit: '',
        status: 'Active',
        authenticatedAt: new Date().toISOString()
      };
      this.persistAuthentication(header, session);
      this.authorizationHeader = header;
      this.sessionSubject.next(session);
      return session;
    }))));
  }

  signOut(): void {
    this.clearAuthentication();
    void this.router.navigate(['/login']);
  }

  clearAuthentication(): void {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(SessionAuthService.storageKey);
    }
    this.authorizationHeader = null;
    this.sessionSubject.next(null);
  }

  private persistAuthentication(authorization: string, session: UserSession): void {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        SessionAuthService.storageKey,
        JSON.stringify({ authorization, session })
      );
    }
  }

  private restoreAuthentication(): StoredAuthentication | null {
    if (typeof window === 'undefined') return null;

    const stored = window.sessionStorage.getItem(SessionAuthService.storageKey);
    if (!stored) return null;

    try {
      const value: unknown = JSON.parse(stored);
      if (this.isStoredAuthentication(value)) return value;
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }

    window.sessionStorage.removeItem(SessionAuthService.storageKey);
    return null;
  }

  private isStoredAuthentication(value: unknown): value is StoredAuthentication {
    if (typeof value !== 'object' || value === null ||
      !('authorization' in value) || typeof value.authorization !== 'string' ||
      !value.authorization.startsWith('Basic ') ||
      !('session' in value) || typeof value.session !== 'object' || value.session === null) {
      return false;
    }

    const session = value.session;
    return 'name' in session && typeof session.name === 'string' &&
      'email' in session && typeof session.email === 'string' &&
      'role' in session && typeof session.role === 'string' &&
      'permissions' in session && typeof session.permissions === 'string' &&
      'status' in session && typeof session.status === 'string' &&
      'authenticatedAt' in session && typeof session.authenticatedAt === 'string';
  }

  private encodeCredentials(username: string, password: string): string {
    const bytes = new TextEncoder().encode(`${username}:${password}`);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary);
  }
}
