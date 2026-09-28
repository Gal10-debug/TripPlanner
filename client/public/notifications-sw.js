self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data?.url;
  if (typeof path !== 'string' || !/^\/trips\/\d+$/.test(path)) return;
  event.waitUntil(self.clients.openWindow(new URL(path, self.location.origin).href));
});
