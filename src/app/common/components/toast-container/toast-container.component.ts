import { Component, OnInit, ViewChild } from '@angular/core';
import { ToastContainerDirective, ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [ToastContainerDirective],
  templateUrl: './toast-container.component.html'
})
export class ToastContainerComponent implements OnInit {
  @ViewChild(ToastContainerDirective, { static: true })
  private toastContainer!: ToastContainerDirective;

  constructor(private readonly toastr: ToastrService) {}

  ngOnInit(): void {
    this.toastr.overlayContainer = this.toastContainer;
  }
}
