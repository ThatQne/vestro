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

        // Normalize the user object to ensure both id and userId are available
        const normalizedUser = {
            ...user,
            id: user.userId || user.id, // Ensure id is available
            userId: user.userId || user.id // Ensure userId is available
        };

        console.log('Auth middleware - User authenticated:', normalizedUser.id); // Debug log
        console.log('Auth middleware - Full user object:', normalizedUser); // Debug log
        req.user = normalizedUser;
        next();
    });
}

module.exports = {
    authenticateToken
}; 