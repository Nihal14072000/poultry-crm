import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DirectoryColumn } from '../../../../../common/models/directory.model';
import { DirectoryService } from '../../../../../common/services/directory.service';
import { ModuleWorkflowService } from '../../../../../common/services/module-workflow.service';
import { WorkflowAction } from '../../../../../common/models/workflow.model';

@Component({
  selector: 'app-production-records',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './production-records.component.html',
  styleUrl: './production-records.component.css'
})
export class ProductionRecordsComponent {
  @Input() title = '';
  @Input() columns: DirectoryColumn[] = [];
  @Input() records: Record<string, string | number>[] = [];
  @Input() query = '';
  @Input() resource = '';
  @Output() queryChange = new EventEmitter<string>();
  saving = false;
  actionError = '';
  successMessage = '';

  constructor(private readonly directories: DirectoryService, private readonly workflows: ModuleWorkflowService) {}

  get hasWorkflow(): boolean {
    return this.workflows.getStatuses(this.resource).length > 0;
  }

  get filteredRecords(): Record<string, string | number>[] {
    const term = this.query.trim().toLowerCase();
    if (!term) return this.records;
    return this.records.filter((record) => Object.values(record).some((value) => String(value).toLowerCase().includes(term)));
  }

  updateQuery(query: string): void {
    this.query = query;
    this.queryChange.emit(query);
  }

  statusClass(value: string | number): string {
    const status = String(value).toLowerCase();
    if (['on track', 'complete', 'completed', 'active'].includes(status)) return 'positive';
    if (['watch', 'setting', 'review'].includes(status)) return 'warning';
    return 'neutral';
  }

  workflowActions(record: Record<string, string | number>): WorkflowAction[] {
    return this.workflows.getActions(this.resource, record);
  }

  runWorkflowAction(record: Record<string, string | number>, action: WorkflowAction): void {
    const id = String(record['_demoId'] ?? '');
    if (!id || this.saving) return;
    this.saving = true;
    this.actionError = '';
    this.successMessage = '';
    this.directories.updateRecord(this.resource, id, { ...record, status: action.nextStatus }).subscribe({
      next: (updated) => {
        this.records = this.records.map((current) => current['_demoId'] === id ? updated : current);
        this.successMessage = `${action.label} completed. Status is now ${action.nextStatus}.`;
        this.saving = false;
      },
      error: () => {
        this.actionError = `Could not ${action.label.toLowerCase()}. The record was not changed.`;
        this.saving = false;
      }
    });
  }
}
