import { EMPTY } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DirectoryService } from '../../services/directory.service';
import { ModuleWorkflowService } from '../../services/module-workflow.service';
import { FarmOperationsService } from '../../services/farm-operations.service';
import { RolePermissionService } from '../../services/role-permission.service';
import { DriverDirectoryService } from '../../services/driver-directory.service';
import { VehicleDirectoryService } from '../../services/vehicle-directory.service';
import { WorkspacePageComponent } from './workspace-page.component';

describe('WorkspacePageComponent validation', () => {
  let component: WorkspacePageComponent;
  let fixture: ComponentFixture<WorkspacePageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WorkspacePageComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { data: EMPTY } },
        { provide: DirectoryService, useValue: {} },
        { provide: FarmOperationsService, useValue: {} },
        { provide: DriverDirectoryService, useValue: {} },
        { provide: VehicleDirectoryService, useValue: {} },
        { provide: RolePermissionService, useValue: { can: () => true, canAccessRecord: () => true, canManageRoles: () => false } }
      ]
    });
    fixture = TestBed.createComponent(WorkspacePageComponent);
    component = fixture.componentInstance;
    component.resource = 'products';
    component.columns = [{ key: 'sku', label: 'SKU' }];
    component.editorRecord = { sku: '' };
  });

  it('requires non-optional fields', () => {
    expect(component.fieldError('sku')).toBe('This field is required.');
  });

  it('rejects a duplicate unique identifier but allows it for the current record', () => {
    component.records = [{ sku: 'FD-001', _demoId: 'products-1' }];
    component.editorRecord = { sku: 'fd-001' };
    expect(component.fieldError('sku')).toBe('This value is already used by another record.');

    component.editorMode = 'edit';
    component.editingId = 'products-1';
    expect(component.fieldError('sku')).toBe('');
  });

  it('enforces percentage bounds and permits supported negative temperatures', () => {
    component.editorRecord = { humidity: '101' };
    expect(component.fieldError('humidity')).toBe('Enter a percentage between 0 and 100.');

    component.editorRecord = { temperature: '-2' };
    expect(component.fieldError('temperature')).toBe('');
  });

  it('rejects malformed email and phone values', () => {
    component.editorRecord = { email: 'not-an-email' };
    expect(component.fieldError('email')).toBe('Enter a valid email address.');

    component.editorRecord = { phone: '12' };
    expect(component.fieldError('phone')).toBe('Enter a valid phone number.');
  });

  it('allows signed, non-zero stock ledger movement quantities', () => {
    component.resource = 'stock-ledger';
    component.editorRecord = { quantity: '−612 kg' };
    expect(component.fieldError('quantity')).toBe('');
    component.editorRecord = { quantity: '0' };
    expect(component.fieldError('quantity')).toBe('Movement quantity cannot be zero.');
  });

  it('validates employee login names at creation time', () => {
    component.resource = 'employees';
    component.editorMode = 'create';
    component.editorRecord = { name: 'Asha:Kumar' };
    expect(component.fieldError('name')).toBe('Employee name cannot contain a colon.');

    component.editorRecord = { name: 'A'.repeat(101) };
    expect(component.fieldError('name')).toBe('Employee name must be 100 characters or fewer.');
    expect(component.maxFieldLength('name')).toBe(100);

    component.editorMode = 'edit';
    expect(component.fieldError('name')).toBe('');
  });

  it('shows employee edit and delete actions in a table and opens the existing dialogs', () => {
    component.resource = 'employees';
    component.title = 'Employees';
    component.mode = 'editable';
    component.columns = [{ key: 'name', label: 'NAME' }, { key: 'status', label: 'STATUS' }];
    component.records = [{ _demoId: '12', name: 'Asha Patil', status: 'Active' }];
    component.loading = false;
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('tbody button')) as HTMLButtonElement[];
    expect(buttons.map((button) => button.textContent.trim())).toEqual(['Edit', 'Delete']);

    buttons[0].click();
    expect(component.editorOpen).toBeTrue();
    component.closeEditor();

    buttons[1].click();
    expect(component.deleteCandidate?['_demoId']).toBe('12');
  });

  it('shows vehicle edit and delete actions in the table', () => {
    component.resource = 'vehicles';
    component.title = 'Company vehicles';
    component.mode = 'editable';
    component.columns = [{ key: 'vehicle', label: 'VEHICLE NUMBER' }, { key: 'status', label: 'STATUS' }];
    component.records = [{ _demoId: '21', vehicle: 'MH-12-AB-4521', status: 'Active' }];
    component.loading = false;
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('tbody button')) as HTMLButtonElement[];
    expect(buttons.map((button) => button.textContent.trim())).toEqual(['Edit', 'Delete']);
    expect(fixture.nativeElement.textContent).toContain('MH-12-AB-4521');
  });
});
