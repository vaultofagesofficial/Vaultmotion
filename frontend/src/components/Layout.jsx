import { Outlet, NavLink } from 'react-router-dom';
import { Video, Layers, Settings, Clapperboard, Rows3 } from 'lucide-react';
import { useTranslation } from '../i18n';

const NAV_KEYS = [
  { to: '/studio',    icon: Clapperboard, key: 'layout.nav.studio'      },
  { to: '/jobs',      icon: Video,        key: 'layout.nav.render_jobs' },
  { to: '/batch',     icon: Rows3,        key: 'layout.nav.batch'       },
  { to: '/templates', icon: Layers,       key: 'layout.nav.templates'   },
  { to: '/settings',  icon: Settings,     key: 'layout.nav.settings'    },
];

export default function Layout() {
  const { t, lang, setLang } = useTranslation();

  function handleLangToggle(newLang) {
    setLang(newLang);
    window.location.reload();
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-dark-800 border-r border-dark-700 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-dark-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Video size={16} className="text-white" />
            </div>
            <div>
              <div className="heading-display font-bold text-sm leading-tight">VaultMotion</div>
              <div className="text-gray-500 text-xs">{t('layout.app_subtitle', 'AI Video Tool')}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_KEYS.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-dark-700'
                }`
              }
            >
              <Icon size={17} />
              {t(key)}
              {to === '/batch' && (
                <span className="ml-auto text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-semibold">
                  NEW
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-dark-700 space-y-2">
          {/* Taal-toggle */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-1">🌐</span>
            {['nl', 'en'].map(l => (
              <button
                key={l}
                onClick={() => lang !== l && handleLangToggle(l)}
                className="text-xs font-semibold px-2 py-0.5 rounded transition-colors"
                style={lang === l
                  ? { backgroundColor: '#374151', color: '#fff' }
                  : { color: '#6b7280' }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            VaultBoost →
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
