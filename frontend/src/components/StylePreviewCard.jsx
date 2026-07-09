// Animated preview cards voor render-stijlen (CapCut/InVideo-stijl).
// Puur CSS — geen externe bibliotheken.

const KEYFRAMES = `
@keyframes vmPan     { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes vmZoom    { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
@keyframes vmSlideIn { 0% { transform: translateX(-110%); opacity: 0; } 15% { transform: translateX(0); opacity: 1; } 80% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(110%); opacity: 0; } }
@keyframes vmFlicker { 0%, 100% { opacity: 1; } 92% { opacity: 1; } 93% { opacity: 0.55; } 94% { opacity: 1; } 97% { opacity: 0.7; } 98% { opacity: 1; } }
@keyframes vmFlash   { 0%, 24% { background: #e53e3e; } 25%, 49% { background: #39ff14; } 50%, 74% { background: #a855f7; } 75%, 100% { background: #fbbf24; } }
@keyframes vmShimmer { 0% { transform: translateX(-120%) skewX(-18deg); } 100% { transform: translateX(320%) skewX(-18deg); } }
@keyframes vmPulse   { 0%, 100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.35); opacity: 0.4; } }
@keyframes vmBarGrow { 0%, 100% { height: 22%; } 50% { height: 78%; } }
`;

function CinematicPreview() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, #2a0a0a, #7c2d12, #1a1a1a, #450a0a)', backgroundSize: '300% 300%', animation: 'vmPan 6s ease-in-out infinite' }}>
      <div style={{ position: 'absolute', inset: 0, animation: 'vmZoom 8s ease-in-out infinite', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'Impact', fontSize: 15, letterSpacing: 2, color: '#fff', textShadow: '0 2px 12px rgba(229,62,62,0.8)' }}>EPIC</span>
      </div>
    </div>
  );
}

function AiImagePreview() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#111' }}>
      <div style={{ position: 'absolute', inset: '-12%', background: 'radial-gradient(circle at 35% 40%, #b45309 0%, #431407 55%, #0a0a0a 100%)', animation: 'vmZoom 9s ease-in-out infinite' }} />
      <span style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 9, color: '#fbbf24' }}>Ken Burns</span>
    </div>
  );
}

function TwoDPreview() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#111', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, padding: '0 12px', overflow: 'hidden' }}>
      {[70, 45, 58].map((w, i) => (
        <div key={i} style={{ height: 7, width: `${w}%`, borderRadius: 3, background: i === 0 ? '#e53e3e' : '#3a3a3a', animation: `vmSlideIn 3.2s ease-in-out ${i * 0.35}s infinite` }} />
      ))}
    </div>
  );
}

function SimplePreview() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #1c1917, #292524)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(229,62,62,0.7)', animation: 'vmPulse 2.4s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', inset: 8, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6 }} />
    </div>
  );
}

function HybridPreview() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', background: 'linear-gradient(135deg, #7c2d12, #1a1a1a)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, width: '35%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)', animation: 'vmShimmer 2.8s linear infinite' }} />
      </div>
      <div style={{ flex: 1, background: '#111', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4, padding: '10px 8px' }}>
        {[0, 0.3, 0.6].map((d, i) => (
          <div key={i} style={{ width: 7, borderRadius: 2, background: '#e53e3e', animation: `vmBarGrow 1.8s ease-in-out ${d}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

function IllustratedPreview() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg, #1e3a5f, #0f2027)', overflow: 'hidden' }}>
      {/* Vlakke illustratie-vormen: zon + heuvels, met Ken Burns zoom */}
      <div style={{ position: 'absolute', inset: '-10%', animation: 'vmZoom 7s ease-in-out infinite' }}>
        <div style={{ position: 'absolute', top: '16%', right: '22%', width: 18, height: 18, borderRadius: '50%', background: '#fbbf24' }} />
        <div style={{ position: 'absolute', bottom: '-12%', left: '-6%', width: '75%', height: '55%', borderRadius: '50% 50% 0 0', background: '#2d6a4f' }} />
        <div style={{ position: 'absolute', bottom: '-16%', right: '-10%', width: '70%', height: '48%', borderRadius: '50% 50% 0 0', background: '#40916c' }} />
        <div style={{ position: 'absolute', bottom: '30%', left: '18%', width: 0, height: 0, borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderBottom: '16px solid #e53e3e' }} />
      </div>
      <span style={{ position: 'absolute', bottom: 5, left: 8, fontSize: 9, color: '#95d5b2' }}>Illustratie</span>
    </div>
  );
}

function NoirPreview() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, #000, #262626, #000)', animation: 'vmFlicker 4s linear infinite', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 13, letterSpacing: 4, color: '#f5f5f5' }}>NOIR</span>
      <div style={{ position: 'absolute', bottom: 10, left: '25%', right: '25%', height: 2, background: '#e53e3e' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 3px)' }} />
    </div>
  );
}

function DocumentaryPreview() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #1f2937, #111827)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', bottom: 10, left: 0, height: 14, width: '62%', background: 'rgba(229,62,62,0.9)', borderRadius: '0 3px 3px 0', animation: 'vmSlideIn 4s ease-in-out infinite', display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
        <span style={{ fontSize: 7, color: '#fff', letterSpacing: 1 }}>BRON: ARCHIEF</span>
      </div>
    </div>
  );
}

function SocialFastPreview() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0014', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.25, animation: 'vmFlash 1.2s steps(1) infinite' }} />
      <span style={{ fontFamily: 'Impact', fontSize: 14, color: '#39ff14', textShadow: '0 0 10px #39ff14', animation: 'vmPulse 0.6s ease-in-out infinite' }}>SNEL!</span>
    </div>
  );
}

function LuxuryPreview() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 12, letterSpacing: 5, color: '#d4af37' }}>LUXURY</span>
      <div style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.28), transparent)', animation: 'vmShimmer 3.5s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: 8, left: '30%', right: '30%', height: 1, background: 'rgba(212,175,55,0.5)' }} />
      <div style={{ position: 'absolute', bottom: 8, left: '30%', right: '30%', height: 1, background: 'rgba(212,175,55,0.5)' }} />
    </div>
  );
}

const PREVIEWS = {
  'ai-cinematic':      CinematicPreview,
  'ai-image':          AiImagePreview,
  '2d':                TwoDPreview,
  'simple':            SimplePreview,
  'hybrid':            HybridPreview,
  'illustrated':       IllustratedPreview,
  'cinematic_noir':    NoirPreview,
  'documentary':       DocumentaryPreview,
  'social_media_fast': SocialFastPreview,
  'luxury':            LuxuryPreview,
};

export function StylePreviewCard({ value, name, cost, info, active, onClick }) {
  const Preview = PREVIEWS[value] || TwoDPreview;
  return (
    <button
      onClick={onClick}
      title={info}
      className="text-left rounded-xl overflow-hidden transition-all"
      style={{
        border: active ? '2px solid #e53e3e' : '2px solid #2a2a2a',
        background: '#161616',
        boxShadow: active ? '0 0 18px rgba(229,62,62,0.25)' : 'none',
        transform: active ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      <div style={{ position: 'relative', height: 64, overflow: 'hidden' }}>
        <Preview />
      </div>
      <div className="px-2.5 py-2">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-semibold" style={{ color: active ? '#fff' : '#d1d5db' }}>{name}</span>
          <span className="text-[10px] shrink-0" style={{ color: cost === '0' || cost === 'gratis' ? '#4ade80' : '#fbbf24' }}>
            {cost === '0' ? 'gratis' : `~${cost}cr`}
          </span>
        </div>
        <span className="text-[9px] block truncate" style={{ color: '#6b6b6b' }} aria-label="Meer info">{info}</span>
      </div>
    </button>
  );
}

export function StylePreviewKeyframes() {
  return <style>{KEYFRAMES}</style>;
}
