// Подключение к WebSocket серверу
const socket = io('https://localhost:3001');

// Элементы DOM
const contentDiv = document.getElementById('app-content');
const homeBtn = document.getElementById('home-btn');
const aboutBtn = document.getElementById('about-btn');

// Функция для преобразования VAPID ключа
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

// ВАШ ПУБЛИЧНЫЙ VAPID КЛЮЧ (из команды generate-vapid-keys)
const VAPID_PUBLIC_KEY = 'BG5xJ7yK9qW2rT4yU6i8O0pA1sD3fG5hJ7kL9zX2cV4bN6mQ8wE0rT2yU4i6O8';

// Функция подписки на push
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

// Функция отписки от push
async function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await fetch('http://localhost:3001/unsubscribe', {
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

// Навигация
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

// Работа с задачами
function loadTasks() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const list = document.getElementById('tasks-list');
    if (list) {
        list.innerHTML = tasks.map((task, index) => `<li>${escapeHtml(task)}</li>`).join('');
    }
}

function addTask(text) {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    tasks.push(text);
    localStorage.setItem('tasks', JSON.stringify(tasks));
    loadTasks();
    
    // Отправляем событие на сервер через WebSocket
    socket.emit('newTask', { text: text, timestamp: Date.now() });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function initNotes() {
    loadTasks();
    const form = document.getElementById('task-form');
    const input = document.getElementById('task-input');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (text) {
                addTask(text);
                input.value = '';
            }
        });
    }
}

// Обработчик получения задачи от сервера (от других клиентов)
socket.on('taskAdded', (task) => {
    console.log('Задача от другого клиента:', task);
    // Показываем всплывающее уведомление
    const notification = document.createElement('div');
    notification.textContent = `📝 Новая задача: ${task.text}`;
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
        animation: fadeInOut 3s ease;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
});

// Обработчики кнопок навигации
homeBtn.addEventListener('click', () => { setActiveButton('home-btn'); loadContent('home'); });
aboutBtn.addEventListener('click', () => { setActiveButton('about-btn'); loadContent('about'); });

// Загружаем главную страницу
loadContent('home');

// Регистрация Service Worker и настройка push-кнопок
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