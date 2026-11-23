import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messagesSubject = new BehaviorSubject<ToastMessage[]>([]);
  readonly messages$ = this.messagesSubject.asObservable();
  private nextId = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(message: string, duration = 4000): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration = 5000): void {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration = 4500): void {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration = 4000): void {
    this.show(message, 'info', duration);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
    this.messagesSubject.next(this.messagesSubject.value.filter((item) => item.id !== id));
  }

  private show(message: string, type: ToastType, duration: number): void {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) return;

    const current = this.messagesSubject.value;
    if (current.length >= 4) {
      const oldest = current[0];
      const oldestTimer = this.timers.get(oldest.id);
      if (oldestTimer) clearTimeout(oldestTimer);
      this.timers.delete(oldest.id);
    }

    const id = ++this.nextId;
    this.messagesSubject.next([...current.slice(-3), { id, type, message }]);
    this.timers.set(id, setTimeout(() => this.dismiss(id), duration));
  }
}
