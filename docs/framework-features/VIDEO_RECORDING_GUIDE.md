# Video Recording Guide

## Overview

Maestro supports video recording of test execution. This guide explains how to use the `--record` flag to capture videos of your tests.

## Quick Start

### Record a Single Test

```bash
maestro test .maestro/flows/Account/test_simple_login.yaml --record
```

### Record with Other Options

```bash
# Record with platform-specific app ID
maestro test flows/Account/login.yaml --record --platform android

# Record with app build
maestro test flows/Account/login.yaml --record --build

# Record from GitHub repository
maestro test flows/Account/login.yaml --record --from-repo --branch develop

# Record without opening browser
maestro test flows/Account/login.yaml --record --no-browser
```

## Configuration

### Default Settings

Video recording is configured in `.maestro/config.yaml`:

```yaml
# Video Recording Configuration
recording:
  # Enable video recording of test execution
  enabled: false
  # Output directory for video files
  outputDir: ../test-reports/videos
  # Video format (mp4, mov, etc.)
  format: mp4
  # Frame rate for recording (1-60 fps)
  fps: 30
  # Quality (low, medium, high)
  quality: medium
```

### Customizing Recording Settings

You can override default settings by modifying `.maestro/config.yaml`:

```yaml
recording:
  enabled: true          # Enable by default
  fps: 60               # Higher frame rate for smoother video
  quality: high         # Better quality
```

## Video Output

### Location

Videos are saved to: `test-reports/videos/`

### File Naming

Videos are named with the test name and timestamp:
```
test-reports/videos/test_simple_login_20260303_172530.mp4
```

### File Size

Video file sizes depend on:
- **Duration**: Longer tests = larger files
- **Frame Rate**: Higher fps = larger files (30 fps is recommended)
- **Quality**: Higher quality = larger files
- **Resolution**: Device resolution affects file size

**Typical sizes:**
- 5-minute test at 30 fps: 50-100 MB
- 5-minute test at 60 fps: 100-200 MB

## Usage Examples

### Example 1: Record a Login Test

```bash
maestro test .maestro/flows/Account/test_simple_login.yaml --record
```

**Output:**
```
🔐 Loading test credentials...
✅ Credentials loaded
...
📹 Recording video to: test-reports/videos/test_simple_login_20260303_172530.mp4
...
✓ Test execution completed!
📄 Report: test-reports/test-report-latest.html
```

### Example 2: Record Multiple Tests with Report

```bash
maestro test .maestro/flows/Account/ --record
```

This records all tests in the Account directory and generates an HTML report with video links.

### Example 3: Record Android Tests

```bash
maestro test flows/Shop/checkout.yaml --record --platform android
```

### Example 4: Record with Build from Repository

```bash
maestro test flows/Account/login.yaml --record --from-repo --branch develop
```

## Viewing Videos

### In HTML Report

Videos are automatically linked in the generated HTML report:
```
test-reports/test-report-latest.html
```

Click on the video link in the report to view the recording.

### Direct Playback

Play videos directly with your media player:
```bash
# macOS
open test-reports/videos/test_simple_login_20260303_172530.mp4

# Linux
vlc test-reports/videos/test_simple_login_20260303_172530.mp4

# Windows
start test-reports/videos/test_simple_login_20260303_172530.mp4
```

## Performance Considerations

### Impact on Test Execution

Recording adds minimal overhead:
- **CPU**: ~5-10% additional usage
- **Memory**: ~50-100 MB additional
- **Disk I/O**: Moderate (depends on frame rate)

### Optimization Tips

1. **Use 30 fps for most tests** (default)
   - Good balance between quality and file size
   - Sufficient for debugging UI interactions

2. **Use 60 fps for critical tests**
   - Better for capturing fast animations
   - Larger file sizes

3. **Use low quality for quick debugging**
   - Smaller file sizes
   - Faster processing

4. **Disable recording for CI/CD pipelines** (if disk space is limited)
   - Only enable for specific test runs
   - Use `--no-record` flag (if needed in future)

## Troubleshooting

### Videos Not Being Generated

1. **Check video directory exists:**
   ```bash
   ls -la test-reports/videos/
   ```

2. **Verify recording flag is passed:**
   ```bash
   maestro test flows/Account/login.yaml --record --skip-setup
   ```

3. **Check disk space:**
   ```bash
   df -h test-reports/
   ```

### Video File is Corrupted

1. **Ensure test completed successfully:**
   - Check test report for failures
   - Verify maestro process exited cleanly

2. **Try with different quality settings:**
   ```yaml
   recording:
     quality: low
   ```

### Large Video Files

1. **Reduce frame rate:**
   ```yaml
   recording:
     fps: 15  # Lower frame rate
   ```

2. **Use lower quality:**
   ```yaml
   recording:
     quality: low
   ```

3. **Compress videos after recording:**
   ```bash
   ffmpeg -i input.mp4 -vcodec libx264 -crf 28 output.mp4
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Tests with Recording
  run: |
    maestro test .maestro/flows/Account/test_simple_login.yaml --record

- name: Upload Videos
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: test-videos
    path: test-reports/videos/
```

### Jenkins Example

```groovy
stage('Test with Recording') {
  steps {
    sh 'maestro test .maestro/flows/Account/test_simple_login.yaml --record'
  }
}

stage('Archive Videos') {
  steps {
    archiveArtifacts artifacts: 'test-reports/videos/**/*.mp4'
  }
}
```

## Advanced Usage

### Record Specific Test Suites

```bash
# Record all Account tests
maestro test .maestro/flows/Account/ --record

# Record all Shop tests
maestro test .maestro/flows/Shop/ --record

# Record specific test file
maestro test .maestro/flows/Account/test_simple_login.yaml --record
```

### Combine with Other Flags

```bash
# Record + Build + Platform
maestro test flows/Account/login.yaml --record --build --platform ios

# Record + Skip Setup + No Browser
maestro test flows/Account/login.yaml --record --skip-setup --no-browser

# Record + From Repo + Branch
maestro test flows/Account/login.yaml --record --from-repo --branch develop
```

## Related Documentation

- [Maestro Wrapper Guide](.maestro/MAESTRO_WRAPPER_GUIDE.md)
- [Test Execution Guide](./TEST_EXECUTION.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_COMMON_ISSUES.md)
