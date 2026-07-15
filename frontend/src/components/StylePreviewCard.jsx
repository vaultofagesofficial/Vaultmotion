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
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1a0a0a 0%, #7c2d12 55%, #2a0a0a 100%)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '-10%', animation: 'vmZoom 9s ease-in-out infinite' }}>
        {/* ondergaande zon + gloed */}
        <div style={{ position: 'absolute', top: '30%', left: '58%', width: 22, height: 22, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 22px 10px rgba(251,191,36,0.45)' }} />
        {/* bergrug */}
        <div style={{ position: 'absolute', bottom: '18%', left: '-8%', width: '120%', height: '32%', background: '#160b08', clipPath: 'polygon(0 100%, 12% 45%, 26% 75%, 42% 30%, 58% 68%, 74% 38%, 88% 70%, 100% 50%, 100% 100%)' }} />
        {/* heldensilhouet met cape */}
        <div style={{ position: 'absolute', bottom: '20%', left: '30%', width: 10, height: 22, background: '#0a0605', borderRadius: '45% 45% 3px 3px' }} />
        <div style={{ position: 'absolute', bottom: '20%', left: '33%', width: 7, height: 14, background: '#0a0605', clipPath: 'polygon(0 0, 100% 20%, 80% 100%, 0 80%)' }} />
        {/* zwevende vonken */}
        {[18, 48, 72].map((x, i) => (
          <div key={i} style={{ position: 'absolute', bottom: '30%', left: `${x}%`, width: 3, height: 3, borderRadius: '50%', background: '#e53e3e', animation: `vmPulse ${2 + i * 0.5}s ease-in-out infinite`, boxShadow: '0 0 6px #e53e3e' }} />
        ))}
      </div>
      <span style={{ position: 'absolute', bottom: 4, left: 8, fontSize: 9, color: '#fca5a5' }}>🎬 AI-video</span>
    </div>
  );
}

function AiImagePreview() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* fotokader met bewegende "foto" erin */}
      <div style={{ position: 'relative', width: '68%', height: '72%', border: '2px solid #3a3a3a', borderRadius: 6, overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.6)' }}>
        <div style={{ position: 'absolute', inset: '-14%', animation: 'vmZoom 8s ease-in-out infinite' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #b45309 0%, #78350f 60%, #431407 100%)' }} />
          <div style={{ position: 'absolute', top: '18%', right: '20%', width: 12, height: 12, borderRadius: '50%', background: '#fde68a' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '38%', background: '#2a1505', clipPath: 'polygon(0 100%, 15% 40%, 35% 80%, 55% 25%, 78% 70%, 100% 45%, 100% 100%)' }} />
        </div>
      </div>
      <span style={{ position: 'absolute', bottom: 4, left: 8, fontSize: 9, color: '#fbbf24' }}>🖼️ Ken Burns</span>
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
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #1c1917, #292524)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* filmstrip: 3 frames met hetzelfde "personage" (consistente look per scène) */}
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ position: 'relative', width: 26, height: 40, borderRadius: 4, background: 'linear-gradient(180deg, #7c2d12, #431407)', border: '1px solid #3a3a3a', overflow: 'hidden', animation: `vmPulse ${3 + i * 0.4}s ease-in-out infinite` }}>
            <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 8, height: 14, background: '#160b08', borderRadius: '45% 45% 2px 2px' }} />
          </div>
        ))}
      </div>
      <span style={{ position: 'absolute', bottom: 4, left: 8, fontSize: 9, color: '#fca5a5' }}>🎯 Per scène</span>
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

function StockPreview() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0f172a', overflow: 'hidden' }}>
      {/* natuur-stockshot: lucht, zon, water met beweging */}
      <div style={{ position: 'absolute', inset: '-15%', animation: 'vmZoom 8s ease-in-out infinite' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #164e63 0%, #0e7490 55%, #0f172a 100%)' }} />
        <div style={{ position: 'absolute', top: '22%', left: '22%', width: 14, height: 14, borderRadius: '50%', background: '#fef3c7', boxShadow: '0 0 14px 6px rgba(254,243,199,0.3)' }} />
        {[58, 68, 78].map((y, i) => (
          <div key={i} style={{ position: 'absolute', top: `${y}%`, left: '-20%', width: '140%', height: 2, background: 'rgba(125,211,252,0.35)', animation: `vmSlideIn ${4 + i}s ease-in-out ${i * 0.6}s infinite` }} />
        ))}
      </div>
      {/* play-knop = echte video */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 0, height: 0, borderLeft: '8px solid #0f172a', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', marginLeft: 2 }} />
      </div>
      <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontWeight: 700 }}>€0</div>
      <span style={{ position: 'absolute', bottom: 5, left: 8, fontSize: 9, color: '#7dd3fc' }}>📹 Echte stockvideo</span>
    </div>
  );
}

function DirectorPreview() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(140deg, #1a0505, #2d0f0f, #0d0d0d)', overflow: 'hidden' }}>
      {/* Character sheet: 3 silhouet-hoeken naast elkaar */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, paddingBottom: 14 }}>
        {[0.75, 1, 0.75].map((s, i) => (
          <div key={i} style={{ width: 15 * s, height: 30 * s, borderRadius: '45% 45% 8px 8px', background: i === 1 ? '#e53e3e' : 'rgba(229,62,62,0.45)', animation: `vmPulse ${2.5 + i * 0.4}s ease-in-out infinite` }} />
        ))}
      </div>
      {/* Filmklapper-streep bovenaan */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 9, background: 'repeating-linear-gradient(-45deg, #d4af37 0 8px, #0d0d0d 8px 16px)', opacity: 0.85 }} />
      <span style={{ position: 'absolute', top: 13, left: 8, fontSize: 9, color: '#d4af37', fontWeight: 700, letterSpacing: 1 }}>PREMIUM</span>
      <span style={{ position: 'absolute', bottom: 4, right: 8, fontSize: 9, color: '#ea6e6e' }}>🎬 Regisseur</span>
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
  'stock':             StockPreview,
  'director':          DirectorPreview,
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
