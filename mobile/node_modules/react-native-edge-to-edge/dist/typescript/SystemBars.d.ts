import { SystemBarsEntry, SystemBarsProps } from "./types";
export declare function SystemBars(props: SystemBarsProps): null;
export declare namespace SystemBars {
    var pushStackEntry: (props: SystemBarsProps) => SystemBarsEntry;
    var popStackEntry: (entry: SystemBarsEntry) => void;
    var replaceStackEntry: (entry: SystemBarsEntry, props: SystemBarsProps) => SystemBarsEntry;
    var setStyle: (style: SystemBarsProps["style"]) => void;
    var setHidden: (hidden: SystemBarsProps["hidden"]) => void;
}
//# sourceMappingURL=SystemBars.d.ts.map