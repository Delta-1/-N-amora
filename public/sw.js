// Never cache authenticated pages, API responses, coordinates or chat content.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window'}).then(clients=>{const found=clients.find(c=>new URL(c.url).origin===self.location.origin);return found?found.focus():self.clients.openWindow('/');}));});
