const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const vapidKeys = {
    publicKey: 'BI00wNa3V7sBmupdRysmDW7IF2h2GtFLrQkRishmsDsUQVUpW5bLTgQwVZf-PYKY9pO0DdcldJD7GZeCd_2K1jw',
    privateKey: '3gpTJBL8xlLLKG1hSNwHtHikGoxUTYCz-GjqVklTmUk'
};

webpush.setVapidDetails(
    'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './')));

let subscriptions = [];
const reminders = new Map();

const options = {
    key: fs.readFileSync(path.join(__dirname, '../localhost-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '../localhost.pem'))
};

const server = https.createServer(options, app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    console.log('Клиент подключён:', socket.id);

    socket.on('newTask', (task) => {
        console.log('Новая задача:', task);
        io.emit('taskAdded', task);
        
        const payload = JSON.stringify({ title: 'Новая задача', body: task.text });
        subscriptions.forEach(sub => {
            webpush.sendNotification(sub, payload).catch(err => console.error('Push error:', err));
        });
    });
    
    socket.on('newReminder', (reminder) => {
        const { id, text, reminderTime } = reminder;
        const delay = reminderTime - Date.now();
        
        console.log(`Новое напоминание: ID=${id}, текст="${text}", через ${Math.round(delay / 1000)} сек`);
        
        if (delay <= 0) {
            console.log('Время напоминания уже прошло');
            return;
        }
        
        const timeoutId = setTimeout(() => {
            console.log(`Отправка напоминания: ID=${id}, текст="${text}"`);
            
            const payload = JSON.stringify({
                title: 'Напоминание',
                body: text,
                reminderId: id
            });
            
            console.log(`Отправка push ${subscriptions.length} подписчикам`);
            subscriptions.forEach(sub => {
                webpush.sendNotification(sub, payload).catch(err => console.error('Push error:', err));
            });
            
            reminders.delete(id);
        }, delay);
        
        reminders.set(id, { timeoutId, text, reminderTime });
        console.log(`Сохранено в reminders. Всего: ${reminders.size}`);
        console.log('Ключи reminders:', Array.from(reminders.keys()));
        
        const confirmPayload = JSON.stringify({
            title: 'Напоминание создано',
            body: `"${text}" на ${new Date(reminderTime).toLocaleString()}`,
            reminderId: null
        });
        
        subscriptions.forEach(sub => {
            webpush.sendNotification(sub, confirmPayload).catch(err => console.error('Push error:', err));
        });
    });
    
    socket.on('disconnect', () => {
        console.log('Клиент отключён:', socket.id);
    });
});

app.post('/subscribe', (req, res) => {
    const sub = req.body;
    if (!subscriptions.some(s => s.endpoint === sub.endpoint)) {
        subscriptions.push(sub);
    }
    res.status(201).json({ message: 'Подписка сохранена' });
    console.log('Всего подписок:', subscriptions.length);
});

app.post('/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
    res.status(200).json({ message: 'Подписка удалена' });
    console.log('Всего подписок:', subscriptions.length);
});

app.post('/snooze', (req, res) => {
    const reminderId = req.query.reminderId;
    console.log('=== POST /snooze ===');
    console.log('Получен reminderId:', reminderId);
    console.log('Тип reminderId:', typeof reminderId);
    console.log('Ключи reminders:', Array.from(reminders.keys()));
    
    if (!reminderId) {
        console.log('Нет reminderId');
        return res.status(400).json({ error: 'No reminderId' });
    }
    
    let foundReminder = null;
    let foundKey = null;
    
    for (const [key, value] of reminders) {
        if (String(key) === String(reminderId)) {
            foundReminder = value;
            foundKey = key;
            break;
        }
    }
    
    if (!foundReminder) {
        console.log('Reminder not found');
        return res.status(400).json({ error: 'Reminder not found' });
    }
    
    console.log('Найдено напоминание:', foundReminder);
    
    clearTimeout(foundReminder.timeoutId);
    
    const newDelay = 5 * 60 * 1000;
    const newTimeoutId = setTimeout(() => {
        console.log(`Отправка отложенного напоминания: "${foundReminder.text}"`);
        
        const payload = JSON.stringify({
            title: 'Напоминание (отложено)',
            body: foundReminder.text,
            reminderId: foundKey
        });
        
        subscriptions.forEach(sub => {
            webpush.sendNotification(sub, payload).catch(err => console.error('Push error:', err));
        });
        
        reminders.delete(foundKey);
    }, newDelay);
    
    const newReminderTime = Date.now() + newDelay;
    
    reminders.set(foundKey, {
        timeoutId: newTimeoutId,
        text: foundReminder.text,
        reminderTime: newReminderTime
    });
    
    const snoozePayload = JSON.stringify({
        title: 'Напоминание отложено',
        body: `"${foundReminder.text}" на 5 минут (до ${new Date(newReminderTime).toLocaleTimeString()})`,
        reminderId: null
    });
    
    console.log('Отправка уведомления об откладывании...');
    subscriptions.forEach(sub => {
        webpush.sendNotification(sub, snoozePayload).catch(err => console.error('Push error:', err));
    });
    
    console.log(`Напоминание "${foundReminder.text}" отложено на 5 минут`);
    res.status(200).json({ message: 'Reminder snoozed for 5 minutes' });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`HTTPS сервер запущен на https://localhost:${PORT}`);
});