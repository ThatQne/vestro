# 🎲 Vestro - Modern Minimalist Gambling App

A sleek, modern gambling application built with Node.js, Express, MongoDB, and Socket.IO. Features true randomness via Random.org API and real-time capabilities.

## ✨ Features

* **🔐 Simple Authentication System** - Username/password login with automatic account creation
* **🎮 Gambling Games**
  * Coin Flip (50/50 chance to double your bet)
  * Dice Roll (Guess higher/lower than 3.5)
  * More games coming soon!
* **📊 User Profiles** - Track stats, balance, level, and game history
* **💱 Trading System** - View trade history (coming soon)
* **🛒 Marketplace** - Buy/sell items (coming soon)
* **💬 Live Chat** - Real-time chat with WebSocket support
* **🏆 Leaderboard & Levels** - Experience system with level progression
* **🎯 True Randomness** - Uses Random.org API for fair gaming

## 🚀 Tech Stack

* **Frontend**: HTML5, CSS3, Vanilla JavaScript, Tailwind CSS
* **Backend**: Node.js, Express.js
* **Database**: MongoDB with Mongoose
* **Real-time**: Socket.IO for WebSocket connections
* **Authentication**: JWT tokens with bcrypt
* **Randomness**: Random.org API
* **Deployment**: GitHub + Render.com

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/ThatQne/vestro.git
cd vestro
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   * Copy `environment.env` to `.env` or update the values in `environment.env`:
```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
RANDOM_ORG_API_KEY=your_random_org_api_key
PORT=3000
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:3000`

## 🎯 Usage

### Getting Started
1. Visit the login page
2. Enter a username and password
3. If the account doesn't exist, it will be created automatically
4. Start with $100 initial balance

### Playing Games
1. Navigate to the Games page using the sidebar
2. Choose a game (Coin Flip or Dice Roll)
3. Set your bet amount
4. Make your choice and play!
5. Win or lose, your balance updates in real-time

### User Features
* **Profile Page**: View your stats, level, and game history
* **Balance**: Earn money by winning games
* **Experience**: Gain XP for playing games (5 XP per game, 10 XP for wins)
* **Levels**: Level up every 100 XP and get $50 bonus

## 🎮 Game Rules

### Coin Flip
* Choose heads or tails
* 50% chance to win
* Win = 2x your bet
* Lose = lose your bet

### Dice Roll
* Choose "Higher" (4-6) or "Lower" (1-3)
* ~50% chance to win each option
* Win = 1.8x your bet
* Lose = lose your bet

## 🔧 API Endpoints

### Authentication
* `POST /api/auth/check-user` - Check if user exists
* `POST /api/auth/login` - Login or register user
* `GET /api/auth/profile` - Get user profile (protected)

### Games
* `POST /api/games/play` - Play a game (protected)
* `GET /api/games/history` - Get game history (protected)

### Random Numbers
* `POST /api/random/number` - Get random number
* `POST /api/random/coinflip` - Flip coin
* `POST /api/random/dice` - Roll dice

## 🚀 Deployment

### Using the Publish Script
```bash
npm run publish
```

This will:
1. Commit your changes with a timestamp
2. Push to GitHub
3. Trigger automatic deployment via GitHub Actions

### Manual Deployment to Render.com
1. Connect your GitHub repository to Render
2. Set up environment variables in Render dashboard
3. Deploy as a Web Service
4. Set start command to `npm start`

### Environment Variables for Production
Make sure to set these in your deployment platform:
* `MONGODB_URI` - Your MongoDB connection string
* `JWT_SECRET` - Secret key for JWT tokens
* `RANDOM_ORG_API_KEY` - API key from Random.org
* `PORT` - Port number (usually set automatically)

## 📱 UI/UX Features

* **Minimalist Design** - Clean, modern interface
* **Responsive Layout** - Works on desktop and mobile
* **Expanding Sidebar** - Hover to reveal navigation labels
* **Smooth Animations** - CSS transitions and hover effects
* **Dark Theme** - Easy on the eyes for long gaming sessions
* **Real-time Updates** - Balance and stats update instantly

## 🔮 Future Features

* **Live Chat System** - Real-time chat with other players
* **Leaderboards** - Compete with other players
* **More Games** - Roulette, Blackjack, Slots
* **Marketplace** - Trade items and skins
* **Daily Bonuses** - Login rewards
* **Tournaments** - Competitive gaming events
* **Social Features** - Friend system and messaging

## 🛡️ Security

* Passwords are hashed with bcrypt
* JWT tokens for authentication
* Input validation and sanitization
* Rate limiting on API endpoints
* CORS configuration for security

## 📊 Database Schema

### Users
```javascript
{
  username: String (unique),
  password: String (hashed),
  balance: Number (default: 100),
  level: Number (default: 1),
  experience: Number (default: 0),
  gamesPlayed: Number,
  totalWagered: Number,
  totalWon: Number,
  bestWin: Number,
  createdAt: Date,
  lastLogin: Date
}
```

### Game History
```javascript
{
  userId: ObjectId,
  gameType: String,
  betAmount: Number,
  playerChoice: String,
  gameResult: String,
  won: Boolean,
  winAmount: Number,
  balanceBefore: Number,
  balanceAfter: Number,
  experienceGained: Number,
  leveledUp: Boolean,
  timestamp: Date
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 Scripts

* `npm start` - Start production server
* `npm run dev` - Start development server with nodemon
* `npm run publish` - Commit and push changes to GitHub

## 🎯 Support

If you encounter any issues or have questions:
1. Check the console for error messages
2. Ensure all environment variables are set correctly
3. Verify MongoDB connection
4. Check Random.org API key validity

---

**Disclaimer**: This is a demonstration gambling application. Please gamble responsibly and be aware of local laws regarding online gambling.

## 🌐 Live Demo

* **Production**: https://vestro-lz81.onrender.com
* **GitHub**: https://github.com/ThatQne/vestro 