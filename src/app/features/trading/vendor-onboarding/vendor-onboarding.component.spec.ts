import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { VendorOnboardingComponent } from './vendor-onboarding.component';
import { DirectoryService } from '../../../common/services/directory.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { SessionAuthService } from '../../../common/services/session-auth.service';

describe('VendorOnboardingComponent', () => {
  let component: VendorOnboardingComponent;
  let mockDirectoryService: any;
  let mockHttpClient: any;

  beforeEach(async () => {
    mockDirectoryService = {
      getDirectory: jasmine.createSpy('getDirectory').and.returnValue(of({ records: [] })),
      createRecord: jasmine.createSpy('createRecord').and.returnValue(of({ id: 'mock-1' }))
    };

    mockHttpClient = {
      post: jasmine.createSpy('post').and.returnValue(of({ success: true }))
    };

    await TestBed.configureTestingModule({
      imports: [VendorOnboardingComponent],
      providers: [
        provideRouter([]),
        { provide: DirectoryService, useValue: mockDirectoryService },
        { provide: HttpClient, useValue: mockHttpClient },
        {
          provide: RolePermissionService,
          useValue: {
            can: () => true
          }
        },
        {
          provide: SessionAuthService,
          useValue: {
            currentUser: { role: 'Organization Admin', username: 'admin' },
            user: () => ({ email: 'ops@flockwise.internal' })
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(VendorOnboardingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should initialize with default supplier mode', () => {
    expect(component).toBeTruthy();
    expect(component.form.vendorType).toBe('SUPPLIER');
    expect(component.form.code.startsWith('SU-')).toBeTrue();
  });

  it('should switch vendor type to DELIVERY_VENDOR', () => {
    component.selectType('DELIVERY_VENDOR');
    expect(component.form.vendorType).toBe('DELIVERY_VENDOR');
    expect(component.form.code.startsWith('VD-')).toBeTrue();
    expect(component.form.category).toBe('Wholesale Market Vendor');
  });

  it('validates required fields properly via validationError getter', () => {
    component.form.name = '';
    expect(component.validationError).toBe('Vendor / Business name is required.');

    component.form.name = 'Sunrise Farms';
    component.form.code = '';
    expect(component.validationError).toBe('Vendor code is required.');

    component.form.code = 'SU-001';
    component.form.contactPerson = '';
    expect(component.validationError).toBe('Primary contact person is required.');

    component.form.contactPerson = 'Ramesh';
    component.form.phone = '';
    expect(component.validationError).toBe('Phone number is required.');

    component.form.phone = '12345';
    expect(component.validationError).toBe('Enter a valid 10-digit phone number.');

    component.form.phone = '9876543210';
    component.form.address = '';
    expect(component.validationError).toBe('Physical address / pickup location is required.');

    component.form.address = 'NH 44 Farm Road';
    component.form.city = '';
    expect(component.validationError).toBe('City / Town is required.');

    component.form.city = 'Nashik';
    component.form.pincode = '123';
    expect(component.validationError).toBe('Enter a valid 6-digit PIN code.');
  });

  it('validates account number matching', () => {
    component.form.name = 'Sunrise Farms';
    component.form.code = 'SU-001';
    component.form.contactPerson = 'Ramesh';
    component.form.phone = '9876543210';
    component.form.address = 'NH 44 Farm Road';
    component.form.city = 'Nashik';
    component.form.pincode = '422001';

    component.form.accountNumber = '1234567890';
    component.form.confirmAccountNumber = '9876543210';
    expect(component.validationError).toBe('Bank account numbers do not match.');

    component.form.confirmAccountNumber = '1234567890';
    expect(component.validationError).toBe('');
  });

  it('validates IFSC, PAN, and GSTIN formatting', () => {
    component.form.name = 'Sunrise Farms';
    component.form.code = 'SU-001';
    component.form.contactPerson = 'Ramesh';
    component.form.phone = '9876543210';
    component.form.address = 'NH 44 Farm Road';
    component.form.city = 'Nashik';
    component.form.pincode = '422001';

    component.form.ifscCode = 'INVALID_IFSC';
    expect(component.validationError).toContain('valid 11-character IFSC');

    component.form.ifscCode = 'SBIN0001234';
    component.form.panNumber = 'INVALID_PAN';
    expect(component.validationError).toContain('valid 10-character PAN');

    component.form.panNumber = 'ABCDE1234F';
    component.form.gstin = 'INVALID_GSTIN';
    expect(component.validationError).toContain('valid 15-character GSTIN');

    component.form.gstin = '27ABCDE1234F1Z5';
    expect(component.validationError).toBe('');
  });

  it('successfully submits valid supplier form and saves to DirectoryService', async () => {
    component.form.name = 'Sunrise Broiler Farms';
    component.form.code = 'SU-001';
    component.form.contactPerson = 'Ramesh Patel';
    component.form.phone = '9876543210';
    component.form.address = 'NH 44 Farm Road';
    component.form.city = 'Nashik';
    component.form.state = 'Maharashtra';
    component.form.pincode = '422001';
    component.form.farmCapacity = 15000;
    component.form.paymentTerms = 'Credit - Net 7 Days';

    await component.submitOnboarding(false);

    expect(mockDirectoryService.createRecord).toHaveBeenCalledWith(
      'suppliers',
      jasmine.objectContaining({
        name: 'Sunrise Broiler Farms',
        code: 'SU-001',
        contact: 'Ramesh Patel',
        phone: '9876543210',
        location: 'Nashik'
      })
    );
    expect(component.saving).toBeFalse();
    expect(component.successMessage).toContain('onboarded successfully');
  });

  it('collapses and expands sections correctly', () => {
    component.collapseAll();
    expect(component.sections.identity).toBeFalse();
    expect(component.sections.operations).toBeFalse();
    expect(component.sections.commercial).toBeFalse();
    expect(component.sections.banking).toBeFalse();
    expect(component.sections.verification).toBeFalse();

    component.expandAll();
    expect(component.sections.identity).toBeTrue();
    expect(component.sections.operations).toBeTrue();
    expect(component.sections.commercial).toBeTrue();
    expect(component.sections.banking).toBeTrue();
    expect(component.sections.verification).toBeTrue();

    component.toggleSection('identity');
    expect(component.sections.identity).toBeFalse();
  });
});
