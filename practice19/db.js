const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const createTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      age INTEGER NOT NULL,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
      updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
  `;
  try {
    await pool.query(query);
    console.log('Table "users" is ready');
  } catch (err) {
    console.error('Error creating table:', err.message);
  }
};

const updateUpdatedAt = async (id) => {
  const query = `
    UPDATE users 
    SET updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
    WHERE id = $1
  `;
  await pool.query(query, [id]);
};

createTable();

module.exports = { pool, updateUpdatedAt };