```markdown
# Практическое занятие №21 — Кэширование с Redis

## Быстрый старт

```bash
# 1. Запустить Redis (Docker)
docker run -d --name redis-cache -p 6379:6379 redis:latest

# 2. Запустить сервер
cd backend
node app.js
```

## 🧪 Проверка работы кэша

### 1. Получить токен

```bash
# Регистрация
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@test.com\",\"firstName\":\"Admin\",\"lastName\":\"Adminov\",\"password\":\"123456\",\"role\":\"admin\"}"

# Вход (сохраните accessToken из ответа)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@test.com\",\"password\":\"123456\"}"
```

### 2. Проверить кэш товаров (TTL = 10 минут)

```bash
# Первый запрос — Cache MISS (данные из сервера)
curl -X GET http://localhost:3000/api/products -H "Authorization: Bearer <accessToken>"

# Второй запрос — Cache HIT (данные из Redis)
curl -X GET http://localhost:3000/api/products -H "Authorization: Bearer <accessToken>"
```

**В консоли сервера:**
```
Cache MISS: products:all
Cache SAVED: products:all (TTL: 600s)
Cache HIT: products:all
```

### 3. Проверить очистку кэша

```bash
# Создать товар → кэш очистится
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d "{\"title\":\"Ноутбук\",\"category\":\"Электроника\",\"description\":\"Мощный ноутбук\",\"price\":50000}"
```

**В консоли:** `Cache INVALIDATED: products`

### 4. Проверить кэш пользователей (TTL = 1 минута)

```bash
curl -X GET http://localhost:3000/api/users -H "Authorization: Bearer <accessToken>"
```

### 5. Проверить Redis напрямую

```bash
docker exec redis-cache redis-cli KEYS "*"
docker exec redis-cache redis-cli TTL products:all
```

## Что должно получиться

| Запрос | Ожидание |
|--------|----------|
| 1-й GET `/api/products` | `Cache MISS` → `Cache SAVED` |
| 2-й GET `/api/products` | `Cache HIT` |
| POST `/api/products` | `Cache INVALIDATED` |
| GET `/api/users` | `Cache HIT` (после первого запроса) |

## Ошибки и решения

| Ошибка | Решение |
|--------|---------|
| `ECONNRESET` | Перезапустить Redis: `docker restart redis-cache` |
| `MODULE_NOT_FOUND: redis` | `npm install redis` |
| Порт 6379 занят | `docker stop redis-cache` |

