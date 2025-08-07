type ResolveWorkspaceOptions = Partial<{
    packageWorkspaces: boolean;
    pnpmWorkspaces: boolean;
}>;
/**
 * Resolve the root of the workspace, using bun, npm, pnpm, or yarn.
 * This will iterate the parent directories until it finds a workspace config,
 * where the starting directory is considered part of the workspace.
 *   - For bun and npm - it looks for the [`workspaces` list](https://docs.npmjs.com/cli/configuring-npm/package-json#workspaces) in `package.json`
 *   - For yarn - it looks for the [`workspaces` list or config](https://yarnpkg.com/features/workspaces) in `package.json`
 *   - For pnpm - it looks for the [`pnpm-workspace.yaml`](https://pnpm.io/workspaces) file
 */
export declare function resolveWorkspaceRoot(startingDir?: string, options?: ResolveWorkspaceOptions): string | null;
/**
 * Resolve the root of the workspace, using bun, npm, pnpm, or yarn.
 * This will iterate the parent directories until it finds a workspace config,
 * where the starting directory is considered part of the workspace.
 *   - For bun and npm - it looks for the [`workspaces` list](https://docs.npmjs.com/cli/configuring-npm/package-json#workspaces) in `package.json`
 *   - For yarn - it looks for the [`workspaces` list or config](https://yarnpkg.com/features/workspaces) in `package.json`
 *   - For pnpm - it looks for the [`pnpm-workspace.yaml`](https://pnpm.io/workspaces) file
 */
export declare function resolveWorkspaceRootAsync(startingDir?: string, options?: ResolveWorkspaceOptions): Promise<string | null>;
/**
 * Get the configured workspace globs from the monorepo.
 *   - For bun and npm - it looks for the [`workspaces` list](https://docs.npmjs.com/cli/configuring-npm/package-json#workspaces) in `package.json`
 *   - For yarn - it looks for the [`workspaces` list or config](https://yarnpkg.com/features/workspaces) in `package.json`
 *   - For pnpm - it looks for the [`pnpm-workspace.yaml`](https://pnpm.io/workspaces) file
 * @note The provided `rootDir` must be the root of the monorepo
 */
export declare function getWorkspaceGlobs(rootDir?: string, options?: ResolveWorkspaceOptions): string[] | null;
/**
 * Get the configured workspace globs from the monorepo.
 *   - For bun and npm - it looks for the [`workspaces` list](https://docs.npmjs.com/cli/configuring-npm/package-json#workspaces) in `package.json`
 *   - For yarn - it looks for the [`workspaces` list or config](https://yarnpkg.com/features/workspaces) in `package.json`
 *   - For pnpm - it looks for the [`pnpm-workspace.yaml`](https://pnpm.io/workspaces) file
 * @note The provided `rootDir` must be the root of the monorepo
 */
export declare function getWorkspaceGlobsAsync(rootDir?: string, options?: ResolveWorkspaceOptions): Promise<string[] | null>;
export {};
