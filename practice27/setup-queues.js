import amqplib from 'amqplib';

async function setupQueues() {
  console.log('Настройка очередей...');
  
  const connection = await amqplib.connect('amqp://localhost');
  const channel = await connection.createChannel();

  // Удаляем всё, что было
  try { await channel.deleteQueue('task_queue'); console.log('✓ Удалена старая очередь'); } catch(e) { console.log('✓ Очередь не существовала'); }
  try { await channel.deleteQueue('dead_letter_queue'); console.log('✓ Удалена старая DLQ'); } catch(e) { console.log('✓ DLQ не существовала'); }
  try { await channel.deleteExchange('dlx_exchange'); console.log('✓ Удален старый exchange'); } catch(e) { console.log('✓ Exchange не существовал'); }

  // Создаём заново
  await channel.assertExchange('dlx_exchange', 'direct', { durable: true });
  console.log('✓ DLX создан');

  await channel.assertQueue('dead_letter_queue', { durable: true });
  console.log('✓ DLQ создана');

  await channel.bindQueue('dead_letter_queue', 'dlx_exchange', 'dead');
  console.log('✓ DLQ привязана');

  await channel.assertQueue('task_queue', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx_exchange',
      'x-dead-letter-routing-key': 'dead'
    }
  });
  console.log('✓ task_queue создана с DLX');

  console.log('Настройка завершена!');
  await channel.close();
  await connection.close();
}

setupQueues().catch(console.error);