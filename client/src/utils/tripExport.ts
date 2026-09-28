import { getPreferences, t } from '../i18n/preferences';
import type { TripSummary } from '../services/exportServices';

function escape(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
function label(value: string) { return escape(t(value)); }
function field(name: string, value: string) { return value ? `<div class="field"><strong>${label(name)}</strong><p>${escape(value)}</p></div>` : ''; }
function date(value: string) { return new Intl.DateTimeFormat(getPreferences().language, { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)); }
function safeLink(url: string) {
  try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) ? escape(parsed.href) : null; }
  catch { return null; }
}

export function tripSummaryHtml({ trip, itinerary, packing, budget, generatedAt }: TripSummary): string {
  const { language, timeZone } = getPreferences();
  const money = (amount: number) => escape(new Intl.NumberFormat(language, { style: 'currency', currency: budget.currency }).format(amount));
  const activities = [...itinerary].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const groups = new Map<string, typeof activities>();
  for (const item of activities) groups.set(item.date, [...(groups.get(item.date) ?? []), item]);
  const links = (trip.usefulLinks ?? []).map(link => {
    const href = safeLink(link.url);
    return `<li>${href ? `<a href="${href}" rel="noreferrer">${escape(link.label)}</a><span class="link-address">${escape(link.url)}</span>` : escape(link.label)}</li>`;
  }).join('');
  return `<!doctype html><html lang="${language}" dir="${language === 'he' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(trip.destination)} — ${label('Trip summary')}</title><style>
  *{box-sizing:border-box}body{margin:0 auto;padding:36px;max-width:900px;color:#193c34;background:white;font:15px/1.55 Arial,sans-serif;overflow-wrap:anywhere}h1{font:42px/1.15 Georgia,serif;margin:8px 0}h2{font-size:23px;border-bottom:1px solid #b8c4bb;padding-bottom:8px;margin-top:30px;break-after:avoid}h3{font-size:17px;break-after:avoid}.meta{color:#53655d;font-size:13px}.field p,.activity p{white-space:pre-wrap;margin:4px 0 12px}.activity{border-inline-start:3px solid #b8c4bb;padding-inline-start:14px;margin-bottom:18px}ul{padding-inline-start:22px}li{margin:8px 0}.packing{list-style:none;padding:0}.link-address{display:block;font-size:12px;direction:ltr;unicode-bidi:embed}a{color:inherit}table{width:100%;border-collapse:collapse}th,td{text-align:start;border-bottom:1px solid #ddd;padding:8px;vertical-align:top}thead{display:table-header-group}tr{break-inside:avoid}footer{margin-top:28px;border-top:1px solid #ddd;padding-top:12px;font-size:12px}@page{size:auto;margin:16mm}@media print{body{padding:0;max-width:none;color:#000}a{text-decoration:none}h1{font-size:32px}}@media(max-width:500px){body{padding:20px}h1{font-size:32px}}
  </style></head><body><header><p class="meta">TripPlanner · ${label('Trip summary')}</p><h1>${escape(trip.destination)}</h1><p>${escape(trip.country)} · ${escape(date(trip.startDate))} — ${escape(date(trip.endDate))}</p><p class="meta">${label('Prepared on')}: ${escape(new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(generatedAt))} (${escape(timeZone)})</p></header>
  <section><h2>${label('Trip details')}</h2>${field('Accommodation', trip.accommodationName)}${field('Accommodation address', trip.accommodationAddress)}${field('Booking reference', trip.bookingReference)}${field('Notes', trip.notes)}${!trip.accommodationName && !trip.accommodationAddress && !trip.bookingReference && !trip.notes ? `<p>${label('No saved trip details.')}</p>` : ''}${links ? `<h3>${label('Useful links')}</h3><ul>${links}</ul>` : ''}</section>
  <section><h2>${label('Daily itinerary')}</h2>${activities.length ? [...groups].map(([day, items]) => `<h3>${escape(date(day))}</h3>${items.map(item => `<div class="activity"><strong>${escape(item.time.slice(0, 5))} · ${escape(item.title)}</strong>${field('Location', item.location)}${item.note ? `<p>${escape(item.note)}</p>` : ''}</div>`).join('')}`).join('') : `<p>${label('No activities saved.')}</p>`}</section>
  <section><h2>${label('Packing list')}</h2>${packing.length ? `<ul class="packing">${[...packing].sort((a,b) => a.category.localeCompare(b.category, language) || a.name.localeCompare(b.name, language)).map(item => `<li>${item.isPacked ? '☑' : '☐'} ${escape(item.name)} × ${escape(item.quantity)} — ${escape(item.category)} (${label(item.isPacked ? 'Packed' : 'Not packed')})</li>`).join('')}</ul>` : `<p>${label('No packing items saved.')}</p>`}</section>
  <section><h2>${label('Budget & expenses')}</h2><p>${label('Budget')}: ${money(budget.budgetAmount)} · ${label('Spent')}: ${money(budget.totalSpent)} · ${label('Remaining')}: ${money(budget.remaining)}</p>${budget.expenses.length ? `<table><thead><tr><th>${label('Date')}</th><th>${label('Description')}</th><th>${label('Category')}</th><th>${label('Amount')}</th></tr></thead><tbody>${[...budget.expenses].sort((a,b)=>a.date.localeCompare(b.date)).map(item => `<tr><td>${escape(date(item.date))}</td><td>${escape(item.description)}</td><td>${escape(item.category)}</td><td>${money(item.amount)}</td></tr>`).join('')}</tbody></table>` : `<p>${label('No expenses saved.')}</p>`}</section>
  <footer>${label('Saved snapshot. Later changes are not included.')} ${label('Activity times are shown as entered in the itinerary.')}</footer></body></html>`;
}

export function downloadTripSummary(html: string, tripId: number) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `wanderly-trip-${tripId}.html`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
