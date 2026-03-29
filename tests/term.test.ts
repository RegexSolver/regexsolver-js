import { Term, RegexTerm, FairTerm } from "../src/models/Term";
import { Integer } from "../src/models/Cardinality";

describe("Term", () => {
  test("creation should work", () => {
    const regexTerm = Term.regex("abc");
    expect(regexTerm).toBeInstanceOf(RegexTerm);
    expect(regexTerm.getValue()).toBe("abc");

    const fairTerm = Term.fair("payload");
    expect(fairTerm).toBeInstanceOf(FairTerm);
    expect(fairTerm.getValue()).toBe("payload");
  });

  test("getFair and getPattern should work", () => {
    const regexTerm = Term.regex("abc");
    expect(regexTerm.getPattern()).toBe("abc");
    expect(regexTerm.getFair()).toBeNull();

    const fairTerm = Term.fair("payload");
    expect(fairTerm.getFair()).toBe("payload");
    expect(fairTerm.getPattern()).toBeNull();

    fairTerm.setCachedPattern("abc");
    expect(fairTerm.getPattern()).toBe("abc");
  });

  test("isMatch should work for regex terms", () => {
    const term = Term.regex("[a-z]+");
    expect(term.isMatch("abc")).toBe(true);
    expect(term.isMatch("123")).toBe(false);
    expect(term.isMatch("ABC")).toBe(false);
  });

  test("isMatch should work with dotAll equivalent", () => {
    const term = Term.regex(".+");
    expect(term.isMatch("abc\ndef")).toBe(true);
  });

  test("isMatch should be anchored", () => {
    const term = Term.regex("abc");
    expect(term.isMatch("abcd")).toBe(false);
    expect(term.isMatch("xabc")).toBe(false);
  });

  test("isMatch should throw for fair terms without cached pattern", () => {
    const term = Term.fair("payload");
    expect(() => term.isMatch("abc")).toThrow(
      "The regex pattern of this term is not defined yet",
    );
  });

  test("serialize/deserialize should work", () => {
    const term = Term.regex("[a-z]+");
    const serialized = term.serialize();
    expect(serialized).toBe("regex=[a-z]+");

    const deserialized = Term.deserialize(serialized);
    if (deserialized === null) {
      fail("Deserialized term should not be null");
    }
    expect(deserialized).toBeInstanceOf(RegexTerm);
    expect(deserialized.getValue()).toBe("[a-z]+");

    const fairTerm = Term.fair("payload");
    const deserializedFair = Term.deserialize(fairTerm.serialize());
    expect(deserializedFair).toEqual(fairTerm);
  });

  test("deserialize should return null for invalid format", () => {
    expect(Term.deserialize("invalid")).toBeNull();
    expect(Term.deserialize("unknown=value")).toBeNull();
  });

  test("toDto should work", () => {
    const term = Term.regex("[a-z]+");
    const dto = term.toDto();
    expect(dto.type).toBe("regex");
    expect(dto.value).toBe("[a-z]+");
  });

  test("fromDto should work", () => {
    const dto = { type: "regex" as const, value: "[a-z]+" };
    const term = Term.fromDto(dto);
    expect(term).toBeInstanceOf(RegexTerm);
    expect(term.getValue()).toBe("[a-z]+");
  });
});
