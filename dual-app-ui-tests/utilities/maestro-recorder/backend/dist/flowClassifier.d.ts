export interface TestStep {
    type: string;
    target?: string;
    value?: string;
    [key: string]: any;
}
export interface ClassificationResult {
    type: 'flow' | 'subflow';
    category: string;
    suggestedName: string;
    confidence: number;
    reasoning: string[];
    suggestedPath: string;
}
export declare function classifyRecordedSteps(steps: TestStep[]): ClassificationResult;
//# sourceMappingURL=flowClassifier.d.ts.map