import { renderOperations, setupOperations, operationFields, bindOperationFields, operationPayload } from './admin-operations.js';
import { statuses } from './operations.js';
const $ = selector => document.querySelector(selector);
const labels = { paulista: 'Paulista & arte', centro: 'Centro histórico', sabores: 'Gastronomia', verde: 'Parques', litoral: 'Litoral', personalizado: 'Sob medida' };
let requests = [];
let activeId = null;
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const displayDate = value => value ? value.split('-').reverse().join('/') : 'A combinar';
const receivedDate = value => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) { if (response.status === 401) showLogin(); throw new Error(data.error || 'Não foi possível concluir a operação.'); }
  return data;
}
function showLogin() { $('#login-view').hidden = false; $('#dashboard').hidden = true; $('#logout').hidden = true; requests = []; $('#requests-list').replaceChildren(); $('#stats').replaceChildren(); $('#request-detail').replaceChildren(); activeId = null; renderOperations([]); for (const id of ['funnel-summary', 'source-summary', 'followups', 'agenda']) document.querySelector('#' + id).replaceChildren(); document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close()); }
async function load() {
  const data = await api('/api/requests'); requests = data.requests;
  $('#login-view').hidden = true; $('#dashboard').hidden = false; $('#logout').hidden = false;
  $('#dashboard-message').textContent = ''; render();
}
function render() {
  renderOperations(requests);
  $('#stats').innerHTML = [['Todos os pedidos', requests.length], ['Novos contatos', requests.filter(item => item.status === 'Novo').length], ['Em negociação', requests.filter(item => ['Em conversa', 'Proposta enviada'].includes(item.status)).length], ['Passeios confirmados', requests.filter(item => item.status === 'Confirmado').length]].map(([label, count]) => `<div class="stat"><strong>${count}</strong><span>${label}</span></div>`).join('');
  const query = $('#search').value.trim().toLocaleLowerCase('pt-BR');
  const selected = $('#status-filter').value;
  const filtered = requests.filter(item => (!selected || item.status === selected) && (!query || [item.name, item.phone, item.email, item.reference].some(value => value.toLocaleLowerCase('pt-BR').includes(query))));
  $('#requests-list').innerHTML = filtered.length ? filtered.map(item => `<article class="request-row"><div><h2>${escape(item.name)}</h2><p>${escape(item.reference)} · ${receivedDate(item.createdAt)}</p></div><div><small>PASSEIO DESEJADO</small><p>${displayDate(item.date)} · ${item.people} pessoa(s)<br>${escape(item.profile)}</p></div><div><span class="status-pill ${item.status === 'Novo' ? 'new' : ''}">${escape(item.status)}</span></div><button class="button" data-open="${item.id}">Ver pedido ↗</button></article>`).join('') : `<div class="empty-state"><h2>${requests.length ? 'Nenhum resultado por aqui.' : 'Espaço para novas histórias.'}</h2><p>${requests.length ? 'Tente outro nome ou altere o filtro de etapa.' : 'Quando alguém enviar o formulário do site, a solicitação aparecerá aqui.'}</p></div>`;
}
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true; $('#login-error').textContent = '';
  try { await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('#password').value }) }); $('#password').value = ''; await load(); } catch (error) { $('#login-error').textContent = error.message; } finally { button.disabled = false; }
});
$('#logout').addEventListener('click', async () => { try { await api('/api/logout', { method: 'POST', body: '{}' }); showLogin(); } catch (error) { $('#dashboard-message').textContent = error.message; } });
$('#refresh').addEventListener('click', async event => { event.currentTarget.disabled = true; try { await load(); } catch (error) { $('#dashboard-message').textContent = error.message; } finally { $('#refresh').disabled = false; } });
$('#search').addEventListener('input', render); $('#status-filter').addEventListener('change', render);
$('#requests-list').addEventListener('click', event => { const button = event.target.closest('[data-open]'); if (button) openRequest(button.dataset.open); });
function openRequest(id) {
  activeId = id; const item = requests.find(entry => entry.id === id);
  const phone = item.phone.replace(/\D/g, ''); const internationalPhone = phone.length <= 11 ? `55${phone}` : phone;
  const message = `Olá, ${item.name}! Aqui é o Lucas, da LUPES TOUR. Recebi sua solicitação ${item.reference} e vamos conversar sobre seu passeio?`;
  $('#request-detail').innerHTML = `<span class="eyebrow">${escape(item.reference)}</span><h2>${escape(item.name)}</h2><div class="admin-actions"><a class="button" href="https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">Conversar no WhatsApp ↗</a>${item.email ? `<a class="button button-light" href="mailto:${escape(item.email)}">Enviar e-mail ↗</a>` : ''}</div><dl class="detail-grid"><div><dt>Recebido em</dt><dd>${receivedDate(item.createdAt)}</dd></div><div><dt>Cidade do passeio</dt><dd>${escape(item.city || 'A combinar')}</dd></div><div><dt>Data inicial</dt><dd>${displayDate(item.date)}</dd></div><div><dt>Data final</dt><dd>${displayDate(item.endDate)}</dd></div><div><dt>Contato</dt><dd>${escape(item.phone)}<br>${escape(item.email || 'Sem e-mail')}</dd></div><div><dt>Grupo</dt><dd>${item.people} pessoa(s) · ${escape(item.profile)}</dd></div><div><dt>Duração</dt><dd>${escape(item.duration || 'A combinar')}</dd></div><div><dt>Precisa de transporte</dt><dd>${escape(item.transport || 'A combinar')}</dd></div><div><dt>Origem do contato</dt><dd>${escape(item.sourcePage || 'Não registrada')}<br>${escape(item.utmSource || 'Sem campanha')} ${escape(item.utmCampaign || '')}</dd></div><div><dt>Interesses</dt><dd>${item.interests.map(key => labels[key]).join(', ') || 'Sob medida'}</dd></div><div><dt>Consentimento registrado</dt><dd>${receivedDate(item.consentAt)}</dd></div></dl><span class="eyebrow">O QUE O CLIENTE CONTOU</span><p class="detail-note">${escape(item.notes || 'Nenhuma observação informada.')}</p><form class="edit-form" id="edit-form"><label>Etapa do atendimento<select name="status">${statuses.map(status => `<option ${item.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></label><p class="detail-note"><strong>Para combinar no WhatsApp:</strong> confirme duração, ponto de encontro e deslocamento (carro/van, transporte público ou caminhada); crianças, idosos, mobilidade reduzida ou pets no grupo; restrições alimentares e estilo de viagem (econômico, intermediário ou premium).</p>${operationFields(item)}<label>Anotações internas<textarea name="internalNotes" rows="4" maxlength="4000" placeholder="Próximo contato, proposta, valores combinados…">${escape(item.internalNotes)}</textarea></label><div class="admin-actions"><button class="button" type="submit">Salvar alterações</button><button id="delete-request" type="button" class="button button-light">Excluir pedido</button></div><p id="edit-message" role="status"></p></form>`;
  bindOperationFields($('#edit-form'));
  $('#request-dialog').showModal();
  $('#edit-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.currentTarget.querySelector('[type="submit"]'); button.disabled = true;
    try { const values = { ...Object.fromEntries(new FormData(event.currentTarget)), ...operationPayload(event.currentTarget) }; delete values.proposalValue; delete values.estimatedCost; const data = await api(`/api/requests/${id}`, { method: 'PATCH', body: JSON.stringify(values) }); requests = requests.map(entry => entry.id === id ? data.request : entry); render(); if ($('#edit-message')) $('#edit-message').textContent = 'Alterações salvas.'; }
    catch (error) { if ($('#edit-message')) $('#edit-message').textContent = error.message; else $('#login-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('#delete-request').addEventListener('click', () => { $('#delete-error').textContent = ''; $('#delete-dialog').showModal(); });
}
$('#confirm-delete').addEventListener('click', async event => {
  event.currentTarget.disabled = true;
  try { await api(`/api/requests/${activeId}`, { method: 'DELETE', body: '{}' }); requests = requests.filter(item => item.id !== activeId); activeId = null; $('#delete-dialog').close(); $('#request-dialog').close(); render(); }
  catch (error) { $('#delete-error').textContent = error.message; }
  finally { $('#confirm-delete').disabled = false; }
});
$('#cancel-delete').addEventListener('click', () => $('#delete-dialog').close());
document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
setupOperations(openRequest);
load().catch(error => { if (!error.message.includes('Entre na área')) $('#login-error').textContent = 'O painel precisa do servidor em execução. ' + error.message; });
