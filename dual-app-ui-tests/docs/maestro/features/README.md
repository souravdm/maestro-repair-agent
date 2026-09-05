# Feature Knowledge Base

This directory contains comprehensive feature documentation for AI models and test automation.

## Purpose

These knowledge base files provide:
- **Complete feature context** from JIRA epics and requirements
- **Business rules and logic** for test validation
- **User personas and journeys** for scenario creation
- **Technical architecture** for integration testing
- **Test coverage requirements** for comprehensive testing
- **Known limitations** to avoid false failures

## Available Features

### Benefits Feature
**File**: `BENEFITS_COMPLETE_KNOWLEDGE.md`

**Source**: JIRA TLOP Board (Open Platform Project)

**What's Inside:**
- Executive summary and business goals
- Feature evolution timeline (Phase 1-5)
- 11 core features and capabilities
- 25+ epics with acceptance criteria
- Technical architecture (APIs, feature flags, integrations)
- 6 user personas and their journeys
- Business rules and display logic
- Test coverage requirements
- Known issues and limitations

**When to Use:**
- Creating new Benefits test cases
- Understanding feature behavior
- Validating test scenarios
- Planning test coverage
- Debugging test failures

**Quick Access:**
```bash
# View the file
cat docs/maestro/features/BENEFITS_COMPLETE_KNOWLEDGE.md

# Search for specific topics
grep -i "deductible" docs/maestro/features/BENEFITS_COMPLETE_KNOWLEDGE.md
grep -i "solera" docs/maestro/features/BENEFITS_COMPLETE_KNOWLEDGE.md
```

### Other Features

**File**: `benefits.md`
- Screen objects and element definitions
- Validation rules
- Test patterns

**Future Features:**
- Additional feature knowledge bases will be added as needed
- Follow the same structure as BENEFITS_COMPLETE_KNOWLEDGE.md

## How AI Models Use This

### Automatic Context Loading

AI models automatically have access to these files through the AGENTS.md guidelines. When working on Benefits-related tasks, models will:

1. **Reference business rules** before creating assertions
2. **Check user personas** when designing test scenarios
3. **Validate against acceptance criteria** from epics
4. **Consider known limitations** to avoid false failures
5. **Follow test coverage requirements** for comprehensive testing

### Manual Reference

You can also explicitly reference these files in your requests:

```
"Create a test for Benefits landing page using @BENEFITS_COMPLETE_KNOWLEDGE.md"
```

## Updating Knowledge Base

When new features are added or existing features evolve:

1. **Extract from JIRA**: Use Atlassian MCP to get latest epic details
2. **Update knowledge file**: Add new sections or update existing ones
3. **Update AGENTS.md**: Add reference if it's a new feature
4. **Test with AI**: Verify AI models can access and use the information

## Structure Template

For new feature knowledge bases, follow this structure:

```markdown
# [Feature Name] - Complete Knowledge Base

## Table of Contents
1. Executive Summary
2. Feature Evolution Timeline
3. Core Features & Capabilities
4. Epic Breakdown
5. Technical Architecture
6. User Personas & Journeys
7. Integration Points
8. Business Rules & Logic
9. Test Coverage Requirements
10. Known Issues & Limitations

## Appendix
- Key Confluence Pages
- Key Figma Files
- JIRA Board Details
```

## Benefits of This Approach

✅ **Centralized Knowledge**: All feature context in one place  
✅ **AI-Accessible**: Models automatically reference these files  
✅ **Version Controlled**: Changes tracked in Git  
✅ **Searchable**: Easy to grep for specific information  
✅ **Comprehensive**: Complete feature history and current state  
✅ **Test-Focused**: Organized for test case creation and validation  

---

**Last Updated**: May 1, 2026  
**Maintainer**: AI Agent  
**Source**: JIRA, Confluence, Figma via MCP integrations
