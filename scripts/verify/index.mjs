#!/usr/bin/env node
/**
 * `yarn verify` — run the checks that apply to what changed, and print a
 * verdict readable without reading the diff.
 *
 * Grown in slices: this revision runs desktop's fast tier only. Routing,
 * environment reporting, cross-repo fan-out and the receipt land in later
 * tasks of the same plan.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepsFor } from './steps.mjs';
import { runStep } from './runner.mjs';
import { renderReport, verdictOf } from './report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DESKTOP = resolve(HERE, '../..');

const plan = { repos: ['desktop'], live: false, reasons: [], skipped: [] };

const results = [];
for (const step of stepsFor('desktop', DESKTOP, 'fast')) {
  results.push(await runStep(step));
}

console.log('\n' + renderReport({ env: null, plan, results }) + '\n');
process.exit(verdictOf(results, plan) === 'FAIL' ? 1 : 0);
