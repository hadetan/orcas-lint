import { cac } from 'cac';
import { analyze } from '../index';
import { ConfigError } from '../config';
import { render } from '../surface';
import { exitCodeForFindings, flagsToOptions } from './args';
import type { ReporterName } from '../types';

/** Parse argv, run analysis, print the report, and return the process exit code. */
export async function run(argv: string[] = process.argv): Promise<number> {
  const cli = cac('orcas');
  cli
    .command('[...paths]', 'Find dead code and unused values')
    .option('--debug', 'Show skipped items and reasons')
    .option('--json', 'Machine-readable JSON output')
    .option('--reporter <name>', 'Reporter: pretty | json')
    .option('--config <path>', 'Path to a config file')
    .option('--no-cache', 'Disable the on-disk cache')
    .option('--trace-depth <n>', 'Interprocedural depth budget')
    .option('--rule <id=sev>', 'Override a rule severity (repeatable)')
    .option('--production', 'Exclude tests/dev files; only runtime deps')
    .option('--max-time <ms>', 'Global wall-clock budget in ms');
  cli.help();

  const parsed = cli.parse(argv, { run: false });
  if (parsed.options.help) {
    cli.outputHelp();
    return 0;
  }

  const options = flagsToOptions({
    paths: parsed.args as string[],
    debug: parsed.options.debug,
    json: parsed.options.json,
    reporter: parsed.options.reporter,
    config: parsed.options.config,
    cache: parsed.options.cache,
    traceDepth: parsed.options.traceDepth,
    rule: parsed.options.rule,
    production: parsed.options.production,
    maxTime: parsed.options.maxTime,
  });

  const reporter: ReporterName = options.reporter ?? 'pretty';
  if (reporter !== 'pretty' && reporter !== 'json') {
    process.stderr.write(`Unknown reporter "${String(reporter)}"\n`);
    return 2;
  }

  try {
    const result = await analyze(options);
    const output = render(result, reporter, { debug: options.debug ?? false });
    process.stdout.write(`${output}\n`);
    return exitCodeForFindings(result.findings);
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`${err.message}\n`);
      return 2;
    }
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 2;
  }
}
