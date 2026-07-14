import assert from 'node:assert/strict';

import {
	runR7310IronDoorReflectionReadinessAudit
} from '../tools/r7-3-10-iron-door-reflection-diagnostic.mjs';

const report = runR7310IronDoorReflectionReadinessAudit();
const runtimeReportContract = report.requirements.runtimeReportContract;

assert.ok(runtimeReportContract, 'readiness audit must expose the runtime report contract gate');
assert.equal(runtimeReportContract.status, 'contract_present_pending_runtime_smoke');

assert.deepEqual(runtimeReportContract.requiredFields, [
	'ironDoorHybridReflectionCurrentMode',
	'ironDoorHybridReflectionPackageDir',
	'ironDoorHybridReflectionCaptureKind',
	'ironDoorHybridReflectionProjectionKind',
	'ironDoorHybridReflectionSelfCaptureExcluded',
	'ironDoorHybridReflectionPrefilterKind',
	'ironDoorHybridReflectionValidationStatus'
]);

assert.deepEqual(runtimeReportContract.requiredFormalReportFields, [
	'currentMode',
	'packageDir',
	'captureKind',
	'projectionKind',
	'selfCaptureExcluded',
	'prefilterKind',
	'validationStatus'
]);

assert.deepEqual(runtimeReportContract.missingFields, []);
assert.deepEqual(runtimeReportContract.missingFormalReportFields, []);
assert.equal(runtimeReportContract.coveredFieldCount, runtimeReportContract.requiredFields.length);
assert.equal(runtimeReportContract.coveredFormalReportFieldCount, runtimeReportContract.requiredFormalReportFields.length);
assert.equal(runtimeReportContract.reportFunction, 'window.reportR7310C1FullRoomDiffuseRuntimeConfig');
assert.equal(runtimeReportContract.formalReportObject, 'ironDoorReflectionFormalReport');
assert.equal(runtimeReportContract.evidence, 'InitCommon runtime report exposes the hybrid reflection decision contract and formal review object');

console.log('R7-3.10 iron door reflection runtime report coverage passed');
