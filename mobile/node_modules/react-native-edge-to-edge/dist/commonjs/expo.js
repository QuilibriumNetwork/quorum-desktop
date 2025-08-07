"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _configPlugins = require("@expo/config-plugins");
const withAndroidEdgeToEdgeTheme = (config, props = {}) => {
  const themes = {
    Default: "Theme.EdgeToEdge",
    Material2: "Theme.EdgeToEdge.Material2",
    Material3: "Theme.EdgeToEdge.Material3",
    "Material3.Dynamic": "Theme.EdgeToEdge.Material3.Dynamic",
    Light: "Theme.EdgeToEdge.Light",
    "Material2.Light": "Theme.EdgeToEdge.Material2.Light",
    "Material3.Light": "Theme.EdgeToEdge.Material3.Light",
    "Material3.Dynamic.Light": "Theme.EdgeToEdge.Material3.Dynamic.Light"
  };
  const cleanupList = new Set(["enforceNavigationBarContrast", "android:enforceNavigationBarContrast", "android:enforceStatusBarContrast", "android:fitsSystemWindows", "android:navigationBarColor", "android:statusBarColor", "android:windowDrawsSystemBarBackgrounds", "android:windowLayoutInDisplayCutoutMode", "android:windowLightNavigationBar", "android:windowLightStatusBar", "android:windowTranslucentNavigation", "android:windowTranslucentStatus"]);
  return (0, _configPlugins.withAndroidStyles)(config, config => {
    const {
      androidNavigationBar = {},
      androidStatusBar = {},
      userInterfaceStyle = "light"
    } = config;
    const {
      barStyle: navigationBarStyle
    } = androidNavigationBar;
    const {
      barStyle: statusBarStyle
    } = androidStatusBar;
    const {
      android = {}
    } = props;
    const {
      enforceNavigationBarContrast,
      parentTheme = "Default"
    } = android;
    config.modResults.resources.style = config.modResults.resources.style?.map(style => {
      if (style.$.name === "AppTheme") {
        style.$.parent = themes[parentTheme] ?? themes["Default"];
        if (style.item != null) {
          style.item = style.item.filter(item => !cleanupList.has(item.$.name));
        }
        if (statusBarStyle != null) {
          style.item.push({
            $: {
              name: "android:windowLightStatusBar"
            },
            _: String(statusBarStyle === "dark-content")
          });
        } else if (userInterfaceStyle !== "automatic") {
          style.item.push({
            $: {
              name: "android:windowLightStatusBar"
            },
            _: String(userInterfaceStyle === "light")
          });
        }
        if (enforceNavigationBarContrast === false) {
          if (navigationBarStyle != null) {
            style.item.push({
              $: {
                name: "android:windowLightNavigationBar"
              },
              _: String(navigationBarStyle === "dark-content")
            });
          } else if (userInterfaceStyle !== "automatic") {
            style.item.push({
              $: {
                name: "android:windowLightNavigationBar"
              },
              _: String(navigationBarStyle === "light")
            });
          }
          style.item.push({
            $: {
              name: "enforceNavigationBarContrast"
            },
            _: String(false)
          });
        }
      }
      return style;
    });
    return config;
  });
};
var _default = exports.default = (0, _configPlugins.createRunOncePlugin)(withAndroidEdgeToEdgeTheme, "react-native-edge-to-edge");
//# sourceMappingURL=expo.js.map