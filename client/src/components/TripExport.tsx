import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n/preferences';
import { loadTripSummary } from '../services/exportServices';
import { downloadTripSummary, tripSummaryHtml } from '../utils/tripExport';

export default function TripExport({ tripId }: { tripId: number }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, [tripId]);
  async function prepare() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setHtml(''); setReady(false); setError('');
    const timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      const summary = await loadTripSummary(tripId, controller.signal);
      if (!controller.signal.aborted) setHtml(tripSummaryHtml(summary));
    } catch {
      if (request.current === controller) setError('Unable to prepare the trip summary. Please try again.');
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) setLoading(false);
    }
  }
  function close() { request.current?.abort(); request.current = null; setHtml(''); setLoading(false); setError(''); setReady(false); }
  function print() {
    try {
      if (!frame.current?.contentWindow) throw new Error();
      frame.current.contentWindow.focus();
      frame.current.contentWindow.print();
    } catch { setError('Unable to open printing. Download the summary and print it from your browser.'); }
  }
  return <section className="trip-export" aria-label={t('Export and print')}>
    <div className="export-actions"><button className="button button--ghost" onClick={() => void prepare()} disabled={loading}>{t(html ? 'Refresh summary' : 'Prepare trip summary')}</button>{(html || loading) && <button className="text-action" onClick={close}>{t('Close summary')}</button>}</div>
    {loading && <p role="status">{t('Preparing your trip summary…')}</p>}
    {error && <p role="alert">{t(error)}</p>}
    {html && <><p>{t('Download an offline HTML copy, or print and choose Save as PDF in your browser.')}</p><p>{t('Saved snapshot. Later changes are not included.')}</p><div className="export-actions"><button className="button" disabled={!ready} onClick={print}>{t('Print / Save as PDF')}</button><button className="button button--ghost" onClick={() => downloadTripSummary(html, tripId)}>{t('Download summary')}</button></div><iframe ref={frame} className="trip-export__preview" title={t('Trip summary preview')} srcDoc={html} sandbox="allow-same-origin allow-modals" onLoad={() => setReady(true)} /></>}
  </section>;
}
