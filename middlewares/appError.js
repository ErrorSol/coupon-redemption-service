class AppError extends Error {
  constructor(message, statusCode, options = {}) {
    super(message);
    this.responseCode = 1;
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    this.errors = options?.errors || [];
    this.code = options?.code || "INTERNAL_ERROR";
    this.details = options?.details;
    Error.captureStackTrace(this, this.constructor);
  }
}
export default AppError;
