#!/usr/bin/env node

/**
 * Test Execution with Dynamic Element Handling
 * 
 * This is a Node.js script, NOT a Maestro test file.
 * Run directly with: node testExecutionWithDynamicHandler.js <test-file> [max-retries]
 * 
 * Do NOT pass this to run-tests-with-report.sh
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dynamicElementHandler = require('./dynamicElementHandler');

/**
 * Test Execution with Dynamic Element Handling
 * Monitors test execution and automatically handles flaky elements
 */

class TestExecutorWithDynamicHandler {
  constructor(testFile, options = {}) {
    this.testFile = testFile;
    this.options = options;
    this.recoveryLog = [];
    this.maxRetries = options.maxRetries || 3;
    this.retryCount = 0;
  }

  /**
   * Extract screen name from test file
   */
  getScreenNameFromTest() {
    const content = fs.readFileSync(this.testFile, 'utf8');
    
    // Look for screen references in the test
    const screenMatch = content.match(/screens\/(\w+)\//i);
    if (screenMatch) {
      return screenMatch[1];
    }
    
    // Fallback to test name
    return path.basename(this.testFile, '.yaml');
  }

  /**
   * Get latest screen dump from test execution
   */
  getLatestScreenDump() {
    // First try test-reports/logs directory
    const logsDir = path.join(path.dirname(this.testFile), '..', '..', 'test-reports', 'logs');
    
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir)
        .filter(f => f.endsWith('.xml') || f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(logsDir, f),
          time: fs.statSync(path.join(logsDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      if (files.length > 0) {
        return files[0].path;
      }
    }
    
    // Try Maestro's default debug directory
    const maestroDebugDir = path.join(process.env.HOME || '/tmp', '.maestro', 'tests');
    
    if (fs.existsSync(maestroDebugDir)) {
      const testDirs = fs.readdirSync(maestroDebugDir)
        .map(dir => ({
          name: dir,
          path: path.join(maestroDebugDir, dir),
          time: fs.statSync(path.join(maestroDebugDir, dir)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      // Look for screen dumps in the most recent test directory
      if (testDirs.length > 0) {
        const latestTestDir = testDirs[0].path;
        const screenDumpFiles = fs.readdirSync(latestTestDir)
          .filter(f => f.endsWith('.xml') || f.endsWith('.json'))
          .map(f => ({
            name: f,
            path: path.join(latestTestDir, f),
            time: fs.statSync(path.join(latestTestDir, f)).mtime.getTime()
          }))
          .sort((a, b) => b.time - a.time);
        
        if (screenDumpFiles.length > 0) {
          return screenDumpFiles[0].path;
        }
      }
    }
    
    return null;
  }

  /**
   * Extract failure information from test output
   */
  extractFailureInfo(output) {
    // Look for element not found pattern
    const elementNotFoundMatch = output.match(/Element not found: Text matching regex: (.+)/);
    if (elementNotFoundMatch) {
      return {
        type: 'element-not-found',
        locator: elementNotFoundMatch[1].trim(),
        message: output
      };
    }
    
    // Look for assertion failure pattern
    const assertionMatch = output.match(/Assert that "([^"]+)" is visible FAILED/);
    if (assertionMatch) {
      return {
        type: 'assertion',
        locator: assertionMatch[1],
        message: output
      };
    }
    
    // Look for tap failure pattern
    const tapMatch = output.match(/Tap on "([^"]+)" FAILED/);
    if (tapMatch) {
      return {
        type: 'tap',
        locator: tapMatch[1],
        message: output
      };
    }
    
    // Look for tap on locator failure
    const tapLocatorMatch = output.match(/Tap on \$\{([^}]+)\}.*FAILED/);
    if (tapLocatorMatch) {
      return {
        type: 'tap-locator',
        locator: tapLocatorMatch[1],
        message: output
      };
    }
    
    return null;
  }

  /**
   * Load credentials from environment
   */
  loadCredentials() {
    try {
      const scriptDir = path.dirname(this.testFile);
      const projectRoot = path.join(scriptDir, '..', '..');
      const decryptScript = path.join(projectRoot, '.maestro', 'scripts', 'decrypt_env.js');
      
      if (fs.existsSync(decryptScript)) {
        console.log(`🔐 Loading test credentials...`);
        
        // Set MAESTRO_ENV for decryption
        process.env.MAESTRO_ENV = 'qa';
        
        // Run decrypt script and capture output
        const output = execSync(`node ${decryptScript}`, {
          cwd: projectRoot,
          encoding: 'utf8'
        });
        
        // Parse output and set environment variables
        const lines = output.split('\n');
        lines.forEach(line => {
          const match = line.match(/^export\s+(\w+)="(.*)"/);
          if (match) {
            const [, key, value] = match;
            process.env[key] = value;
          }
        });
        
        // Verify credentials were loaded
        if (process.env.COMMON_USER) {
          console.log(`✅ Credentials loaded and decrypted`);
          console.log(`   User: ${process.env.COMMON_USER.substring(0, 10)}...`);
        } else {
          console.log(`⚠️  COMMON_PASSWORD not available, using BRAYDEN credentials`);
          if (process.env.BRAYDEN_USER) {
            process.env.COMMON_USER = process.env.BRAYDEN_USER;
            process.env.COMMON_PASSWORD = process.env.BRAYDEN_PASSWORD;
            process.env.STATIC_OTP = process.env.BRAYDEN_OTP;
            process.env.DOB = process.env.BRAYDEN_DOB;
          }
        }
        
        // Set default values if not set
        process.env.STATIC_OTP = process.env.STATIC_OTP || '999999';
        process.env.DOB = process.env.DOB || '07121979';
      }
    } catch (error) {
      console.warn(`⚠️  Could not load credentials: ${error.message}`);
    }
  }

  /**
   * Run test with dynamic element handling
   */
  async runWithDynamicHandling() {
    console.log(`\n🚀 Starting test execution with dynamic element handling...`);
    console.log(`📝 Test: ${this.testFile}`);
    
    // Load credentials before running tests
    this.loadCredentials();
    
    let lastError = null;
    
    while (this.retryCount < this.maxRetries) {
      try {
        console.log(`\n▶️  Attempt ${this.retryCount + 1}/${this.maxRetries}`);
        
        // Run the test with all environment variables (including loaded credentials)
        const env = Object.assign({}, process.env, {
          JAVA_OPTS: '--add-opens java.base/sun.misc=ALL-UNNAMED --enable-native-access=ALL-UNNAMED',
          MAESTRO_DRIVER_STARTUP_TIMEOUT: '20000',
          MAESTRO_WAIT_TIMEOUT: '3000'
        });
        
        // Build Maestro command with all credential env vars
        let maestroCmd = `maestro test ${this.testFile}`;
        
        // Add all credential variables as --env flags
        const credentialVars = [
          'COMMON_USER', 'COMMON_PASSWORD', 'COMMON_OTP', 'STATIC_OTP', 'DOB',
          'USERNAME', 'PASSWORD',
          'BRAYDEN_USER', 'BRAYDEN_PASSWORD', 'BRAYDEN_OTP', 'BRAYDEN_DOB',
          'VALID_USER', 'INVALID_USER', 'CHAT_USER', 'EC_USER', 'AD_USER'
        ];
        
        credentialVars.forEach(varName => {
          if (process.env[varName]) {
            maestroCmd += ` --env ${varName}="${process.env[varName]}"`;
          }
        });
        
        const output = execSync(maestroCmd, {
          encoding: 'utf8',
          stdio: 'pipe',
          env: env
        });
        
        console.log(`✅ Test passed on attempt ${this.retryCount + 1}`);
        return {
          success: true,
          attempts: this.retryCount + 1,
          recoveryLog: this.recoveryLog
        };
      } catch (error) {
        lastError = error;
        const output = error.stdout || error.stderr || error.message || '';
        
        console.log(`\n📋 Test Output:`);
        console.log(output);
        
        // Extract failure information
        const failureInfo = this.extractFailureInfo(output);
        
        if (!failureInfo) {
          console.log(`\n❌ Test failed with non-recoverable error`);
          throw error;
        }
        
        console.log(`⚠️  Test failed: ${failureInfo.type} - ${failureInfo.locator}`);
        
        // Get screen dump
        const screenDumpPath = this.getLatestScreenDump();
        if (!screenDumpPath) {
          console.log(`❌ No screen dump available for recovery`);
          throw error;
        }
        
        // Get screen name
        const screenName = this.getScreenNameFromTest();
        
        // Handle flaky element
        console.log(`🔄 Attempting dynamic element recovery...`);
        const recoveryResult = dynamicElementHandler.handleFlakyElement(
          this.testFile,
          screenName,
          failureInfo.locator,
          screenDumpPath
        );
        
        // Log recovery attempt
        dynamicElementHandler.logElementRecovery(
          path.basename(this.testFile),
          recoveryResult
        );
        
        this.recoveryLog.push(recoveryResult);
        
        if (!recoveryResult.updated) {
          console.log(`❌ Could not recover element: ${recoveryResult.error}`);
          throw error;
        }
        
        console.log(`✅ Element recovered: "${failureInfo.locator}" → "${recoveryResult.alternatives[0].locator}"`);
        console.log(`📝 Updated: ${recoveryResult.updateResult.file}`);
        
        this.retryCount++;
      }
    }
    
    return {
      success: false,
      attempts: this.retryCount,
      error: `Test failed after ${this.maxRetries} attempts`,
      recoveryLog: this.recoveryLog,
      lastError: lastError
    };
  }
}

/**
 * Main execution
 */
async function main() {
  const testFile = process.argv[2];
  const maxRetries = parseInt(process.argv[3]) || 3;
  
  if (!testFile) {
    console.error('Usage: node testExecutionWithDynamicHandler.js <test-file> [max-retries]');
    process.exit(1);
  }
  
  if (!fs.existsSync(testFile)) {
    console.error(`Test file not found: ${testFile}`);
    process.exit(1);
  }
  
  const executor = new TestExecutorWithDynamicHandler(testFile, { maxRetries });
  
  try {
    const result = await executor.runWithDynamicHandling();
    
    console.log(`\n📊 Execution Summary:`);
    console.log(`   Attempts: ${result.attempts}`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Recoveries: ${result.recoveryLog.length}`);
    
    if (result.recoveryLog.length > 0) {
      console.log(`\n🔧 Recovery Details:`);
      result.recoveryLog.forEach((log, idx) => {
        console.log(`   ${idx + 1}. ${log.failedLocator} → ${log.alternatives[0]?.locator}`);
      });
    }
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error(`\n❌ Test execution failed:`, error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { TestExecutorWithDynamicHandler };
