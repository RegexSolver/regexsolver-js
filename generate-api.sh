#!/bin/bash

SPEC_FILE="../m-lab/shared/openapi.yaml"
OUT_DIR="./src/generated"

echo "Running openapi-generator-cli..."
openapi-generator-cli generate \
  -i "$SPEC_FILE" \
  -g typescript-axios \
  -o "$OUT_DIR"

echo "API Generation Complete."
