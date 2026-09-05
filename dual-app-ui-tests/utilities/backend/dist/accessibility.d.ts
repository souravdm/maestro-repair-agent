interface HierarchyElement {
    id: string;
    type: string;
    text: string;
    bounds: string;
    clickable: boolean;
    focused: boolean;
}
export declare enum A11yCategory {
    PERCEIVABLE = "Perceivable",
    OPERABLE = "Operable",
    UNDERSTANDABLE = "Understandable",
    ROBUST = "Robust"
}
export declare enum A11ySeverity {
    CRITICAL = "critical",
    SERIOUS = "serious",
    MODERATE = "moderate",
    MINOR = "minor"
}
export interface A11yViolation {
    id: string;
    category: A11yCategory;
    severity: A11ySeverity;
    wcagCriteria: string;
    wcagLevel: 'A' | 'AA' | 'AAA';
    element: HierarchyElement;
    message: string;
    description: string;
    howToFix: string;
    impact: string;
    colorInfo?: {
        extractedHex: string;
        matchedToken?: string;
        deltaE?: number;
        contrastRatio?: number;
    };
}
export interface A11yReport {
    timestamp: string;
    totalElements: number;
    violations: A11yViolation[];
    passes: number;
    warnings: number;
    summary: {
        critical: number;
        serious: number;
        moderate: number;
        minor: number;
    };
    categoryBreakdown: {
        [key in A11yCategory]: number;
    };
    screenshot?: string;
    colorValidation?: {
        enabled: boolean;
        colorsAnalyzed: number;
        tokenMismatches: number;
        deprecatedColors: number;
        contrastIssues: number;
    };
}
export declare function validateAccessibility(hierarchy: HierarchyElement[], screenshotPath?: string): Promise<A11yReport>;
export declare function formatA11yReport(report: A11yReport): string;
export declare function generateHTMLReport(report: A11yReport): string;
export {};
//# sourceMappingURL=accessibility.d.ts.map