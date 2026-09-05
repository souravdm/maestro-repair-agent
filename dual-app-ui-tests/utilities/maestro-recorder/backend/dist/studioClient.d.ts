export interface StudioHierarchyElement {
    id: string;
    type: string;
    text: string;
    bounds: string;
    clickable: boolean;
    focused: boolean;
}
export interface StudioSnapshot {
    hierarchy: StudioHierarchyElement[];
    screenshot: string | null;
    hash: string;
    source: 'studio';
}
export declare function hashHierarchy(elements: StudioHierarchyElement[]): string;
export declare function invalidateStudioAvailability(): void;
/**
 * Fetch hierarchy + screenshot from a running `maestro studio` instance.
 * Returns null when Studio is not reachable — the caller should fall back
 * to the CLI path.
 */
export declare function tryStudioSnapshot(): Promise<StudioSnapshot | null>;
export declare function studioEndpoint(): string;
//# sourceMappingURL=studioClient.d.ts.map