declare module 'color-diff' {
  export interface Color {
    R: number;
    G: number;
    B: number;
  }

  export function diff(color1: Color, color2: Color): number;
  export function closest(color: Color, palette: Color[]): Color;
  export function furthest(color: Color, palette: Color[]): Color;
  export function map_palette(colors: Color[]): (color: Color) => Color;
}
