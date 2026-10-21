import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tours, publicPages } from '../content/experiences.mjs';

test('Every landing page has unique content, valid local links, and a contextual form CTA', () => {
  const titles = new Set();
  for (const page of publicPages) {
    const file = path.join('public', page.path);
    const html = fs.readFileSync(file, 'utf8');
    titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
    assert.ok(html.includes('<h1>')); assert.ok(html.includes('name="description"'));
    assert.ok(html.includes(encodeURIComponent(page.path)));
    for (const [, reference] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const clean = reference.split(/[?#]/)[0];
      if (!clean || /^https?:/.test(clean)) continue;
      assert.ok(fs.existsSync(path.resolve(path.dirname(file), decodeURIComponent(clean))), `${page.path}: ${clean}`);
    }
  }
  assert.equal(titles.size, 8);
});

test('Home uses the same tours as the dedicated pages', () => {
  const context = { window: {} }; vm.runInNewContext(fs.readFileSync('public/tours-data.js', 'utf8'), context);
  assert.equal(JSON.stringify(context.window.LPS_TOURS), JSON.stringify(tours));
  const index = fs.readFileSync('../index.html', 'utf8');
  assert.ok(index.indexOf('/tours-data.js"') < index.indexOf('/app.js"'));
  assert.ok(index.includes('destinos/sao-paulo.html')); assert.ok(index.includes('destinos/santos.html'));
});

test('Root index, landing pages and admin have valid local links, assets and anchors', () => {
  const pages = ['../index.html', 'public/admin.html', ...publicPages.map(page => path.join('public', page.path))];
  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    for (const [, raw] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const reference = raw.replaceAll('&amp;', '&');
      if (/^(https?:|mailto:|tel:|data:)/.test(reference) || reference.startsWith('/api/')) continue;
      const url = new URL(reference, pathToFileURL(path.resolve(file)));
      const target = fileURLToPath(url);
      assert.ok(fs.existsSync(target), `${file} → ${reference}`);
      if (url.hash) assert.ok(fs.readFileSync(target, 'utf8').includes(`id="${url.hash.slice(1)}"`), `${file}: missing anchor ${reference}`);
    }
  }
  const css = fs.readFileSync('public/styles.css', 'utf8');
  for (const [, reference] of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) assert.ok(fs.existsSync(path.resolve('public', reference)), `CSS resource: ${reference}`);
  assert.ok(!fs.existsSync('public/index.html'), 'The home page has a single source at the repository root');
});

test('The simplified form preserves optional choices, transport values and multi-day behavior', () => {
  const index = fs.readFileSync('../index.html', 'utf8');
  assert.ok(index.includes('1. Seus dados')); assert.ok(index.includes('2. Seu passeio')); assert.ok(index.includes('3. Quem vai com você'));
  for (const [value, label] of [['Dia completo', 'Um dia inteiro'], ['2+ dias', 'Dois dias ou mais'], ['Individual', 'Vou sozinho(a)']]) assert.ok(index.includes(`<option value="${value}">${label}</option>`));
  assert.ok(index.includes('id="end-date-field" hidden')); assert.ok(index.includes('name="endDate" disabled'));
  assert.ok(index.includes('mailto:pereira.lucas.santos96@gmail.com'));
  const config = { window: {} }; vm.runInNewContext(fs.readFileSync('public/config.js', 'utf8'), config);
  assert.equal(config.window.LPS_CONFIG.email, 'pereira.lucas.santos96@gmail.com');
});
