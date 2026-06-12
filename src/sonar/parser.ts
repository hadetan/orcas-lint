/** The result of parsing a single source file. */
export interface ParsedModule {
  readonly file: string;
}

/** Parses source files into {@link ParsedModule} values. */
export interface Parser {
  parse(file: string): ParsedModule;
}

/** Creates a {@link Parser}. */
export function createParser(): Parser {
  return { parse: (file) => ({ file }) };
}
