import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'statusPill',
  standalone: true
})
export class StatusPillPipe implements PipeTransform {
  transform(value: unknown): string {
    const status = String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');

    if (/\b(fail(?:ed|ure)?|error|rejected|declined|void|cancelled|canceled|exception)\b/.test(status)) {
      return 'status-pill--failure';
    }
    if (/\b(partially delivered|in transit|in progress|pending|processing|review|dispatched|started|active|awaiting|reconciliation|underway)\b/.test(status)) {
      return 'status-pill--in-progress';
    }
    if (/\b(completed?|delivered|paid|settled|success(?:ful)?|closed|reconciled)\b/.test(status)) {
      return 'status-pill--completed';
    }
    if (/\b(open|assigned|created|draft|available|unassigned|new)\b/.test(status)) {
      return 'status-pill--open';
    }
    return 'status-pill--neutral';
  }
}
