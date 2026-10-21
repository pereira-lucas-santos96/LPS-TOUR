import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateOperation, financials, summarize, milestones, conflictsFor } from '../public/operations.js';
import { bindOperationFields, operationPayload } from '../public/admin-operations.js';
const now = '2026-10-20T12:00:00.000Z';
const lead = (id = 'a') => ({ id, reference: `LPS-${id}`, status: 'Novo', createdAt: now, updatedAt: now, internalNotes: '', funnel: { proposalAt: null, bookingAt: null, legacyInferred: false } });
const booking = { status: 'Confirmado', bookingStart: '2027-04-05T09:00', bookingEnd: '2027-04-05T12:00' };

test('The proposal editor calculates its preview on open and on input, preserving missing values', () => {
  const output = { textContent: '', className: '' };
  const events = {};
  const form = {
    elements: Object.fromEntries(['proposalValue', 'estimatedCost', 'nextContactAt', 'bookingStart', 'bookingEnd'].map(name => [name, { value: '' }])),
    querySelector: () => output,
    addEventListener: (name, handler) => { events[name] = handler; }
  };
  bindOperationFields(form);
  assert.match(output.textContent, /Preencha proposta/);
  form.elements.proposalValue.value = '1200.00'; form.elements.estimatedCost.value = '450.00';
  events.input();
  assert.match(output.textContent, /750,00/); assert.match(output.textContent, /62,5%/);
  assert.equal(operationPayload(form).proposalCents, 120000);
  form.elements.estimatedCost.value = '1500.00'; events.input();
  assert.match(output.textContent, /custos acima/); assert.equal(output.className, 'operation-warning');
  form.elements.estimatedCost.value = ''; events.input();
  assert.equal(operationPayload(form).estimatedCostCents, null); assert.equal(output.className, '');
  form.elements.proposalValue.value = '12.345'; events.input();
  assert.match(output.textContent, /duas casas decimais/);
});

test('Money uses integer cents; zero, missing data and negative margins are distinct', () => {
  assert.deepEqual(financials(lead()), { value: null, cost: null, margin: null, percent: null });
  assert.equal(financials({ proposalCents: 10000, estimatedCostCents: 12000 }).margin, -2000);
  assert.equal(financials({ proposalCents: 0, estimatedCostCents: 0 }).percent, null);
  const item = updateOperation(lead(), { proposalCents: 12345, estimatedCostCents: 2345 }, []);
  assert.equal(financials(item).margin, 10000);
  for (const value of [-1, 1.2, '100', NaN, Infinity, 10000000001]) assert.throws(() => updateOperation(lead(), { proposalCents: value }, []), /valores/);
  assert.equal(updateOperation(item, { proposalCents: null }, []).estimatedCostCents, 2345);
});

test('Schedule validates calendar dates and blocks overlapping bookings, including multi-day trips', () => {
  const first = updateOperation(lead(), booking, []);
  assert.throws(() => updateOperation(lead('b'), { ...booking, bookingStart: '2027-04-04T18:00', bookingEnd: '2027-04-06T08:00' }, [first]), error => error.status === 409);
  assert.throws(() => updateOperation(lead(), { ...booking, bookingEnd: booking.bookingStart }, []), /posterior/);
  assert.throws(() => updateOperation(lead(), { status: 'Confirmado' }, []), /período/);
  assert.throws(() => updateOperation(lead(), { nextContactAt: '2027-02-30T09:00' }, []), /válidas/);
  assert.throws(() => updateOperation(lead(), { bookingStart: booking.bookingStart }, []), /início e o fim/);
  assert.equal(conflictsFor(first, [first]).length, 0);
  assert.equal(updateOperation(lead('b'), { ...booking, bookingStart: booking.bookingEnd, bookingEnd: '2027-04-05T14:00' }, [first]).status, 'Confirmado');
  const cancelled = updateOperation(first, { status: 'Cancelado' }, [first]);
  assert.equal(updateOperation(lead('b'), booking, [cancelled]).status, 'Confirmado');
  assert.equal(updateOperation(lead('b'), { ...booking, status: 'Proposta enviada' }, [first]).status, 'Proposta enviada');
});

test('Funnel counts each contact once and preserves conversion after cancellations or regressions', () => {
  let first = updateOperation(lead(), { status: 'Proposta enviada' }, [], now);
  first = updateOperation(first, booking, [], now);
  first = updateOperation(first, { status: 'Cancelado' }, [], now);
  const second = updateOperation(lead('b'), { status: 'Proposta enviada' }, [], now);
  const result = summarize([first, second, lead('c')]);
  assert.equal(result.contacts, 3); assert.equal(result.proposals, 2); assert.equal(result.bookings, 1);
  assert.equal(result.proposalToBooking, 50); assert.equal(result.cancelled, 1);
  assert.equal(summarize([]).contactToProposal, null);
  assert.equal(summarize([lead()]).proposalToBooking, null);
  assert.equal(updateOperation(second, { status: 'Novo' }, [], now).funnel.proposalAt, now);
  assert.equal(first.statusHistory.length, 3);
});

test('Totals include only booked trips with both values filled; historical inference is explicit', () => {
  const first = updateOperation(lead(), { ...booking, proposalCents: 50000, estimatedCostCents: 20000 }, [], now);
  const second = updateOperation(lead('b'), booking, [], now);
  const unbooked = updateOperation(lead('c'), { proposalCents: 90000, estimatedCostCents: 1000 }, [], now);
  const result = summarize([first, second, unbooked]);
  assert.equal(result.estimatedRevenue, 50000); assert.equal(result.estimatedMargin, 30000); assert.equal(result.missingPrices, 1);
  const old = { ...lead('old'), funnel: undefined, status: 'Confirmado' };
  assert.equal(milestones(old).legacyInferred, true);
  assert.equal(summarize([old]).bookings, 1);
});
