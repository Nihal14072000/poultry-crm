import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-info-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './info-page.component.html',
  styleUrl: './info-page.component.css'
})
export class InfoPageComponent {
  readonly modules = [
    { number: '01', icon: '↗', title: 'Trips & logistics', description: 'Coordinate trips, deliveries, vehicles and day-to-day movement from one workspace.', tone: 'sage' },
    { number: '02', icon: '◎', title: 'Business partners', description: 'Keep buying parties, selling parties, suppliers and business details organised.', tone: 'blue' },
    { number: '03', icon: '▤', title: 'Orders & operations', description: 'Connect orders with trips, pickups and deliveries for clearer execution.', tone: 'amber' },
    { number: '04', icon: '₹', title: 'Finance & payments', description: 'Track expenses, payments, receivables and payables alongside operations.', tone: 'lavender' },
    { number: '05', icon: '▥', title: 'Reports & insights', description: 'Review operational activity and business performance with reports.', tone: 'blue' },
    { number: '06', icon: '♙', title: 'Team & permissions', description: 'Manage employees and control access with role-based permissions.', tone: 'sage' }
  ];

  readonly benefits = [
    { title: 'One connected workflow', detail: 'Keep business activity linked instead of scattered across separate tools.' },
    { title: 'Better day-to-day visibility', detail: 'See trips, deliveries, payments and outstanding work more clearly.' },
    { title: 'Accountability by role', detail: 'Give team members access aligned with their responsibilities.' }
  ];
}
