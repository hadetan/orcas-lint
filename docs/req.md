# Orcas

Orcas is a open source, npm package built on typescript or rust as engine, that will find values that are never consumed, for example:

- Dead import/export
- variable/value exported but never read anywhere
- Nested array of objects where a key or value or sets of it is not consumed in file or if exported then in globally
- Nested objects with arrays same as above
- Nested mix of objects and arrays same as above
- Returned value from function that is not consumed in its file or if exports then in global where its being called
- A value, array, object is/are mutated but mutated value is never read or consumed

The Orcas engine will be easy to run with a simple one command and its configurations for end users can be like eslint and others, simplified and easy to use and plug in.
The engine is be built to be safe from endless loops, endless run and a fast efficient searcher/indexer.

The Orcas npm package will be used on JavaScript and TypeScript projects that can be either a project (or whatever its called) or a library

## Architecture

The engines architecture is built to scale. All constants, strings are properly placed and each & all modules and sub modules are properly chunked so heavy files are never faced.
The data and memory will be properly managed in places so it can be safe from unexpected mutations.
The engine module is focused heavily with modules and sub modules.

### Module naming

The module naming are done professionally instead of being verbatim. Just like how other engines have done it like docker, linux, eslint and others.

## Tracker

The tracker is a part of the engine that will be safe from endlessly running in a repeating loop. The trackers responsibility is to track the specific feature like finding unused import, export or variable etc. The specific tracker can have sub modules of its own if needed and suspected it would scale very large.

## Graph

The graph is also a part of the engine that will track and place each tokens in its memory graph so it can find all of the link connections regarding the token. The graph module can become a very vulnerable module so it is tried to be as chunked into sub modules as possible for better scalability.

---

The tracker and graph modules that was talked about above are only references and are not a fixed requirement.

**NOTE:**
- Watchdog is not implemented yet but will have room for it to be implemented later.