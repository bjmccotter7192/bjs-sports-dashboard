import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DashboardConfigService } from './core/services/dashboard-config.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  menuOpen = signal(false);
  readonly title = inject(DashboardConfigService).title;

  constructor() {
    const pageTitle = inject(Title);
    effect(() => pageTitle.setTitle(this.title()));
  }

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth > 768) {
      this.menuOpen.set(false);
    }
  }
}
