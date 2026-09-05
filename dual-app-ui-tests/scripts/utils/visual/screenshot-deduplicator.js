#!/usr/bin/env node
'use strict';

/**
 * Screenshot Deduplication Utility
 *
 * Filters visually-similar screenshots using perceptual hashing.
 * Keeps original files on disk, only filters the list for reporting.
 *
 * Algorithm:
 * 1. Sort screenshots by timestamp (extracted from filename)
 * 2. For each screenshot, compare with previous unique screenshot
 * 3. If similarity > threshold AND time gap < minTimeGap, mark as duplicate
 * 4. Return filtered list with only unique screenshots
 *
 * Dependencies: pngjs (for PNG reading)
 */

const fs = require('fs');
const path = require('path');

let PNG = null;

// Load dependencies
function loadDeps() {
  if (PNG) return true;
  try {
    PNG = require('pngjs').PNG;
    return true;
  } catch (e) {
    //console.warn('[Dedup] pngjs not found, screenshot deduplication disabled');
    return false;
  }
}

/**
 * Extract timestamp from Maestro screenshot filename
 * Format: screenshot-{status}-{timestamp}-({testName}).png
 * Status: ⚠️ (warning), ❌ (failure), ✅ (success)
 * Timestamp: Milliseconds since epoch (13 digits)
 *
 * @param {string} filename - Screenshot filename
 * @returns {number|null} - Timestamp in ms, or null if not found
 */
function extractTimestamp(filename) {
  // Match pattern: screenshot-⚠️-1776875252207-(test).png
  // Also match: screenshot_fail_20260422_112941.png format
  let match = filename.match(/screenshot-.-(\d{13})-/);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Try alternate format: screenshot_fail_YYYYMMDD_HHMMSS.png
  match = filename.match(/screenshot_(?:fail|pass)_(\d{8})_(\d{6})/);
  if (match) {
    // Convert YYYYMMDD_HHMMSS to timestamp
    const dateStr = match[1]; // YYYYMMDD
    const timeStr = match[2]; // HHMMSS
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = timeStr.substring(0, 2);
    const min = timeStr.substring(2, 4);
    const sec = timeStr.substring(4, 6);
    const date = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
    return date.getTime();
  }

  // Fallback: try to get file mtime
  return null;
}

/**
 * Check if screenshot represents a failure
 * @param {string} filename - Screenshot filename
 * @returns {boolean} - True if failure screenshot
 */
function isFailureScreenshot(filename) {
  return filename.includes('❌') || filename.includes('fail');
}

/**
 * Read PNG file and return image data
 * @param {string} filePath - Path to PNG file
 * @returns {object|null} - PNG object with width, height, data, or null on error
 */
function readPng(filePath) {
  try {
    if (!loadDeps()) return null;
    const buf = fs.readFileSync(filePath);
    return PNG.sync.read(buf);
  } catch (e) {
    //console.warn(`[Dedup] Failed to read ${path.basename(filePath)}: ${e.message}`);
    return null;
  }
}

/**
 * Resize image to target dimensions for perceptual hash calculation
 * Uses simple nearest-neighbor sampling for speed
 *
 * @param {object} img - PNG image object
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @returns {Uint8Array} - Resized grayscale pixel data
 */
function resizeToGrayscale(img, targetWidth, targetHeight) {
  const { width, height, data } = img;
  const resized = new Uint8Array(targetWidth * targetHeight);

  const xRatio = width / targetWidth;
  const yRatio = height / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      // Sample source pixel (nearest neighbor)
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = (srcY * width + srcX) * 4; // RGBA format

      // Convert to grayscale: 0.299R + 0.587G + 0.114B
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);

      resized[y * targetWidth + x] = gray;
    }
  }

  return resized;
}

/**
 * Simple 2D DCT implementation for perceptual hashing
 * Computes DCT-II on 8x8 block
 *
 * @param {Uint8Array} pixels - Grayscale pixel data (32x32)
 * @returns {Float32Array} - 8x8 DCT coefficients
 */
function computeDCT(pixels) {
  const size = 32;
  const dctSize = 8;
  const dct = new Float32Array(dctSize * dctSize);

  // Compute 8x8 DCT from 32x32 image (using every 4th pixel)
  for (let v = 0; v < dctSize; v++) {
    for (let u = 0; u < dctSize; u++) {
      let sum = 0;

      for (let y = 0; y < dctSize; y++) {
        for (let x = 0; x < dctSize; x++) {
          // Sample from 32x32 grid (every 4th pixel)
          const px = pixels[(y * 4) * size + (x * 4)];

          // DCT formula
          sum += px *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * dctSize)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * dctSize));
        }
      }

      // Normalization factors
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;

      dct[v * dctSize + u] = (1 / 4) * cu * cv * sum;
    }
  }

  return dct;
}

/**
 * Calculate perceptual hash of an image
 * Uses difference hash (dHash) algorithm for speed and simplicity
 *
 * @param {string} imagePath - Path to image file
 * @returns {string|null} - 64-character hash string, or null on error
 */
function calculatePerceptualHash(imagePath) {
  const img = readPng(imagePath);
  if (!img) return null;

  // Resize to 9x8 for horizontal gradient hash
  const width = 9;
  const height = 8;
  const grayscale = resizeToGrayscale(img, width, height);

  // Calculate dHash: compare each pixel to its horizontal neighbor
  let hash = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const left = grayscale[y * width + x];
      const right = grayscale[y * width + (x + 1)];
      hash += left < right ? '1' : '0';
    }
  }

  // Convert binary string to hex for compact representation
  let hexHash = '';
  for (let i = 0; i < hash.length; i += 4) {
    const chunk = hash.substring(i, i + 4);
    hexHash += parseInt(chunk, 2).toString(16);
  }

  return hexHash;
}

/**
 * Calculate Hamming distance between two binary strings
 * @param {string} hash1 - First hash
 * @param {string} hash2 - Second hash
 * @returns {number} - Number of differing bits
 */
function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return Infinity;
  }

  let distance = 0;

  // Convert hex back to binary for comparison
  for (let i = 0; i < hash1.length; i++) {
    const val1 = parseInt(hash1[i], 16);
    const val2 = parseInt(hash2[i], 16);
    const xor = val1 ^ val2;

    // Count set bits
    let bits = xor;
    while (bits > 0) {
      distance += bits & 1;
      bits >>= 1;
    }
  }

  return distance;
}

/**
 * Calculate similarity score between two hashes (0.0 to 1.0)
 * @param {string} hash1 - First hash
 * @param {string} hash2 - Second hash
 * @returns {number} - Similarity score (1.0 = identical, 0.0 = completely different)
 */
function calculateSimilarity(hash1, hash2) {
  const distance = hammingDistance(hash1, hash2);
  if (distance === Infinity) return 0;

  // Max possible distance for 64-bit hash = 64
  const maxDistance = 64;
  return 1 - (distance / maxDistance);
}

/**
 * Deduplicate screenshots based on visual similarity
 *
 * @param {Array} screenshots - Array of {name, path} objects
 * @param {object} options - Deduplication options
 * @param {number} options.similarityThreshold - Similarity threshold (0.0-1.0)
 * @param {number} options.minTimeGapMs - Minimum time gap between screenshots (ms)
 * @param {boolean} options.preserveFailures - Always keep failure screenshots
 * @param {boolean} options.preserveFirst - Always keep first screenshot
 * @returns {object} - {uniqueScreenshots, duplicateScreenshots, originalCount, uniqueCount, duplicateCount}
 */
function deduplicateScreenshots(screenshots, options = {}) {
  // Default options
  const {
    similarityThreshold = 0.95,
    minTimeGapMs = 2000,
    preserveFailures = true,
    preserveFirst = true
  } = options;

  if (!screenshots || screenshots.length === 0) {
    return {
      uniqueScreenshots: [],
      duplicateScreenshots: [],
      originalCount: 0,
      uniqueCount: 0,
      duplicateCount: 0
    };
  }

  // Check if pngjs is available
  if (!loadDeps()) {
    //console.warn('[Dedup] Required dependencies not available, returning all screenshots');
    return {
      uniqueScreenshots: screenshots,
      duplicateScreenshots: [],
      originalCount: screenshots.length,
      uniqueCount: screenshots.length,
      duplicateCount: 0
    };
  }

  // Extract timestamps and sort by time
  const screenshotsWithTime = screenshots.map(s => {
    const timestamp = extractTimestamp(s.name);
    const isFailure = isFailureScreenshot(s.name);
    return {
      ...s,
      timestamp: timestamp || 0,
      isFailure
    };
  }).sort((a, b) => a.timestamp - b.timestamp);

  const uniqueScreenshots = [];
  const duplicateScreenshots = [];
  let lastUniqueHash = null;
  let lastUniqueTimestamp = 0;

  for (let i = 0; i < screenshotsWithTime.length; i++) {
    const screenshot = screenshotsWithTime[i];

    // Always preserve failure screenshots
    if (preserveFailures && screenshot.isFailure) {
      uniqueScreenshots.push(screenshot);
      //console.log(`[Dedup] KEEP ${screenshot.name} (failure screenshot)`);
      continue;
    }

    // Always preserve first screenshot
    if (preserveFirst && i === 0) {
      const hash = calculatePerceptualHash(screenshot.path);
      if (hash) {
        lastUniqueHash = hash;
        lastUniqueTimestamp = screenshot.timestamp;
        uniqueScreenshots.push(screenshot);
        //console.log(`[Dedup] KEEP ${screenshot.name} (first screenshot)`);
      }
      continue;
    }

    // Calculate hash for current screenshot
    const currentHash = calculatePerceptualHash(screenshot.path);
    if (!currentHash) {
      // If hash calculation fails, keep the screenshot
      uniqueScreenshots.push(screenshot);
      //console.log(`[Dedup] KEEP ${screenshot.name} (hash calculation failed)`);
      continue;
    }

    // If no previous unique screenshot, keep this one
    if (!lastUniqueHash) {
      lastUniqueHash = currentHash;
      lastUniqueTimestamp = screenshot.timestamp;
      uniqueScreenshots.push(screenshot);
      //console.log(`[Dedup] KEEP ${screenshot.name} (first valid screenshot)`);
      continue;
    }

    // Calculate similarity with last unique screenshot
    const similarity = calculateSimilarity(currentHash, lastUniqueHash);
    const timeGap = screenshot.timestamp - lastUniqueTimestamp;

    // Determine if screenshot is a duplicate
    const isSimilar = similarity >= similarityThreshold;
    const isTooSoon = timeGap < minTimeGapMs;
    const isDuplicate = isSimilar && isTooSoon;

    if (isDuplicate) {
      duplicateScreenshots.push(screenshot);
      //console.log(`[Dedup] FILTER ${screenshot.name} (similarity=${similarity.toFixed(3)}, gap=${timeGap}ms)`);
    } else {
      lastUniqueHash = currentHash;
      lastUniqueTimestamp = screenshot.timestamp;
      uniqueScreenshots.push(screenshot);
      //console.log(`[Dedup] KEEP ${screenshot.name} (similarity=${similarity.toFixed(3)}, gap=${timeGap}ms)`);
    }
  }

  return {
    uniqueScreenshots,
    duplicateScreenshots,
    originalCount: screenshots.length,
    uniqueCount: uniqueScreenshots.length,
    duplicateCount: duplicateScreenshots.length
  };
}

// Export functions
module.exports = {
  deduplicateScreenshots,
  calculatePerceptualHash,
  extractTimestamp,
  isFailureScreenshot
};

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    //console.log('Usage: node screenshot-deduplicator.js <screenshots-dir>');
    //console.log('       node screenshot-deduplicator.js <screenshot1.png> <screenshot2.png> [compare]');
    process.exit(1);
  }

  // If comparing two screenshots
  if (args.length === 2 || (args.length === 3 && args[2] === 'compare')) {
    const hash1 = calculatePerceptualHash(args[0]);
    const hash2 = calculatePerceptualHash(args[1]);

    if (!hash1 || !hash2) {
      //console.error('Failed to calculate hashes');
      process.exit(1);
    }

    const similarity = calculateSimilarity(hash1, hash2);
    //console.log(`Similarity: ${(similarity * 100).toFixed(2)}%`);
    //console.log(`Hash 1: ${hash1}`);
    //console.log(`Hash 2: ${hash2}`);
    //console.log(`Hamming distance: ${hammingDistance(hash1, hash2)}`);
  } else {
    // Deduplicate directory
    const dir = args[0];
    const screenshots = [];

    // Find all PNG files
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      if (file.toLowerCase().endsWith('.png')) {
        screenshots.push({
          name: file,
          path: path.join(dir, file)
        });
      }
    });

    //console.log(`Found ${screenshots.length} screenshots`);

    const result = deduplicateScreenshots(screenshots, {
      similarityThreshold: 0.95,
      minTimeGapMs: 2000
    });

    //console.log(`\nResults:`);
    //console.log(`  Original: ${result.originalCount}`);
    //console.log(`  Unique:   ${result.uniqueCount}`);
    //console.log(`  Filtered: ${result.duplicateCount}`);
  }
}
