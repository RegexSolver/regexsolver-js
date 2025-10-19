import axios, { AxiosInstance } from "axios";
import { Cardinality, Details, Length } from "./details";

export class RegexSolver {
    private static instance: RegexSolver;
    private apiClient: AxiosInstance;

    private constructor() {
        if (!RegexSolver.instance) {
            RegexSolver.instance = this;
        }
        return RegexSolver.instance;
    }

    static getInstance() {
        if (!RegexSolver.instance) {
            RegexSolver.instance = new RegexSolver();
        }
        return RegexSolver.instance;
    }

    static initialize(apiToken: string = null, baseURL: string = null) {
        const instance = RegexSolver.getInstance();
        if (!apiToken) {
            apiToken = process.env.REGEXSOLVER_API_TOKEN;
        }
        if (!baseURL) {
            baseURL = process.env.REGEXSOLVER_BASE_URL;
            if (!baseURL) {
                baseURL = "https://api.regexsolver.com/"
            }
        }
        instance.apiClient = axios.create({
            baseURL,
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'User-Agent': 'RegexSolver JS / 1.1.0',
            }
        });
    }

    // Analyze

    analyzeDetails(term: Term): Promise<Details> {
        return this.apiClient.post('/api/analyze/details', term)
            .then(response => loadDetails(response.data))
            .catch(error => { throw new ApiError(error.message) });
    }

    analyzeCardinality(term: Term): Promise<Cardinality> {
        return this.apiClient.post('/api/analyze/cardinality', term)
            .then(response => loadCardinality(response.data))
            .catch(error => { throw new ApiError(error.message) });
    }

    analyzeLength(term: Term): Promise<Length> {
        return this.apiClient.post('/api/analyze/length', term)
            .then(response => loadLength(response.data))
            .catch(error => { throw new ApiError(error.message) });
    }

    analyzeEquivalent(request: MultiTermsRequest): Promise<boolean> {
        return this.apiClient.post('/api/analyze/equivalent', request)
            .then(response => response.data.value)
            .catch(error => { throw new ApiError(error.message) });
    }

    analyzeSubset(request: MultiTermsRequest): Promise<boolean> {
        return this.apiClient.post('/api/analyze/subset', request)
            .then(response => response.data.value)
            .catch(error => { throw new ApiError(error.message) });
    }

    analyzeEmpty(request: Term): Promise<boolean> {
        return this.apiClient.post('/api/analyze/empty', request)
            .then(response => response.data.value)
            .catch(error => { throw new ApiError(error.message) });
    }

    analyzeTotal(request: Term): Promise<boolean> {
        return this.apiClient.post('/api/analyze/total', request)
            .then(response => response.data.value)
            .catch(error => { throw new ApiError(error.message) });
    }

    analyzeEmptyString(request: Term): Promise<boolean> {
        return this.apiClient.post('/api/analyze/empty_string', request)
            .then(response => response.data.value)
            .catch(error => { throw new ApiError(error.message) });
    }

    analyzeDot(request: Term): Promise<string> {
        return this.apiClient.post('/api/analyze/dot', request)
            .then(response => response.data.value)
            .catch(error => { throw new ApiError(error.message) });
    }

    analyzePattern(request: Term): Promise<string> {
        return this.apiClient.post('/api/analyze/pattern', request)
            .then(response => response.data.value)
            .catch(error => { throw new ApiError(error.message) });
    }

    // Compute

    computeRepeat(request: RepeatRequest): Promise<Term> { // todo
        return this.apiClient.post<TermTransient>('/api/compute/repeat', request)
            .then(response => loadTerm(response.data))
            .catch(error => { throw new ApiError(error.message) });
    }

    computeIntersection(request: MultiTermsRequest): Promise<Term> {
        return this.apiClient.post<TermTransient>('/api/compute/intersection', request)
            .then(response => loadTerm(response.data))
            .catch(error => { throw new ApiError(error.message) });
    }

    computeUnion(request: MultiTermsRequest): Promise<Term> {
        return this.apiClient.post<TermTransient>('/api/compute/union', request)
            .then(response => loadTerm(response.data))
            .catch(error => { throw new ApiError(error.message) });
    }

    computeDifference(request: MultiTermsRequest): Promise<Term> {
        return this.apiClient.post<TermTransient>('/api/compute/difference', request)
            .then(response => loadTerm(response.data))
            .catch(error => { throw new ApiError(error.message) });
    }

    computeConcat(request: MultiTermsRequest): Promise<Term> {
        return this.apiClient.post<TermTransient>('/api/compute/concat', request)
            .then(response => loadTerm(response.data))
            .catch(error => { throw new ApiError(error.message) });
    }

    // Generate

    generateStrings(request: GenerateStringsRequest): Promise<string[]> {
        return this.apiClient.post('/api/generate/strings', request)
            .then(response => response.data.value)
            .catch(error => { throw new ApiError(error.message) });
    }
}

export type TermType = "fair" | "regex";

interface OperationOptions {
    responseFormat?: ResponseFormat;
    executionTimeout?: number;
}
export class Term {
    readonly type: TermType;
    readonly value: string;

    private details?: Details;
    private cardinality?: Cardinality;
    private length?: Length;
    private empty?: boolean;
    private total?: boolean;
    private emptyString?: boolean;
    private dot?: string;
    private pattern?: string;

    constructor(
        type: TermType,
        value: string
    ) {
        this.type = type;
        this.value = value;
    }

    /**
     * Initialize a Fast Automaton Internal Representation (FAIR).
     */
    static fair(fair: string): Term {
        return new Term("fair", fair);
    }

    /**
     * Initialize a regex.
     */
    static regex(pattern: string): Term {
        return new Term("regex", pattern);
    }

    // Analyze

    /**
     * Check whether this term is equivalent to another.
     * 
     * @param term The term to compare against.
     * @param opts Execution options.
     * 
     * @returns `true` if both terms accept exactly the same language.
     */
    async equivalent(term: Term, opts?: OperationOptions): Promise<boolean> {
        const options = RequestOptionsBuilder.fromArgs({ execution_timeout: opts?.executionTimeout });
        return await RegexSolver.getInstance().analyzeEquivalent({ terms: [this, term], options });
    }

    /**
     * Get the cardinality of this term.
     * 
     * Results are cached on the instance to avoid repeated API calls.
     * 
     * @returns A `Cardinality` object describing how many distinct strings are matched. 
     */
    async getCardinality(): Promise<Cardinality> {
        if (this.cardinality) {
            return this.cardinality;
        } else if (this.details) {
            return this.details.cardinality;
        }
        this.cardinality = await RegexSolver.getInstance().analyzeCardinality(this);
        return this.cardinality;
    }

    /**
     * Analyze this term and return detailed information including cardinality, length, and whether it is empty or total.
     * 
     * Results are cached on the instance to avoid repeated API calls.
     */
    async getDetails(): Promise<Details> {
        if (this.details) {
            return this.details;
        }
        this.details = await RegexSolver.getInstance().analyzeDetails(this);
        return this.details;
    }

    /**
     * Get the GraphViz DOT representation of this term.
     * 
     * Results are cached on the instance to avoid repeated API calls.
     * 
     * @returns A DOT language string describing the automaton for this term.
     */
    async getDot(): Promise<string> {
        if (this.dot) {
            return this.dot;
        }
        this.dot = await RegexSolver.getInstance().analyzeDot(this);
        return this.dot;
    }

    /**
     * Return the Fast Automaton Internal Representation (FAIR).
     */
    getFair(): string | null {
        return this.type === "fair" ? this.value : null;
    }

    /**
     * Get the length bounds of this term.
     * 
     * Results are cached on the instance to avoid repeated API calls.
     * 
     * @returns A `Length` object with the minimum and maximum string length matched by this term.
     */
    async getLength(): Promise<Length> {
        if (this.length) {
            return this.length;
        } else if (this.details) {
            return this.details.length;
        }
        this.length = await RegexSolver.getInstance().analyzeLength(this);
        return this.length;
    }

    /**
     * Return the regular expression pattern.
     * 
     * If the term is not a regex the pattern will be resolved.
     * 
     * Results are cached on the instance to avoid repeated API calls.
     */
    async getPattern(): Promise<string> {
        if (this.type === "regex") return this.value;
        if (this.pattern) return this.pattern;
        this.pattern = await RegexSolver.getInstance().analyzePattern(this);
        return this.pattern;
    }

    getType(): TermType {
        return this.type;
    }

    /**
     * Check whether this term matches no string.
     * 
     * Results are cached on the instance to avoid repeated API calls.
     */
    async isEmpty(): Promise<boolean> {
        if (this.empty) {
            return this.empty;
        } else if (this.details) {
            return this.details.empty;
        }
        this.empty = await RegexSolver.getInstance().analyzeEmpty(this);
        return this.empty;
    }

    /**
     * Check whether this term matches only the empty string.
     * 
     * Results are cached on the instance to avoid repeated API calls.
     */
    async isEmptyString(): Promise<boolean> {
        if (this.emptyString) {
            return this.emptyString;
        }
        this.emptyString = await RegexSolver.getInstance().analyzeEmptyString(this);
        return this.emptyString;
    }

    /**
     * Check whether this term matches all possible strings.
     * 
     * Results are cached on the instance to avoid repeated API calls.
     */
    async isTotal(): Promise<boolean> {
        if (this.total) {
            return this.total;
        } else if (this.details) {
            return this.details.total;
        }
        this.total = await RegexSolver.getInstance().analyzeTotal(this);
        return this.total;
    }

    /**
     * Check whether this term is a subset of another.
     * 
     * @param term The term to compare against.
     * @param opts Execution options.
     * @returns `true` if every string matched by this term is also matched by `term`.
     */
    async subset(term: Term, opts?: OperationOptions): Promise<boolean> {
        const options = RequestOptionsBuilder.fromArgs({ execution_timeout: opts?.executionTimeout });
        return await RegexSolver.getInstance().analyzeSubset({ terms: [this, term], options });
    }

    // Compute

    private getMultiTermsRequest(args: (Term | OperationOptions)[]): MultiTermsRequest {
        const last = args[args.length - 1];
        let options: RequestOptions;
        let terms: Term[];
        if (last instanceof Term) {
            options = undefined;
            terms = args as Term[];
        } else {
            options = RequestOptionsBuilder.fromArgs({ response_format: last.responseFormat, execution_timeout: last.executionTimeout });
            terms = args.slice(0, -1) as Term[];
        }

        return { terms: [this, ...terms], options };
    }

    /**
     * Concatenate this term with one or more other terms.
     * 
     * @returns A new term representing the concatenation.
     */
    async concat(t1: Term, ...rest: Term[]): Promise<Term>;
    async concat(t1: Term, ...termsAndOpts: [...terms: Term[], opts: OperationOptions]): Promise<Term>;
    async concat(...args: (Term | OperationOptions)[]): Promise<Term> {
        return await RegexSolver.getInstance().computeConcat(this.getMultiTermsRequest(args));
    }

    /**
     * Compute the difference between this term and another.
     * 
     * @returns A new term representing the set difference (this - term).
     */
    async difference(term: Term, opts?: OperationOptions): Promise<Term> {
        const options = RequestOptionsBuilder.fromArgs({ response_format: opts?.responseFormat, execution_timeout: opts?.executionTimeout });
        return await RegexSolver.getInstance().computeDifference({ terms: [this, term], options });
    }

    /**
     * Compute the intersection of this term with one or more other terms.
     * 
     * @returns A new term representing the intersection.
     */
    async intersection(t1: Term, ...rest: Term[]): Promise<Term>;
    async intersection(t1: Term, ...termsAndOpts: [...terms: Term[], opts: OperationOptions]): Promise<Term>;
    async intersection(...args: (Term | OperationOptions)[]): Promise<Term> {
        return await RegexSolver.getInstance().computeIntersection(this.getMultiTermsRequest(args));
    }

    /**
     * Computes the repetition of the term between `min` and `max` times; if `max` is `null`, the repetition is unbounded.
     * 
     * @param min The lower bound of the repetition.
     * @param max The upper bound of the repetition, if `null` the repetition is unbounded.
     * @param opts Execution options.
     * @returns A new term representing the repetition.
     */
    async repeat(min: number, max?: number | null, opts?: OperationOptions): Promise<Term> {
        const options = RequestOptionsBuilder.fromArgs({ response_format: opts.responseFormat, execution_timeout: opts.executionTimeout });
        return await RegexSolver.getInstance().computeRepeat({ term: this, min, max, options });
    }

    /**
     * Compute the union of this term with one or more other terms.
     * 
     * @returns A new term representing the union.
     */
    async union(t1: Term, ...rest: Term[]): Promise<Term>;
    async union(t1: Term, ...termsAndOpts: [...terms: Term[], opts: OperationOptions]): Promise<Term>;
    async union(...args: (Term | OperationOptions)[]): Promise<Term> {
        return await RegexSolver.getInstance().computeUnion(this.getMultiTermsRequest(args));
    }

    // Generate

    /**
     * Generate up to `count` example strings that match this term.
     * 
     * @param count Maximum number of unique strings to generate.
     * @param opts Execution options.
     * @returns A list of strings matched by this term.
     */
    async generateStrings(count: number, opts?: OperationOptions): Promise<string[]> {
        const options = RequestOptionsBuilder.fromArgs({ execution_timeout: opts?.executionTimeout });
        return await RegexSolver.getInstance().generateStrings({ term: this, count, options });
    }

    // Others

    /**
     * @returns a string representation of this term in the format `<type>=<value>`, which can later be parsed by `deserialize()`.
     */
    serialize(): string {
        return `${this.type}=${this.value}`;
    }

    /**
     * Parse a string representation produced by `serialize()`.
     * 
     * @param input The serialized term, e.g. `"regex=abc"`.
     * @returns A Term instance, or `null` if the input is empty or invalid.
     */
    static deserialize(input: string | null | undefined): Term | null {
        if (!input || !input.includes("=")) return null;
        let pos = input.indexOf("=");
        const [prefix, value] = [input.slice(0, pos), input.slice(pos + 1)];
        if (prefix === "regex") return Term.regex(value);
        if (prefix === "fair") return Term.fair(value);
        return null;
    }

    toString(): string {
        return this.serialize();
    }
}

interface TermTransient {
    type: TermType;
    value: string;
}

function loadTerm(term: TermTransient): Term {
    return new Term(term.type, term.value);
}

interface TransientDetails {
    cardinality: Cardinality;
    length: number[];
    empty: boolean;
    total: boolean;
}

function loadDetails(data: TransientDetails): Details {
    const cardinality = new Cardinality(data.cardinality.type, data.cardinality.value);
    const length = new Length(data.length[0], data.length[1]);

    return new Details(cardinality, length, data.empty, data.total);
}

function loadCardinality(data: Cardinality): Cardinality {
    return new Cardinality(data.type, data.value);
}

function loadLength(data: { min: number, max?: number | null }): Length {
    return new Length(data.min, data.max);
}

export class ApiError extends Error {
    constructor(message: string) {
        super("The API returned the following error: " + message);
    }
}

export enum ResponseFormat {
    ANY = 'any',
    REGEX = 'regex',
    FAIR = 'fair'
};

interface ResponseOptions {
    format?: ResponseFormat;
}

interface ExecutionOptions {
    timeout?: number;
}

interface RequestOptions {
    schema_version?: number;
    response?: ResponseOptions;
    execution?: ExecutionOptions;
}

interface MultiTermsRequest {
    terms: Term[];
    options?: RequestOptions;
}

interface GenerateStringsRequest {
    term: Term;
    count: number;
    options?: RequestOptions;
}

interface RepeatRequest {
    term: Term;
    min: number;
    max?: number | null;
    options?: RequestOptions;
}

class RequestOptionsBuilder {
    static fromArgs(args?: { response_format?: ResponseFormat | null; execution_timeout?: number | null }): RequestOptions | undefined {
        const response = args?.response_format ? { format: args.response_format } : undefined;
        const execution = args?.execution_timeout ? { timeout: args.execution_timeout } : undefined;
        if (response || execution) {
            return {
                schema_version: 1,
                response,
                execution,
            };
        }
        return undefined;
    }
}