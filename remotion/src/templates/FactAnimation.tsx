import React from 'react';
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, OffthreadVideo, Img } from 'remotion';

interface Fact {
  type: 'count' | 'measurement' | 'duration' | 'date' | 'ratio' | string;
  value: number | string;
  unit?: string | null;
  subject?: string | null;
}

interface Props {
  content: {
    facts?: Fact[];
    title?: string;
    text?: string;
  };
  backgroundVideoUrl?: string | null;
  backgroundImageUrl?: string | null;
  durationInFrames: number;
  sfxUrl?: string | null;
}

// ── Kleurpalet ──────────────────────────────────────────────────────────────
const RED   = '#e53e3e';
const WHITE = '#ffffff';
const DARK  = '#111111';
const GRAY  = 'rgba(255,255,255,0.72)';

// ── Safe-zone constanten (zelfde als SubtitleOverlay) ────────────────────────
const SAFE_BOTTOM  = 170;
const SAFE_SIDES   = 60;

// ── Hulpfuncties ─────────────────────────────────────────────────────────────
function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }

function parseRatio(value: number | string): [number, number] {
  const str = String(value);
  // Formats: "333 to 1", "5:1", "3/1"
  const m = str.match(/(\d+(?:\.\d+)?)\s*(?:to|:|\/)\s*(\d+(?:\.\d+)?)/i);
  if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  return [1, 1];
}

// ── Person SVG icon ──────────────────────────────────────────────────────────
function PersonIcon({ color = WHITE, size = 28 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 20 30" fill={color}>
      <circle cx="10" cy="5" r="5" />
      <path d="M2 30 Q2 16 10 16 Q18 16 18 30Z" />
    </svg>
  );
}

// ── IconGrid: count ≤ 100 ────────────────────────────────────────────────────
function IconGrid({ fact, frame, fps }: { fact: Fact; frame: number; fps: number }) {
  const total = Math.min(Math.max(Math.round(Number(fact.value)), 1), 100);
  const cols  = total <= 10 ? total : total <= 25 ? 5 : total <= 50 ? 10 : 10;
  const rows  = Math.ceil(total / cols);
  const iconSize = total <= 10 ? 52 : total <= 25 ? 42 : total <= 50 ? 34 : 28;
  const gap   = Math.round(iconSize * 0.3);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${iconSize}px)`,
        gap,
      }}>
        {Array.from({ length: total }, (_, idx) => {
          const delay = Math.floor(idx / cols) * 4 + (idx % cols) * 2;
          const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 200 } });
          return (
            <div key={idx} style={{ opacity: s, transform: `scale(${s})` }}>
              <PersonIcon size={iconSize} color={idx === 0 ? RED : WHITE} />
            </div>
          );
        })}
      </div>

      {/* Label */}
      <div style={{
        fontFamily: '"Impact", sans-serif', fontSize: 52, color: RED,
        letterSpacing: 2, textAlign: 'center',
        opacity: spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 200 } }),
      }}>
        {fact.value} {fact.unit || ''} {fact.subject || ''}
      </div>
    </AbsoluteFill>
  );
}

// ── NumericCounter: count > 100 ──────────────────────────────────────────────
function NumericCounter({ fact, frame, fps, durationInFrames }: { fact: Fact; frame: number; fps: number; durationInFrames: number }) {
  const target = Number(fact.value);
  if (isNaN(target)) return <DefaultFact fact={fact} frame={frame} fps={fps} />;
  const countDur = Math.round(durationInFrames * 0.75);
  const progress = easeOut(interpolate(frame, [0, countDur], [0, 1], { extrapolateRight: 'clamp' }));
  const current  = Math.round(progress * target);
  const opacity  = spring({ frame, fps, config: { damping: 200 } });

  function fmt(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1).replace('.0', '') + 'K';
    return n.toLocaleString('nl-BE');
  }

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
      <div style={{
        fontFamily: '"Impact", "Arial Black", sans-serif',
        fontSize: 180, fontWeight: 900, color: WHITE,
        fontVariantNumeric: 'tabular-nums', opacity,
        textShadow: `0 0 60px rgba(229,62,62,0.7), 0 0 120px rgba(229,62,62,0.3)`,
        lineHeight: 0.9, letterSpacing: -4,
      }}>
        {fmt(current)}{fact.unit ? ` ${fact.unit}` : ''}
      </div>
      <div style={{
        fontFamily: '"Inter", sans-serif', fontSize: 48, fontWeight: 300,
        color: GRAY, textTransform: 'uppercase', letterSpacing: 8,
        textAlign: 'center', opacity, padding: '0 60px',
      }}>
        {fact.subject || ''}
      </div>
      <div style={{
        width: interpolate(frame, [0, 30], [0, 140], { extrapolateRight: 'clamp' }),
        height: 4, backgroundColor: RED,
        boxShadow: `0 0 24px ${RED}, 0 0 48px rgba(229,62,62,0.4)`,
      }} />
    </AbsoluteFill>
  );
}

// ── ScaleBar: measurement ─────────────────────────────────────────────────────
function ScaleBar({ fact, frame, fps }: { fact: Fact; frame: number; fps: number }) {
  const HUMAN_HEIGHT_M = 1.8;
  const valueM = fact.unit === 'meters' || fact.unit === 'm'
    ? Number(fact.value)
    : Number(fact.value); // Toon relatief indien geen meter-context

  const ratio = Math.min(valueM / Math.max(valueM, HUMAN_HEIGHT_M * 2), 1);
  const BAR_MAX_H = 360; // px

  const barH = spring({ frame, fps, config: { damping: 200 } }) * BAR_MAX_H * ratio;
  const humanH = BAR_MAX_H * (HUMAN_HEIGHT_M / Math.max(valueM, HUMAN_HEIGHT_M * 2));
  const labelOpacity = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 48, flexDirection: 'row' }}>
      {/* Object bar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ opacity: labelOpacity, fontFamily: '"Impact"', fontSize: 40, color: RED, letterSpacing: 2 }}>
          {fact.value} {fact.unit || ''}
        </div>
        <div style={{
          width: 48, height: barH, backgroundColor: RED,
          boxShadow: `0 0 30px rgba(229,62,62,0.5)`,
          borderRadius: 4,
        }} />
        <div style={{ opacity: labelOpacity, fontFamily: '"Inter"', fontSize: 28, color: GRAY, textAlign: 'center', maxWidth: 200 }}>
          {fact.subject || ''}
        </div>
      </div>

      {/* Menssilhouet als referentie */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ opacity: labelOpacity, fontFamily: '"Impact"', fontSize: 32, color: GRAY }}>1.8m</div>
        <div style={{ height: humanH, display: 'flex', alignItems: 'flex-end' }}>
          <PersonIcon size={36} color={GRAY} />
        </div>
        <div style={{ opacity: labelOpacity, fontFamily: '"Inter"', fontSize: 24, color: GRAY }}>mens</div>
      </div>
    </AbsoluteFill>
  );
}

// ── ProgressArc: duration ─────────────────────────────────────────────────────
function ProgressArc({ fact, frame, fps, durationInFrames }: { fact: Fact; frame: number; fps: number; durationInFrames: number }) {
  const SIZE   = 320;
  const STROKE = 22;
  const R      = (SIZE - STROKE) / 2;
  const CIRC   = 2 * Math.PI * R;

  const progress    = interpolate(frame, [0, durationInFrames - 15], [0, 1], { extrapolateRight: 'clamp' });
  const dashOffset  = CIRC * (1 - progress);
  const opacity     = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={STROKE} />
          {/* Progress */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
            stroke={RED} strokeWidth={STROKE}
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 12px ${RED})` }}
          />
        </svg>
        {/* Getal in midden */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          opacity,
        }}>
          <div style={{ fontFamily: '"Impact"', fontSize: 72, color: WHITE, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {fact.value}
          </div>
          <div style={{ fontFamily: '"Inter"', fontSize: 30, color: GRAY, letterSpacing: 4 }}>
            {fact.unit || 'jaar'}
          </div>
        </div>
      </div>

      <div style={{ opacity, fontFamily: '"Inter"', fontSize: 36, color: GRAY, textAlign: 'center', padding: '0 60px' }}>
        {fact.subject || ''}
      </div>
    </AbsoluteFill>
  );
}

// ── DateStamp: date ───────────────────────────────────────────────────────────
function DateStamp({ fact, frame, fps }: { fact: Fact; frame: number; fps: number }) {
  const s1 = spring({ frame, fps, config: { damping: 200 } });
  const s2 = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20 }}>
      <div style={{
        fontFamily: '"Impact", "Arial Black", sans-serif',
        fontSize: 200, fontWeight: 900, color: WHITE,
        opacity: s1, transform: `translateY(${60 * (1 - s1)}px)`,
        letterSpacing: -6, lineHeight: 0.85,
        textShadow: `0 0 80px rgba(229,62,62,0.5)`,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {fact.value}
      </div>
      {fact.unit && (
        <div style={{ fontFamily: '"Impact"', fontSize: 52, color: RED, opacity: s2, letterSpacing: 6 }}>
          {fact.unit}
        </div>
      )}
      <div style={{
        fontFamily: '"Inter"', fontSize: 40, fontWeight: 300, color: GRAY,
        letterSpacing: 4, opacity: s2, textAlign: 'center', padding: '0 60px',
      }}>
        {fact.subject || ''}
      </div>
    </AbsoluteFill>
  );
}

// ── RatioSplit: ratio ─────────────────────────────────────────────────────────
function RatioSplit({ fact, frame, fps }: { fact: Fact; frame: number; fps: number }) {
  const [a, b] = parseRatio(fact.value);
  const total  = a + b;
  const pctA   = a / total;
  const pctB   = b / total;

  const grow = spring({ frame, fps, config: { damping: 200 } });
  const opacity = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 200 } });

  const BAR_W  = 720;
  const BAR_H  = 80;

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 28 }}>
      <div style={{ opacity, fontFamily: '"Inter"', fontSize: 36, color: GRAY, textTransform: 'uppercase', letterSpacing: 6 }}>
        {fact.subject || ''}
      </div>

      {/* Bar */}
      <div style={{ width: BAR_W, height: BAR_H, borderRadius: 8, overflow: 'hidden', display: 'flex', boxShadow: '0 0 30px rgba(0,0,0,0.5)' }}>
        <div style={{
          width: `${pctA * 100 * grow}%`, height: '100%', backgroundColor: RED,
          boxShadow: `0 0 24px rgba(229,62,62,0.6)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {grow > 0.5 && (
            <span style={{ fontFamily: '"Impact"', fontSize: 36, color: WHITE }}>{a}</span>
          )}
        </div>
        <div style={{
          width: `${pctB * 100 * grow}%`, height: '100%', backgroundColor: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {grow > 0.5 && (
            <span style={{ fontFamily: '"Impact"', fontSize: 36, color: WHITE }}>{b}</span>
          )}
        </div>
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', gap: 48, opacity }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: '"Impact"', fontSize: 80, color: RED, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{a}</div>
          <div style={{ fontFamily: '"Inter"', fontSize: 28, color: GRAY, letterSpacing: 4 }}>vs</div>
          <div style={{ fontFamily: '"Impact"', fontSize: 80, color: GRAY, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{b}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Default: platte tekst ────────────────────────────────────────────────────
function DefaultFact({ fact, frame, fps }: { fact: Fact; frame: number; fps: number }) {
  const opacity = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: '"Impact"', fontSize: 100, color: WHITE, opacity, textAlign: 'center', padding: '0 60px' }}>
        {fact.value}{fact.unit ? ` ${fact.unit}` : ''}
      </div>
      <div style={{ fontFamily: '"Inter"', fontSize: 40, color: GRAY, opacity, textAlign: 'center', padding: '0 60px' }}>
        {fact.subject || fact.type || ''}
      </div>
    </AbsoluteFill>
  );
}

// ── Achtergrond ───────────────────────────────────────────────────────────────
function Background({ backgroundVideoUrl, backgroundImageUrl, frame }: { backgroundVideoUrl?: string | null; backgroundImageUrl?: string | null; frame: number }) {
  const rawProgress = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <>
      {backgroundVideoUrl ? (
        <>
          <OffthreadVideo src={backgroundVideoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.65)' }} />
        </>
      ) : backgroundImageUrl ? (
        <>
          <Img src={backgroundImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.65)' }} />
        </>
      ) : (
        <AbsoluteFill style={{ backgroundColor: DARK }} />
      )}
      {/* Subtiele radiale glow */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at center, rgba(229,62,62,${rawProgress * 0.12}) 0%, transparent 65%)`,
      }} />
    </>
  );
}

// ── Hoofd-component ───────────────────────────────────────────────────────────
export function FactAnimation({ content, backgroundVideoUrl, backgroundImageUrl, durationInFrames, sfxUrl }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const facts: Fact[] = content.facts && content.facts.length > 0 ? content.facts : [];

  // Kies de eerste "trigger"-fact (count/measurement/ratio/duration/date)
  const primaryFact: Fact = facts[0] ?? { type: 'count', value: content.title || '?', subject: content.text || '' };

  function renderFact(fact: Fact) {
    const numVal = Number(fact.value);
    switch (fact.type) {
      case 'count':
        if (isNaN(numVal)) return <DefaultFact fact={fact} frame={frame} fps={fps} />;
        return numVal <= 100
          ? <IconGrid fact={fact} frame={frame} fps={fps} />
          : <NumericCounter fact={fact} frame={frame} fps={fps} durationInFrames={durationInFrames} />;
      case 'measurement':
        return <ScaleBar fact={fact} frame={frame} fps={fps} />;
      case 'duration':
        return <ProgressArc fact={fact} frame={frame} fps={fps} durationInFrames={durationInFrames} />;
      case 'date':
        return <DateStamp fact={fact} frame={frame} fps={fps} />;
      case 'ratio':
        return <RatioSplit fact={fact} frame={frame} fps={fps} />;
      default:
        return <DefaultFact fact={fact} frame={frame} fps={fps} />;
    }
  }

  // Label onderaan — safe-zone: ≥ SAFE_BOTTOM px van onderrand, ≥ SAFE_SIDES px zijkanten
  const labelOpacity = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ backgroundColor: DARK, overflow: 'hidden' }}>
      <Background backgroundVideoUrl={backgroundVideoUrl} backgroundImageUrl={backgroundImageUrl} frame={frame} />

      {sfxUrl && (
        <Sequence from={15} durationInFrames={30}>
          <Audio src={sfxUrl} startFrom={0} volume={0.8} />
        </Sequence>
      )}

      {renderFact(primaryFact)}

    </AbsoluteFill>
  );
}
