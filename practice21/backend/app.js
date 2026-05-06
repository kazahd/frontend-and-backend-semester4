const express = require('express');
const { nanoid } = require('nanoid');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const redis = require('redis');

const app = express();
const port = 3000;

const ACCESS_SECRET = 'access-secret-key-change-this';
const REFRESH_SECRET = 'refresh-secret-key-change-this';
const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

const USERS_CACHE_TTL = 60;     
const PRODUCTS_CACHE_TTL = 600;  

//подключение к redis
const redisClient = redis.createClient({
    url: 'redis://localhost:6379',
    socket: {
        keepAlive: false,           // Оключаем keep-alive (причина ECONNRESET)
        reconnectStrategy: false    // Не переподключаемся автоматически
    }
});

let redisReady = false;

redisClient.on('ready', () => {
    redisReady = true;
    console.log('Redis connected');
});

redisClient.on('error', (err) => {
    redisReady = false;
    console.error('Redis error:', err.message);
});

// Асинхронный запуск подключения к redis
redisClient.connect().catch(err => console.error('Connection error:', err.message));

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

// функции кэширования
function cacheMiddleware(keyBuilder, ttl) {
    return async (req, res, next) => {
        if (!redisReady) {
            console.log('⚠️ Redis not ready, skipping cache');
            return next();
        }
        try {
            const key = keyBuilder(req);
            const cachedData = await redisClient.get(key);
            if (cachedData) {
                console.log(`Cache HIT: ${key}`);
                return res.json(JSON.parse(cachedData));
            }
            console.log(`Cache MISS: ${key}`);
            req.cacheKey = key;
            req.cacheTTL = ttl;
            next();
        } catch (err) {
            console.error('Cache read error:', err.message);
            next();
        }
    };
}

async function saveToCache(key, data, ttl) {
    if (!redisReady || !key || !data) return;
    try {
        await redisClient.set(key, JSON.stringify(data), { EX: ttl });
        console.log(`Cache SAVED: ${key} (TTL: ${ttl}s)`);
    } catch (err) {
        console.error('Cache save error:', err.message);
    }
}

async function invalidateUsersCache(userId = null) {
    if (!redisReady) return;
    try {
        await redisClient.del('users:all');
        if (userId) {
            await redisClient.del(`users:${userId}`);
        }
        console.log(`Cache INVALIDATED: users`);
    } catch (err) {
        console.error('Users cache invalidate error:', err.message);
    }
}

async function invalidateProductsCache(productId = null) {
    if (!redisReady) return;
    try {
        await redisClient.del('products:all');
        if (productId) {
            await redisClient.del(`products:${productId}`);
        }
        console.log(`Cache INVALIDATED: products`);
    } catch (err) {
        console.error('Products cache invalidate error:', err.message);
    }
}

// токены
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

// middleware
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

// swagger
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API с ролевой моделью (RBAC) + Redis Cache',
            version: '1.0.0',
            description: 'Практическое занятие №21 — Кэширование с Redis',
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

// публичные маршруты

app.post('/api/auth/register', async (req, res) => {
    const { email, firstName, lastName, password, role = 'user' } = req.body;

    if (!email || !firstName || !lastName || !password) {
        return res.status(400).json({ error: "Все поля обязательны" });
    }

    if (findUserByEmail(email)) {
        return res.status(400).json({ error: "Пользователь с таким email уже существует" });
    }

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
    await invalidateUsersCache();

    res.status(201).json({
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role
    });
});

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

app.post('/api/auth/refresh', async (req, res) => {
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

// пользователи (только admin)

app.get('/api/users', 
    authMiddleware, 
    roleMiddleware(['admin']),
    cacheMiddleware(() => 'users:all', USERS_CACHE_TTL),
    async (req, res) => {
        const safeUsers = users.map(u => ({
            id: u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            role: u.role
        }));
        await saveToCache(req.cacheKey, safeUsers, req.cacheTTL);
        res.json(safeUsers);
    }
);

app.get('/api/users/:id', 
    authMiddleware, 
    roleMiddleware(['admin']),
    cacheMiddleware((req) => `users:${req.params.id}`, USERS_CACHE_TTL),
    async (req, res) => {
        const user = findUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: "Пользователь не найден" });
        }
        const safeUser = {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
        };
        await saveToCache(req.cacheKey, safeUser, req.cacheTTL);
        res.json(safeUser);
    }
);

app.put('/api/users/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
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

    await invalidateUsersCache(user.id);

    res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
    });
});

app.delete('/api/users/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    const index = users.findIndex(u => u.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: "Пользователь не найден" });
    }

    users.splice(index, 1);
    await invalidateUsersCache(req.params.id);
    
    res.status(204).send();
});

// товары

app.post('/api/products', authMiddleware, roleMiddleware(['seller', 'admin']), async (req, res) => {
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
    await invalidateProductsCache();
    
    res.status(201).json(newProduct);
});

app.get('/api/products', 
    authMiddleware, 
    roleMiddleware(['user', 'seller', 'admin']),
    cacheMiddleware(() => 'products:all', PRODUCTS_CACHE_TTL),
    async (req, res) => {
        await saveToCache(req.cacheKey, products, req.cacheTTL);
        res.json(products);
    }
);

app.get('/api/products/:id', 
    authMiddleware, 
    roleMiddleware(['user', 'seller', 'admin']),
    cacheMiddleware((req) => `products:${req.params.id}`, PRODUCTS_CACHE_TTL),
    async (req, res) => {
        const id = req.params.id;
        const product = findProductOr404(id, res);
        if (!product) return;
        await saveToCache(req.cacheKey, product, req.cacheTTL);
        res.json(product);
    }
);

app.put('/api/products/:id', authMiddleware, roleMiddleware(['seller', 'admin']), async (req, res) => {
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

    await invalidateProductsCache(id);

    res.json(product);
});

app.delete('/api/products/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    const id = req.params.id;
    const exists = products.some(p => p.id === id);
    if (!exists) return res.status(404).json({ error: "Товар не найден" });

    products = products.filter(p => p.id !== id);
    await invalidateProductsCache(id);
    
    res.status(204).send();
});

app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
    console.log(`Swagger: http://localhost:${port}/api-docs`);
});