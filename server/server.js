const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ 
    path: process.env.NODE_ENV === 'development' 
        ? './environment.dev.env' 
        : './environment.env' 
});

const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const randomRoutes = require('./routes/random');
const badgeRoutes = require('./routes/badges');
const leaderboardRoutes = require('./routes/leaderboard');
const casesRoutes = require('./routes/cases');
const inventoryRoutes = require('./routes/inventory');
const marketplaceRoutes = require('./routes/marketplace');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Development mode - proxy to Render backend
if (process.env.NODE_ENV === 'development') {
    const { createProxyMiddleware } = require('http-proxy-middleware');
    
    // Proxy API requests to Render backend
    app.use('/api', createProxyMiddleware({
        target: process.env.BACKEND_URL,
        changeOrigin: true,
        ws: true,
        pathRewrite: {
            '^/api': '/api'
        }
    }));

    // Proxy WebSocket connections
    app.use('/socket.io', createProxyMiddleware({
        target: process.env.BACKEND_URL,
        changeOrigin: true,
        ws: true
    }));

    // Only serve static files in development
    console.log('Development mode: Proxying requests to', process.env.BACKEND_URL);
} else {
    // Production mode - use full server functionality
    
    // Rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    });
    app.use('/api/', limiter);

    // Game rate limiting
    const gameLimiter = rateLimit({
        windowMs: 1000, // 1 second
        max: 1 // limit each IP to 1 game per second
    });
    app.use('/api/games/play', gameLimiter);

    // Connect to MongoDB
    mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

    // Make io available to routes
    app.set('io', io);
    
    // Routes
    console.log('Registering API routes...'); // Debug log
    app.use('/api/auth', authRoutes);
    app.use('/api/games', gameRoutes);
    app.use('/api/random', randomRoutes);
    app.use('/api/badges', badgeRoutes);
    app.use('/api/leaderboard', leaderboardRoutes);
    app.use('/api/cases', casesRoutes);
    app.use('/api/inventory', inventoryRoutes);
    app.use('/api/marketplace', marketplaceRoutes);
    console.log('All API routes registered successfully'); // Debug log

    // Socket.IO connection handling
    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        socket.on('join-room', (userId) => {
            socket.join(userId);
            console.log(`User ${userId} joined room`);
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });

        // Chat functionality
        socket.on('chat-message', (data) => {
            io.emit('chat-message', data);
        });
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 