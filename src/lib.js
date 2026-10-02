export const STAGES = [
  { id: 'novo', label: 'Novo', color: '#6b7280' },
  { id: 'triagem', label: 'Triagem', color: '#2563eb' },
  { id: 'qualificado', label: 'Qualificado', color: '#7c3aed' },
  { id: 'proposta', label: 'Proposta', color: '#d97706' },
  { id: 'negociacao', label: 'Negociação', color: '#ea580c' },
  { id: 'ganho', label: 'Ganho', color: '#15803d' },
  { id: 'perdido', label: 'Perdido', color: '#b91c1c' }
];

export const PRIORITIES = [
  { id: 'baixa', label: 'Baixa' },
  { id: 'normal', label: 'Normal' },
  { id: 'alta', label: 'Alta' },
  { id: 'urgente', label: 'Urgente' }
];

export const ROLES = [
  { id: 'admin', label: 'Administrador' },
  { id: 'gestor', label: 'Gestor' },
  { id: 'atendimento', label: 'Atendimento' },
  { id: 'visualizador', label: 'Somente leitura' }
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((stage) => [stage.id, stage]));

export function canEdit(user) {
  return ['admin', 'gestor', 'atendimento'].includes(user?.role);
}

export function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', options).format(date);
}

export function formatDateTime(value) {
  return formatDate(value, { dateStyle: 'short', timeStyle: 'short' });
}

export function formatMoney(cents) {
  if (cents == null || cents === '') return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents) / 100);
}

export function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || '—';
}

export function whatsappUrl(phone, message = '') {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits && !digits.startsWith('55')) digits = `55${digits}`;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

export function localDateTimeValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function isOverdue(value) {
  return value && new Date(value).getTime() < Date.now();
}

export function todayIso() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
