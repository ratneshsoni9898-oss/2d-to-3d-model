import { useState, useEffect, useCallback, useRef } from 'react';

interface GyroscopeData {
  alpha: number;
  beta: number;
  gamma: number;
  supported: boolean;
  permissionGranted: boolean;
}

export function useGyroscope() {
  const [data, setData] = useState<GyroscopeData>({
    alpha: 0,
    beta: 0,
    gamma: 0,
    supported: false,
    permissionGranted: false,
  });

  const enabledRef = useRef(false);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (!enabledRef.current) return;
    setData((prev) => ({
      ...prev,
      alpha: event.alpha ?? 0,
      beta: event.beta ?? 0,
      gamma: event.gamma ?? 0,
    }));
  }, []);

  const requestPermission = useCallback(async () => {
    // Check if DeviceOrientationEvent is supported
    if (!('DeviceOrientationEvent' in window)) {
      return false;
    }

    // iOS 13+ requires explicit permission
    const DOE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };

    if (typeof DOE.requestPermission === 'function') {
      try {
        const permission = await DOE.requestPermission();
        if (permission === 'granted') {
          setData((prev) => ({
            ...prev,
            supported: true,
            permissionGranted: true,
          }));
          enabledRef.current = true;
          window.addEventListener('deviceorientation', handleOrientation);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    }

    // Non-iOS devices
    setData((prev) => ({ ...prev, supported: true, permissionGranted: true }));
    enabledRef.current = true;
    window.addEventListener('deviceorientation', handleOrientation);
    return true;
  }, [handleOrientation]);

  const disable = useCallback(() => {
    enabledRef.current = false;
    window.removeEventListener('deviceorientation', handleOrientation);
    setData((prev) => ({
      ...prev,
      alpha: 0,
      beta: 0,
      gamma: 0,
      permissionGranted: false,
    }));
  }, [handleOrientation]);

  useEffect(() => {
    // Check support on mount
    if ('DeviceOrientationEvent' in window) {
      setData((prev) => ({ ...prev, supported: true }));
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [handleOrientation]);

  return { ...data, requestPermission, disable };
}
