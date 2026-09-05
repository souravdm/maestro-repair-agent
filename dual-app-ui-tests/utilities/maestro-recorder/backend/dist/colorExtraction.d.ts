/**
 * Color Extraction and Validation Utility
 *
 * Extracts colors from screenshots and validates them against CVS Pulse design tokens.
 * Uses screenshot analysis to get actual rendered colors from the app.
 */
import { ColorToken } from './cvsColorTokens';
interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}
interface ExtractedColor {
    rgb: {
        r: number;
        g: number;
        b: number;
    };
    hex: string;
    dominance: number;
}
interface ColorMatch {
    token: ColorToken;
    deltaE: number;
    confidence: 'exact' | 'close' | 'similar' | 'different';
}
export interface ColorViolation {
    severity: 'error' | 'warning' | 'info';
    message: string;
    extractedColor: ExtractedColor;
    expectedToken?: ColorToken;
    suggestion: string;
    deltaE?: number;
}
/**
 * Extract dominant color from a specific region of a screenshot
 */
export declare function extractColorFromRegion(screenshotPath: string, bounds: Bounds): Promise<ExtractedColor | null>;
/**
 * Extract color palette from entire screenshot
 * Note: This is a simplified version using sharp's stats
 * For more advanced palette extraction, consider using a dedicated library
 */
export declare function extractColorPalette(screenshotPath: string, paletteSize?: number): Promise<ExtractedColor[]>;
/**
 * Find the closest CVS color token match
 */
export declare function findClosestColorToken(extractedColor: ExtractedColor): ColorMatch;
/**
 * Validate color against CVS design tokens
 */
export declare function validateColor(extractedColor: ExtractedColor, elementType: string, elementText: string, elementId?: string): ColorViolation[];
/**
 * Validate color contrast for text elements
 */
export declare function validateTextContrast(screenshotPath: string, textBounds: Bounds, fontSize?: number): Promise<ColorViolation[]>;
export {};
//# sourceMappingURL=colorExtraction.d.ts.map