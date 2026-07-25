# RegexSolver JS API Client
[Homepage](https://regexsolver.com) | [Online Demo](https://regexsolver.com/demo) | [Documentation](https://docs.regexsolver.com) | [Developer Console](https://console.regexsolver.com)

**RegexSolver** is a powerful toolkit for building, combining, and analyzing regular expressions. It is designed for constraint solvers, test generators, and other systems that need advanced regex operations.

## Installation

```sh
npm install regexsolver
```

Requirements: **Node.js >= 18**

## Quick Start

1. Create an API token in the [Developer Console](https://console.regexsolver.com/).
2. Initialize the client and start working with terms.

```javascript
import { RegexSolverClient, Term } from 'regexsolver';

async function main() {
    const client = new RegexSolverClient({ apiToken: 'REGEXSOLVER_API_TOKEN' });

    const term1 = Term.regex("(abc|de|fg){2,}");
    const term2 = Term.regex("de.*");

    const intersection = await client.intersection(term1, term2);
    const pattern = await client.getPattern(intersection);
    console.log(pattern); // de(abc|de|fg)+
}

main();
```

## Key Concepts & Limitations

RegexSolver supports a subset of regular expressions that adhere to the principles of regular languages. Here are the key characteristics and limitations of the regular expressions supported by RegexSolver:
- **Anchored Expressions:** All regular expressions in RegexSolver are anchored. This means that the expressions are treated as if they start and end at the boundaries of the input text. For example, the expression `abc` will match the string "abc" but not "xabc" or "abcx".
- **Lookahead/Lookbehind:** RegexSolver does not support lookahead (`(?=...)`) or lookbehind (`(?<=...)`) assertions. Using them returns an error.
- **Pure Regular Expressions:** RegexSolver focuses on pure regular expressions as defined in regular language theory. This means features that extend beyond regular languages, such as backreferences (`\1`, `\2`, etc.), are not supported. Any use of backreference would return an error.
- **Greedy/Ungreedy Quantifiers:** The concept of ungreedy (`*?`, `+?`, `??`) quantifiers is not supported. All quantifiers are treated as greedy. For example, `a*` or `a*?` will match the longest possible sequence of "a"s.
- **Line Feed and Dot:** RegexSolver handles all characters the same way. The dot `.` matches any Unicode character including line feed (`\n`).
- **Empty Regular Expressions:** The empty language (matches no string) is represented by constructs like `[]` (empty character class). This is distinct from the empty string.

## Response Formats

The API can handle terms in two formats:
- `regex`: a regular expression pattern
- `fair`: FAIR (Fast Automaton Internal Representation), a stable, signed format used internally by the engine

By default, the engine returns whatever the operation produces, with no extra conversion. Override with `OperationOptions`, accepted by the operations that return a term:

```javascript
import { Term, ResponseFormat } from 'regexsolver';

const term1 = Term.regex('abcde');
const term2 = Term.regex('de');

const result1 = await client.union(term1, term2, { responseFormat: ResponseFormat.REGEX });
console.log(result1.toString()); // regex=(abc)?de

const result2 = await client.union(term1, term2, { responseFormat: ResponseFormat.FAIR });
console.log(result2.toString()); // fair=...
```

If the format does not matter, omit `responseFormat` or set it to `ResponseFormat.ANY`.

Regardless of the format, you can always call `getPattern()` to obtain the regex pattern of a term.

## Bounding execution time

Set a server-side compute timeout in milliseconds with `executionTimeout` in `OperationOptions`:

```javascript
import { TimeoutExceededError, Term } from 'regexsolver';

// Limit the server-side compute time to 100 ms
try {
    const term1 = Term.regex('.*ab.*c(de|fg).*dab.*c(de|fg).*ab.*c(de|fg).*dab.*c');
    const term2 = Term.regex('.*abc.*');
    
    const res = await client.difference(term1, term2, { executionTimeout: 100 });
} catch (error) {
    if (error instanceof TimeoutExceededError) {
        console.log(error.message); // The operation took too much time.
    }
}
```

Timeout is best effort. The exact time is not guaranteed.

## API Overview

`RegexSolverClient` exposes the following methods. Every method accepts an optional options object as its last parameter: operations that return a term take `OperationOptions` (`responseFormat`, `deterministic`, `executionTimeout`), while analyze operations and `determinize()` take `ExecutionOptions` (`executionTimeout` only) — the response format is not theirs to choose.

### Analyze

| Method | Return | Description |
| -------- | ------- | ------- |
| `client.equivalent(term1, term2, options?)` | `Promise<boolean>` | `true` if `term1` and `term2` accept exactly the same language. |
| `client.getCardinality(term, options?)` | `Promise<Cardinality>` | Returns the number of possible matched strings. |
| `client.getDot(term, options?)` | `Promise<string>` | Returns a Graphviz DOT representation of the automaton. |
| `client.getLength(term, options?)` | `Promise<Length>` | Returns the minimum and maximum length of matched strings. |
| `client.getPattern(term, options?)` | `Promise<string>` | Returns a regular expression pattern for the term. |
| `client.isEmpty(term, options?)` | `Promise<boolean>` | `true` if the term matches no string. |
| `client.isEmptyString(term, options?)` | `Promise<boolean>` | `true` if the term matches only the empty string. |
| `client.isTotal(term, options?)` | `Promise<boolean>` | `true` if the term matches all possible strings. |
| `client.isDeterministic(term, options?)` | `Promise<boolean>` | `true` if the term's automaton is deterministic. Only a deterministic FAIR guarantees consistent string ordering across paginated `generateStrings()` calls; call `determinize()` first if this is `false`. |
| `client.subset(term1, term2, options?)` | `Promise<boolean>` | `true` if every string matched by `term1` is also matched by `term2`. |

### Compute

| Method | Return | Description |
| -------- | ------- | ------- |
| `client.complement(term, options?)` | `Promise<Term>` | Computes the complement of the given term. |
| `client.concat(term1, term2, ..., options?)` | `Promise<Term>` | Concatenates multiple terms in order. |
| `client.determinize(term, options?)` | `Promise<Term>` | Computes a deterministic FAIR for the given term, suitable for consistent pagination with `generateStrings()`. |
| `client.difference(term1, term2, options?)` | `Promise<Term>` | Computes the difference `term1 - term2`. |
| `client.intersection(term1, term2, ..., options?)` | `Promise<Term>` | Computes the intersection of the given terms. |
| `client.repeat(term, min, max, options?)` | `Promise<Term>` | Computes the repetition of the term between `min` and `max` times. |
| `client.union(term1, term2, ..., options?)` | `Promise<Term>` | Computes the union of the given terms. |

### Generate

| Method | Return | Description |
| -------- | ------- | ------- |
| `client.generateStrings(term, limit, offset, options?)` | `Promise<string[]>` | Generates up to `limit` unique strings matched by `term`, skipping the first `offset` strings. |

## Cross-Language Support

If you want to use this library with other programming languages, we provide:
- [regexsolver-java](https://github.com/RegexSolver/regexsolver-java)
- [regexsolver-python](https://github.com/RegexSolver/regexsolver-python)

For more information about how to use the wrappers, you can refer to our [guide](https://docs.regexsolver.com/getting-started.html).

You can also take a look at [regexsolver](https://github.com/RegexSolver/regexsolver) which contains the source code of the engine.

## License

This project is licensed under the MIT License.
