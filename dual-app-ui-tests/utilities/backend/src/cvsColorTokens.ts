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
  rgb: { r: number; g: number; b: number };
  usage: string;
  deprecated?: boolean;
}

// CVS Core Color Tokens (extracted from Figma)
export const CVS_COLOR_TOKENS: ColorToken[] = [
  // ============================================
  // ROSE (Primary Brand Color)
  // ============================================
  { name: 'rose-50', family: 'rose', shade: '50', hex: '#fff1f2', rgb: { r: 255, g: 241, b: 242 }, usage: 'Lightest rose background' },
  { name: 'rose-100', family: 'rose', shade: '100', hex: '#ffe4e6', rgb: { r: 255, g: 228, b: 230 }, usage: 'Light rose background' },
  { name: 'rose-200', family: 'rose', shade: '200', hex: '#fecdd3', rgb: { r: 254, g: 205, b: 211 }, usage: 'Rose tint' },
  { name: 'rose-300', family: 'rose', shade: '300', hex: '#fda4af', rgb: { r: 253, g: 164, b: 175 }, usage: 'Light rose accent' },
  { name: 'rose-400', family: 'rose', shade: '400', hex: '#fb7185', rgb: { r: 251, g: 113, b: 133 }, usage: 'Rose accent' },
  { name: 'rose-500', family: 'rose', shade: '500', hex: '#f43f5e', rgb: { r: 244, g: 63, b: 94 }, usage: 'Primary rose (CVS brand)' },
  { name: 'rose-600', family: 'rose', shade: '600', hex: '#e11d48', rgb: { r: 225, g: 29, b: 72 }, usage: 'Dark rose (primary buttons)' },
  { name: 'rose-700', family: 'rose', shade: '700', hex: '#be123c', rgb: { r: 190, g: 18, b: 60 }, usage: 'Darker rose' },
  { name: 'rose-800', family: 'rose', shade: '800', hex: '#9f1239', rgb: { r: 159, g: 18, b: 57 }, usage: 'Very dark rose' },
  { name: 'rose-900', family: 'rose', shade: '900', hex: '#881337', rgb: { r: 136, g: 19, b: 55 }, usage: 'Darkest rose' },
  
  // ============================================
  // RED (Error States)
  // ============================================
  { name: 'red-50', family: 'red', shade: '50', hex: '#fef2f2', rgb: { r: 254, g: 242, b: 242 }, usage: 'Lightest error background' },
  { name: 'red-100', family: 'red', shade: '100', hex: '#fee2e2', rgb: { r: 254, g: 226, b: 226 }, usage: 'Light error background' },
  { name: 'red-500', family: 'red', shade: '500', hex: '#ef4444', rgb: { r: 239, g: 68, b: 68 }, usage: 'Error state' },
  { name: 'red-600', family: 'red', shade: '600', hex: '#dc2626', rgb: { r: 220, g: 38, b: 38 }, usage: 'Error emphasis' },
  { name: 'red-700', family: 'red', shade: '700', hex: '#b91c1c', rgb: { r: 185, g: 28, b: 28 }, usage: 'Dark error' },
  { name: 'red-800', family: 'red', shade: '800', hex: '#991b1b', rgb: { r: 153, g: 27, b: 27 }, usage: 'Very dark error' },
  { name: 'red-900', family: 'red', shade: '900', hex: '#7f1d1d', rgb: { r: 127, g: 29, b: 29 }, usage: 'Darkest error' },
  
  // ============================================
  // TEAL (Success States)
  // ============================================
  { name: 'teal-50', family: 'teal', shade: '50', hex: '#f0fdfa', rgb: { r: 240, g: 253, b: 250 }, usage: 'Lightest success background' },
  { name: 'teal-100', family: 'teal', shade: '100', hex: '#ccfbf1', rgb: { r: 204, g: 251, b: 241 }, usage: 'Light success background' },
  { name: 'teal-500', family: 'teal', shade: '500', hex: '#14b8a6', rgb: { r: 20, g: 184, b: 166 }, usage: 'Success state' },
  { name: 'teal-600', family: 'teal', shade: '600', hex: '#0d9488', rgb: { r: 13, g: 148, b: 136 }, usage: 'Success emphasis' },
  { name: 'teal-700', family: 'teal', shade: '700', hex: '#0f766e', rgb: { r: 15, g: 118, b: 110 }, usage: 'Dark success' },
  
  // ============================================
  // TANGERINE (Warning States)
  // ============================================
  { name: 'tangerine-50', family: 'tangerine', shade: '50', hex: '#fff7ed', rgb: { r: 255, g: 247, b: 237 }, usage: 'Lightest warning background' },
  { name: 'tangerine-100', family: 'tangerine', shade: '100', hex: '#ffedd5', rgb: { r: 255, g: 237, b: 213 }, usage: 'Light warning background' },
  { name: 'tangerine-500', family: 'tangerine', shade: '500', hex: '#f97316', rgb: { r: 249, g: 115, b: 22 }, usage: 'Warning state' },
  { name: 'tangerine-600', family: 'tangerine', shade: '600', hex: '#ea580c', rgb: { r: 234, g: 88, b: 12 }, usage: 'Warning emphasis' },
  { name: 'tangerine-700', family: 'tangerine', shade: '700', hex: '#c2410c', rgb: { r: 194, g: 65, b: 12 }, usage: 'Dark warning' },
  
  // ============================================
  // SKY (Info/Interactive)
  // ============================================
  { name: 'sky-50', family: 'sky', shade: '50', hex: '#f0f9ff', rgb: { r: 240, g: 249, b: 255 }, usage: 'Lightest info background' },
  { name: 'sky-100', family: 'sky', shade: '100', hex: '#e0f2fe', rgb: { r: 224, g: 242, b: 254 }, usage: 'Light info background' },
  { name: 'sky-500', family: 'sky', shade: '500', hex: '#0ea5e9', rgb: { r: 14, g: 165, b: 233 }, usage: 'Info state' },
  { name: 'sky-600', family: 'sky', shade: '600', hex: '#0284c7', rgb: { r: 2, g: 132, b: 199 }, usage: 'Interactive elements' },
  { name: 'sky-700', family: 'sky', shade: '700', hex: '#0369a1', rgb: { r: 3, g: 105, b: 161 }, usage: 'Dark info' },
  
  // ============================================
  // VIOLET (Secondary Accent)
  // ============================================
  { name: 'violet-50', family: 'violet', shade: '50', hex: '#f5f3ff', rgb: { r: 245, g: 243, b: 255 }, usage: 'Lightest violet background' },
  { name: 'violet-100', family: 'violet', shade: '100', hex: '#ede9fe', rgb: { r: 237, g: 233, b: 254 }, usage: 'Light violet background' },
  { name: 'violet-500', family: 'violet', shade: '500', hex: '#8b5cf6', rgb: { r: 139, g: 92, b: 246 }, usage: 'Violet accent' },
  { name: 'violet-600', family: 'violet', shade: '600', hex: '#7c3aed', rgb: { r: 124, g: 58, b: 237 }, usage: 'Violet emphasis' },
  
  // ============================================
  // INDIGO (Deep Accent)
  // ============================================
  { name: 'indigo-50', family: 'indigo', shade: '50', hex: '#eef2ff', rgb: { r: 238, g: 242, b: 255 }, usage: 'Lightest indigo background' },
  { name: 'indigo-100', family: 'indigo', shade: '100', hex: '#e0e7ff', rgb: { r: 224, g: 231, b: 255 }, usage: 'Light indigo background' },
  { name: 'indigo-500', family: 'indigo', shade: '500', hex: '#6366f1', rgb: { r: 99, g: 102, b: 241 }, usage: 'Indigo accent' },
  { name: 'indigo-600', family: 'indigo', shade: '600', hex: '#4f46e5', rgb: { r: 79, g: 70, b: 229 }, usage: 'Indigo emphasis' },
  
  // ============================================
  // DUNE (Neutral Backgrounds)
  // ============================================
  { name: 'dune-50', family: 'dune', shade: '50', hex: '#fafaf9', rgb: { r: 250, g: 250, b: 249 }, usage: 'Lightest dune background' },
  { name: 'dune-100', family: 'dune', shade: '100', hex: '#f5f5f4', rgb: { r: 245, g: 245, b: 244 }, usage: 'Light dune background' },
  { name: 'dune-200', family: 'dune', shade: '200', hex: '#e7e5e4', rgb: { r: 231, g: 229, b: 228 }, usage: 'Dune background' },
  { name: 'dune-300', family: 'dune', shade: '300', hex: '#d6d3d1', rgb: { r: 214, g: 211, b: 209 }, usage: 'Dune border' },
  
  // ============================================
  // NEUTRALS (Text, Borders, Backgrounds)
  // ============================================
  { name: 'neutral-50', family: 'neutral', shade: '50', hex: '#fafafa', rgb: { r: 250, g: 250, b: 250 }, usage: 'Lightest background / white text on dark' },
  { name: 'neutral-100', family: 'neutral', shade: '100', hex: '#f5f5f5', rgb: { r: 245, g: 245, b: 245 }, usage: 'Light background' },
  { name: 'neutral-200', family: 'neutral', shade: '200', hex: '#e5e5e5', rgb: { r: 229, g: 229, b: 229 }, usage: 'Border light' },
  { name: 'neutral-300', family: 'neutral', shade: '300', hex: '#d4d4d4', rgb: { r: 212, g: 212, b: 212 }, usage: 'Border' },
  { name: 'neutral-400', family: 'neutral', shade: '400', hex: '#a3a3a3', rgb: { r: 163, g: 163, b: 163 }, usage: 'Disabled text' },
  { name: 'neutral-500', family: 'neutral', shade: '500', hex: '#737373', rgb: { r: 115, g: 115, b: 115 }, usage: 'Secondary text' },
  { name: 'neutral-600', family: 'neutral', shade: '600', hex: '#525252', rgb: { r: 82, g: 82, b: 82 }, usage: 'Body text' },
  { name: 'neutral-700', family: 'neutral', shade: '700', hex: '#404040', rgb: { r: 64, g: 64, b: 64 }, usage: 'Heading text' },
  { name: 'neutral-800', family: 'neutral', shade: '800', hex: '#262626', rgb: { r: 38, g: 38, b: 38 }, usage: 'Dark text' },
  { name: 'neutral-900', family: 'neutral', shade: '900', hex: '#171717', rgb: { r: 23, g: 23, b: 23 }, usage: 'Darkest text / black' },
  
  // ============================================
  // DEPRECATED COLORS (Flag as errors)
  // ============================================
  { name: 'cobalt-500', family: 'cobalt', shade: '500', hex: '#3b82f6', rgb: { r: 59, g: 130, b: 246 }, usage: 'DEPRECATED - Use Sky or Indigo instead', deprecated: true },
  { name: 'cobalt-600', family: 'cobalt', shade: '600', hex: '#2563eb', rgb: { r: 37, g: 99, b: 235 }, usage: 'DEPRECATED - Use Sky or Indigo instead', deprecated: true },
];

// Deprecated color families
export const DEPRECATED_COLOR_FAMILIES = ['cobalt'];

// Color family usage guidelines
export const COLOR_USAGE_GUIDELINES: Record<string, string> = {
  rose: 'Primary brand color - use for primary actions, branding, and key interactive elements',
  red: 'Error states only - destructive actions, validation errors, critical alerts',
  teal: 'Success states - confirmations, completed actions, positive feedback',
  tangerine: 'Warning states - alerts, cautionary messages, attention-needed items',
  sky: 'Info states and interactive elements - links, info messages, secondary actions',
  violet: 'Secondary accent - highlights, badges, special features',
  indigo: 'Deep accent - premium features, special content, tertiary actions',
  dune: 'Neutral backgrounds - cards, containers, surfaces',
  neutral: 'Text and borders - all text hierarchy, dividers, borders, disabled states',
  cobalt: 'DEPRECATED - Do not use. Migrate to Sky (info/interactive) or Indigo (deep accent)'
};

// Semantic color mapping (what color families should be used for what purpose)
export const SEMANTIC_COLOR_MAPPING: Record<string, string[]> = {
  error: ['red'],
  success: ['teal'],
  warning: ['tangerine'],
  info: ['sky'],
  primary: ['rose'],
  secondary: ['violet', 'indigo'],
  neutral: ['neutral', 'dune']
};
