// Badge definitions - these match the client-side definitions
const CLIENT_BADGES = [
    {
        code: 'first_win',
        name: 'First Win',
        description: 'Win your first game',
        icon: '🎯',
        criteria: {
            type: 'wins',
            value: 1
        }
    },
    {
        code: 'high_roller',
        name: 'High Roller',
        description: 'Place a bet of $1000 or more',
        icon: '💰',
        criteria: {
            type: 'bet',
            value: 1000
        }
    },
    {
        code: 'lucky_streak',
        name: 'Lucky Streak',
        description: 'Win 5 games in a row',
        icon: '🔥',
        criteria: {
            type: 'winstreak',
            value: 5
        }
    },
    {
        code: 'veteran',
        name: 'Veteran',
        description: 'Play 100 games',
        icon: '🎮',
        criteria: {
            type: 'games',
            value: 100
        }
    },
    {
        code: 'millionaire',
        name: 'Millionaire',
        description: 'Have a balance of $1,000,000 or more',
        icon: '💎',
        criteria: {
            type: 'balance',
            value: 1000000
        }
    },
    {
        code: 'level_master',
        name: 'Level Master',
        description: 'Reach level 10',
        icon: '⭐',
        criteria: {
            type: 'level',
            value: 10
        }
    }
];

module.exports = CLIENT_BADGES; 