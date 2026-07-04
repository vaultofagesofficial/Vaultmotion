import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, OffthreadVideo, Img } from 'remotion';

interface Location { name: string; x: number; y: number; }
interface Props {
  content: { location?: string; label?: string; locations?: Location[]; text?: string };
  backgroundVideoUrl?: string | null;
  backgroundImageUrl?: string | null;
  durationInFrames: number;
}

const DEFAULT_LOCATIONS: Location[] = [
  { name: 'Europa', x: 48, y: 28 },
  { name: 'USA', x: 22, y: 35 }
];

function deriveLocations(content: Props['content']): Location[] {
  if (content.locations && content.locations.length > 0) return content.locations;
  if (content.location) {
    const name = content.label || content.location;
    return [{ name, x: 50, y: 42 }];
  }
  return DEFAULT_LOCATIONS;
}

// Sterrenhemel — vaste posities
const STARS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  x: (i * 83 + 11) % 100,
  y: (i * 47 + 23) % 100,
  size: i % 12 === 0 ? 3 : i % 5 === 0 ? 2 : 1,
  twinkleSpeed: 0.03 + (i % 7) * 0.01,
  twinkleOffset: (i * 19) % 60,
  brightness: 0.4 + (i % 5) * 0.12,
}));

export function AnimatedMap({ content, backgroundVideoUrl, backgroundImageUrl, durationInFrames }: Props) {
  const frame = useCurrentFrame();
  const locations = deriveLocations(content);
  const { fps } = useVideoConfig();
  const mapScale      = interpolate(frame, [0, durationInFrames * 0.7], [1, 1.12], { extrapolateRight: 'clamp' });
  const overlayOpacity = spring({ frame, fps, config: { damping: 200 } });
  const labelOpacity   = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 200 } });

  // Langzame rotatie van de sterrenhemelsector
  const starDrift = interpolate(frame, [0, durationInFrames], [0, 2], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#010812', overflow: 'hidden' }}>
      {/* Sterrenhemel achtergrond */}
      <AbsoluteFill style={{ transform: `translateX(${starDrift}px)` }}>
        {STARS.map(s => {
          const twinkle = 0.5 + 0.5 * Math.sin((frame * s.twinkleSpeed) + s.twinkleOffset);
          const starOpacity = s.brightness * (0.6 + 0.4 * twinkle);
          return (
            <div key={s.id} style={{
              position: 'absolute',
              left: `${s.x}%`, top: `${s.y}%`,
              width: s.size, height: s.size,
              borderRadius: '50%',
              backgroundColor: '#ffffff',
              opacity: starOpacity,
              boxShadow: s.size > 1 ? `0 0 ${s.size * 3}px rgba(255,255,255,0.8)` : 'none'
            }} />
          );
        })}
      </AbsoluteFill>

      {/* Melkweg nevel */}
      <AbsoluteFill style={{
        background: 'radial-gradient(ellipse at 30% 40%, rgba(30,50,120,0.25) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(60,20,80,0.2) 0%, transparent 50%)'
      }} />

      {backgroundImageUrl ? (
        <>
          <div style={{ position: 'absolute', inset: 0, transform: `scale(${mapScale})` }}>
            <Img src={backgroundImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </>
      ) : backgroundVideoUrl ? (
        <>
          <div style={{ position: 'absolute', inset: 0, transform: `scale(${mapScale})` }}>
            <OffthreadVideo src={backgroundVideoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </>
      ) : null}

      {/* Map grid overlay */}
      <AbsoluteFill style={{ opacity: overlayOpacity * 0.12 }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="mapgrid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#4a90d9" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mapgrid)" />
        </svg>
      </AbsoluteFill>

      {/* Vignette */}
      <AbsoluteFill style={{
        background: 'radial-gradient(ellipse at center, transparent 25%, rgba(1,8,18,0.85) 100%)'
      }} />

      {/* Pulserende locatie stippen */}
      <AbsoluteFill style={{ opacity: labelOpacity }}>
        {locations.map((loc, i) => {
          const dotDelay = i * 10;
          const pulse = interpolate((frame - dotDelay) % 60, [0, 30, 60], [1, 2.2, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const dotOpacity = interpolate(frame, [dotDelay, dotDelay + 20], [0, 1], { extrapolateRight: 'clamp' });
          return (
            <div key={i} style={{ position: 'absolute', left: `${loc.x}%`, top: `${loc.y}%`, transform: 'translate(-50%, -50%)', opacity: dotOpacity }}>
              <div style={{ position: 'absolute', width: 40 * pulse, height: 40 * pulse, borderRadius: '50%', border: '1px solid rgba(229,62,62,0.35)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
              <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#e53e3e', boxShadow: '0 0 20px #e53e3e, 0 0 40px rgba(229,62,62,0.5)', position: 'relative', zIndex: 1 }} />
              <div style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', color: '#ffffff', fontSize: 22, fontWeight: 700, fontFamily: '"Inter", sans-serif', whiteSpace: 'nowrap', textShadow: '1px 1px 6px rgba(0,0,0,0.9)' }}>
                {loc.name}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>

    </AbsoluteFill>
  );
}
