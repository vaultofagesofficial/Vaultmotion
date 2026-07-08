/**
 * SubtitleOverlay.tsx — Hormozi / Blipix stijl + karaoke-box modus
 * - ElevenLabs timestamps (seconden) of fallback berekening
 * - Min 1.2s per woordgroep, 10-frame smooth cross-fade tussen groepen
 * - subtitleStyle: 'classic' = kleur+pop | 'karaoke-box' = CapCut-stijl achtergrond-box
 * - wordsPerLine: number | 'full_sentence' | 'random' — random = 2-6 woorden per groep
 */
import React from 'react';
import { AbsoluteFill, useVideoConfig, interpolate, Easing } from 'remotion';

interface WordTiming {
  word:       string;
  start_time: number;
  end_time:   number;
}

interface SubtitleSettings {
  enabled:        boolean;
  fontSize:       'klein' | 'normaal' | 'groot';
  highlightColor: string;
  position:       'onder' | 'midden';
  wordsPerLine?:  number | 'full_sentence' | 'random';
  subtitleStyle?: 'classic' | 'karaoke-box';
}

interface Props {
  wordTimings:  WordTiming[];
  currentFrame: number;
  settings:     SubtitleSettings;
}

const MIN_GROUP_HOLD  = 1.2;
const FADE_FRAMES     = 10;

const SIZE_MAP        = { klein: 76, normaal: 82, groot: 90 };
// karaoke-box iets kleiner zodat 3 woorden per rij passen
const SIZE_MAP_KARAOKE = { klein: 62, normaal: 68, groot: 76 };

function outline(px: number): string {
  const s: string[] = [];
  for (let x = -px; x <= px; x++) {
    for (let y = -px; y <= px; y++) {
      if (x !== 0 || y !== 0) s.push(`${x}px ${y}px 0 #000`);
    }
  }
  s.push('0 6px 20px rgba(0,0,0,0.95)');
  return s.join(', ');
}

// Eenvoudige luminantie-check voor tekstkleur op box
function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

// Bouw zinsgrenzen: een zin eindigt bij een woord eindigend op . ? !
function buildSentenceGroups(words: WordTiming[]): Array<{ start: number; end: number }> {
  const groups: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (let i = 0; i < words.length; i++) {
    if (/[.?!]$/.test(words[i].word) || i === words.length - 1) {
      groups.push({ start, end: i });
      start = i + 1;
    }
  }
  return groups;
}

// Willekeurige groepsgroottes (2-6 woorden) — deterministisch per woordindex,
// zodat elke frame exact dezelfde indeling ziet en de karaoke-timing klopt.
function buildRandomGroups(words: WordTiming[]): Array<{ start: number; end: number }> {
  const groups: Array<{ start: number; end: number }> = [];
  let start = 0;
  while (start < words.length) {
    // Simpele deterministische hash op de startindex → grootte 2..6
    const h = Math.abs(Math.imul(start + 7, 2654435761) ^ 0x9e3779b9);
    const size = 2 + (h % 5);
    const end = Math.min(start + size - 1, words.length - 1);
    groups.push({ start, end });
    start = end + 1;
  }
  return groups;
}

// Vind de groep waartoe een woordindex behoort
function getGroupForIdx(
  idx: number,
  words: WordTiming[],
  mode: number | 'full_sentence' | 'random',
  sentenceGroups: Array<{ start: number; end: number }>,
  randomGroups?: Array<{ start: number; end: number }>
): { groupStart: number; groupEnd: number } {
  if (mode === 'full_sentence' || mode === 'random') {
    const list = mode === 'random' ? (randomGroups ?? []) : sentenceGroups;
    const g = list.find(g => idx >= g.start && idx <= g.end)
      ?? list[list.length - 1]
      ?? { start: idx, end: idx };
    return { groupStart: g.start, groupEnd: g.end };
  }
  const n = mode as number;
  const gIdx = Math.floor(idx / n);
  return {
    groupStart: gIdx * n,
    groupEnd:   Math.min((gIdx + 1) * n - 1, words.length - 1),
  };
}

// Eerste woordindex van de groep NA de groep die `idx` bevat
function getNextGroupStart(
  idx: number,
  words: WordTiming[],
  mode: number | 'full_sentence' | 'random',
  sentenceGroups: Array<{ start: number; end: number }>,
  randomGroups?: Array<{ start: number; end: number }>
): number {
  const { groupEnd } = getGroupForIdx(idx, words, mode, sentenceGroups, randomGroups);
  return groupEnd + 1;
}

export function SubtitleOverlay({ wordTimings, currentFrame, settings }: Props) {
  const { fps } = useVideoConfig();

  if (!wordTimings || wordTimings.length === 0) return null;

  const isKaraoke = (settings.subtitleStyle || 'classic') === 'karaoke-box';

  // Karaoke-box: altijd 6 (2 rijen × 3), anders: instelling of default 3
  const groupMode: number | 'full_sentence' | 'random' = isKaraoke
    ? 6
    : (settings.wordsPerLine ?? 3);

  // Zorg dat een numerieke waarde in [1,20] valt
  const resolvedMode: number | 'full_sentence' | 'random' =
    groupMode === 'full_sentence' || groupMode === 'random'
      ? groupMode
      : Math.max(1, Math.min(20, Number(groupMode) || 3));

  const sentenceGroups = buildSentenceGroups(wordTimings);
  const randomGroups   = resolvedMode === 'random' ? buildRandomGroups(wordTimings) : undefined;

  const currentTime = currentFrame / fps;

  // ── Vind actief woord ──────────────────────────────────────────────────────
  let currentIdx = wordTimings.findIndex(
    w => currentTime >= w.start_time && currentTime < w.end_time
  );

  let isHolding   = false;
  let holdOpacity = 1;

  // ── Hold: groep vasthouden min 1.2s na laatste woord ──────────────────────
  if (currentIdx === -1) {
    let lastIdx = -1;
    for (let i = wordTimings.length - 1; i >= 0; i--) {
      if (wordTimings[i].end_time <= currentTime) { lastIdx = i; break; }
    }

    if (lastIdx >= 0) {
      const { groupEnd } = getGroupForIdx(lastIdx, wordTimings, resolvedMode, sentenceGroups, randomGroups);
      const groupLastEnd = wordTimings[groupEnd].end_time;

      const nextFirstIdx  = groupEnd + 1;
      const nextStartTime = nextFirstIdx < wordTimings.length
        ? wordTimings[nextFirstIdx].start_time
        : Infinity;

      const holdUntil = Math.min(groupLastEnd + MIN_GROUP_HOLD, nextStartTime);

      if (currentTime < holdUntil) {
        currentIdx = groupEnd;
        isHolding  = true;
        const elapsed  = currentTime - groupLastEnd;
        const holdDur  = Math.max(holdUntil - groupLastEnd, 0.001);
        const holdPct  = elapsed / holdDur;
        holdOpacity    = holdPct > 0.7 ? Math.max(0, 1 - ((holdPct - 0.7) / 0.3)) : 1;
      }
    }
  }

  if (currentIdx === -1) return null;

  const baseFontSize = isKaraoke
    ? (SIZE_MAP_KARAOKE[settings.fontSize] || SIZE_MAP_KARAOKE.normaal)
    : (SIZE_MAP[settings.fontSize] || SIZE_MAP.normaal);
  const highlight    = settings.highlightColor || '#FFD700';
  const bottomPos    = settings.position === 'midden' ? '42%' : '170px';
  const boxTextColor = isLightColor(highlight) ? '#000000' : '#ffffff';

  const { groupStart, groupEnd } = getGroupForIdx(currentIdx, wordTimings, resolvedMode, sentenceGroups, randomGroups);
  const groupWords = wordTimings.slice(groupStart, groupEnd + 1);

  // ── Smooth fade-in nieuwe groep ───────────────────────────────────────────
  const groupFirstWord   = wordTimings[groupStart];
  const groupStartFrame  = Math.round(groupFirstWord.start_time * fps);
  const fadeInOpacity    = isHolding ? holdOpacity : interpolate(
    currentFrame,
    [groupStartFrame, groupStartFrame + FADE_FRAMES],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) }
  );

  // ── Pop animatie actief woord (alleen classic) ────────────────────────────
  const curr        = wordTimings[currentIdx];
  const timeInWord  = currentTime - curr.start_time;
  const wordDur     = Math.max(curr.end_time - curr.start_time, 1 / fps);
  const popProgress = isHolding ? 1 : Math.min(timeInWord / wordDur, 1);
  const popScale    = (!isKaraoke && resolvedMode !== 'full_sentence' && popProgress < 0.15)
    ? 1 + 0.12 * (popProgress / 0.15)
    : isKaraoke ? 1 : 1.12;

  // ── Render ────────────────────────────────────────────────────────────────
  if (isKaraoke) {
    // 2 rijen × 3 woorden
    const row1 = groupWords.slice(0, 3);
    const row2 = groupWords.slice(3, 6);

    const renderRow = (rowWords: typeof groupWords, rowOffset: number) => (
      <div style={{
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'center',
        alignItems:     'center',
        flexWrap:       'wrap',
        gap:            8,
        marginBottom:   rowOffset === 0 && row2.length > 0 ? 10 : 0,
      }}>
        {rowWords.map((wt, wi) => {
          const absIdx   = groupStart + rowOffset + wi;
          const isActive = !isHolding && absIdx === currentIdx;

          return (
            <span
              key={`${wt.word}-${wt.start_time}`}
              style={{
                fontFamily:      '"Anton", "Impact", "Arial Black", sans-serif',
                fontSize:        baseFontSize,
                fontWeight:      400,
                color:           isActive ? boxTextColor : '#FFFFFF',
                textTransform:   'uppercase',
                letterSpacing:   1,
                lineHeight:      1,
                display:         'inline-block',
                backgroundColor: isActive ? highlight : 'transparent',
                padding:         isActive ? '6px 12px' : '6px 0px',
                borderRadius:    isActive ? 8 : 0,
                minWidth:        wt.word.length < 3 ? 28 : undefined,
                textAlign:       'center',
                textShadow:      isActive ? 'none' : outline(3),
                whiteSpace:      'normal',
                wordBreak:       'break-word',
              }}
            >
              {wt.word}
            </span>
          );
        })}
      </div>
    );

    return (
      <AbsoluteFill style={{ pointerEvents: 'none', opacity: fadeInOpacity }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');`}</style>
        <div style={{
          position:      'absolute',
          left:          60,
          right:         60,
          bottom:        bottomPos,
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
        }}>
          {renderRow(row1, 0)}
          {row2.length > 0 && renderRow(row2, 3)}
        </div>
      </AbsoluteFill>
    );
  }

  // ── Classic modus ──────────────────────────────────────────────────────────
  const isSentenceMode = resolvedMode === 'full_sentence';

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: fadeInOpacity }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');`}</style>

      <div style={{
        position:       'absolute',
        left:           60,
        right:          60,
        bottom:         bottomPos,
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'center',
        alignItems:     'flex-end',
        flexWrap:       'wrap',
        gap:            isSentenceMode ? 10 : 14,
        alignContent:   'flex-end',
      }}>
        {groupWords.map((wt, wi) => {
          const absIdx   = groupStart + wi;
          const isActive = !isHolding && absIdx === currentIdx;
          const isPast   = absIdx < currentIdx;

          return (
            <span
              key={`${wt.word}-${wt.start_time}`}
              style={{
                fontFamily:      '"Anton", "Impact", "Arial Black", sans-serif',
                fontSize:        isActive && !isSentenceMode
                  ? baseFontSize
                  : isSentenceMode
                    ? (isActive ? baseFontSize : Math.round(baseFontSize * 0.9))
                    : Math.round(baseFontSize * 0.85),
                fontWeight:      400,
                color:           isActive ? highlight : '#FFFFFF',
                textTransform:   'uppercase',
                letterSpacing:   2,
                lineHeight:      1.3,
                display:         'inline-block',
                transform:       isActive && !isSentenceMode ? `scale(${popScale})` : 'scale(1)',
                transformOrigin: 'center bottom',
                textShadow:      outline(isActive ? 5 : 3),
                whiteSpace:      'normal',
                opacity:         isPast && !isHolding ? 0.55 : 1,
              }}
            >
              {wt.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
