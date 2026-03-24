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
  RequestOptions,
} from "./generated";
import { Term } from "./models/Term";
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

  private buildOptions(
    executionTimeout?: number,
    responseFormat?: ResponseFormat | string,
  ): RequestOptions {
    const options: RequestOptions = { schemaVersion: 1 };
    if (executionTimeout !== undefined) {
      options.execution = { timeout: executionTimeout };
    }
    if (responseFormat !== undefined) {
      options.response = { format: responseFormat as any };
    }
    return options;
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
          return new Exceptions.InvalidNumberOfStringsToGenerate(
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
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns Cardinality object.
   */
  public async getCardinality(
    term: Term,
    executionTimeout?: number,
  ): Promise<Cardinality> {
    if (term._cardinality !== null) {
      return term._cardinality;
    }

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(executionTimeout),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.cardinality(request),
    );
    const cardinality = Cardinality.fromDto(response.data.data);
    term._cardinality = cardinality;
    return cardinality;
  }

  /**
   * Compute the minimum and maximum length of strings matched by the term.
   * @param term Target term to analyze.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns Length object.
   */
  public async getLength(
    term: Term,
    executionTimeout?: number,
  ): Promise<Length> {
    if (term._length !== null) {
      return term._length;
    }

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(executionTimeout),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.length(request),
    );
    const length = Length.fromDto(response.data.data);
    term._length = length;
    return length;
  }

  /**
   * Check if the two terms accept exactly the same language.
   * @param term1 First term.
   * @param term2 Second term.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns True if both terms accept the same language.
   */
  public async equivalent(
    term1: Term,
    term2: Term,
    executionTimeout?: number,
  ): Promise<boolean> {
    const request: TwoTermsRequest = {
      terms: [term1.toDto(), term2.toDto()],
      options: this.buildOptions(executionTimeout),
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
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns True if subset's language is contained within superset's language.
   */
  public async subset(
    subset: Term,
    superset: Term,
    executionTimeout?: number,
  ): Promise<boolean> {
    const request: TwoTermsRequest = {
      terms: [subset.toDto(), superset.toDto()],
      options: this.buildOptions(executionTimeout),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.subset(request),
    );
    return response.data.data.value;
  }

  /**
   * Check if the term matches no strings.
   * @param term Target term to analyze.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns True if language is empty.
   */
  public async isEmpty(
    term: Term,
    executionTimeout?: number,
  ): Promise<boolean> {
    if (term._empty !== null) {
      return term._empty;
    }

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(executionTimeout),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.empty(request),
    );
    const isEmpty = response.data.data.value;
    term._empty = isEmpty;

    if (isEmpty) {
      term._cardinality = new Integer(0);
      term._length = new Length(null, null);
    }

    return isEmpty;
  }

  /**
   * Check if the term matches only the empty string.
   * @param term Target term to analyze.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns True if language contains only the empty string.
   */
  public async isEmptyString(
    term: Term,
    executionTimeout?: number,
  ): Promise<boolean> {
    if (term._emptyString !== null) {
      return term._emptyString;
    }

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(executionTimeout),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.emptyString(request),
    );
    const isEmptyString = response.data.data.value;
    term._emptyString = isEmptyString;

    if (isEmptyString) {
      term._cardinality = new Integer(1);
      term._length = new Length(0, 0);
    }

    return isEmptyString;
  }

  /**
   * Check if the term matches all the possible strings.
   * @param term Target term to analyze.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns True if language contains all possible strings.
   */
  public async isTotal(
    term: Term,
    executionTimeout?: number,
  ): Promise<boolean> {
    if (term._total !== null) {
      return term._total;
    }

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(executionTimeout),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.total(request),
    );
    const isTotal = response.data.data.value;
    term._total = isTotal;

    if (isTotal) {
      term._cardinality = new Infinite();
      term._length = new Length(0, null);
    }

    return isTotal;
  }

  /**
   * Return a regular expression pattern that represents the term.
   * @param term Target term to analyze.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns Regex pattern string.
   */
  public async getPattern(
    term: Term,
    executionTimeout?: number,
  ): Promise<string> {
    if (term._pattern !== null) {
      return term._pattern;
    }

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(executionTimeout),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.pattern(request),
    );
    const pattern = response.data.data.value;
    term._pattern = pattern;
    return pattern;
  }

  /**
   * Build a Graphviz DOT representation of the term's automaton.
   * @param term Target term to analyze.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns DOT string.
   */
  public async getDot(term: Term, executionTimeout?: number): Promise<string> {
    if (term._dot !== null) {
      return term._dot;
    }

    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(executionTimeout),
    };
    const response = await this.executeWithRetry(() =>
      this.analyzeApi.dot(request),
    );
    const dot = response.data.data.value;
    term._dot = dot;
    return dot;
  }

  // --- COMPUTE OPERATIONS ---

  /**
   * Concatenate the given terms in order.
   * @param terms Array of terms to concatenate.
   * @param responseFormat Desired format of the returned term.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns New term representing the concatenation.
   */
  public async concat(
    terms: Term[],
    responseFormat?: ResponseFormat | string,
    executionTimeout?: number,
  ): Promise<Term> {
    const request: MultiTermsRequest = {
      terms: terms.map((t) => t.toDto()),
      options: this.buildOptions(executionTimeout, responseFormat),
    };
    const response = await this.executeWithRetry(() =>
      this.computeApi.concat(request),
    );
    return Term.fromDto(response.data.data);
  }

  /**
   * Computes the intersection of the given terms.
   * @param terms Array of terms to intersect.
   * @param responseFormat Desired format of the returned term.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns New term representing the intersection.
   */
  public async intersection(
    terms: Term[],
    responseFormat?: ResponseFormat | string,
    executionTimeout?: number,
  ): Promise<Term> {
    const request: MultiTermsRequest = {
      terms: terms.map((t) => t.toDto()),
      options: this.buildOptions(executionTimeout, responseFormat),
    };
    const response = await this.executeWithRetry(() =>
      this.computeApi.intersection(request),
    );
    return Term.fromDto(response.data.data);
  }

  /**
   * Computes the union of the given terms.
   * @param terms Array of terms to unite.
   * @param responseFormat Desired format of the returned term.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns New term representing the union.
   */
  public async union(
    terms: Term[],
    responseFormat?: ResponseFormat | string,
    executionTimeout?: number,
  ): Promise<Term> {
    const request: MultiTermsRequest = {
      terms: terms.map((t) => t.toDto()),
      options: this.buildOptions(executionTimeout, responseFormat),
    };
    const response = await this.executeWithRetry(() =>
      this.computeApi.union(request),
    );
    return Term.fromDto(response.data.data);
  }

  /**
   * Computes the difference between the two provided terms.
   * @param base Term to subtract from.
   * @param excluded Term to exclude.
   * @param responseFormat Desired format of the returned term.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns New term representing the difference.
   */
  public async difference(
    base: Term,
    excluded: Term,
    responseFormat?: ResponseFormat | string,
    executionTimeout?: number,
  ): Promise<Term> {
    const request: TwoTermsRequest = {
      terms: [base.toDto(), excluded.toDto()],
      options: this.buildOptions(executionTimeout, responseFormat),
    };
    const response = await this.executeWithRetry(() =>
      this.computeApi.difference(request),
    );
    return Term.fromDto(response.data.data);
  }

  /**
   * Repeat a term between 'min' and 'max' times.
   * @param term Term to repeat.
   * @param min Minimum number of repetitions.
   * @param max Maximum number of repetitions (optional, unbounded if null).
   * @param responseFormat Desired format of the returned term.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns New term representing the repetition.
   */
  public async repeat(
    term: Term,
    min: number,
    max?: number | null,
    responseFormat?: ResponseFormat | string,
    executionTimeout?: number,
  ): Promise<Term> {
    const request: RepeatRequest = {
      term: term.toDto(),
      min,
      max,
      options: this.buildOptions(executionTimeout, responseFormat),
    };
    const response = await this.executeWithRetry(() =>
      this.computeApi.repeat(request),
    );
    return Term.fromDto(response.data.data);
  }

  /**
   * Computes the complement of the given term.
   * @param term Term to complement.
   * @param responseFormat Desired format of the returned term.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns New term representing the complement.
   */
  public async complement(
    term: Term,
    responseFormat?: ResponseFormat | string,
    executionTimeout?: number,
  ): Promise<Term> {
    const request: TermRequest = {
      term: term.toDto(),
      options: this.buildOptions(executionTimeout, responseFormat),
    };
    const response = await this.executeWithRetry(() =>
      this.computeApi.complement(request),
    );
    return Term.fromDto(response.data.data);
  }

  // --- GENERATE OPERATIONS ---

  /**
   * Generates up to `limit` distinct strings matched by 'term', skipping the first 'offset' strings.
   * @param term Source term to generate strings from.
   * @param limit Maximum number of unique strings to return.
   * @param offset Number of matched strings to skip before starting to collect the results. Used for pagination.
   * @param executionTimeout Timeout in milliseconds for the operation.
   * @returns Array of unique strings.
   */
  public async generateStrings(
    term: Term,
    limit: number,
    offset: number,
    executionTimeout?: number,
  ): Promise<string[]> {
    let termToUse = term;
    let returnStableTerm = false;

    if (term._stableTerm !== null) {
      termToUse = term._stableTerm;
    } else {
      returnStableTerm = true;
    }

    const request: GenerateStringsRequest = {
      term: termToUse.toDto(),
      limit,
      offset,
      returnStableTerm,
      options: this.buildOptions(executionTimeout),
    };
    const response = await this.executeWithRetry(() =>
      this.generateApi.strings(request),
    );
    const data = response.data.data;
    if (data.term) {
      term._stableTerm = Term.fromDto(data.term);
    }
    return data.strings.value;
  }
}
