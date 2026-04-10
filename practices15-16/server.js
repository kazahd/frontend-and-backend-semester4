const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const vapidKeys = {
    publicKey: 'BE8p3mWaac6cvEsXioVR9SRgDK7f3gAjEOv2kvOmgTrGnEJiCkW4u8dOU4DqFDtq7od7Ijd3XyfGjGFGmg9RJDY',
    privateKey: 'dhoc7hvSjjBIkwHnVKWudjYRM-V8d0Xx1Z72bFgJjoU'
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

// Хранилище подписок
let subscriptions = [];

// Загрузка сертификатов (из корневой папки, где лежат localhost.pem)
const options = {
    key: fs.readFileSync(path.join(__dirname, '../localhost-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '../localhost.pem'))
};

const server = https.createServer(options, app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Клиент подключён:', socket.id);

    // Обработка события 'newTask' от клиента
    socket.on('newTask', (task) => {
        console.log('Новая задача:', task);
        
        // Рассылаем событие всем подключённым клиентам
        io.emit('taskAdded', task);
        
        // Формируем payload для push-уведомления
        const payload = JSON.stringify({
            title: 'Новая задача',
            body: task.text
        });
        
        // Отправляем уведомление всем подписанным клиентам
        subscriptions.forEach(sub => {
            webpush.sendNotification(sub, payload).catch(err => {
                console.error('Push error:', err);
            });
        });
    });
    
    socket.on('disconnect', () => {
        console.log('Клиент отключён:', socket.id);
    });
});

// Эндпоинт для сохранения push-подписки
app.post('/subscribe', (req, res) => {
    subscriptions.push(req.body);
    res.status(201).json({ message: 'Подписка сохранена' });
    console.log('Всего подписок:', subscriptions.length);
});

// Эндпоинт для удаления push-подписки
app.post('/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
    res.status(200).json({ message: 'Подписка удалена' });
    console.log('Всего подписок:', subscriptions.length);
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`HTTPS сервер запущен на https://localhost:${PORT}`);
});