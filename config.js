// config.js
window.APP_CONFIG = {
    appName: "نور الحسين",
    appIcon: "icon.png", // تأكد من وجود أيقونة بهذا الاسم
    
    // إعدادات Firebase (احصل عليها من Console -> Project Settings)
    firebase: {
        apiKey: "AIzaSyDxxxx...",
        authDomain: "your-project.firebaseapp.com",
        databaseURL: "https://your-project-default-rtdb.firebaseio.com",
        projectId: "your-project",
        storageBucket: "your-project.appspot.com",
        messagingSenderId: "123456789",
        appId: "1:123456789:web:xxxxxx"
    },

    // مفتاح VAPID للإشعارات (من Console -> Cloud Messaging -> Web Push certificates)
    vapidKey: "BKagOny0J_xxxx..." 
};
