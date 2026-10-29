import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DirectoryService } from '../../../common/services/directory.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { SessionAuthService } from '../../../common/services/session-auth.service';
import { environment } from '../../../../environments/environment';

export type OnboardingVendorType = 'SUPPLIER' | 'DELIVERY_VENDOR';

export interface VendorOnboardingForm {
  vendorType: OnboardingVendorType;
  // 01. Business Identity
  code: string;
  name: string;
  category: string;
  contactPerson: string;
  designation: string;
  phone: string;
  alternatePhone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  // 02. Poultry & Operational Specs
  farmCapacity: number | null;
  currentOccupancy: number | null;
  dailyAvailableBirds: number | null;
  avgBirdWeightKg: number | null;
  breed: string;
  vehicleSuitability: string;
  dailyRequirementBirds: number | null;
  dailyRequirementKg: number | null;
  receivingWindow: string;
  deliveryFrequency: string;
  holdingCapacityBirds: number | null;
  preferredRoute: string;
  // 03. Commercial & Payment Terms
  paymentTerms: string;
  creditLimit: number | null;
  pricingBenchmark: string;
  baseRatePerKg: number | null;
  // 04. Banking & KYC
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifscCode: string;
  panNumber: string;
  gstin: string;
  fssaiLicense: string;
  // 05. Verification & Review
  status: 'Active' | 'Pending Verification';
  assignedSupervisor: string;
  notes: string;
}

function emptyOnboardingForm(type: OnboardingVendorType = 'SUPPLIER'): VendorOnboardingForm {
  return {
    vendorType: type,
    code: '',
    name: '',
    category: type === 'SUPPLIER' ? 'Broiler Farm' : 'Wholesale Market Vendor',
    contactPerson: '',
    designation: type === 'SUPPLIER' ? 'Farm Owner' : 'Shop Manager',
    phone: '',
    alternatePhone: '',
    email: '',
    address: '',
    city: 'Nashik',
    state: 'Maharashtra',
    pincode: '',
    farmCapacity: null,
    currentOccupancy: null,
    dailyAvailableBirds: null,
    avgBirdWeightKg: 2.1,
    breed: 'Cobb 430',
    vehicleSuitability: 'Heavy & Medium Truck (6-10 Ton)',
    dailyRequirementBirds: null,
    dailyRequirementKg: null,
    receivingWindow: '04:00 AM - 08:00 AM',
    deliveryFrequency: 'Daily',
    holdingCapacityBirds: null,
    preferredRoute: '',
    paymentTerms: 'Spot UPI / IMPS',
    creditLimit: 0,
    pricingBenchmark: 'Daily Paper Rate',
    baseRatePerKg: null,
    accountHolder: '',
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    panNumber: '',
    gstin: '',
    fssaiLicense: '',
    status: 'Active',
    assignedSupervisor: '',
    notes: ''
  };
}

@Component({
  selector: 'app-vendor-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './vendor-onboarding.component.html',
  styleUrl: './vendor-onboarding.component.css'
})
export class VendorOnboardingComponent implements OnInit {
  form: VendorOnboardingForm = emptyOnboardingForm('SUPPLIER');
  saving = false;
  submitted = false;
  errorMessage = '';
  successMessage = '';
  lastOnboardedCode = '';
  lastOnboardedName = '';
  lastOnboardedType: OnboardingVendorType = 'SUPPLIER';

  // Section collapse states
  sections = {
    identity: true,
    operations: true,
    commercial: true,
    banking: true,
    verification: true
  };

  readonly supplierCategories = [
    'Broiler Farm',
    'Breeder Farm',
    'Layer Farm',
    'Culls Vendor',
    'Feed Mill',
    'Hatchery Supplier',
    'Veterinary Supplies',
    'General Poultry Supplier'
  ];

  readonly deliveryVendorCategories = [
    'Wholesale Market Vendor',
    'Retail Chicken Center',
    'Processing Plant / Dressing Unit',
    'Live Bird Trading Desk',
    'Restaurant / Hotel Supplier',
    'Institutional Canteen Buyer'
  ];

  readonly breeds = ['Cobb 430', 'Ross 308', 'Hubbards', 'Desi / Country Fowl', 'Kadaknath', 'Other'];
  readonly vehicleSuitabilities = [
    'Heavy Truck (10+ Ton / 4000+ Birds)',
    'Medium Truck (6-8 Ton / 2500-3500 Birds)',
    'Light Commercial Vehicle (Tata 407 / Eicher 1500-2000 Birds)',
    'Pickup / Bolero (500-1000 Birds)',
    'Three-Wheeler / Local Cart (< 300 Birds)'
  ];

  readonly paymentTermsOptions = [
    'Spot UPI / IMPS',
    'Cash on Handover',
    'Bank Transfer (NEFT/RTGS)',
    'Credit - Net 7 Days',
    'Credit - Net 15 Days',
    'Credit - Net 30 Days',
    'Advance Payment Required'
  ];

  readonly pricingBenchmarks = [
    'Daily Paper Rate',
    'Fixed Contract Rate (₹/kg)',
    'Paper Rate Minus Commission',
    'Spot Market Negotiated'
  ];

  readonly cities = ['Nashik', 'Pune', 'Sangamner', 'Ahmednagar', 'Dhule', 'Malegaon', 'Mumbai', 'Thane', 'Kolhapur', 'Solapur', 'Other'];
  existingSuppliersCount = 0;
  existingDeliveryVendorsCount = 0;

  constructor(
    private readonly directories: DirectoryService,
    private readonly rolePermissions: RolePermissionService,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    readonly auth: SessionAuthService
  ) {}

  async ngOnInit(): Promise<void> {
    const typeParam = this.activatedRoute.snapshot.queryParamMap.get('type');
    if (typeParam === 'delivery-vendor' || typeParam === 'buyer' || typeParam === 'seller') {
      this.form.vendorType = 'DELIVERY_VENDOR';
      this.form.category = 'Wholesale Market Vendor';
      this.form.designation = 'Shop Manager';
    }
    await this.loadExistingCounts();
    this.suggestCode();
  }

  async loadExistingCounts(): Promise<void> {
    try {
      const [suppliersData, deliveryData] = await Promise.all([
        firstValueFrom(this.directories.getDirectory('suppliers').pipe(catchError(() => of({ records: [] })))),
        firstValueFrom(this.directories.getDirectory('vendor-destinations').pipe(catchError(() => of({ records: [] }))))
      ]);
      this.existingSuppliersCount = suppliersData.records?.length ?? 0;
      this.existingDeliveryVendorsCount = deliveryData.records?.length ?? 0;
    } catch {
      // Non-blocking fallback
    }
  }

  selectType(type: OnboardingVendorType): void {
    if (this.form.vendorType === type) return;
    this.form.vendorType = type;
    this.form.category = type === 'SUPPLIER' ? 'Broiler Farm' : 'Wholesale Market Vendor';
    this.form.designation = type === 'SUPPLIER' ? 'Farm Owner' : 'Shop Manager';
    this.suggestCode();
  }

  suggestCode(): void {
    if (this.form.code && !/^SU-\d+|^VD-\d+/.test(this.form.code)) return;
    if (this.form.vendorType === 'SUPPLIER') {
      const nextNum = String(this.existingSuppliersCount + 1).padStart(3, '0');
      this.form.code = `SU-${nextNum}`;
    } else {
      const nextNum = String(this.existingDeliveryVendorsCount + 1).padStart(3, '0');
      this.form.code = `VD-${nextNum}`;
    }
  }

  toggleSection(section: keyof typeof this.sections): void {
    this.sections[section] = !this.sections[section];
  }

  expandAll(): void {
    for (const key of Object.keys(this.sections) as (keyof typeof this.sections)[]) {
      this.sections[key] = true;
    }
  }

  collapseAll(): void {
    for (const key of Object.keys(this.sections) as (keyof typeof this.sections)[]) {
      this.sections[key] = false;
    }
  }

  get canOnboard(): boolean {
    const resource = this.form.vendorType === 'SUPPLIER' ? 'suppliers' : 'vendor-destinations';
    return this.rolePermissions.can(resource, 'create') || this.auth.currentUser?.role === 'Organization Admin';
  }

  get validationError(): string {
    const f = this.form;
    if (!f.name.trim()) return 'Vendor / Business name is required.';
    if (!f.code.trim()) return 'Vendor code is required.';
    if (!f.contactPerson.trim()) return 'Primary contact person is required.';
    if (!f.phone.trim()) return 'Phone number is required.';
    const digits = f.phone.replace(/\D/g, '');
    if (digits.length < 10) return 'Enter a valid 10-digit phone number.';
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'Enter a valid email address.';
    if (!f.address.trim()) return 'Physical address / pickup location is required.';
    if (!f.city.trim()) return 'City / Town is required.';
    if (f.pincode && !/^\d{6}$/.test(f.pincode.trim())) return 'Enter a valid 6-digit PIN code.';
    if (f.accountNumber && f.confirmAccountNumber && f.accountNumber.trim() !== f.confirmAccountNumber.trim()) {
      return 'Bank account numbers do not match.';
    }
    if (f.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(f.ifscCode.trim())) {
      return 'Enter a valid 11-character IFSC code (e.g. SBIN0001234).';
    }
    if (f.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(f.panNumber.trim())) {
      return 'Enter a valid 10-character PAN number (e.g. ABCDE1234F).';
    }
    if (f.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(f.gstin.trim())) {
      return 'Enter a valid 15-character GSTIN.';
    }
    if (f.creditLimit !== null && f.creditLimit < 0) {
      return 'Credit limit cannot be negative.';
    }
    return '';
  }

  async submitOnboarding(onboardAnother = false): Promise<void> {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.canOnboard) {
      this.errorMessage = 'You do not have permission to onboard vendors.';
      return;
    }

    const error = this.validationError;
    if (error) {
      this.errorMessage = error;
      return;
    }

    this.saving = true;
    const f = this.form;
    const isSupplier = f.vendorType === 'SUPPLIER';
    const fullAddress = [f.address.trim(), f.city.trim(), `${f.state} - ${f.pincode}`.trim()].filter(Boolean).join(', ');
    const contactSummary = f.contactPerson.trim()
      ? (f.phone.trim() ? `${f.contactPerson.trim()} (${f.phone.trim()})`.slice(0, 50) : f.contactPerson.trim().slice(0, 50))
      : f.phone.trim().slice(0, 50);

    try {
      if (isSupplier) {
        // 1. Persist to Directory 'suppliers'
        const supplierRecord: Record<string, string | number> = {
          code: f.code.trim().toUpperCase(),
          name: f.name.trim(),
          category: f.category,
          phone: f.phone.trim(),
          alternatePhone: f.alternatePhone.trim(),
          email: f.email.trim(),
          contact: f.contactPerson.trim(),
          designation: f.designation.trim(),
          location: f.city.trim(),
          address: fullAddress,
          farmCapacity: f.farmCapacity ?? 0,
          currentOccupancy: f.currentOccupancy ?? 0,
          dailyAvailableBirds: f.dailyAvailableBirds ?? 0,
          avgBirdWeightKg: f.avgBirdWeightKg ?? 0,
          breed: f.breed,
          vehicleSuitability: f.vehicleSuitability,
          preferredRoute: f.preferredRoute.trim(),
          paymentTerms: f.paymentTerms,
          creditLimit: f.creditLimit ?? 0,
          pricingBenchmark: f.pricingBenchmark,
          bankName: f.bankName.trim(),
          accountHolder: f.accountHolder.trim() || f.name.trim(),
          accountNumber: f.accountNumber.trim(),
          ifscCode: f.ifscCode.trim().toUpperCase(),
          pan: f.panNumber.trim().toUpperCase(),
          gstin: f.gstin.trim().toUpperCase(),
          orders: '0',
          outstanding: '₹0',
          status: f.status,
          notes: f.notes.trim()
        };

        await firstValueFrom(this.directories.createRecord('suppliers', supplierRecord));

        // 2. Also attempt backend API persistence to /api/buying-parties
        try {
          await firstValueFrom(this.http.post(`${environment.apiUrl}/buying-parties`, {
            name: f.name.trim(),
            contact: contactSummary,
            location: fullAddress,
            isActive: f.status === 'Active'
          }).pipe(catchError(() => of(null))));
        } catch {
          // Backend API is optional if operating on mock data adapter
        }

        this.existingSuppliersCount++;
      } else {
        // 1. Persist to Directory 'vendor-destinations'
        const deliveryVendorRecord: Record<string, string | number> = {
          code: f.code.trim().toUpperCase(),
          name: f.name.trim(),
          category: f.category,
          address: fullAddress,
          contact: f.contactPerson.trim(),
          designation: f.designation.trim(),
          phone: f.phone.trim(),
          alternatePhone: f.alternatePhone.trim(),
          email: f.email.trim(),
          location: f.city.trim(),
          dailyRequirementBirds: f.dailyRequirementBirds ?? 0,
          dailyRequirementKg: f.dailyRequirementKg ?? 0,
          receivingWindow: f.receivingWindow,
          deliveryFrequency: f.deliveryFrequency,
          holdingCapacityBirds: f.holdingCapacityBirds ?? 0,
          preferredRoute: f.preferredRoute.trim(),
          paymentTerms: f.paymentTerms,
          creditLimit: f.creditLimit ?? 0,
          pricingBenchmark: f.pricingBenchmark,
          bankName: f.bankName.trim(),
          accountHolder: f.accountHolder.trim() || f.name.trim(),
          accountNumber: f.accountNumber.trim(),
          ifscCode: f.ifscCode.trim().toUpperCase(),
          pan: f.panNumber.trim().toUpperCase(),
          gstin: f.gstin.trim().toUpperCase(),
          status: f.status,
          notes: f.notes.trim()
        };

        await firstValueFrom(this.directories.createRecord('vendor-destinations', deliveryVendorRecord));

        // 2. Also attempt backend API persistence to /api/selling-parties
        try {
          await firstValueFrom(this.http.post(`${environment.apiUrl}/selling-parties`, {
            name: f.name.trim(),
            contact: contactSummary,
            location: fullAddress,
            isActive: f.status === 'Active'
          }).pipe(catchError(() => of(null))));
        } catch {
          // Backend API optional
        }

        this.existingDeliveryVendorsCount++;
      }

      this.lastOnboardedCode = f.code.trim().toUpperCase();
      this.lastOnboardedName = f.name.trim();
      this.lastOnboardedType = f.vendorType;

      this.successMessage = `${isSupplier ? 'Supplier (Farm Pickup)' : 'Delivery Vendor (Buyer)'} "${f.name.trim()}" onboarded successfully with code ${this.lastOnboardedCode}.`;

      if (onboardAnother) {
        const nextType = this.form.vendorType;
        this.form = emptyOnboardingForm(nextType);
        this.suggestCode();
        this.submitted = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Option to navigate to directory view or keep view visible
      }
    } catch (e) {
      this.errorMessage = e instanceof Error ? e.message : 'The vendor record could not be saved.';
    } finally {
      this.saving = false;
    }
  }

  cancel(): void {
    void this.router.navigate([this.form.vendorType === 'SUPPLIER' ? '/trading/suppliers' : '/trading/vendor-destinations']);
  }
}
