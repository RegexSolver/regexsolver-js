/** Base exception for all RegexSolver errors. */
export class RegexSolverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/** Base exception raised when the RegexSolver API returns an error response. */
export class ApiError extends RegexSolverError {
  public readonly statusCode?: number;
  public readonly body?: string;

  constructor(message: string, statusCode?: number, body?: string) {
    super(message);
    this.statusCode = statusCode;
    this.body = body;
  }
}

/** Raised when the API returns a 400 Bad Request error. */
export class BadRequestError extends ApiError {}

/** Raised when the provided JSON is invalid or cannot be parsed. */
export class InvalidJsonError extends BadRequestError {}

/** Raised when the number of terms provided exceeds the maximum allowed. */
export class TooManyTermsError extends BadRequestError {}

/** Raised when fewer terms are provided than the operation requires. */
export class TooFewTermsError extends BadRequestError {}

/** Raised when the requested `execution_timeout` exceeds the maximum allowed for your current plan. */
export class TimeoutTooLargeError extends BadRequestError {}

/** Raised when the execution of the request exceeds the provided `execution_timeout` or the maximum allowed for your current plan. */
export class TimeoutExceededError extends BadRequestError {}

/** Raised when the requested number of strings to generate is below the minimum or exceeds the maximum allowed. */
export class InvalidNumberOfStringsToGenerateError extends BadRequestError {}

/** Raised when the NFA/DFA exceeds the maximum allowed number of states for your current plan. */
export class AutomatonTooManyStatesError extends BadRequestError {}

/** Raised when the provided regular expression has invalid syntax. */
export class RegexSyntaxError extends BadRequestError {}

/** Raised when the provided FAIR value is malformed or cannot be decoded. */
export class FairSyntaxError extends BadRequestError {}

/** Raised when the API returns a 401 Unauthorized error. */
export class UnauthorizedError extends ApiError {}

/** Raised when the provided authentication token is missing or malformed. */
export class MissingOrMalformedTokenError extends UnauthorizedError {}

/** Raised when the provided authentication token is invalid. */
export class InvalidTokenError extends UnauthorizedError {}

/** Raised when the API returns a 403 Forbidden error. */
export class ForbiddenError extends ApiError {}

/** Raised when your account's monthly compute quota has been exceeded. */
export class QuotaExceededError extends ForbiddenError {}

/** Raised when the API returns a 404 Not Found error.
 * Indicates that the requested API endpoint or resource does not exist.
 */
export class NotFoundError extends ApiError {}

/**
 * Raised when the API returns a 429 Too Many Requests error and max retries are exceeded.
 * Indicates that your requests-per-second (req/s) rate limit has been exceeded.
 */
export class TooManyRequestsError extends ApiError {}

/**
 * Raised when the API returns a 500 Internal Server Error.
 * Indicates an unexpected failure or panic on the RegexSolver compute servers.
 */
export class InternalServerError extends ApiError {}
