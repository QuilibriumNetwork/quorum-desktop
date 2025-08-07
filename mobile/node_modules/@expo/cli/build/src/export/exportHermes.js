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
    assertEngineMismatchAsync: function() {
        return assertEngineMismatchAsync;
    },
    getHermesBytecodeBundleVersionAsync: function() {
        return getHermesBytecodeBundleVersionAsync;
    },
    isAndroidUsingHermes: function() {
        return isAndroidUsingHermes;
    },
    isEnableHermesManaged: function() {
        return isEnableHermesManaged;
    },
    isHermesBytecodeBundleAsync: function() {
        return isHermesBytecodeBundleAsync;
    },
    isHermesPossiblyEnabled: function() {
        return isHermesPossiblyEnabled;
    },
    isIosUsingHermes: function() {
        return isIosUsingHermes;
    },
    maybeInconsistentEngineAndroidAsync: function() {
        return maybeInconsistentEngineAndroidAsync;
    },
    maybeInconsistentEngineIosAsync: function() {
        return maybeInconsistentEngineIosAsync;
    },
    maybeThrowFromInconsistentEngineAsync: function() {
        return maybeThrowFromInconsistentEngineAsync;
    },
    parseGradleProperties: function() {
        return parseGradleProperties;
    }
});
function _config() {
    const data = require("@expo/config");
    _config = function() {
        return data;
    };
    return data;
}
function _jsonfile() {
    const data = /*#__PURE__*/ _interop_require_default(require("@expo/json-file"));
    _jsonfile = function() {
        return data;
    };
    return data;
}
function _fs() {
    const data = /*#__PURE__*/ _interop_require_default(require("fs"));
    _fs = function() {
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
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
async function assertEngineMismatchAsync(projectRoot, exp, platform) {
    const isHermesManaged = isEnableHermesManaged(exp, platform);
    const paths = (0, _config().getConfigFilePaths)(projectRoot);
    const configFilePath = paths.dynamicConfigPath ?? paths.staticConfigPath ?? 'app.json';
    await maybeThrowFromInconsistentEngineAsync(projectRoot, configFilePath, platform, isHermesManaged);
}
function isEnableHermesManaged(expoConfig, platform) {
    switch(platform){
        case 'android':
            {
                var _expoConfig_android;
                return (((_expoConfig_android = expoConfig.android) == null ? void 0 : _expoConfig_android.jsEngine) ?? expoConfig.jsEngine) !== 'jsc';
            }
        case 'ios':
            {
                var _expoConfig_ios;
                return (((_expoConfig_ios = expoConfig.ios) == null ? void 0 : _expoConfig_ios.jsEngine) ?? expoConfig.jsEngine) !== 'jsc';
            }
        default:
            return false;
    }
}
function parseGradleProperties(content) {
    const result = {};
    for (let line of content.split('\n')){
        line = line.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        const sepIndex = line.indexOf('=');
        const key = line.slice(0, sepIndex);
        const value = line.slice(sepIndex + 1);
        result[key] = value;
    }
    return result;
}
async function maybeThrowFromInconsistentEngineAsync(projectRoot, configFilePath, platform, isHermesManaged) {
    const configFileName = _path().default.basename(configFilePath);
    if (platform === 'android' && await maybeInconsistentEngineAndroidAsync(projectRoot, isHermesManaged)) {
        throw new Error(`JavaScript engine configuration is inconsistent between ${configFileName} and Android native project.\n` + `In ${configFileName}: Hermes is ${isHermesManaged ? 'enabled' : 'not enabled'}\n` + `In Android native project: Hermes is ${isHermesManaged ? 'not enabled' : 'enabled'}\n` + `Check the following files for inconsistencies:\n` + `  - ${configFilePath}\n` + `  - ${_path().default.join(projectRoot, 'android', 'gradle.properties')}\n` + `  - ${_path().default.join(projectRoot, 'android', 'app', 'build.gradle')}\n` + 'Learn more: https://expo.fyi/hermes-android-config');
    }
    if (platform === 'ios' && await maybeInconsistentEngineIosAsync(projectRoot, isHermesManaged)) {
        throw new Error(`JavaScript engine configuration is inconsistent between ${configFileName} and iOS native project.\n` + `In ${configFileName}: Hermes is ${isHermesManaged ? 'enabled' : 'not enabled'}\n` + `In iOS native project: Hermes is ${isHermesManaged ? 'not enabled' : 'enabled'}\n` + `Check the following files for inconsistencies:\n` + `  - ${configFilePath}\n` + `  - ${_path().default.join(projectRoot, 'ios', 'Podfile')}\n` + `  - ${_path().default.join(projectRoot, 'ios', 'Podfile.properties.json')}\n` + 'Learn more: https://expo.fyi/hermes-ios-config');
    }
}
async function maybeInconsistentEngineAndroidAsync(projectRoot, isHermesManaged) {
    // Trying best to check android native project if by chance to be consistent between app config
    // Check gradle.properties from prebuild template
    const gradlePropertiesPath = _path().default.join(projectRoot, 'android', 'gradle.properties');
    if (_fs().default.existsSync(gradlePropertiesPath)) {
        const props = parseGradleProperties(await _fs().default.promises.readFile(gradlePropertiesPath, 'utf8'));
        const isHermesBare = props['hermesEnabled'] === 'true';
        if (isHermesManaged !== isHermesBare) {
            return true;
        }
    }
    return false;
}
function isHermesPossiblyEnabled(projectRoot) {
    // Trying best to check ios native project if by chance to be consistent between app config
    // Check ios/Podfile for ":hermes_enabled => true"
    const podfilePath = _path().default.join(projectRoot, 'ios', 'Podfile');
    if (_fs().default.existsSync(podfilePath)) {
        const content = _fs().default.readFileSync(podfilePath, 'utf8');
        const isPropsReference = content.search(/^\s*:hermes_enabled\s*=>\s*podfile_properties\['expo.jsEngine'\]\s*==\s*nil\s*\|\|\s*podfile_properties\['expo.jsEngine'\]\s*==\s*'hermes',?/m) >= 0;
        const isHermesBare = content.search(/^\s*:hermes_enabled\s*=>\s*true,?\s+/m) >= 0;
        if (!isPropsReference && isHermesBare) {
            return true;
        }
    }
    // Check Podfile.properties.json from prebuild template
    const podfilePropertiesPath = _path().default.join(projectRoot, 'ios', 'Podfile.properties.json');
    if (_fs().default.existsSync(podfilePropertiesPath)) {
        try {
            const props = _jsonfile().default.read(podfilePropertiesPath);
            return props['expo.jsEngine'] === 'hermes';
        } catch  {
        // ignore
        }
    }
    return null;
}
async function maybeInconsistentEngineIosAsync(projectRoot, isHermesManaged) {
    // Trying best to check ios native project if by chance to be consistent between app config
    // Check ios/Podfile for ":hermes_enabled => true"
    const podfilePath = _path().default.join(projectRoot, 'ios', 'Podfile');
    if (_fs().default.existsSync(podfilePath)) {
        const content = await _fs().default.promises.readFile(podfilePath, 'utf8');
        const isPropsReference = content.search(/^\s*:hermes_enabled\s*=>\s*podfile_properties\['expo.jsEngine'\]\s*==\s*nil\s*\|\|\s*podfile_properties\['expo.jsEngine'\]\s*==\s*'hermes',?/m) >= 0;
        const isHermesBare = content.search(/^\s*:hermes_enabled\s*=>\s*true,?\s+/m) >= 0;
        if (!isPropsReference && isHermesManaged !== isHermesBare) {
            return true;
        }
    }
    // Check Podfile.properties.json from prebuild template
    const podfilePropertiesPath = _path().default.join(projectRoot, 'ios', 'Podfile.properties.json');
    if (_fs().default.existsSync(podfilePropertiesPath)) {
        const props = await parsePodfilePropertiesAsync(podfilePropertiesPath);
        const isHermesBare = props['expo.jsEngine'] === 'hermes';
        if (isHermesManaged !== isHermesBare) {
            return true;
        }
    }
    return false;
}
// https://github.com/facebook/hermes/blob/release-v0.5/include/hermes/BCGen/HBC/BytecodeFileFormat.h#L24-L25
const HERMES_MAGIC_HEADER = 'c61fbc03c103191f';
async function isHermesBytecodeBundleAsync(file) {
    const header = await readHermesHeaderAsync(file);
    return header.subarray(0, 8).toString('hex') === HERMES_MAGIC_HEADER;
}
async function getHermesBytecodeBundleVersionAsync(file) {
    const header = await readHermesHeaderAsync(file);
    if (header.subarray(0, 8).toString('hex') !== HERMES_MAGIC_HEADER) {
        throw new Error('Invalid hermes bundle file');
    }
    return header.readUInt32LE(8);
}
async function readHermesHeaderAsync(file) {
    const fd = await _fs().default.promises.open(file, 'r');
    const buffer = Buffer.alloc(12);
    await fd.read(buffer, 0, 12, null);
    await fd.close();
    return buffer;
}
async function parsePodfilePropertiesAsync(podfilePropertiesPath) {
    try {
        return JSON.parse(await _fs().default.promises.readFile(podfilePropertiesPath, 'utf8'));
    } catch  {
        return {};
    }
}
function isAndroidUsingHermes(projectRoot) {
    // Check gradle.properties from prebuild template
    const gradlePropertiesPath = _path().default.join(projectRoot, 'android', 'gradle.properties');
    if (_fs().default.existsSync(gradlePropertiesPath)) {
        const props = parseGradleProperties(_fs().default.readFileSync(gradlePropertiesPath, 'utf8'));
        return props['hermesEnabled'] === 'true';
    }
    // Assume Hermes is used by default.
    return true;
}
function isIosUsingHermes(projectRoot) {
    // If nullish, then assume Hermes is used.
    return isHermesPossiblyEnabled(projectRoot) !== false;
}

//# sourceMappingURL=exportHermes.js.map