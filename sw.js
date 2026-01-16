// استيراد سكربتات Firebase الضرورية داخل الـ Worker
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');
// استيراد ملف الإعدادات للوصول للمفاتيح
importScripts('config.js');

// 1. إعداد Firebase داخل الـ SW
firebase.initializeApp(window.APP_CONFIG.firebase);
const messaging = firebase.messaging();

// التعامل مع الرسائل في الخلفية
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: window.APP_CONFIG.appIcon,
    data: payload.data // البيانات الإضافية (مثل الرابط)
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 2. إعدادات الكاش (Logic القديم)
const CACHE_NAME = 'noor-hussein-v3'; // قم بزيادة الرقم لتحديث الكاش عند الزبائن
const ASSETS = [
    './', 
    './index.html', 
    './style.css', 
    './script.js', 
    './config.js',
    './manifest.json'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim()); // السيطرة الفورية
});

self.addEventListener('fetch', (e) => {
    // استثناء طلبات Firebase من الكاش لضمان وصول البيانات الحديثة
    if (e.request.url.includes('firebase') || e.request.url.includes('googleapis')) {
        return; 
    }
    e.respondWith(caches.match(e.request).then((response) => response || fetch(e.request)));
});

// 3. النقر على الإشعار
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // استخراج الرابط من البيانات المرسلة
  let url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/index.html';

  event.waitUntil(
    clients.matchAll({type: 'window'}).then( windowClients => {
      // إذا كان التطبيق مفتوحاً، انتقل إليه
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // إذا لم يكن مفتوحاً، افتحه
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
