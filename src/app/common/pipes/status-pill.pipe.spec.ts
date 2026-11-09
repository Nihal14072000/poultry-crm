import { StatusPillPipe } from './status-pill.pipe';

describe('StatusPillPipe', () => {
  const pipe = new StatusPillPipe();

  it('maps completion, progress, open, and failure statuses to the shared tones', () => {
    expect(pipe.transform('Completed')).toBe('status-pill--completed');
    expect(pipe.transform('Partially Delivered')).toBe('status-pill--in-progress');
    expect(pipe.transform('In transit')).toBe('status-pill--in-progress');
    expect(pipe.transform('Pending reconciliation')).toBe('status-pill--in-progress');
    expect(pipe.transform('Assigned')).toBe('status-pill--open');
    expect(pipe.transform('FAILED')).toBe('status-pill--failure');
  });

  it('uses the neutral tone for unclassified values', () => {
    expect(pipe.transform('Deleted')).toBe('status-pill--neutral');
    expect(pipe.transform(null)).toBe('status-pill--neutral');
  });
});
