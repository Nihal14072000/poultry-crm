import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

export interface GridAction {
  label: string;
  action: string;
  disabled?: boolean;
}

interface GridActionsParams extends ICellRendererParams {
  actions?: GridAction[];
  onAction?: (action: string, row: object) => void;
}

@Component({
  selector: 'app-grid-actions-cell',
  standalone: true,
  template: `<span class="grid-actions">@for (item of actions; track item.action) { <button type="button" [disabled]="item.disabled" (click)="run(item.action)">{{ item.label }}</button> }</span>`,
  styles: [`
    .grid-actions { display: flex; flex-wrap: wrap; gap: 4px; }
    button { background: #eef4ed; border: 0; border-radius: 4px; color: #396447; cursor: pointer; font: inherit; font-size: 11px; padding: 4px 7px; }
    button:disabled { cursor: wait; opacity: .5; }
  `]
})
export class GridActionsCellComponent implements ICellRendererAngularComp {
  actions: GridAction[] = [];
  private params?: GridActionsParams;

  agInit(params: GridActionsParams): void {
    this.params = params;
    this.actions = params.actions ?? (Array.isArray(params.value) ? params.value as GridAction[] : []);
  }

  refresh(params: GridActionsParams): boolean {
    this.agInit(params);
    return true;
  }

  run(action: string): void {
    if (this.params?.data) this.params.onAction?.(action, this.params.data);
  }
}
