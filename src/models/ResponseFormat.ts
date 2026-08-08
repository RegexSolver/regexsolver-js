/**
 * Defines the format in which the engine should return computed Terms.
 */
export enum ResponseFormat {
  /**
   * Allows the engine to return the result in the most efficient format.
   */
  ANY = "any",
  /**
   * Fast Automaton Internal Representation, a stable internal format.
   */
  FAIR = "fair",
  /**
   * Standard regular expression pattern.
   */
  REGEX = "regex",
}
