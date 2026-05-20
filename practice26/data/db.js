// data/db.js
const authors = [
  { id: "1", name: "Лев Толстой", birthYear: 1828 },
  { id: "2", name: "Фёдор Достоевский", birthYear: 1821 },
];

const books = [
  { id: "1", title: "Война и мир", publishedYear: 1869, authorId: "1" },
  { id: "2", title: "Анна Каренина", publishedYear: 1877, authorId: "1" },
  { id: "3", title: "Преступление и наказание", publishedYear: 1866, authorId: "2" },
];

module.exports = { authors, books };