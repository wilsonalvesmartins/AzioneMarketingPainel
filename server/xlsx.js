import zlib from 'zlib';

const ZIP_LOCAL_FILE = 0x04034b50;
const ZIP_CENTRAL_FILE = 0x02014b50;
const ZIP_END = 0x06054b50;
const MAX_UNCOMPRESSED_BYTES = 60 * 1024 * 1024;

function decodeXml(value = '') {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function readZipEntries(buffer) {
  let endOffset = -1;
  const minimum = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === ZIP_END) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset === -1) throw new Error('Arquivo XLSX inválido: diretório ZIP não encontrado.');

  const totalEntries = buffer.readUInt16LE(endOffset + 10);
  let offset = buffer.readUInt32LE(endOffset + 16);
  const entries = new Map();
  let totalUncompressed = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_FILE) throw new Error('Arquivo XLSX inválido: entrada ZIP corrompida.');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8').replace(/\\/g, '/');
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) throw new Error('Arquivo XLSX excede o limite de segurança descompactado.');
    entries.set(name, { method, compressedSize, uncompressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  function read(name) {
    const entry = entries.get(name.replace(/^\//, ''));
    if (!entry) return null;
    const local = entry.localOffset;
    if (buffer.readUInt32LE(local) !== ZIP_LOCAL_FILE) throw new Error('Arquivo XLSX inválido: cabeçalho local corrompido.');
    const nameLength = buffer.readUInt16LE(local + 26);
    const extraLength = buffer.readUInt16LE(local + 28);
    const start = local + 30 + nameLength + extraLength;
    const compressed = buffer.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) return compressed;
    if (entry.method === 8) return zlib.inflateRawSync(compressed);
    throw new Error(`Compactação XLSX não suportada: ${entry.method}.`);
  }

  return { entries, read };
}

function xmlAttribute(fragment, name) {
  const match = String(fragment).match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`, 'i'));
  return match ? decodeXml(match[1]) : null;
}

function columnIndex(reference) {
  const letters = String(reference || '').match(/^[A-Z]+/i)?.[0]?.toUpperCase() || '';
  return letters.split('').reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
}

function collectText(xml = '') {
  return [...String(xml).matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/gi)].map((match) => decodeXml(match[1])).join('');
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/gi)].map((match) => collectText(match[1]));
}

function parseSheetRows(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row(?:\s([^>]*))?>([\s\S]*?)<\/row>/gi)) {
    const rowNumber = Number(xmlAttribute(rowMatch[1], 'r')) || rows.length + 1;
    const cells = new Map();
    for (const cellMatch of rowMatch[2].matchAll(/<c(?:\s([^>]*))?>([\s\S]*?)<\/c>/gi)) {
      const attributes = cellMatch[1] || '';
      const reference = xmlAttribute(attributes, 'r');
      const type = xmlAttribute(attributes, 't');
      const body = cellMatch[2] || '';
      const valueMatch = body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/i);
      let value = null;
      if (type === 'inlineStr') value = collectText(body);
      else if (valueMatch) {
        const raw = decodeXml(valueMatch[1]);
        if (type === 's') value = sharedStrings[Number(raw)] ?? '';
        else if (type === 'b') value = raw === '1';
        else if (type === 'str') value = raw;
        else value = Number.isFinite(Number(raw)) ? Number(raw) : raw;
      }
      cells.set(columnIndex(reference), value);
    }
    rows.push({ rowNumber, cells });
  }
  return rows;
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toUpperCase();
}

function asText(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function excelDate(serial) {
  if (!Number.isFinite(Number(serial))) return asText(serial, 30) || null;
  const timestamp = Date.UTC(1899, 11, 30) + Math.round(Number(serial) * 86400000);
  return new Date(timestamp).toISOString().slice(0, 10);
}

function isoDate(value) {
  if (typeof value === 'number') return excelDate(value);
  const text = asText(value, 30);
  if (!text) return null;
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function stageFor(lead) {
  const contract = normalize(lead.contractStatus);
  const proposal = normalize(lead.proposalStatus);
  const viability = normalize(lead.viability);
  if (contract.includes('CONTRATO ASSINADO')) return 'ganho';
  if (contract.includes('CLIENTE PERDIDO')) return 'perdido';
  if (contract.includes('NEGOCIANDO') || contract.includes('AGUARDANDO')) return 'negociacao';
  if (proposal.includes('PROPOSTA ENVIADA')) return 'proposta';
  if (viability === 'VIABILIDADE JURIDICA') return 'qualificado';
  if (viability.includes('TRIAGEM')) return 'triagem';
  return 'novo';
}

function findSheet(zip) {
  const workbookXml = zip.read('xl/workbook.xml')?.toString('utf8');
  const relationshipsXml = zip.read('xl/_rels/workbook.xml.rels')?.toString('utf8');
  if (!workbookXml || !relationshipsXml) throw new Error('Arquivo XLSX sem estrutura de planilha reconhecível.');

  const relationshipMap = new Map();
  for (const match of relationshipsXml.matchAll(/<Relationship\s+([^>]*?)\/?\s*>/gi)) {
    relationshipMap.set(xmlAttribute(match[1], 'Id'), xmlAttribute(match[1], 'Target'));
  }
  const sheetMatch = workbookXml.match(/<sheet\s+([^>]*?)\/?\s*>/i);
  if (!sheetMatch) throw new Error('Nenhuma aba encontrada no XLSX.');
  const sheetName = xmlAttribute(sheetMatch[1], 'name') || 'Planilha';
  const relationshipId = xmlAttribute(sheetMatch[1], 'r:id');
  const target = relationshipMap.get(relationshipId);
  if (!target) throw new Error('A aba principal do XLSX não pôde ser localizada.');
  const normalizedTarget = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  return { sheetName, path: normalizedTarget.replace(/\/\.\//g, '/') };
}

export function parseLeadWorkbook(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 100) throw new Error('Envie um arquivo XLSX válido.');
  const zip = readZipEntries(buffer);
  const sharedStrings = parseSharedStrings(zip.read('xl/sharedStrings.xml')?.toString('utf8') || '');
  const sheet = findSheet(zip);
  const sheetXml = zip.read(sheet.path)?.toString('utf8');
  if (!sheetXml) throw new Error('Não foi possível ler a primeira aba do XLSX.');
  const rows = parseSheetRows(sheetXml, sharedStrings);
  if (rows.length < 2) throw new Error('A planilha não contém leads para importar.');

  const headerRow = rows[0];
  const headers = new Map();
  for (const [column, value] of headerRow.cells) {
    if (asText(value)) headers.set(normalize(value), column);
  }
  const locate = (...aliases) => aliases.map(normalize).map((alias) => headers.get(alias)).find(Boolean);
  const columns = {
    contactDate: locate('DATA DO CONTATO', 'DATA') || 1,
    name: locate('NOME', 'CLIENTE') || 2,
    phone: locate('TELEFONE', 'CELULAR', 'WHATSAPP') || 3,
    source: locate('PLATAFORMA', 'ORIGEM', 'CANAL') || 4,
    practiceArea: locate('TESE / DEMANDA', 'TESE DEMANDA', 'DEMANDA') || 5,
    viability: locate('VIABILIDADE JURÍDICA', 'VIABILIDADE JURIDICA') || 6,
    proposalStatus: locate('STATUS DA PROPOSTA', 'PROPOSTA') || 7,
    contractStatus: locate('FECHAMENTO DE CONTRATOS', 'FECHAMENTO') || 8,
    objection: locate('OBJEÇÃO PRINCIPAL', 'OBJECAO PRINCIPAL') || 9,
    proposalValue: locate('VALOR DA PROPOSTA') || 10,
    paymentTerms: locate('CONDIÇÕES DE PAGAMENTO', 'CONDICOES DE PAGAMENTO') || 11,
    lastAction: locate('ULTIMA AÇÃO REALIZADA', 'ÚLTIMA AÇÃO REALIZADA', 'ULTIMA ACAO REALIZADA') || 12,
    nextAction: locate('PRÓXIMA AÇÃO A REALIZAR', 'PROXIMA ACAO A REALIZAR') || 13,
    notes: locate('OBSERVAÇÕES', 'OBSERVACOES') || 14
  };
  if (!columns.contactDate || !columns.name || !columns.phone) {
    throw new Error('A planilha precisa conter as colunas Data do contato, Nome e Telefone.');
  }

  const expectedYear = Number(sheet.sheetName.match(/20\d{2}/)?.[0] || 0);
  const warnings = [];
  const leads = [];
  for (const row of rows.slice(1)) {
    const get = (key) => columns[key] ? row.cells.get(columns[key]) : null;
    const name = asText(get('name'), 180);
    const phone = asText(get('phone'), 40);
    if (!name && !phone) continue;
    const contactDate = isoDate(get('contactDate'));
    if (!contactDate) {
      warnings.push(`Linha ${row.rowNumber}: data de contato inválida; registro ignorado.`);
      continue;
    }
    if (expectedYear && Number(contactDate.slice(0, 4)) !== expectedYear) {
      warnings.push(`Linha ${row.rowNumber}: data ${contactDate} está fora do ano ${expectedYear}; valor preservado para revisão.`);
    }
    const proposalValue = Number(get('proposalValue'));
    const lead = {
      contactDate,
      name: name || 'Sem nome informado',
      phone,
      source: asText(get('source'), 100),
      practiceArea: asText(get('practiceArea'), 140),
      viability: asText(get('viability'), 160),
      proposalStatus: asText(get('proposalStatus'), 160),
      contractStatus: asText(get('contractStatus'), 160),
      objection: asText(get('objection'), 1000),
      proposalValueCents: Number.isFinite(proposalValue) ? Math.round(proposalValue * 100) : null,
      paymentTerms: asText(get('paymentTerms'), 500),
      lastAction: asText(get('lastAction'), 1000),
      nextAction: asText(get('nextAction'), 1000),
      notes: asText(get('notes'), 4000),
      priority: 'normal'
    };
    lead.stage = stageFor(lead);
    leads.push(lead);
  }
  if (!leads.length) throw new Error('Nenhum lead válido foi encontrado na planilha.');
  return { sheetName: sheet.sheetName, leads, warnings };
}
