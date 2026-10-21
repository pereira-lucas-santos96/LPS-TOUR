import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const base = process.env.BROWSER_BASE || 'http://127.0.0.1:3001';
fs.mkdirSync('artifacts', { recursive: true });
const targets = await (await fetch(`${process.env.BROWSER_CDP || 'http://127.0.0.1:9222'}/json`, { signal: AbortSignal.timeout(5000) })).json();
const target = targets.find(item => item.type === 'page');
if (!target) throw new Error('Abra uma página no navegador de teste com depuração remota habilitada.');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map(); const errors = []; const loadedDocuments = new Set();
socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) { const entry = pending.get(data.id); pending.delete(data.id); data.error ? entry.reject(data.error) : entry.resolve(data.result); }
  if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text + ' ' + JSON.stringify(data.params.exceptionDetails.exception?.description));
  if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry.text);
  if (data.method === 'Page.lifecycleEvent' && data.params.name === 'load') loadedDocuments.add(data.params.loaderId);
});
function cdp(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(expression) { for (let i = 0; i < 70; i++) { if (await evaluate(expression)) return; await delay(100); } throw new Error(`Timed out: ${expression}`); }
async function navigate(url) {
  const result = await cdp('Page.navigate', { url });
  if (result.errorText) throw new Error(result.errorText);
  for (let attempt = 0; result.loaderId && !loadedDocuments.has(result.loaderId); attempt++) {
    if (attempt === 100) throw new Error(`A página não terminou de carregar: ${url}`);
    await delay(100);
  }
  await until('document.readyState === "complete"'); await evaluate('document.fonts.ready.then(() => true)');
}
async function screenshot(name, full = false) {
  if (full) { await evaluate('Promise.all([...document.images].map(img => { img.loading = "eager"; return img.decode().catch(() => {}); }))'); }
  const metrics = await cdp('Page.getLayoutMetrics');
  const options = full ? { clip: { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 } } : {};
  const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...options }); fs.writeFileSync(`artifacts/${name}.png`, Buffer.from(shot.data, 'base64'));
}
try {
  await cdp('Runtime.enable'); await cdp('Log.enable'); await cdp('Page.enable');
  await cdp('Page.setLifecycleEventsEnabled', { enabled: true });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate(base);
  await until('document.querySelectorAll(".tour-card").length === 6');
  // Intercepta a abertura: os testes nunca enviam dados para o WhatsApp.
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: 'window.whatsappCalls = []; window.open = (...args) => { window.whatsappCalls.push(args); return null; };' });
  await evaluate('window.whatsappCalls = []; window.open = (...args) => { window.whatsappCalls.push(args); return null; };');
  assert.equal(await evaluate('document.querySelector("select[name=city]").options.length'), 646);
  assert.equal(await evaluate('document.querySelector("select[name=city]").size <= 1 && !document.querySelector("select[name=city]").multiple'), true);
  assert.equal(await evaluate('document.querySelector("#end-date-field").hidden'), true);
  await evaluate(`(() => { const form = document.querySelector('#request-form'); form.elements.duration.value = '2+ dias'; form.elements.duration.dispatchEvent(new Event('change')); form.elements.date.value = '2027-12-20'; form.elements.date.dispatchEvent(new Event('input', { bubbles: true })); form.elements.endDate.value = '2027-12-19'; })()`);
  assert.equal(await evaluate('document.querySelector("#end-date-field").hidden'), false);
  assert.equal(await evaluate('document.querySelector("input[name=endDate]").checkValidity()'), false);
  await evaluate(`(() => { const form = document.querySelector('#request-form'); form.elements.duration.value = 'Dia completo'; form.elements.duration.dispatchEvent(new Event('change')); })()`);
  assert.equal(await evaluate('document.querySelector("input[name=endDate]").value'), '');
  assert.equal(await evaluate('document.querySelector("input[name=endDate]").disabled'), true);
  await screenshot('desktop'); await screenshot('desktop-full', true);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'Desktop overflow');
  assert.equal(await evaluate('[...document.querySelectorAll("img[src]")].every(img => img.complete && img.naturalWidth > 0)'), true, 'Images loaded');
  await evaluate('document.querySelector("[data-filter=sabores]").click()');
  assert.equal(await evaluate('[...document.querySelectorAll(".tour-card")].filter(card => !card.hidden).length'), 1);
  await evaluate('document.querySelector("[data-tour=sabores]").click()');
  assert.equal(await evaluate('document.querySelector("#tour-dialog").open'), true);
  await evaluate('document.querySelector("#choose-tour").click()');
  assert.equal(await evaluate('document.querySelector("input[value=sabores]").checked'), true);
  await evaluate('document.querySelector("[data-photo]").click()');
  assert.equal(await evaluate('document.querySelector("#photo-dialog").open'), true);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal(await evaluate('document.querySelector("#photo-dialog").open'), false);
  await evaluate(`(() => { const form = document.querySelector('#request-form'); form.elements.name.value = 'Cliente <teste> & família'; form.elements.phone.value = '(13) 99999-9999'; form.elements.email.value = 'teste@example.com'; form.elements.notes.value = 'Passeio em família, com pausa para café.'; form.elements.city.value = 'São Paulo'; form.elements.duration.value = '2+ dias'; form.elements.duration.dispatchEvent(new Event('change')); form.elements.endDate.value = '2027-12-22'; form.elements.consent.checked = true; form.requestSubmit(); })()`);
  await until('!document.querySelector("#form-feedback").hidden');
  assert.match(await evaluate('document.querySelector("#form-feedback").textContent'), /recebida/);
  const href = await evaluate('document.querySelector("#form-feedback a").href');
  assert.match(href, /wa.me\/5513981435302/); assert.ok(decodeURIComponent(href).includes('Cliente <teste> & família'));
  const opened = await evaluate('window.whatsappCalls');
  assert.equal(opened.length, 1); assert.equal(opened[0][0], href);
  assert.ok(decodeURIComponent(href).includes('Cidade do passeio: São Paulo')); assert.ok(decodeURIComponent(href).includes('Data final: 22/12/2027'));
  assert.equal(await evaluate('document.querySelector("#end-date-field").hidden'), true, 'Reset hides the end date');
  await screenshot('request-success');
  await navigate(base + '/admin.html');
  const key = fs.readFileSync(path.join(process.env.BROWSER_DATA_DIR || 'artifacts/browser-data', 'admin-key.txt'), 'utf8').trim();
  await evaluate(`document.querySelector('#password').value = ${JSON.stringify(key)}; document.querySelector('#login-form').requestSubmit()`);
  await until('!document.querySelector("#dashboard").hidden');
  assert.equal(await evaluate('document.querySelectorAll(".request-row").length'), 1);
  await evaluate('document.querySelector("[data-open]").click()');
  assert.equal(await evaluate('document.querySelector("#request-detail h2").textContent'), 'Cliente <teste> & família');
  assert.match(await evaluate('document.querySelector("#request-detail").textContent'), /São Paulo/);
  assert.match(await evaluate('document.querySelector("#request-detail").textContent'), /22\/12\/2027/);
  assert.match(await evaluate('document.querySelector("#operation-margin").textContent'), /Preencha proposta/);
  await evaluate(`(() => { const form = document.querySelector('#edit-form'); form.elements.proposalValue.value = '1200.00'; form.elements.estimatedCost.value = '450.00'; form.elements.estimatedCost.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  assert.match(await evaluate('document.querySelector("#operation-margin").textContent'), /750,00/);
  await evaluate(`document.querySelector('#edit-form select').value = 'Proposta enviada'; document.querySelector('#edit-form textarea').value = 'Aguardar retorno na sexta.'; document.querySelector('#edit-form').requestSubmit()`);
  await until('document.querySelector("#edit-message").textContent.includes("salvas")');
  await evaluate('document.querySelector("#request-dialog").close()');
  await screenshot('admin');
  assert.match(await evaluate('document.querySelector(".status-pill").textContent'), /Proposta enviada/);
  await evaluate('document.querySelector("[data-open]").click(); document.querySelector("#delete-request").click(); document.querySelector("#confirm-delete").click()');
  await until('document.querySelectorAll(".request-row").length === 0');
  await evaluate('document.querySelector("#logout").click()');
  await until('!document.querySelector("#login-view").hidden');
  for (const width of [390, 320, 768]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: false });
    await navigate(base);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Overflow at ${width}`);
    await screenshot(`viewport-${width}`);
    if (width === 390) {
      await screenshot('mobile-full', true);
      await evaluate('document.querySelector(".menu-toggle").click()');
      assert.equal(await evaluate('document.querySelector(".menu-toggle").getAttribute("aria-expanded")'), 'true');
      await evaluate('document.querySelector("#navigation a").click()');
      assert.equal(await evaluate('document.querySelector(".menu-toggle").getAttribute("aria-expanded")'), 'false');
      await evaluate('document.querySelector("[data-privacy]").click()');
      assert.equal(await evaluate('document.querySelector("#privacy-dialog").open'), true);
      await evaluate('document.querySelector("#privacy-dialog").close()');
    }
  }
  await navigate(pathToFileURL(path.resolve('../index.html')).href);
  await until('document.querySelectorAll(".tour-card").length === 6');
  assert.equal(await evaluate('document.querySelector("select[name=city]").options.length'), 646);
  await evaluate(`(() => { const form = document.querySelector('#request-form'); form.elements.name.value = 'Teste local'; form.elements.phone.value = '(13) 99999-9999'; form.elements.city.value = 'Santos'; form.elements.consent.checked = true; form.requestSubmit(); })()`);
  await until('!document.querySelector("#form-feedback").hidden');
  assert.equal(await evaluate('window.whatsappCalls.length'), 1);
  assert.equal(await evaluate('document.querySelector("#form-feedback").classList.contains("error")'), false);
  const localMessage = decodeURIComponent(await evaluate('window.whatsappCalls[0][0]'));
  assert.ok(localMessage.includes('Cidade do passeio: Santos')); assert.ok(!localMessage.includes('Data final:'));
  const unexpected = errors.filter(error => !error.includes('401 (Unauthorized)'));
  assert.deepEqual(unexpected, [], 'Browser runtime/network errors');
  console.log('Browser checks passed: images, desktop/mobile layouts, filters, tour selection, gallery, request, WhatsApp link, login, status, deletion, logout, menu and privacy.');
} finally { socket.close(); }
