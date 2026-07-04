import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, OffthreadVideo, Img } from 'remotion';

interface TimelineEvent { date: string; event: string; }
interface Props {
  content: { events?: TimelineEvent[]; title?: string };
  backgroundVideoUrl?: string | null;
  backgroundImageUrl?: string | null;
  durationInFrames: number;
}

const DEFAULT_EVENTS: TimelineEvent[] = [
  { date: '1920', event: 'Het begin van alles' },
  { date: '1945', event: 'Een keerpunt' },
  { date: '1969', event: 'De doorbraak' },
  { date: '2001', event: 'De wereld verandert' }
];

// Vaste deeltjes met seeded posities
const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  x: ((i * 73 + 17) % 100),
  y: ((i * 41 + 7) % 100),
  size: 1 + (i % 3),
  speed: 0.2 + (i % 5) * 0.08,
  drift: (i % 2 === 0 ? 1 : -1) * (0.1 + (i % 4) * 0.05),
  opacity: 0.2 + (i % 4) * 0.1,
  delay: (i * 13) % 60,
}));

export function Timeline({ content, backgroundVideoUrl, backgroundImageUrl, durationInFrames }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const events = content.events || DEFAULT_EVENTS;
  const framesPerEvent = durationInFrames / events.length;
  const lineProgress = interpolate(frame, [0, durationInFrames * 0.8], [0, 100], { extrapolateRight: 'clamp' });
  const titleSpring = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ backgroundColor: '#06060f', overflow: 'hidden' }}>
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

      {/* Subtiele deeltjes animatie */}
      {PARTICLES.map(p => {
        const yPos = ((p.y - (frame * p.speed + p.delay) * 0.3) % 110 + 110) % 110;
        const xPos = p.x + Math.sin((frame + p.delay) * p.drift * 0.05) * 3;
        const pOpacity = interpolate(yPos, [0, 10, 90, 110], [0, p.opacity, p.opacity, 0]);
        return (
          <div key={p.id} style={{
            position: 'absolute',
            left: `${xPos}%`, top: `${yPos}%`,
            width: p.size, height: p.size,
            borderRadius: '50%',
            backgroundColor: p.id % 5 === 0 ? '#e53e3e' : '#4a5568',
            opacity: pOpacity,
            boxShadow: p.id % 5 === 0 ? `0 0 ${p.size * 4}px #e53e3e` : 'none'
          }} />
        );
      })}

      {/* Horizontale lichtlijnen */}
      {[20, 45, 70, 90].map((y, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, top: `${y}%`,
          width: '100%', height: 1,
          background: `linear-gradient(90deg, transparent, rgba(74,85,104,${0.05 + i * 0.02}), transparent)`,
        }} />
      ))}

      {/* Gradient overlay */}
      <AbsoluteFill style={{
        background: 'radial-gradient(ellipse at 50% 50%, rgba(229,62,62,0.04) 0%, rgba(6,6,15,0.85) 70%)'
      }} />

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '0 80px' }}>
        {content.title && (
          <div style={{
            fontFamily: '"Impact", sans-serif', fontSize: 56, color: '#ffffff',
            textTransform: 'uppercase', letterSpacing: 6, marginBottom: 80,
            opacity: titleSpring,
            textShadow: '0 0 30px rgba(229,62,62,0.3)'
          }}>
            {content.title}
          </div>
        )}

        <div style={{ width: '100%', position: 'relative' }}>
          <div style={{ height: 4, backgroundColor: '#1a1a2e', width: '100%', position: 'relative', borderRadius: 2 }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${lineProgress}%`,
              background: 'linear-gradient(90deg, #9b2c2c, #e53e3e)',
              boxShadow: '0 0 20px #e53e3e, 0 0 40px rgba(229,62,62,0.4)',
              borderRadius: 2,
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginTop: 0 }}>
            {events.map((ev, i) => {
              const eventFrame = i * framesPerEvent;
              const eventSpring  = spring({ frame: Math.max(0, frame - Math.floor(eventFrame)), fps, config: { damping: 200 } });
              const eventOpacity = eventSpring;
              const eventY       = 30 * (1 - eventSpring);
              return (
                <div key={i} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  opacity: eventOpacity, transform: `translateY(${eventY}px)`
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', backgroundColor: '#e53e3e',
                    boxShadow: '0 0 16px #e53e3e, 0 0 32px rgba(229,62,62,0.4)',
                    marginTop: -6, marginBottom: 20
                  }} />
                  <div style={{ fontFamily: '"Impact", sans-serif', fontSize: 38, color: '#e53e3e', letterSpacing: 2, marginBottom: 8 }}>
                    {ev.date}
                  </div>
                  <div style={{ fontFamily: '"Inter", sans-serif', fontSize: 28, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 1.3, padding: '0 10px' }}>
                    {ev.event}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
