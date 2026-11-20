import { Component, Input } from '@angular/core';

type PartySkeletonVariant = 'directory' | 'details';

@Component({
  selector: 'app-party-loading-skeleton',
  standalone: true,
  templateUrl: './party-loading-skeleton.component.html',
  styleUrl: './party-loading-skeleton.component.css'
})
export class PartyLoadingSkeletonComponent {
  @Input() variant: PartySkeletonVariant = 'directory';

  readonly rows = [1, 2, 3, 4, 5];
  readonly directoryColumns = [1, 2, 3, 4, 5, 6];
  readonly detailColumns = [1, 2, 3, 4, 5, 6, 7];
}
