# RegexSolver Node.js API Client

[Homepage](https://regexsolver.com) | [Documentation](https://docs.regexsolver.com) | [Developer Console](https://console.regexsolver.com)

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
