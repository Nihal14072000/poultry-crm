import { Component } from '@angular/core';
import { ProductionPageComponent } from '../production/production-page.component';

@Component({
  selector: 'app-broiler',
  standalone: true,
  imports: [ProductionPageComponent],
  templateUrl: './broiler.component.html'
})
export class BroilerComponent {}
