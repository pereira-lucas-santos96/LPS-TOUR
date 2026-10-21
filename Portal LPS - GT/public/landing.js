// Propaga apenas identificação de campanha, sem cookies ou rastreamento de navegação.
const campaignParams = new URLSearchParams(location.search);
document.querySelectorAll('a[data-campaign-link]').forEach(link => {
  const url = new URL(link.href);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = campaignParams.get(key);
    if (value) url.searchParams.set(key, value.slice(0, 120));
  }
  link.href = url.href;
});
