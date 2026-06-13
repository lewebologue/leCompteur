import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { toSignal } from '@angular/core/rxjs-interop';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { SessionService } from '../../core/services/session.service';
import { DecimalPipe } from '@angular/common';

const pad = (n: number): string => String(n).padStart(2, '0');

@Component({
  selector: 'app-speedometer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, DecimalPipe],
  templateUrl: './speed-page.component.html',
  styleUrls: ['./speed-page.component.scss'],
})
export class SpeedometerPage {
  readonly stats = toSignal(this.session.stats$);

  readonly R             = 90;
  readonly CIRCUMFERENCE = 2 * Math.PI * this.R; 
  readonly ARC_LENGTH    = this.CIRCUMFERENCE * 0.75;
  readonly ARC_GAP       = this.CIRCUMFERENCE * 0.25;

  readonly TRACK_DASHARRAY = `${this.ARC_LENGTH} ${this.ARC_GAP}`;

  constructor(private readonly session: SessionService) {}

  formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0
      ? `${h}:${pad(m)}:${pad(s)}`
      : `${pad(m)}:${pad(s)}`;
  }

  formatDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  }

  progressDasharray(speed: number, maxSpeed: number): string {
    const scale  = Math.max(maxSpeed, 40);
    const ratio  = Math.min(speed / scale, 1);
    const filled = this.ARC_LENGTH * ratio;
    return `${filled} ${this.CIRCUMFERENCE}`;
  }

  arcColor(speed: number): string {
    if (speed < 25) return '#00C9A7';
    if (speed < 40) return '#F5A623';
    return '#FF4757';
  }

  // ── Contrôles de session ────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.session.start();
    await KeepAwake.keepAwake().catch(() => { /* Web fallback silencieux */ });
  }

  pause(): void {
    this.session.pause();
  }

  async resume(): Promise<void> {
    this.session.resume();
    await KeepAwake.keepAwake().catch(() => {});
  }

  async stop(): Promise<void> {
    this.session.stop();
    await KeepAwake.allowSleep().catch(() => {});
  }
}