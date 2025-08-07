/**
 * Copyright © 2022 650 Industries.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    getDefaultMetroResolver: function() {
        return getDefaultMetroResolver;
    },
    withMetroErrorReportingResolver: function() {
        return withMetroErrorReportingResolver;
    },
    withMetroMutatedResolverContext: function() {
        return withMetroMutatedResolverContext;
    },
    withMetroResolvers: function() {
        return withMetroResolvers;
    }
});
function _chalk() {
    const data = /*#__PURE__*/ _interop_require_default(require("chalk"));
    _chalk = function() {
        return data;
    };
    return data;
}
function _metroresolver() {
    const data = /*#__PURE__*/ _interop_require_wildcard(require("metro-resolver"));
    _metroresolver = function() {
        return data;
    };
    return data;
}
function _path() {
    const data = /*#__PURE__*/ _interop_require_default(require("path"));
    _path = function() {
        return data;
    };
    return data;
}
const _metroErrors = require("./metroErrors");
const _env = require("../../../utils/env");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
const debug = require('debug')('expo:metro:withMetroResolvers');
function getDefaultMetroResolver(projectRoot) {
    return (context, moduleName, platform)=>{
        return _metroresolver().resolve(context, moduleName, platform);
    };
}
function optionsKeyForContext(context) {
    const canonicalize = require('metro-core/src/canonicalize');
    // Compound key for the resolver cache
    return JSON.stringify(context.customResolverOptions ?? {}, canonicalize) ?? '';
}
function withMetroResolvers(config, resolvers) {
    var _config_resolver, _config_resolver1;
    debug(`Appending ${resolvers.length} custom resolvers to Metro config. (has custom resolver: ${!!((_config_resolver = config.resolver) == null ? void 0 : _config_resolver.resolveRequest)})`);
    // const hasUserDefinedResolver = !!config.resolver?.resolveRequest;
    // const defaultResolveRequest = getDefaultMetroResolver(projectRoot);
    const originalResolveRequest = (_config_resolver1 = config.resolver) == null ? void 0 : _config_resolver1.resolveRequest;
    return {
        ...config,
        resolver: {
            ...config.resolver,
            resolveRequest (context, moduleName, platform) {
                const upstreamResolveRequest = context.resolveRequest;
                const universalContext = {
                    ...context,
                    resolveRequest (ctx, moduleName, platform) {
                        for (const resolver of resolvers){
                            try {
                                const res = resolver(ctx, moduleName, platform);
                                if (res) {
                                    return res;
                                }
                            } catch (error) {
                                var _ctx_customResolverOptions;
                                // If the error is directly related to a resolver not being able to resolve a module, then
                                // we can ignore the error and try the next resolver. Otherwise, we should throw the error.
                                const isResolutionError = (0, _metroErrors.isFailedToResolveNameError)(error) || (0, _metroErrors.isFailedToResolvePathError)(error);
                                if (!isResolutionError) {
                                    throw error;
                                }
                                debug(`Custom resolver (${resolver.name || '<anonymous>'}) threw: ${error.constructor.name}. (module: ${moduleName}, platform: ${platform}, env: ${(_ctx_customResolverOptions = ctx.customResolverOptions) == null ? void 0 : _ctx_customResolverOptions.environment}, origin: ${ctx.originModulePath})`);
                            }
                        }
                        // If we haven't returned by now, use the original resolver or upstream resolver.
                        return upstreamResolveRequest(ctx, moduleName, platform);
                    }
                };
                // If the user defined a resolver, run it first and depend on the documented
                // chaining logic: https://facebook.github.io/metro/docs/resolution/#resolution-algorithm
                //
                // config.resolver.resolveRequest = (context, moduleName, platform) => {
                //
                //  // Do work...
                //
                //  return context.resolveRequest(context, moduleName, platform);
                // };
                const firstResolver = originalResolveRequest ?? universalContext.resolveRequest;
                return firstResolver(universalContext, moduleName, platform);
            }
        }
    };
}
function withMetroMutatedResolverContext(config, getContext) {
    var _config_resolver;
    const defaultResolveRequest = getDefaultMetroResolver(config.projectRoot);
    const originalResolveRequest = (_config_resolver = config.resolver) == null ? void 0 : _config_resolver.resolveRequest;
    return {
        ...config,
        resolver: {
            ...config.resolver,
            resolveRequest (context, moduleName, platform) {
                const universalContext = getContext(context, moduleName, platform);
                const firstResolver = originalResolveRequest ?? universalContext.resolveRequest ?? defaultResolveRequest;
                return firstResolver(universalContext, moduleName, platform);
            }
        }
    };
}
function withMetroErrorReportingResolver(config) {
    var _config_resolver;
    if (!_env.env.EXPO_METRO_UNSTABLE_ERRORS) {
        return config;
    }
    const originalResolveRequest = (_config_resolver = config.resolver) == null ? void 0 : _config_resolver.resolveRequest;
    function mutateResolutionError(error, context, moduleName, platform) {
        var _config_server;
        const inputPlatform = platform ?? 'null';
        const mapByOrigin = depGraph.get(optionsKeyForContext(context));
        const mapByPlatform = mapByOrigin == null ? void 0 : mapByOrigin.get(inputPlatform);
        if (!mapByPlatform) {
            return error;
        }
        // collect all references inversely using some expensive lookup
        const getReferences = (origin)=>{
            const inverseOrigin = [];
            if (!mapByPlatform) {
                return inverseOrigin;
            }
            for (const [originKey, mapByTarget] of mapByPlatform){
                // search comparing origin to path
                const found = [
                    ...mapByTarget.values()
                ].find((resolution)=>resolution.path === origin);
                if (found) {
                    inverseOrigin.push({
                        origin,
                        previous: originKey,
                        request: found.request
                    });
                }
            }
            return inverseOrigin;
        };
        const pad = (num)=>{
            return new Array(num).fill(' ').join('');
        };
        const root = ((_config_server = config.server) == null ? void 0 : _config_server.unstable_serverRoot) ?? config.projectRoot;
        const recurseBackWithLimit = (req, limit, count = 0)=>{
            const results = {
                origin: req.origin,
                request: req.request,
                previous: []
            };
            if (count >= limit) {
                return results;
            }
            const inverse = getReferences(req.origin);
            for (const match of inverse){
                // Use more qualified name if possible
                // results.origin = match.origin;
                // Found entry point
                if (req.origin === match.previous) {
                    continue;
                }
                results.previous.push(recurseBackWithLimit({
                    origin: match.previous,
                    request: match.request
                }, limit, count + 1));
            }
            return results;
        };
        const inverseTree = recurseBackWithLimit({
            origin: context.originModulePath,
            request: moduleName
        }, // TODO: Do we need to expose this?
        35);
        if (inverseTree.previous.length > 0) {
            debug('Found inverse graph:', JSON.stringify(inverseTree, null, 2));
            let extraMessage = _chalk().default.bold('Import stack:');
            const printRecursive = (tree, depth = 0)=>{
                let filename = _path().default.relative(root, tree.origin);
                if (filename.match(/\?ctx=[\w\d]+$/)) {
                    filename = filename.replace(/\?ctx=[\w\d]+$/, _chalk().default.dim(' (require.context)'));
                } else {
                    let formattedRequest = _chalk().default.green(`"${tree.request}"`);
                    if (// If bundling for web and the import is pulling internals from outside of react-native
                    // then mark it as an invalid import.
                    inputPlatform === 'web' && !/^(node_modules\/)?react-native\//.test(filename) && tree.request.match(/^react-native\/.*/)) {
                        formattedRequest = formattedRequest + (0, _chalk().default)`\n          {yellow Importing react-native internals is not supported on web.}`;
                    }
                    filename = filename + (0, _chalk().default)`\n{gray  |} {cyan import} ${formattedRequest}\n`;
                }
                let line = '\n' + pad(depth) + _chalk().default.gray(' ') + filename;
                if (filename.match(/node_modules/)) {
                    line = _chalk().default.gray(// Bold the node module name
                    line.replace(/node_modules\/([^/]+)/, (_match, p1)=>{
                        return 'node_modules/' + _chalk().default.bold(p1);
                    }));
                }
                extraMessage += line;
                for (const child of tree.previous){
                    printRecursive(child, // Only add depth if there are multiple children
                    tree.previous.length > 1 ? depth + 1 : depth);
                }
            };
            printRecursive(inverseTree);
            debug('inverse graph message:', extraMessage);
            // @ts-expect-error
            error._expoImportStack = extraMessage;
        } else {
            debug('Found no inverse tree for:', context.originModulePath);
        }
        return error;
    }
    const depGraph = new Map();
    return {
        ...config,
        resolver: {
            ...config.resolver,
            resolveRequest (context, moduleName, platform) {
                const storeResult = (res)=>{
                    const inputPlatform = platform ?? 'null';
                    const key = optionsKeyForContext(context);
                    if (!depGraph.has(key)) depGraph.set(key, new Map());
                    const mapByTarget = depGraph.get(key);
                    if (!mapByTarget.has(inputPlatform)) mapByTarget.set(inputPlatform, new Map());
                    const mapByPlatform = mapByTarget.get(inputPlatform);
                    if (!mapByPlatform.has(context.originModulePath)) mapByPlatform.set(context.originModulePath, new Set());
                    const setForModule = mapByPlatform.get(context.originModulePath);
                    const qualifiedModuleName = (res == null ? void 0 : res.type) === 'sourceFile' ? res.filePath : moduleName;
                    setForModule.add({
                        path: qualifiedModuleName,
                        request: moduleName
                    });
                };
                // If the user defined a resolver, run it first and depend on the documented
                // chaining logic: https://facebook.github.io/metro/docs/resolution/#resolution-algorithm
                //
                // config.resolver.resolveRequest = (context, moduleName, platform) => {
                //
                //  // Do work...
                //
                //  return context.resolveRequest(context, moduleName, platform);
                // };
                try {
                    const firstResolver = originalResolveRequest ?? context.resolveRequest;
                    const res = firstResolver(context, moduleName, platform);
                    storeResult(res);
                    return res;
                } catch (error) {
                    throw mutateResolutionError(error, context, moduleName, platform);
                }
            }
        }
    };
}

//# sourceMappingURL=withMetroResolvers.js.map