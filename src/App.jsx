import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, KanbanSquare, CalendarDays, TrendingUp, 
  DollarSign, FileText, Settings, LogOut, Plus, X, 
  MessageSquare, Calendar, Link as LinkIcon, Image, 
  Bot, Save, Edit3, Trash2, ChevronDown, ChevronUp, Copy, Download,
  BarChart3, BrainCircuit, FileSearch, Eye, EyeOff,
  Send, Upload, Users, CheckCircle2, XCircle, RefreshCw, Megaphone
} from 'lucide-react';

// --- FUNÇÕES DE SEGURANÇA MÁXIMA ---
const safeArray = (arr) => Array.isArray(arr) ? arr : [];
const safeObject = (obj) => (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) ? obj : {};

const formatDriveLink = (url) => {
  if (typeof url !== 'string' || !url) return '';
  return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
};

const getDriveFileId = (url) => {
  if (typeof url !== 'string' || !url) return '';
  const value = url.trim();
  const patterns = [
    /\/file\/d\/([^/]+)/i,
    /[?&]id=([^&]+)/i,
    /\/uc\?export=[^&]+&id=([^&]+)/i
  ];
  const match = patterns.map(pattern => value.match(pattern)).find(Boolean);
  return match ? decodeURIComponent(match[1]) : '';
};

const getMediaCoverUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) return '';
  const value = url.trim();
  const driveId = getDriveFileId(value);
  if (driveId) return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`;
  if (/^data:image\//i.test(value)) return value;
  if (/\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return '';
};

const getCardCoverUrl = (card) => {
  const candidates = card?.isCarousel ? safeArray(card.carousel) : [card?.link];
  return getMediaCoverUrl(candidates.find(link => typeof link === 'string' && link.trim()) || '');
};

const updateFavicon = (logoUrl) => {
  const selector = 'link[rel="icon"][data-dynamic-favicon="true"]';
  const existing = document.querySelector(selector);
  const cleanLogoUrl = typeof logoUrl === 'string' ? logoUrl.trim() : '';

  if (!cleanLogoUrl) {
    existing?.remove();
    return;
  }

  const faviconUrl = getMediaCoverUrl(cleanLogoUrl) || cleanLogoUrl;
  const link = existing || document.createElement('link');
  link.rel = 'icon';
  link.href = faviconUrl;
  link.dataset.dynamicFavicon = 'true';
  if (!existing) document.head.appendChild(link);
};

// --- NOMENCLATURA DE CARGOS ---
const getDisplayRole = (role) => {
  if (role === 'empresa') return 'Cliente Completo';
  if (role === 'visualizador') return 'Cliente Visualizador';
  if (role === 'financeiro') return 'Financeiro';
  if (role === 'master') return 'Master';
  if (role === 'social media') return 'Social Media';
  if (role === 'gestor de tráfego') return 'Gestor de Tráfego';
  return role;
};

// --- MOTOR DA IA (COM RETRY E FALLBACK AUTOMÁTICO) ---
const fetchWithRetry = async (url, options, retries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro detalhado da API do Gemini:", errorText);
        throw new Error(`Erro na API: ${response.status} - ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

const callGeminiWithFallback = async (userPrompt, systemPrompt, userApiKey) => {
  if (!userApiKey) throw new Error("Chave da API do Google Gemini não está configurada.");
  const cleanKey = userApiKey.trim();
  
  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
  let modelName = "";

  try {
    const listData = await fetchWithRetry(listUrl, { method: 'GET' });
    const validModels = (listData.models || []).filter(m => 
      m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini')
    );

    if (validModels.length === 0) throw new Error("A chave é válida, mas sem permissão para modelos Gemini.");

    const preferredModel = 
      validModels.find(m => m.name.includes('1.5-flash')) ||
      validModels.find(m => m.name.includes('1.5-pro')) ||
      validModels.find(m => m.name.includes('2.5-flash')) ||
      validModels.find(m => m.name.includes('1.0-pro') || m.name === 'models/gemini-pro') ||
      validModels[0];

    modelName = preferredModel.name; 
  } catch (err) {
    throw new Error(`Falha ao validar a chave API no Google: ${err.message}`);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${cleanKey}`;
  let payload = {};
  
  if (modelName === 'models/gemini-pro' || modelName === 'models/gemini-1.0-pro') {
      payload = { contents: [{ parts: [{ text: `[INSTRUÇÕES DO SISTEMA]:\n${systemPrompt}\n\n[PEDIDO DO USUÁRIO]:\n${userPrompt}` }] }] };
  } else {
      payload = { contents: [{ parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] } };
  }

  const data = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro: Resposta vazia da IA.";
};

// --- DADOS PADRÃO ---
const defaultUsers = [
  { id: 1, login: 'cliente', pass: 'cliente123', role: 'empresa', name: 'Cliente Completo' },
  { id: 2, login: 'master', pass: 'master123', role: 'master', name: 'Master' },
  { id: 3, login: 'social', pass: 'social123', role: 'social media', name: 'Social Media' },
  { id: 4, login: 'trafego', pass: 'trafego123', role: 'gestor de tráfego', name: 'Gestor de Tráfego' },
  { id: 5, login: 'financeiro', pass: 'fin123', role: 'financeiro', name: 'Financeiro' },
  { id: 6, login: 'visu', pass: 'visu123', role: 'visualizador', name: 'Aprovador' }
];

const defaultKanban = [];
const defaultFinances = [];
const defaultReports = [];
const defaultDocs = [];

const defaultConfig = { 
  companyName: 'Azione Marketing', logo: '', color: '#EF4444', secondaryColor: '#991B1B', bgColor: '#F3F4F6', textColor: '#1F2937', geminiKey: '',
  lookerStudioUrl: '', showDataStudioToClient: true,
  showDisparador: true,
  splashSubtitle: 'Um painel Azione',
  footerText: 'Este é um app oficial Azione Marketing, todos os direitos reservados!'
};

const defaultDisparadorContacts = [];
const defaultDisparadorCreatives = [];
const defaultDisparadorCampaigns = [];
const defaultDisparadorConfig = {
  webhookUrl: '',
  lastWebhookResponse: ''
};

const buildDisparadorPayload = (campaign, creative, contacts) => ({
  source: 'uno-disparador',
  confirmationMode: 'manual',
  campaign: {
    id: campaign.id,
    name: campaign.name,
    startedAt: campaign.startedAt
  },
  creative,
  contacts: contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    notes: contact.notes
  }))
});

const normalizePhone = (phone) => String(phone || '').replace(/[^\d+]/g, '');

const splitCsvLine = (line) => {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if ((char === ',' || char === ';') && !quoted) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const normalizeCsvHeader = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseContactsCsv = (csv) => {
  const lines = String(csv || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('O CSV precisa ter cabecalho e pelo menos uma linha.');
  }

  const headers = splitCsvLine(lines[0]).map(normalizeCsvHeader);
  const nameIndex = headers.findIndex((header) => ['nome', 'name'].includes(header));
  const phoneIndex = headers.findIndex((header) => ['telefone', 'phone', 'whatsapp', 'celular'].includes(header));
  const notesIndex = headers.findIndex((header) => ['observacoes', 'observacao', 'obs', 'notas'].includes(header));

  if (nameIndex === -1 || phoneIndex === -1) {
    throw new Error('O CSV precisa conter as colunas nome e telefone.');
  }

  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    return {
      id: Date.now() + index,
      name: values[nameIndex]?.trim() || '',
      phone: normalizePhone(values[phoneIndex] || ''),
      notes: notesIndex >= 0 ? values[notesIndex]?.trim() || '' : '',
      createdAt: new Date().toISOString()
    };
  }).filter((contact) => contact.name && contact.phone);
};

const PERSIST_DEBOUNCE_MS = 900;

// --- HOOK DE PERSISTÊNCIA NA VPS (REESCRITO PARA GARANTIR SINCRONIA MULTI-DISPOSITIVOS) ---
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const local = localStorage.getItem(`azione_${key}`);
      return local ? JSON.parse(local) : initialValue;
    } catch(e) { return initialValue; }
  });
  
  const [isLoaded, setIsLoaded] = useState(false);
  const saveTimerRef = useRef(null);
  const saveAbortRef = useRef(null);
  const lastSavedRef = useRef('');
  const mountedRef = useRef(true);
  const apiAvailableRef = useRef(true);

  const persistValue = (value, immediate = false) => {
    let serialized = '';
    try {
      serialized = JSON.stringify(value);
      localStorage.setItem(`azione_${key}`, serialized);
    } catch (error) {
      console.error(`Erro ao preparar dados de ${key}:`, error);
      return;
    }

    if (serialized === lastSavedRef.current) return;
    if (!apiAvailableRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveAbortRef.current?.abort();
      const controller = new AbortController();
      saveAbortRef.current = controller;

      fetch(`/api/data/${key}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ data: value }),
        signal: controller.signal
      })
        .then((res) => {
          if (!res.ok) {
            if (res.status === 404) apiAvailableRef.current = false;
            throw new Error(`HTTP ${res.status}`);
          }
          lastSavedRef.current = serialized;
          if (saveAbortRef.current === controller) saveAbortRef.current = null;
        })
        .catch(e => {
          if (e.name === 'AbortError') return;
          if (!apiAvailableRef.current) return;
          console.error("Erro de rede salvando na VPS:", e);
        });
    }, immediate ? 0 : PERSIST_DEBOUNCE_MS);
  };

  useEffect(() => {
    mountedRef.current = true;
    fetch(`/api/data/${key}`)
      .then(res => {
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          if (res.status === 404 || !contentType.includes('application/json')) apiAvailableRef.current = false;
          throw new Error('API indisponivel');
        }
        return res.json();
      })
      .then(data => {
        if (!mountedRef.current) return;
        if (data && data.data !== undefined && data.data !== null) {
          setState(data.data);
          const serialized = JSON.stringify(data.data);
          lastSavedRef.current = serialized;
          localStorage.setItem(`azione_${key}`, serialized);
        } else {
          const local = localStorage.getItem(`azione_${key}`);
          const dataToPush = local ? JSON.parse(local) : initialValue;
          setState(dataToPush);
          persistValue(dataToPush, true);
        }
        setIsLoaded(true);
      })
      .catch(err => {
        if (!mountedRef.current) return;
        setIsLoaded(true);
      });

    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveAbortRef.current?.abort();
    };
  }, [key]);

  const setPersistentState = (newValue) => {
    setState((previousValue) => {
      const valueToStore = typeof newValue === 'function' ? newValue(previousValue) : newValue;
      persistValue(valueToStore);
      return valueToStore;
    });
  };

  return [state, setPersistentState, isLoaded];
}

const Toast = ({ msg, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 5000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-toast-in max-w-md border border-gray-700">
      <span className="text-sm font-medium">{msg}</span>
      <button onClick={onClose} className="hover:text-gray-300 flex-shrink-0"><X size={16} /></button>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('kanban');
  const [toast, setToast] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(false); // NOVO ESTADO: Controle da Animação

  const [users, setUsers, uLoad] = usePersistentState('users', defaultUsers);
  const [kanban, setKanban, kLoad] = usePersistentState('kanban', defaultKanban);
  const [reports, setReports, rLoad] = usePersistentState('reports', defaultReports);
  const [finances, setFinances, fLoad] = usePersistentState('finances', defaultFinances);
  const [docs, setDocs, dLoad] = usePersistentState('docs', defaultDocs);
  const [config, setConfig, cLoad] = usePersistentState('config', defaultConfig);
  const [disparadorContacts, setDisparadorContacts, dcLoad] = usePersistentState('disparadorContacts', defaultDisparadorContacts);
  const [disparadorCreatives, setDisparadorCreatives, dcrLoad] = usePersistentState('disparadorCreatives', defaultDisparadorCreatives);
  const [disparadorCampaigns, setDisparadorCampaigns, dcpLoad] = usePersistentState('disparadorCampaigns', defaultDisparadorCampaigns);
  const [disparadorConfig, setDisparadorConfig, dcfgLoad] = usePersistentState('disparadorConfig', defaultDisparadorConfig);

  const [openCardId, setOpenCardId] = useState(null);

  const showToast = (msg) => setToast(msg);

  const safeConf = { ...defaultConfig, ...config };

  useEffect(() => {
    document.title = safeConf.companyName?.trim() || 'Painel';
  }, [safeConf.companyName]);

  useEffect(() => {
    updateFavicon(safeConf.logo);
  }, [safeConf.logo]);

  useEffect(() => {
    if (view === 'disparador' && safeConf.showDisparador === false) setView('kanban');
  }, [view, safeConf.showDisparador]);

  if (!uLoad || !kLoad || !rLoad || !fLoad || !dLoad || !cLoad || !dcLoad || !dcrLoad || !dcpLoad || !dcfgLoad) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-xl font-bold text-gray-500">Conectando ao servidor...</div></div>;
  }

  const appStyles = {
    backgroundColor: safeConf.bgColor,
    color: safeConf.textColor,
    backgroundImage: `radial-gradient(circle at top left, ${safeConf.color}16, transparent 34rem), radial-gradient(circle at bottom right, ${safeConf.secondaryColor}12, transparent 30rem), linear-gradient(135deg, ${safeConf.bgColor}, #ffffff 130%)`
  };
  const brandInitials = safeConf.companyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase() || 'UN';

  const handleLogin = (e) => {
    e.preventDefault();
    const login = e.target.login.value; const pass = e.target.pass.value;
    const found = safeArray(users).find(u => u.login === login && u.pass === pass);
    if (found) { 
      setUser(found); 
      setShowSplash(true); // GATILHO DA ANIMAÇÃO APÓS LOGIN CORRETO
      if (found.role === 'gestor de tráfego') setView('traffic');
      else if (found.role === 'financeiro') setView('finance');
      else setView('kanban'); 
    } 
    else { showToast('Credenciais inválidas!'); }
  };

  // Renderiza a animação cobrindo tudo se for para mostrar
  if (showSplash) {
    return <SplashScreen config={safeConf} onComplete={() => setShowSplash(false)} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 transition-colors duration-500 relative overflow-hidden" style={{ ...appStyles, '--accent': safeConf.color }}>
        <div className="absolute inset-0 pointer-events-none opacity-70" style={{ backgroundImage: `linear-gradient(120deg, ${safeConf.color}10, transparent 42%, ${safeConf.secondaryColor}12)` }}></div>
        <div className="bg-white/95 p-8 rounded-2xl shadow-xl shadow-gray-900/10 w-full max-w-md text-center border border-white/70 animate-panel-in relative">
          {safeConf.logo ? <img src={safeConf.logo} alt="Logo" className="h-20 mx-auto mb-6 object-contain drop-shadow-sm" /> : <h1 className="text-3xl font-black mb-2" style={{ color: safeConf.color }}>{safeConf.companyName}</h1>}
          <p className="text-sm font-semibold text-gray-400 mb-6">Entre para gerenciar sua operação</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input name="login" type="text" placeholder="Usuário" required className="w-full p-4 border border-gray-200 rounded-xl outline-none bg-gray-50/80 text-gray-800 focus-accent transition-all" />
            
            <div className="relative">
              <input name="pass" type={showPassword ? "text" : "password"} placeholder="Senha" required className="w-full p-4 border border-gray-200 rounded-xl outline-none bg-gray-50/80 text-gray-800 pr-12 focus-accent transition-all" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button type="submit" className="w-full text-white p-4 rounded-xl font-bold text-lg transition-all hover:-translate-y-0.5 hover:shadow-xl shadow-lg" style={{ backgroundColor: safeConf.color }}>Acessar Painel</button>
          </form>
          <div className="mt-6 text-xs font-medium text-gray-400">
            Acesso Restrito
          </div>
        </div>
        {toast && <Toast msg={toast} onClose={() => setToast('')} />}
      </div>
    );
  }

  // --- MENU BASEADO EM FUNÇÕES ---
  const menuItems = [
    { id: 'kanban', label: 'Esteira', icon: <KanbanSquare size={20} />, roles: ['empresa', 'master', 'social media', 'gestor de tráfego', 'visualizador'] },
    { id: 'calendar', label: 'Cronograma', icon: <CalendarDays size={20} />, roles: ['empresa', 'master', 'social media', 'visualizador'] },
    { id: 'traffic', label: 'Dados de Tráfego', icon: <TrendingUp size={20} />, roles: ['empresa', 'master', 'gestor de tráfego', 'visualizador'] },
    { id: 'disparador', label: 'Disparador', icon: <Send size={20} />, roles: ['master'], enabled: safeConf.showDisparador !== false },
    { id: 'finance', label: 'Financeiro', icon: <DollarSign size={20} />, roles: ['empresa', 'master', 'financeiro'] },
    { id: 'docs', label: 'Documentos', icon: <FileText size={20} />, roles: ['empresa', 'master', 'financeiro'] },
    { id: 'settings', label: 'Configurações', icon: <Settings size={20} />, roles: ['master'] },
  ].filter(item => item.roles.includes(user.role) && item.enabled !== false);

  const viewDetails = {
    kanban: { title: 'Esteira de Conteúdo', subtitle: 'Acompanhe criação, aprovação e publicação em um só fluxo.' },
    calendar: { title: 'Cronograma', subtitle: 'Veja os próximos conteúdos e abra cada pauta rapidamente.' },
    traffic: { title: 'Dados de Tráfego', subtitle: 'Centralize relatórios e indicadores de performance.' },
    disparador: { title: 'Disparador', subtitle: 'Prepare contatos, criativos e campanhas com controle.' },
    finance: { title: 'Financeiro', subtitle: 'Organize cobranças, boletos, notas e status de pagamento.' },
    docs: { title: 'Documentos', subtitle: 'Mantenha arquivos e contratos importantes sempre à mão.' },
    settings: { title: 'Painel Master', subtitle: 'Personalize identidade, textos, integrações e acessos.' },
  };
  const activeMenuItem = menuItems.find(item => item.id === view) || menuItems[0];
  const activeView = viewDetails[view] || { title: activeMenuItem?.label || 'Painel', subtitle: 'Gerencie as informações do sistema.' };

  return (
    <div className="min-h-screen flex flex-col md:flex-row transition-colors duration-500 font-sans bg-fixed" style={appStyles}>
      <aside className="bg-white/95 border-r border-white/70 md:w-72 flex-shrink-0 flex flex-col justify-between shadow-sm z-20" style={{ borderTop: `5px solid ${safeConf.color}` }}>
        <div className="p-5 md:p-6">
          <div className="flex items-center gap-3 mb-8 overflow-hidden">
            {safeConf.logo ? <img src={safeConf.logo} alt="Logo" className="h-11 flex-shrink-0 object-contain drop-shadow-sm" /> : <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-gray-900/10" style={{ backgroundColor: safeConf.color }}>{brandInitials}</div>}
            <div className="hidden md:block truncate">
              <h2 className="font-bold text-gray-800 leading-tight truncate text-lg">{safeConf.companyName}</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{getDisplayRole(user.role)}</p>
            </div>
          </div>
          <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {menuItems.map(item => (
              <button key={item.id} onClick={() => setView(item.id)} className={`group flex items-center gap-3 p-3 rounded-xl transition-all whitespace-nowrap font-semibold ${view === item.id ? 'text-white shadow-lg shadow-gray-900/10' : 'text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm'}`} style={view === item.id ? { backgroundColor: safeConf.color } : {}}>
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

      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-[100vw] flex flex-col relative" style={{ color: safeConf.textColor }}>
        <header className="w-full max-w-7xl mx-auto mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg shadow-gray-900/10 flex-shrink-0" style={{ backgroundColor: safeConf.color }}>
              {activeMenuItem?.icon || <LayoutDashboard size={20} />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider opacity-50">Área de trabalho</p>
              <h1 className="text-2xl md:text-3xl font-black leading-tight truncate">{activeView.title}</h1>
              <p className="text-sm font-medium opacity-60 mt-1 line-clamp-2">{activeView.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-2 rounded-xl bg-white/80 border border-white/70 shadow-sm text-xs font-black uppercase tracking-wider text-gray-500">
              {user.name || getDisplayRole(user.role)}
            </span>
            <button onClick={() => setUser(null)} className="md:hidden flex items-center justify-center gap-2 text-gray-500 hover:text-red-600 bg-white/80 hover:bg-red-50 border border-white/70 p-3 rounded-xl transition-colors font-bold shadow-sm">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div key={view} className="flex-1 w-full max-w-7xl mx-auto animate-panel-in">
          {view === 'kanban' && <KanbanView data={safeArray(kanban)} setData={setKanban} user={user} config={safeConf} showToast={showToast} openCardId={openCardId} setOpenCardId={setOpenCardId} />}
          {view === 'calendar' && <CalendarView data={safeArray(kanban)} config={safeConf} onOpenCard={(id) => { setView('kanban'); setOpenCardId(id); }} />}
          {view === 'traffic' && <TrafficView data={safeArray(reports)} setData={setReports} user={user} config={safeConf} setConfig={setConfig} showToast={showToast} />}
          {view === 'disparador' && safeConf.showDisparador !== false && <DisparadorView contacts={safeArray(disparadorContacts)} setContacts={setDisparadorContacts} creatives={safeArray(disparadorCreatives)} setCreatives={setDisparadorCreatives} campaigns={safeArray(disparadorCampaigns)} setCampaigns={setDisparadorCampaigns} disparadorConfig={{ ...defaultDisparadorConfig, ...safeObject(disparadorConfig) }} setDisparadorConfig={setDisparadorConfig} config={safeConf} showToast={showToast} />}
          {view === 'finance' && <FinanceView data={safeArray(finances)} setData={setFinances} user={user} config={safeConf} showToast={showToast} />}
          {view === 'docs' && <DocsView data={safeArray(docs)} setData={setDocs} user={user} config={safeConf} />}
          {view === 'settings' && <SettingsView config={safeConf} setConfig={setConfig} users={safeArray(users)} setUsers={setUsers} showToast={showToast} />}
        </div>
        
        {safeConf.footerText && (
          <footer className="mt-12 pt-6 border-t border-gray-200/50 text-center text-xs font-semibold" style={{ color: `${safeConf.textColor}80` }}>
            {safeConf.footerText}
          </footer>
        )}
      </main>
      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  );
}

// ==========================================
// COMPONENTE: SPLASH SCREEN (ANIMAÇÃO UNO)
// ==========================================
function SplashScreen({ config, onComplete }) {
  const canvasRef = useRef(null);
  const [fade, setFade] = useState(false);
  const primaryColor = config?.color || '#f1aa20';
  const secondaryColor = config?.secondaryColor || '#340508';
  const splashSubtitle = (config?.splashSubtitle || `Um painel ${config?.companyName || 'Azione'}`).slice(0, 80);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const width = 600;
    const height = 650;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let animationFrameId;
    let startTime = null;

    const COLOR_DARK = secondaryColor;
    const COLOR_GOLD = primaryColor;
    
    const L1 = 180; 
    const R = 80; 
    const L2 = R * Math.PI; 
    const L3 = 180; 
    const TOTAL_LENGTH = L1 + L2 + L3;

    const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const draw = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      ctx.clearRect(0, 0, width, height);

      const uRawProgress = Math.min(elapsed / 1400, 1);
      const uProgress = easeInOutCubic(uRawProgress);
      const arrowProgress = Math.max(0, Math.min((elapsed - 1300) / 400, 1));
      const textProgress = Math.max(0, Math.min((elapsed - 1700) / 800, 1));
      const subtextProgress = Math.max(0, Math.min((elapsed - 2200) / 800, 1));

      const gradient = ctx.createLinearGradient(190, 0, 450, 0);
      gradient.addColorStop(0, COLOR_DARK);
      gradient.addColorStop(1, COLOR_GOLD);

      // DESENHO DO "U"
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
      ctx.lineWidth = 60;
      ctx.strokeStyle = gradient;

      ctx.beginPath();
      const startX = 220;
      const startY = 170;
      ctx.moveTo(startX, startY);

      const currentLength = uProgress * TOTAL_LENGTH;

      if (currentLength <= L1) {
        ctx.lineTo(startX, startY + currentLength);
      } else if (currentLength <= L1 + L2) {
        ctx.lineTo(startX, startY + L1);
        const arcProgress = (currentLength - L1) / L2;
        const endAngle = Math.PI - (arcProgress * Math.PI);
        ctx.arc(300, startY + L1, R, Math.PI, endAngle, true); 
      } else {
        ctx.lineTo(startX, startY + L1);
        ctx.arc(300, startY + L1, R, Math.PI, 0, true);
        const rightProgressLength = currentLength - L1 - L2;
        ctx.lineTo(380, startY + L1 - rightProgressLength);
      }
      ctx.stroke();

      // DESENHO DA FLECHA
      if (arrowProgress > 0) {
        ctx.globalAlpha = arrowProgress;
        ctx.fillStyle = gradient;
        
        ctx.beginPath();
        const baseArrowY = 171; 
        const currentLeftX = 380 - (80 * arrowProgress);
        const currentRightX = 380 + (80 * arrowProgress);
        const currentTipY = 170 - (100 * arrowProgress);

        ctx.moveTo(380, baseArrowY);
        ctx.lineTo(currentLeftX, baseArrowY);
        ctx.lineTo(380, currentTipY);
        ctx.lineTo(currentRightX, baseArrowY);
        ctx.closePath();
        ctx.fill();
        
        ctx.globalAlpha = 1.0;
      }

      // DESENHO DO TEXTO "UNO"
      if (textProgress > 0) {
        ctx.globalAlpha = textProgress;
        ctx.fillStyle = '#111111'; 
        ctx.font = 'italic 300 75px "Segoe UI", "Helvetica Neue", sans-serif';
        
        const text = "UNO";
        const letterSpacing = 20;
        
        ctx.textAlign = 'center';
        let totalTextWidth = 0;
        for (let i = 0; i < text.length; i++) {
            totalTextWidth += ctx.measureText(text[i]).width;
        }
        totalTextWidth += letterSpacing * (text.length - 1);
        
        let currentTextX = 300 - (totalTextWidth / 2);
        ctx.textAlign = 'left';
        
        const textSlideOffset = 10 * (1 - textProgress);
        const baseTextY = 550;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            ctx.fillText(char, currentTextX, baseTextY + textSlideOffset);
            currentTextX += ctx.measureText(char).width + letterSpacing;
        }

        ctx.globalAlpha = 1.0;
      }

      // DESENHO DO SUBTEXTO
      if (subtextProgress > 0) {
        ctx.globalAlpha = subtextProgress;
        ctx.fillStyle = '#555555'; 
        ctx.textAlign = 'center';

        let subtitleFontSize = 22;
        do {
          ctx.font = `400 ${subtitleFontSize}px "Segoe UI", "Helvetica Neue", sans-serif`;
          subtitleFontSize -= 1;
        } while (subtitleFontSize > 13 && ctx.measureText(splashSubtitle).width > 500);
        
        const subtextSlideOffset = 10 * (1 - subtextProgress);
        ctx.fillText(splashSubtitle, 300, 595 + subtextSlideOffset);
        
        ctx.globalAlpha = 1.0;
      }

      if (elapsed < 4000) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    animationFrameId = requestAnimationFrame(draw);

    // Fade out nos últimos 500ms
    const fadeTimer = setTimeout(() => { setFade(true); }, 3500);
    // Unmount aos 4000ms
    const endTimer = setTimeout(() => { onComplete(); }, 4000);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [onComplete, primaryColor, secondaryColor, splashSubtitle]);

  return (
    <div className={`fixed inset-0 z-[100] bg-gray-50 flex items-center justify-center p-6 transition-opacity duration-500 ${fade ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className="relative w-full max-w-lg aspect-square flex items-center justify-center overflow-hidden p-4">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full object-contain"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        />
      </div>
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

  const onDragStart = (e, id) => {
    e.dataTransfer.setData('cardId', id);
    setTimeout(() => { if(e.target) e.target.style.opacity = '0.5'; }, 0);
  };

  const onDragEnd = (e) => {
    if(e.target) e.target.style.opacity = '1';
  };

  const onDragOver = (e) => e.preventDefault();

  const onDropKanban = (e, col) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    if (!cardId) return;

    let kanbanArray = [...safeArray(data)];
    const draggedIdx = kanbanArray.findIndex(c => c.id === cardId);
    if (draggedIdx === -1) return;

    const draggedCard = { ...kanbanArray[draggedIdx], col };
    kanbanArray.splice(draggedIdx, 1);

    const targetCardEl = e.target.closest('.kanban-card');
    if (targetCardEl) {
      const targetId = targetCardEl.getAttribute('data-id');
      const targetIdx = kanbanArray.findIndex(c => c.id === targetId);
      if (targetIdx !== -1) {
        const rect = targetCardEl.getBoundingClientRect();
        const isBottom = (e.clientY - rect.top) > (rect.height / 2);
        kanbanArray.splice(isBottom ? targetIdx + 1 : targetIdx, 0, draggedCard);
      } else { kanbanArray.push(draggedCard); }
    } else { kanbanArray.push(draggedCard); }
    
    setData(kanbanArray);
  };

  const createCard = () => {
    const newCard = { id: Date.now().toString(), title: 'Nova Ideia', desc: '', link: '', col: 'Ideias', date: '', isCarousel: false, carousel: [], caption: '', comments: [] };
    setData([...data, newCard]);
    setActiveCard(newCard);
  };

  const deleteCard = (id) => {
    if (window.confirm('Tem certeza que deseja apagar este card permanentemente?')) {
      setData(prev => safeArray(prev).filter(c => c.id !== id));
      setActiveCard(null);
      showToast('Card apagado com sucesso.');
    }
  };

  const canCreate = ['master', 'social media', 'gestor de tráfego'].includes(user.role);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black">Esteira de Produção</h1>
          <p className="text-sm font-medium opacity-70 mt-1">Gerencie cards, arraste para reordenar e acompanhe o funil.</p>
        </div>
        {canCreate && (
          <button onClick={createCard} className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl shadow-lg hover:opacity-90 font-bold transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>
            <Plus size={18} /> Novo Card
          </button>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 flex-1 items-stretch snap-x custom-scrollbar">
        {columns.map(col => (
          <div key={col} 
               className="bg-white/80 border border-gray-200/70 min-w-[300px] w-[300px] rounded-2xl p-4 flex flex-col h-full snap-start shadow-sm" 
               onDragOver={onDragOver} 
               onDrop={(e) => onDropKanban(e, col)}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200/50">
              <h3 className="font-bold text-lg opacity-90">{col}</h3>
              <span className="text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm" style={{ backgroundColor: config.secondaryColor }}>{data.filter(c => c.col === col).length}</span>
            </div>
            
            <div className="flex flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar flex-1 h-full">
              {data.filter(c => c.col === col).map(card => (
                <div key={card.id} 
                     draggable 
                     onDragStart={(e) => onDragStart(e, card.id)} 
                     onDragEnd={onDragEnd}
                     onClick={() => setActiveCard(card)} 
                     className="kanban-card bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-300 transition-all group relative"
                     data-id={card.id}>
                  <KanbanCardCover card={card} />
                  <h4 className="font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">{card.title}</h4>
                  {card.isCarousel && safeArray(card.carousel).filter(Boolean).length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md">
                      <Image size={12} /> {safeArray(card.carousel).filter(Boolean).length} slides
                    </span>
                  )}
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-400 mt-3 pt-3 border-t border-gray-50">
                    {card.date ? <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(card.date).toLocaleDateString('pt-BR')}</span> : <span>Sem data</span>}
                    <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md"><MessageSquare size={12}/> {safeArray(card.comments).length}</span>
                  </div>
                </div>
              ))}
              {data.filter(c => c.col === col).length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl opacity-50 flex-1 flex items-center justify-center pointer-events-none">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Soltar Aqui</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {activeCard && (
        <CardModal 
          card={activeCard} 
          user={user} 
          config={config} 
          showToast={showToast} 
          onClose={() => setActiveCard(null)} 
          onDelete={() => deleteCard(activeCard.id)}
          onSave={(updated) => {
            setData(prev => safeArray(prev).map(c => c.id === updated.id ? updated : c));
            setActiveCard(null);
          }} 
        />
      )}
    </div>
  );
}

function KanbanCardCover({ card }) {
  const coverUrl = getCardCoverUrl(card);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [coverUrl]);

  if (!coverUrl) return null;

  if (failed) {
    return (
      <div className="-m-4 mb-3 h-28 rounded-t-xl bg-gray-100 border-b border-gray-100 flex items-center justify-center text-gray-400">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
          <Image size={16} /> Mídia anexada
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 mb-3 h-36 rounded-t-xl overflow-hidden bg-gray-100 border-b border-gray-100">
      <img
        src={coverUrl}
        alt={`Capa do card ${card.title || ''}`.trim()}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </div>
  );
}

function CardModal({ card, user, config, onClose, onSave, onDelete, showToast }) {
  const [draft, setDraft] = useState({ ...card, comments: safeArray(card.comments), carousel: safeArray(card.carousel) });
  const [commentText, setCommentText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const canEditCore = ['master', 'social media', 'gestor de tráfego'].includes(user.role);
  const canEditClient = ['empresa', 'visualizador'].includes(user.role);

  const handleAI = async () => {
    setAiLoading(true);
    try {
      const prompt = `Título do Post: ${draft.title}. Descrição: ${draft.desc}. Detalhes extras: ${aiPrompt}`;
      const systemInstruction = `Você é um copywriter sênior focado em redes sociais. REGRA 1: Escreva UMA ÚNICA legenda focada em conversão, com um bom CTA e hashtags estratégicas. REGRA 2: Você está PROIBIDO de dizer "Aqui está a legenda", "Opção 1", "Claro, vamos lá!", ou fazer perguntas no final. REGRA 3: Não use separadores (---) ou títulos. Apenas devolva O TEXTO PURO E FINAL DA LEGENDA para ser copiado.`;
      
      const textoGerado = await callGeminiWithFallback(prompt, systemInstruction, config.geminiKey);
      
      setDraft({ ...draft, caption: textoGerado });
      showToast(`Legenda gerada com sucesso pela IA!`);
    } catch (e) {
      showToast(e.message);
    } finally {
      setAiLoading(false);
      setAiPrompt('');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-950/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white text-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border border-white/20">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl flex-shrink-0">
          <h2 className="text-xl font-black">Detalhes do Card</h2>
          <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-gray-200 shadow-sm transition-colors text-gray-500"><X size={20}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white custom-scrollbar">
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
              <textarea disabled={!(canEditCore || canEditClient)} rows={3} value={draft.desc} onChange={e => setDraft({...draft, desc: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-gray-50/50 resize-none" placeholder="Detalhes do conteúdo..." />
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
                <input aria-label="Link da mídia" disabled={!canEditCore} value={draft.link} placeholder="Cole o link do Google Drive" onChange={e => setDraft({...draft, link: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white shadow-inner mb-2 text-sm" />
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

          <div className="space-y-5 flex flex-col">
            <div className="flex-1 flex flex-col">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Legenda (Copy)</label>
              <textarea disabled={!canEditCore} value={draft.caption} onChange={e => setDraft({...draft, caption: e.target.value})} className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:border-blue-500 flex-1 min-h-[150px] resize-none mb-3 bg-gray-50/50 leading-relaxed text-gray-700 custom-scrollbar" placeholder="Escreva a legenda..." />
              
              {canEditCore && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-2xl">
                  <p className="text-xs font-black text-blue-800 mb-3 flex items-center gap-1.5 uppercase tracking-wider"><Bot size={16}/> Gerador Automático de Legenda (IA)</p>
                  <input placeholder="Instruções curtas: Tom descontraído, fale sobre X..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="w-full text-sm p-3 border border-white/60 rounded-xl outline-none mb-3 bg-white/80 shadow-inner focus:border-blue-300" />
                  <button onClick={handleAI} disabled={aiLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-md">
                    {aiLoading ? <span className="animate-pulse">Gerando Legenda com IA...</span> : 'Criar Legenda Incrível'}
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Comentários e Feedbacks</label>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 h-48 overflow-y-auto space-y-3 mb-3 custom-scrollbar shadow-inner">
                {draft.comments.length === 0 && <p className="text-xs font-medium text-gray-400 text-center mt-6">Nenhuma observação ainda.</p>}
                {draft.comments.map((c, i) => (
                  <div key={i} className={`p-3 rounded-xl border text-sm ${['empresa', 'visualizador'].includes(c.author) ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="font-bold text-gray-800 uppercase tracking-wider">{getDisplayRole(c.author)}</span>
                      <span className="text-gray-400 font-medium">{new Date(c.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short'})}</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Deixe um comentário..." className="flex-1 p-3 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 focus:bg-white focus:border-blue-400 transition-colors" />
                <button onClick={() => {
                  if(!commentText.trim()) return;
                  setDraft({...draft, comments: [...draft.comments, { author: user.role, text: commentText, date: new Date().toISOString() }]});
                  setCommentText('');
                }} className="bg-gray-800 hover:bg-black text-white px-5 rounded-xl font-bold shadow-md transition-colors"><Plus size={18}/></button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-between gap-3 rounded-b-2xl flex-shrink-0">
          {canEditCore ? (
            <button onClick={onDelete} className="px-5 py-2.5 font-bold text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center gap-2 rounded-xl transition-colors"><Trash2 size={18}/> Apagar Card</button>
          ) : <div></div>}
          <div className="flex gap-3">
             <button onClick={onClose} className="px-6 py-2.5 font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-xl transition-colors">Cancelar</button>
             <button onClick={() => onSave(draft)} className="px-6 py-2.5 font-bold text-white rounded-xl shadow-lg flex items-center gap-2 transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>
               <Save size={18}/> Salvar e Fechar
             </button>
          </div>
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
      <div className="bg-white/85 p-6 rounded-3xl shadow-sm border border-gray-200/70">
        <div className="space-y-4">
          {progCards.length === 0 && (
            <div className="text-center py-12">
              <CalendarDays size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold opacity-60">Nenhum post programado com data definida.</p>
            </div>
          )}
          {progCards.map(c => {
             const safeDate = new Date(c.date.length === 10 ? `${c.date}T12:00:00` : c.date);
             return (
              <div key={c.id} className="flex flex-col md:flex-row md:items-center p-5 border-l-[6px] rounded-r-2xl bg-white shadow-sm hover:shadow-md transition-shadow group" style={{ borderLeftColor: config.color }}>
                <div className="w-full md:w-32 flex-shrink-0 text-center border-b md:border-b-0 md:border-r border-gray-100 pb-3 md:pb-0 md:pr-5 mb-3 md:mb-0">
                  <p className="text-3xl font-black" style={{ color: config.color }}>{safeDate.getDate()}</p>
                  <p className="text-xs uppercase font-black opacity-40">{safeDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="md:pl-5 flex-1 mb-4 md:mb-0">
                  <h3 className="font-black text-lg group-hover:text-blue-600 transition-colors">{c.title}</h3>
                  <p className="text-sm opacity-70 line-clamp-2 mt-1">{c.caption || c.desc}</p>
                </div>
                <div className="md:px-4 flex flex-row md:flex-col gap-2 items-start md:items-end w-full md:w-auto">
                  <span className="text-xs font-bold bg-gray-100 py-1.5 px-4 rounded-full border border-gray-200 uppercase tracking-wider opacity-80">Agendado</span>
                  <button onClick={() => onOpenCard(c.id)} className="text-xs font-bold bg-gray-800 hover:bg-black text-white py-1.5 px-4 rounded-full transition-colors shadow-sm w-full md:w-auto">Ver no Kanban</button>
                </div>
              </div>
             );
          })}
        </div>
      </div>
    </div>
  );
}

function TrafficView({ data, setData, user, config, setConfig, showToast }) {
  const isClientReadOnly = ['empresa', 'visualizador'].includes(user.role);
  const isAdmin = ['master', 'gestor de tráfego'].includes(user.role);
  const showDataStudioTab = isAdmin || config.showDataStudioToClient !== false;
  
  const [activeTab, setActiveTab] = useState(showDataStudioTab ? 'dataStudio' : 'reports'); 
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!showDataStudioTab && activeTab === 'dataStudio') setActiveTab('reports');
  }, [showDataStudioTab, activeTab]);

  const getEmbedUrl = (url) => {
    if(!url) return '';
    if(url.includes('/embed/')) return url;
    return url.replace('/u/0/reporting/', '/embed/reporting/').replace('/reporting/', '/embed/reporting/');
  };

  const addReport = () => {
    const newRep = { 
      id: Date.now(), name: 'Novo Fechamento', month: new Date().toISOString().slice(0, 7), 
      type: 'manual', date: new Date().toISOString().split('T')[0], leads: 0, cost: '0', contracts: 0, attachment: '', custom: [] 
    };
    setData([newRep, ...data]);
    setExpandedId(newRep.id);
  };

  const updateReport = (idx, changes) => {
    const n = [...data]; n[idx] = { ...n[idx], ...changes }; setData(n);
  };

  const deleteReport = (id) => {
    if(window.confirm('Atenção: Tem certeza que deseja excluir este relatório?')) {
      setData(data.filter(r => r.id !== id));
      showToast('Relatório apagado com sucesso.');
    }
  };

  return (
    <div className="w-full flex flex-col h-full max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black">Dados de Tráfego</h1>
          <p className="text-sm font-medium opacity-70 mt-1">Dashboard Data Studio e Relatórios de Performance.</p>
        </div>
        
        <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit">
          {showDataStudioTab && (
            <button onClick={() => setActiveTab('dataStudio')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'dataStudio' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}>
              <BarChart3 size={16}/> Dashboard Data Studio
            </button>
          )}
          <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:text-gray-800'}`}>
            <FileSearch size={16}/> {isClientReadOnly ? 'Relatórios Mensais' : 'Gerenciar Relatórios'}
          </button>
        </div>
      </div>

      {activeTab === 'dataStudio' && (
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-200/50 overflow-hidden flex flex-col min-h-[600px] relative">
          {isAdmin && (
            <div className="bg-gray-100 p-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">Visibilidade para o Cliente</h3>
                <p className="text-xs font-medium text-gray-500 mt-1">Defina se a aba do Data Studio aparecerá no painel do cliente.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfig({...config, showDataStudioToClient: true})} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${config.showDataStudioToClient !== false ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  👁️ Visível no Painel
                </button>
                <button onClick={() => setConfig({...config, showDataStudioToClient: false})} className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${config.showDataStudioToClient === false ? 'bg-red-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  🚫 Ocultar do Cliente
                </button>
              </div>
            </div>
          )}
          {config.lookerStudioUrl ? (
            <iframe src={getEmbedUrl(config.lookerStudioUrl)} frameBorder="0" style={{ border: 0 }} allowFullScreen className="w-full flex-1 h-full min-h-[700px]"></iframe>
          ) : (
            <div className="flex flex-col items-center justify-center h-full flex-1 p-12 text-center opacity-60">
              <BarChart3 size={64} className="mb-4" />
              <h3 className="text-xl font-bold">Dashboard não configurado</h3>
              <p className="text-sm mt-2">Insira a URL do Data Studio na aba Configurações.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="w-full max-w-4xl mx-auto space-y-4 pb-10">
          {isAdmin && (
            <div className="flex justify-between items-center bg-blue-50 border border-blue-100 p-4 rounded-2xl flex-shrink-0 mb-4">
              <p className="text-sm font-semibold text-blue-800 leading-tight">Cadastre novos fechamentos manualmente ou através de PDFs.</p>
              <button onClick={addReport} className="flex items-center gap-2 text-white px-4 py-2 rounded-xl shadow-lg font-bold transition-transform hover:scale-105 flex-shrink-0" style={{ backgroundColor: config.color }}>
                <Plus size={16} /> Novo Relatório
              </button>
            </div>
          )}
          
          {data.length === 0 && (
             <div className="text-center py-10 bg-white/50 rounded-2xl border border-gray-200 font-bold text-gray-400">Nenhum relatório cadastrado no momento.</div>
          )}

          {data.map((rep, idx) => (
            <div key={rep.id} className="bg-white rounded-3xl shadow-sm border border-gray-200/50 overflow-hidden hover:shadow-md transition-shadow flex-shrink-0">
              <div onClick={() => setExpandedId(expandedId === rep.id ? null : rep.id)} className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4 truncate">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0" style={{ backgroundColor: `${config.secondaryColor}20`, color: config.secondaryColor }}><TrendingUp size={20}/></div>
                  <div className="truncate">
                    <h3 className="font-black text-lg text-gray-800 truncate">{rep.name || 'Relatório de Performance'}</h3>
                    <p className="text-xs font-bold opacity-60 mt-0.5">Mês de Referência: {rep.month || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isAdmin && (
                     <button onClick={(e) => { e.stopPropagation(); deleteReport(rep.id); }} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Apagar"><Trash2 size={16}/></button>
                  )}
                  <div className="bg-gray-100 p-2 rounded-lg text-gray-500 shadow-sm">
                    {expandedId === rep.id ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                  </div>
                </div>
              </div>

              {expandedId === rep.id && (
                <div className="border-t border-gray-100">
                  
                  {/* Edição Admin */}
                  {isAdmin && (
                    <div className="p-5 bg-gray-50/80 border-b border-gray-200/50">
                      
                      <div className="flex gap-4 mb-6 bg-gray-200 p-1.5 rounded-xl w-fit">
                        <button onClick={() => updateReport(idx, {type: 'manual'})} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${rep.type !== 'pdf' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>Inserir Dados Manualmente</button>
                        <button onClick={() => updateReport(idx, {type: 'pdf'})} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${rep.type === 'pdf' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>Inserir PDF Personalizado</button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Nome do Relatório</label>
                          <input value={rep.name || ''} onChange={e => updateReport(idx, {name: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none font-bold text-gray-800 focus:border-blue-400 text-sm" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Mês Ref.</label>
                          <input type="month" value={rep.month || ''} onChange={e => updateReport(idx, {month: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none font-bold text-gray-800 focus:border-blue-400 text-sm" />
                        </div>
                      </div>

                      {rep.type !== 'pdf' ? (
                        <>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Métricas Base Manuais</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                            <MetricBox label="Leads" val={rep.leads} onChange={v => updateReport(idx, {leads: v})} edit={true} color={config.color} />
                            <MetricBox label="Custo / Lead" val={`R$ ${rep.cost}`} onChange={v => updateReport(idx, {cost: v.replace('R$ ', '')})} edit={true} color={config.color} />
                            <MetricBox label="Contratos" val={rep.contracts} onChange={v => updateReport(idx, {contracts: v})} edit={true} color={config.color} />
                            {safeArray(rep.custom).map((c, cidx) => (
                              <div key={cidx} className="relative group">
                                <MetricBox label={c.label} val={c.value} onChange={v => { const custom = [...rep.custom]; custom[cidx].value = v; updateReport(idx, {custom}); }} edit={true} color={config.color} />
                                <button onClick={() => { const custom = [...rep.custom]; custom.splice(cidx, 1); updateReport(idx, {custom}); }} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                              </div>
                            ))}
                            <div className="border-2 border-dashed border-gray-300 p-2 rounded-xl flex items-center justify-center bg-white hover:bg-gray-50 cursor-pointer" onClick={() => { const label = prompt("Métrica (Ex: Investimento):"); if(label) { const custom = [...safeArray(rep.custom), { label, value: '0' }]; updateReport(idx, {custom}); } }}>
                               <span className="text-xs font-bold text-gray-500">+ Métrica</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Link do PDF (Google Drive)</h4>
                          <input value={rep.attachment || ''} onChange={e => updateReport(idx, {attachment: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none text-sm bg-white shadow-sm focus:border-blue-400" placeholder="Cole o link de visualização ou edição do Google Drive..." />
                          <p className="text-[10px] font-bold text-blue-600">O sistema converterá automaticamente este link para visualizar o PDF aqui dentro.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* VISÃO FINAL DO RELATÓRIO (Todos vêem) */}
                  <div className="p-6 bg-white flex flex-col">
                    <div className="flex flex-col mb-6 gap-1 border-b border-gray-100 pb-4">
                      <h2 className="text-xl font-black leading-tight" style={{ color: config.color }}>{rep.name || 'Fechamento de Performance'}</h2>
                      <p className="text-sm font-semibold opacity-60">Referência: {rep.month || 'N/A'}</p>
                    </div>

                    {rep.type === 'pdf' ? (
                      <div className="w-full h-[600px] border border-gray-200 rounded-xl overflow-hidden bg-gray-50 shadow-sm">
                        {rep.attachment ? (
                          <iframe src={formatDriveLink(rep.attachment)} className="w-full h-full" frameBorder="0" allowFullScreen title="Relatório PDF"></iframe>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">PDF ainda não inserido pelo Gestor.</div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <MetricBox label="Leads" val={rep.leads} color={config.color} />
                        <MetricBox label="Custo / Lead" val={`R$ ${rep.cost}`} color={config.color} />
                        <MetricBox label="Contratos" val={rep.contracts} color={config.color} />
                        {safeArray(rep.custom).map((c, cidx) => (
                           <MetricBox key={cidx} label={c.label} val={c.value} color={config.color} />
                        ))}
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
    <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
      <span className="text-[9px] md:text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 line-clamp-1">{label}</span>
      {edit ? (
        <input value={val || ''} onChange={e => onChange(e.target.value)} className="font-black text-xl text-center w-full outline-none border-b focus:border-opacity-100 border-transparent transition-colors bg-transparent" style={{ color: color, borderBottomColor: color }} />
      ) : (
        <span className="font-black text-xl" style={{ color: color }}>{val}</span>
      )}
    </div>
  );
}

function DisparadorView({ contacts, setContacts, creatives, setCreatives, campaigns, setCampaigns, disparadorConfig, setDisparadorConfig, config, showToast }) {
  const [activeTab, setActiveTab] = useState('campaign');
  const [contactForm, setContactForm] = useState({ name: '', phone: '', notes: '' });
  const [creativeForm, setCreativeForm] = useState({ name: '', type: 'TEXT', content: '', mediaUrl: '' });
  const [campaignName, setCampaignName] = useState('');
  const [creativeId, setCreativeId] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [sending, setSending] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [webhookUrlDraft, setWebhookUrlDraft] = useState(disparadorConfig.webhookUrl || '');
  const [analyzingCampaignId, setAnalyzingCampaignId] = useState('');

  const sortedContacts = [...contacts].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  const selectedCampaign = campaigns.find((campaign) => String(campaign.id) === String(selectedCampaignId)) || campaigns[0];
  const selectedCreative = creatives.find((creative) => String(creative.id) === String(creativeId));

  useEffect(() => {
    if (!creativeId && creatives.length > 0) setCreativeId(String(creatives[0].id));
  }, [creativeId, creatives]);

  useEffect(() => {
    setWebhookUrlDraft(disparadorConfig.webhookUrl || '');
  }, [disparadorConfig.webhookUrl]);

  const statusText = {
    WAITING_N8N: 'Pendente',
    SENT: 'Enviado',
    FAILED: 'Falhou'
  };

  const upsertContact = (event) => {
    event.preventDefault();
    const phone = normalizePhone(contactForm.phone);
    if (!contactForm.name.trim() || phone.length < 8) return showToast('Informe nome e telefone validos.');

    const exists = contacts.find((contact) => contact.phone === phone);
    if (exists) {
      setContacts(contacts.map((contact) => contact.phone === phone ? { ...contact, name: contactForm.name.trim(), notes: contactForm.notes.trim() } : contact));
      showToast('Contato atualizado.');
    } else {
      setContacts([...contacts, { id: Date.now(), name: contactForm.name.trim(), phone, notes: contactForm.notes.trim(), createdAt: new Date().toISOString() }]);
      showToast('Contato salvo.');
    }
    setContactForm({ name: '', phone: '', notes: '' });
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setCsvLoading(true);
    try {
      const parsed = parseContactsCsv(await file.text());
      const byPhone = new Map(contacts.map((contact) => [contact.phone, contact]));
      parsed.forEach((contact) => byPhone.set(contact.phone, { ...byPhone.get(contact.phone), ...contact }));
      setContacts(Array.from(byPhone.values()).sort((a, b) => a.name.localeCompare(b.name)));
      showToast(`${parsed.length} contato(s) importado(s) ou atualizado(s).`);
    } catch (error) {
      showToast(error.message);
    } finally {
      setCsvLoading(false);
    }
  };

  const saveCreative = (event) => {
    event.preventDefault();
    if (!creativeForm.name.trim() || !creativeForm.content.trim()) return showToast('Informe nome e conteudo do criativo.');
    if (creativeForm.type !== 'TEXT' && !creativeForm.mediaUrl.trim()) return showToast('Informe a URL da midia.');

    setCreatives([
      { id: Date.now(), ...creativeForm, name: creativeForm.name.trim(), content: creativeForm.content.trim(), mediaUrl: creativeForm.mediaUrl.trim(), createdAt: new Date().toISOString() },
      ...creatives
    ]);
    setCreativeForm({ name: '', type: 'TEXT', content: '', mediaUrl: '' });
    showToast('Criativo salvo.');
  };

  const toggleContact = (contactId) => {
    setSelectedContacts((current) => {
      if (current.includes(contactId)) return current.filter((id) => id !== contactId);
      if (current.length >= 30) {
        showToast('Selecione no maximo 30 contatos por disparo.');
        return current;
      }
      return [...current, contactId];
    });
  };

  const startCampaign = async (event) => {
    event.preventDefault();
    if (!campaignName.trim()) return showToast('Informe o nome da campanha.');
    if (!selectedCreative) return showToast('Selecione um criativo.');
    if (selectedContacts.length === 0) return showToast('Selecione pelo menos um contato.');

    const selected = sortedContacts.filter((contact) => selectedContacts.includes(contact.id));
    const newCampaign = {
      id: Date.now(),
      name: campaignName.trim(),
      creative: selectedCreative,
      status: 'IN_PROGRESS',
      startedAt: new Date().toISOString(),
      dispatches: selected.map((contact) => ({
        id: `${Date.now()}-${contact.id}`,
        contact,
        status: 'WAITING_N8N',
        converted: false,
        notes: '',
        sentAt: null
      })),
      webhookResponse: ''
    };

    const payload = buildDisparadorPayload(newCampaign, selectedCreative, selected);

    setSending(true);
    try {
      const webhookUrl = webhookUrlDraft.trim();
      if (webhookUrl !== (disparadorConfig.webhookUrl || '')) {
        setDisparadorConfig({ ...disparadorConfig, webhookUrl });
      }

      let webhookResponse = 'Sem webhook configurado. Confirme os envios manualmente no historico.';
      if (webhookUrl) {
        const response = await fetch('/api/disparador/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl, payload })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(`${result.message || 'Falha ao chamar o webhook.'}${result.responseText ? ` Retorno: ${result.responseText}` : ''}`);
        }
        webhookResponse = `Webhook chamado com status ${result.status || 200}. ${result.responseText || ''}`.trim();
      }

      const campaignToSave = { ...newCampaign, webhookResponse };
      setCampaigns([campaignToSave, ...campaigns]);
      setDisparadorConfig({ ...disparadorConfig, webhookUrl, lastWebhookResponse: webhookResponse });
      setSelectedCampaignId(String(campaignToSave.id));
      setCampaignName('');
      setSelectedContacts([]);
      setActiveTab('history');
      showToast(webhookUrl ? 'Campanha criada e enviada ao webhook. Confirmacao manual no historico.' : 'Campanha criada. Confirmacao dos envios sera manual.');
    } catch (error) {
      showToast(error.message);
    } finally {
      setSending(false);
    }
  };

  const updateDispatch = (campaignId, dispatchId, patch) => {
    setCampaigns(campaigns.map((campaign) => {
      if (String(campaign.id) !== String(campaignId)) return campaign;
      const dispatches = campaign.dispatches.map((dispatch) => (
        String(dispatch.id) === String(dispatchId)
          ? { ...dispatch, ...patch, sentAt: patch.status === 'SENT' ? new Date().toISOString() : dispatch.sentAt }
          : dispatch
      ));
      const finished = dispatches.length > 0 && dispatches.every((dispatch) => dispatch.status !== 'WAITING_N8N');
      return { ...campaign, dispatches, status: finished ? 'COMPLETED' : 'IN_PROGRESS', completedAt: finished ? new Date().toISOString() : null };
    }));
  };

  const analyzeCampaign = async (campaign) => {
    if (!campaign) return;
    if (!config.geminiKey) return showToast('Configure a chave Gemini em Configuracoes do UNO.');

    setAnalyzingCampaignId(String(campaign.id));
    try {
      const converted = campaign.dispatches.filter((dispatch) => dispatch.converted).length;
      const sent = campaign.dispatches.filter((dispatch) => dispatch.status === 'SENT').length;
      const structuredData = {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          startedAt: campaign.startedAt,
          completedAt: campaign.completedAt || null
        },
        creative: campaign.creative,
        metrics: {
          totalContacts: campaign.dispatches.length,
          sent,
          converted,
          conversionRate: campaign.dispatches.length ? `${Math.round((converted / campaign.dispatches.length) * 100)}%` : '0%'
        },
        contacts: campaign.dispatches.map((dispatch) => ({
          name: dispatch.contact.name,
          phone: dispatch.contact.phone,
          status: statusText[dispatch.status] || dispatch.status,
          converted: dispatch.converted,
          initialNotes: dispatch.contact.notes || '',
          postNotes: dispatch.notes || ''
        }))
      };

      const systemPrompt = [
        'Voce e um analista senior de CRM e vendas por WhatsApp.',
        'Gere um relatorio em portugues do Brasil, objetivo e acionavel.',
        'Inclua resumo executivo, taxa de conversao, padroes nas observacoes, objecoes, proximos passos e sugestoes para o proximo criativo.',
        'Nao invente dados ausentes.'
      ].join(' ');

      const userPrompt = `Analise esta campanha de WhatsApp:\n\n${JSON.stringify(structuredData, null, 2)}`;
      const report = await callGeminiWithFallback(userPrompt, systemPrompt, config.geminiKey);

      setCampaigns(campaigns.map((item) => (
        String(item.id) === String(campaign.id)
          ? { ...item, aiReport: report, aiAnalyzedAt: new Date().toISOString() }
          : item
      )));
      showToast('Analise da campanha gerada com Gemini.');
    } catch (error) {
      showToast(`Erro na analise Gemini: ${error.message}`);
    } finally {
      setAnalyzingCampaignId('');
    }
  };

  const clearData = (target) => {
    const confirmText = window.prompt(`Digite APAGAR para limpar ${target}.`);
    if (confirmText !== 'APAGAR') return;
    if (target === 'contatos') {
      setContacts([]);
      setCampaigns([]);
    }
    if (target === 'criativos') {
      setCreatives([]);
      setCampaigns([]);
    }
    if (target === 'campanhas') setCampaigns([]);
    if (target === 'tudo') {
      setContacts([]);
      setCreatives([]);
      setCampaigns([]);
    }
    showToast('Dados do disparador limpos.');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3"><Megaphone size={30} /> Disparador WhatsApp</h1>
          <p className="text-sm font-medium opacity-70 mt-1">Contatos, criativos, campanhas e confirmacao manual dentro do UNO.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ['campaign', 'Nova campanha'],
            ['contacts', 'Contatos'],
            ['creatives', 'Criativos'],
            ['history', 'Historico'],
            ['settings', 'Ajustes']
          ].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`px-4 py-2 rounded-xl font-black text-sm transition-all ${activeTab === id ? 'text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`} style={activeTab === id ? { backgroundColor: config.color } : {}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'campaign' && (
        <form onSubmit={startCampaign} className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
          <div className="space-y-5">
            <div className="bg-white/80 p-6 rounded-3xl border border-gray-200/50 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Nome da campanha</label>
                  <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl outline-none font-bold bg-gray-50" placeholder="Ex: Oferta Maio" />
                </div>
                <div>
                  <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Criativo</label>
                  <select value={creativeId} onChange={(e) => setCreativeId(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl outline-none font-bold bg-gray-50">
                    {creatives.map((creative) => <option key={creative.id} value={creative.id}>{creative.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="bg-white/80 p-6 rounded-3xl border border-gray-200/50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black">Selecionar contatos</h2>
                <span className="text-xs font-black bg-gray-100 px-3 py-1 rounded-full">{selectedContacts.length}/30</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {sortedContacts.map((contact) => {
                  const selected = selectedContacts.includes(contact.id);
                  return (
                    <button type="button" key={contact.id} onClick={() => toggleContact(contact.id)} className={`text-left p-4 rounded-2xl border transition-all ${selected ? 'bg-green-50 border-green-300 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-start gap-3">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center border ${selected ? 'bg-green-600 border-green-600 text-white' : 'bg-gray-50 border-gray-200'}`}>{selected && <CheckCircle2 size={15} />}</span>
                        <span>
                          <strong className="block text-gray-800">{contact.name}</strong>
                          <small className="block text-gray-500 font-bold">{contact.phone}</small>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {sortedContacts.length === 0 && <div className="text-center p-10 font-bold opacity-50">Cadastre ou importe contatos para iniciar.</div>}
            </div>
          </div>
          <aside className="bg-white/80 p-6 rounded-3xl border border-gray-200/50 shadow-sm h-fit space-y-4">
            <h2 className="text-xl font-black">Resumo</h2>
            <div className="grid gap-3">
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100"><span className="text-xs font-black opacity-50 uppercase">Contatos</span><strong className="block text-2xl">{selectedContacts.length}</strong></div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100"><span className="text-xs font-black opacity-50 uppercase">Criativo</span><strong className="block">{selectedCreative?.name || 'Nenhum'}</strong></div>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
                <span className="text-xs font-black opacity-50 uppercase">Webhook n8n</span>
                <input value={webhookUrlDraft} onChange={(e) => setWebhookUrlDraft(e.target.value)} className="w-full p-2 border border-gray-200 rounded-xl bg-white text-xs font-bold" placeholder="https://seu-n8n.com/webhook/..." />
                <small className="block text-[10px] font-bold text-gray-400">Se preenchido, o webhook sera chamado ao iniciar a campanha.</small>
              </div>
            </div>
            <button disabled={sending || !selectedCreative || selectedContacts.length === 0} className="w-full text-white p-4 rounded-xl font-black shadow-lg disabled:opacity-50 flex items-center justify-center gap-2" style={{ backgroundColor: config.color }}>
              <Send size={18} /> {sending ? 'Iniciando...' : 'Iniciar disparo'}
            </button>
          </aside>
        </form>
      )}

      {activeTab === 'contacts' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
          <div className="bg-white/80 p-6 rounded-3xl border border-gray-200/50 shadow-sm overflow-x-auto">
            <h2 className="text-xl font-black mb-4">Contatos</h2>
            <table className="w-full text-left">
              <thead><tr className="text-xs uppercase opacity-50 border-b"><th className="p-3">Nome</th><th className="p-3">Telefone</th><th className="p-3">Observacoes</th><th className="p-3 text-right">Acoes</th></tr></thead>
              <tbody>
                {sortedContacts.map((contact) => (
                  <tr key={contact.id} className="border-b border-gray-100">
                    <td className="p-3 font-black">{contact.name}</td>
                    <td className="p-3 font-bold text-gray-600">{contact.phone}</td>
                    <td className="p-3 text-gray-500">{contact.notes || '-'}</td>
                    <td className="p-3 text-right"><button onClick={() => setContacts(contacts.filter((item) => item.id !== contact.id))} className="p-2 bg-red-50 text-red-600 rounded-xl"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <aside className="space-y-5">
            <form onSubmit={upsertContact} className="bg-white/80 p-6 rounded-3xl border border-gray-200/50 shadow-sm space-y-3">
              <h2 className="text-xl font-black">Novo contato</h2>
              <input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50" placeholder="Nome" />
              <input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50" placeholder="5511999999999" />
              <textarea value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50" placeholder="Observacoes" rows={3} />
              <button className="w-full text-white p-3 rounded-xl font-black" style={{ backgroundColor: config.color }}>Salvar contato</button>
            </form>
            <div className="bg-white/80 p-6 rounded-3xl border border-gray-200/50 shadow-sm space-y-3">
              <h2 className="text-xl font-black">Importar CSV</h2>
              <label className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 font-black text-gray-600 cursor-pointer">
                <Upload size={18} /> {csvLoading ? 'Importando...' : 'Selecionar CSV'}
                <input type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
              </label>
              <p className="text-xs font-bold text-gray-400">Colunas: nome, telefone, observacoes.</p>
            </div>
          </aside>
        </div>
      )}

      {activeTab === 'creatives' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {creatives.map((creative) => (
              <article key={creative.id} className="bg-white/80 p-6 rounded-3xl border border-gray-200/50 shadow-sm">
                <span className="text-xs font-black bg-blue-50 text-blue-700 px-3 py-1 rounded-full">{creative.type}</span>
                <h3 className="font-black text-xl mt-3">{creative.name}</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap mt-2">{creative.content}</p>
                {creative.mediaUrl && <a href={creative.mediaUrl} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 font-bold mt-3 break-all">{creative.mediaUrl}</a>}
                <button onClick={() => setCreatives(creatives.filter((item) => item.id !== creative.id))} className="mt-4 text-red-600 bg-red-50 p-2 rounded-xl"><Trash2 size={16} /></button>
              </article>
            ))}
          </div>
          <form onSubmit={saveCreative} className="bg-white/80 p-6 rounded-3xl border border-gray-200/50 shadow-sm h-fit space-y-3">
            <h2 className="text-xl font-black">Novo criativo</h2>
            <input value={creativeForm.name} onChange={(e) => setCreativeForm({ ...creativeForm, name: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50" placeholder="Nome do criativo" />
            <select value={creativeForm.type} onChange={(e) => setCreativeForm({ ...creativeForm, type: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-bold">
              <option value="TEXT">Texto</option>
              <option value="IMAGE">Imagem</option>
              <option value="VIDEO">Video</option>
            </select>
            {creativeForm.type !== 'TEXT' && <input value={creativeForm.mediaUrl} onChange={(e) => setCreativeForm({ ...creativeForm, mediaUrl: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50" placeholder="URL da midia" />}
            <textarea value={creativeForm.content} onChange={(e) => setCreativeForm({ ...creativeForm, content: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50" rows={6} placeholder={creativeForm.type === 'TEXT' ? 'Mensagem' : 'Legenda'} />
            <button className="w-full text-white p-3 rounded-xl font-black" style={{ backgroundColor: config.color }}>Salvar criativo</button>
          </form>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const sent = campaign.dispatches.filter((dispatch) => dispatch.status === 'SENT').length;
              return (
                <button key={campaign.id} onClick={() => setSelectedCampaignId(String(campaign.id))} className={`w-full text-left bg-white/80 p-4 rounded-2xl border shadow-sm ${String(selectedCampaign?.id) === String(campaign.id) ? 'border-gray-800' : 'border-gray-200/50'}`}>
                  <strong className="block">{campaign.name}</strong>
                  <small className="font-bold text-gray-500">{sent}/{campaign.dispatches.length} enviados</small>
                </button>
              );
            })}
            {campaigns.length === 0 && <div className="bg-white/80 p-8 rounded-3xl text-center font-bold opacity-50">Nenhuma campanha.</div>}
          </div>
          {selectedCampaign && (
            <div className="bg-white/80 p-6 rounded-3xl border border-gray-200/50 shadow-sm overflow-x-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
                <div><h2 className="text-2xl font-black">{selectedCampaign.name}</h2><p className="text-sm font-bold text-gray-500">{selectedCampaign.creative?.name}</p></div>
                <div className="flex flex-wrap gap-2 items-center">
                  <button onClick={() => analyzeCampaign(selectedCampaign)} disabled={analyzingCampaignId === String(selectedCampaign.id)} className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-xl font-black text-sm border border-purple-100 disabled:opacity-50">
                    <BrainCircuit size={18} /> {analyzingCampaignId === String(selectedCampaign.id) ? 'Analisando...' : 'Analisar com Gemini'}
                  </button>
                  <span className={`px-3 py-1 rounded-full text-xs font-black ${selectedCampaign.status === 'COMPLETED' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>{selectedCampaign.status === 'COMPLETED' ? 'Finalizada' : 'Em andamento'}</span>
                </div>
              </div>
              {selectedCampaign.webhookResponse && (
                <div className="mb-5 bg-blue-50 text-blue-800 border border-blue-100 rounded-2xl p-4 text-sm font-bold whitespace-pre-wrap">
                  Retorno do webhook: {selectedCampaign.webhookResponse}
                </div>
              )}
              <table className="w-full text-left">
                <thead><tr className="text-xs uppercase opacity-50 border-b"><th className="p-3">Contato</th><th className="p-3">Status</th><th className="p-3">Observacoes pos-disparo</th><th className="p-3">Converteu</th></tr></thead>
                <tbody>
                  {selectedCampaign.dispatches.map((dispatch) => (
                    <tr key={dispatch.id} className="border-b border-gray-100">
                      <td className="p-3"><strong className="block">{dispatch.contact.name}</strong><small className="font-bold text-gray-500">{dispatch.contact.phone}</small></td>
                      <td className="p-3">
                        <select value={dispatch.status} onChange={(e) => updateDispatch(selectedCampaign.id, dispatch.id, { status: e.target.value })} className="p-2 border border-gray-200 rounded-xl bg-gray-50 font-bold">
                          <option value="WAITING_N8N">Pendente</option>
                          <option value="SENT">Enviado</option>
                          <option value="FAILED">Falhou</option>
                        </select>
                        <span className="block text-xs font-bold mt-1 text-gray-400">{statusText[dispatch.status]}</span>
                      </td>
                      <td className="p-3"><textarea value={dispatch.notes || ''} onChange={(e) => updateDispatch(selectedCampaign.id, dispatch.id, { notes: e.target.value })} className="w-full min-w-[220px] p-2 border border-gray-200 rounded-xl bg-gray-50" rows={2} /></td>
                      <td className="p-3">
                        <button onClick={() => updateDispatch(selectedCampaign.id, dispatch.id, { converted: !dispatch.converted })} className={`p-2 rounded-xl ${dispatch.converted ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{dispatch.converted ? <CheckCircle2 size={18} /> : <XCircle size={18} />}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedCampaign.aiReport && (
                <div className="mt-6 bg-gray-900 text-white rounded-3xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <BrainCircuit size={20} />
                    <h3 className="font-black text-lg">Analise Gemini</h3>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{selectedCampaign.aiReport}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white/80 p-6 rounded-3xl border border-gray-200/50 shadow-sm space-y-4">
            <h2 className="text-xl font-black">Ajustes do disparador</h2>
            <div>
              <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Webhook opcional</label>
              <input value={disparadorConfig.webhookUrl || ''} onChange={(e) => setDisparadorConfig({ ...disparadorConfig, webhookUrl: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50" placeholder="https://seu-n8n.com/webhook/..." />
              <p className="text-xs font-bold text-gray-400 mt-2">A confirmacao de envio continua manual, mesmo quando o webhook for chamado.</p>
            </div>
          </div>
          <div className="bg-red-50 p-6 rounded-3xl border border-red-100 shadow-sm space-y-4">
            <h2 className="text-xl font-black text-red-700">Limpeza de dados</h2>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => clearData('campanhas')} className="bg-red-600 text-white p-3 rounded-xl font-black">Campanhas</button>
              <button onClick={() => clearData('contatos')} className="bg-red-600 text-white p-3 rounded-xl font-black">Contatos</button>
              <button onClick={() => clearData('criativos')} className="bg-red-600 text-white p-3 rounded-xl font-black">Criativos</button>
              <button onClick={() => clearData('tudo')} className="bg-gray-900 text-white p-3 rounded-xl font-black">Tudo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FinanceView({ data, setData, user, config, showToast }) {
  const isAdmin = user.role === 'master';
  const [editingFin, setEditingFin] = useState(null);

  const copyPix = (pix) => {
    if(!pix) return showToast("Nenhuma chave PIX!");
    const el = document.createElement('textarea'); el.value = pix; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    showToast("PIX copiado!");
  };

  const handleSaveModal = (updatedFin) => {
    if(updatedFin.id === 'new') setData([...data, { ...updatedFin, id: Date.now() }]);
    else setData(safeArray(data).map(d => d.id === updatedFin.id ? updatedFin : d));
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

    <div className="bg-white/85 rounded-3xl shadow-sm border border-gray-200/70 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-gray-100/50 text-sm uppercase tracking-wider font-bold opacity-70 border-b border-gray-200/50">
              <th className="p-5">Descrição do Serviço</th><th className="p-5">Vencimento</th><th className="p-5">Status</th><th className="p-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.map((fin) => {
              const safeDate = new Date(fin.due?.length === 10 ? `${fin.due}T12:00:00` : fin.due);
              return (
              <tr key={fin.id} className="border-b border-gray-100 hover:bg-white transition-colors">
                <td className="p-5 font-black text-gray-800 text-lg">{fin.desc}</td>
                <td className="p-5 font-semibold opacity-80">{fin.due ? safeDate.toLocaleDateString('pt-BR') : 'N/A'}</td>
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
                      <button onClick={() => {if(window.confirm('Apagar fatura no cliente?')) setData(data.filter(d => d.id !== fin.id));}} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 border border-red-100 shadow-sm" title="Apagar"><Trash2 size={18}/></button>
                    </>
                  )}
                </td>
              </tr>
            )})}
            {data.length === 0 && <tr><td colSpan="4" className="p-10 text-center font-bold opacity-50">Nenhuma fatura encontrada.</td></tr>}
          </tbody>
        </table>
      </div>

      {editingFin && (
                <div className="fixed inset-0 bg-gray-950/60 flex items-center justify-center p-4 z-50">
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
                  <option value="Pendente">Pendente</option><option value="Pago">Pago</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Chave PIX</label>
              <input value={editingFin.pix} onChange={e => setEditingFin({...editingFin, pix: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Link do Boleto</label>
              <input value={editingFin.boleto} onChange={e => setEditingFin({...editingFin, boleto: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Link da Nota Fiscal</label>
              <input value={editingFin.nf} onChange={e => setEditingFin({...editingFin, nf: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white text-sm" />
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
  const isAdmin = user.role === 'master';
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
        {data.map((doc, idx) => {
          const safeDate = new Date(doc.date?.length === 10 ? `${doc.date}T12:00:00` : doc.date);
          return (
          <div key={doc.id} className="bg-white/85 p-6 rounded-3xl shadow-sm border border-gray-200/70 flex flex-col gap-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-5 w-full pr-2">
                <div className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-inner" style={{ backgroundColor: `${config.secondaryColor}20`, color: config.secondaryColor }}><FileText size={28}/></div>
                <div className="w-full">
                  {isAdmin ? <input value={doc.title} onChange={e => { const n = [...data]; n[idx].title = e.target.value; setData(n); }} className="font-black text-lg border-b-2 border-transparent focus:border-gray-300 bg-transparent outline-none text-gray-800 w-full transition-colors" placeholder="Título Legal..." /> : <h3 className="font-black text-lg text-gray-800">{doc.title}</h3>}
                  {isAdmin ? <input type="date" value={doc.date} onChange={e => { const n = [...data]; n[idx].date = e.target.value; setData(n); }} className="text-xs font-bold opacity-60 bg-transparent outline-none mt-1 w-full" /> : <p className="text-xs font-bold opacity-60 mt-1">Data Assinatura: {doc.date ? safeDate.toLocaleDateString('pt-BR') : 'S/ Data'}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <>
                    <button onClick={() => setEditingDocLink(editingDocLink === doc.id ? null : doc.id)} className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 text-gray-600 transition-colors"><Edit3 size={18}/></button>
                    <button onClick={() => {if(window.confirm('Apagar documento?')) setData(safeArray(data).filter(d => d.id !== doc.id))}} className="p-3 bg-red-50 rounded-xl hover:bg-red-100 text-red-600 transition-colors"><Trash2 size={18}/></button>
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
        )})}
      </div>
    </div>
  );
}

function SettingsView({ config, setConfig, users, setUsers, showToast }) {
  const [newUser, setNewUser] = useState({ login: '', pass: '', role: 'empresa', name: '' });
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
        <p className="text-sm font-medium opacity-70 mt-1">Ajuste cores globais, links e gerencie os usuários do sistema.</p>
      </div>
      
      <div className="bg-white/90 p-8 rounded-3xl shadow-sm border border-gray-200/70 space-y-6">
        <h2 className="text-xl font-black border-b border-gray-100 pb-3 flex items-center gap-2">🎨 Identidade Visual (White-label)</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Nome Fantasia do Painel</label>
              <input aria-label="Nome fantasia do painel" value={config.companyName} onChange={e => setConfig({...config, companyName: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none font-bold bg-gray-50 focus:bg-white focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">URL da Logotipo</label>
              <input aria-label="URL da logotipo" value={config.logo} onChange={e => setConfig({...config, logo: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 focus:bg-white focus:border-blue-400" placeholder="Ex: https://..." />
            </div>
            <div>
              <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Texto inferior da animação</label>
              <input value={config.splashSubtitle || ''} onChange={e => setConfig({...config, splashSubtitle: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 focus:bg-white focus:border-blue-400 font-medium" placeholder="Ex: Um painel da sua marca" maxLength={80} />
              <p className="text-[10px] text-gray-500 mt-1">Aparece abaixo do logo animado ao entrar no sistema.</p>
            </div>
            <div>
              <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Texto do rodapé</label>
              <textarea value={config.footerText || ''} onChange={e => setConfig({...config, footerText: e.target.value})} className="w-full min-h-[92px] p-3 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 focus:bg-white focus:border-blue-400 font-medium resize-none" placeholder="Texto que aparece no rodapé do painel. Deixe em branco para ocultar." maxLength={180} />
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

      <div className="bg-white/90 p-8 rounded-3xl shadow-sm border border-gray-200/70 space-y-6">
        <h2 className="text-xl font-black border-b border-gray-100 pb-3 flex items-center gap-2">Módulos do Painel</h2>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 border border-gray-100 rounded-2xl p-5">
          <div>
            <h3 className="font-black text-gray-800">Disparador WhatsApp</h3>
            <p className="text-sm font-medium text-gray-500 mt-1">Controle se o módulo Disparador aparece no menu do master.</p>
          </div>
          <button
            type="button"
            onClick={() => setConfig({ ...config, showDisparador: config.showDisparador === false })}
            className={`w-full md:w-auto px-5 py-3 rounded-xl font-black text-sm border transition-colors ${config.showDisparador !== false ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
          >
            {config.showDisparador !== false ? 'Habilitado' : 'Desabilitado'}
          </button>
        </div>
      </div>

      <div className="bg-white/90 p-8 rounded-3xl shadow-sm border border-gray-200/70 space-y-6">
        <h2 className="text-xl font-black border-b border-gray-100 pb-3 flex items-center gap-2">🔗 Motores Externos (Data Studio & IA)</h2>
        <div className="space-y-5">
          <div>
            <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Dashboard Embed URL (Data Studio)</label>
            <input value={config.lookerStudioUrl || ''} onChange={e => setConfig({...config, lookerStudioUrl: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 focus:bg-white focus:border-blue-400 font-medium" placeholder="Cole o link do seu relatório Data Studio aqui..." />
            <p className="text-[10px] font-bold text-blue-600 mt-1 uppercase tracking-wide">Cole o link padrão e o sistema converterá em Embed Automaticamente.</p>
          </div>
          <div>
            <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Google AI Studio Key (Gemini API para a Esteira)</label>
            <div className="flex gap-2">
              <input type="password" value={config.geminiKey || ''} onChange={e => setConfig({...config, geminiKey: e.target.value})} className="flex-1 p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white focus:border-blue-400 font-mono" placeholder="AIzaSy..." />
              <button onClick={handleTestApi} disabled={testingApi} className="bg-gray-800 text-white px-5 rounded-xl font-bold shadow-md hover:bg-black transition-colors disabled:opacity-50">
                {testingApi ? 'Testando...' : 'Verificar API'}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-2">Usado para gerar as legendas e copy dos posts na Esteira.</p>
          </div>
        </div>
      </div>

      <div className="bg-white/90 p-8 rounded-3xl shadow-sm border border-gray-200/70 space-y-6">
        <h2 className="text-xl font-black border-b border-gray-100 pb-3">👥 Gerenciamento de Acessos</h2>
        <div className="space-y-3">
          {safeArray(users).map((u, i) => (
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
            <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="p-3.5 border border-gray-200 rounded-xl outline-none font-bold text-sm w-full md:w-48 bg-white shadow-sm focus:border-blue-400">
              <option value="empresa">Cliente Completo</option>
              <option value="visualizador">Cliente Visualizador</option>
              <option value="financeiro">Financeiro do Cliente</option>
              <option value="master">Master</option>
              <option value="gestor de tráfego">Gestor de Tráfego</option>
              <option value="social media">Social Media</option>
            </select>
            <input value={newUser.login} onChange={e => setNewUser({...newUser, login: e.target.value})} className="flex-1 p-3.5 border border-gray-200 rounded-xl outline-none font-bold text-sm w-full bg-white shadow-sm focus:border-blue-400" placeholder="Nome de Usuário" />
            <input value={newUser.pass} onChange={e => setNewUser({...newUser, pass: e.target.value})} className="flex-1 p-3.5 border border-gray-200 rounded-xl outline-none font-medium text-sm w-full bg-white shadow-sm focus:border-blue-400" placeholder="Senha Forte" type="text" />
            <button onClick={() => { if(newUser.login) { setUsers([...users, {...newUser, id:Date.now()}]); setNewUser({login:'', pass:'', role:'empresa', name:''}); showToast("Usuário adicionado!"); }}} className="w-full md:w-auto px-8 py-3.5 rounded-xl font-black text-white shadow-lg transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>Adicionar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
