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

  test("constructor rejects an empty apiToken", () => {
    expect(() => new RegexSolverClient({ apiToken: "" })).toThrow(
      "apiToken is required",
    );
  });

  test("constructor rejects maxTermsPerRequest below 2", () => {
    expect(
      () =>
        new RegexSolverClient({ apiToken: "test-token", maxTermsPerRequest: 1 }),
    ).toThrow("maxTermsPerRequest must be at least 2");
  });

  test("getAccountLimits should work and be memoized", async () => {
    mock.onGet("/account/limits").reply(200, {
      success: true,
      data: {
        type: "accountLimits",
        maxRequestsCount: 1000,
        maxRequestsRate: 10,
        maxTermsCount: 4,
        maxTimeout: 60000,
        maxStatesCount: 8192,
      },
    });

    const limits = await client.getAccountLimits();
    expect(limits.maxRequestsCount).toBe(1000);
    expect(limits.maxRequestsRate).toBe(10);
    expect(limits.maxTermsCount).toBe(4);
    expect(limits.maxTimeout).toBe(60000);
    expect(limits.maxStatesCount).toBe(8192);

    await client.getAccountLimits();
    expect(mock.history.get.length).toBe(1);
  });

  test("proactive batching folds oversized concat calls in order", async () => {
    const batchClient = new RegexSolverClient({
      apiToken: "batch-token",
      maxTermsPerRequest: 3,
    });
    const batchMock = new MockAdapter((batchClient as any).axiosInstance);
    for (const value of ["r0", "r1", "r2", "r3"]) {
      batchMock.onPost("/compute/concat").replyOnce(200, {
        success: true,
        data: { type: "regex", value },
      });
    }

    const terms = Array.from({ length: 8 }, (_, i) => Term.regex(`t${i}`));
    const result = await batchClient.concat(terms, {
      responseFormat: "regex",
    });
    expect(result.getValue()).toBe("r3");

    const bodies = batchMock.history.post.map((r) => JSON.parse(r.data));
    expect(bodies.length).toBe(4);
    // Left fold preserves concat order: contiguous chunks, accumulator first.
    expect(bodies[0].terms.map((t: any) => t.value)).toEqual([
      "t0",
      "t1",
      "t2",
    ]);
    expect(bodies[1].terms.map((t: any) => t.value)).toEqual([
      "r0",
      "t3",
      "t4",
    ]);
    expect(bodies[2].terms.map((t: any) => t.value)).toEqual([
      "r1",
      "t5",
      "t6",
    ]);
    expect(bodies[3].terms.map((t: any) => t.value)).toEqual(["r2", "t7"]);
    // Only the final request carries the caller's response options.
    expect(bodies[0].options.response).toBeUndefined();
    expect(bodies[1].options.response).toBeUndefined();
    expect(bodies[2].options.response).toBeUndefined();
    expect(bodies[3].options.response).toEqual({ format: "regex" });
    // The limit was known up front, so no limits fetch happened.
    expect(batchMock.history.get.length).toBe(0);
    batchMock.restore();
  });

  test("reactive batching fetches the limits once and re-runs batched", async () => {
    mock.onGet("/account/limits").reply(200, {
      success: true,
      data: {
        type: "accountLimits",
        maxRequestsCount: 1000,
        maxRequestsRate: 10,
        maxTermsCount: 4,
        maxTimeout: 60000,
        maxStatesCount: 8192,
      },
    });
    mock.onPost("/compute/union").replyOnce(400, {
      success: false,
      error: "9 terms provided. Maximum allowed is 4.",
      errorCode: "TooManyTerms",
    });
    for (const value of ["r0", "r1", "r2"]) {
      mock.onPost("/compute/union").replyOnce(200, {
        success: true,
        data: { type: "regex", value },
      });
    }

    const terms = Array.from({ length: 9 }, (_, i) => Term.regex(`t${i}`));
    const result = await client.union(terms);
    expect(result.getValue()).toBe("r2");

    expect(mock.history.get.length).toBe(1);
    const bodies = mock.history.post.map((r: any) => JSON.parse(r.data));
    expect(bodies.length).toBe(4);
    expect(bodies[1].terms.map((t: any) => t.value)).toEqual([
      "t0",
      "t1",
      "t2",
      "t3",
    ]);
    expect(bodies[2].terms.map((t: any) => t.value)).toEqual([
      "r0",
      "t4",
      "t5",
      "t6",
    ]);
    expect(bodies[3].terms.map((t: any) => t.value)).toEqual([
      "r1",
      "t7",
      "t8",
    ]);
  });

  test("autoBatch: false surfaces TooManyTerms without fetching limits", async () => {
    const noBatchClient = new RegexSolverClient({
      apiToken: "no-batch-token",
      autoBatch: false,
    });
    const noBatchMock = new MockAdapter((noBatchClient as any).axiosInstance);
    noBatchMock.onPost("/compute/union").reply(400, {
      success: false,
      error: "9 terms provided. Maximum allowed is 4.",
      errorCode: "TooManyTerms",
    });

    const terms = Array.from({ length: 9 }, (_, i) => Term.regex(`t${i}`));
    await expect(noBatchClient.union(terms)).rejects.toThrow(
      Exceptions.TooManyTermsError,
    );
    expect(noBatchMock.history.get.length).toBe(0);
    noBatchMock.restore();
  });

  test("a failed limits fetch rethrows the original TooManyTerms", async () => {
    mock.onGet("/account/limits").reply(500, {
      success: false,
      error: "Internal server error",
    });
    mock.onPost("/compute/union").reply(400, {
      success: false,
      error: "9 terms provided. Maximum allowed is 4.",
      errorCode: "TooManyTerms",
    });

    const terms = Array.from({ length: 9 }, (_, i) => Term.regex(`t${i}`));
    await expect(client.union(terms)).rejects.toThrow(
      Exceptions.TooManyTermsError,
    );
    // The memo was cleared on rejection, so a later call fetches again.
    await expect(client.getAccountLimits()).rejects.toThrow(
      Exceptions.InternalServerError,
    );
    expect(mock.history.get.length).toBe(2);
  });

  test("generateStrings serializes the ordering options", async () => {
    mock.onPost("/generate/strings").reply(200, {
      success: true,
      data: {
        type: "generatedStrings",
        strings: { type: "strings", value: ["xy"] },
      },
    });

    const result = await client.generateStrings(Term.regex("[a-z]{2}"), 5, 0, {
      pathOrder: "interleave",
      characterOrder: "shuffled",
      seed: 42,
      minLength: 1,
      maxLength: 10,
      charset: "[a-z]",
    });
    expect(result).toEqual(["xy"]);

    const body = JSON.parse(mock.history.post[0].data);
    expect(body.pathOrder).toBe("interleave");
    expect(body.characterOrder).toBe("shuffled");
    expect(body.seed).toBe(42);
    expect(body.minLength).toBe(1);
    expect(body.maxLength).toBe(10);
    expect(body.charset).toBe("[a-z]");
  });

  test("generateStrings omits unset options from the body", async () => {
    mock.onPost("/generate/strings").reply(200, {
      success: true,
      data: {
        type: "generatedStrings",
        strings: { type: "strings", value: ["a"] },
      },
    });

    await client.generateStrings(Term.regex("a"), 1, 0);

    const body = JSON.parse(mock.history.post[0].data);
    expect(body.pathOrder).toBeUndefined();
    expect(body.characterOrder).toBeUndefined();
    expect(body.seed).toBeUndefined();
    expect(body.minLength).toBeUndefined();
    expect(body.maxLength).toBeUndefined();
    expect(body.charset).toBeUndefined();
  });

  test("more consecutive 429s than the old retry cap still succeed", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    for (let i = 0; i < 3; i++) {
      mock.onPost("/analyze/cardinality").replyOnce(
        429,
        { success: false, error: "Too many requests" },
        { "retry-after": "0.02" },
      );
    }
    mock.onPost("/analyze/cardinality").reply(200, {
      success: true,
      data: { type: "integer", value: 26 },
    });

    const cardinality = await client.getCardinality(Term.regex("[a-z]"));
    expect(cardinality).toEqual(new Integer(26));
    expect(mock.history.post.length).toBe(4);
    (Math.random as jest.Mock).mockRestore();
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
