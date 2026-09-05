async function buildMaestroTestGenerationPrompt(graph) {
  const flowExamples = await getComprehensiveFlowExamples();
  
  return `Follow this exact pattern:

appId: \${APP_ID}
tags:
    - feature
---
- runFlow: ../../subflows/common/launchApp.yaml
- tapOn: \${output.elementName}

${flowExamples}

Replace with your test case. OUTPUT ONLY YAML.`;
