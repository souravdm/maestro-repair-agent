/**
 * CVS Pulse Design System - Color Tokens
 *
 * Extracted from Figma: Digital Pulse Core Tokens - CVS
 * https://www.figma.com/design/A2Nf7qRGwNnIGeogzlCfid/Digital-Pulse-Core-Tokens---CVS
 *
 * These tokens represent the official CVS brand colors and should be used
 * for all UI elements to maintain brand consistency.
 */
export interface ColorToken {
    name: string;
    family: string;
    shade: string;
    hex: string;
    rgb: {
        r: number;
        g: number;
        b: number;
    };
    usage: string;
    deprecated?: boolean;
}
export declare const CVS_COLOR_TOKENS: ColorToken[];
export declare const DEPRECATED_COLOR_FAMILIES: string[];
export declare const COLOR_USAGE_GUIDELINES: Record<string, string>;
export declare const SEMANTIC_COLOR_MAPPING: Record<string, string[]>;
//# sourceMappingURL=cvsColorTokens.d.ts.map