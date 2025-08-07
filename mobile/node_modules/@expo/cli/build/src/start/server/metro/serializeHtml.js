"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "serializeHtmlWithAssets", {
    enumerable: true,
    get: function() {
        return serializeHtmlWithAssets;
    }
});
const debug = require('debug')('expo:metro:html');
function serializeHtmlWithAssets({ resources, template, devBundleUrl, baseUrl, route, isExporting, hydrate }) {
    if (!resources) {
        return '';
    }
    return htmlFromSerialAssets(resources, {
        isExporting,
        template,
        baseUrl,
        bundleUrl: isExporting ? undefined : devBundleUrl,
        route,
        hydrate
    });
}
/**
 * Combine the path segments of a URL.
 * This filters out empty segments and avoids duplicate slashes when joining.
 * If base url is empty, it will be treated as a root path, adding `/` to the beginning.
 */ function combineUrlPath(baseUrl, ...segments) {
    return [
        baseUrl || '/',
        ...segments
    ].filter(Boolean).map((segment, index)=>{
        const segmentIsBaseUrl = index === 0;
        // Do not remove leading slashes from baseUrl
        return segment.replace(segmentIsBaseUrl ? /\/+$/g : /^\/+|\/+$/g, '');
    }).join('/');
}
function htmlFromSerialAssets(assets, { isExporting, template, baseUrl, bundleUrl, route, hydrate }) {
    // Combine the CSS modules into tags that have hot refresh data attributes.
    const styleString = assets.filter((asset)=>asset.type.startsWith('css')).map(({ type, metadata, filename, source })=>{
        if (type === 'css') {
            if (isExporting) {
                return [
                    `<link rel="preload" href="${combineUrlPath(baseUrl, filename)}" as="style">`,
                    `<link rel="stylesheet" href="${combineUrlPath(baseUrl, filename)}">`
                ].join('');
            } else {
                return `<style data-expo-css-hmr="${metadata.hmrId}">` + source + '\n</style>';
            }
        }
        // External link tags will be passed through as-is.
        return source;
    }).join('');
    const jsAssets = assets.filter((asset)=>asset.type === 'js');
    const scripts = bundleUrl ? `<script src="${bundleUrl}" defer></script>` : jsAssets.map(({ filename, metadata })=>{
        // TODO: Mark dependencies of the HTML and include them to prevent waterfalls.
        if (metadata.isAsync) {
            // We have the data required to match async chunks to the route's HTML file.
            if ((route == null ? void 0 : route.entryPoints) && metadata.modulePaths && Array.isArray(route.entryPoints) && Array.isArray(metadata.modulePaths)) {
                // TODO: Handle module IDs like `expo-router/build/views/Unmatched.js`
                const doesAsyncChunkContainRouteEntryPoint = route.entryPoints.some((entryPoint)=>metadata.modulePaths.includes(entryPoint));
                if (!doesAsyncChunkContainRouteEntryPoint) {
                    return '';
                }
                debug('Linking async chunk %s to HTML for route %s', filename, route.contextKey);
            // Pass through to the next condition.
            } else {
                return '';
            }
        // Mark async chunks as defer so they don't block the page load.
        // return `<script src="${combineUrlPath(baseUrl, filename)" defer></script>`;
        }
        return `<script src="${combineUrlPath(baseUrl, filename)}" defer></script>`;
    }).join('');
    if (hydrate) {
        const hydrateScript = `<script type="module">globalThis.__EXPO_ROUTER_HYDRATE__=true;</script>`;
        template = template.replace('</head>', `${hydrateScript}</head>`);
    }
    return template.replace('</head>', `${styleString}</head>`).replace('</body>', `${scripts}\n</body>`);
}

//# sourceMappingURL=serializeHtml.js.map