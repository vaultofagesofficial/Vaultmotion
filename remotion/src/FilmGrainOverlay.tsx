import { noise2D } from '@remotion/noise';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

interface Props {
  enabled?: boolean;
}

export function FilmGrainOverlay({ enabled = true }: Props) {
  const frame = useCurrentFrame();
  if (!enabled) return null;

  // noise2D drives per-frame opacity variation — range: ~0.038–0.062
  const variation = noise2D('g', frame * 0.07, 0);
  const opacity   = 0.05 + variation * 0.012;

  // seed changes every frame → different grain pattern per frame
  const seed = frame % 97;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        mixBlendMode:  'overlay',
        opacity,
      }}
    >
      <svg
        width="1080"
        height="1920"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <filter id="fg">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="4"
            seed={seed}
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#fg)" />
      </svg>
    </AbsoluteFill>
  );
}
