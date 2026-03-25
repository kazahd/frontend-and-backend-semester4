const express = require('express');
const { nanoid } = require('nanoid');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const port = 3000;

// ========== НАСТРОЙКИ JWT ==========
const ACCESS_SECRET = 'access-secret-key-change-this';
const REFRESH_SECRET = 'refresh-secret-key-change-this';
const ACCESS_EXPIRES_IN = '15m'; // для демо, потом вернуть '15m'
const REFRESH_EXPIRES_IN = '7d';

// Хранилища
let users = [];
let products = [];
let refreshTokens = new Set();

app.use(express.json());
app.use(cors({ origin: '*' }));

app.use((req, res, next) => {
    res.on('finish', () => {
        console.log(`[${new Date().toISOString()}] [${req.method}] ${res.statusCode} ${req.path}`);
    });
    next();
});

const SALT_ROUNDS = 10;

async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

function findUserByEmail(email) {
    return users.find(u => u.email === email);
}

function findUserById(id) {
    return users.find(u => u.id === id);
}

function findProductOr404(id, res) {
    const product = products.find(p => p.id === id);
    if (!product) {
        res.status(404).json({ error: "Товар не найден" });
        return null;
    }
    return product;
}

//ФУНКЦИИ ГЕНЕРАЦИИ ТОКЕНОВ
function generateAccessToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
        },
        ACCESS_SECRET,
        { expiresIn: ACCESS_EXPIRES_IN }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        { sub: user.id, role: user.role },
        REFRESH_SECRET,
        { expiresIn: REFRESH_EXPIRES_IN }
    );
}

//MIDDLEWARE
function authMiddleware(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    try {
        const payload = jwt.verify(token, ACCESS_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

//Middleware для проверки ролей
function roleMiddleware(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: "Access denied. Insufficient permissions." });
        }
        
        next();
    };
}

//SWAGGER
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API с ролевой моделью (RBAC)',
            version: '1.0.0',
            description: 'Практическое занятие №11 — RBAC',
        },
        servers: [{ url: `http://localhost:${port}`, description: 'Локальный сервер' }],
        components: {
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        firstName: { type: 'string' },
                        lastName: { type: 'string' },
                        role: { type: 'string', enum: ['user', 'seller', 'admin'] }
                    }
                },
                Product: {
                    type: 'object',
                    required: ['title', 'category', 'description', 'price'],
                    properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        category: { type: 'string' },
                        description: { type: 'string' },
                        price: { type: 'number' }
                    }
                }
            },
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
        }
    },
    apis: ['./app.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

//ПУБЛИЧНЫЕ МАРШРУТЫ 

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация нового пользователя
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, firstName, lastName, password]
 *             properties:
 *               email: { type: string }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               password: { type: string }
 *               role: { type: string, enum: [user, seller, admin], default: user }
 *     responses:
 *       201:
 *         description: Пользователь создан
 */
app.post('/api/auth/register', async (req, res) => {
    const { email, firstName, lastName, password, role = 'user' } = req.body;

    if (!email || !firstName || !lastName || !password) {
        return res.status(400).json({ error: "Все поля обязательны" });
    }

    if (findUserByEmail(email)) {
        return res.status(400).json({ error: "Пользователь с таким email уже существует" });
    }

    // Проверяем допустимость роли
    const validRoles = ['user', 'seller', 'admin'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Недопустимая роль" });
    }

    const hashedPassword = await hashPassword(password);

    const newUser = {
        id: nanoid(6),
        email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        passwordHash: hashedPassword,
        role
    };

    users.push(newUser);

    res.status(201).json({
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role
    });
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Успешный вход
 */
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email и пароль обязательны" });
    }

    const user = findUserByEmail(email);
    if (!user) {
        return res.status(401).json({ error: "Неверный email или пароль" });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
        return res.status(401).json({ error: "Неверный email или пароль" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    refreshTokens.add(refreshToken);

    res.json({
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
        }
    });
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Обновление токенов
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Новая пара токенов
 */
app.post('/api/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: "refreshToken обязателен" });
    }

    if (!refreshTokens.has(refreshToken)) {
        return res.status(401).json({ error: "Invalid refresh token" });
    }

    try {
        const payload = jwt.verify(refreshToken, REFRESH_SECRET);
        const user = findUserById(payload.sub);

        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        refreshTokens.delete(refreshToken);
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);
        refreshTokens.add(newRefreshToken);

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired refresh token" });
    }
});

//ЗАЩИЩЁННЫЕ МАРШРУТЫ

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получить данные текущего пользователя
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Данные пользователя
 */
app.get('/api/auth/me', authMiddleware, (req, res) => {
    const userId = req.user.sub;
    const user = findUserById(userId);

    if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
    }

    res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
    });
});

//УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (ТОЛЬКО ADMIN)

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Получить список пользователей (только admin)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Список пользователей
 *       403:
 *         description: Доступ запрещён
 */
app.get('/api/users', authMiddleware, roleMiddleware(['admin']), (req, res) => {
    // Не возвращаем пароли
    const safeUsers = users.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role
    }));
    res.json(safeUsers);
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Получить пользователя по ID (только admin)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Данные пользователя
 *       403:
 *         description: Доступ запрещён
 *       404:
 *         description: Пользователь не найден
 */
app.get('/api/users/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => {
    const user = findUserById(req.params.id);
    if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
    }
    res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
    });
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Обновить пользователя (только admin)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               role: { type: string, enum: [user, seller, admin] }
 *     responses:
 *       200:
 *         description: Пользователь обновлён
 */
app.put('/api/users/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => {
    const user = findUserById(req.params.id);
    if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
    }

    const { email, firstName, lastName, role } = req.body;

    if (email) user.email = email.trim();
    if (firstName) user.firstName = firstName.trim();
    if (lastName) user.lastName = lastName.trim();
    if (role) {
        const validRoles = ['user', 'seller', 'admin'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: "Недопустимая роль" });
        }
        user.role = role;
    }

    res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
    });
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Удалить (заблокировать) пользователя (только admin)
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Пользователь удалён
 */
app.delete('/api/users/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => {
    const index = users.findIndex(u => u.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: "Пользователь не найден" });
    }

    users.splice(index, 1);
    res.status(204).send();
});

//УПРАВЛЕНИЕ ТОВАРАМИ

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Создать товар (продавец, admin)
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, category, description, price]
 *             properties:
 *               title: { type: string }
 *               category: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *     responses:
 *       201:
 *         description: Товар создан
 *       403:
 *         description: Доступ запрещён
 */
app.post('/api/products', authMiddleware, roleMiddleware(['seller', 'admin']), (req, res) => {
    const { title, category, description, price, imageUrl } = req.body;

    if (!title || !category || !description || !price) {
        return res.status(400).json({ error: "Все поля обязательны" });
    }

    const newProduct = {
        id: nanoid(6),
        title: title.trim(),
        category: category.trim(),
        description: description.trim(),
        price: Number(price),
        imageUrl: imageUrl || 'https://via.placeholder.com/300x200?text=Нет+фото'
    };

    products.push(newProduct);
    res.status(201).json(newProduct);
});

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Получить список всех товаров (любой авторизованный пользователь)
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Список товаров
 */
app.get('/api/products', authMiddleware, roleMiddleware(['user', 'seller', 'admin']), (req, res) => {
    res.json(products);
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Получить товар по ID (любой авторизованный пользователь)
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Данные товара
 */
app.get('/api/products/:id', authMiddleware, roleMiddleware(['user', 'seller', 'admin']), (req, res) => {
    const id = req.params.id;
    const product = findProductOr404(id, res);
    if (!product) return;
    res.json(product);
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Обновить товар (продавец, admin)
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, category, description, price]
 *             properties:
 *               title: { type: string }
 *               category: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *     responses:
 *       200:
 *         description: Товар обновлён
 */
app.put('/api/products/:id', authMiddleware, roleMiddleware(['seller', 'admin']), (req, res) => {
    const id = req.params.id;
    const product = findProductOr404(id, res);
    if (!product) return;

    const { title, category, description, price, imageUrl } = req.body;

    if (!title || !category || !description || !price) {
        return res.status(400).json({ error: "Все поля обязательны" });
    }

    product.title = title.trim();
    product.category = category.trim();
    product.description = description.trim();
    product.price = Number(price);
    if (imageUrl) product.imageUrl = imageUrl;

    res.json(product);
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Удалить товар (только admin)
 *     tags: [Products]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Товар удалён
 */
app.delete('/api/products/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => {
    const id = req.params.id;
    const exists = products.some(p => p.id === id);
    if (!exists) return res.status(404).json({ error: "Товар не найден" });

    products = products.filter(p => p.id !== id);
    res.status(204).send();
});

app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
    console.log(`Swagger: http://localhost:${port}/api-docs`);
});