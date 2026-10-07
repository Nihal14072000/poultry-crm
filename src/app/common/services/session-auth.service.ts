import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, forkJoin, map, Observable, throwError } from 'rxjs';
import { DemoUser, UserSession } from '../models/auth.model';
import { DirectoryService } from './directory.service';

const SESSION_KEY = 'flockwise.demo.session';
export const DEMO_PASSWORD = 'demo1234';

@Injectable({ providedIn: 'root' })
export class SessionAuthService {
  private readonly browser: boolean;
  private readonly sessionSubject: BehaviorSubject<UserSession | null>;
  readonly session$: Observable<UserSession | null>;

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private readonly directories: DirectoryService,
    private readonly router: Router
  ) {
    this.browser = isPlatformBrowser(platformId);
    this.sessionSubject = new BehaviorSubject<UserSession | null>(this.readSession());
    this.session$ = this.sessionSubject.asObservable();
  }

  get currentUser(): UserSession | null {
    return this.sessionSubject.value;
  }

  get isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  signIn(email: string, password: string): Observable<UserSession> {
    if (password !== DEMO_PASSWORD) return throwError(() => new Error('Email or password is incorrect.'));
    return forkJoin({
      users: this.directories.getDirectory('users-roles'),
      directory: this.directories.getDirectory('administration')
    }).pipe(map(({ users, directory }) => {
      const user = users.records.find((record) =>
        String(record['email'] ?? '').trim().toLowerCase() === email.trim().toLowerCase()
      );
      if (!user) throw new Error('Email or password is incorrect.');
      if (String(user['status'] ?? '').toLowerCase() !== 'active') throw new Error('This user account is inactive.');
      const directoryUser = directory.records.find((record) =>
        String(record['email'] ?? '').trim().toLowerCase() === email.trim().toLowerCase()
      );
      const session: UserSession = {
        name: String(user['name'] ?? ''),
        email: String(user['email'] ?? ''),
        role: String(user['role'] ?? 'Read Only'),
        permissions: String(user['permissions'] ?? ''),
        businessUnit: String(user['businessUnit'] ?? directoryUser?.['businessUnit'] ?? ''),
        status: String(user['status'] ?? ''),
        _demoId: user['_demoId'],
        authenticatedAt: new Date().toISOString()
      };
      this.saveSession(session);
      return session;
    }));
  }

  signOut(): void {
    if (this.browser) sessionStorage.removeItem(SESSION_KEY);
    this.sessionSubject.next(null);
    void this.router.navigate(['/login']);
  }

  updateCurrentUser(user: DemoUser): void {
    const current = this.currentUser;
    if (!current || current.email.toLowerCase() !== user.email.toLowerCase()) return;
    this.saveSession({ ...user, authenticatedAt: current.authenticatedAt });
  }

  private saveSession(session: UserSession): void {
    if (this.browser) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.sessionSubject.next(session);
  }

  private readSession(): UserSession | null {
    if (!this.browser) return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('Invalid demo session.');
      const session = parsed as UserSession;
      if (!session.email || !session.role || session.status?.toLowerCase() !== 'active') {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
}
