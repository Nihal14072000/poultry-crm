import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Injectable({ providedIn: 'root' })
export class ToastService {
  constructor(private readonly toastr: ToastrService) {}

  success(message: string, duration = 4000): void {
    this.toastr.success(message, undefined, { timeOut: duration });
  }

  error(message: string, duration = 5000): void {
    this.toastr.error(message, undefined, { timeOut: duration });
  }

  warning(message: string, duration = 4500): void {
    this.toastr.warning(message, undefined, { timeOut: duration });
  }

  info(message: string, duration = 4000): void {
    this.toastr.info(message, undefined, { timeOut: duration });
  }

  clear(): void {
    this.toastr.clear();
  }
}
