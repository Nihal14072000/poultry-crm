import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideRouter } from '@angular/router';
import { DirectoryService } from './common/services/directory.service';
import { RolePermissionService } from './common/services/role-permission.service';
import { SessionAuthService } from './common/services/session-auth.service';
import { of } from 'rxjs';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: DirectoryService, useValue: { getDirectory: () => of({ records: [] }) } },
        { provide: SessionAuthService, useValue: { currentUser: { name: 'Alex Morgan', email: 'alex.morgan@example.test', role: 'Organization Admin', status: 'Active' }, signOut: () => {} } },
        { provide: RolePermissionService, useValue: { canAccessRoute: () => true } }
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the Flockwise navigation', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('flockwise');
    expect(compiled.querySelectorAll('.nav-link').length).toBeGreaterThan(5);
  });

  it('should collapse and expand navigation groups', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const farmGroup = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.nav-group-toggle'))
      .find((button) => button.textContent?.includes('Farm operations'));

    expect(farmGroup).toBeTruthy();
    expect(farmGroup?.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.querySelector('.nav-link[href="/farm-operations/farms"]')).toBeNull();
    farmGroup?.click();
    fixture.detectChanges();
    expect(farmGroup?.getAttribute('aria-expanded')).toBe('true');
    expect(compiled.querySelector('.nav-link[href="/farm-operations/farms"]')).toBeTruthy();

    farmGroup?.click();
    fixture.detectChanges();
    expect(farmGroup?.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.querySelector('.nav-link[href="/farm-operations/farms"]')).toBeNull();
  });
});
