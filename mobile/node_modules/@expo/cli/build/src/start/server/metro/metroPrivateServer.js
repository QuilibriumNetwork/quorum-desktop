"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "assertMetroPrivateServer", {
    enumerable: true,
    get: function() {
        return assertMetroPrivateServer;
    }
});
function _nodeassert() {
    const data = /*#__PURE__*/ _interop_require_default(require("node:assert"));
    _nodeassert = function() {
        return data;
    };
    return data;
}
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function assertMetroPrivateServer(metro) {
    (0, _nodeassert().default)(metro, 'Metro server undefined.');
    (0, _nodeassert().default)('_config' in metro && '_bundler' in metro, 'Metro server is missing expected properties (_config, _bundler). This could be due to a version mismatch or change in the Metro API.');
}

//# sourceMappingURL=metroPrivateServer.js.map