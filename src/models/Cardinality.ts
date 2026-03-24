import { Cardinality as CardinalityDto } from "../generated";
import { TermPropertiesMixin } from "./TermPropertiesMixin";

export abstract class Cardinality extends TermPropertiesMixin {
  /** Base class representing the number of unique strings matched by a term. */
  public abstract readonly type: "integer" | "bigInteger" | "infinite";

  public static fromDto(dto: CardinalityDto): Cardinality {
    if (dto.type === "integer") {
      return new Integer(dto.value as number);
    } else if (dto.type === "bigInteger") {
      return new BigInteger();
    } else {
      return new Infinite();
    }
  }

  public isEmpty(): boolean | undefined {
    return undefined;
  }

  public isEmptyString(): boolean | undefined {
    return undefined;
  }

  public isTotal(): boolean | undefined {
    return undefined;
  }

  public isInfinite(): this is Infinite {
    return this.type === "infinite";
  }

  public isBigInteger(): this is BigInteger {
    return this.type === "bigInteger";
  }

  public isInteger(): this is Integer {
    return this.type === "integer";
  }

  public toString(): string {
    return "<Cardinality>";
  }
}

export class Infinite extends Cardinality {
  /** Indicates that the set of matched strings is infinite. */
  public readonly type = "infinite";

  public isEmpty(): boolean | undefined {
    return false;
  }

  public isEmptyString(): boolean | undefined {
    return false;
  }

  public toString(): string {
    return "<Cardinality::Infinite>";
  }
}

export class BigInteger extends Cardinality {
  /** Indicates that the set of matched strings is finite but too large to be returned as a standard integer. */
  public readonly type = "bigInteger";

  public isEmpty(): boolean | undefined {
    return false;
  }

  public isEmptyString(): boolean | undefined {
    return false;
  }

  public isTotal(): boolean | undefined {
    return false;
  }

  public toString(): string {
    return "<Cardinality::BigInteger>";
  }
}

export class Integer extends Cardinality {
  /** * Indicates that the set of matched strings is finite and exactly calculable.
   * * @param value The exact count of uniquely matched strings.
   */
  public readonly type = "integer";
  public readonly value: number;

  constructor(value: number) {
    super();
    this.value = value;
  }

  public isEmpty(): boolean | undefined {
    return this.value === 0;
  }

  public isEmptyString(): boolean | undefined {
    if (this.value === 1) {
      return undefined;
    }
    return false;
  }

  public isTotal(): boolean | undefined {
    return false;
  }

  public toString(): string {
    return `<Cardinality::Integer(${this.value})>`;
  }
}
