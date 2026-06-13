import { inject, Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, interval, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { GpsService } from './gps.service';
import { GpsPoint } from 'src/app/shared/interfaces/gpsPoint.interface';
import { haverstineDistance } from 'src/app/shared/utils/haverstine';
import { SessionStats } from 'src/app/shared/interfaces/session.interface';

const MOVING_THRESHOLD_KMH = 2;
const SIGNAL_LOST_TIMEOUT_MS = 5000;

const INITIAL_STATS: SessionStats = {
  state: 'idle',
  speedKmh: 0,
  maxSpeedKmh: 0,
  avgSpeedKmh: 0,
  distanceMeters: 0,
  elapsedSeconds: 0,
  movingSeconds: 0,
  accuracy: 0,
  signalLost: false,
};

@Injectable({ providedIn: 'root' })
export class SessionService implements OnDestroy {
  readonly #gps = inject(GpsService)
  _destroy$ = new Subject<void>();
  _statsSub: Subscription | null = null;
  _timerSub: Subscription | null = null;
  _signalTimer: ReturnType<typeof setTimeout> | null = null;
  _lastPoint: GpsPoint | null = null;
  _speedSamples: number[] = [];

  _stats$ = new BehaviorSubject<SessionStats>({ ...INITIAL_STATS });
  stats$ = this._stats$.asObservable();

  get stats(): SessionStats {
    return this._stats$.getValue();
  }

  start(): void {
    if (this.stats.state === 'running') return;

    this._patch({ state: 'running', signalLost: false });
    this._startGpsSubscription();
    this._startTimer();
  }

  pause(): void {
    if (this.stats.state !== 'running') return;

    this._patch({ state: 'paused', speedKmh: 0 });
    this._statsSub?.unsubscribe();
    this._timerSub?.unsubscribe();
    this._clearSignalTimer();
  }

  resume(): void {
    if (this.stats.state !== 'paused') return;

    this._patch({ state: 'running', signalLost: false });
    this._startGpsSubscription();
    this._startTimer();
  }

  stop(): void {
    this._statsSub?.unsubscribe();
    this._timerSub?.unsubscribe();
    this._clearSignalTimer();
    this._lastPoint = null;
    this._speedSamples = [];
    this._stats$.next({ ...INITIAL_STATS });
  }

  private _startGpsSubscription(): void {
    this._statsSub?.unsubscribe();

    this._statsSub = this.#gps.position$.pipe(takeUntil(this._destroy$)).subscribe({
      next: (point) => this._onGpsPoint(point),
      error: () => this._patch({ signalLost: true }),
    });
  }

  private _startTimer(): void {
    this._timerSub?.unsubscribe();

    this._timerSub = interval(1000)
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        const s = this.stats;
        if (s.state !== 'running') return;

        const isMoving = s.speedKmh >= MOVING_THRESHOLD_KMH;
        this._patch({
          elapsedSeconds: s.elapsedSeconds + 1,
          movingSeconds: isMoving ? s.movingSeconds + 1 : s.movingSeconds,
        });
      });
  }

  private _onGpsPoint(point: GpsPoint): void {
    this._clearSignalTimer();
    this._signalTimer = setTimeout(() => this._patch({ signalLost: true }), SIGNAL_LOST_TIMEOUT_MS);

    const current = this.stats;
    let distanceMeters = current.distanceMeters;

    if (this._lastPoint) {
      const delta = haverstineDistance(
        this._lastPoint.latitude,
        this._lastPoint.longitude,
        point.latitude,
        point.longitude
      );
      if (delta < 500) {
        distanceMeters += delta;
      }
    }

    const maxSpeedKmh = Math.max(current.maxSpeedKmh, point.speedKmh);

    if (point.speedKmh >= MOVING_THRESHOLD_KMH) {
      this._speedSamples.push(point.speedKmh);
    }
    const avgSpeedKmh =
      this._speedSamples.length > 0
        ? this._speedSamples.reduce((a, b) => a + b, 0) / this._speedSamples.length
        : 0;

    this._lastPoint = point;

    this._patch({
      speedKmh: point.speedKmh,
      maxSpeedKmh,
      avgSpeedKmh,
      distanceMeters,
      accuracy: point.accuracy,
      signalLost: false,
    });
  }

  private _patch(partial: Partial<SessionStats>): void {
    this._stats$.next({ ...this.stats, ...partial });
  }

  private _clearSignalTimer(): void {
    if (this._signalTimer) {
      clearTimeout(this._signalTimer);
      this._signalTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.stop();
    this._destroy$.next();
    this._destroy$.complete();
  }
}
