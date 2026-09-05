'use strict';

/**
 * Static suite -> Zephyr Scale TEST_CYCLE folderId mapping.
 *
 * Zephyr's createTestCycle API silently ignores a path-string `folder`
 * field — it only accepts a numeric `folderId`. Folder structure in the
 * TLPCWHSAM project is fixed and known ahead of time, so rather than
 * building UI to pick a folder on every run, we just look it up here by
 * suite filename.
 *
 * IDs verified via: GET /folders?projectKey=TLPCWHSAM&folderType=TEST_CYCLE
 *
 * Suites not listed here have no confirmed matching folder yet and fall
 * back to no folderId (created at the project root) rather than guessing
 * an incorrect one.
 */
const path = require('path');

const CYCLE_FOLDER_BY_SUITE = {
  'homescreen-complete-suite.yaml': 41724791,               // Homescreen / H100 Regression
  'home_screen_menu_screens_complete_suite.yaml': 41724791, // Homescreen / H100 Regression
  'home-regression.yaml': 41723758,                         // Homescreen / CVS Retail Regression
  'searchandnav-regression.yaml': 41725753,                 // Search and Navigation / CVS Retail Regression
  'h100_smoke.yaml': 53068393,                              // Smoke / H100 Core
  'smoke.yaml': 53068492                                    // Smoke / CVS Core
};

function resolveFolderId(suiteFilePath) {
  return CYCLE_FOLDER_BY_SUITE[path.basename(suiteFilePath)] || null;
}

module.exports = { resolveFolderId, CYCLE_FOLDER_BY_SUITE };
