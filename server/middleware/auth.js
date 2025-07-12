const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('Auth middleware - Token present:', !!token); // Debug log

    if (!token) {
        console.log('Auth middleware - No token provided'); // Debug log
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Auth middleware - Token verification failed:', err.message); // Debug log
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        console.log('Auth middleware - User authenticated:', user.id); // Debug log
        console.log('Auth middleware - Full user object:', user); // Debug log
        req.user = user;
        next();
    });
}

module.exports = {
    authenticateToken
}; 