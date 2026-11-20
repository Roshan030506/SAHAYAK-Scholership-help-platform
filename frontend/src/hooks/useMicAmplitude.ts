import { useEffect, useRef, useState } from "react";

/**
 * Measure microphone loudness while listening.
 *
 * The Web Speech API does not expose audio levels, so a short-lived
 * `getUserMedia` analyser drives the orb. Permission failures are silent: the
 * orb simply falls back to its idle animation while the user types.
 */
export function useMicAmplitude(active: boolean): number {
  const [level, setLevel] = useState(0);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!active) {
      setLevel(0);
      return;
    }
    let cancelled = false;

    async function connect() {
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const context = new AudioContext();
        contextRef.current = context;
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(data);
          const average = data.reduce((sum, value) => sum + value, 0) / data.length;
          setLevel((current) => current * 0.6 + Math.min(average / 90, 1) * 0.4);
          frameRef.current = window.requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setLevel(0);
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void contextRef.current?.close();
      streamRef.current = null;
      contextRef.current = null;
    };
  }, [active]);

  return level;
}
