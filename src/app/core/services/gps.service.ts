import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Geolocation, Position } from '@capacitor/geolocation';
import { GpsPoint } from 'src/app/shared/interfaces/gpsPoint.interface';

const maxAccuracyMeters = 25;
const maxPlausibleSpeedInKm = 80;

@Injectable({ providedIn: 'root' })
export class GpsService implements OnDestroy {
  _destroy$ = new Subject<void>();
  #watchId: string | null = null;

  readonly position$: Observable<GpsPoint> = new Observable<Position>((observer) => {
    Geolocation.checkPermissions()
      .then((status) => {
        if (status.location !== 'granted') {
          return Geolocation.requestPermissions();
        }
        return status
      })
      .then(() => {
        Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          },
          (position, err) => {
            if (err) {
              observer.error(err);
              return;
            }
            if (position) {
              observer.next(position);
            }
          }
        ).then((id) => {
          this.#watchId = id;
        });
      })
      .catch((err) => observer.error(err));

    return () => {
      if (this.#watchId) {
        Geolocation.clearWatch({ id: this.#watchId });
        this.#watchId = null;
      }
    };
  }).pipe(
    filter((pos) => pos.coords.accuracy <= maxAccuracyMeters),
    map((pos) => {
      const rawSpeed = pos.coords.speed ?? 0;
      const speedKmh = Math.max(0, rawSpeed * 3.6);

      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        speedKmh: speedKmh > maxPlausibleSpeedInKm ? 0 : speedKmh,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      } satisfies GpsPoint;
    })
  );

  async requestPermission(): Promise<boolean> {
    try {
      const result = await Geolocation.requestPermissions();
      return result.location === 'granted';
    } catch {
      return false;
    }
  }

  async getCurrentPosition(): Promise<GpsPoint | null> {
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        speedKmh: Math.max(0, (pos.coords.speed ?? 0) * 3.6),
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      };
    } catch {
      return null;
    }
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
