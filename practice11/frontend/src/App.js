import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:3000/api';

// Настройка axios
const api = axios.create({ baseURL: API_URL });

// Добавляем токен к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Обработка 401 (обновление токена)
api.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', res.data.accessToken);
        localStorage.setItem('refreshToken', res.data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${res.data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.clear();
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

function App() {
  const [page, setPage] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'user' });
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [productForm, setProductForm] = useState({ title: '', category: '', description: '', price: '', imageUrl: '' });
  const [userForm, setUserForm] = useState({ email: '', firstName: '', lastName: '', role: '' });
  const [viewingProduct, setViewingProduct] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [tokenExpiryTime, setTokenExpiryTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showWarning, setShowWarning] = useState(false);

  // Функция для декодирования JWT
  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  // Запуск таймера токена
  const startTokenTimer = (token) => {
    const decoded = parseJwt(token);
    if (decoded && decoded.exp) {
      const expiryTimestamp = decoded.exp * 1000;
      setTokenExpiryTime(expiryTimestamp);
    }
  };

  useEffect(() => {
    if (!tokenExpiryTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = tokenExpiryTime - now;
      
      if (diff <= 0) {
        setTimeLeft(0);
        setShowWarning(true);
        clearInterval(interval);
      } else {
        const secondsLeft = Math.floor(diff / 1000);
        setTimeLeft(secondsLeft);
        setShowWarning(secondsLeft <= 5);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tokenExpiryTime]);

  useEffect(() => {
    if (localStorage.getItem('accessToken')) {
      setPage('profile');
      fetchProfile();
      fetchProducts();
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleProductChange = (e) => {
    setProductForm({ ...productForm, [e.target.name]: e.target.value });
  };

  const handleUserChange = (e) => {
    setUserForm({ ...userForm, [e.target.name]: e.target.value });
  };

  const register = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/auth/register`, form);
      alert('Регистрация успешна! Теперь войдите.');
      setPage('login');
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const login = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/auth/login`, form);
      localStorage.setItem('accessToken', res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      startTokenTimer(res.data.accessToken);
      setPage('profile');
      fetchProfile();
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const logout = () => {
    localStorage.clear();
    setPage('login');
    setUser(null);
  };

  const createProduct = async (e) => {
    e.preventDefault();
    try {
      await api.post('/products', productForm);
      setProductForm({ title: '', category: '', description: '', price: '' });
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const updateProduct = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/products/${editingProduct.id}`, productForm);
      setEditingProduct(null);
      setProductForm({ title: '', category: '', description: '', price: '' });
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Удалить товар?')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const updateUser = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/users/${editingUser.id}`, userForm);
      setEditingUser(null);
      setUserForm({ email: '', firstName: '', lastName: '', role: '' });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Удалить пользователя?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Ошибка');
    }
  };

  const startEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      title: product.title,
      category: product.category,
      description: product.description,
      price: product.price
    });
  };

  const startEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    });
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setEditingUser(null);
    setProductForm({ title: '', category: '', description: '', price: '' });
    setUserForm({ email: '', firstName: '', lastName: '', role: '' });
  };

  const viewProduct = (product) => {
    setViewingProduct(product);
    setShowViewModal(true);
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setViewingProduct(null);
  };

  return (
    <div className="app">
      <h1>Каталог товаров</h1>

      {/* Навигация */}
      <div className="nav-buttons">
        {!localStorage.getItem('accessToken') ? (
          <>
            <button className={page === 'login' ? 'active' : ''} onClick={() => setPage('login')}>Вход</button>
            <button className={page === 'register' ? 'active' : ''} onClick={() => setPage('register')}>Регистрация</button>
          </>
        ) : (
          <>
            <button className={page === 'profile' ? 'active' : ''} onClick={() => { setPage('profile'); fetchProfile(); }}>Профиль</button>
            <button className={page === 'products' ? 'active' : ''} onClick={() => { setPage('products'); fetchProducts(); }}>Товары</button>
            {user?.role === 'admin' && (
              <button className={page === 'users' ? 'active' : ''} onClick={() => { setPage('users'); fetchUsers(); }}>Пользователи</button>
            )}
            <button onClick={logout}>Выйти</button>
          </>
        )}
      </div>

      {/* Вход */}
      {page === 'login' && (
        <form onSubmit={login} className="form-container">
          <h2>Вход</h2>
          <input name="email" placeholder="Email" value={form.email} onChange={handleInputChange} required />
          <input name="password" type="password" placeholder="Пароль" value={form.password} onChange={handleInputChange} required />
          <button type="submit">Войти</button>
        </form>
      )}

      {/* Регистрация */}
      {page === 'register' && (
        <form onSubmit={register} className="form-container">
          <h2>Регистрация</h2>
          <input name="email" placeholder="Email" value={form.email} onChange={handleInputChange} required />
          <input name="firstName" placeholder="Имя" value={form.firstName} onChange={handleInputChange} required />
          <input name="lastName" placeholder="Фамилия" value={form.lastName} onChange={handleInputChange} required />
          <input name="password" type="password" placeholder="Пароль" value={form.password} onChange={handleInputChange} required />
          <select name="role" value={form.role} onChange={handleInputChange}>
            <option value="user">Пользователь</option>
            <option value="seller">Продавец</option>
            <option value="admin">Администратор</option>
          </select>
          <button type="submit">Зарегистрироваться</button>
        </form>
      )}

      {/* Профиль */}
      {page === 'profile' && user && (
        <div className="profile-container">
          <h2>Профиль</h2>
          <div className="user-info">
            <p><strong>ID:</strong> {user.id}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Имя:</strong> {user.firstName}</p>
            <p><strong>Фамилия:</strong> {user.lastName}</p>
            <p><strong>Роль:</strong> <span className={`role-badge role-${user.role}`}>{user.role}</span></p>
          </div>
          
          <div className="tokens-info">
            <h3>Токены</h3>
            <div className="token-display">
              <strong>Access Token:</strong>
              <div className="token-value">{localStorage.getItem('accessToken')}</div>
            </div>
            <div className="token-display">
              <strong>Refresh Token:</strong>
              <div className="token-value">{localStorage.getItem('refreshToken')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Управление пользователями (только admin) */}
      {page === 'users' && user?.role === 'admin' && (
        <div className="users-container">
          <h2>Управление пользователями</h2>
          
          {/* Редактирование пользователя */}
          {editingUser && (
            <div className="user-form">
              <h3>Редактировать пользователя</h3>
              <form onSubmit={updateUser}>
                <input name="email" placeholder="Email" value={userForm.email} onChange={handleUserChange} required />
                <input name="firstName" placeholder="Имя" value={userForm.firstName} onChange={handleUserChange} required />
                <input name="lastName" placeholder="Фамилия" value={userForm.lastName} onChange={handleUserChange} required />
                <select name="role" value={userForm.role} onChange={handleUserChange}>
                  <option value="user">Пользователь</option>
                  <option value="seller">Продавец</option>
                  <option value="admin">Администратор</option>
                </select>
                <div className="form-buttons">
                  <button type="submit">Сохранить</button>
                  <button type="button" onClick={cancelEdit} className="cancel-btn">Отмена</button>
                </div>
              </form>
            </div>
          )}

          {/* Список пользователей */}
          <div className="users-list">
            {users.map(u => (
              <div key={u.id} className="user-card">
                <div className="user-header">
                  <span className="user-id">#{u.id}</span>
                  <span className={`role-badge role-${u.role}`}>{u.role}</span>
                </div>
                <p><strong>Email:</strong> {u.email}</p>
                <p><strong>Имя:</strong> {u.firstName} {u.lastName}</p>
                <div className="card-buttons">
                  <button onClick={() => startEditUser(u)} className="edit-btn">Редактировать</button>
                  <button onClick={() => deleteUser(u.id)} className="delete-btn">Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Товары */}
      {page === 'products' && (
        <div className="products-container">
          <h2>Товары</h2>
          
          {/* Форма создания/редактирования (только seller и admin) */}
          {(user?.role === 'seller' || user?.role === 'admin') && (
            <div className="product-form">
              <h3>{editingProduct ? 'Редактировать товар' : 'Создать товар'}</h3>
              <form onSubmit={editingProduct ? updateProduct : createProduct}>
                <input name="title" placeholder="Название" value={productForm.title} onChange={handleProductChange} required />
                <input name="category" placeholder="Категория" value={productForm.category} onChange={handleProductChange} required />
                <textarea name="description" placeholder="Описание" value={productForm.description} onChange={handleProductChange} required rows="3" />
                <input name="price" type="number" placeholder="Цена" value={productForm.price} onChange={handleProductChange} required />
                <input name="imageUrl" placeholder="Ссылка на фото (URL)"value={productForm.imageUrl} onChange={handleProductChange}/>
                <div className="form-buttons">
                  <button type="submit">{editingProduct ? 'Сохранить' : 'Создать'}</button>
                  {editingProduct && (
                    <button type="button" onClick={cancelEdit} className="cancel-btn">Отмена</button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Список товаров */}
          <div className="products-list">
            {products.map(p => (
              <div key={p.id} className="product-card">
                {p.imageUrl && (
                  <div className="product-image">
                    <img src={p.imageUrl} alt={p.title} />
                  </div>
                )}
                
                <div className="product-header">
                  <span className="product-id">#{p.id}</span>
                  <h4 onClick={() => viewProduct(p)} style={{ cursor: 'pointer' }}>{p.title}</h4>
                </div>
  
                <p onClick={() => viewProduct(p)} style={{ cursor: 'pointer' }}>
                  <strong>Категория:</strong> {p.category}
                </p>
                <p onClick={() => viewProduct(p)} style={{ cursor: 'pointer' }}>
                  <strong>Цена:</strong> {p.price} руб.
                </p>
                <div className="card-buttons">
                  {(user?.role === 'seller' || user?.role === 'admin') && (
                    <button onClick={() => startEditProduct(p)} className="edit-btn">Редактировать</button>
                  )}
                  {user?.role === 'admin' && (
                    <button onClick={() => deleteProduct(p.id)} className="delete-btn">Удалить</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Модальное окно просмотра товара */}
      {showViewModal && viewingProduct && (
        <div className="modal-overlay" onClick={closeViewModal}>
          <div className="view-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Просмотр товара</h3>
              <button className="close-btn" onClick={closeViewModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="view-field">
                <strong>ID:</strong>
                <span className="view-id">{viewingProduct.id}</span>
              </div>
              <div className="view-field">
                <strong>Название:</strong>
                <span>{viewingProduct.title}</span>
              </div>
              {viewingProduct.imageUrl && (
                <div className="view-image">
                  <img src={viewingProduct.imageUrl} alt={viewingProduct.title} />
                </div>
              )}
              <div className="view-field">
                <strong>Категория:</strong>
                <span>{viewingProduct.category}</span>
              </div>
              <div className="view-field">
                <strong>Описание:</strong>
                <span className="view-description">{viewingProduct.description}</span>
              </div>
              <div className="view-field">
                <strong>Цена:</strong>
                <span className="view-price">{viewingProduct.price} ₽</span>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={closeViewModal}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;