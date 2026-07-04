import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, OffthreadVideo, Img } from 'remotion';

interface Props {
  content: { channel_name?: string; message?: string; subscribe_text?: string };
  backgroundVideoUrl?: string | null;
  backgroundImageUrl?: string | null;
  durationInFrames: number;
}

// Zelfde particle systeem als CinematicTitle
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: (i * 37 + 11) % 100,
  size: 2 + (i % 4),
  speed: 0.25 + (i % 5) * 0.09,
  delay: (i * 7) % 40,
  color: i % 4 === 0 ? '#e53e3e' : i % 3 === 0 ? '#c53030' : '#ffffff',
}));

export function OutroCTA({ content, backgroundVideoUrl, backgroundImageUrl, durationInFrames }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = spring({ frame, fps, config: { damping: 200 } });
  const bellRotation = frame > 30 ? Math.sin((frame - 30) * 0.4) * 15 * Math.exp(-((frame - 30) * 0.04)) : 0;
  const btnScale = 1 + 0.03 * Math.sin(frame * 0.15);

  // Rode accent lijnen die groeien (zelfde als CinematicTitle)
  const lineWidth = interpolate(frame, [5, 35], [0, 85], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a', overflow: 'hidden' }}>
      {backgroundImageUrl ? (
        <>
          <Img src={backgroundImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </>
      ) : backgroundVideoUrl ? (
        <>
          <OffthreadVideo src={backgroundVideoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </>
      ) : null}

      {/* Floating particles — zelfde stijl als CinematicTitle */}
      {PARTICLES.map(p => {
        const y = ((frame * p.speed + p.delay * 10) % 110) - 10;
        const pOpacity = interpolate(y, [0, 30, 80, 100], [0, 0.7, 0.7, 0]);
        return (
          <div key={p.id} style={{
            position: 'absolute',
            left: `${p.x}%`, top: `${y}%`,
            width: p.size, height: p.size,
            borderRadius: '50%',
            backgroundColor: p.color,
            opacity: pOpacity,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`
          }} />
        );
      })}

      {/* Radiale achtergrond glow — lichter wanneer achtergrond aanwezig */}
      <AbsoluteFill style={{
        background: (backgroundImageUrl || backgroundVideoUrl)
          ? 'radial-gradient(ellipse at center, rgba(229,62,62,0.1) 0%, rgba(0,0,0,0.55) 65%)'
          : 'radial-gradient(ellipse at center, rgba(229,62,62,0.1) 0%, rgba(0,0,0,0.95) 65%)'
      }} />

      {/* Rode accent lijnen boven en onder (CinematicTitle stijl) */}
      <AbsoluteFill style={{ alignItems: 'flex-start', justifyContent: 'center', paddingTop: 180, opacity: fadeIn }}>
        <div style={{ width: `${lineWidth}%`, height: 3, backgroundColor: '#e53e3e', boxShadow: '0 0 20px #e53e3e', marginLeft: `${(100 - lineWidth) / 2}%` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 180, opacity: fadeIn }}>
        <div style={{ width: `${lineWidth}%`, height: 3, backgroundColor: '#e53e3e', boxShadow: '0 0 20px #e53e3e', marginLeft: `${(100 - lineWidth) / 2}%` }} />
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 32, opacity: fadeIn }}>
        <div style={{ fontSize: 100, transform: `rotate(${bellRotation}deg)`, filter: 'drop-shadow(0 0 24px rgba(229,62,62,0.7))' }}>
          🔔
        </div>

        <div style={{
          fontFamily: '"Impact", sans-serif', fontSize: 70, color: '#ffffff',
          textTransform: 'uppercase', letterSpacing: 6, textAlign: 'center',
          textShadow: '0 0 40px rgba(229,62,62,0.5), 2px 2px 8px rgba(0,0,0,0.9)'
        }}>
          {content.subscribe_text || 'Abonneer Nu'}
        </div>

        <div style={{
          backgroundColor: '#e53e3e', borderRadius: 50, padding: '20px 60px',
          transform: `scale(${btnScale})`,
          boxShadow: '0 0 50px rgba(229,62,62,0.6), 0 0 100px rgba(229,62,62,0.2), 0 8px 32px rgba(0,0,0,0.45)'
        }}>
          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 42, fontWeight: 700, color: '#ffffff', letterSpacing: 2 }}>
            ABONNEREN
          </span>
        </div>

        {content.channel_name && (
          <div style={{ fontFamily: '"Inter", sans-serif', fontSize: 38, fontWeight: 300, color: 'rgba(255,255,255,0.65)', letterSpacing: 4 }}>
            {content.channel_name}
          </div>
        )}

        {content.message && (
          <div style={{ fontFamily: '"Inter", sans-serif', fontSize: 32, color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '0 80px' }}>
            {content.message}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
