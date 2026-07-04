import React from 'react';
import { AbsoluteFill, Audio, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig, OffthreadVideo } from 'remotion';

interface Entry {
  label: string;
  value: number;
  color?: string | null;
}

interface Comparison {
  type:    'ranking' | 'scale' | 'before_after' | 'timeline' | string;
  unit?:   string | null;
  entries: Entry[];
  title?:  string | null;
}

interface Props {
  content: {
    comparison?: Comparison;
    title?:      string;
    text?:       string;
  };
  backgroundVideoUrl?: string | null;
  durationInFrames:    number;
  sfxUrl?: string | null;
}

// ── Palet ────────────────────────────────────────────────────────────────────
const RED   = '#e53e3e';
const WHITE = '#ffffff';
const DARK  = '#111111';
const GRAY  = 'rgba(255,255,255,0.65)';
const GREEN = '#38a169';

// ── Safe-zone (identiek aan SubtitleOverlay & FactAnimation) ─────────────────
const SAFE_BOTTOM = 170;
const SAFE_SIDES  = 60;

// ── Hulp: gesorteerde entries, max 4 ─────────────────────────────────────────
function sanitizeEntries(entries: Entry[], unit: string | null | undefined): Entry[] {
  const sliced = entries.slice(0, 4);
  if (entries.length > 4) {
    console.warn('[DataComparison] >4 entries — alleen eerste 4 getoond');
  }
  // forceer unit van parent comparison-object per entry (geen per-entry unit in schema)
  return sliced.map(e => ({ ...e, _unit: unit || '' } as any));
}

// ── AnimatedBarChart: ranking ─────────────────────────────────────────────────
function AnimatedBarChart({ entries, unit, frame, fps }: { entries: Entry[]; unit: string; frame: number; fps: number }) {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const max    = sorted[0]?.value || 1;
  const BAR_MAX_W = 480;

  return (
    <div style={{ width: '100%', padding: `0 ${SAFE_SIDES}px`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sorted.map((e, i) => {
        const delay = i * 6;
        const grow  = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 200 } });
        const barW  = BAR_MAX_W * (e.value / max) * grow;
        const opac  = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 200 } });
        const isTop = i === 0;

        return (
          <div key={i} style={{ opacity: opac }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{
                width: barW, height: 44, borderRadius: 6,
                backgroundColor: isTop ? RED : 'rgba(255,255,255,0.18)',
                boxShadow: isTop ? `0 0 20px rgba(229,62,62,0.4)` : 'none',
                flexShrink: 0, transition: 'none',
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: '"Impact"', fontSize: 28, color: isTop ? RED : WHITE, whiteSpace: 'nowrap' }}>
                  {e.value.toLocaleString()}{unit ? ` ${unit}` : ''}
                </div>
                <div style={{ fontFamily: '"Inter"', fontSize: 20, color: GRAY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.label}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── SideBySideScale: scale ────────────────────────────────────────────────────
function SideBySideScale({ entries, unit, frame, fps }: { entries: Entry[]; unit: string; frame: number; fps: number }) {
  const max    = Math.max(...entries.map(e => e.value), 1);
  const BAR_MAX_H = 320;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 32, paddingBottom: 16 }}>
      {entries.map((e, i) => {
        const delay  = i * 6;
        const grow   = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 200 } });
        const barH   = BAR_MAX_H * (e.value / max) * grow;
        const opac   = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 200 } });
        const isMax  = e.value === max;

        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: opac }}>
            <div style={{ fontFamily: '"Impact"', fontSize: 26, color: isMax ? RED : GRAY }}>
              {e.value.toLocaleString()}{unit ? ` ${unit}` : ''}
            </div>
            <div style={{
              width: 72, height: barH, borderRadius: 6,
              backgroundColor: isMax ? RED : 'rgba(255,255,255,0.22)',
              boxShadow: isMax ? `0 0 24px rgba(229,62,62,0.5)` : 'none',
            }} />
            <div style={{ fontFamily: '"Inter"', fontSize: 20, color: GRAY, textAlign: 'center', maxWidth: 100 }}>
              {e.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── BeforeAfterSplit: before_after ────────────────────────────────────────────
function BeforeAfterSplit({ entries, unit, frame, fps }: { entries: Entry[]; unit: string; frame: number; fps: number }) {
  const [before, after] = [entries[0], entries[1]];
  if (!before || !after) return null;

  const max    = Math.max(before.value, after.value, 1);
  const BAR_MAX_H = 280;
  const afterColor = after.value < before.value ? RED : GREEN;

  const growB = spring({ frame, fps, config: { damping: 200 } });
  const growA = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 200 } });

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 48 }}>
      {/* Vóór */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: growB }}>
        <div style={{ fontFamily: '"Impact"', fontSize: 28, color: WHITE }}>{before.value.toLocaleString()}{unit ? ` ${unit}` : ''}</div>
        <div style={{ width: 100, height: BAR_MAX_H * (before.value / max) * growB, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.28)' }} />
        <div style={{ fontFamily: '"Inter"', fontSize: 22, color: GRAY, textAlign: 'center' }}>{before.label}</div>
      </div>

      {/* Pijl */}
      <div style={{ fontFamily: '"Impact"', fontSize: 48, color: GRAY, alignSelf: 'center', opacity: growA }}>→</div>

      {/* Na */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: growA }}>
        <div style={{ fontFamily: '"Impact"', fontSize: 28, color: afterColor }}>{after.value.toLocaleString()}{unit ? ` ${unit}` : ''}</div>
        <div style={{ width: 100, height: BAR_MAX_H * (after.value / max) * growA, borderRadius: 6, backgroundColor: afterColor, boxShadow: `0 0 20px ${afterColor}55` }} />
        <div style={{ fontFamily: '"Inter"', fontSize: 22, color: GRAY, textAlign: 'center' }}>{after.label}</div>
      </div>
    </div>
  );
}

// ── TimelineComparison: timeline ──────────────────────────────────────────────
function TimelineComparison({ entries, frame, fps }: { entries: Entry[]; frame: number; fps: number }) {
  const lineGrow = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const LINE_W   = 680;

  return (
    <div style={{ padding: `0 ${SAFE_SIDES}px`, position: 'relative' }}>
      {/* Horizontale lijn */}
      <div style={{ position: 'relative', height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '80px 0' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${lineGrow * 100}%`, backgroundColor: RED, borderRadius: 2, boxShadow: `0 0 12px ${RED}` }} />

        {entries.map((e, i) => {
          const delay  = 10 + i * 8;
          const opac   = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 200 } });
          const pos    = entries.length > 1 ? i / (entries.length - 1) : 0.5;
          const above  = i % 2 === 0;

          return (
            <div key={i} style={{ position: 'absolute', left: `${pos * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', opacity: opac }}>
              {/* Stip */}
              <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: RED, boxShadow: `0 0 12px ${RED}`, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />

              {/* Label boven/onder afwisselend */}
              <div style={{
                position: 'absolute',
                [above ? 'bottom' : 'top']: 20,
                left: '50%', transform: 'translateX(-50%)',
                textAlign: 'center', whiteSpace: 'nowrap',
              }}>
                <div style={{ fontFamily: '"Impact"', fontSize: 26, color: RED }}>{e.value}</div>
                <div style={{ fontFamily: '"Inter"', fontSize: 18, color: GRAY, maxWidth: 120, whiteSpace: 'normal', textAlign: 'center' }}>{e.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Default fallback ──────────────────────────────────────────────────────────
function DefaultComparison({ entries, unit, frame, fps }: { entries: Entry[]; unit: string; frame: number; fps: number }) {
  const opac = spring({ frame, fps, config: { damping: 200 } });
  return (
    <div style={{ padding: `0 ${SAFE_SIDES}px`, opacity: opac }}>
      {entries.map((e, i) => (
        <div key={i} style={{ fontFamily: '"Impact"', fontSize: 48, color: WHITE, marginBottom: 12 }}>
          {e.label}: {e.value}{unit ? ` ${unit}` : ''}
        </div>
      ))}
    </div>
  );
}

// ── Hoofd-component ───────────────────────────────────────────────────────────
export function DataComparison({ content, backgroundVideoUrl, durationInFrames, sfxUrl }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const raw: Comparison = content.comparison || { type: 'ranking', entries: [], title: content.title || '' };
  const entries = sanitizeEntries(raw.entries || [], raw.unit);
  const unit    = raw.unit || '';
  const title   = raw.title || content.title || '';

  const titleOpac = spring({ frame, fps, config: { damping: 200 } });
  const rawProg   = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  function renderComparison() {
    if (entries.length < 2) {
      return <DefaultComparison entries={entries} unit={unit} frame={frame} fps={fps} />;
    }
    switch (raw.type) {
      case 'ranking':      return <AnimatedBarChart    entries={entries} unit={unit} frame={frame} fps={fps} />;
      case 'scale':        return <SideBySideScale     entries={entries} unit={unit} frame={frame} fps={fps} />;
      case 'before_after': return <BeforeAfterSplit    entries={entries} unit={unit} frame={frame} fps={fps} />;
      case 'timeline':     return <TimelineComparison  entries={entries}             frame={frame} fps={fps} />;
      default:             return <DefaultComparison   entries={entries} unit={unit} frame={frame} fps={fps} />;
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: DARK, overflow: 'hidden' }}>
      {sfxUrl && (
        <Sequence from={15} durationInFrames={30}>
          <Audio src={sfxUrl} startFrom={0} volume={0.8} />
        </Sequence>
      )}

      {/* Achtergrond */}
      {backgroundVideoUrl ? (
        <>
          <OffthreadVideo src={backgroundVideoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} />
        </>
      ) : (
        <>
          <AbsoluteFill style={{ backgroundColor: DARK }} />
          <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, rgba(229,62,62,${rawProg * 0.10}) 0%, transparent 65%)` }} />
        </>
      )}

      {/* Inhoud gecentreerd verticaal */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 28, paddingTop: 60, paddingBottom: SAFE_BOTTOM }}>
        {/* Titel boven visualisatie */}
        {title && (
          <div style={{
            fontFamily: '"Inter", sans-serif', fontSize: 34, fontWeight: 700,
            color: GRAY, textTransform: 'uppercase', letterSpacing: 6,
            opacity: titleOpac, textAlign: 'center',
            padding: `0 ${SAFE_SIDES}px`,
          }}>
            {title}
          </div>
        )}

        {/* Rode accentlijn */}
        <div style={{ width: interpolate(frame, [0, 20], [0, 100], { extrapolateRight: 'clamp' }), height: 3, backgroundColor: RED, boxShadow: `0 0 16px ${RED}` }} />

        {/* Grafiek */}
        {renderComparison()}
      </AbsoluteFill>

      {/* Script-tekst safe-zone onder */}
      {content.text && (
        <div style={{
          position: 'absolute', bottom: SAFE_BOTTOM, left: SAFE_SIDES, right: SAFE_SIDES,
          textAlign: 'center', fontFamily: '"Inter"', fontSize: 28, color: 'rgba(255,255,255,0.55)',
          opacity: spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 200 } }),
          lineHeight: 1.4,
        }}>
          {content.text}
        </div>
      )}
    </AbsoluteFill>
  );
}
