import { notificationPreferences, type NotificationPreferences } from '../services/notificationPreferences';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../i18n/preferences';

type Notice = { id: number; tripId: number; title: string; destination: string; dueDate: string; isRead: boolean; isAutomatic: boolean; emailStatus?: string };
async function request(path = '', method = 'GET'): Promise<Notice[]> {
  const response = await fetch(`/api/notifications${path}`, { method, credentials: 'include' });
  if (!response.ok) throw new Error('Unable to load notifications. Please try again.');
  return method === 'GET' ? response.json() : [];
}
const Context = createContext<{
  preferences: NotificationPreferences | null; preferencesBusy: boolean; preferencesError: string;
  saveEmail: (enabled: boolean) => Promise<void>; loadPreferences: () => Promise<void>;
  items: Notice[]; loading: boolean; error: string; refresh: () => Promise<void>;
  read: (id?: number) => Promise<void>; enable: (allowOnDevice?: boolean) => Promise<void>; enabled: boolean; browserError: string;
} | null>(null);
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null);
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const [preferencesError, setPreferencesError] = useState('');
  const enabled = preferences?.browserNotifications === true && 'Notification' in window && Notification.permission === 'granted';
  async function loadPreferences() {
    setPreferencesBusy(true);
    try { setNotificationPreferences(await notificationPreferences()); setPreferencesError(''); }
    catch { setPreferencesError('Unable to load or save notification preferences. Please try again.'); }
    finally { setPreferencesBusy(false); }
  }
  async function savePreference(changes: Partial<NotificationPreferences>) {
    if (!preferences || preferencesBusy) return;
    setPreferencesBusy(true);
    try {
      setNotificationPreferences(await notificationPreferences({ emailReminders: preferences.emailReminders, browserNotifications: preferences.browserNotifications, ...changes }));
      setPreferencesError('');
    } catch { setPreferencesError('Unable to load or save notification preferences. Please try again.'); }
    finally { setPreferencesBusy(false); }
  }
  async function saveEmail(emailReminders: boolean) { await savePreference({ emailReminders }); }
  useEffect(() => {
    let active = true;
    notificationPreferences().then(value => { if (active) setNotificationPreferences(value); })
      .catch(() => { if (active) setPreferencesError('Unable to load or save notification preferences. Please try again.'); });
    return () => { active = false; };
  }, []);
  const [browserError, setBrowserError] = useState('');
  async function refresh() {
    try { setItems(await request()); setError(''); }
    catch { setError('Unable to load notifications. Please try again.'); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    async function poll() {
      try { const notices = await request(); if (active) { setItems(notices); setError(''); } }
      catch { if (active) setError('Unable to load notifications. Please try again.'); }
      finally { if (active) setLoading(false); }
    }
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        await navigator.serviceWorker.register('/notifications-sw.js');
        const registration = await navigator.serviceWorker.ready;
        for (const item of items.filter(item => !item.isRead)) {
          if (cancelled) return;
          // An origin-wide Web Lock prevents duplicate alerts across open tabs.
          await navigator.locks.request(`wanderly-notification-${item.id}`, async () => {
            const key = `wanderly-notification-${item.id}`;
            if (cancelled || localStorage.getItem(key)) return;
            await registration.showNotification(t('Trip reminder'), {
              body: `${item.destination}: ${item.isAutomatic ? t(item.title) : item.title}`,
              tag: key, data: { url: `/trips/${item.tripId}` },
            });
            localStorage.setItem(key, 'shown');
          });
        }
      } catch { if (!cancelled) setBrowserError('Browser alerts could not be shown. Check your browser permissions.'); }
    })();
    return () => { cancelled = true; };
  }, [enabled, items]);
  async function enable(allowOnDevice = false) {
    if (preferences?.browserNotifications && !allowOnDevice) { await savePreference({ browserNotifications: false }); return; }
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !navigator.locks) throw new Error();
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error();
      await navigator.serviceWorker.register('/notifications-sw.js');
      await savePreference({ browserNotifications: true }); setBrowserError('');
    } catch { setBrowserError('Browser alerts could not be enabled. Check browser support and permissions.'); }
  }
  async function read(id?: number) {
    try {
      await request(id === undefined ? '/read-all' : `/${id}/read`, 'PUT');
      setItems(current => current.map(item => id === undefined || item.id === id ? { ...item, isRead: true } : item));
      setError('');
    } catch { setError('Unable to update notifications. Please try again.'); }
  }
  return <Context.Provider value={{ preferences, preferencesBusy, preferencesError, saveEmail, loadPreferences, items, loading, error, refresh, read, enable, enabled, browserError }}>{children}</Context.Provider>;
}
export function NotificationLink() {
  const state = useContext(Context)!;
  const count = state.items.filter(item => !item.isRead).length;
  return <Link className="notification-link" to="/notifications">{`${t('Notifications')}${count > 0 ? ` (${count})` : ''}`}</Link>;
}
export default function NotificationsPage() {
  const state = useContext(Context)!;
  return <section>
    <div className="dashboard-intro"><span className="eyebrow">{t('My journeys')}</span><h1>{t('Notifications')}</h1><p>{t('Due reminders from your trips, all in one place.')}</p></div>
    <div className="notification-controls">
      <button className="button button--ghost" disabled={!state.preferences || state.preferencesBusy} onClick={() => void state.enable()}>{t(state.preferences?.browserNotifications ? 'Turn off browser alerts' : 'Enable browser alerts')}</button>
      {state.preferences?.browserNotifications && !state.enabled && <button className="button button--ghost" disabled={state.preferencesBusy} onClick={() => void state.enable(true)}>{t('Allow browser alerts on this device')}</button>}
      <p>{t('Browser preference is saved to your account. Allow alerts on each device; Wanderly must remain open.')}</p>
      {!state.preferences && !state.preferencesError && <p role="status">{t('Loading notification preferences…')}</p>}
      {state.preferences && <label className="notification-email-option"><input type="checkbox" checked={state.preferences.emailReminders} disabled={state.preferencesBusy || (!state.preferences.emailAvailable && !state.preferences.emailReminders)} onChange={event => void state.saveEmail(event.target.checked)} />{t('Email me new due reminders')}</label>}
      <p>{t('Email reminders apply to notifications created after you opt in. Your in-app notification center remains available.')}</p>
      {state.preferences && !state.preferences.emailAvailable && <p>{t('Email reminders are not configured on this server yet.')}</p>}
      {state.preferencesError && <div role="alert"><p>{t(state.preferencesError)}</p><button className="button button--ghost" onClick={() => void state.loadPreferences()}>{t('Retry notification preferences')}</button></div>}
      {state.browserError && <p role="alert">{t(state.browserError)}</p>}
      <button className="button button--ghost" disabled={!state.items.some(item => !item.isRead)} onClick={() => void state.read()}>{t('Mark all as read')}</button>
    </div>
    {state.error && <div role="alert"><p>{t(state.error)}</p><button className="button" onClick={() => void state.refresh()}>{t('Retry')}</button></div>}
    {state.loading ? <p role="status">{t('Loading notifications…')}</p> : state.items.length === 0 && !state.error ? <p>{t('No notifications yet. Due trip reminders will appear here.')}</p> :
      <ul className="notification-list">{state.items.map(item => <li key={item.id} className={item.isRead ? '' : 'notification-unread'}>
        <div><Link to={`/trips/${item.tripId}`}>{item.destination}</Link><p>{item.isAutomatic ? t(item.title) : item.title}</p><time dateTime={item.dueDate}>{item.dueDate}</time>{item.emailStatus === 'sent' && <p>{t('Email sent')}</p>}{item.emailStatus === 'pending' && <p>{t('Email queued')}</p>}{item.emailStatus === 'failed' && <p>{t('Email delivery failed. Please use this reminder in the app.')}</p>}</div>
        {!item.isRead && <button className="button button--ghost" onClick={() => void state.read(item.id)}>{t('Mark as read')}</button>}
      </li>)}</ul>}
  </section>;
}
