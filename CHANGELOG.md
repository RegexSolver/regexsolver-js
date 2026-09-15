# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- `@types/node` raised to `^26.5.1`.

## [1.1.0] - 2026-08-08

The singleton `RegexSolver` becomes an instantiable `RegexSolverClient`, every operation moves from `Term` onto that client, and the SDK covers the whole API rather than the seven endpoints it knew about. The API changed with it, to a new OpenAPI contract served under `/v1`, so upgrading is not optional: 1.0.x no longer reaches an endpoint that exists. Code written against 1.0.4 does not compile against this release; see *Compatibility* below.

### Added

- `RegexSolverClient`, constructed with `new RegexSolverClient({ apiToken, baseUrl?, autoBatch?, maxTermsPerRequest? })`. Several clients, each with its own token, can exist in one process.
- The operations the API gained since 1.0.4: `complement`, `concat`, `determinize`, `repeat`, `getCardinality`, `getDot`, `getLength`, `isEmpty`, `isEmptyString`, `isTotal` and `isDeterministic`.
- `OperationOptions` on every operation that returns a term: `responseFormat` (`REGEX`, `FAIR` or `ANY`), `deterministic` and `executionTimeout`. Analyze operations and `determinize` take `ExecutionOptions`, which is `executionTimeout` alone.
- `generateStrings(term, limit, offset, options?)`, which pages through the language instead of returning a fixed count from the start. `GenerateStringsOptions` carries `pathOrder`, `characterOrder`, `seed`, `minLength`, `maxLength` and `charset`. Paging is only consistent over a deterministic FAIR, hence `determinize()` and `isDeterministic()`.
- `Term.matches(str)`, evaluated locally with `RegExp` rather than by the API: the pattern is anchored with `^(?:...)$` and compiled with the `s` flag. It throws on a FAIR whose pattern is not known yet, and returns `false` for the empty language, which the engine writes as `[]`.
- An exception hierarchy under `RegexSolverError`, so a caller can catch the case it handles instead of matching on a message. `ApiError` carries `statusCode` and `body`, and `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `TooManyRequestsError` and `InternalServerError` split further, down to `RegexSyntaxError`, `TimeoutExceededError`, `QuotaExceededError` and the rest.
- A rate limiter, shared by every client holding the same token: a 429 sets a deadline from `Retry-After`, requests wait for it, and the operation is retried within a five-minute budget.
- Automatic batching. `concat`, `intersection` and `union` accept more terms than the account allows per request, splitting the call and folding the results back into one. Each constituent request counts against the monthly quota. Disable with `autoBatch: false`, or lower the split with `maxTermsPerRequest`.
- A per-term cache of what the API has already returned — cardinality, length, pattern, dot, and the empty, empty-string, total and deterministic flags — so asking twice costs one request.
- `Term.serialize()` / `Term.deserialize()`, round-tripping the `regex=<pattern>` / `fair=<payload>` form, plus `equals()`, `getValue()`, `toDto()` and `fromDto()`.
- `AccountLimits`, `Cardinality` (`Integer`, `BigInteger`, `Infinite`), `Length`, `ResponseFormat`, `PathOrder` and `CharacterOrder` as exported models.
- `generate-api.sh`, which regenerates `src/generated/` from the specification the API publishes at `https://api.regexsolver.com/openapi.json`; `.openapi-generator-ignore` protects the hand-written files.
- CI running the build and the tests on Node 18, 20 and 22, on pushes to `main` and on pull requests, and again before a release is published.
- A `CHANGELOG.md`, this file, a pull request template, and Dependabot updates.

### Changed

- The HTTP layer is `typescript-axios` code generated from the OpenAPI specification instead of hand-written `axios` calls, with `src/` the hand-written surface over it.
- `Term` is an abstract class with `RegexTerm` and `FairTerm` subclasses; `Term.regex()` and `Term.fair()` are unchanged.
- `getPattern()` and `getFair()` return `string | null`, previously `string | void`.
- The minimum supported Node.js version is declared as 18 in `engines`, documenting the requirement rather than raising it.
- `axios` moved to a tilde range, `~1.18.1`, so Dependabot rather than a fresh install decides when the SDK takes a new minor.
- The tests drive the client through `axios-mock-adapter` instead of `nock`, each declaring its own response rather than loading a fixture from `tests/assets/`, and cover the client, the models, the terms and the rate limiter.
- The package is compiled to ES2020 instead of ES2015, with `strict` on, and ships an `exports` map alongside `main` and `types`.

### Removed

- `RegexSolver`, with `getInstance()` and `initialize()`.
- The operation methods on `Term`: `intersection()`, `union()`, `subtraction()`, `isEquivalentTo()`, `isSubsetOf()`, `generateStrings()` and `getDetails()`.
- `Details`, along with `getDetails()`, which returned cardinality, length and the empty and total flags in one response.
- `Term.getType()`. Test with `instanceof RegexTerm` / `instanceof FairTerm`, or read `toDto().type`.

### Compatibility

- Every call site changes. `RegexSolver.initialize(token)` becomes `new RegexSolverClient({ apiToken: token })`, and a term method becomes a client method taking the terms as arguments: `term1.union(term2)` is `client.union(term1, term2)`, `isEquivalentTo` is `equivalent`, `isSubsetOf` is `subset`, `subtraction` is `difference`, and `getDetails` is `getCardinality()`, `getLength()`, `isEmpty()` and `isTotal()`.
- `ApiError` no longer prefixes its message with `The API returned the following error: `. Code catching it still catches everything the API raises, but the message text differs and `statusCode` is what to branch on.
- The endpoints moved from `https://api.regexsolver.com/api/*` to `https://api.regexsolver.com/v1/*`, and `/api/analyze/details` is gone, split into one `/v1/analyze/*` endpoint per property. 1.0.x still calls the old paths and is no longer supported; 1.1.0 is the lowest version that works against the API.
- The serialized `regex=` / `fair=` form is unchanged, so a term persisted by 1.0.x deserializes.
- Node.js 16 and earlier are no longer supported.

## [1.0.4] - 2024-08-15

### Changed

- `axios` raised to `^1.7.4`.
- `ts-jest` is declared as a dev dependency, having been resolved transitively before.

## [1.0.3] - 2024-08-09

### Fixed

- The compiled output is published again. `files` listed `src/` but not `lib/`, so `details.js` and `details.d.ts` were missing from the package.

## [1.0.2] - 2024-08-09

### Changed

- The README documents the full API.

## [1.0.1] - 2024-08-08

### Added

- `Term.getType()`.
- A `User-Agent` header identifying the SDK and its version.
- The MIT licence file.

### Changed

- The term type is `'regex' | 'fair'` rather than `string`.

## [1.0.0] - 2024-08-07

Initial release.

[Unreleased]: https://github.com/RegexSolver/regexsolver-js/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/RegexSolver/regexsolver-js/compare/v1.0.4...v1.1.0
[1.0.4]: https://github.com/RegexSolver/regexsolver-js/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/RegexSolver/regexsolver-js/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/RegexSolver/regexsolver-js/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/RegexSolver/regexsolver-js/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/RegexSolver/regexsolver-js/releases/tag/v1.0.0
