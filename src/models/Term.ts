import { Term as TermDto, TermFair, TermRegex } from "../generated";
import { Cardinality } from "./Cardinality";
import { Length } from "./Length";

export class Term {
  public readonly type: "regex" | "fair";
  public readonly value: string;

  // Cache
  /** @internal */
  public _cardinality: Cardinality | null = null;
  /** @internal */
  public _length: Length | null = null;
  /** @internal */
  public _empty: boolean | null = null;
  /** @internal */
  public _emptyString: boolean | null = null;
  /** @internal */
  public _total: boolean | null = null;
  /** @internal */
  public _pattern: string | null = null;
  /** @internal */
  public _dot: string | null = null;
  /** @internal */
  public _stableTerm: Term | null = null;

  constructor(type: "regex" | "fair", value: string) {
    this.type = type;
    this.value = value;
  }

  public static fair(payload: string): Term {
    return new Term("fair", payload);
  }

  public static regex(pattern: string): Term {
    return new Term("regex", pattern);
  }

  public getFair(): string | null {
    return this.type === "fair" ? this.value : null;
  }

  public getPattern(): string | null {
    return this.type === "regex" ? this.value : this._pattern;
  }

  public serialize(): string {
    return `${this.type}=${this.value}`;
  }

  public static deserialize(serialized: string): Term {
    const parts = serialized.split("=");
    if (parts.length < 2) {
      throw new Error("Invalid serialized term");
    }
    const type = parts[0] as "regex" | "fair";
    const value = parts.slice(1).join("=");
    return new Term(type, value);
  }

  public isMatch(str: string): boolean | null {
    const pattern = this.getPattern();
    if (pattern === null) {
      return null;
    }

    // Must be a "full match" (anchored). Dot (.) must match all characters including newlines.
    const regex = new RegExp(`^(${pattern})$`, "s");
    return regex.test(str);
  }

  public toDto(): TermDto {
    if (this.type === "regex") {
      return { type: "regex", value: this.value } as TermRegex;
    } else {
      return { type: "fair", value: this.value } as TermFair;
    }
  }

  public static fromDto(dto: TermDto): Term {
    return new Term(dto.type, dto.value);
  }
}
