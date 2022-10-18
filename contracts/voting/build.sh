#!/bin/bash
set -e

if [[ ! -v RUST_ENV ]]; then
    RUST_ENV=development
fi

if [ $RUST_ENV == "production" ]; then
    echo "Building production..."
    RUSTFLAGS='-C link-arg=-s' cargo build --target wasm32-unknown-unknown --release
else
    echo "Building development..."
    RUSTFLAGS='-C link-arg=-s --cfg near_testnet' cargo build --target wasm32-unknown-unknown --release
fi
mkdir -p ../../out
cp target/wasm32-unknown-unknown/release/*.wasm ../../out/titstake-voting.wasm