import express from 'express';
import amqplib from 'amqplib';

const app = express();
app.use(express.json());

const QUEUE_NAME = 'task_queue';

app.post('/tasks', async (req, res) => {
  const { type, payload } = req.body;
  
  if (!type || !payload) {
    return res.status(400).json({ error: 'type и payload обязательны' });
  }
  
  const task = {
    id: Date.now().toString(),
    type,
    payload,
    createdAt: new Date().toISOString()
  };
  
  try {
    const connection = await amqplib.connect('amqp://localhost');
    const channel = await connection.createChannel();
    
    // УБИРАЕМ assertQueue - очередь уже создана setup-скриптом!
    // Просто отправляем сообщение
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(task)), { 
      persistent: true 
    });
    
    console.log(`Отправлено: ${task.id}`);
    
    // Закрываем через небольшую задержку
    setTimeout(() => {
      channel.close();
      connection.close();
    }, 100);
    
    res.json({ message: 'Задача принята', taskId: task.id });
  } catch (err) {
    console.error('Ошибка:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log('Producer на http://localhost:3000');
  console.log('POST /tasks - добавить задачу');
});