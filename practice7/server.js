const express = require('express');
const { nanoid } = require('nanoid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');

const app = express();
const port = 3000;

const JWT_SECRET = 'access_secret';
const ACCESS_EXPIRES_IN = '15m';

app.use(express.json());

const users = [];
const products = [];

const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'API для управления товарами',
        version: '1.0.0',
        description: 'API с JWT аутентификацией и CRUD операциями для товаров',
    },
    servers: [
        {
            url: `http://localhost:${port}`,
            description: 'Локальный сервер',
        },
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
        schemas: {
            User: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'abc123' },
                    email: { type: 'string', example: 'ivan@example.com' },
                    first_name: { type: 'string', example: 'Ivan' },
                    last_name: { type: 'string', example: 'Petrov' },
                },
            },
            Product: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'xyz789' },
                    title: { type: 'string', example: 'Laptop' },
                    category: { type: 'string', example: 'Electronics' },
                    description: { type: 'string', example: 'Gaming laptop with RTX 4060' },
                    price: { type: 'number', example: 1500 },
                    createdBy: { type: 'string', example: 'ivan@example.com' },
                },
            },
            RegisterInput: {
                type: 'object',
                required: ['email', 'first_name', 'last_name', 'password'],
                properties: {
                    email: { type: 'string', example: 'ivan@example.com' },
                    first_name: { type: 'string', example: 'Ivan' },
                    last_name: { type: 'string', example: 'Petrov' },
                    password: { type: 'string', example: 'qwerty123' },
                },
            },
            LoginInput: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', example: 'ivan@example.com' },
                    password: { type: 'string', example: 'qwerty123' },
                },
            },
            ProductInput: {
                type: 'object',
                required: ['title', 'category', 'description', 'price'],
                properties: {
                    title: { type: 'string', example: 'Laptop' },
                    category: { type: 'string', example: 'Electronics' },
                    description: { type: 'string', example: 'Gaming laptop with RTX 4060' },
                    price: { type: 'number', example: 1500 },
                },
            },
            ProductUpdateInput: {
                type: 'object',
                properties: {
                    title: { type: 'string', example: 'Gaming Laptop' },
                    category: { type: 'string', example: 'Electronics' },
                    description: { type: 'string', example: 'Updated description' },
                    price: { type: 'number', example: 1400 },
                },
            },
            ErrorResponse: {
                type: 'object',
                properties: {
                    error: { type: 'string', example: 'Error message' },
                },
            },
            LoginResponse: {
                type: 'object',
                properties: {
                    accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                },
            },
        },
    },
    paths: {
        '/api/auth/register': {
            post: {
                summary: 'Регистрация пользователя',
                tags: ['Auth'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/RegisterInput',
                            },
                            example: {
                                email: 'ivan@example.com',
                                first_name: 'Ivan',
                                last_name: 'Petrov',
                                password: 'qwerty123',
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Пользователь создан',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/User',
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Ошибка валидации',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                },
            },
        },
        '/api/auth/login': {
            post: {
                summary: 'Вход в систему',
                tags: ['Auth'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/LoginInput',
                            },
                            example: {
                                email: 'ivan@example.com',
                                password: 'qwerty123',
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Успешный вход, возвращает accessToken',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/LoginResponse',
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Неверные учетные данные',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                },
            },
        },
        '/api/auth/me': {
            get: {
                summary: 'Получить текущего пользователя',
                tags: ['Auth'],
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Данные пользователя',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/User',
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Не авторизован',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                },
            },
        },
        '/api/products': {
            get: {
                summary: 'Получить список товаров',
                tags: ['Products'],
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Список товаров',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        $ref: '#/components/schemas/Product',
                                    },
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Не авторизован',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                },
            },
            post: {
                summary: 'Создать товар',
                tags: ['Products'],
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ProductInput',
                            },
                            example: {
                                title: 'Laptop',
                                category: 'Electronics',
                                description: 'Gaming laptop with RTX 4060',
                                price: 1500,
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Товар создан',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Product',
                                },
                            },
                        },
                    },
                    400: {
                        description: 'Ошибка валидации',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Не авторизован',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                },
            },
        },
        '/api/products/{id}': {
            get: {
                summary: 'Получить товар по ID',
                tags: ['Products'],
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        example: 'xyz789',
                    },
                ],
                responses: {
                    200: {
                        description: 'Товар найден',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Product',
                                },
                            },
                        },
                    },
                    404: {
                        description: 'Товар не найден',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Не авторизован',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                },
            },
            put: {
                summary: 'Обновить товар',
                tags: ['Products'],
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        example: 'xyz789',
                    },
                ],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/ProductUpdateInput',
                            },
                            example: {
                                title: 'Gaming Laptop',
                                price: 1400,
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'Товар обновлен',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Product',
                                },
                            },
                        },
                    },
                    404: {
                        description: 'Товар не найден',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Не авторизован',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                },
            },
            delete: {
                summary: 'Удалить товар',
                tags: ['Products'],
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string' },
                        example: 'xyz789',
                    },
                ],
                responses: {
                    200: {
                        description: 'Товар удален',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string', example: 'Product deleted successfully' },
                                        product: { $ref: '#/components/schemas/Product' },
                                    },
                                },
                            },
                        },
                    },
                    404: {
                        description: 'Товар не найден',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                    401: {
                        description: 'Не авторизован',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/ErrorResponse',
                                },
                            },
                        },
                    },
                },
            },
        },
    },
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

async function hashPassword(password) {
    const rounds = 10;
    return bcrypt.hash(password, rounds);
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

function authMiddleware(req, res, next) {
    const header = req.headers.authorization || '';

    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

app.post('/api/auth/register', async (req, res) => {
    const { email, first_name, last_name, password } = req.body;

    if (!email || !first_name || !last_name || !password) {
        return res.status(400).json({
            error: 'All fields are required: email, first_name, last_name, password'
        });
    }

    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
    }

    const newUser = {
        id: nanoid(),
        email,
        first_name,
        last_name,
        hashedPassword: await hashPassword(password)
    };

    users.push(newUser);

    const { hashedPassword, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
    }

    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await verifyPassword(password, user.hashedPassword);
    if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = jwt.sign(
        {
            sub: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
        },
        JWT_SECRET,
        {
            expiresIn: ACCESS_EXPIRES_IN,
        }
    );

    res.status(200).json({ accessToken });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    const userId = req.user.sub;
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
    });
});

app.post('/api/products', authMiddleware, async (req, res) => {
    const { title, category, description, price } = req.body;

    if (!title || !category || !description || price === undefined) {
        return res.status(400).json({
            error: 'All fields are required: title, category, description, price'
        });
    }

    if (typeof price !== 'number' || price <= 0) {
        return res.status(400).json({ error: 'Price must be a positive number' });
    }

    const newProduct = {
        id: nanoid(),
        title,
        category,
        description,
        price,
        createdBy: req.user.email
    };

    products.push(newProduct);

    res.status(201).json(newProduct);
});

app.get('/api/products', authMiddleware, (req, res) => {
    res.status(200).json(products);
});

app.get('/api/products/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const product = products.find(p => p.id === id);

    if (!product) {
        return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json(product);
});

app.put('/api/products/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { title, category, description, price } = req.body;

    const productIndex = products.findIndex(p => p.id === id);
    if (productIndex === -1) {
        return res.status(404).json({ error: 'Product not found' });
    }

    if (title !== undefined) products[productIndex].title = title;
    if (category !== undefined) products[productIndex].category = category;
    if (description !== undefined) products[productIndex].description = description;
    if (price !== undefined) {
        if (typeof price !== 'number' || price <= 0) {
            return res.status(400).json({ error: 'Price must be a positive number' });
        }
        products[productIndex].price = price;
    }

    res.status(200).json(products[productIndex]);
});

app.delete('/api/products/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const productIndex = products.findIndex(p => p.id === id);

    if (productIndex === -1) {
        return res.status(404).json({ error: 'Product not found' });
    }

    const deletedProduct = products[productIndex];
    products.splice(productIndex, 1);

    res.status(200).json({ message: 'Product deleted successfully', product: deletedProduct });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Swagger UI available at http://localhost:${port}/api-docs`);
});