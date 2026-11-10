import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PartyDirectoryRecord, TripApiService } from '../../../common/services/trip-api.service';
import { RolePermissionService } from '../../../common/services/role-permission.service';

type PartyType = 'buying' | 'selling';

@Component({
  selector: 'app-party-directory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './party-directory.component.html',
  styleUrl: './party-directory.component.css'
})
export class PartyDirectoryComponent implements OnInit {
  title = '';
  partyType: PartyType = 'buying';
  records: PartyDirectoryRecord[] = [];
  loading = true;
  errorMessage = '';
  saving = false;
  editorOpen = false;
  editorMode: 'create' | 'edit' = 'create';
  editingParty?: PartyDirectoryRecord;
  deleteCandidate?: PartyDirectoryRecord;
  successMessage = '';
  actionError = '';
  formError = '';
  partyForm = { name: '', contact: '', location: '', isActive: true };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly tripApi: TripApiService,
    private readonly rolePermissions: RolePermissionService
  ) {}

  ngOnInit(): void {
    this.title = this.route.snapshot.data['title'];
    this.partyType = this.route.snapshot.data['partyType'];
    void this.loadParties();
  }

  get canCreate(): boolean {
    return this.rolePermissions.can(this.permissionResource, 'create');
  }

  get canUpdate(): boolean {
    return this.rolePermissions.can(this.permissionResource, 'update');
  }

  get canDelete(): boolean {
    return this.rolePermissions.can(this.permissionResource, 'delete');
  }

  private get permissionResource(): string {
    return this.partyType === 'buying' ? 'suppliers' : 'vendor-destinations';
  }

  openCreate(): void {
    if (!this.canCreate) return;
    this.editorMode = 'create';
    this.editingParty = undefined;
    this.partyForm = { name: '', contact: '', location: '', isActive: true };
    this.formError = '';
    this.editorOpen = true;
  }

  openEdit(party: PartyDirectoryRecord): void {
    if (!this.canUpdate || party['isDeleted'] === true) return;
    this.editorMode = 'edit';
    this.editingParty = party;
    this.partyForm = {
      name: String(party['name'] ?? ''),
      contact: String(party['contact'] ?? ''),
      location: String(party['location'] ?? ''),
      isActive: party['isActive'] === true
    };
    this.formError = '';
    this.actionError = '';
    this.editorOpen = true;
  }

  closeEditor(): void {
    if (this.saving) return;
    this.editorOpen = false;
    this.editingParty = undefined;
    this.formError = '';
  }

  async createParty(): Promise<void> {
    if (this.editorMode === 'create' ? !this.canCreate : !this.canUpdate) return;
    if (this.editorMode === 'edit' && !this.editingParty) return;
    const party = {
      name: this.partyForm.name.trim(),
      contact: this.partyForm.contact.trim(),
      location: this.partyForm.location.trim(),
      isActive: this.partyForm.isActive
    };
    if (!party.name) {
      this.formError = 'Enter a party name.';
      return;
    }

    this.saving = true;
    this.formError = '';
    this.successMessage = '';
    this.actionError = '';
    try {
      if (this.editorMode === 'edit' && this.editingParty) {
        await this.tripApi.updateParty(this.partyType, String(this.editingParty['_demoId']), {
          ...party,
          isDeleted: false
        });
      } else {
        await this.tripApi.createParty(this.partyType, party);
      }
      this.editorOpen = false;
      this.editingParty = undefined;
      this.successMessage = `${this.partyType === 'buying' ? 'Buying party' : 'Selling party'} ${this.editorMode === 'edit' ? 'updated' : 'added'} successfully.`;
      await this.loadParties();
    } catch {
      this.formError = `The party could not be ${this.editorMode === 'edit' ? 'updated' : 'saved'}. Please try again.`;
    } finally {
      this.saving = false;
    }
  }

  requestDelete(party: PartyDirectoryRecord): void {
    if (!this.canDelete || party['isDeleted'] === true) return;
    this.deleteCandidate = party;
    this.successMessage = '';
    this.actionError = '';
  }

  cancelDelete(): void {
    if (this.saving) return;
    this.deleteCandidate = undefined;
    this.actionError = '';
  }

  async deleteParty(): Promise<void> {
    const party = this.deleteCandidate;
    const id = String(party?.['_demoId'] ?? '');
    if (!party || !id || !this.canDelete || party['isDeleted'] === true) return;

    this.saving = true;
    this.actionError = '';
    this.successMessage = '';
    try {
      await this.tripApi.updateParty(this.partyType, id, {
        name: String(party['name'] ?? ''),
        contact: String(party['contact'] ?? ''),
        location: String(party['location'] ?? ''),
        isActive: false,
        isDeleted: true
      });
      this.deleteCandidate = undefined;
      this.successMessage = `${this.partyType === 'buying' ? 'Buying party' : 'Selling party'} deleted successfully.`;
      await this.loadParties();
    } catch {
      this.actionError = 'The party could not be deleted. Please try again.';
    } finally {
      this.saving = false;
    }
  }

  async loadParties(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      this.records = this.partyType === 'buying'
        ? await this.tripApi.getBuyingParties()
        : await this.tripApi.getSellingParties();
    } catch {
      this.errorMessage = `We could not load ${this.title.toLowerCase()}. Please refresh to try again.`;
    } finally {
      this.loading = false;
    }
  }
}
