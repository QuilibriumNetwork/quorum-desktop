import type { TurboModule } from "react-native";
interface Spec extends TurboModule {
    onColorSchemeChange(): void;
    setStatusBarStyle(style: string): void;
    setNavigationBarStyle(style: string): void;
    setStatusBarHidden(hidden: boolean): void;
    setNavigationBarHidden(hidden: boolean): void;
}
declare const NativeModule: Spec | null;
export default NativeModule;
//# sourceMappingURL=NativeEdgeToEdgeModule.d.ts.map