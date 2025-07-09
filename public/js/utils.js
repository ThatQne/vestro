// Utility functions

// Format number with commas and decimal places
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return parseFloat(num).toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
}

// Animate number changes
function animateNumber(element, newValue, duration = ANIMATION_DURATION, prefix = '') {
    if (!element) return;
    
    const startValue = parseFloat(element.textContent.replace(/[^0-9.-]/g, '')) || 0;
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (newValue - startValue) * easeOut;
        
        element.textContent = prefix + formatNumber(currentValue);
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        } else {
            element.textContent = prefix + formatNumber(newValue);
        }
    }
    
    requestAnimationFrame(updateNumber);
}

// Random number between min and max
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Copy text to clipboard
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const result = document.execCommand('copy');
            document.body.removeChild(textArea);
            return result;
        }
    } catch (err) {
        console.error('Failed to copy text: ', err);
        return false;
    }
}

// Validate bet amount
function validateBetAmount(amount, balance) {
    const betAmount = parseFloat(amount);
    
    if (isNaN(betAmount) || betAmount < 0.01) {
        throw new Error('Minimum bet amount is $0.01');
    }
    
    if (betAmount > balance) {
        throw new Error('Insufficient balance');
    }
    
    return Math.round(betAmount * 100) / 100;
}

// Format time ago
function timeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

// Create element with classes and attributes
function createElement(tag, classes = [], attributes = {}) {
    const element = document.createElement(tag);
    
    if (classes.length > 0) {
        element.classList.add(...classes);
    }
    
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
    
    return element;
}

// Show loading state
function setLoadingState(element, isLoading, originalText = '') {
    if (!element) return;
    
    if (isLoading) {
        element.disabled = true;
        element.dataset.originalText = element.textContent;
        element.textContent = 'Loading...';
    } else {
        element.disabled = false;
        element.textContent = element.dataset.originalText || originalText;
    }
}

// Local storage helpers
const storage = {
    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error getting from localStorage:', error);
            return defaultValue;
        }
    },
    
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Error setting localStorage:', error);
            return false;
        }
    },
    
    remove: (key) => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatNumber,
        animateNumber,
        randomBetween,
        debounce,
        throttle,
        copyToClipboard,
        validateBetAmount,
        timeAgo,
        createElement,
        setLoadingState,
        storage
    };
} 