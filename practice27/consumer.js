import amqplib from 'amqplib';

const QUEUE_NAME = 'task_queue';
const MAX_RETRIES = 3;
const WORKER_ID = Math.floor(Math.random() * 1000);

async function processTask(task) {
  console.log(`[${WORKER_ID}] Начало: ${task.id} (${task.type})`);
  
  // Имитация работы
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 30% ошибок для теста retry
  if (Math.random() < 0.3) {
    throw new Error('Случайная ошибка обработки');
  }
  
  console.log(`[${WORKER_ID}] Завершено: ${task.id}`);
}

async function start() {
  try {
    const connection = await amqplib.connect('amqp://localhost');
    const channel = await connection.createChannel();
    
    // Просто подключаемся к очереди, НЕ создаём
    await channel.prefetch(1);
    
    console.log(`[${WORKER_ID}] Ожидание задач...`);
    
    channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;
      
      const task = JSON.parse(msg.content.toString());
      let attempt = 0;
      let success = false;
      
      while (attempt < MAX_RETRIES && !success) {
        try {
          await processTask(task);
          channel.ack(msg);
          console.log(`[${WORKER_ID}] Успех с ${attempt + 1} попытки`);
          success = true;
        } catch (err) {
          attempt++;
          if (attempt < MAX_RETRIES) {
            const delay = 1000 * Math.pow(2, attempt - 1);
            console.log(`[${WORKER_ID}] Попытка ${attempt}/${MAX_RETRIES} провалилась, повтор через ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
          } else {
            console.error(`[${WORKER_ID}] Все попытки исчерпаны, в DLQ`);
            channel.nack(msg, false, false);
          }
        }
      }
    });
  } catch (err) {
    console.error(`[${WORKER_ID}] Ошибка:`, err.message);
    console.error('Убедитесь, что RabbitMQ запущен и вы выполнили npm run setup');
  }
}

start();