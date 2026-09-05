export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
}
export interface ChatContext {
    currentScreen?: string;
    devicePlatform?: string;
    recordedSteps?: number;
    hierarchy?: any[];
    recentActions?: string[];
}
export declare function generateChatResponse(userMessage: string, context: ChatContext): string;
export declare function getQuickHelpTopics(): string[];
export declare function getFeatureDocumentation(feature: string): string;
//# sourceMappingURL=chatbot.d.ts.map