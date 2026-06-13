#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');

const tool = fs.readFileSync('docs/tools/r7-3-10-full-north-wall-xatlas-bedtop-origin-offset-probe.mjs', 'utf8');

for (const text of [
	'const PHASE0_SCAN = process.argv.includes',
	"'--phase0-scan'",
	"'--westbeam-visible-range-lift-probe'",
	'const PHASE0_CONTACT_TARGETS = [',
	'phase0_bed_top_mid',
	'phase0_bed_top_east',
	'phase0_wardrobe_top_mid',
	'phase0_west_side_wall_back_mid',
	'phase0_east_side_wall_back_mid',
	'phase0_west_beam_under_north',
	'phase0_east_beam_under_north',
		'phase0_west_beam_gap_mid',
		'phase0_east_beam_gap_mid',
		'phase0_west_beam_gap_valid_edge',
		'phase0_east_beam_gap_valid_edge',
		'phase0-coplanar-contact-scan.json',
		'confirmed_bed_top_bake_bug',
		'de_scoped_scene_stale_diagnostic',
		'not_applicable_invalid_region',
		'lift_delta_candidate_needs_nee_resample',
		'suspected_coplanar_secondary_origin_degeneracy',
		'multiDirectionNeeWorstOf',
		'worstNee',
		'WESTBEAM_VISIBLE_RANGE_Y_VALUES',
		'--westbeam-visible-y-list',
		'westbeamVisibleRangeYValues',
		'westbeam_visible_seam_y',
		'westbeam_visible_control_y',
		'west_beam_visible_range_x_-1p750',
		'west_beam_visible_range_control_x_plus_2p5mm',
		'source.md §57 visible black-line y-range sweep'
	]) {
	assert.ok(tool.includes(text), `tool must include ${text}`);
}

assert.match(tool, /phase0Scan\s*\?\s*variants\s*:/, 'phase0 mode must route all variants through secondary probe');
assert.match(tool, /phase0Scan\s*\|\|\s*\(probeMode\s*>=\s*151/, 'phase0 mode must force temporary diagnostic material');
assert.match(tool, /source:\s*'R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS\.west'[\s\S]*?classificationOverride:\s*'not_applicable_invalid_region'/, 'west beam-gap invalid point must be explicitly N/A');
assert.match(tool, /source:\s*'R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS\.east'[\s\S]*?classificationOverride:\s*'not_applicable_invalid_region'/, 'east beam-gap invalid point must be explicitly N/A');
assert.match(tool, /source:\s*'R7310_C1_NORTH_WALL_BEAM_GAP_VALID_EDGE\.west'/, 'west beam-gap must include a valid edge follow-up target');
assert.match(tool, /source:\s*'R7310_C1_NORTH_WALL_BEAM_GAP_VALID_EDGE\.east'/, 'east beam-gap must include a valid edge follow-up target');
assert.match(tool, /validPreparedTexel\s*=\s*target\.preparedWorldTexel[\s\S]*target\.preparedWorldTexel\.valid > 0\.5/, 'phase0 classification must still require valid prepared texels');
assert.match(tool, /const\s+PHASE0_NEE_WORST_OF_DIRECTIONS\s*=/, 'phase0 scanner must define multi-direction NEE resample count');
assert.match(tool, /for \(let directionIndex = 0; directionIndex < PHASE0_NEE_WORST_OF_DIRECTIONS; directionIndex\+\+\)/, 'phase0 scanner must probe multiple NEE directions');
assert.match(tool, /vec3\s+r7310Phase0ProbeCosineDirection\s*\(\s*vec3\s+normal\s*\)/, 'phase0 scanner must inject a probe-only cosine sampler');
assert.match(tool, /r7310Phase0ProbeCosineDirection[\s\S]*uRandomVec2/, 'phase0 probe sampler must use uRandomVec2');
assert.match(tool, /diffuseBounceRayDirection = r7310Phase0ProbeCosineDirection\(nl\);/, 'phase0 probe bounce direction must use the probe sampler');
assert.match(tool, /classificationOverride \|\|/, 'explicit N/A classification must override threshold classification');
assert.match(tool, /productCodeChangedByProbe:\s*false/, 'report must keep product-code red line false');
assert.match(tool, /if \(isBraveBrowserPath\(CHROME_PATH\)\) throw new Error\('Brave is forbidden'\)/, 'tool must refuse Brave');
assert.match(tool, /WESTBEAM_VISIBLE_RANGE_Y_VALUES\s*=\s*\[[\s\S]*2\.526[\s\S]*2\.895[\s\S]*\]/, 'west-beam visible sweep must cover lower edge through upper edge');
assert.match(tool, /WESTBEAM_VISIBLE_RANGE_LIFT_PROBE[\s\S]*WESTBEAM_VISIBLE_RANGE_LIFT_TARGETS/, 'visible sweep flag must route to visible sweep targets');
assert.match(tool, /role:\s*'westbeam_visible_range_seam'[\s\S]*lift:\s*\{\s*x:\s*1,\s*y:\s*0,\s*z:\s*0\s*\}/, 'visible sweep seam targets must use +X lift');
assert.match(tool, /world:\s*\{\s*x:\s*seamX \+ controlDx[\s\S]*role:\s*'westbeam_visible_range_control'/, 'visible sweep must include +2.5mm control targets');

console.log('r7-3-10 phase0 coplanar contact scan contract OK');
