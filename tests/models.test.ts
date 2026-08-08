import { BigInteger, Infinite, Integer } from "../src/models/Cardinality";
import { Length } from "../src/models/Length";

describe("Cardinality", () => {
  test("Integer should work", () => {
    const c = new Integer(10);
    expect(c.value).toBe(10);
    expect(c.isEmpty()).toBe(false);
    expect(c.isEmptyString()).toBe(false);
    expect(c.isTotal()).toBe(false);
    expect(c.toString()).toBe("<Cardinality::Integer(10)>");
  });

  test("Integer zero should work", () => {
    const c = new Integer(0);
    expect(c.isEmpty()).toBe(true);
    expect(c.isEmptyString()).toBe(false);
  });

  test("Integer one should work", () => {
    const c = new Integer(1);
    expect(c.isEmpty()).toBe(false);
    expect(c.isEmptyString()).toBe(undefined);
  });

  test("BigInteger should work", () => {
    const c = new BigInteger();
    expect(c.isEmpty()).toBe(false);
    expect(c.isEmptyString()).toBe(false);
    expect(c.isTotal()).toBe(false);
    expect(c.toString()).toBe("<Cardinality::BigInteger>");
  });

  test("Infinite should work", () => {
    const c = new Infinite();
    expect(c.isEmpty()).toBe(false);
    expect(c.isEmptyString()).toBe(false);
    expect(c.toString()).toBe("<Cardinality::Infinite>");
  });
});

describe("Length", () => {
  test("Length should work", () => {
    const l = new Length(1, 5);
    expect(l.min).toBe(1);
    expect(l.max).toBe(5);
    expect(l.isEmpty()).toBe(false);
    expect(l.isEmptyString()).toBe(false);
    expect(l.isTotal()).toBe(false);
    expect(l.toString()).toBe("<Length: min=1, max=5>");
  });

  test("Length empty should work", () => {
    const l = new Length(null, null);
    expect(l.isEmpty()).toBe(true);
  });

  test("Length empty string should work", () => {
    const l = new Length(0, 0);
    expect(l.isEmptyString()).toBe(true);
  });

  test("Length total candidate should work", () => {
    const l = new Length(0, null);
    expect(l.isTotal()).toBe(undefined);
  });
});
