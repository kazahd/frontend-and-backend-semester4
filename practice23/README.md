## Практика 23 (Docker)

### Запуск

```bash
cd docker-load-balancing
docker compose up --build
```

### Проверка

```cmd
for /l %i in (1,1,10) do curl http://localhost && echo.
```

### Остановка

```bash
docker compose down
```
