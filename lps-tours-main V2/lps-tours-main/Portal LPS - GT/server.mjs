import http from 'node:http';
import { updateOperation, financials } from './public/operations.js';
import { publicPages, tours } from './content/experiences.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const indexPath = path.join(path.dirname(root), 'index.html');
const publicPrefix = `/${path.basename(root)}/public`;
const cities = new Set(JSON.parse(fs.readFileSync(path.join(root, 'cities-sp.json'), 'utf8')));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
fs.mkdirSync(dataDir, { recursive: true });
const storePath = path.join(dataDir, 'requests.json');
const keyPath = path.join(dataDir, 'admin-key.txt');
if (!process.env.ADMIN_PASSWORD && !fs.existsSync(keyPath)) fs.writeFileSync(keyPath, crypto.randomBytes(24).toString('base64url'), { mode: 0o600 });
const password = process.env.ADMIN_PASSWORD || fs.readFileSync(keyPath, 'utf8').trim();
if (password.length < 12) throw new Error('ADMIN_PASSWORD deve ter ao menos 12 caracteres.');
const passwordHash = crypto.createHash('sha256').update(password).digest();
let requests = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, 'utf8')) : [];
if (!Array.isArray(requests)) throw new Error('Arquivo de solicitações inválido. Restaure um backup.');
const sessions = new Map();
const limits = new Map();
const interestIds = tours.map(tour => tour.id);
const profiles = ['Casal', 'Individual', 'Família', 'Amigos', 'Grupo / excursão', 'Corporativo'];
const sourcePages = new Set(['', '/', ...publicPages.map(page => page.path)]);
const origin = process.env.PUBLIC_ORIGIN?.replace(/\/$/, '');
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && (!origin || !origin.startsWith('https://'))) throw new Error('Em produção, configure PUBLIC_ORIGIN com a URL HTTPS do site.');
function persist(next) { const tmp = `${storePath}.tmp`; fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 }); fs.renameSync(tmp, storePath); requests = next; }
function json(res, status, data, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(data)); }
function bad(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function text(value, max = 100) { if (typeof value !== 'string' || value.length > max) bad('Revise os campos da solicitação.'); return value.trim(); }
async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 16000) bad('Solicitação muito grande.', 413); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString()); if (!value || Array.isArray(value) || typeof value !== 'object') bad('Dados inválidos.'); return value; } catch { bad('Dados JSON inválidos.'); }
}
function session(req) { const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('lps_session=')); const token = cookie?.slice(12); const current = sessions.get(token); if (!current || current < Date.now()) { if (token) sessions.delete(token); return null; } return token; }
function limited(req, bucket, max, duration) {
  const key = `${bucket}:${req.socket.remoteAddress}`;
  const now = Date.now(); let record = limits.get(key);
  if (!record || now > record.until) { record = { count: 0, until: now + duration }; limits.set(key, record); }
  record.count++; return record.count > max;
}
const cleanupTimer = setInterval(() => { const now = Date.now(); for (const [key, value] of sessions) if (value < now) sessions.delete(key); for (const [key, value] of limits) if (value.until < now) limits.delete(key); }, 60000);
cleanupTimer.unref();
const localDay = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
function validateRequest(data) {
  const name = text(data.name, 100); if (name.length < 2) bad('Informe seu nome.');
  const phone = text(data.phone, 25); if (!/^[+\d\s().-]+$/.test(phone) || !/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) bad('Informe um telefone válido com DDD.');
  const email = text(data.email || '', 180); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad('Informe um e-mail válido.');
  const date = text(data.date || '', 10); if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < localDay())) bad('Escolha uma data válida, a partir de hoje.');
  if (!Number.isInteger(data.people) || data.people < 1 || data.people > 200) bad('Informe de 1 a 200 pessoas.');
  if (!profiles.includes(data.profile)) bad('Selecione um perfil válido.');
  const duration = text(data.duration ?? '', 20);
  if (!['', 'Meio dia', 'Dia completo', '2+ dias'].includes(duration)) bad('Selecione uma duração válida.');
  const city = text(data.city ?? '', 100);
  if (city && !cities.has(city)) bad('Selecione uma cidade do estado de São Paulo.');
  const endDate = text(data.endDate ?? '', 10);
  if (endDate && (duration !== '2+ dias' || !date || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || !Number.isFinite(Date.parse(endDate)) || new Date(endDate).toISOString().slice(0, 10) !== endDate || endDate <= date)) bad('Para passeios de 2+ dias, escolha uma data final válida posterior à data inicial.');
  const transport = text(data.transport ?? '', 10);
  if (!['', 'Sim', 'Não'].includes(transport)) bad('Selecione uma opção de transporte válida.');
  if (!Array.isArray(data.interests) || data.interests.length > 6 || data.interests.some(id => !interestIds.includes(id))) bad('Selecione interesses válidos.');
  if (data.consent !== true) bad('É necessário concordar com o uso dos dados para o atendimento.');
  const notes = text(data.notes || '', 2000);
  const sourcePage = text(data.sourcePage ?? '', 100);
  if (!sourcePages.has(sourcePage)) bad('Página de origem inválida.');
  const utmSource = text(data.utmSource ?? '', 100);
  const utmCampaign = text(data.utmCampaign ?? '', 120);
  const requestKey = text(data.requestKey || '', 36); if (!/^[a-f0-9-]{36}$/i.test(requestKey)) bad('Identificador da solicitação inválido.');
  return { name, phone, email, date, endDate, city, people: data.people, profile: data.profile, duration, transport, interests: [...new Set(data.interests)], sourcePage, utmSource, utmCampaign, notes, requestKey, consentAt: new Date().toISOString(), privacyVersion: '2026-10-20' };
}
function csvCell(value) { const safe = String(value ?? '').replace(/^[\s]*[=+@-]/, match => `'${match}`); return `"${safe.replaceAll('"', '""')}"`; }
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
export const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  try {
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname;
    if (route.startsWith('/api/')) {
      if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) bad('Método não permitido.', 405);
      if (req.method !== 'GET') {
        const expected = origin || `http://${req.headers.host}`;
        if (req.headers.origin && req.headers.origin !== expected) bad('Origem não permitida.', 403);
        if (req.headers['sec-fetch-site'] === 'cross-site') bad('Origem não permitida.', 403);
        if (!req.headers['content-type']?.startsWith('application/json')) bad('Envie dados em JSON.', 415);
      }
      if (route === '/api/requests' && req.method === 'POST') {
        if (limited(req, 'request', 20, 3600000)) bad('Muitas solicitações. Tente mais tarde ou entre em contato pelo WhatsApp.', 429);
        const data = await body(req);
        if (data.website) bad('Solicitação inválida.');
        const valid = validateRequest(data);
        const existing = requests.find(item => item.requestKey === valid.requestKey);
        if (existing) { const comparable = ['name', 'phone', 'email', 'date', 'endDate', 'city', 'people', 'profile', 'duration', 'transport', 'interests', 'sourcePage', 'utmSource', 'utmCampaign', 'notes']; if (comparable.some(key => JSON.stringify(existing[key] ?? '') !== JSON.stringify(valid[key] ?? ''))) bad('Identificador já utilizado. Atualize a página.', 409); return json(res, 200, { reference: existing.reference }); }
        const item = { ...valid, id: crypto.randomUUID(), reference: `LPS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'Novo', internalNotes: '', proposalCents: null, estimatedCostCents: null, nextContactAt: '', bookingStart: '', bookingEnd: '', funnel: { proposalAt: null, bookingAt: null, legacyInferred: false }, statusHistory: [{ status: 'Novo', at: new Date().toISOString() }] };
        persist([item, ...requests]); return json(res, 201, { reference: item.reference });
      }
      if (route === '/api/login' && req.method === 'POST') {
        if (limited(req, 'login', 10, 900000)) bad('Muitas tentativas. Aguarde 15 minutos.', 429);
        const data = await body(req);
        const candidate = crypto.createHash('sha256').update(typeof data.password === 'string' ? data.password : '').digest();
        if (!crypto.timingSafeEqual(candidate, passwordHash)) bad('Senha incorreta.', 401);
        const token = crypto.randomBytes(32).toString('base64url'); sessions.set(token, Date.now() + 8 * 3600000);
        return json(res, 200, { ok: true }, { 'Set-Cookie': `lps_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${isProduction ? '; Secure' : ''}` });
      }
      const token = session(req); if (!token) bad('Entre na área do guia para continuar.', 401);
      if (route === '/api/logout' && req.method === 'POST') { sessions.delete(token); return json(res, 200, { ok: true }, { 'Set-Cookie': 'lps_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); }
      if (route === '/api/requests' && req.method === 'GET') return json(res, 200, { requests });
      if (route === '/api/export' && req.method === 'GET') {
        const columns = ['reference', 'createdAt', 'name', 'phone', 'email', 'city', 'date', 'endDate', 'people', 'profile', 'duration', 'transport', 'interests', 'status', 'nextContactAt', 'bookingStart', 'bookingEnd', 'proposalValue', 'estimatedCost', 'estimatedMargin', 'marginPercent', 'sourcePage', 'utmSource', 'utmCampaign', 'notes', 'internalNotes'];
        const labels = ['Referência', 'Recebido em', 'Nome', 'WhatsApp', 'E-mail', 'Cidade do passeio', 'Data inicial', 'Data final', 'Pessoas', 'Perfil', 'Duração', 'Precisa de transporte', 'Interesses', 'Status', 'Próximo contato (São Paulo)', 'Início da reserva (São Paulo)', 'Fim da reserva (São Paulo)', 'Proposta (BRL)', 'Custos previstos (BRL)', 'Margem prevista (BRL)', 'Margem (%)', 'Página de origem', 'Origem da campanha', 'Campanha', 'Observações do cliente', 'Anotações internas'];
        const csv = '\uFEFF' + [labels, ...requests.map(item => { const values = financials(item); const row = { ...item, proposalValue: values.value === null ? '' : (values.value / 100).toFixed(2), estimatedCost: values.cost === null ? '' : (values.cost / 100).toFixed(2), estimatedMargin: values.margin === null ? '' : (values.margin / 100).toFixed(2), marginPercent: values.percent === null ? '' : values.percent.toFixed(2) }; return columns.map(key => Array.isArray(row[key]) ? row[key].join(', ') : row[key]); })].map(row => row.map(csvCell).join(';')).join('\r\n');
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="lps-solicitacoes-${localDay()}.csv"`, 'Cache-Control': 'no-store' }); return res.end(csv);
      }
      const match = route.match(/^\/api\/requests\/([a-f0-9-]{36})$/);
      if (match) {
        const index = requests.findIndex(item => item.id === match[1]); if (index < 0) bad('Solicitação não encontrada.', 404);
        if (req.method === 'PATCH') { const data = await body(req); const next = requests.slice(); next[index] = updateOperation(next[index], data, requests); persist(next); return json(res, 200, { request: next[index] }); }
        if (req.method === 'DELETE') { persist(requests.filter(item => item.id !== match[1])); return json(res, 200, { ok: true }); }
      }
      return json(res, 404, { error: 'Rota não encontrada.' });
    }
    if (!['GET', 'HEAD'].includes(req.method)) bad('Método não permitido.', 405);
    const xmlEscape = value => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
    if (route === '/robots.txt' || route === '/sitemap.xml') {
      if (route === '/sitemap.xml' && !origin) bad('Configure PUBLIC_ORIGIN para gerar o sitemap do domínio público.', 503);
      const content = route === '/robots.txt' ? `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api/\n${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ''}` : `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', ...publicPages.map(page => page.path)].map(page => `<url><loc>${xmlEscape(origin + page)}</loc></url>`).join('')}</urlset>`;
      res.writeHead(200, { 'Content-Type': route === '/robots.txt' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(content) });
      return res.end(req.method === 'HEAD' ? undefined : content);
    }
    let pathname; try { pathname = decodeURIComponent(route); } catch { bad('Endereço inválido.'); }
    if (pathname.includes('\\') || pathname.includes('\0')) bad('Acesso negado.', 403);
    if (pathname === `${publicPrefix}/index.html` || pathname === '/public/index.html') {
      res.writeHead(308, { Location: `/index.html${url.search}` }); return res.end();
    }
    const assetPath = pathname.startsWith(publicPrefix + '/') ? pathname.slice(publicPrefix.length) : pathname;
    const isHome = pathname === '/' || pathname === '/index.html';
    const filename = isHome ? indexPath : path.resolve(publicDir, `.${assetPath}`);
    if (!isHome && !filename.startsWith(publicDir + path.sep)) bad('Acesso negado.', 403);
    let stat; try { stat = fs.statSync(filename); } catch { bad('Página não encontrada.', 404); }
    if (!stat.isFile() || !mime[path.extname(filename)]) bad('Página não encontrada.', 404);
    const canonicalPath = isHome ? '/' : assetPath;
    if (origin && sourcePages.has(canonicalPath)) {
      const content = fs.readFileSync(filename, 'utf8').replace('</head>', `<link rel="canonical" href="${xmlEscape(origin + canonicalPath)}"><meta property="og:url" content="${xmlEscape(origin + canonicalPath)}"></head>`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': Buffer.byteLength(content), 'Cache-Control': 'no-cache' });
      return res.end(req.method === 'HEAD' ? undefined : content);
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(filename)], 'Content-Length': stat.size, 'Cache-Control': /\.(jpg|woff2)$/.test(filename) ? 'public, max-age=86400' : 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    const stream = fs.createReadStream(filename); stream.on('error', () => res.destroy()); stream.pipe(res);
  } catch (error) { if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Não foi possível concluir a operação. Tente novamente.' }); else res.end(); if (!error.status) console.error('Erro interno:', error.message); }
});
server.requestTimeout = 20000;
server.headersTimeout = 15000;
server.once('close', () => { clearInterval(cleanupTimer); sessions.clear(); limits.clear(); });
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => {
  console.log(`LUPES TOUR disponível em http://${process.env.HOST || '127.0.0.1'}:${server.address().port}`);
  console.log('Painel do guia: /admin.html');
  if (!process.env.ADMIN_PASSWORD) console.log(`A senha do painel está no arquivo local: ${keyPath}`);
});
