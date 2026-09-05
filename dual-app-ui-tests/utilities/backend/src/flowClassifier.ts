// Flow vs Subflow Auto-Classification Logic
// Based on CVS Maestro Framework Design Patterns

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

// Framework patterns based on existing structure
const SUBFLOW_PATTERNS = {
  authentication: {
    keywords: ['login', 'sign in', 'password', 'email'],
    path: 'Account/authentication',
    maxSteps: 15
  },
  registration: {
    keywords: ['register', 'sign up', 'create account'],
    path: 'Account/registration',
    maxSteps: 20
  },
  navigation: {
    keywords: ['navigate', 'tab', 'menu', 'home'],
    path: 'Common',
    maxSteps: 8
  },
  search: {
    keywords: ['search', 'find', 'filter'],
    path: 'Common',
    maxSteps: 10
  },
  cart: {
    keywords: ['add to cart', 'cart', 'checkout'],
    path: 'Shop',
    maxSteps: 12
  }
};

export function classifyRecordedSteps(steps: TestStep[]): ClassificationResult {
  const reasoning: string[] = [];
  let confidence = 0;
  let type: 'flow' | 'subflow' = 'subflow';
  let category = 'Common';
  
  const stepCount = steps.length;
  const targets = steps.map(s => s.target || '').join(' ').toLowerCase();

  reasoning.push(`Analyzing ${stepCount} recorded steps`);

  // Short sequences are subflows
  if (stepCount < 5) {
    reasoning.push('Short sequence → subflow');
    confidence += 30;
    type = 'subflow';
  }

  // Long sequences are flows
  if (stepCount > 20) {
    reasoning.push('Long sequence → flow');
    confidence += 30;
    type = 'flow';
  }

  // Check patterns
  for (const [name, pattern] of Object.entries(SUBFLOW_PATTERNS)) {
    const matches = pattern.keywords.filter(kw => targets.includes(kw));
    if (matches.length > 0) {
      category = pattern.path;
      confidence += matches.length * 15;
      reasoning.push(`Matched ${name}: ${matches.join(', ')}`);
    }
  }

  const suggestedName = type === 'flow' ? `${category.toLowerCase()}Test` : `${category.toLowerCase()}Flow`;
  const suggestedPath = `.maestro/${type}s/${category}/${suggestedName}.yaml`;

  return { type, category, suggestedName, confidence: Math.min(100, confidence), reasoning, suggestedPath };
}
