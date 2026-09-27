export interface NotificationPreferences {
  emailReminders: boolean;
  browserNotifications: boolean;
  emailAvailable: boolean;
}
export async function notificationPreferences(value?: Pick<NotificationPreferences, 'emailReminders' | 'browserNotifications'>): Promise<NotificationPreferences> {
  const response = await fetch('/api/notifications/preferences', {
    credentials: 'include', method: value ? 'PUT' : 'GET',
    ...(value ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) } : {}),
  });
  if (!response.ok) throw new Error('Unable to load or save notification preferences. Please try again.');
  return response.json();
}
