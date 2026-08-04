import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import {
  AccountApi,
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
import { AccountLimits } from "./models/AccountLimits";
import { Cardinality, Infinite, Integer } from "./models/Cardinality";
import { CharacterOrder, PathOrder } from "./models/GenerateStringsOrder";
import { Length } from "./models/Length";
import { ResponseFormat } from "./models/ResponseFormat";
import * as Exceptions from "./exceptions";
import { getRateLimiter, RateLimiter } from "./RateLimiter";

const VERSION = "1.1.0";

// Retry policy for 429 responses: retry as long as the total wait stays
// within the budget, adding full jitter on top of `Retry-After` so concurrent
// waiters do not re-collide as a single burst. The values are shared across
// all the official clients — change them together.
const RETRY_BUDGET_MS = 300_000;
const JITTER_BASE_S = 0.25;
const JITTER_CAP_S = 2.0;
const DEFAULT_RETRY_AFTER_S = 1.0;

export interface RegexSolverConfig {
  apiToken: string;
  baseUrl?: string;
  /**
   * When true (the default), calls to concat/intersection/union carrying more
   * terms than the account's per-request limit are transparently split into
   * several requests and folded back into one result. Each constituent
   * request counts against the monthly quota.
   */
  autoBatch?: boolean;
  /**
   * Upper bound (>= 2) on the number of terms sent in a single request,
   * overriding the limit fetched from the API when smaller.
   */
  maxTermsPerRequest?: number;
}

/**
 * Options accepted by every operation.
 */
export interface ExecutionOptions {
  /**
   * Timeout in milliseconds for the operation.
   */
  executionTimeout?: number;
}

/**
 * Options for operations that return a term.
 *
 * Analyze operations and determinize() take {@link ExecutionOptions} instead:
 * they do not return a caller-shaped term, so responseFormat and deterministic
 * would have no effect there.
 */
export interface OperationOptions extends ExecutionOptions {
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
}

/**
 * Options accepted by generateStrings().
 */
export interface GenerateStringsOptions extends ExecutionOptions {
  /**
   * Order in which the paths (shapes) of the language are scheduled.
   * Defaults to sweep.
   */
  pathOrder?: PathOrder | "sweep" | "interleave" | "shuffled";
  /**
   * Order in which the strings within each path are produced. Defaults to
   * ascending.
   */
  characterOrder?: CharacterOrder | "ascending" | "shuffled";
  /**
   * Seed behind the shuffled modes. The default seed is fixed, so two calls
   * sharing a seed generate the same strings and `offset` pages through them
   * consistently.
   */
  seed?: number;
  /**
   * Shortest string to generate. Shorter strings are left out of the
   * enumeration entirely, `offset` never counting them.
   */
  minLength?: number;
  /**
   * Longest string to generate.
   */
  maxLength?: number;
  /**
   * Restricts generation to the given characters, e.g. `[a-z]`. Paths
   * requiring a character outside it are dropped.
   */
  charset?: string;
}

export class RegexSolverClient {
  private readonly apiToken: string;
  private readonly accountApi: AccountApi;
  private readonly analyzeApi: AnalyzeApi;
  private readonly computeApi: ComputeApi;
  private readonly generateApi: GenerateApi;
  private readonly axiosInstance: AxiosInstance;
  private readonly rateLimiter: RateLimiter;
  private readonly autoBatch: boolean;
  private readonly maxTermsPerRequest: number | null;
  private limitsPromise: Promise<AccountLimits> | null = null;
  private serverMaxTerms: number | null = null;

  constructor(config: RegexSolverConfig) {
    if (!config.apiToken) {
      throw new Error("apiToken is required");
    }
    if (
      config.maxTermsPerRequest !== undefined &&
      config.maxTermsPerRequest < 2
    ) {
      throw new Error("maxTermsPerRequest must be at least 2");
    }

    this.apiToken = config.apiToken;
    const baseUrl = config.baseUrl || "https://api.regexsolver.com/v1";
    this.rateLimiter = getRateLimiter(this.apiToken);
    this.autoBatch = config.autoBatch ?? true;
    this.maxTermsPerRequest = config.maxTermsPerRequest ?? null;

    const axiosConfig = {
      baseURL: baseUrl,
      headers: {
        "User-Agent": `RegexSolver JS / ${VERSION}`,
        Authorization: `Bearer ${this.apiToken}`,
      },
    };

    this.axiosInstance = axios.create(axiosConfig);

    const apiConfiguration = new Configuration({
      accessToken: this.apiToken,
      basePath: baseUrl,
    });

    this.accountApi = new AccountApi(
      apiConfiguration,
      baseUrl,
      this.axiosInstance,
    );
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
    let attempt = 0;
    let firstFailureAt: number | null = null;

    while (true) {
      await this.rateLimiter.wait();
      if (attempt > 0) {
        const jitterS =
          Math.random() * Math.min(JITTER_BASE_S * 2 ** attempt, JITTER_CAP_S);
        await new Promise((resolve) => setTimeout(resolve, jitterS * 1000));
      }
      try {
        return await apiCall();
      } catch (error) {
        if (!(axios.isAxiosError(error) && error.response)) {
          throw error;
        }
        if (error.response.status !== 429) {
          throw this.mapError(error);
        }

        const retryAfter =
          parseFloat(error.response.headers["retry-after"]) ||
          DEFAULT_RETRY_AFTER_S;
        const now = Date.now();
        firstFailureAt = firstFailureAt ?? now;
        if (now - firstFailureAt + retryAfter * 1000 > RETRY_BUDGET_MS) {
          throw this.mapError(error);
        }

        this.rateLimiter.trigger(retryAfter);
        attempt += 1;
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
        if (errorCode === "TooFewTerms")
          return new Exceptions.TooFewTermsError(
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
        if (errorCode === "FairSyntaxError")
          return new Exceptions.FairSyntaxError(
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

  // --- ACCOUNT OPERATIONS ---

  /**
   * Fetches the plan limits applying to the account.
   *
   * The call never consumes request quota (it is only rate-limited) and the
   * result is cached on the client, so calling it again is free. The cached
   * maxTermsCount also drives auto-batching.
   * @returns The five plan limits.
   */
  public async getAccountLimits(): Promise<AccountLimits> {
    if (!this.limitsPromise) {
      this.limitsPromise = this.executeWithRetry(() =>
        this.accountApi.limits(),
      )
        .then((response) => {
          const limits = AccountLimits.fromDto(response.data.data!);
          this.serverMaxTerms = limits.maxTermsCount;
          return limits;
        })
        .catch((error) => {
          this.limitsPromise = null;
          throw error;
        });
    }
    return this.limitsPromise;
  }

  // --- AUTO-BATCHING ---

  /** The largest term count to send in one request, when known. */
  private effectiveMaxTerms(): number | null {
    if (this.maxTermsPerRequest !== null) {
      return this.serverMaxTerms !== null
        ? Math.min(this.maxTermsPerRequest, this.serverMaxTerms)
        : this.maxTermsPerRequest;
    }
    return this.serverMaxTerms;
  }

  /**
   * Run an n-ary operation (concat/intersection/union), transparently
   * splitting the terms into several requests when they exceed the account's
   * terms-per-request limit (auto-batching).
   */
  private async runNary(
    terms: Term[],
    options: OperationOptions | undefined,
    apiCall: (request: MultiTermsRequest) => Promise<AxiosResponse<any>>,
  ): Promise<Term> {
    // Intermediate results are fed straight back into the next request, so
    // only the final call carries the caller's response options;
    // executionTimeout bounds every constituent request.
    const call = async (batch: Term[], final: boolean): Promise<Term> => {
      const request: MultiTermsRequest = {
        terms: batch.map((t) => t.toDto()),
        options: this.buildOptions(
          final ? options : { executionTimeout: options?.executionTimeout },
        ),
      };
      const response = await this.executeWithRetry(() => apiCall(request));
      return Term.fromDto(response.data.data);
    };

    let maxTerms = this.autoBatch ? this.effectiveMaxTerms() : null;
    if (maxTerms !== null && terms.length > maxTerms) {
      return this.fold(call, terms, maxTerms);
    }

    try {
      return await call(terms, true);
    } catch (error) {
      if (
        !this.autoBatch ||
        maxTerms !== null ||
        !(error instanceof Exceptions.TooManyTermsError)
      ) {
        throw error;
      }
      try {
        await this.getAccountLimits();
      } catch {
        throw error; // fall back to surfacing the original TooManyTerms
      }
      maxTerms = this.effectiveMaxTerms();
      if (maxTerms === null || maxTerms < 2 || terms.length <= maxTerms) {
        throw error;
      }
      return this.fold(call, terms, maxTerms);
    }
  }

  /**
   * Left fold: combine the first `maxTerms` terms, then keep feeding the
   * accumulated result back with the next `maxTerms - 1` terms.
   * Left-associative, so concat order is preserved; union and intersection
   * are commutative and unaffected.
   */
  private async fold(
    call: (batch: Term[], final: boolean) => Promise<Term>,
    terms: Term[],
    maxTerms: number,
  ): Promise<Term> {
    let acc = await call(terms.slice(0, maxTerms), false);
    let index = maxTerms;
    while (index < terms.length) {
      const batch = [acc, ...terms.slice(index, index + maxTerms - 1)];
      index += maxTerms - 1;
      acc = await call(batch, index >= terms.length);
    }
    return acc;
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
    options?: ExecutionOptions,
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
    options?: ExecutionOptions,
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
    options?: ExecutionOptions,
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
    options?: ExecutionOptions,
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
    options?: ExecutionOptions,
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
    options?: ExecutionOptions,
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
    options?: ExecutionOptions,
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
    options?: ExecutionOptions,
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
    options?: ExecutionOptions,
  ): Promise<string> {
    const existingPattern = term.getCachedPattern();
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
  public async getDot(term: Term, options?: ExecutionOptions): Promise<string> {
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
    return this.runNary(terms, options, (request) =>
      this.computeApi.concat(request),
    );
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
    return this.runNary(terms, options, (request) =>
      this.computeApi.intersection(request),
    );
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
    return this.runNary(terms, options, (request) =>
      this.computeApi.union(request),
    );
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
    options?: ExecutionOptions,
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
   * @param options Options object (ordering, seed, length bounds, charset, executionTimeout).
   * @returns Array of unique strings.
   */
  public async generateStrings(
    term: Term,
    limit: number,
    offset: number,
    options?: GenerateStringsOptions,
  ): Promise<string[]> {
    const request: GenerateStringsRequest = {
      term: term.toDto(),
      limit,
      offset,
      options: this.buildOptions(options),
    };
    if (options?.pathOrder !== undefined) {
      request.pathOrder = options.pathOrder as GenerateStringsRequest["pathOrder"];
    }
    if (options?.characterOrder !== undefined) {
      request.characterOrder =
        options.characterOrder as GenerateStringsRequest["characterOrder"];
    }
    if (options?.seed !== undefined) {
      request.seed = options.seed;
    }
    if (options?.minLength !== undefined) {
      request.minLength = options.minLength;
    }
    if (options?.maxLength !== undefined) {
      request.maxLength = options.maxLength;
    }
    if (options?.charset !== undefined) {
      request.charset = options.charset;
    }

    const response = await this.executeWithRetry(() =>
      this.generateApi.strings(request),
    );

    return response.data.data.strings.value;
  }
}
