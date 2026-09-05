async function buildMaestroTestGenerationPrompt(graph) {
  const maestroContext = {
    flows: graph.flows.length,
    subflows: graph.subflows.length,
    screens: graph.screenObjects.length,
    features: ['Account', 'Home', 'Pharmacy', 'Benefits', 'Shop', 'Health', 'MCCore', 'NGS', 'Chatbot', 'VM', 'General']
  };
  
  // Get comprehensive context from all sources
  console.log('🔍 Building comprehensive context for test generation...');
  const docsContext = await getDocsContext();
  const flowExamples = await getComprehensiveFlowExamples();
  const screenExamples = await getComprehensiveScreenExamples();
  const subflowExamples = await getSubflowExamples();
  const configExamples = await getConfigExamples();
  
  console.log('📊 Context summary:');
  console.log(`  - Docs context: ${docsContext.length} characters`);
  console.log(`  - Flow examples: ${flowExamples.length} characters`);
  console.log(`  - Screen examples: ${screenExamples.length} characters`);
  console.log(`  - Subflow examples: ${subflowExamples.length} characters`);
  console.log(`  - Config examples: ${configExamples.length} characters`);
  
  return `Generate Maestro YAML using this structure:

appId: \${APP_ID}
tags:
    - feature
onFlowStart:
  - runScript: ../../screens/Common/CommonScreen.js
  - runScript: ../../screens/Account/accountObjects.js
---
- runFlow: ../../subflows/common/launchApp.yaml
- tapOn: \${output.account_onboarding.letsGetStartedBtn}
- runFlow: ../../subflows/account/complete_signin_and_otp_dob.yaml

RULES:
- Use appId: \${APP_ID}
- Use \${output.screenName.elementName} for UI elements
- Use subflows: ../../subflows/common/launchApp.yaml
- Commands: tapOn, inputText, assertVisible, runFlow, runScript
- NO: elementSelector, elementText, swipeGesture, textValue, elementId
- Single --- after appId section

${flowExamples}

OUTPUT ONLY YAML. NO EXPLANATIONS.`;
}
