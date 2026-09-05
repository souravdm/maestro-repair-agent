# Maestro YAML Validation Script

## Overview

The `validate-yaml.js` script provides comprehensive validation for Maestro test files, ensuring YAML syntax correctness, proper Maestro format, and validation of screen references, test data paths, and flow references.

## Usage

### Command Line
```bash
node scripts/utils/validate-yaml.js <yaml-file-path>
```

### Integration with GUI
The script is integrated with the "Check Issues" button in the Electron GUI and provides real-time validation feedback.

## Validation Checks

### 1. YAML Format Validation
- **Syntax validation**: Checks for proper YAML syntax
- **Structure validation**: Ensures Maestro-specific structure requirements
- **Header validation**: Validates appId and flow separation with `---`

### 2. Screen Reference Validation
Validates `${output.screen.element}` references:
- **Screen existence**: Checks if screen exists in `.maestro/screens/`
- **Format**: Validates correct screen reference format

**Example Valid References:**
```yaml
- tapOn: ${output.LoginScreen.loginButton}
- assertVisible: ${output.HomeScreen.profileIcon}
```

**Example Errors:**
```yaml
- tapOn: ${output.NonExistentScreen.button}  # Screen not found
- assertVisible: ${output.LoginScreen.missingElement}  # Element not found
```

### 3. Test Data Validation
Validates `${output.user.testData}` references:
- **Test data existence**: Checks if test data exists in `.maestro/testdata/`
- **File format**: Expects JSON files in testdata directory

**Example Valid References:**
```yaml
- inputText: ${output.user.validCredentials}
- assertVisible: ${output.user.testUser}
```

**Example Errors:**
```yaml
- inputText: ${output.user.nonExistentData}  # Test data not found
```

### 4. Flow Reference Validation
Validates `runFlow:` commands:
- **Flow existence**: Checks if flow exists in `.maestro/flows/` or `.maestro/subflows/`
- **Path validation**: Validates correct path format
- **Inline flows**: Skips validation for inline flows (no path provided)

**Example Valid References:**
```yaml
- runFlow: Account/login.yaml
- runFlow: .maestro/subflows/Common/navigation.yaml
- runFlow:  # Inline flow (no validation needed)
```

**Example Errors:**
```yaml
- runFlow: NonExistent/flow.yaml  # Flow not found
- runFlow: Account/missing.yaml  # Flow not found
```

### 5. Maestro Command Validation
Validates Maestro command syntax and best practices:
- **Command recognition**: Checks for known Maestro commands
- **Selector validation**: Recommends proper selectors for tapOn commands
- **Tag handling**: Ignores tag lines (like `- homescreen`) that don't contain colons
- **Unknown commands**: Warns about potentially misspelled commands

**Supported Commands:**
- `addMedia`, `assertNoDefectsWithAI`, `assertNotVisible`, `assertScreenshot`
- `assertTrue`, `assertVisible`, `assertWithAI`, `back`, `clearKeychain`
- `clearState`, `copyTextFrom`, `doubleTapOn`, `eraseText`, `evalScript`
- `extendedWaitUntil`, `hideKeyboard`, `inputText`, `killApp`, `launchApp`
- `longPressOn`, `openLink`, `pasteText`, `pressKey`, `repeat`, `retry`
- `runFlow`, `runScript`, `scroll`, `scrollUntilVisible`, `setAirplaneMode`
- `setClipboard`, `setLocation`, `setOrientation`, `setPermissions`
- `startRecording`, `stopApp`, `stopRecording`, `swipe`, `takeScreenshot`
- `tapOn`, `toggleAirplaneMode`, `travel`, `waitForAnimationToEnd`

## Output Format

The script outputs JSON format for integration with the GUI:

### Success (No Issues)
```json
[{
  "success": true,
  "message": "✅ No issues found"
}]
```

### Issues Found
```json
[
  {
    "line": 5,
    "message": "Screen \"NonExistentScreen\" not found in .maestro/screens/",
    "type": "error",
    "severity": "error"
  },
  {
    "line": 8,
    "message": "Test data \"invalidCredentials\" not found in .maestro/testdata/",
    "type": "error",
    "severity": "error"
  },
  {
    "line": 12,
    "message": "tapOn command should use id or text selector for better reliability",
    "type": "warning",
    "severity": "warning"
  }
]
```

## Error Types

### Errors
- **YAML syntax errors**: Invalid YAML format
- **Missing references**: Screens, test data, or flows not found
- **Invalid paths**: Incorrect file paths

### Warnings
- **Best practices**: Recommendations for better test reliability
- **Unknown commands**: Potentially misspelled commands
- **Structure issues**: Missing headers or separators

## Integration with GUI

The validation script is integrated with the "Check Issues" button in the Electron GUI:

1. **File selection**: Validates currently open file in YAML editor
2. **Real-time feedback**: Updates error badges in file tree
3. **Issue display**: Shows detailed error messages in issues panel
4. **Auto-validation**: Runs automatically when files are saved

## File Structure Requirements

The script expects the following directory structure:

```
.maestro/
├── screens/           # Screen definitions (*.json)
├── testdata/          # Test data files (*.json)
├── flows/            # Main flow files (*.yaml, *.yml)
└── subflows/         # Subflow files (*.yaml, *.yml)
```

## Dependencies

- **Node.js**: Runtime environment
- **js-yaml**: YAML parsing library
- **fs**: File system operations
- **path**: Path manipulation

## Installation

Ensure `js-yaml` is installed:
```bash
npm install js-yaml
```

## Examples

### Valid Maestro File
```yaml
appId: com.example.app
name: Login Test
---
- tapOn: ${output.LoginScreen.usernameField}
- inputText: ${output.user.validUser}
- tapOn: ${output.LoginScreen.passwordField}
- inputText: ${output.user.validPassword}
- tapOn: ${output.LoginScreen.loginButton}
- assertVisible: ${output.HomeScreen.dashboard}
- runFlow: Common/postLogin.yaml
```

### File with Issues
```yaml
appId: com.example.app
name: Login Test
---
- tapOn: ${output.MissingScreen.button}  # Screen not found
- inputText: ${output.user.invalidData}  # Test data not found
- runFlow: NonExistent/flow.yaml  # Flow not found
- tapOn: "Some text"  # Warning: should use id selector
```

## Troubleshooting

### Common Issues

1. **File not found**: Check file path and ensure file exists
2. **Screen not found**: Verify screen file exists in `.maestro/screens/`
3. **Test data not found**: Ensure test data exists in `.maestro/testdata/`
4. **Flow not found**: Check flow path in `.maestro/flows/` or `.maestro/subflows/`

### Debug Mode

Run with additional logging:
```bash
DEBUG=* node scripts/utils/validate-yaml.js <file>
```

## Performance

The script:
- **Caches references**: Loads screen/testdata/flow references once
- **Efficient parsing**: Uses regex for pattern matching
- **Minimal memory**: Processes files line by line
- **Fast execution**: Validates typical files in <100ms

## Future Enhancements

Planned improvements:
- **Custom validation rules**: User-defined validation patterns
- **Performance metrics**: Validation timing and statistics
- **Batch validation**: Validate multiple files simultaneously
- **IDE integration**: Real-time validation in code editors
