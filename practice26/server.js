// server.js
const { ApolloServer } = require('@apollo/server');
const { startStandaloneServer } = require('@apollo/server/standalone');
const { authors, books } = require('./data/db');

// 1. Схема GraphQL (typeDefs)
const typeDefs = `#graphql
  type Book {
    id: ID!
    title: String!
    publishedYear: Int
    author: Author!
  }

  type Author {
    id: ID!
    name: String!
    birthYear: Int
    books: [Book!]!
  }

  type Query {
    books: [Book!]!
    book(id: ID!): Book
    authors: [Author!]!
  }

  type Mutation {
    createBook(title: String!, publishedYear: Int, authorId: ID!): Book!
    createAuthor(name: String!, birthYear: Int): Author!
  }
`;

// 2. Резолверы
const resolvers = {
  Query: {
    books: () => books,
    book: (_, args) => books.find(book => book.id === args.id),
    authors: () => authors,
  },
  
  Mutation: {
    createBook: (_, args) => {
      const newBook = {
        id: String(books.length + 1),
        title: args.title,
        publishedYear: args.publishedYear,
        authorId: args.authorId,
      };
      books.push(newBook);
      return newBook;
    },
    createAuthor: (_, args) => {
      const newAuthor = {
        id: String(authors.length + 1),
        name: args.name,
        birthYear: args.birthYear,
      };
      authors.push(newAuthor);
      return newAuthor;
    },
  },

  Book: {
    author: (parent) => authors.find(author => author.id === parent.authorId),
  },

  Author: {
    books: (parent) => books.filter(book => book.authorId === parent.id),
  },
};

// 3. Запуск сервера
const server = new ApolloServer({ typeDefs, resolvers });

startStandaloneServer(server, { listen: { port: 4000 } }).then(({ url }) => {
  console.log(`GraphQL Server ready at ${url}`);
});