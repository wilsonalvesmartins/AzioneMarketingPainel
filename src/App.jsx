import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Columns3,
  Download,
  Eye,
  EyeOff,
  Filter,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Scale,
  Search,
  Settings,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { api, setCsrfToken } from './api';
import {
  canEdit,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPhone,
  isOverdue,
  localDateTimeValue,
  PRIORITIES,
  ROLES,
  STAGE_BY_ID,
  STAGES,
  todayIso,
  whatsappUrl
} from './lib';

const defaultLead = {
  contactDate: todayIso(),
  name: '',
  phone: '',
  email: '',
  source: '',
  practiceArea: '',
  viability: '',
  proposalStatus: '',
  contractStatus: '',
  objection: '',
  proposalValue: '',
  paymentTerms: '',
  lastAction: '',
  nextAction: '',
  notes: '',
  responsibleUserId: '',
  stage: 'novo',
  priority: 'normal',
  followUpAt: ''
};

function Toast({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);
  return (
    <div className={`toast toast-${toast.type || 'success'}`} role="status">
      {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
      <span>{toast.message}</span>
      <button type="button" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
    </div>
  );
}

function EmptyState({ icon: Icon = Activity, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={24} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function LoadingBlock({ label = 'Carregando dados...' }) {
  return <div className="loading-block"><RefreshCw className="spin" size={20} /><span>{label}</span></div>;
}

function StageBadge({ stage }) {
  const config = STAGE_BY_ID[stage] || STAGE_BY_ID.novo;
  return <span className="stage-badge" style={{ '--stage-color': config.color }}>{config.label}</span>;
}

function PriorityBadge({ priority }) {
  if (!priority || priority === 'normal') return null;
  return <span className={`priority-badge priority-${priority}`}>{PRIORITIES.find((item) => item.id === priority)?.label || priority}</span>;
}

function Login({ onLogin, settings }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const session = await api('/auth/login', {
        method: 'POST',
        body: { email: form.get('email'), password: form.get('password') }
      });
      setCsrfToken(session.csrfToken);
      onLogin(session);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-mark brand-mark-large"><Scale size={34} /></div>
        <div>
          <p className="eyebrow">Ambiente interno</p>
          <h1>{settings.office_name || 'JMD Advocacia'}</h1>
          <p>{settings.office_subtitle || 'Gestão de leads jurídicos'}</p>
        </div>
        <div className="login-feature-list">
          <span><Check size={16} /> Dados centralizados e persistentes</span>
          <span><Check size={16} /> Follow-ups com histórico</span>
          <span><Check size={16} /> Acesso protegido por perfil</span>
        </div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="mobile-brand"><Scale size={24} /><strong>{settings.office_name || 'JMD Advocacia'}</strong></div>
          <p className="eyebrow">Acesso restrito</p>
          <h2>Entre na sua conta</h2>
          <p className="muted">Use as credenciais cadastradas pelo administrador.</p>
          <label className="field">
            <span>E-mail</span>
            <input name="email" type="email" autoComplete="username" placeholder="nome@jmdadvocacia.com.br" required />
          </label>
          <label className="field">
            <span>Senha</span>
            <div className="password-field">
              <input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Mostrar senha">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error && <div className="inline-error"><AlertTriangle size={16} />{error}</div>}
          <button className="button button-primary button-large" type="submit" disabled={loading}>
            {loading ? <RefreshCw className="spin" size={18} /> : null}
            {loading ? 'Verificando...' : 'Acessar painel'}
          </button>
          <p className="login-security">Sessão segura com expiração automática.</p>
        </form>
      </section>
    </main>
  );
}

const navigation = [
  { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'pipeline', label: 'Pipeline', icon: Columns3 },
  { id: 'followups', label: 'Follow-ups', icon: CalendarDays },
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  { id: 'admin', label: 'Administração', icon: Settings, adminOnly: true }
];

function AppShell({ session, setSession, onNotice }) {
  const [view, setView] = useState('dashboard');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [leadModal, setLeadModal] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const user = session.user;
  const settings = session.settings || {};
  const title = navigation.find((item) => item.id === view)?.label || 'Painel';

  function refresh() {
    setRefreshKey((value) => value + 1);
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setCsrfToken('');
      setSession(null);
    }
  }

  function navigate(id) {
    setView(id);
    setMobileMenu(false);
  }

  const pageProps = {
    user,
    refreshKey,
    onOpenLead: (lead) => setLeadModal(lead?.id ? { id: lead.id } : { id: null }),
    onChanged: refresh,
    onNotice
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Scale size={23} /></div>
          <div><strong>{settings.office_name || 'JMD Advocacia'}</strong><span>Leads & Relacionamento</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)}><X size={20} /></button>
        </div>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          <p>Operação</p>
          {navigation.filter((item) => !item.adminOnly || user.role === 'admin').map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
                <Icon size={19} /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div>
          <div><strong>{user.name}</strong><span>{ROLES.find((role) => role.id === user.role)?.label}</span></div>
          <button className="icon-button" onClick={logout} title="Sair"><LogOut size={18} /></button>
        </div>
      </aside>
      {mobileMenu && <button className="sidebar-backdrop" onClick={() => setMobileMenu(false)} aria-label="Fechar menu" />}
      <div className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileMenu(true)}><Menu size={21} /></button>
          <div><p className="eyebrow">JMD Advocacia</p><h1>{title}</h1></div>
          <div className="topbar-actions">
            {canEdit(user) && <button className="button button-primary" onClick={() => setLeadModal({ id: null })}><Plus size={17} />Novo lead</button>}
            <div className="topbar-avatar">{user.name[0]?.toUpperCase()}</div>
          </div>
        </header>
        <main className="page-content">
          {view === 'dashboard' && <Dashboard {...pageProps} />}
          {view === 'leads' && <LeadsView {...pageProps} />}
          {view === 'pipeline' && <PipelineView {...pageProps} />}
          {view === 'followups' && <FollowUpsView {...pageProps} />}
          {view === 'reports' && <ReportsView {...pageProps} />}
          {view === 'admin' && user.role === 'admin' && (
            <AdminView {...pageProps} settings={settings} onSettings={(next) => setSession((current) => ({ ...current, settings: { ...current.settings, ...next } }))} />
          )}
        </main>
      </div>
      {leadModal && (
        <LeadDrawer
          leadId={leadModal.id}
          user={user}
          onClose={() => setLeadModal(null)}
          onChanged={() => { refresh(); onNotice('Dados atualizados com sucesso.'); }}
          onNotice={onNotice}
        />
      )}
    </div>
  );
}

function Dashboard({ refreshKey, onOpenLead }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api('/dashboard').then((result) => active && setData(result)).catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [refreshKey]);

  if (!data && !error) return <LoadingBlock />;
  if (error) return <EmptyState icon={AlertTriangle} title="Não foi possível carregar o painel" description={error} />;
  const maxSource = Math.max(1, ...data.sourceCounts.map((item) => item.count));
  const stageMap = Object.fromEntries(data.stageCounts.map((item) => [item.stage, item.count]));
  const maxStage = Math.max(1, ...Object.values(stageMap));

  return (
    <div className="page-stack">
      <section className="welcome-strip">
        <div><p className="eyebrow">Resumo da operação</p><h2>Acompanhe o que exige atenção hoje</h2><p>Os indicadores são calculados diretamente a partir dos leads e follow-ups salvos.</p></div>
        <div className="today-chip"><Calendar size={18} /><span>{formatDate(new Date(), { weekday: 'long', day: '2-digit', month: 'long' })}</span></div>
      </section>
      <section className="kpi-grid">
        <KpiCard label="Leads ativos" value={data.summary.total} detail={`${data.summary.monthNew} novos neste mês`} icon={Users} tone="navy" />
        <KpiCard label="Oportunidades" value={data.summary.opportunities} detail="Proposta ou negociação" icon={Target} tone="gold" />
        <KpiCard label="Contratos ganhos" value={data.summary.won} detail={`${data.summary.conversionRate}% de conversão`} icon={CheckCircle2} tone="green" />
        <KpiCard label="Follow-ups atrasados" value={data.summary.overdue} detail={data.summary.overdue ? 'Requerem ação' : 'Agenda em dia'} icon={Clock3} tone={data.summary.overdue ? 'red' : 'gray'} />
      </section>
      <section className="dashboard-grid">
        <div className="panel panel-wide">
          <div className="panel-heading"><div><p className="eyebrow">Funil comercial</p><h3>Leads por etapa</h3></div><TrendingUp size={20} /></div>
          <div className="funnel-list">
            {STAGES.map((stage) => (
              <div className="funnel-row" key={stage.id}>
                <span>{stage.label}</span>
                <div className="funnel-track"><i style={{ width: `${Math.max(2, ((stageMap[stage.id] || 0) / maxStage) * 100)}%`, background: stage.color }} /></div>
                <strong>{stageMap[stage.id] || 0}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Aquisição</p><h3>Origem dos leads</h3></div><BarChart3 size={20} /></div>
          <div className="source-list">
            {data.sourceCounts.slice(0, 6).map((item) => (
              <div key={item.source}><div><span>{item.source}</span><strong>{item.count}</strong></div><i><b style={{ width: `${(item.count / maxSource) * 100}%` }} /></i></div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Agenda</p><h3>Próximos follow-ups</h3></div><CalendarDays size={20} /></div>
          {data.upcoming.length ? (
            <div className="compact-list">
              {data.upcoming.slice(0, 5).map((item) => (
                <button key={item.id} onClick={() => onOpenLead({ id: item.leadId })}>
                  <span className={`date-tile ${isOverdue(item.dueAt) ? 'overdue' : ''}`}><b>{formatDate(item.dueAt, { day: '2-digit' })}</b><small>{formatDate(item.dueAt, { month: 'short' })}</small></span>
                  <span><strong>{item.leadName}</strong><small>{item.description}</small></span><ChevronRight size={17} />
                </button>
              ))}
            </div>
          ) : <EmptyState icon={CalendarDays} title="Agenda livre" description="Nenhum follow-up pendente." />}
        </div>
        <div className="panel panel-wide">
          <div className="panel-heading"><div><p className="eyebrow">Cadastros recentes</p><h3>Últimos leads</h3></div><Users size={20} /></div>
          <div className="recent-grid">
            {data.recent.map((lead) => (
              <button className="recent-card" key={lead.id} onClick={() => onOpenLead(lead)}>
                <div className="lead-initial">{lead.name[0]?.toUpperCase()}</div>
                <div><strong>{lead.name}</strong><span>{lead.practiceArea || 'Demanda não informada'}</span></div>
                <StageBadge stage={lead.stage} />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value, detail, icon: Icon, tone }) {
  return (
    <article className="kpi-card">
      <div className={`kpi-icon tone-${tone}`}><Icon size={21} /></div>
      <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
    </article>
  );
}

function LeadsView({ user, refreshKey, onOpenLead, onNotice }) {
  const [query, setQuery] = useState({ search: '', stage: '', source: '', followup: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      Object.entries(query).forEach(([key, value]) => value && params.set(key, value));
      try { setData(await api(`/leads?${params}`)); }
      catch (requestError) { setError(requestError.message); }
      finally { setLoading(false); }
    }, 220);
    return () => clearTimeout(timer);
  }, [query, page, refreshKey]);

  async function recordWhatsApp(lead, event) {
    event.stopPropagation();
    const popup = window.open('about:blank', '_blank', 'noopener,noreferrer');
    try {
      await api(`/leads/${lead.id}/activities`, { method: 'POST', body: { type: 'whatsapp', description: 'Contato iniciado por WhatsApp.', completed: true } });
      if (popup) popup.location = whatsappUrl(lead.phone, `Olá, ${lead.name.split(' ')[0]}. Aqui é da JMD Advocacia.`);
      onNotice('Contato por WhatsApp registrado.');
    } catch (requestError) {
      popup?.close();
      onNotice(requestError.message, 'error');
    }
  }

  const sourceOptions = ['GOOGLE ADS', 'META ADS', 'ORGANICO', 'INDICAÇÃO'];
  return (
    <div className="page-stack">
      <section className="toolbar panel">
        <div className="search-box"><Search size={18} /><input value={query.search} onChange={(event) => { setPage(1); setQuery((current) => ({ ...current, search: event.target.value })); }} placeholder="Buscar por nome, telefone ou demanda..." /></div>
        <div className="filter-group">
          <Filter size={17} />
          <select value={query.stage} onChange={(event) => { setPage(1); setQuery((current) => ({ ...current, stage: event.target.value })); }}><option value="">Todas as etapas</option>{STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select>
          <select value={query.source} onChange={(event) => { setPage(1); setQuery((current) => ({ ...current, source: event.target.value })); }}><option value="">Todas as origens</option>{sourceOptions.map((source) => <option key={source}>{source}</option>)}</select>
          <select value={query.followup} onChange={(event) => { setPage(1); setQuery((current) => ({ ...current, followup: event.target.value })); }}><option value="">Qualquer follow-up</option><option value="overdue">Atrasados</option><option value="today">Para hoje</option></select>
        </div>
      </section>
      <section className="panel table-panel">
        <div className="table-heading"><div><h2>Base de leads</h2><p>{data?.total ?? 0} registros encontrados</p></div>{loading && <RefreshCw className="spin" size={18} />}</div>
        {error ? <EmptyState icon={AlertTriangle} title="Falha ao carregar leads" description={error} /> : null}
        {!error && data?.items?.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Lead</th><th>Contato</th><th>Demanda</th><th>Origem</th><th>Etapa</th><th>Follow-up</th><th>Responsável</th><th aria-label="Ações" /></tr></thead>
              <tbody>{data.items.map((lead) => (
                <tr key={lead.id} onClick={() => onOpenLead(lead)}>
                  <td><div className="person-cell"><span>{lead.name[0]?.toUpperCase()}</span><div><strong>{lead.name}</strong><small>Entrada em {formatDate(lead.contactDate)}</small></div></div></td>
                  <td><strong className="cell-main">{formatPhone(lead.phone)}</strong><small>{lead.email || 'Sem e-mail'}</small></td>
                  <td><strong className="cell-main">{lead.practiceArea || 'Não informada'}</strong><small>{lead.viability || 'Sem qualificação'}</small></td>
                  <td>{lead.source || '—'}</td>
                  <td><div className="badges"><StageBadge stage={lead.stage} /><PriorityBadge priority={lead.priority} /></div></td>
                  <td><span className={isOverdue(lead.followUpAt) ? 'danger-text' : ''}>{formatDateTime(lead.followUpAt)}</span><small>{lead.nextAction || 'Sem ação agendada'}</small></td>
                  <td>{lead.responsibleName || 'Não atribuído'}</td>
                  <td><div className="row-actions">{canEdit(user) && lead.phone && <button className="icon-button whatsapp-button" onClick={(event) => recordWhatsApp(lead, event)} title="Abrir WhatsApp"><MessageCircle size={17} /></button>}<button className="icon-button" title="Abrir lead"><ChevronRight size={17} /></button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : !loading && !error ? <EmptyState icon={Users} title="Nenhum lead encontrado" description="Ajuste os filtros ou cadastre um novo lead." /> : null}
        {data && data.pages > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={17} />Anterior</button><span>Página {page} de {data.pages}</span><button disabled={page === data.pages} onClick={() => setPage((value) => value + 1)}>Próxima<ChevronRight size={17} /></button></div>}
      </section>
    </div>
  );
}

function PipelineView({ user, refreshKey, onOpenLead, onChanged, onNotice }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dragged, setDragged] = useState(null);

  useEffect(() => {
    setLoading(true);
    api('/leads?limit=500').then((result) => setItems(result.items)).catch((error) => onNotice(error.message, 'error')).finally(() => setLoading(false));
  }, [refreshKey]);

  const visible = items.filter((lead) => !search || `${lead.name} ${lead.practiceArea} ${lead.phone}`.toLowerCase().includes(search.toLowerCase()));
  const grouped = Object.fromEntries(STAGES.map((stage) => [stage.id, visible.filter((lead) => lead.stage === stage.id)]));

  async function moveLead(stage) {
    if (!dragged || dragged.stage === stage || !canEdit(user)) return;
    const previous = items;
    setItems((current) => current.map((lead) => lead.id === dragged.id ? { ...lead, stage } : lead));
    try {
      await api(`/leads/${dragged.id}`, { method: 'PATCH', body: { stage } });
      onNotice(`Lead movido para ${STAGE_BY_ID[stage].label}.`);
      onChanged();
    } catch (error) {
      setItems(previous);
      onNotice(error.message, 'error');
    } finally {
      setDragged(null);
    }
  }

  return (
    <div className="page-stack pipeline-page">
      <section className="toolbar panel"><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Localizar lead no pipeline..." /></div><div className="toolbar-note"><Columns3 size={17} />{canEdit(user) ? 'Arraste os cards para mudar a etapa' : 'Visualização do pipeline'}</div></section>
      {loading ? <LoadingBlock /> : (
        <section className="kanban-board">
          {STAGES.map((stage) => (
            <div className="kanban-column" key={stage.id} onDragOver={(event) => canEdit(user) && event.preventDefault()} onDrop={() => moveLead(stage.id)}>
              <div className="kanban-heading"><span style={{ background: stage.color }} /><strong>{stage.label}</strong><b>{grouped[stage.id].length}</b></div>
              <div className="kanban-cards">
                {grouped[stage.id].map((lead) => (
                  <button key={lead.id} className={`kanban-card ${dragged?.id === lead.id ? 'dragging' : ''}`} draggable={canEdit(user)} onDragStart={() => setDragged(lead)} onDragEnd={() => setDragged(null)} onClick={() => onOpenLead(lead)}>
                    <div className="kanban-card-top"><PriorityBadge priority={lead.priority} /><span>{formatDate(lead.contactDate)}</span></div>
                    <h3>{lead.name}</h3><p>{lead.practiceArea || 'Demanda não informada'}</p>
                    <div className="kanban-meta"><span>{lead.source || 'Sem origem'}</span>{lead.followUpAt && <span className={isOverdue(lead.followUpAt) ? 'overdue' : ''}><Clock3 size={13} />{formatDate(lead.followUpAt, { day: '2-digit', month: 'short' })}</span>}</div>
                  </button>
                ))}
                {!grouped[stage.id].length && <div className="kanban-empty">Nenhum lead</div>}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function FollowUpsView({ user, refreshKey, onOpenLead, onChanged, onNotice }) {
  const [scope, setScope] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/followups?scope=${scope}`).then(setItems).catch((error) => onNotice(error.message, 'error')).finally(() => setLoading(false));
  }, [scope, refreshKey]);

  async function complete(item, event) {
    event.stopPropagation();
    try {
      await api(`/activities/${item.id}/complete`, { method: 'PATCH' });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      onChanged();
      onNotice('Follow-up concluído.');
    } catch (error) { onNotice(error.message, 'error'); }
  }

  return (
    <div className="page-stack">
      <section className="segmented-wrap panel"><div className="segmented-control">{[['all', 'Pendentes'], ['overdue', 'Atrasados'], ['today', 'Hoje'], ['upcoming', 'Próximos']].map(([id, label]) => <button key={id} className={scope === id ? 'active' : ''} onClick={() => setScope(id)}>{label}</button>)}</div><span>{items.length} item(ns)</span></section>
      <section className="panel followup-panel">
        <div className="table-heading"><div><h2>Agenda de relacionamento</h2><p>Compromissos vinculados ao histórico de cada lead.</p></div><CalendarDays size={21} /></div>
        {loading ? <LoadingBlock /> : items.length ? (
          <div className="followup-list">
            {items.map((item) => (
              <article key={item.id} className={isOverdue(item.dueAt) ? 'followup-item overdue-item' : 'followup-item'} onClick={() => onOpenLead({ id: item.leadId })}>
                <div className="followup-date"><strong>{formatDate(item.dueAt, { day: '2-digit' })}</strong><span>{formatDate(item.dueAt, { month: 'short' })}</span><small>{formatDate(item.dueAt, { hour: '2-digit', minute: '2-digit' })}</small></div>
                <div className="followup-content"><div className="badges"><StageBadge stage={item.stage} /><PriorityBadge priority={item.priority} /></div><h3>{item.leadName}</h3><p>{item.description}</p><span>{formatPhone(item.phone)}</span></div>
                <div className="followup-actions">{item.phone && <a className="icon-button whatsapp-button" href={whatsappUrl(item.phone)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><MessageCircle size={18} /></a>}{canEdit(user) && <button className="button button-secondary" onClick={(event) => complete(item, event)}><Check size={17} />Concluir</button>}</div>
              </article>
            ))}
          </div>
        ) : <EmptyState icon={CalendarDays} title="Nenhum follow-up nesta visão" description="Agende o próximo contato dentro do cadastro de um lead." />}
      </section>
    </div>
  );
}

function ReportsView({ refreshKey, onNotice }) {
  const [data, setData] = useState(null);
  useEffect(() => { api('/dashboard').then(setData).catch((error) => onNotice(error.message, 'error')); }, [refreshKey]);
  if (!data) return <LoadingBlock />;
  const maxMonthly = Math.max(1, ...data.monthly.map((item) => item.leads));
  const totalSources = data.sourceCounts.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <div className="page-stack">
      <section className="report-header panel"><div><p className="eyebrow">Indicadores comerciais</p><h2>Desempenho da captação</h2><p>Uma leitura consolidada da base cadastrada.</p></div><a className="button button-secondary" href="/api/export/leads.csv"><Download size={17} />Exportar CSV</a></section>
      <section className="kpi-grid report-kpis"><KpiCard label="Conversão" value={`${data.summary.conversionRate}%`} detail="Ganhos sobre decisões" icon={TrendingUp} tone="green" /><KpiCard label="Ganhos" value={data.summary.won} detail="Contratos assinados" icon={CheckCircle2} tone="navy" /><KpiCard label="Perdidos" value={data.summary.lost} detail="Leads encerrados" icon={X} tone="red" /><KpiCard label="Em oportunidade" value={data.summary.opportunities} detail="Propostas e negociações" icon={Target} tone="gold" /></section>
      <section className="reports-grid">
        <div className="panel panel-wide"><div className="panel-heading"><div><p className="eyebrow">Evolução</p><h3>Leads por mês</h3></div></div><div className="monthly-chart">{data.monthly.length ? data.monthly.map((item) => <div className="month-column" key={item.month}><div className="month-bars"><i style={{ height: `${Math.max(4, (item.leads / maxMonthly) * 100)}%` }}><span>{item.leads}</span></i><b style={{ height: `${Math.max(2, (item.won / maxMonthly) * 100)}%` }} /></div><small>{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(new Date(`${item.month}-02T12:00:00`))}</small></div>) : <EmptyState title="Sem série histórica" description="Os meses aparecerão conforme os leads forem cadastrados." />}</div><div className="chart-legend"><span><i className="legend-leads" />Leads</span><span><i className="legend-won" />Ganhos</span></div></div>
        <div className="panel"><div className="panel-heading"><div><p className="eyebrow">Canais</p><h3>Participação por origem</h3></div></div><div className="source-donut-list">{data.sourceCounts.map((item, index) => <div key={item.source}><span className={`source-dot source-${index % 5}`} /><strong>{item.source}</strong><small>{Math.round((item.count / totalSources) * 100)}%</small><b>{item.count}</b></div>)}</div></div>
      </section>
    </div>
  );
}

function LeadDrawer({ leadId, user, onClose, onChanged, onNotice }) {
  const [tab, setTab] = useState('dados');
  const [form, setForm] = useState(defaultLead);
  const [activities, setActivities] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(Boolean(leadId));
  const [saving, setSaving] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'nota', description: '', dueAt: '' });

  useEffect(() => {
    api('/team').then(setTeam).catch(() => {});
    if (!leadId) return;
    setLoading(true);
    api(`/leads/${leadId}`).then(({ lead, activities: timeline }) => {
      setForm({
        ...defaultLead,
        ...lead,
        proposalValue: lead.proposalValueCents == null ? '' : String(lead.proposalValueCents / 100).replace('.', ','),
        responsibleUserId: lead.responsibleUserId || '',
        followUpAt: localDateTimeValue(lead.followUpAt)
      });
      setActivities(timeline);
    }).catch((error) => onNotice(error.message, 'error')).finally(() => setLoading(false));
  }, [leadId]);

  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      responsibleUserId: form.responsibleUserId ? Number(form.responsibleUserId) : null,
      proposalValueCents: form.proposalValue === '' ? null : Math.round(Number(String(form.proposalValue).replace(/\./g, '').replace(',', '.')) * 100),
      followUpAt: form.followUpAt ? new Date(form.followUpAt).toISOString() : null
    };
    delete payload.proposalValue;
    try {
      await api(leadId ? `/leads/${leadId}` : '/leads', { method: leadId ? 'PATCH' : 'POST', body: payload });
      onChanged();
      onClose();
    } catch (error) { onNotice(error.message, 'error'); }
    finally { setSaving(false); }
  }

  async function addActivity(event) {
    event.preventDefault();
    if (!leadId) return;
    try {
      const payload = { ...activityForm, completed: activityForm.type !== 'follow_up', dueAt: activityForm.dueAt ? new Date(activityForm.dueAt).toISOString() : null };
      const result = await api(`/leads/${leadId}/activities`, { method: 'POST', body: payload });
      setActivities((current) => [result.activity, ...current]);
      setActivityForm({ type: 'nota', description: '', dueAt: '' });
      onChanged();
      onNotice(activityForm.type === 'follow_up' ? 'Follow-up agendado.' : 'Atividade registrada.');
    } catch (error) { onNotice(error.message, 'error'); }
  }

  async function completeActivity(id) {
    try {
      await api(`/activities/${id}/complete`, { method: 'PATCH' });
      setActivities((current) => current.map((item) => item.id === id ? { ...item, completedAt: new Date().toISOString() } : item));
      onChanged();
      onNotice('Follow-up concluído.');
    } catch (error) { onNotice(error.message, 'error'); }
  }

  async function archive() {
    if (!window.confirm('Arquivar este lead? O registro deixará de aparecer nas visões operacionais.')) return;
    try { await api(`/leads/${leadId}`, { method: 'DELETE' }); onChanged(); onClose(); }
    catch (error) { onNotice(error.message, 'error'); }
  }

  const input = (key, label, props = {}) => <label className={`field ${props.className || ''}`}><span>{label}</span><input value={form[key] ?? ''} onChange={(event) => update(key, event.target.value)} disabled={!canEdit(user)} {...props} className={undefined} /></label>;

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true">
      <button className="drawer-backdrop" onClick={onClose} aria-label="Fechar" />
      <aside className="lead-drawer">
        <header className="drawer-header"><div><p className="eyebrow">{leadId ? `Lead #${leadId}` : 'Novo cadastro'}</p><h2>{leadId ? form.name || 'Carregando...' : 'Cadastrar lead'}</h2></div><button className="icon-button" onClick={onClose}><X size={21} /></button></header>
        {leadId && <div className="drawer-tabs"><button className={tab === 'dados' ? 'active' : ''} onClick={() => setTab('dados')}>Dados</button><button className={tab === 'atividades' ? 'active' : ''} onClick={() => setTab('atividades')}>Histórico <span>{activities.length}</span></button></div>}
        {loading ? <LoadingBlock /> : tab === 'dados' ? (
          <form className="drawer-body lead-form" onSubmit={save}>
            {leadId && <div className="quick-contact"><span>Ações rápidas</span><div>{form.phone && <a className="button button-whatsapp" href={whatsappUrl(form.phone, `Olá, ${form.name.split(' ')[0]}. Aqui é da JMD Advocacia.`)} target="_blank" rel="noreferrer"><MessageCircle size={17} />WhatsApp</a>}{form.phone && <a className="button button-secondary" href={`tel:${form.phone}`}><Phone size={17} />Ligar</a>}{form.email && <a className="button button-secondary" href={`mailto:${form.email}`}><Mail size={17} />E-mail</a>}</div></div>}
            <section className="form-section"><div className="section-title"><span>1</span><div><h3>Contato</h3><p>Dados básicos de identificação.</p></div></div><div className="form-grid">{input('name', 'Nome completo', { required: true, className: 'field-wide' })}{input('contactDate', 'Data do contato', { type: 'date', required: true })}{input('phone', 'Telefone / WhatsApp', { type: 'tel' })}{input('email', 'E-mail', { type: 'email', className: 'field-wide' })}</div></section>
            <section className="form-section"><div className="section-title"><span>2</span><div><h3>Origem e demanda</h3><p>Contexto jurídico e canal de entrada.</p></div></div><div className="form-grid"><label className="field"><span>Plataforma / origem</span><select value={form.source} onChange={(event) => update('source', event.target.value)} disabled={!canEdit(user)}><option value="">Selecione</option><option>GOOGLE ADS</option><option>META ADS</option><option>ORGANICO</option><option>INDICAÇÃO</option><option>OUTRO</option></select></label>{input('practiceArea', 'Tese / demanda')}{input('viability', 'Viabilidade jurídica', { className: 'field-wide' })}</div></section>
            <section className="form-section"><div className="section-title"><span>3</span><div><h3>Pipeline</h3><p>Etapa, prioridade e responsável.</p></div></div><div className="form-grid"><label className="field"><span>Etapa</span><select value={form.stage} onChange={(event) => update('stage', event.target.value)} disabled={!canEdit(user)}>{STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label><label className="field"><span>Prioridade</span><select value={form.priority} onChange={(event) => update('priority', event.target.value)} disabled={!canEdit(user)}>{PRIORITIES.map((priority) => <option key={priority.id} value={priority.id}>{priority.label}</option>)}</select></label><label className="field field-wide"><span>Responsável</span><select value={form.responsibleUserId} onChange={(event) => update('responsibleUserId', event.target.value)} disabled={!canEdit(user)}><option value="">Não atribuído</option>{team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>{input('proposalStatus', 'Status da proposta')}{input('contractStatus', 'Fechamento do contrato')}</div></section>
            <section className="form-section"><div className="section-title"><span>4</span><div><h3>Proposta</h3><p>Condições e objeções registradas.</p></div></div><div className="form-grid">{input('proposalValue', 'Valor da proposta', { inputMode: 'decimal', placeholder: '0,00' })}{input('paymentTerms', 'Condições de pagamento')}<label className="field field-wide"><span>Objeção principal</span><textarea value={form.objection} onChange={(event) => update('objection', event.target.value)} disabled={!canEdit(user)} rows="3" /></label></div></section>
            <section className="form-section"><div className="section-title"><span>5</span><div><h3>Próxima ação</h3><p>Planeje o relacionamento sem perder o prazo.</p></div></div><div className="form-grid">{input('followUpAt', 'Data e hora do follow-up', { type: 'datetime-local' })}{input('nextAction', 'Próxima ação')}{input('lastAction', 'Última ação realizada', { className: 'field-wide' })}<label className="field field-wide"><span>Observações</span><textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} disabled={!canEdit(user)} rows="4" /></label></div></section>
            <footer className="drawer-footer">{leadId && user.role === 'admin' && <button className="button button-danger-ghost" type="button" onClick={archive}><Trash2 size={17} />Arquivar</button>}<div className="footer-spacer" /><button className="button button-secondary" type="button" onClick={onClose}>Cancelar</button>{canEdit(user) && <button className="button button-primary" type="submit" disabled={saving}>{saving ? <RefreshCw className="spin" size={17} /> : <Save size={17} />}{saving ? 'Salvando...' : 'Salvar lead'}</button>}</footer>
          </form>
        ) : (
          <div className="drawer-body activity-tab">
            {canEdit(user) && <form className="activity-form" onSubmit={addActivity}><h3>Registrar atividade</h3><div className="form-grid"><label className="field"><span>Tipo</span><select value={activityForm.type} onChange={(event) => setActivityForm((current) => ({ ...current, type: event.target.value }))}><option value="nota">Nota interna</option><option value="whatsapp">WhatsApp</option><option value="ligacao">Ligação</option><option value="email">E-mail</option><option value="reuniao">Reunião</option><option value="follow_up">Agendar follow-up</option></select></label>{activityForm.type === 'follow_up' && <label className="field"><span>Data e hora</span><input type="datetime-local" required value={activityForm.dueAt} onChange={(event) => setActivityForm((current) => ({ ...current, dueAt: event.target.value }))} /></label>}<label className="field field-wide"><span>Descrição</span><textarea required rows="3" value={activityForm.description} onChange={(event) => setActivityForm((current) => ({ ...current, description: event.target.value }))} placeholder="Registre o que aconteceu ou o próximo passo." /></label></div><button className="button button-primary" type="submit"><Plus size={17} />Adicionar ao histórico</button></form>}
            <section className="timeline"><h3>Histórico do lead</h3>{activities.length ? activities.map((item) => <article key={item.id} className="timeline-item"><span className={`timeline-icon type-${item.type}`}>{item.type === 'follow_up' ? <Calendar size={16} /> : item.type === 'whatsapp' ? <MessageCircle size={16} /> : item.type === 'ligacao' ? <Phone size={16} /> : <Activity size={16} />}</span><div><div className="timeline-meta"><strong>{item.createdByName || 'Sistema'}</strong><span>{formatDateTime(item.createdAt)}</span></div><p>{item.description}</p>{item.dueAt && <div className={`timeline-due ${!item.completedAt && isOverdue(item.dueAt) ? 'overdue' : ''}`}><Clock3 size={14} />{item.completedAt ? `Concluído em ${formatDateTime(item.completedAt)}` : `Previsto para ${formatDateTime(item.dueAt)}`}{!item.completedAt && canEdit(user) && <button onClick={() => completeActivity(item.id)}>Marcar como concluído</button>}</div>}</div></article>) : <EmptyState icon={Activity} title="Sem histórico" description="As ações realizadas aparecerão aqui." />}</section>
          </div>
        )}
      </aside>
    </div>
  );
}

function AdminView({ settings, onSettings, refreshKey, onChanged, onNotice }) {
  const [tab, setTab] = useState('import');
  const [users, setUsers] = useState([]);
  const [imports, setImports] = useState([]);
  const [importing, setImporting] = useState(false);
  const [identity, setIdentity] = useState({ office_name: settings.office_name || 'JMD Advocacia', office_subtitle: settings.office_subtitle || 'Gestão de leads jurídicos' });

  function loadAdmin() {
    Promise.all([api('/users'), api('/imports')]).then(([userList, importList]) => { setUsers(userList); setImports(importList); }).catch((error) => onNotice(error.message, 'error'));
  }
  useEffect(loadAdmin, [refreshKey]);

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) { onNotice('Selecione um arquivo .xlsx.', 'error'); return; }
    setImporting(true);
    try {
      const result = await api('/import/xlsx', { method: 'POST', raw: true, headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'X-File-Name': file.name }, body: await file.arrayBuffer() });
      onNotice(`${result.imported} leads importados; ${result.skipped} duplicados ignorados.`);
      if (result.warnings.length) onNotice(`${result.warnings.length} alerta(s) de qualidade foram registrados.`, 'error');
      onChanged();
      loadAdmin();
    } catch (error) { onNotice(error.message, 'error'); }
    finally { setImporting(false); event.target.value = ''; }
  }

  async function createUser(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api('/users', { method: 'POST', body: Object.fromEntries(form) });
      event.currentTarget.reset();
      loadAdmin();
      onNotice('Usuário criado com sucesso.');
    } catch (error) { onNotice(error.message, 'error'); }
  }

  async function toggleUser(user) {
    try { await api(`/users/${user.id}`, { method: 'PATCH', body: { active: !user.active } }); loadAdmin(); onNotice(`Usuário ${user.active ? 'desativado' : 'ativado'}.`); }
    catch (error) { onNotice(error.message, 'error'); }
  }

  async function saveIdentity(event) {
    event.preventDefault();
    try { const result = await api('/settings', { method: 'PATCH', body: identity }); onSettings(result.settings); onNotice('Identidade do painel atualizada.'); }
    catch (error) { onNotice(error.message, 'error'); }
  }

  async function changePassword(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get('newPassword') !== form.get('confirmation')) return onNotice('A confirmação da nova senha não confere.', 'error');
    try { await api('/auth/change-password', { method: 'POST', body: { currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword') } }); event.currentTarget.reset(); onNotice('Senha alterada com sucesso.'); }
    catch (error) { onNotice(error.message, 'error'); }
  }

  return (
    <div className="page-stack">
      <section className="admin-tabs panel"><div className="segmented-control">{[['import', 'Dados'], ['users', 'Usuários'], ['identity', 'Identidade'], ['security', 'Segurança']].map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div></section>
      {tab === 'import' && <section className="admin-grid"><div className="panel import-card"><div className="panel-heading"><div><p className="eyebrow">Migração e atualização</p><h2>Importar planilha de leads</h2></div><Upload size={22} /></div><p>Compatível com a estrutura de “Controle de leads 2026.xlsx”. Duplicados por data, telefone ou nome são ignorados.</p><label className={`upload-zone ${importing ? 'disabled' : ''}`}><Upload size={28} /><strong>{importing ? 'Importando e validando...' : 'Selecionar arquivo XLSX'}</strong><span>O arquivo é processado no servidor autenticado.</span><input type="file" accept=".xlsx" onChange={importFile} disabled={importing} /></label><div className="security-note"><CheckCircle2 size={18} /><span>A planilha não é publicada no frontend. Apenas os registros validados entram no banco protegido.</span></div></div><div className="panel"><div className="panel-heading"><div><p className="eyebrow">Portabilidade</p><h3>Backup dos leads</h3></div><Download size={21} /></div><p>Exporte a base atual para conferência, cópia de segurança ou análise externa.</p><a className="button button-secondary button-full" href="/api/export/leads.csv"><Download size={17} />Baixar CSV completo</a></div><div className="panel panel-full"><div className="panel-heading"><div><p className="eyebrow">Histórico</p><h3>Importações recentes</h3></div></div>{imports.length ? <div className="import-history">{imports.map((item) => <article key={item.id}><div className="file-icon">XLSX</div><div><strong>{item.fileName}</strong><span>{item.sheetName} · {formatDateTime(item.createdAt)}</span></div><div><b>{item.imported}</b><span>importados</span></div><div><b>{item.skipped}</b><span>duplicados</span></div>{item.warnings.length ? <span className="warning-chip"><AlertTriangle size={14} />{item.warnings.length} alerta(s)</span> : <span className="success-chip"><Check size={14} />Sem alertas</span>}</article>)}</div> : <EmptyState icon={Upload} title="Nenhuma importação" description="O histórico será exibido após o primeiro envio." />}</div></section>}
      {tab === 'users' && <section className="admin-grid"><form className="panel user-form" onSubmit={createUser}><div className="panel-heading"><div><p className="eyebrow">Controle de acesso</p><h2>Novo usuário</h2></div><UserPlus size={22} /></div><label className="field"><span>Nome</span><input name="name" required /></label><label className="field"><span>E-mail</span><input name="email" type="email" required /></label><label className="field"><span>Perfil</span><select name="role" defaultValue="atendimento">{ROLES.map((role) => <option value={role.id} key={role.id}>{role.label}</option>)}</select></label><label className="field"><span>Senha temporária</span><input name="password" type="password" minLength="12" required /><small>Mínimo de 12 caracteres, com letras e números.</small></label><button className="button button-primary button-full" type="submit"><UserPlus size={17} />Criar usuário</button></form><div className="panel panel-users"><div className="panel-heading"><div><p className="eyebrow">Equipe</p><h3>Usuários cadastrados</h3></div><Users size={21} /></div><div className="user-list">{users.map((member) => <article key={member.id}><div className="avatar">{member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div><div><strong>{member.name}</strong><span>{member.email}</span></div><span className="role-chip">{ROLES.find((role) => role.id === member.role)?.label}</span><span className={member.active ? 'status-active' : 'status-inactive'}>{member.active ? 'Ativo' : 'Inativo'}</span><button className="button button-small button-secondary" onClick={() => toggleUser(member)}>{member.active ? 'Desativar' : 'Ativar'}</button></article>)}</div></div></section>}
      {tab === 'identity' && <form className="panel settings-form" onSubmit={saveIdentity}><div className="panel-heading"><div><p className="eyebrow">Personalização</p><h2>Identidade do painel</h2></div><Scale size={22} /></div><div className="form-grid"><label className="field"><span>Nome do escritório</span><input value={identity.office_name} onChange={(event) => setIdentity((current) => ({ ...current, office_name: event.target.value }))} required /></label><label className="field"><span>Subtítulo</span><input value={identity.office_subtitle} onChange={(event) => setIdentity((current) => ({ ...current, office_subtitle: event.target.value }))} required /></label></div><button className="button button-primary" type="submit"><Save size={17} />Salvar identidade</button></form>}
      {tab === 'security' && <section className="admin-grid"><form className="panel user-form" onSubmit={changePassword}><div className="panel-heading"><div><p className="eyebrow">Conta atual</p><h2>Alterar minha senha</h2></div><Settings size={22} /></div><label className="field"><span>Senha atual</span><input name="currentPassword" type="password" required /></label><label className="field"><span>Nova senha</span><input name="newPassword" type="password" minLength="12" required /></label><label className="field"><span>Confirmar nova senha</span><input name="confirmation" type="password" minLength="12" required /></label><button className="button button-primary button-full" type="submit"><Save size={17} />Atualizar senha</button></form><div className="panel security-overview"><div className="panel-heading"><div><p className="eyebrow">Proteções ativas</p><h3>Segurança da aplicação</h3></div></div><ul><li><CheckCircle2 size={18} /><span><strong>Senhas com hash scrypt</strong>O valor original não é armazenado.</span></li><li><CheckCircle2 size={18} /><span><strong>Cookie HttpOnly e SameSite</strong>A sessão não fica disponível ao JavaScript.</span></li><li><CheckCircle2 size={18} /><span><strong>Proteção CSRF e permissões</strong>Toda alteração é validada no backend.</span></li><li><CheckCircle2 size={18} /><span><strong>Registro de atividades</strong>Contatos, etapas e usuários deixam histórico.</span></li></ul></div></section>}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState({ office_name: 'JMD Advocacia', office_subtitle: 'Gestão de leads jurídicos' });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api('/auth/me').then((result) => {
      setCsrfToken(result.csrfToken);
      setSession(result);
      setSettings(result.settings || settings);
    }).catch(() => {}).finally(() => setReady(true));
  }, []);

  function notice(message, type = 'success') {
    setToast({ id: Date.now(), message, type });
  }

  if (!ready) return <div className="app-loading"><div className="brand-mark"><Scale size={25} /></div><RefreshCw className="spin" size={20} /><span>Preparando ambiente seguro...</span></div>;
  return (
    <>
      {session ? <AppShell session={session} setSession={setSession} onNotice={notice} /> : <Login settings={settings} onLogin={(result) => { setSession(result); setSettings(result.settings || settings); }} />}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}
