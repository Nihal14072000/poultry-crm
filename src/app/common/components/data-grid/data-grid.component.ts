import { Component, Input } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ClientSideRowModelModule, ColDef, GridOptions, ModuleRegistry } from 'ag-grid-community';

ModuleRegistry.registerModules([ClientSideRowModelModule]);

@Component({
  selector: 'app-data-grid',
  standalone: true,
  imports: [AgGridAngular],
  template: `<ag-grid-angular class="ag-theme-quartz app-ag-grid" [gridOptions]="gridOptions" [pagination]="pagination" [paginationPageSize]="paginationPageSize" [columnDefs]="columnDefs" [rowData]="rowData"></ag-grid-angular>`,
  styles: [`.app-ag-grid { width: 100%; }`]
})
export class DataGridComponent {
  @Input() columnDefs: ColDef[] = [];
  @Input() rowData: object[] = [];
  @Input() paginationPageSize = 10;
  @Input() pagination = true;

  readonly gridOptions: GridOptions = {
    defaultColDef: {
      filter: true,
      minWidth: 110,
      resizable: true,
      sortable: true
    },
    domLayout: 'autoHeight',
    pagination: true,
    paginationPageSize: 10,
    suppressCellFocus: false
  };
}
