import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { ColorTheme, getTheme } from '../colorThemes';

interface Props {
  content:          Record<string, any>;
  backgroundVideoUrl?: string | null;
  durationInFrames: number;
  colorTheme?:      ColorTheme;
  sceneIndex?:      number;
}

export function OutroCTA2D({ content, durationInFrames, colorTheme }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = colorTheme ?? getTheme('default');

  const ctaLine  = content?.title    || 'Follow for more';
  const subtitle = content?.subtitle || '';

  const s = spring({ frame, fps, config: { damping: 180 } });
  const textY  = interpolate(s, [0, 1], [60, 0]);
  const textOp = interpolate(s, [0, 1], [0, 1]);
  const lineW  = interpolate(frame, [10, 30], [0, 200], { extrapolateRight: 'clamp' });

  // Pulserende ring — golfachtig via sinusfunctie (geen CSS)
  const pulseBase  = 1 + 0.06 * Math.sin(frame * 0.18);
  const ringOp     = interpolate(frame, [0, 12], [0, 0.7], { extrapolateRight: 'clamp' });
  const ringScale  = interpolate(s, [0, 1], [0.3, 1]) * pulseBase;
  const ringSize   = 220;

  const patternOp  = interpolate(frame, [0, 18], [0, 0.55], { extrapolateRight: 'clamp' });
  const subOp      = interpolate(frame, [18, 30], [0, 1], { extrapolateRight: 'clamp' });
  const glowOp     = interpolate(frame, [0, 25], [0, 0.4], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, overflow: 'hidden' }}>
      {/* Radiale gloed vult de achtergrond */}
      <div style={{
        position: 'absolute', inset: 0, opacity: glowOp,
        background: `radial-gradient(circle at 70% 30%, ${theme.primary}55 0%, transparent 55%), radial-gradient(circle at 20% 80%, ${theme.accent}40 0%, transparent 50%)`,
      }} />

      {/* Achtergrondpatroon — spiegeld t.o.v. CinematicTitle2D */}
      <svg width="1080" height="1920" style={{ position: 'absolute', top: 0, left: 0, opacity: patternOp }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <line key={i}
            x1={1280 - i * 200} y1={0}
            x2={880  - i * 200} y2={1920}
            stroke={theme.primary} strokeWidth={2}
          />
        ))}
        {[0, 1, 2, 3].map(i => (
          <rect key={`r${i}`} x={80 + i * 260} y={220 + i * 160} width={110} height={110}
            fill={theme.accent} opacity={0.2}
            transform={`rotate(${-15 - i * 12}, ${135 + i * 260}, ${275 + i * 160})`}
          />
        ))}
      </svg>

      {/* Rechter accentbalk */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 8,
        backgroundColor: theme.primary,
        opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
      }} />

      {/* Pulserende ring */}
      <div style={{
        position: 'absolute', top: '28%', left: '50%',
        transform: `translate(-50%, -50%) scale(${ringScale})`,
        width: ringSize, height: ringSize,
        borderRadius: '50%',
        border: `4px solid ${theme.accent}`,
        opacity: ringOp,
      }} />
      {/* Binnenste ring */}
      <div style={{
        position: 'absolute', top: '28%', left: '50%',
        transform: `translate(-50%, -50%) scale(${ringScale * 0.7})`,
        width: ringSize, height: ringSize,
        borderRadius: '50%',
        border: `2px solid ${theme.primary}`,
        opacity: ringOp * 0.6,
      }} />

      {/* Inhoud */}
      <div style={{
        position: 'absolute', left: 60, right: 60, top: '50%',
        transform: 'translateY(-50%)',
        textAlign: 'center',
      }}>
        <div style={{
          width: lineW, height: 4, backgroundColor: theme.primary,
          borderRadius: 2, margin: '0 auto 28px',
        }} />

        <div style={{
          color: theme.text, fontSize: 72, fontFamily: 'Impact',
          textTransform: 'uppercase', letterSpacing: 4,
          transform: `translateY(${textY}px)`, opacity: textOp,
        }}>
          {ctaLine}
        </div>

        {subtitle && (
          <div style={{
            color: theme.accent, fontSize: 32, fontFamily: 'Impact',
            letterSpacing: 2, marginTop: 20, opacity: subOp,
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}
