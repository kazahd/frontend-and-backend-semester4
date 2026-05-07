```markdown
# Практическое занятие №21 — Кэширование с Redis

## 🧪 Как проверить работу кэширования

### Предварительные требования

```bash
# 1. Запустить Redis (Docker)
docker run -d --name redis-cache -p 6379:6379 redis:latest

# 2. Убедиться, что Redis работает
docker exec redis-cache redis-cli ping
# Ожидаемый ответ: PONG

# 3. Запустить сервер
cd backend
node app.js
```

**Ожидаемый вывод сервера:**
```
 Redis connected
Сервер запущен на http://localhost:3000
Swagger: http://localhost:3000/api-docs
```



###  Проверка 1: Кэширование товаров (TTL = 10 минут)

#### Шаг 1 — Регистрация администратора

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@test.com\",\"firstName\":\"Admin\",\"lastName\":\"Adminov\",\"password\":\"123456\",\"role\":\"admin\"}"
```

**Ожидаемый ответ:**
```json
{"id":"xxx","email":"admin@test.com","firstName":"Admin","lastName":"Adminov","role":"admin"}
```

#### Шаг 2 — Вход (получение токена)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@test.com\",\"password\":\"123456\"}"
```

**Ожидаемый ответ:**
```json
{"accessToken":"eyJ...","refreshToken":"eyJ...","user":{...}}
```
> **Сохраните `accessToken`** — он понадобится для следующих запросов.

#### Шаг 3 — Создать товар (для проверки)

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d "{\"title\":\"Ноутбук\",\"category\":\"Электроника\",\"description\":\"Мощный ноутбук\",\"price\":50000}"
```

#### Шаг 4 — ПЕРВЫЙ GET-запрос (Cache MISS)

```bash
curl -X GET http://localhost:3000/api/products \
  -H "Authorization: Bearer <accessToken>"
```

**В консоли сервера должно появиться:**
```
 Cache MISS: products:all
 Cache SAVED: products:all (TTL: 600s)
[2026-05-07...] [GET] 200 /api/products
```

#### Шаг 5 — ВТОРОЙ GET-запрос (Cache HIT — данные из кэша)

```bash
curl -X GET http://localhost:3000/api/products \
  -H "Authorization: Bearer <accessToken>"
```

**В консоли сервера должно появиться:**
```
 Cache HIT: products:all
```
> **Обратите внимание:** Нет строки `[GET] 200 /api/products` — значит, ответ пришёл из кэша, а не от сервера.



###  Проверка 2: Кэширование пользователей (TTL = 1 минута)

```bash
# Первый запрос (Cache MISS)
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer <accessToken>"

# Второй запрос (Cache HIT)
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer <accessToken>"
```

**В консоли сервера ожидается:**
```
 Cache MISS: users:all
 Cache SAVED: users:all (TTL: 60s)
 Cache HIT: users:all
```



###  Проверка 3: Очистка кэша при изменении данных

#### Шаг 1 — Получить список товаров (кэшируется)

```bash
curl -X GET http://localhost:3000/api/products \
  -H "Authorization: Bearer <accessToken>"
```

**В консоли:** ` Cache MISS: products:all` → ` Cache SAVED`

#### Шаг 2 — Создать новый товар (очищает кэш)

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d "{\"title\":\"Новый товар\",\"category\":\"Тест\",\"description\":\"Описание\",\"price\":1000}"
```

**В консоли сервера:** ` Cache INVALIDATED: products`

#### Шаг 3 — Снова получить список товаров (Cache MISS — кэш очищен)

```bash
curl -X GET http://localhost:3000/api/products \
  -H "Authorization: Bearer <accessToken>"
```

**В консоли:** снова ` Cache MISS: products:all` (кэша нет, пришлось заново сохранить)



###  Проверка 4: Истечение времени кэша (TTL)

```bash
# 1. Выполнить GET-запрос (сохранит кэш на 10 минут для товаров)
curl -X GET http://localhost:3000/api/products -H "Authorization: Bearer <accessToken>"

# 2. Подождать 10 минут (600 секунд)

# 3. Выполнить GET-запрос снова
curl -X GET http://localhost:3000/api/products -H "Authorization: Bearer <accessToken>"
```

**Ожидаемый результат:** через 10 минут кэш истечёт, и сервер снова покажет ` Cache MISS`



###  Проверка 5: Прямая проверка в Redis

```bash
# Посмотреть все ключи в Redis
docker exec redis-cache redis-cli KEYS "*"
```

**Ожидаемый результат:**
```
1) "products:all"
2) "users:all"
3) "products:6Ci7fo"
4) "users:2Mb7Qu"
```

```bash
# Посмотреть время жизни ключа (TTL)
docker exec redis-cache redis-cli TTL products:all
```

**Ожидаемый результат:** число от 600 до 0 (для товаров) или от 60 до 0 (для пользователей)

```bash
# Посмотреть содержимое кэша
docker exec redis-cache redis-cli GET products:all
```

**Ожидаемый результат:** JSON-строка с массивом товаров

