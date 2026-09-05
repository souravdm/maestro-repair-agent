// AI Chatbot for Maestro Recorder
// Provides context-aware assistance for recorder features and test creation

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

// Knowledge base for recorder features
const RECORDER_KNOWLEDGE = {
  features: {
    recording: `
**Recording Features:**
- Start/Stop/Pause recording with buttons
- Auto-detect element selectors (text, ID, bounds)
- Real-time step preview as you interact
- Manual step editing and reordering
- Supports: tapOn, inputText, swipe, scroll, assertVisible
    `,
    accessibility: `
**Accessibility Validation:**
- 35+ WCAG 2.1 checks (all 4 categories)
- VoiceOver/TalkBack property validation
- Touch target size (44×44pt minimum)
- Dynamic text scaling detection
- Color contrast validation (4.5:1 ratio)
- Downloadable HTML reports
- Click ♿ button in Element Hierarchy to run
    `,
    export: `
**Export Options:**
- Export to flows (.maestro/flows/)
- Export to subflows (.maestro/subflows/)
- Generate screen objects (.maestro/screens/)
- Preview YAML before saving
- Auto-classification of flow vs subflow
    `,
    hierarchy: `
**Element Hierarchy:**
- Tree view of all UI elements
- Filter by text, ID, or type
- Click elements to inspect properties
- Refresh button to update
- Shows: type, text, bounds, clickable state
    `,
    devices: `
**Device Support:**
- iOS Simulator (via xcrun simctl)
- Android Emulator (via adb)
- Real devices (with setup)
- Switch devices with dropdown
- Auto-refresh on device change
    `
  },
  
  common_questions: {
    'how to record': 'Click the red Record button, interact with your device, and steps will be captured automatically. Each tap, swipe, or text input creates a new step.',
    'how to export': 'Click the Export button after recording. Choose between Flow (end-to-end test) or Subflow (reusable component). Preview the YAML and confirm to save.',
    'what is subflow': 'Subflows are reusable test components like login, navigation, or search. They are called by flows using runFlow command. Use for common actions under 15 steps.',
    'what is flow': 'Flows are end-to-end test scenarios that test complete user journeys. They can call subflows and typically have 15+ steps. Saved in .maestro/flows/.',
    'how to validate accessibility': 'Click the ♿ (accessibility) button in the Element Hierarchy panel. Wait for validation to complete, then review the report. Click Download Report to save as HTML.',
    'touch target too small': 'Touch targets must be at least 44×44pt (iOS) or 48dp (Android). Increase the size of buttons and interactive elements. Recommended: 48×48pt for optimal accessibility.',
    'missing accessibility label': 'Set accessibilityLabel (iOS) or contentDescription (Android) for all interactive elements. Buttons, images, and controls need labels for screen readers.',
    'how to switch devices': 'Use the device dropdown at the top. Select iOS Simulator or Android Emulator. The screen and hierarchy will update automatically.',
    'element not found': 'Refresh the Element Hierarchy using the refresh button. Ensure the app screen is loaded and in foreground. Try filtering by text or ID.',
    'how to edit steps': 'Click on a step to edit it. You can change the target, value, or delete it. Drag steps to reorder them.',
    'how to generate screens': 'Click the Screen button after recording steps. The AI will extract elements and generate a screen object file with proper naming conventions.'
  },
  
  step_suggestions: {
    login: [
      '- tapOn: "Sign in"',
      '- inputText: "${USER_EMAIL}"',
      '- tapOn: "Continue"',
      '- inputText: "${USER_PASSWORD}"',
      '- tapOn: "Sign in"',
      '- assertVisible: "Home|Account"'
    ],
    search: [
      '- tapOn: "Search"',
      '- inputText: "product name"',
      '- tapOn: "Search button"',
      '- assertVisible: "Results"'
    ],
    navigation: [
      '- tapOn: "Account"',
      '- waitForAnimationToEnd',
      '- assertVisible: "Profile|Settings"'
    ],
    cart: [
      '- tapOn: "Add to cart"',
      '- waitForAnimationToEnd',
      '- tapOn: "Cart"',
      '- assertVisible: "Checkout"'
    ]
  }
};

export function generateChatResponse(
  userMessage: string,
  context: ChatContext
): string {
  const messageLower = userMessage.toLowerCase();
  
  // Check for exact question matches
  for (const [question, answer] of Object.entries(RECORDER_KNOWLEDGE.common_questions)) {
    if (messageLower.includes(question)) {
      return answer;
    }
  }
  
  // Feature-specific responses
  if (messageLower.includes('record') || messageLower.includes('recording')) {
    return RECORDER_KNOWLEDGE.features.recording;
  }
  
  if (messageLower.includes('accessibility') || messageLower.includes('a11y') || messageLower.includes('wcag')) {
    return RECORDER_KNOWLEDGE.features.accessibility;
  }
  
  if (messageLower.includes('export') || messageLower.includes('save')) {
    return RECORDER_KNOWLEDGE.features.export;
  }
  
  if (messageLower.includes('hierarchy') || messageLower.includes('element')) {
    return RECORDER_KNOWLEDGE.features.hierarchy;
  }
  
  if (messageLower.includes('device') || messageLower.includes('simulator') || messageLower.includes('emulator')) {
    return RECORDER_KNOWLEDGE.features.devices;
  }
  
  // Context-aware suggestions
  if (messageLower.includes('suggest') || messageLower.includes('help me') || messageLower.includes('how do i')) {
    return generateContextualSuggestion(messageLower, context);
  }
  
  // Step suggestions
  if (messageLower.includes('login') || messageLower.includes('sign in')) {
    return `**Login Flow Steps:**\n${RECORDER_KNOWLEDGE.step_suggestions.login.join('\n')}`;
  }
  
  if (messageLower.includes('search')) {
    return `**Search Flow Steps:**\n${RECORDER_KNOWLEDGE.step_suggestions.search.join('\n')}`;
  }
  
  if (messageLower.includes('navigate') || messageLower.includes('navigation')) {
    return `**Navigation Steps:**\n${RECORDER_KNOWLEDGE.step_suggestions.navigation.join('\n')}`;
  }
  
  if (messageLower.includes('cart') || messageLower.includes('checkout')) {
    return `**Cart Flow Steps:**\n${RECORDER_KNOWLEDGE.step_suggestions.cart.join('\n')}`;
  }
  
  // Default helpful response
  return `I can help you with:
- **Recording**: How to record and edit test steps
- **Accessibility**: Running WCAG validation and fixing issues
- **Export**: Saving flows, subflows, and screen objects
- **Elements**: Inspecting and filtering UI hierarchy
- **Devices**: Switching between iOS and Android
- **Steps**: Suggesting test steps for common scenarios

What would you like to know more about?`;
}

function generateContextualSuggestion(message: string, context: ChatContext): string {
  const suggestions: string[] = [];
  
  if (context.currentScreen) {
    suggestions.push(`**Current Screen:** ${context.currentScreen}`);
  }
  
  if (context.recordedSteps && context.recordedSteps > 0) {
    suggestions.push(`**Recorded Steps:** ${context.recordedSteps}`);
    
    if (context.recordedSteps < 5) {
      suggestions.push('💡 **Tip:** Short sequences (< 5 steps) are good candidates for subflows.');
    } else if (context.recordedSteps > 15) {
      suggestions.push('💡 **Tip:** Long sequences (> 15 steps) should be exported as flows.');
    }
  }
  
  if (context.devicePlatform) {
    suggestions.push(`**Platform:** ${context.devicePlatform}`);
  }
  
  if (context.recentActions && context.recentActions.length > 0) {
    const lastAction = context.recentActions[context.recentActions.length - 1];
    suggestions.push(`**Last Action:** ${lastAction}`);
    
    // Suggest next steps based on last action
    if (lastAction.includes('login') || lastAction.includes('sign in')) {
      suggestions.push('\n**Next Steps:**\n- Verify login success with assertVisible\n- Navigate to main feature\n- Test core functionality');
    }
  }
  
  if (suggestions.length === 0) {
    return 'Start recording to get contextual suggestions based on your current screen and actions!';
  }
  
  return suggestions.join('\n');
}

// Get quick help topics
export function getQuickHelpTopics(): string[] {
  return [
    'How to record a test',
    'How to validate accessibility',
    'How to export flows',
    'What is a subflow?',
    'How to switch devices',
    'How to fix touch target size',
    'How to add accessibility labels',
    'Suggest login steps',
    'Suggest search steps'
  ];
}

// Get feature documentation
export function getFeatureDocumentation(feature: string): string {
  const featureLower = feature.toLowerCase();
  
  for (const [key, value] of Object.entries(RECORDER_KNOWLEDGE.features)) {
    if (featureLower.includes(key)) {
      return value;
    }
  }
  
  return 'Feature documentation not found. Try: recording, accessibility, export, hierarchy, or devices.';
}
