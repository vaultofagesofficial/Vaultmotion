import React from 'react';
import {
  AbsoluteFill, useCurrentFrame, interpolate,
  spring, useVideoConfig, Video, Sequence, Img
} from 'remotion';

interface Props {
  content: { title?: string; subtitle?: string };
  backgroundVideoUrl?: string | null;
  backgroundImageUrl?: string | null;
  durationInFrames: number;
}

export function CinematicTitle({ content, backgroundVideoUrl, backgroundImageUrl, durationInFrames }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Tekst vliegt in van onderaf — spring voor natuurlijke entree
  const titleSpring    = spring({ frame, fps, config: { damping: 200 } });
  const titleY         = 120 * (1 - titleSpring);
  const titleOpacity   = titleSpring;

  const subtitleSpring  = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 200 } });
  const subtitleY       = 60 * (1 - subtitleSpring);
  const subtitleOpacity = subtitleSpring;

  // Rode accent lijn groeit in
  const lineWidth = interpolate(frame, [5, 35], [0, 100], { extrapolateRight: 'clamp' });

  // Particles (gesimuleerd via CSS animatie)
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: (i * 37 + 11) % 100,
    size: 2 + (i % 4),
    delay: (i * 7) % 30,
    speed: 0.3 + (i % 5) * 0.1
  }));

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
      {backgroundImageUrl ? (
        <>
          <Img src={backgroundImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </>
      ) : backgroundVideoUrl ? (
        <>
          <Video
            src={backgroundVideoUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            startFrom={0}
          />
          <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </>
      ) : null}

      {/* Donkere gradient overlay — lichter wanneer achtergrond aanwezig (anders onzichtbaar) */}
      <AbsoluteFill
        style={{
          background: (backgroundImageUrl || backgroundVideoUrl)
            ? 'radial-gradient(ellipse at center, rgba(229,62,62,0.08) 0%, rgba(0,0,0,0.55) 70%)'
            : 'radial-gradient(ellipse at center, rgba(229,62,62,0.08) 0%, rgba(0,0,0,0.95) 70%)'
        }}
      />

      {/* Floating particles */}
      {particles.map(p => {
        const y = ((frame * p.speed + p.delay * 10) % 110) - 10;
        const opacity = interpolate(y, [0, 40, 80, 100], [0, 0.6, 0.6, 0]);
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${y}%`,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              backgroundColor: '#e53e3e',
              opacity,
              boxShadow: `0 0 ${p.size * 3}px #e53e3e`
            }}
          />
        );
      })}

      {/* Titel content */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        {/* Rode accent lijn */}
        <div style={{
          width: `${lineWidth}%`,
          height: 3,
          backgroundColor: '#e53e3e',
          boxShadow: '0 0 20px #e53e3e',
          transition: 'width 0.1s'
        }} />

        {/* Hoofdtitel */}
        <div style={{
          fontFamily: '"Impact", "Arial Black", sans-serif',
          fontSize: 96,
          fontWeight: 900,
          color: '#ffffff',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: 8,
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
          textShadow: '0 0 40px rgba(229,62,62,0.5), 2px 2px 8px rgba(0,0,0,0.9)',
          padding: '0 40px',
          lineHeight: 1.1
        }}>
          {content.title || 'VaultMotion'}
        </div>

        {/* Rode lijn onder */}
        <div style={{
          width: `${lineWidth}%`,
          height: 3,
          backgroundColor: '#e53e3e',
          boxShadow: '0 0 20px #e53e3e'
        }} />

        {/* Subtitel */}
        {content.subtitle && (
          <div style={{
            fontFamily: '"Inter", sans-serif',
            fontSize: 42,
            fontWeight: 300,
            color: 'rgba(255,255,255,0.7)',
            textAlign: 'center',
            letterSpacing: 6,
            textTransform: 'uppercase',
            transform: `translateY(${subtitleY}px)`,
            opacity: subtitleOpacity
          }}>
            {content.subtitle}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
