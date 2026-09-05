# Flow Classification & AI Chatbot Features

**Last Updated:** April 2, 2026  
**Version:** 1.0.0

---

## Overview

The Maestro Recorder now includes two powerful AI-driven features:

1. **Auto-Classification**: Automatically identifies whether recorded steps should be a Flow or Subflow
2. **AI Chatbot**: Context-aware assistant for recorder features and test creation

---

## 1. Flow vs Subflow Auto-Classification

### What It Does

Automatically analyzes your recorded test steps and recommends whether they should be saved as:
- **Flow**: End-to-end test scenarios (saved in `.maestro/flows/`)
- **Subflow**: Reusable test components (saved in `.maestro/subflows/`)

### How It Works

**Classification Logic:**
- **Short sequences (< 5 steps)**: Likely subflows
- **Long sequences (> 20 steps)**: Likely flows
- **Pattern matching**: Detects common patterns (login, search, navigation, cart operations)
- **Keyword analysis**: Analyzes step targets for feature-specific keywords
- **Confidence scoring**: Provides 0-100% confidence level

**Framework Patterns Detected:**
- **Authentication** (Account/authentication/): login, sign in, password entry
- **Registration** (Account/registration/): sign up, create account
- **Navigation** (Common/): tab switching, menu navigation
- **Search** (Common/): search, filter, lookup
- **Cart Operations** (Shop/): add to cart, checkout
- **Form Filling** (Common/): multi-field input forms
- **Chatbot** (Chatbot/): chat interactions

### Usage

1. **Record your test steps** as normal
2. **Click Export button** to view YAML preview
3. **Auto-classification runs automatically** and displays:
   - Type: FLOW or SUBFLOW
   - Confidence: 0-100%
   - Category: Feature category (Account, Shop, Pharmacy, etc.)
   - Suggested name: Auto-generated name
   - Suggested path: Full file path
   - Reasoning: Explanation of classification

### Example Output

```
🔍 Auto-Classification: SUBFLOW (85% confidence)
📁 Category: Account/authentication
📝 Suggested name: loginFlow
💾 Suggested path: .maestro/subflows/Account/authentication/loginFlow.yaml
Reasoning: Short sequence → subflow • Matched authentication: login, sign in, password
```

### Classification Rules

**Subflow Indicators:**
- ✅ 5-15 steps
- ✅ Single focused action (login, search, navigate)
- ✅ Reusable component
- ✅ Matches known patterns

**Flow Indicators:**
- ✅ 15+ steps
- ✅ Multiple distinct actions
- ✅ End-to-end user journey
- ✅ Tests complete scenario

---

## 2. AI Chatbot Assistant

### What It Does

Provides context-aware assistance for:
- Recording and editing tests
- Accessibility validation
- Exporting flows and subflows
- Device-specific steps
- Framework best practices
- Step suggestions for common scenarios

### Features

**Knowledge Base:**
- Recording features and controls
- Accessibility validation (35+ WCAG checks)
- Export options (flows, subflows, screens)
- Element hierarchy inspection
- Device support (iOS/Android)

**Context-Aware:**
- Current screen name
- Device platform (iOS/Android)
- Number of recorded steps
- Recent actions
- UI hierarchy

**Quick Help Topics:**
- How to record a test
- How to validate accessibility
- How to export flows
- What is a subflow?
- How to switch devices
- How to fix touch target size
- How to add accessibility labels
- Suggest login steps
- Suggest search steps

### Usage

1. **Click the chatbot FAB** (floating action button) in bottom-right corner
2. **Ask questions** or **click quick help topics**
3. **Get instant answers** with context from your current recording session

### Example Conversations

**Q:** "How to validate accessibility?"
**A:** Click the ♿ (accessibility) button in the Element Hierarchy panel. Wait for validation to complete, then review the report. Click Download Report to save as HTML.

**Q:** "Suggest login steps"
**A:** 
```yaml
- tapOn: "Sign in"
- inputText: "${USER_EMAIL}"
- tapOn: "Continue"
- inputText: "${USER_PASSWORD}"
- tapOn: "Sign in"
- assertVisible: "Home|Account"
```

**Q:** "What is a subflow?"
**A:** Subflows are reusable test components like login, navigation, or search. They are called by flows using runFlow command. Use for common actions under 15 steps.

### Chatbot UI

**Components:**
- **FAB Button**: Bottom-right corner (robot icon)
- **Chat Window**: 400x600px dialog
- **Quick Topics**: Chip buttons for common questions
- **Message History**: User and assistant messages
- **Input Field**: Multi-line text input with send button

**Keyboard Shortcuts:**
- `Enter`: Send message
- `Shift + Enter`: New line

---

## Technical Implementation

### Backend

**Files:**
- `backend/src/flowClassifier.ts`: Classification logic
- `backend/src/chatbot.ts`: Chatbot knowledge base and response generation
- `backend/src/server.ts`: WebSocket handlers

**WebSocket Messages:**
- `classify-steps`: Trigger classification
- `classification-result`: Classification response
- `chat-message`: Send chat message
- `chat-response`: Chatbot response
- `get-help-topics`: Request quick help topics

### Frontend

**Files:**
- `frontend/src/components/Chatbot.tsx`: Chatbot UI component
- `frontend/src/App.tsx`: Integration and state management

**State:**
- `classification`: Current classification result
- `messages`: Chat message history
- `helpTopics`: Quick help topic list

---

## Best Practices

### Using Auto-Classification

1. **Review the confidence score**: 70%+ is high confidence
2. **Check the reasoning**: Understand why it classified as flow/subflow
3. **Override if needed**: You can still save to any location
4. **Use suggested paths**: Follow framework structure for consistency

### Using the Chatbot

1. **Ask specific questions**: "How to fix touch target size" vs "help"
2. **Use quick topics**: Faster than typing common questions
3. **Provide context**: Chatbot knows your current recording state
4. **Try step suggestions**: Get YAML snippets for common scenarios

### Framework Integration

**Subflow Patterns:**
- Keep under 15 steps
- Single focused action
- Reusable across flows
- Save to appropriate category folder

**Flow Patterns:**
- 15+ steps for complete scenarios
- Can call multiple subflows
- Test end-to-end user journeys
- Organize by feature area

---

## Troubleshooting

### Classification Issues

**Problem:** Classification confidence is low (< 50%)
**Solution:** 
- Add more steps to provide better context
- Use descriptive element targets
- Follow framework naming conventions

**Problem:** Wrong category detected
**Solution:**
- Manually select correct category when exporting
- Use feature-specific keywords in step targets
- Update flow name to match feature

### Chatbot Issues

**Problem:** Chatbot not responding
**Solution:**
- Check WebSocket connection status
- Refresh the page
- Restart backend server

**Problem:** Generic responses
**Solution:**
- Ask more specific questions
- Use quick help topics
- Provide context about what you're trying to do

---

## Future Enhancements

**Planned Features:**
- Machine learning-based classification
- Custom pattern definitions
- Integration with JIRA for requirements
- Figma design context in chatbot
- Voice input for chatbot
- Multi-language support

---

## API Reference

### Classification API

```typescript
interface ClassificationResult {
  type: 'flow' | 'subflow';
  category: string;
  suggestedName: string;
  confidence: number;
  reasoning: string[];
  suggestedPath: string;
}
```

### Chatbot API

```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatContext {
  currentScreen?: string;
  devicePlatform?: string;
  recordedSteps?: number;
  hierarchy?: any[];
  recentActions?: string[];
}
```

---

## Summary

The Flow Classification and AI Chatbot features enhance the Maestro Recorder with intelligent assistance for test creation. Auto-classification ensures proper organization of flows and subflows, while the chatbot provides instant help and suggestions based on your recording context.

**Key Benefits:**
- ✅ Automatic flow vs subflow identification
- ✅ Framework-compliant organization
- ✅ Context-aware assistance
- ✅ Step suggestions for common scenarios
- ✅ Instant answers to recorder questions
- ✅ Best practices guidance

**Getting Started:**
1. Record test steps as normal
2. Click Export to see auto-classification
3. Click chatbot FAB for instant help
4. Ask questions or use quick topics
5. Follow suggested paths for consistency
