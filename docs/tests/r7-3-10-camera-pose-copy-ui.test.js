import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('Home_Studio.html', 'utf8');
const css = fs.readFileSync('css/default.css', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');

assert.match(html, /id="copyCameraPoseInfo"/);
assert.match(html, />複製視角 INFO</);
assert.match(css, /#copyCameraPoseInfo/);
assert.match(css, /#copyCameraPoseInfo\.copied/);
assert.match(initCommon, /cameraPoseCopyButtonElement\s*=\s*document\.getElementById\('copyCameraPoseInfo'\)/);
assert.match(homeStudio, /function copyR7310CameraPoseInfoToClipboard/);
assert.match(homeStudio, /navigator\.clipboard\.writeText/);
assert.match(homeStudio, /cameraPoseInfoLastCopyText\s*=\s*report\.copyText/);
assert.match(homeStudio, /copyCameraPoseInfo/);
assert.match(homeStudio, /已複製/);
assert.match(runner, /copyButtonShowsCopied/);
assert.match(runner, /copiedTextMatchesElement/);
assert.match(runner, /'cameraPoseInfo',\s*'copyCameraPoseInfo'/);
