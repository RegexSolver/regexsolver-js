import { AccountLimits as AccountLimitsDto } from "../generated";

/**
 * The plan limits currently applying to the account.
 */
export class AccountLimits {
  /** Maximum number of requests allowed per billing period. */
  public readonly maxRequestsCount: number;
  /** Maximum number of requests allowed per second. 0 means no rate limit is enforced. */
  public readonly maxRequestsRate: number;
  /** Maximum number of terms accepted in a single request. */
  public readonly maxTermsCount: number;
  /** Maximum execution timeout per request, in milliseconds. */
  public readonly maxTimeout: number;
  /** Maximum number of automaton states an operation may build. */
  public readonly maxStatesCount: number;

  constructor(
    maxRequestsCount: number,
    maxRequestsRate: number,
    maxTermsCount: number,
    maxTimeout: number,
    maxStatesCount: number,
  ) {
    this.maxRequestsCount = maxRequestsCount;
    this.maxRequestsRate = maxRequestsRate;
    this.maxTermsCount = maxTermsCount;
    this.maxTimeout = maxTimeout;
    this.maxStatesCount = maxStatesCount;
  }

  public static fromDto(dto: AccountLimitsDto): AccountLimits {
    return new AccountLimits(
      dto.maxRequestsCount,
      dto.maxRequestsRate,
      dto.maxTermsCount,
      dto.maxTimeout,
      dto.maxStatesCount,
    );
  }

  public toString(): string {
    return (
      `<AccountLimits: maxRequestsCount=${this.maxRequestsCount}, ` +
      `maxRequestsRate=${this.maxRequestsRate}, ` +
      `maxTermsCount=${this.maxTermsCount}, ` +
      `maxTimeout=${this.maxTimeout}, ` +
      `maxStatesCount=${this.maxStatesCount}>`
    );
  }
}
