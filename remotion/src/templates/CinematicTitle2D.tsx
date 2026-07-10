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

export function CinematicTitle2D({ content, durationInFrames, colorTheme }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = colorTheme ?? getTheme('default');

  const title    = content?.title    || '';
  const subtitle = content?.subtitle || '';

  // Titel: spring van onderaf
  const titleSpring = spring({ frame, fps, config: { damping: 180 } });
  const titleY      = interpolate(titleSpring, [0, 1], [80, 0]);
  const titleOp     = interpolate(titleSpring, [0, 1], [0, 1]);

  // Accentlijn: groeit horizontaal
  const lineW = interpolate(frame, [8, 30], [0, 260], { extrapolateRight: 'clamp' });

  // Subtitle: fade in na 15 frames
  const subtitleOp = interpolate(frame, [15, 28], [0, 1], { extrapolateRight: 'clamp' });

  // Geometrisch patroon: 8 diagonale lijnen in achtergrond
  const patternOp = interpolate(frame, [0, 20], [0, 0.55], { extrapolateRight: 'clamp' });
  const glowOp    = interpolate(frame, [0, 25], [0, 0.4], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, overflow: 'hidden' }}>
      {/* Radiale gloed vult de achtergrond */}
      <div style={{
        position: 'absolute', inset: 0, opacity: glowOp,
        background: `radial-gradient(circle at 30% 25%, ${theme.primary}55 0%, transparent 55%), radial-gradient(circle at 80% 80%, ${theme.accent}40 0%, transparent 50%)`,
      }} />

      {/* Geometrisch patroon */}
      <svg width="1080" height="1920" style={{ position: 'absolute', top: 0, left: 0, opacity: patternOp }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <line
            key={i}
            x1={-200 + i * 200} y1={0}
            x2={200 + i * 200}  y2={1920}
            stroke={theme.primary}
            strokeWidth={2}
          />
        ))}
        {[0, 1, 2, 3].map(i => (
          <rect key={`r${i}`} x={50 + i * 260} y={200 + i * 180} width={120} height={120}
            fill={theme.accent} stroke={theme.accent} strokeWidth={1.5} opacity={0.22}
            transform={`rotate(${15 + i * 12}, ${110 + i * 260}, ${260 + i * 180})`}
          />
        ))}
      </svg>

      {/* Rode/accent verticale balk — links */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 8,
        backgroundColor: theme.primary,
        opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
      }} />

      {/* Inhoud — gecentreerd */}
      <div style={{
        position: 'absolute', left: 60, right: 60,
        top: '38%', transform: 'translateY(-50%)',
      }}>
        {/* Accentlijn */}
        <div style={{
          width: lineW, height: 4, backgroundColor: theme.primary,
          borderRadius: 2, marginBottom: 32,
        }} />

        {/* Titel */}
        <div style={{
          color: theme.text, fontSize: 84, fontFamily: 'Impact',
          letterSpacing: interpolate(titleSpring, [0, 1], [12, 4]),
          textTransform: 'uppercase', lineHeight: 1.05,
          transform: `translateY(${titleY}px)`, opacity: titleOp,
        }}>
          {title}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div style={{
            color: theme.accent, fontSize: 36, fontFamily: 'Impact',
            letterSpacing: 3, marginTop: 24,
            opacity: subtitleOp,
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}
