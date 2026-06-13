export type SessionState = 'idle' | 'running' | 'paused';

export interface SessionStats {
  state: SessionState;
  speedKmh: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  distanceMeters: number;
  elapsedSeconds: number;
  movingSeconds: number;
  accuracy: number;
  signalLost: boolean;
}