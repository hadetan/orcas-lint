#!/usr/bin/env node
import { run } from '../dist/cli/index.js';

run(process.argv)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
