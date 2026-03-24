import { Length as LengthDto } from "../generated";

export class Length {
  public readonly min: number | null;
  public readonly max: number | null;

  constructor(min: number | null, max: number | null) {
    this.min = min;
    this.max = max;
  }

  public static fromDto(dto: LengthDto): Length {
    return new Length(dto.min, dto.max);
  }

  public isEmpty(): boolean {
    return this.min === null;
  }

  public isInfinite(): boolean {
    return this.max === null;
  }
}
