import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { LogOut, Moon, Settings, Sun } from 'lucide-react';
import PipelineBuilder from './PipelineBuilder';
import Dashboard from './pages/Dashboard';
import Automations from './pages/Automations';
import Clients from './pages/Clients';
import Leads from './pages/Leads';
import Opportunities from './pages/Opportunities';
import PeopleCompanies from './pages/PeopleCompanies';
import PipelineSettings from './pages/PipelineSettings';
import Projects from './pages/Projects';
import Login from './pages/Login';
import SettingsPage from './pages/Settings';
import Tasks from './pages/Tasks';
import { NAV_GROUPS, isActive } from './nav';
import { useHashRoute } from './lib/router';
import { ShellContext, useShell } from './lib/shell';
import { EmptyState, Page, PageHeader } from './components/ui';
import ToastHost from './components/Toasts';
import NotificationBell from './components/NotificationBell';
import { initWorkflowSync } from './lib/workflowSync';
import { initCrmSync } from './lib/crmSync';
import { startTaskNotifications } from './lib/taskNotify';
import { initAuth, logout, useAuth } from './lib/auth';
import { loadTeam } from './lib/teamSync';
import { useCan } from './lib/permissions';
import { initials } from './lib/people';

// O editor de e-mail é pesado: só é baixado quando a página de E-mails é aberta.
const Emails = lazy(() => import('./Emails'));
// React Flow (workflow das tarefas) também só carrega quando preciso.
const TaskWorkflow = lazy(() => import('./pages/TaskWorkflow'));
// O editor de texto do Blog (TipTap) também.
const Blog = lazy(() => import('./pages/Blog'));
function NotFound({ path }: { path: string }) {
  return (
    <Page>
      <PageHeader title="Página não encontrada" />
      <EmptyState title={`Não existe nada em ${path}`}>Use o menu lateral para voltar.</EmptyState>
    </Page>
  );
}

const ROLE_NAME = { ADMIN: 'Admin', MANAGER: 'Gerente', SELLER: 'Vendedor' } as const;

function Loading() {
  return <div className="page-loading">Carregando…</div>;
}

function Redirect({ to }: { to: string }) {
  const { navigate } = useShell();
  useEffect(() => { navigate(to); }, [navigate, to]);
  return <Loading />;
}

export default function App() {
  const { segments, path, navigate } = useHashRoute();
  const [isReady, setIsReady] = useState(false);
  const auth = useAuth();
  const can = useCan();
  useEffect(() => { void initAuth(); }, []);
  // Os dados só são pedidos à API depois de saber quem está logado (ou que a API não exige login).
  const authSettled = auth.status === 'off' || auth.status === 'in';
  useEffect(() => {
    if (!authSettled) return;
    if (auth.status === 'in') void loadTeam();
    void initWorkflowSync().then(initCrmSync).then(startTaskNotifications);
  }, [authSettled]); // eslint-disable-line react-hooks/exhaustive-deps
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
    document.documentElement.classList.add('theme-transitioning');
    const transition = document.startViewTransition(() => setIsDarkMode((prev) => !prev));
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        { duration: 400, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' },
      );
    });
    transition.finished.finally(() => {
      document.documentElement.classList.remove('theme-transitioning');
    });
  };

  const shell = useMemo(
    () => ({ dark: isDarkMode, openMenu: () => setIsMobileMenuOpen(true), navigate: (to: string) => { setIsMobileMenuOpen(false); navigate(to); } }),
    [navigate, isDarkMode],
  );

  if (auth.status === 'loading') return <div className="app-wrapper"><Loading /></div>;
  if (auth.status === 'anon') return <div className="app-wrapper"><Login /></div>;

  const [root, second, third] = segments;
  let page: ReactNode;
  switch (root) {
    case undefined:
    case 'dashboard':
      page = <Dashboard />;
      break;
    case 'leads':
      page = <Leads />;
      break;
    case 'oportunidades':
      if (second === 'pipelines' && third === 'nova') page = <PipelineBuilder onBack={() => navigate('/oportunidades/pipelines')} />;
      else if (second === 'pipelines') page = <PipelineSettings pipelineId={third} />;
      else page = <Opportunities />;
      break;
    case 'tarefas':
      page = second ? <TaskWorkflow key={second} pipelineId={second} /> : <Tasks />;
      break;
    case 'pessoas-empresas':
      page = <PeopleCompanies />;
      break;
    case 'clientes':
      page = <Clients />;
      break;
    case 'automacoes':
      page = <Automations />;
      break;
    case 'blog':
      page = can.manageBlog ? <Blog postId={second} /> : <NotFound path={`${path} (sem permissão)`} />;
      break;
    case 'projetos':
      page = <Projects />;
      break;
    case 'configuracoes':
      page = <SettingsPage />;
      break;
    case 'emails':
      page = <Emails />;
      break;
    case 'dom':
    case 'ideias':
      if (second === 'teste' && third === 'dashboard') page = <Redirect to="/dashboard" />;
      else page = <NotFound path={path} />;
      break;
    default:
      page = <NotFound path={path} />;
  }

  return (
    <ShellContext.Provider value={shell}>
      <div className={`app-wrapper ${isDarkMode ? 'dark' : ''}`}>
        <div className={`splash-screen ${isReady ? 'hide' : ''}`}>
          <div className="splash-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src={isDarkMode ? '/kalidash-logo-white.svg' : '/kalidash-logo.svg'} alt="Kalidash Logo" style={{ width: '220px', height: 'auto' }} />
          </div>
        </div>

        <div className="layout">
          <div className={`sidebar-backdrop ${isMobileMenuOpen ? 'show' : ''}`} onClick={() => setIsMobileMenuOpen(false)}></div>

          <aside className={`sidebar animate-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
            <div style={{ padding: '24px 20px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={isDarkMode ? '/kalidash-icon-white.svg' : '/kalidash-icon.svg'} alt="Kalidash Icon" style={{ width: '28px', height: 'auto' }} />
              <span className="font-bold text-base" style={{ letterSpacing: '-0.02em' }}>Kalidash</span>
            </div>

            {auth.status === 'in' && auth.user && (
              <div className="sidebar-user" data-testid="session-user">
                <span className="avatar">{initials(auth.user.name || auth.user.email)}</span>
                <div className="cell-stack">
                  <span className="cell-primary">{auth.user.name || auth.user.email}</span>
                  <span className="text-xs text-muted">{ROLE_NAME[auth.user.role]}</span>
                </div>
                <button type="button" className="icon-btn bare" onClick={() => void logout()} title="Sair" aria-label="Sair"><LogOut size={16} /></button>
              </div>
            )}

            <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              {NAV_GROUPS.map((group, i) => (
                <div key={group.title ?? i}>
                  {group.title && <div className="nav-group-title">{group.title}</div>}
                  {group.items.filter((it) => it.path !== '/blog' || can.manageBlog).map(({ path: to, label, Icon }) => {
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
                <NotificationBell onNavigate={() => setIsMobileMenuOpen(false)} />
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
        <ToastHost />
      </div>
    </ShellContext.Provider>
  );
}
