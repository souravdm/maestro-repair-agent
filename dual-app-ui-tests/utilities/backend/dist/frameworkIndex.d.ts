export interface FrameworkEntry {
    relativePath: string;
    type: 'flow' | 'subflow';
    name: string;
    domain: string;
    tags: string[];
    hasLaunchApp: boolean;
    textTokens: string[];
    actionTypes: string[];
    runFlowRefs: string[];
    stepCount: number;
    summary: string;
}
export interface FrameworkIndex {
    subflows: FrameworkEntry[];
    flows: FrameworkEntry[];
    screens: string[];
    totalFiles: number;
    buildTimeMs: number;
}
export interface MatchResult {
    entry: FrameworkEntry;
    score: number;
    textScore: number;
    actionScore: number;
    reason: string;
}
export declare function buildFrameworkIndex(maestroRoot: string): Promise<FrameworkIndex>;
export declare function matchSteps(recordedSteps: Array<{
    type: string;
    target?: string;
    value?: string;
}>, index: FrameworkIndex, topN?: number): MatchResult[];
//# sourceMappingURL=frameworkIndex.d.ts.map