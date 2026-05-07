## Практика 22 (Нативная балансировка)

### Запуск

```cmd
# Терминал 1
cd backend
node server1.js

# Терминал 2
cd backend
node server2.js

# Терминал 3
cd backend
node server3.js

# Терминал 4
cd C:\nginx
start nginx
```

### Проверка

```cmd
for /l %i in (1,1,10) do curl http://localhost && echo.
```

### Остановка

```cmd
nginx -s stop
```



