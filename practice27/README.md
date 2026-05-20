```markdown
# RabbitMQ Task System

## Запуск

```bash
# 1. Запустить RabbitMQ
docker-compose up -d

# 2. Настроить очереди
npm run setup

# 3. Запустить Producer (1 терминал)
npm run producer

# 4. Запустить воркеров (3 отдельных терминала)
node consumer.js   # терминал 2
node consumer.js   # терминал 3
node consumer.js   # терминал 4
```

## Тестирование

```bash
# Отправить задачу
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"email\",\"payload\":{\"to\":\"test@mail.com\",\"subject\":\"Hello\"}}"
```

## Ожидаемый результат

- Producer возвращает `{"message":"Задача принята","taskId":"..."}`
- Задачи распределяются между воркерами
- При ошибке — retry через 1с, 2с
- После 3 неудачных попыток — сообщение уходит в DLQ

