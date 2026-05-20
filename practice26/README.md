# GraphQL Book Catalog API - Краткое руководство

## Установка и запуск

```bash
npm install
node server.js
```

Сервер запустится на `http://localhost:4000`

## Тестирование

1. Откройте в браузере `http://localhost:4000` (Apollo Sandbox)

2. Скопируйте и выполните любой запрос в окне ввода:

### Получить все книги
```graphql
query {
  books {
    id
    title
    author { name }
  }
}
```

### Получить авторов с их книгами
```graphql
query {
  authors {
    name
    books { title }
  }
}
```

### Добавить автора
```graphql
mutation {
  createAuthor(name: "Имя", birthYear: 2000) {
    id
    name
  }
}
```

### Добавить книгу
```graphql
mutation {
  createBook(title: "Название", authorId: "1") {
    id
    title
  }
}
```

3. Нажмите кнопку **Run** (▶) для выполнения запроса