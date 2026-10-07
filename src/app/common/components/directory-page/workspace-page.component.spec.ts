import { EMPTY } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { DirectoryService } from '../../services/directory.service';
import { ModuleWorkflowService } from '../../services/module-workflow.service';
import { FarmOperationsService } from '../../services/farm-operations.service';
import { RolePermissionService } from '../../services/role-permission.service';
import { WorkspacePageComponent } from './workspace-page.component';

describe('WorkspacePageComponent validation', () => {
  let component: WorkspacePageComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WorkspacePageComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { data: EMPTY } },
        { provide: DirectoryService, useValue: {} },
        { provide: FarmOperationsService, useValue: {} },
        { provide: RolePermissionService, useValue: { can: () => true, canAccessRecord: () => true, canManageRoles: () => false } }
      ]
    });
    component = TestBed.createComponent(WorkspacePageComponent).componentInstance;
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
});
