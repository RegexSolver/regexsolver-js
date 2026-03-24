#!/bin/bash

SPEC_FILE="../m-lab/shared/openapi.yaml"
OUT_DIR="./src/generated"

echo "Generating TypeScript Axios client..."
openapi-generator-cli generate \
  -i "$SPEC_FILE" \
  -g typescript-axios \
  -o "$OUT_DIR"

echo "Generation complete. Metadata is at root, generated source is in src/generated."
