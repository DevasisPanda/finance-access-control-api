class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function errorResponse(error) {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          message: error.message,
          details: error.details ?? null,
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        message: 'Internal server error',
        details: null,
      },
    },
  };
}

module.exports = {
  AppError,
  errorResponse,
};
