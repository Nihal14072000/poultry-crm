import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './help.component.html',
  styleUrl: './help.component.css'
})
export class HelpComponent {
  name = '';
  email = '';
  topic = 'General question';
  message = '';
  submitted = false;

  submitRequest(): void {
    this.submitted = true;
  }
}
