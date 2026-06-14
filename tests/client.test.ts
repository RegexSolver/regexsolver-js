import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { RegexSolverClient } from "../src/RegexSolverClient";
import { Term } from "../src/models/Term";
import * as Exceptions from "../src/exceptions";
import { BigInteger, Infinite, Integer } from "../src/models/Cardinality";

describe("RegexSolverClient", () => {
  let mock: any;
  let client: RegexSolverClient;

  beforeEach(() => {
    client = new RegexSolverClient({ apiToken: "test-token" });

    mock = new MockAdapter((client as any).axiosInstance);
  });

  afterEach(() => {
    mock.restore();
  });

  test("getCardinality should work for integer", async () => {
    mock.onPost("/analyze/cardinality").reply(200, {
      success: true,
      data: { type: "integer", value: 26 },
    });

    const term = Term.regex("[a-z]");
    const cardinality = await client.getCardinality(term);

    expect(cardinality.isInteger()).toBe(true);
    expect(cardinality).toEqual(new Integer(26));
    expect(term.getCachedCardinality()).toBe(cardinality);
  });

  test("getCardinality should work for infinite", async () => {
    mock.onPost("/analyze/cardinality").reply(200, {
      success: true,
      data: { type: "infinite" },
    });

    const term = Term.regex(".*");
    const cardinality = await client.getCardinality(term);

    expect(cardinality.isInfinite()).toBe(true);
    expect(cardinality).toBeInstanceOf(Infinite);
    expect(term.getCachedCardinality()).toBe(cardinality);
  });

  test("getCardinality should work for bigInteger", async () => {
    mock.onPost("/analyze/cardinality").reply(200, {
      success: true,
      data: { type: "bigInteger" },
    });

    const term = Term.regex(".{100}");
    const cardinality = await client.getCardinality(term);

    expect(cardinality.isBigInteger()).toBe(true);
    expect(cardinality).toBeInstanceOf(BigInteger);
    expect(term.getCachedCardinality()).toBe(cardinality);
  });

  test("getLength should work", async () => {
    mock.onPost("/analyze/length").reply(200, {
      success: true,
      data: { type: "length", min: 1, max: 4 },
    });

    const term = Term.regex("(abc)?d");
    const length = await client.getLength(term);

    expect(length.min).toBe(1);
    expect(length.max).toBe(4);
    expect(term.getCachedLength()).toBe(length);
  });

  test("isEmpty should work", async () => {
    mock.onPost("/analyze/empty").reply(200, {
      success: true,
      data: { value: true },
    });

    const term = Term.regex("[]");
    const emptyValue = await client.isEmpty(term);
    expect(emptyValue).toBe(true);
    expect(term.getCachedEmpty()).toBe(true);
  });

  test("isEmptyString should work", async () => {
    mock.onPost("/analyze/empty_string").reply(200, {
      success: true,
      data: { value: true },
    });

    const term = Term.regex("");
    const result = await client.isEmptyString(term);
    expect(result).toBe(true);
    expect(term.getCachedEmptyString()).toBe(true);
  });

  test("isTotal should work", async () => {
    mock.onPost("/analyze/total").reply(200, {
      success: true,
      data: { value: true },
    });

    const term = Term.regex(".*");
    const result = await client.isTotal(term);
    expect(result).toBe(true);
    expect(term.getCachedTotal()).toBe(result);
  });

  test("getPattern should work", async () => {
    mock.onPost("/analyze/pattern").reply(200, {
      success: true,
      data: { value: "a" },
    });

    const term = Term.fair("...");
    const result = await client.getPattern(term);
    expect(result).toBe("a");
    // getCachedPattern() explicitly verifies our internal cache got updated properly
    expect(term.getCachedPattern()).toBe("a");
  });

  test("getDot should work", async () => {
    mock.onPost("/analyze/dot").reply(200, {
      success: true,
      data: { value: "digraph {...}" },
    });

    const term = Term.regex("a");
    const result = await client.getDot(term);
    expect(result).toBe("digraph {...}");
    expect(term.getCachedDot()).toBe(result);
  });

  test("equivalent should work", async () => {
    mock.onPost("/analyze/equivalent").reply(200, {
      success: true,
      data: { value: true },
    });

    const t1 = Term.regex("a");
    const t2 = Term.regex("a");
    const result = await client.equivalent(t1, t2);
    expect(result).toBe(true);
  });

  test("subset should work", async () => {
    mock.onPost("/analyze/subset").reply(200, {
      success: true,
      data: { value: true },
    });

    const t1 = Term.regex("a");
    const t2 = Term.regex("a|b");
    const result = await client.subset(t1, t2);
    expect(result).toBe(true);
  });

  test("intersection should work", async () => {
    mock.onPost("/compute/intersection").reply(200, {
      success: true,
      data: { type: "regex", value: "a" },
    });

    const t1 = Term.regex("a");
    const t2 = Term.regex("ab");
    const result = await client.intersection([t1, t2]);
    expect(result.getValue()).toBe("a");
  });

  test("union should work", async () => {
    mock.onPost("/compute/union").reply(200, {
      success: true,
      data: { type: "regex", value: "a|b" },
    });

    const t1 = Term.regex("a");
    const t2 = Term.regex("b");
    const result = await client.union([t1, t2]);
    expect(result.getValue()).toBe("a|b");
  });

  test("difference should work", async () => {
    mock.onPost("/compute/difference").reply(200, {
      success: true,
      data: { type: "regex", value: "a" },
    });

    const t1 = Term.regex("a|b");
    const t2 = Term.regex("b");
    const result = await client.difference(t1, t2);
    expect(result.getValue()).toBe("a");
  });

  test("concat should work", async () => {
    mock.onPost("/compute/concat").reply(200, {
      success: true,
      data: { type: "regex", value: "ab" },
    });

    const t1 = Term.regex("a");
    const t2 = Term.regex("b");
    const result = await client.concat([t1, t2]);
    expect(result.getValue()).toBe("ab");
  });

  test("repeat should work", async () => {
    mock.onPost("/compute/repeat").reply(200, {
      success: true,
      data: { type: "regex", value: "a{2,3}" },
    });

    const term = Term.regex("a");
    const result = await client.repeat(term, 2, 3);
    expect(result.getValue()).toBe("a{2,3}");
  });

  test("complement should work", async () => {
    mock.onPost("/compute/complement").reply(200, {
      success: true,
      data: { type: "regex", value: "[^a]*" },
    });

    const term = Term.regex("a*");
    const result = await client.complement(term);
    expect(result.getValue()).toBe("[^a]*");
  });

  test("generateStrings should work", async () => {
    mock.onPost("/generate/strings").reply(200, {
      success: true,
      data: {
        type: "generatedStrings",
        strings: {
          type: "strings",
          value: ["", "a", "aa"],
        },
      },
    });

    const term = Term.regex("a*");
    const result = await client.generateStrings(term, 3, 0);
    expect(result).toEqual(["", "a", "aa"]);
  });

  test("error mapping for 400 Bad Request - Invalid JSON", async () => {
    mock.onPost("/analyze/cardinality").reply(400, {
      success: false,
      error: "Invalid JSON body",
      errorCode: "InvalidJson",
    });

    await expect(client.getCardinality(Term.regex("a"))).rejects.toThrow(
      Exceptions.InvalidJsonError,
    );
  });

  test("error mapping for 400 Bad Request - Too Many Terms", async () => {
    mock.onPost("/compute/union").reply(400, {
      success: false,
      error: "Too many terms",
      errorCode: "TooManyTerms",
    });

    await expect(client.union([Term.regex("a")])).rejects.toThrow(
      Exceptions.TooManyTermsError,
    );
  });

  test("error mapping for 400 Bad Request - Timeout Too Large", async () => {
    mock.onPost("/analyze/cardinality").reply(400, {
      success: false,
      error: "Timeout too large",
      errorCode: "TimeoutTooLarge",
    });

    await expect(client.getCardinality(Term.regex("a"))).rejects.toThrow(
      Exceptions.TimeoutTooLargeError,
    );
  });

  test("error mapping for 400 Bad Request - Timeout Exceeded", async () => {
    mock.onPost("/analyze/cardinality").reply(400, {
      success: false,
      error: "Timeout exceeded",
      errorCode: "TimeoutExceeded",
    });

    await expect(client.getCardinality(Term.regex("a"))).rejects.toThrow(
      Exceptions.TimeoutExceededError,
    );
  });

  test("error mapping for 400 Bad Request - Invalid Number Of Strings To Generate", async () => {
    mock.onPost("/generate/strings").reply(400, {
      success: false,
      error: "Invalid number of strings",
      errorCode: "InvalidNumberOfStringsToGenerate",
    });

    await expect(
      client.generateStrings(Term.regex("a"), 10, 0),
    ).rejects.toThrow(Exceptions.InvalidNumberOfStringsToGenerateError);
  });

  test("error mapping for 401 Unauthorized - Missing or Malformed Token", async () => {
    mock.onPost("/analyze/cardinality").reply(401, {
      success: false,
      error: "Missing token",
      errorCode: "MissingOrMalformedToken",
    });

    await expect(client.getCardinality(Term.regex("abc"))).rejects.toThrow(
      Exceptions.MissingOrMalformedTokenError,
    );
  });

  test("error mapping for 401 Unauthorized - Invalid Token", async () => {
    mock.onPost("/analyze/cardinality").reply(401, {
      success: false,
      error: "Invalid token",
      errorCode: "InvalidToken",
    });

    await expect(client.getCardinality(Term.regex("abc"))).rejects.toThrow(
      Exceptions.InvalidTokenError,
    );
  });

  test("error mapping for 403 Forbidden - Quota Exceeded", async () => {
    mock.onPost("/analyze/cardinality").reply(403, {
      success: false,
      error: "Quota exceeded",
      errorCode: "QuotaExceeded",
    });

    await expect(client.getCardinality(Term.regex("abc"))).rejects.toThrow(
      Exceptions.QuotaExceededError,
    );
  });

  test("error mapping for 404 Not Found", async () => {
    mock.onPost("/analyze/cardinality").reply(404, {
      success: false,
      error: "Not Found",
    });

    await expect(client.getCardinality(Term.regex("abc"))).rejects.toThrow(
      Exceptions.NotFoundError,
    );
  });

  test("error mapping for 500 Internal Server Error", async () => {
    mock.onPost("/analyze/cardinality").reply(500, {
      success: false,
      error: "Internal server error",
    });

    await expect(client.getCardinality(Term.regex("abc"))).rejects.toThrow(
      Exceptions.InternalServerError,
    );
  });

  test("rate limit with retry-after should work and block concurrent requests", async () => {
    // First call 429
    mock.onPost("/analyze/cardinality").replyOnce(
      429,
      {
        success: false,
        error: "Too many requests",
        errorCode: "RateLimitExceeded",
      },
      { "retry-after": "0.1" },
    );

    // Second call 200
    mock.onPost("/analyze/cardinality").reply(200, {
      success: true,
      data: { type: "integer", value: 26 },
    });

    const start = Date.now();
    const term = Term.regex("[a-z]");

    // Parallel calls
    const p1 = client.getCardinality(term);
    const p2 = client.getCardinality(term);

    const [c1, c2] = await Promise.all([p1, p2]);
    const duration = Date.now() - start;

    expect(c1).toEqual(new Integer(26));
    expect(c2).toEqual(new Integer(26));
    expect(duration).toBeGreaterThanOrEqual(100);
  });
});
