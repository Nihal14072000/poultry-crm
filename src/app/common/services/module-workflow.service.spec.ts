import { ModuleWorkflowService } from './module-workflow.service';

describe('ModuleWorkflowService', () => {
  let service: ModuleWorkflowService;

  beforeEach(() => {
    service = new ModuleWorkflowService();
  });

  it('returns only actions valid for the current flock status', () => {
    expect(service.getActions('batches', { status: 'Active' })).toEqual([
      { label: 'Mark ready for sale', nextStatus: 'Ready for sale' }
    ]);
    expect(service.getActions('batches', { status: 'Closed' })).toEqual([]);
  });

  it('supports sales progressing from confirmation through delivery', () => {
    expect(service.getActions('sales', { status: 'In transit' })).toEqual([
      { label: 'Confirm delivery', nextStatus: 'Delivered' }
    ]);
  });

  it('resolves status transitions without depending on case', () => {
    expect(service.getActions('quotations', { status: 'sent' })).toContain({
      label: 'Accept quotation',
      nextStatus: 'Accepted'
    });
  });

  it('provides constrained initial statuses for new workflow records', () => {
    expect(service.getInitialStatuses('transfers')).toEqual(['Created']);
    expect(service.getInitialStatuses('orders')).toEqual(['Draft']);
    expect(service.getInitialStatuses('unknown-resource')).toEqual([]);
  });

  it('does not provide lifecycle actions for immutable stock ledger records', () => {
    expect(service.getActions('stock-ledger', { status: 'In transit' })).toEqual([]);
  });

  it('returns configured uniqueness fields for master records', () => {
    expect(service.getUniqueFields('products')).toEqual(['sku']);
    expect(service.getUniqueFields('unknown-resource')).toEqual([]);
  });
});
