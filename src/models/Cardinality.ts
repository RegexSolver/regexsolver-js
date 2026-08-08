import { Cardinality as CardinalityDto } from "../generated";
import { TermPropertiesMixin } from "./TermPropertiesMixin";

export abstract class Cardinality extends TermPropertiesMixin {
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

/** Indicates that the set of matched strings is infinite. */
export class Infinite extends Cardinality {
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

/** Indicates that the set of matched strings is finite but too large to be returned as a standard integer. */
export class BigInteger extends Cardinality {
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

/** Indicates that the set of matched strings is finite and exactly calculable.
 * @param value The exact count of uniquely matched strings.
 */
export class Integer extends Cardinality {
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
