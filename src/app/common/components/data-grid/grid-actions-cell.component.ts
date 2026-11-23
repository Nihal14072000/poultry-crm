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
  template: `
    <span class="grid-actions">
      @for (item of actions; track item.action) {
        <button
          type="button"
          [disabled]="item.disabled"
          [class.icon-action]="iconFor(item)"
          [attr.aria-label]="item.label"
          [attr.title]="item.label"
          (click)="run(item.action)">
          @if (iconFor(item); as icon) {
            <img [src]="icon" alt="" aria-hidden="true" />
          } @else {
            {{ item.label }}
          }
        </button>
      }
    </span>
  `,
  styles: [`
    .grid-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      background: #eef4ed;
      border: 0;
      border-radius: 5px;
      color: #396447;
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      padding: 4px 7px;
    }

    button.icon-action {
      width: 30px;
      height: 30px;
      min-height: 30px;
      padding: 6px;
      background: transparent;
      color: #475569;
    }

    button.icon-action:hover:not(:disabled) {
      background: #f1f5f9;
      color: #0f172a;
    }

    button:focus-visible {
      outline: 2px solid #64748b;
      outline-offset: 2px;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: .45;
    }

    img {
      display: block;
      width: 17px;
      height: 17px;
    }
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

  iconFor(item: GridAction): string | null {
    const labelWords = item.label.toLowerCase().split(/[^a-z]+/);
    if (labelWords.includes('edit')) return 'assets/icons/actions/edit.svg';
    if (labelWords.includes('delete')) return 'assets/icons/actions/delete.svg';
    if (labelWords.includes('view')) return 'assets/icons/actions/view.svg';
    return null;
  }

  run(action: string): void {
    if (this.params?.data) this.params.onAction?.(action, this.params.data);
  }
}
