#!/usr/bin/env node

console.error([
  'R7-3.10 iron door reflection probe packages must be produced by Home Studio runtime scene capture.',
  'Use:',
  '  node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-iron-door-reflection-probe-capture --browser=chrome --angle=metal --atlas-resolution=1024',
  '',
  'This helper no longer writes mountable probe data.'
].join('\n'));
process.exitCode = 1;
