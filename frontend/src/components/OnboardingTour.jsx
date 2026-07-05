import { useState, useEffect } from 'react';

// 5-stappen onboarding voor nieuwe gebruikers. Puur CSS-animatie, localStorage-flag.
const STEPS = [
  { icon: '📝', title: 'Script',   desc: 'Plak je eigen script of laat Claude er één genereren op basis van een onderwerp.' },
  { icon: '🧠', title: 'Analyse',  desc: 'Claude verdeelt je script in scènes met de beste template, timing en visuele focus per scène.' },
  { icon: '🎨', title: 'Stijl',    desc: 'Kies een render-stijl — van gratis 2D tot volledige AI-cinematic. De kostenmatrix toont vooraf wat het kost.' },
  { icon: '🎬', title: 'Render',   desc: 'Voice-over, achtergronden en Remotion-render draaien automatisch. Volg de voortgang live per stap.' },
  { icon: '⬇️', title: 'Download', desc: 'Download je video (en auto-thumbnails) of upload direct naar YouTube vanuit de job-pagina.' },
];

const STORAGE_KEY = 'vm_onboarding_gezien';

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {}
  }, []);

  function close() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setVisible(false);
  }

  if (!visible) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <style>{`
        @keyframes vmObIn { 0% { opacity: 0; transform: translateY(14px) scale(0.97); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes vmObIcon { 0% { transform: scale(0.4) rotate(-12deg); opacity: 0; } 60% { transform: scale(1.15) rotate(3deg); } 100% { transform: scale(1) rotate(0); opacity: 1; } }
      `}</style>
      <div
        key={step}
        className="w-full max-w-sm rounded-2xl p-6 text-center"
        style={{ background: '#161616', border: '1px solid #2a2a2a', animation: 'vmObIn 0.35s ease-out' }}
      >
        {/* Stappen-indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div key={i} className="rounded-full transition-all" style={{
              width: i === step ? 22 : 7, height: 7,
              background: i <= step ? '#e53e3e' : '#333',
            }} />
          ))}
        </div>

        <div style={{ fontSize: 44, animation: 'vmObIcon 0.45s ease-out' }}>{s.icon}</div>
        <h2 className="text-lg font-bold text-white mt-2">{step + 1}. {s.title}</h2>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: '#9ca3af' }}>{s.desc}</p>

        {/* Workflow-strip */}
        <div className="flex items-center justify-center gap-1 mt-5 text-[10px]" style={{ color: '#6b6b6b' }}>
          {STEPS.map((st, i) => (
            <span key={i} className="flex items-center gap-1">
              <span style={{ color: i === step ? '#e53e3e' : i < step ? '#4ade80' : '#6b6b6b', fontWeight: i === step ? 700 : 400 }}>{st.title}</span>
              {i < STEPS.length - 1 && <span>→</span>}
            </span>
          ))}
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={close} className="flex-1 py-2 text-xs rounded-lg" style={{ border: '1px solid #333', color: '#9ca3af' }}>
            Overslaan
          </button>
          <button
            onClick={() => (last ? close() : setStep(step + 1))}
            className="flex-1 py-2 text-xs rounded-lg font-semibold text-white"
            style={{ background: '#e53e3e' }}
          >
            {last ? 'Aan de slag! 🎬' : 'Volgende'}
          </button>
        </div>
      </div>
    </div>
  );
}
