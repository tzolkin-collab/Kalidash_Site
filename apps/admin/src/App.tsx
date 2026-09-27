import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Moon, Settings, Sun } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Opportunities from './pages/Opportunities';
import { NAV_GROUPS, isActive } from './nav';
import { useHashRoute } from './lib/router';
import { ShellContext } from './lib/shell';
import { EmptyState, Page, PageHeader } from './components/ui';

// O editor de e-mail é pesado: só é baixado quando a página de E-mails é aberta.
const Emails = lazy(() => import('./Emails'));

function NotFound({ path }: { path: string }) {
  return (
    <Page>
      <PageHeader title="Página não encontrada" />
      <EmptyState title={`Não existe nada em ${path}`}>Use o menu lateral para voltar.</EmptyState>
    </Page>
  );
}

function Loading() {
  return <div className="page-loading">Carregando…</div>;
}

export default function App() {
  const { segments, path, navigate } = useHashRoute();
  const [isReady, setIsReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 600);
    return () => clearTimeout(t);
  }, []);

  const toggleTheme = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!document.startViewTransition) {
      setIsDarkMode((prev) => !prev);
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(() => setIsDarkMode((prev) => !prev));
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
  };

  const shell = useMemo(
    () => ({ dark: isDarkMode, openMenu: () => setIsMobileMenuOpen(true), navigate: (to: string) => { setIsMobileMenuOpen(false); navigate(to); } }),
    [navigate, isDarkMode],
  );

  const [root] = segments;
  let page: ReactNode;
  switch (root) {
    case undefined:
    case 'dashboard':
      page = <Dashboard />;
      break;
    case 'oportunidades':
      page = <Opportunities />;
      break;
    case 'emails':
      page = <Emails />;
      break;
    default:
      page = <NotFound path={path} />;
  }

  return (
    <ShellContext.Provider value={shell}>
      <div className={`app-wrapper ${isDarkMode ? 'dark' : ''}`}>
        <div className={`splash-screen ${isReady ? 'hide' : ''}`}>
          <div className="splash-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src="/kalidash-logo.svg" alt="Kalidash Logo" style={{ height: '70px', filter: isDarkMode ? 'invert(1)' : 'none' }} />
          </div>
        </div>

        <div className="layout">
          <div className={`sidebar-backdrop ${isMobileMenuOpen ? 'show' : ''}`} onClick={() => setIsMobileMenuOpen(false)}></div>

          <aside className={`sidebar animate-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
            <div style={{ padding: '24px 20px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/kalidash-icon.svg" alt="Kalidash Icon" style={{ width: '28px', height: '28px', filter: isDarkMode ? 'invert(1)' : 'none' }} />
              <span className="font-bold text-base" style={{ letterSpacing: '-0.02em' }}>Kalidash</span>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              {NAV_GROUPS.map((group, i) => (
                <div key={group.title ?? i}>
                  {group.title && <div className="nav-group-title">{group.title}</div>}
                  {group.items.map(({ path: to, label, Icon }) => {
                    const active = isActive(path === '/' ? '/dashboard' : path, to);
                    return (
                      <a key={to} href={`#${to}`} className={`nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => setIsMobileMenuOpen(false)}>
                        <Icon size={18} className="nav-icon" strokeWidth={active ? 2.5 : 2} /> {label}
                      </a>
                    );
                  })}
                </div>
              ))}

              <div style={{ marginTop: 'auto', paddingBottom: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <a href="#" className="nav-link" onClick={toggleTheme}>
                  {isDarkMode ? <><Sun size={18} className="nav-icon" strokeWidth={2} /> Light Mode</> : <><Moon size={18} className="nav-icon" strokeWidth={2} /> Dark Mode</>}
                </a>
                <a href="#/configuracoes" className={`nav-link ${isActive(path, '/configuracoes') ? 'active' : ''}`} onClick={() => setIsMobileMenuOpen(false)}>
                  <Settings size={18} className="nav-icon" strokeWidth={2} /> Configurações
                </a>
              </div>
            </nav>
          </aside>

          <main className="main-content" style={{ background: 'var(--bg-app)' }}>
            <Suspense fallback={<Loading />}>{page}</Suspense>
          </main>
        </div>
      </div>
    </ShellContext.Provider>
  );
}
