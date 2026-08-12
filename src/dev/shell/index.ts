/**
 * Shared shell for the /dev pages.
 *
 * Every dev tool builds its frame from these components rather than
 * hand-rolling one, which is how the eleven pages drifted onto six different
 * container widths and five header shapes.
 *
 * Note for anything added here: these are web-only components, so use plain
 * HTML with the semantic typography classes from `src/styles/_typography.scss`.
 * The `Text` primitive is native-only and must not be used —
 * see `.agents/docs/features/primitives/03-when-to-use-primitives.md`.
 */
export { DevPageLoading } from './DevPageLoading';
export { DevStat, type DevStatTone } from './DevStat';
