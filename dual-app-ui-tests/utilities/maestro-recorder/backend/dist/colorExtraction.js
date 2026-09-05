"use strict";
/**
 * Color Extraction and Validation Utility
 *
 * Extracts colors from screenshots and validates them against CVS Pulse design tokens.
 * Uses screenshot analysis to get actual rendered colors from the app.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractColorFromRegion = extractColorFromRegion;
exports.extractColorPalette = extractColorPalette;
exports.findClosestColorToken = findClosestColorToken;
exports.validateColor = validateColor;
exports.validateTextContrast = validateTextContrast;
const sharp_1 = __importDefault(require("sharp"));
const color_diff_1 = require("color-diff");
const color_contrast_checker_1 = __importDefault(require("color-contrast-checker"));
const cvsColorTokens_1 = require("./cvsColorTokens");
/**
 * Extract dominant color from a specific region of a screenshot
 */
async function extractColorFromRegion(screenshotPath, bounds) {
    try {
        // Validate bounds
        if (bounds.width <= 0 || bounds.height <= 0) {
            console.warn('Invalid bounds for color extraction:', bounds);
            return null;
        }
        // Extract the region from the screenshot and get stats
        const stats = await (0, sharp_1.default)(screenshotPath)
            .extract({
            left: Math.max(0, Math.floor(bounds.x)),
            top: Math.max(0, Math.floor(bounds.y)),
            width: Math.max(1, Math.floor(bounds.width)),
            height: Math.max(1, Math.floor(bounds.height))
        })
            .stats();
        // Get dominant color from stats (use mean of each channel)
        const r = Math.round(stats.channels[0].mean);
        const g = Math.round(stats.channels[1].mean);
        const b = Math.round(stats.channels[2].mean);
        const hex = rgbToHex(r, g, b);
        return {
            rgb: { r, g, b },
            hex,
            dominance: 100 // ColorThief returns most dominant by default
        };
    }
    catch (error) {
        console.error('Color extraction failed:', error);
        return null;
    }
}
/**
 * Extract color palette from entire screenshot
 * Note: This is a simplified version using sharp's stats
 * For more advanced palette extraction, consider using a dedicated library
 */
async function extractColorPalette(screenshotPath, paletteSize = 5) {
    try {
        // Get overall image stats
        const stats = await (0, sharp_1.default)(screenshotPath).stats();
        // Return the dominant color (mean of all channels)
        const r = Math.round(stats.channels[0].mean);
        const g = Math.round(stats.channels[1].mean);
        const b = Math.round(stats.channels[2].mean);
        return [{
                rgb: { r, g, b },
                hex: rgbToHex(r, g, b),
                dominance: 100
            }];
    }
    catch (error) {
        console.error('Palette extraction failed:', error);
        return [];
    }
}
/**
 * Find the closest CVS color token match
 */
function findClosestColorToken(extractedColor) {
    let closestMatch = {
        token: cvsColorTokens_1.CVS_COLOR_TOKENS[0],
        deltaE: Infinity,
        confidence: 'different'
    };
    for (const token of cvsColorTokens_1.CVS_COLOR_TOKENS) {
        const deltaE = (0, color_diff_1.diff)({ R: extractedColor.rgb.r, G: extractedColor.rgb.g, B: extractedColor.rgb.b }, { R: token.rgb.r, G: token.rgb.g, B: token.rgb.b });
        if (deltaE < closestMatch.deltaE) {
            closestMatch = {
                token,
                deltaE,
                confidence: getConfidenceLevel(deltaE)
            };
        }
    }
    return closestMatch;
}
/**
 * Validate color against CVS design tokens
 */
function validateColor(extractedColor, elementType, elementText, elementId = '') {
    const violations = [];
    const match = findClosestColorToken(extractedColor);
    // Check 1: Deprecated color family
    if (cvsColorTokens_1.DEPRECATED_COLOR_FAMILIES.includes(match.token.family)) {
        violations.push({
            severity: 'error',
            message: `Deprecated color detected: ${match.token.name} (${match.token.hex})`,
            extractedColor,
            expectedToken: match.token,
            suggestion: `${match.token.family} is deprecated. ${match.token.usage}`,
            deltaE: match.deltaE
        });
    }
    // Check 2: Close but not exact match (common mistake - wrong shade)
    if (match.deltaE > 5 && match.deltaE < 15 && !match.token.deprecated) {
        violations.push({
            severity: 'warning',
            message: `Color is similar to ${match.token.name} but doesn't match exactly (ΔE: ${match.deltaE.toFixed(1)})`,
            extractedColor,
            expectedToken: match.token,
            suggestion: `Use exact Pulse design token: ${match.token.name} (${match.token.hex}). Extracted: ${extractedColor.hex}`,
            deltaE: match.deltaE
        });
    }
    // Check 3: Very different from any token (custom color)
    if (match.deltaE > 15) {
        violations.push({
            severity: 'warning',
            message: `Color does not match any CVS Pulse design token (closest: ${match.token.name}, ΔE: ${match.deltaE.toFixed(1)})`,
            extractedColor,
            expectedToken: match.token,
            suggestion: `Use CVS Pulse design tokens for brand consistency. Closest match: ${match.token.name} (${match.token.hex})`,
            deltaE: match.deltaE
        });
    }
    // Check 4: Semantic color usage (e.g., red for non-error elements)
    if (match.deltaE < 10 && !match.token.deprecated) {
        const semanticViolation = validateSemanticColorUsage(match.token, elementType, elementText, elementId);
        if (semanticViolation) {
            violations.push({
                ...semanticViolation,
                extractedColor,
                expectedToken: match.token,
                deltaE: match.deltaE
            });
        }
    }
    return violations;
}
/**
 * Validate semantic color usage (right color for right purpose)
 */
function validateSemanticColorUsage(token, elementType, elementText, elementId) {
    const family = token.family;
    const text = elementText.toLowerCase();
    const id = elementId.toLowerCase();
    const type = elementType.toLowerCase();
    // Red should only be used for errors
    if (family === 'red' && !isErrorElement(text, id, type)) {
        return {
            severity: 'warning',
            message: `Red color family (${token.name}) used on non-error element`,
            suggestion: `Red is reserved for error states. Use Rose for brand color or another appropriate family. See: ${cvsColorTokens_1.COLOR_USAGE_GUIDELINES.red}`
        };
    }
    // Teal should be used for success
    if (family === 'teal' && !isSuccessElement(text, id, type)) {
        return {
            severity: 'info',
            message: `Teal color family (${token.name}) used on non-success element`,
            suggestion: `Teal is typically used for success states. Verify this is intentional. See: ${cvsColorTokens_1.COLOR_USAGE_GUIDELINES.teal}`
        };
    }
    // Tangerine should be used for warnings
    if (family === 'tangerine' && !isWarningElement(text, id, type)) {
        return {
            severity: 'info',
            message: `Tangerine color family (${token.name}) used on non-warning element`,
            suggestion: `Tangerine is typically used for warning states. Verify this is intentional. See: ${cvsColorTokens_1.COLOR_USAGE_GUIDELINES.tangerine}`
        };
    }
    return null;
}
/**
 * Validate color contrast for text elements
 */
async function validateTextContrast(screenshotPath, textBounds, fontSize = 14) {
    const violations = [];
    try {
        // Extract text color (center of text bounds)
        const textColor = await extractColorFromRegion(screenshotPath, {
            x: textBounds.x + textBounds.width / 4,
            y: textBounds.y + textBounds.height / 4,
            width: textBounds.width / 2,
            height: textBounds.height / 2
        });
        if (!textColor)
            return violations;
        // Extract background color (area around text)
        const bgBounds = {
            x: Math.max(0, textBounds.x - 10),
            y: Math.max(0, textBounds.y - 10),
            width: textBounds.width + 20,
            height: textBounds.height + 20
        };
        const bgColor = await extractColorFromRegion(screenshotPath, bgBounds);
        if (!bgColor)
            return violations;
        // Calculate contrast ratio
        const ccc = new color_contrast_checker_1.default();
        const contrastRatio = ccc.getContrastRatio([textColor.rgb.r, textColor.rgb.g, textColor.rgb.b], [bgColor.rgb.r, bgColor.rgb.g, bgColor.rgb.b]);
        // WCAG requirements
        const isLargeText = fontSize >= 18; // 18pt or larger
        const requiredRatio = isLargeText ? 3.0 : 4.5;
        const passesAA = contrastRatio >= requiredRatio;
        const passesAAA = contrastRatio >= (isLargeText ? 4.5 : 7.0);
        if (!passesAA) {
            const textMatch = findClosestColorToken(textColor);
            const bgMatch = findClosestColorToken(bgColor);
            violations.push({
                severity: 'error',
                message: `Insufficient color contrast: ${contrastRatio.toFixed(2)}:1 (required: ${requiredRatio}:1 for ${isLargeText ? 'large' : 'normal'} text)`,
                extractedColor: textColor,
                suggestion: `Increase contrast between text (${textColor.hex}, closest: ${textMatch.token.name}) and background (${bgColor.hex}, closest: ${bgMatch.token.name}). Use CVS neutral tokens: neutral-700+ on light backgrounds, neutral-50 on dark backgrounds.`
            });
        }
        else if (!passesAAA) {
            violations.push({
                severity: 'info',
                message: `Color contrast passes WCAG AA (${contrastRatio.toFixed(2)}:1) but not AAA (${isLargeText ? '4.5' : '7.0'}:1)`,
                extractedColor: textColor,
                suggestion: `Consider increasing contrast for better accessibility. Current: ${contrastRatio.toFixed(2)}:1`
            });
        }
    }
    catch (error) {
        console.error('Contrast validation failed:', error);
    }
    return violations;
}
// Helper functions
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
}
function getConfidenceLevel(deltaE) {
    if (deltaE < 2)
        return 'exact';
    if (deltaE < 5)
        return 'close';
    if (deltaE < 10)
        return 'similar';
    return 'different';
}
function isErrorElement(text, id, type) {
    const errorKeywords = ['error', 'invalid', 'failed', 'wrong', 'incorrect', 'danger', 'alert', 'critical'];
    return errorKeywords.some(keyword => text.includes(keyword) || id.includes(keyword) || type.includes(keyword));
}
function isSuccessElement(text, id, type) {
    const successKeywords = ['success', 'complete', 'done', 'confirmed', 'verified', 'approved', 'passed'];
    return successKeywords.some(keyword => text.includes(keyword) || id.includes(keyword) || type.includes(keyword));
}
function isWarningElement(text, id, type) {
    const warningKeywords = ['warning', 'caution', 'attention', 'notice', 'alert'];
    return warningKeywords.some(keyword => text.includes(keyword) || id.includes(keyword) || type.includes(keyword));
}
//# sourceMappingURL=colorExtraction.js.map