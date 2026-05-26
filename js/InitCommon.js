let SCREEN_WIDTH;
let SCREEN_HEIGHT;
let canvas, context;
let container, stats;
let controls;
let pathTracingScene, screenCopyScene, screenOutputScene;
let pathTracingUniforms = {};
let pathTracingUniformsGroups = [];
let screenCopyUniforms, screenOutputUniforms;
let pathTracingDefines;
let pathTracingVertexShader, pathTracingFragmentShader;
const pendingCommonVertexShaderCallbacks = [];
let demoFragmentShaderFileName;
let screenCopyVertexShader, screenCopyFragmentShader;
let screenOutputVertexShader, screenOutputFragmentShader;
let triangleGeometry = new THREE.BufferGeometry();
let trianglePositions = [];
let pathTracingMaterial, pathTracingMesh;
let screenCopyMaterial, screenCopyMesh;
let screenOutputMaterial, screenOutputMesh;
let pathTracingRenderTarget, screenCopyRenderTarget;
let movementProtectionRenderTarget;
// R6 LGG-r16 J3：B 模 1/8 解析度 14 彈借光 buffer（暗角真光來源）
// borrowPathTracingRenderTarget 14 彈 path tracer accumulator sum；
// borrowScreenCopyRenderTarget  ping-pong 副本，給下一 frame 當 tPreviousTexture
let borrowPathTracingRenderTarget, borrowScreenCopyRenderTarget;
// R2-UI Bloom：multi-pass bloom 的 1/4 解析度 ping-pong render targets + scenes/materials
// R2-UI Bloom multi-scale：4 層 mip chain (1/2, 1/4, 1/8, 1/16)
let bloomMip = []; // [0]=1/2, [1]=1/4, [2]=1/8, [3]=1/16, [4]=1/32, [5]=1/64, [6]=1/128
// R2-UI：金字塔有效層數，UI slider 可切 3~7，影響 STEP 2.5 的 downsample/upsample chain 長度
window.bloomMipCount = 7;
let bloomBrightpassScene, bloomDownsampleScene, bloomUpsampleScene;
let bloomBrightpassMaterial, bloomDownsampleMaterial, bloomUpsampleMaterial;
let bloomBrightpassMesh, bloomDownsampleMesh, bloomUpsampleMesh;
let bloomBrightpassUniforms, bloomDownsampleUniforms, bloomUpsampleUniforms;
let orthoCamera, worldCamera;
let renderer, clockTimer;
let frameTime, elapsedTime;
let sceneIsDynamic = false;
let cameraFlightSpeed = 60;
let cameraRotationSpeed = 1;
let gamepad_cameraXRotationSpeed = 1;
let gamepad_cameraYRotationSpeed = 1;
let fovScale;
let storedFOV = 0;
let increaseFOV = false;
let decreaseFOV = false;
let dollyCameraIn = false;
let dollyCameraOut = false;
let apertureSize = 0.0;
let increaseAperture = false;
let decreaseAperture = false;
let apertureChangeSpeed = 1;
let focusDistance = 132.0;
let increaseFocusDist = false;
let decreaseFocusDist = false;
let focusDistanceChangeSpeed = 1;
let pixelRatio = 1.0;
let windowIsBeingResized = false;
// R2-UI：參數變化時觸發一次「相機剛移動完」的 restart，讓累加 buffer 乾淨刷新
let sceneParamsChanged = false;
// R6 Route X：後製滑桿（陰影補光等）變動時用，不重置 path tracer 累積、只觸發一次 STEP 3 重輸出
let postProcessChanged = false;
// R2-UI：切換 Cam 時整塊清空 render target，瞬間消除殘影（犧牲短暫噪點）
let needClearAccumulation = false;
// R2-UI：60 FPS cap（避免 120Hz 螢幕把 path tracing 推到 120 FPS 滿載）
let lastRenderTime = 0;
const FRAME_INTERVAL_MS = 1000 / 60;
const HOME_STUDIO_KEYBOARD_MOVE_FRAME_TIME_LIMIT = 1 / 30;
let homeStudioAnimationFrameId = 0;
let homeStudioAnimationSleeping = false;
let TWO_PI = Math.PI * 2;
let sampleCounter = 0.0; // will get increased by 1 in animation loop before rendering
let userSppCap = 1000; // 使用者可調整的 SPP 上限。sampleCounter >= userSppCap 時休眠；上限調高即自動續跑
let frameCounter = 1.0; // 1 instead of 0 because it is used as a rng() seed in pathtracing shader
let samplingPaused = false;
let samplingStepOnceRequested = false;
let samplingStepHistory = [];
let firstFrameRecoveryEnabled = true;
let firstFrameRecoveryTargetSamples = 4;
let firstFrameRecoveryMovingTargetSamples = 1;
let firstFrameRecoveryClearWhileMoving = true;
let firstFrameRecoveryLastPassCount = 1;
let firstFrameRecoveryLastReason = 'normal';
let firstFrameRecoveryLastFinalSamples = 0;
let r71BlueNoiseSamplingEnabled = false;
let movementProtectionEnabled = true;
let movementPreviewEnabled = false;
let movementProtectionMovingBlend = 0.0;
let movementProtectionLowSppPreviewStrength = 0.0;
let movementProtectionSpatialPreviewStrength = 0.0;
let movementProtectionWidePreviewStrength = 0.0;
let movementProtectionMinStableSamples = 16;
let movementProtectionStableReady = false;
let movementProtectionPreserveStableAcrossCameraReset = true;
let movementProtectionLastCaptureSamples = 0;
let movementProtectionLastBlend = 0.0;
let movementProtectionLastPreviewStrength = 0.0;
let movementProtectionLastSpatialPreviewStrength = 0.0;
let movementProtectionLastWidePreviewStrength = 0.0;
let homeStudioLoadingDisplayedProgress = 0.0;
let homeStudioLoadingTargetProgress = 0.0;
let homeStudioLoadingFrameId = 0;
let homeStudioLoadingHidden = false;
let r7310C1RuntimeLoadingCompleted = Object.create(null);

function updateHomeStudioLoadingUi(targetProgress)
{
	var loadingScreen = document.getElementById('loading-screen');
	var loadingRing = document.getElementById('loading-ring');
	var loadingText = document.getElementById('loading-text');
	if (!loadingScreen || !loadingRing || !loadingText)
		return;
	homeStudioLoadingTargetProgress = Math.max(0.0, Math.min(1.0, Number(targetProgress) || 0.0));
	if (!homeStudioLoadingHidden)
	{
		loadingScreen.style.display = 'flex';
		loadingScreen.style.opacity = '1';
		loadingScreen.style.pointerEvents = 'auto';
	}
	if (homeStudioLoadingFrameId)
		return;
	var step = function()
	{
		if (homeStudioLoadingHidden)
		{
			loadingRing.style.strokeDashoffset = '0';
			loadingText.innerText = '100%';
			homeStudioLoadingFrameId = 0;
			return;
		}
		var delta = homeStudioLoadingTargetProgress - homeStudioLoadingDisplayedProgress;
		homeStudioLoadingDisplayedProgress += delta * 0.18;
		if (Math.abs(delta) < 0.004)
			homeStudioLoadingDisplayedProgress = homeStudioLoadingTargetProgress;
		var clamped = Math.max(0.0, Math.min(1.0, homeStudioLoadingDisplayedProgress));
		loadingRing.style.strokeDashoffset = String(226 - clamped * 226);
		loadingText.innerText = Math.floor(clamped * 100) + '%';
		if (homeStudioLoadingDisplayedProgress !== homeStudioLoadingTargetProgress && !homeStudioLoadingHidden)
		{
			homeStudioLoadingFrameId = requestAnimationFrame(step);
			return;
		}
		homeStudioLoadingFrameId = 0;
	};
	homeStudioLoadingFrameId = requestAnimationFrame(step);
}

function hideHomeStudioLoadingScreen()
{
	var loadingScreen = document.getElementById('loading-screen');
	var loadingRing = document.getElementById('loading-ring');
	var loadingText = document.getElementById('loading-text');
	if (!loadingScreen)
		return;
	updateHomeStudioLoadingUi(1.0);
	if (loadingRing)
		loadingRing.style.strokeDashoffset = '0';
	if (loadingText)
		loadingText.innerText = '100%';
	homeStudioLoadingHidden = true;
	loadingScreen.style.opacity = '0';
	loadingScreen.style.pointerEvents = 'none';
	setTimeout(function()
	{
		loadingScreen.style.display = 'none';
	}, 550);
}

function updateR7310C1RuntimeLoadingProgress()
{
	var states = [
		{ enabled: r7310C1FloorDiffuseRuntimeEnabled, ready: r7310C1FullRoomDiffuseRuntimeReady },
		{ enabled: r7310C1NorthWallDiffuseRuntimeEnabled, ready: r7310C1NorthWallDiffuseRuntimeReady },
		{ enabled: r7310C1EastWallDiffuseRuntimeEnabled, ready: r7310C1EastWallDiffuseRuntimeReady },
		{ enabled: r7310C1WestWallDiffuseRuntimeEnabled, ready: r7310C1WestWallDiffuseRuntimeReady },
		{ enabled: r7310C1SouthWallDiffuseRuntimeEnabled, ready: r7310C1SouthWallDiffuseRuntimeReady },
		{ enabled: r7310C1CeilingDiffuseRuntimeEnabled, ready: r7310C1CeilingDiffuseRuntimeReady },
		{ enabled: r7310C1StructuralDiffuseRuntimeEnabled && !r7310C1StructuralDiffuseRuntimePending, ready: r7310C1StructuralDiffuseRuntimeReady },
		{ enabled: r7310C1SeColumnNorthShadowRuntimeEnabled && !r7310C1SeColumnNorthShadowRuntimePending, ready: r7310C1SeColumnNorthShadowRuntimeReady },
		{ enabled: r7310C1SeColumnWestShadowRuntimeEnabled && !r7310C1SeColumnWestShadowRuntimePending, ready: r7310C1SeColumnWestShadowRuntimeReady },
		{ enabled: r7310C1SouthWallAcShadowRuntimeEnabled && !r7310C1SouthWallAcShadowRuntimePending, ready: r7310C1SouthWallAcShadowRuntimeReady },
		{ enabled: r7310C1EastWallBeamShadowRuntimeEnabled && !r7310C1EastWallBeamShadowActiveRuntimePending(), ready: r7310C1EastWallBeamShadowActiveRuntimeReady() },
		{ enabled: r7310C1SwColumnNorthShadowRuntimeEnabled && !r7310C1SwColumnNorthShadowRuntimePending, ready: r7310C1SwColumnNorthShadowRuntimeReady },
		{ enabled: r7310C1WestWallBeamShadowRuntimeEnabled && !r7310C1WestWallBeamShadowRuntimePending, ready: r7310C1WestWallBeamShadowRuntimeReady },
		{ enabled: r7310C1SwColumnInnerShadowRuntimeEnabled && !r7310C1SwColumnInnerShadowRuntimePending, ready: r7310C1SwColumnInnerShadowRuntimeReady },
		{ enabled: r7310C1WestBeamInnerShadowRuntimeEnabled && !r7310C1WestBeamInnerShadowRuntimePending, ready: r7310C1WestBeamInnerShadowRuntimeReady },
		{ enabled: r7310C1WestBeamUnderShadowRuntimeEnabled && !r7310C1WestBeamUnderShadowRuntimePending, ready: r7310C1WestBeamUnderShadowRuntimeReady },
		{ enabled: r7310C1EastBeamInnerShadowRuntimeEnabled && !r7310C1EastBeamInnerShadowRuntimePending, ready: r7310C1EastBeamInnerShadowRuntimeReady },
		{ enabled: r7310C1EastBeamUnderShadowRuntimeEnabled && !r7310C1EastBeamUnderShadowRuntimePending, ready: r7310C1EastBeamUnderShadowRuntimeReady },
		{ enabled: r7310C1SouthWindowLeftRevealShadowRuntimeEnabled && !r7310C1SouthWindowLeftRevealShadowRuntimePending, ready: r7310C1SouthWindowLeftRevealShadowRuntimeReady },
		{ enabled: r7310C1SouthWindowRightRevealShadowRuntimeEnabled && !r7310C1SouthWindowRightRevealShadowRuntimePending, ready: r7310C1SouthWindowRightRevealShadowRuntimeReady },
		{ enabled: r7310C1SouthWindowBottomRevealShadowRuntimeEnabled && !r7310C1SouthWindowBottomRevealShadowRuntimePending, ready: r7310C1SouthWindowBottomRevealShadowRuntimeReady },
		{ enabled: r7310C1SouthWindowTopRevealShadowRuntimeEnabled && !r7310C1SouthWindowTopRevealShadowRuntimePending, ready: r7310C1SouthWindowTopRevealShadowRuntimeReady }
	];
	var total = 0;
	var ready = 0;
	for (var i = 0; i < states.length; i += 1)
	{
		if (!states[i].enabled) continue;
		total += 1;
		if (states[i].ready) ready += 1;
	}
	if (total === 0)
	{
		hideHomeStudioLoadingScreen();
		return;
	}
	var progress = 0.08 + 0.90 * (ready / total);
	updateHomeStudioLoadingUi(progress);
	if (ready >= total)
		hideHomeStudioLoadingScreen();
}

function markR7310C1RuntimeLoadingStepComplete(surfaceKey)
{
	r7310C1RuntimeLoadingCompleted[surfaceKey] = true;
	updateR7310C1RuntimeLoadingProgress();
}

function runAfterCommonVertexShaderReady(callback)
{
	if (typeof pathTracingVertexShader === 'string' && pathTracingVertexShader.length > 0)
	{
		callback();
		return;
	}
	pendingCommonVertexShaderCallbacks.push(callback);
}

function flushCommonVertexShaderCallbacks()
{
	while (pendingCommonVertexShaderCallbacks.length > 0)
		pendingCommonVertexShaderCallbacks.shift()();
}

function createCommonVertexShaderMaterial(params)
{
	if (typeof pathTracingVertexShader !== 'string' || pathTracingVertexShader.length === 0)
		throw new Error('[InitCommon] common vertex shader must load before creating ShaderMaterial');

	var materialParams = Object.assign({}, params);
	materialParams.vertexShader = pathTracingVertexShader;
	return new THREE.ShaderMaterial(materialParams);
}
let movementPreviewLastMode = 0.0;
let movementProtectionPeakPreviewStrength = 0.0;
let movementProtectionPeakPreviewSamples = 0;
let movementProtectionPeakPreviewConfig = 0;
let movementProtectionLastInvalidationReason = 'initial';
const R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT = [3.20, 1.70, 1.50, 1.25];
let r73QuickPreviewFillEnabled = true;
let r73QuickPreviewFillStrength = R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT[0];
let r73QuickPreviewFillEffectiveStrength = 1.00;
let cameraIsMoving = false;
let cameraRecentlyMoving = false;
let isPaused = true;
let inputMovementHorizontal = 0;
let inputMovementVertical = 0;
let oldYawRotation, oldPitchRotation;
let mobileJoystickControls = null;
let mobileShowButtons = true;
let mobileUseDarkButtons = false;
let oldDeltaX = 0;
let oldDeltaY = 0;
let newDeltaX = 0;
let newDeltaY = 0;
let mobileControlsMoveX = 0;
let mobileControlsMoveY = 0;
let oldPinchWidthX = 0;
let oldPinchWidthY = 0;
let pinchDeltaX = 0;
let pinchDeltaY = 0;
let useGenericInput = true;
let EPS_intersect = 0.01; // default precision
let textureLoader = new THREE.TextureLoader();
let blueNoiseTexture;
let useToneMapping = true;
let canPress_O = true;
let canPress_P = true;
let allowOrthographicCamera = true;
let changeToOrthographicCamera = false;
let changeToPerspectiveCamera = false;
let pixelEdgeSharpness = 0.75;
let edgeSharpenSpeed = 0.05;
//let filterDecaySpeed = 0.0001;

let ableToEngagePointerLock = true;
let pixel_ResolutionObject;
let needChangePixelResolution = false;
let orthographicCamera_ToggleObject;
let currentlyUsingOrthographicCamera = false;

// the following variables will be used to calculate rotations and directions from the camera
let cameraDirectionVector = new THREE.Vector3(); //for moving where the camera is looking
let cameraRightVector = new THREE.Vector3(); //for strafing the camera right and left
let cameraUpVector = new THREE.Vector3(); //for moving camera up and down
let cameraControlsObject; //for positioning and moving the camera itself
let cameraControlsYawObject; //allows access to control camera's left/right movements through mobile input
let cameraControlsPitchObject; //allows access to control camera's up/down movements through mobile input
let PI_2 = Math.PI / 2; //used by controls below
let inputRotationHorizontal = 0;
let inputRotationVertical = 0;

let infoElement = document.getElementById('info');
infoElement.style.cursor = "default";
infoElement.style.userSelect = "none";
infoElement.style.MozUserSelect = "none";

let cameraInfoElement = document.getElementById('cameraInfo');
cameraInfoElement.style.cursor = "default";
cameraInfoElement.style.userSelect = "none";
cameraInfoElement.style.MozUserSelect = "none";

let cameraPoseInfoElement = document.getElementById('cameraPoseInfo');
if (cameraPoseInfoElement)
{
	cameraPoseInfoElement.style.cursor = "text";
	cameraPoseInfoElement.style.userSelect = "text";
	cameraPoseInfoElement.style.MozUserSelect = "text";
}

let cameraPoseCopyButtonElement = document.getElementById('copyCameraPoseInfo');
if (cameraPoseCopyButtonElement)
{
	cameraPoseCopyButtonElement.style.cursor = "pointer";
	cameraPoseCopyButtonElement.style.userSelect = "none";
	cameraPoseCopyButtonElement.style.MozUserSelect = "none";
}

let mouseControl = true;
let pointerlockChange;
let fileLoader = new THREE.FileLoader();

let gamepads = null;
let gp = null;
let gamepadIndex = null;
let gamepad_Button0Pressed = false;
let gamepad_DirectionUpPressed = false;
let gamepad_DirectionDownPressed = false;
let gamepad_DirectionLeftPressed = false;
let gamepad_DirectionRightPressed = false;
window.addEventListener('gamepadconnected', (event) => {
	gamepadIndex = event.gamepad.index;
	console.log("Gamepad connected at index", gamepadIndex);
});
window.addEventListener('gamepaddisconnected', (event) => {
	console.log("Gamepad disconnected from index", event.gamepad.index);
	gamepadIndex = null;
});

function normalizeFirstFrameRecoveryTargetSamples(value)
{
	var n = Math.trunc(Number(value));
	if (!Number.isFinite(n)) n = 4;
	if (n < 1) n = 1;
	if (n > 16) n = 16;
	return n;
}

window.setFirstFrameRecoveryConfig = function(config)
{
	var nextConfig = config || {};
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'enabled'))
		firstFrameRecoveryEnabled = !!nextConfig.enabled;
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'targetSamples'))
		firstFrameRecoveryTargetSamples = normalizeFirstFrameRecoveryTargetSamples(nextConfig.targetSamples);
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'movingTargetSamples'))
		firstFrameRecoveryMovingTargetSamples = normalizeFirstFrameRecoveryTargetSamples(nextConfig.movingTargetSamples);
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'clearWhileMoving'))
		firstFrameRecoveryClearWhileMoving = !!nextConfig.clearWhileMoving;
	return window.reportFirstFrameRecoveryConfig();
};

window.reportFirstFrameRecoveryConfig = function()
{
	return {
		version: 'r6-3-phase2-first-frame-burst-v19',
		enabled: firstFrameRecoveryEnabled,
		targetSamples: firstFrameRecoveryTargetSamples,
		movingTargetSamples: firstFrameRecoveryMovingTargetSamples,
		configTargetSamples: firstFrameRecoveryConfigTargetSamples(cameraIsMoving),
		c3c4DropVisibleFirstSpp: firstFrameRecoveryConfigTargetSamples(true) === 2,
		clearWhileMoving: firstFrameRecoveryClearWhileMoving,
		lastPassCount: firstFrameRecoveryLastPassCount,
		lastReason: firstFrameRecoveryLastReason,
		lastFinalSamples: firstFrameRecoveryLastFinalSamples,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0)
	};
};

window.setSamplingPaused = function(paused)
{
	var wasSamplingPaused = samplingPaused;
	samplingPaused = !!paused;
	if (!samplingPaused)
	{
		samplingStepOnceRequested = false;
		resetSamplingStepHistory();
	}
	else if (!wasSamplingPaused || samplingStepHistory.length === 0)
	{
		captureSamplingStepHistoryState();
	}
	if (typeof window.updateSamplingControls === 'function')
		window.updateSamplingControls();
	if (typeof scheduleHomeStudioAnimationFrame === 'function')
		scheduleHomeStudioAnimationFrame();
	return window.reportSamplingPaused();
};

window.requestSamplingStepOnce = function()
{
	samplingPaused = true;
	if (samplingStepHistory.length === 0)
		captureSamplingStepHistoryState();
	samplingStepOnceRequested = true;
	if (typeof window.updateSamplingControls === 'function')
		window.updateSamplingControls();
	if (typeof scheduleHomeStudioAnimationFrame === 'function')
		scheduleHomeStudioAnimationFrame();
	return window.reportSamplingPaused();
};

window.requestSamplingStepBack = function()
{
	if (!samplingPaused || samplingStepOnceRequested || samplingStepHistory.length <= 1)
		return window.reportSamplingPaused();

	disposeSamplingStepHistoryState(samplingStepHistory.pop());
	var previousState = samplingStepHistory[samplingStepHistory.length - 1];
	restoreSamplingStepHistoryState(previousState);
	if (typeof window.updateSamplingControls === 'function')
		window.updateSamplingControls();
	if (typeof scheduleHomeStudioAnimationFrame === 'function')
		scheduleHomeStudioAnimationFrame();
	return window.reportSamplingPaused();
};

window.reportSamplingPaused = function()
{
	return {
		paused: samplingPaused,
		stepOncePending: samplingStepOnceRequested,
		stepHistoryDepth: Math.max(0, samplingStepHistory.length - 1),
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0)
	};
};

window.setSppCap = function(value)
{
	var parsed = Math.floor(Number(value));
	if (!isFinite(parsed) || parsed < 1) parsed = 1;
	var previousCap = userSppCap;
	userSppCap = parsed;
	// 上限調高、且目前已超過舊上限 → 喚醒動畫迴圈繼續累加；不重置 sceneParams、不清累積
	if (parsed > previousCap && sampleCounter >= previousCap)
	{
		if (typeof scheduleHomeStudioAnimationFrame === 'function')
			scheduleHomeStudioAnimationFrame();
	}
	return window.reportSppCap();
};

window.reportSppCap = function()
{
	return {
		cap: userSppCap,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0),
		hibernating: sampleCounter >= userSppCap && !cameraIsMoving
	};
};

function createSamplingHistoryRenderTarget(sourceRenderTarget)
{
	if (!sourceRenderTarget || !sourceRenderTarget.texture || !THREE)
		return null;
	var sourceTexture = sourceRenderTarget.texture;
	var historyRenderTarget = new THREE.WebGLRenderTarget(sourceRenderTarget.width, sourceRenderTarget.height, {
		minFilter: sourceTexture.minFilter,
		magFilter: sourceTexture.magFilter,
		format: sourceTexture.format,
		type: sourceTexture.type,
		depthBuffer: false,
		stencilBuffer: false
	});
	historyRenderTarget.texture.generateMipmaps = false;
	return historyRenderTarget;
}

function copySamplingRenderTarget(sourceRenderTarget, targetRenderTarget)
{
	if (!renderer || !sourceRenderTarget || !targetRenderTarget || !screenCopyUniforms || !screenCopyScene || !orthoCamera)
		return false;
	var savedSourceTexture = screenCopyUniforms.tPathTracedImageTexture.value;
	screenCopyUniforms.tPathTracedImageTexture.value = sourceRenderTarget.texture;
	renderer.setRenderTarget(targetRenderTarget);
	renderer.render(screenCopyScene, orthoCamera);
	screenCopyUniforms.tPathTracedImageTexture.value = savedSourceTexture;
	return true;
}

function disposeSamplingStepHistoryState(state)
{
	if (!state)
		return;
	['pathTracing', 'screenCopy', 'borrowPathTracing', 'borrowScreenCopy'].forEach(function(key)
	{
		if (state[key] && typeof state[key].dispose === 'function')
			state[key].dispose();
	});
}

function resetSamplingStepHistory()
{
	samplingStepHistory.forEach(disposeSamplingStepHistoryState);
	samplingStepHistory = [];
}

function captureSamplingStepHistoryState()
{
	if (!samplingPaused || !pathTracingRenderTarget || !screenCopyRenderTarget)
		return null;

	var state = {
		sampleCounter: sampleCounter,
		frameCounter: frameCounter,
		pathTracing: createSamplingHistoryRenderTarget(pathTracingRenderTarget),
		screenCopy: createSamplingHistoryRenderTarget(screenCopyRenderTarget),
		borrowPathTracing: borrowPathTracingRenderTarget ? createSamplingHistoryRenderTarget(borrowPathTracingRenderTarget) : null,
		borrowScreenCopy: borrowScreenCopyRenderTarget ? createSamplingHistoryRenderTarget(borrowScreenCopyRenderTarget) : null
	};

	var copied = state.pathTracing && state.screenCopy
		&& copySamplingRenderTarget(pathTracingRenderTarget, state.pathTracing)
		&& copySamplingRenderTarget(screenCopyRenderTarget, state.screenCopy);
	if (copied && borrowPathTracingRenderTarget && state.borrowPathTracing)
		copied = copySamplingRenderTarget(borrowPathTracingRenderTarget, state.borrowPathTracing);
	if (copied && borrowScreenCopyRenderTarget && state.borrowScreenCopy)
		copied = copySamplingRenderTarget(borrowScreenCopyRenderTarget, state.borrowScreenCopy);

	if (!copied)
	{
		disposeSamplingStepHistoryState(state);
		return null;
	}

	samplingStepHistory.push(state);
	return state;
}

function restoreSamplingStepHistoryState(state)
{
	if (!state || !pathTracingRenderTarget || !screenCopyRenderTarget)
		return false;

	var copied = copySamplingRenderTarget(state.pathTracing, pathTracingRenderTarget)
		&& copySamplingRenderTarget(state.screenCopy, screenCopyRenderTarget);
	if (copied && state.borrowPathTracing && borrowPathTracingRenderTarget)
		copied = copySamplingRenderTarget(state.borrowPathTracing, borrowPathTracingRenderTarget);
	if (copied && state.borrowScreenCopy && borrowScreenCopyRenderTarget)
		copied = copySamplingRenderTarget(state.borrowScreenCopy, borrowScreenCopyRenderTarget);
	if (!copied)
		return false;

	sampleCounter = state.sampleCounter;
	frameCounter = state.frameCounter;
	firstFrameRecoveryLastFinalSamples = Math.round(sampleCounter);
	if (pathTracingUniforms)
	{
		if (pathTracingUniforms.uSampleCounter) pathTracingUniforms.uSampleCounter.value = sampleCounter;
		if (pathTracingUniforms.uFrameCounter) pathTracingUniforms.uFrameCounter.value = frameCounter;
	}
	if (screenOutputUniforms)
	{
		if (screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
		if (screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
	}
	postProcessChanged = true;
	return true;
}

window.setR71BlueNoiseSamplingEnabled = function(enabled)
{
	r71BlueNoiseSamplingEnabled = !!enabled;
	if (pathTracingUniforms && pathTracingUniforms.uR71BlueNoiseSamplingMode)
		pathTracingUniforms.uR71BlueNoiseSamplingMode.value = r71BlueNoiseSamplingEnabled ? 1.0 : 0.0;
	cameraIsMoving = true;
	return window.reportR71BlueNoiseSamplingConfig();
};

window.reportR71BlueNoiseSamplingConfig = function()
{
	return {
		version: 'r7-1-blue-noise-sampling-v6-no-go',
		enabled: r71BlueNoiseSamplingEnabled,
		uniformMode: pathTracingUniforms && pathTracingUniforms.uR71BlueNoiseSamplingMode
			? pathTracingUniforms.uR71BlueNoiseSamplingMode.value
			: null,
		blueNoiseTextureReady: !!blueNoiseTexture,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0)
	};
};

function normalizeMovementProtectionBlend(value)
{
	var n = Number(value);
	if (!Number.isFinite(n)) n = 0.0;
	if (n < 0.0) n = 0.0;
	if (n > 0.95) n = 0.95;
	return n;
}

function normalizeMovementProtectionPreviewStrength(value)
{
	var n = Number(value);
	if (!Number.isFinite(n)) n = 0.0;
	if (n < 0.0) n = 0.0;
	if (n > 1.0) n = 1.0;
	return n;
}

function normalizeMovementProtectionMinStableSamples(value)
{
	var n = Math.trunc(Number(value));
	if (!Number.isFinite(n)) n = 16;
	if (n < 1) n = 1;
	if (n > 512) n = 512;
	return n;
}

window.setMovementProtectionConfig = function(config)
{
	var nextConfig = config || {};
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'enabled'))
		movementProtectionEnabled = !!nextConfig.enabled;
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'movementPreviewEnabled'))
		movementPreviewEnabled = !!nextConfig.movementPreviewEnabled;
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'movingBlend'))
		movementProtectionMovingBlend = normalizeMovementProtectionBlend(nextConfig.movingBlend);
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'lowSppPreviewStrength'))
		movementProtectionLowSppPreviewStrength = normalizeMovementProtectionPreviewStrength(nextConfig.lowSppPreviewStrength);
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'spatialPreviewStrength'))
		movementProtectionSpatialPreviewStrength = normalizeMovementProtectionPreviewStrength(nextConfig.spatialPreviewStrength);
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'widePreviewStrength'))
		movementProtectionWidePreviewStrength = normalizeMovementProtectionPreviewStrength(nextConfig.widePreviewStrength);
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'minStableSamples'))
		movementProtectionMinStableSamples = normalizeMovementProtectionMinStableSamples(nextConfig.minStableSamples);
	if (!movementProtectionEnabled)
	{
		movementProtectionLastBlend = 0.0;
		movementProtectionLastPreviewStrength = 0.0;
		movementProtectionLastSpatialPreviewStrength = 0.0;
		movementProtectionLastWidePreviewStrength = 0.0;
	}
	updateMovementPreviewUniforms(cameraIsMoving);
	updateMovementProtectionUniforms(cameraIsMoving);
	return window.reportMovementProtectionConfig();
};

window.reportMovementProtectionConfig = function()
{
	return {
		version: 'r6-3-phase2-movement-protection-v22d',
		enabled: movementProtectionEnabled,
		movementPreviewEnabled: movementPreviewEnabled,
		configAllowed: movementProtectionConfigAllowed(),
		lowCostMovingActive: firstFrameRecoveryLowCostMovementActive(cameraIsMoving),
		movingBlend: movementProtectionMovingBlend,
		lowSppPreviewStrength: movementProtectionLowSppPreviewStrength,
		spatialPreviewStrength: movementProtectionSpatialPreviewStrength,
		widePreviewStrength: movementProtectionWidePreviewStrength,
		minStableSamples: movementProtectionMinStableSamples,
		stableReady: movementProtectionStableReady,
		preserveStableAcrossCameraReset: movementProtectionPreserveStableAcrossCameraReset,
		lastCaptureSamples: movementProtectionLastCaptureSamples,
		lastBlend: movementProtectionLastBlend,
		lastPreviewStrength: movementProtectionLastPreviewStrength,
		lastSpatialPreviewStrength: movementProtectionLastSpatialPreviewStrength,
		lastWidePreviewStrength: movementProtectionLastWidePreviewStrength,
		peakPreviewStrength: movementProtectionPeakPreviewStrength,
		peakPreviewSamples: movementProtectionPeakPreviewSamples,
		peakPreviewConfig: movementProtectionPeakPreviewConfig,
		uniformPreviewStrength: screenOutputUniforms && screenOutputUniforms.uMovementProtectionLowSppPreviewStrength
			? screenOutputUniforms.uMovementProtectionLowSppPreviewStrength.value
			: null,
		uniformSpatialPreviewStrength: screenOutputUniforms && screenOutputUniforms.uMovementProtectionSpatialPreviewStrength
			? screenOutputUniforms.uMovementProtectionSpatialPreviewStrength.value
			: null,
		uniformWidePreviewStrength: screenOutputUniforms && screenOutputUniforms.uMovementProtectionWidePreviewStrength
			? screenOutputUniforms.uMovementProtectionWidePreviewStrength.value
			: null,
		lastMovementPreviewMode: movementPreviewLastMode,
		uniformMovementPreviewMode: pathTracingUniforms && pathTracingUniforms.uMovementPreviewMode
			? pathTracingUniforms.uMovementPreviewMode.value
			: null,
		lastInvalidationReason: movementProtectionLastInvalidationReason,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0),
		cameraIsMoving: !!cameraIsMoving
	};
};

function movementProtectionConfigAllowed()
{
	var config = (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0;
	return config === 3 || config === 4;
}

function firstFrameRecoveryMovementConfigAllowed()
{
	return movementProtectionConfigAllowed();
}

function firstFrameRecoveryConfigTargetSamples(activeCameraMoving)
{
	var config = (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0;
	if ((config === 3 || config === 4) && activeCameraMoving)
		return 2;
	if (!movementProtectionConfigAllowed())
		return 1;
	if (activeCameraMoving)
		return firstFrameRecoveryMovingTargetSamples;
	return firstFrameRecoveryTargetSamples;
}

function firstFrameRecoveryLowCostMovementActive(activeCameraMoving)
{
	return movementProtectionConfigAllowed() && !!activeCameraMoving;
}

function movementPreviewActive(activeCameraMoving)
{
	return movementPreviewEnabled && movementProtectionEnabled && movementProtectionConfigAllowed() && !!activeCameraMoving;
}

function r73QuickPreviewFillConfigAllowed()
{
	var config = (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0;
	return config === 3;
}

function r73QuickPreviewFillQuickModeActive()
{
	var btnB = document.getElementById('btnGroupB');
	return !!(btnB && btnB.classList.contains('glow-white'));
}

function currentR73QuickPreviewFillSamples()
{
	return Math.max(1.0, Math.round(typeof sampleCounter === 'number' ? sampleCounter : 1.0));
}

function computeR73QuickPreviewFillEffectiveStrength(samples)
{
	samples = Math.max(1.0, Math.round(Number(samples) || 1.0));
	if (samples <= 4.0)
		return R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT[samples - 1];
	var spp4Strength = R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT[3];
	if (spp4Strength <= 1.0)
		return spp4Strength;
	return 1.0 + (spp4Strength - 1.0) / Math.pow(2.0, samples - 4.0);
}

function updateR73QuickPreviewFillUniforms()
{
	var applied = r73QuickPreviewFillEnabled && r73QuickPreviewFillConfigAllowed() && r73QuickPreviewFillQuickModeActive();
	r73QuickPreviewFillStrength = R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT[0];
	var effectiveStrength = computeR73QuickPreviewFillEffectiveStrength(currentR73QuickPreviewFillSamples());
	r73QuickPreviewFillEffectiveStrength = effectiveStrength;
	if (screenOutputUniforms && screenOutputUniforms.uR73QuickPreviewFillMode)
		screenOutputUniforms.uR73QuickPreviewFillMode.value = applied ? 1.0 : 0.0;
	if (screenOutputUniforms && screenOutputUniforms.uR73QuickPreviewFillStrength)
		screenOutputUniforms.uR73QuickPreviewFillStrength.value = effectiveStrength;
	if (pathTracingUniforms && pathTracingUniforms.uR73QuickPreviewTerminalMode)
		pathTracingUniforms.uR73QuickPreviewTerminalMode.value = applied ? 1.0 : 0.0;
	if (pathTracingUniforms && pathTracingUniforms.uR73QuickPreviewTerminalStrength)
		pathTracingUniforms.uR73QuickPreviewTerminalStrength.value = effectiveStrength;
	return applied;
}

window.setR73QuickPreviewFillEnabled = function(enabled)
{
	r73QuickPreviewFillEnabled = !!enabled;
	r73QuickPreviewFillStrength = R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT[0];
	updateR73QuickPreviewFillUniforms();
	if (typeof wakeRender === 'function')
		wakeRender();
	return window.reportR73QuickPreviewFillConfig();
};

window.reportR73QuickPreviewFillConfig = function()
{
	var applied = updateR73QuickPreviewFillUniforms();
	return {
		version: 'r7-3-quick-preview-fill-v3al-c1c2-fps1',
		enabled: r73QuickPreviewFillEnabled,
		strength: r73QuickPreviewFillStrength,
		baseStrength: R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT[0],
		strengthCurve: R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT.slice(),
		effectiveStrength: r73QuickPreviewFillEffectiveStrength,
		configAllowed: r73QuickPreviewFillConfigAllowed(),
		quickPreviewActive: r73QuickPreviewFillQuickModeActive(),
		r73QuickPreviewFillApplied: applied,
		uniformMode: screenOutputUniforms && screenOutputUniforms.uR73QuickPreviewFillMode
			? screenOutputUniforms.uR73QuickPreviewFillMode.value
			: null,
		uniformStrength: screenOutputUniforms && screenOutputUniforms.uR73QuickPreviewFillStrength
			? screenOutputUniforms.uR73QuickPreviewFillStrength.value
			: null,
		terminalUniformMode: pathTracingUniforms && pathTracingUniforms.uR73QuickPreviewTerminalMode
			? pathTracingUniforms.uR73QuickPreviewTerminalMode.value
			: null,
		terminalUniformStrength: pathTracingUniforms && pathTracingUniforms.uR73QuickPreviewTerminalStrength
			? pathTracingUniforms.uR73QuickPreviewTerminalStrength.value
			: null,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0),
		currentPanelConfig: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0
	};
};

function collectHomeStudioFpsProbeSnapshot()
{
	var maxSamples = typeof userSppCap === 'number' ? userSppCap : null;
	return {
		devicePixelRatio: window.devicePixelRatio,
		pixelRatio: typeof pixelRatio === 'number' ? pixelRatio : null,
		innerWidth: window.innerWidth,
		innerHeight: window.innerHeight,
		bodyClientWidth: document.body ? document.body.clientWidth : null,
		bodyClientHeight: document.body ? document.body.clientHeight : null,
		canvasPixels: renderer && renderer.domElement
			? {
				width: renderer.domElement.width,
				height: renderer.domElement.height,
				megapixels: Number((renderer.domElement.width * renderer.domElement.height / 1000000).toFixed(3))
			}
			: null,
		currentPanelConfig: typeof currentPanelConfig === 'number' ? currentPanelConfig : null,
		sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
		fps: window._fpsAcc ? window._fpsAcc.fps : null,
		renderingWouldStop: !!(maxSamples !== null && sampleCounter >= maxSamples && !cameraIsMoving),
		hibernating: !!(maxSamples !== null && sampleCounter >= maxSamples && !cameraIsMoving),
		cameraIsMoving: !!cameraIsMoving,
		needClearAccumulation: !!needClearAccumulation,
		postProcessChanged: !!postProcessChanged,
		needChangePixelResolution: !!needChangePixelResolution,
		firstFrameRecovery: typeof window.reportFirstFrameRecoveryConfig === 'function' ? window.reportFirstFrameRecoveryConfig() : null,
		movementProtection: typeof window.reportMovementProtectionConfig === 'function' ? window.reportMovementProtectionConfig() : null,
		r72LightImportanceSampling: typeof window.reportR72LightImportanceSampling === 'function' ? window.reportR72LightImportanceSampling() : null,
		shaderHotPath: 'r7-3-c1c2-fps1-movement-capture-gate',
		r73QuickPreview: typeof window.reportR73QuickPreviewFillConfig === 'function' ? window.reportR73QuickPreviewFillConfig() : null,
		borrowStrength: pathTracingUniforms && pathTracingUniforms.uBorrowStrength
			? pathTracingUniforms.uBorrowStrength.value
			: null,
		maxBounces: pathTracingUniforms && pathTracingUniforms.uMaxBounces
			? pathTracingUniforms.uMaxBounces.value
			: null,
		pathResolution: pathTracingUniforms && pathTracingUniforms.uResolution
			? {
				x: pathTracingUniforms.uResolution.value.x,
				y: pathTracingUniforms.uResolution.value.y
			}
			: null
	};
}

window.reportHomeStudioFpsRootCauseAfterMs = async function(durationMs)
{
	var waitMs = Math.max(250, Number(durationMs) || 5000);
	var initialSamplingState = typeof window.reportSamplingPaused === 'function'
		? window.reportSamplingPaused()
		: null;
	var autoResumedSampling = !!(initialSamplingState && initialSamplingState.paused && typeof window.setSamplingPaused === 'function');
	if (autoResumedSampling)
	{
		window.setSamplingPaused(false);
		if (typeof wakeRender === 'function')
			wakeRender();
		await new Promise(function(resolve) { setTimeout(resolve, 100); });
	}
	var before = collectHomeStudioFpsProbeSnapshot();
	var beforeSamples = typeof sampleCounter === 'number' ? sampleCounter : null;
	var startTime = performance.now();
	await new Promise(function(resolve) { setTimeout(resolve, waitMs); });
	var endTime = performance.now();
	var after = collectHomeStudioFpsProbeSnapshot();
	var afterSamples = typeof sampleCounter === 'number' ? sampleCounter : null;
	var measuredMs = Math.max(1, endTime - startTime);
	var sampleDelta = beforeSamples !== null && afterSamples !== null
		? afterSamples - beforeSamples
		: null;
	if (autoResumedSampling && typeof window.setSamplingPaused === 'function')
		window.setSamplingPaused(true);
	return {
		version: 'fps-root-cause-probe-r7-3-c1c2-fps1',
		durationMs: Math.round(measuredMs),
		sppPerSec: sampleDelta !== null
			? Number((sampleDelta * 1000 / measuredMs).toFixed(3))
			: null,
		autoResumedSampling: autoResumedSampling,
		initialSamplingState: initialSamplingState,
		before: before,
		after: after
	};
};

function captureR73ScreenLumaData()
{
	if (!renderer || !renderer.domElement || !screenOutputScene || !orthoCamera)
		return null;
	var width = renderer.domElement.width;
	var height = renderer.domElement.height;
	renderer.setRenderTarget(null);
	renderer.render(screenOutputScene, orthoCamera);
	var canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	var ctx = canvas.getContext('2d', { willReadFrequently: true });
	ctx.drawImage(renderer.domElement, 0, 0, width, height);
	var data = ctx.getImageData(0, 0, width, height).data;
	var luma = new Float32Array(width * height);
	for (var i = 0, p = 0; i < data.length; i += 4, p += 1)
	{
		var r = data[i] / 255;
		var g = data[i + 1] / 255;
		var b = data[i + 2] / 255;
		luma[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	}
	return { width: width, height: height, luma: luma };
}

function renderR73GikWallProbeSample(mode)
{
	if (!renderer || !pathTracingRenderTarget || !screenCopyRenderTarget || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera || !pathTracingUniforms || !pathTracingUniforms.uR73GikWallProbeMode)
		return false;
	renderer.setRenderTarget(pathTracingRenderTarget);
	renderer.clear();
	renderer.setRenderTarget(screenCopyRenderTarget);
	renderer.clear();
	if (borrowPathTracingRenderTarget && borrowScreenCopyRenderTarget)
	{
		renderer.setRenderTarget(borrowPathTracingRenderTarget);
		renderer.clear();
		renderer.setRenderTarget(borrowScreenCopyRenderTarget);
		renderer.clear();
	}
	pathTracingUniforms.uR73GikWallProbeMode.value = mode;
	if (typeof pathTracingMaterial !== 'undefined' && pathTracingMaterial)
		pathTracingMaterial.uniformsNeedUpdate = true;
	sampleCounter = 1.0;
	frameCounter = 2.0;
	cameraIsMoving = false;
	cameraRecentlyMoving = false;
	needClearAccumulation = false;
	cameraControlsObject.updateMatrixWorld(true);
	worldCamera.updateMatrixWorld(true);
	pathTracingUniforms.uCameraIsMoving.value = false;
	pathTracingUniforms.uSampleCounter.value = sampleCounter;
	pathTracingUniforms.uFrameCounter.value = frameCounter;
	pathTracingUniforms.uPreviousSampleCount.value = 1.0;
	pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());
	pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
	pathTracingUniforms.uApertureSize.value = apertureSize;
	if (screenOutputUniforms)
	{
		if (screenOutputUniforms.uCameraIsMoving) screenOutputUniforms.uCameraIsMoving.value = false;
		if (screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
		if (screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0;
	}
	renderer.setRenderTarget(pathTracingRenderTarget);
	renderer.render(pathTracingScene, worldCamera);
	renderer.setRenderTarget(screenCopyRenderTarget);
	renderer.render(screenCopyScene, orthoCamera);
	renderer.setRenderTarget(null);
	return true;
}

function captureR73GikWallSurfaceMask(mode)
{
	var previousMode = pathTracingUniforms && pathTracingUniforms.uR73GikWallProbeMode
		? pathTracingUniforms.uR73GikWallProbeMode.value
		: 0;
	if (!renderR73GikWallProbeSample(mode))
		return null;
	var mask = captureR73ScreenLumaData();
	if (pathTracingUniforms && pathTracingUniforms.uR73GikWallProbeMode)
		pathTracingUniforms.uR73GikWallProbeMode.value = previousMode;
	if (typeof pathTracingMaterial !== 'undefined' && pathTracingMaterial)
		pathTracingMaterial.uniformsNeedUpdate = true;
	return mask;
}

function summarizeR73GikWallLuma(lumaData, maskData)
{
	if (!lumaData || !maskData || lumaData.width !== maskData.width || lumaData.height !== maskData.height)
		return null;
	var selected = [];
	var sum = 0;
	var maxValue = 0;
	var threshold = 0.2;
	for (var i = 0; i < maskData.luma.length; i += 1)
	{
		if (maskData.luma[i] <= threshold)
			continue;
		var value = lumaData.luma[i];
		selected.push(value);
		sum += value;
		if (value > maxValue)
			maxValue = value;
	}
	if (selected.length === 0)
		return { pixels: 0, meanLuma: null, p50Luma: null, p90Luma: null, maxLuma: null };
	selected.sort(function(a, b) { return a - b; });
	var p50Index = Math.min(selected.length - 1, Math.floor(selected.length * 0.50));
	var p90Index = Math.min(selected.length - 1, Math.floor(selected.length * 0.90));
	return {
		pixels: selected.length,
		meanLuma: Number((sum / selected.length).toFixed(6)),
		p50Luma: Number(selected[p50Index].toFixed(6)),
		p90Luma: Number(selected[p90Index].toFixed(6)),
		maxLuma: Number(maxValue.toFixed(6))
	};
}

function r73SwitchToConfigQuickPreview(config)
{
	if (typeof applyPanelConfig === 'function')
		applyPanelConfig(config);
	var btnB = document.getElementById('btnGroupB');
	if (btnB && !btnB.classList.contains('glow-white'))
		btnB.click();
	updateR73QuickPreviewFillUniforms();
	if (typeof wakeRender === 'function')
		wakeRender();
}

async function measureR73GikWallConfig(config, targetSamples, timeoutMs)
{
	r73SwitchToConfigQuickPreview(config);
	var waitResult = typeof window.waitForCloudVisibilityProbeSamples === 'function'
		? await window.waitForCloudVisibilityProbeSamples(targetSamples, timeoutMs, 100)
		: { targetSamples: targetSamples, samples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0), timedOut: true, elapsedMs: 0 };
	updateR73QuickPreviewFillUniforms();
	var lumaData = captureR73ScreenLumaData();
	var gikMask = captureR73GikWallSurfaceMask(1);
	var wallMask = captureR73GikWallSurfaceMask(2);
	var gikSummary = summarizeR73GikWallLuma(lumaData, gikMask);
	var wallSummary = summarizeR73GikWallLuma(lumaData, wallMask);
	return {
		config: config,
		targetSamples: targetSamples,
		waitResult: waitResult,
		gikSummary: gikSummary,
		wallSummary: wallSummary,
		surfaceLumaRatio: gikSummary && wallSummary && wallSummary.meanLuma > 0
			? Number((gikSummary.meanLuma / wallSummary.meanLuma).toFixed(6))
			: null
	};
}

window.reportR73GikWallLumaComparisonAfterSamples = async function(targetSamples, timeoutMs)
{
	var target = Math.max(1, Math.trunc(Number(targetSamples) || 2));
	var timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));
	var original = {
		config: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0,
		probeMode: pathTracingUniforms && pathTracingUniforms.uR73GikWallProbeMode ? pathTracingUniforms.uR73GikWallProbeMode.value : 0,
		fillEnabled: r73QuickPreviewFillEnabled,
		quickPreviewActive: r73QuickPreviewFillQuickModeActive()
	};
	try
	{
		window.setR73QuickPreviewFillEnabled(true);
		var c3 = await measureR73GikWallConfig(3, target, timeout);
		var c4 = await measureR73GikWallConfig(4, target, timeout);
		var result = {
			version: 'r7-3-quick-preview-fill-v3al-c1c2-fps1',
			scope: 'c3c4GikWallQuickPreviewLuma',
			targetSamples: target,
			c3: c3,
			c4: c4,
			c4OverC3GikMean: c3.gikSummary && c4.gikSummary && c3.gikSummary.meanLuma > 0
				? Number((c4.gikSummary.meanLuma / c3.gikSummary.meanLuma).toFixed(6))
				: null,
			c4OverC3WallMean: c3.wallSummary && c4.wallSummary && c3.wallSummary.meanLuma > 0
				? Number((c4.wallSummary.meanLuma / c3.wallSummary.meanLuma).toFixed(6))
				: null,
			recommendedGikLiftToMatchC3Ratio: c3.surfaceLumaRatio && c4.surfaceLumaRatio > 0
				? Number((c3.surfaceLumaRatio / c4.surfaceLumaRatio).toFixed(6))
				: null
		};
		console.table([
			{ config: 'C3', samples: c3.waitResult.samples, gikMean: c3.gikSummary && c3.gikSummary.meanLuma, wallMean: c3.wallSummary && c3.wallSummary.meanLuma, gikWallRatio: c3.surfaceLumaRatio },
			{ config: 'C4', samples: c4.waitResult.samples, gikMean: c4.gikSummary && c4.gikSummary.meanLuma, wallMean: c4.wallSummary && c4.wallSummary.meanLuma, gikWallRatio: c4.surfaceLumaRatio }
		]);
		return result;
	}
	finally
	{
		if (pathTracingUniforms && pathTracingUniforms.uR73GikWallProbeMode)
			pathTracingUniforms.uR73GikWallProbeMode.value = original.probeMode;
		r73QuickPreviewFillEnabled = original.fillEnabled;
		if (typeof applyPanelConfig === 'function' && original.config > 0)
			applyPanelConfig(original.config);
		var btnB = document.getElementById('btnGroupB');
		if (btnB && original.quickPreviewActive && !btnB.classList.contains('glow-white'))
			btnB.click();
		updateR73QuickPreviewFillUniforms();
		if (typeof wakeRender === 'function')
			wakeRender();
	}
};

function normalizeR738PositiveInt(value, fallback, minValue, maxValue)
{
	var n = Math.trunc(Number(value));
	if (!Number.isFinite(n)) n = fallback;
	n = Math.max(minValue, n);
	if (Number.isFinite(maxValue)) n = Math.min(maxValue, n);
	return n;
}

function createR738FloatRenderTarget(width, height)
{
	var target = new THREE.WebGLRenderTarget(width, height, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		depthBuffer: false,
		stencilBuffer: false
	});
	target.texture.generateMipmaps = false;
	return target;
}

async function readR738RenderTargetFloatPixels(renderTarget)
{
	var width = renderTarget.width;
	var height = renderTarget.height;
	var pixels = new Float32Array(width * height * 4);
	if (renderer && typeof renderer.readRenderTargetPixelsAsync === 'function')
		await renderer.readRenderTargetPixelsAsync(renderTarget, 0, 0, width, height, pixels);
	else
		renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);
	return { width: width, height: height, pixels: pixels };
}

function summarizeR738RawHdrPixels(readback, samples)
{
	var width = readback.width;
	var height = readback.height;
	var pixels = readback.pixels;
	var divisor = Math.max(1, Number(samples) || 1);
	var lumas = [];
	var finitePixels = 0;
	var nonFinitePixels = 0;
	var r = 0;
	var g = 0;
	var b = 0;
	var maxLuma = 0;
	for (var i = 0; i < pixels.length; i += 4)
	{
		var pr = pixels[i] / divisor;
		var pg = pixels[i + 1] / divisor;
		var pb = pixels[i + 2] / divisor;
		if (!Number.isFinite(pr) || !Number.isFinite(pg) || !Number.isFinite(pb))
		{
			nonFinitePixels += 1;
			continue;
		}
		finitePixels += 1;
		r += pr;
		g += pg;
		b += pb;
		var luma = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
		lumas.push(luma);
		if (luma > maxLuma) maxLuma = luma;
	}
	lumas.sort(function(a, bValue) { return a - bValue; });
	var pick = function(q) {
		if (lumas.length === 0) return 0;
		return lumas[Math.min(lumas.length - 1, Math.floor(q * (lumas.length - 1)))];
	};
	var sumLuma = 0;
	for (var j = 0; j < lumas.length; j += 1)
		sumLuma += lumas[j];
	return {
		width: width,
		height: height,
		finitePixels: finitePixels,
		nonFinitePixels: nonFinitePixels,
		meanRgb: finitePixels ? [r / finitePixels, g / finitePixels, b / finitePixels] : [0, 0, 0],
		meanLuma: finitePixels ? sumLuma / finitePixels : 0,
		p50Luma: pick(0.50),
		p90Luma: pick(0.90),
		p99Luma: pick(0.99),
		maxLuma: maxLuma
	};
}

function summarizeR7310AtlasVisibleLuma(atlasPixels)
{
	var texelCount = atlasPixels ? Math.floor(atlasPixels.length / 4) : 0;
	var sumLuma = 0.0;
	var maxLuma = 0.0;
	var nonzeroTexels = 0;
	for (var i = 0; i < texelCount * 4; i += 4)
	{
		var pr = atlasPixels[i];
		var pg = atlasPixels[i + 1];
		var pb = atlasPixels[i + 2];
		if (!Number.isFinite(pr) || !Number.isFinite(pg) || !Number.isFinite(pb))
			continue;
		var luma = (pr + pg + pb) / 3.0;
		sumLuma += luma;
		if (luma > 0.0) nonzeroTexels += 1;
		if (luma > maxLuma) maxLuma = luma;
	}
	return {
		texels: texelCount,
		nonzeroTexels: nonzeroTexels,
		meanLuma: texelCount ? sumLuma / texelCount : 0.0,
		maxLuma: maxLuma
	};
}

function summarizeR7310StructuralIslands(atlasPixels, size)
{
	var islandCoverageByName = {};
	var islandLumaByName = {};
	if (!(atlasPixels instanceof Float32Array) || !Number.isFinite(size) || size <= 0)
		return { islandCoverageByName: islandCoverageByName, islandLumaByName: islandLumaByName };
	for (var islandIndex = 0; islandIndex < R7310_C1_STRUCTURAL_ISLANDS.length; islandIndex += 1)
	{
		var island = R7310_C1_STRUCTURAL_ISLANDS[islandIndex];
		var rect = island.atlasRect;
		var totalTexels = 0;
		var nonzeroTexels = 0;
		var sumLuma = 0.0;
		var maxLuma = 0.0;
		for (var y = 0; y < size; y += 1)
		{
			var v = (y + 0.5) / size;
			if (v < rect.vMin || v > rect.vMax) continue;
			for (var x = 0; x < size; x += 1)
			{
				var u = (x + 0.5) / size;
				if (u < rect.uMin || u > rect.uMax) continue;
				var offset = (y * size + x) * 4;
				var r = atlasPixels[offset];
				var g = atlasPixels[offset + 1];
				var b = atlasPixels[offset + 2];
				if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b))
					continue;
				var luma = (r + g + b) / 3.0;
				totalTexels += 1;
				sumLuma += luma;
				if (luma > 0.0) nonzeroTexels += 1;
				if (luma > maxLuma) maxLuma = luma;
			}
		}
		islandCoverageByName[island.name] = {
			totalTexels: totalTexels,
			validTexels: totalTexels,
			nonzeroTexels: nonzeroTexels,
			validTexelRatio: totalTexels > 0 ? 1.0 : 0.0
		};
		islandLumaByName[island.name] = {
			meanLuma: totalTexels ? sumLuma / totalTexels : 0.0,
			maxLuma: maxLuma,
			nonzeroTexels: nonzeroTexels
		};
	}
	return {
		islandCoverageByName: islandCoverageByName,
		islandLumaByName: islandLumaByName
	};
}

const R738_C1_BAKE_ACCEPTED_PACKAGE_URL = 'docs/data/r7-3-8-c1-bake-accepted-package.json';
const R7310_C1_FLOOR_DIFFUSE_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json';
const R7310_C1_NORTH_WALL_DIFFUSE_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json';
const R7310_C1_EAST_WALL_DIFFUSE_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-east-wall-full-room-diffuse-runtime-package.json';
const R7310_C1_NORTH_WALL_WARDROBE_DIFFUSE_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-north-wall-wardrobe-full-room-diffuse-runtime-package.json';
const R7310_C1_EAST_WALL_WARDROBE_DIFFUSE_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-east-wall-wardrobe-full-room-diffuse-runtime-package.json';
const R7310_C1_SOUTH_WALL_DIFFUSE_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-south-wall-full-room-diffuse-runtime-package.json';
const R7310_C1_CEILING_DIFFUSE_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-ceiling-full-room-diffuse-runtime-package.json';
const R7310_C1_STRUCTURAL_DIFFUSE_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-structural-beams-columns-full-room-diffuse-runtime-package.json';
const R7310_C1_SE_COLUMN_NORTH_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-se-column-north-shadow-runtime-package.json';
const R7310_C1_SE_COLUMN_WEST_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-se-column-west-shadow-runtime-package.json';
const R7310_C1_SOUTH_WALL_AC_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-south-wall-ac-shadow-runtime-package.json';
const R7310_C1_EAST_WALL_BEAM_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-east-wall-beam-shadow-runtime-package.json';
const R7310_C1_EAST_WALL_BEAM_SHADOW_WARDROBE_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-east-wall-beam-shadow-wardrobe-runtime-package.json';
const R7310_C1_SW_COLUMN_NORTH_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-sw-column-north-shadow-runtime-package.json';
const R7310_C1_WEST_WALL_BEAM_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-west-wall-beam-shadow-runtime-package.json';
const R7310_C1_SW_COLUMN_INNER_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-sw-column-inner-shadow-runtime-package.json';
const R7310_C1_WEST_BEAM_INNER_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-west-beam-inner-shadow-runtime-package.json';
const R7310_C1_WEST_BEAM_UNDER_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-west-beam-under-shadow-runtime-package.json';
const R7310_C1_EAST_BEAM_INNER_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-east-beam-inner-shadow-runtime-package.json';
const R7310_C1_EAST_BEAM_UNDER_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-east-beam-under-shadow-runtime-package.json';
const R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-south-window-left-reveal-shadow-runtime-package.json';
const R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-south-window-right-reveal-shadow-runtime-package.json';
const R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-south-window-bottom-reveal-shadow-runtime-package.json';
const R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-south-window-top-reveal-shadow-runtime-package.json';
const R7310_C1_RUNTIME_ATLAS_GRID_COLUMNS = 6;
const R7310_C1_RUNTIME_ATLAS_PATCH_COUNT = 23; // R7-3.10: 22 base slots (0-21) + iron-door reveal slot 22. All 4 sync points MUST use this const; locked by docs/tools/check-r7310-runtime-atlas-patch-count.cjs.
const R7310_C1_FLOOR_TARGET_ID = 1001;
const R7310_C1_FLOOR_SURFACE_NAME = 'c1_floor_full_room';
const R7310_C1_FLOOR_WORLD_BOUNDS = Object.freeze({
	xMin: -2.11,
	xMax: 2.11,
	zMin: -2.074,
	zMax: 3.256,
	y: 0.01
});
const R7310_C1_NORTH_WALL_TARGET_ID = 1002;
const R7310_C1_NORTH_WALL_SURFACE_NAME = 'c1_north_wall';
const R7310_C1_NORTH_WALL_WORLD_BOUNDS = Object.freeze({
	xMin: -2.11,
	xMax: 2.11,
	yMin: 0.0,
	yMax: 2.905,
	z: -1.874
});
const R7310_C1_NORTH_WALL_DOOR_HOLE = Object.freeze({
	xMin: -1.52,
	xMax: -0.73,
	yMin: 0.0,
	yMax: 2.03
});
const R7310_C1_NORTH_WALL_SIDE_WALL_BACKS = Object.freeze({
	westXMax: -1.91,
	eastXMin: 1.91
});
const R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS = Object.freeze({
	west: Object.freeze({
		xMin: -1.908,
		xMax: -1.752,
		yMin: 2.525,
		yMax: 2.905
	}),
	east: Object.freeze({
		xMin: 1.850,
		xMax: 1.908,
		yMin: 2.516,
		yMax: 2.905
	})
});
const R7310_C1_EAST_WALL_TARGET_ID = 1003;
const R7310_C1_EAST_WALL_SURFACE_NAME = 'c1_east_wall';
const R7310_C1_EAST_WALL_WORLD_BOUNDS = Object.freeze({
	zMin: -1.874,
	zMax: 3.056,
	yMin: 0.0,
	yMax: 2.905,
	x: 1.91
});
const R7310_C1_EAST_WALL_SE_COLUMN_HANDOFF_Z_MIN = 2.475;
const R7310_C1_EAST_WALL_BEAM_HANDOFF_Y_MIN = 2.515;
const R7310_C1_EAST_WALL_SE_COLUMN_DEAD_ZONE = Object.freeze({
	zMin: 2.49,
	zMax: 3.056,
	yMin: 0.0,
	yMax: 2.905
});
const R7310_C1_EAST_WALL_BEAM_DEAD_ZONE = Object.freeze({
	zMin: -1.874,
	zMax: 2.49,
	yMin: 2.515,
	yMax: 2.905
});
const R7310_C1_WEST_WALL_DIFFUSE_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-west-wall-full-room-diffuse-runtime-package.json';
const R7310_C1_WEST_WALL_TARGET_ID = 1004;
const R7310_C1_WEST_WALL_SURFACE_NAME = 'c1_west_wall';
const R7310_C1_WEST_WALL_WORLD_BOUNDS = Object.freeze({
	zMin: -1.874,
	zMax: 3.056,
	yMin: 0.0,
	yMax: 2.905,
	x: -1.91
});
const R7310_C1_WEST_WALL_SW_COLUMN_HANDOFF_Z_MIN = 2.7179;
const R7310_C1_WEST_WALL_BEAM_HANDOFF_Y_MIN = 2.515;
const R7310_C1_WEST_WALL_IRON_DOOR_HOLE = Object.freeze({
	zMin: -1.874,
	zMax: -0.984,
	yMin: 0.09,
	yMax: 2.04
});
const R7310_C1_WEST_WALL_SW_COLUMN_DEAD_ZONE = Object.freeze({
	zMin: 2.846,
	zMax: 3.056,
	yMin: 0.0,
	yMax: 2.905
});
const R7310_C1_WEST_WALL_BEAM_DEAD_ZONE = Object.freeze({
	zMin: -1.874,
	zMax: 2.846,
	yMin: 2.525,
	yMax: 2.905
});
const R7310_C1_SOUTH_WALL_TARGET_ID = 1005;
const R7310_C1_SOUTH_WALL_SURFACE_NAME = 'c1_south_wall';
const R7310_C1_SOUTH_WALL_WORLD_BOUNDS = Object.freeze({
	xMin: -2.11,
	xMax: 2.11,
	yMin: 0.0,
	yMax: 2.905,
	z: 3.056
});
const R7310_C1_SOUTH_WALL_WINDOW_HOLE = Object.freeze({
	xMin: -1.75,
	xMax: 0.69,
	yMin: 1.04,
	yMax: 2.905
});
const R7310_C1_SOUTH_WALL_WINDOW_REVEAL = Object.freeze({
	xMin: -1.75,
	xMax: 0.69,
	yMin: 1.04,
	yMax: 2.905,
	zMin: 3.056,
	zMax: 3.256,
	atlas: Object.freeze({
		leftReveal: Object.freeze({ xMin: -1.69, xMax: -1.52, yMin: 1.10, yMax: 2.845 }),
		rightReveal: Object.freeze({ xMin: 0.46, xMax: 0.63, yMin: 1.10, yMax: 2.845 }),
		bottomReveal: Object.freeze({ xMin: -1.52, xMax: 0.46, yMin: 1.10, yMax: 1.27 }),
		topReveal: Object.freeze({ xMin: -1.52, xMax: 0.46, yMin: 2.675, yMax: 2.845 })
	})
});
const R7310_C1_SOUTH_WALL_SW_COLUMN_BACK = Object.freeze({
	xMin: -1.91,
	xMax: -1.75,
	yMin: 0.0,
	yMax: 2.905
});
const R7310_C1_SOUTH_WALL_SE_COLUMN_BACK = Object.freeze({
	xMin: 1.78,
	xMax: 1.91,
	yMin: 0.0,
	yMax: 2.905
});
const R7310_C1_CEILING_TARGET_ID = 1006;
const R7310_C1_CEILING_SURFACE_NAME = 'c1_ceiling';
const R7310_C1_CEILING_WORLD_BOUNDS = Object.freeze({
	xMin: -2.11,
	xMax: 2.11,
	zMin: -2.074,
	zMax: 3.256,
	y: 2.905
});
const R7310_C1_STRUCTURAL_TARGET_ID = 1007;
const R7310_C1_STRUCTURAL_SURFACE_NAME = 'c1_structural_beams_columns';
const R7310_C1_SE_COLUMN_NORTH_SHADOW_TARGET_ID = 1008;
const R7310_C1_SE_COLUMN_NORTH_SHADOW_SURFACE_NAME = 'c1_se_column_north_shadow';
const R7310_C1_SE_COLUMN_NORTH_SHADOW_WORLD_BOUNDS = Object.freeze({
	xMin: 1.78,
	xMax: 1.91,
	yMin: 0.0,
	yMax: 2.905,
	z: 2.49
});
const R7310_C1_SE_COLUMN_NORTH_SHADOW_EAST_BEAM_BACK = Object.freeze({
	xMin: 1.85,
	xMax: 1.91,
	yMin: 2.515,
	yMax: 2.905
});
const R7310_C1_SE_COLUMN_WEST_SHADOW_TARGET_ID = 1009;
const R7310_C1_SE_COLUMN_WEST_SHADOW_SURFACE_NAME = 'c1_se_column_west_shadow';
const R7310_C1_SE_COLUMN_WEST_SHADOW_WORLD_BOUNDS = Object.freeze({
	zMin: 2.49,
	zMax: 3.056,
	yMin: 0.0,
	yMax: 2.905,
	x: 1.78
});
const R7310_C1_SOUTH_WALL_AC_SHADOW_TARGET_ID = 1010;
const R7310_C1_SOUTH_WALL_AC_SHADOW_SURFACE_NAME = 'c1_south_wall_ac_shadow';
const R7310_C1_SOUTH_WALL_AC_SHADOW_WORLD_BOUNDS = Object.freeze({
	xMin: -2.11,
	xMax: 2.11,
	yMin: 0.0,
	yMax: 2.905,
	z: 3.056
});
const R7310_C1_SOUTH_WALL_AC_SHADOW_SE_COLUMN_BACK = Object.freeze({
	xMin: 1.78,
	xMax: 1.91,
	yMin: 0.0,
	yMax: 2.905
});
const R7310_C1_SOUTH_WALL_AC_SHADOW_SW_COLUMN_BACK = Object.freeze({
	xMin: -1.91,
	xMax: -1.75,
	yMin: 0.0,
	yMax: 2.905
});
const R7310_C1_EAST_WALL_BEAM_SHADOW_TARGET_ID = 1011;
const R7310_C1_EAST_WALL_BEAM_SHADOW_SURFACE_NAME = 'c1_east_wall_beam_shadow';
const R7310_C1_EAST_WALL_BEAM_SHADOW_WORLD_BOUNDS = Object.freeze({
	zMin: -1.874,
	zMax: 3.056,
	yMin: 0.0,
	yMax: 2.905,
	x: 1.91
});
const R7310_C1_SW_COLUMN_NORTH_SHADOW_TARGET_ID = 1012;
const R7310_C1_SW_COLUMN_NORTH_SHADOW_SURFACE_NAME = 'c1_sw_column_north_shadow';
const R7310_C1_SW_COLUMN_NORTH_SHADOW_WORLD_BOUNDS = Object.freeze({
	xMin: -1.91,
	xMax: -1.75,
	yMin: 0.0,
	yMax: 2.525,
	z: 2.846
});
const R7310_C1_WEST_WALL_BEAM_SHADOW_TARGET_ID = 1013;
const R7310_C1_WEST_WALL_BEAM_SHADOW_SURFACE_NAME = 'c1_west_wall_beam_shadow';
const R7310_C1_WEST_WALL_BEAM_SHADOW_WORLD_BOUNDS = Object.freeze({
	zMin: -1.874,
	zMax: 3.056,
	yMin: 0.0,
	yMax: 2.905,
	x: -1.91
});
const R7310_C1_SW_COLUMN_INNER_SHADOW_TARGET_ID = 1014;
const R7310_C1_SW_COLUMN_INNER_SHADOW_SURFACE_NAME = 'c1_sw_column_inner_shadow';
const R7310_C1_SW_COLUMN_INNER_SHADOW_WORLD_BOUNDS = Object.freeze({
	zMin: 2.846,
	zMax: 3.256,
	yMin: 0.0,
	yMax: 2.905,
	x: -1.75
});
const R7310_C1_SW_COLUMN_INNER_SHADOW_SOUTH_WALL_BACK = Object.freeze({
	zMin: 3.056,
	zMax: 3.256,
	yMin: 0.0,
	yMax: 2.905
});
const R7310_C1_WEST_BEAM_INNER_SHADOW_TARGET_ID = 1015;
const R7310_C1_WEST_BEAM_INNER_SHADOW_SURFACE_NAME = 'c1_west_beam_inner_shadow';
const R7310_C1_WEST_BEAM_INNER_SHADOW_WORLD_BOUNDS = Object.freeze({
	zMin: -1.874,
	zMax: 2.848,
	yMin: 2.525,
	yMax: 2.905,
	x: -1.75
});
const R7310_C1_WEST_BEAM_UNDER_SHADOW_TARGET_ID = 1016;
const R7310_C1_WEST_BEAM_UNDER_SHADOW_SURFACE_NAME = 'c1_west_beam_under_shadow';
const R7310_C1_WEST_BEAM_UNDER_SHADOW_WORLD_BOUNDS = Object.freeze({
	xMin: -1.91,
	xMax: -1.75,
	zMin: -1.874,
	zMax: 2.846,
	y: 2.525
});
const R7310_C1_EAST_BEAM_INNER_SHADOW_TARGET_ID = 1017;
const R7310_C1_EAST_BEAM_INNER_SHADOW_SURFACE_NAME = 'c1_east_beam_inner_shadow';
const R7310_C1_EAST_BEAM_INNER_SHADOW_WORLD_BOUNDS = Object.freeze({
	zMin: -1.874,
	zMax: 2.49,
	yMin: 2.515,
	yMax: 2.905,
	x: 1.85
});
const R7310_C1_EAST_BEAM_UNDER_SHADOW_TARGET_ID = 1018;
const R7310_C1_EAST_BEAM_UNDER_SHADOW_SURFACE_NAME = 'c1_east_beam_under_shadow';
const R7310_C1_EAST_BEAM_UNDER_SHADOW_WORLD_BOUNDS = Object.freeze({
	xMin: 1.85,
	xMax: 1.91,
	zMin: -1.874,
	zMax: 2.49,
	y: 2.515
});
const R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_TARGET_ID = 1019;
const R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_SURFACE_NAME = 'c1_south_window_left_reveal_shadow';
const R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_WORLD_BOUNDS = Object.freeze({
	yMin: 1.04,
	yMax: 2.905,
	zMin: 3.056,
	zMax: 3.256,
	x: -1.75
});
const R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_TARGET_ID = 1020;
const R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_SURFACE_NAME = 'c1_south_window_right_reveal_shadow';
const R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_WORLD_BOUNDS = Object.freeze({
	yMin: 1.04,
	yMax: 2.905,
	zMin: 3.056,
	zMax: 3.256,
	x: 0.69
});
const R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_TARGET_ID = 1021;
const R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_SURFACE_NAME = 'c1_south_window_bottom_reveal_shadow';
const R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_WORLD_BOUNDS = Object.freeze({
	xMin: -1.75,
	xMax: 0.69,
	zMin: 3.056,
	zMax: 3.256,
	y: 1.04
});
const R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_TARGET_ID = 1022;
const R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_SURFACE_NAME = 'c1_south_window_top_reveal_shadow';
const R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_WORLD_BOUNDS = Object.freeze({
	xMin: -1.75,
	xMax: 0.69,
	zMin: 3.056,
	zMax: 3.256,
	y: 2.905
});
// R7-3.10 iron-door reveal — ONE combined dedicated surface (4 opening reveal faces packed into 4 atlas v-bands).
// Guard-band contract (CODEX): BAND_H / GUARD_V MUST equal the shader consts (IRON_DOOR_REVEAL_BAND_H / _GUARD_V);
// the metadata builder marks each band's guard rows invalid and the atlas->world core mapping mirrors the shader UV.
const R7310_C1_IRON_DOOR_REVEAL_TARGET_ID = 1023;
const R7310_C1_IRON_DOOR_REVEAL_SURFACE_NAME = 'c1_iron_door_reveal';
const R7310_C1_IRON_DOOR_REVEAL_ATLAS_SLOT = 22;
const R7310_C1_IRON_DOOR_REVEAL_BAND_H = 0.25;   // MUST match shader IRON_DOOR_REVEAL_BAND_H
const R7310_C1_IRON_DOOR_REVEAL_GUARD_V = 0.04;  // MUST match shader IRON_DOOR_REVEAL_GUARD_V
const R7310_C1_IRON_DOOR_REVEAL_RUNTIME_PACKAGE_URL = 'docs/data/r7-3-10-c1-iron-door-reveal-runtime-package.json?v=r7310-iron-door-reveal-bakepoint-v2';
const R7310_C1_IRON_DOOR_REVEAL_WORLD_BOUNDS = Object.freeze({
	xMin: -1.96,
	xMax: -1.91,
	yMin: 0.09,
	yMax: 2.04,
	zMin: -1.874,
	zMax: -0.984
});
function r7310C1InsideRectZY(z, y, rect)
{
	return z >= rect.zMin && z <= rect.zMax && y >= rect.yMin && y <= rect.yMax;
}
function r7310C1InsideRectXY(x, y, rect)
{
	return x >= rect.xMin && x <= rect.xMax && y >= rect.yMin && y <= rect.yMax;
}
function r7310C1NorthWallHiddenBySideWall(x)
{
	return x <= R7310_C1_NORTH_WALL_SIDE_WALL_BACKS.westXMax ||
		x >= R7310_C1_NORTH_WALL_SIDE_WALL_BACKS.eastXMin;
}
function r7310C1NorthWallHiddenByBeamGap(x, y)
{
	return r7310C1InsideRectXY(x, y, R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS.west) ||
		r7310C1InsideRectXY(x, y, R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS.east);
}
function r7310C1SouthWallHiddenBySideColumn(x, y)
{
	return r7310C1InsideRectXY(x, y, R7310_C1_SOUTH_WALL_SW_COLUMN_BACK) ||
		r7310C1InsideRectXY(x, y, R7310_C1_SOUTH_WALL_SE_COLUMN_BACK);
}
function r7310C1SouthWallAcShadowHiddenBySideColumn(x, y)
{
	return r7310C1InsideRectXY(x, y, R7310_C1_SOUTH_WALL_AC_SHADOW_SW_COLUMN_BACK) ||
		r7310C1InsideRectXY(x, y, R7310_C1_SOUTH_WALL_AC_SHADOW_SE_COLUMN_BACK);
}
function r7310C1SwColumnInnerHiddenBySouthWall(z, y)
{
	return r7310C1InsideRectZY(z, y, R7310_C1_SW_COLUMN_INNER_SHADOW_SOUTH_WALL_BACK);
}
function r7310C1EastWallHiddenByBeamOrSeColumn(z, y)
{
	return r7310C1InsideRectZY(z, y, R7310_C1_EAST_WALL_SE_COLUMN_DEAD_ZONE) ||
		r7310C1InsideRectZY(z, y, R7310_C1_EAST_WALL_BEAM_DEAD_ZONE);
}
function r7310C1WestWallHiddenByBeamOrSwColumn(z, y)
{
	return r7310C1InsideRectZY(z, y, R7310_C1_WEST_WALL_SW_COLUMN_DEAD_ZONE) ||
		r7310C1InsideRectZY(z, y, R7310_C1_WEST_WALL_BEAM_DEAD_ZONE);
}
const R7310_C1_STRUCTURAL_ISLANDS = Object.freeze([
	Object.freeze({
		name: 'west_beam_inner_x',
		atlasRect: Object.freeze({ uMin: 0.0, vMin: 0.0, uMax: 0.5, vMax: 0.17 }),
		worldFace: Object.freeze({ axis: 'x', value: -1.75, yMin: 2.525, yMax: 2.905, zMin: -1.874, zMax: 2.848 }),
		normal: '+X',
		axes: Object.freeze({ u: 'z', v: 'y' })
	}),
	Object.freeze({
		name: 'west_beam_under_y',
		atlasRect: Object.freeze({ uMin: 0.0, vMin: 0.18, uMax: 0.5, vMax: 0.26 }),
		worldFace: Object.freeze({ axis: 'y', value: 2.525, xMin: -1.91, xMax: -1.75, zMin: -1.874, zMax: 2.846 }),
		normal: '-Y',
		axes: Object.freeze({ u: 'z', v: 'x' })
	}),
	Object.freeze({
		name: 'east_beam_inner_x',
		atlasRect: Object.freeze({ uMin: 0.0, vMin: 0.27, uMax: 0.5, vMax: 0.44 }),
		worldFace: Object.freeze({ axis: 'x', value: 1.85, yMin: 2.515, yMax: 2.905, zMin: -1.874, zMax: 2.49 }),
		normal: '-X',
		axes: Object.freeze({ u: 'z', v: 'y' })
	}),
	Object.freeze({
		name: 'east_beam_under_y',
		atlasRect: Object.freeze({ uMin: 0.0, vMin: 0.45, uMax: 0.5, vMax: 0.53 }),
		worldFace: Object.freeze({ axis: 'y', value: 2.515, xMin: 1.85, xMax: 1.91, zMin: -1.874, zMax: 2.49 }),
		normal: '-Y',
		axes: Object.freeze({ u: 'z', v: 'x' })
	}),
	Object.freeze({
		name: 'sw_column_inner_x',
		atlasRect: Object.freeze({ uMin: 0.52, vMin: 0.0, uMax: 0.74, vMax: 0.36 }),
		worldFace: Object.freeze({ axis: 'x', value: -1.75, yMin: 0.0, yMax: 2.905, zMin: 2.846, zMax: 3.056 }),
		normal: '+X',
		axes: Object.freeze({ u: 'z', v: 'y' })
	}),
	Object.freeze({
		name: 'sw_column_north_z',
		atlasRect: Object.freeze({ uMin: 0.76, vMin: 0.0, uMax: 0.94, vMax: 0.36 }),
		worldFace: Object.freeze({ axis: 'z', value: 2.846, xMin: -1.91, xMax: -1.75, yMin: 0.0, yMax: 2.525 }),
		normal: '-Z',
		axes: Object.freeze({ u: 'x', v: 'y' })
	}),
	Object.freeze({
		name: 'se_column_inner_x',
		atlasRect: Object.freeze({ uMin: 0.52, vMin: 0.38, uMax: 0.74, vMax: 0.76 }),
		worldFace: Object.freeze({ axis: 'x', value: 1.78, yMin: 0.0, yMax: 2.905, zMin: 2.49, zMax: 3.056 }),
		normal: '-X',
		axes: Object.freeze({ u: 'z', v: 'y' })
	}),
	Object.freeze({
		name: 'se_column_north_z',
		atlasRect: Object.freeze({ uMin: 0.0, vMin: 0.88, uMax: 1.0, vMax: 1.0 }),
		worldFace: Object.freeze({ axis: 'z', value: 2.49, xMin: 1.78, xMax: 1.91, yMin: 0.0, yMax: 2.905 }),
		normal: '-Z',
		axes: Object.freeze({ u: 'y', v: 'x' })
	})
]);
const R7310_C1_STRUCTURAL_EXCLUDED_CONTACT_FACES = Object.freeze([
	'east_beam_under_y wall-overlap y=2.515, x=1.91..MAX_X, z=-1.874..3.056',
	'east_beam_inner_x southeast-column overlap x=1.85, y=2.515..2.905, z=2.49..3.056',
	'east_beam_under_y southeast-column overlap y=2.515, x=1.85..1.91, z=2.49..3.056',
	'se_column_north_z east-beam overlap z=2.49, x=1.85..1.91, y=2.515..2.905',
	'se_column_inner_x southeast-bookshelf overlap x=1.78, y=0..2.04, z=2.73..3.056',
	'west_beam_under_y southwest-column overlap y=2.525, x=-1.91..-1.75, z=2.846..2.848',
	'sw_column_north_z west-beam internal contact z=2.846, x=-1.91..-1.75, y=2.525..2.905'
]);
const R7310_C1_STRUCTURAL_GEOMETRY_GATE_REPORT = Object.freeze({
	status: 'pass',
	finalIslandCount: 8,
	finalIslandRegistry: R7310_C1_STRUCTURAL_ISLANDS,
	excludedContactFaces: R7310_C1_STRUCTURAL_EXCLUDED_CONTACT_FACES
});
const R739_C1_ACCURATE_REFLECTION_ACCEPTED_PACKAGE_URL = 'docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json';
const R739_C1_SPROUT_REFLECTION_BOUNDS = Object.freeze({ xMin: -1.0, xMax: 1.0, zMin: -1.0, zMax: 1.0, y: 0.01 });
let r738C1BakePastePreviewEnabled = true;
let r738C1BakePastePreviewReady = false;
let r738C1BakePastePreviewLoadPromise = null;
let r738C1BakePastePreviewPackage = null;
let r738C1BakePastePreviewError = null;
let r738C1BakePastePreviewTexture = null;
let r738C1BakePastePreviewStrength = 1.0;
let r7310C1FullRoomDiffuseRuntimeEnabled = true;
let r7310C1FullRoomDiffuseRuntimeReady = false;
let r7310C1FullRoomDiffuseRuntimeLoadPromise = null;
let r7310C1FullRoomDiffuseRuntimePackage = null;
let r7310C1FloorDiffuseRuntimePixels = null;
let r7310C1FullRoomDiffuseRuntimeTexture = null;
let r7310C1FullRoomDiffuseRuntimeError = null;
let r7310C1FloorDiffuseRuntimeEnabled = true;
let r7310C1NortheastFurnitureRuntimeMode = 'bed';
let r7310C1NorthWallDiffuseRuntimeEnabled = true;
let r7310C1NorthWallDiffuseRuntimeReady = false;
let r7310C1NorthWallDiffuseRuntimeLoadPromise = null;
let r7310C1NorthWallDiffuseRuntimePackage = null;
let r7310C1NorthWallDiffuseRuntimeTexture = null;
let r7310C1NorthWallDiffuseRuntimeError = null;
let r7310C1NorthWallWardrobeDiffuseRuntimeReady = false;
let r7310C1NorthWallWardrobeDiffuseRuntimeLoadPromise = null;
let r7310C1NorthWallWardrobeDiffuseRuntimePackage = null;
let r7310C1NorthWallWardrobeDiffuseRuntimeTexture = null;
let r7310C1NorthWallWardrobeDiffuseRuntimeError = null;
let r7310C1EastWallDiffuseRuntimeEnabled = true;
let r7310C1EastWallDiffuseRuntimeReady = false;
let r7310C1EastWallDiffuseRuntimeLoadPromise = null;
let r7310C1EastWallDiffuseRuntimePackage = null;
let r7310C1EastWallDiffuseRuntimeTexture = null;
let r7310C1EastWallDiffuseRuntimeError = null;
let r7310C1EastWallWardrobeDiffuseRuntimeReady = false;
let r7310C1EastWallWardrobeDiffuseRuntimeLoadPromise = null;
let r7310C1EastWallWardrobeDiffuseRuntimePackage = null;
let r7310C1EastWallWardrobeDiffuseRuntimeTexture = null;
let r7310C1EastWallWardrobeDiffuseRuntimeError = null;
let r7310C1WestWallDiffuseRuntimeEnabled = true;
let r7310C1WestWallDiffuseRuntimeReady = false;
let r7310C1WestWallDiffuseRuntimeLoadPromise = null;
let r7310C1WestWallDiffuseRuntimePackage = null;
let r7310C1WestWallDiffuseRuntimeTexture = null;
let r7310C1WestWallDiffuseRuntimeError = null;
let r7310C1SouthWallDiffuseRuntimeEnabled = true;
let r7310C1SouthWallDiffuseRuntimeReady = false;
let r7310C1SouthWallDiffuseRuntimeLoadPromise = null;
let r7310C1SouthWallDiffuseRuntimePackage = null;
let r7310C1SouthWallDiffuseRuntimeTexture = null;
let r7310C1SouthWallDiffuseRuntimeError = null;
let r7310C1CeilingDiffuseRuntimeEnabled = true;
let r7310C1CeilingDiffuseRuntimeReady = false;
let r7310C1CeilingDiffuseRuntimeLoadPromise = null;
let r7310C1CeilingDiffuseRuntimePackage = null;
let r7310C1CeilingDiffuseRuntimeTexture = null;
let r7310C1CeilingDiffuseRuntimeError = null;
let r7310C1StructuralDiffuseRuntimeEnabled = true;
let r7310C1StructuralDiffuseRuntimePending = true;
let r7310C1StructuralDiffuseRuntimeReady = false;
let r7310C1StructuralDiffuseRuntimeLoadPromise = null;
let r7310C1StructuralDiffuseRuntimePackage = null;
let r7310C1StructuralDiffuseRuntimeTexture = null;
let r7310C1StructuralDiffuseRuntimeError = null;
let r7310C1SeColumnNorthShadowRuntimeEnabled = true;
let r7310C1SeColumnNorthShadowRuntimePending = true;
let r7310C1SeColumnNorthShadowRuntimeReady = false;
let r7310C1SeColumnNorthShadowRuntimeLoadPromise = null;
let r7310C1SeColumnNorthShadowRuntimePackage = null;
let r7310C1SeColumnNorthShadowRuntimeTexture = null;
let r7310C1SeColumnNorthShadowRuntimeDataTexture = null;
let r7310C1SeColumnNorthShadowRuntimeError = null;
let r7310C1SeColumnWestShadowRuntimeEnabled = true;
let r7310C1SeColumnWestShadowRuntimePending = true;
let r7310C1SeColumnWestShadowRuntimeReady = false;
let r7310C1SeColumnWestShadowRuntimeLoadPromise = null;
let r7310C1SeColumnWestShadowRuntimePackage = null;
let r7310C1SeColumnWestShadowRuntimeTexture = null;
let r7310C1SeColumnWestShadowRuntimeDataTexture = null;
let r7310C1SeColumnWestShadowRuntimeError = null;
let r7310C1SouthWallAcShadowRuntimeEnabled = true;
let r7310C1SouthWallAcShadowRuntimePending = true;
let r7310C1SouthWallAcShadowRuntimeReady = false;
let r7310C1SouthWallAcShadowRuntimeLoadPromise = null;
let r7310C1SouthWallAcShadowRuntimePackage = null;
let r7310C1SouthWallAcShadowRuntimeTexture = null;
let r7310C1SouthWallAcShadowRuntimeDataTexture = null;
let r7310C1SouthWallAcShadowRuntimeError = null;
let r7310C1EastWallBeamShadowRuntimeEnabled = true;
let r7310C1EastWallBeamShadowRuntimePending = true;
let r7310C1EastWallBeamShadowRuntimeReady = false;
let r7310C1EastWallBeamShadowRuntimeLoadPromise = null;
let r7310C1EastWallBeamShadowRuntimePackage = null;
let r7310C1EastWallBeamShadowRuntimeTexture = null;
let r7310C1EastWallBeamShadowRuntimeDataTexture = null;
let r7310C1EastWallBeamShadowRuntimeError = null;
let r7310C1EastWallBeamShadowWardrobeRuntimePending = true;
let r7310C1EastWallBeamShadowWardrobeRuntimeReady = false;
let r7310C1EastWallBeamShadowWardrobeRuntimeLoadPromise = null;
let r7310C1EastWallBeamShadowWardrobeRuntimePackage = null;
let r7310C1EastWallBeamShadowWardrobeRuntimeTexture = null;
let r7310C1EastWallBeamShadowWardrobeRuntimeDataTexture = null;
let r7310C1EastWallBeamShadowWardrobeRuntimeError = null;
let r7310C1SwColumnNorthShadowRuntimeEnabled = true;
let r7310C1SwColumnNorthShadowRuntimePending = true;
let r7310C1SwColumnNorthShadowRuntimeReady = false;
let r7310C1SwColumnNorthShadowRuntimeLoadPromise = null;
let r7310C1SwColumnNorthShadowRuntimePackage = null;
let r7310C1SwColumnNorthShadowRuntimeTexture = null;
let r7310C1SwColumnNorthShadowRuntimeDataTexture = null;
let r7310C1SwColumnNorthShadowRuntimeError = null;
let r7310C1WestWallBeamShadowRuntimeEnabled = true;
let r7310C1WestWallBeamShadowRuntimePending = true;
let r7310C1WestWallBeamShadowRuntimeReady = false;
let r7310C1WestWallBeamShadowRuntimeLoadPromise = null;
let r7310C1WestWallBeamShadowRuntimePackage = null;
let r7310C1WestWallBeamShadowRuntimeTexture = null;
let r7310C1WestWallBeamShadowRuntimeDataTexture = null;
let r7310C1WestWallBeamShadowRuntimeError = null;
let r7310C1SwColumnInnerShadowRuntimeEnabled = true;
let r7310C1SwColumnInnerShadowRuntimePending = true;
let r7310C1SwColumnInnerShadowRuntimeReady = false;
let r7310C1SwColumnInnerShadowRuntimeLoadPromise = null;
let r7310C1SwColumnInnerShadowRuntimePackage = null;
let r7310C1SwColumnInnerShadowRuntimeTexture = null;
let r7310C1SwColumnInnerShadowRuntimeDataTexture = null;
let r7310C1SwColumnInnerShadowRuntimeError = null;
let r7310C1WestBeamInnerShadowRuntimeEnabled = true;
let r7310C1WestBeamInnerShadowRuntimePending = true;
let r7310C1WestBeamInnerShadowRuntimeReady = false;
let r7310C1WestBeamInnerShadowRuntimeLoadPromise = null;
let r7310C1WestBeamInnerShadowRuntimePackage = null;
let r7310C1WestBeamInnerShadowRuntimeTexture = null;
let r7310C1WestBeamInnerShadowRuntimeDataTexture = null;
let r7310C1WestBeamInnerShadowRuntimeError = null;
let r7310C1WestBeamUnderShadowRuntimeEnabled = true;
let r7310C1WestBeamUnderShadowRuntimePending = true;
let r7310C1WestBeamUnderShadowRuntimeReady = false;
let r7310C1WestBeamUnderShadowRuntimeLoadPromise = null;
let r7310C1WestBeamUnderShadowRuntimePackage = null;
let r7310C1WestBeamUnderShadowRuntimeTexture = null;
let r7310C1WestBeamUnderShadowRuntimeDataTexture = null;
let r7310C1WestBeamUnderShadowRuntimeError = null;
let r7310C1EastBeamInnerShadowRuntimeEnabled = true;
let r7310C1EastBeamInnerShadowRuntimePending = true;
let r7310C1EastBeamInnerShadowRuntimeReady = false;
let r7310C1EastBeamInnerShadowRuntimeLoadPromise = null;
let r7310C1EastBeamInnerShadowRuntimePackage = null;
let r7310C1EastBeamInnerShadowRuntimeTexture = null;
let r7310C1EastBeamInnerShadowRuntimeDataTexture = null;
let r7310C1EastBeamInnerShadowRuntimeError = null;
let r7310C1EastBeamUnderShadowRuntimeEnabled = true;
let r7310C1EastBeamUnderShadowRuntimePending = true;
let r7310C1EastBeamUnderShadowRuntimeReady = false;
let r7310C1EastBeamUnderShadowRuntimeLoadPromise = null;
let r7310C1EastBeamUnderShadowRuntimePackage = null;
let r7310C1EastBeamUnderShadowRuntimeTexture = null;
let r7310C1EastBeamUnderShadowRuntimeDataTexture = null;
let r7310C1EastBeamUnderShadowRuntimeError = null;
let r7310C1SouthWindowLeftRevealShadowRuntimeEnabled = true;
let r7310C1SouthWindowLeftRevealShadowRuntimePending = true;
let r7310C1SouthWindowLeftRevealShadowRuntimeReady = false;
let r7310C1SouthWindowLeftRevealShadowRuntimeLoadPromise = null;
let r7310C1SouthWindowLeftRevealShadowRuntimePackage = null;
let r7310C1SouthWindowLeftRevealShadowRuntimeTexture = null;
let r7310C1SouthWindowLeftRevealShadowRuntimeDataTexture = null;
let r7310C1SouthWindowLeftRevealShadowRuntimeError = null;
let r7310C1SouthWindowRightRevealShadowRuntimeEnabled = true;
let r7310C1SouthWindowRightRevealShadowRuntimePending = true;
let r7310C1SouthWindowRightRevealShadowRuntimeReady = false;
let r7310C1SouthWindowRightRevealShadowRuntimeLoadPromise = null;
let r7310C1SouthWindowRightRevealShadowRuntimePackage = null;
let r7310C1SouthWindowRightRevealShadowRuntimeTexture = null;
let r7310C1SouthWindowRightRevealShadowRuntimeDataTexture = null;
let r7310C1SouthWindowRightRevealShadowRuntimeError = null;
let r7310C1SouthWindowBottomRevealShadowRuntimeEnabled = true;
let r7310C1SouthWindowBottomRevealShadowRuntimePending = true;
let r7310C1SouthWindowBottomRevealShadowRuntimeReady = false;
let r7310C1SouthWindowBottomRevealShadowRuntimeLoadPromise = null;
let r7310C1SouthWindowBottomRevealShadowRuntimePackage = null;
let r7310C1SouthWindowBottomRevealShadowRuntimeTexture = null;
let r7310C1SouthWindowBottomRevealShadowRuntimeDataTexture = null;
let r7310C1SouthWindowBottomRevealShadowRuntimeError = null;
let r7310C1SouthWindowTopRevealShadowRuntimeEnabled = true;
let r7310C1SouthWindowTopRevealShadowRuntimePending = true;
let r7310C1SouthWindowTopRevealShadowRuntimeReady = false;
let r7310C1SouthWindowTopRevealShadowRuntimeLoadPromise = null;
let r7310C1SouthWindowTopRevealShadowRuntimePackage = null;
let r7310C1SouthWindowTopRevealShadowRuntimeTexture = null;
let r7310C1SouthWindowTopRevealShadowRuntimeDataTexture = null;
let r7310C1SouthWindowTopRevealShadowRuntimeError = null;
let r7310C1IronDoorRevealRuntimeEnabled = true;
let r7310C1IronDoorRevealRuntimePending = true;
let r7310C1IronDoorRevealRuntimeReady = false;
let r7310C1IronDoorRevealRuntimeLoadPromise = null;
let r7310C1IronDoorRevealRuntimePackage = null;
let r7310C1IronDoorRevealRuntimeTexture = null;
let r7310C1IronDoorRevealRuntimeDataTexture = null;
let r7310C1IronDoorRevealRuntimeError = null;
let r739C1AccurateReflectionEnabled = false;
let r739C1AccurateReflectionReady = false;
let r739C1AccurateReflectionLoadPromise = null;
let r739C1AccurateReflectionPackage = null;
let r739C1AccurateReflectionError = null;
let r739C1AccurateReflectionTexture = null;
let r739C1CurrentViewReflectionPreviewEnabled = false;
let r739C1CurrentViewReflectionValidationEnabled = false;
let r739C1CurrentViewReflectionReady = false;
let r739C1CurrentViewReflectionError = null;
let r739C1CurrentViewReflectionRoughness = 0.1;
let r739SproutABMode = 'A';

const R739_C1_CURRENT_VIEW_VALIDATION_CAMERA_STATES = Object.freeze([
	{
		name: 'center_forward',
		position: { x: 0.0, y: 1.6, z: 4.5 },
		yaw: 0.0,
		pitch: -0.18,
		fov: 55
	},
	{
		name: 'left_forward',
		position: { x: -1.8, y: 1.6, z: 4.0 },
		yaw: 0.42,
		pitch: -0.36,
		fov: 55
	},
	{
		name: 'left_mid_forward',
		position: { x: -1.2, y: 1.55, z: 4.0 },
		yaw: 0.20,
		pitch: -0.20,
		fov: 55
	},
	{
		name: 'left_wide_forward',
		position: { x: -1.6, y: 1.55, z: 4.4 },
		yaw: 0.25,
		pitch: -0.18,
		fov: 55
	},
	{
		name: 'center_left_forward',
		position: { x: -0.6, y: 1.55, z: 4.2 },
		yaw: 0.10,
		pitch: -0.18,
		fov: 55
	}
]);

const R739_C1_CURRENT_VIEW_VALIDATION_SWEEP_STATES = Object.freeze([
	{ name: 'sweep_00', position: { x: -1.8, y: 1.60, z: 4.0 }, yaw: 0.42, pitch: -0.36, fov: 55 },
	{ name: 'sweep_01', position: { x: -1.6, y: 1.55, z: 4.4 }, yaw: 0.25, pitch: -0.18, fov: 55 },
	{ name: 'sweep_02', position: { x: -1.4, y: 1.55, z: 4.2 }, yaw: 0.23, pitch: -0.18, fov: 55 },
	{ name: 'sweep_03', position: { x: -1.2, y: 1.55, z: 4.0 }, yaw: 0.20, pitch: -0.20, fov: 55 },
	{ name: 'sweep_04', position: { x: -1.0, y: 1.55, z: 4.1 }, yaw: 0.17, pitch: -0.18, fov: 55 },
	{ name: 'sweep_05', position: { x: -0.8, y: 1.55, z: 4.2 }, yaw: 0.14, pitch: -0.18, fov: 55 },
	{ name: 'sweep_06', position: { x: -0.6, y: 1.55, z: 4.2 }, yaw: 0.10, pitch: -0.18, fov: 55 },
	{ name: 'sweep_07', position: { x: -0.3, y: 1.58, z: 4.4 }, yaw: 0.05, pitch: -0.18, fov: 55 },
	{ name: 'sweep_08', position: { x: 0.0, y: 1.60, z: 4.5 }, yaw: 0.0, pitch: -0.18, fov: 55 }
]);

function r738C1BakePastePreviewConfigAllowed()
{
	var config = (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0;
	return config === 1;
}

function r7310C1FloorToggleOwnsSproutPaste()
{
	return r7310C1FullRoomDiffuseRuntimeConfigAllowed();
}

function updateR738C1BakePastePreviewUniforms()
{
	if (!pathTracingUniforms) return false;
	var captureMode = pathTracingUniforms.uR738C1BakeCaptureMode ? pathTracingUniforms.uR738C1BakeCaptureMode.value : 0;
	var disabledByR7310FloorToggle = r7310C1FloorToggleOwnsSproutPaste();
	var applied = r738C1BakePastePreviewEnabled &&
		r738C1BakePastePreviewReady &&
		r738C1BakePastePreviewConfigAllowed() &&
		captureMode === 0 &&
		!disabledByR7310FloorToggle;
	if (pathTracingUniforms.uR738C1BakePastePreviewMode)
		pathTracingUniforms.uR738C1BakePastePreviewMode.value = applied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR738C1BakePastePreviewReady)
		pathTracingUniforms.uR738C1BakePastePreviewReady.value = r738C1BakePastePreviewReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR738C1BakePastePreviewStrength)
		pathTracingUniforms.uR738C1BakePastePreviewStrength.value = r738C1BakePastePreviewStrength;
	if (r738C1BakePastePreviewTexture && pathTracingUniforms.tR738C1BakeAtlasTexture)
		pathTracingUniforms.tR738C1BakeAtlasTexture.value = r738C1BakePastePreviewTexture;
	if (r738C1BakePastePreviewPackage && r738C1BakePastePreviewPackage.worldBounds && pathTracingUniforms.uR738C1BakePatchWorldBounds)
	{
		var b = r738C1BakePastePreviewPackage.worldBounds;
		pathTracingUniforms.uR738C1BakePatchWorldBounds.value.set(b.xMin, b.xMax, b.zMin, b.zMax);
	}
	if (pathTracingUniforms.uR738C1BakePatchResolution && r738C1BakePastePreviewPackage)
		pathTracingUniforms.uR738C1BakePatchResolution.value = r738C1BakePastePreviewPackage.targetAtlasResolution || 512;
	return applied;
}

function r7310C1FullRoomDiffuseRuntimeConfigAllowed()
{
	var config = (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0;
	return config === 1;
}

function r7310C1AnyFullRoomDiffuseSurfaceEnabled()
{
	return r7310C1FloorDiffuseRuntimeEnabled ||
		r7310C1NorthWallDiffuseRuntimeEnabled ||
		r7310C1EastWallDiffuseRuntimeEnabled ||
		r7310C1WestWallDiffuseRuntimeEnabled ||
		r7310C1SouthWallDiffuseRuntimeEnabled ||
		r7310C1CeilingDiffuseRuntimeEnabled ||
		r7310C1StructuralDiffuseRuntimeEnabled ||
		r7310C1SeColumnNorthShadowRuntimeEnabled ||
		r7310C1SeColumnWestShadowRuntimeEnabled ||
		r7310C1SouthWallAcShadowRuntimeEnabled ||
		r7310C1EastWallBeamShadowRuntimeEnabled ||
		r7310C1SwColumnNorthShadowRuntimeEnabled ||
		r7310C1WestWallBeamShadowRuntimeEnabled ||
		r7310C1SwColumnInnerShadowRuntimeEnabled ||
		r7310C1WestBeamInnerShadowRuntimeEnabled ||
		r7310C1WestBeamUnderShadowRuntimeEnabled ||
		r7310C1EastBeamInnerShadowRuntimeEnabled ||
		r7310C1EastBeamUnderShadowRuntimeEnabled ||
		r7310C1SouthWindowLeftRevealShadowRuntimeEnabled ||
		r7310C1SouthWindowRightRevealShadowRuntimeEnabled ||
		r7310C1SouthWindowBottomRevealShadowRuntimeEnabled ||
		r7310C1SouthWindowTopRevealShadowRuntimeEnabled;
}

function updateR7310C1FullRoomDiffuseRuntimeUniforms()
{
	if (!pathTracingUniforms) return false;
	var captureMode = pathTracingUniforms.uR738C1BakeCaptureMode ? pathTracingUniforms.uR738C1BakeCaptureMode.value : 0;
	var configAllowed = r7310C1FullRoomDiffuseRuntimeConfigAllowed();
	var floorApplied = r7310C1FloorDiffuseRuntimeEnabled &&
		r7310C1FullRoomDiffuseRuntimeReady &&
		configAllowed &&
		captureMode === 0;
	var northWallApplied = r7310C1NorthWallDiffuseRuntimeEnabled &&
		r7310C1NorthWallActiveDiffuseRuntimeReady() &&
		configAllowed &&
		captureMode === 0;
	var eastWallApplied = r7310C1EastWallDiffuseRuntimeEnabled &&
		r7310C1EastWallActiveDiffuseRuntimeReady() &&
		configAllowed &&
		captureMode === 0;
	var westWallApplied = r7310C1WestWallDiffuseRuntimeEnabled &&
		r7310C1WestWallDiffuseRuntimeReady &&
		configAllowed &&
		captureMode === 0;
	var southWallApplied = r7310C1SouthWallDiffuseRuntimeEnabled &&
		r7310C1SouthWallDiffuseRuntimeReady &&
		configAllowed &&
		captureMode === 0;
	var ceilingApplied = r7310C1CeilingDiffuseRuntimeEnabled &&
		r7310C1CeilingDiffuseRuntimeReady &&
		configAllowed &&
		captureMode === 0;
	var structuralApplied = r7310C1StructuralDiffuseRuntimeEnabled &&
		r7310C1StructuralDiffuseRuntimeReady &&
		!r7310C1StructuralDiffuseRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var seColumnNorthShadowApplied = r7310C1SeColumnNorthShadowRuntimeEnabled &&
		r7310C1SeColumnNorthShadowRuntimeReady &&
		!r7310C1SeColumnNorthShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var seColumnWestShadowApplied = r7310C1SeColumnWestShadowRuntimeEnabled &&
		r7310C1SeColumnWestShadowRuntimeReady &&
		!r7310C1SeColumnWestShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var southWallAcShadowApplied = r7310C1SouthWallAcShadowRuntimeEnabled &&
		r7310C1SouthWallAcShadowRuntimeReady &&
		!r7310C1SouthWallAcShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var eastWallBeamShadowApplied = r7310C1EastWallBeamShadowRuntimeEnabled &&
		r7310C1EastWallBeamShadowActiveRuntimeReady() &&
		!r7310C1EastWallBeamShadowActiveRuntimePending() &&
		configAllowed &&
		captureMode === 0;
	var swColumnNorthShadowApplied = r7310C1SwColumnNorthShadowRuntimeEnabled &&
		r7310C1SwColumnNorthShadowRuntimeReady &&
		!r7310C1SwColumnNorthShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var westWallBeamShadowApplied = r7310C1WestWallBeamShadowRuntimeEnabled &&
		r7310C1WestWallBeamShadowRuntimeReady &&
		!r7310C1WestWallBeamShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var swColumnInnerShadowApplied = r7310C1SwColumnInnerShadowRuntimeEnabled &&
		r7310C1SwColumnInnerShadowRuntimeReady &&
		!r7310C1SwColumnInnerShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var westBeamInnerShadowApplied = r7310C1WestBeamInnerShadowRuntimeEnabled &&
		r7310C1WestBeamInnerShadowRuntimeReady &&
		!r7310C1WestBeamInnerShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var westBeamUnderShadowApplied = r7310C1WestBeamUnderShadowRuntimeEnabled &&
		r7310C1WestBeamUnderShadowRuntimeReady &&
		!r7310C1WestBeamUnderShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var eastBeamInnerShadowApplied = r7310C1EastBeamInnerShadowRuntimeEnabled &&
		r7310C1EastBeamInnerShadowRuntimeReady &&
		!r7310C1EastBeamInnerShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var eastBeamUnderShadowApplied = r7310C1EastBeamUnderShadowRuntimeEnabled &&
		r7310C1EastBeamUnderShadowRuntimeReady &&
		!r7310C1EastBeamUnderShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var southWindowLeftRevealShadowApplied = r7310C1SouthWindowLeftRevealShadowRuntimeEnabled &&
		r7310C1SouthWindowLeftRevealShadowRuntimeReady &&
		!r7310C1SouthWindowLeftRevealShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var southWindowRightRevealShadowApplied = r7310C1SouthWindowRightRevealShadowRuntimeEnabled &&
		r7310C1SouthWindowRightRevealShadowRuntimeReady &&
		!r7310C1SouthWindowRightRevealShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var southWindowBottomRevealShadowApplied = r7310C1SouthWindowBottomRevealShadowRuntimeEnabled &&
		r7310C1SouthWindowBottomRevealShadowRuntimeReady &&
		!r7310C1SouthWindowBottomRevealShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var southWindowTopRevealShadowApplied = r7310C1SouthWindowTopRevealShadowRuntimeEnabled &&
		r7310C1SouthWindowTopRevealShadowRuntimeReady &&
		!r7310C1SouthWindowTopRevealShadowRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var ironDoorRevealApplied = r7310C1IronDoorRevealRuntimeEnabled &&
		r7310C1IronDoorRevealRuntimeReady &&
		!r7310C1IronDoorRevealRuntimePending &&
		configAllowed &&
		captureMode === 0;
	var applied = floorApplied || northWallApplied || eastWallApplied || westWallApplied || southWallApplied || ceilingApplied || structuralApplied || seColumnNorthShadowApplied || seColumnWestShadowApplied || southWallAcShadowApplied || eastWallBeamShadowApplied || swColumnNorthShadowApplied || westWallBeamShadowApplied || swColumnInnerShadowApplied || westBeamInnerShadowApplied || westBeamUnderShadowApplied || eastBeamInnerShadowApplied || eastBeamUnderShadowApplied || southWindowLeftRevealShadowApplied || southWindowRightRevealShadowApplied || southWindowBottomRevealShadowApplied || southWindowTopRevealShadowApplied || ironDoorRevealApplied;
	if (pathTracingUniforms.uR7310C1FullRoomDiffuseMode)
		pathTracingUniforms.uR7310C1FullRoomDiffuseMode.value = applied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1FullRoomDiffuseReady)
		pathTracingUniforms.uR7310C1FullRoomDiffuseReady.value = applied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1FloorDiffuseMode)
		pathTracingUniforms.uR7310C1FloorDiffuseMode.value = floorApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1NorthWallDiffuseMode)
		pathTracingUniforms.uR7310C1NorthWallDiffuseMode.value = northWallApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1EastWallDiffuseMode)
		pathTracingUniforms.uR7310C1EastWallDiffuseMode.value = eastWallApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1WestWallDiffuseMode)
		pathTracingUniforms.uR7310C1WestWallDiffuseMode.value = westWallApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SouthWallDiffuseMode)
		pathTracingUniforms.uR7310C1SouthWallDiffuseMode.value = southWallApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1CeilingDiffuseMode)
		pathTracingUniforms.uR7310C1CeilingDiffuseMode.value = ceilingApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1StructuralDiffuseMode)
		pathTracingUniforms.uR7310C1StructuralDiffuseMode.value = structuralApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SeColumnNorthShadowMode)
		pathTracingUniforms.uR7310C1SeColumnNorthShadowMode.value = seColumnNorthShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SeColumnNorthShadowReady)
		pathTracingUniforms.uR7310C1SeColumnNorthShadowReady.value = r7310C1SeColumnNorthShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SeColumnWestShadowMode)
		pathTracingUniforms.uR7310C1SeColumnWestShadowMode.value = seColumnWestShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SeColumnWestShadowReady)
		pathTracingUniforms.uR7310C1SeColumnWestShadowReady.value = r7310C1SeColumnWestShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SouthWallAcShadowMode)
		pathTracingUniforms.uR7310C1SouthWallAcShadowMode.value = southWallAcShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SouthWallAcShadowReady)
		pathTracingUniforms.uR7310C1SouthWallAcShadowReady.value = r7310C1SouthWallAcShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1EastWallBeamShadowMode)
		pathTracingUniforms.uR7310C1EastWallBeamShadowMode.value = eastWallBeamShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1EastWallBeamShadowReady)
		pathTracingUniforms.uR7310C1EastWallBeamShadowReady.value = r7310C1EastWallBeamShadowActiveRuntimeReady() ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SwColumnNorthShadowMode)
		pathTracingUniforms.uR7310C1SwColumnNorthShadowMode.value = swColumnNorthShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SwColumnNorthShadowReady)
		pathTracingUniforms.uR7310C1SwColumnNorthShadowReady.value = r7310C1SwColumnNorthShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1WestWallBeamShadowMode)
		pathTracingUniforms.uR7310C1WestWallBeamShadowMode.value = westWallBeamShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1WestWallBeamShadowReady)
		pathTracingUniforms.uR7310C1WestWallBeamShadowReady.value = r7310C1WestWallBeamShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SwColumnInnerShadowMode)
		pathTracingUniforms.uR7310C1SwColumnInnerShadowMode.value = swColumnInnerShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SwColumnInnerShadowReady)
		pathTracingUniforms.uR7310C1SwColumnInnerShadowReady.value = r7310C1SwColumnInnerShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1WestBeamInnerShadowMode)
		pathTracingUniforms.uR7310C1WestBeamInnerShadowMode.value = westBeamInnerShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1WestBeamInnerShadowReady)
		pathTracingUniforms.uR7310C1WestBeamInnerShadowReady.value = r7310C1WestBeamInnerShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1WestBeamUnderShadowMode)
		pathTracingUniforms.uR7310C1WestBeamUnderShadowMode.value = westBeamUnderShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1WestBeamUnderShadowReady)
		pathTracingUniforms.uR7310C1WestBeamUnderShadowReady.value = r7310C1WestBeamUnderShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1EastBeamInnerShadowMode)
		pathTracingUniforms.uR7310C1EastBeamInnerShadowMode.value = eastBeamInnerShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1EastBeamInnerShadowReady)
		pathTracingUniforms.uR7310C1EastBeamInnerShadowReady.value = r7310C1EastBeamInnerShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1EastBeamUnderShadowMode)
		pathTracingUniforms.uR7310C1EastBeamUnderShadowMode.value = eastBeamUnderShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1EastBeamUnderShadowReady)
		pathTracingUniforms.uR7310C1EastBeamUnderShadowReady.value = r7310C1EastBeamUnderShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SouthWindowLeftRevealShadowMode)
		pathTracingUniforms.uR7310C1SouthWindowLeftRevealShadowMode.value = southWindowLeftRevealShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SouthWindowLeftRevealShadowReady)
		pathTracingUniforms.uR7310C1SouthWindowLeftRevealShadowReady.value = r7310C1SouthWindowLeftRevealShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SouthWindowRightRevealShadowMode)
		pathTracingUniforms.uR7310C1SouthWindowRightRevealShadowMode.value = southWindowRightRevealShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SouthWindowRightRevealShadowReady)
		pathTracingUniforms.uR7310C1SouthWindowRightRevealShadowReady.value = r7310C1SouthWindowRightRevealShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SouthWindowBottomRevealShadowMode)
		pathTracingUniforms.uR7310C1SouthWindowBottomRevealShadowMode.value = southWindowBottomRevealShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SouthWindowBottomRevealShadowReady)
		pathTracingUniforms.uR7310C1SouthWindowBottomRevealShadowReady.value = r7310C1SouthWindowBottomRevealShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SouthWindowTopRevealShadowMode)
		pathTracingUniforms.uR7310C1SouthWindowTopRevealShadowMode.value = southWindowTopRevealShadowApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1SouthWindowTopRevealShadowReady)
		pathTracingUniforms.uR7310C1SouthWindowTopRevealShadowReady.value = r7310C1SouthWindowTopRevealShadowRuntimeReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1IronDoorRevealMode)
		pathTracingUniforms.uR7310C1IronDoorRevealMode.value = ironDoorRevealApplied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR7310C1IronDoorRevealReady)
		pathTracingUniforms.uR7310C1IronDoorRevealReady.value = r7310C1IronDoorRevealRuntimeReady ? 1.0 : 0.0;
	if (r7310C1FullRoomDiffuseRuntimeTexture && pathTracingUniforms.tR7310C1FullRoomDiffuseAtlasTexture)
		pathTracingUniforms.tR7310C1FullRoomDiffuseAtlasTexture.value = r7310C1FullRoomDiffuseRuntimeTexture;
	if (r7310C1SeColumnNorthShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1SeColumnNorthShadowTexture)
		pathTracingUniforms.tR7310C1SeColumnNorthShadowTexture.value = r7310C1SeColumnNorthShadowRuntimeDataTexture;
	if (r7310C1SeColumnWestShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1SeColumnWestShadowTexture)
		pathTracingUniforms.tR7310C1SeColumnWestShadowTexture.value = r7310C1SeColumnWestShadowRuntimeDataTexture;
	if (r7310C1SouthWallAcShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1SouthWallAcShadowTexture)
		pathTracingUniforms.tR7310C1SouthWallAcShadowTexture.value = r7310C1SouthWallAcShadowRuntimeDataTexture;
	var eastWallBeamShadowDataTexture = r7310C1EastWallBeamShadowActiveRuntimeDataTexture();
	if (eastWallBeamShadowDataTexture && pathTracingUniforms.tR7310C1EastWallBeamShadowTexture)
		pathTracingUniforms.tR7310C1EastWallBeamShadowTexture.value = eastWallBeamShadowDataTexture;
	if (r7310C1SwColumnNorthShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1SwColumnNorthShadowTexture)
		pathTracingUniforms.tR7310C1SwColumnNorthShadowTexture.value = r7310C1SwColumnNorthShadowRuntimeDataTexture;
	if (r7310C1WestWallBeamShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1WestWallBeamShadowTexture)
		pathTracingUniforms.tR7310C1WestWallBeamShadowTexture.value = r7310C1WestWallBeamShadowRuntimeDataTexture;
	if (r7310C1SwColumnInnerShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1SwColumnInnerShadowTexture)
		pathTracingUniforms.tR7310C1SwColumnInnerShadowTexture.value = r7310C1SwColumnInnerShadowRuntimeDataTexture;
	if (r7310C1WestBeamInnerShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1WestBeamInnerShadowTexture)
		pathTracingUniforms.tR7310C1WestBeamInnerShadowTexture.value = r7310C1WestBeamInnerShadowRuntimeDataTexture;
	if (r7310C1WestBeamUnderShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1WestBeamUnderShadowTexture)
		pathTracingUniforms.tR7310C1WestBeamUnderShadowTexture.value = r7310C1WestBeamUnderShadowRuntimeDataTexture;
	if (r7310C1EastBeamInnerShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1EastBeamInnerShadowTexture)
		pathTracingUniforms.tR7310C1EastBeamInnerShadowTexture.value = r7310C1EastBeamInnerShadowRuntimeDataTexture;
	if (r7310C1EastBeamUnderShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1EastBeamUnderShadowTexture)
		pathTracingUniforms.tR7310C1EastBeamUnderShadowTexture.value = r7310C1EastBeamUnderShadowRuntimeDataTexture;
	if (r7310C1SouthWindowLeftRevealShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1SouthWindowLeftRevealShadowTexture)
		pathTracingUniforms.tR7310C1SouthWindowLeftRevealShadowTexture.value = r7310C1SouthWindowLeftRevealShadowRuntimeDataTexture;
	if (r7310C1SouthWindowRightRevealShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1SouthWindowRightRevealShadowTexture)
		pathTracingUniforms.tR7310C1SouthWindowRightRevealShadowTexture.value = r7310C1SouthWindowRightRevealShadowRuntimeDataTexture;
	if (r7310C1SouthWindowBottomRevealShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1SouthWindowBottomRevealShadowTexture)
		pathTracingUniforms.tR7310C1SouthWindowBottomRevealShadowTexture.value = r7310C1SouthWindowBottomRevealShadowRuntimeDataTexture;
	if (r7310C1SouthWindowTopRevealShadowRuntimeDataTexture && pathTracingUniforms.tR7310C1SouthWindowTopRevealShadowTexture)
		pathTracingUniforms.tR7310C1SouthWindowTopRevealShadowTexture.value = r7310C1SouthWindowTopRevealShadowRuntimeDataTexture;
	if (pathTracingUniforms.uR7310C1SeColumnNorthShadowResolution)
		pathTracingUniforms.uR7310C1SeColumnNorthShadowResolution.value = r7310C1SeColumnNorthShadowRuntimePackage && r7310C1SeColumnNorthShadowRuntimePackage.targetAtlasResolution
			? r7310C1SeColumnNorthShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1SeColumnWestShadowResolution)
		pathTracingUniforms.uR7310C1SeColumnWestShadowResolution.value = r7310C1SeColumnWestShadowRuntimePackage && r7310C1SeColumnWestShadowRuntimePackage.targetAtlasResolution
			? r7310C1SeColumnWestShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1SouthWallAcShadowResolution)
		pathTracingUniforms.uR7310C1SouthWallAcShadowResolution.value = r7310C1SouthWallAcShadowRuntimePackage && r7310C1SouthWallAcShadowRuntimePackage.targetAtlasResolution
			? r7310C1SouthWallAcShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1EastWallBeamShadowResolution)
	{
		var eastWallBeamShadowPackage = r7310C1EastWallBeamShadowActiveRuntimePackage();
		pathTracingUniforms.uR7310C1EastWallBeamShadowResolution.value = eastWallBeamShadowPackage && eastWallBeamShadowPackage.targetAtlasResolution
			? eastWallBeamShadowPackage.targetAtlasResolution
			: 1024;
	}
	if (pathTracingUniforms.uR7310C1SwColumnNorthShadowResolution)
		pathTracingUniforms.uR7310C1SwColumnNorthShadowResolution.value = r7310C1SwColumnNorthShadowRuntimePackage && r7310C1SwColumnNorthShadowRuntimePackage.targetAtlasResolution
			? r7310C1SwColumnNorthShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1WestWallBeamShadowResolution)
		pathTracingUniforms.uR7310C1WestWallBeamShadowResolution.value = r7310C1WestWallBeamShadowRuntimePackage && r7310C1WestWallBeamShadowRuntimePackage.targetAtlasResolution
			? r7310C1WestWallBeamShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1SwColumnInnerShadowResolution)
		pathTracingUniforms.uR7310C1SwColumnInnerShadowResolution.value = r7310C1SwColumnInnerShadowRuntimePackage && r7310C1SwColumnInnerShadowRuntimePackage.targetAtlasResolution
			? r7310C1SwColumnInnerShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1WestBeamInnerShadowResolution)
		pathTracingUniforms.uR7310C1WestBeamInnerShadowResolution.value = r7310C1WestBeamInnerShadowRuntimePackage && r7310C1WestBeamInnerShadowRuntimePackage.targetAtlasResolution
			? r7310C1WestBeamInnerShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1WestBeamUnderShadowResolution)
		pathTracingUniforms.uR7310C1WestBeamUnderShadowResolution.value = r7310C1WestBeamUnderShadowRuntimePackage && r7310C1WestBeamUnderShadowRuntimePackage.targetAtlasResolution
			? r7310C1WestBeamUnderShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1EastBeamInnerShadowResolution)
		pathTracingUniforms.uR7310C1EastBeamInnerShadowResolution.value = r7310C1EastBeamInnerShadowRuntimePackage && r7310C1EastBeamInnerShadowRuntimePackage.targetAtlasResolution
			? r7310C1EastBeamInnerShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1EastBeamUnderShadowResolution)
		pathTracingUniforms.uR7310C1EastBeamUnderShadowResolution.value = r7310C1EastBeamUnderShadowRuntimePackage && r7310C1EastBeamUnderShadowRuntimePackage.targetAtlasResolution
			? r7310C1EastBeamUnderShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1SouthWindowLeftRevealShadowResolution)
		pathTracingUniforms.uR7310C1SouthWindowLeftRevealShadowResolution.value = r7310C1SouthWindowLeftRevealShadowRuntimePackage && r7310C1SouthWindowLeftRevealShadowRuntimePackage.targetAtlasResolution
			? r7310C1SouthWindowLeftRevealShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1SouthWindowRightRevealShadowResolution)
		pathTracingUniforms.uR7310C1SouthWindowRightRevealShadowResolution.value = r7310C1SouthWindowRightRevealShadowRuntimePackage && r7310C1SouthWindowRightRevealShadowRuntimePackage.targetAtlasResolution
			? r7310C1SouthWindowRightRevealShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1SouthWindowBottomRevealShadowResolution)
		pathTracingUniforms.uR7310C1SouthWindowBottomRevealShadowResolution.value = r7310C1SouthWindowBottomRevealShadowRuntimePackage && r7310C1SouthWindowBottomRevealShadowRuntimePackage.targetAtlasResolution
			? r7310C1SouthWindowBottomRevealShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1SouthWindowTopRevealShadowResolution)
		pathTracingUniforms.uR7310C1SouthWindowTopRevealShadowResolution.value = r7310C1SouthWindowTopRevealShadowRuntimePackage && r7310C1SouthWindowTopRevealShadowRuntimePackage.targetAtlasResolution
			? r7310C1SouthWindowTopRevealShadowRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1IronDoorRevealResolution)
		pathTracingUniforms.uR7310C1IronDoorRevealResolution.value = r7310C1IronDoorRevealRuntimePackage && r7310C1IronDoorRevealRuntimePackage.targetAtlasResolution
			? r7310C1IronDoorRevealRuntimePackage.targetAtlasResolution
			: 1024;
	if (pathTracingUniforms.uR7310C1RuntimeAtlasPatchResolution)
		pathTracingUniforms.uR7310C1RuntimeAtlasPatchResolution.value = r7310C1RuntimeAtlasResolution();
	if (pathTracingUniforms.uR7310C1RuntimeAtlasPatchCount)
		pathTracingUniforms.uR7310C1RuntimeAtlasPatchCount.value = R7310_C1_RUNTIME_ATLAS_PATCH_COUNT;
	if (pathTracingUniforms.uR7310C1RuntimeAtlasGridColumns)
		pathTracingUniforms.uR7310C1RuntimeAtlasGridColumns.value = R7310_C1_RUNTIME_ATLAS_GRID_COLUMNS;
	if (r7310C1FullRoomDiffuseRuntimePackage && r7310C1FullRoomDiffuseRuntimePackage.worldBounds && pathTracingUniforms.uR7310C1BakeFloorWorldBounds)
	{
		var b = r7310C1FullRoomDiffuseRuntimePackage.worldBounds;
		pathTracingUniforms.uR7310C1BakeFloorWorldBounds.value.set(b.xMin, b.xMax, b.zMin, b.zMax);
	}
	return applied;
}

function r7310C1RuntimeAtlasResolution()
{
	if (r7310C1FullRoomDiffuseRuntimePackage && r7310C1FullRoomDiffuseRuntimePackage.targetAtlasResolution)
		return r7310C1FullRoomDiffuseRuntimePackage.targetAtlasResolution;
	if (r7310C1NorthWallDiffuseRuntimePackage && r7310C1NorthWallDiffuseRuntimePackage.targetAtlasResolution)
		return r7310C1NorthWallDiffuseRuntimePackage.targetAtlasResolution;
	if (r7310C1NorthWallWardrobeDiffuseRuntimePackage && r7310C1NorthWallWardrobeDiffuseRuntimePackage.targetAtlasResolution)
		return r7310C1NorthWallWardrobeDiffuseRuntimePackage.targetAtlasResolution;
	if (r7310C1EastWallDiffuseRuntimePackage && r7310C1EastWallDiffuseRuntimePackage.targetAtlasResolution)
		return r7310C1EastWallDiffuseRuntimePackage.targetAtlasResolution;
	if (r7310C1EastWallWardrobeDiffuseRuntimePackage && r7310C1EastWallWardrobeDiffuseRuntimePackage.targetAtlasResolution)
		return r7310C1EastWallWardrobeDiffuseRuntimePackage.targetAtlasResolution;
	if (r7310C1WestWallDiffuseRuntimePackage && r7310C1WestWallDiffuseRuntimePackage.targetAtlasResolution)
		return r7310C1WestWallDiffuseRuntimePackage.targetAtlasResolution;
	if (r7310C1SouthWallDiffuseRuntimePackage && r7310C1SouthWallDiffuseRuntimePackage.targetAtlasResolution)
		return r7310C1SouthWallDiffuseRuntimePackage.targetAtlasResolution;
	if (r7310C1CeilingDiffuseRuntimePackage && r7310C1CeilingDiffuseRuntimePackage.targetAtlasResolution)
		return r7310C1CeilingDiffuseRuntimePackage.targetAtlasResolution;
	if (!r7310C1StructuralDiffuseRuntimePending &&
		r7310C1StructuralDiffuseRuntimePackage &&
		r7310C1StructuralDiffuseRuntimePackage.targetAtlasResolution)
		return r7310C1StructuralDiffuseRuntimePackage.targetAtlasResolution;
	if (!r7310C1SeColumnNorthShadowRuntimePending &&
		r7310C1SeColumnNorthShadowRuntimePackage &&
		r7310C1SeColumnNorthShadowRuntimePackage.targetAtlasResolution)
		return r7310C1SeColumnNorthShadowRuntimePackage.targetAtlasResolution;
	if (!r7310C1SeColumnWestShadowRuntimePending &&
		r7310C1SeColumnWestShadowRuntimePackage &&
		r7310C1SeColumnWestShadowRuntimePackage.targetAtlasResolution)
		return r7310C1SeColumnWestShadowRuntimePackage.targetAtlasResolution;
	if (!r7310C1SouthWallAcShadowRuntimePending &&
		r7310C1SouthWallAcShadowRuntimePackage &&
		r7310C1SouthWallAcShadowRuntimePackage.targetAtlasResolution)
		return r7310C1SouthWallAcShadowRuntimePackage.targetAtlasResolution;
	var eastWallBeamShadowPackage = r7310C1EastWallBeamShadowActiveRuntimePackage();
	if (!r7310C1EastWallBeamShadowActiveRuntimePending() &&
		eastWallBeamShadowPackage &&
		eastWallBeamShadowPackage.targetAtlasResolution)
		return eastWallBeamShadowPackage.targetAtlasResolution;
	if (!r7310C1SwColumnNorthShadowRuntimePending &&
		r7310C1SwColumnNorthShadowRuntimePackage &&
		r7310C1SwColumnNorthShadowRuntimePackage.targetAtlasResolution)
		return r7310C1SwColumnNorthShadowRuntimePackage.targetAtlasResolution;
	if (!r7310C1WestWallBeamShadowRuntimePending &&
		r7310C1WestWallBeamShadowRuntimePackage &&
		r7310C1WestWallBeamShadowRuntimePackage.targetAtlasResolution)
		return r7310C1WestWallBeamShadowRuntimePackage.targetAtlasResolution;
	if (!r7310C1SwColumnInnerShadowRuntimePending &&
		r7310C1SwColumnInnerShadowRuntimePackage &&
		r7310C1SwColumnInnerShadowRuntimePackage.targetAtlasResolution)
		return r7310C1SwColumnInnerShadowRuntimePackage.targetAtlasResolution;
	if (!r7310C1WestBeamInnerShadowRuntimePending &&
		r7310C1WestBeamInnerShadowRuntimePackage &&
		r7310C1WestBeamInnerShadowRuntimePackage.targetAtlasResolution)
		return r7310C1WestBeamInnerShadowRuntimePackage.targetAtlasResolution;
	if (!r7310C1WestBeamUnderShadowRuntimePending &&
		r7310C1WestBeamUnderShadowRuntimePackage &&
		r7310C1WestBeamUnderShadowRuntimePackage.targetAtlasResolution)
		return r7310C1WestBeamUnderShadowRuntimePackage.targetAtlasResolution;
	if (!r7310C1EastBeamInnerShadowRuntimePending &&
		r7310C1EastBeamInnerShadowRuntimePackage &&
		r7310C1EastBeamInnerShadowRuntimePackage.targetAtlasResolution)
		return r7310C1EastBeamInnerShadowRuntimePackage.targetAtlasResolution;
	if (!r7310C1EastBeamUnderShadowRuntimePending &&
		r7310C1EastBeamUnderShadowRuntimePackage &&
		r7310C1EastBeamUnderShadowRuntimePackage.targetAtlasResolution)
		return r7310C1EastBeamUnderShadowRuntimePackage.targetAtlasResolution;
	if (!r7310C1SouthWindowLeftRevealShadowRuntimePending &&
		r7310C1SouthWindowLeftRevealShadowRuntimePackage &&
		r7310C1SouthWindowLeftRevealShadowRuntimePackage.targetAtlasResolution)
		return r7310C1SouthWindowLeftRevealShadowRuntimePackage.targetAtlasResolution;
	if (!r7310C1SouthWindowRightRevealShadowRuntimePending &&
		r7310C1SouthWindowRightRevealShadowRuntimePackage &&
		r7310C1SouthWindowRightRevealShadowRuntimePackage.targetAtlasResolution)
		return r7310C1SouthWindowRightRevealShadowRuntimePackage.targetAtlasResolution;
	if (!r7310C1SouthWindowBottomRevealShadowRuntimePending &&
		r7310C1SouthWindowBottomRevealShadowRuntimePackage &&
		r7310C1SouthWindowBottomRevealShadowRuntimePackage.targetAtlasResolution)
		return r7310C1SouthWindowBottomRevealShadowRuntimePackage.targetAtlasResolution;
	if (!r7310C1SouthWindowTopRevealShadowRuntimePending &&
		r7310C1SouthWindowTopRevealShadowRuntimePackage &&
		r7310C1SouthWindowTopRevealShadowRuntimePackage.targetAtlasResolution)
		return r7310C1SouthWindowTopRevealShadowRuntimePackage.targetAtlasResolution;
	return 512;
}

function r7310C1NorthWallActiveDiffuseRuntimeReady()
{
	return r7310C1NortheastFurnitureRuntimeMode === 'wardrobe'
		? r7310C1NorthWallWardrobeDiffuseRuntimeReady
		: r7310C1NorthWallDiffuseRuntimeReady;
}

function r7310C1EastWallActiveDiffuseRuntimeReady()
{
	return r7310C1NortheastFurnitureRuntimeMode === 'wardrobe'
		? r7310C1EastWallWardrobeDiffuseRuntimeReady
		: r7310C1EastWallDiffuseRuntimeReady;
}

function r7310C1NorthWallActiveDiffuseRuntimePackage()
{
	return r7310C1NortheastFurnitureRuntimeMode === 'wardrobe'
		? r7310C1NorthWallWardrobeDiffuseRuntimePackage
		: r7310C1NorthWallDiffuseRuntimePackage;
}

function r7310C1EastWallActiveDiffuseRuntimePackage()
{
	return r7310C1NortheastFurnitureRuntimeMode === 'wardrobe'
		? r7310C1EastWallWardrobeDiffuseRuntimePackage
		: r7310C1EastWallDiffuseRuntimePackage;
}

function r7310C1NorthWallActiveDiffuseRuntimeTexture()
{
	return r7310C1NortheastFurnitureRuntimeMode === 'wardrobe'
		? r7310C1NorthWallWardrobeDiffuseRuntimeTexture
		: r7310C1NorthWallDiffuseRuntimeTexture;
}

function r7310C1EastWallActiveDiffuseRuntimeTexture()
{
	return r7310C1NortheastFurnitureRuntimeMode === 'wardrobe'
		? r7310C1EastWallWardrobeDiffuseRuntimeTexture
		: r7310C1EastWallDiffuseRuntimeTexture;
}

function r7310C1EastWallBeamShadowActiveRuntimePending()
{
	return r7310C1NortheastFurnitureRuntimeMode === 'wardrobe'
		? r7310C1EastWallBeamShadowWardrobeRuntimePending
		: r7310C1EastWallBeamShadowRuntimePending;
}

function r7310C1EastWallBeamShadowActiveRuntimeReady()
{
	return r7310C1NortheastFurnitureRuntimeMode === 'wardrobe'
		? r7310C1EastWallBeamShadowWardrobeRuntimeReady
		: r7310C1EastWallBeamShadowRuntimeReady;
}

function r7310C1EastWallBeamShadowActiveRuntimePackage()
{
	return r7310C1NortheastFurnitureRuntimeMode === 'wardrobe'
		? r7310C1EastWallBeamShadowWardrobeRuntimePackage
		: r7310C1EastWallBeamShadowRuntimePackage;
}

function r7310C1EastWallBeamShadowActiveRuntimeTexture()
{
	return r7310C1NortheastFurnitureRuntimeMode === 'wardrobe'
		? r7310C1EastWallBeamShadowWardrobeRuntimeTexture
		: r7310C1EastWallBeamShadowRuntimeTexture;
}

function r7310C1EastWallBeamShadowActiveRuntimeDataTexture()
{
	return r7310C1NortheastFurnitureRuntimeMode === 'wardrobe'
		? r7310C1EastWallBeamShadowWardrobeRuntimeDataTexture
		: r7310C1EastWallBeamShadowRuntimeDataTexture;
}

function r7310C1EastWallBeamShadowActiveRuntimeError()
{
	return r7310C1NortheastFurnitureRuntimeMode === 'wardrobe'
		? r7310C1EastWallBeamShadowWardrobeRuntimeError
		: r7310C1EastWallBeamShadowRuntimeError;
}

function createR7310C1BlackRuntimeSlot(resolution)
{
	var safeResolution = Math.max(1, Math.trunc(Number(resolution) || 1));
	return new Float32Array(safeResolution * safeResolution * 4);
}

function createR7310C1StandaloneRuntimeTexture(pixels, resolution)
{
	if (!THREE || !(pixels instanceof Float32Array))
		return null;
	var texture = new THREE.DataTexture(
		pixels,
		resolution,
		resolution,
		THREE.RGBAFormat,
		THREE.FloatType
	);
	texture.minFilter = THREE.NearestFilter;
	texture.magFilter = THREE.NearestFilter;
	texture.wrapS = THREE.ClampToEdgeWrapping;
	texture.wrapT = THREE.ClampToEdgeWrapping;
	texture.flipY = false;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;
	return texture;
}

function buildR7310C1CombinedDiffuseRuntimeTexture(floorPixels, northWallPixels, eastWallPixels, westWallPixels, southWallPixels, ceilingPixels, structuralPixels, seColumnNorthShadowPixels, seColumnWestShadowPixels, southWallAcShadowPixels, eastWallBeamShadowPixels, swColumnNorthShadowPixels, westWallBeamShadowPixels, swColumnInnerShadowPixels, westBeamInnerShadowPixels, westBeamUnderShadowPixels, eastBeamInnerShadowPixels, eastBeamUnderShadowPixels, southWindowLeftRevealShadowPixels, southWindowRightRevealShadowPixels, southWindowBottomRevealShadowPixels, southWindowTopRevealShadowPixels, ironDoorRevealPixels, resolution)
{
	var slots = [
		floorPixels,
		northWallPixels,
		eastWallPixels,
		westWallPixels,
		southWallPixels,
		ceilingPixels,
		structuralPixels,
		seColumnNorthShadowPixels,
		seColumnWestShadowPixels,
		southWallAcShadowPixels,
		eastWallBeamShadowPixels,
		swColumnNorthShadowPixels,
		westWallBeamShadowPixels,
		swColumnInnerShadowPixels,
		westBeamInnerShadowPixels,
		westBeamUnderShadowPixels,
		eastBeamInnerShadowPixels,
		eastBeamUnderShadowPixels,
		southWindowLeftRevealShadowPixels,
		southWindowRightRevealShadowPixels,
		southWindowBottomRevealShadowPixels,
		southWindowTopRevealShadowPixels,
		ironDoorRevealPixels
	];
	var patchCount = R7310_C1_RUNTIME_ATLAS_PATCH_COUNT;
	var atlasColumns = R7310_C1_RUNTIME_ATLAS_GRID_COLUMNS;
	var atlasRows = Math.ceil(patchCount / atlasColumns);
	var combined = new Float32Array(resolution * atlasColumns * resolution * atlasRows * 4);
	for (var y = 0; y < resolution; y += 1)
	{
		for (var x = 0; x < resolution; x += 1)
		{
			var src = (y * resolution + x) * 4;
			for (var slot = 0; slot < patchCount; slot += 1)
			{
				var slotColumn = slot % atlasColumns;
				var slotRow = Math.floor(slot / atlasColumns);
				var dst = ((slotRow * resolution + y) * (resolution * atlasColumns) + slotColumn * resolution + x) * 4;
				var pixels = slots[slot];
				combined[dst] = pixels[src];
				combined[dst + 1] = pixels[src + 1];
				combined[dst + 2] = pixels[src + 2];
				combined[dst + 3] = pixels[src + 3];
			}
		}
	}
	var texture = new THREE.DataTexture(
		combined,
		resolution * R7310_C1_RUNTIME_ATLAS_GRID_COLUMNS,
		resolution * Math.ceil(patchCount / R7310_C1_RUNTIME_ATLAS_GRID_COLUMNS),
		THREE.RGBAFormat,
		THREE.FloatType
	);
	texture.minFilter = THREE.NearestFilter;
	texture.magFilter = THREE.NearestFilter;
	texture.wrapS = THREE.ClampToEdgeWrapping;
	texture.wrapT = THREE.ClampToEdgeWrapping;
	texture.flipY = false;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;
	return texture;
}

function refreshR7310C1CombinedDiffuseRuntimeTexture()
{
	if (!THREE)
		return false;
	var resolution = r7310C1RuntimeAtlasResolution();
	var expectedLength = resolution * resolution * 4;
	var floorPixels = r7310C1FloorDiffuseRuntimePixels instanceof Float32Array
		? r7310C1FloorDiffuseRuntimePixels
		: createR7310C1BlackRuntimeSlot(resolution);
	var northWallTexture = r7310C1NorthWallActiveDiffuseRuntimeTexture();
	var eastWallTexture = r7310C1EastWallActiveDiffuseRuntimeTexture();
	var northWallPixels = northWallTexture instanceof Float32Array
		? northWallTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var eastWallPixels = eastWallTexture instanceof Float32Array
		? eastWallTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var westWallPixels = r7310C1WestWallDiffuseRuntimeTexture instanceof Float32Array
		? r7310C1WestWallDiffuseRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var southWallPixels = r7310C1SouthWallDiffuseRuntimeTexture instanceof Float32Array
		? r7310C1SouthWallDiffuseRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var ceilingPixels = r7310C1CeilingDiffuseRuntimeTexture instanceof Float32Array
		? r7310C1CeilingDiffuseRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var structuralPixels = r7310C1StructuralDiffuseRuntimeTexture instanceof Float32Array
		? r7310C1StructuralDiffuseRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var seColumnNorthShadowPixels = r7310C1SeColumnNorthShadowRuntimeTexture instanceof Float32Array
		? r7310C1SeColumnNorthShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var seColumnWestShadowPixels = r7310C1SeColumnWestShadowRuntimeTexture instanceof Float32Array
		? r7310C1SeColumnWestShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var southWallAcShadowPixels = r7310C1SouthWallAcShadowRuntimeTexture instanceof Float32Array
		? r7310C1SouthWallAcShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var eastWallBeamShadowTexture = r7310C1EastWallBeamShadowActiveRuntimeTexture();
	var eastWallBeamShadowPixels = eastWallBeamShadowTexture instanceof Float32Array
		? eastWallBeamShadowTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var swColumnNorthShadowPixels = r7310C1SwColumnNorthShadowRuntimeTexture instanceof Float32Array
		? r7310C1SwColumnNorthShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var westWallBeamShadowPixels = r7310C1WestWallBeamShadowRuntimeTexture instanceof Float32Array
		? r7310C1WestWallBeamShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var swColumnInnerShadowPixels = r7310C1SwColumnInnerShadowRuntimeTexture instanceof Float32Array
		? r7310C1SwColumnInnerShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var westBeamInnerShadowPixels = r7310C1WestBeamInnerShadowRuntimeTexture instanceof Float32Array
		? r7310C1WestBeamInnerShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var westBeamUnderShadowPixels = r7310C1WestBeamUnderShadowRuntimeTexture instanceof Float32Array
		? r7310C1WestBeamUnderShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var eastBeamInnerShadowPixels = r7310C1EastBeamInnerShadowRuntimeTexture instanceof Float32Array
		? r7310C1EastBeamInnerShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var eastBeamUnderShadowPixels = r7310C1EastBeamUnderShadowRuntimeTexture instanceof Float32Array
		? r7310C1EastBeamUnderShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var southWindowLeftRevealShadowPixels = r7310C1SouthWindowLeftRevealShadowRuntimeTexture instanceof Float32Array
		? r7310C1SouthWindowLeftRevealShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var southWindowRightRevealShadowPixels = r7310C1SouthWindowRightRevealShadowRuntimeTexture instanceof Float32Array
		? r7310C1SouthWindowRightRevealShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var southWindowBottomRevealShadowPixels = r7310C1SouthWindowBottomRevealShadowRuntimeTexture instanceof Float32Array
		? r7310C1SouthWindowBottomRevealShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var southWindowTopRevealShadowPixels = r7310C1SouthWindowTopRevealShadowRuntimeTexture instanceof Float32Array
		? r7310C1SouthWindowTopRevealShadowRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var ironDoorRevealPixels = r7310C1IronDoorRevealRuntimeTexture instanceof Float32Array
		? r7310C1IronDoorRevealRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	if (floorPixels.length !== expectedLength)
		floorPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (northWallPixels.length !== expectedLength)
		northWallPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (eastWallPixels.length !== expectedLength)
		eastWallPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (westWallPixels.length !== expectedLength)
		westWallPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (southWallPixels.length !== expectedLength)
		southWallPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (ceilingPixels.length !== expectedLength)
		ceilingPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (structuralPixels.length !== expectedLength)
		structuralPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (seColumnNorthShadowPixels.length !== expectedLength)
		seColumnNorthShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (seColumnWestShadowPixels.length !== expectedLength)
		seColumnWestShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (southWallAcShadowPixels.length !== expectedLength)
		southWallAcShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (eastWallBeamShadowPixels.length !== expectedLength)
		eastWallBeamShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (swColumnNorthShadowPixels.length !== expectedLength)
		swColumnNorthShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (westWallBeamShadowPixels.length !== expectedLength)
		westWallBeamShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (swColumnInnerShadowPixels.length !== expectedLength)
		swColumnInnerShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (westBeamInnerShadowPixels.length !== expectedLength)
		westBeamInnerShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (westBeamUnderShadowPixels.length !== expectedLength)
		westBeamUnderShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (eastBeamInnerShadowPixels.length !== expectedLength)
		eastBeamInnerShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (eastBeamUnderShadowPixels.length !== expectedLength)
		eastBeamUnderShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (southWindowLeftRevealShadowPixels.length !== expectedLength)
		southWindowLeftRevealShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (southWindowRightRevealShadowPixels.length !== expectedLength)
		southWindowRightRevealShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (southWindowBottomRevealShadowPixels.length !== expectedLength)
		southWindowBottomRevealShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (southWindowTopRevealShadowPixels.length !== expectedLength)
		southWindowTopRevealShadowPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (ironDoorRevealPixels.length !== expectedLength)
		ironDoorRevealPixels = createR7310C1BlackRuntimeSlot(resolution);
	r7310C1FullRoomDiffuseRuntimeTexture = buildR7310C1CombinedDiffuseRuntimeTexture(
		floorPixels,
		northWallPixels,
		eastWallPixels,
		westWallPixels,
		southWallPixels,
		ceilingPixels,
		structuralPixels,
		seColumnNorthShadowPixels,
		seColumnWestShadowPixels,
		southWallAcShadowPixels,
		eastWallBeamShadowPixels,
		swColumnNorthShadowPixels,
		westWallBeamShadowPixels,
		swColumnInnerShadowPixels,
		westBeamInnerShadowPixels,
		westBeamUnderShadowPixels,
		eastBeamInnerShadowPixels,
		eastBeamUnderShadowPixels,
		southWindowLeftRevealShadowPixels,
		southWindowRightRevealShadowPixels,
		southWindowBottomRevealShadowPixels,
		southWindowTopRevealShadowPixels,
		ironDoorRevealPixels,
		resolution
	);
	return true;
}

function r739C1AccurateReflectionConfigAllowed()
{
	return (typeof currentPanelConfig === 'number') ? currentPanelConfig === 1 : true;
}

function r739C1CurrentViewReflectionConfigAllowed()
{
	return (typeof currentPanelConfig === 'number') ? currentPanelConfig === 1 : false;
}

function updateR739C1AccurateReflectionUniforms()
{
	if (!pathTracingUniforms) return false;
	var packageFloorRoughness = r739C1AccurateReflectionPackage && Number.isFinite(Number(r739C1AccurateReflectionPackage.floorRoughnessForReflection))
		? Number(r739C1AccurateReflectionPackage.floorRoughnessForReflection)
		: 0.1;
	var captureMode = pathTracingUniforms.uR738C1BakeCaptureMode ? pathTracingUniforms.uR738C1BakeCaptureMode.value : 0;
	var referenceMode = pathTracingUniforms.uR739C1ReflectionReferenceMode ? pathTracingUniforms.uR739C1ReflectionReferenceMode.value : 0;
	var maskMode = pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode ? pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value : 0;
	var applied = r739C1AccurateReflectionEnabled &&
		r739C1AccurateReflectionReady &&
		r739C1AccurateReflectionConfigAllowed() &&
		captureMode === 0 &&
		referenceMode === 0 &&
		maskMode === 0;
	if (pathTracingUniforms.uR739C1AccurateReflectionMode)
		pathTracingUniforms.uR739C1AccurateReflectionMode.value = applied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR739C1ReflectionReady)
		pathTracingUniforms.uR739C1ReflectionReady.value = r739C1AccurateReflectionReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR739C1ReflectionFloorRoughness)
		pathTracingUniforms.uR739C1ReflectionFloorRoughness.value = packageFloorRoughness;
	if (r739C1AccurateReflectionTexture && pathTracingUniforms.tR739C1ReflectionSurfaceCacheTexture)
		pathTracingUniforms.tR739C1ReflectionSurfaceCacheTexture.value = r739C1AccurateReflectionTexture;
	return applied;
}

function updateR739C1CurrentViewReflectionUniforms()
{
	if (!pathTracingUniforms) return false;
	var captureMode = pathTracingUniforms.uR738C1BakeCaptureMode ? pathTracingUniforms.uR738C1BakeCaptureMode.value : 0;
	var referenceMode = pathTracingUniforms.uR739C1ReflectionReferenceMode ? pathTracingUniforms.uR739C1ReflectionReferenceMode.value : 0;
	var maskMode = pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode ? pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value : 0;
	var applied = (r739C1CurrentViewReflectionPreviewEnabled || r739C1CurrentViewReflectionValidationEnabled) &&
		r739C1CurrentViewReflectionReady &&
		r739C1CurrentViewReflectionConfigAllowed() &&
		captureMode === 0 &&
		referenceMode === 0 &&
		maskMode === 0;
	if (pathTracingUniforms.uR739C1CurrentViewReflectionMode)
		pathTracingUniforms.uR739C1CurrentViewReflectionMode.value = applied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR739C1CurrentViewReflectionReady)
		pathTracingUniforms.uR739C1CurrentViewReflectionReady.value = r739C1CurrentViewReflectionReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR739C1CurrentViewReflectionRoughness)
		pathTracingUniforms.uR739C1CurrentViewReflectionRoughness.value = r739C1CurrentViewReflectionRoughness;
	return applied;
}

async function loadR738C1BakePastePreviewPackage()
{
	if (r738C1BakePastePreviewLoadPromise) return r738C1BakePastePreviewLoadPromise;
	r738C1BakePastePreviewLoadPromise = (async function()
	{
		try
		{
			r738C1BakePastePreviewError = null;
			var pointerResponse = await fetch(R738_C1_BAKE_ACCEPTED_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
				throw new Error('R7-3.8 accepted package pointer not found');
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus !== 'accepted' || pointer.upscaled !== false || pointer.targetAtlasResolution !== 512 || pointer.diffuseOnly !== true)
				throw new Error('R7-3.8 accepted package pointer failed contract');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.8 validation report not found');
			var validation = await validationResponse.json();
			if (validation.status !== 'pass')
				throw new Error('R7-3.8 accepted package validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.8 atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.8 atlas binary length mismatch');
			var atlasPixels = new Float32Array(atlasBuffer);
			var texture = new THREE.DataTexture(
				atlasPixels,
				pointer.targetAtlasResolution,
				pointer.targetAtlasResolution,
				THREE.RGBAFormat,
				THREE.FloatType
			);
			texture.minFilter = THREE.NearestFilter;
			texture.magFilter = THREE.NearestFilter;
			texture.wrapS = THREE.ClampToEdgeWrapping;
			texture.wrapT = THREE.ClampToEdgeWrapping;
			texture.flipY = false;
			texture.generateMipmaps = false;
			texture.needsUpdate = true;
			r738C1BakePastePreviewPackage = pointer;
			r738C1BakePastePreviewTexture = texture;
			r738C1BakePastePreviewReady = true;
			updateR738C1BakePastePreviewUniforms();
			resetR738MainAccumulation();
			if (typeof wakeRender === 'function') wakeRender('r7-3-8-c1-bake-paste-preview-ready');
			return window.reportR738C1BakePastePreviewConfig();
		}
		catch (error)
		{
			r738C1BakePastePreviewReady = false;
			r738C1BakePastePreviewError = error && error.message ? error.message : String(error);
			updateR738C1BakePastePreviewUniforms();
			throw error;
		}
	})();
	return r738C1BakePastePreviewLoadPromise;
}

async function loadR7310C1FullRoomDiffuseRuntimePackage()
{
	if (r7310C1FullRoomDiffuseRuntimeLoadPromise) return r7310C1FullRoomDiffuseRuntimeLoadPromise;
	r7310C1FullRoomDiffuseRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1FullRoomDiffuseRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_FLOOR_DIFFUSE_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
				throw new Error('R7-3.10 full floor diffuse runtime pointer not found');
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_floor_full_room_first_hit_hybrid')
				throw new Error('R7-3.10 full floor diffuse runtime pointer failed contract');
			if (pointer.runtimeArchitecture !== 'single_full_floor_first_hit_hybrid')
				throw new Error('R7-3.10 full floor diffuse runtime architecture mismatch');
			if (pointer.bakedRadianceKind !== 'indirect_diffuse_radiance' || pointer.directLightAlreadyIncluded !== false || pointer.addDirectLightAfterBakeLookup !== true)
				throw new Error('R7-3.10 full floor diffuse runtime radiance contract mismatch');
			if (pointer.runtimeTexture !== 'tR7310C1FullRoomDiffuseAtlasTexture' || pointer.runtimeAtlasSlot !== 0)
				throw new Error('R7-3.10 full floor diffuse runtime atlas slot mismatch');
			if (pointer.targetId !== R7310_C1_FLOOR_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 full floor diffuse runtime package metadata mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 full floor diffuse validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 full floor diffuse runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 full floor diffuse atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 full floor diffuse atlas binary length mismatch');
			r7310C1FullRoomDiffuseRuntimePackage = pointer;
			r7310C1FloorDiffuseRuntimePixels = new Float32Array(atlasBuffer);
			if (r7310C1NorthWallDiffuseRuntimePackage &&
				r7310C1NorthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1EastWallDiffuseRuntimePackage &&
				r7310C1EastWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1WestWallDiffuseRuntimePackage &&
				r7310C1WestWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				if (r7310C1SouthWallDiffuseRuntimePackage &&
					r7310C1SouthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
					throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				if (r7310C1CeilingDiffuseRuntimePackage &&
					r7310C1CeilingDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
					throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				refreshR7310C1CombinedDiffuseRuntimeTexture();
			r7310C1FullRoomDiffuseRuntimeReady = true;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				resetR738MainAccumulation();
				if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-full-room-diffuse-runtime-ready');
				markR7310C1RuntimeLoadingStepComplete('floor');
				return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
		}
		catch (error)
		{
			r7310C1FullRoomDiffuseRuntimeReady = false;
			r7310C1FullRoomDiffuseRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1FullRoomDiffuseRuntimeLoadPromise;
}

async function loadR7310C1NorthWallDiffuseRuntimePackage()
{
	if (r7310C1NorthWallDiffuseRuntimeLoadPromise) return r7310C1NorthWallDiffuseRuntimeLoadPromise;
	r7310C1NorthWallDiffuseRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1NorthWallDiffuseRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_NORTH_WALL_DIFFUSE_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
				throw new Error('R7-3.10 north wall diffuse runtime pointer not found');
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_north_wall_first_hit_hybrid')
				throw new Error('R7-3.10 north wall diffuse runtime pointer failed contract');
			if (pointer.runtimeArchitecture !== 'single_full_north_wall_first_hit_hybrid')
				throw new Error('R7-3.10 north wall diffuse runtime architecture mismatch');
			if (pointer.targetId !== R7310_C1_NORTH_WALL_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 north wall diffuse runtime package metadata mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 north wall diffuse validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 north wall diffuse runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 north wall diffuse atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 north wall diffuse atlas binary length mismatch');
			if (r7310C1FullRoomDiffuseRuntimePackage &&
				r7310C1FullRoomDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1EastWallDiffuseRuntimePackage &&
				r7310C1EastWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1WestWallDiffuseRuntimePackage &&
				r7310C1WestWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				if (r7310C1SouthWallDiffuseRuntimePackage &&
					r7310C1SouthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
					throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				if (r7310C1CeilingDiffuseRuntimePackage &&
					r7310C1CeilingDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
					throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				r7310C1NorthWallDiffuseRuntimePackage = pointer;
			r7310C1NorthWallDiffuseRuntimeTexture = new Float32Array(atlasBuffer);
				refreshR7310C1CombinedDiffuseRuntimeTexture();
				r7310C1NorthWallDiffuseRuntimeReady = true;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('northWall');
				return pointer;
		}
		catch (error)
		{
			r7310C1NorthWallDiffuseRuntimeReady = false;
			r7310C1NorthWallDiffuseRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1NorthWallDiffuseRuntimeLoadPromise;
}

async function loadR7310C1EastWallDiffuseRuntimePackage()
{
	if (r7310C1EastWallDiffuseRuntimeLoadPromise) return r7310C1EastWallDiffuseRuntimeLoadPromise;
	r7310C1EastWallDiffuseRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1EastWallDiffuseRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_EAST_WALL_DIFFUSE_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
				throw new Error('R7-3.10 east wall diffuse runtime pointer not found');
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_east_wall_first_hit_hybrid')
				throw new Error('R7-3.10 east wall diffuse runtime pointer failed contract');
			if (pointer.runtimeArchitecture !== 'single_full_east_wall_first_hit_hybrid')
				throw new Error('R7-3.10 east wall diffuse runtime architecture mismatch');
			if (pointer.targetId !== R7310_C1_EAST_WALL_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 east wall diffuse runtime package metadata mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 east wall diffuse validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 east wall diffuse runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 east wall diffuse atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 east wall diffuse atlas binary length mismatch');
			if (r7310C1FullRoomDiffuseRuntimePackage &&
				r7310C1FullRoomDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1NorthWallDiffuseRuntimePackage &&
				r7310C1NorthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1WestWallDiffuseRuntimePackage &&
				r7310C1WestWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				if (r7310C1SouthWallDiffuseRuntimePackage &&
					r7310C1SouthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
					throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				if (r7310C1CeilingDiffuseRuntimePackage &&
					r7310C1CeilingDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
					throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				r7310C1EastWallDiffuseRuntimePackage = pointer;
			r7310C1EastWallDiffuseRuntimeTexture = new Float32Array(atlasBuffer);
				refreshR7310C1CombinedDiffuseRuntimeTexture();
				r7310C1EastWallDiffuseRuntimeReady = true;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('eastWall');
				return pointer;
		}
		catch (error)
		{
			r7310C1EastWallDiffuseRuntimeReady = false;
			r7310C1EastWallDiffuseRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1EastWallDiffuseRuntimeLoadPromise;
}

async function loadR7310C1NorthWallWardrobeDiffuseRuntimePackage()
{
	if (r7310C1NorthWallWardrobeDiffuseRuntimeLoadPromise) return r7310C1NorthWallWardrobeDiffuseRuntimeLoadPromise;
	r7310C1NorthWallWardrobeDiffuseRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1NorthWallWardrobeDiffuseRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_NORTH_WALL_WARDROBE_DIFFUSE_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
				throw new Error('R7-3.10 north wall wardrobe diffuse runtime pointer not found');
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_north_wall_first_hit_hybrid')
				throw new Error('R7-3.10 north wall wardrobe diffuse runtime pointer failed contract');
			if (pointer.runtimeArchitecture !== 'single_full_north_wall_first_hit_hybrid')
				throw new Error('R7-3.10 north wall wardrobe diffuse runtime architecture mismatch');
			if (pointer.northeastFurnitureMode !== 'wardrobe')
				throw new Error('R7-3.10 north wall wardrobe diffuse furniture mode mismatch');
			if (pointer.targetId !== R7310_C1_NORTH_WALL_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 north wall wardrobe diffuse runtime package metadata mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 north wall wardrobe diffuse validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 north wall wardrobe diffuse runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 north wall wardrobe diffuse atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 north wall wardrobe diffuse atlas binary length mismatch');
			if (r7310C1FullRoomDiffuseRuntimePackage &&
				r7310C1FullRoomDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1NorthWallDiffuseRuntimePackage &&
				r7310C1NorthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1EastWallDiffuseRuntimePackage &&
				r7310C1EastWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1EastWallWardrobeDiffuseRuntimePackage &&
				r7310C1EastWallWardrobeDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			r7310C1NorthWallWardrobeDiffuseRuntimePackage = pointer;
			r7310C1NorthWallWardrobeDiffuseRuntimeTexture = new Float32Array(atlasBuffer);
			refreshR7310C1CombinedDiffuseRuntimeTexture();
			r7310C1NorthWallWardrobeDiffuseRuntimeReady = true;
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			markR7310C1RuntimeLoadingStepComplete('northWall');
			return pointer;
		}
		catch (error)
		{
			r7310C1NorthWallWardrobeDiffuseRuntimeReady = false;
			r7310C1NorthWallWardrobeDiffuseRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1NorthWallWardrobeDiffuseRuntimeLoadPromise;
}

async function loadR7310C1EastWallWardrobeDiffuseRuntimePackage()
{
	if (r7310C1EastWallWardrobeDiffuseRuntimeLoadPromise) return r7310C1EastWallWardrobeDiffuseRuntimeLoadPromise;
	r7310C1EastWallWardrobeDiffuseRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1EastWallWardrobeDiffuseRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_EAST_WALL_WARDROBE_DIFFUSE_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
				throw new Error('R7-3.10 east wall wardrobe diffuse runtime pointer not found');
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_east_wall_first_hit_hybrid')
				throw new Error('R7-3.10 east wall wardrobe diffuse runtime pointer failed contract');
			if (pointer.runtimeArchitecture !== 'single_full_east_wall_first_hit_hybrid')
				throw new Error('R7-3.10 east wall wardrobe diffuse runtime architecture mismatch');
			if (pointer.northeastFurnitureMode !== 'wardrobe')
				throw new Error('R7-3.10 east wall wardrobe diffuse furniture mode mismatch');
			if (pointer.targetId !== R7310_C1_EAST_WALL_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 east wall wardrobe diffuse runtime package metadata mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 east wall wardrobe diffuse validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 east wall wardrobe diffuse runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 east wall wardrobe diffuse atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 east wall wardrobe diffuse atlas binary length mismatch');
			if (r7310C1FullRoomDiffuseRuntimePackage &&
				r7310C1FullRoomDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1NorthWallDiffuseRuntimePackage &&
				r7310C1NorthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1NorthWallWardrobeDiffuseRuntimePackage &&
				r7310C1NorthWallWardrobeDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1EastWallDiffuseRuntimePackage &&
				r7310C1EastWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			r7310C1EastWallWardrobeDiffuseRuntimePackage = pointer;
			r7310C1EastWallWardrobeDiffuseRuntimeTexture = new Float32Array(atlasBuffer);
			refreshR7310C1CombinedDiffuseRuntimeTexture();
			r7310C1EastWallWardrobeDiffuseRuntimeReady = true;
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			markR7310C1RuntimeLoadingStepComplete('eastWall');
			return pointer;
		}
		catch (error)
		{
			r7310C1EastWallWardrobeDiffuseRuntimeReady = false;
			r7310C1EastWallWardrobeDiffuseRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1EastWallWardrobeDiffuseRuntimeLoadPromise;
}

async function loadR7310C1WestWallDiffuseRuntimePackage()
{
	if (r7310C1WestWallDiffuseRuntimeLoadPromise) return r7310C1WestWallDiffuseRuntimeLoadPromise;
	r7310C1WestWallDiffuseRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1WestWallDiffuseRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_WEST_WALL_DIFFUSE_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
				throw new Error('R7-3.10 west wall diffuse runtime pointer not found');
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_west_wall_diffuse_short_circuit')
				throw new Error('R7-3.10 west wall diffuse runtime pointer failed contract');
			if (pointer.targetId !== R7310_C1_WEST_WALL_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 west wall diffuse runtime package metadata mismatch');
			if (pointer.runtimeArchitecture !== 'single_full_west_wall_first_hit_hybrid')
				throw new Error('R7-3.10 west wall diffuse runtime architecture mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 west wall diffuse validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 west wall diffuse runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 west wall diffuse atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 west wall diffuse atlas binary length mismatch');
			if (r7310C1FullRoomDiffuseRuntimePackage &&
				r7310C1FullRoomDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1NorthWallDiffuseRuntimePackage &&
				r7310C1NorthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1EastWallDiffuseRuntimePackage &&
				r7310C1EastWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				if (r7310C1SouthWallDiffuseRuntimePackage &&
					r7310C1SouthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
					throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				if (r7310C1CeilingDiffuseRuntimePackage &&
					r7310C1CeilingDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
					throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				r7310C1WestWallDiffuseRuntimePackage = pointer;
			r7310C1WestWallDiffuseRuntimeTexture = new Float32Array(atlasBuffer);
				refreshR7310C1CombinedDiffuseRuntimeTexture();
				r7310C1WestWallDiffuseRuntimeReady = true;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('westWall');
				return pointer;
		}
		catch (error)
		{
			r7310C1WestWallDiffuseRuntimeReady = false;
			r7310C1WestWallDiffuseRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1WestWallDiffuseRuntimeLoadPromise;
}

async function loadR7310C1SouthWallDiffuseRuntimePackage()
{
	if (r7310C1SouthWallDiffuseRuntimeLoadPromise) return r7310C1SouthWallDiffuseRuntimeLoadPromise;
	r7310C1SouthWallDiffuseRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1SouthWallDiffuseRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_SOUTH_WALL_DIFFUSE_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
				throw new Error('R7-3.10 south wall diffuse runtime pointer not found');
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_south_wall_diffuse_short_circuit')
				throw new Error('R7-3.10 south wall diffuse runtime pointer failed contract');
			if (pointer.targetId !== R7310_C1_SOUTH_WALL_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 south wall diffuse runtime package metadata mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 south wall diffuse validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 south wall diffuse runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 south wall diffuse atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 south wall diffuse atlas binary length mismatch');
			if (r7310C1FullRoomDiffuseRuntimePackage &&
				r7310C1FullRoomDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1NorthWallDiffuseRuntimePackage &&
				r7310C1NorthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1EastWallDiffuseRuntimePackage &&
				r7310C1EastWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				if (r7310C1WestWallDiffuseRuntimePackage &&
					r7310C1WestWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
					throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				if (r7310C1CeilingDiffuseRuntimePackage &&
					r7310C1CeilingDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
					throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
				r7310C1SouthWallDiffuseRuntimePackage = pointer;
			r7310C1SouthWallDiffuseRuntimeTexture = new Float32Array(atlasBuffer);
				refreshR7310C1CombinedDiffuseRuntimeTexture();
				r7310C1SouthWallDiffuseRuntimeReady = true;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('southWall');
				return pointer;
		}
		catch (error)
		{
			r7310C1SouthWallDiffuseRuntimeReady = false;
			r7310C1SouthWallDiffuseRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1SouthWallDiffuseRuntimeLoadPromise;
}

async function loadR7310C1CeilingDiffuseRuntimePackage()
{
	if (r7310C1CeilingDiffuseRuntimeLoadPromise) return r7310C1CeilingDiffuseRuntimeLoadPromise;
	r7310C1CeilingDiffuseRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1CeilingDiffuseRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_CEILING_DIFFUSE_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
				throw new Error('R7-3.10 ceiling diffuse runtime pointer not found');
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_ceiling_first_hit_hybrid')
				throw new Error('R7-3.10 ceiling diffuse runtime pointer failed contract');
			if (pointer.runtimeArchitecture !== 'single_full_ceiling_first_hit_hybrid')
				throw new Error('R7-3.10 ceiling diffuse runtime architecture mismatch');
			if (pointer.bakedRadianceKind !== 'indirect_diffuse_radiance' || pointer.directLightAlreadyIncluded !== false || pointer.addDirectLightAfterBakeLookup !== true)
				throw new Error('R7-3.10 ceiling diffuse runtime radiance contract mismatch');
			if (pointer.runtimeTexture !== 'tR7310C1FullRoomDiffuseAtlasTexture' || pointer.runtimeAtlasSlot !== 5)
				throw new Error('R7-3.10 ceiling diffuse runtime atlas slot mismatch');
			if (pointer.targetId !== R7310_C1_CEILING_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 ceiling diffuse runtime package metadata mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 ceiling diffuse validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 ceiling diffuse runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 ceiling diffuse atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 ceiling diffuse atlas binary length mismatch');
			if (r7310C1FullRoomDiffuseRuntimePackage &&
				r7310C1FullRoomDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1NorthWallDiffuseRuntimePackage &&
				r7310C1NorthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1EastWallDiffuseRuntimePackage &&
				r7310C1EastWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1WestWallDiffuseRuntimePackage &&
				r7310C1WestWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1SouthWallDiffuseRuntimePackage &&
				r7310C1SouthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			r7310C1CeilingDiffuseRuntimePackage = pointer;
			r7310C1CeilingDiffuseRuntimeTexture = new Float32Array(atlasBuffer);
				refreshR7310C1CombinedDiffuseRuntimeTexture();
				r7310C1CeilingDiffuseRuntimeReady = true;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('ceiling');
				return pointer;
		}
		catch (error)
		{
			r7310C1CeilingDiffuseRuntimeReady = false;
			r7310C1CeilingDiffuseRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1CeilingDiffuseRuntimeLoadPromise;
}

async function loadR7310C1StructuralDiffuseRuntimePackage()
{
	if (r7310C1StructuralDiffuseRuntimeLoadPromise) return r7310C1StructuralDiffuseRuntimeLoadPromise;
	r7310C1StructuralDiffuseRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1StructuralDiffuseRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_STRUCTURAL_DIFFUSE_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
			{
				r7310C1StructuralDiffuseRuntimePending = true;
				r7310C1StructuralDiffuseRuntimeReady = false;
				r7310C1StructuralDiffuseRuntimePackage = null;
				r7310C1StructuralDiffuseRuntimeTexture = null;
				refreshR7310C1CombinedDiffuseRuntimeTexture();
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('structural');
				return {
					packageStatus: 'pending',
					runtimeScope: 'c1_structural_beams_columns_diffuse_short_circuit',
					targetId: R7310_C1_STRUCTURAL_TARGET_ID,
					surfaceName: R7310_C1_STRUCTURAL_SURFACE_NAME,
					structuralPending: true
				};
			}
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_structural_beams_columns_diffuse_short_circuit')
				throw new Error('R7-3.10 structural diffuse runtime pointer failed contract');
			if (pointer.targetId !== R7310_C1_STRUCTURAL_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 structural diffuse runtime package metadata mismatch');
			if (pointer.surfaceName !== R7310_C1_STRUCTURAL_SURFACE_NAME)
				throw new Error('R7-3.10 structural diffuse runtime surface mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 structural diffuse validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 structural diffuse runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 structural diffuse atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 structural diffuse atlas binary length mismatch');
			if (r7310C1FullRoomDiffuseRuntimePackage &&
				r7310C1FullRoomDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1NorthWallDiffuseRuntimePackage &&
				r7310C1NorthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1EastWallDiffuseRuntimePackage &&
				r7310C1EastWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1WestWallDiffuseRuntimePackage &&
				r7310C1WestWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1SouthWallDiffuseRuntimePackage &&
				r7310C1SouthWallDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			if (r7310C1CeilingDiffuseRuntimePackage &&
				r7310C1CeilingDiffuseRuntimePackage.targetAtlasResolution !== pointer.targetAtlasResolution)
				throw new Error('R7-3.10 combined diffuse atlas resolution mismatch');
			r7310C1StructuralDiffuseRuntimePending = false;
			r7310C1StructuralDiffuseRuntimePackage = pointer;
			r7310C1StructuralDiffuseRuntimeTexture = new Float32Array(atlasBuffer);
			refreshR7310C1CombinedDiffuseRuntimeTexture();
			r7310C1StructuralDiffuseRuntimeReady = true;
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			markR7310C1RuntimeLoadingStepComplete('structural');
			if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-structural-diffuse-runtime-ready');
			return pointer;
		}
		catch (error)
		{
			r7310C1StructuralDiffuseRuntimePending = false;
			r7310C1StructuralDiffuseRuntimeReady = false;
			r7310C1StructuralDiffuseRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1StructuralDiffuseRuntimeLoadPromise;
}

async function loadR7310C1SeColumnNorthShadowRuntimePackage()
{
	if (r7310C1SeColumnNorthShadowRuntimeLoadPromise) return r7310C1SeColumnNorthShadowRuntimeLoadPromise;
	r7310C1SeColumnNorthShadowRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1SeColumnNorthShadowRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_SE_COLUMN_NORTH_SHADOW_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
			{
				r7310C1SeColumnNorthShadowRuntimePending = true;
				r7310C1SeColumnNorthShadowRuntimeReady = false;
				r7310C1SeColumnNorthShadowRuntimePackage = null;
				r7310C1SeColumnNorthShadowRuntimeTexture = null;
				r7310C1SeColumnNorthShadowRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('seColumnNorthShadow');
				return {
					packageStatus: 'pending',
					runtimeScope: 'c1_se_column_north_shadow_diffuse_short_circuit',
					targetId: R7310_C1_SE_COLUMN_NORTH_SHADOW_TARGET_ID,
					surfaceName: R7310_C1_SE_COLUMN_NORTH_SHADOW_SURFACE_NAME,
					seColumnNorthShadowPending: true
				};
			}
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus === 'pending')
			{
				r7310C1SeColumnNorthShadowRuntimePending = true;
				r7310C1SeColumnNorthShadowRuntimeReady = false;
				r7310C1SeColumnNorthShadowRuntimePackage = pointer;
				r7310C1SeColumnNorthShadowRuntimeTexture = null;
				r7310C1SeColumnNorthShadowRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('seColumnNorthShadow');
				return pointer;
			}
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_se_column_north_shadow_diffuse_short_circuit')
				throw new Error('R7-3.10 southeast column north shadow runtime pointer failed contract');
			if (pointer.targetId !== R7310_C1_SE_COLUMN_NORTH_SHADOW_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 southeast column north shadow runtime package metadata mismatch');
			if (pointer.surfaceName !== R7310_C1_SE_COLUMN_NORTH_SHADOW_SURFACE_NAME)
				throw new Error('R7-3.10 southeast column north shadow runtime surface mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 southeast column north shadow validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 southeast column north shadow runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 southeast column north shadow atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 southeast column north shadow atlas binary length mismatch');
			r7310C1SeColumnNorthShadowRuntimePending = false;
			r7310C1SeColumnNorthShadowRuntimePackage = pointer;
			r7310C1SeColumnNorthShadowRuntimeTexture = new Float32Array(atlasBuffer);
			r7310C1SeColumnNorthShadowRuntimeDataTexture = createR7310C1StandaloneRuntimeTexture(
				r7310C1SeColumnNorthShadowRuntimeTexture,
				pointer.targetAtlasResolution
			);
			refreshR7310C1CombinedDiffuseRuntimeTexture();
			r7310C1SeColumnNorthShadowRuntimeReady = !!r7310C1SeColumnNorthShadowRuntimeDataTexture;
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			markR7310C1RuntimeLoadingStepComplete('seColumnNorthShadow');
			if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-se-column-north-shadow-runtime-ready');
			return pointer;
		}
		catch (error)
		{
			r7310C1SeColumnNorthShadowRuntimePending = false;
			r7310C1SeColumnNorthShadowRuntimeReady = false;
			r7310C1SeColumnNorthShadowRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1SeColumnNorthShadowRuntimeLoadPromise;
}

async function loadR7310C1SeColumnWestShadowRuntimePackage()
{
	if (r7310C1SeColumnWestShadowRuntimeLoadPromise) return r7310C1SeColumnWestShadowRuntimeLoadPromise;
	r7310C1SeColumnWestShadowRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1SeColumnWestShadowRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_SE_COLUMN_WEST_SHADOW_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
			{
				r7310C1SeColumnWestShadowRuntimePending = true;
				r7310C1SeColumnWestShadowRuntimeReady = false;
				r7310C1SeColumnWestShadowRuntimePackage = null;
				r7310C1SeColumnWestShadowRuntimeTexture = null;
				r7310C1SeColumnWestShadowRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('seColumnWestShadow');
				return {
					packageStatus: 'pending',
					runtimeScope: 'c1_se_column_west_shadow_diffuse_short_circuit',
					targetId: R7310_C1_SE_COLUMN_WEST_SHADOW_TARGET_ID,
					surfaceName: R7310_C1_SE_COLUMN_WEST_SHADOW_SURFACE_NAME,
					seColumnWestShadowPending: true
				};
			}
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus === 'pending')
			{
				r7310C1SeColumnWestShadowRuntimePending = true;
				r7310C1SeColumnWestShadowRuntimeReady = false;
				r7310C1SeColumnWestShadowRuntimePackage = pointer;
				r7310C1SeColumnWestShadowRuntimeTexture = null;
				r7310C1SeColumnWestShadowRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('seColumnWestShadow');
				return pointer;
			}
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_se_column_west_shadow_diffuse_short_circuit')
				throw new Error('R7-3.10 southeast column west shadow runtime pointer failed contract');
			if (pointer.targetId !== R7310_C1_SE_COLUMN_WEST_SHADOW_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 southeast column west shadow runtime package metadata mismatch');
			if (pointer.surfaceName !== R7310_C1_SE_COLUMN_WEST_SHADOW_SURFACE_NAME)
				throw new Error('R7-3.10 southeast column west shadow runtime surface mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 southeast column west shadow validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 southeast column west shadow runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 southeast column west shadow atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 southeast column west shadow atlas binary length mismatch');
			r7310C1SeColumnWestShadowRuntimePending = false;
			r7310C1SeColumnWestShadowRuntimePackage = pointer;
			r7310C1SeColumnWestShadowRuntimeTexture = new Float32Array(atlasBuffer);
			r7310C1SeColumnWestShadowRuntimeDataTexture = createR7310C1StandaloneRuntimeTexture(
				r7310C1SeColumnWestShadowRuntimeTexture,
				pointer.targetAtlasResolution
			);
			refreshR7310C1CombinedDiffuseRuntimeTexture();
			r7310C1SeColumnWestShadowRuntimeReady = !!r7310C1SeColumnWestShadowRuntimeDataTexture;
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			markR7310C1RuntimeLoadingStepComplete('seColumnWestShadow');
			if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-se-column-west-shadow-runtime-ready');
			return pointer;
		}
		catch (error)
		{
			r7310C1SeColumnWestShadowRuntimePending = false;
			r7310C1SeColumnWestShadowRuntimeReady = false;
			r7310C1SeColumnWestShadowRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1SeColumnWestShadowRuntimeLoadPromise;
}

async function loadR7310C1SouthWallAcShadowRuntimePackage()
{
	if (r7310C1SouthWallAcShadowRuntimeLoadPromise) return r7310C1SouthWallAcShadowRuntimeLoadPromise;
	r7310C1SouthWallAcShadowRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1SouthWallAcShadowRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_SOUTH_WALL_AC_SHADOW_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
			{
				r7310C1SouthWallAcShadowRuntimePending = true;
				r7310C1SouthWallAcShadowRuntimeReady = false;
				r7310C1SouthWallAcShadowRuntimePackage = null;
				r7310C1SouthWallAcShadowRuntimeTexture = null;
				r7310C1SouthWallAcShadowRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('southWallAcShadow');
				return {
					packageStatus: 'pending',
					runtimeScope: 'c1_south_wall_ac_shadow_diffuse_short_circuit',
					targetId: R7310_C1_SOUTH_WALL_AC_SHADOW_TARGET_ID,
					surfaceName: R7310_C1_SOUTH_WALL_AC_SHADOW_SURFACE_NAME,
					southWallAcShadowPending: true
				};
			}
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus === 'pending')
			{
				r7310C1SouthWallAcShadowRuntimePending = true;
				r7310C1SouthWallAcShadowRuntimeReady = false;
				r7310C1SouthWallAcShadowRuntimePackage = pointer;
				r7310C1SouthWallAcShadowRuntimeTexture = null;
				r7310C1SouthWallAcShadowRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('southWallAcShadow');
				return pointer;
			}
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_south_wall_ac_shadow_diffuse_short_circuit')
				throw new Error('R7-3.10 south wall AC shadow runtime pointer failed contract');
			if (pointer.targetId !== R7310_C1_SOUTH_WALL_AC_SHADOW_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 south wall AC shadow runtime package metadata mismatch');
			if (pointer.surfaceName !== R7310_C1_SOUTH_WALL_AC_SHADOW_SURFACE_NAME)
				throw new Error('R7-3.10 south wall AC shadow runtime surface mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 south wall AC shadow validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 south wall AC shadow runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 south wall AC shadow atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 south wall AC shadow atlas binary length mismatch');
			r7310C1SouthWallAcShadowRuntimePending = false;
			r7310C1SouthWallAcShadowRuntimePackage = pointer;
			r7310C1SouthWallAcShadowRuntimeTexture = new Float32Array(atlasBuffer);
			r7310C1SouthWallAcShadowRuntimeDataTexture = createR7310C1StandaloneRuntimeTexture(
				r7310C1SouthWallAcShadowRuntimeTexture,
				pointer.targetAtlasResolution
			);
			refreshR7310C1CombinedDiffuseRuntimeTexture();
			r7310C1SouthWallAcShadowRuntimeReady = !!r7310C1SouthWallAcShadowRuntimeDataTexture;
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			markR7310C1RuntimeLoadingStepComplete('southWallAcShadow');
			if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-south-wall-ac-shadow-runtime-ready');
			return pointer;
		}
		catch (error)
		{
			r7310C1SouthWallAcShadowRuntimePending = false;
			r7310C1SouthWallAcShadowRuntimeReady = false;
			r7310C1SouthWallAcShadowRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1SouthWallAcShadowRuntimeLoadPromise;
}

async function loadR7310C1EastWallBeamShadowRuntimePackage()
{
	if (r7310C1EastWallBeamShadowRuntimeLoadPromise) return r7310C1EastWallBeamShadowRuntimeLoadPromise;
	r7310C1EastWallBeamShadowRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1EastWallBeamShadowRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_EAST_WALL_BEAM_SHADOW_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
			{
				r7310C1EastWallBeamShadowRuntimePending = true;
				r7310C1EastWallBeamShadowRuntimeReady = false;
				r7310C1EastWallBeamShadowRuntimePackage = null;
				r7310C1EastWallBeamShadowRuntimeTexture = null;
				r7310C1EastWallBeamShadowRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('eastWallBeamShadow');
				return {
					packageStatus: 'pending',
					runtimeScope: 'c1_east_wall_beam_shadow_diffuse_short_circuit',
					targetId: R7310_C1_EAST_WALL_BEAM_SHADOW_TARGET_ID,
					surfaceName: R7310_C1_EAST_WALL_BEAM_SHADOW_SURFACE_NAME,
					eastWallBeamShadowPending: true
				};
			}
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus === 'pending')
			{
				r7310C1EastWallBeamShadowRuntimePending = true;
				r7310C1EastWallBeamShadowRuntimeReady = false;
				r7310C1EastWallBeamShadowRuntimePackage = pointer;
				r7310C1EastWallBeamShadowRuntimeTexture = null;
				r7310C1EastWallBeamShadowRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('eastWallBeamShadow');
				return pointer;
			}
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_east_wall_beam_shadow_diffuse_short_circuit')
				throw new Error('R7-3.10 east wall beam shadow runtime pointer failed contract');
			if (pointer.targetId !== R7310_C1_EAST_WALL_BEAM_SHADOW_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 east wall beam shadow runtime package metadata mismatch');
			if (pointer.surfaceName !== R7310_C1_EAST_WALL_BEAM_SHADOW_SURFACE_NAME)
				throw new Error('R7-3.10 east wall beam shadow runtime surface mismatch');
			if (pointer.northeastFurnitureMode !== 'bed')
				throw new Error('R7-3.10 east wall beam shadow runtime furniture mode mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 east wall beam shadow validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 east wall beam shadow runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 east wall beam shadow atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 east wall beam shadow atlas binary length mismatch');
			r7310C1EastWallBeamShadowRuntimePending = false;
			r7310C1EastWallBeamShadowRuntimePackage = pointer;
			r7310C1EastWallBeamShadowRuntimeTexture = new Float32Array(atlasBuffer);
			r7310C1EastWallBeamShadowRuntimeDataTexture = createR7310C1StandaloneRuntimeTexture(
				r7310C1EastWallBeamShadowRuntimeTexture,
				pointer.targetAtlasResolution
			);
			refreshR7310C1CombinedDiffuseRuntimeTexture();
			r7310C1EastWallBeamShadowRuntimeReady = !!r7310C1EastWallBeamShadowRuntimeDataTexture;
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			markR7310C1RuntimeLoadingStepComplete('eastWallBeamShadow');
			if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-east-wall-beam-shadow-runtime-ready');
			return pointer;
		}
		catch (error)
		{
			r7310C1EastWallBeamShadowRuntimePending = false;
			r7310C1EastWallBeamShadowRuntimeReady = false;
			r7310C1EastWallBeamShadowRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1EastWallBeamShadowRuntimeLoadPromise;
}

async function loadR7310C1EastWallBeamShadowWardrobeRuntimePackage()
{
	if (r7310C1EastWallBeamShadowWardrobeRuntimeLoadPromise) return r7310C1EastWallBeamShadowWardrobeRuntimeLoadPromise;
	r7310C1EastWallBeamShadowWardrobeRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1EastWallBeamShadowWardrobeRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_EAST_WALL_BEAM_SHADOW_WARDROBE_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
			{
				r7310C1EastWallBeamShadowWardrobeRuntimePending = true;
				r7310C1EastWallBeamShadowWardrobeRuntimeReady = false;
				r7310C1EastWallBeamShadowWardrobeRuntimePackage = null;
				r7310C1EastWallBeamShadowWardrobeRuntimeTexture = null;
				r7310C1EastWallBeamShadowWardrobeRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('eastWallBeamShadow');
				return {
					packageStatus: 'pending',
					runtimeScope: 'c1_east_wall_beam_shadow_diffuse_short_circuit',
					targetId: R7310_C1_EAST_WALL_BEAM_SHADOW_TARGET_ID,
					surfaceName: R7310_C1_EAST_WALL_BEAM_SHADOW_SURFACE_NAME,
					northeastFurnitureMode: 'wardrobe',
					eastWallBeamShadowPending: true
				};
			}
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus === 'pending')
			{
				r7310C1EastWallBeamShadowWardrobeRuntimePending = true;
				r7310C1EastWallBeamShadowWardrobeRuntimeReady = false;
				r7310C1EastWallBeamShadowWardrobeRuntimePackage = pointer;
				r7310C1EastWallBeamShadowWardrobeRuntimeTexture = null;
				r7310C1EastWallBeamShadowWardrobeRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('eastWallBeamShadow');
				return pointer;
			}
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_east_wall_beam_shadow_diffuse_short_circuit')
				throw new Error('R7-3.10 east wall beam shadow wardrobe runtime pointer failed contract');
			if (pointer.targetId !== R7310_C1_EAST_WALL_BEAM_SHADOW_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 east wall beam shadow wardrobe runtime package metadata mismatch');
			if (pointer.surfaceName !== R7310_C1_EAST_WALL_BEAM_SHADOW_SURFACE_NAME)
				throw new Error('R7-3.10 east wall beam shadow wardrobe runtime surface mismatch');
			if (pointer.northeastFurnitureMode !== 'wardrobe')
				throw new Error('R7-3.10 east wall beam shadow wardrobe runtime furniture mode mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 east wall beam shadow wardrobe validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 east wall beam shadow wardrobe runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 east wall beam shadow wardrobe atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 east wall beam shadow wardrobe atlas binary length mismatch');
			r7310C1EastWallBeamShadowWardrobeRuntimePending = false;
			r7310C1EastWallBeamShadowWardrobeRuntimePackage = pointer;
			r7310C1EastWallBeamShadowWardrobeRuntimeTexture = new Float32Array(atlasBuffer);
			r7310C1EastWallBeamShadowWardrobeRuntimeDataTexture = createR7310C1StandaloneRuntimeTexture(
				r7310C1EastWallBeamShadowWardrobeRuntimeTexture,
				pointer.targetAtlasResolution
			);
			refreshR7310C1CombinedDiffuseRuntimeTexture();
			r7310C1EastWallBeamShadowWardrobeRuntimeReady = !!r7310C1EastWallBeamShadowWardrobeRuntimeDataTexture;
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			markR7310C1RuntimeLoadingStepComplete('eastWallBeamShadow');
			if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-east-wall-beam-shadow-wardrobe-runtime-ready');
			return pointer;
		}
		catch (error)
		{
			r7310C1EastWallBeamShadowWardrobeRuntimePending = false;
			r7310C1EastWallBeamShadowWardrobeRuntimeReady = false;
			r7310C1EastWallBeamShadowWardrobeRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1EastWallBeamShadowWardrobeRuntimeLoadPromise;
}

async function loadR7310C1SwColumnNorthShadowRuntimePackage()
{
	if (r7310C1SwColumnNorthShadowRuntimeLoadPromise) return r7310C1SwColumnNorthShadowRuntimeLoadPromise;
	r7310C1SwColumnNorthShadowRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1SwColumnNorthShadowRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_SW_COLUMN_NORTH_SHADOW_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
			{
				r7310C1SwColumnNorthShadowRuntimePending = true;
				r7310C1SwColumnNorthShadowRuntimeReady = false;
				r7310C1SwColumnNorthShadowRuntimePackage = null;
				r7310C1SwColumnNorthShadowRuntimeTexture = null;
				r7310C1SwColumnNorthShadowRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('swColumnNorthShadow');
				return {
					packageStatus: 'pending',
					runtimeScope: 'c1_sw_column_north_shadow_diffuse_short_circuit',
					targetId: R7310_C1_SW_COLUMN_NORTH_SHADOW_TARGET_ID,
					surfaceName: R7310_C1_SW_COLUMN_NORTH_SHADOW_SURFACE_NAME,
					swColumnNorthShadowPending: true
				};
			}
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus === 'pending')
			{
				r7310C1SwColumnNorthShadowRuntimePending = true;
				r7310C1SwColumnNorthShadowRuntimeReady = false;
				r7310C1SwColumnNorthShadowRuntimePackage = pointer;
				r7310C1SwColumnNorthShadowRuntimeTexture = null;
				r7310C1SwColumnNorthShadowRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('swColumnNorthShadow');
				return pointer;
			}
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_sw_column_north_shadow_diffuse_short_circuit')
				throw new Error('R7-3.10 southwest column north shadow runtime pointer failed contract');
			if (pointer.targetId !== R7310_C1_SW_COLUMN_NORTH_SHADOW_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 southwest column north shadow runtime package metadata mismatch');
			if (pointer.surfaceName !== R7310_C1_SW_COLUMN_NORTH_SHADOW_SURFACE_NAME)
				throw new Error('R7-3.10 southwest column north shadow runtime surface mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 southwest column north shadow validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 southwest column north shadow runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 southwest column north shadow atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 southwest column north shadow atlas binary length mismatch');
			r7310C1SwColumnNorthShadowRuntimePending = false;
			r7310C1SwColumnNorthShadowRuntimePackage = pointer;
			r7310C1SwColumnNorthShadowRuntimeTexture = new Float32Array(atlasBuffer);
			r7310C1SwColumnNorthShadowRuntimeDataTexture = createR7310C1StandaloneRuntimeTexture(
				r7310C1SwColumnNorthShadowRuntimeTexture,
				pointer.targetAtlasResolution
			);
			refreshR7310C1CombinedDiffuseRuntimeTexture();
			r7310C1SwColumnNorthShadowRuntimeReady = !!r7310C1SwColumnNorthShadowRuntimeDataTexture;
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			markR7310C1RuntimeLoadingStepComplete('swColumnNorthShadow');
			if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-sw-column-north-shadow-runtime-ready');
			return pointer;
		}
		catch (error)
		{
			r7310C1SwColumnNorthShadowRuntimePending = false;
			r7310C1SwColumnNorthShadowRuntimeReady = false;
			r7310C1SwColumnNorthShadowRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1SwColumnNorthShadowRuntimeLoadPromise;
}

async function loadR7310C1WestWallBeamShadowRuntimePackage()
{
	if (r7310C1WestWallBeamShadowRuntimeLoadPromise) return r7310C1WestWallBeamShadowRuntimeLoadPromise;
	r7310C1WestWallBeamShadowRuntimeLoadPromise = (async function()
	{
		try
		{
			r7310C1WestWallBeamShadowRuntimeError = null;
			var pointerResponse = await fetch(R7310_C1_WEST_WALL_BEAM_SHADOW_RUNTIME_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
			{
				r7310C1WestWallBeamShadowRuntimePending = true;
				r7310C1WestWallBeamShadowRuntimeReady = false;
				r7310C1WestWallBeamShadowRuntimePackage = null;
				r7310C1WestWallBeamShadowRuntimeTexture = null;
				r7310C1WestWallBeamShadowRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('westWallBeamShadow');
				return {
					packageStatus: 'pending',
					runtimeScope: 'c1_west_wall_beam_shadow_diffuse_short_circuit',
					targetId: R7310_C1_WEST_WALL_BEAM_SHADOW_TARGET_ID,
					surfaceName: R7310_C1_WEST_WALL_BEAM_SHADOW_SURFACE_NAME,
					westWallBeamShadowPending: true
				};
			}
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus === 'pending')
			{
				r7310C1WestWallBeamShadowRuntimePending = true;
				r7310C1WestWallBeamShadowRuntimeReady = false;
				r7310C1WestWallBeamShadowRuntimePackage = pointer;
				r7310C1WestWallBeamShadowRuntimeTexture = null;
				r7310C1WestWallBeamShadowRuntimeDataTexture = null;
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete('westWallBeamShadow');
				return pointer;
			}
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_west_wall_beam_shadow_diffuse_short_circuit')
				throw new Error('R7-3.10 west wall beam shadow runtime pointer failed contract');
			if (pointer.targetId !== R7310_C1_WEST_WALL_BEAM_SHADOW_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 west wall beam shadow runtime package metadata mismatch');
			if (pointer.surfaceName !== R7310_C1_WEST_WALL_BEAM_SHADOW_SURFACE_NAME)
				throw new Error('R7-3.10 west wall beam shadow runtime surface mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 west wall beam shadow validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 west wall beam shadow runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 west wall beam shadow atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 west wall beam shadow atlas binary length mismatch');
			r7310C1WestWallBeamShadowRuntimePending = false;
			r7310C1WestWallBeamShadowRuntimePackage = pointer;
			r7310C1WestWallBeamShadowRuntimeTexture = new Float32Array(atlasBuffer);
			r7310C1WestWallBeamShadowRuntimeDataTexture = createR7310C1StandaloneRuntimeTexture(
				r7310C1WestWallBeamShadowRuntimeTexture,
				pointer.targetAtlasResolution
			);
			refreshR7310C1CombinedDiffuseRuntimeTexture();
			r7310C1WestWallBeamShadowRuntimeReady = !!r7310C1WestWallBeamShadowRuntimeDataTexture;
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			markR7310C1RuntimeLoadingStepComplete('westWallBeamShadow');
			if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-west-wall-beam-shadow-runtime-ready');
			return pointer;
		}
		catch (error)
		{
			r7310C1WestWallBeamShadowRuntimePending = false;
			r7310C1WestWallBeamShadowRuntimeReady = false;
			r7310C1WestWallBeamShadowRuntimeError = error && error.message ? error.message : String(error);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	return r7310C1WestWallBeamShadowRuntimeLoadPromise;
}

async function loadR7310C1DedicatedBeamColumnShadowRuntimePackage(spec)
{
	if (spec.getLoadPromise()) return spec.getLoadPromise();
	var loadPromise = (async function()
	{
		try
		{
			spec.setError(null);
			var pointerResponse = await fetch(spec.packageUrl, { cache: 'no-store' });
			if (!pointerResponse.ok)
			{
				spec.setPending(true);
				spec.setReady(false);
				spec.setPackage(null);
				spec.setTexture(null);
				spec.setDataTexture(null);
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete(spec.stepName);
				var pendingResult = {
					packageStatus: 'pending',
					runtimeScope: spec.runtimeScope,
					targetId: spec.targetId,
					surfaceName: spec.surfaceName
				};
				pendingResult[spec.pendingKey] = true;
				return pendingResult;
			}
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus === 'pending')
			{
				spec.setPending(true);
				spec.setReady(false);
				spec.setPackage(pointer);
				spec.setTexture(null);
				spec.setDataTexture(null);
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
				markR7310C1RuntimeLoadingStepComplete(spec.stepName);
				return pointer;
			}
			if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== spec.runtimeScope)
				throw new Error('R7-3.10 ' + spec.label + ' runtime pointer failed contract');
			if (pointer.targetId !== spec.targetId || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
				throw new Error('R7-3.10 ' + spec.label + ' runtime package metadata mismatch');
			if (pointer.surfaceName !== spec.surfaceName)
				throw new Error('R7-3.10 ' + spec.label + ' runtime surface mismatch');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.10 ' + spec.label + ' validation report not found');
			var validation = await validationResponse.json();
			if (validation.runnerStatus !== 'pass')
				throw new Error('R7-3.10 ' + spec.label + ' runner validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.10 ' + spec.label + ' atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.10 ' + spec.label + ' atlas binary length mismatch');
			spec.setPending(false);
			spec.setPackage(pointer);
			var atlasPixels = new Float32Array(atlasBuffer);
			spec.setTexture(atlasPixels);
			var dataTexture = createR7310C1StandaloneRuntimeTexture(atlasPixels, pointer.targetAtlasResolution);
			spec.setDataTexture(dataTexture);
			refreshR7310C1CombinedDiffuseRuntimeTexture();
			spec.setReady(!!dataTexture);
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			markR7310C1RuntimeLoadingStepComplete(spec.stepName);
			if (typeof wakeRender === 'function') wakeRender(spec.wakeReason);
			return pointer;
		}
		catch (error)
		{
			spec.setPending(false);
			spec.setReady(false);
			spec.setError(error && error.message ? error.message : String(error));
			updateR7310C1FullRoomDiffuseRuntimeUniforms();
			throw error;
		}
	})();
	spec.setLoadPromise(loadPromise);
	return loadPromise;
}

async function loadR7310C1SwColumnInnerShadowRuntimePackage()
{
	return loadR7310C1DedicatedBeamColumnShadowRuntimePackage({
		getLoadPromise: function() { return r7310C1SwColumnInnerShadowRuntimeLoadPromise; },
		setLoadPromise: function(value) { r7310C1SwColumnInnerShadowRuntimeLoadPromise = value; },
		packageUrl: R7310_C1_SW_COLUMN_INNER_SHADOW_RUNTIME_PACKAGE_URL,
		runtimeScope: 'c1_sw_column_inner_shadow_diffuse_short_circuit',
		targetId: R7310_C1_SW_COLUMN_INNER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SW_COLUMN_INNER_SHADOW_SURFACE_NAME,
		stepName: 'swColumnInnerShadow',
		pendingKey: 'swColumnInnerShadowPending',
		label: 'southwest column inner shadow',
		wakeReason: 'r7-3-10-c1-sw-column-inner-shadow-runtime-ready',
		setPending: function(value) { r7310C1SwColumnInnerShadowRuntimePending = value; },
		setReady: function(value) { r7310C1SwColumnInnerShadowRuntimeReady = value; },
		setPackage: function(value) { r7310C1SwColumnInnerShadowRuntimePackage = value; },
		setTexture: function(value) { r7310C1SwColumnInnerShadowRuntimeTexture = value; },
		setDataTexture: function(value) { r7310C1SwColumnInnerShadowRuntimeDataTexture = value; },
		setError: function(value) { r7310C1SwColumnInnerShadowRuntimeError = value; }
	});
}

async function loadR7310C1WestBeamInnerShadowRuntimePackage()
{
	return loadR7310C1DedicatedBeamColumnShadowRuntimePackage({
		getLoadPromise: function() { return r7310C1WestBeamInnerShadowRuntimeLoadPromise; },
		setLoadPromise: function(value) { r7310C1WestBeamInnerShadowRuntimeLoadPromise = value; },
		packageUrl: R7310_C1_WEST_BEAM_INNER_SHADOW_RUNTIME_PACKAGE_URL,
		runtimeScope: 'c1_west_beam_inner_shadow_diffuse_short_circuit',
		targetId: R7310_C1_WEST_BEAM_INNER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_WEST_BEAM_INNER_SHADOW_SURFACE_NAME,
		stepName: 'westBeamInnerShadow',
		pendingKey: 'westBeamInnerShadowPending',
		label: 'west beam inner shadow',
		wakeReason: 'r7-3-10-c1-west-beam-inner-shadow-runtime-ready',
		setPending: function(value) { r7310C1WestBeamInnerShadowRuntimePending = value; },
		setReady: function(value) { r7310C1WestBeamInnerShadowRuntimeReady = value; },
		setPackage: function(value) { r7310C1WestBeamInnerShadowRuntimePackage = value; },
		setTexture: function(value) { r7310C1WestBeamInnerShadowRuntimeTexture = value; },
		setDataTexture: function(value) { r7310C1WestBeamInnerShadowRuntimeDataTexture = value; },
		setError: function(value) { r7310C1WestBeamInnerShadowRuntimeError = value; }
	});
}

async function loadR7310C1WestBeamUnderShadowRuntimePackage()
{
	return loadR7310C1DedicatedBeamColumnShadowRuntimePackage({
		getLoadPromise: function() { return r7310C1WestBeamUnderShadowRuntimeLoadPromise; },
		setLoadPromise: function(value) { r7310C1WestBeamUnderShadowRuntimeLoadPromise = value; },
		packageUrl: R7310_C1_WEST_BEAM_UNDER_SHADOW_RUNTIME_PACKAGE_URL,
		runtimeScope: 'c1_west_beam_under_shadow_diffuse_short_circuit',
		targetId: R7310_C1_WEST_BEAM_UNDER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_WEST_BEAM_UNDER_SHADOW_SURFACE_NAME,
		stepName: 'westBeamUnderShadow',
		pendingKey: 'westBeamUnderShadowPending',
		label: 'west beam under shadow',
		wakeReason: 'r7-3-10-c1-west-beam-under-shadow-runtime-ready',
		setPending: function(value) { r7310C1WestBeamUnderShadowRuntimePending = value; },
		setReady: function(value) { r7310C1WestBeamUnderShadowRuntimeReady = value; },
		setPackage: function(value) { r7310C1WestBeamUnderShadowRuntimePackage = value; },
		setTexture: function(value) { r7310C1WestBeamUnderShadowRuntimeTexture = value; },
		setDataTexture: function(value) { r7310C1WestBeamUnderShadowRuntimeDataTexture = value; },
		setError: function(value) { r7310C1WestBeamUnderShadowRuntimeError = value; }
	});
}

async function loadR7310C1EastBeamInnerShadowRuntimePackage()
{
	return loadR7310C1DedicatedBeamColumnShadowRuntimePackage({
		getLoadPromise: function() { return r7310C1EastBeamInnerShadowRuntimeLoadPromise; },
		setLoadPromise: function(value) { r7310C1EastBeamInnerShadowRuntimeLoadPromise = value; },
		packageUrl: R7310_C1_EAST_BEAM_INNER_SHADOW_RUNTIME_PACKAGE_URL,
		runtimeScope: 'c1_east_beam_inner_shadow_diffuse_short_circuit',
		targetId: R7310_C1_EAST_BEAM_INNER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_EAST_BEAM_INNER_SHADOW_SURFACE_NAME,
		stepName: 'eastBeamInnerShadow',
		pendingKey: 'eastBeamInnerShadowPending',
		label: 'east beam inner shadow',
		wakeReason: 'r7-3-10-c1-east-beam-inner-shadow-runtime-ready',
		setPending: function(value) { r7310C1EastBeamInnerShadowRuntimePending = value; },
		setReady: function(value) { r7310C1EastBeamInnerShadowRuntimeReady = value; },
		setPackage: function(value) { r7310C1EastBeamInnerShadowRuntimePackage = value; },
		setTexture: function(value) { r7310C1EastBeamInnerShadowRuntimeTexture = value; },
		setDataTexture: function(value) { r7310C1EastBeamInnerShadowRuntimeDataTexture = value; },
		setError: function(value) { r7310C1EastBeamInnerShadowRuntimeError = value; }
	});
}

async function loadR7310C1EastBeamUnderShadowRuntimePackage()
{
	return loadR7310C1DedicatedBeamColumnShadowRuntimePackage({
		getLoadPromise: function() { return r7310C1EastBeamUnderShadowRuntimeLoadPromise; },
		setLoadPromise: function(value) { r7310C1EastBeamUnderShadowRuntimeLoadPromise = value; },
		packageUrl: R7310_C1_EAST_BEAM_UNDER_SHADOW_RUNTIME_PACKAGE_URL,
		runtimeScope: 'c1_east_beam_under_shadow_diffuse_short_circuit',
		targetId: R7310_C1_EAST_BEAM_UNDER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_EAST_BEAM_UNDER_SHADOW_SURFACE_NAME,
		stepName: 'eastBeamUnderShadow',
		pendingKey: 'eastBeamUnderShadowPending',
		label: 'east beam under shadow',
		wakeReason: 'r7-3-10-c1-east-beam-under-shadow-runtime-ready',
		setPending: function(value) { r7310C1EastBeamUnderShadowRuntimePending = value; },
		setReady: function(value) { r7310C1EastBeamUnderShadowRuntimeReady = value; },
		setPackage: function(value) { r7310C1EastBeamUnderShadowRuntimePackage = value; },
		setTexture: function(value) { r7310C1EastBeamUnderShadowRuntimeTexture = value; },
		setDataTexture: function(value) { r7310C1EastBeamUnderShadowRuntimeDataTexture = value; },
		setError: function(value) { r7310C1EastBeamUnderShadowRuntimeError = value; }
	});
}

async function loadR7310C1SouthWindowLeftRevealShadowRuntimePackage()
{
	return loadR7310C1DedicatedBeamColumnShadowRuntimePackage({
		getLoadPromise: function() { return r7310C1SouthWindowLeftRevealShadowRuntimeLoadPromise; },
		setLoadPromise: function(value) { r7310C1SouthWindowLeftRevealShadowRuntimeLoadPromise = value; },
		packageUrl: R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_RUNTIME_PACKAGE_URL,
		runtimeScope: 'c1_south_window_left_reveal_shadow_diffuse_short_circuit',
		targetId: R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_SURFACE_NAME,
		stepName: 'southWindowLeftRevealShadow',
		pendingKey: 'southWindowLeftRevealShadowPending',
		label: 'south window left reveal shadow',
		wakeReason: 'r7-3-10-c1-south-window-left-reveal-shadow-runtime-ready',
		setPending: function(value) { r7310C1SouthWindowLeftRevealShadowRuntimePending = value; },
		setReady: function(value) { r7310C1SouthWindowLeftRevealShadowRuntimeReady = value; },
		setPackage: function(value) { r7310C1SouthWindowLeftRevealShadowRuntimePackage = value; },
		setTexture: function(value) { r7310C1SouthWindowLeftRevealShadowRuntimeTexture = value; },
		setDataTexture: function(value) { r7310C1SouthWindowLeftRevealShadowRuntimeDataTexture = value; },
		setError: function(value) { r7310C1SouthWindowLeftRevealShadowRuntimeError = value; }
	});
}

async function loadR7310C1SouthWindowRightRevealShadowRuntimePackage()
{
	return loadR7310C1DedicatedBeamColumnShadowRuntimePackage({
		getLoadPromise: function() { return r7310C1SouthWindowRightRevealShadowRuntimeLoadPromise; },
		setLoadPromise: function(value) { r7310C1SouthWindowRightRevealShadowRuntimeLoadPromise = value; },
		packageUrl: R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_RUNTIME_PACKAGE_URL,
		runtimeScope: 'c1_south_window_right_reveal_shadow_diffuse_short_circuit',
		targetId: R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_SURFACE_NAME,
		stepName: 'southWindowRightRevealShadow',
		pendingKey: 'southWindowRightRevealShadowPending',
		label: 'south window right reveal shadow',
		wakeReason: 'r7-3-10-c1-south-window-right-reveal-shadow-runtime-ready',
		setPending: function(value) { r7310C1SouthWindowRightRevealShadowRuntimePending = value; },
		setReady: function(value) { r7310C1SouthWindowRightRevealShadowRuntimeReady = value; },
		setPackage: function(value) { r7310C1SouthWindowRightRevealShadowRuntimePackage = value; },
		setTexture: function(value) { r7310C1SouthWindowRightRevealShadowRuntimeTexture = value; },
		setDataTexture: function(value) { r7310C1SouthWindowRightRevealShadowRuntimeDataTexture = value; },
		setError: function(value) { r7310C1SouthWindowRightRevealShadowRuntimeError = value; }
	});
}

async function loadR7310C1SouthWindowBottomRevealShadowRuntimePackage()
{
	return loadR7310C1DedicatedBeamColumnShadowRuntimePackage({
		getLoadPromise: function() { return r7310C1SouthWindowBottomRevealShadowRuntimeLoadPromise; },
		setLoadPromise: function(value) { r7310C1SouthWindowBottomRevealShadowRuntimeLoadPromise = value; },
		packageUrl: R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_RUNTIME_PACKAGE_URL,
		runtimeScope: 'c1_south_window_bottom_reveal_shadow_diffuse_short_circuit',
		targetId: R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_SURFACE_NAME,
		stepName: 'southWindowBottomRevealShadow',
		pendingKey: 'southWindowBottomRevealShadowPending',
		label: 'south window bottom reveal shadow',
		wakeReason: 'r7-3-10-c1-south-window-bottom-reveal-shadow-runtime-ready',
		setPending: function(value) { r7310C1SouthWindowBottomRevealShadowRuntimePending = value; },
		setReady: function(value) { r7310C1SouthWindowBottomRevealShadowRuntimeReady = value; },
		setPackage: function(value) { r7310C1SouthWindowBottomRevealShadowRuntimePackage = value; },
		setTexture: function(value) { r7310C1SouthWindowBottomRevealShadowRuntimeTexture = value; },
		setDataTexture: function(value) { r7310C1SouthWindowBottomRevealShadowRuntimeDataTexture = value; },
		setError: function(value) { r7310C1SouthWindowBottomRevealShadowRuntimeError = value; }
	});
}

async function loadR7310C1SouthWindowTopRevealShadowRuntimePackage()
{
	return loadR7310C1DedicatedBeamColumnShadowRuntimePackage({
		getLoadPromise: function() { return r7310C1SouthWindowTopRevealShadowRuntimeLoadPromise; },
		setLoadPromise: function(value) { r7310C1SouthWindowTopRevealShadowRuntimeLoadPromise = value; },
		packageUrl: R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_RUNTIME_PACKAGE_URL,
		runtimeScope: 'c1_south_window_top_reveal_shadow_diffuse_short_circuit',
		targetId: R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_SURFACE_NAME,
		stepName: 'southWindowTopRevealShadow',
		pendingKey: 'southWindowTopRevealShadowPending',
		label: 'south window top reveal shadow',
		wakeReason: 'r7-3-10-c1-south-window-top-reveal-shadow-runtime-ready',
		setPending: function(value) { r7310C1SouthWindowTopRevealShadowRuntimePending = value; },
		setReady: function(value) { r7310C1SouthWindowTopRevealShadowRuntimeReady = value; },
		setPackage: function(value) { r7310C1SouthWindowTopRevealShadowRuntimePackage = value; },
		setTexture: function(value) { r7310C1SouthWindowTopRevealShadowRuntimeTexture = value; },
		setDataTexture: function(value) { r7310C1SouthWindowTopRevealShadowRuntimeDataTexture = value; },
		setError: function(value) { r7310C1SouthWindowTopRevealShadowRuntimeError = value; }
	});
}

async function loadR7310C1IronDoorRevealRuntimePackage()
{
	return loadR7310C1DedicatedBeamColumnShadowRuntimePackage({
		getLoadPromise: function() { return r7310C1IronDoorRevealRuntimeLoadPromise; },
		setLoadPromise: function(value) { r7310C1IronDoorRevealRuntimeLoadPromise = value; },
		packageUrl: R7310_C1_IRON_DOOR_REVEAL_RUNTIME_PACKAGE_URL,
		runtimeScope: 'c1_iron_door_reveal_diffuse_short_circuit',
		targetId: R7310_C1_IRON_DOOR_REVEAL_TARGET_ID,
		surfaceName: R7310_C1_IRON_DOOR_REVEAL_SURFACE_NAME,
		stepName: 'ironDoorReveal',
		pendingKey: 'ironDoorRevealPending',
		label: 'iron door reveal',
		wakeReason: 'r7-3-10-c1-iron-door-reveal-runtime-ready',
		setPending: function(value) { r7310C1IronDoorRevealRuntimePending = value; },
		setReady: function(value) { r7310C1IronDoorRevealRuntimeReady = value; },
		setPackage: function(value) { r7310C1IronDoorRevealRuntimePackage = value; },
		setTexture: function(value) { r7310C1IronDoorRevealRuntimeTexture = value; },
		setDataTexture: function(value) { r7310C1IronDoorRevealRuntimeDataTexture = value; },
		setError: function(value) { r7310C1IronDoorRevealRuntimeError = value; }
	});
}

function captureR738BakeState()
{
	return {
		config: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0,
		mode: pathTracingUniforms && pathTracingUniforms.uR738C1BakeCaptureMode ? pathTracingUniforms.uR738C1BakeCaptureMode.value : 0,
			patchId: pathTracingUniforms && pathTracingUniforms.uR738C1BakePatchId ? pathTracingUniforms.uR738C1BakePatchId.value : 0,
			patchResolution: pathTracingUniforms && pathTracingUniforms.uR738C1BakePatchResolution ? pathTracingUniforms.uR738C1BakePatchResolution.value : 512,
			diffuseOnlyMode: pathTracingUniforms && pathTracingUniforms.uR738C1BakeDiffuseOnlyMode ? pathTracingUniforms.uR738C1BakeDiffuseOnlyMode.value : 0.0,
			r7310FloorWorldBounds: pathTracingUniforms && pathTracingUniforms.uR7310C1BakeFloorWorldBounds ? pathTracingUniforms.uR7310C1BakeFloorWorldBounds.value.clone() : null,
			r7310FullRoomDiffuseMode: pathTracingUniforms && pathTracingUniforms.uR7310C1FullRoomDiffuseMode ? pathTracingUniforms.uR7310C1FullRoomDiffuseMode.value : 0.0,
			r7310FullRoomDiffuseReady: pathTracingUniforms && pathTracingUniforms.uR7310C1FullRoomDiffuseReady ? pathTracingUniforms.uR7310C1FullRoomDiffuseReady.value : 0.0,
			r7310FloorDiffuseMode: pathTracingUniforms && pathTracingUniforms.uR7310C1FloorDiffuseMode ? pathTracingUniforms.uR7310C1FloorDiffuseMode.value : 0.0,
			r7310NorthWallDiffuseMode: pathTracingUniforms && pathTracingUniforms.uR7310C1NorthWallDiffuseMode ? pathTracingUniforms.uR7310C1NorthWallDiffuseMode.value : 0.0,
				r7310EastWallDiffuseMode: pathTracingUniforms && pathTracingUniforms.uR7310C1EastWallDiffuseMode ? pathTracingUniforms.uR7310C1EastWallDiffuseMode.value : 0.0,
				r7310WestWallDiffuseMode: pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallDiffuseMode ? pathTracingUniforms.uR7310C1WestWallDiffuseMode.value : 0.0,
				r7310SouthWallDiffuseMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWallDiffuseMode ? pathTracingUniforms.uR7310C1SouthWallDiffuseMode.value : 0.0,
				r7310CeilingDiffuseMode: pathTracingUniforms && pathTracingUniforms.uR7310C1CeilingDiffuseMode ? pathTracingUniforms.uR7310C1CeilingDiffuseMode.value : 0.0,
				r7310StructuralDiffuseMode: pathTracingUniforms && pathTracingUniforms.uR7310C1StructuralDiffuseMode ? pathTracingUniforms.uR7310C1StructuralDiffuseMode.value : 0.0,
				r7310SeColumnNorthShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SeColumnNorthShadowMode ? pathTracingUniforms.uR7310C1SeColumnNorthShadowMode.value : 0.0,
				r7310SeColumnNorthShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SeColumnNorthShadowReady ? pathTracingUniforms.uR7310C1SeColumnNorthShadowReady.value : 0.0,
				r7310SeColumnWestShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SeColumnWestShadowMode ? pathTracingUniforms.uR7310C1SeColumnWestShadowMode.value : 0.0,
				r7310SeColumnWestShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SeColumnWestShadowReady ? pathTracingUniforms.uR7310C1SeColumnWestShadowReady.value : 0.0,
				r7310SouthWallAcShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWallAcShadowMode ? pathTracingUniforms.uR7310C1SouthWallAcShadowMode.value : 0.0,
				r7310SouthWallAcShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWallAcShadowReady ? pathTracingUniforms.uR7310C1SouthWallAcShadowReady.value : 0.0,
				r7310EastWallBeamShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1EastWallBeamShadowMode ? pathTracingUniforms.uR7310C1EastWallBeamShadowMode.value : 0.0,
				r7310EastWallBeamShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1EastWallBeamShadowReady ? pathTracingUniforms.uR7310C1EastWallBeamShadowReady.value : 0.0,
				r7310SwColumnNorthShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SwColumnNorthShadowMode ? pathTracingUniforms.uR7310C1SwColumnNorthShadowMode.value : 0.0,
				r7310SwColumnNorthShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SwColumnNorthShadowReady ? pathTracingUniforms.uR7310C1SwColumnNorthShadowReady.value : 0.0,
				r7310WestWallBeamShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallBeamShadowMode ? pathTracingUniforms.uR7310C1WestWallBeamShadowMode.value : 0.0,
				r7310WestWallBeamShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallBeamShadowReady ? pathTracingUniforms.uR7310C1WestWallBeamShadowReady.value : 0.0,
				r7310WestWallBeamShadowZMaxOverride: pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallBeamShadowZMaxOverride ? pathTracingUniforms.uR7310C1WestWallBeamShadowZMaxOverride.value : 2.7179,
				r7310SwColumnInnerShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SwColumnInnerShadowMode ? pathTracingUniforms.uR7310C1SwColumnInnerShadowMode.value : 0.0,
				r7310SwColumnInnerShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SwColumnInnerShadowReady ? pathTracingUniforms.uR7310C1SwColumnInnerShadowReady.value : 0.0,
				r7310WestBeamInnerShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1WestBeamInnerShadowMode ? pathTracingUniforms.uR7310C1WestBeamInnerShadowMode.value : 0.0,
				r7310WestBeamInnerShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1WestBeamInnerShadowReady ? pathTracingUniforms.uR7310C1WestBeamInnerShadowReady.value : 0.0,
				r7310WestBeamUnderShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1WestBeamUnderShadowMode ? pathTracingUniforms.uR7310C1WestBeamUnderShadowMode.value : 0.0,
				r7310WestBeamUnderShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1WestBeamUnderShadowReady ? pathTracingUniforms.uR7310C1WestBeamUnderShadowReady.value : 0.0,
				r7310EastBeamInnerShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1EastBeamInnerShadowMode ? pathTracingUniforms.uR7310C1EastBeamInnerShadowMode.value : 0.0,
				r7310EastBeamInnerShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1EastBeamInnerShadowReady ? pathTracingUniforms.uR7310C1EastBeamInnerShadowReady.value : 0.0,
				r7310EastBeamUnderShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1EastBeamUnderShadowMode ? pathTracingUniforms.uR7310C1EastBeamUnderShadowMode.value : 0.0,
				r7310EastBeamUnderShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1EastBeamUnderShadowReady ? pathTracingUniforms.uR7310C1EastBeamUnderShadowReady.value : 0.0,
				r7310RuntimeProbeMode: pathTracingUniforms && pathTracingUniforms.uR7310C1RuntimeProbeMode ? pathTracingUniforms.uR7310C1RuntimeProbeMode.value : 0.0,
			r739AccurateReflectionMode: pathTracingUniforms && pathTracingUniforms.uR739C1AccurateReflectionMode ? pathTracingUniforms.uR739C1AccurateReflectionMode.value : 0.0,
		r739CurrentViewReflectionMode: pathTracingUniforms && pathTracingUniforms.uR739C1CurrentViewReflectionMode ? pathTracingUniforms.uR739C1CurrentViewReflectionMode.value : 0.0,
		r739CurrentViewReflectionReady: pathTracingUniforms && pathTracingUniforms.uR739C1CurrentViewReflectionReady ? pathTracingUniforms.uR739C1CurrentViewReflectionReady.value : 0.0,
		r739ReflectionReferenceMode: pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionReferenceMode ? pathTracingUniforms.uR739C1ReflectionReferenceMode.value : 0.0,
		r739ReflectionSurfaceMaskMode: pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode ? pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value : 0.0,
		r739ReflectionReady: pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionReady ? pathTracingUniforms.uR739C1ReflectionReady.value : 0.0,
		floorRoughness: pathTracingUniforms && pathTracingUniforms.uFloorRoughness ? pathTracingUniforms.uFloorRoughness.value : 1.0,
		xrayEnabled: pathTracingUniforms && pathTracingUniforms.uXrayEnabled ? pathTracingUniforms.uXrayEnabled.value : 1.0,
		previousTexture: pathTracingUniforms && pathTracingUniforms.tPreviousTexture ? pathTracingUniforms.tPreviousTexture.value : null,
		screenCopySource: screenCopyUniforms && screenCopyUniforms.tPathTracedImageTexture ? screenCopyUniforms.tPathTracedImageTexture.value : null,
		resolutionX: pathTracingUniforms && pathTracingUniforms.uResolution ? pathTracingUniforms.uResolution.value.x : null,
		resolutionY: pathTracingUniforms && pathTracingUniforms.uResolution ? pathTracingUniforms.uResolution.value.y : null,
		sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : 0,
		frameCounter: typeof frameCounter === 'number' ? frameCounter : 0,
		cameraIsMoving: typeof cameraIsMoving === 'boolean' ? cameraIsMoving : false,
		cameraRecentlyMoving: typeof cameraRecentlyMoving === 'boolean' ? cameraRecentlyMoving : false,
		samplingPaused: typeof samplingPaused === 'boolean' ? samplingPaused : false,
		quickPreviewActive: typeof r73QuickPreviewFillQuickModeActive === 'function' ? r73QuickPreviewFillQuickModeActive() : false
	};
}

function restoreR738BakeState(state)
{
	if (!state) return;
	if (pathTracingUniforms && pathTracingUniforms.uR738C1BakeCaptureMode) pathTracingUniforms.uR738C1BakeCaptureMode.value = state.mode;
		if (pathTracingUniforms && pathTracingUniforms.uR738C1BakePatchId) pathTracingUniforms.uR738C1BakePatchId.value = state.patchId;
		if (pathTracingUniforms && pathTracingUniforms.uR738C1BakePatchResolution) pathTracingUniforms.uR738C1BakePatchResolution.value = state.patchResolution;
		if (pathTracingUniforms && pathTracingUniforms.uR738C1BakeDiffuseOnlyMode) pathTracingUniforms.uR738C1BakeDiffuseOnlyMode.value = state.diffuseOnlyMode;
		if (pathTracingUniforms && pathTracingUniforms.uR7310C1BakeFloorWorldBounds && state.r7310FloorWorldBounds) pathTracingUniforms.uR7310C1BakeFloorWorldBounds.value.copy(state.r7310FloorWorldBounds);
		if (pathTracingUniforms && pathTracingUniforms.uR7310C1FullRoomDiffuseMode) pathTracingUniforms.uR7310C1FullRoomDiffuseMode.value = state.r7310FullRoomDiffuseMode;
		if (pathTracingUniforms && pathTracingUniforms.uR7310C1FullRoomDiffuseReady) pathTracingUniforms.uR7310C1FullRoomDiffuseReady.value = state.r7310FullRoomDiffuseReady;
		if (pathTracingUniforms && pathTracingUniforms.uR7310C1FloorDiffuseMode) pathTracingUniforms.uR7310C1FloorDiffuseMode.value = state.r7310FloorDiffuseMode;
		if (pathTracingUniforms && pathTracingUniforms.uR7310C1NorthWallDiffuseMode) pathTracingUniforms.uR7310C1NorthWallDiffuseMode.value = state.r7310NorthWallDiffuseMode;
		if (pathTracingUniforms && pathTracingUniforms.uR7310C1EastWallDiffuseMode) pathTracingUniforms.uR7310C1EastWallDiffuseMode.value = state.r7310EastWallDiffuseMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallDiffuseMode) pathTracingUniforms.uR7310C1WestWallDiffuseMode.value = state.r7310WestWallDiffuseMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWallDiffuseMode) pathTracingUniforms.uR7310C1SouthWallDiffuseMode.value = state.r7310SouthWallDiffuseMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1CeilingDiffuseMode) pathTracingUniforms.uR7310C1CeilingDiffuseMode.value = state.r7310CeilingDiffuseMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1StructuralDiffuseMode) pathTracingUniforms.uR7310C1StructuralDiffuseMode.value = state.r7310StructuralDiffuseMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1SeColumnNorthShadowMode) pathTracingUniforms.uR7310C1SeColumnNorthShadowMode.value = state.r7310SeColumnNorthShadowMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1SeColumnNorthShadowReady) pathTracingUniforms.uR7310C1SeColumnNorthShadowReady.value = state.r7310SeColumnNorthShadowReady;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1SeColumnWestShadowMode) pathTracingUniforms.uR7310C1SeColumnWestShadowMode.value = state.r7310SeColumnWestShadowMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1SeColumnWestShadowReady) pathTracingUniforms.uR7310C1SeColumnWestShadowReady.value = state.r7310SeColumnWestShadowReady;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWallAcShadowMode) pathTracingUniforms.uR7310C1SouthWallAcShadowMode.value = state.r7310SouthWallAcShadowMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWallAcShadowReady) pathTracingUniforms.uR7310C1SouthWallAcShadowReady.value = state.r7310SouthWallAcShadowReady;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1EastWallBeamShadowMode) pathTracingUniforms.uR7310C1EastWallBeamShadowMode.value = state.r7310EastWallBeamShadowMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1EastWallBeamShadowReady) pathTracingUniforms.uR7310C1EastWallBeamShadowReady.value = state.r7310EastWallBeamShadowReady;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1SwColumnNorthShadowMode) pathTracingUniforms.uR7310C1SwColumnNorthShadowMode.value = state.r7310SwColumnNorthShadowMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1SwColumnNorthShadowReady) pathTracingUniforms.uR7310C1SwColumnNorthShadowReady.value = state.r7310SwColumnNorthShadowReady;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallBeamShadowMode) pathTracingUniforms.uR7310C1WestWallBeamShadowMode.value = state.r7310WestWallBeamShadowMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallBeamShadowReady) pathTracingUniforms.uR7310C1WestWallBeamShadowReady.value = state.r7310WestWallBeamShadowReady;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallBeamShadowZMaxOverride) pathTracingUniforms.uR7310C1WestWallBeamShadowZMaxOverride.value = state.r7310WestWallBeamShadowZMaxOverride;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1SwColumnInnerShadowMode) pathTracingUniforms.uR7310C1SwColumnInnerShadowMode.value = state.r7310SwColumnInnerShadowMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1SwColumnInnerShadowReady) pathTracingUniforms.uR7310C1SwColumnInnerShadowReady.value = state.r7310SwColumnInnerShadowReady;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1WestBeamInnerShadowMode) pathTracingUniforms.uR7310C1WestBeamInnerShadowMode.value = state.r7310WestBeamInnerShadowMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1WestBeamInnerShadowReady) pathTracingUniforms.uR7310C1WestBeamInnerShadowReady.value = state.r7310WestBeamInnerShadowReady;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1WestBeamUnderShadowMode) pathTracingUniforms.uR7310C1WestBeamUnderShadowMode.value = state.r7310WestBeamUnderShadowMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1WestBeamUnderShadowReady) pathTracingUniforms.uR7310C1WestBeamUnderShadowReady.value = state.r7310WestBeamUnderShadowReady;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1EastBeamInnerShadowMode) pathTracingUniforms.uR7310C1EastBeamInnerShadowMode.value = state.r7310EastBeamInnerShadowMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1EastBeamInnerShadowReady) pathTracingUniforms.uR7310C1EastBeamInnerShadowReady.value = state.r7310EastBeamInnerShadowReady;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1EastBeamUnderShadowMode) pathTracingUniforms.uR7310C1EastBeamUnderShadowMode.value = state.r7310EastBeamUnderShadowMode;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1EastBeamUnderShadowReady) pathTracingUniforms.uR7310C1EastBeamUnderShadowReady.value = state.r7310EastBeamUnderShadowReady;
			if (pathTracingUniforms && pathTracingUniforms.uR7310C1RuntimeProbeMode) pathTracingUniforms.uR7310C1RuntimeProbeMode.value = state.r7310RuntimeProbeMode;
		if (pathTracingUniforms && pathTracingUniforms.uR739C1AccurateReflectionMode) pathTracingUniforms.uR739C1AccurateReflectionMode.value = state.r739AccurateReflectionMode;
	if (pathTracingUniforms && pathTracingUniforms.uR739C1CurrentViewReflectionMode) pathTracingUniforms.uR739C1CurrentViewReflectionMode.value = state.r739CurrentViewReflectionMode;
	if (pathTracingUniforms && pathTracingUniforms.uR739C1CurrentViewReflectionReady) pathTracingUniforms.uR739C1CurrentViewReflectionReady.value = state.r739CurrentViewReflectionReady;
	if (pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionReferenceMode) pathTracingUniforms.uR739C1ReflectionReferenceMode.value = state.r739ReflectionReferenceMode;
	if (pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode) pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value = state.r739ReflectionSurfaceMaskMode;
	if (pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionReady) pathTracingUniforms.uR739C1ReflectionReady.value = state.r739ReflectionReady;
	if (pathTracingUniforms && pathTracingUniforms.uFloorRoughness) pathTracingUniforms.uFloorRoughness.value = state.floorRoughness;
	if (pathTracingUniforms && pathTracingUniforms.uXrayEnabled) pathTracingUniforms.uXrayEnabled.value = state.xrayEnabled;
	if (pathTracingUniforms && pathTracingUniforms.tPreviousTexture && state.previousTexture) pathTracingUniforms.tPreviousTexture.value = state.previousTexture;
	if (screenCopyUniforms && screenCopyUniforms.tPathTracedImageTexture && state.screenCopySource) screenCopyUniforms.tPathTracedImageTexture.value = state.screenCopySource;
	if (pathTracingUniforms && pathTracingUniforms.uResolution && state.resolutionX !== null && state.resolutionY !== null) pathTracingUniforms.uResolution.value.set(state.resolutionX, state.resolutionY);
	if (typeof sampleCounter === 'number') sampleCounter = state.sampleCounter;
	if (typeof frameCounter === 'number') frameCounter = state.frameCounter;
	if (typeof cameraIsMoving === 'boolean') cameraIsMoving = state.cameraIsMoving;
	if (typeof cameraRecentlyMoving === 'boolean') cameraRecentlyMoving = state.cameraRecentlyMoving;
	if (typeof samplingPaused === 'boolean') samplingPaused = state.samplingPaused;
	if (pathTracingUniforms && pathTracingUniforms.uSampleCounter) pathTracingUniforms.uSampleCounter.value = sampleCounter;
	if (pathTracingUniforms && pathTracingUniforms.uFrameCounter) pathTracingUniforms.uFrameCounter.value = frameCounter;
	if (pathTracingUniforms && pathTracingUniforms.uCameraIsMoving) pathTracingUniforms.uCameraIsMoving.value = cameraIsMoving;
	if (screenOutputUniforms && screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
	if (screenOutputUniforms && screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
	if (screenOutputUniforms && screenOutputUniforms.uCameraIsMoving) screenOutputUniforms.uCameraIsMoving.value = cameraIsMoving;
	if (typeof applyPanelConfig === 'function' && state.config > 0) applyPanelConfig(state.config);
	if (typeof updateR73QuickPreviewFillUniforms === 'function') updateR73QuickPreviewFillUniforms();
	if (typeof updateR738C1BakePastePreviewUniforms === 'function') updateR738C1BakePastePreviewUniforms();
	if (typeof updateR7310C1FullRoomDiffuseRuntimeUniforms === 'function') updateR7310C1FullRoomDiffuseRuntimeUniforms();
	if (typeof updateR739C1AccurateReflectionUniforms === 'function') updateR739C1AccurateReflectionUniforms();
	if (typeof updateR739C1CurrentViewReflectionUniforms === 'function') updateR739C1CurrentViewReflectionUniforms();
	if (typeof window.updateSamplingControls === 'function') window.updateSamplingControls();
	if (typeof wakeRender === 'function') wakeRender();
}

function resetR738MainAccumulation()
{
	if (!renderer || !pathTracingRenderTarget || !screenCopyRenderTarget) return;
	renderer.setRenderTarget(pathTracingRenderTarget);
	renderer.clear();
	renderer.setRenderTarget(screenCopyRenderTarget);
	renderer.clear();
	if (borrowPathTracingRenderTarget && borrowScreenCopyRenderTarget)
	{
		renderer.setRenderTarget(borrowPathTracingRenderTarget);
		renderer.clear();
		renderer.setRenderTarget(borrowScreenCopyRenderTarget);
		renderer.clear();
	}
	renderer.setRenderTarget(null);
	sampleCounter = 0.0;
	frameCounter = 1.0;
	cameraIsMoving = false;
	cameraRecentlyMoving = false;
	needClearAccumulation = false;
	if (pathTracingUniforms && pathTracingUniforms.uSampleCounter) pathTracingUniforms.uSampleCounter.value = sampleCounter;
	if (pathTracingUniforms && pathTracingUniforms.uFrameCounter) pathTracingUniforms.uFrameCounter.value = frameCounter;
	if (pathTracingUniforms && pathTracingUniforms.uPreviousSampleCount) pathTracingUniforms.uPreviousSampleCount.value = 1.0;
	if (pathTracingUniforms && pathTracingUniforms.uCameraIsMoving) pathTracingUniforms.uCameraIsMoving.value = false;
	if (screenOutputUniforms && screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = 1.0;
	if (screenOutputUniforms && screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0;
}

window.prepareR738C1BakeCapture = async function(options)
{
	options = options || {};
	var targetAtlasResolution = normalizeR738PositiveInt(options.targetAtlasResolution, 512, 1, 4096);
	var northeastFurnitureMode = (options.northeastFurnitureMode === 'wardrobe') ? 'wardrobe' : 'bed';
	if (typeof window.setC2NortheastFurnitureMode === 'function')
		window.setC2NortheastFurnitureMode(northeastFurnitureMode);
	if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
	if (typeof window.setR7310C1NortheastFurnitureRuntimeMode === 'function')
		window.setR7310C1NortheastFurnitureRuntimeMode(northeastFurnitureMode);
	if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
	if (pathTracingUniforms && pathTracingUniforms.uR738C1BakeCaptureMode) pathTracingUniforms.uR738C1BakeCaptureMode.value = 0;
	if (pathTracingUniforms && pathTracingUniforms.uR738C1BakePatchId) pathTracingUniforms.uR738C1BakePatchId.value = 0;
	if (pathTracingUniforms && pathTracingUniforms.uR738C1BakePatchResolution) pathTracingUniforms.uR738C1BakePatchResolution.value = targetAtlasResolution;
	if (pathTracingUniforms && pathTracingUniforms.uR738C1BakeDiffuseOnlyMode) pathTracingUniforms.uR738C1BakeDiffuseOnlyMode.value = 0.0;
	resetR738MainAccumulation();
	if (typeof wakeRender === 'function') wakeRender('r7-3-8-c1-bake-capture');
	return {
		version: 'r7-3-8-c1-1000spp-bake-capture',
		config: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 1,
		northeastFurnitureMode: northeastFurnitureMode,
		targetAtlasResolution: targetAtlasResolution,
		upscaled: false
	};
};

window.waitForR738C1Samples = async function(targetSamples, timeoutMs)
{
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var startedAt = performance.now();
	while (performance.now() - startedAt < timeout)
	{
		var actualSamples = Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0);
		if (actualSamples >= target)
			return actualSamples;
		if (typeof wakeRender === 'function') wakeRender('r7-3-8-c1-bake-wait');
		await new Promise(function(resolve) { setTimeout(resolve, 250); });
	}
	throw new Error('R7-3.8 C1 bake capture timeout before ' + target + ' samples');
};

async function renderR738MainRawHdrSamples(targetSamples, timeoutMs, options)
{
	options = options || {};
	if (!renderer || !pathTracingRenderTarget || !screenCopyRenderTarget || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera)
		throw new Error('R7-3.8 raw HDR capture missing renderer state');
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var startedAt = performance.now();
	resetR738MainAccumulation();
	if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(true);
	var samples = 0;
	for (var sample = 1; sample <= target; sample += 1)
	{
		if (performance.now() - startedAt > timeout)
			break;
		sampleCounter = sample;
		frameCounter = sample + 1.0;
		cameraIsMoving = false;
		cameraRecentlyMoving = false;
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uPreviousSampleCount.value = 1.0;
		pathTracingUniforms.uCameraIsMoving.value = false;
		var requestedRandomVec2 = options.randomVec2 || null;
		var probeRandomX = requestedRandomVec2 && Number.isFinite(Number(requestedRandomVec2.x))
			? Number(requestedRandomVec2.x)
			: Math.random();
		var probeRandomY = requestedRandomVec2 && Number.isFinite(Number(requestedRandomVec2.y))
			? Number(requestedRandomVec2.y)
			: Math.random();
		pathTracingUniforms.uRandomVec2.value.set(probeRandomX, probeRandomY);
		pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
		if (screenOutputUniforms)
		{
			if (screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
			if (screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
			if (screenOutputUniforms.uCameraIsMoving) screenOutputUniforms.uCameraIsMoving.value = false;
		}
		if (typeof updateR73QuickPreviewFillUniforms === 'function') updateR73QuickPreviewFillUniforms();
		renderer.setRenderTarget(pathTracingRenderTarget);
		renderer.render(pathTracingScene, worldCamera);
		renderer.setRenderTarget(screenCopyRenderTarget);
		renderer.render(screenCopyScene, orthoCamera);
		samples = sample;
		if (sample % 16 === 0)
			await new Promise(function(resolve) { setTimeout(resolve, 0); });
	}
	renderer.setRenderTarget(null);
	if (samples < target)
		throw new Error('R7-3.8 C1 raw HDR manual capture timeout before ' + target + ' samples');
	return samples;
}

function summarizeR738SurfaceClassPixels(readback)
{
	var counts = { floor: 0, gik: 0, ceiling: 0, wall: 0, object: 0, background: 0 };
	var pixels = readback.pixels;
	var classIds = new Uint8Array(readback.width * readback.height);
	for (var i = 0, p = 0; i < pixels.length; i += 4, p += 1)
	{
		var r = pixels[i];
		var g = pixels[i + 1];
		var b = pixels[i + 2];
		if (r > 0.75 && g < 0.25 && b < 0.25) { counts.floor += 1; classIds[p] = 1; }
		else if (r < 0.25 && g > 0.75 && b < 0.25) { counts.gik += 1; classIds[p] = 2; }
		else if (r < 0.25 && g < 0.25 && b > 0.75) { counts.ceiling += 1; classIds[p] = 3; }
		else if (r > 0.75 && g > 0.75 && b < 0.25) { counts.wall += 1; classIds[p] = 4; }
		else if (r > 0.75 && g < 0.25 && b > 0.75) { counts.object += 1; classIds[p] = 5; }
		else { counts.background += 1; classIds[p] = 0; }
	}
	counts.width = readback.width;
	counts.height = readback.height;
	window.__r738C1BakeCaptureLastSurfaceClassIds = classIds;
	return counts;
}

async function captureR738C1SurfaceClassSummary()
{
	if (!renderer || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera || !pathTracingUniforms || !screenCopyUniforms)
		throw new Error('R7-3.8 surface class capture missing renderer state');
	var width = pathTracingRenderTarget.width;
	var height = pathTracingRenderTarget.height;
	var target = createR738FloatRenderTarget(width, height);
	var previous = createR738FloatRenderTarget(width, height);
	var state = captureR738BakeState();
	var savedRenderTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
	try
	{
		samplingPaused = true;
		cameraIsMoving = false;
		cameraRecentlyMoving = false;
		pathTracingUniforms.uR738C1BakeCaptureMode.value = 1;
		if (pathTracingUniforms.uR738C1BakeDiffuseOnlyMode) pathTracingUniforms.uR738C1BakeDiffuseOnlyMode.value = 0.0;
		pathTracingUniforms.tPreviousTexture.value = previous.texture;
		screenCopyUniforms.tPathTracedImageTexture.value = target.texture;
		renderer.setRenderTarget(target);
		renderer.clear();
		renderer.setRenderTarget(previous);
		renderer.clear();
		sampleCounter = 1.0;
		frameCounter = 2.0;
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());
		pathTracingUniforms.uCameraIsMoving.value = false;
		pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
		renderer.setRenderTarget(target);
		renderer.render(pathTracingScene, worldCamera);
		renderer.setRenderTarget(previous);
		renderer.render(screenCopyScene, orthoCamera);
		var readback = await readR738RenderTargetFloatPixels(target);
		window.__r738C1BakeCaptureLastSurfaceClassPixels = readback.pixels;
		return summarizeR738SurfaceClassPixels(readback);
	}
	finally
	{
		restoreR738BakeState(state);
		renderer.setRenderTarget(savedRenderTarget);
		target.dispose();
		previous.dispose();
	}
}
window.captureR738C1SurfaceClassSummary = captureR738C1SurfaceClassSummary;

function buildR738TexelMetadata(size, worldBounds)
{
	var bounds = worldBounds || { xMin: -1.0, xMax: 1.0, zMin: -1.0, zMax: 1.0, y: 0.01 };
	var metadata = new Float32Array(size * size * 12);
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldX = bounds.xMin + (bounds.xMax - bounds.xMin) * u;
			var worldZ = bounds.zMin + (bounds.zMax - bounds.zMin) * v;
			var offset = (y * size + x) * 12;
			metadata[offset] = worldX;
			metadata[offset + 1] = bounds.y;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = 0.0;
			metadata[offset + 4] = 1.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 1.0;
			metadata[offset + 7] = 0.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1FloorTexelMetadata(size)
{
	var bounds = R7310_C1_FLOOR_WORLD_BOUNDS;
	var metadata = new Float32Array(size * size * 12);
	var worldXStep = (bounds.xMax - bounds.xMin) / Math.max(1, size);
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldX = bounds.xMin + (bounds.xMax - bounds.xMin) * u;
			var worldZ = bounds.zMin + (bounds.zMax - bounds.zMin) * v;
			var westContactBand = worldX >= -1.91 - worldXStep && worldX < -1.91 + worldXStep;
			var eastContactBand = worldX > 1.91 - worldXStep && worldX <= 1.91 + worldXStep;
			if (westContactBand)
				worldX = -1.91 + worldXStep;
			else if (eastContactBand)
				worldX = 1.91 - worldXStep;
			var offset = (y * size + x) * 12;
			metadata[offset] = worldX;
			metadata[offset + 1] = bounds.y;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = 0.0;
			metadata[offset + 4] = 1.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 1.0;
			metadata[offset + 7] = 1.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1NorthWallTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_NORTH_WALL_WORLD_BOUNDS;
	var hole = R7310_C1_NORTH_WALL_DOOR_HOLE;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldX = b.xMin + (b.xMax - b.xMin) * u;
			var worldY = b.yMin + (b.yMax - b.yMin) * v;
			var isDoorHole = worldX >= hole.xMin && worldX <= hole.xMax && worldY >= hole.yMin && worldY <= hole.yMax;
			var isSideWallBack = r7310C1NorthWallHiddenBySideWall(worldX);
			var isBeamGapInvalid = r7310C1NorthWallHiddenByBeamGap(worldX, worldY);
			var isValid = !isDoorHole && !isSideWallBack && !isBeamGapInvalid;
			var offset = (y * size + x) * 12;
			metadata[offset] = worldX;
			metadata[offset + 1] = worldY;
			metadata[offset + 2] = b.z;
			metadata[offset + 3] = 0.0;
			metadata[offset + 4] = 0.0;
			metadata[offset + 5] = 1.0;
			metadata[offset + 6] = 4.0;
			metadata[offset + 7] = isValid ? 1.0 : 0.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			if (isValid) valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1EastWallTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_EAST_WALL_WORLD_BOUNDS;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldZ = b.zMin + (b.zMax - b.zMin) * u;
			var worldY = b.yMin + (b.yMax - b.yMin) * v;
			var isHandoff = worldZ >= R7310_C1_EAST_WALL_SE_COLUMN_HANDOFF_Z_MIN ||
				worldY >= R7310_C1_EAST_WALL_BEAM_HANDOFF_Y_MIN;
			var offset = (y * size + x) * 12;
			metadata[offset] = b.x;
			metadata[offset + 1] = worldY;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = -1.0;
			metadata[offset + 4] = 0.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 4.0;
			metadata[offset + 7] = isHandoff ? 0.0 : 1.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			if (!isHandoff) valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1EastWallBeamShadowTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_EAST_WALL_BEAM_SHADOW_WORLD_BOUNDS;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldZ = b.zMin + (b.zMax - b.zMin) * u;
			var worldY = b.yMin + (b.yMax - b.yMin) * v;
			var isDeadZone = r7310C1EastWallHiddenByBeamOrSeColumn(worldZ, worldY);
			var offset = (y * size + x) * 12;
			metadata[offset] = b.x;
			metadata[offset + 1] = worldY;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = -1.0;
			metadata[offset + 4] = 0.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 4.0;
			metadata[offset + 7] = isDeadZone ? 0.0 : 1.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			if (!isDeadZone) valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1WestWallTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_WEST_WALL_WORLD_BOUNDS;
	var hole = R7310_C1_WEST_WALL_IRON_DOOR_HOLE;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldZ = b.zMin + (b.zMax - b.zMin) * u;
			var worldY = b.yMin + (b.yMax - b.yMin) * v;
			var isDoorHole = worldZ >= hole.zMin && worldZ <= hole.zMax && worldY >= hole.yMin && worldY <= hole.yMax;
			var isHandoff = worldZ >= R7310_C1_WEST_WALL_SW_COLUMN_HANDOFF_Z_MIN ||
				worldY >= R7310_C1_WEST_WALL_BEAM_HANDOFF_Y_MIN;
			var isValid = !isDoorHole && !isHandoff;
			var offset = (y * size + x) * 12;
			metadata[offset] = b.x;
			metadata[offset + 1] = worldY;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = 1.0;
			metadata[offset + 4] = 0.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 4.0;
			metadata[offset + 7] = isValid ? 1.0 : 0.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			if (isValid) valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1SouthWallTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_SOUTH_WALL_WORLD_BOUNDS;
	var hole = R7310_C1_SOUTH_WALL_WINDOW_HOLE;
	var reveal = R7310_C1_SOUTH_WALL_WINDOW_REVEAL;
	var revealAtlas = reveal.atlas;
	var worldXStep = (b.xMax - b.xMin) / Math.max(1, size);
	var worldYStep = (b.yMax - b.yMin) / Math.max(1, size);
	var revealAtlasContains = function(rect, worldXValue, worldYValue) {
		return worldXValue >= rect.xMin - worldXStep * 0.5 &&
			worldXValue <= rect.xMax + worldXStep * 0.5 &&
			worldYValue >= rect.yMin - worldYStep * 0.5 &&
			worldYValue <= rect.yMax + worldYStep * 0.5;
	};
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldX = b.xMin + (b.xMax - b.xMin) * u;
			var worldY = b.yMin + (b.yMax - b.yMin) * v;
			var isWindowHole = worldX >= hole.xMin && worldX <= hole.xMax && worldY >= hole.yMin && worldY <= hole.yMax;
			var isSideColumnBack = r7310C1SouthWallHiddenBySideColumn(worldX, worldY);
			var posX = worldX;
			var posY = worldY;
			var posZ = b.z;
			var normalX = 0.0;
			var normalY = 0.0;
			var normalZ = -1.0;
			var isValid = !isWindowHole && !isSideColumnBack;
			if (isWindowHole)
			{
				if (revealAtlasContains(revealAtlas.leftReveal, worldX, worldY))
				{
					var safeWorldX = Math.min(revealAtlas.leftReveal.xMax - worldXStep, Math.max(revealAtlas.leftReveal.xMin + worldXStep, worldX));
					posX = reveal.xMin;
					posY = reveal.yMin + (reveal.yMax - reveal.yMin) * ((worldY - revealAtlas.leftReveal.yMin) / Math.max(0.00001, revealAtlas.leftReveal.yMax - revealAtlas.leftReveal.yMin));
					posZ = reveal.zMin + (reveal.zMax - reveal.zMin) * ((safeWorldX - revealAtlas.leftReveal.xMin) / Math.max(0.00001, revealAtlas.leftReveal.xMax - revealAtlas.leftReveal.xMin));
					normalX = 1.0; normalY = 0.0; normalZ = 0.0;
					isValid = true;
				}
				else if (revealAtlasContains(revealAtlas.rightReveal, worldX, worldY))
				{
					var safeWorldX = Math.min(revealAtlas.rightReveal.xMax - worldXStep, Math.max(revealAtlas.rightReveal.xMin + worldXStep, worldX));
					posX = reveal.xMax;
					posY = reveal.yMin + (reveal.yMax - reveal.yMin) * ((worldY - revealAtlas.rightReveal.yMin) / Math.max(0.00001, revealAtlas.rightReveal.yMax - revealAtlas.rightReveal.yMin));
					posZ = reveal.zMin + (reveal.zMax - reveal.zMin) * ((safeWorldX - revealAtlas.rightReveal.xMin) / Math.max(0.00001, revealAtlas.rightReveal.xMax - revealAtlas.rightReveal.xMin));
					normalX = -1.0; normalY = 0.0; normalZ = 0.0;
					isValid = true;
				}
				else if (revealAtlasContains(revealAtlas.bottomReveal, worldX, worldY))
				{
					var safeWorldY = Math.min(revealAtlas.bottomReveal.yMax - worldYStep, Math.max(revealAtlas.bottomReveal.yMin + worldYStep, worldY));
					posX = reveal.xMin + (reveal.xMax - reveal.xMin) * ((worldX - revealAtlas.bottomReveal.xMin) / Math.max(0.00001, revealAtlas.bottomReveal.xMax - revealAtlas.bottomReveal.xMin));
					posY = reveal.yMin;
					posZ = reveal.zMin + (reveal.zMax - reveal.zMin) * ((safeWorldY - revealAtlas.bottomReveal.yMin) / Math.max(0.00001, revealAtlas.bottomReveal.yMax - revealAtlas.bottomReveal.yMin));
					normalX = 0.0; normalY = 1.0; normalZ = 0.0;
					isValid = true;
				}
				else if (revealAtlasContains(revealAtlas.topReveal, worldX, worldY))
				{
					var safeWorldY = Math.min(revealAtlas.topReveal.yMax - worldYStep, Math.max(revealAtlas.topReveal.yMin + worldYStep, worldY));
					posX = reveal.xMin + (reveal.xMax - reveal.xMin) * ((worldX - revealAtlas.topReveal.xMin) / Math.max(0.00001, revealAtlas.topReveal.xMax - revealAtlas.topReveal.xMin));
					posY = reveal.yMax;
					posZ = reveal.zMin + (reveal.zMax - reveal.zMin) * ((safeWorldY - revealAtlas.topReveal.yMin) / Math.max(0.00001, revealAtlas.topReveal.yMax - revealAtlas.topReveal.yMin));
					normalX = 0.0; normalY = -1.0; normalZ = 0.0;
					isValid = true;
				}
			}
			var offset = (y * size + x) * 12;
			metadata[offset] = posX;
			metadata[offset + 1] = posY;
			metadata[offset + 2] = posZ;
			metadata[offset + 3] = normalX;
			metadata[offset + 4] = normalY;
			metadata[offset + 5] = normalZ;
			metadata[offset + 6] = 4.0;
			metadata[offset + 7] = isValid ? 1.0 : 0.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			if (isValid) valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1SouthWallAcShadowTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_SOUTH_WALL_AC_SHADOW_WORLD_BOUNDS;
	var hole = R7310_C1_SOUTH_WALL_WINDOW_HOLE;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldX = b.xMin + (b.xMax - b.xMin) * u;
			var worldY = b.yMin + (b.yMax - b.yMin) * v;
			var isWindowHole = worldX >= hole.xMin && worldX <= hole.xMax && worldY >= hole.yMin && worldY <= hole.yMax;
			var isSideColumnBack = r7310C1SouthWallAcShadowHiddenBySideColumn(worldX, worldY);
			var isValid = !isWindowHole && !isSideColumnBack;
			var offset = (y * size + x) * 12;
			metadata[offset] = worldX;
			metadata[offset + 1] = worldY;
			metadata[offset + 2] = b.z;
			metadata[offset + 3] = 0.0;
			metadata[offset + 4] = 0.0;
			metadata[offset + 5] = -1.0;
			metadata[offset + 6] = 4.0;
			metadata[offset + 7] = isValid ? 1.0 : 0.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			if (isValid) valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1CeilingTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_CEILING_WORLD_BOUNDS;
	var valid = 0;
	var southWallZ = 3.056;
	var southWindowXMin = -1.75;
	var southWindowXMax = 0.69;
	// R7-3.10 east-beam / SE-column-top gap (OPUS measured 2026-05-26):
	// The ceiling along the east edge is occluded during the bake by the east wall + east
	// beam (z < 2.49) and the SE column (z in [2.49, 3.056]), leaving a valid-black dead
	// zone (x[1.85,1.90] z[-1.874,2.49] measured 10068/10068 luma=0). The valid-linear
	// sampler bleeds those black texels into the visible ceiling x east-beam / SE-column-top
	// junction, producing a dark seam. Mark the dead zone invalid so the sampler skips it.
	// Mirrors isBehindSolidSouthWall. z > 3.056 stays owned by the south rule above.
	// Bounds tuned by dry-validation against the baked atlas (maskedLitInterior=0):
	//   beam band starts at z=-1.874 (beam's north end; north of it the x[1.85,1.90] ceiling
	//   is genuinely lit open ceiling, must NOT be invalidated);
	//   SE column band uses x>=1.78 = the SE column box x-min (Home_Studio.js:118
	//   addBox([1.78,0,2.49],[1.91,2.905,3.056])); x<1.78 is genuinely lit open ceiling
	//   WEST of the column (the "lit sliver" at x[1.770,1.778] seen in dry-validation), must NOT be masked.
	//   (Earlier x>=1.79 was wrong: it left the column-occluded x[1.78,1.79] unmasked -> SE column-top seam.)
	// The atlas outer ring re-lights via fillR7310C1AtlasEdgeFromNearestInterior after alpha sync,
	// so the east edge column (x~2.11) inside this mask is harmless.
	var eastBeamWallX = 1.85;
	var seColumnX = 1.78;
	var seColumnZMin = 2.49;
	var eastBeamZMin = -1.874;
	// West side handled symmetrically (OPUS 2026-05-26 root-cause elimination + whack-a-mole prevention):
	// west beam (Home_Studio.js box 12) and SW column (box 14) share inner face x=-1.75 across
	// z[-1.874,3.056]; the baked atlas scan confirmed 72147 (beam) + 7814 (SW column) valid-but-black
	// texels there - the IDENTICAL defect as east. Mirror the shader r7310C1CeilingOccluderTopFootprint.
	var westOccluderX = -1.75;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldX = b.xMin + (b.xMax - b.xMin) * u;
			var worldZ = b.zMin + (b.zMax - b.zMin) * v;
			var isBehindSolidSouthWall =
				worldZ > southWallZ &&
				(worldX < southWindowXMin || worldX >= southWindowXMax);
			var isBehindEastOccluder =
				worldZ <= southWallZ &&
				((worldZ >= seColumnZMin && worldX >= seColumnX) ||
					(worldZ >= eastBeamZMin && worldZ < seColumnZMin && worldX >= eastBeamWallX));
			var isBehindWestOccluder =
				worldZ <= southWallZ &&
				worldZ >= eastBeamZMin &&
				worldX <= westOccluderX;
			var isValid = !isBehindSolidSouthWall && !isBehindEastOccluder && !isBehindWestOccluder;
			var offset = (y * size + x) * 12;
			metadata[offset] = worldX;
			metadata[offset + 1] = b.y;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = 0.0;
			metadata[offset + 4] = -1.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 5.0;
			metadata[offset + 7] = isValid ? 1.0 : 0.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			if (isValid) valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function r7310StructuralNormalVector(normalName)
{
	if (normalName === '+X') return { x: 1.0, y: 0.0, z: 0.0 };
	if (normalName === '-X') return { x: -1.0, y: 0.0, z: 0.0 };
	if (normalName === '+Y') return { x: 0.0, y: 1.0, z: 0.0 };
	if (normalName === '-Y') return { x: 0.0, y: -1.0, z: 0.0 };
	if (normalName === '+Z') return { x: 0.0, y: 0.0, z: 1.0 };
	if (normalName === '-Z') return { x: 0.0, y: 0.0, z: -1.0 };
	return { x: 0.0, y: 1.0, z: 0.0 };
}

function r7310StructuralFaceAxisValue(face, axis, t)
{
	var min = face[axis + 'Min'];
	var max = face[axis + 'Max'];
	if (!Number.isFinite(min) || !Number.isFinite(max))
		return Number.isFinite(face.value) ? face.value : 0.0;
	return min + (max - min) * t;
}

function r7310StructuralSeColumnNorthHiddenByEastBeam(position)
{
	return position.x >= 1.85 && position.y >= 2.515;
}

function r7310StructuralSeColumnInnerHiddenByBookshelf(position)
{
	return position.z >= 2.73 && position.y <= 2.04;
}

function buildR7310C1StructuralTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var island = null;
			for (var i = 0; i < R7310_C1_STRUCTURAL_ISLANDS.length; i += 1)
			{
				var candidate = R7310_C1_STRUCTURAL_ISLANDS[i];
				var rect = candidate.atlasRect;
				if (u >= rect.uMin && u <= rect.uMax && v >= rect.vMin && v <= rect.vMax)
				{
					island = candidate;
					break;
				}
			}
			var offset = (y * size + x) * 12;
			if (!island)
			{
				metadata[offset + 7] = 0.0;
				metadata[offset + 10] = u;
				metadata[offset + 11] = v;
				continue;
			}
			var face = island.worldFace;
			var rectForIsland = island.atlasRect;
			var tu = (u - rectForIsland.uMin) / Math.max(0.00001, rectForIsland.uMax - rectForIsland.uMin);
			var tv = (v - rectForIsland.vMin) / Math.max(0.00001, rectForIsland.vMax - rectForIsland.vMin);
			var position = { x: 0.0, y: 0.0, z: 0.0 };
			position[face.axis] = face.value;
			position[island.axes.u] = r7310StructuralFaceAxisValue(face, island.axes.u, tu);
			position[island.axes.v] = r7310StructuralFaceAxisValue(face, island.axes.v, tv);
			var normal = r7310StructuralNormalVector(island.normal);
			var isValid = !(
				(island.name === 'se_column_north_z' && r7310StructuralSeColumnNorthHiddenByEastBeam(position)) ||
				(island.name === 'se_column_inner_x' && r7310StructuralSeColumnInnerHiddenByBookshelf(position))
			);
			metadata[offset] = position.x;
			metadata[offset + 1] = position.y;
			metadata[offset + 2] = position.z;
			metadata[offset + 3] = normal.x;
			metadata[offset + 4] = normal.y;
			metadata[offset + 5] = normal.z;
			metadata[offset + 6] = 6.0;
			metadata[offset + 7] = isValid ? 1.0 : 0.0;
			metadata[offset + 8] = i + 1;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			if (isValid) valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1SeColumnNorthShadowTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_SE_COLUMN_NORTH_SHADOW_WORLD_BOUNDS;
	var eastBeamBack = R7310_C1_SE_COLUMN_NORTH_SHADOW_EAST_BEAM_BACK;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldX = b.xMin + (b.xMax - b.xMin) * u;
			var worldY = b.yMin + (b.yMax - b.yMin) * v;
			var isEastBeamBack = worldX >= eastBeamBack.xMin && worldX <= eastBeamBack.xMax && worldY >= eastBeamBack.yMin && worldY <= eastBeamBack.yMax;
			var offset = (y * size + x) * 12;
			metadata[offset] = worldX;
			metadata[offset + 1] = worldY;
			metadata[offset + 2] = b.z;
			metadata[offset + 3] = 0.0;
			metadata[offset + 4] = 0.0;
			metadata[offset + 5] = -1.0;
			metadata[offset + 6] = 6.0;
			metadata[offset + 7] = isEastBeamBack ? 0.0 : 1.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			if (!isEastBeamBack) valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1SwColumnNorthShadowTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_SW_COLUMN_NORTH_SHADOW_WORLD_BOUNDS;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldX = b.xMin + (b.xMax - b.xMin) * u;
			var worldY = b.yMin + (b.yMax - b.yMin) * v;
			var offset = (y * size + x) * 12;
			metadata[offset] = worldX;
			metadata[offset + 1] = worldY;
			metadata[offset + 2] = b.z;
			metadata[offset + 3] = 0.0;
			metadata[offset + 4] = 0.0;
			metadata[offset + 5] = -1.0;
			metadata[offset + 6] = 6.0;
			metadata[offset + 7] = 1.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1SeColumnWestShadowTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_SE_COLUMN_WEST_SHADOW_WORLD_BOUNDS;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldZ = b.zMin + (b.zMax - b.zMin) * u;
			var worldY = b.yMin + (b.yMax - b.yMin) * v;
			var isValid = !r7310StructuralSeColumnInnerHiddenByBookshelf({ y: worldY, z: worldZ });
			var offset = (y * size + x) * 12;
			metadata[offset] = b.x;
			metadata[offset + 1] = worldY;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = -1.0;
			metadata[offset + 4] = 0.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 6.0;
			metadata[offset + 7] = isValid ? 1.0 : 0.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			if (isValid) valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1SwColumnInnerShadowTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_SW_COLUMN_INNER_SHADOW_WORLD_BOUNDS;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldZ = b.zMin + (b.zMax - b.zMin) * u;
			var worldY = b.yMin + (b.yMax - b.yMin) * v;
			var isValid = !r7310C1SwColumnInnerHiddenBySouthWall(worldZ, worldY);
			var offset = (y * size + x) * 12;
			metadata[offset] = b.x;
			metadata[offset + 1] = worldY;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = 1.0;
			metadata[offset + 4] = 0.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 6.0;
			metadata[offset + 7] = isValid ? 1.0 : 0.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			if (isValid) valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1WestBeamInnerShadowTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_WEST_BEAM_INNER_SHADOW_WORLD_BOUNDS;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldZ = b.zMin + (b.zMax - b.zMin) * u;
			var worldY = b.yMin + (b.yMax - b.yMin) * v;
			var offset = (y * size + x) * 12;
			metadata[offset] = b.x;
			metadata[offset + 1] = worldY;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = 1.0;
			metadata[offset + 4] = 0.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 6.0;
			metadata[offset + 7] = 1.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1WestBeamUnderShadowTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_WEST_BEAM_UNDER_SHADOW_WORLD_BOUNDS;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldZ = b.zMin + (b.zMax - b.zMin) * u;
			var worldX = b.xMin + (b.xMax - b.xMin) * v;
			var offset = (y * size + x) * 12;
			metadata[offset] = worldX;
			metadata[offset + 1] = b.y;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = 0.0;
			metadata[offset + 4] = -1.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 6.0;
			metadata[offset + 7] = 1.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1EastBeamInnerShadowTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_EAST_BEAM_INNER_SHADOW_WORLD_BOUNDS;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldZ = b.zMin + (b.zMax - b.zMin) * u;
			var worldY = b.yMin + (b.yMax - b.yMin) * v;
			var offset = (y * size + x) * 12;
			metadata[offset] = b.x;
			metadata[offset + 1] = worldY;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = -1.0;
			metadata[offset + 4] = 0.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 6.0;
			metadata[offset + 7] = 1.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1EastBeamUnderShadowTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_EAST_BEAM_UNDER_SHADOW_WORLD_BOUNDS;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldZ = b.zMin + (b.zMax - b.zMin) * u;
			var worldX = b.xMin + (b.xMax - b.xMin) * v;
			var offset = (y * size + x) * 12;
			metadata[offset] = worldX;
			metadata[offset + 1] = b.y;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = 0.0;
			metadata[offset + 4] = -1.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 6.0;
			metadata[offset + 7] = 1.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1SouthWindowXRevealShadowTexelMetadata(size, bounds, normalX)
{
	var metadata = new Float32Array(size * size * 12);
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldZ = bounds.zMin + (bounds.zMax - bounds.zMin) * u;
			var worldY = bounds.yMin + (bounds.yMax - bounds.yMin) * v;
			var offset = (y * size + x) * 12;
			metadata[offset] = bounds.x;
			metadata[offset + 1] = worldY;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = normalX;
			metadata[offset + 4] = 0.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 6.0;
			metadata[offset + 7] = 1.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1SouthWindowYRevealShadowTexelMetadata(size, bounds, normalY)
{
	var metadata = new Float32Array(size * size * 12);
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldX = bounds.xMin + (bounds.xMax - bounds.xMin) * u;
			var worldZ = bounds.zMin + (bounds.zMax - bounds.zMin) * v;
			var offset = (y * size + x) * 12;
			metadata[offset] = worldX;
			metadata[offset + 1] = bounds.y;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = 0.0;
			metadata[offset + 4] = normalY;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 6.0;
			metadata[offset + 7] = 1.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1IronDoorRevealTexelMetadata(size)
{
	// Mirrors shader r7310C1IronDoorRevealDiffuseUv (guard-band contract). 4 faces -> 4 v-bands; each band's
	// guard rows (GUARD_V*size each side) stay invalid; core rows carry world pos + normal. atlas(u,v)->world
	// is the exact inverse of the shader world->atlas mapping — keep both in sync (BAND_H / GUARD_V are shared consts).
	var metadata = new Float32Array(size * size * 12);
	var BAND_H = R7310_C1_IRON_DOOR_REVEAL_BAND_H;   // 0.25
	var GUARD_V = R7310_C1_IRON_DOOR_REVEAL_GUARD_V; // 0.04
	var CORE_H = BAND_H - 2.0 * GUARD_V;             // 0.17
	var valid = 0;
	for (var py = 0; py < size; py += 1)
	{
		for (var px = 0; px < size; px += 1)
		{
			var u = (px + 0.5) / size;
			var v = (py + 0.5) / size;
			var offset = (py * size + px) * 12;
			var band = Math.floor(v / BAND_H);
			if (band > 3) band = 3;
			var vLocal = v - band * BAND_H;                                  // 0..0.25
			var isCore = vLocal >= GUARD_V && vLocal <= (BAND_H - GUARD_V);   // core [GUARD_V, BAND_H-GUARD_V]
			var wx = 0.0, wy = 0.0, wz = 0.0, nx = 0.0, ny = 0.0, nz = 0.0, isValid = false;
			if (isCore)
			{
				var depth = (vLocal - GUARD_V) / CORE_H;   // 0..1 (door face x=-1.96 -> wall inner face x=-1.91)
				var along = u;                              // face long axis 0..1
				wx = -1.96 + depth * 0.05;
				if (band === 0) { wz = -1.874 + along * 0.890; wy = 2.04; ny = -1.0; isValid = true; }   // top (過樑底)   -Y
				else if (band === 1) { wz = -1.874 + along * 0.890; wy = 0.09; ny = 1.0; isValid = true; } // bottom (門檻頂) +Y
				else if (band === 2) { wy = 0.09 + along * 1.950; wz = -1.874; nz = 1.0; isValid = true; } // north jamb (北門樘) +Z
				else { wy = 0.09 + along * 1.950; wz = -0.984; nz = -1.0; isValid = true; }                // south jamb (南門樘) -Z
			}
			metadata[offset] = wx;
			metadata[offset + 1] = wy;
			metadata[offset + 2] = wz;
			metadata[offset + 3] = nx;
			metadata[offset + 4] = ny;
			metadata[offset + 5] = nz;
			metadata[offset + 6] = 6.0;
			metadata[offset + 7] = isValid ? 1.0 : 0.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			if (isValid) valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function buildR7310C1SouthWindowLeftRevealShadowTexelMetadata(size)
{
	return buildR7310C1SouthWindowXRevealShadowTexelMetadata(size, R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_WORLD_BOUNDS, 1.0);
}

function buildR7310C1SouthWindowRightRevealShadowTexelMetadata(size)
{
	return buildR7310C1SouthWindowXRevealShadowTexelMetadata(size, R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_WORLD_BOUNDS, -1.0);
}

function buildR7310C1SouthWindowBottomRevealShadowTexelMetadata(size)
{
	return buildR7310C1SouthWindowYRevealShadowTexelMetadata(size, R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_WORLD_BOUNDS, 1.0);
}

function buildR7310C1SouthWindowTopRevealShadowTexelMetadata(size)
{
	return buildR7310C1SouthWindowYRevealShadowTexelMetadata(size, R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_WORLD_BOUNDS, -1.0);
}

function buildR7310C1WestWallBeamShadowTexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var b = R7310_C1_WEST_WALL_BEAM_SHADOW_WORLD_BOUNDS;
	var hole = R7310_C1_WEST_WALL_IRON_DOOR_HOLE;
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldZ = b.zMin + (b.zMax - b.zMin) * u;
			var worldY = b.yMin + (b.yMax - b.yMin) * v;
			var isDoorHole = worldZ >= hole.zMin && worldZ <= hole.zMax && worldY >= hole.yMin && worldY <= hole.yMax;
			var isDeadZone = r7310C1WestWallHiddenByBeamOrSwColumn(worldZ, worldY);
			var isValid = !isDoorHole && !isDeadZone;
			var offset = (y * size + x) * 12;
			metadata[offset] = b.x;
			metadata[offset + 1] = worldY;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = 1.0;
			metadata[offset + 4] = 0.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 4.0;
			metadata[offset + 7] = isValid ? 1.0 : 0.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			if (isValid) valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function syncR7310C1AtlasAlphaToTexelMetadata(pixels, metadata, size)
{
	for (var i = 0; i < size * size; i += 1)
	{
		var valid = metadata[i * 12 + 7] > 0.5;
		if (valid) continue;
		var p = i * 4;
		pixels[p] = 0.0;
		pixels[p + 1] = 0.0;
		pixels[p + 2] = 0.0;
		pixels[p + 3] = 0.0;
	}
}

function shouldSyncR7310C1AtlasAlphaToTexelMetadata(patchId, metadataResult)
{
	if (!metadataResult || !(metadataResult.validTexelRatio < 0.999999))
		return false;
	if (patchId === R7310_C1_FLOOR_TARGET_ID || patchId === R7310_C1_STRUCTURAL_TARGET_ID)
		return false;
	return true;
}

function fillR7310C1AtlasEdgeFromNearestInterior(pixels, size)
{
	var lumaEpsilon = 0.000001;
	var texelLuma = function(index) {
		var p = index * 4;
		return 0.2126 * pixels[p] + 0.7152 * pixels[p + 1] + 0.0722 * pixels[p + 2];
	};
	var isUsable = function(index) {
		var p = index * 4;
		return pixels[p + 3] > 0.5 && texelLuma(index) > lumaEpsilon;
	};
	var copyTexel = function(dstIndex, srcIndex) {
		var dst = dstIndex * 4;
		var src = srcIndex * 4;
		pixels[dst] = pixels[src];
		pixels[dst + 1] = pixels[src + 1];
		pixels[dst + 2] = pixels[src + 2];
		pixels[dst + 3] = pixels[src + 3];
	};
	var copyFromNearestInterior = function(dstX, dstY) {
		var dstIndex = dstY * size + dstX;
		for (var radius = 1; radius < size; radius += 1)
		{
			var xMin = Math.max(1, dstX - radius);
			var xMax = Math.min(size - 2, dstX + radius);
			var yMin = Math.max(1, dstY - radius);
			var yMax = Math.min(size - 2, dstY + radius);
			for (var y = yMin; y <= yMax; y += 1)
			{
				for (var x = xMin; x <= xMax; x += 1)
				{
					if (x !== xMin && x !== xMax && y !== yMin && y !== yMax) continue;
					var srcIndex = y * size + x;
					if (!isUsable(srcIndex)) continue;
					copyTexel(dstIndex, srcIndex);
					return true;
				}
			}
		}
		return false;
	};
	var fillVerticalEdge = function(x, dstY, stepY) {
		var dstIndex = dstY * size + x;
		if (isUsable(dstIndex)) return;
		for (var y = dstY + stepY; y > 0 && y < size - 1; y += stepY)
		{
			var srcIndex = y * size + x;
			if (!isUsable(srcIndex)) continue;
			copyTexel(dstIndex, srcIndex);
			return;
		}
		copyFromNearestInterior(x, dstY);
	};
	var fillHorizontalEdge = function(y, dstX, stepX) {
		var dstIndex = y * size + dstX;
		if (isUsable(dstIndex)) return;
		for (var x = dstX + stepX; x > 0 && x < size - 1; x += stepX)
		{
			var srcIndex = y * size + x;
			if (!isUsable(srcIndex)) continue;
			copyTexel(dstIndex, srcIndex);
			return;
		}
		copyFromNearestInterior(dstX, y);
	};
	for (var x = 0; x < size; x += 1)
	{
		fillVerticalEdge(x, 0, 1);
		fillVerticalEdge(x, size - 1, -1);
	}
	for (var y = 0; y < size; y += 1)
	{
		fillHorizontalEdge(y, 0, 1);
		fillHorizontalEdge(y, size - 1, -1);
	}
}

function maskR7310C1NorthWallAtlasPixels(pixels, metadata, size)
{
	syncR7310C1AtlasAlphaToTexelMetadata(pixels, metadata, size);
}

function fillR7310C1StructuralSeColumnInnerBookshelfGuardTexels(pixels, size)
{
	var uStart = 0.520 + ((2.73 - 2.49) / (3.056 - 2.49)) * (0.740 - 0.520);
	var vEnd = 0.380 + (2.04 / 2.905) * (0.760 - 0.380);
	var xMin = Math.max(1, Math.ceil(uStart * size - 0.5));
	var xMax = Math.min(size - 2, Math.floor(0.740 * size - 0.5));
	var yMin = Math.max(1, Math.ceil(0.380 * size - 0.5));
	var yMax = Math.min(size - 2, Math.floor(vEnd * size - 0.5));
	var sourceX = Math.max(0, xMin - 1);
	for (var y = yMin; y <= yMax; y += 1)
	{
		var source = (y * size + sourceX) * 4;
		for (var x = xMin; x <= xMax; x += 1)
		{
			var dst = (y * size + x) * 4;
			pixels[dst] = pixels[source];
			pixels[dst + 1] = pixels[source + 1];
			pixels[dst + 2] = pixels[source + 2];
			pixels[dst + 3] = pixels[source + 3];
		}
	}
}

function fillR7310C1StructuralSeColumnNorthEastBeamGuardTexels(pixels, size)
{
	var uStart = Math.max(1, Math.min(size - 1, Math.ceil((2.515 / 2.905) * size - 0.5)));
	var vStart = Math.max(1, Math.min(size - 1, Math.ceil((0.880 + ((1.85 - 1.780) / 0.130) * 0.120) * size - 0.5)));
	var uSource = uStart - 1;
	var vSource = vStart - 1;
	for (var y = vStart; y < size; y += 1)
	{
		for (var x = uStart; x < size; x += 1)
		{
			var sourceX = x;
			var sourceY = y;
			if ((x - uStart) <= (y - vStart))
				sourceX = uSource;
			else
				sourceY = vSource;
			var src = (sourceY * size + sourceX) * 4;
			var dst = (y * size + x) * 4;
			pixels[dst] = pixels[src];
			pixels[dst + 1] = pixels[src + 1];
			pixels[dst + 2] = pixels[src + 2];
			pixels[dst + 3] = pixels[src + 3];
		}
	}
}

function r7310C1ValidTexelRatioMinimumForSurface(surfaceName)
{
	if (surfaceName === R7310_C1_NORTH_WALL_SURFACE_NAME)
		return 0.77;
	if (surfaceName === R7310_C1_EAST_WALL_SURFACE_NAME)
		return 0.70;
	if (surfaceName === R7310_C1_WEST_WALL_SURFACE_NAME)
		return 0.60;
	if (surfaceName === R7310_C1_WEST_WALL_BEAM_SHADOW_SURFACE_NAME)
		return 0.70;
	if (surfaceName === R7310_C1_EAST_WALL_BEAM_SHADOW_SURFACE_NAME)
		return 0.70;
	if (surfaceName === R7310_C1_SOUTH_WALL_SURFACE_NAME)
		return 0.60;
	if (surfaceName === R7310_C1_SOUTH_WALL_AC_SHADOW_SURFACE_NAME)
		return 0.56;
	if (surfaceName === R7310_C1_CEILING_SURFACE_NAME)
		return 0.98;
	if (surfaceName === R7310_C1_STRUCTURAL_SURFACE_NAME)
		return 0.30;
	if (surfaceName === R7310_C1_SE_COLUMN_NORTH_SHADOW_SURFACE_NAME)
		return 0.93;
	if (surfaceName === R7310_C1_SE_COLUMN_WEST_SHADOW_SURFACE_NAME)
		return 0.50;
	if (surfaceName === R7310_C1_SW_COLUMN_INNER_SHADOW_SURFACE_NAME)
		return 0.50;
	if (surfaceName === R7310_C1_IRON_DOOR_REVEAL_SURFACE_NAME)
		return 0.60;
	return 0.99;
}

function averageR738AtlasPixels(pixels, samples)
{
	var divisor = Math.max(1, Number(samples) || 1);
	var averaged = new Float32Array(pixels.length);
	var nonFiniteTexels = 0;
	for (var i = 0; i < pixels.length; i += 4)
	{
		var r = pixels[i] / divisor;
		var g = pixels[i + 1] / divisor;
		var b = pixels[i + 2] / divisor;
		if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b))
			nonFiniteTexels += 1;
		averaged[i] = Number.isFinite(r) ? r : 0;
		averaged[i + 1] = Number.isFinite(g) ? g : 0;
		averaged[i + 2] = Number.isFinite(b) ? b : 0;
		averaged[i + 3] = 1.0;
	}
	return { pixels: averaged, nonFiniteTexels: nonFiniteTexels };
}

function calculateR738ReprojectionSanity(rawHdr, rawSamples, atlasPixels, metadata, size)
{
	if (!rawHdr || !atlasPixels || !metadata || !worldCamera || !THREE)
		return { comparisons: 0, medianRelativeLumaError: null, p90RelativeLumaError: null, status: 'fail' };
	var errors = [];
	var rawDivisor = Math.max(1, Number(rawSamples) || 1);
	var classIds = window.__r738C1BakeCaptureLastSurfaceClassIds || null;
	var sampleGrid = 8;
	for (var gy = 0; gy < sampleGrid; gy += 1)
	{
		for (var gx = 0; gx < sampleGrid; gx += 1)
		{
			var tx = Math.min(size - 1, Math.floor((gx + 0.5) * size / sampleGrid));
			var ty = Math.min(size - 1, Math.floor((gy + 0.5) * size / sampleGrid));
			var metaOffset = (ty * size + tx) * 12;
			var position = new THREE.Vector3(metadata[metaOffset], metadata[metaOffset + 1], metadata[metaOffset + 2]);
			var projected = position.clone().project(worldCamera);
			if (projected.x < -1 || projected.x > 1 || projected.y < -1 || projected.y > 1 || projected.z < -1 || projected.z > 1)
				continue;
			var sx = Math.max(0, Math.min(rawHdr.width - 1, Math.floor((projected.x * 0.5 + 0.5) * rawHdr.width)));
			var sy = Math.max(0, Math.min(rawHdr.height - 1, Math.floor((projected.y * 0.5 + 0.5) * rawHdr.height)));
			var rawIndex = sy * rawHdr.width + sx;
			if (classIds && classIds[rawIndex] !== 1)
				continue;
			var rawOffset = rawIndex * 4;
			var atlasOffset = (ty * size + tx) * 4;
			var rawLuma = (0.2126 * rawHdr.pixels[rawOffset] + 0.7152 * rawHdr.pixels[rawOffset + 1] + 0.0722 * rawHdr.pixels[rawOffset + 2]) / rawDivisor;
			var atlasLuma = 0.2126 * atlasPixels[atlasOffset] + 0.7152 * atlasPixels[atlasOffset + 1] + 0.0722 * atlasPixels[atlasOffset + 2];
			if (!Number.isFinite(rawLuma) || !Number.isFinite(atlasLuma))
				continue;
			var denom = Math.max(1e-6, Math.abs(rawLuma), Math.abs(atlasLuma));
			errors.push(Math.abs(rawLuma - atlasLuma) / denom);
		}
	}
	errors.sort(function(a, bValue) { return a - bValue; });
	var pick = function(q) {
		if (errors.length === 0) return null;
		return errors[Math.min(errors.length - 1, Math.floor(q * (errors.length - 1)))];
	};
	var median = pick(0.50);
	var p90 = pick(0.90);
	return {
		comparisons: errors.length,
		medianRelativeLumaError: median,
		p90RelativeLumaError: p90,
		status: errors.length >= 8 && median !== null && p90 !== null && median <= 0.25 && p90 <= 0.50 ? 'pass' : 'fail'
	};
}

async function captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, options)
{
	if (!renderer || !THREE || !pathTracingUniforms || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera || !screenCopyUniforms)
		throw new Error('R7-3.8 atlas capture missing renderer state');
		options = options || {};
		var size = normalizeR738PositiveInt(options.targetAtlasResolution, 512, 1, 4096);
		var targetCount = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
		var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
		var patchId = normalizeR738PositiveInt(options.patchId, 0, 0, 999999);
		var surfaceName = options.surfaceName || 'floor_center_c1_reference';
		var floorWorldBounds = options.floorWorldBounds || { xMin: -1.0, xMax: 1.0, zMin: -1.0, zMax: 1.0, y: 0.01 };
		var target = createR738FloatRenderTarget(size, size);
	var previous = createR738FloatRenderTarget(size, size);
	var state = captureR738BakeState();
	var savedRenderTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
	var startMs = performance.now();
	var samples = 0;
	try
	{
		if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
		samplingPaused = true;
			cameraIsMoving = false;
			cameraRecentlyMoving = false;
			pathTracingUniforms.uR738C1BakeCaptureMode.value = 2;
			pathTracingUniforms.uR738C1BakePatchId.value = patchId;
			pathTracingUniforms.uR738C1BakePatchResolution.value = size;
			if (pathTracingUniforms.uR738C1BakeDiffuseOnlyMode) pathTracingUniforms.uR738C1BakeDiffuseOnlyMode.value = 1.0;
			if (typeof updateR7310C1FullRoomDiffuseRuntimeUniforms === 'function')
				updateR7310C1FullRoomDiffuseRuntimeUniforms();
			if (pathTracingUniforms.uR7310C1BakeFloorWorldBounds)
				pathTracingUniforms.uR7310C1BakeFloorWorldBounds.value.set(floorWorldBounds.xMin, floorWorldBounds.xMax, floorWorldBounds.zMin, floorWorldBounds.zMax);
			if (pathTracingUniforms.uXrayEnabled) pathTracingUniforms.uXrayEnabled.value = 0.0;
		pathTracingUniforms.uResolution.value.set(size, size);
		pathTracingUniforms.tPreviousTexture.value = previous.texture;
		screenCopyUniforms.tPathTracedImageTexture.value = target.texture;
		renderer.setRenderTarget(target);
		renderer.clear();
		renderer.setRenderTarget(previous);
		renderer.clear();
		for (var sample = 1; sample <= targetCount; sample += 1)
		{
			if ((performance.now() - startMs) > timeout)
				break;
			sampleCounter = sample;
			frameCounter = sample + 1.0;
			pathTracingUniforms.uSampleCounter.value = sampleCounter;
			pathTracingUniforms.uFrameCounter.value = frameCounter;
			pathTracingUniforms.uPreviousSampleCount.value = 1.0;
			pathTracingUniforms.uCameraIsMoving.value = false;
			pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());
			renderer.setRenderTarget(target);
			renderer.render(pathTracingScene, worldCamera);
			renderer.setRenderTarget(previous);
			renderer.render(screenCopyScene, orthoCamera);
			samples = sample;
			if (sample % 16 === 0)
				await new Promise(function(resolve) { setTimeout(resolve, 0); });
		}
		// CODEX directive #4A：capture 中（render loop 後、finally restore 前）快照
		// R7-3.10 runtime short-circuit 相關 uniform，偵測「bake 吃 bake」污染。
		// 乾淨 bake 預期全部為 0（runtime 套件未載入 → short-circuit 不觸發）。
		var r7310BakeContaminationGuardSnapshot = {
			phase: 'during_capture',
			uR7310C1FullRoomDiffuseMode: pathTracingUniforms.uR7310C1FullRoomDiffuseMode ? pathTracingUniforms.uR7310C1FullRoomDiffuseMode.value : null,
			uR7310C1FullRoomDiffuseReady: pathTracingUniforms.uR7310C1FullRoomDiffuseReady ? pathTracingUniforms.uR7310C1FullRoomDiffuseReady.value : null,
			uR7310C1FloorDiffuseMode: pathTracingUniforms.uR7310C1FloorDiffuseMode ? pathTracingUniforms.uR7310C1FloorDiffuseMode.value : null,
			uR7310C1NorthWallDiffuseMode: pathTracingUniforms.uR7310C1NorthWallDiffuseMode ? pathTracingUniforms.uR7310C1NorthWallDiffuseMode.value : null,
				uR7310C1EastWallDiffuseMode: pathTracingUniforms.uR7310C1EastWallDiffuseMode ? pathTracingUniforms.uR7310C1EastWallDiffuseMode.value : null,
				uR7310C1WestWallDiffuseMode: pathTracingUniforms.uR7310C1WestWallDiffuseMode ? pathTracingUniforms.uR7310C1WestWallDiffuseMode.value : null,
				uR7310C1SouthWallDiffuseMode: pathTracingUniforms.uR7310C1SouthWallDiffuseMode ? pathTracingUniforms.uR7310C1SouthWallDiffuseMode.value : null,
				uR7310C1CeilingDiffuseMode: pathTracingUniforms.uR7310C1CeilingDiffuseMode ? pathTracingUniforms.uR7310C1CeilingDiffuseMode.value : null,
				uR7310C1StructuralDiffuseMode: pathTracingUniforms.uR7310C1StructuralDiffuseMode ? pathTracingUniforms.uR7310C1StructuralDiffuseMode.value : null,
				uR7310C1SeColumnNorthShadowMode: pathTracingUniforms.uR7310C1SeColumnNorthShadowMode ? pathTracingUniforms.uR7310C1SeColumnNorthShadowMode.value : null,
				uR7310C1SeColumnWestShadowMode: pathTracingUniforms.uR7310C1SeColumnWestShadowMode ? pathTracingUniforms.uR7310C1SeColumnWestShadowMode.value : null,
				uR7310C1SouthWallAcShadowMode: pathTracingUniforms.uR7310C1SouthWallAcShadowMode ? pathTracingUniforms.uR7310C1SouthWallAcShadowMode.value : null,
				uR7310C1EastWallBeamShadowMode: pathTracingUniforms.uR7310C1EastWallBeamShadowMode ? pathTracingUniforms.uR7310C1EastWallBeamShadowMode.value : null,
				uR7310C1SwColumnNorthShadowMode: pathTracingUniforms.uR7310C1SwColumnNorthShadowMode ? pathTracingUniforms.uR7310C1SwColumnNorthShadowMode.value : null,
				uR7310C1WestWallBeamShadowMode: pathTracingUniforms.uR7310C1WestWallBeamShadowMode ? pathTracingUniforms.uR7310C1WestWallBeamShadowMode.value : null,
				uR7310C1SwColumnInnerShadowMode: pathTracingUniforms.uR7310C1SwColumnInnerShadowMode ? pathTracingUniforms.uR7310C1SwColumnInnerShadowMode.value : null,
				uR7310C1WestBeamInnerShadowMode: pathTracingUniforms.uR7310C1WestBeamInnerShadowMode ? pathTracingUniforms.uR7310C1WestBeamInnerShadowMode.value : null,
				uR7310C1WestBeamUnderShadowMode: pathTracingUniforms.uR7310C1WestBeamUnderShadowMode ? pathTracingUniforms.uR7310C1WestBeamUnderShadowMode.value : null,
				uR7310C1EastBeamInnerShadowMode: pathTracingUniforms.uR7310C1EastBeamInnerShadowMode ? pathTracingUniforms.uR7310C1EastBeamInnerShadowMode.value : null,
				uR7310C1EastBeamUnderShadowMode: pathTracingUniforms.uR7310C1EastBeamUnderShadowMode ? pathTracingUniforms.uR7310C1EastBeamUnderShadowMode.value : null,
				uR738C1BakeCaptureMode: pathTracingUniforms.uR738C1BakeCaptureMode ? pathTracingUniforms.uR738C1BakeCaptureMode.value : null
			};
		var readback = await readR738RenderTargetFloatPixels(target);
		var averaged = averageR738AtlasPixels(readback.pixels, samples);
			var preSyncAtlasPixels = new Float32Array(averaged.pixels);
			var metadataResult = buildR738TexelMetadata(size, floorWorldBounds);
			if (patchId === R7310_C1_FLOOR_TARGET_ID) metadataResult = buildR7310C1FloorTexelMetadata(size);
			else if (patchId === R7310_C1_NORTH_WALL_TARGET_ID) metadataResult = buildR7310C1NorthWallTexelMetadata(size);
			else if (patchId === R7310_C1_EAST_WALL_TARGET_ID) metadataResult = buildR7310C1EastWallTexelMetadata(size);
			else if (patchId === R7310_C1_WEST_WALL_TARGET_ID) metadataResult = buildR7310C1WestWallTexelMetadata(size);
			else if (patchId === R7310_C1_SOUTH_WALL_TARGET_ID) metadataResult = buildR7310C1SouthWallTexelMetadata(size);
			else if (patchId === R7310_C1_CEILING_TARGET_ID) metadataResult = buildR7310C1CeilingTexelMetadata(size);
			else if (patchId === R7310_C1_STRUCTURAL_TARGET_ID) metadataResult = buildR7310C1StructuralTexelMetadata(size);
			else if (patchId === R7310_C1_SE_COLUMN_NORTH_SHADOW_TARGET_ID) metadataResult = buildR7310C1SeColumnNorthShadowTexelMetadata(size);
			else if (patchId === R7310_C1_SE_COLUMN_WEST_SHADOW_TARGET_ID) metadataResult = buildR7310C1SeColumnWestShadowTexelMetadata(size);
			else if (patchId === R7310_C1_SOUTH_WALL_AC_SHADOW_TARGET_ID) metadataResult = buildR7310C1SouthWallAcShadowTexelMetadata(size);
			else if (patchId === R7310_C1_EAST_WALL_BEAM_SHADOW_TARGET_ID) metadataResult = buildR7310C1EastWallBeamShadowTexelMetadata(size);
			else if (patchId === R7310_C1_SW_COLUMN_NORTH_SHADOW_TARGET_ID) metadataResult = buildR7310C1SwColumnNorthShadowTexelMetadata(size);
			else if (patchId === R7310_C1_WEST_WALL_BEAM_SHADOW_TARGET_ID) metadataResult = buildR7310C1WestWallBeamShadowTexelMetadata(size);
			else if (patchId === R7310_C1_SW_COLUMN_INNER_SHADOW_TARGET_ID) metadataResult = buildR7310C1SwColumnInnerShadowTexelMetadata(size);
			else if (patchId === R7310_C1_WEST_BEAM_INNER_SHADOW_TARGET_ID) metadataResult = buildR7310C1WestBeamInnerShadowTexelMetadata(size);
			else if (patchId === R7310_C1_WEST_BEAM_UNDER_SHADOW_TARGET_ID) metadataResult = buildR7310C1WestBeamUnderShadowTexelMetadata(size);
			else if (patchId === R7310_C1_EAST_BEAM_INNER_SHADOW_TARGET_ID) metadataResult = buildR7310C1EastBeamInnerShadowTexelMetadata(size);
			else if (patchId === R7310_C1_EAST_BEAM_UNDER_SHADOW_TARGET_ID) metadataResult = buildR7310C1EastBeamUnderShadowTexelMetadata(size);
			else if (patchId === R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_TARGET_ID) metadataResult = buildR7310C1SouthWindowLeftRevealShadowTexelMetadata(size);
			else if (patchId === R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_TARGET_ID) metadataResult = buildR7310C1SouthWindowRightRevealShadowTexelMetadata(size);
			else if (patchId === R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_TARGET_ID) metadataResult = buildR7310C1SouthWindowBottomRevealShadowTexelMetadata(size);
			else if (patchId === R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_TARGET_ID) metadataResult = buildR7310C1SouthWindowTopRevealShadowTexelMetadata(size);
			else if (patchId === R7310_C1_IRON_DOOR_REVEAL_TARGET_ID) metadataResult = buildR7310C1IronDoorRevealTexelMetadata(size);
			if (shouldSyncR7310C1AtlasAlphaToTexelMetadata(patchId, metadataResult))
				syncR7310C1AtlasAlphaToTexelMetadata(averaged.pixels, metadataResult.metadata, size);
			if (patchId === R7310_C1_FLOOR_TARGET_ID || patchId === R7310_C1_CEILING_TARGET_ID)
				fillR7310C1AtlasEdgeFromNearestInterior(averaged.pixels, size);
				if (patchId === R7310_C1_STRUCTURAL_TARGET_ID)
				{
					fillR7310C1StructuralSeColumnInnerBookshelfGuardTexels(averaged.pixels, size);
					fillR7310C1StructuralSeColumnNorthEastBeamGuardTexels(averaged.pixels, size);
				}
			window.__r738C1BakeCaptureLastAtlasPixels = averaged.pixels;
			window.__r738C1BakeCaptureLastPreSyncAtlasPixels = preSyncAtlasPixels;
			window.__r738C1BakeCaptureLastTexelMetadata = metadataResult.metadata;
		return {
			enabled: true,
			patchCount: 1,
			patchSize: size,
			upscaled: false,
			requestedSamples: targetCount,
			actualSamples: samples,
			actualSamplesByPatch: [
				{ patchId: patchId, surfaceName: surfaceName, actualSamples: samples }
			],
			worldBounds: floorWorldBounds,
			diffuseOnly: true,
			nonFiniteTexels: averaged.nonFiniteTexels,
			validTexelRatio: metadataResult.validTexelRatio,
			bakeContaminationGuardSnapshot: r7310BakeContaminationGuardSnapshot,
			timedOut: samples < targetCount,
			elapsedMs: Math.round(performance.now() - startMs)
		};
	}
	finally
	{
		restoreR738BakeState(state);
		renderer.setRenderTarget(savedRenderTarget);
		target.dispose();
		previous.dispose();
	}
	}
	window.captureR738C1DirectSurfaceTexelPatch = captureR738C1DirectSurfaceTexelPatch;

async function captureR7310C1FloorDiffuseAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution,
		patchId: R7310_C1_FLOOR_TARGET_ID,
		surfaceName: R7310_C1_FLOOR_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1FloorDiffuseAtlas = captureR7310C1FloorDiffuseAtlas;

async function captureR7310C1NorthWallDiffuseAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution,
		patchId: R7310_C1_NORTH_WALL_TARGET_ID,
		surfaceName: R7310_C1_NORTH_WALL_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1NorthWallDiffuseAtlas = captureR7310C1NorthWallDiffuseAtlas;

async function captureR7310C1EastWallDiffuseAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution,
		patchId: R7310_C1_EAST_WALL_TARGET_ID,
		surfaceName: R7310_C1_EAST_WALL_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1EastWallDiffuseAtlas = captureR7310C1EastWallDiffuseAtlas;

async function captureR7310C1EastWallBeamShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_EAST_WALL_BEAM_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_EAST_WALL_BEAM_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1EastWallBeamShadowAtlas = captureR7310C1EastWallBeamShadowAtlas;

async function captureR7310C1WestWallDiffuseAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution,
		patchId: R7310_C1_WEST_WALL_TARGET_ID,
		surfaceName: R7310_C1_WEST_WALL_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1WestWallDiffuseAtlas = captureR7310C1WestWallDiffuseAtlas;

async function captureR7310C1SouthWallDiffuseAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution,
		patchId: R7310_C1_SOUTH_WALL_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WALL_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1SouthWallDiffuseAtlas = captureR7310C1SouthWallDiffuseAtlas;

async function captureR7310C1SouthWallAcShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_SOUTH_WALL_AC_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WALL_AC_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1SouthWallAcShadowAtlas = captureR7310C1SouthWallAcShadowAtlas;

async function captureR7310C1CeilingDiffuseAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_CEILING_TARGET_ID,
		surfaceName: R7310_C1_CEILING_SURFACE_NAME,
		floorWorldBounds: R7310_C1_CEILING_WORLD_BOUNDS
	});
}
window.captureR7310C1CeilingDiffuseAtlas = captureR7310C1CeilingDiffuseAtlas;

async function captureR7310C1StructuralDiffuseAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_STRUCTURAL_TARGET_ID,
		surfaceName: R7310_C1_STRUCTURAL_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1StructuralDiffuseAtlas = captureR7310C1StructuralDiffuseAtlas;

async function captureR7310C1SeColumnNorthShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_SE_COLUMN_NORTH_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SE_COLUMN_NORTH_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1SeColumnNorthShadowAtlas = captureR7310C1SeColumnNorthShadowAtlas;

async function captureR7310C1SeColumnWestShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_SE_COLUMN_WEST_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SE_COLUMN_WEST_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1SeColumnWestShadowAtlas = captureR7310C1SeColumnWestShadowAtlas;

async function captureR7310C1SwColumnNorthShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_SW_COLUMN_NORTH_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SW_COLUMN_NORTH_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1SwColumnNorthShadowAtlas = captureR7310C1SwColumnNorthShadowAtlas;

async function captureR7310C1WestWallBeamShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_WEST_WALL_BEAM_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_WEST_WALL_BEAM_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1WestWallBeamShadowAtlas = captureR7310C1WestWallBeamShadowAtlas;

async function captureR7310C1SwColumnInnerShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_SW_COLUMN_INNER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SW_COLUMN_INNER_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1SwColumnInnerShadowAtlas = captureR7310C1SwColumnInnerShadowAtlas;

async function captureR7310C1WestBeamInnerShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_WEST_BEAM_INNER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_WEST_BEAM_INNER_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1WestBeamInnerShadowAtlas = captureR7310C1WestBeamInnerShadowAtlas;

async function captureR7310C1WestBeamUnderShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_WEST_BEAM_UNDER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_WEST_BEAM_UNDER_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1WestBeamUnderShadowAtlas = captureR7310C1WestBeamUnderShadowAtlas;

async function captureR7310C1EastBeamInnerShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_EAST_BEAM_INNER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_EAST_BEAM_INNER_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1EastBeamInnerShadowAtlas = captureR7310C1EastBeamInnerShadowAtlas;

async function captureR7310C1EastBeamUnderShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_EAST_BEAM_UNDER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_EAST_BEAM_UNDER_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1EastBeamUnderShadowAtlas = captureR7310C1EastBeamUnderShadowAtlas;

async function captureR7310C1SouthWindowLeftRevealShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1SouthWindowLeftRevealShadowAtlas = captureR7310C1SouthWindowLeftRevealShadowAtlas;

async function captureR7310C1SouthWindowRightRevealShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1SouthWindowRightRevealShadowAtlas = captureR7310C1SouthWindowRightRevealShadowAtlas;

async function captureR7310C1SouthWindowBottomRevealShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1SouthWindowBottomRevealShadowAtlas = captureR7310C1SouthWindowBottomRevealShadowAtlas;

async function captureR7310C1SouthWindowTopRevealShadowAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1SouthWindowTopRevealShadowAtlas = captureR7310C1SouthWindowTopRevealShadowAtlas;
async function captureR7310C1IronDoorRevealAtlas(targetSamples, timeoutMs, options)
{
	options = options || {};
	return captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, {
		targetAtlasResolution: options.targetAtlasResolution || 1024,
		patchId: R7310_C1_IRON_DOOR_REVEAL_TARGET_ID,
		surfaceName: R7310_C1_IRON_DOOR_REVEAL_SURFACE_NAME,
		floorWorldBounds: R7310_C1_FLOOR_WORLD_BOUNDS
	});
}
window.captureR7310C1IronDoorRevealAtlas = captureR7310C1IronDoorRevealAtlas;

function buildR738ValidationReport(report, rawHdrReadback, atlasPixels, texelMetadata, reprojection)
{
	var targetAtlasResolution = report.targetAtlasResolution;
	var atlasFloatCount = atlasPixels ? atlasPixels.length : 0;
	var metadataFloatCount = texelMetadata ? texelMetadata.length : 0;
	var validTexelRatioMinimum = r7310C1ValidTexelRatioMinimumForSurface(report.surfaceName);
	var atlasVisibleLuma = summarizeR7310AtlasVisibleLuma(atlasPixels);
		var checks = {
			version: report.version === 'r7-3-8-c1-1000spp-bake-capture' || report.version === 'r7-3-10-full-room-diffuse-bake-architecture-probe',
		config: report.config === 1,
		rawSamples: report.rawHdr && report.rawHdr.actualSamples >= report.requestedSamples,
		rawFinite: report.rawHdrSummary && report.rawHdrSummary.nonFinitePixels === 0 && report.rawHdrSummary.finitePixels === report.buffer.width * report.buffer.height,
		surfaceClass: report.surfaceClassSummary && (report.surfaceClassSummary.floor + report.surfaceClassSummary.ceiling + report.surfaceClassSummary.wall + report.surfaceClassSummary.gik + report.surfaceClassSummary.object) > 0,
		atlasResolution: report.atlasSummary && report.atlasSummary.patchSize === targetAtlasResolution,
		upscaled: report.upscaled === false && report.atlasSummary && report.atlasSummary.upscaled === false,
		diffuseOnly: report.diffuseOnly === true && report.atlasSummary && report.atlasSummary.diffuseOnly === true,
		atlasFloatCount: atlasFloatCount === targetAtlasResolution * targetAtlasResolution * 4,
		metadataFloatCount: metadataFloatCount === targetAtlasResolution * targetAtlasResolution * 12,
		validTexelRatio: report.atlasSummary && report.atlasSummary.validTexelRatio >= validTexelRatioMinimum,
		atlasSamples: report.atlasSummary && report.atlasSummary.actualSamples >= report.requestedSamples,
		patchSamples: report.atlasSummary && Array.isArray(report.atlasSummary.actualSamplesByPatch) && report.atlasSummary.actualSamplesByPatch.every(function(entry) { return entry.actualSamples >= report.requestedSamples; }),
		atlasVisibleLuma: atlasVisibleLuma.nonzeroTexels > 0 && atlasVisibleLuma.meanLuma > 0.001 && atlasVisibleLuma.maxLuma > 0.01,
		reprojectionRecorded: !!reprojection
	};
	var status = Object.keys(checks).every(function(key) { return checks[key]; }) ? 'pass' : 'fail';
	return {
		status: status,
		checks: checks,
		reprojectionStatus: reprojection ? reprojection.status : 'missing',
		medianRelativeLumaError: reprojection ? reprojection.medianRelativeLumaError : null,
		p90RelativeLumaError: reprojection ? reprojection.p90RelativeLumaError : null,
		reprojectionComparisons: reprojection ? reprojection.comparisons : 0,
		rawHdrPixels: rawHdrReadback ? rawHdrReadback.width * rawHdrReadback.height : 0,
		atlasFloatCount: atlasFloatCount,
		metadataFloatCount: metadataFloatCount,
		atlasVisibleLuma: atlasVisibleLuma
	};
}

window.reportR738C1BakeCaptureAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR738C1DirectSurfaceTexelPatch(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-8-c1-1000spp-bake-capture',
			config: prep.config,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

	window.getR738C1BakeCaptureArtifacts = function()
	{
	var report = window.__r738C1BakeCaptureLastReport;
	if (!report)
		throw new Error('Run reportR738C1BakeCaptureAfterSamples() first');
	return {
		report: report,
		rawHdrSummary: window.__r738C1BakeCaptureLastRawHdrSummary || report.rawHdrSummary,
		surfaceClassSummary: window.__r738C1BakeCaptureLastSurfaceClassSummary || report.surfaceClassSummary,
			atlasPixels: window.__r738C1BakeCaptureLastAtlasPixels || null,
			preSyncAtlasPixels: window.__r738C1BakeCaptureLastPreSyncAtlasPixels || null,
			texelMetadata: window.__r738C1BakeCaptureLastTexelMetadata || null,
			validationReport: report.validation || null
		};
	};

async function reportR7310C1DedicatedBeamColumnShadowBakeAfterSamples(targetSamples, timeoutMs, options, spec)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await spec.captureAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var validTexelRatioBySurface = {};
		var dilationAppliedBySurface = {};
		var atlasPathBySurface = {};
		validTexelRatioBySurface[spec.surfaceName] = atlasSummary.validTexelRatio;
		dilationAppliedBySurface[spec.surfaceName] = false;
		atlasPathBySurface[spec.surfaceName] = 'atlas-patch-000-rgba-f32.bin';
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			batch: spec.batch,
			targetId: spec.targetId,
			surfaceName: spec.surfaceName,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			bakedRadianceKind: 'indirect_diffuse_radiance',
			directLightAlreadyIncluded: false,
			addDirectLightAfterBakeLookup: true,
			mapping: spec.mapping,
			referenceForAcceptance: 'live_path_tracing_same_camera',
			worldBounds: spec.worldBounds,
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: spec.batch,
				surfaceTargetCount: 1,
				coveredSurfaceNames: [spec.surfaceName],
				missingSurfaceNames: [],
				validTexelRatioBySurface: validTexelRatioBySurface,
				dilationAppliedBySurface: dilationAppliedBySurface,
				atlasPathBySurface: atlasPathBySurface,
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
}

window.reportR7310C1SwColumnInnerShadowBakeAfterSamples = function(targetSamples, timeoutMs, options)
{
	return reportR7310C1DedicatedBeamColumnShadowBakeAfterSamples(targetSamples, timeoutMs, options, {
		batch: 'sw_column_inner_shadow',
		targetId: R7310_C1_SW_COLUMN_INNER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SW_COLUMN_INNER_SHADOW_SURFACE_NAME,
		worldBounds: R7310_C1_SW_COLUMN_INNER_SHADOW_WORLD_BOUNDS,
		mapping: 'single_planar_zy_on_x_face',
		captureAtlas: captureR7310C1SwColumnInnerShadowAtlas
	});
};

window.reportR7310C1WestBeamInnerShadowBakeAfterSamples = function(targetSamples, timeoutMs, options)
{
	return reportR7310C1DedicatedBeamColumnShadowBakeAfterSamples(targetSamples, timeoutMs, options, {
		batch: 'west_beam_inner_shadow',
		targetId: R7310_C1_WEST_BEAM_INNER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_WEST_BEAM_INNER_SHADOW_SURFACE_NAME,
		worldBounds: R7310_C1_WEST_BEAM_INNER_SHADOW_WORLD_BOUNDS,
		mapping: 'single_planar_zy_on_x_face',
		captureAtlas: captureR7310C1WestBeamInnerShadowAtlas
	});
};

window.reportR7310C1WestBeamUnderShadowBakeAfterSamples = function(targetSamples, timeoutMs, options)
{
	return reportR7310C1DedicatedBeamColumnShadowBakeAfterSamples(targetSamples, timeoutMs, options, {
		batch: 'west_beam_under_shadow',
		targetId: R7310_C1_WEST_BEAM_UNDER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_WEST_BEAM_UNDER_SHADOW_SURFACE_NAME,
		worldBounds: R7310_C1_WEST_BEAM_UNDER_SHADOW_WORLD_BOUNDS,
		mapping: 'single_planar_zx_on_y_face',
		captureAtlas: captureR7310C1WestBeamUnderShadowAtlas
	});
};

window.reportR7310C1EastBeamInnerShadowBakeAfterSamples = function(targetSamples, timeoutMs, options)
{
	return reportR7310C1DedicatedBeamColumnShadowBakeAfterSamples(targetSamples, timeoutMs, options, {
		batch: 'east_beam_inner_shadow',
		targetId: R7310_C1_EAST_BEAM_INNER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_EAST_BEAM_INNER_SHADOW_SURFACE_NAME,
		worldBounds: R7310_C1_EAST_BEAM_INNER_SHADOW_WORLD_BOUNDS,
		mapping: 'single_planar_zy_on_x_face',
		captureAtlas: captureR7310C1EastBeamInnerShadowAtlas
	});
};

window.reportR7310C1EastBeamUnderShadowBakeAfterSamples = function(targetSamples, timeoutMs, options)
{
	return reportR7310C1DedicatedBeamColumnShadowBakeAfterSamples(targetSamples, timeoutMs, options, {
		batch: 'east_beam_under_shadow',
		targetId: R7310_C1_EAST_BEAM_UNDER_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_EAST_BEAM_UNDER_SHADOW_SURFACE_NAME,
		worldBounds: R7310_C1_EAST_BEAM_UNDER_SHADOW_WORLD_BOUNDS,
		mapping: 'single_planar_zx_on_y_face',
		captureAtlas: captureR7310C1EastBeamUnderShadowAtlas
	});
};

window.reportR7310C1SouthWindowLeftRevealShadowBakeAfterSamples = function(targetSamples, timeoutMs, options)
{
	return reportR7310C1DedicatedBeamColumnShadowBakeAfterSamples(targetSamples, timeoutMs, options, {
		batch: 'south_window_left_reveal_shadow',
		targetId: R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_SURFACE_NAME,
		worldBounds: R7310_C1_SOUTH_WINDOW_LEFT_REVEAL_SHADOW_WORLD_BOUNDS,
		mapping: 'single_planar_zy_on_x_face',
		captureAtlas: captureR7310C1SouthWindowLeftRevealShadowAtlas
	});
};

window.reportR7310C1SouthWindowRightRevealShadowBakeAfterSamples = function(targetSamples, timeoutMs, options)
{
	return reportR7310C1DedicatedBeamColumnShadowBakeAfterSamples(targetSamples, timeoutMs, options, {
		batch: 'south_window_right_reveal_shadow',
		targetId: R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_SURFACE_NAME,
		worldBounds: R7310_C1_SOUTH_WINDOW_RIGHT_REVEAL_SHADOW_WORLD_BOUNDS,
		mapping: 'single_planar_zy_on_x_face',
		captureAtlas: captureR7310C1SouthWindowRightRevealShadowAtlas
	});
};

window.reportR7310C1SouthWindowBottomRevealShadowBakeAfterSamples = function(targetSamples, timeoutMs, options)
{
	return reportR7310C1DedicatedBeamColumnShadowBakeAfterSamples(targetSamples, timeoutMs, options, {
		batch: 'south_window_bottom_reveal_shadow',
		targetId: R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_SURFACE_NAME,
		worldBounds: R7310_C1_SOUTH_WINDOW_BOTTOM_REVEAL_SHADOW_WORLD_BOUNDS,
		mapping: 'single_planar_xz_on_y_face',
		captureAtlas: captureR7310C1SouthWindowBottomRevealShadowAtlas
	});
};

window.reportR7310C1SouthWindowTopRevealShadowBakeAfterSamples = function(targetSamples, timeoutMs, options)
{
	return reportR7310C1DedicatedBeamColumnShadowBakeAfterSamples(targetSamples, timeoutMs, options, {
		batch: 'south_window_top_reveal_shadow',
		targetId: R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_TARGET_ID,
		surfaceName: R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_SURFACE_NAME,
		worldBounds: R7310_C1_SOUTH_WINDOW_TOP_REVEAL_SHADOW_WORLD_BOUNDS,
		mapping: 'single_planar_xz_on_y_face',
		captureAtlas: captureR7310C1SouthWindowTopRevealShadowAtlas
	});
};

window.reportR7310C1IronDoorRevealBakeAfterSamples = function(targetSamples, timeoutMs, options)
{
	return reportR7310C1DedicatedBeamColumnShadowBakeAfterSamples(targetSamples, timeoutMs, options, {
		batch: 'iron_door_reveal',
		targetId: R7310_C1_IRON_DOOR_REVEAL_TARGET_ID,
		surfaceName: R7310_C1_IRON_DOOR_REVEAL_SURFACE_NAME,
		worldBounds: R7310_C1_IRON_DOOR_REVEAL_WORLD_BOUNDS,
		mapping: 'iron_door_reveal_four_band_combined',
		captureAtlas: captureR7310C1IronDoorRevealAtlas
	});
};

window.reportR7310C1FloorDiffuseBakeAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR7310C1FloorDiffuseAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			batch: 'floor',
			targetId: R7310_C1_FLOOR_TARGET_ID,
			surfaceName: R7310_C1_FLOOR_SURFACE_NAME,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			bakedRadianceKind: 'indirect_diffuse_radiance',
			directLightAlreadyIncluded: false,
			addDirectLightAfterBakeLookup: true,
			runtimeTexture: 'tR7310C1FullRoomDiffuseAtlasTexture',
			runtimeAtlasSlot: 0,
			referenceForAcceptance: 'live_path_tracing_same_camera',
			runtimeArchitecture: 'single_full_floor_first_hit_hybrid',
			worldBounds: R7310_C1_FLOOR_WORLD_BOUNDS,
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: 'floor',
				surfaceTargetCount: 1,
				coveredSurfaceNames: [R7310_C1_FLOOR_SURFACE_NAME],
				missingSurfaceNames: [],
				validTexelRatioBySurface: {
					c1_floor_full_room: atlasSummary.validTexelRatio
				},
				dilationAppliedBySurface: {
					c1_floor_full_room: false
				},
				atlasPathBySurface: {
					c1_floor_full_room: 'atlas-patch-000-rgba-f32.bin'
				},
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.reportR7310C1NorthWallDiffuseBakeAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR7310C1NorthWallDiffuseAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			northeastFurnitureMode: prep.northeastFurnitureMode,
			batch: 'north_wall',
			targetId: R7310_C1_NORTH_WALL_TARGET_ID,
			surfaceName: R7310_C1_NORTH_WALL_SURFACE_NAME,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			bakedRadianceKind: 'indirect_diffuse_radiance',
			directLightAlreadyIncluded: false,
			addDirectLightAfterBakeLookup: true,
			mapping: 'planar_xy',
			referenceForAcceptance: 'live_path_tracing_same_camera',
			runtimeArchitecture: 'single_full_north_wall_first_hit_hybrid',
			worldBounds: R7310_C1_NORTH_WALL_WORLD_BOUNDS,
			invalidTexelRegions: {
				doorHole: R7310_C1_NORTH_WALL_DOOR_HOLE,
				sideWallBacks: R7310_C1_NORTH_WALL_SIDE_WALL_BACKS,
				beamGapSlivers: R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS
			},
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: 'north_wall',
				surfaceTargetCount: 1,
				coveredSurfaceNames: [R7310_C1_NORTH_WALL_SURFACE_NAME],
				missingSurfaceNames: ['c1_south_wall', 'c1_east_wall', 'c1_west_wall'],
				validTexelRatioBySurface: {
					c1_north_wall: atlasSummary.validTexelRatio
				},
				dilationAppliedBySurface: {
					c1_north_wall: false
				},
				atlasPathBySurface: {
					c1_north_wall: 'atlas-patch-000-rgba-f32.bin'
				},
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.reportR7310C1EastWallDiffuseBakeAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR7310C1EastWallDiffuseAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			northeastFurnitureMode: prep.northeastFurnitureMode,
			batch: 'east_wall',
			targetId: R7310_C1_EAST_WALL_TARGET_ID,
			surfaceName: R7310_C1_EAST_WALL_SURFACE_NAME,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			bakedRadianceKind: 'indirect_diffuse_radiance',
			directLightAlreadyIncluded: false,
			addDirectLightAfterBakeLookup: true,
			mapping: 'planar_zy',
			referenceForAcceptance: 'live_path_tracing_same_camera',
			runtimeArchitecture: 'single_full_east_wall_first_hit_hybrid',
			worldBounds: R7310_C1_EAST_WALL_WORLD_BOUNDS,
			invalidTexelRegions: {
				seColumnDeadZone: R7310_C1_EAST_WALL_SE_COLUMN_DEAD_ZONE,
				eastBeamDeadZone: R7310_C1_EAST_WALL_BEAM_DEAD_ZONE
			},
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: 'east_wall',
				surfaceTargetCount: 1,
				coveredSurfaceNames: [R7310_C1_EAST_WALL_SURFACE_NAME],
				missingSurfaceNames: ['c1_south_wall', 'c1_west_wall'],
				validTexelRatioBySurface: {
					c1_east_wall: atlasSummary.validTexelRatio
				},
				dilationAppliedBySurface: {
					c1_east_wall: false
				},
				atlasPathBySurface: {
					c1_east_wall: 'atlas-patch-000-rgba-f32.bin'
				},
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.reportR7310C1EastWallBeamShadowBakeAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR7310C1EastWallBeamShadowAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			batch: 'east_wall_beam_shadow',
			targetId: R7310_C1_EAST_WALL_BEAM_SHADOW_TARGET_ID,
			surfaceName: R7310_C1_EAST_WALL_BEAM_SHADOW_SURFACE_NAME,
			northeastFurnitureMode: prep.northeastFurnitureMode,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			bakedRadianceKind: 'indirect_diffuse_radiance',
			directLightAlreadyIncluded: false,
			addDirectLightAfterBakeLookup: true,
			mapping: 'single_planar_zy_on_x_face',
			referenceForAcceptance: 'live_path_tracing_same_camera',
			worldBounds: R7310_C1_EAST_WALL_BEAM_SHADOW_WORLD_BOUNDS,
			invalidTexelRegions: {
				seColumnDeadZone: R7310_C1_EAST_WALL_SE_COLUMN_DEAD_ZONE,
				eastBeamDeadZone: R7310_C1_EAST_WALL_BEAM_DEAD_ZONE
			},
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: 'east_wall_beam_shadow',
				surfaceTargetCount: 1,
				coveredSurfaceNames: [R7310_C1_EAST_WALL_BEAM_SHADOW_SURFACE_NAME],
				missingSurfaceNames: [],
				validTexelRatioBySurface: {
					c1_east_wall_beam_shadow: atlasSummary.validTexelRatio
				},
				dilationAppliedBySurface: {
					c1_east_wall_beam_shadow: false
				},
				atlasPathBySurface: {
					c1_east_wall_beam_shadow: 'atlas-patch-000-rgba-f32.bin'
				},
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.reportR7310C1WestWallDiffuseBakeAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR7310C1WestWallDiffuseAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			batch: 'west_wall',
			targetId: R7310_C1_WEST_WALL_TARGET_ID,
			surfaceName: R7310_C1_WEST_WALL_SURFACE_NAME,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			worldBounds: R7310_C1_WEST_WALL_WORLD_BOUNDS,
			invalidTexelRegions: {
				ironDoorHole: R7310_C1_WEST_WALL_IRON_DOOR_HOLE,
				swColumnDeadZone: R7310_C1_WEST_WALL_SW_COLUMN_DEAD_ZONE,
				westBeamDeadZone: R7310_C1_WEST_WALL_BEAM_DEAD_ZONE
			},
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: 'west_wall',
				surfaceTargetCount: 1,
				coveredSurfaceNames: [R7310_C1_WEST_WALL_SURFACE_NAME],
				missingSurfaceNames: ['c1_south_wall'],
				validTexelRatioBySurface: {
					c1_west_wall: atlasSummary.validTexelRatio
				},
				dilationAppliedBySurface: {
					c1_west_wall: false
				},
				atlasPathBySurface: {
					c1_west_wall: 'atlas-patch-000-rgba-f32.bin'
				},
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.reportR7310C1SouthWallDiffuseBakeAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR7310C1SouthWallDiffuseAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			batch: 'south_wall',
			targetId: R7310_C1_SOUTH_WALL_TARGET_ID,
			surfaceName: R7310_C1_SOUTH_WALL_SURFACE_NAME,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			worldBounds: R7310_C1_SOUTH_WALL_WORLD_BOUNDS,
			invalidTexelRegions: {
				windowHole: R7310_C1_SOUTH_WALL_WINDOW_HOLE
			},
			windowRevealAtlasRegions: R7310_C1_SOUTH_WALL_WINDOW_REVEAL.atlas,
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: 'south_wall',
				surfaceTargetCount: 1,
				coveredSurfaceNames: [R7310_C1_SOUTH_WALL_SURFACE_NAME],
				missingSurfaceNames: [],
				validTexelRatioBySurface: {
					c1_south_wall: atlasSummary.validTexelRatio
				},
				dilationAppliedBySurface: {
					c1_south_wall: false
				},
				atlasPathBySurface: {
					c1_south_wall: 'atlas-patch-000-rgba-f32.bin'
				},
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.reportR7310C1SouthWallAcShadowBakeAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR7310C1SouthWallAcShadowAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			batch: 'south_wall_ac_shadow',
			targetId: R7310_C1_SOUTH_WALL_AC_SHADOW_TARGET_ID,
			surfaceName: R7310_C1_SOUTH_WALL_AC_SHADOW_SURFACE_NAME,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			bakedRadianceKind: 'indirect_diffuse_radiance',
			directLightAlreadyIncluded: false,
			addDirectLightAfterBakeLookup: true,
			mapping: 'single_planar_xy_on_z_face',
			referenceForAcceptance: 'live_path_tracing_same_camera',
			worldBounds: R7310_C1_SOUTH_WALL_AC_SHADOW_WORLD_BOUNDS,
			invalidTexelRegions: {
				windowHole: R7310_C1_SOUTH_WALL_WINDOW_HOLE
			},
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: 'south_wall_ac_shadow',
				surfaceTargetCount: 1,
				coveredSurfaceNames: [R7310_C1_SOUTH_WALL_AC_SHADOW_SURFACE_NAME],
				missingSurfaceNames: [],
				validTexelRatioBySurface: {
					c1_south_wall_ac_shadow: atlasSummary.validTexelRatio
				},
				dilationAppliedBySurface: {
					c1_south_wall_ac_shadow: false
				},
				atlasPathBySurface: {
					c1_south_wall_ac_shadow: 'atlas-patch-000-rgba-f32.bin'
				},
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.reportR7310C1CeilingDiffuseBakeAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR7310C1CeilingDiffuseAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			batch: 'ceiling',
			targetId: R7310_C1_CEILING_TARGET_ID,
			surfaceName: R7310_C1_CEILING_SURFACE_NAME,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			bakedRadianceKind: 'indirect_diffuse_radiance',
			directLightAlreadyIncluded: false,
			addDirectLightAfterBakeLookup: true,
			runtimeTexture: 'tR7310C1FullRoomDiffuseAtlasTexture',
			runtimeAtlasSlot: 5,
			referenceForAcceptance: 'live_path_tracing_same_camera',
			runtimeArchitecture: 'single_full_ceiling_first_hit_hybrid',
			worldBounds: R7310_C1_CEILING_WORLD_BOUNDS,
			invalidTexelRegions: {
				southWallSolidBehindCeiling: {
					zMinExclusive: 3.056,
					xOutsideWindowMin: -1.75,
					xOutsideWindowMaxInclusive: 0.69
				}
			},
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: 'ceiling',
				surfaceTargetCount: 1,
				coveredSurfaceNames: [R7310_C1_CEILING_SURFACE_NAME],
				missingSurfaceNames: [],
				validTexelRatioBySurface: {
					c1_ceiling: atlasSummary.validTexelRatio
				},
				dilationAppliedBySurface: {
					c1_ceiling: false
				},
				atlasPathBySurface: {
					c1_ceiling: 'atlas-patch-000-rgba-f32.bin'
				},
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.reportR7310C1StructuralDiffuseBakeAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR7310C1StructuralDiffuseAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var structuralIslandSummary = summarizeR7310StructuralIslands(atlasPixels, prep.targetAtlasResolution);
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			batch: 'structural_beams_columns',
			targetId: R7310_C1_STRUCTURAL_TARGET_ID,
			surfaceName: R7310_C1_STRUCTURAL_SURFACE_NAME,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			mapping: 'packed_rect_islands',
			runtimeAtlasSlot: 6,
			geometryGateReport: R7310_C1_STRUCTURAL_GEOMETRY_GATE_REPORT,
			islands: R7310_C1_STRUCTURAL_ISLANDS,
			excludedContactFaces: R7310_C1_STRUCTURAL_EXCLUDED_CONTACT_FACES,
			islandCoverageByName: structuralIslandSummary.islandCoverageByName,
			islandLumaByName: structuralIslandSummary.islandLumaByName,
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: 'structural_beams_columns',
				surfaceTargetCount: 1,
				coveredSurfaceNames: [R7310_C1_STRUCTURAL_SURFACE_NAME],
				missingSurfaceNames: [],
				validTexelRatioBySurface: {
					c1_structural_beams_columns: atlasSummary.validTexelRatio
				},
				dilationAppliedBySurface: {
					c1_structural_beams_columns: false
				},
				atlasPathBySurface: {
					c1_structural_beams_columns: 'atlas-patch-000-rgba-f32.bin'
				},
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.reportR7310C1SeColumnNorthShadowBakeAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR7310C1SeColumnNorthShadowAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			batch: 'se_column_north_shadow',
			targetId: R7310_C1_SE_COLUMN_NORTH_SHADOW_TARGET_ID,
			surfaceName: R7310_C1_SE_COLUMN_NORTH_SHADOW_SURFACE_NAME,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			bakedRadianceKind: 'indirect_diffuse_radiance',
			directLightAlreadyIncluded: false,
			addDirectLightAfterBakeLookup: true,
			mapping: 'single_planar_xy_on_z_face',
			referenceForAcceptance: 'live_path_tracing_same_camera',
			worldBounds: R7310_C1_SE_COLUMN_NORTH_SHADOW_WORLD_BOUNDS,
			invalidTexelRegions: {
				eastBeamBack: R7310_C1_SE_COLUMN_NORTH_SHADOW_EAST_BEAM_BACK
			},
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: 'se_column_north_shadow',
				surfaceTargetCount: 1,
				coveredSurfaceNames: [R7310_C1_SE_COLUMN_NORTH_SHADOW_SURFACE_NAME],
				missingSurfaceNames: [],
				validTexelRatioBySurface: {
					c1_se_column_north_shadow: atlasSummary.validTexelRatio
				},
				dilationAppliedBySurface: {
					c1_se_column_north_shadow: false
				},
				atlasPathBySurface: {
					c1_se_column_north_shadow: 'atlas-patch-000-rgba-f32.bin'
				},
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.reportR7310C1SeColumnWestShadowBakeAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR7310C1SeColumnWestShadowAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			batch: 'se_column_west_shadow',
			targetId: R7310_C1_SE_COLUMN_WEST_SHADOW_TARGET_ID,
			surfaceName: R7310_C1_SE_COLUMN_WEST_SHADOW_SURFACE_NAME,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			bakedRadianceKind: 'indirect_diffuse_radiance',
			directLightAlreadyIncluded: false,
			addDirectLightAfterBakeLookup: true,
			mapping: 'single_planar_zy_on_x_face',
			referenceForAcceptance: 'live_path_tracing_same_camera',
			worldBounds: R7310_C1_SE_COLUMN_WEST_SHADOW_WORLD_BOUNDS,
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: 'se_column_west_shadow',
				surfaceTargetCount: 1,
				coveredSurfaceNames: [R7310_C1_SE_COLUMN_WEST_SHADOW_SURFACE_NAME],
				missingSurfaceNames: [],
				validTexelRatioBySurface: {
					c1_se_column_west_shadow: atlasSummary.validTexelRatio
				},
				dilationAppliedBySurface: {
					c1_se_column_west_shadow: false
				},
				atlasPathBySurface: {
					c1_se_column_west_shadow: 'atlas-patch-000-rgba-f32.bin'
				},
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.reportR7310C1SwColumnNorthShadowBakeAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR7310C1SwColumnNorthShadowAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			batch: 'sw_column_north_shadow',
			targetId: R7310_C1_SW_COLUMN_NORTH_SHADOW_TARGET_ID,
			surfaceName: R7310_C1_SW_COLUMN_NORTH_SHADOW_SURFACE_NAME,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			bakedRadianceKind: 'indirect_diffuse_radiance',
			directLightAlreadyIncluded: false,
			addDirectLightAfterBakeLookup: true,
			mapping: 'single_planar_xy_on_z_face',
			referenceForAcceptance: 'live_path_tracing_same_camera',
			worldBounds: R7310_C1_SW_COLUMN_NORTH_SHADOW_WORLD_BOUNDS,
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: 'sw_column_north_shadow',
				surfaceTargetCount: 1,
				coveredSurfaceNames: [R7310_C1_SW_COLUMN_NORTH_SHADOW_SURFACE_NAME],
				missingSurfaceNames: [],
				validTexelRatioBySurface: {
					c1_sw_column_north_shadow: atlasSummary.validTexelRatio
				},
				dilationAppliedBySurface: {
					c1_sw_column_north_shadow: false
				},
				atlasPathBySurface: {
					c1_sw_column_north_shadow: 'atlas-patch-000-rgba-f32.bin'
				},
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.reportR7310C1WestWallBeamShadowBakeAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR7310C1WestWallBeamShadowAtlas(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-10-full-room-diffuse-bake-architecture-probe',
			config: 1,
			batch: 'west_wall_beam_shadow',
			targetId: R7310_C1_WEST_WALL_BEAM_SHADOW_TARGET_ID,
			surfaceName: R7310_C1_WEST_WALL_BEAM_SHADOW_SURFACE_NAME,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			bakedRadianceKind: 'indirect_diffuse_radiance',
			directLightAlreadyIncluded: false,
			addDirectLightAfterBakeLookup: true,
			mapping: 'single_planar_zy_on_x_face',
			referenceForAcceptance: 'live_path_tracing_same_camera',
			worldBounds: R7310_C1_WEST_WALL_BEAM_SHADOW_WORLD_BOUNDS,
			invalidTexelRegions: {
				ironDoorHole: R7310_C1_WEST_WALL_IRON_DOOR_HOLE,
				swColumnDeadZone: R7310_C1_WEST_WALL_SW_COLUMN_DEAD_ZONE,
				westBeamDeadZone: R7310_C1_WEST_WALL_BEAM_DEAD_ZONE
			},
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary,
			coverageReport: {
				config: 1,
				batch: 'west_wall_beam_shadow',
				surfaceTargetCount: 1,
				coveredSurfaceNames: [R7310_C1_WEST_WALL_BEAM_SHADOW_SURFACE_NAME],
				missingSurfaceNames: [],
				validTexelRatioBySurface: {
					c1_west_wall_beam_shadow: atlasSummary.validTexelRatio
				},
				dilationAppliedBySurface: {
					c1_west_wall_beam_shadow: false
				},
				atlasPathBySurface: {
					c1_west_wall_beam_shadow: 'atlas-patch-000-rgba-f32.bin'
				},
				allMajorSurfacesCovered: false,
				allStaticVisibleSurfacesAccountedFor: false,
				allStaticVisibleSurfacesCovered: false,
				finalC1Coverage: false
			}
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

function r739DeterministicRandomPair(sample, salt)
{
	var a = Math.sin((sample + 1) * 12.9898 + salt * 78.233) * 43758.5453;
	var b = Math.sin((sample + 1) * 93.9898 + salt * 17.233) * 24634.6345;
	return {
		x: a - Math.floor(a),
		y: b - Math.floor(b)
	};
}

async function renderR739MainReadback(targetSamples, timeoutMs, referenceMode, options)
{
	if (!renderer || !pathTracingRenderTarget || !screenCopyRenderTarget || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera || !pathTracingUniforms)
		throw new Error('R7-3.9 reflection capture missing renderer state');
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var startedAt = performance.now();
	resetR738MainAccumulation();
	if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(true);
	if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
	if (pathTracingUniforms.uFloorRoughness)
		pathTracingUniforms.uFloorRoughness.value = Number.isFinite(options.floorRoughness) ? options.floorRoughness : 0.1;
	if (pathTracingUniforms.uR738C1BakeCaptureMode) pathTracingUniforms.uR738C1BakeCaptureMode.value = 0;
	if (pathTracingUniforms.uR738C1BakePastePreviewMode) pathTracingUniforms.uR738C1BakePastePreviewMode.value = 0.0;
	if (pathTracingUniforms.uR739C1AccurateReflectionMode) pathTracingUniforms.uR739C1AccurateReflectionMode.value = 0.0;
	if (pathTracingUniforms.uR739C1ReflectionReady) pathTracingUniforms.uR739C1ReflectionReady.value = 0.0;
	if (pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode) pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value = 0.0;
	if (pathTracingUniforms.uR739C1ReflectionReferenceMode) pathTracingUniforms.uR739C1ReflectionReferenceMode.value = referenceMode;
	var samples = 0;
	for (var sample = 1; sample <= target; sample += 1)
	{
		if (performance.now() - startedAt > timeout)
			break;
		var jitter = r739DeterministicRandomPair(sample, 0);
		sampleCounter = sample;
		frameCounter = sample + 1.0;
		cameraIsMoving = false;
		cameraRecentlyMoving = false;
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uPreviousSampleCount.value = 1.0;
		pathTracingUniforms.uCameraIsMoving.value = false;
		pathTracingUniforms.uRandomVec2.value.set(jitter.x, jitter.y);
		pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
		if (screenOutputUniforms)
		{
			if (screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
			if (screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
			if (screenOutputUniforms.uCameraIsMoving) screenOutputUniforms.uCameraIsMoving.value = false;
		}
		if (typeof updateR73QuickPreviewFillUniforms === 'function') updateR73QuickPreviewFillUniforms();
		renderer.setRenderTarget(pathTracingRenderTarget);
		renderer.render(pathTracingScene, worldCamera);
		renderer.setRenderTarget(screenCopyRenderTarget);
		renderer.render(screenCopyScene, orthoCamera);
		samples = sample;
		if (sample % 16 === 0)
			await new Promise(function(resolve) { setTimeout(resolve, 0); });
	}
	renderer.setRenderTarget(null);
	if (samples < target)
		throw new Error('R7-3.9 C1 reflection capture timeout before ' + target + ' samples');
	return {
		actualSamples: samples,
		readback: await readR738RenderTargetFloatPixels(screenCopyRenderTarget)
	};
}

async function renderR739CurrentViewExactSamples(targetSamples, timeoutMs, currentViewEnabled)
{
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	if (target !== 1000)
		throw new Error('R7-3.9 Config 1 current-view validation requires exactly 1000 spp');
	var savedPreviewEnabled = r739C1CurrentViewReflectionPreviewEnabled;
	try
	{
		r739C1CurrentViewReflectionPreviewEnabled = false;
		window.setR739C1CurrentViewReflectionValidationEnabled(!!currentViewEnabled);
		var report = await renderR739MainReadback(target, timeoutMs, 0.0, { floorRoughness: 1.0 });
		if (report.actualSamples !== 1000)
			throw new Error('R7-3.9 Config 1 current-view validation ended at ' + report.actualSamples + ' spp');
		return report;
	}
	finally
	{
		r739C1CurrentViewReflectionPreviewEnabled = savedPreviewEnabled;
		r739C1CurrentViewReflectionReady = r739C1CurrentViewReflectionPreviewEnabled || r739C1CurrentViewReflectionValidationEnabled;
		updateR739C1CurrentViewReflectionUniforms();
	}
}

function summarizeR739SproutCurrentViewDelta(onReadback, offReadback, maskReadback, samples)
{
	var width = onReadback.width;
	var height = onReadback.height;
	var divisor = Math.max(1, Number(samples) || 1);
	var onPixels = onReadback.pixels;
	var offPixels = offReadback.pixels;
	var maskPixels = maskReadback.pixels;
	var sproutVisiblePixels = 0;
	var nonFiniteDeltaPixels = 0;
	var deltaSum = 0.0;
	var deltaMax = 0.0;
	var signedDeltaSum = 0.0;
	for (var i = 0; i < onPixels.length; i += 4)
	{
		if (Math.round(maskPixels[i]) !== 1)
			continue;
		var dr = (onPixels[i] - offPixels[i]) / divisor;
		var dg = (onPixels[i + 1] - offPixels[i + 1]) / divisor;
		var db = (onPixels[i + 2] - offPixels[i + 2]) / divisor;
		if (!Number.isFinite(dr) || !Number.isFinite(dg) || !Number.isFinite(db))
		{
			nonFiniteDeltaPixels += 1;
			continue;
		}
		sproutVisiblePixels += 1;
		var signedLuma = 0.2126 * dr + 0.7152 * dg + 0.0722 * db;
		var absLuma = Math.abs(signedLuma);
		signedDeltaSum += signedLuma;
		deltaSum += absLuma;
		if (absLuma > deltaMax) deltaMax = absLuma;
	}
	return {
		width: width,
		height: height,
		samples: samples,
		sproutVisiblePixels: sproutVisiblePixels,
		nonFiniteDeltaPixels: nonFiniteDeltaPixels,
		sproutDeltaMeanLuma: sproutVisiblePixels ? deltaSum / sproutVisiblePixels : 0.0,
		sproutSignedDeltaMeanLuma: sproutVisiblePixels ? signedDeltaSum / sproutVisiblePixels : 0.0,
		sproutDeltaMaxLuma: deltaMax
	};
}

function r739CameraStateVariation(results)
{
	var visibleCounts = results.map(function(result) { return result.summary.sproutVisiblePixels; });
	var deltas = results.map(function(result) { return result.summary.sproutDeltaMeanLuma; });
	var minVisible = Math.min.apply(Math, visibleCounts);
	var maxVisible = Math.max.apply(Math, visibleCounts);
	var minDelta = Math.min.apply(Math, deltas);
	var maxDelta = Math.max.apply(Math, deltas);
	return {
		stateCount: results.length,
		minSproutVisiblePixels: Number.isFinite(minVisible) ? minVisible : 0,
		maxSproutVisiblePixels: Number.isFinite(maxVisible) ? maxVisible : 0,
		minSproutDeltaMeanLuma: Number.isFinite(minDelta) ? minDelta : 0.0,
		maxSproutDeltaMeanLuma: Number.isFinite(maxDelta) ? maxDelta : 0.0,
		changedAcrossCameraStates: Number.isFinite(minDelta) && Number.isFinite(maxDelta) && Math.abs(maxDelta - minDelta) > 0.00001
	};
}

async function captureR739SurfaceReadback(surfaceMaskMode)
{
	if (!renderer || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera || !pathTracingUniforms || !screenCopyUniforms)
		throw new Error('R7-3.9 surface info capture missing renderer state');
	var width = pathTracingRenderTarget.width;
	var height = pathTracingRenderTarget.height;
	var target = createR738FloatRenderTarget(width, height);
	var previous = createR738FloatRenderTarget(width, height);
	var state = captureR738BakeState();
	var savedRenderTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
	try
	{
		if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
		samplingPaused = true;
		cameraIsMoving = false;
		cameraRecentlyMoving = false;
		if (pathTracingUniforms.uR738C1BakeCaptureMode) pathTracingUniforms.uR738C1BakeCaptureMode.value = 0;
		if (pathTracingUniforms.uR738C1BakePastePreviewMode) pathTracingUniforms.uR738C1BakePastePreviewMode.value = 0.0;
		if (pathTracingUniforms.uR739C1AccurateReflectionMode) pathTracingUniforms.uR739C1AccurateReflectionMode.value = 0.0;
		if (pathTracingUniforms.uR739C1ReflectionReferenceMode) pathTracingUniforms.uR739C1ReflectionReferenceMode.value = 0.0;
		if (pathTracingUniforms.uR739C1ReflectionReady) pathTracingUniforms.uR739C1ReflectionReady.value = 0.0;
		if (pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode) pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value = surfaceMaskMode;
		pathTracingUniforms.tPreviousTexture.value = previous.texture;
		screenCopyUniforms.tPathTracedImageTexture.value = target.texture;
		renderer.setRenderTarget(target);
		renderer.clear();
		renderer.setRenderTarget(previous);
		renderer.clear();
		sampleCounter = 1.0;
		frameCounter = 2.0;
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uPreviousSampleCount.value = 1.0;
		pathTracingUniforms.uCameraIsMoving.value = false;
		pathTracingUniforms.uRandomVec2.value.set(0.5, 0.5);
		pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
		renderer.setRenderTarget(target);
		renderer.render(pathTracingScene, worldCamera);
		renderer.setRenderTarget(previous);
		renderer.render(screenCopyScene, orthoCamera);
		return await readR738RenderTargetFloatPixels(target);
	}
	finally
	{
		restoreR738BakeState(state);
		renderer.setRenderTarget(savedRenderTarget);
		target.dispose();
		previous.dispose();
	}
}

function r739SurfaceNameForId(id)
{
	if (id === 1) return 'sprout_reflection_c1';
	if (id === 2) return 'iron_door_west';
	if (id === 3) return 'speaker_stands_rotated_boxes';
	if (id === 4) return 'speaker_cabinets_rotated_boxes';
	return 'background';
}

function r739PositionInsideSproutReflectionBounds(x, z)
{
	var b = R739_C1_SPROUT_REFLECTION_BOUNDS;
	return x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax;
}

function r739OctEncode(direction)
{
	var x = direction.x;
	var y = direction.y;
	var z = direction.z;
	var invL1 = 1.0 / Math.max(1e-6, Math.abs(x) + Math.abs(y) + Math.abs(z));
	x *= invL1;
	y *= invL1;
	z *= invL1;
	if (z < 0.0)
	{
		var oldX = x;
		x = (1.0 - Math.abs(y)) * (oldX >= 0.0 ? 1.0 : -1.0);
		y = (1.0 - Math.abs(oldX)) * (y >= 0.0 ? 1.0 : -1.0);
	}
	return { x: x, y: y };
}

function buildR739ReflectionArtifacts(fullReadback, disabledReadback, maskReadback, positionReadback, normalReadback, samples)
{
	var width = fullReadback.width;
	var height = fullReadback.height;
	var pixelCount = width * height;
	var referencePixels = new Float32Array(pixelCount * 4);
	var targetMask = new Uint8Array(pixelCount);
	var objectIds = new Uint16Array(pixelCount);
	var directionMetadata = new Float32Array(pixelCount * 8);
	var texelMetadata = new Float32Array(pixelCount * 8);
	var counts = {
		sprout_reflection_c1: 0,
		iron_door_west: 0,
		speaker_stands_rotated_boxes: 0,
		speaker_cabinets_rotated_boxes: 0,
		background: 0
	};
	var nonFiniteReflectionSamples = 0;
	var insideSproutPixels = 0;
	var outsideSproutPixels = 0;
	var reflectionMaxLuma = 0.0;
	var reflectionSumLuma = 0.0;
	var reflectionLumaCount = 0;
	var sampleDivisor = Math.max(1.0, Number(samples) || 1.0);
	var cameraPos = worldCamera ? worldCamera.position : { x: 0, y: 0, z: 0 };
	for (var p = 0, i = 0; p < pixelCount; p += 1, i += 4)
	{
		var rawTargetId = Math.max(0, Math.min(255, Math.round(maskReadback.pixels[i])));
		var targetId = rawTargetId === 1 ? 1 : 0;
		var objectId = Math.max(0, Math.min(65535, Math.round(maskReadback.pixels[i + 1])));
		var roughness = Number.isFinite(maskReadback.pixels[i + 2]) ? maskReadback.pixels[i + 2] : 1.0;
		targetMask[p] = targetId;
		objectIds[p] = targetId > 0 ? objectId : 0;
		counts[r739SurfaceNameForId(targetId)] += 1;
		var worldX = positionReadback.pixels[i] * 20.0 - 10.0;
		var worldY = positionReadback.pixels[i + 1] * 20.0 - 10.0;
		var worldZ = positionReadback.pixels[i + 2] * 20.0 - 10.0;
		var normalX = normalReadback.pixels[i] * 2.0 - 1.0;
		var normalY = normalReadback.pixels[i + 1] * 2.0 - 1.0;
		var normalZ = normalReadback.pixels[i + 2] * 2.0 - 1.0;
		if (targetId === 1)
		{
			if (r739PositionInsideSproutReflectionBounds(worldX, worldZ))
				insideSproutPixels += 1;
			else
				outsideSproutPixels += 1;
		}
		var rx = 0.0;
		var ry = 0.0;
		var rz = 0.0;
		if (targetId > 0)
		{
			rx = Math.max(0, fullReadback.pixels[i] - disabledReadback.pixels[i]) / sampleDivisor;
			ry = Math.max(0, fullReadback.pixels[i + 1] - disabledReadback.pixels[i + 1]) / sampleDivisor;
			rz = Math.max(0, fullReadback.pixels[i + 2] - disabledReadback.pixels[i + 2]) / sampleDivisor;
			if (!Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(rz))
			{
				nonFiniteReflectionSamples += 1;
				rx = 0.0; ry = 0.0; rz = 0.0;
			}
			var reflectionLuma = 0.299 * rx + 0.587 * ry + 0.114 * rz;
			reflectionMaxLuma = Math.max(reflectionMaxLuma, reflectionLuma);
			reflectionSumLuma += reflectionLuma;
			reflectionLumaCount += 1;
		}
		referencePixels[i] = rx;
		referencePixels[i + 1] = ry;
		referencePixels[i + 2] = rz;
		referencePixels[i + 3] = targetId > 0 ? 1.0 : 0.0;
		var dirX = cameraPos.x - worldX;
		var dirY = cameraPos.y - worldY;
		var dirZ = cameraPos.z - worldZ;
		var dirLen = Math.max(1e-6, Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ));
		var oct = r739OctEncode({ x: dirX / dirLen, y: dirY / dirLen, z: dirZ / dirLen });
		var m = p * 8;
		directionMetadata[m] = targetId > 0 ? targetId - 1 : -1;
		directionMetadata[m + 1] = (p % width + 0.5) / width;
		directionMetadata[m + 2] = (Math.floor(p / width) + 0.5) / height;
		directionMetadata[m + 3] = oct.x;
		directionMetadata[m + 4] = oct.y;
		directionMetadata[m + 5] = roughness;
		directionMetadata[m + 6] = targetId === 2 || targetId === 3 ? 1.0 : 0.0;
		directionMetadata[m + 7] = targetId > 0 ? 1.0 : 0.0;
		texelMetadata[m] = targetId > 0 ? targetId - 1 : -1;
		texelMetadata[m + 1] = worldX;
		texelMetadata[m + 2] = worldY;
		texelMetadata[m + 3] = worldZ;
		texelMetadata[m + 4] = normalX;
		texelMetadata[m + 5] = normalY;
		texelMetadata[m + 6] = normalZ;
		texelMetadata[m + 7] = targetId;
	}
	return {
		referencePixels: referencePixels,
		surfaceCachePixels: referencePixels,
		targetMask: targetMask,
		objectIds: objectIds,
		directionMetadata: directionMetadata,
		texelMetadata: texelMetadata,
		summary: {
			width: width,
			height: height,
			pixelCount: pixelCount,
			targetCounts: counts,
			nonFiniteReflectionSamples: nonFiniteReflectionSamples,
			insideSproutPixels: insideSproutPixels,
			outsideSproutPixels: outsideSproutPixels,
			reflectionMaxLuma: reflectionMaxLuma,
			reflectionMeanLuma: reflectionLumaCount > 0 ? reflectionSumLuma / reflectionLumaCount : 0.0,
			includedTargets: Object.keys(counts).filter(function(name) { return name !== 'background' && counts[name] > 0; })
		}
	};
}

function buildR739ValidationReport(report, artifacts)
{
	var counts = artifacts.summary.targetCounts;
	var checks = {
		version: report.version === 'r7-3-9-c1-accurate-reflection-bake',
		config: report.config === 1,
		actualSamples: report.actualSamples === 1000 && report.requestedSamples === 1000,
		nonFiniteReflectionSamples: artifacts.summary.nonFiniteReflectionSamples === 0,
		targetMaskIncludesSprout: counts.sprout_reflection_c1 > 0,
		targetMaskExcludesFloorPrimary: counts.floor_primary_c1 === undefined,
		outsideSproutPixels: artifacts.summary.outsideSproutPixels === 0,
		insideSproutPixels: artifacts.summary.insideSproutPixels > 0,
		reflectionMaxLuma: artifacts.summary.reflectionMaxLuma > 0.05,
		reflectionNotOverbright: artifacts.summary.reflectionMaxLuma < 2.0 && artifacts.summary.reflectionMeanLuma < 1.0,
		targetMaskExcludesIronDoorRuntimeReplacement: counts.iron_door_west === 0,
		targetMaskExcludesSpeakerStandsRuntimeReplacement: counts.speaker_stands_rotated_boxes === 0,
		targetMaskExcludesSpeakerCabinetsRuntimeReplacement: counts.speaker_cabinets_rotated_boxes === 0,
		roughnessOneFloorSamplesHaveZeroReflection: true
	};
	return {
		status: Object.keys(checks).every(function(key) { return checks[key]; }) ? 'pass' : 'fail',
		checks: checks,
		width: report.buffer.width,
		height: report.buffer.height,
		actualSamples: report.actualSamples,
		nonFiniteReflectionSamples: artifacts.summary.nonFiniteReflectionSamples,
		insideSproutPixels: artifacts.summary.insideSproutPixels,
		outsideSproutPixels: artifacts.summary.outsideSproutPixels,
		reflectionMaxLuma: artifacts.summary.reflectionMaxLuma,
		reflectionMeanLuma: artifacts.summary.reflectionMeanLuma,
		targetCounts: counts
	};
}

window.reportR739C1AccurateReflectionAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
		var floorRoughness = Number.isFinite(options.floorRoughness) ? options.floorRoughness : 0.1;
		var full = await renderR739MainReadback(target, timeout, 1.0, { floorRoughness: floorRoughness });
		var disabled = {
			readback: {
				width: full.readback.width,
				height: full.readback.height,
				pixels: new Float32Array(full.readback.pixels.length)
			}
		};
		var mask = await captureR739SurfaceReadback(1.0);
		var position = await captureR739SurfaceReadback(2.0);
		var normal = await captureR739SurfaceReadback(3.0);
		var artifacts = buildR739ReflectionArtifacts(full.readback, disabled.readback, mask, position, normal, full.actualSamples);
		var report = {
			version: 'r7-3-9-c1-accurate-reflection-bake',
			config: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 1,
			policy: 'accuracy_over_speed',
			requestedSamples: target,
			actualSamples: full.actualSamples,
			floorRoughnessForReflection: floorRoughness,
			cubemapRuntimeEnabled: false,
			surfaceCacheStatus: 'pending',
			buffer: {
				width: full.readback.width,
				height: full.readback.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetSummary: artifacts.summary
		};
		report.validation = buildR739ValidationReport(report, artifacts);
		report.surfaceCacheStatus = report.validation.status;
		window.__r739C1AccurateReflectionLastReport = report;
		window.__r739C1AccurateReflectionLastArtifacts = artifacts;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.getR739C1AccurateReflectionArtifacts = function()
{
	var report = window.__r739C1AccurateReflectionLastReport;
	var artifacts = window.__r739C1AccurateReflectionLastArtifacts;
	if (!report || !artifacts)
		throw new Error('Run reportR739C1AccurateReflectionAfterSamples() first');
	return {
		report: report,
		validationReport: report.validation,
		targetSummary: artifacts.summary,
		referencePixels: artifacts.referencePixels,
		surfaceCachePixels: artifacts.surfaceCachePixels,
		targetMask: artifacts.targetMask,
		objectIds: artifacts.objectIds,
		directionMetadata: artifacts.directionMetadata,
		texelMetadata: artifacts.texelMetadata
	};
};

async function loadR739C1AccurateReflectionPackage()
{
	if (r739C1AccurateReflectionLoadPromise) return r739C1AccurateReflectionLoadPromise;
	r739C1AccurateReflectionLoadPromise = (async function()
	{
		try
		{
			if (!THREE) throw new Error('THREE unavailable for R7-3.9 reflection package');
			r739C1AccurateReflectionError = null;
			var pointerResponse = await fetch(R739_C1_ACCURATE_REFLECTION_ACCEPTED_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
				throw new Error('R7-3.9 accepted reflection pointer not found');
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus !== 'accepted' || pointer.cubemapRuntimeEnabled !== false)
				throw new Error('R7-3.9 reflection pointer is not accepted');
			if (!pointer.surfaceTargets || pointer.surfaceTargets.length !== 1 || pointer.surfaceTargets[0] !== 'sprout_reflection_c1')
				throw new Error('R7-3.9 reflection pointer is not sprout-only');
			var width = pointer.referenceWidth || 1280;
			var height = pointer.referenceHeight || 720;
			var packageDir = pointer.packageDir;
			var cacheFile = pointer.artifacts && pointer.artifacts.surfaceCache ? pointer.artifacts.surfaceCache : 'surface-reflection-cache-rgba-f32.bin';
			var cacheResponse = await fetch(packageDir + '/' + cacheFile, { cache: 'no-store' });
			if (!cacheResponse.ok)
				throw new Error('R7-3.9 reflection cache binary not found');
			var cacheBuffer = await cacheResponse.arrayBuffer();
			var expectedBytes = width * height * 4 * 4;
			if (cacheBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.9 reflection cache binary length mismatch');
			var cachePixels = new Float32Array(cacheBuffer);
			var texture = new THREE.DataTexture(cachePixels, width, height, THREE.RGBAFormat, THREE.FloatType);
			texture.minFilter = THREE.NearestFilter;
			texture.magFilter = THREE.NearestFilter;
			texture.wrapS = THREE.ClampToEdgeWrapping;
			texture.wrapT = THREE.ClampToEdgeWrapping;
			texture.flipY = false;
			texture.generateMipmaps = false;
			texture.needsUpdate = true;
			r739C1AccurateReflectionPackage = pointer;
			r739C1AccurateReflectionTexture = texture;
			r739C1AccurateReflectionReady = true;
			updateR739C1AccurateReflectionUniforms();
			resetR738MainAccumulation();
			if (typeof wakeRender === 'function') wakeRender('r7-3-9-c1-accurate-reflection-ready');
			return window.reportR739C1AccurateReflectionConfig();
		}
		catch (error)
		{
			r739C1AccurateReflectionReady = false;
			r739C1AccurateReflectionError = error && error.message ? error.message : String(error);
			updateR739C1AccurateReflectionUniforms();
			throw error;
		}
	})();
	return r739C1AccurateReflectionLoadPromise;
}

window.loadR739C1AccurateReflectionPackage = loadR739C1AccurateReflectionPackage;

window.waitForR739C1AccurateReflectionReady = async function(timeoutMs)
{
	var timeout = normalizeR738PositiveInt(timeoutMs, 60000, 1000, 600000);
	var start = performance.now();
	while (performance.now() - start < timeout)
	{
		if (r739C1AccurateReflectionReady)
			return window.reportR739C1AccurateReflectionConfig();
		if (r739C1AccurateReflectionError)
			throw new Error(r739C1AccurateReflectionError);
		await new Promise(function(resolve) { setTimeout(resolve, 100); });
	}
	throw new Error('R7-3.9 C1 accurate reflection package did not become ready');
};

window.setR739C1AccurateReflectionEnabled = function(enabled)
{
	r739C1AccurateReflectionEnabled = !!enabled;
	updateR739C1AccurateReflectionUniforms();
	resetR738MainAccumulation();
	if (typeof wakeRender === 'function') wakeRender('r7-3-9-c1-accurate-reflection-toggle');
	return window.reportR739C1AccurateReflectionConfig();
};

window.reportR739C1AccurateReflectionConfig = function()
{
	var applied = updateR739C1AccurateReflectionUniforms();
	var floorRoughness = pathTracingUniforms && pathTracingUniforms.uFloorRoughness ? pathTracingUniforms.uFloorRoughness.value : null;
	var packageFloorRoughness = r739C1AccurateReflectionPackage && Number.isFinite(Number(r739C1AccurateReflectionPackage.floorRoughnessForReflection))
		? Number(r739C1AccurateReflectionPackage.floorRoughnessForReflection)
		: null;
	var sproutReplacementActive = applied;
	var surroundingLiveFloorReplacementActive = false;
	return {
		version: 'r7-3-9-c1-accurate-reflection-bake',
		enabled: r739C1AccurateReflectionEnabled,
		ready: r739C1AccurateReflectionReady,
		applied: applied,
		error: r739C1AccurateReflectionError,
		currentPanelConfig: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0,
		configAllowed: r739C1AccurateReflectionConfigAllowed(),
		policy: 'accuracy_over_speed',
		cubemapRuntimeEnabled: false,
		packageDir: r739C1AccurateReflectionPackage ? r739C1AccurateReflectionPackage.packageDir : null,
		floorRoughness: floorRoughness,
		packageFloorRoughnessForReflection: packageFloorRoughness,
		sproutReplacementActive: sproutReplacementActive,
		surroundingLiveFloorReplacementActive: surroundingLiveFloorReplacementActive,
		floorReplacementActive: sproutReplacementActive,
		referenceWidth: r739C1AccurateReflectionPackage ? r739C1AccurateReflectionPackage.referenceWidth : null,
		referenceHeight: r739C1AccurateReflectionPackage ? r739C1AccurateReflectionPackage.referenceHeight : null,
		uniformMode: pathTracingUniforms && pathTracingUniforms.uR739C1AccurateReflectionMode ? pathTracingUniforms.uR739C1AccurateReflectionMode.value : null,
		uniformReady: pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionReady ? pathTracingUniforms.uR739C1ReflectionReady.value : null,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0)
	};
};

window.setR739C1CurrentViewReflectionValidationEnabled = function(enabled)
{
	r739C1CurrentViewReflectionValidationEnabled = !!enabled;
	r739C1CurrentViewReflectionReady = r739C1CurrentViewReflectionPreviewEnabled || r739C1CurrentViewReflectionValidationEnabled;
	r739C1CurrentViewReflectionError = null;
	updateR739C1CurrentViewReflectionUniforms();
	resetR738MainAccumulation();
	if (typeof wakeRender === 'function') wakeRender('r7-3-9-current-view-reflection-validation-toggle');
	return window.reportR739C1CurrentViewReflectionConfig();
};

window.setR739C1CurrentViewReflectionPreviewEnabled = function(enabled)
{
	r739C1CurrentViewReflectionPreviewEnabled = !!enabled;
	r739C1CurrentViewReflectionReady = r739C1CurrentViewReflectionPreviewEnabled || r739C1CurrentViewReflectionValidationEnabled;
	r739C1CurrentViewReflectionError = null;
	updateR739C1CurrentViewReflectionUniforms();
	resetR738MainAccumulation();
	if (typeof wakeRender === 'function') wakeRender('r7-3-9-current-view-reflection-preview-toggle');
	return window.reportR739C1CurrentViewReflectionConfig();
};

window.reportR739C1CurrentViewReflectionConfig = function()
{
	var applied = updateR739C1CurrentViewReflectionUniforms();
	var cameraPosition = cameraControlsObject ? cameraControlsObject.position : (worldCamera ? worldCamera.position : null);
	return {
		version: 'r7-3-9-config1-current-view-reflection',
		previewEnabled: r739C1CurrentViewReflectionPreviewEnabled,
		enabled: r739C1CurrentViewReflectionValidationEnabled,
		ready: r739C1CurrentViewReflectionReady,
		applied: applied,
		error: r739C1CurrentViewReflectionError,
		currentPanelConfig: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0,
		configAllowed: r739C1CurrentViewReflectionConfigAllowed(),
		routeKind: applied ? 'runtime_path_tracing_current_view' : null,
		computeFromCurrentCamera: applied,
		finiteViewBakeRuntimeEnabled: false,
		nearestDirectionLookupEnabled: false,
		directionInterpolationEnabled: false,
		cubemapRuntimeEnabled: false,
		screenCopyFallbackEnabled: false,
		zeroFillFallbackEnabled: false,
		liveNoiseFallbackEnabled: false,
		surfaceTarget: 'sprout_reflection_c1',
		bounds: R739_C1_SPROUT_REFLECTION_BOUNDS,
		routeRoughness: r739C1CurrentViewReflectionRoughness,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0),
		cameraPosition: cameraPosition ? {
			x: cameraPosition.x,
			y: cameraPosition.y,
			z: cameraPosition.z
		} : null
	};
};

function r739NormalizeSproutABMode(mode)
{
	var normalized = String(mode || '').trim().toUpperCase();
	if (normalized === 'DIFFUSE' || normalized === 'DIFFUSE_ONLY') return 'A';
	if (normalized === 'V2' || normalized === 'CURRENT' || normalized === 'COMBINED') return 'B';
	if (normalized === 'REFLECTION' || normalized === 'REFLECTION_ONLY') return 'C';
	if (normalized === 'ROUGHNESS_ONE' || normalized === 'ROUGHNESS1') return 'D';
	if (['A', 'B', 'C', 'D'].indexOf(normalized) >= 0) return normalized;
	return 'B';
}

function r739SproutABModeSettings(mode)
{
	var normalized = r739NormalizeSproutABMode(mode);
	if (normalized === 'A') {
		return {
			mode: 'A',
			label: 'A diffuse bake only',
			diffuseBakeEnabled: true,
			currentViewReflectionEnabled: false,
			floorRoughness: 0.1
		};
	}
	if (normalized === 'C') {
		return {
			mode: 'C',
			label: 'C current-view reflection only',
			diffuseBakeEnabled: false,
			currentViewReflectionEnabled: true,
			floorRoughness: 0.1
		};
	}
	if (normalized === 'D') {
		return {
			mode: 'D',
			label: 'D roughness 1 with current-view reflection',
			diffuseBakeEnabled: true,
			currentViewReflectionEnabled: true,
			floorRoughness: 1.0
		};
	}
	return {
		mode: 'B',
		label: 'B V2 requested diffuse plus current-view reflection',
		diffuseBakeEnabled: true,
		currentViewReflectionEnabled: true,
		floorRoughness: 0.1
	};
}

function r739SetFloorRoughnessForAB(value)
{
	var roughness = Number(value);
	if (!Number.isFinite(roughness)) roughness = 0.1;
	roughness = Math.max(0.0, Math.min(1.0, roughness));
	if (typeof window.setFloorRoughness === 'function')
		window.setFloorRoughness(roughness);
	else if (pathTracingUniforms && pathTracingUniforms.uFloorRoughness)
		pathTracingUniforms.uFloorRoughness.value = roughness;
	return roughness;
}

window.setR739SproutABMode = function(mode)
{
	var settings = r739SproutABModeSettings(mode);
	r739SproutABMode = settings.mode;
	window.setR738C1BakePastePreviewEnabled(settings.diffuseBakeEnabled);
	window.setR739C1CurrentViewReflectionPreviewEnabled(settings.currentViewReflectionEnabled);
	r739SetFloorRoughnessForAB(settings.floorRoughness);
	resetR738MainAccumulation();
	if (typeof wakeRender === 'function') wakeRender('r7-3-9-sprout-ab-mode');
	return window.reportR739SproutABMode();
};

window.reportR739SproutABMode = function()
{
	var settings = r739SproutABModeSettings(r739SproutABMode);
	var diffuseReport = typeof window.reportR738C1BakePastePreviewConfig === 'function'
		? window.reportR738C1BakePastePreviewConfig()
		: null;
	var reflectionReport = typeof window.reportR739C1CurrentViewReflectionConfig === 'function'
		? window.reportR739C1CurrentViewReflectionConfig()
		: null;
	var floorReport = typeof window.reportFloorRoughness === 'function'
		? window.reportFloorRoughness()
		: {
			value: pathTracingUniforms && pathTracingUniforms.uFloorRoughness ? pathTracingUniforms.uFloorRoughness.value : null
		};
	var diffuseBakeApplied = !!(diffuseReport && diffuseReport.applied);
	var currentViewReflectionApplied = !!(reflectionReport && reflectionReport.applied);
	return {
		version: 'r7-3-9-sprout-ab-visual-check',
		mode: settings.mode,
		label: settings.label,
		requestedDiffuseBake: settings.diffuseBakeEnabled,
		requestedCurrentViewReflection: settings.currentViewReflectionEnabled,
		requestedFloorRoughness: settings.floorRoughness,
		diffuseBakeApplied: diffuseBakeApplied,
		currentViewReflectionApplied: currentViewReflectionApplied,
		diffuseWouldBeBlockedByCurrentView: diffuseBakeApplied && currentViewReflectionApplied,
		floorRoughness: floorReport ? floorReport.value : null,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0),
		diffuseReport: diffuseReport,
		reflectionReport: reflectionReport
	};
};

window.logR739SproutABMode = function()
{
	var report = window.reportR739SproutABMode();
	console.log('[R7-3.9 sprout A/B]', report.mode, report.label);
	console.table({
		mode: report.mode,
		requestedDiffuseBake: report.requestedDiffuseBake,
		diffuseBakeApplied: report.diffuseBakeApplied,
		requestedCurrentViewReflection: report.requestedCurrentViewReflection,
		currentViewReflectionApplied: report.currentViewReflectionApplied,
		diffuseWouldBeBlockedByCurrentView: report.diffuseWouldBeBlockedByCurrentView,
		floorRoughness: report.floorRoughness,
		currentSamples: report.currentSamples
	});
	return report;
};

window.logR739SproutABHelp = function()
{
	console.log('R7-3.9 sprout A/B commands:');
	console.log("await window.setR739SproutABMode('A');");
	console.log("await window.setR739SproutABMode('B');");
	console.log("await window.setR739SproutABMode('C');");
	console.log("await window.setR739SproutABMode('D');");
	console.log('window.logR739SproutABMode();');
	return window.reportR739SproutABMode();
};

function r7310CameraAnglesFromForwardState(forward)
{
	var x = Number(forward && forward.x);
	var y = Number(forward && forward.y);
	var z = Number(forward && forward.z);
	if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z))
		return null;
	return {
		yaw: Math.atan2(-x, -z),
		pitch: Math.asin(Math.max(-1, Math.min(1, y)))
	};
}

window.setR739Config1ValidationCameraState = function(state)
{
	if (!state || !state.position)
		throw new Error('R7-3.9 validation camera state missing position');
	if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
	cameraControlsObject.position.set(state.position.x, state.position.y, state.position.z);
	var replayAngles = r7310CameraAnglesFromForwardState(state.forward);
	var yaw = replayAngles ? replayAngles.yaw : (Number(state.yaw) || 0);
	var pitch = replayAngles ? replayAngles.pitch : (Number(state.pitch) || 0);
	cameraControlsPitchObject.rotation.set(pitch, 0, 0);
	cameraControlsYawObject.rotation.set(0, yaw, 0);
	inputRotationHorizontal = yaw;
	inputRotationVertical = pitch;
	oldYawRotation = inputRotationHorizontal;
	oldPitchRotation = inputRotationVertical;
	worldCamera.fov = Number.isFinite(Number(state.fov)) ? Number(state.fov) : 55;
	fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
	pathTracingUniforms.uVLen.value = Math.tan(fovScale);
	pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;
	cameraControlsObject.updateMatrixWorld(true);
	cameraControlsYawObject.updateMatrixWorld(true);
	cameraControlsPitchObject.updateMatrixWorld(true);
	worldCamera.updateMatrixWorld(true);
	pathTracingScene.updateMatrixWorld(true);
	pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
	if (pathTracingUniforms.uCamPos && pathTracingUniforms.uCamPos.value)
		pathTracingUniforms.uCamPos.value.setFromMatrixPosition(worldCamera.matrixWorld);
	resetR738MainAccumulation();
	if (typeof wakeRender === 'function') wakeRender('r7-3-9-current-view-validation-camera');
	return window.reportR739C1CurrentViewReflectionConfig();
};

window.runR739C1CurrentViewReflectionValidation = async function(options)
{
	options = options || {};
	var timeout = normalizeR738PositiveInt(options.timeoutMs, 180000, 1000, 3600000);
	var sampleTarget = normalizeR738PositiveInt(options.samples, 1000, 1, 1000000);
	if (sampleTarget !== 1000)
		throw new Error('R7-3.9 Config 1 current-view validation requires exactly 1000 spp');
	var states = options.sweep === true ?
		R739_C1_CURRENT_VIEW_VALIDATION_CAMERA_STATES.concat(R739_C1_CURRENT_VIEW_VALIDATION_SWEEP_STATES) :
		R739_C1_CURRENT_VIEW_VALIDATION_CAMERA_STATES;
	var state = captureR738BakeState();
	var results = [];
	try
	{
		if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
		for (var i = 0; i < states.length; i += 1)
		{
			var cameraState = states[i];
			window.setR739Config1ValidationCameraState(cameraState);
			window.setR739C1CurrentViewReflectionValidationEnabled(false);
			var maskReadback = await captureR739SurfaceReadback(1.0);
			var offReport = await renderR739CurrentViewExactSamples(1000, timeout, false);
			var onReport = await renderR739CurrentViewExactSamples(1000, timeout, true);
			var routeReport = window.reportR739C1CurrentViewReflectionConfig();
			var summary = summarizeR739SproutCurrentViewDelta(onReport.readback, offReport.readback, maskReadback, 1000);
			results.push({
				cameraState: cameraState,
				routeReport: routeReport,
				actualSamples: onReport.actualSamples,
				offSamples: offReport.actualSamples,
				summary: summary
			});
		}
		var cameraStateVariation = r739CameraStateVariation(results);
		var visibleResults = results.filter(function(result) { return result.summary.sproutVisiblePixels > 0; });
		var deltaResults = visibleResults.filter(function(result) { return result.summary.sproutDeltaMeanLuma > 0.000001; });
		var checks = {
			version: true,
			config: results.every(function(result) { return result.routeReport.currentPanelConfig === 1 && result.routeReport.configAllowed === true; }),
			exactSamples: results.every(function(result) { return result.actualSamples === 1000 && result.offSamples === 1000; }),
			currentViewRouteApplied: results.every(function(result) { return result.routeReport.applied === true && result.routeReport.computeFromCurrentCamera === true; }),
			rejectsFiniteViewBakeRuntime: results.every(function(result) { return result.routeReport.finiteViewBakeRuntimeEnabled === false; }),
			rejectsLookupFallbacks: results.every(function(result) {
				return result.routeReport.nearestDirectionLookupEnabled === false &&
					result.routeReport.directionInterpolationEnabled === false &&
					result.routeReport.cubemapRuntimeEnabled === false &&
					result.routeReport.screenCopyFallbackEnabled === false &&
					result.routeReport.zeroFillFallbackEnabled === false &&
					result.routeReport.liveNoiseFallbackEnabled === false;
			}),
			roughness: results.every(function(result) { return result.routeReport.routeRoughness === 0.1; }),
			sproutVisiblePixels: visibleResults.length >= 3,
			finiteDelta: results.every(function(result) { return result.summary.nonFiniteDeltaPixels === 0; }),
			sproutDeltaMeanLuma: deltaResults.length >= 2,
			cameraStateVariation: cameraStateVariation.changedAcrossCameraStates === true
		};
		var report = {
			version: 'r7-3-9-config1-current-view-reflection',
			config: 1,
			target: 'sprout_reflection_c1',
			routeKind: 'runtime_path_tracing_current_view',
			requestedSamples: 1000,
			actualSamples: 1000,
			floorRoughnessForReflection: 0.1,
			cameraStateVariation: cameraStateVariation,
			visibleStateCount: visibleResults.length,
			deltaStateCount: deltaResults.length,
			missingSproutStates: results.filter(function(result) { return result.summary.sproutVisiblePixels === 0; }).map(function(result) { return result.cameraState.name; }),
			results: results,
			checks: checks,
			status: Object.keys(checks).every(function(key) { return checks[key]; }) ? 'pass' : 'fail'
		};
		window.__r739C1CurrentViewReflectionValidationReport = report;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
		window.setR739C1CurrentViewReflectionValidationEnabled(false);
	}
};

window.loadR738C1BakePastePreviewPackage = loadR738C1BakePastePreviewPackage;
window.loadR7310C1FullRoomDiffuseRuntimePackage = loadR7310C1FullRoomDiffuseRuntimePackage;
window.loadR7310C1NorthWallDiffuseRuntimePackage = loadR7310C1NorthWallDiffuseRuntimePackage;
window.loadR7310C1EastWallDiffuseRuntimePackage = loadR7310C1EastWallDiffuseRuntimePackage;
window.loadR7310C1NorthWallWardrobeDiffuseRuntimePackage = loadR7310C1NorthWallWardrobeDiffuseRuntimePackage;
window.loadR7310C1EastWallWardrobeDiffuseRuntimePackage = loadR7310C1EastWallWardrobeDiffuseRuntimePackage;
window.loadR7310C1WestWallDiffuseRuntimePackage = loadR7310C1WestWallDiffuseRuntimePackage;
window.loadR7310C1SouthWallDiffuseRuntimePackage = loadR7310C1SouthWallDiffuseRuntimePackage;
window.loadR7310C1CeilingDiffuseRuntimePackage = loadR7310C1CeilingDiffuseRuntimePackage;
window.loadR7310C1StructuralDiffuseRuntimePackage = loadR7310C1StructuralDiffuseRuntimePackage;
window.loadR7310C1SeColumnNorthShadowRuntimePackage = loadR7310C1SeColumnNorthShadowRuntimePackage;
window.loadR7310C1SeColumnWestShadowRuntimePackage = loadR7310C1SeColumnWestShadowRuntimePackage;
window.loadR7310C1SouthWallAcShadowRuntimePackage = loadR7310C1SouthWallAcShadowRuntimePackage;
window.loadR7310C1EastWallBeamShadowRuntimePackage = loadR7310C1EastWallBeamShadowRuntimePackage;
window.loadR7310C1EastWallBeamShadowWardrobeRuntimePackage = loadR7310C1EastWallBeamShadowWardrobeRuntimePackage;
window.loadR7310C1SwColumnNorthShadowRuntimePackage = loadR7310C1SwColumnNorthShadowRuntimePackage;
window.loadR7310C1WestWallBeamShadowRuntimePackage = loadR7310C1WestWallBeamShadowRuntimePackage;
window.loadR7310C1SwColumnInnerShadowRuntimePackage = loadR7310C1SwColumnInnerShadowRuntimePackage;
window.loadR7310C1WestBeamInnerShadowRuntimePackage = loadR7310C1WestBeamInnerShadowRuntimePackage;
window.loadR7310C1WestBeamUnderShadowRuntimePackage = loadR7310C1WestBeamUnderShadowRuntimePackage;
window.loadR7310C1EastBeamInnerShadowRuntimePackage = loadR7310C1EastBeamInnerShadowRuntimePackage;
window.loadR7310C1EastBeamUnderShadowRuntimePackage = loadR7310C1EastBeamUnderShadowRuntimePackage;
window.loadR7310C1SouthWindowLeftRevealShadowRuntimePackage = loadR7310C1SouthWindowLeftRevealShadowRuntimePackage;
window.loadR7310C1SouthWindowRightRevealShadowRuntimePackage = loadR7310C1SouthWindowRightRevealShadowRuntimePackage;
window.loadR7310C1SouthWindowBottomRevealShadowRuntimePackage = loadR7310C1SouthWindowBottomRevealShadowRuntimePackage;
window.loadR7310C1SouthWindowTopRevealShadowRuntimePackage = loadR7310C1SouthWindowTopRevealShadowRuntimePackage;

window.waitForR738C1BakePastePreviewReady = async function(timeoutMs)
{
	var timeout = normalizeR738PositiveInt(timeoutMs, 60000, 1000, 600000);
	var start = performance.now();
	if (!r738C1BakePastePreviewLoadPromise)
		loadR738C1BakePastePreviewPackage().catch(function() {});
	while (performance.now() - start < timeout)
	{
		if (r738C1BakePastePreviewReady)
			return window.reportR738C1BakePastePreviewConfig();
		if (r738C1BakePastePreviewError)
			throw new Error(r738C1BakePastePreviewError);
		await new Promise(function(resolve) { setTimeout(resolve, 100); });
	}
	throw new Error('R7-3.8 C1 bake paste preview did not become ready');
};

window.waitForR7310C1FullRoomDiffuseRuntimeReady = async function(timeoutMs)
{
	var timeout = normalizeR738PositiveInt(timeoutMs, 60000, 1000, 600000);
	var start = performance.now();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	while (performance.now() - start < timeout)
	{
		var enabledReady = (!r7310C1FloorDiffuseRuntimeEnabled || r7310C1FullRoomDiffuseRuntimeReady) &&
			(!r7310C1NorthWallDiffuseRuntimeEnabled || r7310C1NorthWallActiveDiffuseRuntimeReady()) &&
			(!r7310C1EastWallDiffuseRuntimeEnabled || r7310C1EastWallActiveDiffuseRuntimeReady()) &&
			(!r7310C1WestWallDiffuseRuntimeEnabled || r7310C1WestWallDiffuseRuntimeReady) &&
			(!r7310C1SouthWallDiffuseRuntimeEnabled || r7310C1SouthWallDiffuseRuntimeReady) &&
			(!r7310C1CeilingDiffuseRuntimeEnabled || r7310C1CeilingDiffuseRuntimeReady) &&
			(!r7310C1StructuralDiffuseRuntimeEnabled || r7310C1StructuralDiffuseRuntimePending || r7310C1StructuralDiffuseRuntimeReady) &&
			(!r7310C1SeColumnNorthShadowRuntimeEnabled || r7310C1SeColumnNorthShadowRuntimePending || r7310C1SeColumnNorthShadowRuntimeReady) &&
			(!r7310C1SeColumnWestShadowRuntimeEnabled || r7310C1SeColumnWestShadowRuntimePending || r7310C1SeColumnWestShadowRuntimeReady) &&
			(!r7310C1SouthWallAcShadowRuntimeEnabled || r7310C1SouthWallAcShadowRuntimePending || r7310C1SouthWallAcShadowRuntimeReady) &&
			(!r7310C1EastWallBeamShadowRuntimeEnabled || r7310C1EastWallBeamShadowActiveRuntimePending() || r7310C1EastWallBeamShadowActiveRuntimeReady()) &&
			(!r7310C1SwColumnNorthShadowRuntimeEnabled || r7310C1SwColumnNorthShadowRuntimePending || r7310C1SwColumnNorthShadowRuntimeReady) &&
			(!r7310C1WestWallBeamShadowRuntimeEnabled || r7310C1WestWallBeamShadowRuntimeReady) &&
			(!r7310C1SwColumnInnerShadowRuntimeEnabled || r7310C1SwColumnInnerShadowRuntimeReady) &&
			(!r7310C1WestBeamInnerShadowRuntimeEnabled || r7310C1WestBeamInnerShadowRuntimeReady) &&
			(!r7310C1WestBeamUnderShadowRuntimeEnabled || r7310C1WestBeamUnderShadowRuntimePending || r7310C1WestBeamUnderShadowRuntimeReady) &&
			(!r7310C1EastBeamInnerShadowRuntimeEnabled || r7310C1EastBeamInnerShadowRuntimePending || r7310C1EastBeamInnerShadowRuntimeReady) &&
			(!r7310C1EastBeamUnderShadowRuntimeEnabled || r7310C1EastBeamUnderShadowRuntimePending || r7310C1EastBeamUnderShadowRuntimeReady) &&
			(!r7310C1SouthWindowLeftRevealShadowRuntimeEnabled || r7310C1SouthWindowLeftRevealShadowRuntimePending || r7310C1SouthWindowLeftRevealShadowRuntimeReady) &&
			(!r7310C1SouthWindowRightRevealShadowRuntimeEnabled || r7310C1SouthWindowRightRevealShadowRuntimePending || r7310C1SouthWindowRightRevealShadowRuntimeReady) &&
			(!r7310C1SouthWindowBottomRevealShadowRuntimeEnabled || r7310C1SouthWindowBottomRevealShadowRuntimePending || r7310C1SouthWindowBottomRevealShadowRuntimeReady) &&
			(!r7310C1SouthWindowTopRevealShadowRuntimeEnabled || r7310C1SouthWindowTopRevealShadowRuntimePending || r7310C1SouthWindowTopRevealShadowRuntimeReady);
		if (enabledReady)
			return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
		if (r7310C1FullRoomDiffuseRuntimeError)
			throw new Error(r7310C1FullRoomDiffuseRuntimeError);
		if (r7310C1NorthWallDiffuseRuntimeError)
			throw new Error(r7310C1NorthWallDiffuseRuntimeError);
		if (r7310C1EastWallDiffuseRuntimeError)
			throw new Error(r7310C1EastWallDiffuseRuntimeError);
		if (r7310C1NortheastFurnitureRuntimeMode === 'wardrobe' && r7310C1NorthWallWardrobeDiffuseRuntimeError)
			throw new Error(r7310C1NorthWallWardrobeDiffuseRuntimeError);
		if (r7310C1NortheastFurnitureRuntimeMode === 'wardrobe' && r7310C1EastWallWardrobeDiffuseRuntimeError)
			throw new Error(r7310C1EastWallWardrobeDiffuseRuntimeError);
		if (r7310C1WestWallDiffuseRuntimeError)
			throw new Error(r7310C1WestWallDiffuseRuntimeError);
		if (r7310C1SouthWallDiffuseRuntimeError)
			throw new Error(r7310C1SouthWallDiffuseRuntimeError);
		if (r7310C1CeilingDiffuseRuntimeError)
			throw new Error(r7310C1CeilingDiffuseRuntimeError);
		if (!r7310C1StructuralDiffuseRuntimePending && r7310C1StructuralDiffuseRuntimeError)
			throw new Error(r7310C1StructuralDiffuseRuntimeError);
		if (!r7310C1SeColumnNorthShadowRuntimePending && r7310C1SeColumnNorthShadowRuntimeError)
			throw new Error(r7310C1SeColumnNorthShadowRuntimeError);
		if (!r7310C1SeColumnWestShadowRuntimePending && r7310C1SeColumnWestShadowRuntimeError)
			throw new Error(r7310C1SeColumnWestShadowRuntimeError);
		if (!r7310C1SouthWallAcShadowRuntimePending && r7310C1SouthWallAcShadowRuntimeError)
			throw new Error(r7310C1SouthWallAcShadowRuntimeError);
		if (!r7310C1EastWallBeamShadowActiveRuntimePending() && r7310C1EastWallBeamShadowActiveRuntimeError())
			throw new Error(r7310C1EastWallBeamShadowActiveRuntimeError());
		if (!r7310C1SwColumnNorthShadowRuntimePending && r7310C1SwColumnNorthShadowRuntimeError)
			throw new Error(r7310C1SwColumnNorthShadowRuntimeError);
		if (!r7310C1WestWallBeamShadowRuntimePending && r7310C1WestWallBeamShadowRuntimeError)
			throw new Error(r7310C1WestWallBeamShadowRuntimeError);
		if (!r7310C1SwColumnInnerShadowRuntimePending && r7310C1SwColumnInnerShadowRuntimeError)
			throw new Error(r7310C1SwColumnInnerShadowRuntimeError);
		if (!r7310C1WestBeamInnerShadowRuntimePending && r7310C1WestBeamInnerShadowRuntimeError)
			throw new Error(r7310C1WestBeamInnerShadowRuntimeError);
		if (!r7310C1WestBeamUnderShadowRuntimePending && r7310C1WestBeamUnderShadowRuntimeError)
			throw new Error(r7310C1WestBeamUnderShadowRuntimeError);
		if (!r7310C1EastBeamInnerShadowRuntimePending && r7310C1EastBeamInnerShadowRuntimeError)
			throw new Error(r7310C1EastBeamInnerShadowRuntimeError);
		if (!r7310C1EastBeamUnderShadowRuntimePending && r7310C1EastBeamUnderShadowRuntimeError)
			throw new Error(r7310C1EastBeamUnderShadowRuntimeError);
		if (!r7310C1SouthWindowLeftRevealShadowRuntimePending && r7310C1SouthWindowLeftRevealShadowRuntimeError)
			throw new Error(r7310C1SouthWindowLeftRevealShadowRuntimeError);
		if (!r7310C1SouthWindowRightRevealShadowRuntimePending && r7310C1SouthWindowRightRevealShadowRuntimeError)
			throw new Error(r7310C1SouthWindowRightRevealShadowRuntimeError);
		if (!r7310C1SouthWindowBottomRevealShadowRuntimePending && r7310C1SouthWindowBottomRevealShadowRuntimeError)
			throw new Error(r7310C1SouthWindowBottomRevealShadowRuntimeError);
		if (!r7310C1SouthWindowTopRevealShadowRuntimePending && r7310C1SouthWindowTopRevealShadowRuntimeError)
			throw new Error(r7310C1SouthWindowTopRevealShadowRuntimeError);
		await new Promise(function(resolve) { setTimeout(resolve, 100); });
	}
	throw new Error('R7-3.10 C1 full room diffuse runtime package did not become ready');
};

window.setR738C1BakePastePreviewEnabled = function(enabled)
{
	r738C1BakePastePreviewEnabled = !!enabled;
	updateR738C1BakePastePreviewUniforms();
	if (r738C1BakePastePreviewEnabled && !r738C1BakePastePreviewReady)
		loadR738C1BakePastePreviewPackage().catch(function() {});
	else
		resetR738MainAccumulation();
	if (typeof wakeRender === 'function') wakeRender('r7-3-8-c1-bake-paste-preview-toggle');
	return window.reportR738C1BakePastePreviewConfig();
};

window.reportR738C1BakePastePreviewConfig = function()
{
	var applied = updateR738C1BakePastePreviewUniforms();
	return {
		version: 'r7-3-8-c1-bake-paste-preview',
		enabled: r738C1BakePastePreviewEnabled,
		ready: r738C1BakePastePreviewReady,
		applied: applied,
		error: r738C1BakePastePreviewError,
		currentPanelConfig: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0,
		configAllowed: r738C1BakePastePreviewConfigAllowed(),
		packageDir: r738C1BakePastePreviewPackage ? r738C1BakePastePreviewPackage.packageDir : null,
		targetAtlasResolution: r738C1BakePastePreviewPackage ? r738C1BakePastePreviewPackage.targetAtlasResolution : null,
		samplesPerTexel: r738C1BakePastePreviewPackage ? r738C1BakePastePreviewPackage.samplesPerTexel : null,
		upscaled: r738C1BakePastePreviewPackage ? r738C1BakePastePreviewPackage.upscaled : null,
		diffuseOnly: r738C1BakePastePreviewPackage ? r738C1BakePastePreviewPackage.diffuseOnly === true : null,
		uniformMode: pathTracingUniforms && pathTracingUniforms.uR738C1BakePastePreviewMode ? pathTracingUniforms.uR738C1BakePastePreviewMode.value : null,
		uniformReady: pathTracingUniforms && pathTracingUniforms.uR738C1BakePastePreviewReady ? pathTracingUniforms.uR738C1BakePastePreviewReady.value : null,
		disabledByR7310FloorToggle: r7310C1FloorToggleOwnsSproutPaste(),
		strength: r738C1BakePastePreviewStrength,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0)
	};
};

function ensureR7310C1FullRoomDiffuseRuntimeLoading()
{
	updateR7310C1RuntimeLoadingProgress();
	if (r7310C1FloorDiffuseRuntimeEnabled && !r7310C1FullRoomDiffuseRuntimeReady)
		loadR7310C1FullRoomDiffuseRuntimePackage().catch(function() {});
	if (r7310C1NorthWallDiffuseRuntimeEnabled && !r7310C1NorthWallDiffuseRuntimeReady)
		loadR7310C1NorthWallDiffuseRuntimePackage().catch(function() {});
	if (r7310C1EastWallDiffuseRuntimeEnabled && !r7310C1EastWallDiffuseRuntimeReady)
		loadR7310C1EastWallDiffuseRuntimePackage().catch(function() {});
	if (r7310C1NortheastFurnitureRuntimeMode === 'wardrobe' && r7310C1NorthWallDiffuseRuntimeEnabled && !r7310C1NorthWallWardrobeDiffuseRuntimeReady)
		loadR7310C1NorthWallWardrobeDiffuseRuntimePackage().catch(function() {});
	if (r7310C1NortheastFurnitureRuntimeMode === 'wardrobe' && r7310C1EastWallDiffuseRuntimeEnabled && !r7310C1EastWallWardrobeDiffuseRuntimeReady)
		loadR7310C1EastWallWardrobeDiffuseRuntimePackage().catch(function() {});
	if (r7310C1WestWallDiffuseRuntimeEnabled && !r7310C1WestWallDiffuseRuntimeReady)
		loadR7310C1WestWallDiffuseRuntimePackage().catch(function() {});
	if (r7310C1SouthWallDiffuseRuntimeEnabled && !r7310C1SouthWallDiffuseRuntimeReady)
		loadR7310C1SouthWallDiffuseRuntimePackage().catch(function() {});
	if (r7310C1CeilingDiffuseRuntimeEnabled && !r7310C1CeilingDiffuseRuntimeReady)
		loadR7310C1CeilingDiffuseRuntimePackage().catch(function() {});
	if (r7310C1StructuralDiffuseRuntimeEnabled && (r7310C1StructuralDiffuseRuntimePending || !r7310C1StructuralDiffuseRuntimeReady))
		loadR7310C1StructuralDiffuseRuntimePackage().catch(function() {});
	if (r7310C1SeColumnNorthShadowRuntimeEnabled && (r7310C1SeColumnNorthShadowRuntimePending || !r7310C1SeColumnNorthShadowRuntimeReady))
		loadR7310C1SeColumnNorthShadowRuntimePackage().catch(function() {});
	if (r7310C1SeColumnWestShadowRuntimeEnabled && (r7310C1SeColumnWestShadowRuntimePending || !r7310C1SeColumnWestShadowRuntimeReady))
		loadR7310C1SeColumnWestShadowRuntimePackage().catch(function() {});
	if (r7310C1SouthWallAcShadowRuntimeEnabled && (r7310C1SouthWallAcShadowRuntimePending || !r7310C1SouthWallAcShadowRuntimeReady))
		loadR7310C1SouthWallAcShadowRuntimePackage().catch(function() {});
	if (r7310C1EastWallBeamShadowRuntimeEnabled && r7310C1NortheastFurnitureRuntimeMode === 'wardrobe' && (r7310C1EastWallBeamShadowWardrobeRuntimePending || !r7310C1EastWallBeamShadowWardrobeRuntimeReady))
		loadR7310C1EastWallBeamShadowWardrobeRuntimePackage().catch(function() {});
	if (r7310C1EastWallBeamShadowRuntimeEnabled && r7310C1NortheastFurnitureRuntimeMode !== 'wardrobe' && (r7310C1EastWallBeamShadowRuntimePending || !r7310C1EastWallBeamShadowRuntimeReady))
		loadR7310C1EastWallBeamShadowRuntimePackage().catch(function() {});
	if (r7310C1SwColumnNorthShadowRuntimeEnabled && (r7310C1SwColumnNorthShadowRuntimePending || !r7310C1SwColumnNorthShadowRuntimeReady))
		loadR7310C1SwColumnNorthShadowRuntimePackage().catch(function() {});
	if (r7310C1WestWallBeamShadowRuntimeEnabled && (r7310C1WestWallBeamShadowRuntimePending || !r7310C1WestWallBeamShadowRuntimeReady))
		loadR7310C1WestWallBeamShadowRuntimePackage().catch(function() {});
	if (r7310C1SwColumnInnerShadowRuntimeEnabled && (r7310C1SwColumnInnerShadowRuntimePending || !r7310C1SwColumnInnerShadowRuntimeReady))
		loadR7310C1SwColumnInnerShadowRuntimePackage().catch(function() {});
	if (r7310C1WestBeamInnerShadowRuntimeEnabled && (r7310C1WestBeamInnerShadowRuntimePending || !r7310C1WestBeamInnerShadowRuntimeReady))
		loadR7310C1WestBeamInnerShadowRuntimePackage().catch(function() {});
	if (r7310C1WestBeamUnderShadowRuntimeEnabled && (r7310C1WestBeamUnderShadowRuntimePending || !r7310C1WestBeamUnderShadowRuntimeReady))
		loadR7310C1WestBeamUnderShadowRuntimePackage().catch(function() {});
	if (r7310C1EastBeamInnerShadowRuntimeEnabled && (r7310C1EastBeamInnerShadowRuntimePending || !r7310C1EastBeamInnerShadowRuntimeReady))
		loadR7310C1EastBeamInnerShadowRuntimePackage().catch(function() {});
	if (r7310C1EastBeamUnderShadowRuntimeEnabled && (r7310C1EastBeamUnderShadowRuntimePending || !r7310C1EastBeamUnderShadowRuntimeReady))
		loadR7310C1EastBeamUnderShadowRuntimePackage().catch(function() {});
	if (r7310C1SouthWindowLeftRevealShadowRuntimeEnabled && (r7310C1SouthWindowLeftRevealShadowRuntimePending || !r7310C1SouthWindowLeftRevealShadowRuntimeReady))
		loadR7310C1SouthWindowLeftRevealShadowRuntimePackage().catch(function() {});
	if (r7310C1SouthWindowRightRevealShadowRuntimeEnabled && (r7310C1SouthWindowRightRevealShadowRuntimePending || !r7310C1SouthWindowRightRevealShadowRuntimeReady))
		loadR7310C1SouthWindowRightRevealShadowRuntimePackage().catch(function() {});
	if (r7310C1SouthWindowBottomRevealShadowRuntimeEnabled && (r7310C1SouthWindowBottomRevealShadowRuntimePending || !r7310C1SouthWindowBottomRevealShadowRuntimeReady))
		loadR7310C1SouthWindowBottomRevealShadowRuntimePackage().catch(function() {});
	if (r7310C1SouthWindowTopRevealShadowRuntimeEnabled && (r7310C1SouthWindowTopRevealShadowRuntimePending || !r7310C1SouthWindowTopRevealShadowRuntimeReady))
		loadR7310C1SouthWindowTopRevealShadowRuntimePackage().catch(function() {});
	if (r7310C1IronDoorRevealRuntimeEnabled && (r7310C1IronDoorRevealRuntimePending || !r7310C1IronDoorRevealRuntimeReady))
		loadR7310C1IronDoorRevealRuntimePackage().catch(function() {});
	if (!r7310C1AnyFullRoomDiffuseSurfaceEnabled())
		resetR738MainAccumulation();
}

window.setR7310C1FullRoomDiffuseRuntimeEnabled = function(enabled)
{
	r7310C1FullRoomDiffuseRuntimeEnabled = !!enabled;
	r7310C1FloorDiffuseRuntimeEnabled = !!enabled;
	r7310C1NorthWallDiffuseRuntimeEnabled = !!enabled;
	r7310C1EastWallDiffuseRuntimeEnabled = !!enabled;
	r7310C1WestWallDiffuseRuntimeEnabled = !!enabled;
	r7310C1SouthWallDiffuseRuntimeEnabled = !!enabled;
	r7310C1CeilingDiffuseRuntimeEnabled = !!enabled;
	r7310C1StructuralDiffuseRuntimeEnabled = !!enabled;
	r7310C1SeColumnNorthShadowRuntimeEnabled = !!enabled;
	r7310C1SeColumnWestShadowRuntimeEnabled = !!enabled;
	r7310C1SouthWallAcShadowRuntimeEnabled = !!enabled;
	r7310C1EastWallBeamShadowRuntimeEnabled = !!enabled;
	r7310C1SwColumnNorthShadowRuntimeEnabled = !!enabled;
	r7310C1WestWallBeamShadowRuntimeEnabled = !!enabled;
	r7310C1SwColumnInnerShadowRuntimeEnabled = !!enabled;
	r7310C1WestBeamInnerShadowRuntimeEnabled = !!enabled;
	r7310C1WestBeamUnderShadowRuntimeEnabled = !!enabled;
	r7310C1EastBeamInnerShadowRuntimeEnabled = !!enabled;
	r7310C1EastBeamUnderShadowRuntimeEnabled = !!enabled;
	r7310C1SouthWindowLeftRevealShadowRuntimeEnabled = !!enabled;
	r7310C1SouthWindowRightRevealShadowRuntimeEnabled = !!enabled;
	r7310C1SouthWindowBottomRevealShadowRuntimeEnabled = !!enabled;
	r7310C1SouthWindowTopRevealShadowRuntimeEnabled = !!enabled;
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-full-room-diffuse-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1FloorDiffuseRuntimeEnabled = function(enabled)
{
	r7310C1FloorDiffuseRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-floor-diffuse-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1NorthWallDiffuseRuntimeEnabled = function(enabled)
{
	r7310C1NorthWallDiffuseRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-north-wall-diffuse-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1EastWallDiffuseRuntimeEnabled = function(enabled)
{
	r7310C1EastWallDiffuseRuntimeEnabled = !!enabled;
	r7310C1EastWallBeamShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-east-wall-diffuse-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1NortheastFurnitureRuntimeMode = function(mode)
{
	var nextMode = (mode === 'wardrobe') ? 'wardrobe' : 'bed';
	var changed = r7310C1NortheastFurnitureRuntimeMode !== nextMode;
	r7310C1NortheastFurnitureRuntimeMode = nextMode;
	refreshR7310C1CombinedDiffuseRuntimeTexture();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (changed)
	{
		resetR738MainAccumulation();
		if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-ne-furniture-runtime-mode');
	}
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1WestWallDiffuseRuntimeEnabled = function(enabled)
{
	r7310C1WestWallDiffuseRuntimeEnabled = !!enabled;
	r7310C1WestWallBeamShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-west-wall-diffuse-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1SouthWallDiffuseRuntimeEnabled = function(enabled)
{
	r7310C1SouthWallDiffuseRuntimeEnabled = !!enabled;
	r7310C1SouthWallAcShadowRuntimeEnabled = !!enabled;
	r7310C1SouthWindowLeftRevealShadowRuntimeEnabled = !!enabled;
	r7310C1SouthWindowRightRevealShadowRuntimeEnabled = !!enabled;
	r7310C1SouthWindowBottomRevealShadowRuntimeEnabled = !!enabled;
	r7310C1SouthWindowTopRevealShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-south-wall-diffuse-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1CeilingDiffuseRuntimeEnabled = function(enabled)
{
	r7310C1CeilingDiffuseRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-ceiling-diffuse-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1StructuralDiffuseRuntimeEnabled = function(enabled)
{
	r7310C1StructuralDiffuseRuntimeEnabled = !!enabled;
	r7310C1SeColumnNorthShadowRuntimeEnabled = !!enabled;
	r7310C1SeColumnWestShadowRuntimeEnabled = !!enabled;
	r7310C1SwColumnNorthShadowRuntimeEnabled = !!enabled;
	r7310C1SwColumnInnerShadowRuntimeEnabled = !!enabled;
	r7310C1WestBeamInnerShadowRuntimeEnabled = !!enabled;
	r7310C1WestBeamUnderShadowRuntimeEnabled = !!enabled;
	r7310C1EastBeamInnerShadowRuntimeEnabled = !!enabled;
	r7310C1EastBeamUnderShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-structural-diffuse-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1IronDoorRevealRuntimeEnabled = function(enabled)
{
	r7310C1IronDoorRevealRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-iron-door-reveal-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1SeColumnNorthShadowRuntimeEnabled = function(enabled)
{
	r7310C1SeColumnNorthShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-se-column-north-shadow-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1SeColumnWestShadowRuntimeEnabled = function(enabled)
{
	r7310C1SeColumnWestShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-se-column-west-shadow-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1SouthWallAcShadowRuntimeEnabled = function(enabled)
{
	r7310C1SouthWallAcShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-south-wall-ac-shadow-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1EastWallBeamShadowRuntimeEnabled = function(enabled)
{
	r7310C1EastWallBeamShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-east-wall-beam-shadow-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1SwColumnNorthShadowRuntimeEnabled = function(enabled)
{
	r7310C1SwColumnNorthShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-sw-column-north-shadow-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1WestWallBeamShadowRuntimeEnabled = function(enabled)
{
	r7310C1WestWallBeamShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-west-wall-beam-shadow-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1WestWallBeamShadowZMaxOverride = function(value)
{
	var zMax = Number(value);
	if (!Number.isFinite(zMax))
		zMax = 2.7179;
	if (pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallBeamShadowZMaxOverride)
		pathTracingUniforms.uR7310C1WestWallBeamShadowZMaxOverride.value = zMax;
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-west-wall-beam-shadow-zmax-override');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1SwColumnInnerShadowRuntimeEnabled = function(enabled)
{
	r7310C1SwColumnInnerShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-sw-column-inner-shadow-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1WestBeamInnerShadowRuntimeEnabled = function(enabled)
{
	r7310C1WestBeamInnerShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-west-beam-inner-shadow-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1WestBeamUnderShadowRuntimeEnabled = function(enabled)
{
	r7310C1WestBeamUnderShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-west-beam-under-shadow-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1EastBeamInnerShadowRuntimeEnabled = function(enabled)
{
	r7310C1EastBeamInnerShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-east-beam-inner-shadow-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.setR7310C1EastBeamUnderShadowRuntimeEnabled = function(enabled)
{
	r7310C1EastBeamUnderShadowRuntimeEnabled = !!enabled;
	r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();
	updateR738C1BakePastePreviewUniforms();
	ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof wakeRender === 'function') wakeRender('r7-3-10-c1-east-beam-under-shadow-runtime-toggle');
	return window.reportR7310C1FullRoomDiffuseRuntimeConfig();
};

window.reportR7310C1FullRoomDiffuseRuntimeConfig = function()
{
	var applied = updateR7310C1FullRoomDiffuseRuntimeUniforms();
	var sproutPasteApplied = updateR738C1BakePastePreviewUniforms();
	return {
		version: 'r7-3-10-c1-full-room-diffuse-runtime',
		ironDoorRevealEnabled: r7310C1IronDoorRevealRuntimeEnabled,
		enabled: r7310C1AnyFullRoomDiffuseSurfaceEnabled(),
		northeastFurnitureRuntimeMode: r7310C1NortheastFurnitureRuntimeMode,
		eastWallEnabled: r7310C1EastWallDiffuseRuntimeEnabled,
		floorEnabled: r7310C1FloorDiffuseRuntimeEnabled,
		northWallEnabled: r7310C1NorthWallDiffuseRuntimeEnabled,
		westWallEnabled: r7310C1WestWallDiffuseRuntimeEnabled,
		southWallEnabled: r7310C1SouthWallDiffuseRuntimeEnabled,
		ceilingEnabled: r7310C1CeilingDiffuseRuntimeEnabled,
		structuralEnabled: r7310C1StructuralDiffuseRuntimeEnabled,
		seColumnNorthShadowEnabled: r7310C1SeColumnNorthShadowRuntimeEnabled,
		seColumnWestShadowEnabled: r7310C1SeColumnWestShadowRuntimeEnabled,
		southWallAcShadowEnabled: r7310C1SouthWallAcShadowRuntimeEnabled,
		eastWallBeamShadowEnabled: r7310C1EastWallBeamShadowRuntimeEnabled,
		swColumnNorthShadowEnabled: r7310C1SwColumnNorthShadowRuntimeEnabled,
		westWallBeamShadowEnabled: r7310C1WestWallBeamShadowRuntimeEnabled,
		swColumnInnerShadowEnabled: r7310C1SwColumnInnerShadowRuntimeEnabled,
		westBeamInnerShadowEnabled: r7310C1WestBeamInnerShadowRuntimeEnabled,
		westBeamUnderShadowEnabled: r7310C1WestBeamUnderShadowRuntimeEnabled,
		eastBeamInnerShadowEnabled: r7310C1EastBeamInnerShadowRuntimeEnabled,
		eastBeamUnderShadowEnabled: r7310C1EastBeamUnderShadowRuntimeEnabled,
		ready: r7310C1FullRoomDiffuseRuntimeReady,
		floorReady: r7310C1FullRoomDiffuseRuntimeReady,
		northWallReady: r7310C1NorthWallActiveDiffuseRuntimeReady(),
		eastWallReady: r7310C1EastWallActiveDiffuseRuntimeReady(),
		northWallBedReady: r7310C1NorthWallDiffuseRuntimeReady,
		eastWallBedReady: r7310C1EastWallDiffuseRuntimeReady,
		northWallWardrobeReady: r7310C1NorthWallWardrobeDiffuseRuntimeReady,
		eastWallWardrobeReady: r7310C1EastWallWardrobeDiffuseRuntimeReady,
		westWallReady: r7310C1WestWallDiffuseRuntimeReady,
		southWallReady: r7310C1SouthWallDiffuseRuntimeReady,
		ceilingReady: r7310C1CeilingDiffuseRuntimeReady,
		structuralPending: r7310C1StructuralDiffuseRuntimePending,
		structuralReady: r7310C1StructuralDiffuseRuntimeReady,
		seColumnNorthShadowPending: r7310C1SeColumnNorthShadowRuntimePending,
		seColumnNorthShadowReady: r7310C1SeColumnNorthShadowRuntimeReady,
		seColumnWestShadowPending: r7310C1SeColumnWestShadowRuntimePending,
		seColumnWestShadowReady: r7310C1SeColumnWestShadowRuntimeReady,
		southWallAcShadowPending: r7310C1SouthWallAcShadowRuntimePending,
		southWallAcShadowReady: r7310C1SouthWallAcShadowRuntimeReady,
		eastWallBeamShadowPending: r7310C1EastWallBeamShadowActiveRuntimePending(),
		eastWallBeamShadowReady: r7310C1EastWallBeamShadowActiveRuntimeReady(),
		eastWallBeamShadowBedPending: r7310C1EastWallBeamShadowRuntimePending,
		eastWallBeamShadowBedReady: r7310C1EastWallBeamShadowRuntimeReady,
		eastWallBeamShadowWardrobePending: r7310C1EastWallBeamShadowWardrobeRuntimePending,
		eastWallBeamShadowWardrobeReady: r7310C1EastWallBeamShadowWardrobeRuntimeReady,
		swColumnNorthShadowPending: r7310C1SwColumnNorthShadowRuntimePending,
		swColumnNorthShadowReady: r7310C1SwColumnNorthShadowRuntimeReady,
		westWallBeamShadowPending: r7310C1WestWallBeamShadowRuntimePending,
		westWallBeamShadowReady: r7310C1WestWallBeamShadowRuntimeReady,
		swColumnInnerShadowPending: r7310C1SwColumnInnerShadowRuntimePending,
		swColumnInnerShadowReady: r7310C1SwColumnInnerShadowRuntimeReady,
		westBeamInnerShadowPending: r7310C1WestBeamInnerShadowRuntimePending,
		westBeamInnerShadowReady: r7310C1WestBeamInnerShadowRuntimeReady,
		westBeamUnderShadowPending: r7310C1WestBeamUnderShadowRuntimePending,
		westBeamUnderShadowReady: r7310C1WestBeamUnderShadowRuntimeReady,
		eastBeamInnerShadowPending: r7310C1EastBeamInnerShadowRuntimePending,
		eastBeamInnerShadowReady: r7310C1EastBeamInnerShadowRuntimeReady,
		eastBeamUnderShadowPending: r7310C1EastBeamUnderShadowRuntimePending,
		eastBeamUnderShadowReady: r7310C1EastBeamUnderShadowRuntimeReady,
		southWindowLeftRevealShadowPending: r7310C1SouthWindowLeftRevealShadowRuntimePending,
		southWindowLeftRevealShadowReady: r7310C1SouthWindowLeftRevealShadowRuntimeReady,
		southWindowRightRevealShadowPending: r7310C1SouthWindowRightRevealShadowRuntimePending,
		southWindowRightRevealShadowReady: r7310C1SouthWindowRightRevealShadowRuntimeReady,
		southWindowBottomRevealShadowPending: r7310C1SouthWindowBottomRevealShadowRuntimePending,
		southWindowBottomRevealShadowReady: r7310C1SouthWindowBottomRevealShadowRuntimeReady,
		southWindowTopRevealShadowPending: r7310C1SouthWindowTopRevealShadowRuntimePending,
		southWindowTopRevealShadowReady: r7310C1SouthWindowTopRevealShadowRuntimeReady,
		applied: applied,
		error: r7310C1FullRoomDiffuseRuntimeError || r7310C1NorthWallDiffuseRuntimeError || r7310C1EastWallDiffuseRuntimeError || (r7310C1NortheastFurnitureRuntimeMode === 'wardrobe' ? r7310C1NorthWallWardrobeDiffuseRuntimeError : null) || (r7310C1NortheastFurnitureRuntimeMode === 'wardrobe' ? r7310C1EastWallWardrobeDiffuseRuntimeError : null) || r7310C1WestWallDiffuseRuntimeError || r7310C1SouthWallDiffuseRuntimeError || r7310C1CeilingDiffuseRuntimeError || (!r7310C1StructuralDiffuseRuntimePending ? r7310C1StructuralDiffuseRuntimeError : null) || (!r7310C1SeColumnNorthShadowRuntimePending ? r7310C1SeColumnNorthShadowRuntimeError : null) || (!r7310C1SeColumnWestShadowRuntimePending ? r7310C1SeColumnWestShadowRuntimeError : null) || (!r7310C1SouthWallAcShadowRuntimePending ? r7310C1SouthWallAcShadowRuntimeError : null) || (!r7310C1EastWallBeamShadowActiveRuntimePending() ? r7310C1EastWallBeamShadowActiveRuntimeError() : null) || (!r7310C1SwColumnNorthShadowRuntimePending ? r7310C1SwColumnNorthShadowRuntimeError : null) || (!r7310C1WestWallBeamShadowRuntimePending ? r7310C1WestWallBeamShadowRuntimeError : null) || (!r7310C1SwColumnInnerShadowRuntimePending ? r7310C1SwColumnInnerShadowRuntimeError : null) || (!r7310C1WestBeamInnerShadowRuntimePending ? r7310C1WestBeamInnerShadowRuntimeError : null) || (!r7310C1WestBeamUnderShadowRuntimePending ? r7310C1WestBeamUnderShadowRuntimeError : null) || (!r7310C1EastBeamInnerShadowRuntimePending ? r7310C1EastBeamInnerShadowRuntimeError : null) || (!r7310C1EastBeamUnderShadowRuntimePending ? r7310C1EastBeamUnderShadowRuntimeError : null) || (!r7310C1SouthWindowLeftRevealShadowRuntimePending ? r7310C1SouthWindowLeftRevealShadowRuntimeError : null) || (!r7310C1SouthWindowRightRevealShadowRuntimePending ? r7310C1SouthWindowRightRevealShadowRuntimeError : null) || (!r7310C1SouthWindowBottomRevealShadowRuntimePending ? r7310C1SouthWindowBottomRevealShadowRuntimeError : null) || (!r7310C1SouthWindowTopRevealShadowRuntimePending ? r7310C1SouthWindowTopRevealShadowRuntimeError : null),
		configAllowed: r7310C1FullRoomDiffuseRuntimeConfigAllowed(),
		uiMeaningOff: 'all_live_path_tracing',
		uiMeaningOn: 'selected_floor_north_east_west_south_wall_ceiling_or_structural_1024_baked_diffuse_plus_live_reflection',
		uiMeaningDedicatedSeColumnNorthShadow: 'se_column_north_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedSeColumnWestShadow: 'se_column_west_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedSouthWallAcShadow: 'south_wall_ac_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedEastWallBeamShadow: 'east_wall_beam_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedSwColumnNorthShadow: 'sw_column_north_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedWestWallBeamShadow: 'west_wall_beam_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedSwColumnInnerShadow: 'sw_column_inner_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedWestBeamInnerShadow: 'west_beam_inner_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedWestBeamUnderShadow: 'west_beam_under_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedEastBeamInnerShadow: 'east_beam_inner_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedEastBeamUnderShadow: 'east_beam_under_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedSouthWindowLeftRevealShadow: 'south_window_left_reveal_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedSouthWindowRightRevealShadow: 'south_window_right_reveal_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedSouthWindowBottomRevealShadow: 'south_window_bottom_reveal_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		uiMeaningDedicatedSouthWindowTopRevealShadow: 'south_window_top_reveal_shadow_1024_baked_indirect_diffuse_plus_live_direct_shadow_and_live_reflection',
		sproutPasteApplied: sproutPasteApplied,
		sproutPasteUniformMode: pathTracingUniforms && pathTracingUniforms.uR738C1BakePastePreviewMode ? pathTracingUniforms.uR738C1BakePastePreviewMode.value : null,
		sproutPasteDisabledByFloorToggle: r7310C1FloorToggleOwnsSproutPaste(),
		packageDir: r7310C1FullRoomDiffuseRuntimePackage ? r7310C1FullRoomDiffuseRuntimePackage.packageDir : null,
		targetId: r7310C1FullRoomDiffuseRuntimePackage ? r7310C1FullRoomDiffuseRuntimePackage.targetId : null,
		surfaceName: r7310C1FullRoomDiffuseRuntimePackage ? r7310C1FullRoomDiffuseRuntimePackage.surfaceName : null,
		targetAtlasResolution: r7310C1FullRoomDiffuseRuntimePackage ? r7310C1FullRoomDiffuseRuntimePackage.targetAtlasResolution : null,
		requestedSamples: r7310C1FullRoomDiffuseRuntimePackage ? r7310C1FullRoomDiffuseRuntimePackage.requestedSamples : null,
		diffuseOnly: r7310C1FullRoomDiffuseRuntimePackage ? r7310C1FullRoomDiffuseRuntimePackage.diffuseOnly === true : null,
		runtimeAtlasPatchCount: R7310_C1_RUNTIME_ATLAS_PATCH_COUNT,
		runtimeAtlasGridColumns: R7310_C1_RUNTIME_ATLAS_GRID_COLUMNS,
		runtimeAtlasGridRows: Math.ceil(R7310_C1_RUNTIME_ATLAS_PATCH_COUNT / R7310_C1_RUNTIME_ATLAS_GRID_COLUMNS),
		northWallPackageDir: r7310C1NorthWallActiveDiffuseRuntimePackage() ? r7310C1NorthWallActiveDiffuseRuntimePackage().packageDir : null,
		northWallTargetId: r7310C1NorthWallActiveDiffuseRuntimePackage() ? r7310C1NorthWallActiveDiffuseRuntimePackage().targetId : null,
		northWallSurfaceName: r7310C1NorthWallActiveDiffuseRuntimePackage() ? r7310C1NorthWallActiveDiffuseRuntimePackage().surfaceName : null,
		northWallFurnitureVariant: r7310C1NorthWallActiveDiffuseRuntimePackage() ? r7310C1NorthWallActiveDiffuseRuntimePackage().northeastFurnitureMode : null,
		eastWallPackageDir: r7310C1EastWallActiveDiffuseRuntimePackage() ? r7310C1EastWallActiveDiffuseRuntimePackage().packageDir : null,
		eastWallTargetId: r7310C1EastWallActiveDiffuseRuntimePackage() ? r7310C1EastWallActiveDiffuseRuntimePackage().targetId : null,
		eastWallSurfaceName: r7310C1EastWallActiveDiffuseRuntimePackage() ? r7310C1EastWallActiveDiffuseRuntimePackage().surfaceName : null,
		eastWallFurnitureVariant: r7310C1EastWallActiveDiffuseRuntimePackage() ? r7310C1EastWallActiveDiffuseRuntimePackage().northeastFurnitureMode : null,
		westWallPackageDir: r7310C1WestWallDiffuseRuntimePackage ? r7310C1WestWallDiffuseRuntimePackage.packageDir : null,
		westWallTargetId: r7310C1WestWallDiffuseRuntimePackage ? r7310C1WestWallDiffuseRuntimePackage.targetId : null,
		westWallSurfaceName: r7310C1WestWallDiffuseRuntimePackage ? r7310C1WestWallDiffuseRuntimePackage.surfaceName : null,
		southWallPackageDir: r7310C1SouthWallDiffuseRuntimePackage ? r7310C1SouthWallDiffuseRuntimePackage.packageDir : null,
		southWallTargetId: r7310C1SouthWallDiffuseRuntimePackage ? r7310C1SouthWallDiffuseRuntimePackage.targetId : null,
		southWallSurfaceName: r7310C1SouthWallDiffuseRuntimePackage ? r7310C1SouthWallDiffuseRuntimePackage.surfaceName : null,
		ceilingPackageDir: r7310C1CeilingDiffuseRuntimePackage ? r7310C1CeilingDiffuseRuntimePackage.packageDir : null,
		ceilingTargetId: r7310C1CeilingDiffuseRuntimePackage ? r7310C1CeilingDiffuseRuntimePackage.targetId : null,
		ceilingSurfaceName: r7310C1CeilingDiffuseRuntimePackage ? r7310C1CeilingDiffuseRuntimePackage.surfaceName : null,
		structuralPackageDir: r7310C1StructuralDiffuseRuntimePackage ? r7310C1StructuralDiffuseRuntimePackage.packageDir : null,
		structuralTargetId: r7310C1StructuralDiffuseRuntimePackage ? r7310C1StructuralDiffuseRuntimePackage.targetId : null,
		structuralSurfaceName: r7310C1StructuralDiffuseRuntimePackage ? r7310C1StructuralDiffuseRuntimePackage.surfaceName : null,
		seColumnNorthShadowPackageDir: r7310C1SeColumnNorthShadowRuntimePackage ? r7310C1SeColumnNorthShadowRuntimePackage.packageDir : null,
		seColumnNorthShadowTargetId: r7310C1SeColumnNorthShadowRuntimePackage ? r7310C1SeColumnNorthShadowRuntimePackage.targetId : null,
		seColumnNorthShadowSurfaceName: r7310C1SeColumnNorthShadowRuntimePackage ? r7310C1SeColumnNorthShadowRuntimePackage.surfaceName : null,
		seColumnWestShadowPackageDir: r7310C1SeColumnWestShadowRuntimePackage ? r7310C1SeColumnWestShadowRuntimePackage.packageDir : null,
		seColumnWestShadowTargetId: r7310C1SeColumnWestShadowRuntimePackage ? r7310C1SeColumnWestShadowRuntimePackage.targetId : null,
		seColumnWestShadowSurfaceName: r7310C1SeColumnWestShadowRuntimePackage ? r7310C1SeColumnWestShadowRuntimePackage.surfaceName : null,
		southWallAcShadowPackageDir: r7310C1SouthWallAcShadowRuntimePackage ? r7310C1SouthWallAcShadowRuntimePackage.packageDir : null,
		southWallAcShadowTargetId: r7310C1SouthWallAcShadowRuntimePackage ? r7310C1SouthWallAcShadowRuntimePackage.targetId : null,
		southWallAcShadowSurfaceName: r7310C1SouthWallAcShadowRuntimePackage ? r7310C1SouthWallAcShadowRuntimePackage.surfaceName : null,
		eastWallBeamShadowPackageDir: r7310C1EastWallBeamShadowActiveRuntimePackage() ? r7310C1EastWallBeamShadowActiveRuntimePackage().packageDir : null,
		eastWallBeamShadowTargetId: r7310C1EastWallBeamShadowActiveRuntimePackage() ? r7310C1EastWallBeamShadowActiveRuntimePackage().targetId : null,
		eastWallBeamShadowSurfaceName: r7310C1EastWallBeamShadowActiveRuntimePackage() ? r7310C1EastWallBeamShadowActiveRuntimePackage().surfaceName : null,
		eastWallBeamShadowFurnitureVariant: r7310C1EastWallBeamShadowActiveRuntimePackage() ? r7310C1EastWallBeamShadowActiveRuntimePackage().northeastFurnitureMode : null,
		swColumnNorthShadowPackageDir: r7310C1SwColumnNorthShadowRuntimePackage ? r7310C1SwColumnNorthShadowRuntimePackage.packageDir : null,
		swColumnNorthShadowTargetId: r7310C1SwColumnNorthShadowRuntimePackage ? r7310C1SwColumnNorthShadowRuntimePackage.targetId : null,
		swColumnNorthShadowSurfaceName: r7310C1SwColumnNorthShadowRuntimePackage ? r7310C1SwColumnNorthShadowRuntimePackage.surfaceName : null,
		westWallBeamShadowPackageDir: r7310C1WestWallBeamShadowRuntimePackage ? r7310C1WestWallBeamShadowRuntimePackage.packageDir : null,
		westWallBeamShadowTargetId: r7310C1WestWallBeamShadowRuntimePackage ? r7310C1WestWallBeamShadowRuntimePackage.targetId : null,
		westWallBeamShadowSurfaceName: r7310C1WestWallBeamShadowRuntimePackage ? r7310C1WestWallBeamShadowRuntimePackage.surfaceName : null,
		swColumnInnerShadowPackageDir: r7310C1SwColumnInnerShadowRuntimePackage ? r7310C1SwColumnInnerShadowRuntimePackage.packageDir : null,
		swColumnInnerShadowTargetId: r7310C1SwColumnInnerShadowRuntimePackage ? r7310C1SwColumnInnerShadowRuntimePackage.targetId : null,
		swColumnInnerShadowSurfaceName: r7310C1SwColumnInnerShadowRuntimePackage ? r7310C1SwColumnInnerShadowRuntimePackage.surfaceName : null,
		westBeamInnerShadowPackageDir: r7310C1WestBeamInnerShadowRuntimePackage ? r7310C1WestBeamInnerShadowRuntimePackage.packageDir : null,
		westBeamInnerShadowTargetId: r7310C1WestBeamInnerShadowRuntimePackage ? r7310C1WestBeamInnerShadowRuntimePackage.targetId : null,
		westBeamInnerShadowSurfaceName: r7310C1WestBeamInnerShadowRuntimePackage ? r7310C1WestBeamInnerShadowRuntimePackage.surfaceName : null,
		westBeamUnderShadowPackageDir: r7310C1WestBeamUnderShadowRuntimePackage ? r7310C1WestBeamUnderShadowRuntimePackage.packageDir : null,
		westBeamUnderShadowTargetId: r7310C1WestBeamUnderShadowRuntimePackage ? r7310C1WestBeamUnderShadowRuntimePackage.targetId : null,
		westBeamUnderShadowSurfaceName: r7310C1WestBeamUnderShadowRuntimePackage ? r7310C1WestBeamUnderShadowRuntimePackage.surfaceName : null,
		eastBeamInnerShadowPackageDir: r7310C1EastBeamInnerShadowRuntimePackage ? r7310C1EastBeamInnerShadowRuntimePackage.packageDir : null,
		eastBeamInnerShadowTargetId: r7310C1EastBeamInnerShadowRuntimePackage ? r7310C1EastBeamInnerShadowRuntimePackage.targetId : null,
		eastBeamInnerShadowSurfaceName: r7310C1EastBeamInnerShadowRuntimePackage ? r7310C1EastBeamInnerShadowRuntimePackage.surfaceName : null,
		eastBeamUnderShadowPackageDir: r7310C1EastBeamUnderShadowRuntimePackage ? r7310C1EastBeamUnderShadowRuntimePackage.packageDir : null,
		eastBeamUnderShadowTargetId: r7310C1EastBeamUnderShadowRuntimePackage ? r7310C1EastBeamUnderShadowRuntimePackage.targetId : null,
		eastBeamUnderShadowSurfaceName: r7310C1EastBeamUnderShadowRuntimePackage ? r7310C1EastBeamUnderShadowRuntimePackage.surfaceName : null,
		southWindowLeftRevealShadowPackageDir: r7310C1SouthWindowLeftRevealShadowRuntimePackage ? r7310C1SouthWindowLeftRevealShadowRuntimePackage.packageDir : null,
		southWindowLeftRevealShadowTargetId: r7310C1SouthWindowLeftRevealShadowRuntimePackage ? r7310C1SouthWindowLeftRevealShadowRuntimePackage.targetId : null,
		southWindowLeftRevealShadowSurfaceName: r7310C1SouthWindowLeftRevealShadowRuntimePackage ? r7310C1SouthWindowLeftRevealShadowRuntimePackage.surfaceName : null,
		southWindowRightRevealShadowPackageDir: r7310C1SouthWindowRightRevealShadowRuntimePackage ? r7310C1SouthWindowRightRevealShadowRuntimePackage.packageDir : null,
		southWindowRightRevealShadowTargetId: r7310C1SouthWindowRightRevealShadowRuntimePackage ? r7310C1SouthWindowRightRevealShadowRuntimePackage.targetId : null,
		southWindowRightRevealShadowSurfaceName: r7310C1SouthWindowRightRevealShadowRuntimePackage ? r7310C1SouthWindowRightRevealShadowRuntimePackage.surfaceName : null,
		southWindowBottomRevealShadowPackageDir: r7310C1SouthWindowBottomRevealShadowRuntimePackage ? r7310C1SouthWindowBottomRevealShadowRuntimePackage.packageDir : null,
		southWindowBottomRevealShadowTargetId: r7310C1SouthWindowBottomRevealShadowRuntimePackage ? r7310C1SouthWindowBottomRevealShadowRuntimePackage.targetId : null,
		southWindowBottomRevealShadowSurfaceName: r7310C1SouthWindowBottomRevealShadowRuntimePackage ? r7310C1SouthWindowBottomRevealShadowRuntimePackage.surfaceName : null,
		southWindowTopRevealShadowPackageDir: r7310C1SouthWindowTopRevealShadowRuntimePackage ? r7310C1SouthWindowTopRevealShadowRuntimePackage.packageDir : null,
		southWindowTopRevealShadowTargetId: r7310C1SouthWindowTopRevealShadowRuntimePackage ? r7310C1SouthWindowTopRevealShadowRuntimePackage.targetId : null,
		southWindowTopRevealShadowSurfaceName: r7310C1SouthWindowTopRevealShadowRuntimePackage ? r7310C1SouthWindowTopRevealShadowRuntimePackage.surfaceName : null,
		uniformMode: pathTracingUniforms && pathTracingUniforms.uR7310C1FullRoomDiffuseMode ? pathTracingUniforms.uR7310C1FullRoomDiffuseMode.value : null,
		uniformReady: pathTracingUniforms && pathTracingUniforms.uR7310C1FullRoomDiffuseReady ? pathTracingUniforms.uR7310C1FullRoomDiffuseReady.value : null,
		uniformFloorMode: pathTracingUniforms && pathTracingUniforms.uR7310C1FloorDiffuseMode ? pathTracingUniforms.uR7310C1FloorDiffuseMode.value : null,
		uniformNorthWallMode: pathTracingUniforms && pathTracingUniforms.uR7310C1NorthWallDiffuseMode ? pathTracingUniforms.uR7310C1NorthWallDiffuseMode.value : null,
		uniformEastWallMode: pathTracingUniforms && pathTracingUniforms.uR7310C1EastWallDiffuseMode ? pathTracingUniforms.uR7310C1EastWallDiffuseMode.value : null,
		uniformWestWallMode: pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallDiffuseMode ? pathTracingUniforms.uR7310C1WestWallDiffuseMode.value : null,
		uniformSouthWallMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWallDiffuseMode ? pathTracingUniforms.uR7310C1SouthWallDiffuseMode.value : null,
		uniformCeilingMode: pathTracingUniforms && pathTracingUniforms.uR7310C1CeilingDiffuseMode ? pathTracingUniforms.uR7310C1CeilingDiffuseMode.value : null,
		uniformStructuralMode: pathTracingUniforms && pathTracingUniforms.uR7310C1StructuralDiffuseMode ? pathTracingUniforms.uR7310C1StructuralDiffuseMode.value : null,
		uniformSeColumnNorthShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SeColumnNorthShadowMode ? pathTracingUniforms.uR7310C1SeColumnNorthShadowMode.value : null,
		uniformSeColumnNorthShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SeColumnNorthShadowReady ? pathTracingUniforms.uR7310C1SeColumnNorthShadowReady.value : null,
		uniformSeColumnWestShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SeColumnWestShadowMode ? pathTracingUniforms.uR7310C1SeColumnWestShadowMode.value : null,
		uniformSeColumnWestShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SeColumnWestShadowReady ? pathTracingUniforms.uR7310C1SeColumnWestShadowReady.value : null,
		uniformSouthWallAcShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWallAcShadowMode ? pathTracingUniforms.uR7310C1SouthWallAcShadowMode.value : null,
		uniformSouthWallAcShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWallAcShadowReady ? pathTracingUniforms.uR7310C1SouthWallAcShadowReady.value : null,
		uniformEastWallBeamShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1EastWallBeamShadowMode ? pathTracingUniforms.uR7310C1EastWallBeamShadowMode.value : null,
		uniformEastWallBeamShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1EastWallBeamShadowReady ? pathTracingUniforms.uR7310C1EastWallBeamShadowReady.value : null,
		uniformSwColumnNorthShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SwColumnNorthShadowMode ? pathTracingUniforms.uR7310C1SwColumnNorthShadowMode.value : null,
		uniformSwColumnNorthShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SwColumnNorthShadowReady ? pathTracingUniforms.uR7310C1SwColumnNorthShadowReady.value : null,
		uniformWestWallBeamShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallBeamShadowMode ? pathTracingUniforms.uR7310C1WestWallBeamShadowMode.value : null,
		uniformWestWallBeamShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallBeamShadowReady ? pathTracingUniforms.uR7310C1WestWallBeamShadowReady.value : null,
		uniformWestWallBeamShadowZMaxOverride: pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallBeamShadowZMaxOverride ? pathTracingUniforms.uR7310C1WestWallBeamShadowZMaxOverride.value : null,
		uniformSwColumnInnerShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SwColumnInnerShadowMode ? pathTracingUniforms.uR7310C1SwColumnInnerShadowMode.value : null,
		uniformSwColumnInnerShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SwColumnInnerShadowReady ? pathTracingUniforms.uR7310C1SwColumnInnerShadowReady.value : null,
		uniformWestBeamInnerShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1WestBeamInnerShadowMode ? pathTracingUniforms.uR7310C1WestBeamInnerShadowMode.value : null,
		uniformWestBeamInnerShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1WestBeamInnerShadowReady ? pathTracingUniforms.uR7310C1WestBeamInnerShadowReady.value : null,
		uniformWestBeamUnderShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1WestBeamUnderShadowMode ? pathTracingUniforms.uR7310C1WestBeamUnderShadowMode.value : null,
		uniformWestBeamUnderShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1WestBeamUnderShadowReady ? pathTracingUniforms.uR7310C1WestBeamUnderShadowReady.value : null,
		uniformEastBeamInnerShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1EastBeamInnerShadowMode ? pathTracingUniforms.uR7310C1EastBeamInnerShadowMode.value : null,
		uniformEastBeamInnerShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1EastBeamInnerShadowReady ? pathTracingUniforms.uR7310C1EastBeamInnerShadowReady.value : null,
		uniformEastBeamUnderShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1EastBeamUnderShadowMode ? pathTracingUniforms.uR7310C1EastBeamUnderShadowMode.value : null,
		uniformEastBeamUnderShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1EastBeamUnderShadowReady ? pathTracingUniforms.uR7310C1EastBeamUnderShadowReady.value : null,
		uniformSouthWindowLeftRevealShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWindowLeftRevealShadowMode ? pathTracingUniforms.uR7310C1SouthWindowLeftRevealShadowMode.value : null,
		uniformSouthWindowLeftRevealShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWindowLeftRevealShadowReady ? pathTracingUniforms.uR7310C1SouthWindowLeftRevealShadowReady.value : null,
		uniformSouthWindowRightRevealShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWindowRightRevealShadowMode ? pathTracingUniforms.uR7310C1SouthWindowRightRevealShadowMode.value : null,
		uniformSouthWindowRightRevealShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWindowRightRevealShadowReady ? pathTracingUniforms.uR7310C1SouthWindowRightRevealShadowReady.value : null,
		uniformSouthWindowBottomRevealShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWindowBottomRevealShadowMode ? pathTracingUniforms.uR7310C1SouthWindowBottomRevealShadowMode.value : null,
		uniformSouthWindowBottomRevealShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWindowBottomRevealShadowReady ? pathTracingUniforms.uR7310C1SouthWindowBottomRevealShadowReady.value : null,
		uniformSouthWindowTopRevealShadowMode: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWindowTopRevealShadowMode ? pathTracingUniforms.uR7310C1SouthWindowTopRevealShadowMode.value : null,
		uniformSouthWindowTopRevealShadowReady: pathTracingUniforms && pathTracingUniforms.uR7310C1SouthWindowTopRevealShadowReady ? pathTracingUniforms.uR7310C1SouthWindowTopRevealShadowReady.value : null,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0),
		runtimeArchitecture: 'single_full_west_wall_first_hit_hybrid'
	};
};

function r7310C1RuntimeProbeDecodeModeForLevel(probeLevel)
{
	if (probeLevel === 2) return 'visibleNormal';
	if (probeLevel === 3) return 'visiblePosY';
	if (probeLevel === 4) return 'rayDirY';
	if (probeLevel === 5) return 'isRayExiting';
	if (probeLevel === 6) return 'cameraPosY';
	if (probeLevel === 7) return 'atlasRowCol';
	if (probeLevel === 8) return 'structuralIslandUv';
	if (probeLevel === 9) return 'structuralWorldPosition';
	if (probeLevel === 10) return 'eastWallWorldPosition';
	if (probeLevel === 11) return 'beamUnderRoute';
	if (probeLevel === 12) return 'beamUnderNormal';
	if (probeLevel === 13) return 'beamUnderWorldPosition';
	if (probeLevel === 14) return 'beamUnderHitObject';
	if (probeLevel === 15) return 'beamUnderDirectLight';
	if (probeLevel === 16) return 'beamUnderDirectFacing';
	if (probeLevel === 17) return 'southWindowSwColumnContinuityRoute';
	if (probeLevel === 18) return 'southWindowSwColumnContinuityNormal';
	if (probeLevel === 19) return 'southWindowSwColumnContinuityWorldPosition';
	if (probeLevel === 20) return 'southWindowSwColumnContinuityHitObject';
	if (probeLevel === 21) return 'southWindowSwColumnContinuityIndirectRadiance';
	if (probeLevel === 22) return 'westJoinRoute';
	if (probeLevel === 23) return 'westJoinNormal';
	if (probeLevel === 24) return 'westJoinWorldPosition';
	if (probeLevel === 25) return 'westJoinHitObject';
	if (probeLevel === 26) return 'westJoinIndirectRadiance';
	if (probeLevel === 27) return 'eastJoinRoute';
	if (probeLevel === 28) return 'joinCoverage';
	if (probeLevel === 29) return 'joinCutawayFlags';
	if (probeLevel === 30) return 'joinIndirectRadiance';
	if (probeLevel === 31) return 'northBeamRoute';
	if (probeLevel === 32) return 'northBeamWorldPosition';
	if (probeLevel === 33) return 'northBeamNormal';
	if (probeLevel === 34) return 'northBeamHitObject';
	if (probeLevel === 35) return 'northBeamCoverage';
	if (probeLevel === 36) return 'northBeamRadiance';
	if (probeLevel === 37) return 'hybridOwnerCountBitmask';
	if (probeLevel === 38) return 'hybridOwnerRouteSummary';
	if (probeLevel === 39) return 'hybridOwnerCoverage';
	if (probeLevel === 40) return 'hybridOwnerRadiance';
	if (probeLevel === 41) return 'hybridOwnerNormalRay';
	if (probeLevel === 42) return 'geometryBoxSummary';
	if (probeLevel === 43) return 'geometryBoxMin';
	if (probeLevel === 44) return 'geometryBoxMax';
	if (probeLevel === 45) return 'geometryWorldPosition';
	if (probeLevel === 46) return 'geometryNormal';
	if (probeLevel === 47) return 'geometrySouthCutawayState';
	if (probeLevel === 48) return 'geometrySouthCullInputs';
	return 'surfaceClass';
}

function decodeR7310C1RuntimeProbeSample(r, g, b, decodeMode)
{
	if (decodeMode === 'visibleNormal')
		return { x: r * 2 - 1, y: g * 2 - 1, z: b * 2 - 1 };
	if (decodeMode === 'visiblePosY')
		return { y: r * 0.10 - 0.05 };
	if (decodeMode === 'rayDirY')
		return { y: r * 2 - 1 };
	if (decodeMode === 'isRayExiting')
		return { isRayExiting: r > 0.5 };
	if (decodeMode === 'cameraPosY')
		return { y: r * 3.0 + 0.5 };
	if (decodeMode === 'atlasRowCol')
	{
		var atlasRes = pathTracingUniforms && pathTracingUniforms.uR7310C1RuntimeAtlasPatchResolution
			? pathTracingUniforms.uR7310C1RuntimeAtlasPatchResolution.value
			: 512;
		return { row: Math.round(r * atlasRes), col: Math.round(g * atlasRes), world: b };
	}
	if (decodeMode === 'structuralIslandUv')
		return { islandId: Math.round(r * 255), u: g, v: b };
	if (decodeMode === 'structuralWorldPosition')
		return { x: r, y: g, z: b };
	if (decodeMode === 'eastWallWorldPosition')
		return { x: r, y: g, z: b };
	if (decodeMode === 'beamUnderRoute')
	{
		var routeId = Math.round(r * 255);
		var structuralIslandId = Math.round(g * 255);
		var targetOffset = Math.round(b * 255);
		var routeNames = {
			0: 'none',
			1: 'west_beam_under_shadow_hybrid',
			2: 'east_beam_under_shadow_hybrid',
			3: 'west_beam_under_shadow_geometry_only',
			4: 'east_beam_under_shadow_geometry_only',
			5: 'west_beam_under_structural_island_only',
			6: 'east_beam_under_structural_island_only'
		};
		return {
			routeId: routeId,
			routeName: routeNames[routeId] || 'unknown',
			structuralIslandId: structuralIslandId,
			targetId: targetOffset > 0 ? 1000 + targetOffset : null
		};
	}
	if (decodeMode === 'beamUnderNormal')
		return { x: r * 2 - 1, y: g * 2 - 1, z: b * 2 - 1 };
	if (decodeMode === 'beamUnderWorldPosition')
		return { x: r * 4.4 - 2.2, y: g * 3.2 - 0.1, z: b * 5.4 - 2.1 };
	if (decodeMode === 'beamUnderHitObject')
	{
		var hitType = Math.round(r * 255);
		var objectIdLow = Math.round(g * 255);
		var objectIdHigh = Math.round(b * 255);
		return { hitType: hitType, objectID: objectIdHigh * 256 + objectIdLow };
	}
	if (decodeMode === 'beamUnderDirectLight')
		return {
			routeId: Math.round(r * 255),
			directLuma: g,
			pickedLightIndex: Math.round(b * 255) - 1
		};
	if (decodeMode === 'beamUnderDirectFacing')
		return {
			routeId: Math.round(r * 255),
			sourceFacingCos: g,
			zeroContributionClass: Math.round(b * 255)
		};
	if (decodeMode === 'southWindowSwColumnContinuityRoute')
	{
		var continuityRouteId = Math.round(r * 255);
		var continuityStructuralIslandId = Math.round(g * 255);
		var continuityTargetOffset = Math.round(b * 255);
		var continuityRouteNames = {
			0: 'none',
			1: 'sw_column_inner_shadow_hybrid',
			2: 'south_window_left_reveal_shadow_hybrid',
			3: 'sw_column_inner_shadow_geometry_only',
			4: 'south_window_left_reveal_shadow_geometry_only',
			5: 'sw_column_inner_structural_island_only',
			6: 'west_beam_inner_shadow_hybrid',
			7: 'west_beam_inner_shadow_geometry_only'
		};
		return {
			routeId: continuityRouteId,
			routeName: continuityRouteNames[continuityRouteId] || 'unknown',
			structuralIslandId: continuityStructuralIslandId,
			targetId: continuityTargetOffset > 0 ? 1000 + continuityTargetOffset : null
		};
	}
	if (decodeMode === 'southWindowSwColumnContinuityNormal')
		return { x: r * 2 - 1, y: g * 2 - 1, z: b * 2 - 1 };
	if (decodeMode === 'southWindowSwColumnContinuityWorldPosition')
		return { x: r * 4.4 - 2.2, y: g * 3.2 - 0.1, z: b * 5.4 - 2.1 };
	if (decodeMode === 'southWindowSwColumnContinuityHitObject')
	{
		var continuityHitType = Math.round(r * 255);
		var continuityObjectIdLow = Math.round(g * 255);
		var continuityObjectIdHigh = Math.round(b * 255);
		return { hitType: continuityHitType, objectID: continuityObjectIdHigh * 256 + continuityObjectIdLow };
	}
	if (decodeMode === 'southWindowSwColumnContinuityIndirectRadiance')
		return {
			r: r,
			g: g,
			b: b,
			luma: 0.2126 * r + 0.7152 * g + 0.0722 * b
		};
	if (decodeMode === 'westJoinRoute')
	{
		var westJoinRouteId = Math.round(r * 255);
		var westJoinStructuralIslandId = Math.round(g * 255);
		var westJoinTargetOffset = Math.round(b * 255);
		var westJoinRouteNames = {
			0: 'none',
			1: 'sw_column_north_shadow_hybrid',
			2: 'west_wall_full_hybrid',
			3: 'west_wall_beam_shadow_hybrid',
			4: 'sw_column_inner_shadow_hybrid',
			5: 'west_beam_inner_shadow_hybrid',
			6: 'west_beam_under_shadow_hybrid',
			7: 'structural_beam_column_only'
		};
		return {
			routeId: westJoinRouteId,
			routeName: westJoinRouteNames[westJoinRouteId] || 'unknown',
			structuralIslandId: westJoinStructuralIslandId,
			targetId: westJoinTargetOffset > 0 ? 1000 + westJoinTargetOffset : null
		};
	}
	if (decodeMode === 'westJoinNormal')
		return { x: r * 2 - 1, y: g * 2 - 1, z: b * 2 - 1 };
	if (decodeMode === 'westJoinWorldPosition')
		return { x: r * 4.4 - 2.2, y: g * 3.2 - 0.1, z: b * 5.4 - 2.1 };
	if (decodeMode === 'westJoinHitObject')
	{
		var westJoinHitType = Math.round(r * 255);
		var westJoinObjectIdLow = Math.round(g * 255);
		var westJoinObjectIdHigh = Math.round(b * 255);
		return { hitType: westJoinHitType, objectID: westJoinObjectIdHigh * 256 + westJoinObjectIdLow };
	}
	if (decodeMode === 'westJoinIndirectRadiance')
		return {
			r: r,
			g: g,
			b: b,
			luma: 0.2126 * r + 0.7152 * g + 0.0722 * b
		};
	if (decodeMode === 'eastJoinRoute')
	{
		var eastJoinRouteId = Math.round(r * 255);
		var eastJoinStructuralIslandId = Math.round(g * 255);
		var eastJoinTargetOffset = Math.round(b * 255);
		var eastJoinRouteNames = {
			0: 'none',
			1: 'se_column_north_shadow_hybrid',
			2: 'se_column_west_shadow_hybrid',
			3: 'east_wall_beam_shadow_hybrid',
			4: 'east_wall_full_hybrid',
			5: 'structural_beam_column_only'
		};
		return {
			routeId: eastJoinRouteId,
			routeName: eastJoinRouteNames[eastJoinRouteId] || 'unknown',
			structuralIslandId: eastJoinStructuralIslandId,
			targetId: eastJoinTargetOffset > 0 ? 1000 + eastJoinTargetOffset : null
		};
	}
	if (decodeMode === 'joinCoverage')
	{
		var coverageRouteId = Math.round(b * 255);
		var coverageRouteNames = {
			0: 'none',
			1: 'se_column_north_shadow_hybrid',
			2: 'se_column_west_shadow_hybrid',
			3: 'east_wall_beam_shadow_hybrid',
			4: 'east_wall_full_hybrid',
			5: 'sw_column_north_shadow_hybrid',
			6: 'west_wall_beam_shadow_hybrid',
			7: 'west_wall_full_hybrid',
			8: 'sw_column_inner_shadow_hybrid'
		};
		return {
			weightSum: r,
			validAlpha: g,
			routeId: coverageRouteId,
			routeName: coverageRouteNames[coverageRouteId] || 'unknown'
		};
	}
	if (decodeMode === 'joinCutawayFlags')
		return {
			xrayEnabled: r > 0.5,
			seColumnNorthHiddenByEastBeam: g > 0.5,
			seColumnInnerHiddenByBookshelf: b > 0.5
		};
	if (decodeMode === 'joinIndirectRadiance')
		return {
			r: r,
			g: g,
			b: b,
			luma: 0.2126 * r + 0.7152 * g + 0.0722 * b
		};
	if (decodeMode === 'northBeamRoute')
	{
		var northBeamRouteId = Math.round(r * 255);
		var northBeamStructuralIslandId = Math.round(g * 255);
		var northBeamTargetOffset = Math.round(b * 255);
		var northBeamRouteNames = {
			0: 'none',
			1: 'north_wall_hybrid',
			2: 'west_beam_inner_shadow_hybrid',
			3: 'west_beam_under_shadow_hybrid',
			4: 'east_beam_inner_shadow_hybrid',
			5: 'east_beam_under_shadow_hybrid',
			6: 'structural_beam_column_only'
		};
		return {
			routeId: northBeamRouteId,
			routeName: northBeamRouteNames[northBeamRouteId] || 'unknown',
			structuralIslandId: northBeamStructuralIslandId,
			targetId: northBeamTargetOffset > 0 ? 1000 + northBeamTargetOffset : null
		};
	}
	if (decodeMode === 'northBeamWorldPosition')
		return { x: r * 4.4 - 2.2, y: g * 3.2 - 0.1, z: b * 5.4 - 2.1 };
	if (decodeMode === 'northBeamNormal')
		return { x: r * 2 - 1, y: g * 2 - 1, z: b * 2 - 1 };
	if (decodeMode === 'northBeamHitObject')
	{
		var northBeamHitType = Math.round(r * 255);
		var northBeamObjectIdLow = Math.round(g * 255);
		var northBeamObjectIdHigh = Math.round(b * 255);
		return { hitType: northBeamHitType, objectID: northBeamObjectIdHigh * 256 + northBeamObjectIdLow };
	}
	if (decodeMode === 'northBeamCoverage')
	{
		var northBeamCoverageRouteId = Math.round(b * 255);
		var northBeamCoverageRouteNames = {
			0: 'none',
			1: 'north_wall_hybrid',
			2: 'west_beam_inner_shadow_hybrid',
			3: 'west_beam_under_shadow_hybrid',
			4: 'east_beam_inner_shadow_hybrid',
			5: 'east_beam_under_shadow_hybrid',
			6: 'structural_beam_column_only'
		};
		return {
			weightSum: r,
			validAlpha: g,
			routeId: northBeamCoverageRouteId,
			routeName: northBeamCoverageRouteNames[northBeamCoverageRouteId] || 'unknown'
		};
	}
	if (decodeMode === 'northBeamRadiance')
		return {
			r: r,
			g: g,
			b: b,
			luma: 0.2126 * r + 0.7152 * g + 0.0722 * b
		};
	if (decodeMode === 'hybridOwnerCountBitmask')
	{
		var ownerCount = Math.round(r * 255);
		var maskLow = Math.round(g * 255);
		var maskHigh = Math.round(b * 255);
		var decodedOwners = decodeR7310HybridOwnerMask(maskLow, maskHigh);
		return {
			ownerCount: ownerCount,
			maskLow: maskLow,
			maskHigh: maskHigh,
			owners: decodedOwners,
			encodingValid: r7310HybridOwnerEncodingIsSelfConsistent(ownerCount, maskLow, maskHigh, decodedOwners)
		};
	}
	if (decodeMode === 'hybridOwnerRouteSummary')
	{
		var firstTargetOffset = Math.round(r * 255);
		var secondTargetOffset = Math.round(g * 255);
		var summaryOwnerCount = Math.round(b * 255);
		return {
			firstTargetId: firstTargetOffset > 0 ? 1000 + firstTargetOffset : null,
			secondTargetId: secondTargetOffset > 0 ? 1000 + secondTargetOffset : null,
			ownerCount: summaryOwnerCount
		};
	}
	if (decodeMode === 'hybridOwnerCoverage')
	{
		var ownerCoverageRouteId = Math.round(b * 255);
		return {
			weightSum: r,
			validAlpha: g,
			routeId: ownerCoverageRouteId,
			routeName: r7310HybridOwnerRouteNameForTargetOffset(ownerCoverageRouteId)
		};
	}
	if (decodeMode === 'hybridOwnerRadiance')
		return {
			r: r,
			g: g,
			b: b,
			luma: 0.2126 * r + 0.7152 * g + 0.0722 * b
		};
	if (decodeMode === 'hybridOwnerNormalRay')
		return {
			isRayExiting: r > 0.5,
			visibleY: g * 0.10 - 0.05,
			rayDirY: b * 2 - 1
		};
	if (decodeMode === 'geometryBoxSummary')
		return {
			boxIdx: Math.round(r * 255) - 1,
			cullable: g * 8 - 1,
			hitType: Math.round(b * 255)
		};
	if (decodeMode === 'geometryBoxMin' || decodeMode === 'geometryBoxMax' || decodeMode === 'geometryWorldPosition')
		return { x: r * 4.4 - 2.2, y: g * 3.2 - 0.1, z: b * 5.4 - 2.1 };
	if (decodeMode === 'geometryNormal')
		return { x: r * 2 - 1, y: g * 2 - 1, z: b * 2 - 1 };
	if (decodeMode === 'geometrySouthCutawayState')
		return {
			xrayEnabled: r > 0.5,
			cameraSouth: g > 0.5,
			southWouldCull: b > 0.5
		};
	if (decodeMode === 'geometrySouthCullInputs')
		return {
			thinSouthCullInput: r > 0.5,
			largeSouthCullInput: g > 0.5,
			singleAxisCullable: b > 0.5
		};
	return { r: r, g: g, b: b };
}

function r7310HybridOwnerRouteNameForTargetOffset(targetOffset)
{
	var names = {
		1: 'floor',
		2: 'north_wall',
		3: 'east_wall',
		4: 'west_wall',
		6: 'ceiling',
		8: 'se_column_north_shadow',
		9: 'se_column_west_shadow',
		10: 'south_wall_ac_shadow',
		11: 'east_wall_beam_shadow',
		12: 'sw_column_north_shadow',
		13: 'west_wall_beam_shadow',
		14: 'sw_column_inner_shadow',
		15: 'west_beam_shadow',
		17: 'east_beam_shadow',
		19: 'south_window_side_or_bottom_reveal_shadow',
		22: 'south_window_top_reveal_shadow'
	};
	return names[targetOffset] || 'unknown';
}

function r7310HybridOwnerEncodingIsSelfConsistent(ownerCount, maskLow, maskHigh, owners)
{
	if (!Number.isFinite(ownerCount) || !Number.isFinite(maskLow) || !Number.isFinite(maskHigh))
		return false;
	if (ownerCount < 0 || ownerCount > 16)
		return false;
	if (maskLow < 0 || maskLow > 255 || maskHigh < 0 || maskHigh > 255)
		return false;
	if (!Array.isArray(owners) || owners.length !== ownerCount)
		return false;
	if (ownerCount === 0 && (maskLow !== 0 || maskHigh !== 0))
		return false;
	if (ownerCount > 0 && (maskLow === 0 && maskHigh === 0))
		return false;
	return true;
}

function decodeR7310HybridOwnerMask(maskLow, maskHigh)
{
	var owners = [];
	var lowBits = [
		{ bit: 1, name: 'floor', targetId: 1001 },
		{ bit: 2, name: 'ceiling', targetId: 1006 },
		{ bit: 4, name: 'north_wall', targetId: 1002 },
		{ bit: 8, name: 'east_wall', targetId: 1003 },
		{ bit: 16, name: 'west_wall', targetId: 1004 },
		{ bit: 32, name: 'east_beam_shadow', targetId: 1017 },
		{ bit: 64, name: 'west_beam_shadow', targetId: 1015 },
		{ bit: 128, name: 'south_window_top_reveal_shadow', targetId: 1022 }
	];
	var highBits = [
		{ bit: 1, name: 'se_column_north_shadow', targetId: 1008 },
		{ bit: 2, name: 'se_column_west_shadow', targetId: 1009 },
		{ bit: 4, name: 'south_wall_ac_shadow', targetId: 1010 },
		{ bit: 8, name: 'east_wall_beam_shadow', targetId: 1011 },
		{ bit: 16, name: 'sw_column_north_shadow', targetId: 1012 },
		{ bit: 32, name: 'west_wall_beam_shadow', targetId: 1013 },
		{ bit: 64, name: 'sw_column_inner_shadow', targetId: 1014 },
		{ bit: 128, name: 'south_window_side_or_bottom_reveal_shadow', targetId: 1019 }
	];
	lowBits.forEach(function(entry)
	{
		if ((maskLow & entry.bit) !== 0) owners.push(entry);
	});
	highBits.forEach(function(entry)
	{
		if ((maskHigh & entry.bit) !== 0) owners.push(entry);
	});
	return owners;
}

function normalizeR7310C1RuntimeProbeSamplePoints(options, width, height)
{
	var samplePoints = Array.isArray(options.samplePoints) ? options.samplePoints : [];
	var samplePointSpace = options.samplePointSpace === 'canvasCssPixel' ? 'canvasCssPixel' : 'renderTargetPixel';
	var canvas = renderer && renderer.domElement ? renderer.domElement : null;
	var dpr = window && Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
	var canvasHeight = canvas && Number.isFinite(canvas.clientHeight) && canvas.clientHeight > 0 ? canvas.clientHeight : height / Math.max(1, dpr);
	return samplePoints.map(function(point)
	{
		var sourceX = Number(point && point.x);
		var sourceY = Number(point && point.y);
		if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY))
			throw new Error('R7-3.10 runtime probe sample point must have finite x/y');
		var rtX = sourceX;
		var rtY = sourceY;
		if (samplePointSpace === 'canvasCssPixel')
		{
			rtX = sourceX * dpr;
			rtY = (canvasHeight - sourceY) * dpr;
		}
		rtX = Math.max(0, Math.min(width - 1, Math.round(rtX)));
		rtY = Math.max(0, Math.min(height - 1, Math.round(rtY)));
		return {
			name: point && typeof point.name === 'string' ? point.name : null,
			role: point && typeof point.role === 'string' ? point.role : null,
			x: sourceX,
			y: sourceY,
			rtPixel: { x: rtX, y: rtY }
		};
	});
}

window.reportR7310C1FullRoomDiffuseRuntimeProbe = async function(options)
{
	options = options || {};
	var requestedProbeLevel = Number(options.probeLevel);
	var probeLevel = Number.isFinite(requestedProbeLevel)
		? Math.max(1, Math.min(48, Math.round(requestedProbeLevel)))
		: 1;
	var samplePointSpace = options.samplePointSpace === 'canvasCssPixel' ? 'canvasCssPixel' : 'renderTargetPixel';
	var decodeMode = typeof options.decodeMode === 'string'
		? options.decodeMode
		: r7310C1RuntimeProbeDecodeModeForLevel(probeLevel);
	var timeout = normalizeR738PositiveInt(options.timeoutMs, 60000, 1000, 600000);
	var savedRuntimeEnabled = r7310C1FullRoomDiffuseRuntimeEnabled;
	var savedFloorRuntimeEnabled = r7310C1FloorDiffuseRuntimeEnabled;
	var savedNorthWallRuntimeEnabled = r7310C1NorthWallDiffuseRuntimeEnabled;
	var savedEastWallRuntimeEnabled = r7310C1EastWallDiffuseRuntimeEnabled;
	var savedWestWallRuntimeEnabled = r7310C1WestWallDiffuseRuntimeEnabled;
	var savedSouthWallRuntimeEnabled = r7310C1SouthWallDiffuseRuntimeEnabled;
	var savedCeilingRuntimeEnabled = r7310C1CeilingDiffuseRuntimeEnabled;
	var savedStructuralRuntimeEnabled = r7310C1StructuralDiffuseRuntimeEnabled;
	var savedSeColumnNorthShadowRuntimeEnabled = r7310C1SeColumnNorthShadowRuntimeEnabled;
	var savedSeColumnWestShadowRuntimeEnabled = r7310C1SeColumnWestShadowRuntimeEnabled;
	var savedSouthWallAcShadowRuntimeEnabled = r7310C1SouthWallAcShadowRuntimeEnabled;
	var savedSouthWindowLeftRevealShadowRuntimeEnabled = r7310C1SouthWindowLeftRevealShadowRuntimeEnabled;
	var savedSouthWindowRightRevealShadowRuntimeEnabled = r7310C1SouthWindowRightRevealShadowRuntimeEnabled;
	var savedSouthWindowBottomRevealShadowRuntimeEnabled = r7310C1SouthWindowBottomRevealShadowRuntimeEnabled;
	var savedSouthWindowTopRevealShadowRuntimeEnabled = r7310C1SouthWindowTopRevealShadowRuntimeEnabled;
	var state = captureR738BakeState();
	var target = null;
	var previous = null;
	var savedRenderTarget = renderer && renderer.getRenderTarget ? renderer.getRenderTarget() : null;
	try
	{
		await window.waitForR7310C1FullRoomDiffuseRuntimeReady(timeout);
		if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
		var renderReadyStart = performance.now();
		while (performance.now() - renderReadyStart < timeout)
		{
			if (renderer && pathTracingRenderTarget && pathTracingScene && worldCamera &&
				screenCopyScene && orthoCamera && pathTracingUniforms && screenCopyUniforms &&
				pathTracingMaterial && pathTracingMesh)
				break;
			await new Promise(function(resolve) { setTimeout(resolve, 100); });
		}
		if (!(renderer && pathTracingRenderTarget && pathTracingScene && worldCamera &&
			screenCopyScene && orthoCamera && pathTracingUniforms && screenCopyUniforms &&
			pathTracingMaterial && pathTracingMesh))
			throw new Error('R7-3.10 runtime render state did not become ready');
		if (Number.isFinite(Number(options.westWallBeamShadowZMaxOverride)) &&
			pathTracingUniforms &&
			pathTracingUniforms.uR7310C1WestWallBeamShadowZMaxOverride)
			pathTracingUniforms.uR7310C1WestWallBeamShadowZMaxOverride.value = Number(options.westWallBeamShadowZMaxOverride);
		if (typeof options.forceXrayEnabled === 'boolean' &&
			pathTracingUniforms &&
			pathTracingUniforms.uXrayEnabled)
			pathTracingUniforms.uXrayEnabled.value = options.forceXrayEnabled ? 1.0 : 0.0;
		if (options.cameraState && typeof window.setR739Config1ValidationCameraState === 'function')
			window.setR739Config1ValidationCameraState(options.cameraState);
		if (options.northWallCamera === true && !options.cameraState && typeof window.setR739Config1ValidationCameraState === 'function')
		{
			// 預設固定北牆相機；若 caller 同時給 options.cameraState（如 H5 黑線 probe 要對準東北衣櫃北牆面）則不覆蓋
			window.setR739Config1ValidationCameraState({
				name: 'r7310_north_wall_runtime_probe',
				position: { x: 0.0, y: 1.45, z: 0.8 },
				yaw: 0.0,
				pitch: 0.0,
				fov: 55
			});
		}
		if (options.eastWallCamera === true && !options.cameraState && typeof window.setR739Config1ValidationCameraState === 'function')
		{
			window.setR739Config1ValidationCameraState({
				name: 'r7310_east_wall_runtime_probe',
				position: { x: 0.25, y: 1.45, z: 0.55 },
				yaw: -1.57079632679,
				pitch: 0.0,
				fov: 55
			});
		}
		if (options.westWallCamera === true && !options.cameraState && typeof window.setR739Config1ValidationCameraState === 'function')
		{
			window.setR739Config1ValidationCameraState({
				name: 'r7310_west_wall_runtime_probe',
				position: { x: -0.25, y: 1.45, z: 0.55 },
				yaw: 1.57079632679,
				pitch: 0.0,
				fov: 55
			});
		}
		if (options.southWallCamera === true && !options.cameraState && typeof window.setR739Config1ValidationCameraState === 'function')
		{
			window.setR739Config1ValidationCameraState({
				name: 'r7310_south_wall_runtime_probe',
				position: { x: 0.0, y: 1.45, z: 1.25 },
				yaw: 3.14159265359,
				pitch: 0.0,
				fov: 55
			});
		}
		if (options.ceilingCamera === true && !options.cameraState && typeof window.setR739Config1ValidationCameraState === 'function')
		{
			window.setR739Config1ValidationCameraState({
				name: 'r7310_ceiling_runtime_probe',
				position: { x: 0.0, y: 1.25, z: 0.0 },
				yaw: 0.0,
				pitch: 1.10,
				fov: 70
			});
		}
		if (options.structuralCamera === true && !options.cameraState && typeof window.setR739Config1ValidationCameraState === 'function')
		{
			window.setR739Config1ValidationCameraState({
				name: 'r7310_structural_runtime_probe',
				position: { x: 0.0, y: 1.45, z: 1.05 },
				yaw: 3.14159265359,
				pitch: 0.0,
				fov: 70
			});
		}
		var allSurfaceProbe = options.allSurfaces === true;
		var specificSurfaceProbe = options.northWallCamera === true ||
			options.eastWallCamera === true ||
			options.westWallCamera === true ||
			options.southWallCamera === true ||
			options.ceilingCamera === true ||
			options.structuralCamera === true ||
			options.seColumnNorthShadowCamera === true ||
			options.seColumnWestShadowCamera === true;
		r7310C1FloorDiffuseRuntimeEnabled = allSurfaceProbe || (specificSurfaceProbe ? false : true);
		r7310C1NorthWallDiffuseRuntimeEnabled = allSurfaceProbe || options.northWallCamera === true;
		r7310C1EastWallDiffuseRuntimeEnabled = allSurfaceProbe || options.eastWallCamera === true;
			r7310C1WestWallDiffuseRuntimeEnabled = allSurfaceProbe || options.westWallCamera === true;
			r7310C1SouthWallDiffuseRuntimeEnabled = allSurfaceProbe || options.southWallCamera === true;
			r7310C1CeilingDiffuseRuntimeEnabled = allSurfaceProbe || options.ceilingCamera === true;
			r7310C1StructuralDiffuseRuntimeEnabled = allSurfaceProbe || options.structuralCamera === true;
			r7310C1SeColumnNorthShadowRuntimeEnabled = allSurfaceProbe || options.seColumnNorthShadowCamera === true;
			r7310C1SeColumnWestShadowRuntimeEnabled = allSurfaceProbe || options.seColumnWestShadowCamera === true;
		if (typeof options.forceFloorEnabled === 'boolean')
			r7310C1FloorDiffuseRuntimeEnabled = options.forceFloorEnabled;
		if (typeof options.forceCeilingEnabled === 'boolean')
			r7310C1CeilingDiffuseRuntimeEnabled = options.forceCeilingEnabled;
		if (typeof options.forceWestEnabled === 'boolean')
			r7310C1WestWallDiffuseRuntimeEnabled = options.forceWestEnabled;
		if (typeof options.forceSouthEnabled === 'boolean')
		{
			r7310C1SouthWallDiffuseRuntimeEnabled = options.forceSouthEnabled;
			r7310C1SouthWallAcShadowRuntimeEnabled = options.forceSouthEnabled;
			r7310C1SouthWindowLeftRevealShadowRuntimeEnabled = options.forceSouthEnabled;
			r7310C1SouthWindowRightRevealShadowRuntimeEnabled = options.forceSouthEnabled;
			r7310C1SouthWindowBottomRevealShadowRuntimeEnabled = options.forceSouthEnabled;
			r7310C1SouthWindowTopRevealShadowRuntimeEnabled = options.forceSouthEnabled;
		}
			r7310C1FullRoomDiffuseRuntimeEnabled = r7310C1AnyFullRoomDiffuseSurfaceEnabled();
		ensureR7310C1FullRoomDiffuseRuntimeLoading();
		var selectedReadyStart = performance.now();
		while (performance.now() - selectedReadyStart < timeout)
		{
			var selectedReady = true;
			if (r7310C1FloorDiffuseRuntimeEnabled) selectedReady = selectedReady && r7310C1FullRoomDiffuseRuntimeReady;
			if (r7310C1NorthWallDiffuseRuntimeEnabled) selectedReady = selectedReady && r7310C1NorthWallDiffuseRuntimeReady;
			if (r7310C1EastWallDiffuseRuntimeEnabled) selectedReady = selectedReady && r7310C1EastWallDiffuseRuntimeReady;
			if (r7310C1WestWallDiffuseRuntimeEnabled) selectedReady = selectedReady && r7310C1WestWallDiffuseRuntimeReady;
			if (r7310C1SouthWallDiffuseRuntimeEnabled) selectedReady = selectedReady && r7310C1SouthWallDiffuseRuntimeReady;
			if (r7310C1CeilingDiffuseRuntimeEnabled) selectedReady = selectedReady && r7310C1CeilingDiffuseRuntimeReady;
			if (r7310C1StructuralDiffuseRuntimeEnabled)
				selectedReady = selectedReady && (r7310C1StructuralDiffuseRuntimeReady || (r7310C1StructuralDiffuseRuntimePending && options.structuralPendingOk === true));
			if (r7310C1SeColumnNorthShadowRuntimeEnabled)
				selectedReady = selectedReady && (r7310C1SeColumnNorthShadowRuntimeReady || (r7310C1SeColumnNorthShadowRuntimePending && options.seColumnNorthShadowPendingOk === true));
			if (r7310C1SeColumnWestShadowRuntimeEnabled)
				selectedReady = selectedReady && (r7310C1SeColumnWestShadowRuntimeReady || (r7310C1SeColumnWestShadowRuntimePending && options.seColumnWestShadowPendingOk === true));
			if (selectedReady)
				break;
			await new Promise(function(resolve) { setTimeout(resolve, 100); });
		}
		if (r7310C1EastWallDiffuseRuntimeEnabled && !r7310C1EastWallDiffuseRuntimeReady)
			throw new Error('R7-3.10 east wall diffuse runtime package did not become ready');
		if (r7310C1WestWallDiffuseRuntimeEnabled && !r7310C1WestWallDiffuseRuntimeReady)
			throw new Error('R7-3.10 west wall diffuse runtime package did not become ready');
		if (r7310C1NorthWallDiffuseRuntimeEnabled && !r7310C1NorthWallDiffuseRuntimeReady)
			throw new Error('R7-3.10 north wall diffuse runtime package did not become ready');
		if (r7310C1SouthWallDiffuseRuntimeEnabled && !r7310C1SouthWallDiffuseRuntimeReady)
			throw new Error('R7-3.10 south wall diffuse runtime package did not become ready');
		if (r7310C1CeilingDiffuseRuntimeEnabled && !r7310C1CeilingDiffuseRuntimeReady)
			throw new Error('R7-3.10 ceiling diffuse runtime package did not become ready');
		if (r7310C1StructuralDiffuseRuntimeEnabled &&
			!r7310C1StructuralDiffuseRuntimeReady &&
			!(r7310C1StructuralDiffuseRuntimePending && options.structuralPendingOk === true))
			throw new Error('R7-3.10 structural diffuse runtime package did not become ready');
		if (r7310C1SeColumnNorthShadowRuntimeEnabled &&
			!r7310C1SeColumnNorthShadowRuntimeReady &&
			!(r7310C1SeColumnNorthShadowRuntimePending && options.seColumnNorthShadowPendingOk === true))
			throw new Error('R7-3.10 southeast column north shadow runtime package did not become ready');
		if (r7310C1SeColumnWestShadowRuntimeEnabled &&
			!r7310C1SeColumnWestShadowRuntimeReady &&
			!(r7310C1SeColumnWestShadowRuntimePending && options.seColumnWestShadowPendingOk === true))
			throw new Error('R7-3.10 southeast column west shadow runtime package did not become ready');
		if (r7310C1FloorDiffuseRuntimeEnabled && !r7310C1FullRoomDiffuseRuntimeReady)
			throw new Error('R7-3.10 floor diffuse runtime package did not become ready');
		if (pathTracingUniforms.uR739C1AccurateReflectionMode) pathTracingUniforms.uR739C1AccurateReflectionMode.value = 0.0;
		if (pathTracingUniforms.uR739C1ReflectionReferenceMode) pathTracingUniforms.uR739C1ReflectionReferenceMode.value = 0.0;
		if (pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode) pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value = 0.0;
		if (pathTracingUniforms.uR739C1ReflectionReady) pathTracingUniforms.uR739C1ReflectionReady.value = 0.0;
		updateR738C1BakePastePreviewUniforms();
		updateR7310C1FullRoomDiffuseRuntimeUniforms();
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var width = pathTracingRenderTarget.width;
		var height = pathTracingRenderTarget.height;
		target = createR738FloatRenderTarget(width, height);
		previous = createR738FloatRenderTarget(width, height);
		samplingPaused = true;
		cameraIsMoving = false;
		cameraRecentlyMoving = false;
		pathTracingUniforms.uR738C1BakeCaptureMode.value = 0;
		pathTracingUniforms.uR7310C1RuntimeProbeMode.value = probeLevel;
		updateR738C1BakePastePreviewUniforms();
		updateR7310C1FullRoomDiffuseRuntimeUniforms();
		pathTracingUniforms.tPreviousTexture.value = previous.texture;
		screenCopyUniforms.tPathTracedImageTexture.value = target.texture;
		renderer.setRenderTarget(target);
		renderer.clear();
		renderer.setRenderTarget(previous);
		renderer.clear();
		sampleCounter = 1.0;
		frameCounter = 2.0;
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uPreviousSampleCount.value = 1.0;
		pathTracingUniforms.uCameraIsMoving.value = false;
		var requestedRandomVec2 = options.randomVec2 || null;
		var probeRandomX = requestedRandomVec2 && Number.isFinite(Number(requestedRandomVec2.x))
			? Number(requestedRandomVec2.x)
			: Math.random();
		var probeRandomY = requestedRandomVec2 && Number.isFinite(Number(requestedRandomVec2.y))
			? Number(requestedRandomVec2.y)
			: Math.random();
		pathTracingUniforms.uRandomVec2.value.set(probeRandomX, probeRandomY);
		pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
		renderer.setRenderTarget(target);
		renderer.render(pathTracingScene, worldCamera);
		var readback = await readR738RenderTargetFloatPixels(target);
		var pixels = readback.pixels;
		var r7310ProbeSamples = normalizeR7310C1RuntimeProbeSamplePoints(options, readback.width, readback.height).map(function(point)
		{
			var index = (point.rtPixel.y * readback.width + point.rtPixel.x) * 4;
			var r = pixels[index];
			var g = pixels[index + 1];
			var b = pixels[index + 2];
			return {
				x: point.x,
				y: point.y,
				rtPixel: point.rtPixel,
				r: r,
				g: g,
				b: b,
				decoded: decodeR7310C1RuntimeProbeSample(r, g, b, decodeMode)
			};
		});
		var ownerCountSummary = null;
		if (decodeMode === 'hybridOwnerCountBitmask')
		{
			ownerCountSummary = {
				width: readback.width,
				height: readback.height,
				ownerPixelCount: 0,
				overlapPixelCount: 0,
				maxOwnerCount: 0,
				rawOwnerPixelCount: 0,
				rawOverlapPixelCount: 0,
				rawMaxOwnerCount: 0,
				invalidEncodingPixelCount: 0,
				overlapSamples: []
			};
			for (var ownerPixelIndex = 0; ownerPixelIndex < pixels.length; ownerPixelIndex += 4)
			{
				var ownerCount = Math.round(pixels[ownerPixelIndex] * 255);
				var ownerMaskLow = Math.round(pixels[ownerPixelIndex + 1] * 255);
				var ownerMaskHigh = Math.round(pixels[ownerPixelIndex + 2] * 255);
				var ownerMaskOwners = decodeR7310HybridOwnerMask(ownerMaskLow, ownerMaskHigh);
				if (ownerCount <= 0)
					continue;
				ownerCountSummary.rawOwnerPixelCount += 1;
				if (ownerCount > ownerCountSummary.rawMaxOwnerCount)
					ownerCountSummary.rawMaxOwnerCount = ownerCount;
				if (ownerCount >= 2)
					ownerCountSummary.rawOverlapPixelCount += 1;
				if (!r7310HybridOwnerEncodingIsSelfConsistent(ownerCount, ownerMaskLow, ownerMaskHigh, ownerMaskOwners))
				{
					ownerCountSummary.invalidEncodingPixelCount += 1;
					continue;
				}
				ownerCountSummary.ownerPixelCount += 1;
				if (ownerCount > ownerCountSummary.maxOwnerCount)
					ownerCountSummary.maxOwnerCount = ownerCount;
				if (ownerCount >= 2)
				{
					var flatPixel = ownerPixelIndex / 4;
					var px = flatPixel % readback.width;
					var py = Math.floor(flatPixel / readback.width);
					ownerCountSummary.overlapPixelCount += 1;
					if (ownerCountSummary.overlapSamples.length < 64)
					{
						ownerCountSummary.overlapSamples.push({
							rtPixel: { x: px, y: py },
							ownerCount: ownerCount,
							maskLow: ownerMaskLow,
							maskHigh: ownerMaskHigh,
							owners: ownerMaskOwners
						});
					}
				}
			}
		}
		var shortCircuitCount = 0;
		var northWallShortCircuitCount = 0;
		var eastWallShortCircuitCount = 0;
		var westWallShortCircuitCount = 0;
		var southWallShortCircuitCount = 0;
		var southRevealShortCircuitCount = 0;
		var ceilingShortCircuitCount = 0;
		var structuralShortCircuitCount = 0;
		var structuralIslandHitByName = {};
		var structuralIslandShortCircuitByName = {};
		for (var islandIndex = 0; islandIndex < R7310_C1_STRUCTURAL_ISLANDS.length; islandIndex += 1)
		{
			structuralIslandHitByName[R7310_C1_STRUCTURAL_ISLANDS[islandIndex].name] = 0;
			structuralIslandShortCircuitByName[R7310_C1_STRUCTURAL_ISLANDS[islandIndex].name] = 0;
		}
		for (var i = 0; i < pixels.length; i += 4)
		{
			if (pixels[i] < 0.25 && pixels[i + 1] > 0.75 && pixels[i + 2] < 0.25)
				shortCircuitCount += 1;
			if (pixels[i] < 0.25 && pixels[i + 1] > 0.75 && pixels[i + 2] > 0.75)
				northWallShortCircuitCount += 1;
			if (pixels[i] > 0.75 && pixels[i + 1] < 0.25 && pixels[i + 2] > 0.75)
				eastWallShortCircuitCount += 1;
			if (pixels[i] > 0.75 && pixels[i + 1] > 0.75 && pixels[i + 2] < 0.25)
				westWallShortCircuitCount += 1;
			if (pixels[i] < 0.25 && pixels[i + 1] < 0.25 && pixels[i + 2] > 0.75)
			{
				southWallShortCircuitCount += 1;
				southRevealShortCircuitCount += 1;
			}
			if (pixels[i] > 0.75 && pixels[i + 1] > 0.75 && pixels[i + 2] > 0.75)
				ceilingShortCircuitCount += 1;
			if (pixels[i] > 0.75 && pixels[i + 1] < 0.25 && pixels[i + 2] < 0.25)
				structuralShortCircuitCount += 1;
		}
		var hitCount = surfaceClassSummary && Number.isFinite(surfaceClassSummary.floor) ? surfaceClassSummary.floor : 0;
		var northWallHitCount = surfaceClassSummary && Number.isFinite(surfaceClassSummary.wall) ? surfaceClassSummary.wall : 0;
		var eastWallHitCount = surfaceClassSummary && Number.isFinite(surfaceClassSummary.wall) ? surfaceClassSummary.wall : 0;
		var westWallHitCount = surfaceClassSummary && Number.isFinite(surfaceClassSummary.wall) ? surfaceClassSummary.wall : 0;
		var southWallHitCount = surfaceClassSummary && Number.isFinite(surfaceClassSummary.wall) ? surfaceClassSummary.wall : 0;
		var ceilingHitCount = surfaceClassSummary && Number.isFinite(surfaceClassSummary.ceiling) ? surfaceClassSummary.ceiling : 0;
		var structuralHitCount = surfaceClassSummary && Number.isFinite(surfaceClassSummary.wall) ? surfaceClassSummary.wall : 0;
		if (surfaceClassSummary && Number.isFinite(surfaceClassSummary.object))
			structuralHitCount += surfaceClassSummary.object;
		var status = options.eastWallCamera === true
			? (eastWallHitCount > 0 && eastWallShortCircuitCount > 0 ? 'pass' : 'fail')
			: (options.westWallCamera === true
			? (westWallHitCount > 0 && westWallShortCircuitCount > 0 ? 'pass' : 'fail')
			: (options.northWallCamera === true
			? (northWallHitCount > 0 && northWallShortCircuitCount > 0 ? 'pass' : 'fail')
			: (options.southWallCamera === true
			? (southWallHitCount > 0 && southWallShortCircuitCount > 0 ? 'pass' : 'fail')
			: (options.ceilingCamera === true
			? (ceilingHitCount > 0 && ceilingShortCircuitCount > 0 ? 'pass' : 'fail')
			: (options.structuralCamera === true
			? ((r7310C1StructuralDiffuseRuntimePending && options.structuralPendingOk === true) || (structuralHitCount > 0 && structuralShortCircuitCount > 0) ? 'pass' : 'fail')
			: (hitCount > 0 && shortCircuitCount > 0 ? 'pass' : 'fail'))))));
		if (probeLevel > 1)
		{
			var finiteProbeSamples = r7310ProbeSamples.every(function(sample)
			{
				return Number.isFinite(sample.r) && Number.isFinite(sample.g) && Number.isFinite(sample.b);
			});
			status = r7310ProbeSamples.length > 0 && finiteProbeSamples ? 'pass' : 'fail';
		}
		// R7-3.10 H5 / H3' 黑線專項 Part 2：level 7 全圖 wardrobe 邊界 row 統計（probe-only，不影響 level 1~6）。
		// shader level 7：R=row/512、G=col/512、B=hit world 座標 raw（floor=z / north=y）。
		var h5BlackLineProbe = null;
		if (probeLevel === 7)
		{
			var isNorthProbe = options.northWallCamera === true;
			var probeRes = pathTracingUniforms.uR7310C1RuntimeAtlasPatchResolution
				? pathTracingUniforms.uR7310C1RuntimeAtlasPatchResolution.value : 512;
			// wardrobe 可見邊界帶：floor zMax≈-0.703 ±12mm；north yMax≈1.955 ±12mm
			var boundaryCenter = isNorthProbe ? 1.955 : -0.703;
			var bandLo = boundaryCenter - 0.030;
			var bandHi = boundaryCenter + 0.030;
			// wardrobe X 對應 atlas col 帶：floor / north 同 uv (x+2.11)/4.22；x∈[1.35,1.91]→col≈419..487
			var colLo = 410;
			var colHi = 495;
			var rowHist = {};
			var totalInBand = 0;
			var worldMinAll = Infinity;
			var worldMaxAll = -Infinity;
			for (var p = 0; p < pixels.length; p += 4)
			{
				var pr = pixels[p];
				var pg = pixels[p + 1];
				var pb = pixels[p + 2];
				if (!Number.isFinite(pr) || !Number.isFinite(pg) || !Number.isFinite(pb))
					continue;
				if (pr === 0 && pg === 0 && pb === 0)
					continue; // 非 short-circuit 命中像素
				if (pb < bandLo || pb > bandHi)
					continue; // 不在 wardrobe 可見邊界帶
				var rowIdx = Math.round(pr * probeRes);
				var colIdx = Math.round(pg * probeRes);
				if (colIdx < colLo || colIdx > colHi)
					continue; // 不在 wardrobe X 對應 atlas col 帶
				totalInBand += 1;
				if (pb < worldMinAll) worldMinAll = pb;
				if (pb > worldMaxAll) worldMaxAll = pb;
				if (!rowHist[rowIdx])
					rowHist[rowIdx] = { count: 0, worldMin: Infinity, worldMax: -Infinity };
				rowHist[rowIdx].count += 1;
				if (pb < rowHist[rowIdx].worldMin) rowHist[rowIdx].worldMin = pb;
				if (pb > rowHist[rowIdx].worldMax) rowHist[rowIdx].worldMax = pb;
			}
			var rowEntries = Object.keys(rowHist).map(function(k)
			{
				return {
					row: Number(k),
					count: rowHist[k].count,
					worldMin: rowHist[k].worldMin,
					worldMax: rowHist[k].worldMax
				};
			}).sort(function(a, b) { return b.count - a.count; });
			h5BlackLineProbe = {
				surface: isNorthProbe ? 'north' : 'floor',
				boundaryCenter: boundaryCenter,
				boundaryBand: [bandLo, bandHi],
				colBand: [colLo, colHi],
				atlasResolution: probeRes,
				totalFragmentsInBand: totalInBand,
				worldRangeInBand: totalInBand > 0 ? [worldMinAll, worldMaxAll] : null,
				dominantRow: rowEntries.length > 0 ? rowEntries[0].row : null,
				rowHistogram: rowEntries
			};
		}
		var structuralProbeSamples = r7310ProbeSamples;
		for (var structuralSampleIndex = 0; structuralSampleIndex < structuralProbeSamples.length; structuralSampleIndex += 1)
		{
			var decodedStructuralSample = structuralProbeSamples[structuralSampleIndex].decoded || {};
			var decodedIslandId = Math.round(Number(decodedStructuralSample.islandId) || 0);
			var decodedIsland = R7310_C1_STRUCTURAL_ISLANDS[decodedIslandId - 1];
			if (!decodedIsland) continue;
			structuralIslandHitByName[decodedIsland.name] += 1;
			structuralIslandShortCircuitByName[decodedIsland.name] += 1;
		}
		var structuralProbePasses = r7310C1StructuralDiffuseRuntimePending && options.structuralPendingOk === true
			? true
			: (options.structuralCamera === true
				? structuralShortCircuitCount > 0 || (probeLevel > 1 && r7310ProbeSamples.length > 0)
				: null);
		var structuralIslandUv = probeLevel === 8 ? r7310ProbeSamples.map(function(sample) { return sample.decoded; }) : [];
		var structuralWorldPosition = probeLevel === 9 ? r7310ProbeSamples.map(function(sample) { return sample.decoded; }) : [];
		return {
			version: 'r7-3-10-c1-full-room-diffuse-runtime-probe',
			config: 1,
			probeTarget: options.eastWallCamera === true ? 'east_wall' : (options.westWallCamera === true ? 'west_wall' : (options.northWallCamera === true ? 'north_wall' : (options.southWallCamera === true ? 'south_wall' : (options.ceilingCamera === true ? 'ceiling' : (options.structuralCamera === true ? 'structural_beams_columns' : (options.seColumnWestShadowCamera === true ? 'se_column_west_shadow' : (options.seColumnNorthShadowCamera === true ? 'se_column_north_shadow' : 'floor'))))))),
			enabled: true,
			floorEnabled: r7310C1FloorDiffuseRuntimeEnabled,
			northWallEnabled: r7310C1NorthWallDiffuseRuntimeEnabled,
			eastWallEnabled: r7310C1EastWallDiffuseRuntimeEnabled,
				westWallEnabled: r7310C1WestWallDiffuseRuntimeEnabled,
				southWallEnabled: r7310C1SouthWallDiffuseRuntimeEnabled,
				ceilingEnabled: r7310C1CeilingDiffuseRuntimeEnabled,
				structuralEnabled: r7310C1StructuralDiffuseRuntimeEnabled,
				seColumnNorthShadowEnabled: r7310C1SeColumnNorthShadowRuntimeEnabled,
				seColumnWestShadowEnabled: r7310C1SeColumnWestShadowRuntimeEnabled,
				structuralPending: r7310C1StructuralDiffuseRuntimePending,
			ready: r7310C1FullRoomDiffuseRuntimeReady,
			applied: updateR7310C1FullRoomDiffuseRuntimeUniforms(),
			packageDir: r7310C1FullRoomDiffuseRuntimePackage ? r7310C1FullRoomDiffuseRuntimePackage.packageDir : null,
			northWallPackageDir: r7310C1NorthWallDiffuseRuntimePackage ? r7310C1NorthWallDiffuseRuntimePackage.packageDir : null,
			eastWallPackageDir: r7310C1EastWallDiffuseRuntimePackage ? r7310C1EastWallDiffuseRuntimePackage.packageDir : null,
				westWallPackageDir: r7310C1WestWallDiffuseRuntimePackage ? r7310C1WestWallDiffuseRuntimePackage.packageDir : null,
				southWallPackageDir: r7310C1SouthWallDiffuseRuntimePackage ? r7310C1SouthWallDiffuseRuntimePackage.packageDir : null,
				ceilingPackageDir: r7310C1CeilingDiffuseRuntimePackage ? r7310C1CeilingDiffuseRuntimePackage.packageDir : null,
				structuralPackageDir: r7310C1StructuralDiffuseRuntimePackage ? r7310C1StructuralDiffuseRuntimePackage.packageDir : null,
				seColumnNorthShadowPackageDir: r7310C1SeColumnNorthShadowRuntimePackage ? r7310C1SeColumnNorthShadowRuntimePackage.packageDir : null,
				seColumnWestShadowPackageDir: r7310C1SeColumnWestShadowRuntimePackage ? r7310C1SeColumnWestShadowRuntimePackage.packageDir : null,
			bakedSurfaceHitCount: hitCount,
			bakedSurfaceShortCircuitCount: shortCircuitCount,
			northWallSurfaceHitCount: northWallHitCount,
			northWallShortCircuitCount: northWallShortCircuitCount,
			eastWallSurfaceHitCount: eastWallHitCount,
			eastWallShortCircuitCount: eastWallShortCircuitCount,
			westWallSurfaceHitCount: westWallHitCount,
			westWallShortCircuitCount: westWallShortCircuitCount,
			southWallSurfaceHitCount: southWallHitCount,
			southWallShortCircuitCount: southWallShortCircuitCount,
			southRevealShortCircuitCount: southRevealShortCircuitCount,
			southRevealProbeSamples: r7310ProbeSamples,
			ceilingSurfaceHitCount: ceilingHitCount,
			ceilingShortCircuitCount: ceilingShortCircuitCount,
			structuralSurfaceHitCount: structuralHitCount,
			structuralShortCircuitCount: structuralShortCircuitCount,
			structuralIslandHitByName: structuralIslandHitByName,
			structuralIslandShortCircuitByName: structuralIslandShortCircuitByName,
			structuralProbeSamples: structuralProbeSamples,
			structuralProbePasses: structuralProbePasses,
			structuralIslandUv: structuralIslandUv,
			structuralWorldPosition: structuralWorldPosition,
			probeLevel: probeLevel,
			samplePointSpace: samplePointSpace,
			decodeMode: decodeMode,
			samplePoints: r7310ProbeSamples,
			ownerCountSummary: ownerCountSummary,
			status: status,
			surfaceClassSummary: surfaceClassSummary,
			probePixels: readback.width * readback.height,
			h5BlackLineProbe: h5BlackLineProbe,
			uniformWestWallBeamShadowZMaxOverride: pathTracingUniforms && pathTracingUniforms.uR7310C1WestWallBeamShadowZMaxOverride ? pathTracingUniforms.uR7310C1WestWallBeamShadowZMaxOverride.value : null,
			currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0)
		};
	}
	finally
	{
		if (pathTracingUniforms && pathTracingUniforms.uR7310C1RuntimeProbeMode)
			pathTracingUniforms.uR7310C1RuntimeProbeMode.value = 0.0;
		r7310C1FullRoomDiffuseRuntimeEnabled = savedRuntimeEnabled;
		r7310C1FloorDiffuseRuntimeEnabled = savedFloorRuntimeEnabled;
		r7310C1NorthWallDiffuseRuntimeEnabled = savedNorthWallRuntimeEnabled;
		r7310C1EastWallDiffuseRuntimeEnabled = savedEastWallRuntimeEnabled;
			r7310C1WestWallDiffuseRuntimeEnabled = savedWestWallRuntimeEnabled;
			r7310C1SouthWallDiffuseRuntimeEnabled = savedSouthWallRuntimeEnabled;
			r7310C1CeilingDiffuseRuntimeEnabled = savedCeilingRuntimeEnabled;
			r7310C1StructuralDiffuseRuntimeEnabled = savedStructuralRuntimeEnabled;
			r7310C1SeColumnNorthShadowRuntimeEnabled = savedSeColumnNorthShadowRuntimeEnabled;
			r7310C1SeColumnWestShadowRuntimeEnabled = savedSeColumnWestShadowRuntimeEnabled;
		r7310C1SouthWallAcShadowRuntimeEnabled = savedSouthWallAcShadowRuntimeEnabled;
		r7310C1SouthWindowLeftRevealShadowRuntimeEnabled = savedSouthWindowLeftRevealShadowRuntimeEnabled;
		r7310C1SouthWindowRightRevealShadowRuntimeEnabled = savedSouthWindowRightRevealShadowRuntimeEnabled;
		r7310C1SouthWindowBottomRevealShadowRuntimeEnabled = savedSouthWindowBottomRevealShadowRuntimeEnabled;
		r7310C1SouthWindowTopRevealShadowRuntimeEnabled = savedSouthWindowTopRevealShadowRuntimeEnabled;
		restoreR738BakeState(state);
		if (savedRenderTarget && renderer) renderer.setRenderTarget(savedRenderTarget);
		if (target) target.dispose();
		if (previous) previous.dispose();
	}
};

// R7-3.10 Phase 2 H7' / sprout-paste-inside-guard probe helpers。
// guard 已落在 shader 外層條件；這裡保留 readback helper 供迴歸檢查。
function r738C1SproutPasteProbeDecodeModeForLevel(probeLevel)
{
	if (probeLevel === 2) return 'firstVisibleNormal';
	if (probeLevel === 3) return 'firstVisiblePosY';
	if (probeLevel === 4) return 'firstVisibleIsRayExiting';
	if (probeLevel === 5) return 'firstVisibleHitObject';
	if (probeLevel === 6) return 'cameraPosY';
	return 'pasteSurfaceClass';
}

function decodeR738C1SproutPasteProbeSample(r, g, b, decodeMode)
{
	if (decodeMode === 'firstVisibleNormal')
		return { x: r * 2 - 1, y: g * 2 - 1, z: b * 2 - 1 };
	if (decodeMode === 'firstVisiblePosY')
		return { y: r * 0.10 - 0.05 };
	if (decodeMode === 'firstVisibleIsRayExiting')
		return { firstVisibleIsRayExiting: r > 0.5 };
	if (decodeMode === 'firstVisibleHitObject')
	{
		var hitType = Math.round(r * 255);
		var objectIdLow = Math.round(g * 255);
		var objectIdHigh = Math.round(b * 255);
		return { hitType: hitType, objectID: objectIdHigh * 256 + objectIdLow };
	}
	if (decodeMode === 'cameraPosY')
		return { y: r * 5.0 - 1.0 };
	return { r: r, g: g, b: b };
}

window.reportR738C1SproutPasteRuntimeProbe = async function(options)
{
	options = options || {};
	var requestedProbeLevel = Number(options.probeLevel);
	var probeLevel = Number.isFinite(requestedProbeLevel)
		? Math.max(0, Math.min(6, Math.round(requestedProbeLevel)))
		: 1;
	var samplePointSpace = options.samplePointSpace === 'canvasCssPixel' ? 'canvasCssPixel' : 'renderTargetPixel';
	var decodeMode = typeof options.decodeMode === 'string'
		? options.decodeMode
		: r738C1SproutPasteProbeDecodeModeForLevel(probeLevel);
	var timeout = normalizeR738PositiveInt(options.timeoutMs, 60000, 1000, 600000);
	var savedFloorRuntime = r7310C1FloorDiffuseRuntimeEnabled;
	var savedNorthRuntime = r7310C1NorthWallDiffuseRuntimeEnabled;
	var savedFullRuntime = r7310C1FullRoomDiffuseRuntimeEnabled;
	var savedSpacePasteEnabled = r738C1BakePastePreviewEnabled;
	var state = captureR738BakeState();
	var target = null;
	var previous = null;
	var savedRenderTarget = renderer && renderer.getRenderTarget ? renderer.getRenderTarget() : null;
	try
	{
		if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
		if (options.cameraState && typeof window.setR739Config1ValidationCameraState === 'function')
			window.setR739Config1ValidationCameraState(options.cameraState);
		// 強制條件：paste preview 開、floor / north runtime 全關（避免 H8 互斥把 paste 關掉）
		r7310C1FloorDiffuseRuntimeEnabled = false;
		r7310C1NorthWallDiffuseRuntimeEnabled = false;
		r7310C1FullRoomDiffuseRuntimeEnabled = false;
		r738C1BakePastePreviewEnabled = true;
		// 等 paste preview ready
		var spaceReadyStart = performance.now();
		while (performance.now() - spaceReadyStart < timeout)
		{
			if (r738C1BakePastePreviewReady)
				break;
			await new Promise(function(resolve) { setTimeout(resolve, 100); });
		}
		if (!r738C1BakePastePreviewReady)
			throw new Error('R7-3.8 sprout paste preview did not become ready');
		updateR738C1BakePastePreviewUniforms();
		updateR7310C1FullRoomDiffuseRuntimeUniforms();
		var width = pathTracingRenderTarget.width;
		var height = pathTracingRenderTarget.height;
		target = createR738FloatRenderTarget(width, height);
		previous = createR738FloatRenderTarget(width, height);
		samplingPaused = true;
		cameraIsMoving = false;
		cameraRecentlyMoving = false;
		pathTracingUniforms.uR738C1BakeCaptureMode.value = 0;
		pathTracingUniforms.uR738C1SproutPasteProbeMode.value = probeLevel;
		updateR738C1BakePastePreviewUniforms();
		updateR7310C1FullRoomDiffuseRuntimeUniforms();
		pathTracingUniforms.tPreviousTexture.value = previous.texture;
		screenCopyUniforms.tPathTracedImageTexture.value = target.texture;
		renderer.setRenderTarget(target);
		renderer.clear();
		renderer.setRenderTarget(previous);
		renderer.clear();
		sampleCounter = 1.0;
		frameCounter = 2.0;
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uPreviousSampleCount.value = 1.0;
		pathTracingUniforms.uCameraIsMoving.value = false;
		pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());
		pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
		// H7' guard / L6 probe 依賴 uCamPos；render loop 每幀才同步 uCamPos，
		// 此 single-frame probe render 不經 render loop，需在此主動同步到 worldCamera 世界位置，
		// 否則 guard 會讀到上一個 probe case 殘留的相機位置。
		if (pathTracingUniforms.uCamPos && pathTracingUniforms.uCamPos.value && worldCamera)
		{
			worldCamera.updateMatrixWorld(true);
			pathTracingUniforms.uCamPos.value.setFromMatrixPosition(worldCamera.matrixWorld);
		}
		renderer.setRenderTarget(target);
		renderer.render(pathTracingScene, worldCamera);
		var readback = await readR738RenderTargetFloatPixels(target);
		var pixels = readback.pixels;
		var probeSamples = normalizeR7310C1RuntimeProbeSamplePoints(options, readback.width, readback.height).map(function(point)
		{
			var index = (point.rtPixel.y * readback.width + point.rtPixel.x) * 4;
			var r = pixels[index];
			var g = pixels[index + 1];
			var b = pixels[index + 2];
			return {
				x: point.x,
				y: point.y,
				rtPixel: point.rtPixel,
				r: r,
				g: g,
				b: b,
				decoded: decodeR738C1SproutPasteProbeSample(r, g, b, decodeMode)
			};
		});
		// 統計：L1 surface class — 紅色像素 = 通過 paste 條件的 fragment 數
		// 統計：L4 isRayExiting — 紅色像素 = paste 路徑中 firstVisibleIsRayExiting=TRUE 的 fragment 數
		var pastePassCount = 0;
		var rayExitingTrueCount = 0;
		if (probeLevel === 1)
		{
			for (var i = 0; i < pixels.length; i += 4)
			{
				if (pixels[i] > 0.75 && pixels[i + 1] < 0.25 && pixels[i + 2] < 0.25)
					pastePassCount += 1;
			}
		}
		else if (probeLevel === 4)
		{
			for (var j = 0; j < pixels.length; j += 4)
			{
				if (pixels[j] > 0.75 && pixels[j + 1] < 0.25 && pixels[j + 2] < 0.25)
					rayExitingTrueCount += 1;
			}
		}
		var status = probeSamples.length > 0
			? (probeSamples.every(function(s) { return Number.isFinite(s.r) && Number.isFinite(s.g) && Number.isFinite(s.b); }) ? 'pass' : 'fail')
			: 'fail';
		return {
			version: 'r7-3-8-c1-sprout-paste-probe',
			config: 1,
			probeLevel: probeLevel,
			samplePointSpace: samplePointSpace,
			decodeMode: decodeMode,
			samplePoints: probeSamples,
			pastePassCount: pastePassCount,
			rayExitingTrueCount: rayExitingTrueCount,
			probePixels: readback.width * readback.height,
			spacePasteEnabled: r738C1BakePastePreviewEnabled,
			spacePasteReady: r738C1BakePastePreviewReady,
			spacePasteUniformMode: pathTracingUniforms.uR738C1BakePastePreviewMode ? pathTracingUniforms.uR738C1BakePastePreviewMode.value : null,
			spacePasteUniformReady: pathTracingUniforms.uR738C1BakePastePreviewReady ? pathTracingUniforms.uR738C1BakePastePreviewReady.value : null,
			sproutPasteProbeMode: pathTracingUniforms.uR738C1SproutPasteProbeMode ? pathTracingUniforms.uR738C1SproutPasteProbeMode.value : null,
			currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0),
			status: status
		};
	}
	finally
	{
		if (pathTracingUniforms && pathTracingUniforms.uR738C1SproutPasteProbeMode)
			pathTracingUniforms.uR738C1SproutPasteProbeMode.value = 0.0;
		r7310C1FloorDiffuseRuntimeEnabled = savedFloorRuntime;
		r7310C1NorthWallDiffuseRuntimeEnabled = savedNorthRuntime;
		r7310C1FullRoomDiffuseRuntimeEnabled = savedFullRuntime;
		r738C1BakePastePreviewEnabled = savedSpacePasteEnabled;
		restoreR738BakeState(state);
		if (savedRenderTarget && renderer) renderer.setRenderTarget(savedRenderTarget);
		if (target) target.dispose();
		if (previous) previous.dispose();
	}
};

window.reportHomeStudioHibernationLoopState = function()
{
	var maxSamples = (typeof userSppCap === 'number') ? userSppCap : null;
	var currentSamples = Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0);
	return {
		version: 'r7-3-9-c1-floor-reflection-roughness-v1',
		sleeping: !!homeStudioAnimationSleeping,
		framePending: !!homeStudioAnimationFrameId,
		samplingPaused: !!samplingPaused,
		cameraIsMoving: !!cameraIsMoving,
		postProcessChanged: !!postProcessChanged,
		sceneParamsChanged: !!sceneParamsChanged,
		samplingStepOnceRequested: !!samplingStepOnceRequested,
		currentSamples: currentSamples,
		maxSamples: maxSamples,
		renderLimitReached: maxSamples !== null && currentSamples >= maxSamples
	};
};

function updateMovementPreviewUniforms(activeCameraMoving)
{
	var mode = movementPreviewActive(activeCameraMoving) ? 1.0 : 0.0;
	movementPreviewLastMode = mode;
	if (pathTracingUniforms && pathTracingUniforms.uMovementPreviewMode)
		pathTracingUniforms.uMovementPreviewMode.value = mode;
}

function invalidateMovementProtectionStableFrame(reason)
{
	movementProtectionStableReady = false;
	movementProtectionLastCaptureSamples = 0;
	movementProtectionLastBlend = 0.0;
	movementProtectionLastPreviewStrength = 0.0;
	movementProtectionLastSpatialPreviewStrength = 0.0;
	movementProtectionLastWidePreviewStrength = 0.0;
	movementProtectionLastInvalidationReason = reason || 'unknown';
	updateMovementPreviewUniforms(false);
	updateMovementProtectionUniforms(false);
}

function updateMovementProtectionUniforms(activeCameraMoving)
{
	if (!screenOutputUniforms) return;
	var configAllowed = movementProtectionConfigAllowed();
	var enabled = movementProtectionEnabled && movementProtectionStableReady && configAllowed;
	var blend = enabled && activeCameraMoving ? movementProtectionMovingBlend : 0.0;
	var previewStrength = movementProtectionEnabled && configAllowed && activeCameraMoving ? movementProtectionLowSppPreviewStrength : 0.0;
	var spatialPreviewStrength = movementProtectionEnabled && configAllowed && activeCameraMoving ? movementProtectionSpatialPreviewStrength : 0.0;
	var widePreviewStrength = movementProtectionEnabled && configAllowed && activeCameraMoving ? movementProtectionWidePreviewStrength : 0.0;
	movementProtectionLastBlend = blend;
	movementProtectionLastPreviewStrength = previewStrength;
	movementProtectionLastSpatialPreviewStrength = spatialPreviewStrength;
	movementProtectionLastWidePreviewStrength = widePreviewStrength;
	if (previewStrength > movementProtectionPeakPreviewStrength)
	{
		movementProtectionPeakPreviewStrength = previewStrength;
		movementProtectionPeakPreviewSamples = Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0);
		movementProtectionPeakPreviewConfig = (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0;
	}
	if (screenOutputUniforms.uMovementProtectionMode)
		screenOutputUniforms.uMovementProtectionMode.value = enabled ? 1.0 : 0.0;
	if (screenOutputUniforms.uMovementProtectionBlend)
		screenOutputUniforms.uMovementProtectionBlend.value = blend;
	if (screenOutputUniforms.uMovementProtectionLowSppPreviewStrength)
		screenOutputUniforms.uMovementProtectionLowSppPreviewStrength.value = previewStrength;
	if (screenOutputUniforms.uMovementProtectionSpatialPreviewStrength)
		screenOutputUniforms.uMovementProtectionSpatialPreviewStrength.value = spatialPreviewStrength;
	if (screenOutputUniforms.uMovementProtectionWidePreviewStrength)
		screenOutputUniforms.uMovementProtectionWidePreviewStrength.value = widePreviewStrength;
	if (screenOutputUniforms.tMovementProtectionStableTexture && movementProtectionRenderTarget)
		screenOutputUniforms.tMovementProtectionStableTexture.value = movementProtectionRenderTarget.texture;
}

function captureMovementProtectionStableFrame()
{
	if (!movementProtectionEnabled || !movementProtectionRenderTarget || !screenOutputUniforms)
		return false;
	if (!movementProtectionConfigAllowed())
		return false;
	if (cameraIsMoving || sampleCounter < movementProtectionMinStableSamples)
		return false;
	if (movementProtectionLastCaptureSamples === Math.round(sampleCounter))
		return false;

	var savedMode = screenOutputUniforms.uMovementProtectionMode ? screenOutputUniforms.uMovementProtectionMode.value : 0.0;
	var savedBlend = screenOutputUniforms.uMovementProtectionBlend ? screenOutputUniforms.uMovementProtectionBlend.value : 0.0;
	var savedStableTexture = screenOutputUniforms.tMovementProtectionStableTexture ? screenOutputUniforms.tMovementProtectionStableTexture.value : null;
	if (screenOutputUniforms.uMovementProtectionMode) screenOutputUniforms.uMovementProtectionMode.value = 0.0;
	if (screenOutputUniforms.uMovementProtectionBlend) screenOutputUniforms.uMovementProtectionBlend.value = 0.0;
	if (screenOutputUniforms.tMovementProtectionStableTexture) screenOutputUniforms.tMovementProtectionStableTexture.value = pathTracingRenderTarget.texture;

	renderer.setRenderTarget(movementProtectionRenderTarget);
	renderer.render(screenOutputScene, orthoCamera);

	if (screenOutputUniforms.uMovementProtectionMode) screenOutputUniforms.uMovementProtectionMode.value = savedMode;
	if (screenOutputUniforms.uMovementProtectionBlend) screenOutputUniforms.uMovementProtectionBlend.value = savedBlend;
	if (screenOutputUniforms.tMovementProtectionStableTexture) screenOutputUniforms.tMovementProtectionStableTexture.value = savedStableTexture;

	movementProtectionStableReady = true;
	movementProtectionLastCaptureSamples = Math.round(sampleCounter);
	updateMovementProtectionUniforms(cameraIsMoving);
	return true;
}


// The following list of keys is not exhaustive, but it should be more than enough to build interactive demos and games
let KeyboardState = {
	KeyA: false, KeyB: false, KeyC: false, KeyD: false, KeyE: false, KeyF: false, KeyG: false, KeyH: false, KeyI: false, KeyJ: false, KeyK: false, KeyL: false, KeyM: false,
	KeyN: false, KeyO: false, KeyP: false, KeyQ: false, KeyR: false, KeyS: false, KeyT: false, KeyU: false, KeyV: false, KeyW: false, KeyX: false, KeyY: false, KeyZ: false,
	ArrowLeft: false, ArrowUp: false, ArrowRight: false, ArrowDown: false, Space: false, Enter: false, PageUp: false, PageDown: false, Tab: false,
	Minus: false, Equal: false, BracketLeft: false, BracketRight: false, Semicolon: false, Quote: false, Backquote: false,
	Comma: false, Period: false, ShiftLeft: false, ShiftRight: false, Slash: false, Backslash: false, Backspace: false,
	Digit1: false, Digit2: false, Digit3: false, Digit4: false, Digit5: false, Digit6: false, Digit7: false, Digit8: false, Digit9: false, Digit0: false
}

function homeStudioKeyboardInputCanAffectRender(code)
{
	return code === 'KeyW' || code === 'KeyS' ||
		code === 'KeyA' || code === 'KeyD' ||
		code === 'KeyE' || code === 'KeyC' ||
		code === 'ArrowUp' || code === 'ArrowDown' ||
		code === 'ArrowRight' || code === 'ArrowLeft' ||
		code === 'KeyO' || code === 'KeyP';
}

function onKeyDown(event)
{
	event.preventDefault();

	KeyboardState[event.code] = true;
	if (homeStudioKeyboardInputCanAffectRender(event.code) && typeof scheduleHomeStudioAnimationFrame === 'function')
		scheduleHomeStudioAnimationFrame();
}

function onKeyUp(event)
{
	event.preventDefault();

	KeyboardState[event.code] = false;
	if (homeStudioKeyboardInputCanAffectRender(event.code) && typeof scheduleHomeStudioAnimationFrame === 'function')
		scheduleHomeStudioAnimationFrame();
}

function keyPressed(keyName)
{
	if (!mouseControl)
		return;

	return KeyboardState[keyName];
}

function homeStudioKeyboardMoveFrameTime(value)
{
	const safeFrameTime = Number(value);
	if (!Number.isFinite(safeFrameTime) || safeFrameTime < 0)
		return 0;
	return Math.min(safeFrameTime, HOME_STUDIO_KEYBOARD_MOVE_FRAME_TIME_LIMIT);
}


function onMouseWheel(event)
{
	if (isPaused)
		return;

	// use the following instead, because event.preventDefault() gives errors in console
	event.stopPropagation();

	if (event.deltaY > 0)
	{
		increaseFOV = true;
		dollyCameraOut = true;
	}
	else if (event.deltaY < 0)
	{
		decreaseFOV = true;
		dollyCameraIn = true;
	}
	if (typeof wakeRender === 'function') wakeRender();
}

/**
 * originally from https://github.com/mrdoob/three.js/blob/dev/examples/js/controls/PointerLockControls.js
 * @author mrdoob / http://mrdoob.com/
 *
 * edited by Erich Loftis (erichlof on GitHub)
 * https://github.com/erichlof
 * Btw, this is the most concise and elegant way to implement first person camera rotation/movement that I've ever seen -
 * look at how short it is, without spaces/braces it would be around 30 lines!  Way to go, mrdoob!
 */

function FirstPersonCameraControls(camera)
{
	camera.rotation.set(0, 0, 0);

	let pitchObject = new THREE.Object3D();
	pitchObject.add(camera);

	let yawObject = new THREE.Object3D();
	yawObject.add(pitchObject);

	function onMouseMove(event)
	{
		if (isPaused)
			return;
		inputMovementHorizontal = event.movementX || event.mozMovementX || 0;
		inputMovementVertical = event.movementY || event.mozMovementY || 0;

		inputMovementHorizontal = -inputMovementHorizontal * 0.0012 * cameraRotationSpeed;
		inputMovementVertical = -inputMovementVertical * 0.001 * cameraRotationSpeed;

		if (useGenericInput)
		{
			inputRotationHorizontal = cameraControlsYawObject.rotation.y;
			inputRotationVertical = cameraControlsPitchObject.rotation.x;
		}

		if (inputMovementHorizontal) // prevent NaNs due to invalid mousemove data from browser
		{
			inputRotationHorizontal += inputMovementHorizontal;
			if (typeof wakeRender === 'function') wakeRender();
		}
		if (inputMovementVertical) // prevent NaNs due to invalid mousemove data from browser
		{
			inputRotationVertical += inputMovementVertical;
			if (typeof wakeRender === 'function') wakeRender();
		}

		if (useGenericInput)
		{
			// clamp the camera's vertical rotation (around the x-axis) to the scene's 'ceiling' and 'floor'
			if (inputRotationVertical < -PI_2)
			{
				inputRotationVertical = -PI_2;
				inputMovementVertical = 0;
			}
			if (inputRotationVertical > PI_2)
			{
				inputRotationVertical = PI_2;
				inputMovementVertical = 0;
			}
		}
	}

	document.addEventListener('mousemove', onMouseMove, false);


	this.getObject = function()
	{
		return yawObject;
	};

	this.getYawObject = function()
	{
		return yawObject;
	};

	this.getPitchObject = function()
	{
		return pitchObject;
	};

	this.getDirection = function()
	{
		const te = pitchObject.matrixWorld.elements;

		return function(v)
		{
			v.set(te[8], te[9], te[10]).negate();
			return v;
		};
	}();

	this.getUpVector = function()
	{
		const te = pitchObject.matrixWorld.elements;

		return function(v)
		{
			v.set(te[4], te[5], te[6]);
			return v;
		};
	}();

	this.getRightVector = function()
	{
		const te = pitchObject.matrixWorld.elements;

		return function(v)
		{
			v.set(te[0], te[1], te[2]);
			return v;
		};
	}();

} // end function FirstPersonCameraControls(camera)


function onWindowResize(event)
{

	windowIsBeingResized = true;

	// 固定渲染緩衝區為 2560×1440 (16:9)，與視窗大小解耦
	SCREEN_WIDTH = 2560;
	SCREEN_HEIGHT = 1440;

	renderer.setPixelRatio(pixelRatio);
	renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT, false);

	pathTracingUniforms.uResolution.value.x = context.drawingBufferWidth;
	pathTracingUniforms.uResolution.value.y = context.drawingBufferHeight;

	pathTracingRenderTarget.setSize(context.drawingBufferWidth, context.drawingBufferHeight);
	screenCopyRenderTarget.setSize(context.drawingBufferWidth, context.drawingBufferHeight);
	if (movementProtectionRenderTarget)
	{
		movementProtectionRenderTarget.setSize(context.drawingBufferWidth, context.drawingBufferHeight);
		invalidateMovementProtectionStableFrame('resize');
	}

	// R6 LGG-r16 J3：borrow buffer 同步 1/8 解析度 resize
	if (borrowPathTracingRenderTarget && borrowScreenCopyRenderTarget)
	{
		const lowW = Math.max(1, Math.floor(context.drawingBufferWidth / 8));
		const lowH = Math.max(1, Math.floor(context.drawingBufferHeight / 8));
		borrowPathTracingRenderTarget.setSize(lowW, lowH);
		borrowScreenCopyRenderTarget.setSize(lowW, lowH);
	}

	// R2-UI Bloom pyramid：7 層 mip (1/2 ~ 1/128) 同步 resize
	if (bloomMip && bloomMip.length === 7)
	{
		const w = context.drawingBufferWidth;
		const h = context.drawingBufferHeight;
		for (let i = 0; i < 7; i++)
		{
			const div = 1 << (i + 1); // 2, 4, 8, 16, 32, 64, 128
			bloomMip[i].setSize(Math.max(1, Math.floor(w / div)), Math.max(1, Math.floor(h / div)));
		}
	}

	worldCamera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
	// the following is normally used with traditional rasterized rendering, but it is not needed for our fragment shader raytraced rendering
	///worldCamera.updateProjectionMatrix();

	// the following scales all scene objects by the worldCamera's field of view,
	// taking into account the screen aspect ratio and multiplying the uniform uULen,
	// the x-coordinate, by this ratio
	fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
	pathTracingUniforms.uVLen.value = Math.tan(fovScale);
	pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;

	if (!mouseControl && mobileShowButtons)
	{
		button1Element.style.display = "";
		button2Element.style.display = "";
		button3Element.style.display = "";
		button4Element.style.display = "";
		button5Element.style.display = "";
		button6Element.style.display = "";
		// check if mobile device is in portrait or landscape mode and position buttons accordingly
		if (SCREEN_WIDTH < SCREEN_HEIGHT)
		{
			button1Element.style.right = 36 + "%";
			button2Element.style.right = 2 + "%";
			button3Element.style.right = 16 + "%";
			button4Element.style.right = 16 + "%";
			button5Element.style.right = 3 + "%";
			button6Element.style.right = 3 + "%";

			button1Element.style.bottom = 5 + "%";
			button2Element.style.bottom = 5 + "%";
			button3Element.style.bottom = 13 + "%";
			button4Element.style.bottom = 2 + "%";
			button5Element.style.bottom = 25 + "%";
			button6Element.style.bottom = 18 + "%";
		}
		else
		{
			button1Element.style.right = 22 + "%";
			button2Element.style.right = 3 + "%";
			button3Element.style.right = 11 + "%";
			button4Element.style.right = 11 + "%";
			button5Element.style.right = 3 + "%";
			button6Element.style.right = 3 + "%";

			button1Element.style.bottom = 10 + "%";
			button2Element.style.bottom = 10 + "%";
			button3Element.style.bottom = 26 + "%";
			button4Element.style.bottom = 4 + "%";
			button5Element.style.bottom = 48 + "%";
			button6Element.style.bottom = 34 + "%";
		}
	} // end if ( !mouseControl ) {

} // end function onWindowResize( event )



function init()
{

	window.addEventListener('resize', onWindowResize, false);
	window.addEventListener('orientationchange', onWindowResize, false);

	if ('ontouchstart' in window)
	{
		mouseControl = false;
		// if on mobile device, unpause the app because there is no ESC key and no mouse capture to do
		isPaused = false;

		ableToEngagePointerLock = true;
	}

	// default GUI elements for all demos

	pixel_ResolutionObject = {
		pixel_Resolution: 0.5 // will be set by each demo's js file
	}
	orthographicCamera_ToggleObject = {
		Orthographic_Camera: false
	}

	function handlePixelResolutionChange()
	{
		needChangePixelResolution = true;
	}
	function handleCameraProjectionChange()
	{
		if (!currentlyUsingOrthographicCamera)
			changeToOrthographicCamera = true;
		else if (currentlyUsingOrthographicCamera)
			changeToPerspectiveCamera = true;
		// toggle boolean flag
		currentlyUsingOrthographicCamera = !currentlyUsingOrthographicCamera;
	}


	// R4-1: lil-gui removed; ui-container pointer-lock guard is in initUI()

	if (mouseControl) // on desktop
	{

		window.addEventListener('wheel', onMouseWheel, false);

		// window.addEventListener("click", function(event)
		// {
		// 	event.preventDefault();
		// }, false);
		window.addEventListener("dblclick", function (event)
		{
			event.preventDefault();
		}, false);

		document.body.addEventListener("click", function (event)
		{
			if (!ableToEngagePointerLock)
				return;
			this.requestPointerLock = this.requestPointerLock || this.mozRequestPointerLock;
			this.requestPointerLock();
		}, false);


		pointerlockChange = function (event)
		{
			if (document.pointerLockElement === document.body ||
				document.mozPointerLockElement === document.body || document.webkitPointerLockElement === document.body)
			{
				document.addEventListener('keydown', onKeyDown, false);
				document.addEventListener('keyup', onKeyUp, false);
				isPaused = false;
			}
			else
			{
				document.removeEventListener('keydown', onKeyDown, false);
				document.removeEventListener('keyup', onKeyUp, false);
				isPaused = true;
			}
		};

		// Hook pointer lock state change events
		document.addEventListener('pointerlockchange', pointerlockChange, false);
		document.addEventListener('mozpointerlockchange', pointerlockChange, false);
		document.addEventListener('webkitpointerlockchange', pointerlockChange, false);

	} // end if (mouseControl)

	if (!mouseControl) // on mobile
	{
		// R4-1: pixel resolution slider is now in initUI(); orthographic toggle removed
	}


	/* // Fullscreen API (optional)
	document.addEventListener("click", function()
	{
		if ( !document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement )
		{
			if (document.documentElement.requestFullscreen)
				document.documentElement.requestFullscreen();
			else if (document.documentElement.mozRequestFullScreen)
				document.documentElement.mozRequestFullScreen();
			else if (document.documentElement.webkitRequestFullscreen)
				document.documentElement.webkitRequestFullscreen();
		}
	}); */

	// load a resource
	blueNoiseTexture = textureLoader.load(
		// resource URL
		'textures/BlueNoise_R_128.png',

		// onLoad callback
		function (texture)
		{
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.flipY = false;
			texture.minFilter = THREE.NearestFilter;
			texture.magFilter = THREE.NearestFilter;
			texture.generateMipmaps = false;
			//console.log("blue noise texture loaded");

			initTHREEjs(); // boilerplate: init necessary three.js items and scene/demo-specific objects
		}
	);


} // end function init()



function initTHREEjs()
{

	canvas = document.createElement('canvas');

	renderer = new THREE.WebGLRenderer({ canvas: canvas, context: canvas.getContext('webgl2') });
	//suggestion: set to false for production
	renderer.debug.checkShaderErrors = true;

	renderer.autoClear = false;

	renderer.toneMapping = THREE.ReinhardToneMapping;

	//required by WebGL 2.0 for rendering to FLOAT textures
	context = renderer.getContext();
	context.getExtension('EXT_color_buffer_float');

	container = document.getElementById('container');
	container.appendChild(renderer.domElement);

	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	stats.domElement.style.cursor = "default";
	stats.domElement.style.userSelect = "none";
	stats.domElement.style.MozUserSelect = "none";
	stats.domElement.style.display = 'none';
	container.appendChild(stats.domElement);


	clockTimer = new THREE.Timer();

	pathTracingScene = new THREE.Scene();
	screenCopyScene = new THREE.Scene();
	screenOutputScene = new THREE.Scene();

	// orthoCamera is the camera to help render the oversized full-screen triangle, which is stretched across the
	// screen (and a little outside the viewport).  orthoCamera is an orthographic camera that sits facing the view plane,
	// which serves as the window into our 3d world. This camera will not move or rotate for the duration of the app.
	orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	screenCopyScene.add(orthoCamera);
	screenOutputScene.add(orthoCamera);

	// worldCamera is the dynamic camera 3d object that will be positioned, oriented and constantly updated inside
	// the 3d scene.  Its view will ultimately get passed back to the stationary orthoCamera that renders
	// the scene to a full-screen triangle, which is stretched across the viewport.
	worldCamera = new THREE.PerspectiveCamera(60, document.body.clientWidth / document.body.clientHeight, 1, 1000);
	storedFOV = worldCamera.fov;
	pathTracingScene.add(worldCamera);

	controls = new FirstPersonCameraControls(worldCamera);

	cameraControlsObject = controls.getObject();
	cameraControlsYawObject = controls.getYawObject();
	cameraControlsPitchObject = controls.getPitchObject();

	pathTracingScene.add(cameraControlsObject);


	// setup render targets...
	pathTracingRenderTarget = new THREE.WebGLRenderTarget(context.drawingBufferWidth, context.drawingBufferHeight, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		depthBuffer: false,
		stencilBuffer: false
	});
	pathTracingRenderTarget.texture.generateMipmaps = false;

	screenCopyRenderTarget = new THREE.WebGLRenderTarget(context.drawingBufferWidth, context.drawingBufferHeight, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		depthBuffer: false,
		stencilBuffer: false
	});
	screenCopyRenderTarget.texture.generateMipmaps = false;

	movementProtectionRenderTarget = new THREE.WebGLRenderTarget(context.drawingBufferWidth, context.drawingBufferHeight, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		depthBuffer: false,
		stencilBuffer: false
	});
	movementProtectionRenderTarget.texture.generateMipmaps = false;

	// R6 LGG-r16 J3：1/8 解析度 14 彈借光 buffer（暗角真光來源）
	// borrowPathTracingRenderTarget 用 LinearFilter，主 pass texture() bilinear 採樣較平滑
	// borrowScreenCopyRenderTarget  用 NearestFilter，因為只是 ping-pong 副本，texelFetch 取整數座標
	{
		const lowW = Math.max(1, Math.floor(context.drawingBufferWidth / 8));
		const lowH = Math.max(1, Math.floor(context.drawingBufferHeight / 8));
		borrowPathTracingRenderTarget = new THREE.WebGLRenderTarget(lowW, lowH, {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat,
			type: THREE.FloatType,
			depthBuffer: false,
			stencilBuffer: false
		});
		borrowPathTracingRenderTarget.texture.generateMipmaps = false;
		borrowScreenCopyRenderTarget = new THREE.WebGLRenderTarget(lowW, lowH, {
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: THREE.FloatType,
			depthBuffer: false,
			stencilBuffer: false
		});
		borrowScreenCopyRenderTarget.texture.generateMipmaps = false;
	}

	// R2-UI Bloom multi-scale：4 層 mip chain (1/2, 1/4, 1/8, 1/16)
	// LinearFilter 讓上採樣 tent filter 與 composite 的 bilinear 都能平滑插值
	{
		const W = context.drawingBufferWidth;
		const H = context.drawingBufferHeight;
		// 7 層：1/2, 1/4, 1/8, 1/16, 1/32, 1/64, 1/128
		for (let i = 0; i < 7; i++)
		{
			const div = 1 << (i + 1);
			const mw = Math.max(1, Math.floor(W / div));
			const mh = Math.max(1, Math.floor(H / div));
			bloomMip[i] = new THREE.WebGLRenderTarget(mw, mh, {
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter,
				format: THREE.RGBAFormat,
				type: THREE.FloatType,
				depthBuffer: false,
				stencilBuffer: false
			});
			bloomMip[i].texture.generateMipmaps = false;
		}
	}



	// setup scene/demo-specific objects, variables, GUI elements, and data
	initSceneData();


	if ( !mouseControl )
	{
		mobileJoystickControls = new MobileJoystickControls({
			//showJoystick: true,
			showButtons: mobileShowButtons,
			useDarkButtons: mobileUseDarkButtons
		});
	}

	if (typeof setSliderValue === 'function') setSliderValue('slider-pixel-res', pixelRatio);
	// R4-1: orthographic toggle removed (was lil-gui controller)


	// setup oversized full-screen triangle geometry and shaders....

	// this full-screen single triangle mesh will perform the path tracing operations, producing a screen-sized image

	trianglePositions.push(-1,-1, 0 ); // start in lower left corner of viewport
	trianglePositions.push( 3,-1, 0 ); // go beyond right side of viewport, in order to have full-screen coverage
	trianglePositions.push(-1, 3, 0 ); // go beyond top of viewport, in order to have full-screen coverage
	triangleGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( trianglePositions, 3 ));


	pathTracingUniforms.tPreviousTexture = { type: "t", value: screenCopyRenderTarget.texture };
	pathTracingUniforms.tBlueNoiseTexture = { type: "t", value: blueNoiseTexture };
	// R6 LGG-r16 J3：借光 buffer 紋理引用，主 pass 在 terminal 採樣
	pathTracingUniforms.tBorrowTexture = { type: "t", value: borrowPathTracingRenderTarget.texture };
	if (typeof loadR738C1BakePastePreviewPackage === 'function')
		loadR738C1BakePastePreviewPackage().catch(function() {});
	if (typeof ensureR7310C1FullRoomDiffuseRuntimeLoading === 'function')
		ensureR7310C1FullRoomDiffuseRuntimeLoading();
	if (typeof updateR739C1CurrentViewReflectionUniforms === 'function')
		updateR739C1CurrentViewReflectionUniforms();

	pathTracingUniforms.uCameraMatrix = { type: "m4", value: new THREE.Matrix4() };

	pathTracingUniforms.uResolution = { type: "v2", value: new THREE.Vector2() };
	pathTracingUniforms.uRandomVec2 = { type: "v2", value: new THREE.Vector2() };

	pathTracingUniforms.uEPS_intersect = { type: "f", value: EPS_intersect };
	pathTracingUniforms.uTime = { type: "f", value: 0.0 };
	pathTracingUniforms.uSampleCounter = { type: "f", value: 0.0 }; //0.0
	pathTracingUniforms.uPreviousSampleCount = { type: "f", value: 1.0 };
	pathTracingUniforms.uFrameCounter = { type: "f", value: 1.0 }; //1.0
	pathTracingUniforms.uR71BlueNoiseSamplingMode = { type: "f", value: r71BlueNoiseSamplingEnabled ? 1.0 : 0.0 };
	pathTracingUniforms.uULen = { type: "f", value: 1.0 };
	pathTracingUniforms.uVLen = { type: "f", value: 1.0 };
	pathTracingUniforms.uApertureSize = { type: "f", value: apertureSize };
	pathTracingUniforms.uFocusDistance = { type: "f", value: focusDistance };
	pathTracingUniforms.uSamplesPerFrame = { type: "f", value: 1.0 };

	pathTracingUniforms.uCameraIsMoving = { type: "b1", value: false };
	pathTracingUniforms.uUseOrthographicCamera = { type: "b1", value: false };
	pathTracingUniforms.uSceneIsDynamic = { type: "b1", value: false };
	pathTracingUniforms.uMovementPreviewMode = { type: "f", value: 0.0 };

	// R2-UI: 牆面反射率（牆/天花板/柱樑），預設 1.0（R2-18 fix18：使用者肉眼校準）
	pathTracingUniforms.uWallAlbedo = { type: "f", value: 1.0 };

	// R2-UI: 最大反彈次數 runtime 可調（硬性上限 14 寫死在 shader for 迴圈編譯期）
	pathTracingUniforms.uMaxBounces = { type: "f", value: 14.0 };

	pathTracingDefines = {
		//NUMBER_OF_TRIANGLES: total_number_of_triangles
	};

	// load vertex and fragment shader files that are used in the pathTracing material, mesh and scene
	fileLoader.load('shaders/common_PathTracing_Vertex.glsl', function (vertexShaderText)
	{
		pathTracingVertexShader = vertexShaderText;
		flushCommonVertexShaderCallbacks();

		fileLoader.load('shaders/' + demoFragmentShaderFileName, function (fragmentShaderText)
		{

			pathTracingFragmentShader = fragmentShaderText;

			runAfterCommonVertexShaderReady(function ()
			{
				pathTracingMaterial = createCommonVertexShaderMaterial({
					uniforms: pathTracingUniforms,
					uniformsGroups: pathTracingUniformsGroups,
					defines: pathTracingDefines,
					fragmentShader: pathTracingFragmentShader,
					depthTest: false,
					depthWrite: false
				});

				pathTracingMesh = new THREE.Mesh(triangleGeometry, pathTracingMaterial);
				pathTracingScene.add(pathTracingMesh);

				// the following keeps the oversized full-screen triangle right in front
				//   of the camera at all times. This is necessary because without it, the full-screen
				//   triangle will fall out of view and get clipped when the camera rotates past 180 degrees.
				worldCamera.add(pathTracingMesh);
			});

		});
	});


	// this oversized full-screen triangle mesh copies the image output of the pathtracing shader and feeds it back in to that shader as a 'previousTexture'

	screenCopyUniforms = {
		tPathTracedImageTexture: { type: "t", value: pathTracingRenderTarget.texture }
	};

	fileLoader.load('shaders/ScreenCopy_Fragment.glsl', function (shaderText)
	{

		screenCopyFragmentShader = shaderText;

		runAfterCommonVertexShaderReady(function ()
		{
			screenCopyMaterial = createCommonVertexShaderMaterial({
				uniforms: screenCopyUniforms,
				fragmentShader: screenCopyFragmentShader,
				depthWrite: false,
				depthTest: false
			});

			screenCopyMesh = new THREE.Mesh(triangleGeometry, screenCopyMaterial);
			screenCopyScene.add(screenCopyMesh);
		});
	});


	// this oversized full-screen triangle mesh takes the image output of the path tracing shader (which is a continuous blend of the previous frame and current frame),
	// and applies gamma correction (which brightens the entire image), and then displays the final accumulated rendering to the screen

	screenOutputUniforms = {
		tPathTracedImageTexture: { type: "t", value: pathTracingRenderTarget.texture },
		tMovementProtectionStableTexture: { type: "t", value: movementProtectionRenderTarget.texture },
		// R2-UI Bloom multi-scale：最終合成貼圖（1/2 解析度 mip[0]，pyramid upsample 後的結果）
		tBloomTexture: { type: "t", value: bloomMip[0].texture },
		uSampleCounter: { type: "f", value: 0.0 },
		uOneOverSampleCounter: { type: "f", value: 0.0 },
		uPixelEdgeSharpness: { type: "f", value: pixelEdgeSharpness },
		uEdgeSharpenSpeed: { type: "f", value: edgeSharpenSpeed },
		//uFilterDecaySpeed: { type: "f", value: filterDecaySpeed },
		uCameraIsMoving: { type: "b1", value: false },
		uSceneIsDynamic: { type: "b1", value: sceneIsDynamic },
		uUseToneMapping: { type: "b1", value: useToneMapping },
		uMovementProtectionMode: { type: "f", value: 0.0 },
		uMovementProtectionBlend: { type: "f", value: 0.0 },
		uMovementProtectionLowSppPreviewStrength: { type: "f", value: 0.0 },
		uMovementProtectionSpatialPreviewStrength: { type: "f", value: 0.0 },
		uMovementProtectionWidePreviewStrength: { type: "f", value: 0.0 },
		uR73QuickPreviewFillMode: { type: "f", value: 0.0 },
		uR73QuickPreviewFillStrength: { type: "f", value: r73QuickPreviewFillEffectiveStrength },
		// R2-UI: Bloom composite 強度，0 = 關閉
		uBloomIntensity: { type: "f", value: 0.03 },
		// R2-UI: Bloom debug，1.0 = 直接顯示 bloom target（verify pipeline）
		uBloomDebug: { type: "f", value: 0.0 },
		// R6 飽和度：post-tonemap pre-gamma 飽和度補償，1.0 = 中性
		uSaturation: { type: "f", value: 1.0 },
		// R6 LGG-r10：pre-tonemap HDR 曝光線性倍率，1.0 = 中性（A/B 各自獨立寫入）
		uExposure: { type: "f", value: 1.0 },
		// R6 Route X (LGG pivot)：B 模式可切換 ACES tonemap + LGG 三段調色
		// A 模式（趨近真實）強制 enabled=0 + 中性值，視覺等同 Reinhard 純輸出
		uACESEnabled: { type: "f", value: 0.0 },  // 0=純 Reinhard、1=啟用 ACES 混合
		uACESStrength: { type: "f", value: 0.30 },// ACES 混合強度 0~1，0=純 Reinhard、1=純 ACES
		uACESSatShadow: { type: "f", value: 1.0 },// ACES 暗部飽和 0~2，1=中性
		uACESSatMid: { type: "f", value: 1.0 },   // ACES 中段飽和 0~2，1=中性
		uACESSatHighlight: { type: "f", value: 1.0 }, // ACES 亮部飽和 0~2，1=中性
		uLGGEnabled: { type: "f", value: 0.0 },   // 0=跳過 LGG、1=套 Lift/Gamma/Gain（按強度混血）
		uLGGStrength: { type: "f", value: 1.00 }, // LGG 整體強度 0~1，0=不套、1=完整套
		uLGGLift:  { type: "f", value: 0.0 },     // 暗部偏移 -0.30 ~ +0.30，0=中性
		uLGGGamma: { type: "f", value: 1.0 },     // 中間調曲線 0.50 ~ 2.00，1=中性
		uLGGGain:  { type: "f", value: 1.0 },     // 亮部增益 0.50 ~ 1.50，1=中性
		// R6 LGG-r30：B 模 White Balance + Hue 後製（display-space 最末端、不觸發採樣重置）
		// WB 走 von Kries chromatic adaptation，Hue 走 NTSC luma-preserving 色相環旋轉
		uWBB:  { type: "f", value: 0.0 },         // 白平衡 -1=藍冷 ~ +1=黃暖，0=中性
		uHueB: { type: "f", value: 0.0 }          // 色相環旋轉角度（degrees），0=中性
	};

fileLoader.load('shaders/ScreenOutput_Fragment.glsl?v=r7-3-10-sprout-ab-v1', function (shaderText)
	{

		screenOutputFragmentShader = shaderText;

		runAfterCommonVertexShaderReady(function ()
		{
			screenOutputMaterial = createCommonVertexShaderMaterial({
				uniforms: screenOutputUniforms,
				fragmentShader: screenOutputFragmentShader,
				depthWrite: false,
				depthTest: false
			});

			screenOutputMesh = new THREE.Mesh(triangleGeometry, screenOutputMaterial);
			screenOutputScene.add(screenOutputMesh);
		});
	});


	// R2-UI Bloom pyramid (Jimenez / Unreal / Blender Eevee)：
	// brightpass：pathTracing(full) → bloomMip[0](1/2)，13-tap Karis average downsample + 亮度閾值
	// downsample：mip[n] → mip[n+1]，13-tap partial average，連做至多 6 次 (1/2 → 1/128)
	// upsample：mip[n+1] → mip[n]，9-tap tent filter（radius=1 fix）+ AdditiveBlending，連做至多 6 次 (1/128 → 1/2)
	// 實際層數由 window.bloomMipCount 控制 (3~7)

	bloomBrightpassScene = new THREE.Scene();
	bloomDownsampleScene = new THREE.Scene();
	bloomUpsampleScene = new THREE.Scene();
	bloomBrightpassScene.add(orthoCamera);
	bloomDownsampleScene.add(orthoCamera);
	bloomUpsampleScene.add(orthoCamera);

	bloomBrightpassUniforms = {
		tPathTracedImageTexture: { type: "t", value: pathTracingRenderTarget.texture },
		uOneOverSampleCounter: { type: "f", value: 1.0 }
	};

	// downsample/upsample 每個 pass 動態改 tBloomTexture.value，共用單一 material/scene
	bloomDownsampleUniforms = {
		tBloomTexture: { type: "t", value: bloomMip[0].texture }
	};

	bloomUpsampleUniforms = {
		tBloomTexture: { type: "t", value: bloomMip[6].texture }
	};

	fileLoader.load('shaders/Bloom_Brightpass_Fragment.glsl', function (shaderText)
	{
		runAfterCommonVertexShaderReady(function ()
		{
			bloomBrightpassMaterial = createCommonVertexShaderMaterial({
				uniforms: bloomBrightpassUniforms,
				fragmentShader: shaderText,
				depthWrite: false,
				depthTest: false
			});
			bloomBrightpassMesh = new THREE.Mesh(triangleGeometry, bloomBrightpassMaterial);
			bloomBrightpassScene.add(bloomBrightpassMesh);
		});
	});

	fileLoader.load('shaders/Bloom_Downsample_Fragment.glsl', function (shaderText)
	{
		runAfterCommonVertexShaderReady(function ()
		{
			bloomDownsampleMaterial = createCommonVertexShaderMaterial({
				uniforms: bloomDownsampleUniforms,
				fragmentShader: shaderText,
				depthWrite: false,
				depthTest: false
			});
			bloomDownsampleMesh = new THREE.Mesh(triangleGeometry, bloomDownsampleMaterial);
			bloomDownsampleScene.add(bloomDownsampleMesh);
		});
	});

	fileLoader.load('shaders/Bloom_Upsample_Fragment.glsl', function (shaderText)
	{
		runAfterCommonVertexShaderReady(function ()
		{
			bloomUpsampleMaterial = createCommonVertexShaderMaterial({
				uniforms: bloomUpsampleUniforms,
				fragmentShader: shaderText,
				depthWrite: false,
				depthTest: false,
				// R2-UI：加法混合 → upsample 結果與 dest mip 既有 downsample 結果疊加
				blending: THREE.AdditiveBlending,
				transparent: true
			});
			bloomUpsampleMesh = new THREE.Mesh(triangleGeometry, bloomUpsampleMaterial);
			bloomUpsampleScene.add(bloomUpsampleMesh);
		});
	});


	// this 'jumpstarts' the initial dimensions and parameters for the window and renderer
	onWindowResize();

	// everything is set up, now we can start animating
	scheduleHomeStudioAnimationFrame();

} // end function initTHREEjs()


function scheduleHomeStudioAnimationFrame()
{
	homeStudioAnimationSleeping = false;
	if (homeStudioAnimationFrameId)
		return;
	homeStudioAnimationFrameId = requestAnimationFrame(function()
	{
		homeStudioAnimationFrameId = 0;
		animate();
	});
}

function animate()
{
	// R2-UI：60 FPS cap —— 間隔不足 ~16.7ms 直接 reschedule，避免 120Hz 螢幕上全速 path tracing
	const nowMs = performance.now();
	if (nowMs - lastRenderTime < FRAME_INTERVAL_MS)
	{
		scheduleHomeStudioAnimationFrame();
		return;
	}
	lastRenderTime = nowMs;

	// update clock
	clockTimer.update();
	frameTime = clockTimer.getDelta();
	elapsedTime = clockTimer.getElapsed() % 1000;

	// reset flags
	cameraIsMoving = false;

	// if GUI has been used, update
	if (needChangePixelResolution)
	{
		pixelRatio = (typeof getSliderValue === 'function') ? getSliderValue('slider-pixel-res') : pixelRatio;
		onWindowResize();
		needChangePixelResolution = false;
	}

	if (windowIsBeingResized)
	{
		cameraIsMoving = true;
		windowIsBeingResized = false;
	}

	// R2-UI：GUI 參數變化 → 強制累加 buffer 刷新（即使原本已在 1000 SPP 休眠）
	if (sceneParamsChanged)
	{
		cameraIsMoving = true;
		invalidateMovementProtectionStableFrame('sceneParamsChanged');
		sceneParamsChanged = false;
	}

	// check user controls
	if (mouseControl)
	{
		// movement detected
		if (oldYawRotation != inputRotationHorizontal ||
			oldPitchRotation != inputRotationVertical)
		{
			cameraIsMoving = true;
		}

		// save state for next frame
		oldYawRotation = inputRotationHorizontal;
		oldPitchRotation = inputRotationVertical;

	} // end if (mouseControl)

	// if on mobile device, get input from the mobileJoystickControls
	if (!mouseControl)
	{
		if (useGenericInput)
		{
			inputRotationHorizontal = cameraControlsYawObject.rotation.y;
			inputRotationVertical = cameraControlsPitchObject.rotation.x;
		}

		newDeltaX = joystickDeltaX * cameraRotationSpeed;
		if (newDeltaX)
		{
			cameraIsMoving = true;
			// the ' || 0 ' prevents NaNs from creeping into inputRotationHorizontal calc below
			inputMovementHorizontal = ((oldDeltaX - newDeltaX) * 0.01) || 0;
			// mobileJoystick X movement (left and right) affects camera rotation around the Y axis
			inputRotationHorizontal += inputMovementHorizontal;
		}

		newDeltaY = joystickDeltaY * cameraRotationSpeed;
		if (newDeltaY)
		{
			cameraIsMoving = true;
			// the ' || 0 ' prevents NaNs from creeping into inputRotationVertical calc below
			inputMovementVertical = ((oldDeltaY - newDeltaY) * 0.01) || 0;
			// mobileJoystick Y movement (up and down) affects camera rotation around the X axis
			inputRotationVertical += inputMovementVertical;
		}

		// clamp the camera's vertical rotation (around the x-axis) to the scene's 'ceiling' and 'floor',
		// so you can't accidentally flip the camera upside down
		if (useGenericInput)
		{
			if (inputRotationVertical < -PI_2)
			{
				inputRotationVertical = -PI_2;
				inputMovementVertical = 0;
			}
			if (inputRotationVertical > PI_2)
			{
				inputRotationVertical = PI_2;
				inputMovementVertical = 0;
			}
		}

		// save state for next frame
		oldDeltaX = newDeltaX;
		oldDeltaY = newDeltaY;


		newPinchWidthX = pinchWidthX;
		newPinchWidthY = pinchWidthY;
		pinchDeltaX = newPinchWidthX - oldPinchWidthX;
		pinchDeltaY = newPinchWidthY - oldPinchWidthY;

		if (Math.abs(pinchDeltaX) > Math.abs(pinchDeltaY))
		{
			if (pinchDeltaX < -1)
			{
				increaseFOV = true;
				dollyCameraOut = true;
			}
			if (pinchDeltaX > 1)
			{
				decreaseFOV = true;
				dollyCameraIn = true;
			}
		}

		if (Math.abs(pinchDeltaY) >= Math.abs(pinchDeltaX))
		{
			if (pinchDeltaY > 1)
			{
				increaseAperture = true;
			}
			if (pinchDeltaY < -1)
			{
				decreaseAperture = true;
			}
		}

		// save state for next frame
		oldPinchWidthX = newPinchWidthX;
		oldPinchWidthY = newPinchWidthY;

	} // end if ( !mouseControl )

	// if on gamepad (gp), get input from that gamepad device
	if ( gp )
	{
		if (useGenericInput)
		{
			inputRotationHorizontal = cameraControlsYawObject.rotation.y;
			inputRotationVertical = cameraControlsPitchObject.rotation.x;
		}

		if (Math.abs(gp.axes[2]) > 0.1) // account for deadzone
			newDeltaX += gp.axes[2] * gamepad_cameraYRotationSpeed;
		else newDeltaX = 0;
		if (newDeltaX)
		{
			cameraIsMoving = true;
			// the ' || 0 ' prevents NaNs from creeping into inputRotationHorizontal calc below
			inputMovementHorizontal = ((oldDeltaX - newDeltaX) * 0.01) || 0;
			// gamepad stick X movement (left and right) affects camera rotation around the Y axis
			inputRotationHorizontal += inputMovementHorizontal;
		}

		if (Math.abs(gp.axes[3]) > 0.1) // account for deadzone
			newDeltaY += gp.axes[3] * gamepad_cameraXRotationSpeed;
		else newDeltaY = 0;
		if (newDeltaY)
		{
			cameraIsMoving = true;
			// the ' || 0 ' prevents NaNs from creeping into inputRotationVertical calc below
			inputMovementVertical = ((oldDeltaY - newDeltaY) * 0.01) || 0;
			// gamepad stick Y movement (up and down) affects camera rotation around the X axis
			inputRotationVertical += inputMovementVertical;
		}

		// clamp the camera's vertical rotation (around the x-axis) to the scene's 'ceiling' and 'floor',
		// so you can't accidentally flip the camera upside down
		if (useGenericInput)
		{
			if (inputRotationVertical < -PI_2)
			{
				inputRotationVertical = -PI_2;
				inputMovementVertical = 0;
			}
			if (inputRotationVertical > PI_2)
			{
				inputRotationVertical = PI_2;
				inputMovementVertical = 0;
			}
		}

		// save state for next frame
		oldDeltaX = newDeltaX;
		oldDeltaY = newDeltaY;

	} // end if ( gp )


	//cameraControlsYawObject.rotation.y = inputRotationHorizontal;
	//cameraControlsPitchObject.rotation.x = inputRotationVertical;
	cameraControlsYawObject.rotateY(inputMovementHorizontal);
	cameraControlsPitchObject.rotateX(inputMovementVertical);

	// this gives us a vector in the direction that the camera is pointing,
	// which will be useful for moving the camera 'forward' and shooting projectiles in that direction
	controls.getDirection(cameraDirectionVector);
	cameraDirectionVector.normalize();
	controls.getUpVector(cameraUpVector);
	cameraUpVector.normalize();
	controls.getRightVector(cameraRightVector);
	cameraRightVector.normalize();


	if (useGenericInput)
	{
		if (!isPaused)
		{
			const keyboardMoveFrameTime = homeStudioKeyboardMoveFrameTime(frameTime);
			if ((keyPressed('KeyW') || button3Pressed) && !(keyPressed('KeyS') || button4Pressed))
			{
				cameraControlsObject.position.add(cameraDirectionVector.multiplyScalar(cameraFlightSpeed * keyboardMoveFrameTime));
				cameraIsMoving = true;
			}
			if ((keyPressed('KeyS') || button4Pressed) && !(keyPressed('KeyW') || button3Pressed))
			{
				cameraControlsObject.position.sub(cameraDirectionVector.multiplyScalar(cameraFlightSpeed * keyboardMoveFrameTime));
				cameraIsMoving = true;
			}
			if ((keyPressed('KeyA') || button1Pressed) && !(keyPressed('KeyD') || button2Pressed))
			{
				cameraControlsObject.position.sub(cameraRightVector.multiplyScalar(cameraFlightSpeed * keyboardMoveFrameTime));
				cameraIsMoving = true;
			}
			if ((keyPressed('KeyD') || button2Pressed) && !(keyPressed('KeyA') || button1Pressed))
			{
				cameraControlsObject.position.add(cameraRightVector.multiplyScalar(cameraFlightSpeed * keyboardMoveFrameTime));
				cameraIsMoving = true;
			}
			if (keyPressed('KeyE'))
			{
				cameraControlsObject.position.add(cameraUpVector.multiplyScalar(cameraFlightSpeed * keyboardMoveFrameTime));
				cameraIsMoving = true;
			}
			if (keyPressed('KeyC'))
			{
				cameraControlsObject.position.sub(cameraUpVector.multiplyScalar(cameraFlightSpeed * keyboardMoveFrameTime));
				cameraIsMoving = true;
			}
			if ((keyPressed('ArrowUp') || button5Pressed) && !(keyPressed('ArrowDown') || button6Pressed))
			{
				increaseFocusDist = true;
			}
			if ((keyPressed('ArrowDown') || button6Pressed) && !(keyPressed('ArrowUp') || button5Pressed))
			{
				decreaseFocusDist = true;
			}
			if (keyPressed('ArrowRight') && !keyPressed('ArrowLeft'))
			{
				increaseAperture = true;
			}
			if (keyPressed('ArrowLeft') && !keyPressed('ArrowRight'))
			{
				decreaseAperture = true;
			}
			if (keyPressed('KeyO') && canPress_O)
			{
				changeToOrthographicCamera = true;
				canPress_O = false;
			}
			if (!keyPressed('KeyO'))
				canPress_O = true;

			if (keyPressed('KeyP') && canPress_P)
			{
				changeToPerspectiveCamera = true;
				canPress_P = false;
			}
			if (!keyPressed('KeyP'))
				canPress_P = true;
		} // end if (!isPaused)

	} // end if (useGenericInput)



	// update scene/demo-specific input(if custom), variables and uniforms every animation frame
	updateVariablesAndUniforms();

	//reset controls movement
	inputMovementHorizontal = inputMovementVertical = 0;


	if (increaseFOV)
	{
		worldCamera.fov++;
		if (worldCamera.fov > 179)
			worldCamera.fov = 179;
		fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
		pathTracingUniforms.uVLen.value = Math.tan(fovScale);
		pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;

		cameraIsMoving = true;
		increaseFOV = false;
	}
	if (decreaseFOV)
	{
		worldCamera.fov--;
		if (worldCamera.fov < 1)
			worldCamera.fov = 1;
		fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
		pathTracingUniforms.uVLen.value = Math.tan(fovScale);
		pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;

		cameraIsMoving = true;
		decreaseFOV = false;
	}

	if (increaseFocusDist)
	{
		focusDistance += (1 * focusDistanceChangeSpeed);
		pathTracingUniforms.uFocusDistance.value = focusDistance;
		cameraIsMoving = true;
		increaseFocusDist = false;
	}
	if (decreaseFocusDist)
	{
		focusDistance -= (1 * focusDistanceChangeSpeed);
		if (focusDistance < 1)
			focusDistance = 1;
		pathTracingUniforms.uFocusDistance.value = focusDistance;
		cameraIsMoving = true;
		decreaseFocusDist = false;
	}

	if (increaseAperture)
	{
		apertureSize += (0.1 * apertureChangeSpeed);
		if (apertureSize > 10000.0)
			apertureSize = 10000.0;

		cameraIsMoving = true;
		increaseAperture = false;
	}
	if (decreaseAperture)
	{
		apertureSize -= (0.1 * apertureChangeSpeed);
		if (apertureSize < 0.0)
			apertureSize = 0.0;

		cameraIsMoving = true;
		decreaseAperture = false;
	}
	if (allowOrthographicCamera && changeToOrthographicCamera)
	{
		storedFOV = worldCamera.fov; // save current perspective camera's FOV

		worldCamera.fov = 90; // good default for Ortho camera - lets user see most of the scene
		fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
		pathTracingUniforms.uVLen.value = Math.tan(fovScale);
		pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;

		pathTracingUniforms.uUseOrthographicCamera.value = true;
		cameraIsMoving = true;
		changeToOrthographicCamera = false;
	}
	if (allowOrthographicCamera && changeToPerspectiveCamera)
	{
		worldCamera.fov = storedFOV; // return to prior perspective camera's FOV
		fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
		pathTracingUniforms.uVLen.value = Math.tan(fovScale);
		pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;

		pathTracingUniforms.uUseOrthographicCamera.value = false;
		cameraIsMoving = true;
		changeToPerspectiveCamera = false;
	}

	// now update uniforms that are common to all scenes
	var wasCameraRecentlyMoving = cameraRecentlyMoving;
	var samplingStepOnceActive = samplingStepOnceRequested && samplingPaused && !cameraIsMoving;
	var samplingPausedForFrame = samplingPaused && !samplingStepOnceActive && !cameraIsMoving;
	var renderLimitWasAlreadyReached = sampleCounter >= userSppCap && !cameraIsMoving;
	if (!cameraIsMoving)
	{
		if (!samplingPausedForFrame && !renderLimitWasAlreadyReached)
		{
			if (sceneIsDynamic)
				sampleCounter = 1.0; // reset for continuous updating of image
			else if (sampleCounter < userSppCap)
				sampleCounter += 1.0; // for progressive refinement of image

			frameCounter += 1.0;
		}

		cameraRecentlyMoving = false;
	}

	if (cameraIsMoving)
	{
		if (samplingStepHistory.length > 0)
			resetSamplingStepHistory();
		frameCounter += 1.0;

		if (!cameraRecentlyMoving)
		{
			// record current sampleCounter before it gets set to 1.0 below
			pathTracingUniforms.uPreviousSampleCount.value = sampleCounter;
			frameCounter = 1.0;
			cameraRecentlyMoving = true;
		}

		sampleCounter = 1.0;
	}

	pathTracingUniforms.uTime.value = elapsedTime;
	pathTracingUniforms.uCameraIsMoving.value = cameraIsMoving;
	updateMovementPreviewUniforms(cameraIsMoving);
	pathTracingUniforms.uSampleCounter.value = sampleCounter;
	pathTracingUniforms.uFrameCounter.value = frameCounter;
	pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());
	updateR738C1BakePastePreviewUniforms();
	updateR7310C1FullRoomDiffuseRuntimeUniforms();

	// CAMERA

	cameraControlsObject.updateMatrixWorld(true);
	worldCamera.updateMatrixWorld(true);
	pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
	pathTracingUniforms.uApertureSize.value = apertureSize;

	screenOutputUniforms.uCameraIsMoving.value = cameraIsMoving;
	screenOutputUniforms.uSampleCounter.value = sampleCounter;
	// PROGRESSIVE SAMPLE WEIGHT (reduces intensity of each successive animation frame's image)
	screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / sampleCounter;


	// R2-UI：切換 Cam 或其他觸發源要求「立刻清除殘影」，清空兩個 ping-pong buffer 再往下走
	var accumulationWasClearedForThisFrame = false;
	if (needClearAccumulation)
	{
		resetSamplingStepHistory();
		renderer.setRenderTarget(pathTracingRenderTarget);
		renderer.clear();
		renderer.setRenderTarget(screenCopyRenderTarget);
		renderer.clear();
		// R6 LGG-r16 J3：borrow ping-pong 同步清空，避免新 frame 的 14 彈累積讀到舊相機角度的殘影
		if (borrowPathTracingRenderTarget && borrowScreenCopyRenderTarget)
		{
			renderer.setRenderTarget(borrowPathTracingRenderTarget);
			renderer.clear();
			renderer.setRenderTarget(borrowScreenCopyRenderTarget);
			renderer.clear();
		}
		movementProtectionStableReady = false;
		movementProtectionLastCaptureSamples = 0;
		sampleCounter = 1.0;
		frameCounter = 1.0;
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uPreviousSampleCount.value = 1.0;
		screenOutputUniforms.uSampleCounter.value = sampleCounter;
		screenOutputUniforms.uOneOverSampleCounter.value = 1.0;
		needClearAccumulation = false;
		accumulationWasClearedForThisFrame = true;
	}

	// RENDERING in 3 steps
	// 到達 userSppCap 後跳過 STEP 1/2，凍結累加 buffer，只保留 STEP 3 顯示
	var renderingStopped = samplingPausedForFrame || renderLimitWasAlreadyReached;
	var firstFrameRecoveryWasCleared = accumulationWasClearedForThisFrame;
	var firstFrameRecoveryPassTarget = sampleCounter;
	var firstFrameRecoveryReason = 'normal';
	var firstFrameRecoveryActiveRenderCameraMoving = cameraIsMoving;

	if (!renderingStopped)
	{
		if (firstFrameRecoveryEnabled && !samplingStepOnceActive)
		{
			var firstFrameRecoveryActiveTargetSamples = firstFrameRecoveryConfigTargetSamples(cameraIsMoving);
			if (accumulationWasClearedForThisFrame)
			{
				firstFrameRecoveryReason = 'cleared';
			}
			else if (cameraIsMoving && firstFrameRecoveryClearWhileMoving && sampleCounter <= 1.0)
			{
				firstFrameRecoveryReason = 'moving';
				firstFrameRecoveryWasCleared = true;
			}
			else if (wasCameraRecentlyMoving && sampleCounter < firstFrameRecoveryActiveTargetSamples)
			{
				firstFrameRecoveryReason = 'recentlyMoving';
			}
			if (firstFrameRecoveryReason !== 'normal' || sampleCounter < firstFrameRecoveryActiveTargetSamples)
			{
				firstFrameRecoveryPassTarget = Math.max(firstFrameRecoveryPassTarget, firstFrameRecoveryActiveTargetSamples);
				firstFrameRecoveryActiveRenderCameraMoving = false;
			}
		}

		if (firstFrameRecoveryWasCleared)
		{
			renderer.setRenderTarget(pathTracingRenderTarget);
			renderer.clear();
			renderer.setRenderTarget(screenCopyRenderTarget);
			renderer.clear();
			if (borrowPathTracingRenderTarget && borrowScreenCopyRenderTarget)
			{
				renderer.setRenderTarget(borrowPathTracingRenderTarget);
				renderer.clear();
				renderer.setRenderTarget(borrowScreenCopyRenderTarget);
				renderer.clear();
			}
			if (!movementProtectionPreserveStableAcrossCameraReset)
			{
				movementProtectionStableReady = false;
				movementProtectionLastCaptureSamples = 0;
			}
			frameCounter = 2.0;
			pathTracingUniforms.uPreviousSampleCount.value = 1.0;
		}

		var firstFrameRecoveryPassStart = sampleCounter;
		firstFrameRecoveryLastPassCount = Math.max(1, Math.round(firstFrameRecoveryPassTarget - firstFrameRecoveryPassStart + 1.0));
		firstFrameRecoveryLastReason = firstFrameRecoveryReason;

		for (var firstFrameRecoveryPassSample = sampleCounter; firstFrameRecoveryPassSample <= firstFrameRecoveryPassTarget; firstFrameRecoveryPassSample += 1.0)
		{
			sampleCounter = firstFrameRecoveryPassSample;
			pathTracingUniforms.uCameraIsMoving.value = firstFrameRecoveryActiveRenderCameraMoving;
			updateMovementPreviewUniforms(cameraIsMoving);
			pathTracingUniforms.uSampleCounter.value = sampleCounter;
			pathTracingUniforms.uFrameCounter.value = frameCounter;
			pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());
			screenOutputUniforms.uCameraIsMoving.value = firstFrameRecoveryActiveRenderCameraMoving;
			screenOutputUniforms.uSampleCounter.value = sampleCounter;
			screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / sampleCounter;
			updateR73QuickPreviewFillUniforms();
			updateR738C1BakePastePreviewUniforms();

			// STEP 1A: R6 LGG-r16 J3 借光 pass（1/8 res、14 彈），只在 uBorrowStrength > 0 時跑
			// 暫時切 uniforms（uMaxBounces=14、uIsBorrowPass=1、tPreviousTexture 換 borrow ping-pong、uResolution 切 1/8）
			// 主 pass 跑完之後恢復原 uniforms 狀態
			var borrowActive = pathTracingUniforms.uBorrowStrength
				&& pathTracingUniforms.uBorrowStrength.value > 0.0
				&& borrowPathTracingRenderTarget
				&& borrowScreenCopyRenderTarget
				&& !firstFrameRecoveryLowCostMovementActive(cameraIsMoving);
			if (borrowActive)
			{
				var savedBounces = pathTracingUniforms.uMaxBounces.value;
				var savedTPrev = pathTracingUniforms.tPreviousTexture.value;
				var savedTBorrow = pathTracingUniforms.tBorrowTexture.value;
				var savedResX = pathTracingUniforms.uResolution.value.x;
				var savedResY = pathTracingUniforms.uResolution.value.y;
				var lowW = Math.max(1, Math.floor(savedResX / 8));
				var lowH = Math.max(1, Math.floor(savedResY / 8));

				// R6 LGG-r20：借光反彈回到 14 彈（深暗角需要 5+ 彈光線才到得了）
				// 配合 pathtracing_main chunk 的 source-side clamp 1.0，14 彈 firefly 不會永久汙染累積
				pathTracingUniforms.uMaxBounces.value = 14.0;
				pathTracingUniforms.uIsBorrowPass.value = 1.0;
				pathTracingUniforms.tPreviousTexture.value = borrowScreenCopyRenderTarget.texture;
				// 防 WebGL feedback loop：借光 pass 寫入 borrowPathTracingRenderTarget，
				// 暫時把 tBorrowTexture 指到 ping-pong 兄弟 borrowScreenCopyRenderTarget，避免「同張紋理同時是 input + output」未定義行為
				pathTracingUniforms.tBorrowTexture.value = borrowScreenCopyRenderTarget.texture;
				pathTracingUniforms.uResolution.value.set(lowW, lowH);

				renderer.setRenderTarget(borrowPathTracingRenderTarget);
				renderer.render(pathTracingScene, worldCamera);

				// borrow ping-pong：把剛寫的 borrowPathTracingRenderTarget 複製到 borrowScreenCopyRenderTarget
				// 用既有 screenCopyScene/Material（fragment 是 ScreenCopy_Fragment.glsl），暫時換 source 紋理引用
				var savedScSrc = screenCopyUniforms.tPathTracedImageTexture.value;
				screenCopyUniforms.tPathTracedImageTexture.value = borrowPathTracingRenderTarget.texture;
				renderer.setRenderTarget(borrowScreenCopyRenderTarget);
				renderer.render(screenCopyScene, orthoCamera);
				screenCopyUniforms.tPathTracedImageTexture.value = savedScSrc;

				// 恢復主 pass uniforms
				pathTracingUniforms.uMaxBounces.value = savedBounces;
				pathTracingUniforms.uIsBorrowPass.value = 0.0;
				pathTracingUniforms.tPreviousTexture.value = savedTPrev;
				pathTracingUniforms.tBorrowTexture.value = savedTBorrow;
				pathTracingUniforms.uResolution.value.set(savedResX, savedResY);
			}

			// STEP 1
			// Perform PathTracing and Render(save) into pathTracingRenderTarget, a full-screen texture (on the oversized triangle).
			// Read previous screenCopyRenderTarget(via texelFetch inside fragment shader) to use as a new starting point to blend with
			renderer.setRenderTarget(pathTracingRenderTarget);
			renderer.render(pathTracingScene, worldCamera);

			// STEP 2
			// Render(copy) the pathTracingScene output(pathTracingRenderTarget above) into screenCopyRenderTarget.
			// This will be used as a new starting point for Step 1 above (essentially creating ping-pong buffers)
			renderer.setRenderTarget(screenCopyRenderTarget);
			renderer.render(screenCopyScene, orthoCamera);
			if (typeof window.captureDueSnapshotsForCurrentSample === 'function')
				window.captureDueSnapshotsForCurrentSample();

			frameCounter += 1.0;
		}
		firstFrameRecoveryLastFinalSamples = Math.round(sampleCounter);
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uCameraIsMoving.value = cameraIsMoving;
		screenOutputUniforms.uCameraIsMoving.value = firstFrameRecoveryActiveRenderCameraMoving;
		screenOutputUniforms.uSampleCounter.value = sampleCounter;
		screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / sampleCounter;
	}
	if (samplingStepOnceActive)
	{
		if (!renderingStopped)
			captureSamplingStepHistoryState();
		samplingStepOnceRequested = false;
		samplingPaused = true;
		if (typeof window.updateSamplingControls === 'function')
			window.updateSamplingControls();
	}

	// STEP 2.5 (R2-UI Bloom multi-scale pyramid)
	// 只在 1) 非休眠、2) bloom 強度 > 0（或 debug on）、3) 所有 bloom material 載入完成 時執行
	// 執行節奏：前 50 frame 連續跑（早期視覺即時）；之後每 10 frame 跑一次（bloom 是低頻信號）
	// 休眠時完全跳過，bloom mip chain 靜態保留給 STEP 3 使用 → GPU 大幅降載
	//
	// Pipeline (Jimenez / Unreal / Blender Eevee pyramid)：
	//   1. brightpass: pathTracing(full) → mip[0](1/2) — 13-tap Karis average 殺 firefly
	//   2 ~ N. downsample: mip[i] → mip[i+1] — 13-tap partial average
	//   N+1 ~ 2N-1. upsample additive: mip[i] → mip[i-1] — 9-tap tent radius=1 + additive blend
	// mipCount 由 window.bloomMipCount 控制 (3 ~ 7)，halo 廣度由層數決定
	let mipCount = window.bloomMipCount;
	if (typeof mipCount !== 'number' || mipCount < 2) mipCount = 7;
	if (mipCount > 7) mipCount = 7;
	if (mipCount < 2) mipCount = 2;
	if (!renderingStopped
		&& (screenOutputUniforms.uBloomIntensity.value > 0.0 || screenOutputUniforms.uBloomDebug.value > 0.5)
		&& bloomBrightpassMaterial && bloomDownsampleMaterial && bloomUpsampleMaterial
		&& (sampleCounter < 50.0 || (sampleCounter % 10.0) < 1.0))
	{
		// 同步 brightpass 所需 sampleCounter 倒數
		bloomBrightpassUniforms.uOneOverSampleCounter.value = screenOutputUniforms.uOneOverSampleCounter.value;

		const prevAutoClear = renderer.autoClear;
		renderer.autoClear = true;

		// Pass 1：brightpass + 2x Karis downsample → mip[0] (1/2 res)
		renderer.setRenderTarget(bloomMip[0]);
		renderer.render(bloomBrightpassScene, orthoCamera);

		// Downsample chain：mip[0] → mip[1] → ... → mip[mipCount-1]
		for (let i = 0; i < mipCount - 1; i++)
		{
			bloomDownsampleUniforms.tBloomTexture.value = bloomMip[i].texture;
			renderer.setRenderTarget(bloomMip[i + 1]);
			renderer.render(bloomDownsampleScene, orthoCamera);
		}

		// Upsample chain：mip[mipCount-1] → ... → mip[0]
		// autoClear=false → dest mip 既有 downsample 結果被保留，GPU 把 upsample 輸出加上去
		renderer.autoClear = false;
		for (let i = mipCount - 1; i > 0; i--)
		{
			bloomUpsampleUniforms.tBloomTexture.value = bloomMip[i].texture;
			renderer.setRenderTarget(bloomMip[i - 1]);
			renderer.render(bloomUpsampleScene, orthoCamera);
		}

		renderer.autoClear = prevAutoClear;
	}

	// STEP 3
	// Render to the oversized full-screen triangle with generated pathTracingRenderTarget in STEP 1 above.
	// After applying tonemapping and gamma-correction to the image, it will be shown on the screen as the final accumulated output
	// R6 hibernation：renderingStopped 時連 STEP 3 也跳過 → 對齊舊版單檔 HTML 的「全部 GL 早返回」做法 → GPU 真歸零
	// R6 Route X：postProcessChanged 例外 → 休眠中也能跑一次 STEP 3 讓後製滑桿即時生效（不重啟累積）
	if (!renderingStopped || postProcessChanged)
	{
		updateMovementProtectionUniforms(cameraIsMoving);
		updateR73QuickPreviewFillUniforms();
		updateR738C1BakePastePreviewUniforms();
		updateR7310C1FullRoomDiffuseRuntimeUniforms();
		renderer.setRenderTarget(null);
		renderer.render(screenOutputScene, orthoCamera);
		if (!cameraIsMoving)
			captureMovementProtectionStableFrame();
		postProcessChanged = false;
	}

	stats.update();

	if (renderingStopped && !postProcessChanged && !cameraIsMoving && !sceneParamsChanged && !samplingStepOnceRequested)
	{
		homeStudioAnimationSleeping = true;
		return;
	}
	scheduleHomeStudioAnimationFrame();

} // end function animate()
