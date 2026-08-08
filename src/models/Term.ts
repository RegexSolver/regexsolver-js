import { Term as TermDto, TermFair, TermRegex } from "../generated";
import { Cardinality } from "./Cardinality";
import { Length } from "./Length";
import { TermPropertiesMixin } from "./TermPropertiesMixin";

/** How the engine renders a language that matches no string at all. */
const EMPTY_LANGUAGE_PATTERN = "[]";

/**
 * Represents a mathematical term (Regex or FAIR) on which operations can be performed.
 */
export abstract class Term {
  private readonly value: string;

  // Shared Cache (Internal)
  private _cardinality: Cardinality | null = null;
  private _length: Length | null = null;
  private _empty: boolean | null = null;
  private _emptyString: boolean | null = null;
  private _total: boolean | null = null;
  protected _pattern: string | null = null;
  private _dot: string | null = null;

  private _compiledRegex: RegExp | null = null;

  protected constructor(value: string) {
    this.value = value;
  }

  public abstract getPattern(): string | null;
  public abstract getFair(): string | null;
  public abstract toDto(): TermDto;
  public abstract serialize(): string;

  public static regex(pattern: string): Term {
    return new RegexTerm(pattern);
  }

  public static fair(payload: string): Term {
    return new FairTerm(payload, null);
  }

  // --- Shared Behavior ---

  public getValue(): string {
    return this.value;
  }

  public _setPropertiesMixin(propertiesMixin: TermPropertiesMixin): void {
    const empty = propertiesMixin.isEmpty();
    if (empty !== null && empty !== undefined) {
      this.setCachedEmpty(empty);
    }

    const emptyString = propertiesMixin.isEmptyString();
    if (emptyString !== null && emptyString !== undefined) {
      this.setCachedEmptyString(emptyString);
    }

    const total = propertiesMixin.isTotal();
    if (total !== null && total !== undefined) {
      this.setCachedTotal(total);
    }
  }

  public matches(str: string): boolean {
    const pattern = this.getPattern();
    if (pattern === null) {
      throw new Error(
        "The regex pattern of this term is not defined yet, call getPattern() on the client to set it.",
      );
    }

    // The engine renders the empty language as "[]". By definition it matches
    // nothing, and other engines reject the pattern outright.
    if (pattern === EMPTY_LANGUAGE_PATTERN) {
      return false;
    }

    if (this._compiledRegex === null) {
      try {
        this._compiledRegex = new RegExp(`^(?:${pattern})$`, "s");
      } catch (e: any) {
        throw new Error(
          `Pattern '${pattern}' cannot be evaluated by JavaScript's RegExp module: ${e.message}`,
        );
      }
    }

    return this._compiledRegex.test(str);
  }

  public static deserialize(
    serialized: string | null | undefined,
  ): Term | null {
    if (!serialized || !serialized.includes("=")) {
      return null;
    }

    const index = serialized.indexOf("=");
    const typeStr = serialized.substring(0, index);
    const val = serialized.substring(index + 1);

    if (typeStr.toLowerCase() === "regex") {
      return Term.regex(val);
    } else if (typeStr.toLowerCase() === "fair") {
      return Term.fair(val);
    }
    return null;
  }

  public static fromDto(dto: TermDto): Term {
    if (dto.type === "regex") {
      return Term.regex(dto.value);
    } else {
      return new FairTerm(dto.value, dto.metadata?.deterministic ?? null);
    }
  }

  // --- Cache Getters and Setters ---

  public getCachedCardinality(): Cardinality | null {
    return this._cardinality;
  }
  public setCachedCardinality(cardinality: Cardinality | null): void {
    this._cardinality = cardinality;
  }

  public getCachedLength(): Length | null {
    return this._length;
  }
  public setCachedLength(length: Length | null): void {
    this._length = length;
  }

  public getCachedEmpty(): boolean | null {
    return this._empty;
  }
  public setCachedEmpty(empty: boolean | null): void {
    this._empty = empty;
  }

  public getCachedEmptyString(): boolean | null {
    return this._emptyString;
  }
  public setCachedEmptyString(emptyString: boolean | null): void {
    this._emptyString = emptyString;
  }

  public getCachedTotal(): boolean | null {
    return this._total;
  }
  public setCachedTotal(total: boolean | null): void {
    this._total = total;
  }

  public getCachedPattern(): string | null {
    return this._pattern;
  }
  public setCachedPattern(pattern: string | null): void {
    this._pattern = pattern;
  }

  public getCachedDot(): string | null {
    return this._dot;
  }
  public setCachedDot(dot: string | null): void {
    this._dot = dot;
  }

  public equals(other: any): boolean {
    if (this === other) return true;
    if (!(other instanceof Term)) return false;
    return this.serialize() === other.serialize();
  }

  public toString(): string {
    return this.serialize();
  }
}

export class RegexTerm extends Term {
  constructor(value: string) {
    super(value);
  }

  public getPattern(): string | null {
    return this.getValue();
  }

  public getFair(): string | null {
    return null;
  }

  public toDto(): TermDto {
    return { type: "regex", value: this.getValue() } as TermRegex;
  }

  public serialize(): string {
    return "regex=" + this.getValue();
  }
}

export class FairTerm extends Term {
  private _deterministic: boolean | null = null;

  constructor(value: string, deterministic: boolean | null) {
    super(value);
    this._deterministic = deterministic;
  }

  public getPattern(): string | null {
    return this._pattern;
  }

  public getFair(): string | null {
    return this.getValue();
  }

  public toDto(): TermDto {
    return { type: "fair", value: this.getValue() } as TermFair;
  }

  public serialize(): string {
    return "fair=" + this.getValue();
  }

  public getCachedDeterministic(): boolean | null {
    return this._deterministic;
  }

  public setCachedDeterministic(deterministic: boolean | null) {
    this._deterministic = deterministic;
  }
}
