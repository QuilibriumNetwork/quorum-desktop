"use strict";
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
    getApiRoutesForDirectory: function() {
        return getApiRoutesForDirectory;
    },
    getAppRouterRelativeEntryPath: function() {
        return getAppRouterRelativeEntryPath;
    },
    getRoutePaths: function() {
        return getRoutePaths;
    },
    getRouterDirectory: function() {
        return getRouterDirectory;
    },
    getRouterDirectoryModuleIdWithManifest: function() {
        return getRouterDirectoryModuleIdWithManifest;
    },
    hasWarnedAboutApiRoutes: function() {
        return hasWarnedAboutApiRoutes;
    },
    isApiRouteConvention: function() {
        return isApiRouteConvention;
    },
    warnInvalidWebOutput: function() {
        return warnInvalidWebOutput;
    }
});
function _chalk() {
    const data = /*#__PURE__*/ _interop_require_default(require("chalk"));
    _chalk = function() {
        return data;
    };
    return data;
}
function _glob() {
    const data = require("glob");
    _glob = function() {
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
function _resolvefrom() {
    const data = /*#__PURE__*/ _interop_require_default(require("resolve-from"));
    _resolvefrom = function() {
        return data;
    };
    return data;
}
const _log = require("../../../log");
const _dir = require("../../../utils/dir");
const _filePath = require("../../../utils/filePath");
const _link = require("../../../utils/link");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const debug = require('debug')('expo:start:server:metro:router');
function getAppRouterRelativeEntryPath(projectRoot, routerDirectory = getRouterDirectory(projectRoot)) {
    // Auto pick App entry
    const routerEntry = _resolvefrom().default.silent(projectRoot, 'expo-router/entry') ?? getFallbackEntryRoot(projectRoot);
    if (!routerEntry) {
        return undefined;
    }
    // It doesn't matter if the app folder exists.
    const appFolder = _path().default.join(projectRoot, routerDirectory);
    const appRoot = _path().default.relative(_path().default.dirname(routerEntry), appFolder);
    debug('expo-router entry', routerEntry, appFolder, appRoot);
    return appRoot;
}
/** If the `expo-router` package is not installed, then use the `expo` package to determine where the node modules are relative to the project. */ function getFallbackEntryRoot(projectRoot) {
    const expoRoot = _resolvefrom().default.silent(projectRoot, 'expo/package.json');
    if (expoRoot) {
        return _path().default.join(_path().default.dirname(_path().default.dirname(expoRoot)), 'expo-router/entry');
    }
    return _path().default.join(projectRoot, 'node_modules/expo-router/entry');
}
function getRouterDirectoryModuleIdWithManifest(projectRoot, exp) {
    var _exp_extra_router, _exp_extra;
    return (0, _filePath.toPosixPath)(((_exp_extra = exp.extra) == null ? void 0 : (_exp_extra_router = _exp_extra.router) == null ? void 0 : _exp_extra_router.root) ?? getRouterDirectory(projectRoot));
}
let hasWarnedAboutSrcDir = false;
const logSrcDir = ()=>{
    if (hasWarnedAboutSrcDir) return;
    hasWarnedAboutSrcDir = true;
    _log.Log.log(_chalk().default.gray('Using src/app as the root directory for Expo Router.'));
};
function getRouterDirectory(projectRoot) {
    // more specific directories first
    if ((0, _dir.directoryExistsSync)(_path().default.join(projectRoot, 'src', 'app'))) {
        logSrcDir();
        return _path().default.join('src', 'app');
    }
    debug('Using app as the root directory for Expo Router.');
    return 'app';
}
function isApiRouteConvention(name) {
    return /\+api\.[tj]sx?$/.test(name);
}
function getApiRoutesForDirectory(cwd) {
    return (0, _glob().sync)('**/*+api.@(ts|tsx|js|jsx)', {
        cwd,
        absolute: true,
        dot: true
    });
}
function getRoutePaths(cwd) {
    return (0, _glob().sync)('**/*.@(ts|tsx|js|jsx)', {
        cwd,
        dot: true
    }).map((p)=>'./' + normalizePaths(p));
}
function normalizePaths(p) {
    return p.replace(/\\/g, '/');
}
let hasWarnedAboutApiRouteOutput = false;
function hasWarnedAboutApiRoutes() {
    return hasWarnedAboutApiRouteOutput;
}
function warnInvalidWebOutput() {
    if (!hasWarnedAboutApiRouteOutput) {
        _log.Log.warn(_chalk().default.yellow`Using API routes requires the {bold web.output} to be set to {bold "server"} in the project {bold app.json}. ${(0, _link.learnMore)('https://docs.expo.dev/router/reference/api-routes/')}`);
    }
    hasWarnedAboutApiRouteOutput = true;
}

//# sourceMappingURL=router.js.map