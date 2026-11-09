import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { navigationScreenResources } from './common/config/screen-visibility.config';
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

  it('should render every navigation group permitted by the central policy', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('flockwise');
    expect(compiled.querySelectorAll('.nav-link').length).toBeGreaterThan(5);
    const groupLabels = Array.from(compiled.querySelectorAll('.nav-group-toggle')).map((button) => button.textContent);
    expect(groupLabels).toContain('Farm operations');
    expect(groupLabels).toContain('Trading');
    expect(groupLabels).toContain('Customer relations');
    expect(groupLabels).toContain('Inventory');
    expect(compiled.querySelector('.nav-link[href="/people-logistics/vehicle-assignments"]')).toBeTruthy();
    expect(app.navigation.flatMap((group) => group.links)
      .every((link) => !!navigationScreenResources[link.path])).toBeTrue();
  });

  it('should show deliveries to users with trip access', () => {
    const rolePermissions = jasmine.createSpyObj<RolePermissionService>('RolePermissionService', ['canAccessRoute']);
    rolePermissions.canAccessRoute.and.callFake((resource) => resource === 'trips');
    const app = new AppComponent(
      { currentUser: null } as unknown as SessionAuthService,
      rolePermissions
    );

    const peopleLogistics = app.visibleNavigation.find((group) => group.label === 'People & logistics');

    expect(peopleLogistics?.links.map((link) => link.label)).toContain('Deliveries');
    expect(peopleLogistics?.links.map((link) => link.label)).not.toContain('Vehicle assignments');
  });

  it('should collapse and expand navigation groups', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const farmGroup = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.nav-group-toggle'))
      .find((button) => button.textContent?.includes('Inventory'));

    expect(farmGroup).toBeTruthy();
    expect(farmGroup?.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.querySelector('.nav-link[href="/inventory/products"]')).toBeNull();
    farmGroup?.click();
    fixture.detectChanges();
    expect(farmGroup?.getAttribute('aria-expanded')).toBe('true');
    expect(compiled.querySelector('.nav-link[href="/inventory/products"]')).toBeTruthy();

    farmGroup?.click();
    fixture.detectChanges();
    expect(farmGroup?.getAttribute('aria-expanded')).toBe('false');
    expect(compiled.querySelector('.nav-link[href="/inventory/products"]')).toBeNull();
  });

  it('should keep navigation groups expanded after selecting a link', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const farmGroup = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.nav-group-toggle'))
      .find((button) => button.textContent?.includes('Inventory'));

    farmGroup?.click();
    fixture.detectChanges();
    compiled.querySelector<HTMLAnchorElement>('.nav-link[href="/inventory/products"]')?.click();
    fixture.detectChanges();

    expect(farmGroup?.getAttribute('aria-expanded')).toBe('true');
    expect(compiled.querySelector('.nav-link[href="/inventory/products"]')).toBeTruthy();
  });

  it('should open and close the mobile navigation drawer', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const menuButton = compiled.querySelector<HTMLButtonElement>('.mobile-menu-toggle');
    const sidebar = compiled.querySelector<HTMLElement>('.sidebar');

    expect(menuButton?.getAttribute('aria-expanded')).toBe('false');
    expect(sidebar?.classList.contains('mobile-open')).toBe(false);

    menuButton?.click();
    fixture.detectChanges();
    expect(menuButton?.getAttribute('aria-expanded')).toBe('true');
    expect(sidebar?.classList.contains('mobile-open')).toBe(true);

    compiled.querySelector<HTMLAnchorElement>('.nav-link[href="/workspace/overview"]')?.click();
    fixture.detectChanges();
    expect(menuButton?.getAttribute('aria-expanded')).toBe('false');
    expect(sidebar?.classList.contains('mobile-open')).toBe(false);
  });
});
