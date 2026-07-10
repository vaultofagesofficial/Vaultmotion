import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { ColorTheme, getTheme } from '../colorThemes';

interface Props {
  content:             Record<string, any>;
  backgroundVideoUrl?: string | null;
  durationInFrames:    number;
  colorTheme?:         ColorTheme;
  sceneIndex?:         number;
}

const SAFE_BOTTOM = 170;
const SAFE_SIDES  = 60;

// Gedeeld gevuld achtergrond-patroon zodat 2D-scènes nooit kaal ogen
function BgFill({ frame, theme }: { frame: number; theme: ColorTheme }) {
  const glowOp    = interpolate(frame, [0, 25], [0, 0.4], { extrapolateRight: 'clamp' });
  const patternOp = interpolate(frame, [0, 20], [0, 0.5], { extrapolateRight: 'clamp' });
  return (
    <>
      <div style={{
        position: 'absolute', inset: 0, opacity: glowOp,
        background: `radial-gradient(circle at 75% 20%, ${theme.primary}55 0%, transparent 55%), radial-gradient(circle at 15% 85%, ${theme.accent}40 0%, transparent 50%)`,
      }} />
      <svg width="1080" height="1920" style={{ position: 'absolute', top: 0, left: 0, opacity: patternOp }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <line key={i} x1={-300 + i * 260} y1={0} x2={100 + i * 260} y2={1920} stroke={theme.primary} strokeWidth={2} />
        ))}
        {[0, 1, 2].map(i => (
          <rect key={`r${i}`} x={620 + i * 40} y={140 + i * 260} width={100} height={100}
            fill={theme.accent} opacity={0.2}
            transform={`rotate(${20 + i * 15}, ${670 + i * 40}, ${190 + i * 260})`}
          />
        ))}
      </svg>
    </>
  );
}

// ── Variant 0: Centered Quote ─────────────────────────────────────────────────
// Grote quote-aanhalingstekens, gecentreerde tekst, spring-in van onderaf
function CenteredQuote({ text, frame, fps, theme }: { text: string; frame: number; fps: number; theme: ColorTheme }) {
  const s  = spring({ frame, fps, config: { damping: 180 } });
  const y  = interpolate(s, [0, 1], [50, 0]);
  const op = interpolate(s, [0, 1], [0, 1]);

  const quoteOp    = interpolate(frame, [0, 20], [0, 0.18], { extrapolateRight: 'clamp' });
  const accentOp   = interpolate(frame, [12, 28], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
      <BgFill frame={frame} theme={theme} />
      {/* Grote aanhalingstekens als achtergrond-element */}
      <div style={{
        position: 'absolute', top: '18%', left: 50,
        fontSize: 240, fontFamily: 'Georgia, serif', color: theme.primary,
        opacity: quoteOp, lineHeight: 1, userSelect: 'none',
      }}>"</div>

      {/* Tekst */}
      <div style={{
        padding: `0 ${SAFE_SIDES + 20}px`,
        transform: `translateY(${y}px)`, opacity: op,
        textAlign: 'center',
      }}>
        <div style={{
          color: theme.text, fontSize: 52, fontFamily: 'Impact',
          lineHeight: 1.25, letterSpacing: 1,
        }}>
          {text}
        </div>
        <div style={{
          width: 80, height: 3, backgroundColor: theme.accent,
          margin: '28px auto 0', opacity: accentOp, borderRadius: 2,
        }} />
      </div>
    </AbsoluteFill>
  );
}

// ── Variant 1: Left-Aligned Bold ──────────────────────────────────────────────
// Verticale accentbalk links, vetgedrukte links-uitgelijnde tekst
function LeftAlignedBold({ text, frame, fps, theme }: { text: string; frame: number; fps: number; theme: ColorTheme }) {
  const barH  = interpolate(frame, [0, 20], [0, 420], { extrapolateRight: 'clamp' });
  const s     = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const op    = interpolate(s, [0, 1], [0, 1]);
  const x     = interpolate(s, [0, 1], [-60, 0]);

  const dotOp = interpolate(frame, [14, 24], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, overflow: 'hidden' }}>
      <BgFill frame={frame} theme={theme} />
      {/* Verticale accentbalk */}
      <div style={{
        position: 'absolute', left: SAFE_SIDES, top: '50%',
        transform: 'translateY(-50%)',
        width: 6, height: barH, backgroundColor: theme.primary, borderRadius: 3,
      }} />

      {/* Accent-stipje bovenaan balk */}
      <div style={{
        position: 'absolute', left: SAFE_SIDES - 5, top: `calc(50% - ${barH / 2}px - 8px)`,
        width: 16, height: 16, borderRadius: '50%', backgroundColor: theme.accent,
        opacity: dotOp,
      }} />

      {/* Tekst */}
      <div style={{
        position: 'absolute', left: SAFE_SIDES + 32, right: SAFE_SIDES,
        top: '50%',
        opacity: op, transform: `translateX(${x}px) translateY(-50%)`,
      }}>
        <div style={{
          color: theme.text, fontSize: 56, fontFamily: 'Impact',
          lineHeight: 1.2, letterSpacing: 0,
        }}>
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Variant 2: Headline Split ─────────────────────────────────────────────────
// Eerste woorden groot bovenaan in accentkleur, rest klein eronder
function HeadlineSplit({ text, frame, fps, theme }: { text: string; frame: number; fps: number; theme: ColorTheme }) {
  const words   = text.split(/\s+/);
  const cutoff  = Math.min(3, Math.ceil(words.length / 3));
  const headline = words.slice(0, cutoff).join(' ');
  const body     = words.slice(cutoff).join(' ');

  const s1   = spring({ frame,           fps, config: { damping: 160 } });
  const s2   = spring({ frame: frame - 10, fps, config: { damping: 180 } });
  const lineW = interpolate(frame, [5, 25], [0, 320], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, justifyContent: 'center', overflow: 'hidden' }}>
      <BgFill frame={frame} theme={theme} />
      <div style={{ padding: `0 ${SAFE_SIDES}px` }}>
        {/* Grote headline in accentkleur */}
        <div style={{
          color: theme.accent, fontSize: 96, fontFamily: 'Impact',
          textTransform: 'uppercase', letterSpacing: 2, lineHeight: 1,
          opacity: interpolate(s1, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(s1, [0, 1], [40, 0])}px)`,
        }}>
          {headline}
        </div>

        {/* Horizontale lijn */}
        <div style={{
          width: lineW, height: 3, backgroundColor: theme.primary,
          borderRadius: 2, margin: '20px 0',
        }} />

        {/* Body tekst in wit */}
        {body && (
          <div style={{
            color: theme.text, fontSize: 42, fontFamily: 'Impact',
            lineHeight: 1.3, letterSpacing: 0,
            opacity: interpolate(s2, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(s2, [0, 1], [30, 0])}px)`,
          }}>
            {body}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

// ── Hoofd-component ───────────────────────────────────────────────────────────
export function TextFocus2D({ content, durationInFrames, colorTheme, sceneIndex = 0 }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = colorTheme ?? getTheme('default');

  const text = content?.script_segment || content?.text || content?.title || '';
  const variant = sceneIndex % 3;

  if (variant === 0) return <CenteredQuote   text={text} frame={frame} fps={fps} theme={theme} />;
  if (variant === 1) return <LeftAlignedBold  text={text} frame={frame} fps={fps} theme={theme} />;
  return               <HeadlineSplit      text={text} frame={frame} fps={fps} theme={theme} />;
}
