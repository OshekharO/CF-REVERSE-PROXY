const fs = require('fs');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const config = {
  replace_dict: {
    'literotica.com': 'goindex.eu.org',
    'Premium': ''
  }
};

// Original implementation
function applyReplaceDictOriginal(text) {
  let result = text;
  for (const [key, value] of Object.entries(config.replace_dict)) {
    const re = new RegExp(escapeRegExp(key), 'gi');
    result = result.replace(re, value);
  }
  return result;
}

// Pre-compiled implementation
const compiledReplaceDictRules = Object.entries(config.replace_dict).map(([key, value]) => ({
  re: new RegExp(escapeRegExp(key), 'gi'),
  value
}));

function applyReplaceDictOptimized(text) {
  let result = text;
  for (let i = 0; i < compiledReplaceDictRules.length; i++) {
    result = result.replace(compiledReplaceDictRules[i].re, compiledReplaceDictRules[i].value);
  }
  return result;
}

const sampleHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Literotica.com - Premium Stories</title>
</head>
<body>
    <h1>Welcome to literotica.com</h1>
    <p>Enjoy our Premium adult fiction and stories on literotica.com!</p>
    <a href="https://literotica.com/stories">Read Premium Stories</a>
    <footer>Copyright literotica.com Premium Services</footer>
</body>
</html>
`.repeat(20);

// Correctness check
const resOrig = applyReplaceDictOriginal(sampleHtml);
const resOpt = applyReplaceDictOptimized(sampleHtml);
if (resOrig !== resOpt) {
  console.error("MISMATCH ERROR!");
  process.exit(1);
}

const ITERATIONS = 100000;

console.log(`Running benchmark (${ITERATIONS} iterations)...`);

// Warmup
for (let i = 0; i < 10000; i++) {
  applyReplaceDictOriginal(sampleHtml);
  applyReplaceDictOptimized(sampleHtml);
}

const startOrig = process.hrtime.bigint();
for (let i = 0; i < ITERATIONS; i++) {
  applyReplaceDictOriginal(sampleHtml);
}
const endOrig = process.hrtime.bigint();
const timeOrigMs = Number(endOrig - startOrig) / 1e6;

const startOpt = process.hrtime.bigint();
for (let i = 0; i < ITERATIONS; i++) {
  applyReplaceDictOptimized(sampleHtml);
}
const endOpt = process.hrtime.bigint();
const timeOptMs = Number(endOpt - startOpt) / 1e6;

console.log(`Original execution time: ${timeOrigMs.toFixed(2)} ms`);
console.log(`Optimized execution time: ${timeOptMs.toFixed(2)} ms`);
console.log(`Speedup: ${(timeOrigMs / timeOptMs).toFixed(2)}x`);
console.log(`Time saved: ${(timeOrigMs - timeOptMs).toFixed(2)} ms (${(((timeOrigMs - timeOptMs) / timeOrigMs) * 100).toFixed(1)}% reduction)`);
