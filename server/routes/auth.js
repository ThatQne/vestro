const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Check if user exists
router.post('/check-user', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username || username.length < 3) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username must be at least 3 characters' 
            });
        }

        const user = await User.findOne({ username: username.toLowerCase() });
        
        res.json({ 
            success: true, 
            exists: !!user 
        });
    } catch (error) {
        console.error('Check user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// Login or register
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }

        if (username.length < 3) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username must be at least 3 characters' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password must be at least 6 characters' 
            });
        }

        // Check if user exists
        let user = await User.findOne({ username: username.toLowerCase() });

        if (user) {
            // User exists - verify password
            const isValidPassword = await user.comparePassword(password);
            if (!isValidPassword) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid credentials' 
                });
            }

            // Update last login
            user.lastLogin = new Date();
            await user.save();
        } else {
            // User doesn't exist - create new account
            user = new User({
                username: username.toLowerCase(),
                password: password
            });
            await user.save();
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: user.toJSON(),
            message: user.createdAt.getTime() === user.lastLogin.getTime() ? 
                'Account created successfully!' : 'Welcome back!'
        });

    } catch (error) {
        console.error('Login error:', error);
        
        // Handle duplicate username error
        if (error.code === 11000) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username already exists' 
            });
        }

        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        res.json({
            success: true,
            user: user.toJSON()
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

module.exports = router; 