const socket = io('https://localhost:3001');

const contentDiv = document.getElementById('app-content');
const homeBtn = document.getElementById('home-btn');
const aboutBtn = document.getElementById('about-btn');

const VAPID_PUBLIC_KEY = 'BI00wNa3V7sBmupdRysmDW7IF2h2GtFLrQkRishmsDsUQVUpW5bLTgQwVZf-PYKY9pO0DdcldJD7GZeCd_2K1jw';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push не поддерживается');
        return;
    }
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        await fetch('https://localhost:3001/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });
        console.log('Подписка на push отправлена');
    } catch (err) {
        console.error('Ошибка подписки на push:', err);
    }
}

async function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await fetch('https://localhost:3001/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: subscription.endpoint })
            });
            await subscription.unsubscribe();
            console.log('Отписка выполнена');
        }
    } catch (err) {
        console.error('Ошибка отписки:', err);
    }
}

function setActiveButton(activeId) {
    [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
    document.getElementById(activeId).classList.add('active');
}

async function loadContent(page) {
    try {
        const response = await fetch(`/content/${page}.html`);
        const html = await response.text();
        contentDiv.innerHTML = html;
        if (page === 'home') initNotes();
    } catch (err) {
        contentDiv.innerHTML = '<p class="is-center">Ошибка загрузки</p>';
    }
}

function generateId() {
    return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function loadNotes() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const list = document.getElementById('notes-list');
    if (list) {
        list.innerHTML = notes.map(note => {
            let reminderInfo = '';
            if (note.reminder) {
                const date = new Date(note.reminder);
                reminderInfo = `<br><small style="color: #888;">Напоминание: ${date.toLocaleString()}</small>`;
            }
            return `<li style="margin-bottom: 8px; padding: 10px; background-color: #f9f9f9; border-radius: 4px; border-left: 4px solid #999;">
                        ${escapeHtml(note.text)}${reminderInfo}
                    </li>`;
        }).join('');
    }
}

function addNote(text) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const newNote = { 
        id: generateId(), 
        text: text, 
        reminder: null 
    };
    notes.push(newNote);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
    socket.emit('newTask', { text: text, timestamp: Date.now() });
}

function addReminder(text, reminderTime) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const newNote = { 
        id: generateId(), 
        text: text, 
        reminder: reminderTime 
    };
    notes.push(newNote);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
    socket.emit('newReminder', { 
        id: newNote.id, 
        text: text, 
        reminderTime: reminderTime 
    });
    console.log(`Напоминание запланировано на ${new Date(reminderTime).toLocaleString()}`);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function initNotes() {
    loadNotes();
    
    const form = document.getElementById('note-form');
    const input = document.getElementById('note-input');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (text) {
                addNote(text);
                input.value = '';
            }
        });
    }
    
    const reminderForm = document.getElementById('reminder-form');
    const reminderText = document.getElementById('reminder-text');
    const reminderTime = document.getElementById('reminder-time');
    if (reminderForm) {
        reminderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = reminderText.value.trim();
            const time = reminderTime.value;
            if (text && time) {
                const timestamp = new Date(time).getTime();
                if (timestamp > Date.now()) {
                    addReminder(text, timestamp);
                    reminderText.value = '';
                    reminderTime.value = '';
                } else {
                    alert('Дата и время должны быть в будущем');
                }
            } else {
                alert('Заполните оба поля');
            }
        });
    }
}

socket.on('taskAdded', (task) => {
    console.log('Задача от другого клиента:', task);
    const notification = document.createElement('div');
    notification.textContent = `Новая задача: ${task.text}`;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #555;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
});

homeBtn.addEventListener('click', () => { setActiveButton('home-btn'); loadContent('home'); });
aboutBtn.addEventListener('click', () => { setActiveButton('about-btn'); loadContent('about'); });

loadContent('home');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            console.log('ServiceWorker зарегистрирован');
            
            const enableBtn = document.getElementById('enable-push');
            const disableBtn = document.getElementById('disable-push');
            
            if (enableBtn && disableBtn) {
                const subscription = await reg.pushManager.getSubscription();
                if (subscription) {
                    enableBtn.style.display = 'none';
                    disableBtn.style.display = 'inline-block';
                }
                
                enableBtn.addEventListener('click', async () => {
                    if (Notification.permission === 'denied') {
                        alert('Уведомления запрещены. Разрешите их в настройках браузера.');
                        return;
                    }
                    if (Notification.permission === 'default') {
                        const permission = await Notification.requestPermission();
                        if (permission !== 'granted') {
                            alert('Необходимо разрешить уведомления.');
                            return;
                        }
                    }
                    await subscribeToPush();
                    enableBtn.style.display = 'none';
                    disableBtn.style.display = 'inline-block';
                });
                
                disableBtn.addEventListener('click', async () => {
                    await unsubscribeFromPush();
                    disableBtn.style.display = 'none';
                    enableBtn.style.display = 'inline-block';
                });
            }
        } catch (err) {
            console.error('Ошибка регистрации ServiceWorker:', err);
        }
    });
}