export class RegexSolverError extends Error {
    public readonly errorCode?: string;
    public readonly statusCode?: number;

    constructor(message: string, statusCode?: number, errorCode?: string) {
        super(message);
        this.name = 'RegexSolverError';
        this.statusCode = statusCode;
        this.errorCode = errorCode;
    }
}

export class InvalidJson extends RegexSolverError {
    constructor(message: string) {
        super(message, 400, 'InvalidJson');
        this.name = 'InvalidJson';
    }
}

export class TooManyTerms extends RegexSolverError {
    constructor(message: string) {
        super(message, 400, 'TooManyTerms');
        this.name = 'TooManyTerms';
    }
}

export class TimeoutTooLarge extends RegexSolverError {
    constructor(message: string) {
        super(message, 400, 'TimeoutTooLarge');
        this.name = 'TimeoutTooLarge';
    }
}

export class TimeoutExceeded extends RegexSolverError {
    constructor(message: string) {
        super(message, 400, 'TimeoutExceeded');
        this.name = 'TimeoutExceeded';
    }
}

export class InvalidNumberOfStringsToGenerate extends RegexSolverError {
    constructor(message: string) {
        super(message, 400, 'InvalidNumberOfStringsToGenerate');
        this.name = 'InvalidNumberOfStringsToGenerate';
    }
}

export class MissingOrMalformedToken extends RegexSolverError {
    constructor(message: string) {
        super(message, 401, 'MissingOrMalformedToken');
        this.name = 'MissingOrMalformedToken';
    }
}

export class InvalidToken extends RegexSolverError {
    constructor(message: string) {
        super(message, 401, 'InvalidToken');
        this.name = 'InvalidToken';
    }
}

export class QuotaExceeded extends RegexSolverError {
    constructor(message: string) {
        super(message, 403, 'QuotaExceeded');
        this.name = 'QuotaExceeded';
    }
}

export class NotFound extends RegexSolverError {
    constructor(message: string) {
        super(message, 404);
        this.name = 'NotFound';
    }
}

export class TooManyRequestsError extends RegexSolverError {
    public readonly retryAfter?: number;

    constructor(message: string, retryAfter?: number) {
        super(message, 429);
        this.name = 'TooManyRequestsError';
        this.retryAfter = retryAfter;
    }
}

export class InternalServerError extends RegexSolverError {
    constructor(message: string) {
        super(message, 500);
        this.name = 'InternalServerError';
    }
}
