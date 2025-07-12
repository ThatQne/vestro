// Notification System
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notification-container');
        this.notifications = [];
        this.maxNotifications = 3;
    }

    show(options) {
        const {
            type = 'info',
            title,
            message,
            amount = null,
            duration = 5000,
            persistent = false,
            customColor = null
        } = options;

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Apply custom color if provided
        if (customColor) {
            notification.style.setProperty('--notification-color', customColor);
            //notification.style.borderColor = customColor;
        }
        
        // Create notification content
        const header = document.createElement('div');
        header.className = 'notification-header';
        
        const titleElement = document.createElement('div');
        titleElement.className = 'notification-title';
        
        const icon = document.createElement('div');
        icon.className = 'notification-icon';
        icon.textContent = this.getIcon(type);
        
        // Apply custom color to icon if provided
        if (customColor) {
            icon.style.color = customColor;
        }
        
        const titleText = document.createElement('span');
        titleText.textContent = title;
        
        titleElement.appendChild(icon);
        titleElement.appendChild(titleText);
        header.appendChild(titleElement);
        notification.appendChild(header);
        
        if (message) {
            const messageElement = document.createElement('div');
            messageElement.className = 'notification-message';
            messageElement.textContent = message;
            notification.appendChild(messageElement);
        }
        
        if (amount !== null) {
            const amountElement = document.createElement('div');
            amountElement.className = 'notification-amount';
            const sign = amount >= 0 ? '+' : '';
            amountElement.textContent = `${sign}$${formatNumber(Math.abs(amount))}`;
            
            // Apply custom color to amount if provided
            if (customColor) {
                amountElement.style.color = customColor;
                amountElement.style.fontWeight = 'bold';
            }
            
            notification.appendChild(amountElement);
        }
        
        // Add progress bar for auto-dismiss
        if (!persistent && duration > 0) {
            const progressBar = document.createElement('div');
            progressBar.className = 'notification-progress';
            progressBar.style.width = '100%';
            
            // Apply custom color to progress bar if provided
            if (customColor) {
                progressBar.style.backgroundColor = customColor;
            }
            
            notification.appendChild(progressBar);
            
            // Animate progress bar
            requestAnimationFrame(() => {
                progressBar.style.transition = `width ${duration}ms linear`;
                progressBar.style.width = '0%';
            });
        }
        
        // Add click to dismiss
        notification.onclick = () => this.dismiss(notification);
        
        // Add to container
        this.container.appendChild(notification);
        this.notifications.push(notification);
        
        // Remove excess notifications
        while (this.notifications.length > this.maxNotifications) {
            const oldest = this.notifications.shift();
            this.dismiss(oldest);
        }
        
        // Animate in
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // Auto dismiss
        if (!persistent && duration > 0) {
            setTimeout(() => {
                this.dismiss(notification);
            }, duration);
        }
        
        return notification;
    }

    dismiss(notification) {
        if (!notification || !notification.parentNode) return;
        
        notification.classList.add('hide');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            const index = this.notifications.indexOf(notification);
            if (index > -1) {
                this.notifications.splice(index, 1);
            }
        }, 300);
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '!',
            warning: '!',
            info: 'i',
            'level-up': '↑',
            'badge': '★'
        };
        return icons[type] || 'i';
    }

    // Convenience methods
    success(title, message, amount = null) {
        return this.show({ type: 'success', title, message, amount });
    }

    error(title, message) {
        return this.show({ type: 'error', title, message, duration: 7000 });
    }

    warning(title, message) {
        return this.show({ type: 'warning', title, message });
    }

    info(title, message) {
        return this.show({ type: 'info', title, message });
    }

    levelUp(title, message, amount = null) {
        return this.show({ type: 'level-up', title, message, amount, duration: 8000 });
    }
}

// Initialize notification manager
const notifications = new NotificationManager();

// Replace old notification functions
function showError(message) {
    notifications.error('Error', message);
}

function showBadgeNotification(badge) {
    const notification = notifications.show({
        type: 'badge',
        title: 'Badge Earned!',
        message: badge.name,
        duration: 8000
    });
    
    // Customize notification with badge color and icon
    if (notification) {
        notification.style.setProperty('--notification-color', badge.color);
        const iconElement = notification.querySelector('.notification-icon');
        if (iconElement) {
            iconElement.innerHTML = `<i data-lucide="${badge.icon}"></i>`;
            iconElement.style.background = badge.color;
        }
        
        // Re-initialize lucide icons for the notification
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}

function showGameNotification(isWin, amount, customMessage = null, colorObj = null, multiplier = null) {
    if (customMessage) {
        if (customMessage.includes('Level Up')) {
            notifications.levelUp('Level Up!', customMessage);
        } else if (customMessage.includes('completed')) {
            notifications.info('Auto Bet', customMessage);
        } else if (customMessage.includes('reached')) {
            notifications.warning('Auto Bet', customMessage);
        } else {
            notifications.info('Game', customMessage);
        }
    } else {
        const optsColor = colorObj ? colorObj.text : undefined;
        if (multiplier !== null && multiplier < 1) {
            notifications.show({
                type: 'info',
                title: 'Partial Return',
                message: `You got back $${amount.toFixed(2)}`,
                amount,
                customColor: optsColor
            });
        } else if (isWin) {
            notifications.show({
                type: 'success',
                title: 'You Won!',
                message: `Won $${amount.toFixed(2)}!`,
                amount,
                customColor: optsColor
            });
        } else {
            notifications.show({
                type: 'error',
                title: 'You Lost',
                message: 'Better luck next time!',
                amount,
                customColor: optsColor
            });
        }
    }
}

function showCopyFeedback() {
    notifications.success('Copied!', 'Hash copied to clipboard');
}

// Global showNotification function for compatibility
function showNotification(message, type = 'info') {
    const titleMap = {
        'success': 'Success',
        'error': 'Error',
        'warning': 'Warning',
        'info': 'Info'
    };
    
    const title = titleMap[type] || 'Info';
    
    switch (type) {
        case 'success':
            notifications.success(title, message);
            break;
        case 'error':
            notifications.error(title, message);
            break;
        case 'warning':
            notifications.warning(title, message);
            break;
        default:
            notifications.info(title, message);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        NotificationManager,
        notifications,
        showGameNotification,
        showError,
        showBadgeNotification,
        showCopyFeedback
    };
} 