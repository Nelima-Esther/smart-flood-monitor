import { useEffect, useRef } from 'preact/hooks';

export default function WaterBackground() {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause();
      return;
    }
    video.play().catch(() => {});
  }, []);

  return (
    <div class="water-bg" aria-hidden="true">
      <video
        ref={videoRef}
        class="water-video"
        autoplay
        muted
        loop
        playsinline
        preload="auto"
      >
        <source src="/water.mp4" type="video/mp4" />
      </video>
      <div class="water-tint" />
    </div>
  );
}