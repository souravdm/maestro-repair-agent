/**
 * Request Helper - Axios wrapper for API requests
 * Provides consistent request/response handling and logging
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class RequestHelper {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || 30000,
      baseURL: config.baseURL || '',
      headers: config.headers || {},
      ...config
    };

    this.client = axios.create({
      timeout: this.config.timeout,
      baseURL: this.config.baseURL,
      headers: this.config.headers
    });

    // Add response interceptor for consistent handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          return Promise.reject({
            statusCode: error.response.status,
            statusMessage: error.response.statusText,
            data: error.response.data,
            headers: error.response.headers,
            error: error.message
          });
        } else if (error.request) {
          return Promise.reject({
            statusCode: 0,
            error: 'No response received',
            message: error.message
          });
        } else {
          return Promise.reject({
            statusCode: 0,
            error: error.message
          });
        }
      }
    );
  }

  /**
   * Make a GET request
   * @param {string} url - Request URL
   * @param {Object} config - Axios config
   * @returns {Promise<Object>} Response object
   */
  async get(url, config = {}) {
    return this.request('GET', url, null, config);
  }

  /**
   * Make a POST request
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {Object} config - Axios config
   * @returns {Promise<Object>} Response object
   */
  async post(url, data, config = {}) {
    return this.request('POST', url, data, config);
  }

  /**
   * Make a PUT request
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {Object} config - Axios config
   * @returns {Promise<Object>} Response object
   */
  async put(url, data, config = {}) {
    return this.request('PUT', url, data, config);
  }

  /**
   * Make a PATCH request
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {Object} config - Axios config
   * @returns {Promise<Object>} Response object
   */
  async patch(url, data, config = {}) {
    return this.request('PATCH', url, data, config);
  }

  /**
   * Make a DELETE request
   * @param {string} url - Request URL
   * @param {Object} config - Axios config
   * @returns {Promise<Object>} Response object
   */
  async delete(url, config = {}) {
    return this.request('DELETE', url, null, config);
  }

  /**
   * Generic request method
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {Object} config - Axios config
   * @returns {Promise<Object>} Response object
   */
  async request(method, url, data = null, config = {}) {
    const startTime = Date.now();
    const baseURL = (this.config.baseURL || '').replace(/\/$/, '');
    const requestDetails = {
      method,
      url: baseURL + url,
      headers: { ...this.client.defaults.headers.common },
      body: data
    };

    try {
      const response = await this.client({
        method,
        url,
        data,
        ...config
      });

      const endTime = Date.now();

      return {
        statusCode: response.status,
        statusMessage: response.statusText,
        headers: response.headers,
        data: response.data,
        timing: endTime - startTime,
        success: response.status >= 200 && response.status < 300,
        request: requestDetails
      };
    } catch (error) {
      const endTime = Date.now();

      return {
        statusCode: error.statusCode || 0,
        statusMessage: error.statusMessage || 'Error',
        data: error.data,
        error: error.error || error.message,
        timing: endTime - startTime,
        success: false,
        request: requestDetails
      };
    }
  }

  /**
   * Set authorization header
   * @param {string} token - Auth token
   * @param {string} type - Token type (Bearer, Basic, etc.)
   */
  setAuth(token, type = 'Bearer') {
    this.client.defaults.headers.common['Authorization'] = `${type} ${token}`;
  }

  /**
   * Set custom header
   * @param {string} key - Header key
   * @param {string} value - Header value
   */
  setHeader(key, value) {
    this.client.defaults.headers.common[key] = value;
  }

  /**
   * Set multiple headers
   * @param {Object} headers - Headers object
   */
  setHeaders(headers) {
    Object.assign(this.client.defaults.headers.common, headers);
  }

  /**
   * Clear all custom headers
   */
  clearHeaders() {
    this.client.defaults.headers.common = {};
  }
}

module.exports = RequestHelper;
