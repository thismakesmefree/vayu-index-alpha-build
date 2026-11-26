import { useEffect, useRef, useState } from 'react';

type Theme = 'dark' | 'light';
type TransitionDirection = 'dark-to-light' | 'light-to-dark' | null;

const assets = {
  darkImage: '/assets/aistudio/dark_24ff50f3.jpg',
  lightImage: '/assets/aistudio/light_8e2c77fd.jpg',
  darkToLight: [
    '/assets/aistudio/dark-to-light_upscaled.mp4',
    '/assets/aistudio/dark-to-light_18d61ae3.mp4',
  ],
  lightToDark: [
    '/assets/aistudio/light-to-dark_upscaled.mp4',
    '/assets/aistudio/light-to-dark_26317572.mp4',
  ],
};

export default function AtmosphericBackground({ theme }: { theme: Theme }) {
  const previousTheme = useRef(theme);
  const darkToLightRef = useRef<HTMLVideoElement>(null);
  const lightToDarkRef = useRef<HTMLVideoElement>(null);
  const safetyTimer = useRef<number | null>(null);
  const [displayedTheme, setDisplayedTheme] = useState(theme);
  const [transition, setTransition] = useState<TransitionDirection>(null);
  const [videoVisible, setVideoVisible] = useState(false);

  useEffect(() => {
    const previous = previousTheme.current;
    if (previous === theme) return;
    previousTheme.current = theme;

    const direction: TransitionDirection =
      previous === 'dark' && theme === 'light' ? 'dark-to-light' : 'light-to-dark';
    const video = direction === 'dark-to-light' ? darkToLightRef.current : lightToDarkRef.current;
    const finish = () => {
      if (safetyTimer.current !== null) window.clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
      setDisplayedTheme(theme);
      setVideoVisible(false);
      window.setTimeout(() => setTransition(null), 260);
    };

    setTransition(direction);
    setVideoVisible(true);
    if (video) {
      video.currentTime = 0;
      video.playbackRate = 1.15;
      video.play().catch(finish);
    }

    const midpoint = window.setTimeout(() => setDisplayedTheme(theme), 1100);
    safetyTimer.current = window.setTimeout(finish, 3200);
    return () => {
      window.clearTimeout(midpoint);
      if (safetyTimer.current !== null) window.clearTimeout(safetyTimer.current);
    };
  }, [theme]);

  const finishTransition = () => {
    if (safetyTimer.current !== null) window.clearTimeout(safetyTimer.current);
    safetyTimer.current = null;
    setDisplayedTheme(theme);
    setVideoVisible(false);
    window.setTimeout(() => setTransition(null), 260);
  };

  return (
    <div
      className={`atmosphere atmosphere-${displayedTheme}`}
      data-testid="atmospheric-background"
      data-transition-video={transition ?? 'idle'}
      aria-hidden="true"
    >
      <img className={`atmosphere-image ${displayedTheme}`} src={displayedTheme === 'dark' ? assets.darkImage : assets.lightImage} alt="" />
      <div className="atmosphere-glow atmosphere-glow-one" />
      <div className="atmosphere-glow atmosphere-glow-two" />
      <div className="atmosphere-veil" />
      <video
        ref={darkToLightRef}
        className={`atmosphere-video ${transition === 'dark-to-light' && videoVisible ? 'visible' : ''}`}
        muted
        playsInline
        preload="none"
        onEnded={finishTransition}
      >
        {assets.darkToLight.map((source) => <source key={source} src={source} type="video/mp4" />)}
      </video>
      <video
        ref={lightToDarkRef}
        className={`atmosphere-video ${transition === 'light-to-dark' && videoVisible ? 'visible' : ''}`}
        muted
        playsInline
        preload="none"
        onEnded={finishTransition}
      >
        {assets.lightToDark.map((source) => <source key={source} src={source} type="video/mp4" />)}
      </video>
      <div className="atmosphere-grain" />
    </div>
  );
}
