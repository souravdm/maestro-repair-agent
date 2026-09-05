// Adhoc monkey-tester: picks a weighted random action each iteration.
// Weights can be overridden by passing TAP_WEIGHT / SWIPE_WEIGHT / BACK_WEIGHT
// as Maestro env vars (integers, must sum to a positive number).
var env = maestro.env || {};
var TAP_WEIGHT   = parseInt(env.TAP_WEIGHT)   || 80;
var SWIPE_WEIGHT = parseInt(env.SWIPE_WEIGHT) || 15;
var BACK_WEIGHT  = parseInt(env.BACK_WEIGHT)  || 5;

var total = TAP_WEIGHT + SWIPE_WEIGHT + BACK_WEIGHT;
var rand  = Math.floor(Math.random() * total);

var action;
if (rand < TAP_WEIGHT) {
    action = 'TAP';
} else if (rand < TAP_WEIGHT + SWIPE_WEIGHT) {
    action = 'SWIPE';
} else {
    action = 'BACK';
}

// Random element index for TAP – taps the Nth visible text element (0-based).
// Upper bound of 19 covers most screens; optional:true in the flow silently
// skips iterations where the index exceeds the real element count.
var tapIndex = Math.floor(Math.random() * 20);

// Swipe direction: weighted towards vertical scrolling (more natural for apps)
var swipeRand = Math.floor(Math.random() * 100);
var swipeDirection = '';
if (swipeRand < 45) {
    swipeDirection = 'UP';
} else if (swipeRand < 90) {
    swipeDirection = 'DOWN';
} else if (swipeRand < 95) {
    swipeDirection = 'LEFT';
} else {
    swipeDirection = 'RIGHT';
}

output.adhoc = {
    action:         action,
    tapIndex:       tapIndex,
    swipeDirection: swipeDirection
};
