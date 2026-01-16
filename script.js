// ==========================================
// 1. تهيئة Firebase والإعدادات
// ==========================================
if (!window.APP_CONFIG) alert("خطأ: ملف config.js مفقود!");

firebase.initializeApp(window.APP_CONFIG.firebase);
const database = firebase.database();
const messaging = firebase.messaging();

// متغيرات عامة
const ADMIN_PIN = "1972"; 
let db = JSON.parse(localStorage.getItem('noorHusseinDB')) || { customers: [] }; // للأدمن المحلي فقط
let activeCustomer = null;
let currentCart = [];
let deferredPrompt; // لتخزين حدث التثبيت

// ==========================================
// 2. دورة حياة التطبيق (PWA Install & Init)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    checkPWAInstallation();
});

// تسجيل Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
    .then((reg) => console.log('SW Registered', reg))
    .catch((err) => console.log('SW Failed', err));
}

// منطق التثبيت (Android/PC)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('install-banner');
    if(banner) banner.style.display = 'block';
});

document.getElementById('installBtn')?.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            deferredPrompt = null;
            document.getElementById('install-banner').style.display = 'none';
        }
    }
});

// منطق التثبيت (iOS)
function checkPWAInstallation() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (isIOS && !isStandalone) {
        // عرض تعليمات iOS مرة واحدة فقط في الجلسة
        if (!sessionStorage.getItem('iosPromptShown')) {
            document.getElementById('ios-install-modal').style.display = 'block';
            sessionStorage.setItem('iosPromptShown', 'true');
        }
    }
}

// ==========================================
// 3. نظام الإشعارات (FCM)
// ==========================================
function updateNotifyButtonUI(granted) {
    const btn = document.getElementById('notify-btn');
    if (!btn) return;
    
    btn.style.display = 'inline-block';
    if (granted) {
        btn.innerHTML = '<i class="fas fa-bell"></i> الإشعارات مفعلة';
        btn.style.background = '#27ae60';
        btn.onclick = null; // تعطيل الزر
    } else {
        btn.innerHTML = '<i class="fas fa-bell-slash"></i> تفعيل الإشعارات';
        btn.style.background = '#e74c3c';
        btn.onclick = requestNotificationPermission;
    }
}

async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await messaging.getToken({ vapidKey: window.APP_CONFIG.vapidKey });
            if (token) {
                console.log('FCM Token:', token);
                saveTokenToDatabase(token);
                updateNotifyButtonUI(true);
            }
        } else {
            alert("يجب السماح بالإشعارات لتلقي التنبيهات.");
        }
    } catch (error) {
        console.error("Error getting permission/token:", error);
    }
}

function saveTokenToDatabase(token) {
    // نحفظ التوكن مرتبطاً بكود الزبون الحالي
    const customerCode = localStorage.getItem('currentCustomerCode');
    if (customerCode) {
        const tokenRef = database.ref(`tokens/${customerCode}/${token.replaceAll('.', '_')}`); // استبدال النقاط لأنها ممنوعة في مفاتيح Firebase
        tokenRef.set(true);
    }
}

// ==========================================
// 4. منطق التطبيق (Navigation & Login)
// ==========================================
function initApp() {
    hideAllScreens();
    const urlParams = new URLSearchParams(window.location.search);
    
    // فحص إذا كان التطبيق مفتوح عبر إشعار
    if (urlParams.get('customerCode')) {
        const code = urlParams.get('customerCode');
        document.getElementById('clientCodeInput').value = code;
        checkClientLoginFirebase(code);
    } else {
        showScreen('screen-client-login'); // الافتراضي صفحة دخول الزبون
    }
}

function showScreen(screenId) {
    hideAllScreens();
    document.getElementById(screenId).classList.add('active-screen');
}

function hideAllScreens() {
    document.querySelectorAll('.app-section').forEach(el => el.classList.remove('active-screen'));
}

// ------------------------------------------
// تسجيل دخول الزبون (Firebase)
// ------------------------------------------
function checkClientLoginFirebase(autoCode = null) {
    const codeInput = document.getElementById('clientCodeInput');
    const code = autoCode || codeInput.value.trim();

    if (!code) return alert("الرجاء إدخال الكود");

    const loadingDiv = document.getElementById('cvTransList');
    loadingDiv.innerHTML = '<p style="text-align:center;">جاري الاتصال...</p>';

    // قراءة البيانات من Firebase
    database.ref('customers/' + code).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                localStorage.setItem('currentCustomerCode', code); // تخزين الكود للجلسة
                showScreen('screen-client-view');
                fillClientViewData(data);
                
                // التحقق من حالة الإشعارات
                if (Notification.permission === 'granted') {
                    updateNotifyButtonUI(true);
                    // تحديث التوكن لضمان وصوله
                    messaging.getToken({ vapidKey: window.APP_CONFIG.vapidKey }).then(saveTokenToDatabase);
                } else {
                    updateNotifyButtonUI(false);
                }

            } else {
                alert("كود الزبون غير صحيح أو غير موجود.");
                showScreen('screen-client-login');
            }
        })
        .catch((error) => {
            console.error(error);
            alert("حدث خطأ في الاتصال، تأكد من الإنترنت.");
        });
}

function fillClientViewData(c) {
    document.getElementById('cvName').innerText = c.name;
    const debt = (c.totalSales || 0) - (c.totalPaid || 0);
    
    document.getElementById('cvSales').innerText = (c.totalSales || 0).toLocaleString();
    document.getElementById('cvPaid').innerText = (c.totalPaid || 0).toLocaleString();
    document.getElementById('cvDebt').innerText = debt.toLocaleString();

    const list = document.getElementById('cvTransList');
    list.innerHTML = '';
    
    // التعامل مع object بدل array في Firebase
    const transactions = c.transactions ? Object.values(c.transactions) : [];
    
    transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(t => {
        let details = '';
        if (t.type === 'sale' && t.items) {
            details = `<div style="font-size:11px; color:#666; margin-top:4px;">${t.items.map(i => i.name).join(' + ')}</div>`;
        }
        
        list.innerHTML += `
            <div style="background:white; padding:12px; border-bottom:1px solid #eee; margin-bottom:5px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight:bold; color:${t.type === 'sale' ? '#c0392b' : '#27ae60'}">
                        ${t.type === 'sale' ? '<i class="fas fa-file-invoice"></i> فاتورة' : '<i class="fas fa-money-bill-wave"></i> تسديد'}
                    </div>
                    <div style="font-weight:bold; font-size:1.1rem;">${t.amount.toLocaleString()}</div>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:5px;">
                     <div style="font-size:11px; color:#999;">${t.date}</div>
                </div>
                ${details}
            </div>
        `;
    });
}

// ------------------------------------------
// منطق الأدمن (محلي + يمكن ربطه بفايربيس مستقبلاً)
// ------------------------------------------
function checkAdminLogin() {
    const pin = document.getElementById('adminPinInput').value;
    if (pin === ADMIN_PIN) {
        showScreen('screen-admin-app');
        // هنا يمكنك إضافة كود لمزامنة البيانات المحلية مع فايربيس إذا أردت
        renderCustomerList();
    } else {
        alert("الرمز خطأ");
    }
}

// (بقية دوال الأدمن renderCustomerList, switchTab ... تبقى كما هي ولكن يجب الانتباه أن الأدمن حالياً يعمل على LocalStorage بينما الزبون يقرأ من Firebase. 
// لتوحيد النظام، يجب تعديل دوال الأدمن لتكتب في Firebase بدلاً من LocalStorage. سأضيف دالة مثال للإضافة)

// مثال لتعديل دالة إضافة زبون لتكتب في Firebase (اختياري لكن مفيد للنظام المتكامل)
function confirmAddCustomer() {
    const name = document.getElementById('newCName').value;
    const phone = document.getElementById('newCPhone').value;
    
    if (!name) return alert("الاسم مطلوب");

    // إنشاء كود عشوائي للزبون
    const customerCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newC = {
        code: customerCode,
        name: name,
        phone: phone,
        totalSales: 0,
        totalPaid: 0,
        createdAt: new Date().toISOString()
    };

    // حفظ في LocalStorage للأدمن
    newC.id = Date.now(); // للإبقاء على توافق الكود القديم
    newC.transactions = []; 
    db.customers.push(newC);
    localStorage.setItem('noorHusseinDB', JSON.stringify(db));

    // **حفظ في Firebase لكي يستطيع الزبون الدخول**
    // ملاحظة: هذا يتطلب تسجيل دخول الأدمن بـ Firebase Auth في المستقبل، لكن حالياً سنفترض القواعد مفتوحة للأدمن
    database.ref('customers/' + customerCode).set(newC)
    .then(() => {
        alert(`تمت الإضافة! كود الزبون هو: ${customerCode}`);
        closeAddCustomerModal();
        renderCustomerList();
    })
    .catch(err => alert("خطأ في المزامنة: " + err.message));
}
