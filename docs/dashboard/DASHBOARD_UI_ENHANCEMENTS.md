# Dashboard UI Enhancements

## Overview
Enhanced the Test Generator dashboard with improved UI for better test input/output management and regeneration capabilities.

## Changes Made

### 1. **Input/YAML Tabs**
Added tabbed interface to the "Generated Maestro Test" section with two tabs:

#### **Input Tab** (Default)
- Shows the original test case details that were used to generate the test
- Displays:
  - Test Case #
  - Functional Area
  - Test Scenario
  - Notes
  - Test Steps
  - Generation Mode (template/hybrid/llm)
- Read-only preview of the Excel/form input data
- Left-aligned with action buttons (Re-generate, Copy, Download)

#### **YAML Tab**
- Shows the editable generated YAML test
- Same as previous single view but now in a tab
- Users can review and edit the generated Maestro YAML

### 2. **Re-generate Test Button**
Added "🔄 Re-generate Test" button to the left of Copy/Download buttons.

**Functionality:**
- Uses current form field values to regenerate the test
- Allows users to modify inputs (Test Steps, Notes, Functional Area, etc.) and quickly regenerate
- Maintains the same generation mode (template/hybrid/llm)
- Shows loading state during regeneration

**Use Case:**
1. User generates a test from Excel
2. User reviews the YAML output
3. User modifies test steps in the form
4. User clicks "Re-generate Test" to get updated YAML
5. No need to re-upload Excel or manually copy data

### 3. **Visual Design**
- Tabs are left-aligned and positioned above the content area
- Active tab highlighted with CVS red color (`var(--cvs-red)`)
- Smooth transitions on tab hover/click
- Consistent with existing dashboard design language

## Implementation Details

### CSS Classes Added
```css
.output-tab {
  padding: 6px 16px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
  background: var(--bg2);
  border-radius: 4px 4px 0 0;
}

.output-tab:hover { 
  color: var(--text); 
  background: var(--bg3); 
}

.output-tab.output-tab-active { 
  color: var(--cvs-red); 
  border-bottom-color: var(--cvs-red); 
  background: var(--bg1);
}
```

### JavaScript Functions Added

#### `switchOutputTab(tab, context)`
- Switches between Input and YAML tabs
- Handles both test-generator and main contexts
- Updates active states and content visibility

#### `regenerateTest()`
- Regenerates test using current `currentTestData`
- Calls `generateMaestroTest()` with stored test data
- Validates test data exists before regenerating

#### `regenerateTestMain()`
- Regenerates test in main window context
- Calls `generateMaestroTestMain()` with current form values
- Reads latest values from form fields

#### `populateInputDisplay(testData, targetId)`
- Formats and displays test input data in the Input tab
- Shows all test case details in readable format
- Used in both test-generator and main contexts

### Modified Functions

#### `generateMaestroTest()`
- Now calls `populateInputDisplay()` to populate Input tab
- Stores `currentTestData` for regeneration

#### `generateMaestroTestMain()`
- Now calls `populateInputDisplay()` to populate Input tab
- Stores `currentTestDataMain` for regeneration

## File Modified
- `/Users/c256618/StudioProjects/cvs-app-e2e-automation/dashboard/index.html`

## User Workflow

### Excel Batch Generation
1. Upload Excel file with test cases
2. Click "Generate All Tests"
3. Tests appear in dropdown list
4. Click on a test to view:
   - **Input Tab**: Original Excel row data (Test ID, Functional Area, Steps, etc.)
   - **YAML Tab**: Generated Maestro YAML
5. Modify any input fields in the form
6. Click "🔄 Re-generate Test" to regenerate with new values
7. Click "📋 Copy" or "💾 Download" from the YAML tab

### Manual Single Test Generation
1. Fill in test case details manually
2. Select generation mode (Template/Hybrid/LLM)
3. Click "🚀 Generate Test"
4. Review in tabs:
   - **Input Tab**: Shows what you entered
   - **YAML Tab**: Shows generated test
5. Edit form fields if needed
6. Click "🔄 Re-generate Test"
7. Copy or download the final test

## Benefits

1. **Better Input/Output Separation** - Clear distinction between what was input vs. what was generated
2. **Easy Debugging** - Quickly see what inputs led to current output
3. **Iterative Development** - Modify inputs and regenerate without re-entering data
4. **Excel Context Preservation** - Input tab preserves original Excel data for reference
5. **Workflow Efficiency** - No need to scroll back to input fields to remember what was entered
