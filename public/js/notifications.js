// Notification Manager
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.init();
    }
    
    init() {
        // Create notification container if it doesn't exist
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.container = createElement('div', ['notification-container'], {
                id: 'notification-container'
            });
            document.body.appendChild(this.container);
        }
    }
    
    show(options) {
        const {
            type = 'info',
            title = '',
            message = '',
            amount = null,
            duration = NOTIFICATION_DURATION,
            colorObj = null
        } = options;
        
        const notification = createElement('div', ['notification', `notification-${type}`]);
        
        // Apply custom colors if provided
        if (colorObj) {
            notification.style.backgroundColor = colorObj.bg;
            notification.style.borderColor = colorObj.border;
            notification.style.color = colorObj.text;
        }
        
        const icon = this.getIcon(type);
        const content = createElement('div', ['notification-content']);
        
        let titleElement = '';
        if (title) {
            titleElement = `<div class="notification-title">${title}</div>`;
        }
        
        let amountElement = '';
        if (amount !== null) {
            const amountClass = amount >= 0 ? 'positive' : 'negative';
            const amountPrefix = amount >= 0 ? '+' : '';
            amountElement = `<div class="notification-amount ${amountClass}">${amountPrefix}$${formatNumber(Math.abs(amount))}</div>`;
        }
        
        content.innerHTML = `
            <div class="notification-header">
                ${icon}
                ${titleElement}
            </div>
            <div class="notification-message">${message}</div>
            ${amountElement}
        `;
        
        const closeButton = createElement('button', ['notification-close'], {
            type: 'button',
            'aria-label': 'Close notification'
        });
        closeButton.innerHTML = '×';
        closeButton.addEventListener('click', () => this.dismiss(notification));
        
        notification.appendChild(content);
        notification.appendChild(closeButton);
        
        // Add to container
        this.container.appendChild(notification);
        this.notifications.push(notification);
        
        // Animate in
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                this.dismiss(notification);
            }, duration);
        }
        
        return notification;
    }
    
    dismiss(notification) {
        if (!notification || !notification.parentNode) return;
        
        notification.classList.remove('show');
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
            success: '<i data-lucide="check-circle"></i>',
            error: '<i data-lucide="x-circle"></i>',
            warning: '<i data-lucide="alert-triangle"></i>',
            info: '<i data-lucide="info"></i>',
            levelUp: '<i data-lucide="star"></i>'
        };
        
        return icons[type] || icons.info;
    }
    
    // Convenience methods
    success(title, message, amount = null) {
        return this.show({ type: 'success', title, message, amount });
    }
    
    error(title, message) {
        return this.show({ type: 'error', title, message });
    }
    
    warning(title, message) {
        return this.show({ type: 'warning', title, message });
    }
    
    info(title, message) {
        return this.show({ type: 'info', title, message });
    }
    
    levelUp(title, message, amount = null) {
        return this.show({ type: 'levelUp', title, message, amount });
    }
    
    // Clear all notifications
    clearAll() {
        this.notifications.forEach(notification => {
            this.dismiss(notification);
        });
    }
}

// Create global instance
const notificationManager = new NotificationManager();

// Game-specific notification functions
function showGameNotification(isWin, amount, customMessage = null, colorObj = null, multiplier = null) {
    let title, message;
    
    if (customMessage) {
        title = customMessage;
        message = '';
    } else if (isWin) {
        title = 'You Won!';
        message = multiplier ? `${multiplier}x multiplier` : '';
    } else {
        title = 'You Lost';
        message = 'Better luck next time!';
    }
    
    const type = isWin ? 'success' : 'error';
    notificationManager.show({
        type,
        title,
        message,
        amount,
        colorObj
    });
}

function showError(message) {
    notificationManager.error('Error', message);
}

function showBadgeNotification(badge) {
    notificationManager.show({
        type: 'success',
        title: 'New Badge Earned!',
        message: badge.name,
        duration: 7000
    });
}

function showCopyFeedback() {
    notificationManager.success('Copied!', 'Hash copied to clipboard');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        NotificationManager,
        notificationManager,
        showGameNotification,
        showError,
        showBadgeNotification,
        showCopyFeedback
    };
} 