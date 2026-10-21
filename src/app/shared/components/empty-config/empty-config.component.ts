import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Shown in place of a view when the user hasn't picked any teams or series yet. */
@Component({
  selector: 'app-empty-config',
  imports: [RouterLink],
  templateUrl: './empty-config.component.html',
  styleUrl: './empty-config.component.scss',
})
export class EmptyConfigComponent {}
