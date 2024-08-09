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

    static initialize(apiToken, baseURL = null) {
        const instance = RegexSolver.getInstance();
        if (!baseURL) {
            baseURL = "https://api.regexsolver.com/"
        }
        instance.apiClient = axios.create({
            baseURL: baseURL,
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'User-Agent': 'RegexSolver Node.js / 1.0.3',
            }
        });
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

    computeSubtraction(request: MultiTermsRequest): Promise<Term> {
        return this.apiClient.post<TermTransient>('/api/compute/subtraction', request)
            .then(response => loadTerm(response.data))
            .catch(error => { throw new ApiError(error.message) });
    }

    getDetails(term: Term): Promise<Details> {
        return this.apiClient.post('/api/analyze/details', term)
            .then(response => loadDetails(response.data))
            .catch(error => { throw new ApiError(error.message) });
    }

    equivalence(request: MultiTermsRequest): Promise<boolean> {
        return this.apiClient.post('/api/analyze/equivalence', request)
            .then(response => response.data.value)
            .catch(error => { throw new ApiError(error.message) });
    }

    subset(request: MultiTermsRequest): Promise<boolean> {
        return this.apiClient.post('/api/analyze/subset', request)
            .then(response => response.data.value)
            .catch(error => { throw new ApiError(error.message) });
    }

    generateStrings(request: GenerateStringsRequest): Promise<string[]> {
        return this.apiClient.post('/api/generate/strings', request)
            .then(response => response.data.value)
            .catch(error => { throw new ApiError(error.message) });
    }
}

export class Term {
    private static readonly REGEX_PREFIX = 'regex';
    private static readonly FAIR_PREFIX = 'fair';
    private static readonly UNKNOWN_PREFIX = 'unknown';

    private details?: Details;
    constructor(
        private type: 'regex' | 'fair',
        private value: string
    ) {
    }

    static regex(pattern: string): Term {
        return new Term(Term.REGEX_PREFIX, pattern);
    }

    static fair(fair: string): Term {
        return new Term(Term.FAIR_PREFIX, fair);
    }

    getType(): 'regex' | 'fair' {
        return this.type;
    }

    getFair(): string | void {
        if (this.type == Term.FAIR_PREFIX) {
            return this.value;
        }
        return null;
    }

    getPattern(): string | void {
        if (this.type == Term.REGEX_PREFIX) {
            return this.value;
        }
        return null;
    }

    async getDetails(): Promise<Details> {
        if (this.details) {
            return this.details;
        }
        this.details = await RegexSolver.getInstance().getDetails(this);
        return this.details;
    }

    async generateStrings(count: number): Promise<string[]> {
        return await RegexSolver.getInstance().generateStrings({ term: this, count });
    }

    async intersection(...terms: Term[]): Promise<Term> {
        return await RegexSolver.getInstance().computeIntersection({ terms: [this, ...terms] });
    }

    async union(...terms: Term[]): Promise<Term> {
        return await RegexSolver.getInstance().computeUnion({ terms: [this, ...terms] });
    }

    async subtraction(term: Term): Promise<Term> {
        return await RegexSolver.getInstance().computeSubtraction({ terms: [this, term] });
    }

    async isEquivalentTo(term: Term): Promise<boolean> {
        return await RegexSolver.getInstance().equivalence({ terms: [this, term] });
    }

    async isSubsetOf(term: Term): Promise<boolean> {
        return await RegexSolver.getInstance().subset({ terms: [this, term] });
    }

    serialize(): string {
        let prefix = Term.UNKNOWN_PREFIX;
        if (this.type == Term.REGEX_PREFIX) {
            prefix = Term.REGEX_PREFIX;
        } else if (this.type == Term.FAIR_PREFIX) {
            prefix = Term.FAIR_PREFIX;
        }
        return prefix + "=" + this.value;
    }

    static deserialize(string: string): Term | void {
        if (string.startsWith(Term.REGEX_PREFIX)) {
            return Term.regex(string.substring(this.REGEX_PREFIX.length + 1));
        } else if (string.startsWith(Term.FAIR_PREFIX)) {
            return Term.fair(string.substring(this.FAIR_PREFIX.length + 1));
        }
        return null;
    }

    toString(): string {
        return this.serialize();
    }
}

interface TermTransient {
    type: 'regex' | 'fair';
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

export class ApiError extends Error {
    constructor(message: string) {
        super("The API returned the following error: " + message);
    }
}

interface MultiTermsRequest {
    terms: Term[];
}

interface GenerateStringsRequest {
    term: Term;
    count: number;
}