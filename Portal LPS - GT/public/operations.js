// Datas operacionais usam o horário de São Paulo (UTC-03:00).
export const statuses = ['Novo', 'Em conversa', 'Proposta enviada', 'Confirmado', 'Concluído', 'Cancelado'];
export const isBooked = item => ['Confirmado', 'Concluído'].includes(item.status);
export function milestones(item) {
  if (item.funnel) return item.funnel;
  return {
    proposalAt: ['Proposta enviada', 'Confirmado', 'Concluído'].includes(item.status) ? item.updatedAt || item.createdAt : null,
    bookingAt: isBooked(item) ? item.updatedAt || item.createdAt : null,
    legacyInferred: true
  };
}
export function financials(item) {
  const value = item.proposalCents ?? null;
  const cost = item.estimatedCostCents ?? null;
  const margin = value !== null && cost !== null ? value - cost : null;
  return { value, cost, margin, percent: margin !== null && value > 0 ? margin / value * 100 : null };
}
export function summarize(items) {
  const proposals = items.filter(item => milestones(item).proposalAt).length;
  const bookings = items.filter(item => milestones(item).bookingAt).length;
  const priced = items.filter(isBooked).filter(item => financials(item).margin !== null);
  return {
    contacts: items.length, proposals, bookings,
    contactToProposal: items.length ? proposals / items.length * 100 : null,
    proposalToBooking: proposals ? bookings / proposals * 100 : null,
    cancelled: items.filter(item => item.status === 'Cancelado').length,
    estimatedRevenue: priced.reduce((sum, item) => sum + item.proposalCents, 0),
    estimatedCost: priced.reduce((sum, item) => sum + item.estimatedCostCents, 0),
    estimatedMargin: priced.reduce((sum, item) => sum + financials(item).margin, 0),
    pricedBookings: priced.length,
    missingPrices: items.filter(isBooked).length - priced.length,
    legacyInferred: items.filter(item => milestones(item).legacyInferred).length
  };
}
export function conflictsFor(item, items) {
  if (!isBooked(item) || !item.bookingStart || !item.bookingEnd) return [];
  return items.filter(other => other.id !== item.id && isBooked(other) && other.bookingStart && other.bookingEnd && item.bookingStart < other.bookingEnd && item.bookingEnd > other.bookingStart);
}
function invalid(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function dateTime(value) {
  if (value === '') return value;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) invalid('Informe uma data e hora válidas.');
  const parsed = new Date(value + ':00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 16) !== value) invalid('Informe uma data e hora válidas.');
  return value;
}
export function updateOperation(item, data, items, now = new Date().toISOString()) {
  const next = { ...item, funnel: { ...milestones(item) }, updatedAt: now };
  if ('status' in data) { if (!statuses.includes(data.status)) invalid('Status inválido.'); next.status = data.status; }
  if ('internalNotes' in data) {
    if (typeof data.internalNotes !== 'string' || data.internalNotes.length > 4000) invalid('As anotações devem ter até 4000 caracteres.');
    next.internalNotes = data.internalNotes.trim();
  }
  for (const key of ['proposalCents', 'estimatedCostCents']) {
    if (!(key in data)) continue;
    if (data[key] !== null && (!Number.isSafeInteger(data[key]) || data[key] < 0 || data[key] > 10000000000)) invalid('Informe valores entre R$ 0 e R$ 100.000.000,00, com até duas casas decimais.');
    next[key] = data[key];
  }
  for (const key of ['nextContactAt', 'bookingStart', 'bookingEnd']) if (key in data) next[key] = dateTime(data[key]);
  if (Boolean(next.bookingStart) !== Boolean(next.bookingEnd)) invalid('Preencha o início e o fim do período reservado.');
  if (next.bookingStart && next.bookingEnd <= next.bookingStart) invalid('O fim da reserva deve ser posterior ao início.');
  if (isBooked(next) && (!next.bookingStart || !next.bookingEnd)) invalid('Informe o período da reserva antes de confirmar ou concluir o passeio.');
  const conflicts = conflictsFor(next, items);
  if (conflicts.length) invalid(`Conflito de agenda com ${conflicts.map(other => other.reference).join(', ')}. Ajuste o período antes de salvar.`, 409);
  if (['Proposta enviada', 'Confirmado', 'Concluído'].includes(next.status)) next.funnel.proposalAt ||= now;
  if (isBooked(next)) next.funnel.bookingAt ||= now;
  if (item.status !== next.status) next.statusHistory = [...(item.statusHistory || []), { status: next.status, at: now }];
  return next;
}
