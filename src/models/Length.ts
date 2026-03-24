import { Length as LengthDto } from "../generated";
import { TermPropertiesMixin } from "./TermPropertiesMixin";

/**
 * Represents the minimum and maximum lengths of any string matched by the term.
 */
export class Length extends TermPropertiesMixin {
  /** The shortest possible matched string length, or null if the language is empty. */
  public readonly min: number | null;
  /** The longest possible matched string length, or null if the length is unbounded. */
  public readonly max: number | null;

  constructor(min: number | null = null, max: number | null = null) {
    super();
    this.min = min;
    this.max = max;
  }

  public static fromDto(dto: LengthDto): Length {
    return new Length(dto.min, dto.max);
  }

  public toString(): string {
    return `<Length: min=${this.min}, max=${this.max}>`;
  }

  public isEmpty(): boolean | undefined {
    return this.min === null && this.max === null;
  }

  public isEmptyString(): boolean | undefined {
    return this.min === 0 && this.max === 0;
  }

  public isTotal(): boolean | undefined {
    if (this.min !== 0 || this.max !== null) {
      return false;
    } else {
      return undefined;
    }
  }

  public isInfinite(): boolean {
    return this.min !== null && this.max === null;
  }
}
