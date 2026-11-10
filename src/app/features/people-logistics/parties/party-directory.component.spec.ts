import { ActivatedRoute } from '@angular/router';
import { RolePermissionService } from '../../../common/services/role-permission.service';
import { PartyDirectoryRecord, TripApiService } from '../../../common/services/trip-api.service';
import { PartyDirectoryComponent } from './party-directory.component';

describe('PartyDirectoryComponent', () => {
  let tripApi: jasmine.SpyObj<TripApiService>;
  let permissions: jasmine.SpyObj<RolePermissionService>;
  let component: PartyDirectoryComponent;

  beforeEach(() => {
    tripApi = jasmine.createSpyObj<TripApiService>('TripApiService', ['getBuyingParties', 'getSellingParties', 'createParty', 'updateParty']);
    tripApi.createParty.and.resolveTo();
    tripApi.updateParty.and.resolveTo();
    permissions = jasmine.createSpyObj<RolePermissionService>('RolePermissionService', ['can']);
    permissions.can.and.returnValue(true);
    component = new PartyDirectoryComponent({} as ActivatedRoute, tripApi, permissions);
  });

  it('loads buying parties from the buying-party endpoint', async () => {
    const records: PartyDirectoryRecord[] = [{
      _demoId: '1', id: 1, name: 'Supplier', contact: '', location: '',
      isActive: false, isDeleted: false, status: 'Inactive'
    }];
    tripApi.getBuyingParties.and.resolveTo(records);
    component.partyType = 'buying';

    await component.loadParties();

    expect(component.records).toEqual(records);
    expect(tripApi.getBuyingParties).toHaveBeenCalled();
    expect(tripApi.getSellingParties).not.toHaveBeenCalled();
  });

  it('loads selling parties from the selling-party endpoint', async () => {
    const records: PartyDirectoryRecord[] = [{
      _demoId: '2', id: 2, name: 'Buyer', contact: '', location: '',
      isActive: true, isDeleted: false, status: 'Active'
    }];
    tripApi.getSellingParties.and.resolveTo(records);
    component.partyType = 'selling';

    await component.loadParties();

    expect(component.records).toEqual(records);
    expect(tripApi.getSellingParties).toHaveBeenCalled();
    expect(tripApi.getBuyingParties).not.toHaveBeenCalled();
  });

  it('creates a party using the selected party type and reloads the directory', async () => {
    tripApi.getBuyingParties.and.resolveTo([]);
    component.partyType = 'buying';
    component.title = 'Buying parties';
    component.partyForm = { name: '  Farm supplier  ', contact: '  Pat  ', location: '  Nashik  ', isActive: true };

    await component.createParty();

    expect(tripApi.createParty).toHaveBeenCalledWith('buying', {
      name: 'Farm supplier', contact: 'Pat', location: 'Nashik', isActive: true
    });
    expect(tripApi.getBuyingParties).toHaveBeenCalled();
    expect(component.successMessage).toBe('Buying party added successfully.');
    expect(component.editorOpen).toBeFalse();
  });

  it('requires a party name before submitting', async () => {
    component.partyForm.name = '  ';

    await component.createParty();

    expect(component.formError).toBe('Enter a party name.');
    expect(tripApi.createParty).not.toHaveBeenCalled();
  });

  it('updates the selected party with edited fields', async () => {
    tripApi.getBuyingParties.and.resolveTo([]);
    component.partyType = 'buying';
    component.title = 'Buying parties';
    const party: PartyDirectoryRecord = {
      _demoId: '31', id: 31, name: 'Old name', contact: 'Pat', location: 'Nashik', isActive: true, isDeleted: false, status: 'Active'
    };
    component.openEdit(party);
    component.partyForm.name = 'New name';

    await component.createParty();

    expect(tripApi.updateParty).toHaveBeenCalledWith('buying', '31', {
      name: 'New name', contact: 'Pat', location: 'Nashik', isActive: true, isDeleted: false
    });
    expect(component.successMessage).toBe('Buying party updated successfully.');
  });

  it('soft-deletes a party through the update API', async () => {
    tripApi.getSellingParties.and.resolveTo([]);
    component.partyType = 'selling';
    component.deleteCandidate = {
      _demoId: '52', id: 52, name: 'Market buyer', contact: 'Desk', location: 'Pune', isActive: true, isDeleted: false, status: 'Active'
    };

    await component.deleteParty();

    expect(tripApi.updateParty).toHaveBeenCalledWith('selling', '52', {
      name: 'Market buyer', contact: 'Desk', location: 'Pune', isActive: false, isDeleted: true
    });
    expect(component.deleteCandidate).toBeUndefined();
  });
});
