"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createCorsMiddleware", {
    enumerable: true,
    get: function() {
        return createCorsMiddleware;
    }
});
const DEFAULT_ALLOWED_CORS_HOSTNAMES = [
    'localhost',
    'chrome-devtools-frontend.appspot.com',
    'devtools'
];
function createCorsMiddleware(exp) {
    var _exp_extra_router, _exp_extra, _exp_extra_router1, _exp_extra1;
    const allowedHostnames = [
        ...DEFAULT_ALLOWED_CORS_HOSTNAMES
    ];
    // Support for expo-router API routes
    if ((_exp_extra = exp.extra) == null ? void 0 : (_exp_extra_router = _exp_extra.router) == null ? void 0 : _exp_extra_router.headOrigin) {
        allowedHostnames.push(new URL(exp.extra.router.headOrigin).hostname);
    }
    if ((_exp_extra1 = exp.extra) == null ? void 0 : (_exp_extra_router1 = _exp_extra1.router) == null ? void 0 : _exp_extra_router1.origin) {
        allowedHostnames.push(new URL(exp.extra.router.origin).hostname);
    }
    return (req, res, next)=>{
        if (typeof req.headers.origin === 'string') {
            const { host, hostname } = new URL(req.headers.origin);
            const isSameOrigin = host === req.headers.host;
            if (!isSameOrigin && !allowedHostnames.includes(hostname)) {
                next(new Error(`Unauthorized request from ${req.headers.origin}. ` + 'This may happen because of a conflicting browser extension to intercept HTTP requests. ' + 'Disable browser extensions or use incognito mode and try again.'));
                return;
            }
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
            maybePreventMetroResetCorsHeader(req, res);
        }
        // Block MIME-type sniffing.
        res.setHeader('X-Content-Type-Options', 'nosniff');
        next();
    };
}
// When accessing source maps,
// metro will overwrite the `Access-Control-Allow-Origin` header with hardcoded `devtools://devtools` value.
// https://github.com/facebook/metro/blob/a7f8955e6d2424b0d5f73d4bcdaf22560e1d5f27/packages/metro/src/Server.js#L540
// This is a workaround to prevent this behavior.
function maybePreventMetroResetCorsHeader(req, res) {
    const pathname = req.url ? new URL(req.url, `http://${req.headers.host}`).pathname : '';
    if (pathname.endsWith('.map')) {
        const setHeader = res.setHeader.bind(res);
        res.setHeader = (key, ...args)=>{
            if (key !== 'Access-Control-Allow-Origin') {
                setHeader(key, ...args);
            }
            return res;
        };
    }
}

//# sourceMappingURL=CorsMiddleware.js.map