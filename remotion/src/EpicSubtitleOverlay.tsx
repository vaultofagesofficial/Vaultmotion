/**
 * EpicSubtitleOverlay.tsx — Dark fantasy / Epic stijl
 * Bebas Neue, 90px, wit met gouden glow, BOVENAAN, fade in/out per woord.
 */
import React from 'react';
import { AbsoluteFill, interpolate, Easing, useVideoConfig } from 'remotion';

interface WordTiming {
  word:       string;
  start_time: number;  // seconden
  end_time:   number;  // seconden
}

interface SubtitleSettings {
  enabled:        boolean;
  fontSize:       'klein' | 'normaal' | 'groot';
  highlightColor: string;
  position:       'onder' | 'midden';
}

interface Props {
  wordTimings:  WordTiming[];
  currentFrame: number;
  settings:     SubtitleSettings;
}

const WORDS_PER_GROUP = 4;

const SIZE_MAP = { klein: 80, normaal: 90, groot: 100 };

// Gouden glow + rode onderglow voor epic sfeer
function epicShadow(isActive: boolean): string {
  const glow  = isActive ? '#FFD700' : 'rgba(255,215,0,0.4)';
  const size  = isActive ? 20 : 10;
  return [
    `-2px -2px 0 #000`, `2px -2px 0 #000`, `-2px 2px 0 #000`, `2px 2px 0 #000`,
    `0 0 ${size}px ${glow}`,
    `0 0 ${size * 2}px ${glow}`,
    `0 4px 30px rgba(180,50,0,0.6)`,
  ].join(', ');
}

export function EpicSubtitleOverlay({ wordTimings, currentFrame, settings }: Props) {
  const { fps } = useVideoConfig();

  if (!wordTimings || wordTimings.length === 0) return null;

  const currentTime = currentFrame / fps;

  const currentIdx = wordTimings.findIndex(
    w => currentTime >= w.start_time && currentTime < w.end_time
  );
  if (currentIdx === -1) return null;

  const baseFontSize = SIZE_MAP[settings.fontSize] || SIZE_MAP.normaal;

  const groupIdx   = Math.floor(currentIdx / WORDS_PER_GROUP);
  const groupStart = groupIdx * WORDS_PER_GROUP;
  const groupWords = wordTimings.slice(groupStart, groupStart + WORDS_PER_GROUP);

  // Groepfade-in in frames vanuit groep-starttijd
  const groupStartTime  = wordTimings[groupStart]?.start_time ?? 0;
  const groupStartFrame = groupStartTime * fps;
  const groupFade       = interpolate(currentFrame, [groupStartFrame, groupStartFrame + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.16, 1, 0.3, 1) });

  // Actief woord fade op basis van seconden → frames
  const curr         = wordTimings[currentIdx];
  const wStartFrame  = curr.start_time * fps;
  const wEndFrame    = curr.end_time   * fps;
  const wordFadeIn   = interpolate(currentFrame, [wStartFrame, wStartFrame + 4], [0, 1], { extrapolateRight: 'clamp' });
  const wordFadeOut  = interpolate(currentFrame, [wEndFrame - 4, wEndFrame], [1, 0], { extrapolateLeft: 'clamp' });
  const wordAlpha    = Math.min(wordFadeIn, wordFadeOut);

  // Safe zones: ≥170px van onder, ≥150px van boven
  const posStyle = settings.position === 'midden'
    ? { top: '42%' }
    : settings.position === 'boven'
    ? { top: '150px' }
    : { bottom: '170px' }; // 'onder' = default

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>

      <div style={{
        position:       'absolute',
        left:           0,
        right:          0,
        ...posStyle,
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'center',
        alignItems:     'center',
        gap:            16,
        padding:        '0 60px',
        opacity:        groupFade,
      }}>
        {groupWords.map((wt, wi) => {
          const absIdx   = groupStart + wi;
          const isActive = absIdx === currentIdx;
          const isPast   = absIdx < currentIdx;

          // Fade per woord
          const wFade = isActive ? wordAlpha : isPast ? 0.5 : 0.25;

          return (
            <span
              key={`${wt.word}-${wt.start_time}`}
              style={{
                fontFamily:    '"Bebas Neue", "Impact", "Arial Black", sans-serif',
                fontSize:      isActive ? baseFontSize : Math.round(baseFontSize * 0.82),
                fontWeight:    400,
                color:         '#FFFFFF',
                textTransform: 'uppercase',
                letterSpacing: 4,
                lineHeight:    1,
                display:       'inline-block',
                textShadow:    epicShadow(isActive),
                whiteSpace:    'nowrap',
                opacity:       wFade,
                transform:     isActive ? 'scale(1.05)' : 'scale(1)',
                transformOrigin: 'center center',
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
