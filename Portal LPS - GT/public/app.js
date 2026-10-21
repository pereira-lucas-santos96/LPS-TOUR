const $ = (selector) => document.querySelector(selector);
const config = window.LPS_CONFIG;
const scriptBase = new URL('./', document.currentScript.src);
const assetUrl = name => new URL(`assets/${name}`, scriptBase).href;
const tours = window.LPS_TOURS;
const artworks = {
  city: '<path d="M15 120h250M28 120V69h45v51m9 0V58h18V28h14v30h18v62m14 0V67h48v53m17 0V42h38v78M22 69l29-22 29 22M151 66l19-18 19 18M95 28l12-17 12 17M37 83h27m-27 12h27m-27 12h27m94-25h22m-22 14h22m47-37h16m-16 14h16m-16 14h16m-16 14h16"/>',
  food: '<path d="M25 120h235M55 91h87l-9 20H64ZM61 91c-6-15 2-25 13-32 10 8 16 18 12 32m0 0c-7-24 8-42 20-52 17 15 18 37 7 52m1-30c8-10 16-16 26-12 1 15-1 30-12 42M166 79h54v28a15 15 0 0 1-15 13h-24a15 15 0 0 1-15-13Zm54 7h6a12 12 0 0 1 0 24h-8M173 65c-10-13 13-14 3-29m18 29c-10-13 13-14 3-29m18 29c-10-13 13-14 3-29"/>',
  nature: '<path d="M15 120h250M63 120V64m-21 15 21 17 20-21M63 22C21 44 9 83 42 90m21-68c42 22 54 61 21 68M186 120V39m-15 21 15 13 13-13m-13-45c-30 17-45 44-31 59m31-59c30 17 45 44 31 59M110 120V99h44v21m-48-21h52m-47-10h42M22 132c30-10 49 8 75-1s42 8 65 0 42 8 81 0"/><circle cx="132" cy="30" r="13"/>',
  coast: '<path d="M14 123c24-14 32 14 56 0s32 14 56 0 32 14 56 0 32 14 56 0m-214 14c24-14 32 14 56 0s32 14 56 0 32 14 56 0M87 109h58l-9-9V56H98v44ZM94 56h46l-8-12h-30Zm9-12V32h28v12m-14-23V10m-3 72h9m-9 12h9m63 17V75m0 0c-17-23-34-23-43-15m43 15c-6-24 1-42 13-49m-13 49c16-25 34-28 46-22m-46 22c18-6 29 2 35 16"/><circle cx="48" cy="35" r="16"/>',
  route: '<path d="M48 27c-20 0-24 23 0 48 24-25 20-48 0-48ZM222 69c-20 0-24 23 0 48 24-25 20-48 0-48Z"/><circle cx="48" cy="45" r="6"/><circle cx="222" cy="87" r="6"/><path d="M51 87c-8 41 68 42 76 6s-38-61 5-67 42 45 72 30" stroke-dasharray="4 7"/><path d="m172 92 5 12 12 5-12 5-5 12-5-12-12-5 12-5Z"/>'
};
function art(tour) {
  return tour.image ? `<img src="${assetUrl('sao-paulo.jpg')}" alt="Avenida Paulista vista do alto" width="1600" height="1200" loading="lazy">` : `<svg viewBox="0 0 280 150" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${artworks[tour.art]}</svg>`;
}
$('#tour-grid').innerHTML = tours.map((tour, i) => `<article class="tour-card" data-category="${tour.category}"><div class="tour-art ${tour.category}">${art(tour)}<small>${tour.image ? 'UM NOVO OLHAR' : 'EXPLORE DO SEU JEITO'}</small><span class="tour-number" aria-hidden="true">0${i + 1}</span></div><div class="tour-body"><div class="tour-meta">${tour.tag}</div><h3>${tour.title}</h3><p>${tour.description}</p><div class="tour-bottom"><span>${tour.duration}</span><button type="button" data-tour="${tour.id}" aria-label="Conhecer ${tour.title}">Conhecer <span aria-hidden="true">↗</span></button></div></div></article>`).join('');
$('#interest-options').innerHTML = tours.map(tour => `<label class="interest-choice"><input type="checkbox" name="interests" value="${tour.id}"><span>${({ paulista: 'Paulista & arte', centro: 'Centro histórico', sabores: 'Gastronomia', verde: 'Parques', litoral: 'Litoral', personalizado: 'Sob medida' })[tour.id]}</span></label>`).join('');
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-filter]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
  document.querySelectorAll('.tour-card').forEach(card => { card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter; });
}));
$('#tour-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-tour]');
  if (!button) return;
  const tour = tours.find(item => item.id === button.dataset.tour);
  $('#tour-detail').innerHTML = `<span class="eyebrow">${tour.tag}</span><h2>${tour.title}</h2><p>${tour.detail}</p><ul>${tour.stops.map(stop => `<li>${stop}</li>`).join('')}</ul><p><strong>${tour.duration}</strong><br>Disponibilidade e valores sob consulta. A contratação depende da aprovação da proposta.</p><button class="button" id="choose-tour">Quero este roteiro <span aria-hidden="true">↗</span></button>`;
  $('#tour-dialog').showModal();
  $('#choose-tour').addEventListener('click', () => {
    $(`input[name="interests"][value="${tour.id}"]`).checked = true;
    $('#tour-dialog').close();
    $('#planejar').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => $('input[name="name"]').focus({ preventScroll: true }), 400);
  });
});
const photos = [
  ['marrocos', 'Marrocos', 'ENTRE DUNAS', 'Lucas no deserto do Marrocos, com turbante azul'],
  ['louvre', 'França', 'ARTE PELO CAMINHO', 'Lucas diante da pirâmide do Museu do Louvre em Paris'],
  ['escocia', 'Escócia', 'HISTÓRIA VIVA', 'Lucas junto ao Monumento a Scott em Edimburgo'],
  ['lucas-natureza', 'Natureza', 'ESPÍRITO EXPLORADOR', 'Lucas de capacete em uma passarela de madeira junto à entrada de uma caverna'],
  ['paris', 'Paris', 'NOVAS PERSPECTIVAS', 'Lucas com a Torre Eiffel ao fundo'],
  ['deserto', 'Marrocos', 'MEMÓRIAS DO DESERTO', 'Lucas em um passeio de dromedário no deserto'],
  ['arco-do-triunfo', 'França', 'PELAS RUAS DE PARIS', 'Lucas em frente ao Arco do Triunfo'],
  ['jardins', 'Pelo mundo', 'TEMPO PARA CONTEMPLAR', 'Lucas junto a um lago em um parque arborizado']
];
$('#gallery-track').innerHTML = photos.map((photo, index) => `<figure class="gallery-item"><button data-photo="${index}" aria-label="Ampliar foto: ${photo[3]}"><img src="${assetUrl(photo[0] + '.jpg')}" alt="${photo[3]}" width="400" height="520" loading="lazy"><span class="photo-expand" aria-hidden="true">↗</span></button><figcaption><strong>${photo[1]}</strong><span>${photo[2]}</span></figcaption></figure>`).join('');
$('#gallery-track').addEventListener('click', event => {
  const button = event.target.closest('[data-photo]');
  if (!button) return;
  const photo = photos[Number(button.dataset.photo)];
  $('#expanded-photo').src = assetUrl(photo[0] + '.jpg');
  $('#expanded-photo').alt = photo[3];
  $('#expanded-caption').textContent = `${photo[1]} · ${photo[2].toLowerCase()} · Acervo pessoal de Lucas Pereira`;
  $('#photo-dialog').showModal();
});
for (const [id, direction] of [['#gallery-prev', -1], ['#gallery-next', 1]]) $(id).addEventListener('click', () => $('#gallery-track').scrollBy({ left: direction * $('#gallery-track').clientWidth * .75, behavior: 'smooth' }));
document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }));
document.querySelectorAll('[data-privacy]').forEach(button => button.addEventListener('click', () => $('#privacy-dialog').showModal()));
const menu = $('.menu-toggle');
function closeMenu() { menu.setAttribute('aria-expanded', 'false'); $('#navigation').classList.remove('is-open'); menu.setAttribute('aria-label', 'Abrir menu'); }
menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu'); $('#navigation').classList.toggle('is-open', open); });
$('#navigation').addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
document.querySelectorAll('.whatsapp-link').forEach(link => { link.href = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent('Olá, Lucas! Vim pelo site da LUPES TOUR e gostaria de conversar sobre um roteiro em São Paulo.')}`; });
document.querySelectorAll('.email-link').forEach(link => { link.href = `mailto:${config.email}`; link.textContent = config.email; });
$('#year').textContent = new Date().getFullYear();
function localDate() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date()); }
$('input[name="date"]').min = localDate();
const startDateInput = $('input[name="date"]');
const endDateInput = $('input[name="endDate"]');
const durationInput = $('select[name="duration"]');
function syncDateRange() {
  const multipleDays = durationInput.value === '2+ dias';
  $('#end-date-field').hidden = !multipleDays;
  endDateInput.disabled = !multipleDays;
  if (!multipleDays) endDateInput.value = '';
  startDateInput.required = multipleDays && Boolean(endDateInput.value);
  $('#start-date-optional').textContent = startDateInput.required ? '*' : '(opcional)';
  if (startDateInput.value) {
    const nextDay = new Date(`${startDateInput.value}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    endDateInput.min = nextDay.toISOString().slice(0, 10);
  } else endDateInput.min = localDate();
}
durationInput.addEventListener('change', syncDateRange);
startDateInput.addEventListener('input', syncDateRange);
endDateInput.addEventListener('input', syncDateRange);
$('#request-form').addEventListener('reset', () => queueMicrotask(syncDateRange));
syncDateRange();
let requestKey = null;
$('#request-form').addEventListener('input', () => { requestKey = null; });
$('#request-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  syncDateRange();
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const feedback = $('#form-feedback');
  const phone = String(data.get('phone')).replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 15) { $('input[name="phone"]').setCustomValidity('Informe um telefone com DDD, entre 10 e 15 dígitos.'); $('input[name="phone"]').reportValidity(); return; }
  const payload = Object.fromEntries(data.entries());
  payload.name = payload.name.trim();
  if (payload.name.length < 2) { $('input[name="name"]').setCustomValidity('Informe seu nome com pelo menos dois caracteres.'); $('input[name="name"]').reportValidity(); return; }
  payload.interests = data.getAll('interests');
  payload.consent = data.get('consent') === 'on';
  payload.people = Number(payload.people);
  const entry = new URLSearchParams(location.search);
  const allowedSources = ['/', '/destinos/sao-paulo.html', '/destinos/santos.html', ...tours.map(tour => `/roteiros/${tour.id}.html`)];
  payload.sourcePage = allowedSources.includes(entry.get('source')) ? entry.get('source') : '/';
  payload.utmSource = (entry.get('utm_source') || '').slice(0, 100);
  payload.utmCampaign = (entry.get('utm_campaign') || '').slice(0, 120);
  requestKey ||= crypto.randomUUID();
  payload.requestKey = requestKey;
  const interestNames = tours.filter(tour => payload.interests.includes(tour.id)).map(tour => tour.title).join(', ') || 'Roteiro sob medida';
  const dateText = payload.date ? payload.date.split('-').reverse().join('/') : 'A combinar';
  const endDateText = payload.endDate ? payload.endDate.split('-').reverse().join('/') : 'A combinar';
  const message = `Olá, Lucas! Quero planejar um passeio com a LUPES TOUR.\n\nNome: ${payload.name}\nWhatsApp: ${payload.phone}\nE-mail: ${payload.email || 'Não informado'}\nInteresses: ${interestNames}\nCidade do passeio: ${payload.city || 'A combinar'}\nData inicial: ${dateText}${payload.duration === '2+ dias' ? `\nData final: ${endDateText}` : ''}\nPessoas: ${payload.people}\nPerfil: ${payload.profile}\nDuração: ${payload.duration || 'A combinar'}\nPrecisa de transporte: ${payload.transport || 'A combinar'}\nObservações: ${payload.notes || 'A combinar'}`;
  const whatsappUrl = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(message)}`;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = 'Preparando seu pedido…';
  feedback.hidden = true;
  // Abre durante o clique do cliente, antes de aguardar a rede, para evitar bloqueios de pop-up.
  // O link no retorno continua disponível caso o navegador bloqueie a abertura.
  try { window.open(whatsappUrl, '_blank', 'noopener,noreferrer'); } catch { /* Mantém o link de alternativa. */ }
  try {
    if (location.protocol === 'file:') throw new Error('preview');
    const response = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível registrar a solicitação.');
    feedback.className = '';
    feedback.replaceChildren();
    const title = document.createElement('strong'); title.textContent = `Solicitação ${result.reference} recebida!`;
    const description = document.createElement('p'); description.textContent = 'Seus dados foram registrados. Confirme o envio do resumo no WhatsApp. Se ele não abriu automaticamente, use o botão abaixo. A reserva será confirmada após combinarmos a proposta.';
    feedback.append(title, description);
    form.reset();
    requestKey = null;
  } catch (error) {
    feedback.className = error.message === 'preview' ? '' : 'error';
    feedback.replaceChildren();
    const description = document.createElement('p');
    description.textContent = error.message === 'preview' ? 'Seu resumo está pronto. Confirme o envio no WhatsApp. Se ele não abriu automaticamente, use o botão abaixo.' : `Não foi possível confirmar o registro no site. ${error.name === 'TimeoutError' ? 'A conexão demorou mais que o esperado.' : ''} Confirme o envio do resumo no WhatsApp ou abra a conversa pelo botão abaixo.`;
    feedback.append(description);
  } finally {
    const link = document.createElement('a');
    link.href = whatsappUrl;
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = 'Abrir WhatsApp com meu resumo ↗';
    feedback.append(link);
    feedback.hidden = false;
    button.disabled = false;
    button.innerHTML = 'Pedir orçamento pelo WhatsApp <span aria-hidden="true">↗</span>';
    feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});
for (const name of ['phone', 'name']) $(`input[name="${name}"]`).addEventListener('input', event => event.target.setCustomValidity(''));

// Aplica as preferências vindas das páginas de roteiros e destinos.
const entryParams = new URLSearchParams(location.search);
const requestedTour = tours.find(tour => tour.id === entryParams.get('tour'));
if (requestedTour) document.querySelector('input[name="interests"][value="' + requestedTour.id + '"]').checked = true;
const requestedCity = entryParams.get('city');
if ([...document.querySelector('select[name="city"]').options].some(option => option.value === requestedCity)) document.querySelector('select[name="city"]').value = requestedCity;
