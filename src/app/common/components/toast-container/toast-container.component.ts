import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ToastMessage, ToastService, ToastType } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.css'
})
export class ToastContainerComponent {
  readonly messages$ = this.toasts.messages$;

  constructor(private readonly toasts: ToastService) {}

  dismiss(id: number): void {
    this.toasts.dismiss(id);
  }

  iconFor(type: ToastType): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '!';
      case 'warning': return '⚠';
      default: return 'i';
    }
  }
}
