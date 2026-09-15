#!/bin/bash

# The API serves its own specification, which is the source the SDK is generated
# from. Pass a path or another URL as the first argument to generate against it.
SPEC="${1:-https://api.regexsolver.com/openapi.json}"
OUT_DIR="./src/generated"

echo "Running openapi-generator-cli..."
openapi-generator-cli generate \
  -i "$SPEC" \
  -g typescript-axios \
  -o "$OUT_DIR"

echo "API Generation Complete."
