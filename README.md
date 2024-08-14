# RegexSolver Node.js API Client

[Homepage](https://regexsolver.com) | [Online Demo](https://regexsolver.com/demo) | [Documentation](https://docs.regexsolver.com) | [Developer Console](https://console.regexsolver.com)

This repository contains the source code of the Node.js library for [RegexSolver](https://regexsolver.com) API.

RegexSolver is a powerful regular expression manipulation toolkit, that gives you the power to manipulate regex as if
they were sets.

## Installation

```sh
npm install regexsolver
```

## Usage

In order to use the library you need to generate an API Token on our [Developer Console](https://console.regexsolver.com/).

```javascript
import { RegexSolver, Term } from 'regexsolver';

RegexSolver.initialize("YOUR TOKEN HERE");

const term1 = Term.regex("(abc|de|fg){2,}");
const term2 = Term.regex("de.*");
const term3 = Term.regex(".*abc");

const term4 = Term.regex(".+(abc|de).+");

term1.intersection(term2, term3)
    .then(result => result.subtraction(term4))
    .then(result => console.log(result.toString()));
```


## Features

- [Intersection](#intersection)
- [Union](#union)
- [Subtraction / Difference](#subtraction--difference)
- [Equivalence](#equivalence)
- [Subset](#subset)
- [Details](#details)
- [Generate Strings](#generate-strings)

### Intersection

#### Request

Compute the intersection of the provided terms and return the resulting term.

The maximum number of terms is currently limited to 10.

```javascript
const term1 = Term.regex("(abc|de){2}");
const term2 = Term.regex("de.*");
const term3 = Term.regex(".*abc");

term1.intersection(term2, term3).then(result => {
  console.log(result.toString());
});
```

#### Response

```
regex=deabc
```

### Union

Compute the union of the provided terms and return the resulting term.

The maximum number of terms is currently limited to 10.

#### Request

```javascript
const term1 = Term.regex("abc");
const term2 = Term.regex("de");
const term3 = Term.regex("fghi");

term1.union(term2, term3).then(result => {
  console.log(result.toString());
});
```

#### Response

```
regex=(abc|de|fghi)
```

### Subtraction / Difference

Compute the first term minus the second and return the resulting term.

#### Request

```javascript
const term1 = Term.regex("(abc|de)");
const term2 = Term.regex("de");

term1.subtraction(term2).then(result => {
  console.log(result.toString());
});

```

#### Response

```
regex=abc
```

### Equivalence

Analyze if the two provided terms are equivalent.

#### Request

```javascript
const term1 = Term.regex("(abc|de)");
const term2 = Term.regex("(abc|de)*");

term1.isEquivalentTo(term2).then(result => {
  console.log(result);
});
```

#### Response

```
false
```

### Subset

Analyze if the second term is a subset of the first.

#### Request

```javascript
const term1 = Term.regex("de");
const term2 = Term.regex("(abc|de)");

term1.isSubsetOf(term2).then(result => {
  console.log(result);
});

```

#### Response

```
true
```

### Details

Compute the details of the provided term.

The computed details are:

- **Cardinality:** the number of possible values.
- **Length:** the minimum and maximum length of possible values.
- **Empty:** true if is an empty set (does not contain any value), false otherwise.
- **Total:** true if is a total set (contains all values), false otherwise.

#### Request

```javascript
const term = Term.regex("(abc|de)");

term.getDetails().then(details => {
  console.log(details.toString());
});
```

#### Response

```
Details[cardinality=Integer(2), length=Length[minimum=2, maximum=3], empty=false, total=false]
```

### Generate Strings

Generate the given number of strings that can be matched by the provided term.

The maximum number of strings to generate is currently limited to 200.

#### Request

```javascript
const term = Term.regex("(abc|de){2}");

term.generateStrings(3).then(result => {
  console.log(result);
});
```

#### Response

```
[ 'deabc', 'abcde', 'dede' ]
```
