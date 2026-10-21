import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { once } from 'node:events';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lps-tests-'));
const password = crypto.randomBytes(20).toString('hex');
let server, base, cookie, id;
async function start(settings = {}) {
  if (process.env.IN_PROCESS_TESTS === '1') {
    const environment = { PORT: '0', HOST: '127.0.0.1', DATA_DIR: directory, ADMIN_PASSWORD: password, NODE_ENV: 'test', PUBLIC_ORIGIN: '', ...settings };
    const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
    try {
      Object.assign(process.env, environment);
      ({ server } = await import(`../server.mjs?test=${crypto.randomUUID()}`));
      if (!server.listening) await once(server, 'listening');
      base = `http://127.0.0.1:${server.address().port}`;
    } finally {
      for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
    return;
  }
  server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '0', HOST: '127.0.0.1', DATA_DIR: directory, ADMIN_PASSWORD: password, NODE_ENV: 'test', PUBLIC_ORIGIN: '', ...settings }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Server timeout')), 10000); server.stdout.on('data', chunk => { const match = chunk.toString().match(/http:\/\/127.0.0.1:\d+/); if (match) { base = match[0]; clearTimeout(timeout); resolve(); } }); server.once('error', reject); server.stderr.on('data', chunk => process.stderr.write(chunk)); });
}
const stop = () => new Promise(resolve => { if (process.env.IN_PROCESS_TESTS === '1') server.close(resolve); else { server.once('exit', resolve); server.kill(); } });
const api = (route, method = 'GET', data, auth = false, headers = {}) => fetch(base + route, { method, headers: { ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Cookie: cookie } : {}), ...headers }, body: data !== undefined ? JSON.stringify(data) : undefined });
const valid = () => ({ name: 'Cliente de teste <script>', phone: '(13) 99999-9999', email: 'teste@example.com', date: '2027-12-20', people: 3, profile: 'Família', interests: ['verde', 'centro'], notes: '=HYPERLINK("example.com")', consent: true, requestKey: crypto.randomUUID(), website: '' });
before(() => start());
after(async () => { await stop(); fs.rmSync(directory, { recursive: true, force: true }); });
test('Site serves local assets and does not expose private files', async () => {
  assert.equal((await api('/')).status, 200);
  for (const url of ['/styles.css', '/app.js', '/assets/dm-serif.ttf', '/assets/sao-paulo.jpg', '/favicon.svg']) assert.equal((await api(url)).status, 200, url);
  for (const url of ['/server.mjs', '/data/admin-key.txt', '/.env', '/..%5cserver.mjs']) assert.ok([403, 404].includes((await api(url)).status), url);
});

test('Root home serves prefixed public resources without exposing the project directory', async () => {
  const html = await (await api('/index.html')).text();
  assert.equal(html, await (await api('/')).text());
  for (const [, reference] of html.matchAll(/(?:href|src)="(Portal%20LPS%20-%20GT\/public\/[^"?#]+)[^"]*"/g)) {
    assert.equal((await api('/' + reference)).status, 200, reference);
  }
  for (const route of ['/Portal%20LPS%20-%20GT/server.mjs', '/Portal%20LPS%20-%20GT/data/admin-key.txt', '/Portal%20LPS%20-%20GT/cities-sp.json', '/Portal%20LPS%20-%20GT/public/..%5cserver.mjs']) assert.ok([403, 404].includes((await api(route)).status));
  const old = await fetch(base + '/Portal%20LPS%20-%20GT/public/index.html?tour=centro', { redirect: 'manual' });
  assert.equal(old.status, 308); assert.equal(old.headers.get('location'), '/index.html?tour=centro');
});

test('The form includes every municipality in the local IBGE list', async () => {
  const cities = JSON.parse(fs.readFileSync('cities-sp.json', 'utf8'));
  assert.equal(cities.length, 645); assert.equal(new Set(cities).size, 645);
  for (const name of ['São Paulo', 'Santos', 'Águas de Lindóia', 'Embu das Artes', 'Ilhabela']) assert.ok(cities.includes(name));
  const html = await (await api('/')).text();
  const options = html.match(/<select name="city"[^>]*>([\s\S]*?)<\/select>/)[1];
  const names = [...options.matchAll(/<option>(.*?)<\/option>/g)].map(match => match[1].replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replaceAll('&amp;', '&').replaceAll('&quot;', '"'));
  assert.deepEqual(names, cities);
});
test('Unauthenticated requests cannot read or change client information', async () => {
  assert.equal((await api('/api/requests')).status, 401);
  assert.equal((await api('/api/export')).status, 401);
  assert.equal((await api('/api/requests/00000000-0000-0000-0000-000000000000', 'DELETE', {})).status, 401);
});
test('Server validates consent, dates, contact, interests, group and honeypot', async () => {
  for (const change of [{ consent: false }, { phone: '123' }, { date: '2020-01-01' }, { date: '2027-02-30' }, { people: 0 }, { interests: ['invalid'] }, { email: 'invalid' }, { website: 'spam' }, { duration: 'Uma semana' }, { transport: true }]) assert.equal((await api('/api/requests', 'POST', { ...valid(), ...change })).status, 400);
  for (const change of [{ city: 'Rio de Janeiro' }, { city: ['São Paulo'] }, { duration: '2+ dias', endDate: '2027-12-20' }, { duration: '2+ dias', endDate: '2027-12-19' }, { duration: '2+ dias', date: '', endDate: '2027-12-22' }, { duration: '2+ dias', date: '2027-01-01', endDate: '2027-02-30' }, { duration: 'Dia completo', endDate: '2027-12-22' }]) assert.equal((await api('/api/requests', 'POST', { ...valid(), ...change })).status, 400);
  await stop(); await start();
});
let reference;
test('Valid request persists, returns a reference and retries are idempotent', async () => {
  const payload = { ...valid(), duration: '2+ dias', transport: 'Não', city: 'São Paulo', endDate: '2027-12-22', sourcePage: '/roteiros/paulista.html', utmSource: 'google', utmCampaign: 'perfil_empresa' };
  const response = await api('/api/requests', 'POST', payload); assert.equal(response.status, 201);
  reference = (await response.json()).reference; assert.match(reference, /^LPS-/);
  const retry = await api('/api/requests', 'POST', payload); assert.equal(retry.status, 200); assert.equal((await retry.json()).reference, reference);
  const changed = await api('/api/requests', 'POST', { ...payload, name: 'Outro nome' }); assert.equal(changed.status, 409);
  for (const change of [{ duration: 'Meio dia', endDate: '' }, { transport: 'Sim' }, { city: 'Santos' }, { endDate: '2027-12-23' }]) assert.equal((await api('/api/requests', 'POST', { ...payload, ...change })).status, 409);
  const persisted = JSON.parse(fs.readFileSync(path.join(directory, 'requests.json'), 'utf8')); assert.equal(persisted.length, 1); assert.equal(persisted[0].status, 'Novo'); id = persisted[0].id;
  assert.equal(persisted[0].duration, '2+ dias'); assert.equal(persisted[0].transport, 'Não'); assert.deepEqual(persisted[0].interests, ['verde', 'centro']);
  assert.equal(persisted[0].city, 'São Paulo'); assert.equal(persisted[0].endDate, '2027-12-22');
  assert.equal(persisted[0].sourcePage, '/roteiros/paulista.html'); assert.equal(persisted[0].utmSource, 'google'); assert.equal(persisted[0].funnel.proposalAt, null);
});
test('Authentication creates an HttpOnly, SameSite session', async () => {
  assert.equal((await api('/api/login', 'POST', { password: 'wrong' })).status, 401);
  const response = await api('/api/login', 'POST', { password }); assert.equal(response.status, 200);
  const header = response.headers.get('set-cookie'); assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Strict/); cookie = header.split(';')[0];
  const result = await (await api('/api/requests', 'GET', undefined, true)).json(); assert.equal(result.requests.length, 1);
});
test('Cross-origin changes are blocked and invalid status is rejected', async () => {
  assert.equal((await api(`/api/requests/${id}`, 'PATCH', { status: 'Confirmado' }, true, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await api(`/api/requests/${id}`, 'PATCH', { status: 'Invalid' }, true)).status, 400);
});
test('Status and notes are saved and CSV escapes formula injection', async () => {
  const response = await api(`/api/requests/${id}`, 'PATCH', { status: 'Proposta enviada', internalNotes: 'Proposta de roteiro enviada.' }, true); assert.equal(response.status, 200);
  const item = (await response.json()).request; assert.equal(item.status, 'Proposta enviada');
  const csv = await (await api('/api/export', 'GET', undefined, true)).text(); assert.ok(csv.includes(reference)); assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes('Proposta de roteiro enviada.'));
  assert.ok(csv.includes('"Duração";"Precisa de transporte"')); assert.ok(csv.includes('"2+ dias";"Não"'));
  assert.ok(csv.includes('"Cidade do passeio";"Data inicial";"Data final"')); assert.ok(csv.includes('"São Paulo";"2027-12-20";"2027-12-22"'));
});

test('Operations persist money and reminders, reject conflicts, and retain funnel history', async () => {
  let response = await api(`/api/requests/${id}`, 'PATCH', { proposalCents: 120000, estimatedCostCents: 45000, nextContactAt: '2027-12-01T10:30', status: 'Confirmado', bookingStart: '2027-12-20T09:00', bookingEnd: '2027-12-22T18:00' }, true);
  assert.equal(response.status, 200);
  let item = (await response.json()).request;
  assert.equal(item.proposalCents, 120000); assert.ok(item.funnel.proposalAt); assert.ok(item.funnel.bookingAt);
  assert.equal((await api(`/api/requests/${id}`, 'PATCH', { estimatedCostCents: -1 }, true)).status, 400);
  await api('/api/requests', 'POST', valid());
  const stored = (await (await api('/api/requests', 'GET', undefined, true)).json()).requests;
  const other = stored.find(entry => entry.id !== id);
  response = await api(`/api/requests/${other.id}`, 'PATCH', { status: 'Confirmado', bookingStart: '2027-12-21T09:00', bookingEnd: '2027-12-21T18:00' }, true);
  assert.equal(response.status, 409);
  await api(`/api/requests/${other.id}`, 'DELETE', {}, true);
  response = await api(`/api/requests/${id}`, 'PATCH', { status: 'Proposta enviada' }, true);
  item = (await response.json()).request;
  assert.ok(item.funnel.bookingAt); assert.equal(item.nextContactAt, '2027-12-01T10:30');
  const csv = await (await api('/api/export', 'GET', undefined, true)).text();
  assert.ok(csv.includes('"1200.00";"450.00";"750.00";"62.50"'));
  assert.ok(csv.includes('"/roteiros/paulista.html";"google";"perfil_empresa"'));
});
test('Requests survive a server restart; sessions require a new login', async () => {
  await stop(); await start();
  assert.equal((await api('/api/requests', 'GET', undefined, true)).status, 401);
  const response = await api('/api/login', 'POST', { password }); cookie = response.headers.get('set-cookie').split(';')[0];
  const result = await (await api('/api/requests', 'GET', undefined, true)).json(); assert.equal(result.requests[0].status, 'Proposta enviada');
  assert.equal(result.requests[0].duration, '2+ dias'); assert.equal(result.requests[0].transport, 'Não');
  assert.equal(result.requests[0].city, 'São Paulo'); assert.equal(result.requests[0].endDate, '2027-12-22');
  assert.equal(result.requests[0].proposalCents, 120000); assert.ok(result.requests[0].funnel.bookingAt);
});

test('Trip preferences remain optional, including retries of older requests', async () => {
  const payload = valid();
  assert.equal((await api('/api/requests', 'POST', payload)).status, 201);
  const store = path.join(directory, 'requests.json');
  const persisted = JSON.parse(fs.readFileSync(store, 'utf8'));
  const item = persisted.find(entry => entry.requestKey === payload.requestKey);
  assert.equal(item.duration, ''); assert.equal(item.transport, '');
  assert.equal(item.city, ''); assert.equal(item.endDate, '');
  await stop();
  delete item.duration; delete item.transport;
  delete item.city; delete item.endDate;
  fs.writeFileSync(store, JSON.stringify(persisted));
  await start();
  assert.equal((await api('/api/requests', 'POST', payload)).status, 200);
  const login = await api('/api/login', 'POST', { password }); cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await api(`/api/requests/${item.id}`, 'DELETE', {}, true)).status, 200);
});
test('Deletion removes the request and logout revokes access', async () => {
  assert.equal((await api(`/api/requests/${id}`, 'DELETE', {}, true)).status, 200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'requests.json'), 'utf8')).length, 0);
  assert.equal((await api('/api/logout', 'POST', {}, true)).status, 200);
  assert.equal((await api('/api/requests', 'GET', undefined, true)).status, 401);
});

test('Public pages, canonical URLs and sitemap use the configured domain', async () => {
  await stop(); await start({ PUBLIC_ORIGIN: 'https://example.com' });
  for (const route of ['/', '/destinos/sao-paulo.html', '/destinos/santos.html', '/roteiros/paulista.html', '/roteiros/centro.html', '/roteiros/sabores.html', '/roteiros/verde.html', '/roteiros/litoral.html', '/roteiros/personalizado.html']) {
    const response = await api(route); assert.equal(response.status, 200);
    assert.ok((await response.text()).includes(`rel="canonical" href="https://example.com${route}"`));
  }
  const sitemap = await (await api('/sitemap.xml')).text(); assert.equal((sitemap.match(/<loc>/g) || []).length, 9);
  assert.ok(!sitemap.includes('admin.html'));
  assert.ok((await (await api('/robots.txt')).text()).includes('Sitemap: https://example.com/sitemap.xml'));
  const aliased = await (await api('/Portal%20LPS%20-%20GT/public/destinos/santos.html')).text();
  assert.ok(aliased.includes('rel="canonical" href="https://example.com/destinos/santos.html"'));
});
