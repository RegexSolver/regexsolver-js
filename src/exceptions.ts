export class RegexSolverError extends Error {
  /** Base exception for all RegexSolver errors. */
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ApiError extends RegexSolverError {
  /** Base exception raised when the RegexSolver API returns an error response. */
  public readonly statusCode?: number;
  public readonly body?: string;

  constructor(message: string, statusCode?: number, body?: string) {
    super(message);
    this.statusCode = statusCode;
    this.body = body;
  }
}

export class BadRequestError extends ApiError {
  /** Raised when the API returns a 400 Bad Request error. */
}

export class InvalidJsonError extends BadRequestError {
  /** Raised when the provided JSON is invalid or cannot be parsed. */
}

export class TooManyTermsError extends BadRequestError {
  /** Raised when the number of terms provided exceeds the maximum allowed. */
}

export class TimeoutTooLargeError extends BadRequestError {
  /** Raised when the requested `execution_timeout` exceeds the maximum allowed for your current plan. */
}

export class TimeoutExceededError extends BadRequestError {
  /** Raised when the execution of the request exceeds the provided `execution_timeout` or the maximum allowed for your current plan. */
}

export class InvalidNumberOfStringsToGenerate extends BadRequestError {
  /** Raised when the requested number of strings to generate is below the minimum or exceeds the maximum allowed. */
}

export class UnauthorizedError extends ApiError {
  /** Raised when the API returns a 401 Unauthorized error. */
}

export class MissingOrMalformedTokenError extends UnauthorizedError {
  /** Raised when the provided authentication token is missing or malformed. */
}

export class InvalidTokenError extends UnauthorizedError {
  /** Raised when the provided authentication token is invalid. */
}

export class ForbiddenError extends ApiError {
  /** Raised when the API returns a 403 Forbidden error. */
}

export class QuotaExceededError extends ForbiddenError {
  /** Raised when your account's monthly compute quota has been exceeded. */
}

export class NotFoundError extends ApiError {
  /** * Raised when the API returns a 404 Not Found error.
   * Indicates that the requested API endpoint or resource does not exist.
   */
}

export class TooManyRequestsError extends ApiError {
  /**
   * Raised when the API returns a 429 Too Many Requests error and max retries are exceeded.
   * Indicates that your requests-per-second (req/s) rate limit has been exceeded.
   */
}

export class InternalServerError extends ApiError {
  /**
   * Raised when the API returns a 500 Internal Server Error.
   * Indicates an unexpected failure or panic on the RegexSolver compute servers.
   */
}
