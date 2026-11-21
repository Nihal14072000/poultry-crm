import { Component, Input } from '@angular/core';

export type LoadingSkeletonVariant = 'dashboard' | 'overview' | 'table' | 'detail' | 'form' | 'finance';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  templateUrl: './loading-skeleton.component.html',
  styleUrl: './loading-skeleton.component.css'
})
export class LoadingSkeletonComponent {
  @Input() variant: LoadingSkeletonVariant = 'table';

  readonly cards = [1, 2, 3, 4];
  readonly rows = [1, 2, 3, 4, 5, 6];
  readonly columns = [1, 2, 3, 4, 5, 6];
}
