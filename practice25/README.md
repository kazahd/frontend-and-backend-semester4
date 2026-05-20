## Тестирование

### 1. Запуск dev-сервера
```bash
npm run dev
```
Открыть `http://localhost:5173/`

### 2. Проверка lazy loading
- `F12` → вкладка **Network**
- Обновить страницу → файла `About...js` **нет**
- Нажать **"О нас"** → файл `About...js` **появился**

### 3. Production-сборка
```bash
npm run build
npm run preview
```
Открыть `http://localhost:4173/`

### 4. Анализ бандла
После `npm run build` открыть `bundle-report.html` в браузере