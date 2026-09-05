#!/usr/bin/env node

/**
 * Zephyr Scale API Client
 * Provides methods to interact with Zephyr Scale REST API
 * Documentation: https://support.smartbear.com/zephyr-scale-cloud/api-docs/
 */

const https = require('https');
const http = require('http');

class ZephyrScaleClient {
  constructor(config) {
    this.apiToken = config.apiToken || process.env.ZEPHYR_API_TOKEN;
    this.projectKey = config.projectKey || process.env.ZEPHYR_PROJECT_KEY || 'TLPCWHSAM';
    this.baseUrl = config.baseUrl || process.env.ZEPHYR_BASE_URL || 'https://api.zephyrscale.smartbear.com/v2';
    this.jiraBaseUrl = config.jiraBaseUrl || process.env.JIRA_BASE_URL || 'https://cvsdigital.atlassian.net';
    
    if (!this.apiToken) {
      throw new Error('Zephyr API token is required. Set ZEPHYR_API_TOKEN environment variable.');
    }
  }

  /**
   * Make HTTP request to Zephyr Scale API
   * @private
   */
  async _request(method, endpoint, data = null, retries = 3) {
    // Plain `new URL(endpoint, this.baseUrl)` silently drops the "/v2" path
    // segment of baseUrl whenever endpoint starts with "/" (WHATWG URL
    // resolution treats a leading-slash path as absolute). Concatenate
    // directly so the base path is always preserved.
    const url = new URL(`${this.baseUrl.replace(/\/$/, '')}${endpoint}`);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    return new Promise((resolve, reject) => {
      const req = protocol.request(url, options, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(body ? JSON.parse(body) : {});
            } catch (e) {
              resolve({ raw: body });
            }
          } else if (res.statusCode === 429 && retries > 0) {
            // Rate limit - retry after delay
            const retryAfter = parseInt(res.headers['retry-after'] || '5', 10);
            setTimeout(() => {
              this._request(method, endpoint, data, retries - 1)
                .then(resolve)
                .catch(reject);
            }, retryAfter * 1000);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', (err) => {
        if (retries > 0) {
          setTimeout(() => {
            this._request(method, endpoint, data, retries - 1)
              .then(resolve)
              .catch(reject);
          }, 2000);
        } else {
          reject(err);
        }
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  /**
   * Create a test case in Zephyr Scale
   */
  async createTestCase(testCase) {
    const payload = {
      projectKey: this.projectKey,
      name: testCase.name,
      objective: testCase.objective || testCase.description,
      folder: testCase.folder || '/Automated',
      status: testCase.status || 'Approved',
      priority: testCase.priority || 'Normal',
      labels: testCase.labels || ['automated', 'maestro'],
      customFields: {
        'Automation Status': 'Automated',
        'Framework': 'Maestro',
        ...(testCase.customFields || {})
      }
    };

    if (testCase.steps && testCase.steps.length > 0) {
      payload.testScript = {
        type: 'PLAIN_TEXT',
        steps: testCase.steps.map((step, index) => ({
          index: index + 1,
          description: step.description || step,
          expectedResult: step.expectedResult || 'Step completes successfully'
        }))
      };
    }

    return this._request('POST', '/testcases', payload);
  }

  /**
   * Update an existing test case
   */
  async updateTestCase(testCaseKey, updates) {
    return this._request('PUT', `/testcases/${testCaseKey}`, updates);
  }

  /**
   * Get test case by key
   */
  async getTestCase(testCaseKey) {
    return this._request('GET', `/testcases/${testCaseKey}`);
  }

  /**
   * Search test cases
   */
  async searchTestCases(query) {
    const params = new URLSearchParams({
      projectKey: this.projectKey,
      ...query
    });
    return this._request('GET', `/testcases/search?${params}`);
  }

  /**
   * Create a test cycle
   */
  async createTestCycle(cycle) {
    const payload = {
      projectKey: this.projectKey,
      name: cycle.name,
      description: cycle.description || '',
      plannedStartDate: cycle.startDate || new Date().toISOString(),
      plannedEndDate: cycle.endDate || new Date().toISOString(),
      folder: cycle.folder || '/Automated',
      status: cycle.status || 'Not Executed',
      customFields: cycle.customFields || {}
    };
    // Zephyr's API only honors a numeric folderId — the `folder` path
    // string above is accepted but silently ignored server-side.
    if (cycle.folderId) payload.folderId = cycle.folderId;

    return this._request('POST', '/testcycles', payload);
  }

  /**
   * Update test cycle
   */
  async updateTestCycle(cycleKey, updates) {
    return this._request('PUT', `/testcycles/${cycleKey}`, updates);
  }

  /**
   * Get test cycle by key
   */
  async getTestCycle(cycleKey) {
    return this._request('GET', `/testcycles/${cycleKey}`);
  }

  /**
   * Create test execution
   */
  async createTestExecution(execution) {
    const payload = {
      projectKey: this.projectKey,
      testCaseKey: execution.testCaseKey,
      testCycleKey: execution.testCycleKey,
      statusName: execution.status || 'Pass',
      executionTime: execution.executionTime || 0,
      executedById: execution.executedBy,
      assignedToId: execution.assignedTo,
      environmentName: execution.environment || 'QA',
      comment: execution.comment || '',
      customFields: execution.customFields || {}
    };

    return this._request('POST', '/testexecutions', payload);
  }

  /**
   * Update test execution
   */
  async updateTestExecution(executionKey, updates) {
    return this._request('PUT', `/testexecutions/${executionKey}`, updates);
  }

  /**
   * Add attachment to test execution
   */
  async addAttachment(entityType, entityKey, filePath) {
    // Note: File upload requires multipart/form-data
    // This is a placeholder - implement file upload separately
    console.warn('File upload not yet implemented. Use Zephyr UI to attach files.');
    return { success: false, message: 'Not implemented' };
  }

  /**
   * Get folders in project
   */
  async getFolders(folderType = 'TEST_CASE') {
    const params = new URLSearchParams({
      projectKey: this.projectKey,
      folderType
    });
    return this._request('GET', `/folders?${params}`);
  }

  /**
   * Create folder
   */
  async createFolder(name, parentId = null, type = 'TEST_CASE') {
    const payload = {
      projectKey: this.projectKey,
      name,
      type,
      parentId
    };
    return this._request('POST', '/folders', payload);
  }

  /**
   * Link test case to JIRA issue
   */
  async linkToJiraIssue(testCaseKey, issueKey) {
    const payload = {
      issueKey
    };
    return this._request('POST', `/testcases/${testCaseKey}/links/issues`, payload);
  }

  /**
   * Get project information
   */
  async getProject() {
    return this._request('GET', `/projects/${this.projectKey}`);
  }

  /**
   * Health check - verify API connectivity
   */
  async healthCheck() {
    try {
      await this.getProject();
      return { healthy: true, message: 'Connected to Zephyr Scale API' };
    } catch (error) {
      return { healthy: false, message: error.message };
    }
  }
}

module.exports = ZephyrScaleClient;

// CLI usage
if (require.main === module) {
  const client = new ZephyrScaleClient({});
  
  client.healthCheck()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.healthy ? 0 : 1);
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}
