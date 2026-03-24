import { Term } from "../src/models/Term";

describe("Term", () => {
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

  test("serialize/deserialize should work", () => {
    const term = Term.regex("[a-z]+");
    const serialized = term.serialize();
    expect(serialized).toBe("regex=[a-z]+");

    const deserialized = Term.deserialize(serialized);
    expect(deserialized.type).toBe("regex");
    expect(deserialized.value).toBe("[a-z]+");
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
    expect(term.type).toBe("regex");
    expect(term.value).toBe("[a-z]+");
  });
});
