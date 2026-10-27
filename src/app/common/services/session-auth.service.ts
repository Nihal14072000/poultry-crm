import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { UserSession } from '../models/auth.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SessionAuthService {
  private authorizationHeader: string | null = null;
  private readonly sessionSubject: BehaviorSubject<UserSession | null>;
  readonly session$: Observable<UserSession | null>;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    this.sessionSubject = new BehaviorSubject<UserSession | null>(null);
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
    return this.http.get<unknown[]>(`${environment.apiUrl}/employees`, {
      headers: { Authorization: header }
    }).pipe(map(() => {
      const session: UserSession = {
        name: username,
        email: username,
        role: 'Authenticated',
        permissions: '',
        moduleAccess: '',
        businessUnit: '',
        status: 'Active',
        authenticatedAt: new Date().toISOString()
      };
      this.authorizationHeader = header;
      this.sessionSubject.next(session);
      return session;
    }));
  }

  signOut(): void {
    this.clearAuthentication();
    void this.router.navigate(['/login']);
  }

  clearAuthentication(): void {
    this.authorizationHeader = null;
    this.sessionSubject.next(null);
  }

  private encodeCredentials(username: string, password: string): string {
    const bytes = new TextEncoder().encode(`${username}:${password}`);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary);
  }
}
