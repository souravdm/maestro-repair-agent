declare module 'color-contrast-checker' {
  export default class ColorContrastChecker {
    constructor();
    
    /**
     * Get contrast ratio between two colors
     * @param rgb1 - First color as [r, g, b] array
     * @param rgb2 - Second color as [r, g, b] array
     * @returns Contrast ratio (e.g., 4.5)
     */
    getContrastRatio(rgb1: number[], rgb2: number[]): number;
    
    /**
     * Check if contrast passes WCAG AA
     * @param rgb1 - First color as [r, g, b] array
     * @param rgb2 - Second color as [r, g, b] array
     * @param fontSize - Font size in pt
     * @returns true if passes WCAG AA
     */
    isLevelAA(rgb1: number[], rgb2: number[], fontSize: number): boolean;
    
    /**
     * Check if contrast passes WCAG AAA
     * @param rgb1 - First color as [r, g, b] array
     * @param rgb2 - Second color as [r, g, b] array
     * @param fontSize - Font size in pt
     * @returns true if passes WCAG AAA
     */
    isLevelAAA(rgb1: number[], rgb2: number[], fontSize: number): boolean;
  }
}
