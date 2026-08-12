/**
 * Forbid assigning a `__`-prefixed debug global to `window` / `globalThis`
 * unless it sits inside a development-only guard.
 *
 * Anything reachable from `window` in a production build is readable by every
 * script running in the page, including browser extensions and any injected
 * or compromised third-party code. Debug handles tend to expose far more than
 * their name suggests — a service object reaches whatever that service holds —
 * so they belong in development builds only.
 *
 * What counts as a guard
 * ----------------------
 * An enclosing `if` whose test mentions either `import.meta.env…DEV` (the Vite
 * idiom used by src/dev/db-inspector/dbDumpUtil.ts) or `NODE_ENV` with
 * `production` (used by src/identity/diagnostics.ts). Both are verified to
 * strip from a production bundle. The test is matched on source text rather
 * than AST shape so that `import.meta.env.DEV`, `import.meta.env?.DEV` and
 * `typeof window !== 'undefined' && import.meta.env?.DEV` all pass.
 *
 * Being under src/dev/ is NOT a guard. Nothing stops a production module
 * importing such a file, which pulls the assignment into the bundle with it.
 *
 * Only `__`-prefixed properties are restricted, that being the convention for
 * debug handles. `window.Buffer` in src/App.tsx is a real production polyfill
 * and is intentionally allowed.
 *
 * scripts/check-bundle-globals.mjs is the other half of this guard: it checks
 * the built artifact, catching cases where the source is correct but the
 * output is not.
 */

/** Unwrap `(window as any)`, `(window as unknown as T)`, `window!`, `(window)`. */
function baseObject(node) {
  let current = node;
  for (;;) {
    if (!current) return null;
    switch (current.type) {
      case 'TSAsExpression':
      case 'TSNonNullExpression':
      case 'TSTypeAssertion':
      case 'ChainExpression':
        current = current.expression;
        break;
      default:
        return current;
    }
  }
}

/** `window.__x` -> "__x", `window['__x']` -> "__x", otherwise null. */
function propertyName(memberExpression) {
  const { property, computed } = memberExpression;
  if (!computed && property.type === 'Identifier') return property.name;
  if (computed && property.type === 'Literal' && typeof property.value === 'string') {
    return property.value;
  }
  return null;
}

const GUARD_PATTERNS = [
  /import\s*\.\s*meta\s*\.\s*env\s*\??\.\s*DEV/,
  /NODE_ENV[\s\S]*production/,
];

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Debug globals on window must be behind a development-only guard, ' +
        'so they cannot reach a production bundle.',
    },
    schema: [],
    messages: {
      ungated:
        "'{{name}}' is assigned to {{target}} without a development guard, so it " +
        'reaches production builds and is readable by any script on the page. ' +
        "Wrap it in `if (typeof window !== 'undefined' && import.meta.env?.DEV) " +
        '{ … }` — see src/dev/db-inspector/dbDumpUtil.ts — or delete it. Check what ' +
        'the exposed object can reach before assuming it is harmless.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /** True when an ancestor `if` guards this node with a dev-only test. */
    function isDevGuarded(node) {
      for (let current = node; current; current = current.parent) {
        const parent = current.parent;
        if (
          parent &&
          parent.type === 'IfStatement' &&
          // Only the consequent is guarded. An `else` branch runs in production.
          parent.consequent === current
        ) {
          const test = sourceCode.getText(parent.test);
          if (GUARD_PATTERNS.some((pattern) => pattern.test(test))) return true;
        }
      }
      return false;
    }

    return {
      AssignmentExpression(node) {
        if (node.left.type !== 'MemberExpression') return;

        const name = propertyName(node.left);
        if (!name || !name.startsWith('__')) return;

        const base = baseObject(node.left.object);
        if (
          !base ||
          base.type !== 'Identifier' ||
          (base.name !== 'window' && base.name !== 'globalThis')
        ) {
          return;
        }

        if (isDevGuarded(node)) return;

        context.report({
          node,
          messageId: 'ungated',
          data: { name, target: base.name },
        });
      },
    };
  },
};
