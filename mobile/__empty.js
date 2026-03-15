// Empty module — used by Metro to satisfy root package.json resolution.
// The monorepo root package.json has "main": "web/electron/main.cjs" (for Electron).
// When Metro encounters this in the workspace, it tries to resolve it, fails (blocked),
// and falls back to ./index which doesn't exist at root. This empty module prevents that error.
module.exports = {};
