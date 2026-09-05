#!/usr/bin/env node

const { getSubflowsForAction } = require('./docs-subflow-registry');
const { resolveElement } = require('./docs-screen-registry');
const { matchTestData } = require('./testdata-matcher');
const path = require('path');
const fs = require('fs');

// ─── Filesystem-based subflow search by filename keywords ────────────────────
let _subflowFileCache = null;

function loadSubflowFiles() {
  if (_subflowFileCache) return _subflowFileCache;
  _subflowFileCache = [];
  const baseDir = path.join(__dirname, '..', '..', '..', '.maestro', 'subflows');
  try {
    (function scan(dir, rel) {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          scan(full, rel ? `${rel}/${entry}` : entry);
        } else if (entry.endsWith('.yaml')) {
          const relPath = `../../subflows/${rel ? rel + '/' : ''}${entry}`;
          const nameWords = entry.replace('.yaml', '').toLowerCase().split(/[-_]/);
          // Include directory path words for matching (e.g. medReminders → med, reminders)
          const dirWords = (rel || '').split(/[/\\-_]/).flatMap(w => {
            // Split camelCase BEFORE lowercasing: medReminders → med reminders
            return w.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/);
          }).filter(w => w.length > 2);
          const allWords = [...new Set([...nameWords, ...dirWords])];
          _subflowFileCache.push({ path: relPath, nameWords: allWords, name: entry.replace('.yaml', '') });
        }
      }
    })(baseDir, '');
  } catch (_) { /* subflows dir may not exist */ }
  return _subflowFileCache;
}

// Synonym map for intent matching — maps common verbs/words to their subflow equivalents
const INTENT_SYNONYMS = {
  show: ['open', 'display', 'visible'],
  display: ['open', 'show', 'visible'],
  open: ['show', 'display'],
  verify: ['validate', 'check', 'confirm'],
  validate: ['verify', 'check', 'confirm'],
  check: ['verify', 'validate'],
  complete: ['finish', 'done', 'completed'],
  setup: ['configure', 'set', 'init'],
  previous: ['prev', 'back'],
  next: ['forward'],
  close: ['dismiss', 'closed'],
  start: ['begin', 'launch'],
  reminder: ['reminders', 'remind'],
  reminders: ['reminder', 'remind'],
};

function expandWithSynonyms(words) {
  const expanded = new Set(words);
  for (const w of words) {
    if (INTENT_SYNONYMS[w]) {
      INTENT_SYNONYMS[w].forEach(syn => expanded.add(syn));
    }
  }
  return Array.from(expanded);
}

function findSubflowByIntent(intentPhrase) {
  const files = loadSubflowFiles();
  const rawWords = intentPhrase.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const words = expandWithSynonyms(rawWords);
  let bestMatch = null;
  let bestScore = 0;
  let bestHasStrongWord = false;

  for (const sf of files) {
    let score = 0;
    let hasStrongWord = false;
    for (const w of words) {
      if (sf.nameWords.some(nw => nw.includes(w) || w.includes(nw))) {
        score++;
        if (w.length >= 5) hasStrongWord = true;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = sf;
      bestHasStrongWord = hasStrongWord;
    }
  }

  // Accept score >= 2 always, or score >= 1 if the matching word is strong (5+ chars)
  if (bestScore >= 2 || (bestScore >= 1 && bestHasStrongWord)) {
    return bestMatch;
  }
  return null;
}

/**
 * Step 1: Interpret and enhance human steps to match CVS flow formats
 * Uses the docs registries to resolve elements and subflows accurately.
 */
async function enhanceHumanSteps(testSteps, functionalArea) {
  const enhancedSteps = [];
  const lines = testSteps.split('\n').filter(line => line.trim());
  const seenActions = new Set();

  for (const line of lines) {
    const cleanLine = line.replace(/^\d+\.\s*/, '').trim();
    if (!cleanLine) continue;
    const enhanced = await enhanceSingleStep(cleanLine, functionalArea);

    for (const step of enhanced) {
      const actionKey = `${step.type}:${step.action}:${step.target}`;
      if (!seenActions.has(actionKey)) {
        seenActions.add(actionKey);
        enhancedSteps.push(step);
      }
    }
  }

  return enhancedSteps;
}

async function enhanceSingleStep(step, functionalArea) {
  const enhanced = [];
  const lower = step.toLowerCase().trim();

  // ─── Launch / Start ───────────────────────────────────────────────
  if (lower.includes('launch') || lower === 'start app' || lower === 'open app' || lower.includes('start the app')) {
    enhanced.push({
      type: 'action',
      action: 'runFlow',
      target: '../../subflows/common/launchApp.yaml',
      description: 'Launch application with clearState'
    });
    return enhanced;
  }

  // ─── Guest flow ───────────────────────────────────────────────────
  if (lower.includes('continue as guest') || lower.includes('guest mode') ||
      (lower.includes('guest') && !lower.includes('verify'))) {
    enhanced.push({
      type: 'action',
      action: 'tapOn',
      target: '${output.account_onboarding.letsGetStartedBtn}',
      description: 'Tap Get Started button'
    });
    enhanced.push({
      type: 'action',
      action: 'tapOn',
      target: '${output.account_signIn.continueAsGuestBtn}',
      description: 'Continue as guest'
    });
    return enhanced;
  }

  // ─── Authentication ───────────────────────────────────────────────
  // Skip if this is a verify/assert step that mentions sign in (e.g. "verify sign in button visible")
  if ((lower.includes('sign in') || lower.includes('signin') || lower.includes('log in') || lower.includes('login'))
      && !lower.includes('verify') && !lower.includes('assert') && !lower.includes('check') && !lower.includes('confirm') && !lower.includes('visible')) {
    if (lower.includes('complete') || lower.includes('full') || lower.includes('with credentials') ||
        lower.includes('with valid') || lower.includes('valid credentials') ||
        !lower.includes('button') && !lower.includes('tap')) {
      // Full sign-in flow via subflow
      enhanced.push({
        type: 'action',
        action: 'tapOn',
        target: '${output.account_onboarding.letsGetStartedBtn}',
        description: 'Tap Get Started button'
      });
      enhanced.push({
        type: 'action',
        action: 'runFlow',
        target: '../../subflows/account/complete_signin_and_otp_dob.yaml',
        description: 'Complete sign in with OTP and DOB'
      });
    } else {
      // Just tap sign in button
      enhanced.push({
        type: 'action',
        action: 'tapOn',
        target: '${output.account_signIn.signInBtn}',
        description: 'Tap Sign In button'
      });
    }
    return enhanced;
  }

  // ─── Logout ───────────────────────────────────────────────────────
  if (lower.includes('logout') || lower.includes('log out') || lower.includes('sign out') || lower.includes('signout')) {
    enhanced.push({
      type: 'action',
      action: 'runFlow',
      target: '../../subflows/account/logout.yaml',
      description: 'Logout from app'
    });
    return enhanced;
  }

  // ─── Onboarding ───────────────────────────────────────────────────
  if (lower.includes('onboarding') || lower.includes('get started') || lower.includes('lets get started')) {
    // "Continue through onboarding as authenticated user" → full sign-in flow
    // (don't confuse "continue through" with tapping the Continue button)
    const isAuthOnboarding = lower.includes('authenticated') || lower.includes('signed in') ||
                             lower.includes('logged in') || lower.includes('loa');
    const isContinueThrough = /continue\s+(through|with|past)\b/.test(lower);

    if (isAuthOnboarding || isContinueThrough) {
      // Full authenticated onboarding = letsGetStarted + sign-in subflow
      enhanced.push({
        type: 'action',
        action: 'tapOn',
        target: '${output.account_onboarding.letsGetStartedBtn}',
        description: 'Tap Get Started button'
      });
      enhanced.push({
        type: 'action',
        action: 'runFlow',
        target: '../../subflows/account/complete_signin_and_otp_dob.yaml',
        description: 'Complete sign in with OTP and DOB'
      });
      return enhanced;
    }

    enhanced.push({
      type: 'action',
      action: 'tapOn',
      target: '${output.account_onboarding.letsGetStartedBtn}',
      description: 'Tap Get Started button'
    });
    // Only tap continue button if explicitly asked (e.g. "tap continue on onboarding")
    // not when "continue" is used as a verb meaning "proceed through"
    if (lower.includes('continue') && !isContinueThrough) {
      enhanced.push({
        type: 'action',
        action: 'tapOn',
        target: '${output.account_onboarding.continueBtn}',
        description: 'Tap Continue button'
      });
    }
    if (lower.includes('maybe later') || lower.includes('skip')) {
      enhanced.push({
        type: 'action',
        action: 'tapOn',
        target: '${output.account_onboarding.maybeLaterBtn}',
        description: 'Tap Maybe Later'
      });
    }
    return enhanced;
  }

  // ─── Homescreen verification ──────────────────────────────────────
  if (lower.includes('verify homescreen') || lower.includes('homescreen loaded') ||
      lower.includes('home screen loaded') || lower.includes('verify home screen')) {
    enhanced.push({
      type: 'action',
      action: 'runFlow',
      target: '../../subflows/Home/homescreen_loaded_successful.yaml',
      description: 'Verify homescreen loaded successfully'
    });
    return enhanced;
  }

  // ─── Splitview tabs ───────────────────────────────────────────────
  if (lower.includes('splitview') || lower.includes('split view')) {
    if (lower.includes('verify') || lower.includes('visible') || lower.includes('check')) {
      enhanced.push({
        type: 'action',
        action: 'assertVisible',
        target: '${output.homescreen_splitview.tab_shop}',
        description: 'Verify Shop tab visible'
      });
      enhanced.push({
        type: 'action',
        action: 'assertVisible',
        target: '${output.homescreen_splitview.tab_health_and_pharmacy}',
        description: 'Verify Health & Pharmacy tab visible'
      });
    } else if (lower.includes('shop')) {
      enhanced.push({
        type: 'action',
        action: 'tapOn',
        target: '${output.homescreen_splitview.tab_shop}',
        description: 'Switch to Shop tab'
      });
    } else if (lower.includes('health')) {
      enhanced.push({
        type: 'action',
        action: 'tapOn',
        target: '${output.homescreen_splitview.tab_health_and_pharmacy}',
        description: 'Switch to Health & Pharmacy tab'
      });
    }
    return enhanced;
  }

  // ─── Activity zone / ANBA ─────────────────────────────────────────
  if (lower.includes('activity zone') || lower.includes('activity') && lower.includes('verify')) {
    enhanced.push({
      type: 'action',
      action: 'assertVisible',
      target: '${output.homescreen_activity.activityHeader}',
      description: 'Verify activity zone header visible'
    });
    return enhanced;
  }

  // ─── Discovery zone / DNBA ────────────────────────────────────────
  if (lower.includes('discovery') || lower.includes('discover')) {
    if (lower.includes('verify') || lower.includes('loaded') || lower.includes('visible')) {
      enhanced.push({
        type: 'action',
        action: 'assertVisible',
        target: '${output.homescreen_discover.discoverHeader}',
        description: 'Verify discovery zone header visible'
      });
    }
    return enhanced;
  }

  // ─── Prescription status ANBAs ────────────────────────────────────
  if (lower.includes('prescription') || lower.includes('rx')) {
    if (lower.includes('not filled')) {
      enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.homescreen_activity.anba_notFilled}', description: 'Verify not filled prescription card' });
    } else if (lower.includes('delayed')) {
      enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.homescreen_activity.anba_delayed}', description: 'Verify delayed prescription card' });
    } else if (lower.includes('ready for pickup') || lower.includes('pickup')) {
      enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.homescreen_activity.anba_readyForPickup}', description: 'Verify ready for pickup card' });
    } else if (lower.includes('ready')) {
      enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.homescreen_activity.anba_ready}', description: 'Verify ready prescription card' });
    } else if (lower.includes('refill')) {
      enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.homescreen_activity.anba_availableForRefill}', description: 'Verify available for refill card' });
    } else if (lower.includes('renewal') || lower.includes('renew')) {
      enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.homescreen_activity.anba_availableForRenewal}', description: 'Verify available for renewal card' });
    } else if (lower.includes('working on it')) {
      enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.homescreen_activity.anba_wereWorkingOnIt}', description: 'Verify working on it card' });
    } else if (lower.includes('view') || lower.includes('all')) {
      enhanced.push({ type: 'action', action: 'tapOn', target: '${output.homescreen_pharmacy.viewAllPrescriptions}', description: 'Tap view all prescriptions' });
    }
    if (enhanced.length > 0) return enhanced;
  }

  // ─── Bottom navigation ────────────────────────────────────────────
  if (lower.includes('bottom nav') || lower.includes('nav bar') || lower.includes('tab bar') ||
      lower.includes('navigation bar') || (lower.includes('verify') && lower.includes('navigation'))) {
    enhanced.push({
      type: 'action',
      action: 'runFlow',
      target: '../../subflows/searchNav/bottom_nav_loaded.yaml',
      description: 'Verify bottom navigation bar loaded'
    });
    return enhanced;
  }

  // ─── Tab navigation (navigate to X) ──────────────────────────────
  if (lower.includes('navigate to') || lower.includes('go to') || lower.includes('switch to') || lower.includes('open')) {
    const tabMap = {
      home: { target: '${output.searchNav_bottomNav.homeTab}', desc: 'Navigate to Home tab' },
      shop: { target: '${output.searchNav_bottomNav.shopTab}', desc: 'Navigate to Shop tab' },
      health: { target: '${output.searchNav_bottomNav.healthTab}', desc: 'Navigate to Health tab' },
      account: { target: '${output.searchNav_bottomNav.accountTab}', desc: 'Navigate to Account tab' },
      more: { target: '${output.searchNav_bottomNav.moreTab}', desc: 'Navigate to More tab' },
      benefits: { target: '${output.benefits_navigation.benefitsTab}', desc: 'Navigate to Benefits tab' },
      pharmacy: { target: '${output.searchNav_bottomNav.pharmacyTab}', desc: 'Navigate to Pharmacy tab' },
      search: { target: '${output.searchNav_search.searchField}', desc: 'Open search' }
    };

    for (const [tabName, tabInfo] of Object.entries(tabMap)) {
      if (lower.includes(tabName)) {
        enhanced.push({
          type: 'action',
          action: 'tapOn',
          target: tabInfo.target,
          description: tabInfo.desc
        });
        return enhanced;
      }
    }
  }

  // ─── Benefits ─────────────────────────────────────────────────────
  if (lower.includes('benefits loaded') || lower.includes('verify benefits')) {
    enhanced.push({
      type: 'action',
      action: 'runFlow',
      target: '../../subflows/benefits/benefits_loaded_successful.yaml',
      description: 'Verify benefits screen loaded'
    });
    return enhanced;
  }
  if (lower.includes('plan summary') || lower.includes('plan details')) {
    if (lower.includes('verify') || lower.includes('visible') || lower.includes('displayed')) {
      enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.benefits_landing.planSummaryLabel}', description: 'Verify plan summary visible' });
    } else {
      enhanced.push({ type: 'action', action: 'tapOn', target: '${output.benefits_landing.planSummaryLabel}', description: 'Tap plan summary' });
    }
    return enhanced;
  }
  if (lower.includes('deductible')) {
    enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.benefits_landing.deductible}', description: 'Verify deductible visible' });
    return enhanced;
  }
  if (lower.includes('out of pocket')) {
    enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.benefits_landing.outOfPocketMax}', description: 'Verify out of pocket max visible' });
    return enhanced;
  }
  if (lower.includes('id card') || lower.includes('member id')) {
    if (lower.includes('verify') || lower.includes('visible')) {
      enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.benefits_landing.memberIdBtn}', description: 'Verify member ID button visible' });
    } else {
      enhanced.push({ type: 'action', action: 'tapOn', target: '${output.benefits_landing.memberIdBtn}', description: 'Tap member ID button' });
    }
    return enhanced;
  }
  if (lower.includes('claims')) {
    enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.benefits_claims.claimsHeader}', description: 'Verify claims header visible' });
    return enhanced;
  }

  // ─── Multi-component check/verify (e.g. "Check X - A, B, C") ──────
  // Must be before Search handler so "Check header - ..., search bar, ..." doesn't get caught by search
  if ((lower.includes('check') || lower.includes('verify') || lower.includes('confirm') || lower.includes('assert'))
      && (step.includes(' - ') || step.includes(': '))) {
    const splitChar = step.includes(' - ') ? ' - ' : ': ';
    const parts = step.split(splitChar);
    if (parts.length >= 2) {
      const componentList = parts.slice(1).join(splitChar);
      const components = componentList
        .split(/,|\/|\band\b/)
        .map(c => c.replace(/\b(displayed|visible|loaded|present|shown|is|are)\b/gi, '').trim())
        .filter(c => c.length > 0);

      if (components.length > 1) {
        // Only consider a subflow if there are very few components (2) AND the
        // subflow confidence is very high — otherwise the user is enumerating
        // individual items they want verified one by one
        if (components.length <= 2) {
          const subflowMatch = getSubflowsForAction(step);
          if (subflowMatch.bestMatch && subflowMatch.confidence >= 75) {
            enhanced.push({
              type: 'action',
              action: 'runFlow',
              target: subflowMatch.bestMatch.path,
              description: subflowMatch.bestMatch.description
            });
            return enhanced;
          }
        }

        // Extract context from the description part (e.g. "header components")
        const contextPart = parts[0].toLowerCase();
        const contextHint = contextPart.includes('header') ? 'header' :
                           contextPart.includes('bottom') || contextPart.includes('nav bar') || contextPart.includes('tab bar') ? 'bottomNav' :
                           null;

        // Generate individual assertVisible for each component
        for (const comp of components) {
          const resolved = await resolveElement(comp, functionalArea, contextHint);
          if (resolved && resolved.confidence >= 40) {
            enhanced.push({
              type: 'action',
              action: 'assertVisible',
              target: resolved.path,
              description: `Verify ${comp} is visible`
            });
          } else {
            enhanced.push({
              type: 'action',
              action: 'assertVisible',
              target: `"${comp}"`,
              description: `Verify ${comp} is visible`
            });
          }
        }
        return enhanced;
      }
    }
  }

  // ─── Search results verification (without "search" keyword) ────────
  if ((lower.includes('results') || lower.includes('result')) && (lower.includes('verify') || lower.includes('visible') || lower.includes('displayed') || lower.includes('check'))) {
    enhanced.push({
      type: 'action',
      action: 'assertVisible',
      target: '${output.searchNav_results.resultCard}',
      description: 'Verify search results visible'
    });
    return enhanced;
  }

  // ─── Search ───────────────────────────────────────────────────────
  if (lower.includes('search') && !lower.includes('navigate')) {
    if (lower.includes('tap') || lower.includes('open') || lower.includes('bar')) {
      enhanced.push({
        type: 'action',
        action: 'tapOn',
        target: '${output.searchNav_search.searchField}',
        description: 'Tap search field'
      });
    }
    // Extract search term: "search for X" or "type X" patterns
    const searchTermMatch = step.match(/(?:search\s+for|type|enter|input)\s+["']?([^"'\n]+)["']?/i);
    if (searchTermMatch) {
      const term = searchTermMatch[1].trim();
      if (!lower.includes('tap')) {
        enhanced.push({
          type: 'action',
          action: 'tapOn',
          target: '${output.searchNav_search.searchField}',
          description: 'Tap search field'
        });
      }
      enhanced.push({
        type: 'action',
        action: 'inputText',
        target: `"${term}"`,
        value: term,
        description: `Type "${term}" in search`
      });
    }
    if (lower.includes('results') || lower.includes('verify')) {
      enhanced.push({
        type: 'action',
        action: 'assertVisible',
        target: '${output.searchNav_results.resultCard}',
        description: 'Verify search results visible'
      });
    }
    if (enhanced.length > 0) return enhanced;
  }

  // ─── Typing / Input ───────────────────────────────────────────────
  if (lower.includes('type') || lower.includes('enter') || lower.includes('input')) {
    const textMatch = step.match(/(?:type|enter|input)\s+["']?([^"'\n]+)["']?/i);
    if (textMatch) {
      const text = textMatch[1].trim();
      enhanced.push({
        type: 'action',
        action: 'inputText',
        target: `"${text}"`,
        value: text,
        description: `Input text: "${text}"`
      });
      return enhanced;
    }
  }

  // ─── Scroll until visible ─────────────────────────────────────────
  const scrollUntilMatch = step.match(/scroll\s+(?:down\s+)?(?:to|until|till)\s+(.+?)(?:\s+(?:is\s+)?(?:visible|displayed|found))?$/i);
  if (scrollUntilMatch) {
    const element = scrollUntilMatch[1].trim();
    const resolved = await resolveElement(element, functionalArea);
    if (resolved && resolved.confidence >= 40) {
      enhanced.push({ type: 'action', action: 'scrollUntilVisible', target: resolved.path, description: `Scroll until ${element} is visible` });
    } else {
      enhanced.push({ type: 'action', action: 'scrollUntilVisible', target: `"${element}"`, description: `Scroll until ${element} is visible` });
    }
    return enhanced;
  }

  // ─── Conditional flow: "if X is visible" ───────────────────────────
  const conditionalMatch = step.match(/if\s+(.+?)\s+(?:is\s+)?(?:visible|displayed|present|shown)\s*,?\s*(?:then\s+)?(?:tap|click|press)\s+(?:on\s+)?(?:it|that|(.+?))?$/i);
  if (conditionalMatch) {
    const condElement = conditionalMatch[1].trim();
    const tapTarget = conditionalMatch[2] ? conditionalMatch[2].trim() : condElement;
    const resolvedCond = await resolveElement(condElement, functionalArea);
    const resolvedTap = await resolveElement(tapTarget, functionalArea);
    const condPath = (resolvedCond && resolvedCond.confidence >= 40) ? resolvedCond.path : `"${condElement}"`;
    const tapPath = (resolvedTap && resolvedTap.confidence >= 40) ? resolvedTap.path : `"${tapTarget}"`;
    enhanced.push({
      type: 'action',
      action: 'conditionalFlow',
      condition: condPath,
      commands: [`tapOn: ${tapPath}`],
      target: condPath,
      description: `If ${condElement} is visible, tap ${tapTarget}`
    });
    return enhanced;
  }

  // ─── Scrolling / Swiping ──────────────────────────────────────────
  if (lower.includes('scroll down') || lower.includes('swipe up')) {
    enhanced.push({ type: 'action', action: 'scroll', target: '', description: 'Scroll down' });
    return enhanced;
  }
  if (lower.includes('scroll up') || lower.includes('swipe down')) {
    enhanced.push({ type: 'action', action: 'swipe', target: '"down"', description: 'Swipe down (scroll up)' });
    return enhanced;
  }
  if (lower.includes('pull to refresh') || lower.includes('refresh')) {
    enhanced.push({ type: 'action', action: 'swipe', target: '"down"', description: 'Pull to refresh' });
    return enhanced;
  }

  // ─── Wait ─────────────────────────────────────────────────────────
  if (lower.includes('wait')) {
    const secondsMatch = lower.match(/wait\s+(?:for\s+)?(\d+)\s*(?:seconds?|s)/);
    if (secondsMatch) {
      const ms = parseInt(secondsMatch[1]) * 1000;
      enhanced.push({ type: 'action', action: 'wait', target: `${ms}`, description: `Wait ${secondsMatch[1]} seconds` });
      return enhanced;
    }
    // "wait for X" → extendedWaitUntil
    const waitForMatch = step.match(/wait\s+for\s+(.+)/i);
    if (waitForMatch) {
      const element = waitForMatch[1].trim();
      const resolved = await resolveElement(element, functionalArea);
      if (resolved && resolved.confidence >= 40) {
        enhanced.push({
          type: 'action',
          action: 'extendedWaitUntil',
          target: resolved.path,
          description: `Wait until ${element} is visible`
        });
      } else {
        enhanced.push({
          type: 'action',
          action: 'extendedWaitUntil',
          target: `"${element}"`,
          description: `Wait until ${element} is visible`
        });
      }
      return enhanced;
    }
    // Default wait
    enhanced.push({ type: 'action', action: 'wait', target: '3000', description: 'Wait 3 seconds' });
    return enhanced;
  }

  // ─── Go back ──────────────────────────────────────────────────────
  if (lower === 'go back' || lower === 'back' || lower.includes('navigate back') || lower.includes('press back')) {
    enhanced.push({ type: 'action', action: 'back', target: '', description: 'Navigate back' });
    return enhanced;
  }

  // ─── Hide keyboard ────────────────────────────────────────────────
  if (lower.includes('hide keyboard') || lower.includes('dismiss keyboard')) {
    enhanced.push({ type: 'action', action: 'hideKeyboard', target: '', description: 'Hide keyboard' });
    return enhanced;
  }

  // ─── Take screenshot ──────────────────────────────────────────────
  if (lower.includes('screenshot') || lower.includes('capture')) {
    enhanced.push({ type: 'action', action: 'takeScreenshot', target: '"screenshot"', description: 'Take screenshot' });
    return enhanced;
  }

  // ─── Error / network patterns ─────────────────────────────────────
  if (lower.includes('disable network') || lower.includes('disconnect') || lower.includes('airplane mode')) {
    enhanced.push({
      type: 'action',
      action: 'runFlow',
      target: '../../subflows/common/disable_network.yaml',
      description: 'Disable network'
    });
    return enhanced;
  }
  if (lower.includes('enable network') || lower.includes('reconnect')) {
    enhanced.push({
      type: 'action',
      action: 'runFlow',
      target: '../../subflows/common/enable_network.yaml',
      description: 'Enable network'
    });
    return enhanced;
  }

  // ─── Sign in button visible (verify) ──────────────────────────────
  if (lower.includes('sign in button') && (lower.includes('verify') || lower.includes('visible'))) {
    enhanced.push({
      type: 'action',
      action: 'assertVisible',
      target: '${output.searchnav_header.signInBtn}',
      description: 'Verify sign in button is visible'
    });
    return enhanced;
  }

  // ─── Account dashboard ────────────────────────────────────────────
  if (lower.includes('account dashboard') || lower.includes('account page')) {
    if (lower.includes('verify') || lower.includes('visible') || lower.includes('check')) {
      enhanced.push({
        type: 'action',
        action: 'extendedWaitUntil',
        target: '${output.account_dashboard.accountNavTitle}',
        description: 'Verify account dashboard loaded',
        timeout: 8000
      });
    } else {
      enhanced.push({
        type: 'action',
        action: 'tapOn',
        target: '${output.searchNav_bottomNav.accountTab}',
        description: 'Navigate to account'
      });
    }
    return enhanced;
  }

  // ─── ExtraCare / Rewards ──────────────────────────────────────────
  if (lower.includes('extracare') || lower.includes('rewards') || lower.includes('savings')) {
    if (lower.includes('verify') || lower.includes('visible')) {
      enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.homescreen_extracare.savingsAndRewardsHeader}', description: 'Verify savings & rewards visible' });
    }
    return enhanced;
  }

  // ─── Health services ──────────────────────────────────────────────
  if (lower.includes('health services') || lower.includes('care options') || lower.includes('flu shot')) {
    if (lower.includes('verify') || lower.includes('visible')) {
      enhanced.push({ type: 'action', action: 'assertVisible', target: '${output.homescreen_healthServices.healthServices}', description: 'Verify health services visible' });
    } else if (lower.includes('schedule') || lower.includes('flu')) {
      enhanced.push({ type: 'action', action: 'tapOn', target: '${output.homescreen_healthServices.scheduleFluShot}', description: 'Tap schedule flu shot' });
    } else if (lower.includes('explore') || lower.includes('care')) {
      enhanced.push({ type: 'action', action: 'tapOn', target: '${output.homescreen_healthServices.exploreCareOptions}', description: 'Tap explore care options' });
    }
    if (enhanced.length > 0) return enhanced;
  }

  // ─── "check navigation of X" → tapOn ────────────────────────────
  const navCheckMatch = step.match(/check\s+(?:the\s+)?navigation\s+(?:of|to)\s+(.+)/i);
  if (navCheckMatch) {
    const elementDesc = navCheckMatch[1].trim();
    const resolved = await resolveElement(elementDesc, functionalArea);
    if (resolved && resolved.confidence >= 40) {
      enhanced.push({ type: 'action', action: 'tapOn', target: resolved.path, description: `Tap on ${elementDesc} (check navigation)` });
    } else {
      enhanced.push({ type: 'action', action: 'tapOn', target: `"${elementDesc}"`, description: `Tap on ${elementDesc} (check navigation)` });
    }
    return enhanced;
  }

  // ─── Generic tap/click ────────────────────────────────────────────
  if (lower.includes('tap') || lower.includes('click') || lower.includes('press')) {
    // First try to extract a quoted element: tap "Previous" button to show...
    const quotedTapMatch = step.match(/(?:tap|click|press)\s+(?:on\s+)?(?:the\s+)?["']([^"']+)["']/i);
    if (quotedTapMatch) {
      const elementDesc = quotedTapMatch[1].trim();
      const resolved = await resolveElement(elementDesc, functionalArea);
      if (resolved && resolved.confidence >= 40) {
        enhanced.push({ type: 'action', action: 'tapOn', target: resolved.path, description: `Tap on ${elementDesc}` });
      } else {
        enhanced.push({ type: 'action', action: 'tapOn', target: `"${elementDesc}"`, description: `Tap on ${elementDesc}` });
      }

      // Check for "to show/verify/validate..." trailing intent → subflow match
      const trailingIntent = step.match(/["']\s+(?:button\s+)?(?:to\s+)?(show|verify|validate|check|see|open|display)\s+(.+?)["']?$/i);
      if (trailingIntent) {
        const intentVerb = trailingIntent[1].trim();
        const intentObject = trailingIntent[2].trim();
        const sfMatch = findSubflowByIntent(`${intentVerb} ${intentObject}`);
        if (sfMatch) {
          enhanced.push({ type: 'action', action: 'runFlow', target: sfMatch.path, description: `Validate: ${intentObject}` });
        }
      }

      return enhanced;
    }

    // Fallback: unquoted element with optional trailing intent
    const elementMatch = step.match(/(?:tap|click|press)\s+(?:on\s+)?(?:the\s+)?(.+?)(?:\s+(?:button|link|tab|icon))?(?:\s+(?:to\s+)(show|verify|validate|check|see|open|display)\s+(.+?))?$/i);
    if (elementMatch) {
      const elementDesc = elementMatch[1].trim().replace(/["']$/g, '');
      const resolved = await resolveElement(elementDesc, functionalArea);
      if (resolved && resolved.confidence >= 40) {
        enhanced.push({ type: 'action', action: 'tapOn', target: resolved.path, description: `Tap on ${elementDesc}` });
      } else {
        enhanced.push({ type: 'action', action: 'tapOn', target: `"${elementDesc}"`, description: `Tap on ${elementDesc}` });
      }

      // If trailing intent captured, try subflow match (include verb for synonym matching)
      if (elementMatch[3]) {
        const intentVerb = elementMatch[2] ? elementMatch[2].trim() : '';
        const intentObject = elementMatch[3].trim();
        const sfMatch = findSubflowByIntent(`${intentVerb} ${intentObject}`);
        if (sfMatch) {
          enhanced.push({ type: 'action', action: 'runFlow', target: sfMatch.path, description: `Validate: ${intentObject}` });
        }
      }

      return enhanced;
    }
  }

  // ─── Quoted multi-element: '"Next" and "Previous" buttons display' ────
  const quotedMultiMatch = step.match(/(?:verify|assert|check|confirm|validate)?\s*["']([^"']+)["']\s+and\s+["']([^"']+)["']\s*(?:buttons?|elements?|items?|sections?)?\s*(?:display|visible|displayed|shown|present|loaded)?/i);
  if (quotedMultiMatch) {
    const elements = [quotedMultiMatch[1].trim(), quotedMultiMatch[2].trim()];
    for (const el of elements) {
      const resolved = await resolveElement(el, functionalArea);
      if (resolved && resolved.confidence >= 40) {
        enhanced.push({ type: 'action', action: 'assertVisible', target: resolved.path, description: `Verify ${el} is visible` });
      } else {
        enhanced.push({ type: 'action', action: 'assertVisible', target: `"${el}"`, description: `Verify ${el} is visible` });
      }
    }
    return enhanced;
  }

  // ─── Generic verify/assert/check ──────────────────────────────────
  if (lower.includes('verify') || lower.includes('assert') || lower.includes('check') || lower.includes('confirm') || lower.includes('validate') || lower.includes('display')) {
    // ─── "Verify no X or Y is displayed" → multi-element assertNotVisible ─────
    // Pattern: "verify no "Next" or "Previous" button is displayed"
    // Also handles: "verify in Med reminders no "Next" or "Previous" button is displayed"
    const noMultiQuotedMatch = step.match(/(?:verify|assert|check|confirm|validate)\s+(?:that\s+)?(?:in\s+.+?\s+)?no\s+["']([^"']+)["']\s+(?:or|and)\s*["']([^"']+)["']\s*(?:buttons?|elements?|items?)?\s*(?:is\s+|are\s+)?(?:displayed|visible|present|shown)?/i);
    if (noMultiQuotedMatch) {
      const elements = [noMultiQuotedMatch[1].trim(), noMultiQuotedMatch[2].trim()];
      for (const el of elements) {
        enhanced.push({ type: 'action', action: 'assertNotVisible', target: `"${el}"`, description: `Verify ${el} is NOT visible` });
      }
      return enhanced;
    }

    // ─── State verification → subflow matching ─────────────────────────────
    // Pattern: "Verify Med reminders complete state is displayed"
    // → look for subflow: validate_complete_state.yaml in medReminders folder
    const stateVerifyMatch = step.match(/(?:verify|assert|check|confirm|validate)\s+(?:that\s+)?(.+?)\s+(open|complete|setup|closed|initial|loaded|empty|error)\s+state\s+(?:is\s+)?(?:displayed|visible|shown|present)/i);
    if (stateVerifyMatch) {
      const contextPhrase = stateVerifyMatch[1].trim().toLowerCase();  // e.g. "Med reminders"
      const stateName = stateVerifyMatch[2].trim().toLowerCase();      // e.g. "complete"
      // Search for a subflow with validate_{state}_state pattern
      const sfMatch = findSubflowByIntent(`validate ${stateName} state ${contextPhrase}`);
      if (sfMatch) {
        enhanced.push({
          type: 'action',
          action: 'runFlow',
          target: sfMatch.path,
          description: `Validate ${contextPhrase} ${stateName} state`
        });
        return enhanced;
      }
    }

    // "verify X is not visible"
    if (lower.includes('not visible') || lower.includes('not displayed') || lower.includes('not present') || lower.includes('hidden')) {
      const elementMatch = step.match(/(?:verify|assert|check|confirm|validate)\s+(?:that\s+)?["']?(.+?)["']?\s+(?:is\s+)?(?:not|isn't)/i);
      if (elementMatch) {
        const elementDesc = elementMatch[1].trim();
        const resolved = await resolveElement(elementDesc, functionalArea);
        if (resolved && resolved.confidence >= 40) {
          enhanced.push({ type: 'action', action: 'assertNotVisible', target: resolved.path, description: `Verify ${elementDesc} is NOT visible` });
        } else {
          enhanced.push({ type: 'action', action: 'assertNotVisible', target: `"${elementDesc}"`, description: `Verify ${elementDesc} is NOT visible` });
        }
        return enhanced;
      }
    }

    // Split multi-element verify: "verify X, Y, Z are visible" or "verify X, Y, and Z"
    const multiVerifyMatch = step.match(/(?:verify|assert|check|confirm|validate)\s+(?:that\s+)?(.+?)\s+(?:are|is)\s+(?:visible|displayed|present|shown|loaded)/i);
    if (multiVerifyMatch) {
      const elementsStr = multiVerifyMatch[1].trim();
      // Split on comma, " and ", " & "
      const elements = elementsStr.split(/\s*(?:,\s*(?:and\s+)?|(?:\s+and\s+)|\s*&\s*)\s*/).filter(e => e.trim());
      if (elements.length > 1) {
        for (const el of elements) {
          const elTrimmed = el.trim().replace(/^["']|["']$/g, '');
          if (!elTrimmed) continue;
          const resolved = await resolveElement(elTrimmed, functionalArea);
          if (resolved && resolved.confidence >= 40) {
            enhanced.push({ type: 'action', action: 'assertVisible', target: resolved.path, description: `Verify ${elTrimmed} is visible` });
          } else {
            enhanced.push({ type: 'action', action: 'assertVisible', target: `"${elTrimmed}"`, description: `Verify ${elTrimmed} is visible` });
          }
        }
        return enhanced;
      }
    }

    // "verify X" / "verify X is visible" / "verify X is displayed"
    const elementMatch = step.match(/(?:verify|assert|check|confirm|validate)\s+(?:that\s+)?["']?(.+?)["']?\s*(?:is\s+(?:visible|displayed|present|loaded|shown))?$/i);
    if (elementMatch) {
      const elementDesc = elementMatch[1].trim();
      const resolved = await resolveElement(elementDesc, functionalArea);
      if (resolved && resolved.confidence >= 40) {
        enhanced.push({ type: 'action', action: 'assertVisible', target: resolved.path, description: `Verify ${elementDesc} is visible` });
      } else {
        enhanced.push({ type: 'action', action: 'assertVisible', target: `"${elementDesc}"`, description: `Verify ${elementDesc} is visible` });
      }
      return enhanced;
    }
  }

  // ─── Subflow lookup fallback ──────────────────────────────────────
  const subflowMatch = getSubflowsForAction(step);
  if (subflowMatch.bestMatch && subflowMatch.confidence >= 40) {
    enhanced.push({
      type: 'action',
      action: 'runFlow',
      target: subflowMatch.bestMatch.path,
      description: subflowMatch.bestMatch.description
    });
    return enhanced;
  }

  // ─── Screen object resolution fallback ────────────────────────────
  const resolved = await resolveElement(step, functionalArea);
  if (resolved && resolved.confidence >= 50) {
    // Determine if this is likely a tap or assert
    if (lower.includes('visible') || lower.includes('displayed') || lower.includes('present')) {
      enhanced.push({ type: 'action', action: 'assertVisible', target: resolved.path, description: `Verify ${step}` });
    } else {
      enhanced.push({ type: 'action', action: 'tapOn', target: resolved.path, description: `Tap on ${step}` });
    }
    return enhanced;
  }

  // ─── Absolute last resort — use text selector ─────────────────────
  enhanced.push({
    type: 'action',
    action: 'tapOn',
    target: `"${step}"`,
    description: `Tap on "${step}"`
  });
  return enhanced;
}

/**
 * Detect test data (email + DOB) from test steps or notes
 * Returns the loginData key (e.g., HAYES_LUCAS, LOA2) to use in runScript
 */
function detectTestData(testSteps, notes) {
  const combinedInput = `${testSteps || ''}\n${notes || ''}`;
  
  const match = matchTestData(combinedInput);
  
  if (match) {
    return {
      detected: true,
      userKey: match.userKey,
      email: match.email,
      dob: match.dob,
      matchType: match.matchType
    };
  }
  
  return {
    detected: false,
    userKey: 'LOA2', // Default
    email: null,
    dob: null,
    matchType: 'default'
  };
}

module.exports = { enhanceHumanSteps, enhanceSingleStep, detectTestData };

// CLI usage
if (require.main === module) {
  const testSteps = process.argv[2] || '1. Launch app\n2. Sign in\n3. Verify homescreen loaded';
  const functionalArea = process.argv[3] || 'Home';

  enhanceHumanSteps(testSteps, functionalArea)
    .then(steps => {
      console.log('\n=== Enhanced Steps ===\n');
      steps.forEach((s, i) => {
        console.log(`${i + 1}. [${s.action}] ${s.target} — ${s.description}`);
      });
    })
    .catch(console.error);
}
