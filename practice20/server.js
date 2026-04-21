const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(express.json());

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

const userSchema = new mongoose.Schema({
  id: { type: Number, unique: true },  
  first_name: { type: String, required: [true, 'First name is required'] },
  last_name: { type: String, required: [true, 'Last name is required'] },
  age: { type: Number, required: [true, 'Age is required'], min: 0 },
  created_at: { type: Number },  
  updated_at: { type: Number }  
});

userSchema.pre('save', async function(next) {
  const now = Math.floor(Date.now() / 1000);
  
  if (this.isNew) {
    this.created_at = now;
    this.updated_at = now;
    
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'userId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.id = counter.seq;
    } catch (err) {
      return next(err);
    }
  } else {
    this.updated_at = now;
  }
  next();
});

userSchema.pre('findOneAndUpdate', async function() {
  this.set({ updated_at: Math.floor(Date.now() / 1000) });
});

const User = mongoose.model('User', userSchema);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));


app.post('/api/users', async (req, res) => {
  try {
    const { first_name, last_name, age } = req.body;
    const user = new User({ first_name, last_name, age });
    await user.save();
    
    res.status(201).json({
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      age: user.age,
      created_at: user.created_at,
      updated_at: user.updated_at
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, { _id: 0, __v: 0 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID must be an integer' });
    }
    
    const user = await User.findOne({ id }, { _id: 0, __v: 0 });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID must be an integer' });
    }
    
    const { first_name, last_name, age } = req.body;
    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (age !== undefined) updateData.age = age;
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const user = await User.findOneAndUpdate(
      { id },
      updateData,
      { new: true, runValidators: true }
    ).select('-_id -__v');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID must be an integer' });
    }
    
    const user = await User.findOneAndDelete({ id });
    if (!user) {
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