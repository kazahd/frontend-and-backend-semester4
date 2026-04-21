const express = require('express');
const { pool, updateUpdatedAt } = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());

app.post('/api/users', async (req, res) => {
  const { first_name, last_name, age } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, age) 
       VALUES ($1, $2, $3) 
       RETURNING id, first_name, last_name, age, created_at, updated_at`,
      [first_name, last_name, age]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, first_name, last_name, age, created_at, updated_at FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT id, first_name, last_name, age, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, age } = req.body;
  
  const fields = [];
  const values = [];
  
  if (first_name !== undefined) {
    fields.push(`first_name = $${fields.length + 1}`);
    values.push(first_name);
  }
  if (last_name !== undefined) {
    fields.push(`last_name = $${fields.length + 1}`);
    values.push(last_name);
  }
  if (age !== undefined) {
    fields.push(`age = $${fields.length + 1}`);
    values.push(age);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);
  const query = `
    UPDATE users 
    SET ${fields.join(', ')}, updated_at = EXTRACT(EPOCH FROM NOW())::BIGINT 
    WHERE id = $${values.length} 
    RETURNING id, first_name, last_name, age, created_at, updated_at
  `;

  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});