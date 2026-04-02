// Элементы DOM
const form = document.getElementById('task-form');
const input = document.getElementById('task-input');
const list = document.getElementById('tasks-list');

// Загрузка задач из localStorage при старте
function loadTasks() {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    list.innerHTML = tasks.map(task => `<li>${escapeHtml(task)}</li>`).join('');
}

// Сохранение новой задачи
function addTask(text) {
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    tasks.push(text);
    localStorage.setItem('tasks', JSON.stringify(tasks));
    loadTasks();
}

// Простая защита от XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Обработка отправки формы
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
        addTask(text);
        input.value = '';
    }
});

// Первоначальная загрузка
loadTasks();

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('ServiceWorker зарегистрирован:', registration.scope);
        } catch (err) {
            console.error('Ошибка регистрации ServiceWorker:', err);
        }
    });
}