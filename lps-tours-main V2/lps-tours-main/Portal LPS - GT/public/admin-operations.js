import { summarize, financials, isBooked, conflictsFor } from './operations.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = cents => cents === null ? 'Não informado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const percentage = value => value === null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const dateTime = value => value ? `${value.slice(0, 10).split('-').reverse().join('/')} às ${value.slice(11, 16)}` : 'Não agendado';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
let records = [];
const button = item => `<button type="button" class="inline-button" data-operation-open="${escape(item.id)}">${escape(item.name)} · ${escape(item.reference)}</button>`;
export function renderOperations(items) {
  records = items;
  const from = document.querySelector('#cohort-from').value;
  const to = document.querySelector('#cohort-to').value;
  if (from && to && from > to) {
    document.querySelector('#funnel-summary').textContent = 'A data final do filtro deve ser igual ou posterior à inicial.';
    document.querySelector('#source-summary').replaceChildren();
  } else {
    const cohort = items.filter(item => {
      const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date(item.createdAt));
      return (!from || day >= from) && (!to || day <= to);
    });
    const summary = summarize(cohort);
    document.querySelector('#funnel-summary').innerHTML = `<div class="stats operational-stats">${[
      ['Contatos recebidos', summary.contacts], ['Chegaram a proposta', summary.proposals], ['Chegaram a reserva', summary.bookings], ['Cancelados atualmente', summary.cancelled],
      ['Contato → proposta', percentage(summary.contactToProposal)], ['Proposta → reserva', percentage(summary.proposalToBooking)]
    ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><p class="operations-help">Etapas acumuladas dos contatos recebidos no período selecionado. Confirmar uma reserva também registra a etapa de proposta. Cancelamentos não apagam etapas já alcançadas. ${summary.legacyInferred ? `${summary.legacyInferred} contato(s) anterior(es) à atualização têm histórico estimado pela etapa disponível.` : ''}</p><div class="stats financial-stats">${[
      ['Receita prevista', money(summary.estimatedRevenue)], ['Custos previstos', money(summary.estimatedCost)], ['Margem prevista', money(summary.estimatedMargin)]
    ].map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><p class="operations-help">Totais de ${summary.pricedBookings} reserva(s) confirmada(s) ou concluída(s) com proposta e custos preenchidos; ${summary.missingPrices} sem valores completos. Estimativas, sem controle de pagamentos ou custos realizados.</p>`;
    const sources = new Map();
    for (const item of cohort) {
      const source = `${item.sourcePage || 'Origem não registrada'} · ${item.utmSource || 'Sem campanha'}${item.utmCampaign ? ` / ${item.utmCampaign}` : ''}`;
      if (!sources.has(source)) sources.set(source, []);
      sources.get(source).push(item);
    }
    document.querySelector('#source-summary').innerHTML = sources.size ? `<div class="table-scroll"><table><caption>Conversão por página e campanha</caption><thead><tr><th>Origem</th><th>Contatos</th><th>Propostas</th><th>Reservas</th><th>Contato → proposta</th><th>Proposta → reserva</th></tr></thead><tbody>${[...sources].map(([source, entries]) => { const result = summarize(entries); return `<tr><td>${escape(source)}</td><td>${result.contacts}</td><td>${result.proposals}</td><td>${result.bookings}</td><td>${percentage(result.contactToProposal)}</td><td>${percentage(result.proposalToBooking)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p>Nenhum contato nesse período.</p>';
  }
  const pending = items.filter(item => item.nextContactAt && !['Concluído', 'Cancelado'].includes(item.status)).sort((a, b) => a.nextContactAt.localeCompare(b.nextContactAt));
  document.querySelector('#followups').innerHTML = pending.length ? `<ul class="operation-list">${pending.map(item => {
    const overdue = Date.parse(item.nextContactAt + ':00-03:00') < Date.now();
    return `<li>${button(item)}<span class="${overdue ? 'operation-warning' : ''}">${dateTime(item.nextContactAt)}${overdue ? ' · Atrasado' : item.nextContactAt.startsWith(today()) ? ' · Hoje' : ''}</span></li>`;
  }).join('')}</ul>` : '<p>Nenhum próximo contato agendado. Abra um pedido para adicionar um lembrete.</p>';
  const month = document.querySelector('#agenda-month').value || today().slice(0, 7);
  const start = month + '-01T00:00';
  const next = new Date(month + '-01T00:00:00Z'); next.setUTCMonth(next.getUTCMonth() + 1);
  const end = next.toISOString().slice(0, 16);
  const booked = items.filter(isBooked);
  const agenda = booked.filter(item => item.bookingStart && item.bookingStart < end && item.bookingEnd > start).sort((a, b) => a.bookingStart.localeCompare(b.bookingStart));
  document.querySelector('#agenda').innerHTML = (agenda.length ? `<ul class="operation-list">${agenda.map(item => `<li><div>${button(item)}<p>${escape(item.city || 'Cidade a combinar')} · ${escape(item.status)}</p></div><div>${dateTime(item.bookingStart)}<br>até ${dateTime(item.bookingEnd)}${conflictsFor(item, booked).length ? '<p class="operation-warning">Conflito de horários: revise esta reserva.</p>' : ''}</div></li>`).join('')}</ul>` : '<p>Nenhuma reserva para este mês.</p>') + (booked.some(item => !item.bookingStart) ? '<p class="operation-warning">Há reservas antigas sem horário. Abra esses pedidos para completar a agenda.</p>' : '');
}
export function operationFields(item) {
  const amount = key => item[key] == null ? '' : (item[key] / 100).toFixed(2);
  return `<fieldset><legend>Gestão do atendimento</legend><label>Próximo contato · horário de São Paulo<input type="datetime-local" name="nextContactAt" value="${escape(item.nextContactAt || '')}"></label><p class="operations-help">O lembrete aparece no painel. Limpe a data após realizar o contato ou agende o próximo.</p><div class="form-row"><label>Valor da proposta (R$)<input type="number" name="proposalValue" min="0" max="100000000" step="0.01" value="${amount('proposalCents')}" placeholder="Não informado"></label><label>Custos previstos (R$)<input type="number" name="estimatedCost" min="0" max="100000000" step="0.01" value="${amount('estimatedCostCents')}" placeholder="Não informado"></label></div><output id="operation-margin" aria-live="polite"></output></fieldset><fieldset><legend>Período reservado · horário de São Paulo</legend><div class="form-row"><label>Início da reserva<input type="datetime-local" name="bookingStart" value="${escape(item.bookingStart || '')}"></label><label>Fim da reserva<input type="datetime-local" name="bookingEnd" value="${escape(item.bookingEnd || '')}"></label></div><p class="operations-help">Preencha antes de confirmar. Inclua tempo de deslocamento e preparação. Os horários combinados podem ser diferentes das datas inicialmente solicitadas. Reservas confirmadas ou concluídas bloqueiam períodos sobrepostos para o guia.</p></fieldset>`;
}
function cents(value) {
  if (value === '') return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('Use valores positivos com até duas casas decimais.');
  const [whole, fraction = ''] = value.split('.');
  const number = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(number) || number > 10000000000) throw new Error('Valor acima do limite permitido.');
  return number;
}
export function operationPayload(form) {
  return { proposalCents: cents(form.elements.proposalValue.value), estimatedCostCents: cents(form.elements.estimatedCost.value), nextContactAt: form.elements.nextContactAt.value, bookingStart: form.elements.bookingStart.value, bookingEnd: form.elements.bookingEnd.value };
}
export function bindOperationFields(form) {
  const update = () => {
    try {
      const result = financials(operationPayload(form));
      const output = form.querySelector('#operation-margin');
      output.textContent = result.margin === null ? 'Preencha proposta e custos para calcular a margem prevista.' : `Margem prevista: ${money(result.margin)} · ${percentage(result.percent)}${result.margin < 0 ? ' · Atenção: custos acima do valor da proposta.' : ''}`;
      output.className = result.margin < 0 ? 'operation-warning' : '';
    } catch (error) { form.querySelector('#operation-margin').textContent = error.message; }
  };
  form.addEventListener('input', update); update();
}
export function setupOperations(openRequest) {
  document.querySelector('#agenda-month').value = today().slice(0, 7);
  for (const id of ['cohort-from', 'cohort-to', 'agenda-month']) document.querySelector('#' + id).addEventListener('change', () => renderOperations(records));
  document.querySelector('#operations').addEventListener('click', event => { const target = event.target.closest('[data-operation-open]'); if (target) openRequest(target.dataset.operationOpen); });
  setInterval(() => { if (!document.querySelector('#dashboard').hidden) renderOperations(records); }, 60000);
}
