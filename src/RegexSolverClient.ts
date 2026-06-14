import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import {
  AnalyzeApi,
  ComputeApi,
  GenerateApi,
  Configuration,
  TermRequest,
  MultiTermsRequest,
  TwoTermsRequest,
  RepeatRequest,
  GenerateStringsRequest,
  RequestOptions as RequestOptionsDto,
} from "./generated";
import { FairTerm, Term } from "./models/Term";
import { Cardinality, Infinite, Integer } from "./models/Cardinality";
import { Length } from "./models/Length";
import { ResponseFormat } from "./models/ResponseFormat";
import * as Exceptions from "./exceptions";
import { getRateLimiter, RateLimiter } from "./RateLimiter";

const VERSION = "1.1.0";

export interface RegexSolverConfig {
  apiToken: string;
  baseUrl?: string;
}

/**
 * Options to customize the execution of operations.
 */
export interface OperationOptions {
  /**
   * Return format of the term.
   */
  responseFormat?: ResponseFormat | string;
  /**
   * When true, guarantees the returned FAIR encodes a deterministic automaton.
   * Only valid with responseFormat=ResponseFormat.FAIR or when responseFormat is
   * unset (in which case it defaults to ResponseFormat.FAIR). Throws otherwise.
   */
  deterministic?: boolean;
  /**
   * Timeout in milliseconds for the operation.
   */
  executionTimeout?: number;
}

export class RegexSolverClient {
  private readonly apiToken: string;
  private readonly analyzeApi: AnalyzeApi;
  private readonly computeApi: ComputeApi;
  private readonly generateApi: GenerateApi;
  private readonly axiosInstance: AxiosInstance;
  private readonly rateLimiter: RateLimiter;

  constructor(config: RegexSolverConfig) {
    this.apiToken = config.apiToken;
    const baseUrl = config.baseUrl || "https://api.regexsolver.com/v1";
    this.rateLimiter = getRateLimiter(this.apiToken);

    const axiosConfig = {
      baseURL: baseUrl,
      headers: {
        "User-Agent": `RegexSolver JS / ${VERSION}`,
        Authorization: `Bearer ${this.apiToken}`,
      },
    };

    this.axiosInstance = axios.create(axiosConfig);

    // Add rate limit interceptor
    this.axiosInstance.interceptors.request.use(async (requestConfig) => {
      await this.rateLimiter.wait();
      return requestConfig;
    });

    const apiConfiguration = new Configuration({
      accessToken: this.apiToken,
      basePath: baseUrl,
    });

    this.analyzeApi = new AnalyzeApi(
      apiConfiguration,
      baseUrl,
      this.axiosInstance,
    );
    this.computeApi = new ComputeApi(
      apiConfiguration,
      baseUrl,
      this.axiosInstance,
    );
    this.generateApi = new GenerateApi(
      apiConfiguration,
      baseUrl,
      this.axiosInstance,
    );
  }

  private buildOptions(options?: OperationOptions): RequestOptionsDto {
    const dto: RequestOptionsDto = { schemaVersion: 1 };
    if (options?.executionTimeout !== undefined) {
      dto.execution = { timeout: options.executionTimeout };
    }

    const { responseFormat, deterministic } = options ?? {};
    if (deterministic !== undefined && responseFormat !== undefined) {
      const fmt = String(responseFormat);
      if (fmt !== ResponseFormat.FAIR) {
        throw new Error(
          `deterministic can only be used with responseFormat=ResponseFormat.FAIR, got ${JSON.stringify(responseFormat)}`,
        );
      }
    }

    if (responseFormat !== undefined || deterministic !== undefined) {
      dto.response = {};
      if (responseFormat !== undefined) {
        dto.response.format = responseFormat as any;
      }
      if (deterministic !== undefined) {
        dto.response.fair = { deterministic };
        if (responseFormat === undefined) {
          // FairResponseOptions is only applied when the response format is
          // "fair", so default to it to honor the deterministic request.
          dto.response.format = ResponseFormat.FAIR as any;
        }
      }
    }
    return dto;
  }

  private async executeWithRetry<T>(
    apiCall: () => Promise<AxiosResponse<T>>,
  ): Promise<AxiosResponse<T>> {
    let retried = false;

    while (true) {
      try {
        return await apiCall();
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          const statusCode = error.response.status;
          if (statusCode === 429) {
            if (retried) {
              throw this.mapError(error);
            }
            retried = true;
            const retryAfter = parseFloat(
              error.response.headers["retry-after"] || "1",
            );

            this.rateLimiter.trigger(retryAfter);
            continue;
          }
          throw this.mapError(error);
        }
        throw error;
      }
    }
  }

  private mapError(error: AxiosError<any>): Error {
    if (!error.response) return error;

    const statusCode = error.response.status;
    const data = error.response.data;

    let message = error.message;
    let errorCode = "UnknownError";
    const bodyString = typeof data === "string" ? data : JSON.stringify(data);

    if (data) {
      message = data.error || message;
      errorCode = data.errorCode || errorCode;
    }

    message = message || "Unknown API Error";

    switch (statusCode) {
      case 400:
        if (errorCode === "InvalidJson")
          return new Exceptions.InvalidJsonError(
            message,
            statusCode,
            bodyString,
          );
        if (errorCode === "TooManyTerms")
          return new Exceptions.TooManyTermsError(
            message,
            statusCode,
            bodyString,
          );
        if (errorCode === "TimeoutTooLarge")
          return new Exceptions.TimeoutTooLargeError(
            message,
            statusCode,
            bodyString,
          );
        if (errorCode === "TimeoutExceeded")
          return new Exceptions.TimeoutExceededError(
            message,
            statusCode,
            bodyString,
          );
        if (errorCode === "InvalidNumberOfStringsToGenerate")
          return new Exceptions.InvalidNumberOfStringsToGenerateError(
            message,
            statusCode,
            bodyString,
          );
        if (errorCode === "AutomatonTooManyStates")
          return new Exceptions.AutomatonTooManyStatesError(
            message,
            statusCode,
            bodyString,
          );
        if (errorCode === "RegexSyntaxError")
          return new Exceptions.RegexSyntaxError(
            message,
            statusCode,
            bodyString,
          );
        return new Exceptions.BadRequestError(message, statusCode, bodyString);
      case 401:
        if (errorCode === "MissingOrMalformedToken")
          return new Exceptions.MissingOrMalformedTokenError(
            message,
            statusCode,
            bodyString,
          );
        if (errorCode === "InvalidToken")
          return new Exceptions.InvalidTokenError(
            message,
            statusCode,
            bodyString,
          );
        return new Exceptions.UnauthorizedError(
          message,
          statusCode,
          bodyString,
        );
      case 403:
        if (errorCode === "QuotaExceeded")
          return new Exceptions.QuotaExceededError(
            message,
            statusCode,
            bodyString,
          );
        return new Exceptions.ForbiddenError(message, statusCode, bodyString);
      case 404:
        return new Exceptions.NotFoundError(message, statusCode, bodyString);
      case 429:
        const msg =
          message === "Unknown API Error"
            ? "Max retries exceeded for 429 Too Many Requests."
            : message;
        return new Exceptions.TooManyRequestsError(msg, statusCode, bodyString);
      case 500:
        return new Exceptions.InternalServerError(
          message,
          statusCode,
          bodyString,
        );
      default:
        return new Exceptions.ApiError(message, statusCode, bodyString);
    }
  }

  // --- ANALYZE OPERATIONS ---

  /**
   * Computes how many unique strings the term matches.
   * @param term Target term to analyze.
   * @param options Options object.
   * @returns Cardinality object.
   */
  public async getCardinality(
    term: Term,
    options?: OperationOptions,
  ): Promise<Cardinality> {
    const cached = term.getCachedCardinality();
    if (cached !== null) return cached;

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.cardinality(request),
    );

    const cardinality = Cardinality.fromDto(response.data.data);
    term.setCachedCardinality(cardinality);
    term._setPropertiesMixin(cardinality as any);
    return cardinality;
  }

  /**
   * Compute the minimum and maximum length of strings matched by the term.
   * @param term Target term to analyze.
   * @param options Options object.
   * @returns Length object.
   */
  public async getLength(
    term: Term,
    options?: OperationOptions,
  ): Promise<Length> {
    const cached = term.getCachedLength();
    if (cached !== null) return cached;

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.length(request),
    );

    const length = Length.fromDto(response.data.data);
    term.setCachedLength(length);
    term._setPropertiesMixin(length as any);
    return length;
  }

  /**
   * Check if the two terms accept exactly the same language.
   * @param term1 First term.
   * @param term2 Second term.
   * @param options Options object.
   * @returns True if both terms accept the same language.
   */
  public async equivalent(
    term1: Term,
    term2: Term,
    options?: OperationOptions,
  ): Promise<boolean> {
    const request: TwoTermsRequest = {
      terms: [term1.toDto(), term2.toDto()],
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.equivalent(request),
    );
    return response.data.data.value;
  }

  /**
   * Check if the first term's language is a subset of the second term's language.
   * @param subset Candidate subset term.
   * @param superset Candidate superset term.
   * @param options Options object.
   * @returns True if subset's language is contained within superset's language.
   */
  public async subset(
    subset: Term,
    superset: Term,
    options?: OperationOptions,
  ): Promise<boolean> {
    const request: TwoTermsRequest = {
      terms: [subset.toDto(), superset.toDto()],
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.subset(request),
    );
    return response.data.data.value;
  }

  /**
   * Check if the term matches no strings.
   * @param term Target term to analyze.
   * @param options Options object.
   * @returns True if language is empty.
   */
  public async isEmpty(
    term: Term,
    options?: OperationOptions,
  ): Promise<boolean> {
    const cached = term.getCachedEmpty();
    if (cached !== null) return cached;

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.empty(request),
    );

    const isEmpty = response.data.data.value;
    term.setCachedEmpty(isEmpty);

    if (isEmpty) {
      term.setCachedCardinality(new Integer(0));
      term.setCachedLength(new Length(null, null));
    }
    return isEmpty;
  }

  /**
   * Check if the term matches only the empty string.
   * @param term Target term to analyze.
   * @param options Options object.
   * @returns True if language contains only the empty string.
   */
  public async isEmptyString(
    term: Term,
    options?: OperationOptions,
  ): Promise<boolean> {
    const cached = term.getCachedEmptyString();
    if (cached !== null) return cached;

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.emptyString(request),
    );

    const isEmptyString = response.data.data.value;
    term.setCachedEmptyString(isEmptyString);

    if (isEmptyString) {
      term.setCachedCardinality(new Integer(1));
      term.setCachedLength(new Length(0, 0));
    }
    return isEmptyString;
  }

  /**
   * Check if the term matches all the possible strings.
   * @param term Target term to analyze.
   * @param options Options object.
   * @returns True if language contains all possible strings.
   */
  public async isTotal(
    term: Term,
    options?: OperationOptions,
  ): Promise<boolean> {
    const cached = term.getCachedTotal();
    if (cached !== null) return cached;

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.total(request),
    );

    const isTotal = response.data.data.value;
    term.setCachedTotal(isTotal);

    if (isTotal) {
      term.setCachedCardinality(new Infinite());
      term.setCachedLength(new Length(0, null));
    }
    return isTotal;
  }

  /**
   * Check if the term's automaton is deterministic.
   * Only a deterministic FAIR guarantees consistent string ordering across paginated generateStrings() calls; call determinize() first if this is false.
   * @param term The term to analyze.
   * @param options Options object.
   * @returns True if the term's automaton is deterministic.
   */
  public async isDeterministic(
    term: Term,
    options?: OperationOptions,
  ): Promise<boolean> {
    if (!(term instanceof FairTerm)) {
      return false;
    }
    const cached = term.getCachedDeterministic();
    if (cached !== null) return cached;

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.deterministic(request),
    );

    const isDeterministic = response.data.data.value;
    term.setCachedDeterministic(isDeterministic);

    return isDeterministic;
  }

  /**
   * Return a regular expression pattern that represents the term.
   * @param term Target term to analyze.
   * @param options Options object.
   * @returns Regex pattern string.
   */
  public async getPattern(
    term: Term,
    options?: OperationOptions,
  ): Promise<string> {
    const existingPattern = term.getPattern();
    if (existingPattern !== null) return existingPattern;

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.pattern(request),
    );

    const pattern = response.data.data.value;
    term.setCachedPattern(pattern);
    return pattern;
  }

  /**
   * Build a Graphviz DOT representation of the term's automaton.
   * @param term Target term to analyze.
   * @param options Options object.
   * @returns DOT string.
   */
  public async getDot(term: Term, options?: OperationOptions): Promise<string> {
    const cached = term.getCachedDot();
    if (cached !== null) return cached;

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.dot(request),
    );

    const dot = response.data.data.value;
    term.setCachedDot(dot);
    return dot;
  }

  // --- COMPUTE OPERATIONS ---

  /**
   * Concatenate the given terms in order.
   * @param terms Array of terms or variadic terms to concatenate.
   * @returns New term representing the concatenation.
   */
  public async concat(terms: Term[]): Promise<Term>;
  public async concat(...terms: Term[]): Promise<Term>;
  public async concat(terms: Term[], options?: OperationOptions): Promise<Term>;
  public async concat(...args: any[]): Promise<Term> {
    const { terms, options } = this.parseArgs(args);
    const request: MultiTermsRequest = {
      terms: terms.map((t) => t.toDto()),
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.computeApi.concat(request),
    );
    return Term.fromDto(response.data.data);
  }

  /**
   * Computes the intersection of the given terms.
   * @param terms Array of terms or variadic terms to intersect.
   * @returns New term representing the intersection.
   */
  public async intersection(terms: Term[]): Promise<Term>;
  public async intersection(...terms: Term[]): Promise<Term>;
  public async intersection(
    terms: Term[],
    options?: OperationOptions,
  ): Promise<Term>;
  public async intersection(...args: any[]): Promise<Term> {
    const { terms, options } = this.parseArgs(args);
    const request: MultiTermsRequest = {
      terms: terms.map((t) => t.toDto()),
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.computeApi.intersection(request),
    );
    return Term.fromDto(response.data.data);
  }

  /**
   * Computes the union of the given terms.
   * @param terms Array of terms or variadic terms to unite.
   * @returns New term representing the union.
   */
  public async union(terms: Term[]): Promise<Term>;
  public async union(...terms: Term[]): Promise<Term>;
  public async union(terms: Term[], options?: OperationOptions): Promise<Term>;
  public async union(...args: any[]): Promise<Term> {
    const { terms, options } = this.parseArgs(args);
    const request: MultiTermsRequest = {
      terms: terms.map((t) => t.toDto()),
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.computeApi.union(request),
    );
    return Term.fromDto(response.data.data);
  }

  private parseArgs(args: any[]): {
    terms: Term[];
    options?: OperationOptions;
  } {
    if (args.length === 0) {
      return { terms: [] };
    }

    if (Array.isArray(args[0])) {
      return {
        terms: args[0],
        options: args[1],
      };
    }

    // Variadic
    // Check if last arg is options object
    const lastArg = args[args.length - 1];
    if (
      args.length > 1 &&
      typeof lastArg === "object" &&
      lastArg !== null &&
      !(lastArg instanceof Term)
    ) {
      return { terms: args.slice(0, -1), options: lastArg };
    }

    return { terms: args };
  }

  /**
   * Computes the difference between the two given terms.
   * @param base Term to subtract from.
   * @param excluded Term to exclude.
   * @param options Options object.
   * @returns New term representing the difference.
   */
  public async difference(
    base: Term,
    excluded: Term,
    options?: OperationOptions,
  ): Promise<Term> {
    const request: TwoTermsRequest = {
      terms: [base.toDto(), excluded.toDto()],
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.computeApi.difference(request),
    );
    return Term.fromDto(response.data.data);
  }

  /**
   * Repeat a term between `min` and `max` times.
   * @param term Term to repeat.
   * @param min Minimum number of repetitions.
   * @param max Maximum number of repetitions (optional, unbounded if null).
   * @param options Options object.
   * @returns New term representing the repetition.
   */
  public async repeat(
    term: Term,
    min: number,
    max?: number | null,
    options?: OperationOptions,
  ): Promise<Term> {
    const request: RepeatRequest = {
      term: term.toDto(),
      min,
      max,
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.computeApi.repeat(request),
    );
    return Term.fromDto(response.data.data);
  }

  /**
   * Computes the complement of the given term.
   * @param term Term to complement.
   * @param options Options object.
   * @returns New term representing the complement.
   */
  public async complement(
    term: Term,
    options?: OperationOptions,
  ): Promise<Term> {
    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.computeApi.complement(request),
    );
    return Term.fromDto(response.data.data);
  }

  /**
   * Computes a deterministic FAIR automaton from the given term.
   * A deterministic FAIR guarantees consistent string ordering across paginated
   * generateStrings() calls. Use this when isDeterministic() is false
   * before calling generateStrings() with an offset.
   * @param term Term to determinize.
   * @param options Options object.
   * @returns A deterministic FAIR.
   */
  public async determinize(
    term: Term,
    options?: OperationOptions,
  ): Promise<Term> {
    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(options),
    };
    const response = await this.executeWithRetry(() =>
      this.computeApi.determinize(request),
    );
    return Term.fromDto(response.data.data);
  }

  // --- GENERATE OPERATIONS ---

  /**
   * Generates up to `limit` distinct strings matched by `term`, skipping the first `offset` strings.
   * @param term Source term to generate strings from.
   * @param limit Maximum number of unique strings to return.
   * @param offset Number of matched strings to skip before starting to collect the results. Used for pagination.
   * @param options Options object.
   * @returns Array of unique strings.
   */
  public async generateStrings(
    term: Term,
    limit: number,
    offset: number,
    options?: OperationOptions,
  ): Promise<string[]> {
    const request: GenerateStringsRequest = {
      term: term.toDto(),
      limit,
      offset,
      options: this.buildOptions(options),
    };

    const response = await this.executeWithRetry(() =>
      this.generateApi.strings(request),
    );

    return response.data.data.strings.value;
  }
}
