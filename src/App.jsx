import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, KanbanSquare, CalendarDays, TrendingUp, 
  DollarSign, FileText, Settings, LogOut, Plus, X, 
  MessageSquare, Calendar, Link as LinkIcon, Image, 
  Bot, Save, Edit3, Trash2, ChevronDown, ChevronUp, Copy, Download,
  BarChart3, BrainCircuit, FileSearch
} from 'lucide-react';

// --- FUNÇÃO AUXILIAR DE NOMENCLATURA DE CARGOS ---
const getDisplayRole = (role) => {
  if (role === 'empresa' || role === 'cliente') return 'Cliente';
  if (role === 'gestor' || role === 'administrador') return 'Administrador';
  if (role === 'midias') return 'Mídias';
  return role;
};

// --- DADOS PADRÃO (Usados apenas se o banco da VPS estiver vazio) ---
const defaultUsers = [
  { id: 1, login: 'cliente', pass: 'cliente123', role: 'cliente', name: 'Cliente Azione' },
  { id: 2, login: 'gestor', pass: 'gestor123', role: 'administrador', name: 'Administrador Geral' },
  { id: 3, login: 'midias', pass: 'midias123', role: 'midias', name: 'Gestor de Mídias' }
];

const defaultKanban = [
  { id: '1', title: 'Campanha de Inverno', desc: 'Vídeo promocional para o instagram.', link: 'https://drive.google.com/file/d/123/preview', col: 'Produção', date: '', isCarousel: false, carousel: [], caption: '', comments: [] },
  { id: '2', title: 'Dicas de Marketing', desc: 'Carrossel com 3 dicas.', link: '', col: 'Programados', date: '2026-04-15', isCarousel: true, carousel: ['https://link1.com', 'https://link2.com'], caption: 'Confira essas dicas incríveis! #marketing', comments: [{ author: 'administrador', text: 'Aprovado para postagem!', date: new Date().toISOString() }] }
];

const defaultFinances = [
  { id: 1, desc: 'Fatura Abril', due: '2026-04-20', pix: '000.000.000-00', boleto: '', nf: '', status: 'Pendente' }
];

const defaultReports = [{ id: 1, date: new Date().toISOString().split('T')[0], leads: 150, cost: '5.50', contracts: 10, attachment: '', aiAnalysis: '', custom: [{ label: 'Alcance Total', value: '45.000' }, { label: 'CTR Médio', value: '2.5%' }] }];
const defaultDocs = [{ id: 1, title: 'Contrato Social', date: '2025-01-10', link: '' }];

// Novas configurações de personalização
const defaultConfig = { 
  companyName: 'Azione Marketing', 
  logo: '', 
  color: '#EF4444', // Vermelho do PDF
  secondaryColor: '#991B1B', 
  bgColor: '#F3F4F6', 
  textColor: '#1F2937',
  geminiKey: '',
  lookerStudioUrl: 'https://lookerstudio.google.com/reporting/10b2cbf5-4b1f-4f87-a96a-855d8067c523/page/4E6KF'
};

// --- HOOK DE PERSISTÊNCIA (Grava na VPS ou LocalStorage) ---
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/data/${key}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => {
        if (data && data.data) {
          // CORREÇÃO CRÍTICA: Garante que Arrays (Listas) não sejam convertidos em objetos
          if (Array.isArray(data.data)) {
            setState(data.data);
          } else if (typeof data.data === 'object' && data.data !== null) {
            setState({ ...initialValue, ...data.data }); 
          } else {
            setState(data.data);
          }
        }
        setIsLoaded(true);
      })
      .catch(err => {
        const local = localStorage.getItem(`azione_${key}`);
        if (local) { 
          try { 
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed)) setState(parsed);
            else if (typeof parsed === 'object' && parsed !== null) setState({ ...initialValue, ...parsed });
            else setState(parsed);
          } catch(e){} 
        }
        setIsLoaded(true);
      });
  }, [key]);

  const setPersistentState = (newValue) => {
    const valueToStore = typeof newValue === 'function' ? newValue(state) : newValue;
    setState(valueToStore);
    fetch(`/api/data/${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: valueToStore })
    }).catch(() => {
      localStorage.setItem(`azione_${key}`, JSON.stringify(valueToStore));
    });
  };

  return [state, setPersistentState, isLoaded];
}

// --- FUNÇÃO GLOBAL DE CHAMADA DO GEMINI ---
const callGeminiAPI = async (prompt, systemInstruction, config, showToast) => {
  if (!config.geminiKey) throw new Error("Chave API do Gemini não configurada.");
  
  const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
  let lastError = '';

  for (const model of modelsToTry) {
    try {
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] }
      };
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error?.message || `Erro HTTP ${res.status}`);
      
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text, model };
      throw new Error("Resposta vazia da IA.");
    } catch (e) {
      lastError = e.message;
    }
  }
  throw new Error(`Falha após tentar todos os modelos. Último erro: ${lastError}`);
};

// --- COMPONENTES DE UI ---
const Toast = ({ msg, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 5000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-bounce max-w-md border border-gray-700">
      <span className="text-sm font-medium">{msg}</span>
      <button onClick={onClose} className="hover:text-gray-300 flex-shrink-0"><X size={16} /></button>
    </div>
  );
};

// --- APP PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('kanban');
  const [toast, setToast] = useState('');

  // Estados com Persistência
  const [users, setUsers, uLoad] = usePersistentState('users', defaultUsers);
  const [kanban, setKanban, kLoad] = usePersistentState('kanban', defaultKanban);
  const [reports, setReports, rLoad] = usePersistentState('reports', defaultReports);
  const [finances, setFinances, fLoad] = usePersistentState('finances', defaultFinances);
  const [docs, setDocs, dLoad] = usePersistentState('docs', defaultDocs);
  const [config, setConfig, cLoad] = usePersistentState('config', defaultConfig);

  const [openCardId, setOpenCardId] = useState(null);

  const showToast = (msg) => setToast(msg);

  if (!uLoad || !kLoad || !rLoad || !fLoad || !dLoad || !cLoad) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-xl font-bold text-gray-500">Conectando ao banco de dados...</div></div>;
  }

  // Estilos Dinâmicos Globais Baseados nas Configurações
  const appStyles = {
    backgroundColor: config.bgColor || '#F3F4F6',
    color: config.textColor || '#1F2937'
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const login = e.target.login.value;
    const pass = e.target.pass.value;
    const found = users.find(u => u.login === login && u.pass === pass);
    if (found) {
      setUser(found);
      setView('kanban');
    } else {
      showToast('Credenciais inválidas!');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 transition-colors duration-500" style={{ backgroundColor: config.bgColor }}>
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-gray-100">
          {config.logo ? <img src={config.logo} alt="Logo" className="h-20 mx-auto mb-6 object-contain" /> : <h1 className="text-3xl font-black mb-6" style={{ color: config.color }}>{config.companyName}</h1>}
          <form onSubmit={handleLogin} className="space-y-4">
            <input name="login" type="text" placeholder="Usuário" required className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:ring-2 bg-gray-50 text-gray-800" style={{ focusRing: config.color }} />
            <input name="pass" type="password" placeholder="Senha" required className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:ring-2 bg-gray-50 text-gray-800" />
            <button type="submit" className="w-full text-white p-4 rounded-xl font-bold text-lg transition-transform hover:scale-[1.02] shadow-lg" style={{ backgroundColor: config.color }}>Acessar Painel</button>
          </form>
          <div className="mt-6 text-sm text-gray-500 flex flex-col gap-1">
            <p className="font-bold">Dicas de acesso:</p>
            <p>cliente / cliente123</p>
            <p>gestor / gestor123</p>
            <p>midias / midias123</p>
          </div>
          <div className="mt-6 text-xs font-medium text-gray-400">
            Azione Marketing e Propaganda © 2026
          </div>
        </div>
        {toast && <Toast msg={toast} onClose={() => setToast('')} />}
      </div>
    );
  }

  const menuItems = [
    { id: 'kanban', label: 'Esteira', icon: <KanbanSquare size={20} />, roles: ['empresa', 'cliente', 'gestor', 'administrador', 'midias'] },
    { id: 'calendar', label: 'Cronograma', icon: <CalendarDays size={20} />, roles: ['empresa', 'cliente', 'gestor', 'administrador', 'midias'] },
    { id: 'traffic', label: 'Tráfego & BI', icon: <TrendingUp size={20} />, roles: ['empresa', 'cliente', 'gestor', 'administrador'] },
    { id: 'finance', label: 'Financeiro', icon: <DollarSign size={20} />, roles: ['empresa', 'cliente', 'gestor', 'administrador'] },
    { id: 'docs', label: 'Documentos', icon: <FileText size={20} />, roles: ['empresa', 'cliente', 'gestor', 'administrador'] },
    { id: 'settings', label: 'Configurações', icon: <Settings size={20} />, roles: ['gestor', 'administrador'] },
  ].filter(item => item.roles.includes(user.role));

  return (
    <div className="min-h-screen flex flex-col md:flex-row transition-colors duration-500 font-sans" style={appStyles}>
      {/* Sidebar */}
      <aside className="bg-white border-r border-gray-200 md:w-64 flex-shrink-0 flex flex-col justify-between shadow-sm z-10" style={{ borderTop: `5px solid ${config.color}` }}>
        <div className="p-5 md:p-6">
          <div className="flex items-center gap-3 mb-8 overflow-hidden">
            {config.logo ? <img src={config.logo} alt="Logo" className="h-10 flex-shrink-0 object-contain" /> : <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-xl shadow-md" style={{ backgroundColor: config.color }}>AZ</div>}
            <div className="hidden md:block truncate">
              <h2 className="font-bold text-gray-800 leading-tight truncate text-lg">{config.companyName}</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{getDisplayRole(user.role)}</p>
            </div>
          </div>
          <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {menuItems.map(item => (
              <button key={item.id} onClick={() => setView(item.id)} className={`flex items-center gap-3 p-3 rounded-xl transition-all whitespace-nowrap font-semibold ${view === item.id ? 'text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`} style={view === item.id ? { backgroundColor: config.color } : {}}>
                {item.icon} <span className="hidden md:block">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="p-5 border-t border-gray-100 hidden md:block">
          <button onClick={() => setUser(null)} className="flex items-center justify-center gap-2 text-gray-500 hover:text-red-600 hover:bg-red-50 p-3 rounded-xl w-full transition-colors font-bold">
            <LogOut size={18} /> Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-[100vw] flex flex-col relative" style={{ color: config.textColor }}>
        <div className="flex-1 max-w-7xl mx-auto w-full">
          {view === 'kanban' && <KanbanView data={kanban} setData={setKanban} user={user} config={config} showToast={showToast} openCardId={openCardId} setOpenCardId={setOpenCardId} />}
          {view === 'calendar' && <CalendarView data={kanban} setData={setKanban} config={config} onOpenCard={(id) => { setView('kanban'); setOpenCardId(id); }} />}
          {view === 'traffic' && <TrafficView data={reports} setData={setReports} user={user} config={config} showToast={showToast} />}
          {view === 'finance' && <FinanceView data={finances} setData={setFinances} user={user} config={config} showToast={showToast} />}
          {view === 'docs' && <DocsView data={docs} setData={setDocs} user={user} config={config} />}
          {view === 'settings' && <SettingsView config={config} setConfig={setConfig} users={users} setUsers={setUsers} showToast={showToast} />}
        </div>
        
        <footer className="mt-12 pt-6 border-t border-gray-200/50 text-center text-xs font-semibold" style={{ color: `${config.textColor}80` }}>
          Este é um app oficial Azione Marketing, todos os direitos reservados!
        </footer>
      </main>
      
      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  );
}

// ==========================================
// VIEWS (Telas Secundárias)
// ==========================================

function KanbanView({ data, setData, user, config, showToast, openCardId, setOpenCardId }) {
  const columns = ['Ideias', 'Produção', 'Finalizados', 'Aprovados', 'Rejeitados', 'Programados', 'Postados'];
  const [activeCard, setActiveCard] = useState(null);

  useEffect(() => {
    if (openCardId) {
      const cardToOpen = data.find(c => c.id === openCardId);
      if (cardToOpen) setActiveCard(cardToOpen);
      setOpenCardId(null);
    }
  }, [openCardId, data, setOpenCardId]);

  const onDragStart = (e, id) => e.dataTransfer.setData('cardId', id);
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (e, col) => {
    const id = e.dataTransfer.getData('cardId');
    setData(prev => prev.map(c => c.id === id ? { ...c, col } : c));
  };

  const createCard = () => {
    const newCard = { id: Date.now().toString(), title: 'Nova Ideia', desc: '', link: '', col: 'Ideias', date: '', isCarousel: false, carousel: [], caption: '', comments: [] };
    setData([...data, newCard]);
    setActiveCard(newCard);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black">Esteira de Produção</h1>
          <p className="text-sm font-medium opacity-70 mt-1">Gerencie cards, aprove posts e acompanhe o funil de mídia.</p>
        </div>
        {['gestor', 'administrador', 'midias'].includes(user.role) && (
          <button onClick={createCard} className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl shadow-lg hover:opacity-90 font-bold transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>
            <Plus size={18} /> Novo Card
          </button>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 flex-1 items-start snap-x custom-scrollbar">
        {columns.map(col => (
          <div key={col} className="bg-white/40 backdrop-blur-md border border-gray-200/50 min-w-[300px] w-[300px] rounded-2xl p-4 flex flex-col max-h-[75vh] snap-start shadow-sm" onDragOver={onDragOver} onDrop={(e) => onDrop(e, col)}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200/50">
              <h3 className="font-bold text-lg opacity-90">{col}</h3>
              <span className="text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm" style={{ backgroundColor: config.secondaryColor }}>{data.filter(c => c.col === col).length}</span>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto pr-1">
              {data.filter(c => c.col === col).map(card => (
                <div key={card.id} draggable onDragStart={(e) => onDragStart(e, card.id)} onClick={() => setActiveCard(card)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all active:scale-95 group">
                  <h4 className="font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">{card.title}</h4>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-400 mt-3 pt-3 border-t border-gray-50">
                    {card.date ? <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(card.date).toLocaleDateString('pt-BR')}</span> : <span>Sem data</span>}
                    <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md"><MessageSquare size={12}/> {card.comments.length}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activeCard && (
        <CardModal card={activeCard} user={user} config={config} showToast={showToast} onClose={() => setActiveCard(null)} onSave={(updated) => {
          setData(prev => prev.map(c => c.id === updated.id ? updated : c));
          setActiveCard(null);
        }} />
      )}
    </div>
  );
}

function CardModal({ card, user, config, onClose, onSave, showToast }) {
  const [draft, setDraft] = useState({ ...card });
  const [commentText, setCommentText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const canEditCore = ['gestor', 'administrador', 'midias'].includes(user.role);
  
  const formatDriveLink = (url) => {
    if (!url) return '';
    return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
  };

  const handleAI = async () => {
    setAiLoading(true);
    try {
      const prompt = `Título do Post: ${draft.title}. Descrição: ${draft.desc}. Detalhes extras: ${aiPrompt}`;
      const systemInstruction = "Você atua como especialista em marketing e copywriter. Crie uma legenda chamativa para redes sociais, focada em conversão, com um bom CTA e hashtags estratégicas.";
      const { text, model } = await callGeminiAPI(prompt, systemInstruction, config, showToast);
      
      setDraft({ ...draft, caption: text });
      showToast(`Legenda gerada com sucesso (${model})!`);
    } catch (e) {
      showToast(e.message);
    } finally {
      setAiLoading(false);
      setAiPrompt('');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white text-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border border-white/20">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <h2 className="text-xl font-black">Detalhes do Card</h2>
          <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-gray-200 shadow-sm transition-colors text-gray-500"><X size={20}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white">
          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Título</label>
              <input disabled={!canEditCore} value={draft.title} onChange={e => setDraft({...draft, title: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-gray-50/50 font-bold text-lg" />
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Data Programada</label>
                <input type="date" value={draft.date} onChange={e => setDraft({...draft, date: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-gray-50/50" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Status (Coluna)</label>
                <select value={draft.col} onChange={e => setDraft({...draft, col: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white font-semibold">
                  {['Ideias', 'Produção', 'Finalizados', 'Aprovados', 'Rejeitados', 'Programados', 'Postados'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Descrição / Roteiro</label>
              <textarea disabled={!canEditCore} rows={3} value={draft.desc} onChange={e => setDraft({...draft, desc: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-gray-50/50 resize-none" placeholder="Detalhes do conteúdo..." />
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Link da Mídia (Drive)</label>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-200 cursor-pointer">
                  <input type="checkbox" disabled={!canEditCore} checked={draft.isCarousel} onChange={e => setDraft({...draft, isCarousel: e.target.checked})} className="accent-blue-600" />
                  Modo Carrossel
                </label>
              </div>
              
              {!draft.isCarousel ? (
                <input disabled={!canEditCore} value={draft.link} placeholder="Cole o link do Google Drive" onChange={e => setDraft({...draft, link: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white shadow-inner mb-2 text-sm" />
              ) : (
                <div className="space-y-2">
                  {draft.carousel.map((link, i) => (
                    <input key={i} disabled={!canEditCore} value={link} placeholder={`Link da Imagem/Vídeo ${i+1}`} onChange={e => {
                      const newC = [...draft.carousel]; newC[i] = e.target.value; setDraft({...draft, carousel: newC});
                    }} className="w-full p-3 border border-gray-200 rounded-xl text-sm bg-white shadow-inner" />
                  ))}
                  {canEditCore && draft.carousel.length < 15 && (
                    <button onClick={() => setDraft({...draft, carousel: [...draft.carousel, '']})} className="text-sm font-bold text-blue-600 flex items-center gap-1 w-full justify-center p-2 hover:bg-blue-50 rounded-lg transition-colors"><Plus size={16}/> Adicionar Slide (+1)</button>
                  )}
                </div>
              )}
              
              {/* Previews */}
              <div className="mt-4 flex flex-col gap-4">
                {!draft.isCarousel && draft.link && draft.link.includes('drive.google.com') && (
                  <iframe src={formatDriveLink(draft.link)} className="w-full h-72 border border-gray-200 rounded-xl bg-white shadow-sm" title="Preview"></iframe>
                )}
                {draft.isCarousel && draft.carousel.map((link, idx) => link && link.includes('drive.google.com') && (
                  <div key={idx} className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-400 uppercase">Slide {idx + 1}</span>
                    <iframe src={formatDriveLink(link)} className="w-full h-72 border border-gray-200 rounded-xl bg-white shadow-sm" title={`Preview ${idx + 1}`}></iframe>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Coluna Direita */}
          <div className="space-y-5 flex flex-col">
            <div className="flex-1 flex flex-col">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Legenda (Copy)</label>
              <textarea value={draft.caption} onChange={e => setDraft({...draft, caption: e.target.value})} className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:border-blue-500 flex-1 min-h-[150px] resize-none mb-3 bg-gray-50/50 leading-relaxed text-gray-700" placeholder="Escreva a legenda ou gere com IA..." />
              
              {canEditCore && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-2xl">
                  <p className="text-xs font-black text-blue-800 mb-3 flex items-center gap-1.5 uppercase tracking-wider"><Bot size={16}/> Gerador Automático de Legenda (IA)</p>
                  <input placeholder="Ex: Focar na dor do cliente, tom descontraído..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="w-full text-sm p-3 border border-white/60 rounded-xl outline-none mb-3 bg-white/80 shadow-inner focus:border-blue-300" />
                  <button onClick={handleAI} disabled={aiLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-md">
                    {aiLoading ? <span className="animate-pulse">Criando magia...</span> : 'Gerar Super Legenda'}
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Comentários e Feedbacks</label>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 h-48 overflow-y-auto space-y-3 mb-3 custom-scrollbar shadow-inner">
                {draft.comments.length === 0 && <p className="text-xs font-medium text-gray-400 text-center mt-6">Nenhuma observação ainda.</p>}
                {draft.comments.map((c, i) => (
                  <div key={i} className={`p-3 rounded-xl border text-sm ${['empresa', 'cliente'].includes(c.author) ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="font-bold text-gray-800 uppercase tracking-wider">{getDisplayRole(c.author)}</span>
                      <span className="text-gray-400 font-medium">{new Date(c.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short'})}</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Deixe um comentário para a equipe..." className="flex-1 p-3 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 focus:bg-white focus:border-blue-400 transition-colors" />
                <button onClick={() => {
                  if(!commentText.trim()) return;
                  setDraft({...draft, comments: [...draft.comments, { author: user.role, text: commentText, date: new Date().toISOString() }]});
                  setCommentText('');
                }} className="bg-gray-800 hover:bg-black text-white px-5 rounded-xl font-bold shadow-md transition-colors"><Plus size={18}/></button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-2.5 font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-xl transition-colors">Cancelar</button>
          <button onClick={() => onSave(draft)} className="px-6 py-2.5 font-bold text-white rounded-xl shadow-lg flex items-center gap-2 transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>
            <Save size={18}/> Salvar e Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ data, config, onOpenCard }) {
  const progCards = data.filter(c => c.col === 'Programados' && c.date).sort((a,b) => new Date(a.date) - new Date(b.date));
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black">Cronograma de Postagens</h1>
        <p className="text-sm font-medium opacity-70 mt-1">Visualize os conteúdos com data marcada para ir ao ar.</p>
      </div>
      <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-gray-200/50">
        <div className="space-y-4">
          {progCards.length === 0 && (
            <div className="text-center py-12">
              <CalendarDays size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold opacity-60">Nenhum post programado com data definida.</p>
            </div>
          )}
          {progCards.map(c => (
            <div key={c.id} className="flex flex-col md:flex-row md:items-center p-5 border-l-[6px] rounded-r-2xl bg-white shadow-sm hover:shadow-md transition-shadow group" style={{ borderLeftColor: config.color }}>
              <div className="w-full md:w-32 flex-shrink-0 text-center border-b md:border-b-0 md:border-r border-gray-100 pb-3 md:pb-0 md:pr-5 mb-3 md:mb-0">
                <p className="text-3xl font-black" style={{ color: config.color }}>{new Date(c.date).getDate() + 1}</p>
                <p className="text-xs uppercase font-black opacity-40">{new Date(c.date).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="md:pl-5 flex-1 mb-4 md:mb-0">
                <h3 className="font-black text-lg group-hover:text-blue-600 transition-colors">{c.title}</h3>
                <p className="text-sm opacity-70 line-clamp-2 mt-1">{c.caption || c.desc}</p>
              </div>
              <div className="md:px-4 flex flex-row md:flex-col gap-2 items-start md:items-end w-full md:w-auto">
                <span className="text-xs font-bold bg-gray-100 py-1.5 px-4 rounded-full border border-gray-200 uppercase tracking-wider opacity-80">
                  Agendado
                </span>
                <button onClick={() => onOpenCard(c.id)} className="text-xs font-bold bg-gray-800 hover:bg-black text-white py-1.5 px-4 rounded-full transition-colors shadow-sm w-full md:w-auto">
                  Ver no Kanban
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrafficView({ data, setData, user, config, showToast }) {
  const isClient = ['empresa', 'cliente'].includes(user.role);
  const [activeTab, setActiveTab] = useState('looker'); // 'looker', 'reports'
  const [expandedId, setExpandedId] = useState(null);
  const [aiLoadingId, setAiLoadingId] = useState(null);

  const getEmbedUrl = (url) => {
    if(!url) return '';
    if(url.includes('/embed/')) return url;
    return url.replace('/u/0/reporting/', '/embed/reporting/').replace('/reporting/', '/embed/reporting/');
  };

  const addReport = () => {
    const newRep = { id: Date.now(), date: new Date().toISOString().split('T')[0], leads: 0, cost: '0', contracts: 0, attachment: '', aiAnalysis: '', custom: [] };
    setData([newRep, ...data]);
    setExpandedId(newRep.id);
  };

  const generateAIForReport = async (reportId) => {
    setAiLoadingId(reportId);
    try {
      const rep = data.find(r => r.id === reportId);
      const metricsText = `Leads: ${rep.leads}, Custo por Lead: R$ ${rep.cost}, Contratos Fechados: ${rep.contracts}. ` + rep.custom.map(c => `${c.label}: ${c.value}`).join(', ');
      
      const prompt = `Atuando de forma extremamente profissional como a agência ${config.companyName}, redija uma análise de performance executiva para nosso cliente referente ao período atual. Use os seguintes dados extraídos do dashboard do Google/Meta Ads: ${metricsText}. \nDivida o texto usando headers markdown (##) nestas seções: "Resumo Executivo do Período", "Análise de Plataformas e Eficiência", e "Próximos Passos e Recomendações". Não mencione que você é uma IA, aja 100% como um analista humano sênior enviando um relatório direto ao cliente.`;
      const sysInst = "Você é um Analista Senior de Performance. Produza um relatório claro, profissional e focado em resultados reais.";

      const { text, model } = await callGeminiAPI(prompt, sysInst, config, showToast);
      
      setData(data.map(d => d.id === reportId ? { ...d, aiAnalysis: text } : d));
      showToast(`Análise gerada e incorporada com sucesso (${model})!`);
    } catch (e) {
      showToast(e.message);
    } finally {
      setAiLoadingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black">Performance & Business Intelligence</h1>
          <p className="text-sm font-medium opacity-70 mt-1">Acompanhe as métricas e relatórios das suas campanhas de tráfego.</p>
        </div>
        
        {/* Navegação de Abas - Unificada e Adaptada por Perfil */}
        <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit">
          <button onClick={() => setActiveTab('looker')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'looker' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}>
            <BarChart3 size={16}/> Dashboard Integrado
          </button>
          <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:text-gray-800'}`}>
            <FileSearch size={16}/> {isClient ? 'Relatórios Azione' : 'Gerenciar Relatórios'}
          </button>
        </div>
      </div>

      {/* ABA 1: LOOKER STUDIO */}
      {activeTab === 'looker' && (
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-200/50 overflow-hidden flex flex-col min-h-[600px]">
          {config.lookerStudioUrl ? (
            <div className="flex-1 flex flex-col">
              <div className="bg-yellow-50 p-3 text-center text-xs font-bold text-yellow-700 border-b border-yellow-200 flex flex-col md:flex-row justify-center items-center gap-2">
                <span className="text-xl">⚠️</span> 
                <span><strong>Aviso de Segurança Google:</strong> Se o painel não carregar, acesse seu Looker Studio, vá em <strong>Arquivo &gt; Incorporar Relatório</strong> e marque a caixa <strong>Ativar Incorporação</strong>.</span>
              </div>
              <iframe src={getEmbedUrl(config.lookerStudioUrl)} frameBorder="0" style={{ border: 0 }} allowFullScreen className="w-full h-full flex-1 min-h-[700px]"></iframe>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full flex-1 p-12 text-center opacity-60">
              <BarChart3 size={64} className="mb-4" />
              <h3 className="text-xl font-bold">Dashboard não configurado</h3>
              <p className="text-sm mt-2">O Gestor precisa inserir a URL do Looker Studio na aba de Configurações.</p>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: RELATÓRIOS (Visão Unificada: IA + PDF) */}
      {activeTab === 'reports' && (
        <div className="max-w-5xl w-full mx-auto space-y-5">
          {!isClient && (
            <div className="flex justify-between items-center bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-2">
              <p className="text-sm font-semibold text-blue-800">Extraia o PDF do Looker Studio, insira os dados cruciais abaixo e gere uma análise para o cliente com IA.</p>
              <button onClick={addReport} className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>
                <Plus size={18} /> Novo Relatório
              </button>
            </div>
          )}
          
          {data.map((rep, idx) => (
            <div key={rep.id} className="bg-white rounded-3xl shadow-sm border border-gray-200/50 overflow-hidden hover:shadow-md transition-shadow">
              <div onClick={() => setExpandedId(expandedId === rep.id ? null : rep.id)} className="p-6 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: `${config.secondaryColor}20`, color: config.secondaryColor }}><TrendingUp size={26}/></div>
                  <div>
                    <h3 className="font-black text-xl text-gray-800">Relatório de Performance</h3>
                    <p className="text-sm font-bold opacity-60 mt-0.5">Mês de Referência: {new Date(rep.date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</p>
                  </div>
                </div>
                <div className="bg-gray-100 p-3 rounded-xl text-gray-500 shadow-sm border border-gray-200">
                  {expandedId === rep.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                </div>
              </div>

              {expandedId === rep.id && (
                <div className="border-t border-gray-100">
                  
                  {/* VISÃO DO GESTOR: Inserção de Dados e Geração */}
                  {!isClient && (
                    <div className="p-6 bg-gray-50/80 border-b border-gray-200/50">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4">1. Inserção de Métricas do Dashboard</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <MetricBox label="Leads Totais" val={rep.leads} onChange={v => { const n = [...data]; n[idx].leads = v; setData(n); }} edit={true} color={config.color} />
                        <MetricBox label="Custo / Lead" val={`R$ ${rep.cost}`} onChange={v => { const n = [...data]; n[idx].cost = v.replace('R$ ', ''); setData(n); }} edit={true} color={config.color} />
                        <MetricBox label="Contratos" val={rep.contracts} onChange={v => { const n = [...data]; n[idx].contracts = v; setData(n); }} edit={true} color={config.color} />
                        {rep.custom.map((c, cidx) => (
                          <MetricBox key={cidx} label={c.label} val={c.value} onChange={v => { const n = [...data]; n[idx].custom[cidx].value = v; setData(n); }} edit={true} color={config.color} />
                        ))}
                        <div className="border-2 border-dashed border-gray-300 p-2 rounded-2xl flex flex-col items-center justify-center bg-white hover:bg-gray-50 transition-colors">
                           <button onClick={() => { const label = prompt("Nome da nova métrica (Ex: ROAS):"); if(label) { const n = [...data]; n[idx].custom.push({ label, value: '0' }); setData(n); } }} className="text-xs font-bold text-gray-500 hover:text-blue-600 w-full">+ Adicionar</button>
                        </div>
                      </div>

                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-4">2. Análise do Período</h4>
                      <div className="flex flex-col gap-3">
                        <textarea 
                          value={rep.aiAnalysis} 
                          onChange={e => { const n = [...data]; n[idx].aiAnalysis = e.target.value; setData(n); }} 
                          className="w-full p-5 border border-gray-200 rounded-2xl outline-none focus:border-blue-400 min-h-[200px] text-gray-700 bg-white leading-relaxed shadow-inner resize-none"
                          placeholder="Você pode escrever a análise manualmente aqui ou usar a Inteligência Artificial clicando no botão abaixo..."
                        />
                        <button 
                          onClick={() => generateAIForReport(rep.id)} 
                          disabled={aiLoadingId === rep.id} 
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-md transition-transform hover:scale-[1.01] flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                          {aiLoadingId === rep.id ? <span className="animate-pulse">Analisando métricas e elaborando relatório...</span> : <><BrainCircuit size={18}/> Redigir Análise com IA (Baseado nas Métricas)</>}
                        </button>
                      </div>

                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mt-8 mb-4">3. Anexar PDF do Looker Studio</h4>
                      <div className="flex gap-2">
                        <input value={rep.attachment} onChange={e => { const n = [...data]; n[idx].attachment = e.target.value; setData(n); }} className="flex-1 p-3 border border-gray-200 rounded-xl outline-none text-sm bg-white" placeholder="Link do Google Drive contendo o PDF do relatório..." />
                      </div>
                    </div>
                  )}

                  {/* VISÃO DO CLIENTE: O Relatório Pronto, Bonito e Profissional */}
                  <div className="p-8 bg-white">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-gray-100 pb-6">
                      <div>
                        <h2 className="text-2xl font-black" style={{ color: config.color }}>Análise Executiva</h2>
                        <p className="text-sm text-gray-500 font-semibold mt-1">Visão estratégica da equipe {config.companyName}</p>
                      </div>
                      {rep.attachment && (
                        <a href={rep.attachment} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-transform hover:scale-105 w-full md:w-auto justify-center" style={{ backgroundColor: config.secondaryColor }}>
                          <Download size={18}/> Baixar Relatório em PDF
                        </a>
                      )}
                    </div>

                    {!rep.aiAnalysis ? (
                      <div className="text-center py-10 opacity-40 font-bold text-gray-500">A análise estratégica deste período está sendo elaborada pela equipe.</div>
                    ) : (
                      <div className="prose prose-lg max-w-none text-gray-700">
                        {rep.aiAnalysis.split('\n').map((line, i) => {
                          if(line.startsWith('##')) return <h3 key={i} className="text-xl font-black mt-8 mb-4 text-gray-800 border-l-4 pl-3" style={{ borderLeftColor: config.color }}>{line.replace(/#/g, '')}</h3>;
                          if(line.startsWith('#')) return <h2 key={i} className="text-2xl font-black mt-8 mb-4 text-gray-900">{line.replace(/#/g, '')}</h2>;
                          if(line.startsWith('* ') || line.startsWith('- ')) return <li key={i} className="ml-4 mb-2">{line.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>;
                          if(!line.trim()) return <br key={i}/>;
                          return <p key={i} className="mb-4 leading-relaxed" dangerouslySetInnerHTML={{__html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>')}}></p>;
                        })}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, val, onChange, edit, color }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
      <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">{label}</span>
      {edit ? (
        <input value={val} onChange={e => onChange(e.target.value)} className="font-black text-2xl text-center w-full outline-none border-b-2 focus:border-opacity-100 border-transparent transition-colors" style={{ color: color, focusBorderColor: color }} />
      ) : (
        <span className="font-black text-2xl" style={{ color: color }}>{val}</span>
      )}
    </div>
  );
}

function FinanceView({ data, setData, user, config, showToast }) {
  const isAdmin = ['gestor', 'administrador'].includes(user.role);
  const [editingFin, setEditingFin] = useState(null);

  const copyPix = (pix) => {
    if(!pix) return showToast("Nenhuma chave PIX cadastrada!");
    const el = document.createElement('textarea'); el.value = pix; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    showToast("Chave PIX copiada com sucesso!");
  };

  const handleSaveModal = (updatedFin) => {
    if(updatedFin.id === 'new') setData([...data, { ...updatedFin, id: Date.now() }]);
    else setData(data.map(d => d.id === updatedFin.id ? updatedFin : d));
    setEditingFin(null);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black">Departamento Financeiro</h1>
          <p className="text-sm font-medium opacity-70 mt-1">Controle de faturas, boletos, PIX e Notas Fiscais.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setEditingFin({ id: 'new', desc: 'Nova Cobrança Mensalidade', due: '', pix: '', boleto: '', nf: '', status: 'Pendente' })} className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>
            <Plus size={18} /> Nova Fatura
          </button>
        )}
      </div>

      <div className="bg-white/60 backdrop-blur-md rounded-3xl shadow-sm border border-gray-200/50 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100/50 text-sm uppercase tracking-wider font-bold opacity-70 border-b border-gray-200/50">
              <th className="p-5">Descrição do Serviço</th>
              <th className="p-5">Vencimento</th>
              <th className="p-5">Status</th>
              <th className="p-5 text-right">Ações e Documentos</th>
            </tr>
          </thead>
          <tbody>
            {data.map((fin) => (
              <tr key={fin.id} className="border-b border-gray-100 hover:bg-white transition-colors">
                <td className="p-5 font-black text-gray-800 text-lg">{fin.desc}</td>
                <td className="p-5 font-semibold opacity-80">{fin.due ? new Date(fin.due).toLocaleDateString('pt-BR') : 'N/A'}</td>
                <td className="p-5">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide border shadow-sm ${fin.status === 'Pago' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                    {fin.status || 'Pendente'}
                  </span>
                </td>
                <td className="p-5 flex gap-2 justify-end">
                  <button onClick={() => copyPix(fin.pix)} className="p-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 shadow-sm transition-colors" title="Copiar PIX"><Copy size={18}/></button>
                  <a href={fin.boleto || '#'} target="_blank" rel="noreferrer" onClick={e => !fin.boleto && e.preventDefault()} className={`p-2.5 rounded-xl shadow-sm transition-colors ${fin.boleto ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100'}`} title="Baixar Boleto"><FileText size={18}/></a>
                  <a href={fin.nf || '#'} target="_blank" rel="noreferrer" onClick={e => !fin.nf && e.preventDefault()} className={`p-2.5 rounded-xl shadow-sm transition-colors ${fin.nf ? 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100'}`} title="Baixar NF"><Download size={18}/></a>
                  {isAdmin && (
                    <>
                      <div className="w-px bg-gray-200 mx-1"></div>
                      <button onClick={() => setEditingFin(fin)} className="p-2.5 bg-yellow-50 text-yellow-600 rounded-xl hover:bg-yellow-100 border border-yellow-100 shadow-sm" title="Editar"><Edit3 size={18}/></button>
                      <button onClick={() => {setData(data.filter(d => d.id !== fin.id)); showToast("Fatura apagada!");}} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 border border-red-100 shadow-sm" title="Apagar"><Trash2 size={18}/></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan="4" className="p-10 text-center font-bold opacity-50">Nenhuma fatura encontrada no sistema.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal Finanças igual ao anterior, reestilizado */}
      {editingFin && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-5 text-gray-800">
            <h3 className="text-2xl font-black border-b border-gray-100 pb-4">Detalhes da Cobrança</h3>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Descrição do Serviço</label>
              <input value={editingFin.desc} onChange={e => setEditingFin({...editingFin, desc: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none font-bold bg-gray-50 focus:bg-white" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Vencimento</label>
                <input type="date" value={editingFin.due} onChange={e => setEditingFin({...editingFin, due: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Status</label>
                <select value={editingFin.status || 'Pendente'} onChange={e => setEditingFin({...editingFin, status: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none font-bold bg-gray-50 focus:bg-white">
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Chave PIX</label>
              <input value={editingFin.pix} onChange={e => setEditingFin({...editingFin, pix: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white" placeholder="Celular, CNPJ, Email ou Aleatória..." />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Link do Boleto (Google Drive/PDF)</label>
              <input value={editingFin.boleto} onChange={e => setEditingFin({...editingFin, boleto: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white text-sm" placeholder="https://..." />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Link da Nota Fiscal (Google Drive/PDF)</label>
              <input value={editingFin.nf} onChange={e => setEditingFin({...editingFin, nf: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white text-sm" placeholder="https://..." />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button onClick={() => setEditingFin(null)} className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
              <button onClick={() => handleSaveModal(editingFin)} className="px-6 py-3 font-bold text-white rounded-xl shadow-lg transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>Salvar Fatura</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocsView({ data, setData, user, config }) {
  const isAdmin = ['gestor', 'administrador'].includes(user.role);
  const [editingDocLink, setEditingDocLink] = useState(null);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black">Documentos Oficiais</h1>
          <p className="text-sm font-medium opacity-70 mt-1">Acesso a contratos, aditivos e propostas.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setData([...data, { id: Date.now(), title: 'Novo Documento Legal', date: '', link: '' }])} className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>
            <Plus size={18} /> Upload de Arquivo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {data.map((doc, idx) => (
          <div key={doc.id} className="bg-white/60 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-gray-200/50 flex flex-col gap-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-5 w-full pr-2">
                <div className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-inner" style={{ backgroundColor: `${config.secondaryColor}20`, color: config.secondaryColor }}><FileText size={28}/></div>
                <div className="w-full">
                  {isAdmin ? <input value={doc.title} onChange={e => { const n = [...data]; n[idx].title = e.target.value; setData(n); }} className="font-black text-lg border-b-2 border-transparent focus:border-gray-300 bg-transparent outline-none text-gray-800 w-full transition-colors" placeholder="Título Legal..." /> : <h3 className="font-black text-lg text-gray-800">{doc.title}</h3>}
                  {isAdmin ? <input type="date" value={doc.date} onChange={e => { const n = [...data]; n[idx].date = e.target.value; setData(n); }} className="text-xs font-bold opacity-60 bg-transparent outline-none mt-1 w-full" /> : <p className="text-xs font-bold opacity-60 mt-1">Data Assinatura: {new Date(doc.date).toLocaleDateString('pt-BR')}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <>
                    <button onClick={() => setEditingDocLink(editingDocLink === doc.id ? null : doc.id)} className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 text-gray-600 transition-colors"><Edit3 size={18}/></button>
                    <button onClick={() => setData(data.filter(d => d.id !== doc.id))} className="p-3 bg-red-50 rounded-xl hover:bg-red-100 text-red-600 transition-colors"><Trash2 size={18}/></button>
                  </>
                )}
                <a href={doc.link || '#'} target="_blank" rel="noreferrer" onClick={e => !doc.link && e.preventDefault()} className={`p-3 rounded-xl transition-colors shadow-sm ${doc.link ? 'text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`} style={doc.link ? { backgroundColor: config.color } : {}}><Download size={18}/></a>
              </div>
            </div>
            {editingDocLink === doc.id && (
              <div className="flex gap-2 w-full pt-4 border-t border-gray-100">
                <input autoFocus value={doc.link} onChange={e => { const n = [...data]; n[idx].link = e.target.value; setData(n); }} placeholder="https:// link do PDF (Drive)..." className="flex-1 p-3 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 font-medium" />
                <button onClick={() => setEditingDocLink(null)} className="text-white px-5 rounded-xl font-bold shadow-md transition-transform hover:scale-105" style={{ backgroundColor: config.secondaryColor }}>Salvar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView({ config, setConfig, users, setUsers, showToast }) {
  const [newUser, setNewUser] = useState({ login: '', pass: '', role: 'cliente', name: '' });
  const [testingApi, setTestingApi] = useState(false);

  const handleTestApi = async () => {
    if (!config.geminiKey) return showToast("Insira a chave da API antes de testar.");
    setTestingApi(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.geminiKey}`);
      if (res.ok) showToast(`✅ Chave API validada e pronta para uso!`);
      else throw new Error("Chave inválida.");
    } catch (err) {
      showToast(`❌ Erro na chave: ${err.message}`);
    } finally {
      setTestingApi(false);
    }
  };

  // Componente Reutilizável para Input de Códigos HEX Livres
  const HexInput = ({ label, value, onChange }) => (
    <div>
      <label className="text-[10px] font-bold opacity-60 uppercase tracking-wider block mb-1">{label}</label>
      <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
        <input value={value} onChange={e => onChange(e.target.value)} className="w-full bg-transparent outline-none font-mono text-sm uppercase text-gray-700 px-2" placeholder="#000000" maxLength={7} />
        <div className="w-8 h-8 rounded-lg shadow-sm border border-gray-200 flex-shrink-0" style={{ backgroundColor: value }}></div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-black">Painel de Controle e Customização</h1>
        <p className="text-sm font-medium opacity-70 mt-1">Ajuste cores globais, integrações de IA e gerencie os usuários do sistema.</p>
      </div>
      
      {/* 1. Customização Visual Avançada */}
      <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-gray-200/50 space-y-6">
        <h2 className="text-xl font-black border-b border-gray-100 pb-3 flex items-center gap-2">🎨 Identidade Visual (White-label)</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Nome Fantasia do Painel</label>
              <input value={config.companyName} onChange={e => setConfig({...config, companyName: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none font-bold bg-gray-50 focus:bg-white focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">URL da Logotipo</label>
              <input value={config.logo} onChange={e => setConfig({...config, logo: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 focus:bg-white focus:border-blue-400" placeholder="Ex: https://..." />
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HexInput label="Cor Primária" value={config.color} onChange={v => setConfig({...config, color: v})} />
            <HexInput label="Cor Secundária" value={config.secondaryColor} onChange={v => setConfig({...config, secondaryColor: v})} />
            <HexInput label="Fundo Global" value={config.bgColor} onChange={v => setConfig({...config, bgColor: v})} />
            <HexInput label="Texto / Contraste" value={config.textColor} onChange={v => setConfig({...config, textColor: v})} />
          </div>
        </div>
      </div>

      {/* 2. Integrações Poderosas */}
      <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-gray-200/50 space-y-6">
        <h2 className="text-xl font-black border-b border-gray-100 pb-3 flex items-center gap-2">🔗 Motores Externos (Looker & IA)</h2>
        <div className="space-y-5">
          <div>
            <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Dashboard Embed URL (Looker Studio)</label>
            <input value={config.lookerStudioUrl} onChange={e => setConfig({...config, lookerStudioUrl: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 focus:bg-white focus:border-blue-400 font-medium" placeholder="Cole o link do seu relatório Looker Studio aqui..." />
            <p className="text-[10px] font-bold text-blue-600 mt-1 uppercase tracking-wide">Cole o link padrão e o sistema converterá em Embed Automaticamente.</p>
          </div>
          <div>
            <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Google AI Studio Key (Gemini API)</label>
            <div className="flex gap-2">
              <input type="password" value={config.geminiKey} onChange={e => setConfig({...config, geminiKey: e.target.value})} className="flex-1 p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white focus:border-blue-400 font-mono" placeholder="AIzaSy..." />
              <button onClick={handleTestApi} disabled={testingApi} className="bg-gray-800 text-white px-5 rounded-xl font-bold shadow-md hover:bg-black transition-colors disabled:opacity-50">
                {testingApi ? 'Testando...' : 'Verificar API'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Usuários */}
      <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-gray-200/50 space-y-6">
        <h2 className="text-xl font-black border-b border-gray-100 pb-3">👥 Gerenciamento de Acessos</h2>
        <div className="space-y-3">
          {users.map((u, i) => (
            <div key={u.id} className="flex gap-3 items-center border border-gray-100 p-3 rounded-2xl bg-gray-50 shadow-inner">
              <span className="bg-white shadow-sm border border-gray-200 text-xs font-black px-3 py-1.5 rounded-lg uppercase tracking-wider w-32 text-center text-gray-700">{getDisplayRole(u.role)}</span>
              <input value={u.login} onChange={e => { const n = [...users]; n[i].login = e.target.value; setUsers(n); }} className="flex-1 outline-none font-bold text-gray-800 bg-transparent" placeholder="Login" />
              <input value={u.pass} onChange={e => { const n = [...users]; n[i].pass = e.target.value; setUsers(n); }} className="flex-1 outline-none text-gray-500 font-medium bg-transparent" placeholder="Senha" type="text" />
              <button onClick={() => {if(users.length>1) setUsers(users.filter(usr=>usr.id!==u.id)); else showToast("Impossível apagar o último.")}} className="p-2.5 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors"><Trash2 size={18}/></button>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200/50">
          <h3 className="text-sm font-black text-gray-800 mb-3 uppercase tracking-wider">Novo Colaborador / Cliente</h3>
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="p-3.5 border border-gray-200 rounded-xl outline-none font-bold text-sm w-full md:w-40 bg-white shadow-sm focus:border-blue-400">
              <option value="cliente">Cliente</option>
              <option value="administrador">Administrador</option>
              <option value="midias">Mídias</option>
            </select>
            <input value={newUser.login} onChange={e => setNewUser({...newUser, login: e.target.value})} className="flex-1 p-3.5 border border-gray-200 rounded-xl outline-none font-bold text-sm w-full bg-white shadow-sm focus:border-blue-400" placeholder="Nome de Usuário" />
            <input value={newUser.pass} onChange={e => setNewUser({...newUser, pass: e.target.value})} className="flex-1 p-3.5 border border-gray-200 rounded-xl outline-none font-medium text-sm w-full bg-white shadow-sm focus:border-blue-400" placeholder="Senha Forte" type="text" />
            <button onClick={() => { if(newUser.login) { setUsers([...users, {...newUser, id:Date.now()}]); setNewUser({login:'', pass:'', role:'cliente', name:''}); showToast("Usuário adicionado!"); }}} className="w-full md:w-auto px-8 py-3.5 rounded-xl font-black text-white shadow-lg transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>Adicionar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
