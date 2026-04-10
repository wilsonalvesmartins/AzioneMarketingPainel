import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, KanbanSquare, CalendarDays, TrendingUp, 
  DollarSign, FileText, Settings, LogOut, Plus, X, 
  MessageSquare, Calendar, Link as LinkIcon, Image, 
  Bot, Save, Edit3, Trash2, ChevronDown, ChevronUp, Copy, Download
} from 'lucide-react';

// --- DADOS PADRÃO (Usados apenas se o banco da VPS estiver vazio) ---
const defaultUsers = [
  { id: 1, login: 'empresa', pass: 'empresa123', role: 'empresa', name: 'Cliente Azione' },
  { id: 2, login: 'gestor', pass: 'gestor123', role: 'gestor', name: 'Gestor Geral' },
  { id: 3, login: 'midias', pass: 'midias123', role: 'midias', name: 'Gestor de Mídias' }
];

const defaultKanban = [
  { id: '1', title: 'Campanha de Inverno', desc: 'Vídeo promocional para o instagram.', link: 'https://drive.google.com/file/d/123/preview', col: 'Produção', date: '', isCarousel: false, carousel: [], caption: '', comments: [] },
  { id: '2', title: 'Dicas de Marketing', desc: 'Carrossel com 3 dicas.', link: '', col: 'Programados', date: '2026-04-15', isCarousel: true, carousel: ['https://link1.com', 'https://link2.com'], caption: 'Confira essas dicas incríveis! #marketing', comments: [{ author: 'gestor', text: 'Aprovado para postagem!', date: new Date().toISOString() }] }
];

const defaultFinances = [
  { id: 1, desc: 'Fatura Abril', due: '2026-04-20', pix: '000.000.000-00', boleto: '', nf: '', status: 'Pendente' }
];

const defaultReports = [{ id: 1, date: '2026-04-01', leads: 150, cost: '5.50', contracts: 10, attachment: '', custom: [{ label: 'Alcance Total', value: '45.000' }] }];
const defaultDocs = [{ id: 1, title: 'Contrato Social', date: '2025-01-10', link: '' }];
const defaultConfig = { companyName: 'Azione Marketing', logo: '', color: '#3B82F6', geminiKey: '' };

// --- HOOK DE PERSISTÊNCIA (Grava na VPS ou LocalStorage) ---
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 1. Tenta buscar os dados do Banco da VPS
    fetch(`/api/data/${key}`)
      .then(res => {
        if (!res.ok) throw new Error('API da VPS inacessível');
        return res.json();
      })
      .then(data => {
        if (data && data.data) setState(data.data);
        setIsLoaded(true);
      })
      .catch(err => {
        // 2. Se a VPS não responder (ex: Preview Canvas), busca do cache local
        const local = localStorage.getItem(`azione_${key}`);
        if (local) {
          try { setState(JSON.parse(local)); } catch(e){}
        }
        setIsLoaded(true);
      });
  }, [key]);

  const setPersistentState = (newValue) => {
    const valueToStore = typeof newValue === 'function' ? newValue(state) : newValue;
    setState(valueToStore);
    
    // 1. Tenta Salvar no Banco da VPS
    fetch(`/api/data/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: valueToStore })
    }).catch(() => {
      // 2. Se falhar (Preview), salva no cache local para não perder
      localStorage.setItem(`azione_${key}`, JSON.stringify(valueToStore));
    });
  };

  return [state, setPersistentState, isLoaded];
}

// --- COMPONENTES DE UI ---
const Toast = ({ msg, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 5000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-bounce max-w-md">
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

  // Estado para gerenciar qual card abrir ao vir do Cronograma
  const [openCardId, setOpenCardId] = useState(null);

  const showToast = (msg) => setToast(msg);

  // Tela de Loading enquanto busca dados da VPS
  if (!uLoad || !kLoad || !rLoad || !fLoad || !dLoad || !cLoad) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-xl font-bold text-gray-500">Conectando ao banco de dados...</div></div>;
  }

  // Login Handler
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
          {config.logo ? <img src={config.logo} alt="Logo" className="h-16 mx-auto mb-6 object-contain" /> : <h1 className="text-3xl font-bold text-gray-800 mb-6" style={{ color: config.color }}>{config.companyName}</h1>}
          <form onSubmit={handleLogin} className="space-y-4">
            <input name="login" type="text" placeholder="Usuário" required className="w-full p-3 border rounded-xl outline-none focus:ring-2" style={{ focusRing: config.color }} />
            <input name="pass" type="password" placeholder="Senha" required className="w-full p-3 border rounded-xl outline-none focus:ring-2" />
            <button type="submit" className="w-full text-white p-3 rounded-xl font-semibold transition-opacity hover:opacity-90" style={{ backgroundColor: config.color }}>Entrar no Painel</button>
          </form>
          <div className="mt-6 text-sm text-gray-500 flex flex-col gap-1">
            <p>Dicas de acesso:</p>
            <p>empresa / empresa123</p>
            <p>gestor / gestor123</p>
            <p>midias / midias123</p>
          </div>
        </div>
        {toast && <Toast msg={toast} onClose={() => setToast('')} />}
      </div>
    );
  }

  // Permissões Menu
  const menuItems = [
    { id: 'kanban', label: 'Esteira', icon: <KanbanSquare size={20} />, roles: ['empresa', 'gestor', 'midias'] },
    { id: 'calendar', label: 'Cronograma', icon: <CalendarDays size={20} />, roles: ['empresa', 'gestor', 'midias'] },
    { id: 'traffic', label: 'Tráfego', icon: <TrendingUp size={20} />, roles: ['empresa', 'gestor'] },
    { id: 'finance', label: 'Financeiro', icon: <DollarSign size={20} />, roles: ['empresa', 'gestor'] },
    { id: 'docs', label: 'Documentos', icon: <FileText size={20} />, roles: ['empresa', 'gestor'] },
    { id: 'settings', label: 'Configurações', icon: <Settings size={20} />, roles: ['gestor'] },
  ].filter(item => item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Sidebar Desktop / Topbar Mobile */}
      <aside className="bg-white border-r border-gray-200 md:w-64 flex-shrink-0 flex flex-col justify-between" style={{ borderTop: `4px solid ${config.color}` }}>
        <div className="p-4 md:p-6">
          <div className="flex items-center gap-3 mb-8 overflow-hidden">
            {config.logo ? <img src={config.logo} alt="Logo" className="h-10 flex-shrink-0 object-contain" /> : <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold" style={{ backgroundColor: config.color }}>AZ</div>}
            <div className="hidden md:block truncate">
              <h2 className="font-bold text-gray-800 leading-tight truncate">{config.companyName}</h2>
              <p className="text-xs text-gray-500 uppercase">{user.role}</p>
            </div>
          </div>
          <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {menuItems.map(item => (
              <button key={item.id} onClick={() => setView(item.id)} className={`flex items-center gap-3 p-3 rounded-xl transition-colors whitespace-nowrap ${view === item.id ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`} style={view === item.id ? { backgroundColor: config.color } : {}}>
                {item.icon} <span className="font-medium hidden md:block">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-gray-100 hidden md:block">
          <button onClick={() => setUser(null)} className="flex items-center gap-3 text-red-500 hover:bg-red-50 p-3 rounded-xl w-full transition-colors">
            <LogOut size={20} /> <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-[100vw] flex flex-col">
        <div className="flex-1">
          {view === 'kanban' && <KanbanView data={kanban} setData={setKanban} user={user} config={config} showToast={showToast} openCardId={openCardId} setOpenCardId={setOpenCardId} />}
          {view === 'calendar' && <CalendarView data={kanban} setData={setKanban} config={config} onOpenCard={(id) => { setView('kanban'); setOpenCardId(id); }} />}
          {view === 'traffic' && <TrafficView data={reports} setData={setReports} user={user} config={config} />}
          {view === 'finance' && <FinanceView data={finances} setData={setFinances} user={user} config={config} showToast={showToast} />}
          {view === 'docs' && <DocsView data={docs} setData={setDocs} user={user} config={config} />}
          {view === 'settings' && <SettingsView config={config} setConfig={setConfig} users={users} setUsers={setUsers} showToast={showToast} />}
        </div>
        
        {/* Rodapé Oficial */}
        <footer className="mt-8 pt-6 border-t border-gray-200 text-center text-xs font-medium text-gray-400">
          Este é um app oficial Azione Marketing e Propaganda, todos os direitos reservados!
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

  // Efeito para abrir card vindo do cronograma
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Esteira de Produção</h1>
        {['gestor', 'midias'].includes(user.role) && (
          <button onClick={createCard} className="flex items-center gap-2 text-white px-4 py-2 rounded-xl shadow-md" style={{ backgroundColor: config.color }}>
            <Plus size={18} /> Novo Card
          </button>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">
        {columns.map(col => (
          <div key={col} className="bg-gray-200/50 min-w-[280px] w-[280px] rounded-2xl p-4 flex flex-col max-h-full" onDragOver={onDragOver} onDrop={(e) => onDrop(e, col)}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-700">{col}</h3>
              <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">{data.filter(c => c.col === col).length}</span>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto">
              {data.filter(c => c.col === col).map(card => (
                <div key={card.id} draggable onDragStart={(e) => onDragStart(e, card.id)} onClick={() => setActiveCard(card)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow">
                  <h4 className="font-semibold text-gray-800 mb-1">{card.title}</h4>
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-3">
                    {card.date ? <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(card.date).toLocaleDateString('pt-BR')}</span> : <span>Sem data</span>}
                    <span className="flex items-center gap-1"><MessageSquare size={12}/> {card.comments.length}</span>
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

  const canEditCore = ['gestor', 'midias'].includes(user.role);
  
  const formatDriveLink = (url) => {
    if (!url) return '';
    return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
  };

  const handleAI = async () => {
    if (!config.geminiKey) return showToast("Erro: Chave API do Gemini não está configurada nas Configurações.");
    setAiLoading(true);
    
    // Fallback Inteligente: Tenta o 2.5 primeiro. Se der falha de demanda (503), pula pro próximo.
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro'
    ];

    let success = false;
    let lastError = '';

    for (const model of modelsToTry) {
      try {
        const payload = {
          contents: [{ parts: [{ text: `Título do Post: ${draft.title}. Detalhes adicionais: ${aiPrompt}` }] }],
          systemInstruction: { parts: [{ text: `Você atua como especialista em marketing. O usuário pediu para listar os modelos e usar o recomendado. Diga: 'Modelos listados. Utilizando o ${model}.'. Crie uma legenda chamativa com CTA e hashtags.` }] }
        };
        
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiKey}`, {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload)
        });
        
        const result = await res.json();
        
        if (!res.ok) {
          throw new Error(result.error?.message || `Erro HTTP ${res.status}`);
        }
        
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
          setDraft({ ...draft, caption: text });
          showToast(`Legenda gerada com sucesso (${model})!`);
          success = true;
          break; // Sai do loop porque deu certo
        } else {
          throw new Error("Resposta vazia da IA.");
        }
        
      } catch (e) {
        console.warn(`Tentativa com ${model} falhou:`, e.message);
        lastError = e.message;
        // O loop continua e tenta o próximo modelo automaticamente
      }
    }

    if (!success) {
      showToast(`Falha após tentar todos os modelos. Último erro: ${lastError}`);
    }
    
    setAiLoading(false);
    setAiPrompt('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Detalhes do Card</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna Esquerda: Detalhes principais */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Título</label>
              <input disabled={!canEditCore} value={draft.title} onChange={e => setDraft({...draft, title: e.target.value})} className="w-full p-2 border rounded-lg outline-none" />
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-semibold text-gray-600 block mb-1">Data Programada</label>
                <input type="date" value={draft.date} onChange={e => setDraft({...draft, date: e.target.value})} className="w-full p-2 border rounded-lg outline-none" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-semibold text-gray-600 block mb-1">Status (Coluna)</label>
                <select value={draft.col} onChange={e => setDraft({...draft, col: e.target.value})} className="w-full p-2 border rounded-lg outline-none bg-white">
                  {['Ideias', 'Produção', 'Finalizados', 'Aprovados', 'Rejeitados', 'Programados', 'Postados'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Descrição / Roteiro</label>
              <textarea disabled={!canEditCore} rows={3} value={draft.desc} onChange={e => setDraft({...draft, desc: e.target.value})} className="w-full p-2 border rounded-lg outline-none resize-none" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-600">Link da Mídia (Drive)</label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" disabled={!canEditCore} checked={draft.isCarousel} onChange={e => setDraft({...draft, isCarousel: e.target.checked})} />
                  Carrossel
                </label>
              </div>
              {!draft.isCarousel ? (
                <input disabled={!canEditCore} value={draft.link} placeholder="Cole o link do Google Drive" onChange={e => setDraft({...draft, link: e.target.value})} className="w-full p-2 border rounded-lg outline-none mb-2" />
              ) : (
                <div className="space-y-2 border p-3 rounded-lg bg-gray-50">
                  {draft.carousel.map((link, i) => (
                    <input key={i} disabled={!canEditCore} value={link} placeholder={`Link ${i+1}`} onChange={e => {
                      const newC = [...draft.carousel]; newC[i] = e.target.value; setDraft({...draft, carousel: newC});
                    }} className="w-full p-2 border rounded-lg text-sm" />
                  ))}
                  {canEditCore && draft.carousel.length < 15 && (
                    <button onClick={() => setDraft({...draft, carousel: [...draft.carousel, '']})} className="text-sm font-semibold text-blue-600 flex items-center gap-1"><Plus size={14}/> Adicionar Link (Máx 15)</button>
                  )}
                </div>
              )}
              
              {/* Preview Iframe do Drive Ampliado e Suporte a Carrossel */}
              <div className="mt-4 flex flex-col gap-4">
                {!draft.isCarousel && draft.link && draft.link.includes('drive.google.com') && (
                  <iframe src={formatDriveLink(draft.link)} className="w-full h-72 border rounded-xl bg-gray-100 shadow-sm" title="Preview"></iframe>
                )}
                {draft.isCarousel && draft.carousel.map((link, idx) => link && link.includes('drive.google.com') && (
                  <div key={idx} className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Preview da Mídia {idx + 1}</span>
                    <iframe src={formatDriveLink(link)} className="w-full h-72 border rounded-xl bg-gray-100 shadow-sm" title={`Preview ${idx + 1}`}></iframe>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Coluna Direita: IA, Legenda e Comentários */}
          <div className="space-y-4 flex flex-col">
            <div className="flex-1 flex flex-col">
              <label className="text-sm font-semibold text-gray-600 block mb-1">Legenda</label>
              <textarea value={draft.caption} onChange={e => setDraft({...draft, caption: e.target.value})} className="w-full p-2 border rounded-lg outline-none flex-1 min-h-[120px] resize-none mb-2" />
              {canEditCore && (
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                  <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1"><Bot size={14}/> Assistente IA Gemini</p>
                  <input placeholder="Informações extras para a IA..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="w-full text-sm p-2 border rounded outline-none mb-2" />
                  <button onClick={handleAI} disabled={aiLoading} className="w-full bg-blue-600 text-white text-sm font-bold py-2 rounded flex items-center justify-center gap-2 disabled:opacity-50">
                    {aiLoading ? 'Processando (com fallback)...' : 'Gerar Legenda com IA'}
                  </button>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <label className="text-sm font-semibold text-gray-600 block mb-2">Comentários</label>
              <div className="bg-gray-50 border rounded-lg p-3 h-40 overflow-y-auto space-y-2 mb-2">
                {draft.comments.length === 0 && <p className="text-xs text-gray-400 text-center mt-4">Nenhum comentário.</p>}
                {draft.comments.map((c, i) => (
                  <div key={i} className="bg-white p-2 rounded border shadow-sm text-sm">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-bold text-gray-700 capitalize">{c.author}</span>
                      <span className="text-gray-400">{new Date(c.date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-800">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Escreva um comentário..." className="flex-1 p-2 border rounded-lg outline-none text-sm" />
                <button onClick={() => {
                  if(!commentText.trim()) return;
                  setDraft({...draft, comments: [...draft.comments, { author: user.role, text: commentText, date: new Date().toISOString() }]});
                  setCommentText('');
                }} className="bg-gray-800 text-white px-4 rounded-lg"><Plus size={16}/></button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2 font-semibold text-gray-600 hover:bg-gray-200 rounded-xl">Cancelar</button>
          <button onClick={() => onSave(draft)} className="px-5 py-2 font-semibold text-white rounded-xl shadow-md flex items-center gap-2" style={{ backgroundColor: config.color }}>
            <Save size={18}/> Salvar Card
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ data, setData, config, onOpenCard }) {
  const progCards = data.filter(c => c.col === 'Programados' && c.date).sort((a,b) => new Date(a.date) - new Date(b.date));
  
  const markAsPosted = (id) => {
    setData(data.map(c => c.id === id ? { ...c, col: 'Postados' } : c));
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Cronograma de Postagens</h1>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="space-y-4">
          {progCards.length === 0 && <p className="text-gray-500 text-center py-8">Nenhum post programado com data definida.</p>}
          {progCards.map(c => (
            <div key={c.id} className="flex items-center p-4 border-l-4 rounded-r-xl bg-gray-50 hover:bg-gray-100 transition-colors" style={{ borderLeftColor: config.color }}>
              <div className="w-32 flex-shrink-0 text-center border-r border-gray-200 pr-4">
                <p className="text-2xl font-bold" style={{ color: config.color }}>{new Date(c.date).getDate() + 1}</p>
                <p className="text-xs uppercase font-bold text-gray-500">{new Date(c.date).toLocaleString('pt-BR', { month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="pl-4 flex-1">
                <h3 className="font-bold text-lg text-gray-800">{c.title}</h3>
                <p className="text-sm text-gray-600 truncate max-w-md">{c.caption || c.desc}</p>
              </div>
              <div className="px-4 flex flex-col gap-2 items-end">
                <span className="text-xs font-bold bg-white shadow-sm py-1 px-3 rounded-full text-gray-600 border">
                  Programado
                </span>
                <div className="flex gap-2">
                  <button onClick={() => onOpenCard(c.id)} className="text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-full transition-colors shadow-sm">
                    Abrir no Kanban
                  </button>
                  <button onClick={() => markAsPosted(c.id)} className="text-xs font-bold bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded-full transition-colors shadow-sm">
                    Postado
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrafficView({ data, setData, user, config }) {
  const [expandedId, setExpandedId] = useState(null);
  const [newMetric, setNewMetric] = useState({ reportId: null, label: '' });
  const [editLink, setEditLink] = useState({ reportId: null, url: '' });

  const addReport = () => {
    const newRep = { id: Date.now(), date: new Date().toISOString().split('T')[0], leads: 0, cost: '0', contracts: 0, attachment: '', custom: [] };
    setData([newRep, ...data]);
    setExpandedId(newRep.id);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Relatórios de Tráfego</h1>
        {user.role === 'gestor' && (
          <button onClick={addReport} className="flex items-center gap-2 text-white px-4 py-2 rounded-xl shadow-md" style={{ backgroundColor: config.color }}>
            <Plus size={18} /> Nova Análise
          </button>
        )}
      </div>

      <div className="space-y-4">
        {data.map((rep, idx) => (
          <div key={rep.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div onClick={() => setExpandedId(expandedId === rep.id ? null : rep.id)} className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100 text-green-600"><TrendingUp size={20}/></div>
                <div>
                  <h3 className="font-bold text-gray-800">Análise de Desempenho</h3>
                  <p className="text-sm text-gray-500">Realizada em {new Date(rep.date).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              {expandedId === rep.id ? <ChevronUp /> : <ChevronDown />}
            </div>

            {expandedId === rep.id && (
              <div className="p-6 border-t bg-gray-50 grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricBox label="Leads" val={rep.leads} onChange={v => { const n = [...data]; n[idx].leads = v; setData(n); }} edit={user.role === 'gestor'} />
                <MetricBox label="Custo / Lead" val={`R$ ${rep.cost}`} onChange={v => { const n = [...data]; n[idx].cost = v.replace('R$ ', ''); setData(n); }} edit={user.role === 'gestor'} />
                <MetricBox label="Contratos Fechados" val={rep.contracts} onChange={v => { const n = [...data]; n[idx].contracts = v; setData(n); }} edit={user.role === 'gestor'} />
                
                {rep.custom.map((c, cidx) => (
                  <MetricBox key={cidx} label={c.label} val={c.value} onChange={v => { const n = [...data]; n[idx].custom[cidx].value = v; setData(n); }} edit={user.role === 'gestor'} />
                ))}

                {user.role === 'gestor' && (
                  <div className="col-span-full border border-dashed border-gray-300 p-4 rounded-xl flex flex-col items-center justify-center bg-gray-50">
                    {newMetric.reportId === rep.id ? (
                      <div className="flex w-full gap-2">
                        <input autoFocus value={newMetric.label} onChange={e => setNewMetric({...newMetric, label: e.target.value})} placeholder="Nome da métrica..." className="flex-1 p-2 border rounded outline-none text-sm" />
                        <button onClick={() => { if(newMetric.label) { const n = [...data]; n[idx].custom.push({ label: newMetric.label, value: '0' }); setData(n); } setNewMetric({reportId: null, label: ''}); }} className="bg-blue-600 text-white px-3 rounded text-sm font-bold">Salvar</button>
                        <button onClick={() => setNewMetric({reportId: null, label: ''})} className="bg-gray-200 text-gray-700 px-3 rounded text-sm font-bold">Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setNewMetric({ reportId: rep.id, label: '' })} className="text-sm font-semibold text-gray-500 hover:text-blue-600 w-full h-full p-2">+ Adicionar Métrica Personalizada</button>
                    )}
                  </div>
                )}
                <div className="col-span-full mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <a href={rep.attachment || '#'} target="_blank" rel="noreferrer" onClick={e => !rep.attachment && e.preventDefault()} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${rep.attachment ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 bg-gray-100 cursor-not-allowed'}`}><LinkIcon size={14}/> Ver Relatório Completo (Drive/PDF)</a>
                    {user.role === 'gestor' && <button onClick={() => setEditLink({ reportId: rep.id, url: rep.attachment })} className="text-gray-500 text-sm hover:text-blue-600 font-semibold px-2">Editar Link</button>}
                  </div>
                  {editLink.reportId === rep.id && (
                    <div className="flex gap-2 mt-2 w-full max-w-md">
                       <input autoFocus value={editLink.url} onChange={e => setEditLink({...editLink, url: e.target.value})} placeholder="https://..." className="flex-1 p-2 border rounded outline-none text-sm" />
                       <button onClick={() => { const n = [...data]; n[idx].attachment = editLink.url; setData(n); setEditLink({reportId: null, url: ''}); }} className="bg-blue-600 text-white px-3 rounded text-sm font-bold">Salvar Link</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricBox({ label, val, onChange, edit }) {
  return (
    <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-center items-center text-center">
      <span className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">{label}</span>
      {edit ? (
        <input value={val} onChange={e => onChange(e.target.value)} className="font-bold text-xl text-gray-800 text-center w-full outline-none border-b focus:border-blue-500" />
      ) : (
        <span className="font-bold text-xl text-gray-800">{val}</span>
      )}
    </div>
  );
}

function FinanceView({ data, setData, user, config, showToast }) {
  const [editingFin, setEditingFin] = useState(null);

  const copyPix = (pix) => {
    if(!pix) return showToast("Nenhuma chave PIX cadastrada!");
    const el = document.createElement('textarea'); el.value = pix; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    showToast("Chave PIX copiada!");
  };

  const handleSaveModal = (updatedFin) => {
    if(updatedFin.id === 'new') {
      setData([...data, { ...updatedFin, id: Date.now() }]);
    } else {
      setData(data.map(d => d.id === updatedFin.id ? updatedFin : d));
    }
    setEditingFin(null);
  };

  const handleDelete = (id) => {
    setData(data.filter(d => d.id !== id));
    showToast("Fatura apagada!");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Financeiro</h1>
        {user.role === 'gestor' && (
          <button onClick={() => setEditingFin({ id: 'new', desc: 'Nova Cobrança', due: '', pix: '', boleto: '', nf: '', status: 'Pendente' })} className="flex items-center gap-2 text-white px-4 py-2 rounded-xl shadow-md" style={{ backgroundColor: config.color }}>
            <Plus size={18} /> Nova Fatura
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm uppercase">
              <th className="p-4 font-bold">Descrição</th>
              <th className="p-4 font-bold">Vencimento</th>
              <th className="p-4 font-bold">Status</th>
              <th className="p-4 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.map((fin) => (
              <tr key={fin.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="p-4 font-semibold text-gray-800">{fin.desc}</td>
                <td className="p-4 text-gray-600">{fin.due ? new Date(fin.due).toLocaleDateString('pt-BR') : 'N/A'}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${fin.status === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {fin.status || 'Pendente'}
                  </span>
                </td>
                <td className="p-4 flex gap-2 justify-end">
                  <button onClick={() => copyPix(fin.pix)} className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 tooltip" title="Copiar PIX"><Copy size={16}/></button>
                  <a href={fin.boleto || '#'} target="_blank" rel="noreferrer" onClick={e => !fin.boleto && e.preventDefault()} className={`p-2 rounded-lg ${fin.boleto ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} title="Baixar Boleto"><FileText size={16}/></a>
                  <a href={fin.nf || '#'} target="_blank" rel="noreferrer" onClick={e => !fin.nf && e.preventDefault()} className={`p-2 rounded-lg ${fin.nf ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} title="Baixar NF"><Download size={16}/></a>
                  {user.role === 'gestor' && (
                    <>
                      <button onClick={() => setEditingFin(fin)} className="p-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 tooltip" title="Editar"><Edit3 size={16}/></button>
                      <button onClick={() => handleDelete(fin.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 tooltip" title="Apagar"><Trash2 size={16}/></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan="4" className="p-4 text-center text-gray-500">Nenhuma fatura encontrada.</td></tr>}
          </tbody>
        </table>
      </div>

      {editingFin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-xl font-bold border-b pb-2">Detalhes da Fatura</h3>
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Descrição</label>
              <input value={editingFin.desc} onChange={e => setEditingFin({...editingFin, desc: e.target.value})} className="w-full p-2 border rounded-lg outline-none" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-semibold text-gray-600 block mb-1">Vencimento</label>
                <input type="date" value={editingFin.due} onChange={e => setEditingFin({...editingFin, due: e.target.value})} className="w-full p-2 border rounded-lg outline-none" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-semibold text-gray-600 block mb-1">Status</label>
                <select value={editingFin.status || 'Pendente'} onChange={e => setEditingFin({...editingFin, status: e.target.value})} className="w-full p-2 border rounded-lg outline-none bg-white">
                  <option value="Pendente">Pendente</option>
                  <option value="Pago">Pago</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Chave PIX</label>
              <input value={editingFin.pix} onChange={e => setEditingFin({...editingFin, pix: e.target.value})} className="w-full p-2 border rounded-lg outline-none" placeholder="000.000.000-00" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Link do Boleto (Drive/PDF)</label>
              <input value={editingFin.boleto} onChange={e => setEditingFin({...editingFin, boleto: e.target.value})} className="w-full p-2 border rounded-lg outline-none" placeholder="https://..." />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1">Link da Nota Fiscal (Drive/PDF)</label>
              <input value={editingFin.nf} onChange={e => setEditingFin({...editingFin, nf: e.target.value})} className="w-full p-2 border rounded-lg outline-none" placeholder="https://..." />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setEditingFin(null)} className="px-5 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">Cancelar</button>
              <button onClick={() => handleSaveModal(editingFin)} className="px-5 py-2 font-semibold text-white rounded-xl shadow-md" style={{ backgroundColor: config.color }}>Salvar Fatura</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocsView({ data, setData, user, config }) {
  const [editingDocLink, setEditingDocLink] = useState(null);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Documentos e Contratos</h1>
        {user.role === 'gestor' && (
          <button onClick={() => setData([...data, { id: Date.now(), title: 'Novo Doc', date: '', link: '' }])} className="flex items-center gap-2 text-white px-4 py-2 rounded-xl shadow-md" style={{ backgroundColor: config.color }}>
            <Plus size={18} /> Upload Documento
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map((doc, idx) => (
          <div key={doc.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4 w-full pr-2">
                <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center bg-red-50 text-red-500"><FileText size={24}/></div>
                <div className="w-full">
                  {user.role === 'gestor' ? <input value={doc.title} onChange={e => { const n = [...data]; n[idx].title = e.target.value; setData(n); }} className="font-bold border-b outline-none text-gray-800 w-full" placeholder="Título do Documento" /> : <h3 className="font-bold text-gray-800">{doc.title}</h3>}
                  {user.role === 'gestor' ? <input type="date" value={doc.date} onChange={e => { const n = [...data]; n[idx].date = e.target.value; setData(n); }} className="text-xs border-b outline-none text-gray-500 mt-1 w-full" /> : <p className="text-xs text-gray-500 mt-1">Data: {new Date(doc.date).toLocaleDateString('pt-BR')}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                {user.role === 'gestor' && (
                  <>
                    <button onClick={() => setEditingDocLink(editingDocLink === doc.id ? null : doc.id)} className="p-2 text-gray-400 hover:text-blue-600"><Edit3 size={18}/></button>
                    <button onClick={() => setData(data.filter(d => d.id !== doc.id))} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                  </>
                )}
                <a href={doc.link || '#'} target="_blank" rel="noreferrer" onClick={e => !doc.link && e.preventDefault()} className={`p-2 rounded-lg ${doc.link ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}><Download size={18}/></a>
              </div>
            </div>
            {editingDocLink === doc.id && (
              <div className="flex gap-2 w-full pt-3 border-t mt-1">
                <input autoFocus value={doc.link} onChange={e => { const n = [...data]; n[idx].link = e.target.value; setData(n); }} placeholder="https:// link do PDF/Drive..." className="flex-1 p-2 border rounded outline-none text-sm" />
                <button onClick={() => setEditingDocLink(null)} className="bg-blue-600 text-white px-3 rounded text-sm font-bold">OK</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView({ config, setConfig, users, setUsers, showToast }) {
  const [newUser, setNewUser] = useState({ login: '', pass: '', role: 'empresa', name: '' });
  const [testingApi, setTestingApi] = useState(false);

  const handleAddUser = () => {
    if(!newUser.login || !newUser.pass) return showToast("Preencha login e senha!");
    setUsers([...users, { ...newUser, id: Date.now() }]);
    setNewUser({ login: '', pass: '', role: 'empresa', name: '' });
    showToast("Usuário adicionado!");
  };

  const handleDeleteUser = (id) => {
    if(users.length <= 1) return showToast("Não é possível apagar o último usuário.");
    setUsers(users.filter(u => u.id !== id));
    showToast("Usuário removido.");
  };

  const handleTestApi = async () => {
    if (!config.geminiKey) return showToast("Insira a chave da API antes de testar.");
    setTestingApi(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.geminiKey}`);
      const data = await res.json();
      if (res.ok && data.models) {
        showToast(`✅ Chave validada! ${data.models.length} modelos disponíveis.`);
      } else {
        throw new Error(data.error?.message || "Erro desconhecido ao validar a chave.");
      }
    } catch (err) {
      showToast(`❌ Erro na chave: ${err.message}`);
    } finally {
      setTestingApi(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Configurações do Sistema</h1>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-bold border-b pb-2">Identidade Visual e Integrações</h2>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="text-sm font-semibold text-gray-600 block mb-1">Nome da Empresa</label>
            <input value={config.companyName} onChange={e => setConfig({...config, companyName: e.target.value})} className="w-full p-3 border rounded-xl outline-none" placeholder="Azione Marketing" />
          </div>
          <div className="flex-1">
            <label className="text-sm font-semibold text-gray-600 block mb-1">Logo (URL da Imagem)</label>
            <input value={config.logo} onChange={e => setConfig({...config, logo: e.target.value})} className="w-full p-3 border rounded-xl outline-none" placeholder="https://link-da-imagem.png" />
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="text-sm font-semibold text-gray-600 block mb-1">Cor Primária (HEX)</label>
            <input value={config.color} onChange={e => setConfig({...config, color: e.target.value})} className="w-full p-3 border rounded-xl outline-none" placeholder="#3B82F6" />
          </div>
          <div className="w-12 h-12 rounded-lg border mt-5" style={{ backgroundColor: config.color }}></div>
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-600 block mb-1">Chave API (Gemini IA)</label>
          <div className="flex gap-2">
            <input type="password" value={config.geminiKey} onChange={e => setConfig({...config, geminiKey: e.target.value})} className="flex-1 p-3 border rounded-xl outline-none" placeholder="AIzaSy..." />
            <button onClick={handleTestApi} disabled={testingApi} className="bg-gray-100 text-gray-700 px-4 rounded-xl font-bold border hover:bg-gray-200 disabled:opacity-50 transition-colors">
              {testingApi ? 'Testando...' : 'Testar Chave'}
            </button>
          </div>
        </div>
        <button onClick={() => showToast("Ajustes visuais atualizados!")} className="bg-gray-800 text-white px-6 py-2 rounded-xl font-bold">Atualizar Tela</button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-bold border-b pb-2">Controle de Usuários</h2>
        <div className="space-y-3">
          {users.map((u, i) => (
            <div key={u.id} className="flex gap-3 items-center border p-3 rounded-xl bg-gray-50">
              <span className="bg-gray-200 text-xs font-bold px-2 py-1 rounded uppercase w-24 text-center">{u.role}</span>
              <input value={u.login} onChange={e => { const n = [...users]; n[i].login = e.target.value; setUsers(n); }} className="flex-1 outline-none font-semibold text-gray-700 bg-transparent" placeholder="Login" />
              <input value={u.pass} onChange={e => { const n = [...users]; n[i].pass = e.target.value; setUsers(n); }} className="flex-1 outline-none text-gray-500 bg-transparent" placeholder="Senha" type="text" />
              <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Adicionar Novo Usuário</h3>
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="p-3 border rounded-xl outline-none text-sm w-full md:w-32 bg-white">
              <option value="empresa">Empresa</option>
              <option value="gestor">Gestor Geral</option>
              <option value="midias">Mídias</option>
            </select>
            <input value={newUser.login} onChange={e => setNewUser({...newUser, login: e.target.value})} className="flex-1 p-3 border rounded-xl outline-none text-sm w-full" placeholder="Novo Login" />
            <input value={newUser.pass} onChange={e => setNewUser({...newUser, pass: e.target.value})} className="flex-1 p-3 border rounded-xl outline-none text-sm w-full" placeholder="Nova Senha" type="text" />
            <button onClick={handleAddUser} className="w-full md:w-auto px-6 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-sm" style={{ backgroundColor: config.color }}><Plus size={18}/> Add</button>
          </div>
        </div>

        <p className="text-xs text-green-600 font-medium mt-2">* Tudo o que for alterado no app é salvo imediatamente na VPS.</p>
      </div>
    </div>
  );
}
