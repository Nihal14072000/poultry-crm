import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [RouterLink],
  template: `<main class="denied"><span>403</span><h1>Access not assigned</h1><p>Your current role does not have permission to view this area.</p><a routerLink="/workspace/overview">Back to workspace</a></main>`,
  styles: [`.denied{align-items:center;color:#334239;display:flex;flex-direction:column;justify-content:center;min-height:65vh;text-align:center}.denied>span{color:#8da18f;font-size:12px;font-weight:700;letter-spacing:.2em}.denied h1{font-size:25px;margin:12px 0 6px}.denied p{color:#7f8b82;font-size:13px}.denied a{color:#28764a;font-size:12px;font-weight:650;margin-top:12px;text-decoration:none}`]
})
export class AccessDeniedComponent {}
