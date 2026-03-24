import { Cardinality as CardinalityDto } from "../generated";

export class Cardinality {
  public readonly type: "integer" | "bigInteger" | "infinite";
  public readonly value: number | null;

  constructor(
    type: "integer" | "bigInteger" | "infinite",
    value: number | null = null,
  ) {
    this.type = type;
    this.value = value;
  }

  public static fromDto(dto: CardinalityDto): Cardinality {
    if (dto.type === "integer") {
      return new Cardinality("integer", dto.value);
    } else if (dto.type === "bigInteger") {
      return new Cardinality("bigInteger");
    } else {
      return new Cardinality("infinite");
    }
  }

  public isInfinite(): boolean {
    return this.type === "infinite";
  }

  public isBigInteger(): boolean {
    return this.type === "bigInteger";
  }

  public isInteger(): boolean {
    return this.type === "integer";
  }
}
