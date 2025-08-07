import { ConfigPlugin } from "@expo/config-plugins";
type ParentTheme = "Default" | "Material2" | "Material3" | "Material3.Dynamic" | "Light" | "Material2.Light" | "Material3.Light" | "Material3.Dynamic.Light";
type AndroidProps = {
    enforceNavigationBarContrast?: boolean;
    parentTheme?: ParentTheme;
};
type Props = {
    android?: AndroidProps;
} | undefined;
declare const _default: ConfigPlugin<Props>;
export default _default;
//# sourceMappingURL=expo.d.ts.map