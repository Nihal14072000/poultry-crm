import { Injectable } from '@angular/core';
import { ModuleWorkflow, WorkflowAction } from '../models/workflow.model';

const workflows: Record<string, ModuleWorkflow> = {
  farms: { transitions: [], uniqueFields: ['code'] },
  customers: { transitions: [], uniqueFields: ['code'] },
  suppliers: { transitions: [], uniqueFields: ['code'] },
  batches: {
    uniqueFields: ['batch'],
    transitions: [
      { from: 'Planned', action: 'Place flock', to: 'Placed' },
      { from: 'Placed', action: 'Activate flock', to: 'Active' },
      { from: 'Active', action: 'Mark ready for sale', to: 'Ready for sale' },
      { from: 'Ready for sale', action: 'Record partial sale', to: 'Partially sold' },
      { from: 'Ready for sale', action: 'Complete batch', to: 'Completed' },
      { from: 'Partially sold', action: 'Complete batch', to: 'Completed' },
      { from: 'Completed', action: 'Close batch', to: 'Closed' }
    ]
  },
  products: { uniqueFields: ['sku'], transitions: [{ from: 'Active', action: 'Deactivate product', to: 'Inactive' }, { from: 'Inactive', action: 'Activate product', to: 'Active' }] },
  warehouses: { uniqueFields: ['code'], transitions: [{ from: 'Active', action: 'Deactivate warehouse', to: 'Inactive' }, { from: 'Inactive', action: 'Activate warehouse', to: 'Active' }] },
  transfers: {
    uniqueFields: ['transfer'],
    transitions: [
      { from: 'Created', action: 'Dispatch transfer', to: 'In transit' },
      { from: 'In transit', action: 'Receive transfer', to: 'Received' }
    ]
  },
  quotations: {
    uniqueFields: ['quotation'],
    transitions: [
      { from: 'Draft', action: 'Send quotation', to: 'Sent' },
      { from: 'Sent', action: 'Accept quotation', to: 'Accepted' },
      { from: 'Sent', action: 'Decline quotation', to: 'Declined' }
    ]
  },
  orders: {
    uniqueFields: ['order'],
    transitions: [
      { from: 'Draft', action: 'Confirm order', to: 'Confirmed' },
      { from: 'Confirmed', action: 'Dispatch order', to: 'Dispatched' },
      { from: 'Dispatched', action: 'Complete order', to: 'Completed' }
    ]
  },
  sales: {
    uniqueFields: ['order'],
    transitions: [
      { from: 'Confirmed', action: 'Dispatch sale', to: 'Dispatched' },
      { from: 'Dispatched', action: 'Mark in transit', to: 'In transit' },
      { from: 'In transit', action: 'Confirm delivery', to: 'Delivered' },
      { from: 'Delivered', action: 'Complete sale', to: 'Completed' }
    ]
  },
  procurement: {
    uniqueFields: ['order'],
    transitions: [
      { from: 'Draft', action: 'Submit purchase order', to: 'Ordered' },
      { from: 'Ordered', action: 'Record receipt', to: 'Received' },
      { from: 'Partially received', action: 'Record receipt', to: 'Received' },
      { from: 'Received', action: 'Record supplier invoice', to: 'Invoiced' }
    ]
  },
  dispatch: {
    uniqueFields: ['delivery'],
    transitions: [
      { from: 'Created', action: 'Dispatch delivery', to: 'Dispatched' },
      { from: 'Dispatched', action: 'Mark in transit', to: 'In transit' },
      { from: 'In transit', action: 'Confirm delivery', to: 'Delivered' },
      { from: 'Delivered', action: 'Complete delivery', to: 'Completed' }
    ]
  },
  leads: {
    uniqueFields: ['lead'],
    transitions: [
      { from: 'New', action: 'Qualify lead', to: 'Qualified' },
      { from: 'Qualified', action: 'Convert to opportunity', to: 'Opportunity' },
      { from: 'Qualified', action: 'Disqualify lead', to: 'Disqualified' }
    ]
  },
  opportunities: {
    transitions: [
      { from: 'Open', action: 'Mark won', to: 'Won' },
      { from: 'Open', action: 'Mark lost', to: 'Lost' }
    ]
  },
  'follow-ups': {
    transitions: [
      { from: 'Open', action: 'Complete follow-up', to: 'Completed' },
      { from: 'Scheduled', action: 'Complete follow-up', to: 'Completed' },
      { from: 'Scheduled', action: 'Reschedule follow-up', to: 'Open' }
    ]
  },
  complaints: {
    uniqueFields: ['case'],
    transitions: [
      { from: 'Open', action: 'Investigate complaint', to: 'Investigating' },
      { from: 'Investigating', action: 'Resolve complaint', to: 'Resolved' }
    ]
  },
  health: {
    transitions: [
      { from: 'Open', action: 'Start investigation', to: 'Under review' },
      { from: 'Under review', action: 'Resolve incident', to: 'Resolved' }
    ]
  },
  medication: {
    uniqueFields: ['record'],
    transitions: [
      { from: 'Planned', action: 'Schedule treatment', to: 'Scheduled' },
      { from: 'Scheduled', action: 'Record administration', to: 'Administered' }
    ]
  },
  feed: {
    transitions: [
      { from: 'Planned', action: 'Record feed issue', to: 'Recorded' },
      { from: 'Review', action: 'Approve feed record', to: 'Recorded' }
    ]
  },
  hatchery: {
    transitions: [
      { from: 'Setting', action: 'Record candling', to: 'Candled' },
      { from: 'Candled', action: 'Transfer eggs', to: 'Transferred' },
      { from: 'Transferred', action: 'Start hatching', to: 'Hatching' },
      { from: 'Hatching', action: 'Complete hatch', to: 'Complete' },
      { from: 'In progress', action: 'Complete hatch', to: 'Complete' }
    ]
  },
  fleet: {
    uniqueFields: ['vehicle'],
    transitions: [
      { from: 'Available', action: 'Assign vehicle', to: 'Assigned' },
      { from: 'Assigned', action: 'Start trip', to: 'In transit' },
      { from: 'In transit', action: 'Complete trip', to: 'Available' }
    ]
  },
  vehicles: {
    uniqueFields: ['vehicle'],
    transitions: [
      { from: 'Active', action: 'Record vehicle sale', to: 'Sold' }
    ]
  },
  expenses: {
    uniqueFields: ['reference'],
    transitions: [
      { from: 'Pending', action: 'Approve expense', to: 'Approved' },
      { from: 'Approved', action: 'Mark paid', to: 'Paid' }
    ]
  },
  notifications: {
    transitions: [
      { from: 'Unread', action: 'Mark as read', to: 'Read' }
    ]
  }
};

const initialStatuses: Record<string, string> = {
  batches: 'Planned',
  products: 'Active',
  warehouses: 'Active',
  transfers: 'Created',
  quotations: 'Draft',
  orders: 'Draft',
  sales: 'Draft',
  procurement: 'Draft',
  dispatch: 'Created',
  leads: 'New',
  opportunities: 'Open',
  'follow-ups': 'Open',
  complaints: 'Open',
  health: 'Open',
  medication: 'Planned',
  feed: 'Planned',
  hatchery: 'Setting',
  fleet: 'Available',
  vehicles: 'Active',
  expenses: 'Pending',
  notifications: 'Unread'
};

@Injectable({ providedIn: 'root' })
export class ModuleWorkflowService {
  getActions(resource: string, record: Record<string, string | number>): WorkflowAction[] {
    const status = String(record['status'] ?? '').trim().toLocaleLowerCase();
    return (workflows[resource]?.transitions ?? [])
      .filter((transition) => transition.from.toLocaleLowerCase() === status)
      .map(({ action, to }) => ({ label: action, nextStatus: to }));
  }

  getStatuses(resource: string): string[] {
    const transitions = workflows[resource]?.transitions ?? [];
    return [...new Set(transitions.flatMap(({ from, to }) => [from, to]))];
  }

  getInitialStatuses(resource: string): string[] {
    const status = initialStatuses[resource];
    return status ? [status] : [];
  }

  getUniqueFields(resource: string): string[] {
    return workflows[resource]?.uniqueFields ?? [];
  }
}
