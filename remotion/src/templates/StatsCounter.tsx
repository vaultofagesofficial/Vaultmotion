import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, OffthreadVideo, Img } from 'remotion';
import { ColorTheme } from '../colorThemes';

interface Props {
  content: { stat_value?: number; stat_label?: string; prefix?: string; suffix?: string; text?: string };
  backgroundVideoUrl?: string | null;
  backgroundImageUrl?: string | null;
  durationInFrames: number;
  colorTheme?: ColorTheme | null;
}

function easeOut(t: number): number { return 1 - Math.pow(1 - t, 3); }

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'K';
  return n.toLocaleString('nl-BE');
}

// Pulse ringen vanuit het midden
const RINGS = Array.from({ length: 5 }, (_, i) => ({ id: i, delay: i * 18 }));

export function StatsCounter({ content, backgroundVideoUrl, backgroundImageUrl, durationInFrames, colorTheme }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // 2D-modus (geen AI-achtergrond): gebruik het gekozen kleurthema i.p.v. de
  // oude hardcoded near-black #080005 — die bypasste de eerdere donker-bug-fix
  // volledig omdat dit component nooit colorTheme accepteerde.
  const bgColor  = colorTheme?.bg      || '#080005';
  const accent   = colorTheme?.primary || '#e53e3e';
  const targetValue = content.stat_value || 1000000;
  const countDuration = Math.round(durationInFrames * 0.75);

  const rawProgress = interpolate(frame, [0, countDuration], [0, 1], { extrapolateRight: 'clamp' });
  const easedProgress = easeOut(rawProgress);
  const currentValue = Math.round(easedProgress * targetValue);
  const opacity = spring({ frame, fps, config: { damping: 200 } });
  const scale = interpolate(frame, [countDuration - 10, countDuration + 5], [1, 1.06], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glowIntensity = rawProgress * 80;
  const hexToRgb = (hex: string) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  };
  const [ar, ag, ab] = hexToRgb(accent);
  const accentRgb = `${ar}, ${ag}, ${ab}`;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>
      {backgroundVideoUrl && (
        <>
          <OffthreadVideo src={backgroundVideoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </>
      )}
      {!backgroundVideoUrl && backgroundImageUrl && (
        <>
          <Img src={backgroundImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </>
      )}

      {/* Radiale pulse ringen vanuit het midden */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        {RINGS.map(ring => {
          const ringFrame = (frame - ring.delay);
          const cycle = ((ringFrame % 90) + 90) % 90;
          const ringProgress = cycle / 90;
          const ringScale = 0.1 + ringProgress * 2.5;
          const ringOpacity = rawProgress * (1 - ringProgress) * 0.35;
          return (
            <div key={ring.id} style={{
              position: 'absolute',
              width: 400, height: 400,
              borderRadius: '50%',
              border: `2px solid rgba(${accentRgb},${ringOpacity})`,
              transform: `scale(${ringScale})`,
              boxShadow: `0 0 30px rgba(${accentRgb},${ringOpacity * 0.5})`
            }} />
          );
        })}
      </AbsoluteFill>

      {/* Achtergrond radiale glow — groeit mee met getal */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at center, rgba(${accentRgb},${rawProgress * 0.18}) 0%, rgba(120,20,20,${rawProgress * 0.08}) 40%, rgba(0,0,0,0.95) 75%)`
      }} />

      {/* Subtiele diagonale lijnen */}
      {[0, 25, 50, 75].map((offset, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${offset}%`, top: 0,
          width: '2px', height: '200%',
          background: `linear-gradient(180deg, transparent, rgba(${accentRgb},${0.02 + rawProgress * 0.03}), transparent)`,
          transform: 'rotate(30deg)',
          transformOrigin: 'top',
          opacity: rawProgress
        }} />
      ))}

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
        {content.prefix && (
          <div style={{ fontFamily: '"Impact", sans-serif', fontSize: 72, color: accent, opacity, letterSpacing: 4 }}>
            {content.prefix}
          </div>
        )}

        <div style={{
          fontFamily: '"Impact", "Arial Black", sans-serif',
          fontSize: 180, fontWeight: 900, color: '#ffffff',
          textAlign: 'center', opacity,
          transform: `scale(${scale})`,
          fontVariantNumeric: 'tabular-nums',
          textShadow: `0 0 ${glowIntensity}px rgba(${accentRgb},0.9), 0 0 ${glowIntensity * 1.5}px rgba(${accentRgb},0.4), 0 0 ${glowIntensity * 3}px rgba(${accentRgb},0.15)`,
          lineHeight: 0.9, letterSpacing: -4
        }}>
          {content.prefix || ''}{formatNumber(currentValue)}{content.suffix || ''}
        </div>

        <div style={{
          fontFamily: '"Inter", sans-serif', fontSize: 52, fontWeight: 300,
          color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase',
          letterSpacing: 8, textAlign: 'center', opacity, padding: '0 60px'
        }}>
          {content.stat_label || content.text || ''}
        </div>

        <div style={{
          width: interpolate(frame, [0, 30], [0, 140], { extrapolateRight: 'clamp' }),
          height: 4, backgroundColor: accent,
          boxShadow: `0 0 24px ${accent}, 0 0 48px rgba(${accentRgb},0.4)`
        }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
