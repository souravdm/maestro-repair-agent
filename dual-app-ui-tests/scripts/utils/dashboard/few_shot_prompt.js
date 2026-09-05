async function buildMaestroTestGenerationPrompt(graph) {
  const maestroContext = {
    flows: graph.flows.length,
    subflows: graph.subflows.length,
    screens: graph.screenObjects.length,
    features: ['Account', 'Home', 'Pharmacy', 'Benefits', 'Shop', 'Health', 'MCCore', 'NGS', 'Chatbot', 'VM', 'General']
  };
  
  // Get comprehensive context from all sources
  console.log('🔍 Building comprehensive context for test generation...');
  const flowExamples = await getComprehensiveFlowExamples();
  
  console.log('📊 Context summary:');
  console.log(`  - Flow examples: ${flowExamples.length} characters`);
  
  return `You are a Maestro YAML generator. Generate ONLY the YAML output, no explanations.

EXAMPLE 1 - Correct Output:
appId: \${APP_ID}
tags:
    - homescreen
    - smoke
onFlowStart:
  - runScript: ../../screens/Common/CommonScreen.js
  - runScript: ../../screens/Account/accountObjects.js
---
- runFlow: ../../subflows/common/launchApp.yaml
- tapOn: \${output.account_onboarding.letsGetStartedBtn}
- runFlow: ../../subflows/account/complete_signin_and_otp_dob.yaml

EXAMPLE 2 - Correct Output:
appId: \${APP_ID}
tags:
    - login
    - guest
---
- runFlow: ../../subflows/common/launchApp.yaml
- tapOn: \${output.account_onboarding.letsGetStartedBtn}
- tapOn: \${output.account_signIn.continueAsGuestBtn}
- assertVisible: \${output.homescreen.activityZoneTitle}

RULES:
- Use appId: \${APP_ID}
- Use \${output.screenName.elementName} for UI elements
- Use subflows for common actions
- Single --- after appId section
- NO comments, NO explanations, NO markdown

${flowExamples}

Generate the test case following the exact pattern above. OUTPUT ONLY YAML.`;
