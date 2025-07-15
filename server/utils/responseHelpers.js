function createErrorResponse(message, statusCode = 500) {
    return {
        success: false,
        message: message
    };
}

function createSuccessResponse(data = {}, message = null) {
    const response = {
        success: true,
        ...data
    };
    
    if (message) {
        response.message = message;
    }
    
    return response;
}

function handleRouteError(error, res, defaultMessage = 'Server error') {
    console.error('Route error:', error);
    
    if (error.message === 'User not found') {
        return res.status(404).json(createErrorResponse('User not found'));
    }
    
    if (error.message === 'Inventory not found') {
        return res.status(404).json(createErrorResponse('Inventory not found'));
    }
    
    if (error.message === 'Item not found') {
        return res.status(404).json(createErrorResponse('Item not found'));
    }
    
    res.status(500).json(createErrorResponse(defaultMessage));
}

module.exports = {
    createErrorResponse,
    createSuccessResponse,
    handleRouteError
};
