# Практические работы: Backend-разработка

## Практическое занятие №19: Работа с PostgreSQL (реляционные СУБД)

**Цель:** Создание REST API для управления пользователями с использованием Node.js и реляционной базы данных PostgreSQL.

### Реализовано:
- Подключение к PostgreSQL с использованием `pg` (Pool) и `Sequelize` ORM.
- Создание таблиц `users` через SQL-миграции.
- Реализация модели "Пользователь" с полями: `id`, `first_name`, `last_name`, `age`, `created_at`, `updated_at`.
- Полный набор CRUD-операций:
  - `POST /api/users` – создание пользователя
  - `GET /api/users` – получение всех пользователей
  - `GET /api/users/:id` – получение одного пользователя
  - `PATCH /api/users/:id` – обновление данных
  - `DELETE /api/users/:id` – удаление пользователя
- Использование транзакций и агрегационных запросов.

**Стек:** Node.js, Express, PostgreSQL, Sequelize (или pg).

## Практическое занятие №20: Работа с MongoDB (NoSQL)

**Цель:** Разработка API для управления пользователями с использованием документоориентированной базы данных MongoDB.

### Реализовано:
- Установка и настройка MongoDB (локально или облако).
- Подключение к MongoDB через Mongoose ODM.
- Создание схемы `User` с валидацией (`required`, `unique`, `min`).
- Те же CRUD-эндпоинты, что и в занятии №19, но адаптированные под MongoDB:
  - `POST /api/users`
  - `GET /api/users`
  - `GET /api/users/:id`
  - `PATCH /api/users/:id`
  - `DELETE /api/users/:id`
- Использование методов Mongoose: `.save()`, `.find()`, `.findByIdAndUpdate()`, `.findByIdAndDelete()`.

**Стек:** Node.js, Express, MongoDB, Mongoose.


## Практическое занятие №21: Кэширование с Redis

**Цель:** Оптимизация работы API с помощью кэширования часто запрашиваемых данных в Redis.

### Реализовано:
- Подключение Redis клиента к Node.js приложению.
- Реализация middleware для кэширования (`cacheMiddleware`).
- Кэширование запросов:
  - `GET /api/users` – TTL 1 минута
  - `GET /api/users/:id` – TTL 1 минута
  - `GET /api/products` – TTL 10 минут
  - `GET /api/products/:id` – TTL 10 минут
- Инвалидация кэша при операциях изменения данных (`POST`, `PATCH`, `DELETE`).
- Проверка заголовка `source: "cache"` или `"server"` в ответе.

**Стек:** Node.js, Express, Redis, (MongoDB или PostgreSQL из предыдущих практик).

## Практическое занятие №22: Балансировка нагрузки (Nginx + HAProxy)

**Цель:** Настройка распределения трафика между несколькими backend-серверами с помощью балансировщиков.

### Реализовано:
- Запуск минимум двух идентичных backend-серверов на разных портах (3000, 3001).
- Настройка Nginx как балансировщика:
  - Алгоритм `roundrobin` (по умолчанию)
  - Резервный сервер (`backup`)
  - Параметры отказоустойчивости: `max_fails=2`, `fail_timeout=30s`
- Тестирование распределения запросов через `curl`.
- Альтернативная конфигурация для HAProxy.
- Проверка работы при отключении одного из бэкендов.

**Стек:** Node.js, Nginx, HAProxy (опционально).


## Практическое занятие №23: Контейнеризация с Docker + Nginx балансировка

**Цель:** Упаковка приложения и балансировщика в Docker-контейнеры, оркестрация через Docker Compose в WSL.

### Реализовано:
- Установка WSL и Docker Desktop (интеграция).
- Написание `Dockerfile` для backend-сервиса (Node.js).
- Создание `docker-compose.yml`, включающего:
  - 2–3 экземпляра backend-сервиса
  - 1 экземпляр Nginx в роли балансировщика
  - Общую сеть `app-network`
- Конфигурация `nginx.conf` с использованием имен сервисов (`backend1`, `backend2`).
- Запуск стека командой `docker compose up --build`.
- Проверка балансировки – ответы поступают от разных серверов.
- Тестирование отказоустойчивости: остановка одного контейнера не прерывает работу.

**Стек:** Docker, Docker Compose, Nginx, Node.js, WSL.

## Как запустить 

```bash
# Для практик 19–20 (обычный Node.js)
npm install
node server.js  # или npm start

# Для практики 21 (Redis)
docker run -d --name redis-cache -p 6379:6379 redis
node server.js

# Для практики 22 (без Docker)
node server1.js (порт 3000)
node server2.js (порт 3001)
sudo nginx -c /path/to/nginx.conf

# Для практики 23 (Docker)
docker compose up --build
```
