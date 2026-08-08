/**
 * Order in which the paths of the language are scheduled when generating
 * strings — the *shapes* the term allows, as opposed to the characters
 * filling them.
 */
export enum PathOrder {
  /**
   * Expand one path in full, shortest first, before moving to the next one.
   * The cheapest way to page through a whole language.
   */
  SWEEP = "sweep",
  /**
   * Cover every path once before any path yields a second string. Best
   * suited to deriving test cases.
   */
  INTERLEAVE = "interleave",
  /**
   * Interleave with same-length paths visited in an order drawn from the
   * seed.
   */
  SHUFFLED = "shuffled",
}

/**
 * Order in which the strings within each path are produced when generating
 * strings. Orthogonal to PathOrder: it does not change *what* can be
 * generated, only which strings are reached first.
 */
export enum CharacterOrder {
  /**
   * Expand each position from the low end of its character range first — a
   * stable order returning the smallest witnesses of a path first.
   */
  ASCENDING = "ascending",
  /**
   * A permutation drawn from the seed, so the strings look like real inputs.
   * Random in look only — generation stays reproducible.
   */
  SHUFFLED = "shuffled",
}
