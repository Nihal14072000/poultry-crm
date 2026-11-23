import { Component, HostListener, Input } from '@angular/core';

@Component({
  selector: 'app-info-popover',
  standalone: true,
  templateUrl: './info-popover.component.html',
  styleUrl: './info-popover.component.css'
})
export class InfoPopoverComponent {
  @Input() title = 'Information';
  @Input() content = '';
  isOpen = false;

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  @HostListener('document:click')
  closeOnOutsideClick(): void {
    this.isOpen = false;
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.isOpen = false;
  }
}
