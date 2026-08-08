/**
 * A mixin providing default property inference for Term analytics.
 *
 * Returns `undefined` when a property cannot be strictly inferred from the current data alone.
 */
export abstract class TermPropertiesMixin {
  /**
   * Infers whether the term matches no strings at all.
   *
   * @returns {boolean | undefined} True if it definitely matches no strings, False if it matches at least one, or undefined if it cannot be inferred.
   */
  public isEmpty(): boolean | undefined {
    return undefined;
  }

  /**
   * Infers whether the term matches strictly the empty string ("").
   *
   * @returns {boolean | undefined} True if it definitely matches only the empty string, False if it matches other strings, or undefined if it cannot be inferred.
   */
  public isEmptyString(): boolean | undefined {
    return undefined;
  }

  /**
   * Infers whether the term matches all possible strings.
   *
   * @returns {boolean | undefined} True if it definitely matches all strings, False if it misses at least one string, or undefined if it cannot be inferred.
   */
  public isTotal(): boolean | undefined {
    return undefined;
  }
}
