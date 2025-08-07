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
    DevToolsPluginEndpoint: function() {
        return DevToolsPluginEndpoint;
    },
    default: function() {
        return DevToolsPluginManager;
    }
});
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
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const debug = require('debug')('expo:start:server:devtools');
const DevToolsPluginEndpoint = '/_expo/plugins';
class DevToolsPluginManager {
    constructor(projectRoot){
        this.projectRoot = projectRoot;
        this.plugins = null;
    }
    async queryPluginsAsync() {
        if (this.plugins) {
            return this.plugins;
        }
        const plugins = (await this.queryAutolinkedPluginsAsync(this.projectRoot)).map((plugin)=>({
                ...plugin,
                webpageEndpoint: `${DevToolsPluginEndpoint}/${plugin.packageName}`
            }));
        this.plugins = plugins;
        return this.plugins;
    }
    async queryPluginWebpageRootAsync(pluginName) {
        const plugins = await this.queryPluginsAsync();
        const plugin = plugins.find((p)=>p.packageName === pluginName);
        return (plugin == null ? void 0 : plugin.webpageRoot) ?? null;
    }
    async queryAutolinkedPluginsAsync(projectRoot) {
        const expoPackagePath = _resolvefrom().default.silent(projectRoot, 'expo/package.json');
        if (!expoPackagePath) {
            return [];
        }
        const resolvedPath = _resolvefrom().default.silent(_path().default.dirname(expoPackagePath), 'expo-modules-autolinking/exports');
        if (!resolvedPath) {
            return [];
        }
        const autolinkingModule = require(resolvedPath);
        if (!autolinkingModule.queryAutolinkingModulesFromProjectAsync) {
            throw new Error('Missing exported `queryAutolinkingModulesFromProjectAsync()` function from `expo-modules-autolinking`');
        }
        const plugins = await autolinkingModule.queryAutolinkingModulesFromProjectAsync(projectRoot, {
            platform: 'devtools',
            onlyProjectDeps: false
        });
        debug('Found autolinked plugins', this.plugins);
        return plugins;
    }
}

//# sourceMappingURL=DevToolsPluginManager.js.map