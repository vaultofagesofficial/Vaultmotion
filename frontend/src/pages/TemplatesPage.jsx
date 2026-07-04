import { useState, useEffect } from 'react';
import axios from 'axios';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    axios.get('/api/templates').then(r => setTemplates(r.data)).catch(() => {});
  }, []);

  const COLORS = {
    cinematic_title: 'from-gray-900 to-black',
    ken_burns:       'from-amber-950 to-stone-900',
    animated_map:    'from-blue-950 to-slate-900',
    timeline:        'from-purple-950 to-gray-900',
    stats_counter:   'from-red-950 to-gray-900',
    outro_cta:       'from-brand-700 to-dark-900'
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Templates</h1>
        <p className="text-gray-400">6 herbruikbare Remotion animatie templates</p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {templates.map(t => (
          <div key={t.id} className="card overflow-hidden hover:border-dark-600 transition-all">
            {/* Preview balk */}
            <div className={`bg-gradient-to-br ${COLORS[t.id] || 'from-dark-700 to-dark-900'} h-24 -m-6 mb-4 flex items-center justify-center text-4xl`}>
              {t.icon}
            </div>

            <div className="flex items-start justify-between gap-2 mt-4">
              <div>
                <h3 className="font-bold text-white">{t.name}</h3>
                <p className="text-gray-400 text-sm mt-1">{t.description}</p>
              </div>
              <span className="badge bg-dark-700 text-gray-400 whitespace-nowrap">{t.duration_range}</span>
            </div>

            <div className="mt-3 pt-3 border-t border-dark-700 text-xs text-brand-500 font-medium">
              🎯 {t.use_for}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
