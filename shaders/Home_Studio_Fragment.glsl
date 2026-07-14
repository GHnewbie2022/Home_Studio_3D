precision highp float;
precision highp int;
precision highp sampler2D;

#include <pathtracing_uniforms_and_defines>

// BVH data textures
uniform sampler2D tBVHTexture;
uniform sampler2D tBoxDataTexture;

// Textures
uniform sampler2D uWinTex;
uniform sampler2D u150F;
uniform sampler2D u150B;
uniform sampler2D uWoodDoorTex;
uniform sampler2D uIronDoorTex;
uniform sampler2D u750F;
uniform sampler2D u750B;
uniform sampler2D uGikGrayTex;
uniform sampler2D uGikWhiteTex;

// ISO-PUCK
uniform vec3 uPuckPositions[8];
uniform float uPuckRadius;
uniform float uPuckHalfH;

// R2-11 中央吸頂燈
uniform vec3 uLightEmission;
uniform vec3 uCeilingLampPos;
uniform float uCeilingLampRadius;
uniform float uCeilingLampHalfH;

uniform float uWallAlbedo; // R2-UI：結構表面反射率（地板/天花板/牆/樑/柱，陣列索引 0..32；fix19 修正原 1..15 漏蓋多數牆段之索引錯誤）
uniform float uMaxBounces; // R2-UI：最大反彈次數 1~14，runtime 可調，硬性編譯期上限 14
#if !defined(R7310_BAKE_ONLY_NO_BORROW) && !defined(R7310_RUNTIME_NO_BORROW_TEXTURE)
uniform sampler2D tBorrowTexture; // R6 LGG-r16 J3：1/8 res 14 彈借光 buffer，主 pass 在 terminal 採樣
#endif
uniform float uBorrowStrength;    // R6 LGG-r16 J3：借光強度 0~1，0=關（不跑借光 pass）
uniform float uIsBorrowPass;      // R6 LGG-r16 J3：1=當前 frame 是借光 pass，shader 跳過借光採樣避免遞迴
uniform float uR73QuickPreviewTerminalMode;
uniform float uR73QuickPreviewTerminalStrength;
uniform int uR73GikWallProbeMode;
uniform int uR738C1BakeCaptureMode;
uniform int uR738C1BakePatchId;
uniform float uR738C1BakePatchResolution;
uniform float uR738C1BakeDiffuseOnlyMode;
uniform vec2 uR738C1BakeTileOriginPx;
uniform vec2 uR738C1BakeFullAtlasResolution;
uniform sampler2D tR738C1BakeAtlasTexture;
uniform sampler2D tR7310C1FullRoomDiffuseAtlasTexture;
#if !defined(R7310_FORMAL_XATLAS_RAW)
uniform sampler2D tR7310C1FullRoomDiffuseAtlasTextureNonSquare;
#endif
uniform sampler2D tR7310C1XatlasRuntimeFloorPageTexture;
// R7-3.10 C2C: xatlas wall runtime atlas REUSES the tR738C1BakeAtlasTexture slot.
// Floor is the first true independent page texture; total sampler count remains at the Metal 16-TIU budget.
uniform float uR7310C1FullRoomDiffuseMode;
uniform float uR7310C1FullRoomDiffuseReady;
uniform float uR7310C1FloorDiffuseMode;
uniform float uR7310C1NorthWallDiffuseMode;
uniform float uR7310C1EastWallDiffuseMode;
uniform float uR7310C1WestWallDiffuseMode;
uniform float uR7310C1SouthWallDiffuseMode;
uniform float uR7310C1CeilingDiffuseMode;
uniform float uR7310C1StructuralDiffuseMode;
uniform float uR7310C1SeColumnNorthShadowMode;
uniform float uR7310C1SeColumnNorthShadowReady;
uniform float uR7310C1SeColumnNorthShadowResolution;
uniform float uR7310C1SeColumnWestShadowMode;
uniform float uR7310C1SeColumnWestShadowReady;
uniform float uR7310C1SeColumnWestShadowResolution;
uniform float uR7310C1SouthWallAcShadowMode;
uniform float uR7310C1SouthWallAcShadowReady;
uniform float uR7310C1SouthWallAcShadowResolution;
uniform float uR7310C1EastWallBeamShadowMode;
uniform float uR7310C1EastWallBeamShadowReady;
uniform float uR7310C1EastWallBeamShadowResolution;
uniform float uR7310C1SwColumnNorthShadowMode;
uniform float uR7310C1SwColumnNorthShadowReady;
uniform float uR7310C1SwColumnNorthShadowResolution;
uniform float uR7310C1WestWallBeamShadowMode;
uniform float uR7310C1WestWallBeamShadowReady;
uniform float uR7310C1WestWallBeamShadowResolution;
uniform float uR7310C1WestWallBeamShadowZMaxOverride;
uniform float uR7310C1SwColumnInnerShadowMode;
uniform float uR7310C1SwColumnInnerShadowReady;
uniform float uR7310C1SwColumnInnerShadowResolution;
uniform float uR7310C1WestBeamInnerShadowMode;
uniform float uR7310C1WestBeamInnerShadowReady;
uniform float uR7310C1WestBeamInnerShadowResolution;
uniform float uR7310C1WestBeamUnderShadowMode;
uniform float uR7310C1WestBeamUnderShadowReady;
uniform float uR7310C1WestBeamUnderShadowResolution;
uniform float uR7310C1EastBeamInnerShadowMode;
uniform float uR7310C1EastBeamInnerShadowReady;
uniform float uR7310C1EastBeamInnerShadowResolution;
uniform float uR7310C1EastBeamUnderShadowMode;
uniform float uR7310C1EastBeamUnderShadowReady;
uniform float uR7310C1EastBeamUnderShadowResolution;
uniform float uR7310C1SouthWindowLeftRevealShadowMode;
uniform float uR7310C1SouthWindowLeftRevealShadowReady;
uniform float uR7310C1SouthWindowLeftRevealShadowResolution;
uniform float uR7310C1SouthWindowRightRevealShadowMode;
uniform float uR7310C1SouthWindowRightRevealShadowReady;
uniform float uR7310C1SouthWindowRightRevealShadowResolution;
uniform float uR7310C1SouthWindowBottomRevealShadowMode;
uniform float uR7310C1SouthWindowBottomRevealShadowReady;
uniform float uR7310C1SouthWindowBottomRevealShadowResolution;
uniform float uR7310C1SouthWindowTopRevealShadowMode;
uniform float uR7310C1SouthWindowTopRevealShadowReady;
uniform float uR7310C1SouthWindowTopRevealShadowResolution;
uniform float uR7310C1IronDoorRevealMode;
uniform float uR7310C1IronDoorRevealReady;
uniform float uR7310C1IronDoorRevealResolution;
uniform float uR7310C1IronDoorBodyMode;
uniform float uR7310C1IronDoorBodyReady;
uniform float uR7310C1IronDoorBodyDebugMode;
uniform float uR7310C1IronDoorReflectionProbeMode;
uniform float uR7310C1IronDoorReflectionProbeReady;
uniform vec2 uR7310C1IronDoorReflectionProbeAtlasSize;
uniform float uR7310C1IronDoorReflectionProbeFaceSize;
uniform vec3 uR7310C1IronDoorReflectionProbePosition;
uniform vec3 uR7310C1IronDoorReflectionProbeBoxMin;
uniform vec3 uR7310C1IronDoorReflectionProbeBoxMax;
uniform float uR7310C1IronDoorRuntimePlanarReflectionMode;
uniform float uR7310C1IronDoorRuntimePlanarReflectionReady;
uniform vec2 uR7310C1IronDoorRuntimePlanarReflectionTextureSize;
uniform mat4 uR7310C1IronDoorRuntimePlanarReflectionTextureMatrix;
uniform float uR7310C1IronDoorRuntimePlanarReflectionSourcePass;
uniform float uR7310C1IronDoorRuntimePlanarReflectionSourceOneOverSampleCounter;
uniform float uR7310C1IronDoorPlanarReflectionMode;
uniform float uR7310C1IronDoorPlanarReflectionReady;
uniform vec2 uR7310C1IronDoorPlanarReflectionAtlasSize;
uniform vec3 uR7310C1IronDoorPlanarReflectionCameraPosition;
uniform vec3 uR7310C1IronDoorPlanarReflectionCameraForward;
uniform vec3 uR7310C1IronDoorPlanarReflectionCameraRight;
uniform vec3 uR7310C1IronDoorPlanarReflectionCameraUp;
uniform float uR7310C1IronDoorPlanarReflectionCameraFovScale;
uniform float uR7310C1IronDoorPlanarReflectionCameraAspect;
uniform float uR7310C1IronDoorPlanarReflectionCaptureExcludeDoor;
uniform float uR7310C1IronDoorPlanarReflectionCaptureClipPlaneMode;
uniform vec4 uR7310C1IronDoorPlanarReflectionCaptureClipPlane;
uniform vec2 uR7310C1IronDoorBodyAtlasSize;
uniform float uR7310C1RuntimeProbeMode;
uniform float uR7310C1RuntimeAtlasPatchResolution;
uniform float uR7310C1RuntimeAtlasPatchCount;
uniform float uR7310C1RuntimeAtlasGridColumns;
uniform float uR7310C1SeparatedBakeMode;
// ADR 2 v2 Normal-Aux Output：plan §13 ADR-Normal-Aux-Shader、為 OIDN albedo+normal 降噪模式提供 world-space normal G-buffer
// 0.0 = 預設、輸出 indirect_diffuse_radiance；> 0.5 = primary hit early-out、直接輸出 raw firstVisibleNormal
// 值域：[-1, +1]^3、無 pack、無 clamp、單位向量直供 OIDN normal 輔助圖使用
// 對齊 OIDN RT filter normal aux 規格（world-space normal）來源：Open Image Denoise documentation
// 與 r7-3-8-c1-bake-capture-runner.mjs --output-mode=normal 與 ?outputMode=normal URL query 對接
uniform float uR7310C1NormalAuxOutputMode;
uniform float uR7310C1XatlasBakeMode;
uniform float uR7310C1XatlasBakeFullRadianceMode;
uniform float uR7310R42aBakeWitness; // R4-2A BAKE_CAPTURE compile-only 見證 uniform（值 0、runtime 無作用）
uniform vec2 uR7310C1XatlasBakeAtlasSize;
uniform float uR7310C1XatlasRuntimeMode;
uniform float uR7310C1XatlasRuntimeReady;
uniform vec2 uR7310C1XatlasRuntimeAtlasSize;
uniform vec4 uR7310C1XatlasRuntimeLightmapPageIds;
uniform float uR7310C1XatlasRuntimeLightmapPagesMode;
uniform vec2 uR7310C1XatlasRuntimeFloorPageSize;
uniform float uR7310C1XatlasRuntimeSeparatedAlbedo;
uniform float uR7310C1XatlasRuntimeFullWestWallDirectIncluded;
uniform float uR7310C1XatlasRuntimeWestThresholdTopDirectIncluded;
uniform float uR7310C1XatlasRuntimeWestThresholdFrontDirectIncluded;
uniform float uR7310C1XatlasRuntimeFullNorthWallDirectIncluded;
uniform float uR7310C1XatlasRuntimeFullEastWallDirectIncluded;
uniform float uR7310C1XatlasRuntimeFullSouthWallDirectIncluded;
uniform float uR7310C1XatlasRuntimeFullCeilingDirectIncluded;
uniform float uR7310C1XatlasRuntimeDepthH2DirectIncluded;
uniform float uR7310C1XatlasRuntimeFullFloorDirectIncluded;
uniform float uR7310C1XatlasRuntimeCentralDeskDirectIncluded;
uniform float uR7310C1XatlasRuntimeStructuralDirectIncluded;
uniform float uR7310C1XatlasRuntimeSouthWindowRevealsDirectIncluded;
uniform float uR7310C1XatlasRuntimeWestWallSwitchDirectIncluded;
uniform float uR7310C1XatlasRuntimeFullFloorSeparatedAlbedo;
uniform float uR7310C1XatlasRuntimeFullNorthWallMode;
uniform float uR7310C1XatlasRuntimeFullEastWallMode;
uniform float uR7310C1XatlasRuntimeFullCeilingMode;
uniform float uR7310C1XatlasRuntimeFullFloorMode;
uniform float uR7310C1XatlasRuntimeStackedMode;
uniform float uR7310C1XatlasParamSurfaceCount; // R4-2A-2 param runtime：dynamic while loop 上界（uniform、非編譯期常數）
uniform vec4 uR7310C1XatlasParamSurfaceTable[336]; // generated param table：最多 48 面 × 7 vec4
// master shelf-pack：北+東+天花板（寬度不同）打包進同一張貼圖、共用 bake-atlas slot（守 16-TIU）
// rect = (x,y,w,h) 像素（左上原點、y 往下）；MasterMode>0.5 時各面 UV 投到自己的 sub-rect
uniform float uR7310C1XatlasRuntimeMasterMode;
uniform float uR7310C1WestScopeProbeMode;
uniform float uR7310C1XatlasParamWestSurfaceIndex;
uniform float uR7310C1XatlasParamWestWallSwitchPlateIndex;
uniform float uR7310C1XatlasParamWestWallSwitchButtonIndex;
uniform vec4 uR7310C1XatlasRectCeiling;
uniform vec4 uR7310C1XatlasRectNorth;
uniform vec4 uR7310C1XatlasRectEast;
// R7-3.10 第6步：H2（south_window_top_reveal_depth）窗楣 -Y 深度面 master sub-rect（depth_h2）
uniform vec4 uR7310C1XatlasRectDepthH2;
// R7-3.10 §13：地板 C1A shell sub-rect（floor，master append 第四排）
uniform vec4 uR7310C1XatlasRectFloor;
uniform float uR7310C1NorthWallSeparatedDiffuseMode;
uniform float uR7310C1UseNonSquareAtlas;
uniform float uR7310C1NonSquareAtlasReady;
uniform vec2 uR7310C1NonSquareAtlasSizePx;
uniform vec4 uR7310C1NonSquareNorthWallUvRect;
uniform vec4 uR7310C1NonSquareEastWallUvRect;
uniform vec2 uR7310C1NonSquareNorthWallFaceSizePx;
uniform vec2 uR7310C1NonSquareEastWallFaceSizePx;
uniform float uR738C1BakePastePreviewMode;
uniform float uR738C1BakePastePreviewReady;
uniform float uR738C1BakePastePreviewStrength;
// R7-3.10 Phase 2 H7' / sprout-paste-inside-guard probe 用，預設 0：不影響 paste mix 行為
uniform float uR738C1SproutPasteProbeMode;
uniform vec4 uR738C1BakePatchWorldBounds;
uniform vec4 uR7310C1BakeFloorWorldBounds;
uniform float uR739C1AccurateReflectionMode;
uniform float uR739C1ReflectionReferenceMode;
uniform float uR739C1ReflectionSurfaceMaskMode;
uniform float uR739C1ReflectionReady;
uniform float uR739C1ReflectionFloorRoughness;

bool r7310C1XatlasBakeTexelValid = true;
vec3 r7310C1XatlasBakeSurfaceNormal = vec3(0.0, 1.0, 0.0);
uniform float uR739C1CurrentViewReflectionMode;
uniform float uR739C1CurrentViewReflectionReady;
uniform float uR739C1CurrentViewReflectionRoughness;

// R2-13 X-ray 透視剝離
uniform vec3 uCamPos;
uniform vec3 uRoomMin;
uniform vec3 uRoomMax;
uniform float uCullThreshold;
uniform float uCullEpsilon;
uniform float uXrayEnabled; // 0.0 = off, 1.0 = on

// R2-14 東西投射燈軌道（fixtureGroup=1）開關；關閉時 primary 與 secondary ray 皆跳過，自動無陰影
uniform float uTrackLightEnabled; // 0.0 = off, 1.0 = on

// R2-15 南北廣角燈軌道（fixtureGroup=2）開關
uniform float uWideTrackLightEnabled; // 0.0 = off, 1.0 = on

// R2-16 Cloud 吸音板（fixtureGroup=3）開關；關閉時 6 片 box 於 shader 層整體跳過，吸頂燈位置 JS 端聯動
uniform float uCloudPanelEnabled; // 0.0 = off, 1.0 = on

// R2-17 Cloud 漫射燈條（fixtureGroup=4）開關；4 支矩形長柱 emission=0 視覺幾何，真光源留 R3
uniform float uCloudLightEnabled; // 0.0 = off, 1.0 = on

// R2-18 Step 6 per-class roughness / metalness scale（三類金屬分離調控；非金屬不受影響）
uniform float uIronDoorRoughnessScale;
uniform float uIronDoorMetalnessScale;
uniform float uStandRoughnessScale;
uniform float uStandMetalnessScale;
uniform float uStandPillarRoughnessScale;
uniform float uStandPillarMetalnessScale;

// R2-18 Phase 2：軌道+燈具本體束包（TRACK 軌道、LAMP_SHELL 吸頂燈殼、CLOUD_LIGHT 燈條、投射/廣角燈頭）
uniform float uFixtureRoughness;
uniform float uFixtureMetalness;

// R2-18 fix17：地板磁磚（霧面磁磚，dielectric Fresnel + roughness blur）
uniform float uFloorRoughness;

// R2-18 fix19：間接光倍率（僅作用於 diffuseBounceMask 檢索路徑，不影響 direct NEE）
uniform float uIndirectMultiplier;

// R3-0：legacy gain（10 處 mask *= weight × magic 魔數集中管理；預設 1.5 維持 R2-18 亮度，為 R3-5 MIS 歸一做準備）
uniform float uLegacyGain;
// R3-6.5 S2：Dynamic light pool (LUT + count)。依 GUI 九個 emitter checkbox 即時重建 active 名單。
//   uActiveLightCount：有效光源數量（0..11）；0 時 sampleStochasticLightDynamic black-out 回退 nl。
//   uActiveLightIndex[11]：slot→real idx LUT（未用 slot 填 -1，僅前 count 個有效）。
uniform int uActiveLightCount;
uniform int uActiveLightIndex[11];
uniform float uActiveLightPickPdf[11];
uniform float uActiveLightPickCdf[11];
uniform float uR72LightImportanceSamplingMode;
uniform float uR3ProbeSentinel;
uniform int uCloudVisibilityProbeMode;
uniform int uCloudVisibilityProbeRod;
uniform int uCloudVisibilityProbeClass;
uniform int uCloudVisibilityProbeThetaBin;
uniform int uCloudVisibilityProbeThetaBinCount;
uniform int uCloudThetaImportanceShaderABMode;
uniform int uCloudMisWeightProbeMode;
uniform int uCloudContributionProbeMode;
uniform float uCloudDarkSurfaceCleanupMode;
uniform float uCloudDarkSurfaceCleanupLuma;
uniform float uCloudSameSurfaceDarkFillMode;
uniform float uCloudSameSurfaceDarkFillStrength;
uniform float uCloudSameSurfaceDarkFillMaxSamples;
uniform float uCloudSameSurfaceDarkFillFloorLuma;
uniform float uCloudSameSurfaceDarkFillGikLuma;
uniform vec3 uCloudEmission[4];
uniform vec3 uTrackEmission[4];
uniform vec3 uTrackWideEmission[2];
uniform float uR3EmissionGate;   // R3-1 起預留；R3-3 S3b 翻 1.0
// R6-3 Phase 1C：Cloud rod analytic 1/4 arc emitter meta。
uniform float uCloudObjIdBase;   // R3-3 fix01：= objectCount(0) + CLOUD_BOX_IDX_BASE(72) + 1 = 73（sceneBoxes 陣列 index，非註解邏輯 ID）
uniform float uCloudFaceArea[4]; // [0]=E [1]=W [2]=S [3]=N，A_face = 0.016 × rodLength
uniform float uEmissiveClamp;    // R3-3 firefly clamp（median×30 估算；預設 50）
// 每 rod 存世界空間 center + 完整半邊 (halfX, halfY, halfZ)；NEE / hit 由此重建 1/4 圓弧面。
uniform vec3 uCloudRodCenter[4];
uniform vec3 uCloudRodHalfExtent[4];
// R3-4：Track spot lamp emitter meta（4 盞，hitType=TRACK_LIGHT）
uniform vec2 uTrackBeamCos[4];   // .x = cos(inner_half) ≈ 0.9659（15°）；.y = cos(outer_half) ≈ 0.8660（30°）；smoothstep 邊界 edge0=.y、edge1=.x
uniform float uTrackLampIdBase;  // R3-4 fix01：= objectCount(0) + 400 = 400（pre-bake objectCount，仿 R3-3 uCloudObjIdBase pattern；CalculateRadiance 無 objectCount 區域變數可見）；JS 端 TRACK_LAMP_ID_BASE 同步契約，throw-first assertion 守門
// R3-5a：TrackWide 廣角燈 emitter meta（2 盞，hitType=TRACK_WIDE_LIGHT；複用 R3-4 Option A' pattern）
uniform vec2 uTrackWideBeamCos[2];   // .x = cos(inner_half) ≈ 0.5736（55°）；.y = cos(outer_half) = 0.5（60°）；smoothstep 邊緣軟於 spot（全角 120°）
uniform float uTrackWideLampIdBase;  // = 700（pre-bake，避開 400 spot / 500 wide housing / 600 spot housing）；JS 端 TRACK_WIDE_LAMP_ID_BASE 同步契約

// R2-14 投射燈頭（4 盞傾斜圓柱；pivot 位於支架底，半徑 3cm、長 13.5cm；與 uTrackLightEnabled 共開關）
uniform vec3 uTrackLampPos[4];
uniform vec3 uTrackLampDir[4];

// R2-15 廣角燈頭（2 盞矮胖圓柱；pivot 位於支架底 y=2.845，半徑 5cm、長 7.2cm；與 uWideTrackLightEnabled 共開關）
// 形狀撈自舊專案 Path Tracking 260412a 5.4 Clarity.html：半徑 0.05m、長度 0.072m，比 R2-14 投射燈矮胖
uniform vec3 uTrackWideLampPos[2];
uniform vec3 uTrackWideLampDir[2];

int primaryRay = 1; // 僅 bounces==0 為 1，其餘為 0

#define BACKDROP 5
#define SPEAKER 6
#define WOOD_DOOR 7
#define IRON_DOOR 8
#define SUBWOOFER 9
#define ACOUSTIC_PANEL 10
#define OUTLET 11
#define LAMP_SHELL 12
#define TRACK 13
#define CLOUD_LIGHT 14 // R6-3 Phase 1C Cloud analytic 1/4 arc emitter
#define TRACK_LIGHT 15 // R3-4 軌道投射燈 emitter 圓柱（hitType-only branch，emissive primary/specular accumulation；與 TRACK=13 軌道鋁槽 box 分家）
#define TRACK_WIDE_LIGHT 16 // R3-5a 軌道廣角燈 emitter 圓盤（pattern 同 TRACK_LIGHT，全角 120° 軟邊 smoothstep gate；與 TRACK=13/TRACK_LIGHT=15 分家）
// R3-4 fix07：發光圓盤面積（disk-area NEE integrand 需乘此常數，對齊 L = Φ/(K·π·A) radiance 量綱契約）
// 雙源同步契約：與 js/Home_Studio.js TRACK_LAMP_EMITTER_AREA = Math.PI * 0.03² 值一致（≈ 2.8274e-3 m²）
const float TRACK_LAMP_EMITTER_AREA = PI * 0.03 * 0.03;
// R3-5a：廣角燈發光圓盤面積（r=5cm）；雙源同步契約與 js/Home_Studio.js TRACK_WIDE_LAMP_EMITTER_AREA = Math.PI * 0.05² 值一致（≈ 7.8540e-3 m²）
const float TRACK_WIDE_LAMP_EMITTER_AREA = PI * 0.05 * 0.05;

// R2-6 旋轉物件逆矩陣
uniform mat4 uLeftSpeakerInvMatrix;
uniform mat4 uLeftStandBaseInvMatrix;
uniform mat4 uLeftStandPillarInvMatrix;
uniform mat4 uLeftStandTopInvMatrix;
uniform mat4 uRightSpeakerInvMatrix;
uniform mat4 uRightStandBaseInvMatrix;
uniform mat4 uRightStandPillarInvMatrix;
uniform mat4 uRightStandTopInvMatrix;

// R2-6 物件空間 AABB（half-size，中心在原點）
#define N_ROTATED 8
const vec3 rotHalf[N_ROTATED] = vec3[N_ROTATED](
    vec3(0.1125, 0.1725, 0.1365),  // 左喇叭
    vec3(0.125,  0.015,  0.15),    // 左底座
    vec3(0.02,   0.43,   0.05),    // 左支柱
    vec3(0.10,   0.01,   0.125),   // 左頂板
    vec3(0.1125, 0.1725, 0.1365),  // 右喇叭
    vec3(0.125,  0.015,  0.15),    // 右底座
    vec3(0.02,   0.43,   0.05),    // 右支柱
    vec3(0.10,   0.01,   0.125)    // 右頂板
);
const vec3 rotColor[N_ROTATED] = vec3[N_ROTATED](
    vec3(0.12, 0.12, 0.12),       // C_SPEAKER
    vec3(0.08, 0.08, 0.08),       // C_STAND
    vec3(0.80, 0.82, 0.85),       // C_STAND_PILLAR
    vec3(0.08, 0.08, 0.08),       // C_STAND
    vec3(0.12, 0.12, 0.12),       // C_SPEAKER
    vec3(0.08, 0.08, 0.08),       // C_STAND
    vec3(0.80, 0.82, 0.85),       // C_STAND_PILLAR
    vec3(0.08, 0.08, 0.08)        // C_STAND
);
// R2-18 旋轉物件材質（SPEAKER 走 type 分支不依此；C_STAND / C_STAND_PILLAR 為金屬）
const float rotRoughness[N_ROTATED] = float[N_ROTATED](
    0.4,  // 左喇叭 SPEAKER
    0.2,  // 左底座 C_STAND（金屬亮黑漆）
    0.55, // 左支柱 C_STAND_PILLAR（霧面鋁）
    0.2,  // 左頂板 C_STAND
    0.4,  // 右喇叭 SPEAKER
    0.2,  // 右底座 C_STAND
    0.55, // 右支柱 C_STAND_PILLAR
    0.2   // 右頂板 C_STAND
);
const float rotMetalness[N_ROTATED] = float[N_ROTATED](
    0.0,  // 喇叭非金屬
    1.0,  // C_STAND 金屬
    1.0,  // C_STAND_PILLAR 金屬
    1.0,
    0.0,
    1.0,
    1.0,
    1.0
);

vec3 rayOrigin, rayDirection;
vec3 hitNormal, hitEmission, hitColor;
vec3 hitBoxMin, hitBoxMax;
vec3 hitObjNormal;  // 旋轉物件的物件空間法向量
vec3 hitObjPos;     // 旋轉物件的物件空間命中點
vec3 hitObjHalf;    // 旋轉物件的 half-size
vec2 hitUV;
float hitObjectID;
float hitBoxIndex;
float hitBoxCullable;
float hitBoxFixtureGroup;
int hitType = -100;
float hitMeta;
// R2-18 命中材質
float hitRoughness;
float hitMetalness;
// R7-3-x GIK 橫擺面板旋轉旗標：>0.5 時 UV 順時針 90 度旋轉（北牆 N1/N2/N3）
float hitRotateUV90;
int hitIsRayExiting;

struct Quad { vec3 normal; vec3 v0; vec3 v1; vec3 v2; vec3 v3; vec3 emission; vec3 color; int type; };

Quad ceilingLampQuad; // R2-11 向下矩形光 importance sampling PDF 目標（不加入幾何）

#include <pathtracing_random_functions>

#include <pathtracing_box_intersect>

#include <pathtracing_box_interior_intersect>

#include <pathtracing_boundingbox_intersect>

#include <pathtracing_sample_quad_light>

// R3-6：MIS Phase-1 helpers（power heuristic β=2；Veach 1997 thesis §9.2.4）
// scope：ceiling quadLight (NEE pool idx 0) + Cloud 4 rod (idx 7-10) = 5 DIFF-emitters
// Track/Wide 6 盞（idx 1-6）BSDF-hit 維持 R3-5b `bounceIsSpecular == TRUE` 直接累加，不套 MIS（避 cone 外能量洩漏）。
// 使用 p*p（非 pow(p, 2.0)）：Apple-M / Mesa fp32 pow 走 exp2(log2(x)*2) ~1 ULP 精度損失；p*p 單指令 fma <0.5 ULP。
float misPowerWeight(float p1, float p2)
{
	float p1sq = p1 * p1;
	float p2sq = p2 * p2;
	float denom = p1sq + p2sq;
	if (denom < 1e-12) return 0.5; // p1 = p2 = 0 特判（S3 pre-mortem）
	return p1sq / denom;
}
float cosWeightedPdf(vec3 dir, vec3 normal)
{
	// Lambertian 於 direction 之 solid-angle PDF = cos(θ) / π（θ 為與 normal 夾角）
	return max(0.0, dot(dir, normal)) * ONE_OVER_PI;
}
vec3 cloudMisWeightProbeDirectNee(float wNee, float pNee, float pBsdf)
{
	if (uCloudMisWeightProbeMode == 1)
		return vec3(wNee, 1.0, 0.0);
	if (uCloudMisWeightProbeMode == 2)
		return vec3(pNee, pBsdf, 1.0);
	return vec3(0.0);
}
vec3 cloudMisWeightProbeBsdfHit(float wBsdf, float pBsdf, float pNeeReverse)
{
	if (uCloudMisWeightProbeMode == 3)
		return vec3(wBsdf, 1.0, 0.0);
	if (uCloudMisWeightProbeMode == 4)
		return vec3(pNeeReverse, pBsdf, 1.0);
	return vec3(0.0);
}
float cloudMisProbeLuma(vec3 c)
{
	return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
vec3 cloudMisWeightProbeContribution(vec3 weightedContribution, vec3 unweightedContribution)
{
	return vec3(cloudMisProbeLuma(weightedContribution), 1.0, cloudMisProbeLuma(unweightedContribution));
}
vec3 cloudMisWeightProbeBsdfHitContributionSentinel()
{
	return vec3(0.125, 1.0, 0.5);
}
vec3 cloudMisWeightProbeUniformSentinel()
{
	return vec3(0.25, 1.0, 0.75);
}
vec3 cloudMisWeightProbeContributionUniformSentinel()
{
	return (uCloudContributionProbeMode == 3) ? vec3(0.375, 1.0, 0.875) : vec3(0.625, 1.0, 0.125);
}
bool cloudDirectNeeSourceIsFloor(int sourceHitType, float sourceObjectID, vec3 sourceNormal, vec3 sourcePosition)
{
	return sourceObjectID < 1.5 && sourceNormal.y > 0.5 && sourcePosition.y < 0.1;
}
bool cloudDirectNeeSourceIsGik(int sourceHitType)
{
	return sourceHitType == ACOUSTIC_PANEL;
}
bool cloudDirectNeeSourceIsCeiling(int sourceHitType, float sourceObjectID, vec3 sourceNormal, vec3 sourcePosition)
{
	return sourceObjectID < 1.5 && sourceNormal.y < -0.5 && sourcePosition.y > 2.8;
}
bool cloudDirectNeeSourceIsWall(int sourceHitType, float sourceObjectID, vec3 sourceNormal)
{
	return sourceObjectID < 1.5 && abs(sourceNormal.y) <= 0.5;
}
bool cloudVisibleSurfaceIsFloor(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return cloudDirectNeeSourceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
}
bool cloudVisibleSurfaceIsGik(int visibleHitType)
{
	return cloudDirectNeeSourceIsGik(visibleHitType);
}
bool cloudVisibleSurfaceIsCeiling(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return cloudDirectNeeSourceIsCeiling(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
}
bool cloudVisibleSurfaceIsWall(int visibleHitType, float visibleObjectID, vec3 visibleNormal)
{
	return cloudDirectNeeSourceIsWall(visibleHitType, visibleObjectID, visibleNormal);
}
bool cloudVisibleSurfaceIsObject(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return !cloudVisibleSurfaceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		!cloudVisibleSurfaceIsGik(visibleHitType) &&
		!cloudVisibleSurfaceIsCeiling(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		!cloudVisibleSurfaceIsWall(visibleHitType, visibleObjectID, visibleNormal);
}
vec4 r738C1SurfaceClassColor(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	if (cloudVisibleSurfaceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition)) return vec4(1.0, 0.0, 0.0, 1.0);
	if (cloudVisibleSurfaceIsGik(visibleHitType)) return vec4(0.0, 1.0, 0.0, 1.0);
	if (cloudVisibleSurfaceIsCeiling(visibleHitType, visibleObjectID, visibleNormal, visiblePosition)) return vec4(0.0, 0.0, 1.0, 1.0);
	if (cloudVisibleSurfaceIsWall(visibleHitType, visibleObjectID, visibleNormal)) return vec4(1.0, 1.0, 0.0, 1.0);
	if (cloudVisibleSurfaceIsObject(visibleHitType, visibleObjectID, visibleNormal, visiblePosition)) return vec4(1.0, 0.0, 1.0, 1.0);
	return vec4(0.0, 0.0, 0.0, 1.0);
}
#if defined(R7310_INCLUDE_BAKE_CAPTURE)
bool r738C1BakeSurfacePoint(int patchId, vec2 texelUv, out vec3 position, out vec3 normal, out int hitType, out float objectID)
{
	vec2 uv = clamp(texelUv, vec2(0.0), vec2(1.0));
	if (patchId == 0)
	{
		float x = mix(-1.0, 1.0, uv.x);
		float z = mix(-1.0, 1.0, uv.y);
		position = vec3(x, 0.01, z);
		normal = vec3(0.0, 1.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	position = vec3(0.0);
	normal = vec3(0.0, 1.0, 0.0);
	hitType = 0;
	objectID = 0.0;
	return false;
}
#endif
bool r7310C1EastWallHiddenByStaticContact(float z, float y)
{
	return false;
}
bool r7310C1FloorHiddenByStaticContact(float x, float z)
{
	return false;
}
float r7310C1FloorBakeSafeX(float x)
{
	float inset = 4.22 / max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	float westBand = step(-1.91 - inset, x) * (1.0 - step(-1.91 + inset, x));
	float eastBand = step(1.91 - inset, x) * (1.0 - step(1.91 + inset, x));
	x = mix(x, -1.91 + inset, westBand);
	x = mix(x, 1.91 - inset, eastBand);
	return x;
}
bool r7310C1NorthWallHiddenByStaticContact(float x, float y)
{
	return false;
}
bool r7310C1SouthWallAtlasRect(float x, float y, float xMin, float xMax, float yMin, float yMax)
{
	float halfX = 2.11 / max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	float halfY = 1.4525 / max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	return x >= xMin - halfX && x <= xMax + halfX && y >= yMin - halfY && y <= yMax + halfY;
}
float r7310C1SouthWallRevealBakePackedX(float x, float xMin, float xMax)
{
	float inset = 4.22 / max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	return clamp(x, xMin + inset, xMax - inset);
}
float r7310C1SouthWallRevealBakePackedY(float y, float yMin, float yMax)
{
	float inset = 2.905 / max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	return clamp(y, yMin + inset, yMax - inset);
}
vec2 r7310C1SouthWallAtlasUvFromPackedPoint(float x, float y)
{
	return vec2((x + 2.11) / 4.22, y / 2.905);
}
float r7310C1SouthWallFrontHoleEdgeBand()
{
	return max(0.025, 8.0 * 4.22 / max(1.0, uR7310C1RuntimeAtlasPatchResolution));
}
float r7310C1SouthWallClampPackedX(float x, float xMin, float xMax)
{
	float inset = 4.22 / max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	return clamp(x, xMin + inset, xMax - inset);
}
float r7310C1SouthWallClampPackedY(float y, float yMin, float yMax)
{
	float inset = 2.905 / max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	return clamp(y, yMin + inset, yMax - inset);
}
bool r7310C1SouthWallWindowRevealBakePoint(float x, float y, out vec3 position, out vec3 normal)
{
	float revealY = 0.0;
	float revealZ = 0.0;
	float revealX = 0.0;
	if (r7310C1SouthWallAtlasRect(x, y, -1.69, -1.52, 1.10, 2.845))
	{
		float safeX = r7310C1SouthWallRevealBakePackedX(x, -1.69, -1.52);
		revealY = mix(1.04, 2.905, (y - 1.10) / (2.845 - 1.10));
		revealZ = mix(3.056, 3.256, (safeX + 1.69) / (-1.52 + 1.69));
		position = vec3(-1.75, revealY, revealZ);
		normal = vec3(1.0, 0.0, 0.0);
		return true;
	}
	if (r7310C1SouthWallAtlasRect(x, y, 0.46, 0.63, 1.10, 2.845))
	{
		float safeX = r7310C1SouthWallRevealBakePackedX(x, 0.46, 0.63);
		revealY = mix(1.04, 2.905, (y - 1.10) / (2.845 - 1.10));
		revealZ = mix(3.056, 3.256, (safeX - 0.46) / (0.63 - 0.46));
		position = vec3(0.69, revealY, revealZ);
		normal = vec3(-1.0, 0.0, 0.0);
		return true;
	}
	if (r7310C1SouthWallAtlasRect(x, y, -1.52, 0.46, 1.10, 1.27))
	{
		float safeY = r7310C1SouthWallRevealBakePackedY(y, 1.10, 1.27);
		revealX = mix(-1.75, 0.69, (x + 1.52) / (0.46 + 1.52));
		revealZ = mix(3.056, 3.256, (safeY - 1.10) / (1.27 - 1.10));
		position = vec3(revealX, 1.04, revealZ);
		normal = vec3(0.0, 1.0, 0.0);
		return true;
	}
	if (r7310C1SouthWallAtlasRect(x, y, -1.52, 0.46, 2.675, 2.845))
	{
		float safeY = r7310C1SouthWallRevealBakePackedY(y, 2.675, 2.845);
		revealX = mix(-1.75, 0.69, (x + 1.52) / (0.46 + 1.52));
		revealZ = mix(3.056, 3.256, (safeY - 2.675) / (2.845 - 2.675));
		position = vec3(revealX, 2.905, revealZ);
		normal = vec3(0.0, -1.0, 0.0);
		return true;
	}
	return false;
}
bool r7310C1SouthWallWindowFrontEdgeDiffuseUv(vec3 visiblePosition, vec3 visibleNormal, out vec2 atlasUv)
{
	atlasUv = vec2(0.0);
	if (visibleNormal.z >= -0.5 ||
		visiblePosition.z < 3.05 || visiblePosition.z > 3.07 ||
		visiblePosition.x < -1.75 || visiblePosition.x > 0.69 ||
		visiblePosition.y < 1.04 || visiblePosition.y > 2.905)
		return false;

	float leftDistance = visiblePosition.x + 1.75;
	float rightDistance = 0.69 - visiblePosition.x;
	float bottomDistance = visiblePosition.y - 1.04;
	float topDistance = 2.905 - visiblePosition.y;
	float nearestDistance = min(min(leftDistance, rightDistance), min(bottomDistance, topDistance));
	if (nearestDistance > r7310C1SouthWallFrontHoleEdgeBand())
		return false;

	float tx = clamp((visiblePosition.x + 1.75) / (0.69 + 1.75), 0.0, 1.0);
	float ty = clamp((visiblePosition.y - 1.04) / (2.905 - 1.04), 0.0, 1.0);
	if (bottomDistance <= topDistance &&
		bottomDistance <= leftDistance &&
		bottomDistance <= rightDistance)
	{
		atlasUv = r7310C1SouthWallAtlasUvFromPackedPoint(
			r7310C1SouthWallClampPackedX(mix(-1.52, 0.46, tx), -1.52, 0.46),
			1.10 + 2.905 / max(1.0, uR7310C1RuntimeAtlasPatchResolution)
		);
		return true;
	}
	if (topDistance <= leftDistance &&
		topDistance <= rightDistance)
	{
		atlasUv = r7310C1SouthWallAtlasUvFromPackedPoint(
			r7310C1SouthWallClampPackedX(mix(-1.52, 0.46, tx), -1.52, 0.46),
			2.675 + 2.905 / max(1.0, uR7310C1RuntimeAtlasPatchResolution)
		);
		return true;
	}
	if (leftDistance <= rightDistance)
	{
		atlasUv = r7310C1SouthWallAtlasUvFromPackedPoint(
			-1.69 + 4.22 / max(1.0, uR7310C1RuntimeAtlasPatchResolution),
			r7310C1SouthWallClampPackedY(mix(1.10, 2.845, ty), 1.10, 2.845)
		);
		return true;
	}
	atlasUv = r7310C1SouthWallAtlasUvFromPackedPoint(
		0.46 + 4.22 / max(1.0, uR7310C1RuntimeAtlasPatchResolution),
		r7310C1SouthWallClampPackedY(mix(1.10, 2.845, ty), 1.10, 2.845)
	);
	return true;
}
bool r7310C1StructuralSeColumnNorthHiddenByEastBeam(float x, float y)
{
	return x >= 1.85 && y >= 2.515;
}
bool r7310C1SeColumnNorthShadowHiddenByEastBeam(float x, float y)
{
	return x >= 1.85 &&
		x <= 1.91 &&
		y >= 2.515 &&
		y <= 2.905;
}
bool r7310C1StructuralSeColumnInnerHiddenByBookshelf(float z, float y)
{
	return z >= 2.73 && y <= 2.04;
}
const float R7310_C1_NORTH_WALL_SIDE_WALL_WEST_X_MAX = -1.91;
const float R7310_C1_NORTH_WALL_SIDE_WALL_EAST_X_MIN = 1.91;
bool r7310C1NorthWallHiddenBySideWall(float x)
{
	return x <= R7310_C1_NORTH_WALL_SIDE_WALL_WEST_X_MAX ||
		x >= R7310_C1_NORTH_WALL_SIDE_WALL_EAST_X_MIN;
}
const float R7310_C1_NORTH_WALL_DOOR_HOLE_X_MIN = -1.52;
const float R7310_C1_NORTH_WALL_DOOR_HOLE_X_MAX = -0.73;
const float R7310_C1_NORTH_WALL_DOOR_HOLE_Y_MIN = 0.0;
const float R7310_C1_NORTH_WALL_DOOR_HOLE_Y_MAX = 2.03;
bool r7310C1NorthWallHiddenByDoorHole(float x, float y)
{
	return x >= R7310_C1_NORTH_WALL_DOOR_HOLE_X_MIN &&
		x <= R7310_C1_NORTH_WALL_DOOR_HOLE_X_MAX &&
		y >= R7310_C1_NORTH_WALL_DOOR_HOLE_Y_MIN &&
		y <= R7310_C1_NORTH_WALL_DOOR_HOLE_Y_MAX;
}
const float R7310_C1_NORTH_WALL_BEAM_GAP_WEST_X_MIN = -1.908;
const float R7310_C1_NORTH_WALL_BEAM_GAP_WEST_X_MAX = -1.752;
const float R7310_C1_NORTH_WALL_BEAM_GAP_WEST_Y_MIN = 2.525;
const float R7310_C1_NORTH_WALL_BEAM_GAP_WEST_Y_MAX = 2.905;
const float R7310_C1_NORTH_WALL_BEAM_GAP_EAST_X_MIN = 1.850;
const float R7310_C1_NORTH_WALL_BEAM_GAP_EAST_X_MAX = 1.908;
const float R7310_C1_NORTH_WALL_BEAM_GAP_EAST_Y_MIN = 2.516;
const float R7310_C1_NORTH_WALL_BEAM_GAP_EAST_Y_MAX = 2.905;
const float R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS = 0.000625;
const float R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_LIFT = 0.000125;
const float R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_DIR_EPS = 0.000001;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_NONE = 0;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_BED_TOP = 1;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_BEAM_VERTICAL_SEAM = 2;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_VERTICAL_SEAM = 3;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BED_TOP = 4;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_SW_COLUMN_VERTICAL_SEAM = 5;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_SOUTH_DESK_TOP = 6;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_SOUTH_DESK_SW_COLUMN_CORNER = 7;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_IRON_THRESHOLD_TOP = 8;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_IRON_THRESHOLD_TOP_WEST_EDGE = 9;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_BEAM_UNDER_SEAM = 10;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_SE_COLUMN_SEAM = 11;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_INNER_UNDER_SEAM = 12;
const int R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_SE_COLUMN_VERTICAL_SEAM = 13;
// R7-3.10 source.md §39-§40: confirmed bed-top coplanar bake bug line.
const float R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_X_MIN = -0.027;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_X_MAX = 1.910;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_PLANE_Y = 0.280;
// R7-3.10 west-beam whole seam trial: user LIVE found residuals above and below the §63 mid-band.
const float R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_PLANE_X = -1.750;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_Y_MIN = 2.515;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_Y_MAX = 2.905;
// R7-3.10 east-beam whole seam trial: mirror west-beam contact, escaping inward from the east beam.
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_PLANE_X = 1.850;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_Y_MIN = 2.516;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_Y_MAX = 2.905;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Y = 2.515;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Z_MIN = -1.874;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Z_MAX = 2.490;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Z = 2.490;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Y_MIN = 0.0;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Y_MAX = 2.905;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_INNER_X = 1.850;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SE_COLUMN_Y_MIN = 2.515;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SE_COLUMN_Y_MAX = 2.905;

// 東牆 bed-top 接觸邊（床東面 x=1.91 與東牆共面、床頂 y=0.28、z 為床深度範圍）
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_PLANE_X = 1.910;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_PLANE_Y = 0.280;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_Z_MIN = -1.874;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_Z_MAX = -0.314;
// 西牆 / 西南柱北面接觸邊（西牆 x=-1.91，西南柱北面 z=2.846，沿 y 全高）。
const float R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SW_COLUMN_SEAM_PLANE_Z = 2.846;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SW_COLUMN_SEAM_Y_MIN = 0.0;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SW_COLUMN_SEAM_Y_MAX = 2.905;
// 西牆 / 南方系統木桌桌面上緣接觸邊（西牆 x=-1.91，桌面 y=0.77，沿 z 到南牆）。
const float R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SOUTH_DESK_TOP_PLANE_Y = 0.77;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SOUTH_DESK_TOP_Z_MIN = 2.385;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SOUTH_DESK_TOP_Z_MAX = 3.056;
// 西牆 / 鐵門門檻頂邊接觸線（西牆 x=-1.91，門檻上緣 y=0.09，沿門洞 z）。
const float R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_PLANE_Y = 0.09;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_Z_MIN = -1.874;
const float R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_Z_MAX = -0.984;
// 鐵門門檻頂面貼西牆室內側邊（門檻頂面 y=0.09，室內側 x=-1.91，沿門洞 z）。
const float R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_IRON_THRESHOLD_TOP_WEST_EDGE_PLANE_X = -1.91;
bool r7310C1NorthWallHiddenByBeamGap(float x, float y)
{
	// R7-3.10 global seam hardening (OPUS 2026-06-03): mirror JS
	// R7310_C1_NORTH_WALL_BEAM_GAP_INVALID_REGIONS (InitCommon.js). The west/east beam
	// north caps are coplanar with the north-wall plane (z=-1.874, normal +Z, objectID<1.5)
	// so they pass RuntimeSurfaceIsNorthWall and the north-wall hybrid CLAIMS them. JS
	// metadata already marks those texels invalid (alpha=0); the valid-linear sampler then
	// returns vec3(0.0) -> the thin west-beam-north-end black line (visible with the
	// non-square d800 atlas, hidden on the dilation-filled square atlas). Runtime ownership
	// MUST exclude the same region so the cap LIVE-TRACES instead. The two sides are locked
	// by docs/tests/r7-3-10-north-wall-beam-gap-contract.test.js -- changing one constant
	// without the other reopens the seam.
	bool westBeamGap = x >= R7310_C1_NORTH_WALL_BEAM_GAP_WEST_X_MIN &&
		x <= R7310_C1_NORTH_WALL_BEAM_GAP_WEST_X_MAX &&
		y >= R7310_C1_NORTH_WALL_BEAM_GAP_WEST_Y_MIN &&
		y <= R7310_C1_NORTH_WALL_BEAM_GAP_WEST_Y_MAX;
	bool eastBeamGap = x >= R7310_C1_NORTH_WALL_BEAM_GAP_EAST_X_MIN &&
		x <= R7310_C1_NORTH_WALL_BEAM_GAP_EAST_X_MAX &&
		y >= R7310_C1_NORTH_WALL_BEAM_GAP_EAST_Y_MIN &&
		y <= R7310_C1_NORTH_WALL_BEAM_GAP_EAST_Y_MAX;
	return westBeamGap || eastBeamGap;
}
bool r7310C1NorthWallOwnerExcluded(float x, float y)
{
	return r7310C1NorthWallHiddenBySideWall(x) ||
		r7310C1NorthWallHiddenByDoorHole(x, y) ||
		r7310C1NorthWallHiddenByBeamGap(x, y);
}
bool r7310C1SouthWallHiddenBySideColumn(float x, float y)
{
	bool swColumnBack = x >= -1.91 && x <= -1.75 && y >= 0.0 && y <= 2.905;
	bool seColumnBack = x >= 1.78 && x <= 1.91 && y >= 0.0 && y <= 2.905;
	return swColumnBack || seColumnBack;
}
bool r7310C1SwColumnInnerHiddenBySouthWall(float z, float y)
{
	return z >= 3.056 && z <= 3.256 && y >= 0.0 && y <= 2.905;
}
bool r7310C1EastWallHiddenByBeamOrSeColumn(float z, float y)
{
	return z >= 2.49 || (z <= 2.49 && y >= 2.515);
}
bool r7310C1WestWallHiddenByBeamOrSwColumn(float z, float y)
{
	return z >= 2.846 || (z <= 2.846 && y >= 2.525);
}
bool r7310C1SouthWallAcShadowHiddenBySeColumn(float x, float y)
{
	return x >= 1.78 &&
		x <= 1.91 &&
		y >= 0.0 &&
		y <= 2.905;
}
bool r7310C1SouthWallAcShadowHiddenBySideColumn(float x, float y)
{
	// R7-3.10 global seam hardening: mirror JS R7310_C1_SOUTH_WALL_AC_SHADOW_SW/SE_COLUMN_BACK.
	// The AC-shadow face shares the south-wall side-column backs; bake-point 1010 + metadata already
	// exclude them, so the runtime gate must too. Locked by the south-wall side-column contract test.
	bool acSwColumnBack = x >= -1.91 && x <= -1.75 && y >= 0.0 && y <= 2.905;
	bool acSeColumnBack = x >= 1.78 && x <= 1.91 && y >= 0.0 && y <= 2.905;
	return acSwColumnBack || acSeColumnBack;
}
// R7-3.10 iron-door reveal guard-band contract constants (single source of truth; Phase 3 metadata builder MUST reuse).
const float IRON_DOOR_REVEAL_BAND_H = 0.25;                                                   // 4 faces -> 4 v-bands
const float IRON_DOOR_REVEAL_GUARD_V = 0.04;                                                  // guard each side of every band (atlas-v)
const float IRON_DOOR_REVEAL_CORE_H = IRON_DOOR_REVEAL_BAND_H - 2.0 * IRON_DOOR_REVEAL_GUARD_V; // 0.17 usable core per band
#if defined(R7310_INCLUDE_BAKE_CAPTURE)
bool r7310C1BakeSurfacePoint(int patchId, vec2 texelUv, out vec3 position, out vec3 normal, out int hitType, out float objectID)
{
	vec2 uv = clamp(texelUv, vec2(0.0), vec2(1.0));
	if (patchId == 1001)
	{
		float x = mix(uR7310C1BakeFloorWorldBounds.x, uR7310C1BakeFloorWorldBounds.y, uv.x);
		float z = mix(uR7310C1BakeFloorWorldBounds.z, uR7310C1BakeFloorWorldBounds.w, uv.y);
		position = vec3(r7310C1FloorBakeSafeX(x), 0.01, z);
		normal = vec3(0.0, 1.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1002)
	{
		float x = mix(-2.11, 2.11, uv.x);
		float y = mix(0.0, 2.905, uv.y);
		if (r7310C1NorthWallOwnerExcluded(x, y))
			return false;
		position = vec3(x, y, -1.874);
		normal = vec3(0.0, 0.0, 1.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1003)
	{
		float z = mix(-1.874, 3.056, uv.x);
		float y = mix(0.0, 2.905, uv.y);
		if (r7310C1EastWallHiddenByBeamOrSeColumn(z, y))
			return false;
		position = vec3(1.91, y, z);
		normal = vec3(-1.0, 0.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1004)
	{
		float z = mix(-1.874, 3.056, uv.x);
		float y = mix(0.0, 2.905, uv.y);
		if (z >= -1.874 && z <= -0.984 && y >= 0.09 && y <= 2.04)
			return false;
		if (r7310C1WestWallHiddenByBeamOrSwColumn(z, y))
			return false;
		position = vec3(-1.91, y, z);
		normal = vec3(1.0, 0.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1005)
	{
		float x = mix(-2.11, 2.11, uv.x);
		float y = mix(0.0, 2.905, uv.y);
		if (r7310C1SouthWallHiddenBySideColumn(x, y))
			return false;
		if (r7310C1SouthWallWindowRevealBakePoint(x, y, position, normal))
		{
			hitType = 1;
			objectID = 0.0;
			return true;
		}
		if (x >= -1.75 && x <= 0.69 && y >= 1.04 && y <= 2.905)
			return false;
		position = vec3(x, y, 3.056);
		normal = vec3(0.0, 0.0, -1.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1006)
	{
		float x = mix(-2.11, 2.11, uv.x);
		float z = mix(-2.074, 3.256, uv.y);
		position = vec3(x, 2.905, z);
		normal = vec3(0.0, -1.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1007)
	{
		if (uv.x >= 0.000 && uv.x <= 0.500 && uv.y >= 0.000 && uv.y <= 0.170)
		{
			float tU = (uv.x - 0.000) / 0.500;
			float tV = (uv.y - 0.000) / 0.170;
			position = vec3(-1.75, mix(2.525, 2.905, tV), mix(-1.874, 2.848, tU));
			normal = vec3(1.0, 0.0, 0.0);
			hitType = 1;
			objectID = 0.0;
			return true;
		}
		if (uv.x >= 0.000 && uv.x <= 0.500 && uv.y >= 0.180 && uv.y <= 0.260)
		{
			float tU = (uv.x - 0.000) / 0.500;
			float tV = (uv.y - 0.180) / 0.080;
			position = vec3(mix(-1.91, -1.75, tV), 2.525, mix(-1.874, 2.846, tU));
			normal = vec3(0.0, -1.0, 0.0);
			hitType = 1;
			objectID = 0.0;
			return true;
		}
		if (uv.x >= 0.000 && uv.x <= 0.500 && uv.y >= 0.270 && uv.y <= 0.440)
		{
			float tU = (uv.x - 0.000) / 0.500;
			float tV = (uv.y - 0.270) / 0.170;
			position = vec3(1.85, mix(2.515, 2.905, tV), mix(-1.874, 2.49, tU));
			normal = vec3(-1.0, 0.0, 0.0);
			hitType = 1;
			objectID = 0.0;
			return true;
		}
		if (uv.x >= 0.000 && uv.x <= 0.500 && uv.y >= 0.450 && uv.y <= 0.530)
		{
			float tU = (uv.x - 0.000) / 0.500;
			float tV = (uv.y - 0.450) / 0.080;
			position = vec3(mix(1.85, 1.91, tV), 2.515, mix(-1.874, 2.49, tU));
			normal = vec3(0.0, -1.0, 0.0);
			hitType = 1;
			objectID = 0.0;
			return true;
		}
		if (uv.x >= 0.520 && uv.x <= 0.740 && uv.y >= 0.000 && uv.y <= 0.360)
		{
			float tU = (uv.x - 0.520) / 0.220;
			float tV = (uv.y - 0.000) / 0.360;
			position = vec3(-1.75, mix(0.0, 2.905, tV), mix(2.846, 3.056, tU));
			normal = vec3(1.0, 0.0, 0.0);
			hitType = 1;
			objectID = 0.0;
			return true;
		}
		if (uv.x >= 0.760 && uv.x <= 0.940 && uv.y >= 0.000 && uv.y <= 0.360)
		{
			float tU = (uv.x - 0.760) / 0.180;
			float tV = (uv.y - 0.000) / 0.360;
			position = vec3(mix(-1.91, -1.75, tU), mix(0.0, 2.525, tV), 2.846);
			normal = vec3(0.0, 0.0, -1.0);
			hitType = 1;
			objectID = 0.0;
			return true;
		}
		if (uv.x >= 0.520 && uv.x <= 0.740 && uv.y >= 0.380 && uv.y <= 0.760)
		{
			float tU = (uv.x - 0.520) / 0.220;
			float tV = (uv.y - 0.380) / 0.380;
			float rawY = mix(0.0, 2.905, tV);
			float rawZ = mix(2.49, 3.056, tU);
			if (r7310C1StructuralSeColumnInnerHiddenByBookshelf(rawZ, rawY))
				return false;
			position = vec3(1.78, rawY, rawZ);
			normal = vec3(-1.0, 0.0, 0.0);
			hitType = 1;
			objectID = 0.0;
			return true;
		}
		if (uv.x >= 0.000 && uv.x <= 1.000 && uv.y >= 0.880 && uv.y <= 1.000)
		{
			float tU = uv.x;
			float tV = (uv.y - 0.880) / 0.120;
			float rawY = mix(0.0, 2.905, tU);
			float rawX = mix(1.78, 1.91, tV);
			if (r7310C1StructuralSeColumnNorthHiddenByEastBeam(rawX, rawY))
				return false;
			position = vec3(rawX, rawY, 2.49);
			normal = vec3(0.0, 0.0, -1.0);
			hitType = 1;
			objectID = 0.0;
			return true;
		}
		return false;
	}
	if (patchId == 1008)
	{
		float x = mix(1.78, 1.91, uv.x);
		float y = mix(0.0, 2.905, uv.y);
		if (r7310C1SeColumnNorthShadowHiddenByEastBeam(x, y))
			return false;
		position = vec3(x, y, 2.49);
		normal = vec3(0.0, 0.0, -1.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1009)
	{
		float z = mix(2.49, 3.056, uv.x);
		float y = mix(0.0, 2.905, uv.y);
		if (r7310C1StructuralSeColumnInnerHiddenByBookshelf(z, y))
			return false;
		position = vec3(1.78, y, z);
		normal = vec3(-1.0, 0.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1010)
	{
		float x = mix(-2.11, 2.11, uv.x);
		float y = mix(0.0, 2.905, uv.y);
		if (x >= -1.75 && x <= 0.69 && y >= 1.04 && y <= 2.905)
			return false;
		if (r7310C1SouthWallAcShadowHiddenBySeColumn(x, y))
			return false;
		if (r7310C1SouthWallHiddenBySideColumn(x, y))
			return false;
		position = vec3(x, y, 3.056);
		normal = vec3(0.0, 0.0, -1.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1011)
	{
		float z = mix(-1.874, 3.056, uv.x);
		float y = mix(0.0, 2.905, uv.y);
		if (r7310C1EastWallHiddenByBeamOrSeColumn(z, y))
			return false;
		position = vec3(1.91, y, z);
		normal = vec3(-1.0, 0.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1012)
	{
		float x = mix(-1.91, -1.75, uv.x);
		float y = mix(0.0, 2.525, uv.y);
		position = vec3(x, y, 2.846);
		normal = vec3(0.0, 0.0, -1.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1013)
	{
		float z = mix(-1.874, 3.056, uv.x);
		float y = mix(0.0, 2.905, uv.y);
		if (z >= -1.874 && z <= -0.984 && y >= 0.09 && y <= 2.04)
			return false;
		if (r7310C1WestWallHiddenByBeamOrSwColumn(z, y))
			return false;
		position = vec3(-1.91, y, z);
		normal = vec3(1.0, 0.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1014)
	{
		float z = mix(2.846, 3.256, uv.x);
		float y = mix(0.0, 2.905, uv.y);
		if (r7310C1SwColumnInnerHiddenBySouthWall(z, y))
			return false;
		position = vec3(-1.75, y, z);
		normal = vec3(1.0, 0.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1015)
	{
		float z = mix(-1.874, 2.848, uv.x);
		float y = mix(2.525, 2.905, uv.y);
		position = vec3(-1.75, y, z);
		normal = vec3(1.0, 0.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1016)
	{
		float z = mix(-1.874, 2.846, uv.x);
		float x = mix(-1.91, -1.75, uv.y);
		position = vec3(x, 2.525, z);
		normal = vec3(0.0, -1.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1017)
	{
		float z = mix(-1.874, 2.49, uv.x);
		float y = mix(2.515, 2.905, uv.y);
		position = vec3(1.85, y, z);
		normal = vec3(-1.0, 0.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1018)
	{
		float z = mix(-1.874, 2.49, uv.x);
		float x = mix(1.85, 1.91, uv.y);
		position = vec3(x, 2.515, z);
		normal = vec3(0.0, -1.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1019)
	{
		float z = mix(3.056, 3.256, uv.x);
		float y = mix(1.04, 2.905, uv.y);
		position = vec3(-1.75, y, z);
		normal = vec3(1.0, 0.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1020)
	{
		float z = mix(3.056, 3.256, uv.x);
		float y = mix(1.04, 2.905, uv.y);
		position = vec3(0.69, y, z);
		normal = vec3(-1.0, 0.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1021)
	{
		float x = mix(-1.75, 0.69, uv.x);
		float z = mix(3.056, 3.256, uv.y);
		position = vec3(x, 1.04, z);
		normal = vec3(0.0, 1.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1022)
	{
		float x = mix(-1.75, 0.69, uv.x);
		float z = mix(3.056, 3.256, uv.y);
		position = vec3(x, 2.905, z);
		normal = vec3(0.0, -1.0, 0.0);
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 1023)
	{
		float band = min(3.0, floor(uv.y / IRON_DOOR_REVEAL_BAND_H));
		float vLocal = uv.y - band * IRON_DOOR_REVEAL_BAND_H;
		if (vLocal < IRON_DOOR_REVEAL_GUARD_V || vLocal > (IRON_DOOR_REVEAL_BAND_H - IRON_DOOR_REVEAL_GUARD_V))
			return false;
		float depth = (vLocal - IRON_DOOR_REVEAL_GUARD_V) / IRON_DOOR_REVEAL_CORE_H;
		float x = -1.96 + depth * 0.05;
		float along = uv.x;
		if (band < 0.5)
		{
			position = vec3(x, 2.04, -1.874 + along * 0.890);
			normal = vec3(0.0, -1.0, 0.0);
		}
		else if (band < 1.5)
		{
			position = vec3(x, 0.09, -1.874 + along * 0.890);
			normal = vec3(0.0, 1.0, 0.0);
		}
		else if (band < 2.5)
		{
			position = vec3(x, 0.09 + along * 1.950, -1.874);
			normal = vec3(0.0, 0.0, 1.0);
		}
		else
		{
			position = vec3(x, 0.09 + along * 1.950, -0.984);
			normal = vec3(0.0, 0.0, -1.0);
		}
		hitType = 1;
		objectID = 0.0;
		return true;
	}
	if (patchId == 230001)
	{
		float z = mix(-0.984, -1.874, uv.x);
		float y = mix(0.09, 2.04, uv.y);
		position = vec3(-1.96, y, z);
		normal = vec3(1.0, 0.0, 0.0);
		hitType = IRON_DOOR;
		objectID = 0.0;
		return true;
	}
	position = vec3(0.0);
	normal = vec3(0.0, 1.0, 0.0);
	hitType = 0;
	objectID = 0.0;
	return false;
}
#endif
bool r738C1BakePastePreviewUv(vec3 visiblePosition, out vec2 atlasUv)
{
	float xMin = uR738C1BakePatchWorldBounds.x;
	float xMax = uR738C1BakePatchWorldBounds.y;
	float zMin = uR738C1BakePatchWorldBounds.z;
	float zMax = uR738C1BakePatchWorldBounds.w;
	if (visiblePosition.x < xMin || visiblePosition.x > xMax || visiblePosition.z < zMin || visiblePosition.z > zMax)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.x - xMin) / max(0.00001, xMax - xMin),
		(visiblePosition.z - zMin) / max(0.00001, zMax - zMin)
	);
	return true;
}
bool r7310C1BakePastePreviewUv(vec3 visiblePosition, out vec2 atlasUv)
{
	float xMin = uR7310C1BakeFloorWorldBounds.x;
	float xMax = uR7310C1BakeFloorWorldBounds.y;
	float zMin = uR7310C1BakeFloorWorldBounds.z;
	float zMax = uR7310C1BakeFloorWorldBounds.w;
	if (visiblePosition.x < xMin || visiblePosition.x > xMax || visiblePosition.z < zMin || visiblePosition.z > zMax)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.x - xMin) / max(0.00001, xMax - xMin),
		(visiblePosition.z - zMin) / max(0.00001, zMax - zMin)
	);
	return true;
}
vec3 r738C1BakePastePreviewSample(vec2 atlasUv)
{
	return max(texture(tR738C1BakeAtlasTexture, clamp(atlasUv, vec2(0.0), vec2(1.0))).rgb, vec3(0.0));
}
vec3 r7310C1FullRoomDiffuseSample(vec2 atlasUv)
{
	return max(texture(tR7310C1FullRoomDiffuseAtlasTexture, clamp(atlasUv, vec2(0.0), vec2(1.0))).rgb, vec3(0.0));
}
vec2 r7310C1CombinedAtlasUv(vec2 localUv, float patchSlot)
{
	float resolution = max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	float patchCount = max(1.0, uR7310C1RuntimeAtlasPatchCount);
	float columns = max(1.0, uR7310C1RuntimeAtlasGridColumns);
	float rows = max(1.0, ceil(patchCount / columns));
	float slot = clamp(patchSlot, 0.0, patchCount - 1.0);
	float column = mod(slot, columns);
	float row = floor(slot / columns);
	vec2 safeUv = (clamp(localUv, vec2(0.0), vec2(1.0)) * (resolution - 1.0) + 0.5) / resolution;
	return vec2((safeUv.x + column) / columns, (safeUv.y + row) / rows);
}
vec4 r7310C1FullRoomDiffuseSamplePatchTexel(vec2 pixelCoord, float patchSlot)
{
	float resolution = max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	float patchCount = max(1.0, uR7310C1RuntimeAtlasPatchCount);
	float columns = max(1.0, uR7310C1RuntimeAtlasGridColumns);
	float rows = max(1.0, ceil(patchCount / columns));
	float slot = clamp(patchSlot, 0.0, patchCount - 1.0);
	float column = mod(slot, columns);
	float row = floor(slot / columns);
	vec2 localUv = (pixelCoord + vec2(0.5)) / resolution;
	return texture(tR7310C1FullRoomDiffuseAtlasTexture, vec2((localUv.x + column) / columns, (localUv.y + row) / rows));
}
vec3 r7310C1FullRoomDiffuseSamplePatchValidLinear(vec2 atlasUv, float patchSlot)
{
	float resolution = max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), vec2(0.0), vec2(resolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(resolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1FullRoomDiffuseSamplePatchTexel(p0, patchSlot);
	vec4 c10 = r7310C1FullRoomDiffuseSamplePatchTexel(vec2(p1.x, p0.y), patchSlot);
	vec4 c01 = r7310C1FullRoomDiffuseSamplePatchTexel(vec2(p0.x, p1.y), patchSlot);
	vec4 c11 = r7310C1FullRoomDiffuseSamplePatchTexel(p1, patchSlot);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1FullRoomDiffuseSamplePatchTexel(floor(pixel + vec2(0.5)), patchSlot);
	return nearest.a > 0.5 ? max(nearest.rgb, vec3(0.0)) : vec3(0.0);
}
vec4 r7310C1XatlasRuntimeSampleTexel(vec2 pixelCoord)
{
	ivec2 atlasSize = ivec2(max(uR7310C1XatlasRuntimeAtlasSize, vec2(1.0)));
	ivec2 pixel = ivec2(clamp(floor(pixelCoord + vec2(0.5)), vec2(0.0), vec2(atlasSize) - vec2(1.0)));
	return texelFetch(tR738C1BakeAtlasTexture, pixel, 0); // R7-3.10 C2C: reuse bake-atlas slot (runtime-xatlas / bake / paste-preview are mutually exclusive)
}
bool r7310C1XatlasRuntimeSampleValidLinear(vec2 atlasUv, out vec3 radiance)
{
	vec2 atlasSize = max(uR7310C1XatlasRuntimeAtlasSize, vec2(1.0));
	vec2 pixel = clamp(atlasUv * atlasSize - vec2(0.5), vec2(0.0), atlasSize - vec2(1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), atlasSize - vec2(1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1XatlasRuntimeSampleTexel(p0);
	vec4 c10 = r7310C1XatlasRuntimeSampleTexel(vec2(p1.x, p0.y));
	vec4 c01 = r7310C1XatlasRuntimeSampleTexel(vec2(p0.x, p1.y));
	vec4 c11 = r7310C1XatlasRuntimeSampleTexel(p1);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
	{
		radiance = max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
		return true;
	}
	vec4 nearest = r7310C1XatlasRuntimeSampleTexel(floor(pixel + vec2(0.5)));
	if (nearest.a > 0.5)
	{
		radiance = max(nearest.rgb, vec3(0.0));
		return true;
	}
	radiance = vec3(0.0);
	return false;
}
vec4 r7310C1XatlasRuntimeSampleFloorPageTexel(vec2 pixelCoord)
{
	ivec2 pageSize = ivec2(max(uR7310C1XatlasRuntimeFloorPageSize, vec2(1.0)));
	ivec2 pixel = ivec2(clamp(floor(pixelCoord + vec2(0.5)), vec2(0.0), vec2(pageSize) - vec2(1.0)));
	return texelFetch(tR7310C1XatlasRuntimeFloorPageTexture, pixel, 0);
}
bool r7310C1XatlasRuntimeSampleValidLinearFloorPage(vec2 pageUv, out vec3 radiance)
{
	vec2 pageSize = max(uR7310C1XatlasRuntimeFloorPageSize, vec2(1.0));
	vec2 pixel = clamp(pageUv * pageSize - vec2(0.5), vec2(0.0), pageSize - vec2(1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), pageSize - vec2(1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1XatlasRuntimeSampleFloorPageTexel(p0);
	vec4 c10 = r7310C1XatlasRuntimeSampleFloorPageTexel(vec2(p1.x, p0.y));
	vec4 c01 = r7310C1XatlasRuntimeSampleFloorPageTexel(vec2(p0.x, p1.y));
	vec4 c11 = r7310C1XatlasRuntimeSampleFloorPageTexel(p1);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
	{
		radiance = max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
		return true;
	}
	vec4 nearest = r7310C1XatlasRuntimeSampleFloorPageTexel(floor(pixel + vec2(0.5)));
	if (nearest.a > 0.5)
	{
		radiance = max(nearest.rgb, vec3(0.0));
		return true;
	}
	radiance = vec3(0.0);
	return false;
}
bool r7310C1RuntimeSurfaceIsNorthWall(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition);
bool r7310C1RuntimeSurfaceIsEastWall(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition);
bool r7310C1RuntimeSurfaceIsWestWall(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition);
bool r7310C1RuntimeSurfaceIsCeiling(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition);
bool r7310C1XatlasA1NorthWallUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (uR7310C1NorthWallDiffuseMode < 0.5 ||
		uR7310C1XatlasRuntimeMode < 0.5 ||
		uR7310C1XatlasRuntimeReady < 0.5)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (!r7310C1RuntimeSurfaceIsNorthWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (visiblePosition.x < -1.912 || visiblePosition.x > -1.518 ||
		visiblePosition.y < -0.002 || visiblePosition.y > 2.907 ||
		abs(visiblePosition.z + 1.874) > 0.006)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (r7310C1NorthWallOwnerExcluded(visiblePosition.x, visiblePosition.y))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	float y01 = clamp(visiblePosition.y / 2.905, 0.0, 1.0);
	float x01 = clamp((visiblePosition.x + 1.91) / 0.39, 0.0, 1.0);
	atlasUv = vec2(
			mix(0.6146934628, 0.0005285412, y01),
			mix(0.3594961166, 0.5106589198, x01)
		);
	return true;
}
float r7310C1XatlasA1NorthWallTriangleId(vec3 visiblePosition)
{
	float y01 = clamp(visiblePosition.y / 2.905, 0.0, 1.0);
	float x01 = clamp((visiblePosition.x + 1.91) / 0.39, 0.0, 1.0);
	return y01 <= x01 ? 10.0 : 11.0;
}
vec3 r7310C1XatlasA1TriangleProbeColor(float triangleId)
{
	if (triangleId < 10.5)
		return vec3(1.0, 0.12, 0.02); // tri10
	if (triangleId < 11.5)
		return vec3(0.05, 0.95, 0.25); // tri11
	if (triangleId < 20.5)
		return vec3(0.15, 0.35, 1.0); // tri20
	if (triangleId < 21.5)
		return vec3(1.0, 0.85, 0.05); // tri21
	return vec3(0.35);
}
bool r7310C1XatlasFullNorthWallUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	// guard 解耦：只依 xatlas 北牆 mode（不再要求 NorthWallDiffuseMode），讓開關獨立於該牆烘焙鈕
	if (uR7310C1XatlasRuntimeMode < 0.5 ||
		uR7310C1XatlasRuntimeReady < 0.5 ||
		uR7310C1XatlasRuntimeFullNorthWallMode < 0.5)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (!r7310C1RuntimeSurfaceIsNorthWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (visiblePosition.x < -2.11 || visiblePosition.x > 2.11 ||
		visiblePosition.y < -0.002 || visiblePosition.y > 2.907 ||
		abs(visiblePosition.z + 1.874) > 0.006)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (r7310C1NorthWallOwnerExcluded(visiblePosition.x, visiblePosition.y))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	float y01 = clamp(visiblePosition.y / 2.905, 0.0, 1.0);
	float x01 = clamp((visiblePosition.x + 2.11) / 4.22, 0.0, 1.0);
	// 單面滿版 local UV（atlasUv.x=滿版直軸→貼圖橫向、atlasUv.y=水平軸→貼圖縱向；stacked/master 之前的純 [0,1] 對應）
	vec2 localUv01 = vec2(
			mix(0.9997849464, 0.0002150538, y01),
			mix(0.0001480604, 0.9998519421, x01)
		);
	if (uR7310C1XatlasRuntimeMasterMode > 0.5)
	{
		// rect-pack：投到北面 sub-rect。gutter(alpha=0) 依賴 SampleValidLinear 的 alpha 加權 bilinear 把跨界 tap 歸零，故不需 per-rect clamp。
		vec2 px = uR7310C1XatlasRectNorth.xy + localUv01 * uR7310C1XatlasRectNorth.zw;
		atlasUv = px / max(uR7310C1XatlasRuntimeAtlasSize, vec2(1.0));
	}
	else if (uR7310C1XatlasRuntimeStackedMode > 0.5)
	{
		// 堆疊模式（保留可回退）：北段佔合成貼圖上段；交界往內縮 ~4px（3377→~3373）避免 bilinear 跨段滲色到東牆
		atlasUv = vec2(localUv01.x, localUv01.y * 0.4608);
	}
	else
	{
		atlasUv = localUv01; // 單面（保留可回退）
	}
	return true;
}
bool r7310C1XatlasFullEastWallUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	// 東牆真非方格 xatlas runtime（與北牆 FullNorthWallUv 對稱；固定 x=1.91、自由軸 z/y、法線 -X）
	// guard 解耦：只依 xatlas 東牆 mode（不再要求 EastWallDiffuseMode）
	if (uR7310C1XatlasRuntimeMode < 0.5 ||
		uR7310C1XatlasRuntimeReady < 0.5 ||
		uR7310C1XatlasRuntimeFullEastWallMode < 0.5)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (!r7310C1RuntimeSurfaceIsEastWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (visiblePosition.y < -0.002 || visiblePosition.y > 2.907 ||
		visiblePosition.z < -1.876 || visiblePosition.z > 3.058 ||
		abs(visiblePosition.x - 1.91) > 0.006)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (r7310C1EastWallHiddenByBeamOrSeColumn(visiblePosition.z, visiblePosition.y))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	// u 軸=worldY（÷2.905）、v 軸=worldZ（(z+1.874)/4.93）；V 用 east prepare rowFlippedRuntime 常數
	float y01 = clamp(visiblePosition.y / 2.905, 0.0, 1.0);
	float z01 = clamp((visiblePosition.z + 1.874) / 4.93, 0.0, 1.0);
	// 單面滿版 local UV（atlasUv.x=worldY 直軸→貼圖橫向、atlasUv.y=worldZ 水平軸→貼圖縱向；stacked/master 之前的純 [0,1] 對應）
	vec2 localUv01 = vec2(
			mix(0.9997849464, 0.0002150538, y01),
			mix(0.0001267195, 0.9998732573, z01)
		);
	if (uR7310C1XatlasRuntimeMasterMode > 0.5)
	{
		// rect-pack：投到東面 sub-rect。gutter 由 alpha 加權 bilinear 自動歸零跨界 tap，不需 per-rect clamp。
		vec2 px = uR7310C1XatlasRectEast.xy + localUv01 * uR7310C1XatlasRectEast.zw;
		atlasUv = px / max(uR7310C1XatlasRuntimeAtlasSize, vec2(1.0));
	}
	else if (uR7310C1XatlasRuntimeStackedMode > 0.5)
	{
		// 堆疊模式（保留可回退）：東段佔合成貼圖下段；起點從交界往內縮 ~4px（3377→~3381）避免 bilinear 取到北段（綠斑根因）
		atlasUv = vec2(localUv01.x, 0.46176 + localUv01.y * 0.53817);
	}
	else
	{
		atlasUv = localUv01; // 單面（保留可回退）
	}
	return true;
}
bool r7310C1XatlasParamSurfaceAllowsObjectHit(vec4 nf, vec4 bmin, vec4 bmax)
{
	bool westThresholdFront =
		nf.x > 0.5 &&
		bmin.x <= -1.90 && bmax.x >= -1.92 &&
		bmin.y >= -0.001 && bmax.y <= 0.105 &&
		bmin.z >= -1.875 && bmax.z <= -0.983;
	bool westThresholdTop =
		nf.y > 0.5 &&
		bmin.x <= -1.90 && bmax.x >= -2.11 &&
		bmin.y >= 0.079 && bmax.y <= 0.105 &&
		bmin.z >= -1.875 && bmax.z <= -0.983;
	bool centralDesk =
		bmin.x >= -0.611 && bmax.x <= 0.611 &&
		bmin.y >= -0.001 && bmax.y <= 0.768 &&
		bmin.z >= 0.394 && bmax.z <= 0.956;
	bool structural =
		((bmin.x >= -1.93 && bmax.x <= -1.73) || (bmin.x >= 1.76 && bmax.x <= 1.93)) &&
		bmin.y >= -0.011 && bmax.y <= 2.916 &&
		bmin.z >= -1.875 && bmax.z <= 3.057;
	bool westWallSwitch =
		bmin.x >= -1.902 && bmax.x <= -1.897 &&
		bmin.y >= 1.147 && bmax.y <= 1.219 &&
		bmin.z >= -0.090 && bmax.z <= 0.032;
	return westThresholdFront || westThresholdTop || centralDesk || structural || westWallSwitch;
}
bool r7310C1XatlasParamSurfaceUv(int sid, float visibleObjectID, vec3 n, vec3 p, out vec2 atlasUv)
{
	int b = sid * 7;
	vec4 nf   = uR7310C1XatlasParamSurfaceTable[b + 0];
	vec4 bmin = uR7310C1XatlasParamSurfaceTable[b + 1];
	vec4 bmax = uR7310C1XatlasParamSurfaceTable[b + 2];
	vec4 umap = uR7310C1XatlasParamSurfaceTable[b + 3];
	vec4 vmap = uR7310C1XatlasParamSurfaceTable[b + 4];
	vec4 mixuv= uR7310C1XatlasParamSurfaceTable[b + 5];
	vec4 rect = uR7310C1XatlasParamSurfaceTable[b + 6];
	if (bmin.w < 0.5) { atlasUv = vec2(0.0); return false; }
	if (visibleObjectID >= 1.5 && !r7310C1XatlasParamSurfaceAllowsObjectHit(nf, bmin, bmax)) { atlasUv = vec2(0.0); return false; }
	if (dot(n, nf.xyz) < vmap.w) { atlasUv = vec2(0.0); return false; }
	if (p.x < bmin.x || p.x > bmax.x || p.y < bmin.y || p.y > bmax.y || p.z < bmin.z || p.z > bmax.z) { atlasUv = vec2(0.0); return false; }
	int ua = int(umap.x); int va = int(vmap.x);
	float tu = clamp((p[ua] - umap.y) * umap.z, 0.0, 1.0);
	float tv = clamp((p[va] - vmap.y) * vmap.z, 0.0, 1.0);
	vec2 localUv01 = vec2(mix(mixuv.x, mixuv.y, tu), mix(mixuv.z, mixuv.w, tv));
	vec2 px = rect.xy + localUv01 * rect.zw;
	atlasUv = px / max(uR7310C1XatlasRuntimeAtlasSize, vec2(1.0));
	return true;
}
bool r7310C1XatlasParamSampleAny(float visibleObjectID, vec3 n, vec3 p, out vec2 atlasUv)
{
	int i = 0;
	while (i < int(uR7310C1XatlasParamSurfaceCount))
	{
		if (r7310C1XatlasParamSurfaceUv(i, visibleObjectID, n, p, atlasUv)) return true;
		i++;
	}
	return false;
}
bool r7310C1XatlasParamWestSurfaceActive()
{
	if (uR7310C1XatlasParamWestSurfaceIndex < 0.0) return false;
	int b = int(uR7310C1XatlasParamWestSurfaceIndex) * 7;
	return uR7310C1XatlasParamSurfaceTable[b + 1].w > 0.5;
}
// === GENERATED: surface-owner BEGIN  (registry bfebcab598756c9b) ===
// Source of truth: docs/data/r7-3-10-surface-owner-registry.json
// Generator     : docs/tools/r7-3-10-surface-owner-codegen.mjs  (DO NOT hand-edit this block)
const int R7310_OWNER_NONE = 0;
const int R7310_OWNER_CEILING_OPEN = 1;
const int R7310_OWNER_SOUTH_WALL = 2;
const int R7310_OWNER_SOUTH_WALL_DEPTH_TOP = 3;
const int R7310_OWNER_SOUTH_WINDOW_TOP_REVEAL_DEPTH = 4;
const int R7310_OWNER_SOUTH_WINDOW_TOP_REVEAL_FRONT = 5;
const int R7310_OWNER_SOUTH_WINDOW_LEFT_REVEAL = 6;
const int R7310_OWNER_SOUTH_WINDOW_RIGHT_REVEAL = 7;
const int R7310_OWNER_SOUTH_WINDOW_BOTTOM_REVEAL = 8;
const int R7310_OWNER_FLOOR_OPEN = 9;
const int R7310_OWNER_CENTRAL_DESK_TOP = 10;
const int R7310_OWNER_CENTRAL_DESK_FRONT = 11;
const int R7310_OWNER_CENTRAL_DESK_BACK = 12;
const int R7310_OWNER_CENTRAL_DESK_LEFT = 13;
const int R7310_OWNER_CENTRAL_DESK_RIGHT = 14;
const int R7310_OWNER_WEST_WALL_SWITCH_PLATE = 15;
const int R7310_OWNER_WEST_WALL_SWITCH_BUTTON = 16;
const int R7310_OWNER_WEST_WALL_OPEN = 17;
const int R7310_OWNER_WEST_THRESHOLD_FRONT = 18;
const int R7310_OWNER_WEST_THRESHOLD_TOP = 19;
bool r7310SurfaceOwnerIsPending(int ownerId) {
	return false;
}
// highest-precedence matching owner; 0 if none. Mirrors registry ownerOfSurface().
int r7310SurfaceOwnerId(vec3 p, vec3 n, float objId) {
	int best = R7310_OWNER_NONE;
	int bestPrec = -2147483647;
	// ceiling_open (precedence 10)
	if (n.y * -1.0 > 0.5 && objId < 1.5 && p.y >= 2.895 && p.y <= 2.915 && p.z >= -2.074 && p.z <= 3.256 && p.x >= -2.11 && p.x <= 2.11) { if (10 > bestPrec) { bestPrec = 10; best = R7310_OWNER_CEILING_OPEN; } }
	// south_wall (precedence 10)
	if (n.z * -1.0 > 0.5 && objId < 1.5 && p.y >= 0.0 && p.y <= 2.905 && p.z >= 3.05 && p.z <= 3.07 && p.x >= -2.11 && p.x <= 2.11) { if (10 > bestPrec) { bestPrec = 10; best = R7310_OWNER_SOUTH_WALL; } }
	// south_wall_depth_top (precedence 20)
	if (n.y * -1.0 > 0.5 && objId < 1.5 && p.y >= 2.895 && p.y <= 2.915 && p.z >= 3.056 && p.z <= 3.256 && ((p.x >= -2.11 && p.x <= -1.75) || (p.x >= 0.69 && p.x <= 2.11))) { if (20 > bestPrec) { bestPrec = 20; best = R7310_OWNER_SOUTH_WALL_DEPTH_TOP; } }
	// south_window_top_reveal_depth (precedence 21)
	if (n.y * -1.0 > 0.5 && objId < 1.5 && p.y >= 2.895 && p.y <= 2.915 && p.z >= 3.056 && p.z <= 3.256 && p.x >= -1.75 && p.x <= 0.69) { if (21 > bestPrec) { bestPrec = 21; best = R7310_OWNER_SOUTH_WINDOW_TOP_REVEAL_DEPTH; } }
	// south_window_top_reveal_front (precedence 15)
	if (n.z * -1.0 > 0.5 && objId < 1.5 && p.y >= 1.04 && p.y <= 2.905 && p.z >= 3.05 && p.z <= 3.07 && p.x >= -1.75 && p.x <= 0.69) { if (15 > bestPrec) { bestPrec = 15; best = R7310_OWNER_SOUTH_WINDOW_TOP_REVEAL_FRONT; } }
	// south_window_left_reveal (precedence 22)
	if (n.x * 1.0 > 0.5 && objId < 1.5 && p.y >= 1.04 && p.y <= 2.905 && p.z >= 3.056 && p.z <= 3.256 && p.x >= -1.76 && p.x <= -1.74) { if (22 > bestPrec) { bestPrec = 22; best = R7310_OWNER_SOUTH_WINDOW_LEFT_REVEAL; } }
	// south_window_right_reveal (precedence 22)
	if (n.x * -1.0 > 0.5 && objId < 1.5 && p.y >= 1.04 && p.y <= 2.905 && p.z >= 3.056 && p.z <= 3.256 && p.x >= 0.68 && p.x <= 0.7) { if (22 > bestPrec) { bestPrec = 22; best = R7310_OWNER_SOUTH_WINDOW_RIGHT_REVEAL; } }
	// south_window_bottom_reveal (precedence 22)
	if (n.y * 1.0 > 0.5 && objId < 1.5 && p.y >= 1.03 && p.y <= 1.05 && p.z >= 3.056 && p.z <= 3.256 && p.x >= -1.75 && p.x <= 0.69) { if (22 > bestPrec) { bestPrec = 22; best = R7310_OWNER_SOUTH_WINDOW_BOTTOM_REVEAL; } }
	// floor_open (precedence 10)
	if (n.y * 1.0 > 0.5 && objId < 1.5 && p.y >= -0.0005 && p.y <= 0.025 && p.z >= -2.074 && p.z <= 3.256 && p.x >= -2.11 && p.x <= 2.11) { if (10 > bestPrec) { bestPrec = 10; best = R7310_OWNER_FLOOR_OPEN; } }
	// central_desk_top (precedence 40)
	if (n.y * 1.0 > 0.5 && p.y >= 0.747 && p.y <= 0.767 && p.z >= 0.405 && p.z <= 0.945 && p.x >= -0.6 && p.x <= 0.6) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_CENTRAL_DESK_TOP; } }
	// central_desk_front (precedence 40)
	if (n.z * -1.0 > 0.5 && p.y >= 0.0 && p.y <= 0.757 && p.z >= 0.395 && p.z <= 0.415 && p.x >= -0.6 && p.x <= 0.6) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_CENTRAL_DESK_FRONT; } }
	// central_desk_back (precedence 40)
	if (n.z * 1.0 > 0.5 && p.y >= 0.0 && p.y <= 0.757 && p.z >= 0.935 && p.z <= 0.955 && p.x >= -0.6 && p.x <= 0.6) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_CENTRAL_DESK_BACK; } }
	// central_desk_left (precedence 40)
	if (n.x * -1.0 > 0.5 && p.y >= 0.0 && p.y <= 0.757 && p.z >= 0.405 && p.z <= 0.945 && p.x >= -0.61 && p.x <= -0.59) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_CENTRAL_DESK_LEFT; } }
	// central_desk_right (precedence 40)
	if (n.x * 1.0 > 0.5 && p.y >= 0.0 && p.y <= 0.757 && p.z >= 0.405 && p.z <= 0.945 && p.x >= 0.59 && p.x <= 0.61) { if (40 > bestPrec) { bestPrec = 40; best = R7310_OWNER_CENTRAL_DESK_RIGHT; } }
	// west_wall_switch_plate (precedence 50)
	if (n.x * 1.0 > 0.5 && p.y >= 1.148 && p.y <= 1.218 && p.z >= -0.089 && p.z <= 0.031 && p.x >= -1.901 && p.x <= -1.899) { if (50 > bestPrec) { bestPrec = 50; best = R7310_OWNER_WEST_WALL_SWITCH_PLATE; } }
	// west_wall_switch_button (precedence 51)
	if (n.x * 1.0 > 0.5 && p.y >= 1.161 && p.y <= 1.205 && p.z >= -0.076 && p.z <= 0.018 && p.x >= -1.899 && p.x <= -1.897) { if (51 > bestPrec) { bestPrec = 51; best = R7310_OWNER_WEST_WALL_SWITCH_BUTTON; } }
	// west_wall_open (precedence 10)
	if (n.x * 1.0 > 0.5 && objId < 1.5 && p.y >= 0.0 && p.y <= 2.905 && p.z >= -1.874 && p.z <= 3.056 && p.x >= -1.92 && p.x <= -1.9) { if (10 > bestPrec) { bestPrec = 10; best = R7310_OWNER_WEST_WALL_OPEN; } }
	// west_threshold_front (precedence 31)
	if (n.x * 1.0 > 0.5 && p.y >= 0.0 && p.y <= 0.095 && p.z >= -1.874 && p.z <= -0.984 && p.x >= -1.92 && p.x <= -1.9) { if (31 > bestPrec) { bestPrec = 31; best = R7310_OWNER_WEST_THRESHOLD_FRONT; } }
	// west_threshold_top (precedence 30)
	if (n.y * 1.0 > 0.5 && p.y >= 0.085 && p.y <= 0.095 && p.z >= -1.874 && p.z <= -0.984 && p.x >= -2.11 && p.x <= -1.91) { if (30 > bestPrec) { bestPrec = 30; best = R7310_OWNER_WEST_THRESHOLD_TOP; } }
	return best;
}
// Convenience owner gate: true only where the open ceiling is the rightful owner.
bool r7310SurfaceOwnerIsCeilingOpen(vec3 p, vec3 n, float objId) {
	return r7310SurfaceOwnerId(p, n, objId) == R7310_OWNER_CEILING_OPEN;
}
// === GENERATED: surface-owner END ===
bool r7310C1XatlasFullCeilingUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	// 天花板真非方格 xatlas runtime（固定 y=2.905、自由軸 x/z、法線 -Y；單獨用貼圖槽、非堆疊）
	// u 軸=worldZ、v 軸=worldX（xatlas 將 chart 轉向、與牆相反）；V 用 prepare rowFlippedRuntime 常數。
	if (uR7310C1XatlasRuntimeMode < 0.5 ||
		uR7310C1XatlasRuntimeReady < 0.5 ||
		uR7310C1XatlasRuntimeFullCeilingMode < 0.5)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (!r7310C1RuntimeSurfaceIsCeiling(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) ||
		!r7310SurfaceOwnerIsCeilingOpen(visiblePosition, visibleNormal, visibleObjectID))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (visiblePosition.x < -2.111 || visiblePosition.x > 2.111 ||
		visiblePosition.z < -2.075 || visiblePosition.z > 3.257 ||
		abs(visiblePosition.y - 2.905) > 0.006)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	float z01 = clamp((visiblePosition.z + 2.074) / 5.33, 0.0, 1.0);
	float x01 = clamp((visiblePosition.x + 2.11) / 4.22, 0.0, 1.0);
	// 天花板已是純 [0,1] 滿版 local UV（atlasUv.x=worldZ 直軸→貼圖橫向、atlasUv.y=worldX 水平軸→貼圖縱向）
	vec2 localUv01 = vec2(
			mix(0.9998827576637268, 0.00011723329225787893, z01),
			mix(0.0001480579376220703, 0.9998519395885523, x01)
		);
	if (uR7310C1XatlasRuntimeMasterMode > 0.5)
	{
		// master shelf-pack：投到天花板 sub-rect（上排）。gutter 由 alpha 加權 bilinear 自動歸零跨界 tap，不需 per-rect clamp。
		vec2 px = uR7310C1XatlasRectCeiling.xy + localUv01 * uR7310C1XatlasRectCeiling.zw;
		atlasUv = px / max(uR7310C1XatlasRuntimeAtlasSize, vec2(1.0));
	}
	else
	{
		atlasUv = localUv01; // 單張天花板（保留可回退）
	}
	return true;
}
bool r7310C1XatlasFullDepthH2Uv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	// R7-3.10 第6步：H2＝south_window_top_reveal_depth（窗楣 -Y 水平深度面，x[-1.75,0.69] z[3.056,3.256] y=2.905）。
	// 自烤 1024² runner 原生方形圖（未走天花板/北/東那套 prepare 重排）：texelFetch + flipY=false + 逐列 blit 全直通，
	// 故 localUv 與烤點 patchId 1022 的 uv 同向、無翻轉、無 half-texel inset（SampleValidLinear 的 -0.5 自然對中）。
	// 只在 master 模式供應 depth_h2 sub-rect；非 master 無此面、回 false（不退 LIVE，由上層 owner 機制處理）。
	if (uR7310C1XatlasRuntimeMode < 0.5 ||
		uR7310C1XatlasRuntimeReady < 0.5 ||
		uR7310C1XatlasRuntimeFullCeilingMode < 0.5 ||
		uR7310C1XatlasRuntimeMasterMode < 0.5)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	// owner 必須是 H2（precedence 21；法線 -Y、objId<1.5、x/y/z 在窗楣範圍）才取樣，避免吃到鄰接天花板/牆頂 blocker。
	if (r7310SurfaceOwnerId(visiblePosition, visibleNormal, visibleObjectID) != R7310_OWNER_SOUTH_WINDOW_TOP_REVEAL_DEPTH)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	float u01 = clamp((visiblePosition.x + 1.75) / 2.44, 0.0, 1.0); // 貼圖橫軸＝worldX（烤點 mix(-1.75,0.69,uv.x)）
	float v01 = clamp((visiblePosition.z - 3.056) / 0.2, 0.0, 1.0);  // 貼圖縱軸＝worldZ（烤點 mix(3.056,3.256,uv.y)）
	vec2 localUv01 = vec2(u01, v01);
	vec2 px = uR7310C1XatlasRectDepthH2.xy + localUv01 * uR7310C1XatlasRectDepthH2.zw;
	atlasUv = px / max(uR7310C1XatlasRuntimeAtlasSize, vec2(1.0));
	return true;
}
float r7310C1XatlasFullNorthWallTriangleId(vec3 visiblePosition)
{
	float y01 = clamp(visiblePosition.y / 2.905, 0.0, 1.0);
	float x01 = clamp((visiblePosition.x + 2.11) / 4.22, 0.0, 1.0);
	return y01 <= x01 ? 0.0 : 1.0;
}
vec3 r7310C1XatlasFullNorthWallTriangleProbeColor(float triangleId)
{
	if (triangleId < 0.5)
		return vec3(1.0, 0.12, 0.02);
	if (triangleId < 1.5)
		return vec3(0.05, 0.95, 0.25);
	return vec3(0.35);
}
bool r7310C1XatlasFullFloorLocalUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 localUv01)
{
	// R7-3.10 §13 地板 C1A shell：floor_open 非方格 3376×4264（800 texel/m）、planar XZ on +Y face；u=worldX、v=worldZ。
	if (uR7310C1XatlasRuntimeMode < 0.5 ||
		uR7310C1XatlasRuntimeReady < 0.5 ||
		uR7310C1XatlasRuntimeFullFloorMode < 0.5)
	{
		localUv01 = vec2(0.0);
		return false;
	}
	// owner 必須是 floor_open（generated 述詞已含 法線+Y、objId<1.5、x[-2.11,2.11] y[-0.0005,0.025] z[-2.074,3.256] 完整地板判定）。
	if (r7310SurfaceOwnerId(visiblePosition, visibleNormal, visibleObjectID) != R7310_OWNER_FLOOR_OPEN)
	{
		localUv01 = vec2(0.0);
		return false;
	}
	float u01 = clamp((visiblePosition.x + 2.11) / 4.22, 0.0, 1.0); // 貼圖橫軸＝worldX
	float v01 = clamp((visiblePosition.z + 2.074) / 5.33, 0.0, 1.0); // 貼圖縱軸＝worldZ
	localUv01 = vec2(u01, v01);
	return true;
}
bool r7310C1XatlasFullFloorUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	// Legacy/master shelf path：floor still maps into the master sub-rect when a true page is not active.
	if (uR7310C1XatlasRuntimeMasterMode < 0.5)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	vec2 localUv01 = vec2(0.0);
	if (!r7310C1XatlasFullFloorLocalUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, localUv01))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	vec2 px = uR7310C1XatlasRectFloor.xy + localUv01 * uR7310C1XatlasRectFloor.zw;
	atlasUv = px / max(uR7310C1XatlasRuntimeAtlasSize, vec2(1.0));
	return true;
}
bool r7310C1XatlasFullFloorPageUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 pageUv)
{
	if (uR7310C1XatlasRuntimeLightmapPagesMode < 0.5)
	{
		pageUv = vec2(0.0);
		return false;
	}
	return r7310C1XatlasFullFloorLocalUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, pageUv);
}
bool r7310C1XatlasNorthWallUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	// 非互斥：北東可同時開（堆疊貼圖）；依命中面回各自 UV（兩面法線幾何互斥，順序試即天然並存）
	if (uR7310C1XatlasRuntimeFullEastWallMode > 0.5 &&
		r7310C1XatlasFullEastWallUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return true;
	int r7310XatlasOwnerId = r7310SurfaceOwnerId(visiblePosition, visibleNormal, visibleObjectID);
	if (r7310XatlasOwnerId == R7310_OWNER_WEST_WALL_SWITCH_PLATE &&
		uR7310C1XatlasParamWestWallSwitchPlateIndex >= 0.0 &&
		r7310C1XatlasParamSurfaceUv(int(uR7310C1XatlasParamWestWallSwitchPlateIndex), visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return true;
	if (r7310XatlasOwnerId == R7310_OWNER_WEST_WALL_SWITCH_BUTTON &&
		uR7310C1XatlasParamWestWallSwitchButtonIndex >= 0.0 &&
		r7310C1XatlasParamSurfaceUv(int(uR7310C1XatlasParamWestWallSwitchButtonIndex), visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return true;
	{ vec2 r7310C1XatlasParamUv; if (r7310C1XatlasParamSampleAny(visibleObjectID, visibleNormal, visiblePosition, r7310C1XatlasParamUv)) { atlasUv = r7310C1XatlasParamUv; return true; } }
	if (uR7310C1XatlasRuntimeFullNorthWallMode > 0.5 &&
		r7310C1XatlasFullNorthWallUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return true;
	if (uR7310C1XatlasRuntimeFullCeilingMode > 0.5 &&
		r7310C1XatlasFullCeilingUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return true;
	// H2 窗楣深度面（master sub-rect depth_h2）：與天花板同屬「全室真非方格」開關群，故沿用 FullCeilingMode gate。
	// 天花板函式以 owner gate 已排除 H2，兩者互斥，順序不衝突。
	if (uR7310C1XatlasRuntimeFullCeilingMode > 0.5 &&
		r7310C1XatlasFullDepthH2Uv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return true;
	return r7310C1XatlasA1NorthWallUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
float r7310C1XatlasNorthWallTriangleId(vec3 visiblePosition)
{
	if (uR7310C1XatlasRuntimeFullNorthWallMode > 0.5)
		return r7310C1XatlasFullNorthWallTriangleId(visiblePosition);
	return r7310C1XatlasA1NorthWallTriangleId(visiblePosition);
}
vec3 r7310C1XatlasNorthWallTriangleProbeColor(float triangleId)
{
	if (uR7310C1XatlasRuntimeFullNorthWallMode > 0.5)
		return r7310C1XatlasFullNorthWallTriangleProbeColor(triangleId);
	return r7310C1XatlasA1TriangleProbeColor(triangleId);
}
vec3 r7310C1FullRoomDiffuseSamplePatchPixel(vec2 pixelCoord, float patchSlot)
{
	return max(r7310C1FullRoomDiffuseSamplePatchTexel(pixelCoord, patchSlot).rgb, vec3(0.0));
}
vec3 r7310C1PatchCoverageProbe(vec2 atlasUv, float resolution, float patchSlot, float routeId)
{
	float safeResolution = max(1.0, resolution);
	vec2 pixel = clamp(atlasUv * safeResolution - vec2(0.5), vec2(0.0), vec2(safeResolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(safeResolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1FullRoomDiffuseSamplePatchTexel(p0, patchSlot);
	vec4 c10 = r7310C1FullRoomDiffuseSamplePatchTexel(vec2(p1.x, p0.y), patchSlot);
	vec4 c01 = r7310C1FullRoomDiffuseSamplePatchTexel(vec2(p0.x, p1.y), patchSlot);
	vec4 c11 = r7310C1FullRoomDiffuseSamplePatchTexel(p1, patchSlot);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	vec4 nearest = r7310C1FullRoomDiffuseSamplePatchTexel(floor(pixel + vec2(0.5)), patchSlot);
	return vec3(clamp(weightSum, 0.0, 1.0), clamp(nearest.a, 0.0, 1.0), clamp(routeId / 255.0, 0.0, 1.0));
}
vec3 r7310C1FullAtlasCoverageProbe(float routeId)
{
	return vec3(1.0, 1.0, clamp(routeId / 255.0, 0.0, 1.0));
}
void r7310HybridOwnerAdd(bool isActive, float targetOffset, float maskLowBit, float maskHighBit, inout float ownerCount, inout float maskLow, inout float maskHigh, inout float firstTargetOffset, inout float secondTargetOffset)
{
	if (!isActive)
		return;
	if (firstTargetOffset < 0.5)
		firstTargetOffset = targetOffset;
	else if (secondTargetOffset < 0.5)
		secondTargetOffset = targetOffset;
	ownerCount += 1.0;
	maskLow += maskLowBit;
	maskHigh += maskHighBit;
}
vec3 r7310C1FullRoomDiffuseSampleRectLinear(vec2 atlasUv, float patchSlot, vec4 rect)
{
	float resolution = max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	vec2 minPixel = ceil(rect.xy * resolution - vec2(0.5));
	vec2 maxPixel = floor(rect.zw * resolution - vec2(0.5));
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), minPixel, maxPixel);
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), maxPixel);
	vec2 t = pixel - p0;
	vec3 c00 = r7310C1FullRoomDiffuseSamplePatchPixel(p0, patchSlot);
	vec3 c10 = r7310C1FullRoomDiffuseSamplePatchPixel(vec2(p1.x, p0.y), patchSlot);
	vec3 c01 = r7310C1FullRoomDiffuseSamplePatchPixel(vec2(p0.x, p1.y), patchSlot);
	vec3 c11 = r7310C1FullRoomDiffuseSamplePatchPixel(p1, patchSlot);
	return mix(mix(c00, c10, t.x), mix(c01, c11, t.x), t.y);
}
vec3 r7310C1FullRoomDiffuseSampleRectTent3(vec2 atlasUv, float patchSlot, vec4 rect)
{
	float resolution = max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	vec2 pixelStep = vec2(1.0 / resolution);
	vec3 sum = vec3(0.0);
	float weightSum = 0.0;
	for (int y = -1; y <= 1; y++)
	{
		for (int x = -1; x <= 1; x++)
		{
			float wx = x == 0 ? 2.0 : 1.0;
			float wy = y == 0 ? 2.0 : 1.0;
			float w = wx * wy;
			sum += w * r7310C1FullRoomDiffuseSampleRectLinear(
				atlasUv + vec2(float(x), float(y)) * pixelStep,
				patchSlot,
				rect
			);
			weightSum += w;
		}
	}
	return sum / max(1.0, weightSum);
}
vec3 r7310C1FullRoomDiffuseSampleRectTent5(vec2 atlasUv, float patchSlot, vec4 rect)
{
	float resolution = max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	vec2 pixelStep = vec2(1.0 / resolution);
	vec3 sum = vec3(0.0);
	float weightSum = 0.0;
	for (int y = -2; y <= 2; y++)
	{
		for (int x = -2; x <= 2; x++)
		{
			float wx = 3.0 - abs(float(x));
			float wy = 3.0 - abs(float(y));
			float w = wx * wy;
			sum += w * r7310C1FullRoomDiffuseSampleRectLinear(
				atlasUv + vec2(float(x), float(y)) * pixelStep,
				patchSlot,
				rect
			);
			weightSum += w;
		}
	}
	return sum / max(1.0, weightSum);
}
bool r7310C1NonSquareAtlasSlotSupported(float patchSlot)
{
	float slot = floor(patchSlot + 0.5);
	return slot == 1.0 || slot == 2.0;
}
bool r7310C1ShouldUseNonSquareAtlas(float patchSlot)
{
#if defined(R7310_FORMAL_XATLAS_RAW)
	return false;
#else
	return uR7310C1UseNonSquareAtlas > 0.5 &&
		uR7310C1NonSquareAtlasReady > 0.5 &&
		r7310C1NonSquareAtlasSlotSupported(patchSlot);
#endif
}
vec4 r7310C1NonSquareAtlasUvRect(float patchSlot)
{
	float slot = floor(patchSlot + 0.5);
	if (slot == 1.0)
		return uR7310C1NonSquareNorthWallUvRect;
	if (slot == 2.0)
		return uR7310C1NonSquareEastWallUvRect;
	return vec4(0.0, 0.0, 1.0, 1.0);
}
vec2 r7310C1NonSquareAtlasFaceSizePx(float patchSlot)
{
	float slot = floor(patchSlot + 0.5);
	if (slot == 1.0)
		return max(vec2(1.0), uR7310C1NonSquareNorthWallFaceSizePx);
	if (slot == 2.0)
		return max(vec2(1.0), uR7310C1NonSquareEastWallFaceSizePx);
	return vec2(max(1.0, uR7310C1RuntimeAtlasPatchResolution));
}
vec4 r7310C1FullRoomDiffuseSamplePatchTexelNonSquare(vec2 pixelCoord, float patchSlot)
{
#if defined(R7310_FORMAL_XATLAS_RAW)
	return r7310C1FullRoomDiffuseSamplePatchTexel(pixelCoord, patchSlot);
#else
	if (!r7310C1NonSquareAtlasSlotSupported(patchSlot))
		return r7310C1FullRoomDiffuseSamplePatchTexel(pixelCoord, patchSlot);
	vec2 atlasSize = max(vec2(1.0), uR7310C1NonSquareAtlasSizePx);
	vec4 uvRect = r7310C1NonSquareAtlasUvRect(patchSlot);
	vec2 faceSize = r7310C1NonSquareAtlasFaceSizePx(patchSlot);
	vec2 pixel = clamp(pixelCoord, vec2(0.0), faceSize - vec2(1.0));
	vec2 uv = uvRect.xy + (pixel + vec2(0.5)) / atlasSize;
	return texture(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, uv);
#endif
}
vec3 r7310C1FullRoomDiffuseSamplePatchValidLinearNonSquare(vec2 atlasUv, float patchSlot)
{
	if (!r7310C1NonSquareAtlasSlotSupported(patchSlot))
		return r7310C1FullRoomDiffuseSamplePatchValidLinear(atlasUv, patchSlot);
	vec2 faceSize = r7310C1NonSquareAtlasFaceSizePx(patchSlot);
	vec2 pixel = clamp(atlasUv * faceSize - vec2(0.5), vec2(0.0), faceSize - vec2(1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), faceSize - vec2(1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1FullRoomDiffuseSamplePatchTexelNonSquare(p0, patchSlot);
	vec4 c10 = r7310C1FullRoomDiffuseSamplePatchTexelNonSquare(vec2(p1.x, p0.y), patchSlot);
	vec4 c01 = r7310C1FullRoomDiffuseSamplePatchTexelNonSquare(vec2(p0.x, p1.y), patchSlot);
	vec4 c11 = r7310C1FullRoomDiffuseSamplePatchTexelNonSquare(p1, patchSlot);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1FullRoomDiffuseSamplePatchTexelNonSquare(floor(pixel + vec2(0.5)), patchSlot);
	return nearest.a > 0.5 ? max(nearest.rgb, vec3(0.0)) : vec3(0.0);
}
vec4 r7310C1FullRoomDiffuseSamplePatchTexelRect(vec2 pixelCoord, float patchSlot, vec2 patchSize)
{
	float resolution = max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	vec2 safeSize = clamp(floor(patchSize + vec2(0.5)), vec2(1.0), vec2(resolution));
	vec2 pixel = clamp(pixelCoord, vec2(0.0), safeSize - vec2(1.0));
	return r7310C1FullRoomDiffuseSamplePatchTexel(pixel, patchSlot);
}
vec3 r7310C1FullRoomDiffuseSamplePatchValidLinearRect(vec2 atlasUv, float patchSlot, vec2 patchSize)
{
	float resolution = max(1.0, uR7310C1RuntimeAtlasPatchResolution);
	vec2 safeSize = clamp(floor(patchSize + vec2(0.5)), vec2(1.0), vec2(resolution));
	vec2 pixel = clamp(atlasUv * safeSize - vec2(0.5), vec2(0.0), safeSize - vec2(1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), safeSize - vec2(1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1FullRoomDiffuseSamplePatchTexelRect(p0, patchSlot, safeSize);
	vec4 c10 = r7310C1FullRoomDiffuseSamplePatchTexelRect(vec2(p1.x, p0.y), patchSlot, safeSize);
	vec4 c01 = r7310C1FullRoomDiffuseSamplePatchTexelRect(vec2(p0.x, p1.y), patchSlot, safeSize);
	vec4 c11 = r7310C1FullRoomDiffuseSamplePatchTexelRect(p1, patchSlot, safeSize);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1FullRoomDiffuseSamplePatchTexelRect(floor(pixel + vec2(0.5)), patchSlot, safeSize);
	return nearest.a > 0.5 ? max(nearest.rgb, vec3(0.0)) : vec3(0.0);
}
vec3 r7310C1FullRoomDiffuseSamplePatchPixelNonSquare(vec2 pixelCoord, float patchSlot)
{
	return max(r7310C1FullRoomDiffuseSamplePatchTexelNonSquare(pixelCoord, patchSlot).rgb, vec3(0.0));
}
vec3 r7310C1PatchCoverageProbeNonSquare(vec2 atlasUv, float patchSlot, float routeId)
{
	if (!r7310C1NonSquareAtlasSlotSupported(patchSlot))
		return r7310C1PatchCoverageProbe(atlasUv, uR7310C1RuntimeAtlasPatchResolution, patchSlot, routeId);
	vec2 faceSize = r7310C1NonSquareAtlasFaceSizePx(patchSlot);
	vec2 pixel = clamp(atlasUv * faceSize - vec2(0.5), vec2(0.0), faceSize - vec2(1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), faceSize - vec2(1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1FullRoomDiffuseSamplePatchTexelNonSquare(p0, patchSlot);
	vec4 c10 = r7310C1FullRoomDiffuseSamplePatchTexelNonSquare(vec2(p1.x, p0.y), patchSlot);
	vec4 c01 = r7310C1FullRoomDiffuseSamplePatchTexelNonSquare(vec2(p0.x, p1.y), patchSlot);
	vec4 c11 = r7310C1FullRoomDiffuseSamplePatchTexelNonSquare(p1, patchSlot);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	vec4 nearest = r7310C1FullRoomDiffuseSamplePatchTexelNonSquare(floor(pixel + vec2(0.5)), patchSlot);
	return vec3(clamp(weightSum, 0.0, 1.0), clamp(nearest.a, 0.0, 1.0), clamp(routeId / 255.0, 0.0, 1.0));
}
vec3 r7310C1FullRoomDiffuseSampleRectLinearNonSquare(vec2 atlasUv, float patchSlot, vec4 rect)
{
	if (!r7310C1NonSquareAtlasSlotSupported(patchSlot))
		return r7310C1FullRoomDiffuseSampleRectLinear(atlasUv, patchSlot, rect);
	vec2 faceSize = r7310C1NonSquareAtlasFaceSizePx(patchSlot);
	vec2 minPixel = ceil(rect.xy * faceSize - vec2(0.5));
	vec2 maxPixel = floor(rect.zw * faceSize - vec2(0.5));
	vec2 pixel = clamp(atlasUv * faceSize - vec2(0.5), minPixel, maxPixel);
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), maxPixel);
	vec2 t = pixel - p0;
	vec3 c00 = r7310C1FullRoomDiffuseSamplePatchPixelNonSquare(p0, patchSlot);
	vec3 c10 = r7310C1FullRoomDiffuseSamplePatchPixelNonSquare(vec2(p1.x, p0.y), patchSlot);
	vec3 c01 = r7310C1FullRoomDiffuseSamplePatchPixelNonSquare(vec2(p0.x, p1.y), patchSlot);
	vec3 c11 = r7310C1FullRoomDiffuseSamplePatchPixelNonSquare(p1, patchSlot);
	return mix(mix(c00, c10, t.x), mix(c01, c11, t.x), t.y);
}
vec3 r7310C1FullRoomDiffuseSampleRectTent3NonSquare(vec2 atlasUv, float patchSlot, vec4 rect)
{
	if (!r7310C1NonSquareAtlasSlotSupported(patchSlot))
		return r7310C1FullRoomDiffuseSampleRectTent3(atlasUv, patchSlot, rect);
	vec2 faceSize = r7310C1NonSquareAtlasFaceSizePx(patchSlot);
	vec2 pixelStep = vec2(1.0) / faceSize;
	vec3 sum = vec3(0.0);
	float weightSum = 0.0;
	for (int y = -1; y <= 1; y++)
	{
		for (int x = -1; x <= 1; x++)
		{
			float wx = x == 0 ? 2.0 : 1.0;
			float wy = y == 0 ? 2.0 : 1.0;
			float w = wx * wy;
			sum += w * r7310C1FullRoomDiffuseSampleRectLinearNonSquare(
				atlasUv + vec2(float(x), float(y)) * pixelStep,
				patchSlot,
				rect
			);
			weightSum += w;
		}
	}
	return sum / max(1.0, weightSum);
}
vec3 r7310C1FullRoomDiffuseSampleRectTent5NonSquare(vec2 atlasUv, float patchSlot, vec4 rect)
{
	if (!r7310C1NonSquareAtlasSlotSupported(patchSlot))
		return r7310C1FullRoomDiffuseSampleRectTent5(atlasUv, patchSlot, rect);
	vec2 faceSize = r7310C1NonSquareAtlasFaceSizePx(patchSlot);
	vec2 pixelStep = vec2(1.0) / faceSize;
	vec3 sum = vec3(0.0);
	float weightSum = 0.0;
	for (int y = -2; y <= 2; y++)
	{
		for (int x = -2; x <= 2; x++)
		{
			float wx = 3.0 - abs(float(x));
			float wy = 3.0 - abs(float(y));
			float w = wx * wy;
			sum += w * r7310C1FullRoomDiffuseSampleRectLinearNonSquare(
				atlasUv + vec2(float(x), float(y)) * pixelStep,
				patchSlot,
				rect
			);
			weightSum += w;
		}
	}
	return sum / max(1.0, weightSum);
}
vec4 r7310C1EastWallAtlasRect()
{
	return vec4(0.0, 0.0, 1.0, 1.0);
}
const float R7310_C1_EAST_WALL_BEAM_SHADOW_SEAM_GUARD_Z_MAX = 2.49;
const bool R7310_C1_EAST_WALL_BEAM_SHADOW_RETIRED = true;
const float R7310_C1_WEST_WALL_BEAM_SHADOW_SEAM_GUARD_Z_MAX = 2.846;
const float R7310_C1_WEST_WALL_BEAM_SHADOW_Z_MAX = 3.056;
const float R7310_C1_WEST_WALL_BEAM_SHADOW_Y_MAX = 2.905;
const float R7310_C1_EAST_WALL_SE_COLUMN_HANDOFF_Z_MIN = 2.49;
const float R7310_C1_EAST_WALL_BEAM_HANDOFF_Y_MIN = 2.515;
const float R7310_C1_WEST_WALL_SW_COLUMN_HANDOFF_Z_MIN = 2.7179;
const float R7310_C1_WEST_WALL_BEAM_HANDOFF_Y_MIN = 2.515;
bool r7310C1RuntimeSurfaceIsTrueFloor(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.y > 0.5 &&
		visiblePosition.y >= -0.0005 &&
		visiblePosition.y <= 0.025;
}
bool r7310C1FloorDiffuseUv(vec3 visiblePosition, out vec2 atlasUv)
{
	return r7310C1BakePastePreviewUv(visiblePosition, atlasUv);
}
bool r7310C1FloorHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1FloorDiffuseMode > 0.5 &&
		uR7310C1FullRoomDiffuseReady > 0.5 &&
		r7310C1RuntimeSurfaceIsTrueFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1FloorDiffuseUv(visiblePosition, atlasUv);
}
vec3 r7310C1FloorHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1FloorDiffuseUv(visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1FullRoomDiffuseSamplePatchValidLinear(atlasUv, 0.0);
}
bool r7310C1FloorIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1001 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1RuntimeSurfaceIsNorthWall(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.z > 0.5 &&
		visiblePosition.z >= -1.88 &&
		visiblePosition.z <= -1.86 &&
		visiblePosition.x >= -2.11 &&
		visiblePosition.x <= 2.11 &&
		visiblePosition.y >= 0.0 &&
		visiblePosition.y <= 2.905;
}
bool r7310C1RuntimeSurfaceIsWestIronThresholdTop(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.y > 0.5 &&
		visiblePosition.y >= 0.084 &&
		visiblePosition.y <= 0.096 &&
		visiblePosition.x >= -2.11 &&
		visiblePosition.x <= -1.90 &&
		visiblePosition.z >= R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_Z_MIN &&
		visiblePosition.z <= R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_Z_MAX;
}
bool r7310C1RuntimeSurfaceIsEastBeamUnder(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleNormal.y < -0.5 &&
		abs(visiblePosition.y - R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Y) <= 0.006 &&
		visiblePosition.x >= 1.849 && visiblePosition.x <= 1.911 &&
		visiblePosition.z >= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Z_MIN &&
		visiblePosition.z <= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Z_MAX;
}
bool r7310C1RuntimeSurfaceIsEastBeamInner(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleNormal.x < -0.5 &&
		abs(visiblePosition.x - R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_INNER_X) <= 0.006 &&
		visiblePosition.y >= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Y &&
		visiblePosition.y <= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SE_COLUMN_Y_MAX &&
		visiblePosition.z >= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Z_MIN &&
		visiblePosition.z <= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Z_MAX;
}
bool r7310C1RuntimeSurfaceIsSeColumnNorth(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleNormal.z < -0.5 &&
		abs(visiblePosition.z - R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Z) <= 0.006 &&
		visiblePosition.x >= 1.779 && visiblePosition.x <= 1.911 &&
		visiblePosition.y >= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Y_MIN &&
		visiblePosition.y <= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Y_MAX;
}
int r7310C1XatlasBakeCoplanarConfirmedLineId(
	int visibleHitType,
	float visibleObjectID,
	vec3 visibleNormal,
	vec3 visiblePosition)
{
	if (r7310C1RuntimeSurfaceIsNorthWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		if (visiblePosition.x >= R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_X_MIN &&
			visiblePosition.x <= R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_X_MAX &&
			abs(visiblePosition.y - R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_PLANE_Y) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS)
		{
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_BED_TOP;
		}
		if (abs(visiblePosition.x - R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_PLANE_X) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS &&
			visiblePosition.y >= R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_Y_MIN &&
			visiblePosition.y <= R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_Y_MAX)
		{
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_BEAM_VERTICAL_SEAM;
		}
		if (abs(visiblePosition.x - R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_PLANE_X) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS &&
			visiblePosition.y >= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_Y_MIN &&
			visiblePosition.y <= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_Y_MAX)
		{
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_VERTICAL_SEAM;
		}
		return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_NONE;
	}
	if (r7310C1RuntimeSurfaceIsEastWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		if (abs(visiblePosition.y - R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Y) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS &&
			visiblePosition.z >= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Z_MIN &&
			visiblePosition.z <= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Z_MAX)
		{
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_BEAM_UNDER_SEAM;
		}
		if (abs(visiblePosition.z - R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Z) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS &&
			visiblePosition.y >= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Y_MIN &&
			visiblePosition.y <= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Y_MAX)
		{
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_SE_COLUMN_SEAM;
		}
		// 東牆 bed-top 接觸邊（床頂 y=0.28，沿牆深度 z 為床範圍；x 已由 east 面保證 ≈1.91）
		if (abs(visiblePosition.y - R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_PLANE_Y) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS &&
			visiblePosition.z >= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_Z_MIN &&
			visiblePosition.z <= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_Z_MAX)
		{
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BED_TOP;
		}
		return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_NONE;
	}
	if (r7310C1RuntimeSurfaceIsEastBeamUnder(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		if (abs(visiblePosition.x - R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_INNER_X) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS)
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_INNER_UNDER_SEAM;
		if (abs(visiblePosition.x - 1.910) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS)
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_BEAM_UNDER_SEAM;
		return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_NONE;
	}
	if (r7310C1RuntimeSurfaceIsEastBeamInner(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		if (abs(visiblePosition.y - R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Y) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS)
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_INNER_UNDER_SEAM;
		if (abs(visiblePosition.z - R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Z) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS)
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_SE_COLUMN_VERTICAL_SEAM;
		return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_NONE;
	}
	if (r7310C1RuntimeSurfaceIsSeColumnNorth(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		if (abs(visiblePosition.x - R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_INNER_X) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS &&
			visiblePosition.y >= R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SE_COLUMN_Y_MIN)
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_SE_COLUMN_VERTICAL_SEAM;
		if (abs(visiblePosition.x - 1.910) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS)
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_SE_COLUMN_SEAM;
		return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_NONE;
	}
	if (r7310C1RuntimeSurfaceIsWestIronThresholdTop(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		if (abs(visiblePosition.x - R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_IRON_THRESHOLD_TOP_WEST_EDGE_PLANE_X) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS)
		{
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_IRON_THRESHOLD_TOP_WEST_EDGE;
		}
		return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_NONE;
	}
	if (r7310C1RuntimeSurfaceIsWestWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		if (abs(visiblePosition.y - R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SOUTH_DESK_TOP_PLANE_Y) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS &&
			abs(visiblePosition.z - R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SW_COLUMN_SEAM_PLANE_Z) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS)
		{
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_SOUTH_DESK_SW_COLUMN_CORNER;
		}
		if (abs(visiblePosition.y - R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_PLANE_Y) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS &&
			visiblePosition.z >= R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_Z_MIN &&
			visiblePosition.z <= R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_Z_MAX)
		{
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_IRON_THRESHOLD_TOP;
		}
		if (abs(visiblePosition.y - R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SOUTH_DESK_TOP_PLANE_Y) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS &&
			visiblePosition.z >= R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SOUTH_DESK_TOP_Z_MIN &&
			visiblePosition.z <= R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SOUTH_DESK_TOP_Z_MAX)
		{
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_SOUTH_DESK_TOP;
		}
		if (abs(visiblePosition.z - R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SW_COLUMN_SEAM_PLANE_Z) <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_PLANE_RADIUS &&
			visiblePosition.y >= R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SW_COLUMN_SEAM_Y_MIN &&
			visiblePosition.y <= R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SW_COLUMN_SEAM_Y_MAX)
		{
			return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_SW_COLUMN_VERTICAL_SEAM;
		}
		return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_NONE;
	}
	return R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_NONE;
}
bool r7310C1XatlasBakeCoplanarContactCandidate(
	int visibleHitType,
	float visibleObjectID,
	vec3 visibleNormal,
	vec3 visiblePosition)
{
	return r7310C1XatlasBakeCoplanarConfirmedLineId(
		visibleHitType,
		visibleObjectID,
		visibleNormal,
		visiblePosition
	) != R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_NONE;
}
bool r7310C1XatlasBakeCoplanarSeamAabb(int confirmedLineId, out vec3 seamMin, out vec3 seamMax)
{
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_BED_TOP)
	{
		seamMin = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_X_MIN, R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_PLANE_Y, -1.874);
		seamMax = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_X_MAX, R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_PLANE_Y, -1.874);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_BEAM_VERTICAL_SEAM)
	{
		seamMin = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_PLANE_X, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_Y_MIN, -1.874);
		seamMax = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_PLANE_X, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_Y_MAX, -1.874);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_VERTICAL_SEAM)
	{
		seamMin = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_PLANE_X, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_Y_MIN, -1.874);
		seamMax = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_PLANE_X, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_Y_MAX, -1.874);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BED_TOP)
	{
		seamMin = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_PLANE_X, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_PLANE_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_Z_MIN);
		seamMax = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_PLANE_X, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_PLANE_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_Z_MAX);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_BEAM_UNDER_SEAM)
	{
		seamMin = vec3(1.910, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Z_MIN);
		seamMax = vec3(1.910, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Z_MAX);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_SE_COLUMN_SEAM)
	{
		seamMin = vec3(1.910, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Y_MIN, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Z);
		seamMax = vec3(1.910, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Y_MAX, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Z);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_INNER_UNDER_SEAM)
	{
		seamMin = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_INNER_X, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Z_MIN);
		seamMax = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_INNER_X, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_BEAM_UNDER_Z_MAX);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_SE_COLUMN_VERTICAL_SEAM)
	{
		seamMin = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_INNER_X, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SE_COLUMN_Y_MIN, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Z);
		seamMax = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_INNER_X, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SE_COLUMN_Y_MAX, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_WALL_SE_COLUMN_Z);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_SW_COLUMN_VERTICAL_SEAM)
	{
		seamMin = vec3(-1.91, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SW_COLUMN_SEAM_Y_MIN, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SW_COLUMN_SEAM_PLANE_Z);
		seamMax = vec3(-1.91, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SW_COLUMN_SEAM_Y_MAX, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SW_COLUMN_SEAM_PLANE_Z);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_SOUTH_DESK_TOP)
	{
		seamMin = vec3(-1.91, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SOUTH_DESK_TOP_PLANE_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SOUTH_DESK_TOP_Z_MIN);
		seamMax = vec3(-1.91, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SOUTH_DESK_TOP_PLANE_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SOUTH_DESK_TOP_Z_MAX);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_SOUTH_DESK_SW_COLUMN_CORNER)
	{
		seamMin = vec3(-1.91, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SOUTH_DESK_TOP_PLANE_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SW_COLUMN_SEAM_PLANE_Z);
		seamMax = vec3(-1.91, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SOUTH_DESK_TOP_PLANE_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_SW_COLUMN_SEAM_PLANE_Z);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_IRON_THRESHOLD_TOP)
	{
		seamMin = vec3(-1.91, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_PLANE_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_Z_MIN);
		seamMax = vec3(-1.91, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_PLANE_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_Z_MAX);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_IRON_THRESHOLD_TOP_WEST_EDGE)
	{
		seamMin = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_IRON_THRESHOLD_TOP_WEST_EDGE_PLANE_X, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_PLANE_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_Z_MIN);
		seamMax = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_IRON_THRESHOLD_TOP_WEST_EDGE_PLANE_X, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_PLANE_Y, R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_WALL_IRON_THRESHOLD_TOP_Z_MAX);
		return true;
	}
	seamMin = vec3(0.0);
	seamMax = vec3(0.0);
	return false;
}
bool r7310C1XatlasBakeCoplanarNeighborAabb(int confirmedLineId, out vec3 neighborMin, out vec3 neighborMax)
{
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_BED_TOP)
	{
		neighborMin = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_X_MIN, 0.0, -1.874);
		neighborMax = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_X_MAX, R7310_C1_XATLAS_BAKE_CONFIRMED_BED_TOP_PLANE_Y, -0.314);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_BEAM_VERTICAL_SEAM)
	{
		neighborMin = vec3(-1.910, 2.525, -1.874);
		neighborMax = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_WEST_BEAM_SEAM_PLANE_X, 2.905, 2.848);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_VERTICAL_SEAM)
	{
		neighborMin = vec3(R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BEAM_SEAM_PLANE_X, 2.515, -1.874);
		neighborMax = vec3(2.110, 2.905, 3.056);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BED_TOP)
	{
		// 鄰體＝床（東面 x=1.91 與東牆共面、頂 y=0.28、深度 z[-1.874,-0.314]）
		neighborMin = vec3(-0.027, 0.0, -1.874);
		neighborMax = vec3(1.910, R7310_C1_XATLAS_BAKE_CONFIRMED_EAST_BED_TOP_PLANE_Y, -0.314);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_BEAM_UNDER_SEAM)
	{
		neighborMin = vec3(1.850, 2.515, -1.874);
		neighborMax = vec3(2.110, 2.905, 3.056);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_WALL_SE_COLUMN_SEAM)
	{
		neighborMin = vec3(1.780, 0.0, 2.490);
		neighborMax = vec3(1.910, 2.905, 3.056);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_INNER_UNDER_SEAM)
	{
		neighborMin = vec3(1.850, 2.515, -1.874);
		neighborMax = vec3(2.110, 2.905, 3.056);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_EAST_BEAM_SE_COLUMN_VERTICAL_SEAM)
	{
		neighborMin = vec3(1.780, 0.0, 2.490);
		neighborMax = vec3(1.910, 2.905, 3.056);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_SW_COLUMN_VERTICAL_SEAM)
	{
		neighborMin = vec3(-1.91, 0.0, 2.846);
		neighborMax = vec3(-1.75, 2.905, 3.056);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_SOUTH_DESK_TOP)
	{
		neighborMin = vec3(-1.91, 0.63, 2.385);
		neighborMax = vec3(1.02, 0.77, 3.056);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_SOUTH_DESK_SW_COLUMN_CORNER)
	{
		neighborMin = vec3(-1.91, 0.0, 2.385);
		neighborMax = vec3(1.02, 2.905, 3.056);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_IRON_THRESHOLD_TOP)
	{
		neighborMin = vec3(-2.11, 0.0, -1.874);
		neighborMax = vec3(-1.91, 0.09, -0.984);
		return true;
	}
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_IRON_THRESHOLD_TOP_WEST_EDGE)
	{
		neighborMin = vec3(-2.11, 0.0, -1.874);
		neighborMax = vec3(-1.91, 0.09, -0.984);
		return true;
	}
	neighborMin = vec3(0.0);
	neighborMax = vec3(0.0);
	return false;
}
bool r7310C1XatlasBakeCoplanarCornerEscapeDirection(int confirmedLineId, out vec3 escapeDir)
{
	if (confirmedLineId == R7310_C1_XATLAS_BAKE_CONFIRMED_LINE_WEST_WALL_SOUTH_DESK_SW_COLUMN_CORNER)
	{
		escapeDir = vec3(0.0, 1.0, -1.0);
		return true;
	}
	escapeDir = vec3(0.0);
	return false;
}
int r7310C1XatlasBakeDominantAxis(vec3 v)
{
	vec3 a = abs(v);
	if (a.y > a.x && a.y >= a.z) return 1;
	if (a.z > a.x && a.z > a.y) return 2;
	return 0;
}
vec3 r7310C1XatlasBakeAxisDir(int axis, float direction)
{
	if (axis == 0) return vec3(direction, 0.0, 0.0);
	if (axis == 1) return vec3(0.0, direction, 0.0);
	return vec3(0.0, 0.0, direction);
}
vec3 r7310C1XatlasBakeCoplanarEscapeFromNeighborAabb(vec3 seamMin, vec3 seamMax, vec3 neighborMin, vec3 neighborMax, vec3 visibleNormal)
{
	vec3 seamCenter = (seamMin + seamMax) * 0.5;
	vec3 seamExtent = abs(seamMax - seamMin);
	vec3 neighborCenter = (neighborMin + neighborMax) * 0.5;
	vec3 delta = seamCenter - neighborCenter;
	int lineAxis = r7310C1XatlasBakeDominantAxis(seamExtent);
	int normalAxis = r7310C1XatlasBakeDominantAxis(visibleNormal);
	int escapeAxis = -1;
	float escapeMagnitude = -1.0;
	if (lineAxis != 0 && normalAxis != 0)
	{
		escapeAxis = 0;
		escapeMagnitude = abs(delta.x);
	}
	if (lineAxis != 1 && normalAxis != 1 && abs(delta.y) > escapeMagnitude)
	{
		escapeAxis = 1;
		escapeMagnitude = abs(delta.y);
	}
	if (lineAxis != 2 && normalAxis != 2 && abs(delta.z) > escapeMagnitude)
	{
		escapeAxis = 2;
		escapeMagnitude = abs(delta.z);
	}
	if (escapeAxis < 0 || escapeMagnitude <= R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_DIR_EPS)
		return vec3(0.0);
	float direction = 1.0;
	if (escapeAxis == 0) direction = delta.x >= 0.0 ? 1.0 : -1.0;
	else if (escapeAxis == 1) direction = delta.y >= 0.0 ? 1.0 : -1.0;
	else direction = delta.z >= 0.0 ? 1.0 : -1.0;
	return r7310C1XatlasBakeAxisDir(escapeAxis, direction);
}
vec3 r7310C1XatlasBakeCoplanarLiftDirection(
	int visibleHitType,
	float visibleObjectID,
	vec3 visibleNormal,
	vec3 visiblePosition)
{
	int confirmedLineId = r7310C1XatlasBakeCoplanarConfirmedLineId(
		visibleHitType,
		visibleObjectID,
		visibleNormal,
		visiblePosition
	);
	vec3 cornerEscapeDir;
	if (r7310C1XatlasBakeCoplanarCornerEscapeDirection(confirmedLineId, cornerEscapeDir))
		return cornerEscapeDir;
	vec3 seamMin;
	vec3 seamMax;
	if (!r7310C1XatlasBakeCoplanarSeamAabb(confirmedLineId, seamMin, seamMax))
		return vec3(0.0);
	vec3 neighborMin;
	vec3 neighborMax;
	if (!r7310C1XatlasBakeCoplanarNeighborAabb(confirmedLineId, neighborMin, neighborMax))
		return vec3(0.0);
	return r7310C1XatlasBakeCoplanarEscapeFromNeighborAabb(seamMin, seamMax, neighborMin, neighborMax, visibleNormal);
}
vec3 r7310C1XatlasBakeCoplanarLiftedSurfacePoint(
	int visibleHitType,
	float visibleObjectID,
	vec3 visibleNormal,
	vec3 visiblePosition,
	vec3 outgoingDir)
{
	vec3 surfacePoint = visiblePosition;
	vec3 liftDirection = r7310C1XatlasBakeCoplanarLiftDirection(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	if (dot(liftDirection, liftDirection) > 0.5 &&
		dot(outgoingDir, liftDirection) < -R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_DIR_EPS)
	{
		surfacePoint += liftDirection * R7310_C1_XATLAS_BAKE_COPLANAR_DEGEN_LIFT;
	}
	return surfacePoint;
}
vec3 r7310C1XatlasBakeSecondaryRayOrigin(
	int visibleHitType,
	float visibleObjectID,
	vec3 visibleNormal,
	vec3 visiblePosition,
	vec3 outgoingDir)
{
	return r7310C1XatlasBakeCoplanarLiftedSurfacePoint(
		visibleHitType,
		visibleObjectID,
		visibleNormal,
		visiblePosition,
		outgoingDir
	) + visibleNormal * uEPS_intersect;
}
#if defined(R7310_INCLUDE_BAKE_CAPTURE)
vec3 r7310C1XatlasBakeNeeShadowRayOrigin(
	int visibleHitType,
	float visibleObjectID,
	vec3 visibleNormal,
	vec3 visiblePosition,
	vec3 outgoingDir)
{
	return r7310C1XatlasBakeCoplanarLiftedSurfacePoint(
		visibleHitType,
		visibleObjectID,
		visibleNormal,
		visiblePosition,
		outgoingDir
	);
}
#endif
bool r7310C1RuntimeSurfaceIsEastWall(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.x < -0.5 &&
		visiblePosition.x >= 1.90 &&
		visiblePosition.x <= 1.92 &&
		visiblePosition.z >= -1.874 &&
		visiblePosition.z <= 3.056 &&
		visiblePosition.y >= 0.0 &&
		visiblePosition.y <= 2.905;
}
bool r7310C1RuntimeSurfaceIsWestWall(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.x > 0.5 &&
		visiblePosition.x >= -1.92 &&
		visiblePosition.x <= -1.90 &&
		visiblePosition.z >= -1.874 &&
		visiblePosition.z <= 3.056 &&
		visiblePosition.y >= 0.0 &&
		visiblePosition.y <= 2.905;
}
bool r7310C1RuntimeSurfaceIsSouthWall(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.z < -0.5 &&
		visiblePosition.z >= 3.05 &&
		visiblePosition.z <= 3.07 &&
		visiblePosition.x >= -2.11 &&
		visiblePosition.x <= 2.11 &&
		visiblePosition.y >= 0.0 &&
			visiblePosition.y <= 2.905;
}
bool r7310C1SouthWallWindowHolePoint(vec3 visiblePosition)
{
	return visiblePosition.x >= -1.75 &&
		visiblePosition.x <= 0.69 &&
		visiblePosition.y >= 1.04 &&
		visiblePosition.y <= 2.905;
}
bool r7310C1RuntimeSurfaceIsSouthWallAcShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return r7310C1RuntimeSurfaceIsSouthWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		!r7310C1SouthWallWindowHolePoint(visiblePosition);
}
bool r7310C1CeilingOccluderTopFootprint(vec3 visiblePosition)
{
	// R7-3.10 ceiling x occluder-top seam/glow ROOT CAUSE (OPUS 2026-05-26)
	// The SE column (x>=1.78, z[2.49,3.056]) and east beam (x>=1.85, z[-1.874,2.49]) rise flush
	// to the ceiling plane (y=2.905). Their footprint ceiling texels bake black because the
	// occluder blocks the downward hemisphere during the bake. That produced two distinct artifacts:
	//   (1) SEAM - valid-linear averaged those black texels into the adjacent lit ceiling. Handled
	//              by the InitCommon buildR7310C1CeilingTexelMetadata atlas valid-mask, which marks
	//              the footprint texels invalid so the sampler skips them on the lit (x<1.78) side.
	//   (2) GLOW - even masked-invalid, while the ceiling hybrid still OWNED the footprint the
	//              valid-linear sampler (line ~1077) re-normalizes over valid taps only, so a masked
	//              texel one texel from the lit region returned the lit value at FULL brightness -> a
	//              bright fringe at the occluder edge (the glow seen from inside the column).
	// Fix: exclude the occluder-top footprint from ceiling ownership so it LIVE-TRACES, matching the
	// "ceiling bake off" appearance the user accepts. Excluding it inside RuntimeSurfaceIsCeiling
	// covers BOTH ceiling-claiming paths: r7310CeilingHybridFirstHit (carve at 5347) AND the
	// r7310C1FullRoomDiffuseShortCircuit re-claim (~line 2762). Bounds MIRROR the InitCommon
	// buildR7310C1CeilingTexelMetadata east+west occluder mask - the two MUST stay in sync;
	// changing one without the other reopens the seam/glow.
	// East/SE handled because the user reported it; West/SW handled PROACTIVELY - the baked atlas
	// scan confirmed the identical valid-but-black defect there (west beam 72147 + SW column 7814
	// valid-black texels). The four inward-protruding beams/columns (Home_Studio.js boxes 12/13/14/15)
	// rise flush to y=2.905; the outer wall tops are NOT listed here because the atlas edge-padding
	// (fillR7310C1AtlasEdgeFromNearestInterior) already re-lights the outer ring.
	if (visiblePosition.z > 3.056 || visiblePosition.z < -1.874)
		return false;
	// East side: SE column inner face x=1.78 (box 15), east beam inner face x=1.85 (box 13).
	bool seColumnTop = visiblePosition.z >= 2.49 && visiblePosition.x >= 1.78;
	bool eastBeamTop = visiblePosition.z < 2.49 && visiblePosition.x >= 1.85;
	// West side: west beam (box 12) and SW column (box 14) share inner face x=-1.75 across z[-1.874,3.056].
	bool westOccluderTop = visiblePosition.x <= -1.75;
	return seColumnTop || eastBeamTop || westOccluderTop;
}
bool r7310C1RuntimeSurfaceIsCeiling(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.y < -0.5 &&
		visiblePosition.y >= 2.895 &&
		visiblePosition.y <= 2.915 &&
		visiblePosition.x >= -2.11 &&
		visiblePosition.x <= 2.11 &&
		visiblePosition.z >= -2.074 &&
		visiblePosition.z <= 3.256 &&
		!r7310C1CeilingOccluderTopFootprint(visiblePosition);
}
float r7310C1StructuralBeamColumnIslandId(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	if (visibleObjectID >= 1.5)
		return 0.0;
	if (visibleNormal.x > 0.5 &&
		visiblePosition.x >= -1.760 && visiblePosition.x <= -1.740 &&
		visiblePosition.y >= 2.525 && visiblePosition.y <= 2.905 &&
		visiblePosition.z >= -1.874 && visiblePosition.z <= 2.848)
		return 1.0;
	if (visibleNormal.y < -0.5 &&
		visiblePosition.y >= 2.515 && visiblePosition.y <= 2.535 &&
		visiblePosition.x >= -1.91 && visiblePosition.x <= -1.75 &&
		visiblePosition.z >= -1.874 && visiblePosition.z <= 2.846)
		return 2.0;
	if (visibleNormal.x < -0.5 &&
		visiblePosition.x >= 1.840 && visiblePosition.x <= 1.860 &&
		visiblePosition.y >= 2.515 && visiblePosition.y <= 2.905 &&
		visiblePosition.z >= -1.874 && visiblePosition.z <= 2.49)
		return 3.0;
	if (visibleNormal.y < -0.5 &&
		visiblePosition.y >= 2.505 && visiblePosition.y <= 2.525 &&
		visiblePosition.x >= 1.85 && visiblePosition.x <= 1.91 &&
		visiblePosition.z >= -1.874 && visiblePosition.z <= 2.49)
		return 4.0;
	if (visibleNormal.x > 0.5 &&
		visiblePosition.x >= -1.760 && visiblePosition.x <= -1.740 &&
		visiblePosition.y >= 0.0 && visiblePosition.y <= 2.905 &&
		visiblePosition.z >= 2.846 && visiblePosition.z <= 3.056)
		return 5.0;
	if (visibleNormal.z < -0.5 &&
		visiblePosition.z >= 2.838 && visiblePosition.z <= 2.858 &&
		visiblePosition.x >= -1.91 && visiblePosition.x <= -1.75 &&
		visiblePosition.y >= 0.0 && visiblePosition.y <= 2.525)
		return 6.0;
	if (visibleNormal.x < -0.5 &&
		visiblePosition.x >= 1.770 && visiblePosition.x <= 1.790 &&
		visiblePosition.y >= 0.0 && visiblePosition.y <= 2.905 &&
		visiblePosition.z >= 2.49 && visiblePosition.z <= 3.056 &&
		!r7310C1StructuralSeColumnInnerHiddenByBookshelf(visiblePosition.z, visiblePosition.y))
		return 7.0;
	if (visibleNormal.z < -0.5 &&
		visiblePosition.z >= 2.480 && visiblePosition.z <= 2.500 &&
		visiblePosition.x >= 1.78 && visiblePosition.x <= 1.91 &&
		visiblePosition.y >= 0.0 && visiblePosition.y <= 2.905)
		return 8.0;
	return 0.0;
}
bool r7310C1RuntimeSurfaceIsStructuralBeamColumn(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return r7310C1StructuralBeamColumnIslandId(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) > 0.5;
}
bool r7310C1RuntimeSurfaceIsSeColumnNorthShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.z < -0.5 &&
		visiblePosition.z >= 2.480 &&
		visiblePosition.z <= 2.500 &&
		visiblePosition.x >= 1.78 &&
		visiblePosition.x <= 1.91 &&
		visiblePosition.y >= 0.0 &&
		visiblePosition.y <= 2.905;
}
bool r7310C1RuntimeSurfaceIsSeColumnWestShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.x < -0.5 &&
		visiblePosition.x >= 1.770 &&
		visiblePosition.x <= 1.790 &&
		visiblePosition.z >= 2.49 &&
		visiblePosition.z <= 3.056 &&
		visiblePosition.y >= 0.0 &&
		visiblePosition.y <= 2.905 &&
		!r7310C1StructuralSeColumnInnerHiddenByBookshelf(visiblePosition.z, visiblePosition.y);
}
bool r7310C1RuntimeSurfaceIsSwColumnNorthShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.z < -0.5 &&
		visiblePosition.z >= 2.838 &&
		visiblePosition.z <= 2.858 &&
		visiblePosition.x >= -1.91 &&
		visiblePosition.x <= -1.75 &&
		visiblePosition.y >= 0.0 &&
		visiblePosition.y <= 2.525;
}
vec4 r7310C1StructuralBeamColumnAtlasRect(float islandId)
{
	if (islandId < 1.5) return vec4(0.000, 0.000, 0.500, 0.170);
	if (islandId < 2.5) return vec4(0.000, 0.180, 0.500, 0.260);
	if (islandId < 3.5) return vec4(0.000, 0.270, 0.500, 0.440);
	if (islandId < 4.5) return vec4(0.000, 0.450, 0.500, 0.530);
	if (islandId < 5.5) return vec4(0.520, 0.000, 0.740, 0.360);
	if (islandId < 6.5) return vec4(0.760, 0.000, 0.940, 0.360);
	if (islandId < 7.5) return vec4(0.520, 0.380, 0.740, 0.760);
	if (islandId < 8.5) return vec4(0.000, 0.880, 1.000, 1.000);
	return vec4(0.0, 0.0, 1.0, 1.0);
}
vec4 r7310C1StructuralBeamColumnAtlasRectForPoint(float islandId, vec3 visiblePosition)
{
	return r7310C1StructuralBeamColumnAtlasRect(islandId);
}
bool r7310C1NorthWallDiffuseUv(vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsNorthWall(1, 0.0, vec3(0.0, 0.0, 1.0), visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (r7310C1NorthWallOwnerExcluded(visiblePosition.x, visiblePosition.y))
	{
		// West/east beam north cap -> not owned by the north wall; let it live-trace.
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.x + 2.11) / 4.22,
		visiblePosition.y / 2.905
	);
	return true;
}
bool r7310C1NorthWallHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1NorthWallDiffuseMode > 0.5 &&
		uR7310C1FullRoomDiffuseReady > 0.5 &&
		r7310C1RuntimeSurfaceIsNorthWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1NorthWallDiffuseUv(visiblePosition, atlasUv);
}
vec3 r7310C1NorthWallHybridPreAlbedoRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1NorthWallDiffuseUv(visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1ShouldUseNonSquareAtlas(1.0)
		? r7310C1FullRoomDiffuseSamplePatchValidLinearNonSquare(atlasUv, 1.0)
		: r7310C1FullRoomDiffuseSamplePatchValidLinear(atlasUv, 1.0);
}
vec3 r7310C1NorthWallHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, vec3 visibleAlbedo)
{
	vec3 r7310NorthWallPreAlbedoRadiance = r7310C1NorthWallHybridPreAlbedoRadiance(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	if (uR7310C1NorthWallSeparatedDiffuseMode > 0.5)
		return r7310NorthWallPreAlbedoRadiance * visibleAlbedo;
	return r7310NorthWallPreAlbedoRadiance;
}
bool r7310C1NorthWallIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1002 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1EastWallDiffuseUv(vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsEastWall(1, 0.0, vec3(-1.0, 0.0, 0.0), visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (visiblePosition.z >= R7310_C1_EAST_WALL_SE_COLUMN_HANDOFF_Z_MIN ||
		visiblePosition.y >= R7310_C1_EAST_WALL_BEAM_HANDOFF_Y_MIN)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.z + 1.874) / 4.93,
		visiblePosition.y / 2.905
	);
	return true;
}
bool r7310C1EastWallHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1EastWallDiffuseMode > 0.5 &&
		uR7310C1FullRoomDiffuseReady > 0.5 &&
		r7310C1RuntimeSurfaceIsEastWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1EastWallDiffuseUv(visiblePosition, atlasUv);
}
vec3 r7310C1EastWallHybridPreAlbedoRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1EastWallDiffuseUv(visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1ShouldUseNonSquareAtlas(2.0)
		? r7310C1FullRoomDiffuseSampleRectTent3NonSquare(atlasUv, 2.0, r7310C1EastWallAtlasRect())
		: r7310C1FullRoomDiffuseSampleRectTent3(atlasUv, 2.0, r7310C1EastWallAtlasRect());
}
vec3 r7310C1EastWallHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return r7310C1EastWallHybridPreAlbedoRadiance(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
}
bool r7310C1EastWallIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1003 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1RuntimeSurfaceIsEastWallBeamShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return r7310C1RuntimeSurfaceIsEastWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		visiblePosition.z < R7310_C1_EAST_WALL_BEAM_SHADOW_SEAM_GUARD_Z_MAX;
}
bool r7310C1EastWallBeamShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsEastWallBeamShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.z + 1.874) / 4.93,
		visiblePosition.y / 2.905
	);
	return true;
}
vec4 r7310C1EastWallBeamShadowTexel(vec2 pixelCoord)
{
	float resolution = max(1.0, uR7310C1EastWallBeamShadowResolution);
	return r7310C1FullRoomDiffuseSamplePatchTexel(clamp(pixelCoord, vec2(0.0), vec2(resolution - 1.0)), 10.0);
}
vec3 r7310C1EastWallBeamShadowSampleValidLinear(vec2 atlasUv)
{
	float resolution = max(1.0, uR7310C1EastWallBeamShadowResolution);
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), vec2(0.0), vec2(resolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(resolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1EastWallBeamShadowTexel(p0);
	vec4 c10 = r7310C1EastWallBeamShadowTexel(vec2(p1.x, p0.y));
	vec4 c01 = r7310C1EastWallBeamShadowTexel(vec2(p0.x, p1.y));
	vec4 c11 = r7310C1EastWallBeamShadowTexel(p1);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1EastWallBeamShadowTexel(floor(pixel + vec2(0.5)));
	return max(nearest.rgb, vec3(0.0));
}
bool r7310C1EastWallBeamShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	if (R7310_C1_EAST_WALL_BEAM_SHADOW_RETIRED)
		return false;
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1EastWallBeamShadowMode > 0.5 &&
		uR7310C1EastWallBeamShadowReady > 0.5 &&
		r7310C1RuntimeSurfaceIsEastWallBeamShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1EastWallBeamShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1EastWallBeamShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1EastWallBeamShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1EastWallBeamShadowSampleValidLinear(atlasUv);
}
bool r7310C1EastWallBeamShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1011 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1RuntimeSurfaceIsWestWallBeamShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return r7310C1RuntimeSurfaceIsWestWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		visiblePosition.z <= max(uR7310C1WestWallBeamShadowZMaxOverride, R7310_C1_WEST_WALL_BEAM_SHADOW_SEAM_GUARD_Z_MAX) &&
		visiblePosition.y <= R7310_C1_WEST_WALL_BEAM_SHADOW_Y_MAX;
}
bool r7310C1WestWallBeamShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsWestWallBeamShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.z + 1.874) / 4.93,
		visiblePosition.y / 2.905
	);
	return true;
}
vec4 r7310C1WestWallBeamShadowTexel(vec2 pixelCoord)
{
	float resolution = max(1.0, uR7310C1WestWallBeamShadowResolution);
	return r7310C1FullRoomDiffuseSamplePatchTexel(clamp(pixelCoord, vec2(0.0), vec2(resolution - 1.0)), 12.0);
}
vec3 r7310C1WestWallBeamShadowSampleValidLinear(vec2 atlasUv)
{
	float resolution = max(1.0, uR7310C1WestWallBeamShadowResolution);
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), vec2(0.0), vec2(resolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(resolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1WestWallBeamShadowTexel(p0);
	vec4 c10 = r7310C1WestWallBeamShadowTexel(vec2(p1.x, p0.y));
	vec4 c01 = r7310C1WestWallBeamShadowTexel(vec2(p0.x, p1.y));
	vec4 c11 = r7310C1WestWallBeamShadowTexel(p1);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1WestWallBeamShadowTexel(floor(pixel + vec2(0.5)));
	return max(nearest.rgb, vec3(0.0));
}
bool r7310C1WestWallBeamShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1WestWallBeamShadowMode > 0.5 &&
		uR7310C1WestWallBeamShadowReady > 0.5 &&
		!r7310C1XatlasParamWestSurfaceActive() &&
		r7310C1RuntimeSurfaceIsWestWallBeamShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1WestWallBeamShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1WestWallBeamShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1WestWallBeamShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1WestWallBeamShadowSampleValidLinear(atlasUv);
}
bool r7310C1WestWallBeamShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1013 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1RuntimeSurfaceIsSwColumnInnerShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.x > 0.5 &&
		visiblePosition.x >= -1.760 &&
		visiblePosition.x <= -1.740 &&
		visiblePosition.z >= 2.846 &&
		visiblePosition.z <= 3.056 &&
		visiblePosition.y >= 0.0 &&
		visiblePosition.y <= 2.905;
}
bool r7310C1SwColumnInnerShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsSwColumnInnerShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.z - 2.846) / 0.410,
		visiblePosition.y / 2.905
	);
	return true;
}
vec4 r7310C1SwColumnInnerShadowTexel(vec2 pixelCoord)
{
	float resolution = max(1.0, uR7310C1SwColumnInnerShadowResolution);
	return r7310C1FullRoomDiffuseSamplePatchTexel(clamp(pixelCoord, vec2(0.0), vec2(resolution - 1.0)), 13.0);
}
vec3 r7310C1SwColumnInnerShadowSampleValidLinear(vec2 atlasUv)
{
	float resolution = max(1.0, uR7310C1SwColumnInnerShadowResolution);
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), vec2(0.0), vec2(resolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(resolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1SwColumnInnerShadowTexel(p0);
	vec4 c10 = r7310C1SwColumnInnerShadowTexel(vec2(p1.x, p0.y));
	vec4 c01 = r7310C1SwColumnInnerShadowTexel(vec2(p0.x, p1.y));
	vec4 c11 = r7310C1SwColumnInnerShadowTexel(p1);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1SwColumnInnerShadowTexel(floor(pixel + vec2(0.5)));
	return max(nearest.rgb, vec3(0.0));
}
bool r7310C1SwColumnInnerShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1SwColumnInnerShadowMode > 0.5 &&
		uR7310C1SwColumnInnerShadowReady > 0.5 &&
		r7310C1RuntimeSurfaceIsSwColumnInnerShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1SwColumnInnerShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1SwColumnInnerShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1SwColumnInnerShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1SwColumnInnerShadowSampleValidLinear(atlasUv);
}
bool r7310C1SwColumnInnerShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1014 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1RuntimeSurfaceIsWestBeamInnerShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.x > 0.5 &&
		visiblePosition.x >= -1.760 &&
		visiblePosition.x <= -1.740 &&
		visiblePosition.z >= -1.874 &&
		visiblePosition.z <= 2.848 &&
		visiblePosition.y >= 2.525 &&
		visiblePosition.y <= 2.905;
}
bool r7310C1WestBeamInnerShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsWestBeamInnerShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.z + 1.874) / 4.722,
		(visiblePosition.y - 2.525) / 0.380
	);
	return true;
}
vec4 r7310C1WestBeamInnerShadowTexel(vec2 pixelCoord)
{
	float resolution = max(1.0, uR7310C1WestBeamInnerShadowResolution);
	return r7310C1FullRoomDiffuseSamplePatchTexel(clamp(pixelCoord, vec2(0.0), vec2(resolution - 1.0)), 14.0);
}
vec3 r7310C1WestBeamInnerShadowSampleValidLinear(vec2 atlasUv)
{
	float resolution = max(1.0, uR7310C1WestBeamInnerShadowResolution);
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), vec2(0.0), vec2(resolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(resolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1WestBeamInnerShadowTexel(p0);
	vec4 c10 = r7310C1WestBeamInnerShadowTexel(vec2(p1.x, p0.y));
	vec4 c01 = r7310C1WestBeamInnerShadowTexel(vec2(p0.x, p1.y));
	vec4 c11 = r7310C1WestBeamInnerShadowTexel(p1);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1WestBeamInnerShadowTexel(floor(pixel + vec2(0.5)));
	return max(nearest.rgb, vec3(0.0));
}
bool r7310C1WestBeamInnerShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1WestBeamInnerShadowMode > 0.5 &&
		uR7310C1WestBeamInnerShadowReady > 0.5 &&
		r7310C1RuntimeSurfaceIsWestBeamInnerShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1WestBeamInnerShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1WestBeamInnerShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1WestBeamInnerShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1WestBeamInnerShadowSampleValidLinear(atlasUv);
}
bool r7310C1WestBeamInnerShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1015 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1RuntimeSurfaceIsWestBeamUnderShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.y < -0.5 &&
		visiblePosition.y >= 2.515 &&
		visiblePosition.y <= 2.535 &&
		visiblePosition.x >= -1.91 &&
		visiblePosition.x <= -1.75 &&
		visiblePosition.z >= -1.874 &&
		visiblePosition.z <= 2.846;
}
bool r7310C1WestBeamUnderShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsWestBeamUnderShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.z + 1.874) / 4.720,
		(visiblePosition.x + 1.91) / 0.160
	);
	return true;
}
vec4 r7310C1WestBeamUnderShadowTexel(vec2 pixelCoord)
{
	float resolution = max(1.0, uR7310C1WestBeamUnderShadowResolution);
	return r7310C1FullRoomDiffuseSamplePatchTexel(clamp(pixelCoord, vec2(0.0), vec2(resolution - 1.0)), 15.0);
}
vec3 r7310C1WestBeamUnderShadowSampleValidLinear(vec2 atlasUv)
{
	float resolution = max(1.0, uR7310C1WestBeamUnderShadowResolution);
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), vec2(0.0), vec2(resolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(resolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1WestBeamUnderShadowTexel(p0);
	vec4 c10 = r7310C1WestBeamUnderShadowTexel(vec2(p1.x, p0.y));
	vec4 c01 = r7310C1WestBeamUnderShadowTexel(vec2(p0.x, p1.y));
	vec4 c11 = r7310C1WestBeamUnderShadowTexel(p1);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1WestBeamUnderShadowTexel(floor(pixel + vec2(0.5)));
	return max(nearest.rgb, vec3(0.0));
}
bool r7310C1WestBeamUnderShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1WestBeamUnderShadowMode > 0.5 &&
		uR7310C1WestBeamUnderShadowReady > 0.5 &&
		r7310C1RuntimeSurfaceIsWestBeamUnderShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1WestBeamUnderShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1WestBeamUnderShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1WestBeamUnderShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1WestBeamUnderShadowSampleValidLinear(atlasUv);
}
bool r7310C1WestBeamUnderShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1016 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1RuntimeSurfaceIsEastBeamInnerShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		visibleNormal.x < -0.5 &&
		visiblePosition.x >= 1.840 &&
		visiblePosition.x <= 1.860 &&
		visiblePosition.z >= -1.874 &&
		visiblePosition.z <= 2.49 &&
		visiblePosition.y >= 2.515 &&
		visiblePosition.y <= 2.905;
}
bool r7310C1EastBeamInnerShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsEastBeamInnerShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.z + 1.874) / 4.364,
		(visiblePosition.y - 2.515) / 0.390
	);
	return true;
}
vec4 r7310C1EastBeamInnerShadowTexel(vec2 pixelCoord)
{
	float resolution = max(1.0, uR7310C1EastBeamInnerShadowResolution);
	return r7310C1FullRoomDiffuseSamplePatchTexel(clamp(pixelCoord, vec2(0.0), vec2(resolution - 1.0)), 16.0);
}
vec3 r7310C1EastBeamInnerShadowSampleValidLinear(vec2 atlasUv)
{
	float resolution = max(1.0, uR7310C1EastBeamInnerShadowResolution);
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), vec2(0.0), vec2(resolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(resolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1EastBeamInnerShadowTexel(p0);
	vec4 c10 = r7310C1EastBeamInnerShadowTexel(vec2(p1.x, p0.y));
	vec4 c01 = r7310C1EastBeamInnerShadowTexel(vec2(p0.x, p1.y));
	vec4 c11 = r7310C1EastBeamInnerShadowTexel(p1);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1EastBeamInnerShadowTexel(floor(pixel + vec2(0.5)));
	return max(nearest.rgb, vec3(0.0));
}
bool r7310C1EastBeamInnerShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1EastBeamInnerShadowMode > 0.5 &&
		uR7310C1EastBeamInnerShadowReady > 0.5 &&
		r7310C1RuntimeSurfaceIsEastBeamInnerShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1EastBeamInnerShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1EastBeamInnerShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1EastBeamInnerShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1EastBeamInnerShadowSampleValidLinear(atlasUv);
}
bool r7310C1EastBeamInnerShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1017 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1XatlasBakeSurfaceIsEastBeamUnder(vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleNormal.y < -0.5 &&
		visiblePosition.y >= 2.505 &&
		visiblePosition.y <= 2.525 &&
		visiblePosition.x >= 1.85 &&
		visiblePosition.x <= 1.91 &&
		visiblePosition.z >= -1.874 &&
		visiblePosition.z <= 2.49;
}
bool r7310C1RuntimeSurfaceIsEastBeamUnderShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		r7310C1XatlasBakeSurfaceIsEastBeamUnder(visibleNormal, visiblePosition);
}
bool r7310C1EastBeamUnderShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsEastBeamUnderShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.z + 1.874) / 4.364,
		(visiblePosition.x - 1.85) / 0.060
	);
	return true;
}
vec4 r7310C1EastBeamUnderShadowTexel(vec2 pixelCoord)
{
	float resolution = max(1.0, uR7310C1EastBeamUnderShadowResolution);
	return r7310C1FullRoomDiffuseSamplePatchTexel(clamp(pixelCoord, vec2(0.0), vec2(resolution - 1.0)), 17.0);
}
vec3 r7310C1EastBeamUnderShadowSampleValidLinear(vec2 atlasUv)
{
	float resolution = max(1.0, uR7310C1EastBeamUnderShadowResolution);
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), vec2(0.0), vec2(resolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(resolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1EastBeamUnderShadowTexel(p0);
	vec4 c10 = r7310C1EastBeamUnderShadowTexel(vec2(p1.x, p0.y));
	vec4 c01 = r7310C1EastBeamUnderShadowTexel(vec2(p0.x, p1.y));
	vec4 c11 = r7310C1EastBeamUnderShadowTexel(p1);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1EastBeamUnderShadowTexel(floor(pixel + vec2(0.5)));
	return max(nearest.rgb, vec3(0.0));
}
bool r7310C1EastBeamUnderShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1EastBeamUnderShadowMode > 0.5 &&
		uR7310C1EastBeamUnderShadowReady > 0.5 &&
		r7310C1RuntimeSurfaceIsEastBeamUnderShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1EastBeamUnderShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1EastBeamUnderShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1EastBeamUnderShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1EastBeamUnderShadowSampleValidLinear(atlasUv);
}
bool r7310C1EastBeamUnderShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1018 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
float r7310C1SouthWindowFrontEdgeNearestReveal(vec3 visiblePosition, vec3 visibleNormal)
{
	if (visibleNormal.z >= -0.5 ||
		visiblePosition.z < 3.05 || visiblePosition.z > 3.07 ||
		visiblePosition.x < -1.75 || visiblePosition.x > 0.69 ||
		visiblePosition.y < 1.04 || visiblePosition.y > 2.905)
		return 0.0;
	float leftDistance = visiblePosition.x + 1.75;
	float rightDistance = 0.69 - visiblePosition.x;
	float bottomDistance = visiblePosition.y - 1.04;
	float topDistance = 2.905 - visiblePosition.y;
	float nearestDistance = min(min(leftDistance, rightDistance), min(bottomDistance, topDistance));
	if (nearestDistance > r7310C1SouthWallFrontHoleEdgeBand())
		return 0.0;
	if (bottomDistance <= topDistance &&
		bottomDistance <= leftDistance &&
		bottomDistance <= rightDistance)
		return 3.0;
	if (topDistance <= leftDistance &&
		topDistance <= rightDistance)
		return 4.0;
	if (leftDistance <= rightDistance)
		return 1.0;
	return 2.0;
}
bool r7310C1RuntimeSurfaceIsSouthWindowLeftRevealShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		((visibleNormal.x > 0.5 &&
			visiblePosition.x >= -1.76 && visiblePosition.x <= -1.74 &&
			visiblePosition.y >= 1.04 && visiblePosition.y <= 2.905 &&
			visiblePosition.z >= 3.056 && visiblePosition.z <= 3.256) ||
		(r7310C1SouthWindowFrontEdgeNearestReveal(visiblePosition, visibleNormal) > 0.5 &&
			r7310C1SouthWindowFrontEdgeNearestReveal(visiblePosition, visibleNormal) < 1.5));
}
bool r7310C1RuntimeSurfaceIsSouthWindowRightRevealShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		((visibleNormal.x < -0.5 &&
			visiblePosition.x >= 0.68 && visiblePosition.x <= 0.70 &&
			visiblePosition.y >= 1.04 && visiblePosition.y <= 2.905 &&
			visiblePosition.z >= 3.056 && visiblePosition.z <= 3.256) ||
		(r7310C1SouthWindowFrontEdgeNearestReveal(visiblePosition, visibleNormal) > 1.5 &&
			r7310C1SouthWindowFrontEdgeNearestReveal(visiblePosition, visibleNormal) < 2.5));
}
bool r7310C1RuntimeSurfaceIsSouthWindowBottomRevealShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		((visibleNormal.y > 0.5 &&
			visiblePosition.y >= 1.03 && visiblePosition.y <= 1.05 &&
			visiblePosition.x >= -1.75 && visiblePosition.x <= 0.69 &&
			visiblePosition.z >= 3.056 && visiblePosition.z <= 3.256) ||
		(r7310C1SouthWindowFrontEdgeNearestReveal(visiblePosition, visibleNormal) > 2.5 &&
			r7310C1SouthWindowFrontEdgeNearestReveal(visiblePosition, visibleNormal) < 3.5));
}
bool r7310C1RuntimeSurfaceIsSouthWindowTopRevealShadow(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleObjectID < 1.5 &&
		r7310C1SouthWindowFrontEdgeNearestReveal(visiblePosition, visibleNormal) > 3.5 &&
		r7310C1SouthWindowFrontEdgeNearestReveal(visiblePosition, visibleNormal) < 4.5;
}
bool r7310C1SouthWindowLeftRevealShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsSouthWindowLeftRevealShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		clamp((visiblePosition.z - 3.056) / 0.200, 0.0, 1.0),
		clamp((visiblePosition.y - 1.04) / 1.865, 0.0, 1.0)
	);
	return true;
}
bool r7310C1SouthWindowRightRevealShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsSouthWindowRightRevealShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		clamp((visiblePosition.z - 3.056) / 0.200, 0.0, 1.0),
		clamp((visiblePosition.y - 1.04) / 1.865, 0.0, 1.0)
	);
	return true;
}
bool r7310C1SouthWindowBottomRevealShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsSouthWindowBottomRevealShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		clamp((visiblePosition.x + 1.75) / 2.44, 0.0, 1.0),
		clamp((visiblePosition.z - 3.056) / 0.200, 0.0, 1.0)
	);
	return true;
}
bool r7310C1SouthWindowTopRevealShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsSouthWindowTopRevealShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		clamp((visiblePosition.x + 1.75) / 2.44, 0.0, 1.0),
		clamp((visiblePosition.z - 3.056) / 0.200, 0.0, 1.0)
	);
	return true;
}
vec4 r7310C1SouthWindowRevealShadowTexel(vec2 pixelCoord, float resolution, float slot)
{
	return r7310C1FullRoomDiffuseSamplePatchTexel(clamp(pixelCoord, vec2(0.0), vec2(resolution - 1.0)), slot);
}
vec3 r7310C1SouthWindowRevealShadowSampleValidLinear(vec2 atlasUv, float resolution, float slot)
{
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), vec2(0.0), vec2(resolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(resolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1SouthWindowRevealShadowTexel(p0, resolution, slot);
	vec4 c10 = r7310C1SouthWindowRevealShadowTexel(vec2(p1.x, p0.y), resolution, slot);
	vec4 c01 = r7310C1SouthWindowRevealShadowTexel(vec2(p0.x, p1.y), resolution, slot);
	vec4 c11 = r7310C1SouthWindowRevealShadowTexel(p1, resolution, slot);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1SouthWindowRevealShadowTexel(floor(pixel + vec2(0.5)), resolution, slot);
	return max(nearest.rgb, vec3(0.0));
}
bool r7310C1SouthWindowLeftRevealShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1SouthWindowLeftRevealShadowMode > 0.5 &&
		uR7310C1SouthWindowLeftRevealShadowReady > 0.5 &&
		r7310C1SouthWindowLeftRevealShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1SouthWindowLeftRevealShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1SouthWindowLeftRevealShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1SouthWindowRevealShadowSampleValidLinear(atlasUv, max(1.0, uR7310C1SouthWindowLeftRevealShadowResolution), 18.0);
}
bool r7310C1SouthWindowRightRevealShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1SouthWindowRightRevealShadowMode > 0.5 &&
		uR7310C1SouthWindowRightRevealShadowReady > 0.5 &&
		r7310C1SouthWindowRightRevealShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1SouthWindowRightRevealShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1SouthWindowRightRevealShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1SouthWindowRevealShadowSampleValidLinear(atlasUv, max(1.0, uR7310C1SouthWindowRightRevealShadowResolution), 19.0);
}
bool r7310C1SouthWindowBottomRevealShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1SouthWindowBottomRevealShadowMode > 0.5 &&
		uR7310C1SouthWindowBottomRevealShadowReady > 0.5 &&
		r7310C1SouthWindowBottomRevealShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1SouthWindowBottomRevealShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1SouthWindowBottomRevealShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1SouthWindowRevealShadowSampleValidLinear(atlasUv, max(1.0, uR7310C1SouthWindowBottomRevealShadowResolution), 20.0);
}
bool r7310C1SouthWindowTopRevealShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1SouthWindowTopRevealShadowMode > 0.5 &&
		uR7310C1SouthWindowTopRevealShadowReady > 0.5 &&
		r7310C1SouthWindowTopRevealShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1SouthWindowTopRevealShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1SouthWindowTopRevealShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1SouthWindowRevealShadowSampleValidLinear(atlasUv, max(1.0, uR7310C1SouthWindowTopRevealShadowResolution), 21.0);
}
bool r7310C1RuntimeSurfaceIsIronDoorBody(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return visibleHitType == IRON_DOOR;
}
bool r7310C1IronDoorBodyDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsIronDoorBody(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	float u = clamp((-0.984 - visiblePosition.z) / 0.890, 0.0, 1.0);
	float v = clamp((visiblePosition.y - 0.09) / 1.950, 0.0, 1.0);
	atlasUv = vec2(u, v);
	return true;
}
bool r7310C1IronDoorMainFlatPlateMask(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	// full_flat_door_photo_plane: the iron door is one flat photo-textured metal plane.
	vec2 atlasUv = vec2(0.0);
	if (visibleHitType != IRON_DOOR ||
		abs(visibleNormal.x) < 0.9 ||
		!r7310C1IronDoorBodyDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return false;
	return true;
}
bool r7310C1IronDoorBodyHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1IronDoorBodyMode > 0.5 &&
		uR7310C1IronDoorBodyReady > 0.5 &&
		r7310C1IronDoorBodyDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1IronDoorBodyHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1IronDoorBodyDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1FullRoomDiffuseSamplePatchValidLinearRect(atlasUv, 23.0, uR7310C1IronDoorBodyAtlasSize);
}
float r7310C1IronDoorNonZeroSign(float v)
{
	return v < 0.0 ? -1.0 : 1.0;
}
vec3 r7310C1IronDoorSafeDirection(vec3 direction)
{
	vec3 d = normalize(direction);
	return vec3(
		abs(d.x) < 0.0001 ? 0.0001 * r7310C1IronDoorNonZeroSign(d.x) : d.x,
		abs(d.y) < 0.0001 ? 0.0001 * r7310C1IronDoorNonZeroSign(d.y) : d.y,
		abs(d.z) < 0.0001 ? 0.0001 * r7310C1IronDoorNonZeroSign(d.z) : d.z
	);
}
vec3 r7310C1IronDoorBoxProjectedProbeDirection(vec3 origin, vec3 direction)
{
	vec3 d = r7310C1IronDoorSafeDirection(direction);
	vec3 tMin = (uR7310C1IronDoorReflectionProbeBoxMin - origin) / d;
	vec3 tMax = (uR7310C1IronDoorReflectionProbeBoxMax - origin) / d;
	vec3 tBox = mix(tMin, tMax, step(vec3(0.0), d));
	float t = min(min(tBox.x, tBox.y), tBox.z);
	vec3 hitPosition = origin + d * max(t, 0.0);
	return normalize(hitPosition - uR7310C1IronDoorReflectionProbePosition);
}
void r7310C1IronDoorProbeFaceUv(vec3 direction, out float faceIndex, out vec2 uv)
{
	vec3 d = normalize(direction);
	vec3 ad = abs(d);
	faceIndex = 0.0;
	uv = vec2(0.5);
	if (ad.x >= ad.y && ad.x >= ad.z)
	{
		if (d.x > 0.0)
		{
			faceIndex = 0.0;
			uv = vec2(-d.z, d.y) / ad.x;
		}
		else
		{
			faceIndex = 1.0;
			uv = vec2(d.z, d.y) / ad.x;
		}
	}
	else if (ad.y >= ad.z)
	{
		if (d.y > 0.0)
		{
			faceIndex = 2.0;
			uv = vec2(d.x, -d.z) / ad.y;
		}
		else
		{
			faceIndex = 3.0;
			uv = vec2(d.x, d.z) / ad.y;
		}
	}
	else
	{
		if (d.z > 0.0)
		{
			faceIndex = 4.0;
			uv = vec2(d.x, d.y) / ad.z;
		}
		else
		{
			faceIndex = 5.0;
			uv = vec2(-d.x, d.y) / ad.z;
		}
	}
	uv = clamp(uv * 0.5 + 0.5, vec2(0.001), vec2(0.999));
}
vec3 r7310C1IronDoorCapturedProbeRadiance(vec3 origin, vec3 direction, float roughness)
{
	vec3 probeDirection = r7310C1IronDoorBoxProjectedProbeDirection(origin, direction);
	float faceIndex = 0.0;
	vec2 atlasUv = vec2(0.5);
	r7310C1IronDoorProbeFaceUv(probeDirection, faceIndex, atlasUv);
	float patchSlot = 24.0 + faceIndex;
	vec3 radiance = r7310C1FullRoomDiffuseSamplePatchValidLinearRect(atlasUv, patchSlot, uR7310C1IronDoorReflectionProbeAtlasSize);
	return max(radiance, vec3(0.0));
}
bool r7310C1IronDoorRuntimePlanarReflectionSourcePassActive()
{
	return uR7310C1IronDoorRuntimePlanarReflectionSourcePass > 0.5;
}
bool r7310C1RuntimeFirstHitBakeAllowed(int bounces)
{
	return bounces == 0 && uR7310C1XatlasBakeMode < 0.5;
}
bool r7310C1IronDoorRuntimePlanarReflectionUv(vec3 visiblePosition, out vec2 planarUv)
{
	vec4 projected = uR7310C1IronDoorRuntimePlanarReflectionTextureMatrix * vec4(visiblePosition, 1.0);
	if (projected.w <= 0.0001)
	{
		planarUv = vec2(0.5);
		return false;
	}
	planarUv = projected.xy / projected.w;
	return all(greaterThanEqual(planarUv, vec2(0.0))) &&
		all(lessThanEqual(planarUv, vec2(1.0)));
}
float r7310C1IronDoorRuntimePlanarReflectionMaterialRoughness(float surfaceRoughness, float scaledRoughness)
{
	return clamp(scaledRoughness, 0.0, 1.0);
}
float r7310C1IronDoorRuntimePlanarReflectionMaxMipLod()
{
	return clamp(log2(max(1.0, uR7310C1IronDoorRuntimePlanarReflectionTextureSize.y)), 0.0, 12.0);
}
vec3 r7310C1IronDoorRuntimePlanarReflectionSample(vec2 planarUv)
{
#if defined(R7310_FORMAL_XATLAS_RAW)
	return texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv, vec2(0.0), vec2(1.0))).rgb;
#else
	return texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv, vec2(0.0), vec2(1.0))).rgb;
#endif
}
vec3 r7310C1IronDoorRuntimePlanarReflectionSamplePrefiltered(vec3 visiblePosition, vec3 viewRayDirection, vec3 visibleNormal, float roughness)
{
	vec2 planarUv = vec2(0.5);
	if (!r7310C1IronDoorRuntimePlanarReflectionUv(visiblePosition, planarUv))
		return vec3(0.0);
	float roughnessWeight = clamp(roughness * roughness, 0.0, 1.0);
	vec2 texelFootprint = 1.0 / max(uR7310C1IronDoorRuntimePlanarReflectionTextureSize, vec2(1.0));
	vec2 roughnessFootprint = texelFootprint * mix(0.0, 96.0, roughnessWeight);
#if defined(R7310_FORMAL_XATLAS_RAW)
	vec3 radiance =
		texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv, vec2(0.0), vec2(1.0))).rgb * 0.28 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv + roughnessFootprint * vec2( 1.0,  0.0), vec2(0.0), vec2(1.0))).rgb * 0.10 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv + roughnessFootprint * vec2(-1.0,  0.0), vec2(0.0), vec2(1.0))).rgb * 0.10 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv + roughnessFootprint * vec2( 0.0,  1.0), vec2(0.0), vec2(1.0))).rgb * 0.10 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv + roughnessFootprint * vec2( 0.0, -1.0), vec2(0.0), vec2(1.0))).rgb * 0.10 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv + roughnessFootprint * vec2( 0.7071,  0.7071), vec2(0.0), vec2(1.0))).rgb * 0.045 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv + roughnessFootprint * vec2(-0.7071,  0.7071), vec2(0.0), vec2(1.0))).rgb * 0.045 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv + roughnessFootprint * vec2( 0.7071, -0.7071), vec2(0.0), vec2(1.0))).rgb * 0.045 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv + roughnessFootprint * vec2(-0.7071, -0.7071), vec2(0.0), vec2(1.0))).rgb * 0.045 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv + roughnessFootprint * 2.0 * vec2( 1.0,  0.0), vec2(0.0), vec2(1.0))).rgb * 0.035 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv + roughnessFootprint * 2.0 * vec2(-1.0,  0.0), vec2(0.0), vec2(1.0))).rgb * 0.035 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv + roughnessFootprint * 2.0 * vec2( 0.0,  1.0), vec2(0.0), vec2(1.0))).rgb * 0.035 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTexture, clamp(planarUv + roughnessFootprint * 2.0 * vec2( 0.0, -1.0), vec2(0.0), vec2(1.0))).rgb * 0.035;
#else
	vec3 radiance =
		texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv, vec2(0.0), vec2(1.0))).rgb * 0.28 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv + roughnessFootprint * vec2( 1.0,  0.0), vec2(0.0), vec2(1.0))).rgb * 0.10 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv + roughnessFootprint * vec2(-1.0,  0.0), vec2(0.0), vec2(1.0))).rgb * 0.10 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv + roughnessFootprint * vec2( 0.0,  1.0), vec2(0.0), vec2(1.0))).rgb * 0.10 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv + roughnessFootprint * vec2( 0.0, -1.0), vec2(0.0), vec2(1.0))).rgb * 0.10 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv + roughnessFootprint * vec2( 0.7071,  0.7071), vec2(0.0), vec2(1.0))).rgb * 0.045 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv + roughnessFootprint * vec2(-0.7071,  0.7071), vec2(0.0), vec2(1.0))).rgb * 0.045 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv + roughnessFootprint * vec2( 0.7071, -0.7071), vec2(0.0), vec2(1.0))).rgb * 0.045 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv + roughnessFootprint * vec2(-0.7071, -0.7071), vec2(0.0), vec2(1.0))).rgb * 0.045 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv + roughnessFootprint * 2.0 * vec2( 1.0,  0.0), vec2(0.0), vec2(1.0))).rgb * 0.035 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv + roughnessFootprint * 2.0 * vec2(-1.0,  0.0), vec2(0.0), vec2(1.0))).rgb * 0.035 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv + roughnessFootprint * 2.0 * vec2( 0.0,  1.0), vec2(0.0), vec2(1.0))).rgb * 0.035 +
		texture2D(tR7310C1FullRoomDiffuseAtlasTextureNonSquare, clamp(planarUv + roughnessFootprint * 2.0 * vec2( 0.0, -1.0), vec2(0.0), vec2(1.0))).rgb * 0.035;
#endif
	return max(radiance * uR7310C1IronDoorRuntimePlanarReflectionSourceOneOverSampleCounter, vec3(0.0));
}
vec3 r7310C1IronDoorRuntimePlanarReflectionEnvBrdfApprox(vec3 specularColor, float roughness, float noV)
{
	const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
	const vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
	vec4 r = roughness * c0 + c1;
	float a004 = min(r.x * r.x, exp2(-9.28 * noV)) * r.x + r.y;
	vec2 ab = vec2(-1.04, 1.04) * a004 + r.zw;
	return specularColor * ab.x + ab.y;
}
vec3 r7310C1IronDoorRuntimePlanarReflectionSpecularWeight(vec3 baseColor, vec3 viewRayDirection, vec3 visibleNormal, float roughness)
{
	return max(baseColor, vec3(0.0));
}
vec3 r7310C1IronDoorRuntimePlanarReflectionRadiance(vec3 visiblePosition, vec3 viewRayDirection, vec3 visibleNormal, float roughness)
{
	vec2 planarUv = vec2(0.5);
	if (!r7310C1IronDoorRuntimePlanarReflectionUv(visiblePosition, planarUv))
		return vec3(0.0);
	return r7310C1IronDoorRuntimePlanarReflectionSamplePrefiltered(visiblePosition, viewRayDirection, visibleNormal, roughness);
}
bool r7310C1IronDoorPlanarReflectionUv(vec3 visiblePosition, out vec2 atlasUv)
{
	vec3 toPoint = visiblePosition - uR7310C1IronDoorPlanarReflectionCameraPosition;
	vec3 cameraForward = normalize(uR7310C1IronDoorPlanarReflectionCameraForward);
	vec3 cameraRight = normalize(uR7310C1IronDoorPlanarReflectionCameraRight);
	vec3 cameraUp = normalize(uR7310C1IronDoorPlanarReflectionCameraUp);
	float depth = dot(toPoint, cameraForward);
	if (depth <= 0.0001)
	{
		atlasUv = vec2(0.5);
		return false;
	}
	float sx = dot(toPoint, cameraRight) /
		(depth * max(0.0001, uR7310C1IronDoorPlanarReflectionCameraFovScale) * max(0.0001, uR7310C1IronDoorPlanarReflectionCameraAspect));
	float sy = dot(toPoint, cameraUp) /
		(depth * max(0.0001, uR7310C1IronDoorPlanarReflectionCameraFovScale));
	atlasUv = vec2(sx * 0.5 + 0.5, sy * 0.5 + 0.5);
	return all(greaterThanEqual(atlasUv, vec2(0.0))) &&
		all(lessThanEqual(atlasUv, vec2(1.0)));
}
vec3 r7310C1IronDoorPlanarReflectionRadiance(vec3 visiblePosition, float roughness)
{
	vec2 atlasUv = vec2(0.5);
	if (!r7310C1IronDoorPlanarReflectionUv(visiblePosition, atlasUv))
		return vec3(0.0);
	vec3 radiance = r7310C1FullRoomDiffuseSamplePatchValidLinearRect(atlasUv, 24.0, uR7310C1IronDoorPlanarReflectionAtlasSize);
	return max(radiance, vec3(0.0));
}

bool r7310C1IronDoorRuntimePlanarReflectionClipSeed(out vec3 sourceDoorPosition, out vec3 sourceDoorNormal)
{
	sourceDoorPosition = rayOrigin;
	sourceDoorNormal = vec3(1.0, 0.0, 0.0);
	if (uR7310C1IronDoorPlanarReflectionCaptureClipPlaneMode < 0.5)
		return true;
	vec3 clipNormal = normalize(uR7310C1IronDoorPlanarReflectionCaptureClipPlane.xyz);
	float clipConstant = uR7310C1IronDoorPlanarReflectionCaptureClipPlane.w;
	float denom = dot(clipNormal, rayDirection);
	if (abs(denom) < 0.000001)
		return false;
	float tClip = (clipConstant - dot(clipNormal, rayOrigin)) / denom;
	if (tClip <= 0.0)
		return false;
	sourceDoorPosition = rayOrigin + rayDirection * tClip;
	sourceDoorNormal = clipNormal;
	rayOrigin = sourceDoorPosition + clipNormal * max(uEPS_intersect * 8.0, 0.0005);
	return true;
}

bool r7310C1IronDoorPlanarReflectionApplyCaptureClipPlane()
{
	vec3 sourceDoorPosition;
	vec3 sourceDoorNormal;
	return r7310C1IronDoorRuntimePlanarReflectionClipSeed(sourceDoorPosition, sourceDoorNormal);
}

// R7-3.10 iron-door opening reveal (OPUS 2026-05-26) — ONE combined dedicated surface (atlas slot 22, target 1023).
// The iron door (box26 x[-2.00,-1.96]) is recessed 5cm behind the west wall inner face (x=-1.91), so the opening
// has 4 reveal/jamb faces inside the recess x[-1.96,-1.91]. All 4 are currently live: top/bottom/south-jamb have no
// owner; the north jamb sits on the north-wall plane but NorthWallHiddenBySideWall(x<=-1.91) excludes it from the
// north-wall bake. This surface bakes all 4 into 4 horizontal atlas bands (v: top 0-.25 / bottom .25-.5 / north .5-.75 / south .75-1).
bool r7310C1RuntimeSurfaceIsIronDoorReveal(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	if (visibleObjectID >= 1.5 || visiblePosition.x < -1.965 || visiblePosition.x > -1.91)
		return false;
	bool topFace    = visibleNormal.y < -0.5 && visiblePosition.y >= 2.03 && visiblePosition.y <= 2.05 && visiblePosition.z >= -1.874 && visiblePosition.z <= -0.984;
	bool bottomFace = visibleNormal.y > 0.5 && visiblePosition.y >= 0.08 && visiblePosition.y <= 0.10 && visiblePosition.z >= -1.874 && visiblePosition.z <= -0.984;
	bool northJamb  = visibleNormal.z > 0.5 && visiblePosition.z >= -1.884 && visiblePosition.z <= -1.864 && visiblePosition.y >= 0.09 && visiblePosition.y <= 2.04;
	bool southJamb  = visibleNormal.z < -0.5 && visiblePosition.z >= -0.994 && visiblePosition.z <= -0.974 && visiblePosition.y >= 0.09 && visiblePosition.y <= 2.04;
	return topFace || bottomFace || northJamb || southJamb;
}
bool r7310C1IronDoorRevealDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsIronDoorReveal(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	// GUARD-BAND CONTRACT (CODEX Phase 1 review, hard constraint): the 4 faces share one atlas in 4 horizontal
	// 0.25 v-bands. To stop valid-linear bilinear from bleeding across a band boundary into the neighbouring
	// face, each band reserves IRON_DOOR_REVEAL_GUARD_V (=0.04, atlas-v) on each side as guard; the shader maps
	// the sample only into the band CORE (height 0.25-2*GUARD=0.17), and the Phase 3 metadata builder MUST mark
	// those guard rows invalid (alpha=0) using the SAME bands+GUARD (round(GUARD*resolution) rows). Keep in sync.
	// u (along the face's long axis) needs no inter-face guard: each band is one face spanning full u; the atlas
	// outer ring (u≈0/1, v≈0/1) is handled by fillR7310C1AtlasEdgeFromNearestInterior.
	float depth = clamp((visiblePosition.x + 1.96) / 0.05, 0.0, 1.0); // door face x=-1.96 -> wall inner face x=-1.91
	float bandV = IRON_DOOR_REVEAL_GUARD_V + depth * IRON_DOOR_REVEAL_CORE_H; // map into band CORE (skip guard rows)
	float along; float bandBase;
	if (visibleNormal.y < -0.5)      { along = clamp((visiblePosition.z + 1.874) / 0.890, 0.0, 1.0); bandBase = IRON_DOOR_REVEAL_BAND_H * 0.0; }
	else if (visibleNormal.y > 0.5)  { along = clamp((visiblePosition.z + 1.874) / 0.890, 0.0, 1.0); bandBase = IRON_DOOR_REVEAL_BAND_H * 1.0; }
	else if (visibleNormal.z > 0.5)  { along = clamp((visiblePosition.y - 0.09) / 1.950, 0.0, 1.0); bandBase = IRON_DOOR_REVEAL_BAND_H * 2.0; }
	else                             { along = clamp((visiblePosition.y - 0.09) / 1.950, 0.0, 1.0); bandBase = IRON_DOOR_REVEAL_BAND_H * 3.0; }
	atlasUv = vec2(along, bandBase + bandV);
	return true;
}
bool r7310C1IronDoorRevealHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1IronDoorRevealMode > 0.5 &&
		uR7310C1IronDoorRevealReady > 0.5 &&
		r7310C1IronDoorRevealDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1IronDoorRevealHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1IronDoorRevealDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1SouthWindowRevealShadowSampleValidLinear(atlasUv, max(1.0, uR7310C1IronDoorRevealResolution), 22.0);
}
bool r7310C1IronDoorRevealIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1023 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1SouthWindowLeftRevealShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1019 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1SouthWindowRightRevealShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1020 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1SouthWindowBottomRevealShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1021 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1SouthWindowTopRevealShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1022 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1WestWallDiffuseUv(vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsWestWall(1, 0.0, vec3(1.0, 0.0, 0.0), visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (visiblePosition.z >= -1.874 && visiblePosition.z <= -0.984 && visiblePosition.y >= 0.09 && visiblePosition.y <= 2.04)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (visiblePosition.z >= R7310_C1_WEST_WALL_SW_COLUMN_HANDOFF_Z_MIN ||
		visiblePosition.y >= R7310_C1_WEST_WALL_BEAM_HANDOFF_Y_MIN)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.z + 1.874) / 4.93,
		visiblePosition.y / 2.905
	);
	return true;
}
bool r7310C1WestWallHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1WestWallDiffuseMode > 0.5 &&
		!r7310C1XatlasParamWestSurfaceActive() &&
		uR7310C1FullRoomDiffuseReady > 0.5 &&
		r7310C1RuntimeSurfaceIsWestWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1WestWallDiffuseUv(visiblePosition, atlasUv);
}
vec3 r7310C1WestWallHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1WestWallDiffuseUv(visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1FullRoomDiffuseSample(r7310C1CombinedAtlasUv(atlasUv, 3.0));
}
bool r7310C1WestWallIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1004 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1SouthWallWindowRevealDiffuseUv(vec3 visiblePosition, vec3 visibleNormal, out vec2 atlasUv)
{
	float revealT = 0.0;
	if (r7310C1SouthWallWindowFrontEdgeDiffuseUv(visiblePosition, visibleNormal, atlasUv))
		return true;
	if (visiblePosition.z < 3.056 || visiblePosition.z > 3.256)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (visibleNormal.x > 0.5 &&
		visiblePosition.x >= -1.76 && visiblePosition.x <= -1.74 &&
		visiblePosition.y >= 1.04 && visiblePosition.y <= 2.905)
	{
		revealT = (visiblePosition.z - 3.056) / (3.256 - 3.056);
		atlasUv = r7310C1SouthWallAtlasUvFromPackedPoint(
			r7310C1SouthWallClampPackedX(mix(-1.69, -1.52, revealT), -1.69, -1.52),
			r7310C1SouthWallClampPackedY(mix(1.10, 2.845, (visiblePosition.y - 1.04) / (2.905 - 1.04)), 1.10, 2.845)
		);
		return true;
	}
	if (visibleNormal.x < -0.5 &&
		visiblePosition.x >= 0.68 && visiblePosition.x <= 0.70 &&
		visiblePosition.y >= 1.04 && visiblePosition.y <= 2.905)
	{
		revealT = (visiblePosition.z - 3.056) / (3.256 - 3.056);
		atlasUv = r7310C1SouthWallAtlasUvFromPackedPoint(
			r7310C1SouthWallClampPackedX(mix(0.46, 0.63, revealT), 0.46, 0.63),
			r7310C1SouthWallClampPackedY(mix(1.10, 2.845, (visiblePosition.y - 1.04) / (2.905 - 1.04)), 1.10, 2.845)
		);
		return true;
	}
	if (visibleNormal.y > 0.5 &&
		visiblePosition.y >= 1.03 && visiblePosition.y <= 1.05 &&
		visiblePosition.x >= -1.75 && visiblePosition.x <= 0.69)
	{
		revealT = (visiblePosition.z - 3.056) / (3.256 - 3.056);
		atlasUv = r7310C1SouthWallAtlasUvFromPackedPoint(
			r7310C1SouthWallClampPackedX(mix(-1.52, 0.46, (visiblePosition.x + 1.75) / (0.69 + 1.75)), -1.52, 0.46),
			r7310C1SouthWallClampPackedY(mix(1.10, 1.27, revealT), 1.10, 1.27)
		);
		return true;
	}
	atlasUv = vec2(0.0);
	return false;
}
bool r7310C1SouthWallDiffuseUv(vec3 visiblePosition, vec3 visibleNormal, out vec2 atlasUv)
{
	if (r7310C1SouthWallWindowRevealDiffuseUv(visiblePosition, visibleNormal, atlasUv))
		return true;
	if (!r7310C1RuntimeSurfaceIsSouthWall(1, 0.0, vec3(0.0, 0.0, -1.0), visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (visiblePosition.x >= -1.75 && visiblePosition.x <= 0.69 && visiblePosition.y >= 1.04 && visiblePosition.y <= 2.905)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (r7310C1SouthWallHiddenBySideColumn(visiblePosition.x, visiblePosition.y))
	{
		// R7-3.10 global seam hardening (OPUS 2026-06-03): SW/SE column backs are baked-invalid
		// (JS metadata alpha=0; bake-point 1005 skips them, added in db6895d). The runtime ownership
		// gate was the missing third side -> south wall hybrid claimed those bands and the combined
		// atlas read produced a dark fringe at the x=-1.75 / x=1.78 column edges (bilinear bleed).
		// Release them to live trace, matching metadata. Locked by
		// docs/tests/r7-3-10-south-wall-side-column-contract.test.js.
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.x + 2.11) / 4.22,
		visiblePosition.y / 2.905
	);
	return true;
}
bool r7310C1CeilingDiffuseUv(vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsCeiling(1, 0.0, vec3(0.0, -1.0, 0.0), visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.x + 2.11) / 4.22,
		(visiblePosition.z + 2.074) / 5.33
	);
	return true;
}
bool r7310C1CeilingHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1CeilingDiffuseMode > 0.5 &&
		uR7310C1FullRoomDiffuseReady > 0.5 &&
		r7310C1RuntimeSurfaceIsCeiling(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1CeilingDiffuseUv(visiblePosition, atlasUv);
}
vec3 r7310C1CeilingHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1CeilingDiffuseUv(visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1FullRoomDiffuseSamplePatchValidLinear(atlasUv, 5.0);
}
bool r7310C1CeilingIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1006 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1StructuralBeamColumnDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	float islandId = r7310C1StructuralBeamColumnIslandId(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	if (islandId < 0.5)
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (islandId < 1.5)
	{
		// west_beam_inner_x
		atlasUv = vec2(
			mix(0.000, 0.500, (visiblePosition.z + 1.874) / 4.930),
			mix(0.000, 0.170, (visiblePosition.y - 2.525) / 0.380)
		);
		return true;
	}
	if (islandId < 2.5)
	{
		// west_beam_under_y
		atlasUv = vec2(
			mix(0.000, 0.500, (visiblePosition.z + 1.874) / 4.722),
			mix(0.180, 0.260, (visiblePosition.x + 1.910) / 0.160)
		);
		return true;
	}
	if (islandId < 3.5)
	{
		// east_beam_inner_x
		atlasUv = vec2(
			mix(0.000, 0.500, (visiblePosition.z + 1.874) / 4.364),
			mix(0.270, 0.440, (visiblePosition.y - 2.515) / 0.390)
		);
		return true;
	}
	if (islandId < 4.5)
	{
		// east_beam_under_y
		atlasUv = vec2(
			mix(0.000, 0.500, (visiblePosition.z + 1.874) / 4.364),
			mix(0.450, 0.530, (visiblePosition.x - 1.850) / 0.060)
		);
		return true;
	}
	if (islandId < 5.5)
	{
		// sw_column_inner_x
		atlasUv = vec2(
			mix(0.520, 0.740, (visiblePosition.z - 2.846) / 0.210),
			mix(0.000, 0.360, visiblePosition.y / 2.905)
		);
		return true;
	}
	if (islandId < 6.5)
	{
		// sw_column_north_z
		atlasUv = vec2(
			mix(0.760, 0.940, (visiblePosition.x + 1.910) / 0.160),
			mix(0.000, 0.360, visiblePosition.y / 2.525)
		);
		return true;
	}
	if (islandId < 7.5)
	{
		// se_column_inner_x
		atlasUv = vec2(
			mix(0.520, 0.740, (visiblePosition.z - 2.490) / 0.566),
			mix(0.380, 0.760, visiblePosition.y / 2.905)
		);
		return true;
	}
	if (islandId < 8.5)
	{
		// se_column_north_z
		if (r7310C1StructuralSeColumnNorthHiddenByEastBeam(visiblePosition.x, visiblePosition.y))
		{
			atlasUv = vec2(0.0);
			return false;
		}
		atlasUv = vec2(
			mix(0.000, 1.000, visiblePosition.y / 2.905),
			mix(0.880, 1.000, (visiblePosition.x - 1.780) / 0.130)
		);
		return true;
	}
	atlasUv = vec2(0.0);
	return false;
}
bool r7310C1SeColumnNorthShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsSeColumnNorthShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (r7310C1SeColumnNorthShadowHiddenByEastBeam(visiblePosition.x, visiblePosition.y))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.x - 1.78) / 0.13,
		visiblePosition.y / 2.905
	);
	return true;
}
vec4 r7310C1SeColumnNorthShadowTexel(vec2 pixelCoord)
{
	float resolution = max(1.0, uR7310C1SeColumnNorthShadowResolution);
	return r7310C1FullRoomDiffuseSamplePatchTexel(clamp(pixelCoord, vec2(0.0), vec2(resolution - 1.0)), 7.0);
}
vec3 r7310C1SeColumnNorthShadowSampleValidLinear(vec2 atlasUv)
{
	float resolution = max(1.0, uR7310C1SeColumnNorthShadowResolution);
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), vec2(0.0), vec2(resolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(resolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1SeColumnNorthShadowTexel(p0);
	vec4 c10 = r7310C1SeColumnNorthShadowTexel(vec2(p1.x, p0.y));
	vec4 c01 = r7310C1SeColumnNorthShadowTexel(vec2(p0.x, p1.y));
	vec4 c11 = r7310C1SeColumnNorthShadowTexel(p1);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1SeColumnNorthShadowTexel(floor(pixel + vec2(0.5)));
	return max(nearest.rgb, vec3(0.0));
}
bool r7310C1SeColumnNorthShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1SeColumnNorthShadowMode > 0.5 &&
		uR7310C1SeColumnNorthShadowReady > 0.5 &&
		r7310C1RuntimeSurfaceIsSeColumnNorthShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1SeColumnNorthShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1SeColumnNorthShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1SeColumnNorthShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1SeColumnNorthShadowSampleValidLinear(atlasUv);
}
bool r7310C1SeColumnNorthShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1008 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1SeColumnWestShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsSeColumnWestShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.z - 2.49) / 0.566,
		visiblePosition.y / 2.905
	);
	return true;
}
vec4 r7310C1SeColumnWestShadowTexel(vec2 pixelCoord)
{
	float resolution = max(1.0, uR7310C1SeColumnWestShadowResolution);
	return r7310C1FullRoomDiffuseSamplePatchTexel(clamp(pixelCoord, vec2(0.0), vec2(resolution - 1.0)), 8.0);
}
vec3 r7310C1SeColumnWestShadowSampleValidLinear(vec2 atlasUv)
{
	float resolution = max(1.0, uR7310C1SeColumnWestShadowResolution);
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), vec2(0.0), vec2(resolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(resolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1SeColumnWestShadowTexel(p0);
	vec4 c10 = r7310C1SeColumnWestShadowTexel(vec2(p1.x, p0.y));
	vec4 c01 = r7310C1SeColumnWestShadowTexel(vec2(p0.x, p1.y));
	vec4 c11 = r7310C1SeColumnWestShadowTexel(p1);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1SeColumnWestShadowTexel(floor(pixel + vec2(0.5)));
	return max(nearest.rgb, vec3(0.0));
}
bool r7310C1SeColumnWestShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1SeColumnWestShadowMode > 0.5 &&
		uR7310C1SeColumnWestShadowReady > 0.5 &&
		r7310C1RuntimeSurfaceIsSeColumnWestShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1SeColumnWestShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1SeColumnWestShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1SeColumnWestShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1SeColumnWestShadowSampleValidLinear(atlasUv);
}
bool r7310C1SeColumnWestShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1009 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1SwColumnNorthShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsSwColumnNorthShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.x + 1.91) / 0.16,
		visiblePosition.y / 2.525
	);
	return true;
}
vec4 r7310C1SwColumnNorthShadowTexel(vec2 pixelCoord)
{
	float resolution = max(1.0, uR7310C1SwColumnNorthShadowResolution);
	return r7310C1FullRoomDiffuseSamplePatchTexel(clamp(pixelCoord, vec2(0.0), vec2(resolution - 1.0)), 11.0);
}
vec3 r7310C1SwColumnNorthShadowSampleValidLinear(vec2 atlasUv)
{
	float resolution = max(1.0, uR7310C1SwColumnNorthShadowResolution);
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), vec2(0.0), vec2(resolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(resolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1SwColumnNorthShadowTexel(p0);
	vec4 c10 = r7310C1SwColumnNorthShadowTexel(vec2(p1.x, p0.y));
	vec4 c01 = r7310C1SwColumnNorthShadowTexel(vec2(p0.x, p1.y));
	vec4 c11 = r7310C1SwColumnNorthShadowTexel(p1);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1SwColumnNorthShadowTexel(floor(pixel + vec2(0.5)));
	return max(nearest.rgb, vec3(0.0));
}
bool r7310C1SwColumnNorthShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1SwColumnNorthShadowMode > 0.5 &&
		uR7310C1SwColumnNorthShadowReady > 0.5 &&
		r7310C1RuntimeSurfaceIsSwColumnNorthShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1SwColumnNorthShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1SwColumnNorthShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1SwColumnNorthShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1SwColumnNorthShadowSampleValidLinear(atlasUv);
}
bool r7310C1SwColumnNorthShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1012 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1SouthWallAcShadowDiffuseUv(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec2 atlasUv)
{
	if (!r7310C1RuntimeSurfaceIsSouthWallAcShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition))
	{
		atlasUv = vec2(0.0);
		return false;
	}
	if (r7310C1SouthWallAcShadowHiddenBySideColumn(visiblePosition.x, visiblePosition.y))
	{
		// R7-3.10 global seam hardening: same SW/SE column-back release as the main south wall.
		atlasUv = vec2(0.0);
		return false;
	}
	atlasUv = vec2(
		(visiblePosition.x + 2.11) / 4.22,
		visiblePosition.y / 2.905
	);
	return true;
}
vec4 r7310C1SouthWallAcShadowTexel(vec2 pixelCoord)
{
	float resolution = max(1.0, uR7310C1SouthWallAcShadowResolution);
	return r7310C1FullRoomDiffuseSamplePatchTexel(clamp(pixelCoord, vec2(0.0), vec2(resolution - 1.0)), 9.0);
}
vec3 r7310C1SouthWallAcShadowSampleValidLinear(vec2 atlasUv)
{
	float resolution = max(1.0, uR7310C1SouthWallAcShadowResolution);
	vec2 pixel = clamp(atlasUv * resolution - vec2(0.5), vec2(0.0), vec2(resolution - 1.0));
	vec2 p0 = floor(pixel);
	vec2 p1 = min(p0 + vec2(1.0), vec2(resolution - 1.0));
	vec2 t = pixel - p0;
	vec4 c00 = r7310C1SouthWallAcShadowTexel(p0);
	vec4 c10 = r7310C1SouthWallAcShadowTexel(vec2(p1.x, p0.y));
	vec4 c01 = r7310C1SouthWallAcShadowTexel(vec2(p0.x, p1.y));
	vec4 c11 = r7310C1SouthWallAcShadowTexel(p1);
	float w00 = (1.0 - t.x) * (1.0 - t.y) * c00.a;
	float w10 = t.x * (1.0 - t.y) * c10.a;
	float w01 = (1.0 - t.x) * t.y * c01.a;
	float w11 = t.x * t.y * c11.a;
	float weightSum = w00 + w10 + w01 + w11;
	if (weightSum > 0.000001)
		return max((c00.rgb * w00 + c10.rgb * w10 + c01.rgb * w01 + c11.rgb * w11) / weightSum, vec3(0.0));
	vec4 nearest = r7310C1SouthWallAcShadowTexel(floor(pixel + vec2(0.5)));
	return max(nearest.rgb, vec3(0.0));
}
bool r7310C1SouthWallAcShadowHybridActive(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	return uR738C1BakeCaptureMode == 0 &&
		uR7310C1SouthWallAcShadowMode > 0.5 &&
		uR7310C1SouthWallAcShadowReady > 0.5 &&
		r7310C1RuntimeSurfaceIsSouthWallAcShadow(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1SouthWallAcShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv);
}
vec3 r7310C1SouthWallAcShadowHybridRadiance(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	vec2 atlasUv = vec2(0.0);
	if (!r7310C1SouthWallAcShadowDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
		return vec3(0.0);
	return r7310C1SouthWallAcShadowSampleValidLinear(atlasUv);
}
bool r7310C1SouthWallAcShadowIndirectBakeFirstHit(int bounceIndex, int diffuseIndex)
{
	return uR738C1BakeCaptureMode == 2 &&
		uR738C1BakePatchId == 1010 &&
		bounceIndex == 0 &&
		diffuseIndex == 0;
}
bool r7310C1FullRoomDiffuseShortCircuit(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, int visibleIsRayExiting, vec3 visibleAlbedo, out vec3 bakedRadiance)
{
	bakedRadiance = vec3(0.0);
	if (uR738C1BakeCaptureMode != 0)
		return false;
	if (uR7310C1FullRoomDiffuseMode < 0.5 || uR7310C1FullRoomDiffuseReady < 0.5)
		return false;
	if (visibleIsRayExiting == TRUE)
		return false;
	vec2 atlasUv = vec2(0.0);
	if (uR7310C1FloorDiffuseMode > 0.5 &&
		r7310C1RuntimeSurfaceIsTrueFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1BakePastePreviewUv(visiblePosition, atlasUv))
	{
		bakedRadiance = r7310C1FullRoomDiffuseSample(r7310C1CombinedAtlasUv(atlasUv, 0.0));
		return true;
	}
	if (r7310C1XatlasNorthWallUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
	{
		vec3 r7310XatlasRadiance = vec3(0.0);
		if (r7310C1XatlasRuntimeSampleValidLinear(atlasUv, r7310XatlasRadiance))
		{
			bakedRadiance = uR7310C1XatlasRuntimeSeparatedAlbedo > 0.5
				? r7310XatlasRadiance * visibleAlbedo
				: r7310XatlasRadiance;
			return true;
		}
	}
	if (uR7310C1NorthWallDiffuseMode > 0.5 &&
		r7310C1RuntimeSurfaceIsNorthWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1NorthWallDiffuseUv(visiblePosition, atlasUv))
	{
		vec3 r7310NorthWallBakedRadiance = r7310C1ShouldUseNonSquareAtlas(1.0)
			? r7310C1FullRoomDiffuseSamplePatchValidLinearNonSquare(atlasUv, 1.0)
			: r7310C1FullRoomDiffuseSample(r7310C1CombinedAtlasUv(atlasUv, 1.0));
		if (uR7310C1NorthWallSeparatedDiffuseMode > 0.5)
			bakedRadiance = r7310NorthWallBakedRadiance * visibleAlbedo;
		else
			bakedRadiance = r7310NorthWallBakedRadiance;
		return true;
	}
	if (uR7310C1EastWallDiffuseMode > 0.5 &&
		r7310C1RuntimeSurfaceIsEastWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1EastWallDiffuseUv(visiblePosition, atlasUv))
	{
		vec3 r7310EastWallBakedRadiance = r7310C1ShouldUseNonSquareAtlas(2.0)
			? r7310C1FullRoomDiffuseSampleRectTent3NonSquare(atlasUv, 2.0, r7310C1EastWallAtlasRect())
			: r7310C1FullRoomDiffuseSampleRectTent3(atlasUv, 2.0, r7310C1EastWallAtlasRect());
		bakedRadiance = r7310EastWallBakedRadiance;
		return true;
	}
	if (uR7310C1WestWallDiffuseMode > 0.5 &&
		!r7310C1XatlasParamWestSurfaceActive() &&
		r7310C1RuntimeSurfaceIsWestWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1WestWallDiffuseUv(visiblePosition, atlasUv))
	{
		vec3 r7310WestWallBakedRadiance = r7310C1FullRoomDiffuseSample(r7310C1CombinedAtlasUv(atlasUv, 3.0));
		bakedRadiance = r7310WestWallBakedRadiance;
		return true;
	}
	if (uR7310C1SouthWallDiffuseMode > 0.5 &&
		r7310C1RuntimeSurfaceIsSouthWall(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1SouthWallDiffuseUv(visiblePosition, visibleNormal, atlasUv))
	{
		vec3 r7310SouthWallBakedRadiance = r7310C1FullRoomDiffuseSample(r7310C1CombinedAtlasUv(atlasUv, 4.0));
		bakedRadiance = r7310SouthWallBakedRadiance;
		return true;
	}
	if (uR7310C1SouthWallDiffuseMode > 0.5 &&
		visibleObjectID < 1.5 &&
		r7310C1SouthWallWindowRevealDiffuseUv(visiblePosition, visibleNormal, atlasUv))
	{
		vec3 r7310SouthWallRevealBakedRadiance = r7310C1FullRoomDiffuseSample(r7310C1CombinedAtlasUv(atlasUv, 4.0));
		bakedRadiance = r7310SouthWallRevealBakedRadiance;
		return true;
	}
	if (uR7310C1CeilingDiffuseMode > 0.5 &&
		r7310C1RuntimeSurfaceIsCeiling(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		r7310C1CeilingDiffuseUv(visiblePosition, atlasUv))
	{
		vec3 r7310CeilingBakedRadiance = r7310C1FullRoomDiffuseSample(r7310C1CombinedAtlasUv(atlasUv, 5.0));
		bakedRadiance = r7310CeilingBakedRadiance;
		return true;
	}
	float structuralIslandId = r7310C1StructuralBeamColumnIslandId(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	if (uR7310C1StructuralDiffuseMode > 0.5 &&
		uR7310C1XatlasRuntimeStructuralDirectIncluded < 0.5 &&
		structuralIslandId > 0.5 &&
		r7310C1StructuralBeamColumnDiffuseUv(visibleHitType, visibleObjectID, visibleNormal, visiblePosition, atlasUv))
	{
		vec3 r7310StructuralBeamColumnBakedRadiance = r7310C1FullRoomDiffuseSampleRectLinear(atlasUv, 6.0, r7310C1StructuralBeamColumnAtlasRectForPoint(structuralIslandId, visiblePosition));
		bakedRadiance = r7310StructuralBeamColumnBakedRadiance;
		return true;
	}
	return false;
}
int r739C1ReflectionTargetId(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	if (cloudVisibleSurfaceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition)) return 1;
	if (visibleHitType == IRON_DOOR && abs(visiblePosition.x + 1.96) < 0.08) return 2;
	if (visibleObjectID >= 101.0 && visibleObjectID <= 103.0) return 3;
	if (visibleObjectID >= 105.0 && visibleObjectID <= 107.0) return 3;
	if (visibleHitType == SPEAKER && (abs(visibleObjectID - 100.0) < 0.5 || abs(visibleObjectID - 104.0) < 0.5)) return 4;
	return 0;
}
vec3 r739C1ReflectionTargetColor(int targetId)
{
	if (targetId == 1) return vec3(1.0, 0.0, 0.0);
	if (targetId == 2) return vec3(0.0, 1.0, 0.0);
	if (targetId == 3) return vec3(0.0, 0.0, 1.0);
	if (targetId == 4) return vec3(1.0, 0.0, 1.0);
	return vec3(0.0);
}
bool r739C1AccurateReflectionReplacesTarget(int targetId, vec3 visiblePosition)
{
	if (targetId != 1) return false;
	vec2 r739SproutUv;
	return r738C1BakePastePreviewUv(visiblePosition, r739SproutUv);
}
bool r739C1CurrentViewReflectionActiveForTarget(int targetId, vec3 visiblePosition)
{
	return uR739C1CurrentViewReflectionMode > 0.5 &&
		uR739C1CurrentViewReflectionReady > 0.5 &&
		r739C1AccurateReflectionReplacesTarget(targetId, visiblePosition);
}
float r739C1CurrentViewFloorRoughness(int targetId, vec3 visiblePosition)
{
	if (r739C1CurrentViewReflectionActiveForTarget(targetId, visiblePosition))
		return clamp(uR739C1CurrentViewReflectionRoughness, 0.0, 1.0);
	return uFloorRoughness;
}
bool r739C1ReflectionReferenceDisablesTarget(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return uR739C1ReflectionReferenceMode > 1.5 &&
		r739C1AccurateReflectionReplacesTarget(r739C1ReflectionTargetId(visibleHitType, visibleObjectID, visibleNormal, visiblePosition), visiblePosition);
}
vec3 r739SampleAccurateSurfaceReflection(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	int targetId = r739C1ReflectionTargetId(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	if (!r739C1AccurateReflectionReplacesTarget(targetId, visiblePosition)) return vec3(0.0);
	return vec3(0.0);
}
bool cloudVisibleSurfaceProbeModeMatches(int mode, int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	if (mode == 12 || mode == 17) return cloudVisibleSurfaceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	if (mode == 13 || mode == 18) return cloudVisibleSurfaceIsGik(visibleHitType);
	if (mode == 14 || mode == 19) return cloudVisibleSurfaceIsCeiling(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	if (mode == 15 || mode == 20) return cloudVisibleSurfaceIsWall(visibleHitType, visibleObjectID, visibleNormal);
	if (mode == 16 || mode == 21) return cloudVisibleSurfaceIsObject(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	return false;
}
bool cloudDarkVisibleSurfaceSourceProbeModeMatches(int mode, int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, int sourceHitType, float sourceObjectID, vec3 sourceNormal, vec3 sourcePosition)
{
	bool visibleFloor = cloudVisibleSurfaceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	bool visibleGik = cloudVisibleSurfaceIsGik(visibleHitType);
	bool sourceFloor = cloudDirectNeeSourceIsFloor(sourceHitType, sourceObjectID, sourceNormal, sourcePosition);
	bool sourceGik = cloudDirectNeeSourceIsGik(sourceHitType);
	bool sourceCeiling = cloudDirectNeeSourceIsCeiling(sourceHitType, sourceObjectID, sourceNormal, sourcePosition);
	bool sourceWall = cloudDirectNeeSourceIsWall(sourceHitType, sourceObjectID, sourceNormal);
	bool sourceObject = !sourceFloor && !sourceGik && !sourceCeiling && !sourceWall;
	if (mode == 22) return visibleFloor && sourceFloor;
	if (mode == 23) return visibleFloor && sourceGik;
	if (mode == 24) return visibleFloor && sourceCeiling;
	if (mode == 25) return visibleFloor && sourceWall;
	if (mode == 26) return visibleFloor && sourceObject;
	if (mode == 27) return visibleGik && sourceFloor;
	if (mode == 28) return visibleGik && sourceGik;
	if (mode == 29) return visibleGik && sourceCeiling;
	if (mode == 30) return visibleGik && sourceWall;
	if (mode == 31) return visibleGik && sourceObject;
	return false;
}
vec3 cloudDarkVisibleSurfaceCleanupContribution(vec3 contribution, int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, int sourceHitType, float sourceObjectID, vec3 sourceNormal, vec3 sourcePosition)
{
	if (uCloudDarkSurfaceCleanupMode < 0.5) return contribution;
	bool visibleDarkSurface = cloudVisibleSurfaceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) || cloudVisibleSurfaceIsGik(visibleHitType);
	bool strongBouncedSource = cloudDirectNeeSourceIsCeiling(sourceHitType, sourceObjectID, sourceNormal, sourcePosition) || cloudDirectNeeSourceIsWall(sourceHitType, sourceObjectID, sourceNormal);
	if (!visibleDarkSurface || !strongBouncedSource) return contribution;
	float cap = max(0.0, uCloudDarkSurfaceCleanupLuma);
	if (cap <= 0.0) return contribution;
	float luma = cloudMisProbeLuma(contribution);
	if (luma <= cap || luma <= 1e-9) return contribution;
	return contribution * (cap / luma);
}
vec3 cloudSameSurfaceDarkFillContribution(vec3 contribution, int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, int diffuseCountArg)
{
	if (uCloudSameSurfaceDarkFillMode < 0.5) return contribution;
	if (diffuseCountArg < 1) return contribution;
	bool visibleFloor = cloudVisibleSurfaceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	bool visibleGik = cloudVisibleSurfaceIsGik(visibleHitType);
	if (!visibleFloor && !visibleGik) return contribution;
	float targetLuma = (visibleFloor ? uCloudSameSurfaceDarkFillFloorLuma : uCloudSameSurfaceDarkFillGikLuma) * 1.25;
	if (targetLuma <= 0.0) return contribution;
	float luma = cloudMisProbeLuma(contribution);
	if (luma <= 1e-9 || luma >= targetLuma) return contribution;
	float maxSamples = max(1.0, uCloudSameSurfaceDarkFillMaxSamples);
	float fadeSamples = max(1.0, maxSamples);
	float sampleFade = 1.0 - smoothstep(maxSamples, maxSamples + fadeSamples, uSampleCounter);
	float fillStrength = clamp(uCloudSameSurfaceDarkFillStrength, 0.0, 1.0) * sampleFade;
	if (fillStrength <= 0.0) return contribution;
	float filledLuma = mix(luma, targetLuma, fillStrength);
	return contribution * (filledLuma / luma);
}
bool cloudMisWeightProbeForcedBsdfHit(vec3 x, vec3 nl, vec3 sourceMask, out vec3 encoded)
;
float pdfNeeForLight(vec3 x, vec3 lightPoint, vec3 lightNormal, float lightArea, float selectPdfArg)
{
	// 給定 shade-point x 與 emitter 表面樣本 (lightPoint, lightNormal, lightArea)，
	// 回傳 uniform light-pick (selectPdfArg) 下的 solid-angle PDF。
	//   p_ω = selectPdfArg · dist² / (cos_light · A_face)
	// R3-6.5 S2：selectPdfArg 由 caller 傳入──legacy 11-pick 傳 1.0/11.0；dynamic pool 傳 1.0/uActiveLightCount。
	// U4：lightArea / cosLight 加 1e-6 / 1e-12 denom 守門防 NaN / Inf。
	vec3 toLight = lightPoint - x;
	float dist2 = max(dot(toLight, toLight), 1e-4);
	float cosLight = max(1e-6, dot(-normalize(toLight), lightNormal));
	float safeArea = max(lightArea, 1e-6);
	return selectPdfArg * (dist2 / (cosLight * safeArea));
}

int sampleActiveLightSlot(float randomValue)
{
	if (uActiveLightCount <= 0)
		return 0;
	if (uR72LightImportanceSamplingMode < 0.5)
		return clamp(int(floor(randomValue * float(uActiveLightCount))), 0, uActiveLightCount - 1);
	for (int i = 0; i < 11; i++)
	{
		if (i >= uActiveLightCount)
			break;
		if (randomValue <= uActiveLightPickCdf[i])
			return i;
	}
	return uActiveLightCount - 1;
}

float activeLightPickPdfByIndex(int lightIndex)
{
	if (uActiveLightCount <= 0)
		return 1e-6;
	if (uR72LightImportanceSamplingMode < 0.5)
		return 1.0 / float(uActiveLightCount);
	for (int i = 0; i < 11; i++)
	{
		if (i >= uActiveLightCount)
			break;
		if (uActiveLightIndex[i] == lightIndex)
			return max(uActiveLightPickPdf[i], 1e-6);
	}
	return 1e-6;
}
// R6-3 Phase 1C：Cloud 鋁槽 1/4 圓弧 diffuser。
// 16mm × 16mm 外接正方形對應完整 1/4 pizza，發光弧面半徑 16mm。
// uCloudFaceArea = 0.016 × rodLength；真實弧面 A_arc = (π/2) × uCloudFaceArea。
const float CLOUD_ARC_RADIUS = 0.016;
const float CLOUD_ARC_AREA_SCALE = 1.5707963267948966;
const float CLOUD_ARC_THETA_MAX = 1.5707963267948966;
const float CLOUD_THETA_IMPORTANCE_SHADER_AB_PROTECTED_FLOOR = 0.5;
const float CLOUD_THETA_IMPORTANCE_UNIFORM_BIN_PDF = 0.125;

vec3 cloudOutAxis(int rodIdx)
{
	if (rodIdx == 0) return vec3( 1.0, 0.0, 0.0);
	if (rodIdx == 1) return vec3(-1.0, 0.0, 0.0);
	if (rodIdx == 2) return vec3( 0.0, 0.0, 1.0);
	return vec3(0.0, 0.0, -1.0);
}

vec3 cloudLongAxis(int rodIdx)
{
	return (rodIdx < 2) ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
}

float cloudLongHalf(int rodIdx, vec3 rodHalf)
{
	return (rodIdx < 2) ? rodHalf.z : rodHalf.x;
}

float cloudCrossHalf(int rodIdx, vec3 rodHalf)
{
	return (rodIdx < 2) ? rodHalf.x : rodHalf.z;
}

float cloudArcRadius(int rodIdx, vec3 rodHalf)
{
	return max(CLOUD_ARC_RADIUS, cloudCrossHalf(rodIdx, rodHalf) + rodHalf.y);
}

vec3 cloudArcCenter(int rodIdx, vec3 rodCenter, vec3 rodHalf)
{
	return rodCenter - cloudOutAxis(rodIdx) * cloudCrossHalf(rodIdx, rodHalf) - vec3(0.0, rodHalf.y, 0.0);
}

vec3 cloudArcNormal(int rodIdx, float theta)
{
	return normalize(cloudOutAxis(rodIdx) * cos(theta) + vec3(0.0, sin(theta), 0.0));
}

vec3 cloudArcEmissionNormal(int rodIdx, float theta)
{
	return -cloudArcNormal(rodIdx, theta);
}

vec3 cloudArcRenderNormal(int rodIdx, float theta)
{
	return (uCloudVisibilityProbeMode > 0) ? cloudArcEmissionNormal(rodIdx, theta) : cloudArcNormal(rodIdx, theta);
}

int cloudVisibilityProbeThetaBin(float theta)
{
	int binCount = max(uCloudVisibilityProbeThetaBinCount, 1);
	float theta01 = clamp(theta / CLOUD_ARC_THETA_MAX, 0.0, 0.999999);
	return int(floor(theta01 * float(binCount)));
}

float cloudThetaImportancePdfForBin(int thetaBin)
{
	int bin = clamp(thetaBin, 0, 7);
	if (bin == 0) return 0.182214;
	if (bin == 1) return 0.164555;
	if (bin == 2) return 0.139731;
	if (bin == 3) return 0.124376;
	if (bin == 4) return 0.108893;
	if (bin == 5) return 0.094690;
	if (bin == 6) return 0.091107;
	return 0.094434;
}

float cloudThetaImportancePdfCompensationForBin(int thetaBin)
{
	return CLOUD_THETA_IMPORTANCE_UNIFORM_BIN_PDF / max(cloudThetaImportancePdfForBin(thetaBin), 1e-6);
}

float cloudThetaImportanceSampleTheta(float u, out int thetaBin, out float pdfCompensationMultiplier)
{
	float x = clamp(u, 0.0, 0.999999);
	float prev = 0.0;
	float next = 0.182214;
	thetaBin = 0;
	if (x >= next) { prev = next; next = 0.346769; thetaBin = 1; }
	if (x >= next) { prev = next; next = 0.486500; thetaBin = 2; }
	if (x >= next) { prev = next; next = 0.610876; thetaBin = 3; }
	if (x >= next) { prev = next; next = 0.719769; thetaBin = 4; }
	if (x >= next) { prev = next; next = 0.814459; thetaBin = 5; }
	if (x >= next) { prev = next; next = 0.905566; thetaBin = 6; }
	if (x >= next) { prev = next; next = 1.0; thetaBin = 7; }
	float binPdf = max(next - prev, 1e-6);
	float localU = clamp((x - prev) / binPdf, 0.0, 0.999999);
	pdfCompensationMultiplier = cloudThetaImportancePdfCompensationForBin(thetaBin);
	return (float(thetaBin) + localU) * (CLOUD_ARC_THETA_MAX * CLOUD_THETA_IMPORTANCE_UNIFORM_BIN_PDF);
}

int cloudThetaImportanceBinFromNormal(int rodIdx, vec3 normal)
{
	vec3 outAxis = cloudOutAxis(rodIdx);
	float outPart = max(0.0, dot(normalize(normal), outAxis));
	float upPart = max(0.0, normalize(normal).y);
	float theta = clamp(atan(upPart, outPart), 0.0, CLOUD_ARC_THETA_MAX * 0.999999);
	return int(floor(clamp(theta / CLOUD_ARC_THETA_MAX, 0.0, 0.999999) * 8.0));
}

float cloudThetaImportanceEffectiveArcArea(float cloudArcArea, float pdfCompensationMultiplier)
{
	if (uCloudThetaImportanceShaderABMode <= 0)
		return cloudArcArea;
	return cloudArcArea * pdfCompensationMultiplier;
}

float cloudThetaImportanceEffectiveArcAreaForNormal(int rodIdx, float cloudArcArea, vec3 normal)
{
	if (uCloudThetaImportanceShaderABMode <= 0)
		return cloudArcArea;
	int thetaBin = cloudThetaImportanceBinFromNormal(rodIdx, normal);
	return cloudArcArea * cloudThetaImportancePdfCompensationForBin(thetaBin);
}

bool cloudMisWeightProbeForcedBsdfHit(vec3 x, vec3 nl, vec3 sourceMask, out vec3 encoded)
{
	encoded = vec3(0.0);
	if (uCloudMisWeightProbeMode < 10 || uCloudMisWeightProbeMode > 13)
		return false;
	if (uCloudLightEnabled < 0.5 || uActiveLightCount <= 0)
		return true;

	float bestScore = 0.0;
	int bestRod = -1;
	vec3 bestTarget = vec3(0.0);
	vec3 bestNormal = vec3(0.0);
	vec3 bestDir = vec3(0.0);

	for (int rodIdx = 0; rodIdx < 4; rodIdx++)
	{
		vec3 rodCenter = uCloudRodCenter[rodIdx];
		vec3 rodHalf = uCloudRodHalfExtent[rodIdx];
		vec3 arcCenter = cloudArcCenter(rodIdx, rodCenter, rodHalf);
		vec3 longAxis = cloudLongAxis(rodIdx);
		float radius = cloudArcRadius(rodIdx, rodHalf);
		float theta = CLOUD_ARC_THETA_MAX * 0.5;
		vec3 localNormal = cloudArcNormal(rodIdx, theta);
		vec3 target = arcCenter + longAxis * 0.0 + localNormal * radius;
		vec3 toCloud = target - x;
		float dist2 = max(dot(toCloud, toCloud), 1e-4);
		vec3 dir = toCloud * inversesqrt(dist2);
		float sourceCos = max(0.0, dot(nl, dir));
		float cloudCos = max(0.0, dot(-dir, localNormal));
		float score = sourceCos * cloudCos / dist2;
		if (score > bestScore)
		{
			bestScore = score;
			bestRod = rodIdx;
			bestTarget = target;
			bestNormal = localNormal;
			bestDir = dir;
		}
	}

	if (bestRod < 0 || bestScore <= 1e-10)
		return true;

	float cloudArcArea = uCloudFaceArea[bestRod] * CLOUD_ARC_AREA_SCALE;
	float reverseCloudPdfArea = cloudThetaImportanceEffectiveArcAreaForNormal(bestRod, cloudArcArea, bestNormal);
	float pBsdf = cosWeightedPdf(bestDir, nl);
	float pNeeReverse = pdfNeeForLight(x, bestTarget, bestNormal, reverseCloudPdfArea, activeLightPickPdfByIndex(bestRod + 7));
	float wBsdf = misPowerWeight(pBsdf, pNeeReverse);
	vec3 emission = min(uCloudEmission[bestRod], vec3(uEmissiveClamp));
	vec3 weightedContribution = min(sourceMask * emission * wBsdf, vec3(uEmissiveClamp));
	vec3 unweightedContribution = min(sourceMask * emission, vec3(uEmissiveClamp));

	if (uCloudMisWeightProbeMode == 10)
		encoded = cloudMisWeightProbeBsdfHitContributionSentinel();
	if (uCloudMisWeightProbeMode == 11)
		encoded = cloudMisWeightProbeContribution(weightedContribution, unweightedContribution);
	if (uCloudMisWeightProbeMode == 12)
		encoded = vec3(pNeeReverse, pBsdf, 1.0);
	if (uCloudMisWeightProbeMode == 13)
		encoded = vec3(wBsdf, 1.0, 0.0);
	return true;
}

bool cloudVisibilityProbeThetaBinMatches(int thetaBin)
{
	if (uCloudVisibilityProbeThetaBin < 0)
		return true;
	int binCount = max(uCloudVisibilityProbeThetaBinCount, 1);
	int selectedBin = clamp(uCloudVisibilityProbeThetaBin, 0, binCount - 1);
	return thetaBin == selectedBin;
}

float CloudArcIntersect(int rodIdx, vec3 ro, vec3 rd, out vec3 normal)
{
	vec3 rodCenter = uCloudRodCenter[rodIdx];
	vec3 rodHalf = uCloudRodHalfExtent[rodIdx];
	vec3 outAxis = cloudOutAxis(rodIdx);
	vec3 longAxis = cloudLongAxis(rodIdx);
	vec3 arcCenter = cloudArcCenter(rodIdx, rodCenter, rodHalf);
	float radius = cloudArcRadius(rodIdx, rodHalf);
	float longHalf = cloudLongHalf(rodIdx, rodHalf);

	vec3 oc = ro - arcCenter;
	float ou = dot(oc, outAxis);
	float ov = oc.y;
	float du = dot(rd, outAxis);
	float dv = rd.y;
	float a = du * du + dv * dv;
	if (a < 1e-10) return INFINITY;
	float b = 2.0 * (ou * du + ov * dv);
	float c = ou * ou + ov * ov - radius * radius;
	float disc = b * b - 4.0 * a * c;
	if (disc < 0.0) return INFINITY;

	float sq = sqrt(disc);
	float bestT = INFINITY;
	for (int i = 0; i < 2; i++)
	{
		float tCand = (i == 0) ? ((-b - sq) / (2.0 * a)) : ((-b + sq) / (2.0 * a));
		if (tCand > 0.0 && tCand < bestT)
		{
			vec3 hit = oc + rd * tCand;
			float longCoord = dot(hit, longAxis);
			float outCoord = dot(hit, outAxis);
			float upCoord = hit.y;
			if (abs(longCoord) <= longHalf && outCoord >= -1e-5 && upCoord >= -1e-5)
			{
				bestT = tCand;
				normal = normalize(outAxis * outCoord + vec3(0.0, upCoord, 0.0));
			}
		}
	}
	return bestT;
}

bool cloudVisibilityProbeMatches(int pickedIdx)
{
	if (uCloudVisibilityProbeMode <= 0)
		return false;
	if (pickedIdx < 7 || pickedIdx > 10)
		return false;
	int rodIdx = pickedIdx - 7;
	return (uCloudVisibilityProbeRod < 0 || uCloudVisibilityProbeRod == rodIdx);
}

bool cloudVisibilityProbeHasContribution(vec3 eventMask)
{
	return max(max(eventMask.r, eventMask.g), eventMask.b) > 1e-7;
}

vec3 cloudVisibilityProbeVisibleColor(int pickedIdx, vec3 eventMask)
{
	int rodIdx = clamp(pickedIdx - 7, 0, 3);
	float rodCue = (float(rodIdx) + 1.0) * 0.18;
	float contributionCue = clamp(log(1.0 + max(max(eventMask.r, eventMask.g), eventMask.b)) * 0.25, 0.0, 0.25);
	return vec3(0.0, 1.0, rodCue + contributionCue);
}

vec3 cloudVisibilityProbeBlockedColor(int pickedIdx)
{
	int rodIdx = clamp(pickedIdx - 7, 0, 3);
	float rodCue = (float(rodIdx) + 1.0) * 0.18;
	return vec3(1.0, 0.0, rodCue);
}

const int CLOUD_PROBE_CLASS_ZERO_CONTRIBUTION = 0;
const int CLOUD_PROBE_CLASS_VISIBLE = 1;
const int CLOUD_PROBE_CLASS_WRONG_CLOUD_ROD = 2;
const int CLOUD_PROBE_CLASS_CLOUD_ALUMINIUM = 3;
const int CLOUD_PROBE_CLASS_CLOUD_GIK_PANEL = 4;
const int CLOUD_PROBE_CLASS_SAME_ACOUSTIC_PANEL = 5;
const int CLOUD_PROBE_CLASS_NORTH_ACOUSTIC_PANEL = 6;
const int CLOUD_PROBE_CLASS_EAST_ACOUSTIC_PANEL = 7;
const int CLOUD_PROBE_CLASS_WEST_ACOUSTIC_PANEL = 8;
const int CLOUD_PROBE_CLASS_ROOM_SHELL = 9;
const int CLOUD_PROBE_CLASS_OTHER_SCENE_OBJECT = 10;
const int CLOUD_PROBE_CLASS_MISS = 11;
const int CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK = 12;
const int CLOUD_PROBE_CLASS_ZERO_SOURCE_FACING = 13;
const int CLOUD_PROBE_CLASS_ZERO_CLOUD_FACING = 14;
const int CLOUD_PROBE_CLASS_ZERO_FACING_BOTH = 15;
const int CLOUD_PROBE_CLASS_ZERO_OTHER = 16;

bool cloudVisibilityProbeIsZeroContributionClass(int blockerClass)
{
	return blockerClass == CLOUD_PROBE_CLASS_ZERO_CONTRIBUTION ||
		blockerClass == CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK ||
		blockerClass == CLOUD_PROBE_CLASS_ZERO_SOURCE_FACING ||
		blockerClass == CLOUD_PROBE_CLASS_ZERO_CLOUD_FACING ||
		blockerClass == CLOUD_PROBE_CLASS_ZERO_FACING_BOTH ||
		blockerClass == CLOUD_PROBE_CLASS_ZERO_OTHER;
}

int cloudVisibilityProbeBlockerClass(int pickedIdx, float sourceObjectID, int sourceHitType)
{
	if (hitType == CLOUD_LIGHT)
	{
		int cloudRodIdx = int(hitObjectID - uCloudObjIdBase + 0.5);
		cloudRodIdx = clamp(cloudRodIdx, 0, 3);
		return (pickedIdx == cloudRodIdx + 7) ? CLOUD_PROBE_CLASS_VISIBLE : CLOUD_PROBE_CLASS_WRONG_CLOUD_ROD;
	}

	if (hitObjectID >= uCloudObjIdBase + 4.0 && hitObjectID <= uCloudObjIdBase + 11.0)
		return CLOUD_PROBE_CLASS_CLOUD_ALUMINIUM;

	if (hitObjectID >= 50.0 && hitObjectID <= 55.0)
		return CLOUD_PROBE_CLASS_CLOUD_GIK_PANEL;

	if (hitType == ACOUSTIC_PANEL)
	{
		if (sourceHitType == ACOUSTIC_PANEL && abs(hitObjectID - sourceObjectID) < 0.5)
			return CLOUD_PROBE_CLASS_SAME_ACOUSTIC_PANEL;
		if (hitObjectID >= 84.0 && hitObjectID <= 86.0)
			return CLOUD_PROBE_CLASS_NORTH_ACOUSTIC_PANEL;
		if (hitObjectID >= 87.0 && hitObjectID <= 89.0)
			return CLOUD_PROBE_CLASS_EAST_ACOUSTIC_PANEL;
		if (hitObjectID >= 90.0 && hitObjectID <= 92.0)
			return CLOUD_PROBE_CLASS_WEST_ACOUSTIC_PANEL;
	}

	if (hitObjectID == 1.0)
		return CLOUD_PROBE_CLASS_ROOM_SHELL;

	return CLOUD_PROBE_CLASS_OTHER_SCENE_OBJECT;
}

vec3 cloudVisibilityProbeClassColor(int blockerClass)
{
	if (blockerClass == CLOUD_PROBE_CLASS_ZERO_CONTRIBUTION) return vec3(1.0, 1.0, 1.0);
	if (blockerClass == CLOUD_PROBE_CLASS_VISIBLE) return vec3(0.0, 1.0, 0.0);
	if (blockerClass == CLOUD_PROBE_CLASS_WRONG_CLOUD_ROD) return vec3(0.0, 0.0, 1.0);
	if (blockerClass == CLOUD_PROBE_CLASS_CLOUD_ALUMINIUM) return vec3(1.0, 1.0, 0.0);
	if (blockerClass == CLOUD_PROBE_CLASS_CLOUD_GIK_PANEL) return vec3(0.0, 1.0, 1.0);
	if (blockerClass == CLOUD_PROBE_CLASS_SAME_ACOUSTIC_PANEL) return vec3(0.0, 0.35, 0.0);
	if (blockerClass == CLOUD_PROBE_CLASS_NORTH_ACOUSTIC_PANEL) return vec3(0.45, 1.0, 0.45);
	if (blockerClass == CLOUD_PROBE_CLASS_EAST_ACOUSTIC_PANEL) return vec3(0.25, 0.8, 0.25);
	if (blockerClass == CLOUD_PROBE_CLASS_WEST_ACOUSTIC_PANEL) return vec3(0.65, 1.0, 0.65);
	if (blockerClass == CLOUD_PROBE_CLASS_ROOM_SHELL) return vec3(1.0, 0.0, 1.0);
	if (blockerClass == CLOUD_PROBE_CLASS_OTHER_SCENE_OBJECT) return vec3(1.0, 0.5, 0.0);
	if (blockerClass == CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK) return vec3(0.15, 0.9, 0.15);
	if (blockerClass == CLOUD_PROBE_CLASS_ZERO_SOURCE_FACING) return vec3(0.4, 1.0, 0.0);
	if (blockerClass == CLOUD_PROBE_CLASS_ZERO_CLOUD_FACING) return vec3(0.0, 0.85, 0.45);
	if (blockerClass == CLOUD_PROBE_CLASS_ZERO_FACING_BOTH) return vec3(0.65, 1.0, 0.0);
	if (blockerClass == CLOUD_PROBE_CLASS_ZERO_OTHER) return vec3(0.0, 0.55, 0.2);
	return vec3(1.0, 0.0, 0.0);
}

vec3 cloudVisibilityProbeSelectedClassColor(int blockerClass, int thetaBin)
{
	if (!cloudVisibilityProbeThetaBinMatches(thetaBin))
		return vec3(0.0);
	if (uCloudVisibilityProbeClass < 0)
		return cloudVisibilityProbeClassColor(blockerClass);
	bool selected = (uCloudVisibilityProbeClass == CLOUD_PROBE_CLASS_ZERO_CONTRIBUTION)
		? cloudVisibilityProbeIsZeroContributionClass(blockerClass)
		: (blockerClass == uCloudVisibilityProbeClass);
	return selected ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
}

vec3 cloudVisibilityProbeFacingDiagnosticColor(vec3 facingDiagnostic, int thetaBin)
{
	if (!cloudVisibilityProbeThetaBinMatches(thetaBin))
		return vec3(0.0);
	return facingDiagnostic;
}


// R3-6.5 S2：動態版 NEE pick。slot→real idx 透過 LUT 轉譯，
// 並以 uActiveLightCount 取代硬編碼 11。uActiveLightCount==0 時 black-out 回傳 nl（避免 ÷0）。
// selectPdf = 1 / uActiveLightCount；5 個分支（idx==0 / <=4 / <=6 / 7-10）。
vec3 sampleStochasticLightDynamic(vec3 x, vec3 nl, Quad ql0, out vec3 throughput, out float pdfNeeOmega, out int pickedIdx, out int zeroContributionClass, out int probeThetaBin, out vec3 facingDiagnostic)
{
	zeroContributionClass = CLOUD_PROBE_CLASS_ZERO_OTHER;
	probeThetaBin = -1;
	facingDiagnostic = vec3(0.0);
	// R3-6.5 S2.5：DCE runtime-impossible guard。
	// uR3ProbeSentinel runtime 恆 1.0；手動設 -200 觸發 sentinel 分支驗證 DCE 未 strip。
	if (uR3ProbeSentinel < -100.0) {
		pickedIdx = -42;
		throughput = vec3(0);
		pdfNeeOmega = 1e-6;
		return nl;
	}
	if (uActiveLightCount <= 0) {
		throughput = vec3(0);
		pdfNeeOmega = 1e-6;
		pickedIdx = -1;
		return nl;
	}
	int slot = sampleActiveLightSlot(rng());
	int neeIdx = uActiveLightIndex[slot];
	float selectPdf = uActiveLightPickPdf[slot];
	selectPdf = max(selectPdf, 1e-6);
	pickedIdx = neeIdx;       // R3-6：observability + MIS reverse-NEE 用
	pdfNeeOmega = 0.0;        // 預設；每分支覆寫
	if (neeIdx == 0)
	{
		float w;
		vec3 dir = sampleQuadLight(x, nl, ql0, w);
		throughput = vec3(w / selectPdf);
		// R3-6 idx 0：ceiling quadLight NEE solid-angle PDF。sampleQuadLight 已處理 dist²/cos_light/A 積分；
		// 對 MIS 用 solid-angle 一致化公式 p_ω = selectPdf · dist²/(cos_light · A)，A = 1.44 m² (ceilingLampQuad)
		//   emitter 為向下矩形光（normal=-y），向上 shade point 之 cos_light = dir.y (dir 指向 emitter)
		vec3 lampCenter = (ql0.v0 + ql0.v2) * 0.5;
		vec3 lampExt1 = ql0.v1 - ql0.v0;
		vec3 lampExt2 = ql0.v3 - ql0.v0;
		float lampArea = length(lampExt1) * length(lampExt2);
		pdfNeeOmega = pdfNeeForLight(x, lampCenter, ql0.normal, lampArea, selectPdf);
		return dir;
	}
	if (neeIdx <= 4)
	{
		// R3-5b fix07：Track off 守門。checkbox 關 uTrackLightEnabled=0 僅擋 primary-hit emission，
		// NEE pool 若無此 gate，uTrackEmission 仍非零 → shadow ray 把 warm(3000K) 能量打到牆 → 光斑殘留。
		// 對齊 L263 Cloud gate 同構。
		if (uTrackLightEnabled < 0.5) {
			throughput = vec3(0);
			pdfNeeOmega = 1e-6;  // U4：守門 denom 非 NaN；Track 不在 R3-6 MIS scope 故值不影響 heuristic
			return nl;
		}
		int li = neeIdx - 1;
		// R3-4 fix04：uTrackLampPos 為支架底（pivot），非發光面中心。
		// 發光底圓面在 pa + lampDir * 0.135（與 SceneIntersect 圓柱長度一致）。
		// 原誤射 pivot → shadow ray grazing 或命中 housing 頂蓋（faceAlign=-1）→ NEE 必 miss → 4 盞軌道燈貢獻實質歸零。
		vec3 target = uTrackLampPos[li] + uTrackLampDir[li] * 0.135;
		vec3 toLight = target - x;
		float dist2 = max(dot(toLight, toLight), 1e-4);     // firefly clamp（近距離 distance²→0 防呆）
		vec3 ldir = toLight * inversesqrt(dist2);
		float cos_light = max(0.0, dot(-ldir, uTrackLampDir[li]));
		float falloff = smoothstep(uTrackBeamCos[li].y, uTrackBeamCos[li].x, cos_light);
		vec3 emit = uTrackEmission[li] * falloff;           // emit 於此 baked → TRACK_LIGHT branch sampleLight 路徑直接 accumCol += mask
		float geom = max(0.0, dot(nl, ldir)) * cos_light / dist2;
		// R3-4 fix07：disk-area integrand（× A）。JS 端 L = Φ/(K·π·A) 為 radiance，shader NEE 需乘發光面積還原 flux contribution。
		// fix05 throughput-50 clamp 移除：上游量綱修正後 emit≈700（非 8.4e5）、× A≈2.83e-3 × geom × /0.2 合計 O(1)，不再 firefly。
		throughput = emit * geom * TRACK_LAMP_EMITTER_AREA / selectPdf;
		// R3-6：Track 非 MIS scope（cone falloff R3-7 再擴）；pdfNeeOmega 留作 observability，不入 heuristic。
		pdfNeeOmega = pdfNeeForLight(x, target, -uTrackLampDir[li], TRACK_LAMP_EMITTER_AREA, selectPdf);
		return ldir;
	}
	if (neeIdx <= 6)
	{
		// R3-5b fix07：Wide off 守門。同理於 Track gate；cool(6500K) 能量經 NEE 漏至牆面 → 冷光斑殘留。
		if (uWideTrackLightEnabled < 0.5) {
			throughput = vec3(0);
			pdfNeeOmega = 1e-6;
			return nl;
		}
		// R3-5a：neeIdx == 5 / 6 → TrackWide 2 盞（slot 5=南、slot 6=北；索引對齊 JS uTrackWideLampPos 順序）
		int wi = neeIdx - 5;
		// 發光底圓面中心 = 支架底 + lampDir * 0.072（與 SceneIntersect 圓柱長度一致）
		vec3 wideTarget = uTrackWideLampPos[wi] + uTrackWideLampDir[wi] * 0.072;
		vec3 wideTo = wideTarget - x;
		float wideDist2 = max(dot(wideTo, wideTo), 1e-4);
		vec3 wideDir = wideTo * inversesqrt(wideDist2);
		float wideCosLight = max(0.0, dot(-wideDir, uTrackWideLampDir[wi]));
		float wideFalloff = smoothstep(uTrackWideBeamCos[wi].y, uTrackWideBeamCos[wi].x, wideCosLight);
		vec3 wideEmit = uTrackWideEmission[wi] * wideFalloff;
		float wideGeom = max(0.0, dot(nl, wideDir)) * wideCosLight / wideDist2;
		// disk-area integrand，對齊 L = Φ/(K·π·A)（JS computeTrackWideRadiance）；emitter A = π·0.05² ≈ 7.85e-3 m²
		throughput = wideEmit * wideGeom * TRACK_WIDE_LAMP_EMITTER_AREA / selectPdf;
		pdfNeeOmega = pdfNeeForLight(x, wideTarget, -uTrackWideLampDir[wi], TRACK_WIDE_LAMP_EMITTER_AREA, selectPdf);
		return wideDir;
	}
	// R6-3 Phase 1C: neeIdx 7-10 → Cloud rod 0-3 analytic 1/4 arc。
	// R3-5b fix01：Cloud-off 守門。cull 時幾何消失但 uCloudEmission 仍非零，
	// 若無此 gate，shadow ray 會穿透 Cloud 位置命中 ceilingLampQuad（LIGHT 分支 L898）→ 雙計爆 firefly。
	if (uCloudLightEnabled < 0.5) {
		throughput = vec3(0);
		pdfNeeOmega = 1e-6;
		return nl;
	}
	int rodIdx = neeIdx - 7;
	vec3 rodCenter = uCloudRodCenter[rodIdx];
	vec3 rodHalf = uCloudRodHalfExtent[rodIdx];
	vec3 longAxis = cloudLongAxis(rodIdx);
	vec3 arcCenter = cloudArcCenter(rodIdx, rodCenter, rodHalf);
	float radius = cloudArcRadius(rodIdx, rodHalf);
	float longHalf = cloudLongHalf(rodIdx, rodHalf);
	float cloudArcArea = uCloudFaceArea[rodIdx] * CLOUD_ARC_AREA_SCALE;

	float longOffset = (rng() * 2.0 - 1.0) * longHalf;
	float thetaRandom = rng();
	float thetaPdfCompensationMultiplier = 1.0;
	int sampledThetaBin = -1;
	float theta = (uCloudThetaImportanceShaderABMode > 0)
		? cloudThetaImportanceSampleTheta(thetaRandom, sampledThetaBin, thetaPdfCompensationMultiplier)
		: thetaRandom * CLOUD_ARC_THETA_MAX;
	probeThetaBin = cloudVisibilityProbeThetaBin(theta);
	vec3 localNormal = cloudArcNormal(rodIdx, theta);
	// R6-3 Phase2: keep render-energy and probe-classification Cloud normals visible side by side.
	vec3 normalEmissionNormal = cloudArcNormal(rodIdx, theta);
	vec3 probeEmissionNormal = cloudArcEmissionNormal(rodIdx, theta);
	vec3 emissionNormal = cloudArcRenderNormal(rodIdx, theta);
	vec3 cloudTarget = arcCenter + longAxis * longOffset + localNormal * radius;
	vec3 cloudTo = cloudTarget - x;
	float cloudDist2 = max(dot(cloudTo, cloudTo), 1e-4);
	vec3 cloudDir = cloudTo * inversesqrt(cloudDist2);
	float cloudSourceCos = max(0.0, dot(nl, cloudDir));
	float normalCloudCos = max(0.0, dot(-cloudDir, normalEmissionNormal));
	float probeCloudCos = max(0.0, dot(-cloudDir, probeEmissionNormal));
	float cloudCosLight = max(0.0, dot(-cloudDir, emissionNormal));
	facingDiagnostic = vec3(
		(cloudSourceCos <= 1e-7) ? 1.0 : 0.0,
		(normalCloudCos <= 1e-7) ? 1.0 : 0.0,
		(probeCloudCos <= 1e-7) ? 1.0 : 0.0
	);
	if (cloudSourceCos <= 1e-7 && cloudCosLight <= 1e-7)
		zeroContributionClass = CLOUD_PROBE_CLASS_ZERO_FACING_BOTH;
	else if (cloudSourceCos <= 1e-7)
		zeroContributionClass = CLOUD_PROBE_CLASS_ZERO_SOURCE_FACING;
	else if (cloudCosLight <= 1e-7)
		zeroContributionClass = CLOUD_PROBE_CLASS_ZERO_CLOUD_FACING;
	float cloudGeom = cloudSourceCos * cloudCosLight / cloudDist2;
	vec3 cloudEmit = uCloudEmission[rodIdx];
	if (max(max(cloudEmit.r, cloudEmit.g), cloudEmit.b) <= 1e-7)
		zeroContributionClass = CLOUD_PROBE_CLASS_ZERO_OTHER;
	float cloudPdfArea = cloudThetaImportanceEffectiveArcArea(cloudArcArea, thetaPdfCompensationMultiplier);
	throughput = cloudEmit * cloudGeom * cloudPdfArea / selectPdf;
	pdfNeeOmega = pdfNeeForLight(x, cloudTarget, emissionNormal, cloudPdfArea, selectPdf);
	return cloudDir;
}

// 世界空間垂直圓柱交叉（ISO-PUCK 用）
float CylinderIntersect(vec3 center, float radius, float halfH, vec3 ro, vec3 rd, out vec3 normal)
{
	vec3 oc = ro - center;
	float t = INFINITY;

	// 側面 (XZ 平面圓)
	float a = rd.x * rd.x + rd.z * rd.z;
	float b = 2.0 * (oc.x * rd.x + oc.z * rd.z);
	float c = oc.x * oc.x + oc.z * oc.z - radius * radius;
	float disc = b * b - 4.0 * a * c;

	if (disc >= 0.0)
	{
		float sq = sqrt(disc);
		float t0 = (-b - sq) / (2.0 * a);
		if (t0 > 0.0)
		{
			float y = oc.y + t0 * rd.y;
			if (abs(y) <= halfH)
			{
				t = t0;
				vec3 hit = oc + t0 * rd;
				normal = normalize(vec3(hit.x, 0, hit.z));
				return t;
			}
		}
	}

	// 頂蓋 / 底蓋
	if (abs(rd.y) > 0.0001)
	{
		float tTop = (halfH - oc.y) / rd.y;
		if (tTop > 0.0 && tTop < t)
		{
			vec2 p = oc.xz + tTop * rd.xz;
			if (dot(p, p) <= radius * radius)
			{ t = tTop; normal = vec3(0, 1, 0); }
		}
		float tBot = (-halfH - oc.y) / rd.y;
		if (tBot > 0.0 && tBot < t)
		{
			vec2 p = oc.xz + tBot * rd.xz;
			if (dot(p, p) <= radius * radius)
			{ t = tBot; normal = vec3(0, -1, 0); }
		}
	}

	return t;
}

// 物件空間 stadium 截面支柱交叉（短邊圓弧）
// 分解為中央 box ∪ 兩端半圓柱
float StadiumPillarIntersect(vec3 halfBox, vec3 ro, vec3 rd, out vec3 normal)
{
	float r = halfBox.x; // 短邊半徑 = X half
	float innerZ = halfBox.z - r; // 去掉圓弧部分的 Z
	float t = INFINITY;
	vec3 n;
	int dummy;

	// 中央矩形部分
	float tBox = BoxIntersect(vec3(-r, -halfBox.y, -innerZ), vec3(r, halfBox.y, innerZ), ro, rd, n, dummy);
	if (tBox > 0.0 && tBox < t) { t = tBox; normal = n; }

	// Z 正端半圓柱 (軸沿 Y，圓心在 z=+innerZ)
	vec3 oc1 = ro - vec3(0, 0, innerZ);
	float a1 = rd.x * rd.x;
	float b1 = 2.0 * oc1.x * rd.x;
	float c1 = oc1.x * oc1.x + oc1.z * oc1.z - r * r;

	// 這裡要用完整 XZ 圓：x² + (z-innerZ)² ≤ r²
	a1 = rd.x * rd.x + rd.z * rd.z;
	b1 = 2.0 * (oc1.x * rd.x + oc1.z * rd.z);
	c1 = oc1.x * oc1.x + oc1.z * oc1.z - r * r;
	float disc1 = b1 * b1 - 4.0 * a1 * c1;
	if (disc1 >= 0.0)
	{
		float sq = sqrt(disc1);
		float t0 = (-b1 - sq) / (2.0 * a1);
		if (t0 > 0.0 && t0 < t)
		{
			float y = ro.y + t0 * rd.y;
			float z = ro.z + t0 * rd.z;
			if (abs(y) <= halfBox.y && z >= innerZ)
			{
				t = t0;
				vec3 hit = oc1 + t0 * rd;
				normal = normalize(vec3(hit.x, 0, hit.z));
			}
		}
	}

	// Z 負端半圓柱
	vec3 oc2 = ro - vec3(0, 0, -innerZ);
	float a2 = rd.x * rd.x + rd.z * rd.z;
	float b2 = 2.0 * (oc2.x * rd.x + oc2.z * rd.z);
	float c2 = oc2.x * oc2.x + oc2.z * oc2.z - r * r;
	float disc2 = b2 * b2 - 4.0 * a2 * c2;
	if (disc2 >= 0.0)
	{
		float sq = sqrt(disc2);
		float t0 = (-b2 - sq) / (2.0 * a2);
		if (t0 > 0.0 && t0 < t)
		{
			float y = ro.y + t0 * rd.y;
			float z = ro.z + t0 * rd.z;
			if (abs(y) <= halfBox.y && z <= -innerZ)
			{
				t = t0;
				vec3 hit = oc2 + t0 * rd;
				normal = normalize(vec3(hit.x, 0, hit.z));
			}
		}
	}

	// 頂蓋 / 底蓋 (stadium 形狀的 cap)
	if (abs(rd.y) > 0.0001)
	{
		for (int s = 0; s < 2; s++)
		{
			float sign_y = (s == 0) ? 1.0 : -1.0;
			float tCap = (sign_y * halfBox.y - ro.y) / rd.y;
			if (tCap > 0.0 && tCap < t)
			{
				float hx = ro.x + tCap * rd.x;
				float hz = ro.z + tCap * rd.z;
				float cz = clamp(hz, -innerZ, innerZ);
				if (hx * hx + (hz - cz) * (hz - cz) <= r * r)
				{
					t = tCap;
					normal = vec3(0, sign_y, 0);
				}
			}
		}
	}

	return t;
}

// 任意方向線段圓柱交叉（R2-14 投射燈頭；含端蓋）
float CylinderSegmentIntersect(vec3 pa, vec3 pb, float r, vec3 ro, vec3 rd, out vec3 normal)
{
	vec3 ba = pb - pa;
	vec3 oc = ro - pa;
	float baba = dot(ba, ba);
	float bard = dot(ba, rd);
	float baoc = dot(ba, oc);
	float k2 = baba - bard * bard;
	float k1 = baba * dot(oc, rd) - baoc * bard;
	float k0 = baba * dot(oc, oc) - baoc * baoc - r * r * baba;
	float h = k1 * k1 - k2 * k0;
	if (h < 0.0) return INFINITY;
	h = sqrt(h);
	float tSide = (-k1 - h) / k2;
	float yS = baoc + tSide * bard;
	if (tSide > 0.001 && yS > 0.0 && yS < baba)
	{
		normal = (oc + tSide * rd - ba * yS / baba) / r;
		return tSide;
	}
	float yCap = (yS < 0.0) ? 0.0 : baba;
	float tCap = (yCap - baoc) / bard;
	if (tCap > 0.001 && abs(k1 + k2 * tCap) < h)
	{
		normal = ba * sign(yS) / sqrt(baba);
		return tCap;
	}
	return INFINITY;
}


// BVH node: 2 pixels per node in tBVHTexture
// pixel 2n:   [idPrimitive, min.x, min.y, min.z]  (idPrimitive >= 0 = leaf, -1 = inner)
// pixel 2n+1: [idRightChild, max.x, max.y, max.z]

void fetchBVHNode(int idx, out float idPrimitive, out vec3 minC, out float idRightChild, out vec3 maxC) {
	vec4 p0 = texelFetch(tBVHTexture, ivec2(idx * 2, 0), 0);
	vec4 p1 = texelFetch(tBVHTexture, ivec2(idx * 2 + 1, 0), 0);
	idPrimitive  = p0.x;
	minC         = p0.yzw;
	idRightChild = p1.x;
	maxC         = p1.yzw;
}

// Box data: 5 pixels per box in tBoxDataTexture (R2-18 起由 4 擴為 5)
// pixel 5i:   [emission.rgb, type]
// pixel 5i+1: [color.rgb, meta]
// pixel 5i+2: [min.xyz, cullable]
// pixel 5i+3: [max.xyz, fixtureGroup]  R2-14：新增 fixtureGroup 於末位
// pixel 5i+4: [roughness, metalness, 0, 0]  R2-18：scalar roughness mix + metalness

void fetchBoxData(int idx, out vec3 emission, out int type, out vec3 color, out float meta, out vec3 bMin, out vec3 bMax, out float cullable, out float fixtureGroup, out float roughness, out float metalness, out float rotateUV90) {
	int base = idx * 5;
	vec4 p0 = texelFetch(tBoxDataTexture, ivec2(base, 0), 0);
	vec4 p1 = texelFetch(tBoxDataTexture, ivec2(base + 1, 0), 0);
	vec4 p2 = texelFetch(tBoxDataTexture, ivec2(base + 2, 0), 0);
	vec4 p3 = texelFetch(tBoxDataTexture, ivec2(base + 3, 0), 0);
	vec4 p4 = texelFetch(tBoxDataTexture, ivec2(base + 4, 0), 0);
	emission = p0.xyz;
	type     = int(p0.w);
	color    = p1.xyz;
	meta     = p1.w;
	bMin     = p2.xyz;
	bMax     = p3.xyz;
	cullable = p2.w;
	fixtureGroup = p3.w;
	roughness    = p4.x;
	metalness    = p4.y;
	rotateUV90   = p4.z;
}

// R2-14：裝置開關 gating。關閉時 primary 與 secondary ray 皆跳過該 box，自動無陰影
bool isFixtureDisabled(float fixtureGroup)
{
	if (fixtureGroup < 0.5) return false; // 基底幾何恆顯
	if (fixtureGroup < 1.5) return uTrackLightEnabled < 0.5; // R2-14 群組 1
	if (fixtureGroup < 2.5) return uWideTrackLightEnabled < 0.5; // R2-15 群組 2
	if (fixtureGroup < 3.5) return uCloudPanelEnabled < 0.5; // R2-16 群組 3 Cloud 吸音板
	if (fixtureGroup < 4.5) return uCloudLightEnabled < 0.5; // R2-17 群組 4 Cloud 漫射燈條
	return false;
}


// R2-13 X-ray 透視剝離：三層 cullable tier
//   cullable=0：家具（永不透）
//   cullable=1：牆／樑／GIK／插座 —— box 之內向角近牆面（薄板貼牆）
//   cullable=2：柱等大型遮擋 —— box 中心位於相機同側半空間（X + Z 雙軸）
//   cullable=3：單軸（僅 X）大型遮擋 —— 西南/東南角柱：只隨東西側牆連動剝離，不隨南北牆連動
bool isBoxCulled(vec3 bmin, vec3 bmax, float cullable)
{
	if (uXrayEnabled < 0.5) return false;
	// R2-18 fix20：解耦 X-ray 透視與間接光。secondary ray（NEE shadow + indirect bounce）不做 culling，
	// 令被剝離之牆面對 secondary 仍為實體，indirect 反彈光正常回饋，避免陰影過暗。
	// fix12 舊策略（secondary 亦透）已廢棄：其所欲消除之「陰影殘跡」於室內相機場景不會發生
	// （uCamPos 在房內時下方四向判式本就全 false），只有室外觀察時 fix12 副作用才顯現為間接光流失。
	if (primaryRay == 0) return false;
	if (cullable < 0.5) return false;

	float T = uCullThreshold;
	float eps = uCullEpsilon;

	if (cullable < 1.5)
	{
		// cullable=1：貼牆薄板，以「內向角近牆面」為判
		if (uCamPos.x > uRoomMax.x + eps && bmin.x > uRoomMax.x - T) return true;
		if (uCamPos.x < uRoomMin.x - eps && bmax.x < uRoomMin.x + T) return true;
		if (uCamPos.z > uRoomMax.z + eps && bmin.z > uRoomMax.z - T) return true;
		if (uCamPos.z < uRoomMin.z - eps && bmax.z < uRoomMin.z + T) return true;
	}
	else if (cullable < 2.5)
	{
		// cullable=2：柱等大型遮擋，以「box 中心位於相機同側半空間」為判（X + Z 雙軸）
		vec3 roomCenter = (uRoomMin + uRoomMax) * 0.5;
		vec3 boxCenter = (bmin + bmax) * 0.5;
		if (uCamPos.x > uRoomMax.x + eps && boxCenter.x > roomCenter.x) return true;
		if (uCamPos.x < uRoomMin.x - eps && boxCenter.x < roomCenter.x) return true;
		if (uCamPos.z > uRoomMax.z + eps && boxCenter.z > roomCenter.z) return true;
		if (uCamPos.z < uRoomMin.z - eps && boxCenter.z < roomCenter.z) return true;
	}
	else
	{
		// cullable=3：單軸（僅 X）半空間判 —— 西南/東南角柱：跟隨東西側牆連動剝離，南牆剝離時柱子保持可視
		vec3 roomCenter = (uRoomMin + uRoomMax) * 0.5;
		vec3 boxCenter = (bmin + bmax) * 0.5;
		if (uCamPos.x > uRoomMax.x + eps && boxCenter.x > roomCenter.x) return true;
		if (uCamPos.x < uRoomMin.x - eps && boxCenter.x < roomCenter.x) return true;
	}

	return false;
}

bool r7310C1WestBeamSwColumnLUnionWallFace(int boxIdx, vec3 boxNormal, vec3 boxMin, vec3 boxMax)
{
	bool westBeamInnerFace = boxIdx == 28 &&
		boxNormal.x > 0.5 &&
		boxMin.x >= -1.92 && boxMin.x <= -1.90 &&
		boxMax.x >= -1.76 && boxMax.x <= -1.74 &&
		boxMin.y >= 2.52 && boxMin.y <= 2.53 &&
		boxMax.y >= 2.89 && boxMax.y <= 2.92 &&
		boxMin.z >= -1.88 && boxMin.z <= -1.86 &&
		boxMax.z >= 2.84 && boxMax.z <= 2.86;
	bool swColumnInnerFace = boxIdx == 30 &&
		boxNormal.x > 0.5 &&
		boxMin.x >= -1.92 && boxMin.x <= -1.90 &&
		boxMax.x >= -1.76 && boxMax.x <= -1.74 &&
		boxMin.z >= 2.84 && boxMin.z <= 2.86 &&
		boxMax.z >= 3.05 && boxMax.z <= 3.07;
	return westBeamInnerFace || swColumnInnerFace;
}

vec3 r7310C1DynamicSouthWallBaseColor()
{
	return vec3(0.75, 0.738, 0.71175);
}

bool r7310C1HiddenSwColumnSouthWallJoinFace(vec3 boxNormal, vec3 boxMin, vec3 boxMax, vec3 candidatePosition)
{
	bool sameWallSlab =
		boxMin.x >= -1.92 && boxMin.x <= -1.90 &&
		boxMax.x >= -1.76 && boxMax.x <= -1.74 &&
		boxMin.y >= -0.01 && boxMin.y <= 0.01 &&
		boxMax.y >= 2.89 && boxMax.y <= 2.92;
	bool swColumnSide =
		boxMin.z >= 2.84 && boxMin.z <= 2.86 &&
		boxMax.z >= 3.05 && boxMax.z <= 3.07;
	bool southWallSide =
		boxMin.z >= 3.05 && boxMin.z <= 3.07 &&
		boxMax.z >= 3.25;
	bool southCutawayKeepsColumnFace = uXrayEnabled > 0.5 &&
		uCamPos.z > uRoomMax.z + uCullEpsilon &&
		swColumnSide;
	if (southCutawayKeepsColumnFace)
		return false;
	return sameWallSlab &&
		(swColumnSide || southWallSide) &&
		abs(boxNormal.z) > 0.5 &&
		abs(candidatePosition.z - 3.056) <= 0.002 &&
		candidatePosition.x >= -1.912 &&
		candidatePosition.x <= -1.748 &&
		candidatePosition.y >= -0.002 &&
		candidatePosition.y <= 2.907;
}

bool r7310C1HiddenWestBeamSwColumnJoinFace(vec3 boxNormal, vec3 boxMin, vec3 boxMax, vec3 candidatePosition)
{
	bool sameWestSlab =
		boxMin.x >= -1.92 && boxMin.x <= -1.90 &&
		boxMax.x >= -1.76 && boxMax.x <= -1.74;
	bool westBeamSide =
		boxMin.y >= 2.52 && boxMin.y <= 2.53 &&
		boxMax.y >= 2.89 && boxMax.y <= 2.92 &&
		boxMin.z >= -1.88 && boxMin.z <= -1.86 &&
		boxMax.z >= 2.84 && boxMax.z <= 2.86;
	bool hiddenWestBeamContact = sameWestSlab &&
		westBeamSide &&
		abs(boxNormal.z) > 0.5 &&
		abs(candidatePosition.z - 2.848) <= 0.002 &&
		candidatePosition.x >= -1.912 &&
		candidatePosition.x <= -1.748 &&
		candidatePosition.y >= 2.527 &&
		candidatePosition.y <= 2.907;
	return hiddenWestBeamContact;
}

float SceneIntersect( )
{
	vec3 normal, n;
    float d;
	float t = INFINITY;
	int objectCount = 0;

	hitObjectID = -INFINITY;

	// R2-18 防漏寫預設：hitRoughness/hitMetalness 若某 hit site 未明確寫入，不得 leak 自前一個更遠的 hit
	hitRoughness = 1.0;
	hitMetalness = 0.0;
	hitRotateUV90 = 0.0;
	hitBoxIndex = -1.0;
	hitBoxCullable = -1.0;
	hitBoxFixtureGroup = -1.0;
	hitIsRayExiting = FALSE;

	// R2-11 光源幾何由圓柱承載（見下方區塊 5），ceilingLampQuad 僅作為 importance sampling PDF 目標

	// 2) BVH traversal for boxes
	vec3 invDir = 1.0 / rayDirection;
	int isRayExiting = FALSE;

	float idPrimitive, idRightChild;
	vec3 nodeMin, nodeMax;

	int stack[32];
	int stackPtr = 0;
	stack[stackPtr++] = 0; // push root

	while (stackPtr > 0) {
		int nodeIdx = stack[--stackPtr];

		fetchBVHNode(nodeIdx, idPrimitive, nodeMin, idRightChild, nodeMax);

		// test ray against node AABB
		d = BoundingBoxIntersect(nodeMin, nodeMax, rayOrigin, invDir);
		if (d >= t) continue; // AABB miss or farther than current best

		if (idPrimitive >= 0.0) {
			// LEAF: test actual box primitive
			int boxIdx = int(idPrimitive);
			vec3 boxEmission, boxColor, boxMin, boxMax;
			int boxType;
			float boxMeta, boxCullable, boxFixtureGroup, boxRoughness, boxMetalness, boxRotateUV90;
			fetchBoxData(boxIdx, boxEmission, boxType, boxColor, boxMeta, boxMin, boxMax, boxCullable, boxFixtureGroup, boxRoughness, boxMetalness, boxRotateUV90);

			// R2-14：裝置關閉時 primary/secondary ray 皆跳過（自動無陰影）；R2-13 X-ray 剝離沿用
			if (!isFixtureDisabled(boxFixtureGroup) && !isBoxCulled(boxMin, boxMax, boxCullable) && boxType != CLOUD_LIGHT)
			{
				d = BoxIntersect(boxMin, boxMax, rayOrigin, rayDirection, n, isRayExiting);
				if (d < t && n != vec3(0,0,0))
				{
					vec3 candidatePosition = rayOrigin + rayDirection * d;
					if (r7310C1HiddenWestBeamSwColumnJoinFace(n, boxMin, boxMax, candidatePosition))
						continue;
					if (r7310C1HiddenSwColumnSouthWallJoinFace(n, boxMin, boxMax, candidatePosition))
						continue;
					t = d;
					hitNormal = n;
					hitEmission = boxEmission;
					hitColor = boxColor;
					if (r7310C1WestBeamSwColumnLUnionWallFace(boxIdx, n, boxMin, boxMax))
						hitColor = r7310C1DynamicSouthWallBaseColor();
					// R2-UI（fix19）：對所有結構表面（地板/天花板/牆/樑/柱，陣列索引 0..32）套用 uWallAlbedo，家具（索引 33+）與貼圖物件不受影響
					// 歷史：原寫 index 1..15，但 fix10 地板/天花板重切後陣列索引重排，導致僅 2a/2b 被套用 albedo 而 3a 起不受影響，造成木門西側 asymmetric 暗化
					if (boxIdx <= 32) hitColor *= uWallAlbedo;
					hitType = boxType;
					hitMeta = boxMeta;
					hitRoughness = boxRoughness;
					hitMetalness = boxMetalness;
					hitRotateUV90 = boxRotateUV90;
					hitIsRayExiting = isRayExiting;
					hitBoxMin = boxMin;
					hitBoxMax = boxMax;
					hitBoxIndex = float(boxIdx);
					hitBoxCullable = boxCullable;
					hitBoxFixtureGroup = boxFixtureGroup;
					// fix20：結構性 box（索引 0..32：地板/天花板/牆/樑/柱）統一 objectID=1，使邊界間 fwidth(objectID)=0，
					// 避免 PathTracingCommon.js main() 之 objectDifference>=1.0 觸發 pixelSharpness=1 而於共邊永保 raw noise
					// 傢俱與貼圖物件（索引 33+）保留各自獨特 ID（+1 讓最小為 34 避免與結構組撞）；確保 wall-furniture 邊緣仍受 edge 保護
					hitObjectID = float(objectCount + (boxIdx <= 32 ? 1 : boxIdx + 1));
				}
			}
		} else {
			// INNER NODE: push children (right first so left pops first)
			int rc = int(idRightChild);
			if (rc > 0)
				stack[stackPtr++] = rc;
			stack[stackPtr++] = nodeIdx + 1; // left child
		}
	}

	// 3) R2-6 旋轉物件
	vec3 rObjOrigin, rObjDirection;

	// helper macro: 標準 box 測試（底座、頂板）— R2-18 Step 6：C_STAND 類 per-class scale
	#define TEST_BOX(INV_MAT, IDX) { \
		rObjOrigin = vec3(INV_MAT * vec4(rayOrigin, 1.0)); \
		rObjDirection = vec3(INV_MAT * vec4(rayDirection, 0.0)); \
		d = BoxIntersect(-rotHalf[IDX], rotHalf[IDX], rObjOrigin, rObjDirection, n, isRayExiting); \
		if (d < t) { \
			t = d; \
			hitNormal = transpose(mat3(INV_MAT)) * n; \
			hitEmission = vec3(0); \
			hitColor = rotColor[IDX]; \
			hitType = DIFF; \
			hitRoughness = clamp(rotRoughness[IDX] * uStandRoughnessScale, 0.0, 1.0); \
			hitMetalness = clamp(rotMetalness[IDX] * uStandMetalnessScale, 0.0, 1.0); \
			hitIsRayExiting = isRayExiting; \
			hitObjectID = float(objectCount + 100 + IDX); \
		} \
	}

	// helper macro: 喇叭 box 測試（type SPEAKER + 記錄物件空間資料）
	#define TEST_SPEAKER(INV_MAT, IDX) { \
		rObjOrigin = vec3(INV_MAT * vec4(rayOrigin, 1.0)); \
		rObjDirection = vec3(INV_MAT * vec4(rayDirection, 0.0)); \
		d = BoxIntersect(-rotHalf[IDX], rotHalf[IDX], rObjOrigin, rObjDirection, n, isRayExiting); \
		if (d < t) { \
			t = d; \
			hitNormal = transpose(mat3(INV_MAT)) * n; \
			hitObjNormal = n; \
			hitObjPos = rObjOrigin + d * rObjDirection; \
			hitObjHalf = rotHalf[IDX]; \
			hitEmission = vec3(0); \
			hitColor = rotColor[IDX]; \
			hitType = SPEAKER; \
			hitRoughness = rotRoughness[IDX]; \
			hitMetalness = rotMetalness[IDX]; \
			hitIsRayExiting = isRayExiting; \
			hitObjectID = float(objectCount + 100 + IDX); \
		} \
	}

	// helper macro: stadium 支柱測試 — R2-18 Step 6：C_STAND_PILLAR 類 per-class scale
	#define TEST_PILLAR(INV_MAT, IDX) { \
		rObjOrigin = vec3(INV_MAT * vec4(rayOrigin, 1.0)); \
		rObjDirection = vec3(INV_MAT * vec4(rayDirection, 0.0)); \
		d = StadiumPillarIntersect(rotHalf[IDX], rObjOrigin, rObjDirection, n); \
		if (d < t) { \
			t = d; \
			hitNormal = transpose(mat3(INV_MAT)) * n; \
			hitEmission = vec3(0); \
			hitColor = rotColor[IDX]; \
			hitType = DIFF; \
			hitRoughness = clamp(rotRoughness[IDX] * uStandPillarRoughnessScale, 0.0, 1.0); \
			hitMetalness = clamp(rotMetalness[IDX] * uStandPillarMetalnessScale, 0.0, 1.0); \
			hitObjectID = float(objectCount + 100 + IDX); \
		} \
	}

	TEST_SPEAKER(uLeftSpeakerInvMatrix, 0)
	TEST_BOX(uLeftStandBaseInvMatrix, 1)
	TEST_PILLAR(uLeftStandPillarInvMatrix, 2)
	TEST_BOX(uLeftStandTopInvMatrix, 3)
	TEST_SPEAKER(uRightSpeakerInvMatrix, 4)
	TEST_BOX(uRightStandBaseInvMatrix, 5)
	TEST_PILLAR(uRightStandPillarInvMatrix, 6)
	TEST_BOX(uRightStandTopInvMatrix, 7)

	// 4) ISO-PUCK MINI (8 顆垂直圓柱)
	for (int pi = 0; pi < 8; pi++)
	{
		d = CylinderIntersect(uPuckPositions[pi], uPuckRadius, uPuckHalfH, rayOrigin, rayDirection, n);
		if (d < t)
		{
			t = d;
			hitNormal = n;
			hitEmission = vec3(0);
			hitColor = vec3(0.05, 0.05, 0.05); // 黑色橡膠
			hitType = DIFF;
			hitRoughness = 1.0; hitMetalness = 0.0; // R2-18：黑橡膠全粗糙非金屬，防 metalness leak
			hitObjectID = float(objectCount + 200 + pi);
		}
	}

	// 5) R2-11 中央吸頂燈圓柱 — 物理正確的單向光模型
	// 底面（n.y < -0.5）= LIGHT 發光；頂面與側壁 = DIFF 白色不發光外殼
	// 3cm 間隙不會洩漏直接光，天花板完全靠反彈受光 → 自然漸層
	d = CylinderIntersect(uCeilingLampPos, uCeilingLampRadius, uCeilingLampHalfH, rayOrigin, rayDirection, n);
	if (d < t)
	{
		t = d;
		hitNormal = n;
		if (n.y < -0.5)
		{
			// 底面 — 發光面
			hitEmission = uLightEmission;
			hitColor = vec3(0);
			hitType = LIGHT;
		}
		else
		{
			// 側面 + 頂面 — LAMP_SHELL：相機視覺上發光，間接反彈走 DIFF
			hitEmission = uLightEmission;
			hitColor = vec3(0.9, 0.9, 0.9);
			hitType = LAMP_SHELL;
		}
		hitRoughness = 1.0; hitMetalness = 0.0; // R2-18：光源/燈殼非金屬
		hitObjectID = float(objectCount + 300);
	}

	// 6) R2-14 → R3-4 東西投射燈頭（4 盞傾斜圓柱；關閉時 primary/secondary ray 皆跳過 → 自動無陰影）
	// R3-4：emitter 改 hitType=TRACK_LIGHT；hitColor=0 阻 BSDF 二次 mask；hitObjectID 改 uTrackLampIdBase（雙源同步契約，JS TRACK_LAMP_ID_BASE=400）
	// R3-4 fix03：face-gate 對齊舊專案 BVH_Spot_Light_Source pattern（disk = emitter / openCylinder = housing）
	//   - 底蓋（normal 與 lampDir 同向，faceAlign > 0.9）→ TRACK_LIGHT emitter
	//   - 側面 + 頂蓋 → DIFF housing（深灰殼，避免筒身全亮之視覺 bug）
	if (uTrackLightEnabled > 0.5)
	{
		for (int li = 0; li < 4; li++)
		{
			vec3 pa = uTrackLampPos[li];
			vec3 pb = pa + uTrackLampDir[li] * 0.135;
			d = CylinderSegmentIntersect(pa, pb, 0.03, rayOrigin, rayDirection, n);
			if (d < t)
			{
				t = d;
				hitNormal = n;
				float faceAlign = dot(n, uTrackLampDir[li]);
				if (faceAlign > 0.9)
				{
					hitEmission = uTrackEmission[li];
					hitColor = vec3(0);
					hitType = TRACK_LIGHT;
					hitRoughness = 1.0; hitMetalness = 0.0; // R3-4：emitter 非金屬，繞過 metal gate
					hitObjectID = uTrackLampIdBase + float(li);
				}
				else
				{
					hitEmission = vec3(0);
					hitColor = vec3(0.15, 0.15, 0.15);
					hitType = DIFF;
					hitRoughness = uFixtureRoughness;
					hitMetalness = uFixtureMetalness;
					hitObjectID = float(objectCount + 600 + li);
				}
			}
		}
	}

	// 7) R2-15 → R3-5a 南北廣角燈頭（2 盞矮胖圓柱；關閉時 primary/secondary ray 皆跳過）
	// R3-5a：emitter 改 hitType=TRACK_WIDE_LIGHT；face-gate 對齊 R3-4 spot pattern（disk = emitter / openCylinder = housing）
	//   - 底蓋（normal 與 lampDir 同向，faceAlign > 0.9）→ TRACK_WIDE_LIGHT emitter
	//   - 側面 + 頂蓋 → DIFF housing（深灰殼），hitObjectID 沿用 objectCount + 500 + li 保 R2-15 既有編號
	if (uWideTrackLightEnabled > 0.5)
	{
		for (int li = 0; li < 2; li++)
		{
			vec3 pa = uTrackWideLampPos[li];
			vec3 pb = pa + uTrackWideLampDir[li] * 0.072;
			d = CylinderSegmentIntersect(pa, pb, 0.05, rayOrigin, rayDirection, n);
			if (d < t)
			{
				t = d;
				hitNormal = n;
				float wideFaceAlign = dot(n, uTrackWideLampDir[li]);
				if (wideFaceAlign > 0.9)
				{
					hitEmission = uTrackWideEmission[li];
					hitColor = vec3(0);
					hitType = TRACK_WIDE_LIGHT;
					hitRoughness = 1.0; hitMetalness = 0.0; // emitter 非金屬，繞過 metal gate
					hitObjectID = uTrackWideLampIdBase + float(li);
				}
				else
				{
					hitEmission = vec3(0);
					hitColor = vec3(0.15, 0.15, 0.15);
					hitType = DIFF;
					hitRoughness = uFixtureRoughness;
					hitMetalness = uFixtureMetalness;
					hitObjectID = float(objectCount + 500 + li);
				}
			}
		}
	}

	// R6-3 Phase 1C：Cloud 鋁槽弧形 diffuser analytic geometry。
	// BVH 中的 square proxy 僅保留資料來源；真正發光與命中使用 1/4 圓弧面。
	if (uCloudLightEnabled > 0.5)
	{
		for (int ci = 0; ci < 4; ci++)
		{
			d = CloudArcIntersect(ci, rayOrigin, rayDirection, n);
			if (d < t)
			{
				t = d;
				hitNormal = n;
				hitEmission = uCloudEmission[ci];
				hitColor = vec3(0.0);
				hitType = CLOUD_LIGHT;
				hitRoughness = 1.0;
				hitMetalness = 0.0;
				hitObjectID = uCloudObjIdBase + float(ci);
				hitBoxMin = uCloudRodCenter[ci] - uCloudRodHalfExtent[ci];
				hitBoxMax = uCloudRodCenter[ci] + uCloudRodHalfExtent[ci];
			}
		}
	}

	return t;
}


vec3 CalculateMovementPreview( out vec3 objectNormal, out vec3 objectColor, out float objectID, out float pixelSharpness )
{
	hitType = -100;
	primaryRay = 1;
	float t = SceneIntersect();
	if (t == INFINITY)
	{
		pixelSharpness = 1.0;
		return vec3(0.0);
	}

	vec3 n = normalize(hitNormal);
	vec3 nl = dot(n, rayDirection) < 0.0 ? n : -n;
	objectNormal += n;
	objectColor += hitColor;
	objectID = hitObjectID;

	if (hitType == BACKDROP || hitType == SPEAKER || hitType == WOOD_DOOR || hitType == IRON_DOOR || hitType == SUBWOOFER || hitType == ACOUSTIC_PANEL || hitType == OUTLET)
		pixelSharpness = 1.0;

	if (hitType == LIGHT || hitType == TRACK_LIGHT || hitType == TRACK_WIDE_LIGHT || hitType == CLOUD_LIGHT)
	{
		pixelSharpness = 1.0;
		return min(hitEmission, vec3(uEmissiveClamp));
	}

	vec3 keyDir = normalize(vec3(-0.35, 0.75, -0.25));
	float hemi = clamp(nl.y * 0.5 + 0.5, 0.0, 1.0);
	float key = clamp(dot(nl, keyDir), 0.0, 1.0);
	float grazingLift = 1.0 - abs(dot(nl, rayDirection));
	vec3 previewColor = hitColor * (0.34 + 0.38 * hemi + 0.22 * key + 0.08 * grazingLift);
	return clamp(previewColor, vec3(0.0), vec3(1.4));
}

vec3 CalculateRadiance( out vec3 objectNormal, out vec3 objectColor, out float objectID, out float pixelSharpness )
{
    // R2-11 用 ceilingLampQuad 做向下單向光的 importance sampling（PDF 目標，非場景幾何）
    Quad light = ceilingLampQuad;

	vec3 accumCol = vec3(0);
	vec3 mask = vec3(1);
	if (uCloudMisWeightProbeMode == 8)
		return cloudMisWeightProbeUniformSentinel();
	if (uCloudMisWeightProbeMode == 9)
		return cloudMisWeightProbeContributionUniformSentinel();
	if (uMovementPreviewMode > 0.5 && uCloudVisibilityProbeMode == 0 && uCloudMisWeightProbeMode == 0 && uCloudContributionProbeMode == 0)
		return CalculateMovementPreview(objectNormal, objectColor, objectID, pixelSharpness);
#if defined(R7310_INCLUDE_DEBUG_PROBES)
	if (uR7310C1XatlasBakeMode > 0.5 && uR7310C1RuntimeProbeMode > 76.5 && uR7310C1RuntimeProbeMode < 80.5)
	{
		// OPUS/CODEX 2026-06-10 probe 77-80：4636 invalid 短路之前，自己重做 bake gate texelFetch。
		// 77/78 看 gate；79 看 sampler size；80 看 normal x=511/512 的硬切線。
		ivec2 r7310P77Texel = ivec2(floor(gl_FragCoord.xy + uR738C1BakeTileOriginPx));
		vec4 r7310P77WP = texelFetch(tR738C1BakeAtlasTexture, r7310P77Texel, 0);
		vec4 r7310P77NP = texelFetch(tR7310C1FullRoomDiffuseAtlasTexture, r7310P77Texel, 0);
		float r7310P77NL = length(r7310P77NP.xyz);
		objectNormal = vec3(0.0); objectColor = vec3(0.0); objectID = -INFINITY; pixelSharpness = 1.0;
		if (uR7310C1RuntimeProbeMode < 77.5)
			return vec3(clamp(r7310P77WP.w, 0.0, 1.0), clamp(r7310P77NP.w, 0.0, 1.0), clamp(r7310P77NL, 0.0, 1.0));
		if (uR7310C1RuntimeProbeMode < 78.5)
			return vec3(r7310C1XatlasBakeTexelValid ? 1.0 : 0.0, clamp((r7310P77WP.z + 2.074) / 0.2, 0.0, 1.0), r7310P77NP.z * 0.5 + 0.5);
		ivec2 r7310P79WorldSize = textureSize(tR738C1BakeAtlasTexture, 0);
		ivec2 r7310P79NormalSize = textureSize(tR7310C1FullRoomDiffuseAtlasTexture, 0);
		if (uR7310C1RuntimeProbeMode < 79.5)
			return vec3(clamp(float(r7310P79WorldSize.x) / 1024.0, 0.0, 1.0), clamp(float(r7310P79NormalSize.x) / 1024.0, 0.0, 1.0), clamp(float(r7310P79NormalSize.y) / 1024.0, 0.0, 1.0));
		int r7310P80Y = clamp(r7310P77Texel.y, 0, max(0, r7310P79NormalSize.y - 1));
		vec4 r7310P80N511 = texelFetch(tR7310C1FullRoomDiffuseAtlasTexture, ivec2(511, r7310P80Y), 0);
		vec4 r7310P80N512 = texelFetch(tR7310C1FullRoomDiffuseAtlasTexture, ivec2(512, r7310P80Y), 0);
		return vec3(clamp(length(r7310P80N511.xyz), 0.0, 1.0), clamp(length(r7310P80N512.xyz), 0.0, 1.0), clamp(r7310P77NL, 0.0, 1.0));
	}
#endif
	if (uR7310C1XatlasBakeMode > 0.5 && !r7310C1XatlasBakeTexelValid)
	{
		objectNormal = vec3(0.0);
		objectColor = vec3(0.0);
		objectID = -INFINITY;
		pixelSharpness = 1.0;
		return vec3(0.0);
	}
    vec3 n, nl, x;
	vec3 diffuseBounceMask = vec3(1);
	vec3 diffuseBounceRayOrigin = vec3(0);
	vec3 diffuseBounceRayDirection = vec3(0);

	float t = INFINITY;
	// R3-4 / R3-5a / R3-5b：weight 升 vec3 以承載 stochastic NEE 之 emit baked + 色溫權重；既有 mask 為 vec3，相乘 component-wise
	vec3 weight;
	float p;

	int diffuseCount = 0;
	bool indirectMultApplied = false; // R6: uIndirectMultiplier 整條光路只套一次（原每次消費皆套會指數疊加）
	bool reachedMaxBounces = false; // R6 LGG-r15 B1：旗標──只有在 path 被 max bounces 強制中斷時為 true，其他 break（撞光、ray escape）為 false
	int previousIntersecType = -100;
	hitType = -100;

	int bounceIsSpecular = TRUE;
	int sampleLight = FALSE;
	int willNeedDiffuseBounceRay = FALSE;

	// R3-6：MIS Phase-1 跨 bounce state。
	//   misWPrimaryNeeLast：最近一次 NEE dispatch 的 solid-angle PDF（p_nee）；BSDF-indirect 命中 emitter 時用於 heuristic w_bsdf = p_bsdf²/(p_nee² + p_bsdf²)。
	//   misPBsdfNeeLast：NEE dispatch 當下由 shading point nl 與 NEE 方向算得之 cos-weighted BSDF PDF（cos/π）；NEE-hit 分支用於 w_nee = p_nee²/(p_nee² + p_bsdf²)。
	//   lastNeePickedIdx：最近一次 NEE 所抽的 light idx（0..10）；reverse-NEE PDF 計算時確認命中的確是「若重抽會被選中」之 emitter。
	//   misBsdfBounceNl + misBsdfBounceOrigin：BSDF 間接 bounce 發射點之 shading normal 與 position；bounce ray 命中 ceiling/Cloud emitter 時用於 reverse-NEE PDF 評估。
	//   misPBsdfStashed：BSDF bounce ray sample time cached cos-weighted PDF（cos(bounceDir, nl)/π）。
	// 每處 bounceIsSpecular = FALSE 必配此組變數 reset (plan R4 規則，17 處 site)。
	float misWPrimaryNeeLast = 0.0;
	float misPBsdfNeeLast = 0.0;
	int lastNeePickedIdx = -1;
	float lastNeeSourceObjectID = -INFINITY;
	int lastNeeSourceHitType = -100;
	vec3 lastNeeSourceNormal = vec3(0.0);
	vec3 lastNeeSourcePosition = vec3(0.0);
	int lastNeeZeroContributionClass = CLOUD_PROBE_CLASS_ZERO_OTHER;
	int lastNeeProbeThetaBin = -1;
	vec3 lastNeeFacingDiagnostic = vec3(0.0);
	int firstVisibleHitType = -100;
	float firstVisibleObjectID = -INFINITY;
	vec3 firstVisibleNormal = vec3(0.0);
	vec3 firstVisiblePosition = vec3(0.0);
	// R7-3.10 Phase 2 H7' / sprout-paste-inside-guard probe：
	// 用來量測 inside-floor 視角是否仍把 R7-3.8 paste 套用；實際 guard 採 camera-y 條件。
	int firstVisibleIsRayExiting = FALSE;
	bool r7310FloorFullRadianceBakeFirstHit = false;
		vec3 misBsdfBounceNl = vec3(0.0);
		vec3 misBsdfBounceOrigin = vec3(0.0);
		float misPBsdfStashed = 0.0;
			for (int bounces = 0; bounces < 14; bounces++)
		{
			if (bounces >= int(uMaxBounces)) { reachedMaxBounces = true; break; } // R2-UI：runtime 動態上限；R6 LGG-r15：標記為 max-bounce 強制中斷供 terminal ambient 用
			primaryRay = bounces == 0 ? 1 : 0;
		previousIntersecType = hitType;

		t = SceneIntersect();

		if (t == INFINITY)
		{
#if defined(R7310_INCLUDE_DEBUG_PROBES)
			if (uR7310C1XatlasBakeMode > 0.5 &&
				sampleLight == TRUE &&
				uR7310C1RuntimeProbeMode > 80.5 &&
				uR7310C1RuntimeProbeMode < 84.5)
			{
				accumCol = vec3(0.0, 0.0, 1.0);
				break;
			}
			if (bounces == 0 &&
				uR7310C1XatlasBakeMode > 0.5 &&
				uR7310C1RuntimeProbeMode > 71.5 &&
				uR7310C1RuntimeProbeMode < 75.5)
			{
				// OPUS 2026-06-10 probe 72-75（CODEX 指定）：t==INFINITY miss 分支內 primary ray 診斷。
				// 查 low_tri10 為何 miss。bounces==0；rayOrigin≈atlasWorldPos+normal*8eps、rayDirection=-atlasNormal。
				// 72=常數校準（確認 low 走 miss）、73=rayOrigin worldPos、74=rayDirection、75=rayOrigin.z 高精度+rayDir.z。
				if (uR7310C1RuntimeProbeMode < 72.5) {
					accumCol = vec3(0.25, 0.5, 0.75);
				} else if (uR7310C1RuntimeProbeMode < 73.5) {
					accumCol = vec3(clamp((rayOrigin.x + 1.95) / 3.9, 0.0, 1.0), clamp(rayOrigin.y / 3.0, 0.0, 1.0), clamp((rayOrigin.z + 2.1) / 5.2, 0.0, 1.0));
				} else if (uR7310C1RuntimeProbeMode < 74.5) {
					accumCol = rayDirection * 0.5 + 0.5;
				} else {
					accumCol = vec3(clamp((rayOrigin.z + 1.95) / 0.4, 0.0, 1.0), clamp(rayDirection.z * 0.5 + 0.5, 0.0, 1.0), clamp(rayOrigin.y / 3.0, 0.0, 1.0));
				}
				break;
			}
#endif
			// ADR 2 Normal-Aux primary miss：plan §13 ADR-Normal-Aux-Shader 修訂（CODEX 二審）
			// primary ray 沒打到任何 geometry 時、normal aux 回 vec3(0.0) 表「無 first-visible surface」
			// 與 OIDN normal-aux 的「無 geometry」慣例對齊；bounces > 0 不受此 branch 影響
			if (bounces == 0 && uR7310C1NormalAuxOutputMode > 0.5)
				return vec3(0.0);

			if (uCloudVisibilityProbeMode > 0 && sampleLight == TRUE && cloudVisibilityProbeMatches(lastNeePickedIdx))
			{
				accumCol += (uCloudVisibilityProbeMode >= 4)
					? cloudVisibilityProbeFacingDiagnosticColor(lastNeeFacingDiagnostic, lastNeeProbeThetaBin)
					: ((uCloudVisibilityProbeMode >= 2)
					? ((uCloudVisibilityProbeMode >= 3)
						? cloudVisibilityProbeSelectedClassColor(cloudVisibilityProbeHasContribution(mask) ? CLOUD_PROBE_CLASS_MISS : lastNeeZeroContributionClass, lastNeeProbeThetaBin)
						: cloudVisibilityProbeClassColor(cloudVisibilityProbeHasContribution(mask) ? CLOUD_PROBE_CLASS_MISS : lastNeeZeroContributionClass))
					: cloudVisibilityProbeBlockedColor(lastNeePickedIdx));
				break;
			}

			if (bounces == 0 || (bounces == 1 && previousIntersecType == SPEC))
				pixelSharpness = 1.0;

			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;

				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}

			break;
		}


		n = normalize(hitNormal);
    nl = dot(n, rayDirection) < 0.0 ? n : -n;
		x = rayOrigin + rayDirection * t;

				if (bounces == 0)
				{
					objectID = hitObjectID;
			firstVisibleHitType = hitType;
			firstVisibleObjectID = hitObjectID;
			firstVisibleNormal = nl;
			firstVisiblePosition = x;
			// R7-3.10 Phase 2 H7' probe：把 BVH 命中的 isRayExiting 升級到 firstVisible* 體系。
			// 此值僅作 probe 證據，不作 guard 條件。
			firstVisibleIsRayExiting = hitIsRayExiting;
			r7310FloorFullRadianceBakeFirstHit =
				uR738C1BakeCaptureMode == 2 &&
				uR738C1BakePatchId == 1001 &&
				uR7310C1XatlasBakeFullRadianceMode > 0.5 &&
				cloudVisibleSurfaceIsFloor(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition);
			if (r7310FloorFullRadianceBakeFirstHit)
			{
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
			}
			// R4-2C Phase A（CODEX 2026-06-21）：移除 west threshold bake early break（門檻帶 bounce0 中斷→烤黑）。
			// 門檻帶 y[0,0.091]&z[-1.875,-0.983] 屬 west 有效覆蓋，應正常採光、不再 break。
#if defined(R7310_INCLUDE_DEBUG_PROBES)
			if (uR7310C1XatlasBakeMode > 0.5 &&
				uR7310C1RuntimeProbeMode > 66.5 &&
				uR7310C1RuntimeProbeMode < 71.5)
			{
				// OPUS 2026-06-10 probe 67-71（CODEX 指定）：SceneIntersect 後、hitType 分流前的通用命中點。
				// 查 low_tri10 primary first-hit 命中誰。此處 bounces==0、firstVisible* 已設、未分流。
				// 67=常數校準、68=hitType/objId、69=nl、70=worldPos x、71=primary rayDirection。
				if (uR7310C1RuntimeProbeMode < 67.5) {
					accumCol = vec3(0.25, 0.5, 0.75);
				} else if (uR7310C1RuntimeProbeMode < 68.5) {
					accumCol = vec3(clamp(float(firstVisibleHitType) / 256.0, 0.0, 1.0), clamp(firstVisibleObjectID / 256.0, 0.0, 1.0), 0.0);
				} else if (uR7310C1RuntimeProbeMode < 69.5) {
					accumCol = firstVisibleNormal * 0.5 + 0.5;
				} else if (uR7310C1RuntimeProbeMode < 70.5) {
					accumCol = vec3(clamp((firstVisiblePosition.x + 1.95) / 3.9, 0.0, 1.0), clamp(firstVisiblePosition.y / 3.0, 0.0, 1.0), clamp((firstVisiblePosition.z + 2.1) / 5.2, 0.0, 1.0));
				} else {
					accumCol = vec3(clamp(rayDirection.x * 0.5 + 0.5, 0.0, 1.0), clamp(rayDirection.y * 0.5 + 0.5, 0.0, 1.0), clamp(rayDirection.z * 0.5 + 0.5, 0.0, 1.0));
				}
				break;
			}
#endif
			// ADR 2 Normal-Aux Early-Out：plan §13 ADR-Normal-Aux-Shader 修訂（CODEX 二審）
			// primary hit 設好 firstVisibleNormal 後立即 return、bypass 整個 PT loop、
			// 達到 1 SPP geometry-only 的時間與穩定性優勢
			// 直接輸出 raw firstVisibleNormal ∈ [-1, +1]、無 pack、無 clamp
			// PFM RGBA32F 支援負值浮點、由 oidn-bridge 直接寫入 normal.pfm、
			// 對齊 OIDN RT filter normal aux 規格（world-space normal、[-1, +1] raw）
			// 來源：Open Image Denoise documentation RT filter 參數表
			if (uR7310C1NormalAuxOutputMode > 0.5)
				return firstVisibleNormal;
			if (
				uR739C1ReflectionReferenceMode > 0.5 &&
				uR739C1ReflectionReferenceMode < 1.5 &&
				!r739C1AccurateReflectionReplacesTarget(
					r739C1ReflectionTargetId(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition),
					firstVisiblePosition
				)
			) {
				break;
			}
			if (uR738C1BakeCaptureMode == 1)
			{
				accumCol += r738C1SurfaceClassColor(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition).rgb;
				break;
			}
			if (uR739C1ReflectionSurfaceMaskMode > 0.5)
			{
				int r739TargetId = r739C1ReflectionTargetId(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition);
				if (!r739C1AccurateReflectionReplacesTarget(r739TargetId, firstVisiblePosition)) r739TargetId = 0;
				if (uR739C1ReflectionSurfaceMaskMode < 1.5)
					accumCol += vec3(float(r739TargetId), firstVisibleObjectID, hitRoughness);
				else if (uR739C1ReflectionSurfaceMaskMode < 2.5)
					accumCol += firstVisiblePosition * 0.05 + 0.5;
				else if (uR739C1ReflectionSurfaceMaskMode < 3.5)
					accumCol += firstVisibleNormal * 0.5 + 0.5;
				else
					accumCol += r739C1ReflectionTargetColor(r739TargetId);
				break;
			}
			if (uR73GikWallProbeMode > 0)
			{
				bool r73ProbeMatch =
					(uR73GikWallProbeMode == 1 && cloudVisibleSurfaceIsGik(firstVisibleHitType)) ||
					(uR73GikWallProbeMode == 2 && cloudVisibleSurfaceIsWall(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal));
				accumCol += r73ProbeMatch ? vec3(1.0) : vec3(0.0);
				break;
			}
			// 有貼圖的表面：標記為 edge pixel，跳過降噪模糊核心
			if (hitType == BACKDROP || hitType == SPEAKER || hitType == WOOD_DOOR || hitType == IRON_DOOR || hitType == SUBWOOFER || hitType == ACOUSTIC_PANEL || hitType == OUTLET)
				pixelSharpness = 1.0;
			if (uCloudMisWeightProbeMode > 0)
			{
				if (uCloudContributionProbeMode >= 17 && uCloudContributionProbeMode <= 21)
				{
					if (cloudVisibleSurfaceProbeModeMatches(uCloudContributionProbeMode, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
						accumCol += cloudMisWeightProbeContribution(vec3(1.0), vec3(1.0));
					break;
				}
			}
		}

		if (diffuseCount == 0)
		{
			objectNormal += n;
			objectColor += hitColor;
		}

		if (uCloudVisibilityProbeMode > 0 && sampleLight == TRUE && cloudVisibilityProbeMatches(lastNeePickedIdx))
		{
			int blockerClass = cloudVisibilityProbeHasContribution(mask) ? cloudVisibilityProbeBlockerClass(lastNeePickedIdx, lastNeeSourceObjectID, lastNeeSourceHitType) : lastNeeZeroContributionClass;
			accumCol += (uCloudVisibilityProbeMode >= 4)
				? cloudVisibilityProbeFacingDiagnosticColor(lastNeeFacingDiagnostic, lastNeeProbeThetaBin)
				: ((uCloudVisibilityProbeMode >= 2)
				? ((uCloudVisibilityProbeMode >= 3)
					? cloudVisibilityProbeSelectedClassColor(blockerClass, lastNeeProbeThetaBin)
					: cloudVisibilityProbeClassColor(blockerClass))
				: ((blockerClass == CLOUD_PROBE_CLASS_VISIBLE)
					? cloudVisibilityProbeVisibleColor(lastNeePickedIdx, mask)
					: cloudVisibilityProbeBlockedColor(lastNeePickedIdx)));
			break;
		}

#if defined(R7310_INCLUDE_DEBUG_PROBES)
		if (uR7310C1XatlasBakeMode > 0.5 &&
			sampleLight == TRUE &&
			uR7310C1RuntimeProbeMode > 80.5 &&
			uR7310C1RuntimeProbeMode < 84.5)
		{
			bool r7310P81EmitterHit = hitType == LIGHT ||
				hitType == TRACK_LIGHT ||
				hitType == TRACK_WIDE_LIGHT ||
				hitType == CLOUD_LIGHT;
			if (uR7310C1RuntimeProbeMode < 81.5)
			{
				accumCol = r7310P81EmitterHit ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
			}
			else if (uR7310C1RuntimeProbeMode < 82.5)
			{
				accumCol = vec3(
					clamp(float(hitType) / 255.0, 0.0, 1.0),
					clamp(mod(hitObjectID, 256.0) / 255.0, 0.0, 1.0),
					clamp(float(lastNeePickedIdx + 1) / 16.0, 0.0, 1.0)
				);
			}
			else if (uR7310C1RuntimeProbeMode < 83.5)
			{
				accumCol = vec3(
					clamp((x.x + 2.2) / 4.4, 0.0, 1.0),
					clamp((x.y + 0.1) / 3.2, 0.0, 1.0),
					clamp((x.z + 2.1) / 5.4, 0.0, 1.0)
				);
			}
			else
			{
				accumCol = vec3(
					clamp((lastNeeSourcePosition.x + 2.2) / 4.4, 0.0, 1.0),
					clamp((lastNeeSourcePosition.y + 0.1) / 3.2, 0.0, 1.0),
					clamp((lastNeeSourcePosition.z + 2.1) / 5.4, 0.0, 1.0)
				);
			}
			break;
		}
#endif

		if (hitType == LIGHT)
		{
			if (diffuseCount == 0)
				pixelSharpness = 1.0;
			if (uCloudMisWeightProbeMode > 0) { break; }

			if (bounceIsSpecular == TRUE)
			{
				// SPEC chain / primary-ray 直接命中 ceiling：MIS 不套（Dirac delta BSDF，Veach §9.2.4），直接累加。
				accumCol += mask * hitEmission;
			}
			else if (sampleLight == TRUE)
			{
				// NEE shadow ray 命中 ceiling。若 MIS 啟用且抽到 ceiling (idx 0)，套 w_nee 權重。
				if (lastNeePickedIdx == 0)
				{
					float wNee = misPowerWeight(misWPrimaryNeeLast, misPBsdfNeeLast);
					accumCol += mask * hitEmission * wNee;
				}
				else
				{
					accumCol += mask * hitEmission;
				}
			}
			else if (diffuseCount >= 1 && misPBsdfStashed > 0.0)
			{
				// BSDF-indirect bounce ray 命中 ceiling：R3-6 新增路徑（R3-5b blocked）。
				// reverse-NEE PDF 以 bounce 發射點 (misBsdfBounceOrigin) 為源，評估「若重抽 NEE 會選中 ceiling」之 p_ω。
				vec3 lampCenter = (light.v0 + light.v2) * 0.5;
				vec3 lampExt1 = light.v1 - light.v0;
				vec3 lampExt2 = light.v3 - light.v0;
				float lampArea = length(lampExt1) * length(lampExt2);
				float pNeeReverse = pdfNeeForLight(misBsdfBounceOrigin, lampCenter, light.normal, lampArea, activeLightPickPdfByIndex(0));
				float wBsdf = misPowerWeight(misPBsdfStashed, pNeeReverse);
				accumCol += mask * hitEmission * wBsdf;
			}

			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;

				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}

			break;
		}

		// R3-4 fix04：TRACK_LIGHT 分支必須前置於 NEE-miss handler 之前，
		// 否則 L831 catch-all 會先攔截 sampleLight==TRUE 的合法 NEE 命中，
		// 導致 stochastic NEE baked 入 mask 的 emit 被丟棄（Option A' 退化成 Option A）。
		if (hitType == TRACK_LIGHT)
		{
			if (diffuseCount == 0)
				pixelSharpness = 1.0;
			if (uCloudMisWeightProbeMode > 0) { break; }

			if (sampleLight == TRUE)
			{
				accumCol += mask;
			}
			else if (bounceIsSpecular == TRUE)
			{
				int lampIdx = int(hitObjectID - uTrackLampIdBase + 0.5);
				lampIdx = clamp(lampIdx, 0, 3);
				// R3-4 fix07：量綱修正後 rawEmit≈700（非 8.4e5），tier-10/1 雙段 clamp 不再必要。
				// 改用 uEmissiveClamp（預設 50）統一節流；max-channel normalize 保色比（per-channel min 會殺色溫，見 feedback_pathtracing_spotlight_facegate_and_maxch_normalize）。
				vec3 rawEmit = uTrackEmission[lampIdx];
				float maxCh = max(max(rawEmit.r, rawEmit.g), rawEmit.b);
				float scale = (maxCh > uEmissiveClamp) ? (uEmissiveClamp / maxCh) : 1.0;
				accumCol += mask * (rawEmit * scale);
			}
			// BSDF-indirect (兩者皆 false) 不累加，避與 NEE 路徑雙計

			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;

				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}

			break;
		}

		// R3-5a：TRACK_WIDE_LIGHT 分支（複用 R3-4 TRACK_LIGHT pattern；clamp index 0..1 對應南/北 2 盞）
		if (hitType == TRACK_WIDE_LIGHT)
		{
			if (diffuseCount == 0)
				pixelSharpness = 1.0;
			if (uCloudMisWeightProbeMode > 0) { break; }

			if (sampleLight == TRUE)
			{
				accumCol += mask;
			}
			else if (bounceIsSpecular == TRUE)
			{
				int wideIdx = int(hitObjectID - uTrackWideLampIdBase + 0.5);
				wideIdx = clamp(wideIdx, 0, 1);
				vec3 rawEmit = uTrackWideEmission[wideIdx];
				float maxCh = max(max(rawEmit.r, rawEmit.g), rawEmit.b);
				float scale = (maxCh > uEmissiveClamp) ? (uEmissiveClamp / maxCh) : 1.0;
				accumCol += mask * (rawEmit * scale);
			}
			// BSDF-indirect 不累加（避 NEE 雙計，待 R3-6 MIS 權重到位才開）

			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;

				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}

			break;
		}

		// R6-3 Phase 1C：Cloud NEE shadow ray 命中 analytic arc emitter。
		// 只有命中本次抽到的 rod 才累加；命中其他 rod 視為遮擋。
		if (hitType == CLOUD_LIGHT && sampleLight == TRUE && uR3EmissionGate > 0.5)
		{
			int cloudRodIdx = int(hitObjectID - uCloudObjIdBase + 0.5);
			cloudRodIdx = clamp(cloudRodIdx, 0, 3);
			if (diffuseCount == 0)
				pixelSharpness = 1.0;
			if (lastNeePickedIdx == cloudRodIdx + 7)
			{
				float wNee = misPowerWeight(misWPrimaryNeeLast, misPBsdfNeeLast);
				vec3 cloudNeeContribution = cloudDarkVisibleSurfaceCleanupContribution(mask * wNee, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition, lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition);
				cloudNeeContribution = cloudSameSurfaceDarkFillContribution(cloudNeeContribution, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition, diffuseCount);
				if (uCloudMisWeightProbeMode > 0)
				{
					if (uCloudContributionProbeMode == 1)
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 4 && diffuseCount == 0)
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 5 && diffuseCount >= 1)
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 6 && diffuseCount >= 1 && cloudDirectNeeSourceIsFloor(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 7 && diffuseCount >= 1 && cloudDirectNeeSourceIsGik(lastNeeSourceHitType))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 8 && diffuseCount >= 1 && !cloudDirectNeeSourceIsFloor(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition) && !cloudDirectNeeSourceIsGik(lastNeeSourceHitType))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 9 && diffuseCount >= 1 && cloudDirectNeeSourceIsCeiling(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 10 && diffuseCount >= 1 && cloudDirectNeeSourceIsWall(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 11 && diffuseCount >= 1 && !cloudDirectNeeSourceIsFloor(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition) && !cloudDirectNeeSourceIsGik(lastNeeSourceHitType) && !cloudDirectNeeSourceIsCeiling(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition) && !cloudDirectNeeSourceIsWall(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 12 && diffuseCount >= 1 && cloudVisibleSurfaceIsFloor(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 13 && diffuseCount >= 1 && cloudVisibleSurfaceIsGik(firstVisibleHitType))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 14 && diffuseCount >= 1 && cloudVisibleSurfaceIsCeiling(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 15 && diffuseCount >= 1 && cloudVisibleSurfaceIsWall(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 16 && diffuseCount >= 1 && cloudVisibleSurfaceIsObject(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode >= 22 && uCloudContributionProbeMode <= 31 && diffuseCount >= 1 && cloudDarkVisibleSurfaceSourceProbeModeMatches(uCloudContributionProbeMode, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition, lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode > 0)
						accumCol += vec3(0.0);
					else
						accumCol += cloudMisWeightProbeDirectNee(wNee, misWPrimaryNeeLast, misPBsdfNeeLast);
				}
				else
					accumCol += cloudNeeContribution;
			}
			if (uCloudMisWeightProbeMode > 0) { break; }
			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			break;
		}

		if (sampleLight == TRUE)
		{
			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;

				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}

			break;
		}

		if (hitType == BACKDROP)
		{
			if (uCloudMisWeightProbeMode > 0) { break; }
			// 只渲染面向室內的 -Z 面
			if (hitNormal.z < -0.5)
			{
				vec3 hitPoint = rayOrigin + rayDirection * t;
				vec3 center = (hitBoxMin + hitBoxMax) * 0.5;
				vec3 half_s = (hitBoxMax - hitBoxMin) * 0.5;
				vec3 localPos = hitPoint - center;
				vec2 uv = vec2(-localPos.x / half_s.x * 0.5 + 0.5, localPos.y / half_s.y * 0.5 + 0.5);
				accumCol = mask * pow(texture(uWinTex, uv).rgb, vec3(2.2));
			}
			break;
		}

		if (hitType == SPEAKER)
		{
			// 喇叭正面/背面貼圖
			vec3 aON = abs(hitObjNormal);
			if (aON.z > 0.5)
			{
				vec2 uv;
				uv.x = (hitObjNormal.z > 0.0) ? (hitObjPos.x / hitObjHalf.x * 0.5 + 0.5) : (-hitObjPos.x / hitObjHalf.x * 0.5 + 0.5);
				uv.y = hitObjPos.y / hitObjHalf.y * 0.5 + 0.5;
				if (hitObjNormal.z < -0.5)
					hitColor = pow(texture(u150F, uv).rgb, vec3(2.2));
				else
					hitColor = pow(texture(u150B, uv).rgb, vec3(2.2));
			}
			// R2-18 Step 5：per-box hitMetalness 切金屬路徑（Step 6 GUI multiplier 可調）
			bool r739SpeakerReferenceDisabled = r739C1ReflectionReferenceDisablesTarget(hitType, hitObjectID, nl, x);
			if (!r739SpeakerReferenceDisabled && hitRoughness < 0.999) {
				float speakerCosI = max(0.0, dot(-rayDirection, nl));
				float speakerF = 0.04 + 0.96 * pow(1.0 - speakerCosI, 5.0);
				if (rand() < speakerF) {
					mask *= hitColor;
					vec3 speakerReflDir = reflect(rayDirection, nl);
					vec3 speakerDiffDir = randomCosWeightedDirectionInHemisphere(nl);
					rayDirection = normalize(mix(speakerReflDir, speakerDiffDir, hitRoughness * hitRoughness));
					rayOrigin = x + nl * uEPS_intersect;
					continue;
				}
			}
			if (!r739SpeakerReferenceDisabled && rand() < hitMetalness) {
				mask *= hitColor;
				vec3 reflDir = reflect(rayDirection, nl);
				vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
				rayDirection = normalize(mix(reflDir, diffDir, hitRoughness * hitRoughness));
				rayOrigin = x + nl * uEPS_intersect;
				continue;
			}
			// 其他面保持 C_SPEAKER 顏色，以 DIFF 方式繼續
			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			lastNeeSourceNormal = nl;
			lastNeeSourcePosition = x;
			continue;
		}

    if (hitType == WOOD_DOOR)
		{
			// 木門：Z 面貼圖，其餘面用 C_WOOD 漫射
			vec3 aN = abs(hitNormal);
			if (aN.z > 0.5)
			{
				vec3 hp = rayOrigin + rayDirection * t;
				vec3 ctr = (hitBoxMin + hitBoxMax) * 0.5;
				vec3 hs = (hitBoxMax - hitBoxMin) * 0.5;
				vec3 lp = hp - ctr;
				vec2 uv = vec2(lp.x / hs.x * 0.5 + 0.5, lp.y / hs.y * 0.5 + 0.5);
				hitColor = pow(texture(uWoodDoorTex, uv).rgb, vec3(2.2));
			}
			// 以 DIFF 方式繼續
			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			lastNeeSourceNormal = nl;
			lastNeeSourcePosition = x;
			continue;
		}

		if (hitType == IRON_DOOR)
		{
				// 鐵門：維持舊 live 金屬分支；bake 只替代 fallback 光照。
			bool r7310IronDoorDiffuseLightBake = uR738C1BakeCaptureMode == 2 && uR738C1BakePatchId == 230001 && uR738C1BakeDiffuseOnlyMode > 0.5;
				if (uR7310C1IronDoorPlanarReflectionCaptureExcludeDoor > 0.5)
				{
					rayOrigin = x + rayDirection * 0.12;
					continue;
				}
				vec3 aN = abs(hitNormal);
				if (aN.x > 0.5)
				{
					vec3 hp = rayOrigin + rayDirection * t;
					vec3 ctr = (hitBoxMin + hitBoxMax) * 0.5;
					vec3 hs = (hitBoxMax - hitBoxMin) * 0.5;
					vec3 lp = hp - ctr;
					vec2 uv = vec2(-lp.z / hs.z * 0.5 + 0.5, lp.y / hs.y * 0.5 + 0.5);
					hitColor = pow(texture(uIronDoorTex, uv).rgb, vec3(2.2));
				}
				float ironM = clamp(hitMetalness * uIronDoorMetalnessScale, 0.0, 1.0);
				float ironR = clamp(hitRoughness * uIronDoorRoughnessScale, 0.0, 1.0);
				float r7310IronDoorRuntimePlanarRoughness = ironR;
				bool r7310IronDoorBodyHybrid = r7310C1IronDoorBodyHybridActive(hitType, hitObjectID, nl, x);
				bool r7310IronDoorMainFlatPlateCandidate = r7310C1IronDoorMainFlatPlateMask(hitType, hitObjectID, nl, x);
				vec3 r7310IronDoorBodyBakedRadiance = r7310IronDoorBodyHybrid ? r7310C1IronDoorBodyHybridRadiance(hitType, hitObjectID, nl, x) : vec3(0.0);
				bool r7310IronDoorRuntimePlanarDebugReady =
					uR7310C1IronDoorRuntimePlanarReflectionMode > 0.5 &&
					uR7310C1IronDoorRuntimePlanarReflectionReady > 0.5 &&
					r7310IronDoorBodyHybrid &&
					r7310IronDoorMainFlatPlateCandidate;
				bool r7310IronDoorCapturedPlanarDebugReady =
					uR7310C1IronDoorPlanarReflectionMode > 0.5 &&
					uR7310C1IronDoorPlanarReflectionReady > 0.5 &&
					r7310IronDoorBodyHybrid &&
					r7310IronDoorMainFlatPlateCandidate;
				bool r7310IronDoorBodyBakeOnlyDebug = r7310IronDoorBodyHybrid &&
					uR7310C1IronDoorBodyDebugMode > 0.5 &&
					uR7310C1IronDoorBodyDebugMode < 1.5;
				if (uR7310C1IronDoorBodyDebugMode > 2.5 &&
					uR7310C1IronDoorBodyDebugMode < 3.5)
				{
					bool r7310IronDoorBodyDebugHit = r7310C1RuntimeSurfaceIsIronDoorBody(hitType, hitObjectID, nl, x);
					accumCol += mask * (r7310IronDoorBodyDebugHit ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 1.0));
					break;
				}
				if (uR7310C1IronDoorBodyDebugMode > 3.5 &&
					uR7310C1IronDoorBodyDebugMode < 4.5)
				{
					vec2 r7310IronDoorPlanarDebugUv = vec2(0.5);
					bool r7310IronDoorPlanarDebugValid = r7310IronDoorRuntimePlanarDebugReady
						? r7310C1IronDoorRuntimePlanarReflectionUv(x, r7310IronDoorPlanarDebugUv)
						: r7310C1IronDoorPlanarReflectionUv(x, r7310IronDoorPlanarDebugUv);
					accumCol += mask * (r7310IronDoorPlanarDebugValid
						? vec3(r7310IronDoorPlanarDebugUv, 0.25)
						: vec3(1.0, 0.0, 1.0));
					break;
				}
				if (uR7310C1IronDoorBodyDebugMode > 4.5 &&
					uR7310C1IronDoorBodyDebugMode < 5.5)
				{
					accumCol += mask * (r7310IronDoorMainFlatPlateCandidate
						? vec3(0.0, 1.0, 0.35)
						: vec3(0.35, 0.05, 0.85));
					break;
				}
				if (uR7310C1IronDoorBodyDebugMode > 5.5 &&
					uR7310C1IronDoorBodyDebugMode < 6.5)
				{
					vec3 r7310IronDoorPlanarDebugRadiance = r7310IronDoorRuntimePlanarDebugReady
						? r7310C1IronDoorRuntimePlanarReflectionRadiance(x, rayDirection, nl, r7310IronDoorRuntimePlanarRoughness)
						: (r7310IronDoorCapturedPlanarDebugReady
							? r7310C1IronDoorPlanarReflectionRadiance(x, ironR)
							: vec3(1.0, 0.0, 1.0));
					accumCol += mask * r7310IronDoorPlanarDebugRadiance;
					break;
				}
				if (uR7310C1IronDoorBodyDebugMode > 6.5 &&
					uR7310C1IronDoorBodyDebugMode < 7.5)
				{
					accumCol += mask * hitColor;
					break;
				}
				if (uR7310C1IronDoorBodyDebugMode > 7.5 &&
					uR7310C1IronDoorBodyDebugMode < 8.5)
				{
					vec3 r7310IronDoorPlanarProductDebugRadiance =
						r7310IronDoorRuntimePlanarDebugReady
							? r7310C1IronDoorRuntimePlanarReflectionRadiance(x, rayDirection, nl, r7310IronDoorRuntimePlanarRoughness)
							: (r7310IronDoorCapturedPlanarDebugReady
								? r7310C1IronDoorPlanarReflectionRadiance(x, ironR)
								: vec3(1.0, 0.0, 1.0));
					vec3 r7310IronDoorPlanarProductDebugSpecularWeight =
						r7310IronDoorRuntimePlanarDebugReady
							? r7310C1IronDoorRuntimePlanarReflectionSpecularWeight(hitColor, rayDirection, nl, r7310IronDoorRuntimePlanarRoughness)
							: hitColor;
					accumCol += mask * r7310IronDoorPlanarProductDebugRadiance * r7310IronDoorPlanarProductDebugSpecularWeight * ironM;
					break;
				}
				if (uR7310C1IronDoorRuntimePlanarReflectionMode > 0.5 &&
					uR7310C1IronDoorRuntimePlanarReflectionReady > 0.5 &&
					r7310IronDoorBodyHybrid &&
					r7310IronDoorMainFlatPlateCandidate &&
					!r7310IronDoorDiffuseLightBake &&
					!r7310IronDoorBodyBakeOnlyDebug)
				{
					vec3 r7310IronDoorRuntimePlanarRadiance = r7310C1IronDoorRuntimePlanarReflectionRadiance(x, rayDirection, nl, r7310IronDoorRuntimePlanarRoughness);
					vec3 r7310IronDoorRuntimePlanarSpecularWeight = r7310C1IronDoorRuntimePlanarReflectionSpecularWeight(hitColor, rayDirection, nl, r7310IronDoorRuntimePlanarRoughness);
					vec3 r7310IronDoorRuntimePlanarBase = r7310IronDoorRuntimePlanarRadiance * r7310IronDoorRuntimePlanarSpecularWeight * ironM;
					vec3 r7310IronDoorRuntimePlanarDiffuse = r7310IronDoorBodyBakedRadiance * hitColor * (1.0 - ironM);
					accumCol += mask * (r7310IronDoorRuntimePlanarBase + r7310IronDoorRuntimePlanarDiffuse);
					break;
				}
				if (uR7310C1IronDoorPlanarReflectionMode > 0.5 &&
					uR7310C1IronDoorPlanarReflectionReady > 0.5 &&
					r7310IronDoorBodyHybrid &&
					r7310IronDoorMainFlatPlateCandidate &&
					!r7310IronDoorDiffuseLightBake &&
					!r7310IronDoorBodyBakeOnlyDebug)
				{
					vec3 r7310IronDoorPlanarRadiance = r7310C1IronDoorPlanarReflectionRadiance(x, ironR);
					vec3 r7310IronDoorPlanarBase = r7310IronDoorPlanarRadiance * hitColor * ironM;
					vec3 r7310IronDoorPlanarDiffuse = r7310IronDoorBodyBakedRadiance * hitColor * (1.0 - ironM);
					accumCol += mask * (r7310IronDoorPlanarBase + r7310IronDoorPlanarDiffuse);
					break;
				}
				if (uR7310C1IronDoorReflectionProbeMode > 0.5 &&
					uR7310C1IronDoorReflectionProbeReady > 0.5 &&
					r7310IronDoorBodyHybrid &&
					r7310IronDoorMainFlatPlateCandidate &&
					!r7310IronDoorDiffuseLightBake &&
					!r7310IronDoorBodyBakeOnlyDebug)
				{
					vec3 r7310IronDoorProbeRadiance = r7310C1IronDoorCapturedProbeRadiance(x, reflect(rayDirection, nl), ironR);
					vec3 r7310IronDoorProbeBase = r7310IronDoorProbeRadiance * hitColor * ironM;
					vec3 r7310IronDoorProbeDiffuse = r7310IronDoorBodyBakedRadiance * hitColor * (1.0 - ironM);
					accumCol += mask * (r7310IronDoorProbeBase + r7310IronDoorProbeDiffuse);
					break;
				}
				if (!r7310IronDoorDiffuseLightBake &&
					!r7310IronDoorBodyBakeOnlyDebug &&
					!r739C1ReflectionReferenceDisablesTarget(hitType, hitObjectID, nl, x) &&
						rand() < ironM) {
						mask *= hitColor;
					vec3 reflDir = reflect(rayDirection, nl);
					vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
					rayDirection = normalize(mix(reflDir, diffDir, ironR * ironR));
					rayOrigin = x + nl * uEPS_intersect;
					continue;
				}
				if (r7310IronDoorBodyHybrid && uR7310C1IronDoorBodyDebugMode < 1.5)
				{
						accumCol += mask * r7310IronDoorBodyBakedRadiance * hitColor;
					break;
				}
			// 漫射 fallback（bake capture 或 runtime package 未啟用時）
			diffuseCount++;
			if (!(uR7310C1SeparatedBakeMode > 0.5 && r7310IronDoorDiffuseLightBake))
					mask *= hitColor;
			bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces) {
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			continue;
		}

		if (hitType == SUBWOOFER)
		{
			// KH750：Z 面正背面貼圖，其餘面用 C_SPEAKER 漫射
			vec3 aN = abs(hitNormal);
			if (aN.z > 0.5)
			{
				vec3 hp = rayOrigin + rayDirection * t;
				vec3 ctr = (hitBoxMin + hitBoxMax) * 0.5;
				vec3 hs = (hitBoxMax - hitBoxMin) * 0.5;
				vec3 lp = hp - ctr;
				vec2 uv;
				uv.x = (hitNormal.z > 0.0) ? (lp.x / hs.x * 0.5 + 0.5) : (-lp.x / hs.x * 0.5 + 0.5);
				uv.y = lp.y / hs.y * 0.5 + 0.5;
				if (hitNormal.z > 0.5)
					hitColor = pow(texture(u750F, uv).rgb, vec3(2.2));
				else
					hitColor = pow(texture(u750B, uv).rgb, vec3(2.2));
			}
			// R2-18 Step 5：per-box hitMetalness 切金屬路徑（Step 6 GUI multiplier 可調）
			if (rand() < hitMetalness) {
				mask *= hitColor;
				vec3 reflDir = reflect(rayDirection, nl);
				vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
				rayDirection = normalize(mix(reflDir, diffDir, hitRoughness * hitRoughness));
				rayOrigin = x + nl * uEPS_intersect;
				continue;
			}
			// 預設 roughness 0.4, metalness 0.0：純漫反射
			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			continue;
		}

		if (hitType == ACOUSTIC_PANEL)
		{
			// GIK 吸音板：依法向量面朝向計算 UV，hitMeta 選擇灰/白貼圖
			// R2-LOGO-FIX：偵測薄軸，側面沿薄軸方向改取正面貼圖的中央細條
			//   （維持正面紋理密度，避免側面把整張貼圖含 LOGO 拉伸覆蓋）
			vec3 aN = abs(hitNormal);
			vec3 hp = rayOrigin + rayDirection * t;
			vec3 ctr = (hitBoxMin + hitBoxMax) * 0.5;
			vec3 hs = (hitBoxMax - hitBoxMin) * 0.5;
			vec3 lp = hp - ctr;
			vec2 uv;

			float minHS = min(hs.x, min(hs.y, hs.z));
			bool thinIsX = (hs.x <= minHS + 1e-5);
			bool thinIsY = (hs.y <= minHS + 1e-5);
			bool thinIsZ = (hs.z <= minHS + 1e-5);
			// 正面以非薄軸中較長者為紋理密度基準
			float maxFront = thinIsX ? max(hs.y, hs.z) : (thinIsY ? max(hs.x, hs.z) : max(hs.x, hs.y));
			float thinDenom = 2.0 * maxFront; // 薄軸 UV 以此為分母 → 正面同密度

			if (aN.x > 0.5)
			{
				// 法向沿 X：uv.x 對應 Z 軸，uv.y 對應 Y 軸
				float uxDen = thinIsZ ? thinDenom : (2.0 * hs.z);
				float uyDen = thinIsY ? thinDenom : (2.0 * hs.y);
				float uxSign = (hitNormal.x > 0.0) ? -1.0 : 1.0;
				uv.x = 0.5 + uxSign * lp.z / uxDen;
				uv.y = 0.5 + lp.y / uyDen;
			}
			else if (aN.y > 0.5)
			{
				// 法向沿 Y：uv.x 對應 X 軸，uv.y 對應 Z 軸（反向）
				// R2-18 fix17：天花板 Cloud（hitNormal.y < 0）時 X 翻轉，令 LOGO 落右上角
				float uxDen = thinIsX ? thinDenom : (2.0 * hs.x);
				float uyDen = thinIsZ ? thinDenom : (2.0 * hs.z);
				float uxSign = (hitNormal.y < 0.0) ? -1.0 : 1.0;
				uv.x = 0.5 + uxSign * lp.x / uxDen;
				uv.y = 0.5 + (-lp.z) / uyDen;
			}
			else
			{
				// 法向沿 Z：uv.x 對應 X 軸，uv.y 對應 Y 軸
				float uxDen = thinIsX ? thinDenom : (2.0 * hs.x);
				float uyDen = thinIsY ? thinDenom : (2.0 * hs.y);
				float uxSign = (hitNormal.z > 0.0) ? 1.0 : -1.0;
				uv.x = 0.5 + uxSign * lp.x / uxDen;
				uv.y = 0.5 + lp.y / uyDen;
			}

			// R7-3-x：rotateUV90 box（北牆橫擺 N1/N2/N3）將三個面共用的 UV 整體順時針 90° 旋轉，
			//        讓 1440×2912 直擺貼圖映射到 X 長 / Y 短的橫擺面板上不被拉寬壓扁，
			//        正面與上下側、左右側同步旋轉，維持 R2-LOGO-FIX 接縫關係不變
			if (hitRotateUV90 > 0.5)
			{
				vec2 rel = uv - vec2(0.5);
				uv = vec2(0.5 - rel.y, 0.5 + rel.x);
			}

			vec3 rawTexCol;
			if (hitMeta < 0.5)
				rawTexCol = texture(uGikGrayTex, uv).rgb;
			else
				rawTexCol = texture(uGikWhiteTex, uv).rgb;

			hitColor = pow(rawTexCol, vec3(2.2)) * 0.7;

			// R2-16 Cloud 吸音板 DASH 拼縫虛線（天花板向下面）
			// 觸發：Box 中心 y > 2.7m（排除牆面吸音板）且命中面法線朝下
			// Z 向縫 4 條（x = ±0.9 外邊界、±0.3 內縫）；X 向縫 3 條（z = -0.702, +0.498, +1.698）
			// 週期 6cm：4cm 實 + 2cm 空；命中時 hitColor=vec3(1.0) 覆寫為純白
			if (ctr.y > 2.7 && hitNormal.y < -0.5)
			{
				bool isLine = false;
				if (hp.z > -0.702 && hp.z < 1.698)
				{
					if (abs(hp.x + 0.9) < 0.001 || abs(hp.x + 0.3) < 0.001 ||
					    abs(hp.x - 0.3) < 0.001 || abs(hp.x - 0.9) < 0.001)
					{
						if (mod(hp.z + 10.0, 0.06) < 0.04) isLine = true;
					}
				}
				if (hp.x > -0.9 && hp.x < 0.9)
				{
					if (abs(hp.z + 0.702) < 0.001 ||
					    abs(hp.z - 0.498) < 0.001 ||
					    abs(hp.z - 1.698) < 0.001)
					{
						if (mod(hp.x + 10.0, 0.06) < 0.04) isLine = true;
					}
				}
				if (isLine) hitColor = vec3(1.0);
			}

			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			continue;
		}

		if (hitType == TRACK)
		{
			// R2-18 Phase 2：軌道+燈具束包覆寫 + metal gate
			hitRoughness = uFixtureRoughness;
			hitMetalness = uFixtureMetalness;
			if (rand() < hitMetalness) {
				mask *= hitColor;
				vec3 reflDir = reflect(rayDirection, nl);
				vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
				rayDirection = normalize(mix(reflDir, diffDir, hitRoughness * hitRoughness));
				rayOrigin = x + nl * uEPS_intersect;
				continue;
			}
			// R2-14 真修：軌道純白漫射，無孔、無貼圖、吃降噪
			// 邏輯等同 DIFF，獨立分支避免未來再與插座材質糾纏
			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			continue;
		}

		// R3-4 fix04：TRACK_LIGHT 分支已前移至 L830 附近（NEE-miss handler 之前），此處原複本移除以免死碼誤導

		if (hitType == OUTLET)
		{
			// 插座面板：白色漫射 + 物理座標插孔（參考舊專案）
			vec3 hp = rayOrigin + rayDirection * t;
			vec3 ctr = (hitBoxMin + hitBoxMax) * 0.5;
			vec3 hs = (hitBoxMax - hitBoxMin) * 0.5;
			vec3 lp = hp - ctr;
			vec3 aN = abs(hitNormal);

			// 只在正面（深度最薄軸）繪製插孔
			bool isFront = (aN.x > 0.5 && hs.x < 0.01) ||
			               (aN.y > 0.5 && hs.y < 0.01) ||
			               (aN.z > 0.5 && hs.z < 0.01);

			if (isFront)
			{
				// u = 寬度軸座標（公尺），與舊專案相同邏輯
				float u = (hs.x > hs.z) ? lp.x : lp.z;
				float u_r = abs(u) - 0.025;
				bool isHole = false;

				if (hs.y > 0.04) // 雙聯插座（高度 > 8cm）
				{
					if (lp.y > 0.0)
						isHole = abs(u_r) < 0.008 && (abs(lp.y - 0.025 - 0.008) < 0.002 || abs(lp.y - 0.025 + 0.008) < 0.002);
					else
						isHole = abs(u) < 0.015 && abs(lp.y + 0.025) < 0.015;
				}
				else // 單聯插座
					isHole = abs(u_r) < 0.008 && (abs(lp.y - 0.008) < 0.002 || abs(lp.y + 0.008) < 0.002);

				if (isHole)
					hitColor = vec3(0.0);
			}

			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			continue;
		}

    if (hitType == LAMP_SHELL)
    {
			// R2-11 燈具外殼：相機直視 / 鏡面反射看見 → 視為發光（殼整顆亮）
			// 間接 diffuse bounce 打到 → 按 DIFF 處理（維持天花板漸層、不產生陰影）
			if (bounceIsSpecular == TRUE)
			{
				if (uCloudMisWeightProbeMode > 0) { break; }
				accumCol = mask * hitEmission;
				break;
			}
			// R2-18 Phase 2：軌道+燈具束包覆寫 + metal gate
			hitRoughness = uFixtureRoughness;
			hitMetalness = uFixtureMetalness;
			if (rand() < hitMetalness) {
				mask *= hitColor;
				vec3 reflDir = reflect(rayDirection, nl);
				vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
				rayDirection = normalize(mix(reflDir, diffDir, hitRoughness * hitRoughness));
				rayOrigin = x + nl * uEPS_intersect;
				continue;
			}
			// 以下與標準 DIFF 分支相同
			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			continue;
		}

    if (hitType == CLOUD_LIGHT)
    {
			// R6-3 Phase 1C：Cloud hit 來自 analytic 1/4 圓弧 diffuser，整個命中面皆為 emissive。
			if (uR3EmissionGate > 0.5)
			{
				int rodIdx = int(hitObjectID - uCloudObjIdBase + 0.5);
				rodIdx = clamp(rodIdx, 0, 3);
				vec3 emission = min(uCloudEmission[rodIdx], vec3(uEmissiveClamp));
				if (diffuseCount == 0)
					pixelSharpness = 1.0;
				if (uCloudMisWeightProbeMode == 7)
				{
					if (diffuseCount >= 1 && misPBsdfStashed > 0.0 && !(uCloudLightEnabled < 0.5))
						accumCol += cloudMisWeightProbeBsdfHitContributionSentinel();
					break;
				}
				if (uCloudMisWeightProbeMode == 6)
				{
					if (diffuseCount >= 1 && misPBsdfStashed > 0.0 && !(uCloudLightEnabled < 0.5))
					{
						float cloudArcArea = uCloudFaceArea[rodIdx] * CLOUD_ARC_AREA_SCALE;
						vec3 reverseEmissionNormal = hitNormal;
						float reverseCloudPdfArea = cloudThetaImportanceEffectiveArcAreaForNormal(rodIdx, cloudArcArea, hitNormal);
						float pNeeReverse = pdfNeeForLight(misBsdfBounceOrigin, x, reverseEmissionNormal, reverseCloudPdfArea, activeLightPickPdfByIndex(rodIdx + 7));
						float wBsdf = misPowerWeight(misPBsdfStashed, pNeeReverse);
						vec3 weightedContribution = min(mask * emission * wBsdf, vec3(uEmissiveClamp));
						vec3 unweightedContribution = min(mask * emission, vec3(uEmissiveClamp));
						accumCol += cloudMisWeightProbeContribution(weightedContribution, unweightedContribution);
					}
					break;
				}
				if (uCloudMisWeightProbeMode > 0)
				{
					if (sampleLight == TRUE && lastNeePickedIdx == rodIdx + 7)
					{
						float wNee = misPowerWeight(misWPrimaryNeeLast, misPBsdfNeeLast);
						vec3 cloudNeeContribution = cloudDarkVisibleSurfaceCleanupContribution(mask * wNee, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition, lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition);
						cloudNeeContribution = cloudSameSurfaceDarkFillContribution(cloudNeeContribution, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition, diffuseCount);
						if (uCloudContributionProbeMode == 1)
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 4 && diffuseCount == 0)
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 5 && diffuseCount >= 1)
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 6 && diffuseCount >= 1 && cloudDirectNeeSourceIsFloor(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 7 && diffuseCount >= 1 && cloudDirectNeeSourceIsGik(lastNeeSourceHitType))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 8 && diffuseCount >= 1 && !cloudDirectNeeSourceIsFloor(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition) && !cloudDirectNeeSourceIsGik(lastNeeSourceHitType))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 9 && diffuseCount >= 1 && cloudDirectNeeSourceIsCeiling(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 10 && diffuseCount >= 1 && cloudDirectNeeSourceIsWall(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 11 && diffuseCount >= 1 && !cloudDirectNeeSourceIsFloor(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition) && !cloudDirectNeeSourceIsGik(lastNeeSourceHitType) && !cloudDirectNeeSourceIsCeiling(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition) && !cloudDirectNeeSourceIsWall(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 12 && diffuseCount >= 1 && cloudVisibleSurfaceIsFloor(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 13 && diffuseCount >= 1 && cloudVisibleSurfaceIsGik(firstVisibleHitType))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 14 && diffuseCount >= 1 && cloudVisibleSurfaceIsCeiling(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 15 && diffuseCount >= 1 && cloudVisibleSurfaceIsWall(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 16 && diffuseCount >= 1 && cloudVisibleSurfaceIsObject(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode >= 22 && uCloudContributionProbeMode <= 31 && diffuseCount >= 1 && cloudDarkVisibleSurfaceSourceProbeModeMatches(uCloudContributionProbeMode, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition, lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode > 0)
							accumCol += vec3(0.0);
						else
							accumCol += cloudMisWeightProbeDirectNee(wNee, misWPrimaryNeeLast, misPBsdfNeeLast);
					}
					else if (diffuseCount >= 1 && misPBsdfStashed > 0.0 && !(uCloudLightEnabled < 0.5))
					{
						float cloudArcArea = uCloudFaceArea[rodIdx] * CLOUD_ARC_AREA_SCALE;
						vec3 reverseEmissionNormal = hitNormal;
						float reverseCloudPdfArea = cloudThetaImportanceEffectiveArcAreaForNormal(rodIdx, cloudArcArea, hitNormal);
						float pNeeReverse = pdfNeeForLight(misBsdfBounceOrigin, x, reverseEmissionNormal, reverseCloudPdfArea, activeLightPickPdfByIndex(rodIdx + 7));
						float wBsdf = misPowerWeight(misPBsdfStashed, pNeeReverse);
						if (uCloudMisWeightProbeMode == 7)
							accumCol += cloudMisWeightProbeBsdfHitContributionSentinel();
						else if (uCloudMisWeightProbeMode == 6)
						{
							vec3 weightedContribution = min(mask * emission * wBsdf, vec3(uEmissiveClamp));
							vec3 unweightedContribution = min(mask * emission, vec3(uEmissiveClamp));
							accumCol += cloudMisWeightProbeContribution(weightedContribution, unweightedContribution);
						}
						else if (uCloudContributionProbeMode == 3)
							accumCol += cloudMisWeightProbeBsdfHitContributionSentinel();
						else if (uCloudContributionProbeMode == 2)
						{
							vec3 weightedContribution = min(mask * emission * wBsdf, vec3(uEmissiveClamp));
							vec3 unweightedContribution = min(mask * emission, vec3(uEmissiveClamp));
							accumCol += cloudMisWeightProbeContribution(weightedContribution, unweightedContribution);
						}
						else if (uCloudContributionProbeMode > 0)
							accumCol += vec3(0.0);
						else if (uCloudMisWeightProbeMode == 3)
							accumCol += vec3(wBsdf, 1.0, 0.0);
						else if (uCloudMisWeightProbeMode == 4)
							accumCol += vec3(pNeeReverse, misPBsdfStashed, 1.0);
					}
					break;
				}
				if (sampleLight == TRUE)
				{
					if (lastNeePickedIdx == rodIdx + 7)
					{
						float wNee = misPowerWeight(misWPrimaryNeeLast, misPBsdfNeeLast);
						accumCol += mask * wNee;
					}
				}
				else if (bounceIsSpecular == TRUE)
				{
					accumCol = min(mask * emission, vec3(uEmissiveClamp));
				}
				else if (diffuseCount >= 1 && misPBsdfStashed > 0.0 && !(uCloudLightEnabled < 0.5))
				{
					float cloudArcArea = uCloudFaceArea[rodIdx] * CLOUD_ARC_AREA_SCALE;
					vec3 rodCenter = uCloudRodCenter[rodIdx];
					vec3 rodHalf = uCloudRodHalfExtent[rodIdx];
					vec3 longAxis = cloudLongAxis(rodIdx);
					vec3 arcCenter = cloudArcCenter(rodIdx, rodCenter, rodHalf);
					float longHalf = cloudLongHalf(rodIdx, rodHalf);
					float reverseLongOffset = clamp(dot(x - arcCenter, longAxis), -longHalf, longHalf);
					vec3 reverseEmissionNormal = (uCloudVisibilityProbeMode > 0) ? -hitNormal : hitNormal;
					float reverseCloudPdfArea = cloudThetaImportanceEffectiveArcAreaForNormal(rodIdx, cloudArcArea, hitNormal);
					float pNeeReverse = pdfNeeForLight(misBsdfBounceOrigin, x, reverseEmissionNormal, reverseCloudPdfArea, activeLightPickPdfByIndex(rodIdx + 7));
					float wBsdf = misPowerWeight(misPBsdfStashed, pNeeReverse);
					accumCol += min(mask * emission * wBsdf, vec3(uEmissiveClamp));
				}
				if (willNeedDiffuseBounceRay == TRUE)
				{
					mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
					rayOrigin = diffuseBounceRayOrigin;
					rayDirection = diffuseBounceRayDirection;
					willNeedDiffuseBounceRay = FALSE;
					bounceIsSpecular = FALSE;
					misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
					sampleLight = FALSE;
					diffuseCount++;
					continue;
				}
				break;
			}
    }

    if (hitType == DIFF)
    {
			vec3 forcedBsdfHitProbe = vec3(0.0);
			if (cloudMisWeightProbeForcedBsdfHit(x, nl, mask * hitColor, forcedBsdfHitProbe))
			{
				accumCol += forcedBsdfHitProbe;
				break;
			}
				// R2-18 fix17：地板磁磚 dielectric Fresnel 分支（hitObjectID=1 結構組 + 頂面 + bmax.y≈0）
				// Schlick F0=0.04，rand()<F 走鏡面（roughness² blur），否則走下方漫射
				bool isFloor = (hitObjectID < 1.5 && hitNormal.y > 0.5 && hitBoxMax.y < 0.1);
				// R4-2C Phase A（CODEX 2026-06-21）：移除 west threshold bake early break（bounce1 中斷→烤黑）。
				bool r738DiffuseOnlyActive = (uR738C1BakeCaptureMode == 2 && uR738C1BakeDiffuseOnlyMode > 0.5);
				bool r7310FloorLiveSpecularActive = uR738C1BakeCaptureMode != 2 ||
					uR7310C1XatlasBakeFullRadianceMode < 0.5;
				vec2 r7310FloorLiveSpecularPageUv = vec2(0.0);
				vec3 r7310FloorLiveSpecularPageRadiance = vec3(0.0);
				bool r7310FloorLiveSpecularPageMapped = isFloor &&
					uR7310C1XatlasRuntimeFullFloorMode > 0.5 &&
					r7310C1XatlasFullFloorPageUv(hitType, hitObjectID, nl, x, r7310FloorLiveSpecularPageUv);
				bool r7310FloorLiveSpecularPageValid = r7310FloorLiveSpecularPageMapped &&
					r7310C1XatlasRuntimeSampleValidLinearFloorPage(r7310FloorLiveSpecularPageUv, r7310FloorLiveSpecularPageRadiance);
				bool r7310FloorLiveSpecularAllowed = true;
				if (isFloor && uR7310C1XatlasRuntimeFullFloorMode > 0.5)
				{
					r7310FloorLiveSpecularAllowed = r7310FloorLiveSpecularPageMapped && r7310FloorLiveSpecularPageValid;
				}
			int r739TargetId = r739C1ReflectionTargetId(hitType, hitObjectID, nl, x);
			float r739EffectiveFloorRoughness = r739C1CurrentViewFloorRoughness(r739TargetId, x);
			bool r739ReferenceDisabled = r739C1ReflectionReferenceDisablesTarget(hitType, hitObjectID, nl, x);
			bool r739ReflectionOnlyTarget = uR739C1ReflectionReferenceMode > 0.5 &&
				uR739C1ReflectionReferenceMode < 1.5 &&
				r739C1AccurateReflectionReplacesTarget(r739TargetId, x);
			if (isFloor && !r7310FloorFullRadianceBakeFirstHit && r7310FloorLiveSpecularActive && r7310FloorLiveSpecularAllowed && r739ReflectionOnlyTarget) {
				if (r739EffectiveFloorRoughness < 0.999) {
					float cosI = max(0.0, dot(-rayDirection, nl));
					float F = 0.04 + 0.96 * pow(1.0 - cosI, 5.0);
					if (rand() < F) {
						vec3 reflDir = reflect(rayDirection, nl);
						vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
						rayDirection = normalize(mix(reflDir, diffDir, r739EffectiveFloorRoughness * r739EffectiveFloorRoughness));
						rayOrigin = x + nl * uEPS_intersect;
						continue;
					}
				}
				break;
			}
			if (isFloor && !r7310FloorFullRadianceBakeFirstHit && r7310FloorLiveSpecularActive && r7310FloorLiveSpecularAllowed && !r738DiffuseOnlyActive && !r739ReferenceDisabled && r739EffectiveFloorRoughness < 0.999) {
				float cosI = max(0.0, dot(-rayDirection, nl));
				float F = 0.04 + 0.96 * pow(1.0 - cosI, 5.0);
				if (rand() < F) {
					vec3 reflDir = reflect(rayDirection, nl);
					vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
					rayDirection = normalize(mix(reflDir, diffDir, r739EffectiveFloorRoughness * r739EffectiveFloorRoughness));
					rayOrigin = x + nl * uEPS_intersect;
					continue;
				}
			}
			// R2-18 Step 4 金屬路徑切分：per-box hitMetalness 驅動，mix 權重 = roughness²
			if (!r7310FloorFullRadianceBakeFirstHit && !r739ReferenceDisabled && rand() < hitMetalness) {
				mask *= hitColor;
				vec3 reflDir = reflect(rayDirection, nl);
				vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
				rayDirection = normalize(mix(reflDir, diffDir, hitRoughness * hitRoughness));
				rayOrigin = x + nl * uEPS_intersect;
				continue;
			}
			vec3 r7310BakedRadiance = vec3(0.0);
			bool r7310FloorHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				hitIsRayExiting != TRUE &&
				r7310C1FloorHybridActive(hitType, hitObjectID, nl, x);
			bool r7310CeilingHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				hitIsRayExiting != TRUE &&
				r7310C1CeilingHybridActive(hitType, hitObjectID, nl, x);
			bool r7310NorthWallHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1NorthWallHybridActive(hitType, hitObjectID, nl, x);
			bool r7310SeColumnNorthHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1SeColumnNorthShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310SeColumnWestHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1SeColumnWestShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310SouthWallAcHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1SouthWallAcShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310EastWallBeamHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1EastWallBeamShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310EastWallHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1EastWallHybridActive(hitType, hitObjectID, nl, x);
			bool r7310SwColumnNorthHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1SwColumnNorthShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310WestWallBeamHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1WestWallBeamShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310WestWallHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				!r7310WestWallBeamHybridFirstHit &&
				r7310C1WestWallHybridActive(hitType, hitObjectID, nl, x);
			bool r7310SwColumnInnerShadowHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1SwColumnInnerShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310WestBeamInnerShadowHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				!r7310SwColumnInnerShadowHybridFirstHit &&
				r7310C1WestBeamInnerShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310WestBeamUnderShadowHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1WestBeamUnderShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310EastBeamInnerShadowHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1EastBeamInnerShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310EastBeamUnderShadowHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1EastBeamUnderShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310SouthWindowLeftRevealShadowHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1SouthWindowLeftRevealShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310SouthWindowRightRevealShadowHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1SouthWindowRightRevealShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310SouthWindowBottomRevealShadowHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1SouthWindowBottomRevealShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310SouthWindowTopRevealShadowHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1SouthWindowTopRevealShadowHybridActive(hitType, hitObjectID, nl, x);
			bool r7310IronDoorRevealHybridFirstHit = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
				r7310C1IronDoorRevealHybridActive(hitType, hitObjectID, nl, x);
			bool r7310DedicatedCeilingHybridFirstHit =
				r7310SeColumnNorthHybridFirstHit ||
				r7310SeColumnWestHybridFirstHit ||
				r7310SouthWallAcHybridFirstHit ||
				r7310EastWallBeamHybridFirstHit ||
				r7310SwColumnNorthHybridFirstHit ||
				r7310WestWallBeamHybridFirstHit ||
				r7310SwColumnInnerShadowHybridFirstHit ||
				r7310WestBeamInnerShadowHybridFirstHit ||
				r7310WestBeamUnderShadowHybridFirstHit ||
				r7310EastBeamInnerShadowHybridFirstHit ||
				r7310EastBeamUnderShadowHybridFirstHit ||
				r7310SouthWindowLeftRevealShadowHybridFirstHit ||
				r7310SouthWindowRightRevealShadowHybridFirstHit ||
				r7310SouthWindowBottomRevealShadowHybridFirstHit ||
				r7310SouthWindowTopRevealShadowHybridFirstHit ||
				r7310IronDoorRevealHybridFirstHit;
			r7310CeilingHybridFirstHit = r7310CeilingHybridFirstHit && !r7310DedicatedCeilingHybridFirstHit;
			bool r7310FloorHybridGuard = !r7310FloorHybridFirstHit;
			bool r7310CeilingHybridGuard = !r7310CeilingHybridFirstHit;
			bool r7310NorthWallHybridGuard = !r7310NorthWallHybridFirstHit;
			bool r7310SeColumnNorthHybridGuard = !r7310SeColumnNorthHybridFirstHit;
			bool r7310SeColumnWestHybridGuard = !r7310SeColumnWestHybridFirstHit;
			bool r7310SouthWallAcHybridGuard = !r7310SouthWallAcHybridFirstHit;
			bool r7310EastWallBeamHybridGuard = !r7310EastWallBeamHybridFirstHit;
			bool r7310EastWallHybridGuard = !r7310EastWallHybridFirstHit;
			bool r7310SwColumnNorthHybridGuard = !r7310SwColumnNorthHybridFirstHit;
			bool r7310WestWallHybridGuard = !r7310WestWallHybridFirstHit;
			bool r7310WestWallBeamHybridGuard = !r7310WestWallBeamHybridFirstHit;
			bool r7310SwColumnInnerShadowHybridGuard = !r7310SwColumnInnerShadowHybridFirstHit;
			bool r7310WestBeamInnerShadowHybridGuard = !r7310WestBeamInnerShadowHybridFirstHit;
			bool r7310WestBeamUnderShadowHybridGuard = !r7310WestBeamUnderShadowHybridFirstHit;
			bool r7310EastBeamInnerShadowHybridGuard = !r7310EastBeamInnerShadowHybridFirstHit;
			bool r7310EastBeamUnderShadowHybridGuard = !r7310EastBeamUnderShadowHybridFirstHit;
			bool r7310SouthWindowLeftRevealShadowHybridGuard = !r7310SouthWindowLeftRevealShadowHybridFirstHit;
			bool r7310SouthWindowRightRevealShadowHybridGuard = !r7310SouthWindowRightRevealShadowHybridFirstHit;
			bool r7310SouthWindowBottomRevealShadowHybridGuard = !r7310SouthWindowBottomRevealShadowHybridFirstHit;
			bool r7310SouthWindowTopRevealShadowHybridGuard = !r7310SouthWindowTopRevealShadowHybridFirstHit;
			bool r7310IronDoorRevealHybridGuard = !r7310IronDoorRevealHybridFirstHit;
			bool r7310FloorIndirectBakeFirstHit = r7310C1FloorIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310CeilingIndirectBakeFirstHit = r7310C1CeilingIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310NorthWallIndirectBakeFirstHit = r7310C1NorthWallIndirectBakeFirstHit(bounces, diffuseCount);
			// R7-3.10 全域 albedo-free 契約（CODEX 2026-06-16）：任一以 --r7310-separated-irradiance-bake 宣告的 dedicated 烤
			// （captureMode==2、patchId 無關）的「該面自身 first-hit（bounce0/diffuse0）」。供下方跳過 mask*=hitColor，使烤圖只含乾淨 irradiance。
			bool r7310SeparatedDedicatedBakeFirstHit = uR738C1BakeCaptureMode == 2 && bounces == 0 && diffuseCount == 0;
			bool r7310EastWallIndirectBakeFirstHit = r7310C1EastWallIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310SeColumnNorthIndirectBakeFirstHit = r7310C1SeColumnNorthShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310SeColumnWestIndirectBakeFirstHit = r7310C1SeColumnWestShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310SouthWallAcIndirectBakeFirstHit = r7310C1SouthWallAcShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310EastWallBeamIndirectBakeFirstHit = r7310C1EastWallBeamShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310SwColumnNorthIndirectBakeFirstHit = r7310C1SwColumnNorthShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310WestWallIndirectBakeFirstHit = r7310C1WestWallIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310WestWallBeamIndirectBakeFirstHit = r7310C1WestWallBeamShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310SwColumnInnerShadowIndirectBakeFirstHit = r7310C1SwColumnInnerShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310WestBeamInnerShadowIndirectBakeFirstHit = r7310C1WestBeamInnerShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310WestBeamUnderShadowIndirectBakeFirstHit = r7310C1WestBeamUnderShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310EastBeamInnerShadowIndirectBakeFirstHit = r7310C1EastBeamInnerShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310EastBeamUnderShadowIndirectBakeFirstHit = r7310C1EastBeamUnderShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310SouthWindowLeftRevealShadowIndirectBakeFirstHit = r7310C1SouthWindowLeftRevealShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310SouthWindowRightRevealShadowIndirectBakeFirstHit = r7310C1SouthWindowRightRevealShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310SouthWindowBottomRevealShadowIndirectBakeFirstHit = r7310C1SouthWindowBottomRevealShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310SouthWindowTopRevealShadowIndirectBakeFirstHit = r7310C1SouthWindowTopRevealShadowIndirectBakeFirstHit(bounces, diffuseCount);
			bool r7310IronDoorRevealIndirectBakeFirstHit = r7310C1IronDoorRevealIndirectBakeFirstHit(bounces, diffuseCount);
				bool r7310XatlasIndirectBakeFirstHit =
					uR7310C1XatlasBakeMode > 0.5 &&
					r7310C1XatlasBakeTexelValid &&
					bounces == 0 &&
					diffuseCount == 0;
				vec2 r7310XatlasRuntimeAtlasUv = vec2(0.0);
				vec3 r7310XatlasRuntimeSheetRadiance = vec3(0.0);
				bool r7310XatlasRuntimeSheetMapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
					hitIsRayExiting != TRUE &&
					r7310C1XatlasNorthWallUv(hitType, hitObjectID, nl, x, r7310XatlasRuntimeAtlasUv);
				bool r7310XatlasRuntimeSheetFirstHit = r7310XatlasRuntimeSheetMapped &&
					r7310C1XatlasRuntimeSampleValidLinear(r7310XatlasRuntimeAtlasUv, r7310XatlasRuntimeSheetRadiance);
				vec2 r7310XatlasRuntimeFloorPageUv = vec2(0.0);
				vec3 r7310XatlasRuntimeFloorPageRadiance = vec3(0.0);
				bool r7310XatlasRuntimeFloorPageMapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
					hitIsRayExiting != TRUE &&
					uR7310C1XatlasRuntimeFullFloorMode > 0.5 &&
					r7310C1XatlasFullFloorPageUv(hitType, hitObjectID, nl, x, r7310XatlasRuntimeFloorPageUv);
				bool r7310XatlasRuntimeFloorPageFirstHit = r7310XatlasRuntimeFloorPageMapped &&
					r7310C1XatlasRuntimeSampleValidLinearFloorPage(r7310XatlasRuntimeFloorPageUv, r7310XatlasRuntimeFloorPageRadiance);
				vec3 r7310XatlasRuntimeRadiance = r7310XatlasRuntimeFloorPageFirstHit
					? r7310XatlasRuntimeFloorPageRadiance
					: r7310XatlasRuntimeSheetRadiance;
				bool r7310XatlasRuntimeMapped = r7310XatlasRuntimeSheetMapped || r7310XatlasRuntimeFloorPageMapped;
				bool r7310XatlasRuntimeFirstHit = r7310XatlasRuntimeSheetFirstHit || r7310XatlasRuntimeFloorPageFirstHit;
				vec2 r7310XatlasRuntimeNorthAtlasUv = vec2(0.0);
				bool r7310XatlasRuntimeNorthMapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
					hitIsRayExiting != TRUE &&
					uR7310C1XatlasRuntimeFullNorthWallMode > 0.5 &&
					r7310C1XatlasFullNorthWallUv(hitType, hitObjectID, nl, x, r7310XatlasRuntimeNorthAtlasUv);
				bool r7310XatlasRuntimeNorthFirstHit = r7310XatlasRuntimeFirstHit &&
					r7310XatlasRuntimeNorthMapped;
				vec2 r7310XatlasRuntimeEastAtlasUv = vec2(0.0);
				bool r7310XatlasRuntimeEastMapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
					hitIsRayExiting != TRUE &&
					uR7310C1XatlasRuntimeFullEastWallMode > 0.5 &&
					r7310C1XatlasFullEastWallUv(hitType, hitObjectID, nl, x, r7310XatlasRuntimeEastAtlasUv);
				bool r7310XatlasRuntimeEastFirstHit = r7310XatlasRuntimeFirstHit &&
					r7310XatlasRuntimeEastMapped;
				int r7310XatlasRuntimeOwnerId = r7310SurfaceOwnerId(x, nl, hitObjectID);
				vec2 r7310XatlasRuntimeWestAtlasUv = vec2(0.0);
				bool r7310XatlasRuntimeWestMapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
					hitIsRayExiting != TRUE &&
					r7310XatlasRuntimeOwnerId == R7310_OWNER_WEST_WALL_OPEN &&
					uR7310C1XatlasParamWestSurfaceIndex >= 0.0 &&
					r7310C1XatlasParamSurfaceUv(int(uR7310C1XatlasParamWestSurfaceIndex), hitObjectID, nl, x, r7310XatlasRuntimeWestAtlasUv);
				bool r7310XatlasRuntimeWestFirstHit = r7310XatlasRuntimeFirstHit &&
					r7310XatlasRuntimeWestMapped;
				bool r7310XatlasRuntimeWestThresholdTopMapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
					hitIsRayExiting != TRUE &&
					r7310XatlasRuntimeOwnerId == R7310_OWNER_WEST_THRESHOLD_TOP;
				bool r7310XatlasRuntimeWestThresholdTopFirstHit = r7310XatlasRuntimeFirstHit &&
					r7310XatlasRuntimeWestThresholdTopMapped;
				bool r7310XatlasRuntimeWestThresholdFrontMapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
					hitIsRayExiting != TRUE &&
					r7310XatlasRuntimeOwnerId == R7310_OWNER_WEST_THRESHOLD_FRONT;
					bool r7310XatlasRuntimeWestThresholdFrontFirstHit = r7310XatlasRuntimeFirstHit &&
						r7310XatlasRuntimeWestThresholdFrontMapped;
					bool r7310XatlasRuntimeSouthMapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
						hitIsRayExiting != TRUE &&
						r7310XatlasRuntimeOwnerId == R7310_OWNER_SOUTH_WALL;
					bool r7310XatlasRuntimeSouthFirstHit = r7310XatlasRuntimeFirstHit &&
						r7310XatlasRuntimeSouthMapped;
					bool r7310XatlasRuntimeCeilingMapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
						hitIsRayExiting != TRUE &&
						uR7310C1XatlasRuntimeFullCeilingMode > 0.5 &&
						r7310XatlasRuntimeOwnerId == R7310_OWNER_CEILING_OPEN;
					bool r7310XatlasRuntimeCeilingFirstHit = r7310XatlasRuntimeFirstHit &&
						r7310XatlasRuntimeCeilingMapped;
					bool r7310XatlasRuntimeDepthH2Mapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
						hitIsRayExiting != TRUE &&
						uR7310C1XatlasRuntimeFullCeilingMode > 0.5 &&
						r7310XatlasRuntimeOwnerId == R7310_OWNER_SOUTH_WINDOW_TOP_REVEAL_DEPTH;
					bool r7310XatlasRuntimeDepthH2FirstHit = r7310XatlasRuntimeFirstHit &&
						r7310XatlasRuntimeDepthH2Mapped;
					vec2 r7310XatlasRuntimeFloorAtlasUv = vec2(0.0);
					bool r7310XatlasRuntimeFloorMapped = r7310XatlasRuntimeFloorPageMapped;
					bool r7310XatlasRuntimeFloorFirstHit = r7310XatlasRuntimeFloorPageFirstHit;
					bool r7310XatlasRuntimeCentralDeskMapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
						hitIsRayExiting != TRUE &&
						(r7310XatlasRuntimeOwnerId == R7310_OWNER_CENTRAL_DESK_TOP ||
						r7310XatlasRuntimeOwnerId == R7310_OWNER_CENTRAL_DESK_FRONT ||
						r7310XatlasRuntimeOwnerId == R7310_OWNER_CENTRAL_DESK_BACK ||
						r7310XatlasRuntimeOwnerId == R7310_OWNER_CENTRAL_DESK_LEFT ||
						r7310XatlasRuntimeOwnerId == R7310_OWNER_CENTRAL_DESK_RIGHT);
					bool r7310XatlasRuntimeCentralDeskFirstHit = r7310XatlasRuntimeFirstHit &&
						r7310XatlasRuntimeCentralDeskMapped;
					float r7310XatlasRuntimeStructuralIslandId = r7310C1StructuralBeamColumnIslandId(hitType, hitObjectID, nl, x);
					bool r7310XatlasRuntimeStructuralMapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
						hitIsRayExiting != TRUE &&
						r7310XatlasRuntimeStructuralIslandId > 0.5;
					bool r7310XatlasRuntimeStructuralFirstHit = r7310XatlasRuntimeFirstHit &&
						r7310XatlasRuntimeStructuralMapped;
					bool r7310XatlasRuntimeSouthWindowRevealsMapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
						hitIsRayExiting != TRUE &&
						(r7310XatlasRuntimeOwnerId == R7310_OWNER_SOUTH_WINDOW_LEFT_REVEAL ||
						r7310XatlasRuntimeOwnerId == R7310_OWNER_SOUTH_WINDOW_RIGHT_REVEAL ||
						r7310XatlasRuntimeOwnerId == R7310_OWNER_SOUTH_WINDOW_BOTTOM_REVEAL);
					bool r7310XatlasRuntimeSouthWindowRevealsFirstHit = r7310XatlasRuntimeFirstHit &&
						r7310XatlasRuntimeSouthWindowRevealsMapped;
					bool r7310XatlasRuntimeWestWallSwitchMapped = r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
						hitIsRayExiting != TRUE &&
						(r7310XatlasRuntimeOwnerId == R7310_OWNER_WEST_WALL_SWITCH_PLATE ||
						r7310XatlasRuntimeOwnerId == R7310_OWNER_WEST_WALL_SWITCH_BUTTON);
					bool r7310XatlasRuntimeWestWallSwitchFirstHit = r7310XatlasRuntimeFirstHit &&
						r7310XatlasRuntimeWestWallSwitchMapped;
					bool r7310XatlasRuntimeFullBakeWestClaimed =
						(uR7310C1XatlasRuntimeFullWestWallDirectIncluded > 0.5 && r7310XatlasRuntimeWestMapped) ||
						(uR7310C1XatlasRuntimeWestThresholdTopDirectIncluded > 0.5 && r7310XatlasRuntimeWestThresholdTopMapped) ||
						(uR7310C1XatlasRuntimeWestThresholdFrontDirectIncluded > 0.5 && r7310XatlasRuntimeWestThresholdFrontMapped);
					bool r7310XatlasRuntimeFullBakeNorthClaimed =
						uR7310C1XatlasRuntimeFullNorthWallDirectIncluded > 0.5 &&
						r7310XatlasRuntimeNorthMapped;
					bool r7310XatlasRuntimeFullBakeEastClaimed =
						uR7310C1XatlasRuntimeFullEastWallDirectIncluded > 0.5 &&
						r7310XatlasRuntimeEastMapped;
					bool r7310XatlasRuntimeFullBakeSouthClaimed =
						uR7310C1XatlasRuntimeFullSouthWallDirectIncluded > 0.5 &&
						r7310XatlasRuntimeSouthMapped;
					bool r7310XatlasRuntimeFullBakeCeilingClaimed =
						uR7310C1XatlasRuntimeFullCeilingDirectIncluded > 0.5 &&
						r7310XatlasRuntimeCeilingMapped;
					bool r7310XatlasRuntimeFullBakeDepthH2Claimed =
						uR7310C1XatlasRuntimeDepthH2DirectIncluded > 0.5 &&
						r7310XatlasRuntimeDepthH2Mapped;
					bool r7310XatlasRuntimeFullBakeFloorClaimed =
						uR7310C1XatlasRuntimeFullFloorDirectIncluded > 0.5 &&
						r7310XatlasRuntimeFloorMapped;
					bool r7310XatlasRuntimeFullBakeCentralDeskClaimed =
						uR7310C1XatlasRuntimeCentralDeskDirectIncluded > 0.5 &&
						r7310XatlasRuntimeCentralDeskMapped;
					bool r7310XatlasRuntimeFullBakeStructuralClaimed =
						uR7310C1XatlasRuntimeStructuralDirectIncluded > 0.5 &&
						r7310XatlasRuntimeStructuralMapped;
					bool r7310XatlasRuntimeFullBakeSouthWindowRevealsClaimed =
						uR7310C1XatlasRuntimeSouthWindowRevealsDirectIncluded > 0.5 &&
						r7310XatlasRuntimeSouthWindowRevealsMapped;
					bool r7310XatlasRuntimeFullBakeWestWallSwitchClaimed =
						uR7310C1XatlasRuntimeWestWallSwitchDirectIncluded > 0.5 &&
						r7310XatlasRuntimeWestWallSwitchMapped;
					bool r7310XatlasRuntimeFullBakeRouteMissIsDebugError =
						(r7310XatlasRuntimeFullBakeWestClaimed ||
						r7310XatlasRuntimeFullBakeNorthClaimed ||
						r7310XatlasRuntimeFullBakeEastClaimed ||
						r7310XatlasRuntimeFullBakeSouthClaimed ||
						r7310XatlasRuntimeFullBakeCeilingClaimed ||
						r7310XatlasRuntimeFullBakeDepthH2Claimed ||
						r7310XatlasRuntimeFullBakeCentralDeskClaimed ||
						r7310XatlasRuntimeFullBakeStructuralClaimed ||
						r7310XatlasRuntimeFullBakeSouthWindowRevealsClaimed ||
						r7310XatlasRuntimeFullBakeWestWallSwitchClaimed) &&
						!r7310XatlasRuntimeFirstHit;
					bool r7310XatlasRuntimeFloorFootprintHoleFallsBackToLive =
						r7310XatlasRuntimeFullBakeFloorClaimed &&
						!r7310XatlasRuntimeFloorFirstHit;
#if defined(R7310_INCLUDE_DEBUG_PROBES)
				float r7310C1RuntimeProbeMode = uR7310C1RuntimeProbeMode;
				if (bounces == 0 &&
					r7310C1RuntimeProbeMode > 66.5 &&
					r7310C1RuntimeProbeMode < 69.5)
				{
					bool r7310XatlasRuntimeAnyClaimed =
						r7310XatlasRuntimeFullBakeWestClaimed ||
						r7310XatlasRuntimeFullBakeNorthClaimed ||
						r7310XatlasRuntimeFullBakeEastClaimed ||
						r7310XatlasRuntimeFullBakeSouthClaimed ||
						r7310XatlasRuntimeFullBakeCeilingClaimed ||
						r7310XatlasRuntimeFullBakeDepthH2Claimed ||
						r7310XatlasRuntimeFullBakeCentralDeskClaimed ||
						r7310XatlasRuntimeFullBakeStructuralClaimed ||
						r7310XatlasRuntimeFullBakeSouthWindowRevealsClaimed ||
						r7310XatlasRuntimeFullBakeWestWallSwitchClaimed;
					if (r7310C1RuntimeProbeMode < 67.5)
					{
						accumCol = vec3(
							r7310XatlasRuntimeSheetMapped ? 1.0 : 0.0,
							r7310XatlasRuntimeSheetFirstHit ? 1.0 : 0.0,
							r7310XatlasRuntimeAnyClaimed ? 1.0 : 0.0
						);
					}
					else if (r7310C1RuntimeProbeMode < 68.5)
					{
						float nearestAlpha = 0.0;
						if (r7310XatlasRuntimeSheetMapped)
						{
							vec2 atlasSize = max(uR7310C1XatlasRuntimeAtlasSize, vec2(1.0));
							vec2 atlasPixel = r7310XatlasRuntimeAtlasUv * atlasSize - vec2(0.5);
							nearestAlpha = r7310C1XatlasRuntimeSampleTexel(floor(atlasPixel + vec2(0.5))).a;
						}
						accumCol = vec3(nearestAlpha, r7310XatlasRuntimeAtlasUv);
					}
					else
					{
						accumCol = vec3(
							clamp(float(r7310XatlasRuntimeOwnerId) / 255.0, 0.0, 1.0),
							clamp(r7310XatlasRuntimeStructuralIslandId / 255.0, 0.0, 1.0),
							clamp(hitObjectID / 255.0, 0.0, 1.0)
						);
					}
					break;
				}
				if (bounces == 1 &&
					uR7310C1XatlasBakeMode > 0.5 &&
					r7310C1RuntimeProbeMode > 56.5 &&
					r7310C1RuntimeProbeMode < 57.5)
				{
				// OPUS 2026-06-09 probe 57（修正版）：second-hit（bounces==1）點的 NEE weight。
				// NEE dispatch 分散在多個 hitType 分支，故在此通用命中點自算一次 NEE，量「未遮擋的 NEE 貢獻權重」。
				// 多 sample 累積平均後 = NEE weight 平均，直接對照 §14.10 CPU 0.0058（非零）。
				// GPU 算 ~0 → raw zero 在 NEE；GPU 算 ~0.0058 → raw zero 在更後面（遮擋／accumulation）。
				// R=G=B=NEE weight luma；輸出後 break；probeMode≠57 不觸發、正常 bake 不受影響。
				vec3 r7310P57NeeDir; vec3 r7310P57NeeT; float r7310P57NeePdf;
				int r7310P57NeeIdx; int r7310P57NeeZero; int r7310P57NeeTheta; vec3 r7310P57NeeFacing;
				r7310P57NeeDir = sampleStochasticLightDynamic(x, nl, light, r7310P57NeeT, r7310P57NeePdf, r7310P57NeeIdx, r7310P57NeeZero, r7310P57NeeTheta, r7310P57NeeFacing);
				float r7310P57NeeW = dot(max(r7310P57NeeT, vec3(0.0)), vec3(0.2126, 0.7152, 0.0722));
				// OPUS 過夜拆解：R=幾何項 max(0,dot(nl,ldir))（選中光源方向）、G=second-hit 法線 nl.y（0.5 水平/1 朝上/0 朝下）、B=NEE weight luma。
				float r7310P57Geom = max(0.0, dot(nl, r7310P57NeeDir));
				// OPUS 過夜第二層：R=second-hit 高度 x.y/3、G=bake ray 入射方向 (rayDirection.y+1)/2、B=幾何項。
				// 解 CPU／GPU 張力：GPU second-hit 實際命中高度（天花板 y≈2.9 還是地板 y≈0）＋ bake ray 朝上還是朝下。
					accumCol = vec3(clamp(x.y / 3.0, 0.0, 1.0), clamp(rayDirection.y * 0.5 + 0.5, 0.0, 1.0), r7310P57Geom);
					break;
				}
				if (bounces == 1 &&
					uR7310C1XatlasBakeMode > 0.5 &&
					r7310C1RuntimeProbeMode > 60.5 &&
					r7310C1RuntimeProbeMode < 61.5)
			{
				// OPUS 2026-06-10 probe 61（CODEX 指定）：accumCol 常數校準。
				// 在 probe 57 同一 bounces==1 可控輸出點輸出固定值，驗證 readback 能讀到原樣數字。
				// 預期 readback (R,G,B)=(0.25,0.5,0.75)；若非，代表 accumCol 在 break 後被後處理（exposure/scale/mask）。
				accumCol = vec3(0.25, 0.5, 0.75);
				break;
			}
			if (bounces == 0 &&
				uR7310C1XatlasBakeMode > 0.5 &&
				r7310C1RuntimeProbeMode > 61.5 &&
				r7310C1RuntimeProbeMode < 66.5)
			{
				// OPUS 2026-06-10 probe 62-66（CODEX 指定）：bounces==0 primary first-hit 診斷。
				// 62=常數校準（驗 bounces==0 是否可控）、63=first-hit nl、64=primary rayDirection、
				// 65=hitType/hitObjectID、66=first-hit worldPos x。break 後不污染；probeMode∉{62..66} 不觸發。
				if (r7310C1RuntimeProbeMode < 62.5) {
					accumCol = vec3(0.25, 0.5, 0.75);
				} else if (r7310C1RuntimeProbeMode < 63.5) {
					accumCol = nl * 0.5 + 0.5;
				} else if (r7310C1RuntimeProbeMode < 64.5) {
					accumCol = rayDirection * 0.5 + 0.5;
				} else if (r7310C1RuntimeProbeMode < 65.5) {
					accumCol = vec3(clamp(float(hitType) / 256.0, 0.0, 1.0), clamp(hitObjectID / 256.0, 0.0, 1.0), 0.0);
				} else {
					accumCol = vec3(clamp((x.x + 1.95) / 3.9, 0.0, 1.0), clamp(x.y / 3.0, 0.0, 1.0), clamp((x.z + 2.1) / 5.2, 0.0, 1.0));
				}
				break;
			}
#endif
			// === R7-3.10 Surface Ownership Map: PENDING owner render path (CODEX step 5) ===
			// The generated owner says this first hit belongs to a not-yet-baked (pending) surface.
			// Show a debug PENDING colour; do NOT fall through to LIVE diffuse / dilation / dark bake.
			// Gated to xatlas runtime + ceiling active so the all-off / hybrid state is unaffected.
			if (bounces == 0 && hitIsRayExiting != TRUE &&
				uR7310C1XatlasRuntimeMode > 0.5 && uR7310C1XatlasRuntimeReady > 0.5 &&
				uR7310C1XatlasRuntimeFullCeilingMode > 0.5 &&
				r7310SurfaceOwnerIsPending(r7310SurfaceOwnerId(x, nl, hitObjectID)))
			{
				accumCol = vec3(1.0, 0.0, 1.0); // PENDING debug magenta — owner 未烘焙，不退 LIVE / 不 dilation / 不取暗烤
				break;
			}
			if (bounces == 0 && hitIsRayExiting != TRUE && uR7310C1WestScopeProbeMode > 0.5)
			{
				int r7310WestProbeOwner = r7310SurfaceOwnerId(x, nl, hitObjectID);
				bool r7310WestProbeOwnerHit = r7310WestProbeOwner == R7310_OWNER_WEST_WALL_OPEN;
				bool r7310WestProbeParamHit = false;
				if (uR7310C1WestScopeProbeMode > 1.5 && uR7310C1XatlasParamWestSurfaceIndex >= 0.0)
				{
					vec2 r7310WestProbeUv = vec2(0.0);
					r7310WestProbeParamHit = r7310C1XatlasParamSurfaceUv(int(uR7310C1XatlasParamWestSurfaceIndex), hitObjectID, nl, x, r7310WestProbeUv);
				}
				if (uR7310C1WestScopeProbeMode < 1.5 && r7310WestProbeOwnerHit)
				{
					accumCol = vec3(1.0, 0.0, 1.0);
					break;
				}
				if (uR7310C1WestScopeProbeMode > 1.5 && uR7310C1WestScopeProbeMode < 2.5 && r7310WestProbeParamHit)
				{
					accumCol = vec3(0.0, 1.0, 1.0);
					break;
				}
				if (uR7310C1WestScopeProbeMode > 2.5 &&
					uR7310C1WestScopeProbeMode < 3.5 &&
					(r7310WestProbeOwnerHit || r7310WestProbeParamHit))
				{
					accumCol = r7310WestProbeOwnerHit && r7310WestProbeParamHit ? vec3(1.0) : (r7310WestProbeOwnerHit ? vec3(1.0, 0.0, 1.0) : vec3(0.0, 1.0, 1.0));
					break;
				}
			}
			float r7310HybridOwnerCount = 0.0;
			float r7310HybridOwnerMaskLow = 0.0;
			float r7310HybridOwnerMaskHigh = 0.0;
			float r7310HybridOwnerFirstTargetOffset = 0.0;
			float r7310HybridOwnerSecondTargetOffset = 0.0;
			r7310HybridOwnerAdd(r7310FloorHybridFirstHit, 1.0, 1.0, 0.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310CeilingHybridFirstHit, 6.0, 2.0, 0.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310NorthWallHybridFirstHit, 2.0, 4.0, 0.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310EastWallHybridFirstHit, 3.0, 8.0, 0.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310WestWallHybridFirstHit, 4.0, 16.0, 0.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310EastBeamInnerShadowHybridFirstHit || r7310EastBeamUnderShadowHybridFirstHit, 17.0, 32.0, 0.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310WestBeamInnerShadowHybridFirstHit || r7310WestBeamUnderShadowHybridFirstHit, 15.0, 64.0, 0.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310SouthWindowTopRevealShadowHybridFirstHit, 22.0, 128.0, 0.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310IronDoorRevealHybridFirstHit, 23.0, 0.0, 0.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310SeColumnNorthHybridFirstHit, 8.0, 0.0, 1.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310SeColumnWestHybridFirstHit, 9.0, 0.0, 2.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310SouthWallAcHybridFirstHit, 10.0, 0.0, 4.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310EastWallBeamHybridFirstHit, 11.0, 0.0, 8.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310SwColumnNorthHybridFirstHit, 12.0, 0.0, 16.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310WestWallBeamHybridFirstHit, 13.0, 0.0, 32.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310SwColumnInnerShadowHybridFirstHit, 14.0, 0.0, 64.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
			r7310HybridOwnerAdd(r7310SouthWindowLeftRevealShadowHybridFirstHit || r7310SouthWindowRightRevealShadowHybridFirstHit || r7310SouthWindowBottomRevealShadowHybridFirstHit, 19.0, 0.0, 128.0, r7310HybridOwnerCount, r7310HybridOwnerMaskLow, r7310HybridOwnerMaskHigh, r7310HybridOwnerFirstTargetOffset, r7310HybridOwnerSecondTargetOffset);
#if defined(R7310_INCLUDE_DEBUG_PROBES)
			if (bounces == 0 &&
				r7310C1RuntimeProbeMode > 36.5 &&
				r7310C1RuntimeProbeMode < 41.5)
			{
				if (r7310C1RuntimeProbeMode < 37.5)
				{
					accumCol = vec3(
						clamp(r7310HybridOwnerCount / 255.0, 0.0, 1.0),
						clamp(r7310HybridOwnerMaskLow / 255.0, 0.0, 1.0),
						clamp(r7310HybridOwnerMaskHigh / 255.0, 0.0, 1.0)
					);
				}
				else if (r7310C1RuntimeProbeMode < 38.5)
				{
					accumCol = vec3(
						clamp(r7310HybridOwnerFirstTargetOffset / 255.0, 0.0, 1.0),
						clamp(r7310HybridOwnerSecondTargetOffset / 255.0, 0.0, 1.0),
						clamp(r7310HybridOwnerCount / 255.0, 0.0, 1.0)
					);
				}
				else if (r7310C1RuntimeProbeMode < 39.5)
				{
					vec2 r7310HybridOwnerCoverageUv = vec2(0.0);
					if (r7310CeilingHybridFirstHit && r7310C1CeilingDiffuseUv(x, r7310HybridOwnerCoverageUv))
						accumCol = r7310C1PatchCoverageProbe(r7310HybridOwnerCoverageUv, uR7310C1RuntimeAtlasPatchResolution, 5.0, 6.0);
					else if (r7310FloorHybridFirstHit && r7310C1FloorDiffuseUv(x, r7310HybridOwnerCoverageUv))
						accumCol = r7310C1PatchCoverageProbe(r7310HybridOwnerCoverageUv, uR7310C1RuntimeAtlasPatchResolution, 0.0, 1.0);
					else if (r7310SouthWindowTopRevealShadowHybridFirstHit && r7310C1SouthWindowTopRevealShadowDiffuseUv(hitType, hitObjectID, nl, x, r7310HybridOwnerCoverageUv))
						accumCol = r7310C1PatchCoverageProbe(r7310HybridOwnerCoverageUv, uR7310C1SouthWindowTopRevealShadowResolution, 21.0, 22.0);
					else if (r7310WestWallHybridFirstHit)
						accumCol = r7310C1FullAtlasCoverageProbe(4.0);
					else
						accumCol = vec3(0.0);
				}
				else if (r7310C1RuntimeProbeMode < 40.5)
				{
					vec3 r7310HybridOwnerRadiance = vec3(0.0);
					if (r7310FloorHybridFirstHit)
						r7310HybridOwnerRadiance += r7310C1FloorHybridRadiance(hitType, hitObjectID, nl, x);
					if (r7310CeilingHybridFirstHit)
						r7310HybridOwnerRadiance += r7310C1CeilingHybridRadiance(hitType, hitObjectID, nl, x);
					if (r7310SouthWindowTopRevealShadowHybridFirstHit)
						r7310HybridOwnerRadiance += r7310C1SouthWindowTopRevealShadowHybridRadiance(hitType, hitObjectID, nl, x);
					if (r7310WestWallHybridFirstHit)
						r7310HybridOwnerRadiance += r7310C1WestWallHybridRadiance(hitType, hitObjectID, nl, x);
					accumCol = clamp(r7310HybridOwnerRadiance, vec3(0.0), vec3(1.0));
				}
				else
				{
					accumCol = vec3(
						hitIsRayExiting == TRUE ? 1.0 : 0.0,
						clamp((x.y + 0.05) / 0.10, 0.0, 1.0),
						clamp(rayDirection.y * 0.5 + 0.5, 0.0, 1.0)
					);
				}
				break;
			}
			if (bounces == 0 &&
				r7310C1RuntimeProbeMode > 41.5 &&
				r7310C1RuntimeProbeMode < 48.5)
			{
				vec3 r7310ProbeBoxCenter = (hitBoxMin + hitBoxMax) * 0.5;
				vec3 r7310ProbeRoomCenter = (uRoomMin + uRoomMax) * 0.5;
				bool r7310ProbeCamSouth = uCamPos.z > uRoomMax.z + uCullEpsilon;
				bool r7310ProbeThinSouthCull =
					hitBoxCullable >= 0.5 &&
					hitBoxCullable < 1.5 &&
					hitBoxMin.z > uRoomMax.z - uCullThreshold;
				bool r7310ProbeLargeSouthCull =
					hitBoxCullable >= 1.5 &&
					hitBoxCullable < 2.5 &&
					r7310ProbeBoxCenter.z > r7310ProbeRoomCenter.z;
				bool r7310ProbeSingleAxisCullable = hitBoxCullable >= 2.5;
				bool r7310ProbeSouthWouldCull =
					uXrayEnabled > 0.5 &&
					r7310ProbeCamSouth &&
					(r7310ProbeThinSouthCull || r7310ProbeLargeSouthCull);
				if (r7310C1RuntimeProbeMode < 42.5)
				{
					accumCol = vec3(
						clamp((hitBoxIndex + 1.0) / 255.0, 0.0, 1.0),
						clamp((hitBoxCullable + 1.0) / 8.0, 0.0, 1.0),
						clamp(float(hitType) / 255.0, 0.0, 1.0)
					);
				}
				else if (r7310C1RuntimeProbeMode < 43.5)
				{
					accumCol = vec3(
						clamp((hitBoxMin.x + 2.2) / 4.4, 0.0, 1.0),
						clamp((hitBoxMin.y + 0.1) / 3.2, 0.0, 1.0),
						clamp((hitBoxMin.z + 2.1) / 5.4, 0.0, 1.0)
					);
				}
				else if (r7310C1RuntimeProbeMode < 44.5)
				{
					accumCol = vec3(
						clamp((hitBoxMax.x + 2.2) / 4.4, 0.0, 1.0),
						clamp((hitBoxMax.y + 0.1) / 3.2, 0.0, 1.0),
						clamp((hitBoxMax.z + 2.1) / 5.4, 0.0, 1.0)
					);
				}
				else if (r7310C1RuntimeProbeMode < 45.5)
				{
					accumCol = vec3(
						clamp((x.x + 2.2) / 4.4, 0.0, 1.0),
						clamp((x.y + 0.1) / 3.2, 0.0, 1.0),
						clamp((x.z + 2.1) / 5.4, 0.0, 1.0)
					);
				}
				else if (r7310C1RuntimeProbeMode < 46.5)
				{
					accumCol = nl * 0.5 + 0.5;
				}
				else if (r7310C1RuntimeProbeMode < 47.5)
				{
					accumCol = vec3(
						uXrayEnabled > 0.5 ? 1.0 : 0.0,
						r7310ProbeCamSouth ? 1.0 : 0.0,
						r7310ProbeSouthWouldCull ? 1.0 : 0.0
					);
				}
				else
				{
					accumCol = vec3(
						r7310ProbeThinSouthCull ? 1.0 : 0.0,
						r7310ProbeLargeSouthCull ? 1.0 : 0.0,
						r7310ProbeSingleAxisCullable ? 1.0 : 0.0
					);
				}
				break;
			}
			if (bounces == 0 &&
				r7310C1RuntimeProbeMode > 48.5 &&
				r7310C1RuntimeProbeMode < 53.5)
			{
				if (r7310C1RuntimeProbeMode < 49.5)
				{
					accumCol = r7310NorthWallHybridFirstHit
						? clamp(r7310C1NorthWallHybridPreAlbedoRadiance(hitType, hitObjectID, nl, x), vec3(0.0), vec3(1.0))
						: vec3(0.0);
				}
				else if (r7310C1RuntimeProbeMode < 50.5)
				{
					accumCol = r7310EastWallHybridFirstHit
						? clamp(r7310C1EastWallHybridPreAlbedoRadiance(hitType, hitObjectID, nl, x), vec3(0.0), vec3(1.0))
						: vec3(0.0);
				}
				else if (r7310C1RuntimeProbeMode < 51.5)
				{
					accumCol = r7310EastWallHybridFirstHit
						? vec3(
							r7310C1ShouldUseNonSquareAtlas(2.0) ? 1.0 : 0.0,
							uR7310C1UseNonSquareAtlas > 0.5 ? 1.0 : 0.0,
							uR7310C1NonSquareAtlasReady > 0.5 ? 1.0 : 0.0
						)
						: vec3(0.0);
				}
				else if (r7310C1RuntimeProbeMode < 52.5)
				{
					accumCol = r7310EastWallHybridFirstHit
						? clamp(r7310C1FullRoomDiffuseSamplePatchTexelNonSquare(vec2(10.0, 10.0), 2.0).rgb, vec3(0.0), vec3(1.0))
						: vec3(0.0);
				}
				else
				{
					vec2 r7310ProbeEastUv = vec2(0.0);
					accumCol = r7310EastWallHybridFirstHit && r7310C1EastWallDiffuseUv(x, r7310ProbeEastUv)
						? clamp(r7310C1FullRoomDiffuseSampleRectTent3NonSquare(r7310ProbeEastUv, 2.0, r7310C1EastWallAtlasRect()), vec3(0.0), vec3(1.0))
						: vec3(0.0);
				}
				break;
			}
			if (bounces == 0 &&
				r7310C1RuntimeProbeMode > 21.5 &&
				r7310C1RuntimeProbeMode < 26.5)
			{
				float r7310WestJoinRouteId = 0.0;
				float r7310WestJoinTargetOffset = 0.0;
				float r7310WestJoinStructuralIslandId = r7310C1StructuralBeamColumnIslandId(hitType, hitObjectID, nl, x);
				if (r7310SwColumnNorthHybridFirstHit)
				{
					r7310WestJoinRouteId = 1.0;
					r7310WestJoinTargetOffset = 12.0;
				}
				else if (r7310WestWallHybridFirstHit)
				{
					r7310WestJoinRouteId = 2.0;
					r7310WestJoinTargetOffset = 3.0;
				}
				else if (r7310WestWallBeamHybridFirstHit)
				{
					r7310WestJoinRouteId = 3.0;
					r7310WestJoinTargetOffset = 13.0;
				}
				else if (r7310SwColumnInnerShadowHybridFirstHit)
				{
					r7310WestJoinRouteId = 4.0;
					r7310WestJoinTargetOffset = 14.0;
				}
				else if (r7310WestBeamInnerShadowHybridFirstHit)
				{
					r7310WestJoinRouteId = 5.0;
					r7310WestJoinTargetOffset = 15.0;
				}
				else if (r7310WestBeamUnderShadowHybridFirstHit)
				{
					r7310WestJoinRouteId = 6.0;
					r7310WestJoinTargetOffset = 16.0;
				}
				else if (r7310WestJoinStructuralIslandId > 0.5)
				{
					r7310WestJoinRouteId = 7.0;
					r7310WestJoinTargetOffset = 6.0;
				}
				if (r7310C1RuntimeProbeMode > 21.5 && r7310C1RuntimeProbeMode < 22.5)
					accumCol = vec3(r7310WestJoinRouteId / 255.0, r7310WestJoinStructuralIslandId / 255.0, r7310WestJoinTargetOffset / 255.0);
				else if (r7310C1RuntimeProbeMode > 22.5 && r7310C1RuntimeProbeMode < 23.5)
					accumCol = nl * 0.5 + 0.5;
				else if (r7310C1RuntimeProbeMode > 23.5 && r7310C1RuntimeProbeMode < 24.5)
					accumCol = vec3(
						clamp((x.x + 2.2) / 4.4, 0.0, 1.0),
						clamp((x.y + 0.1) / 3.2, 0.0, 1.0),
						clamp((x.z + 2.1) / 5.4, 0.0, 1.0)
					);
				else if (r7310C1RuntimeProbeMode > 24.5 && r7310C1RuntimeProbeMode < 25.5)
				{
					float h = float(hitType);
					float oid = hitObjectID;
					accumCol = vec3(
						clamp(h / 255.0, 0.0, 1.0),
						clamp(mod(oid, 256.0) / 255.0, 0.0, 1.0),
						clamp(floor(oid / 256.0) / 255.0, 0.0, 1.0)
					);
				}
				else
				{
					vec3 r7310WestJoinRadiance = vec3(0.0);
					if (r7310SwColumnNorthHybridFirstHit)
						r7310WestJoinRadiance = r7310C1SwColumnNorthShadowHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310WestWallHybridFirstHit)
						r7310WestJoinRadiance = r7310C1WestWallHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310WestWallBeamHybridFirstHit)
						r7310WestJoinRadiance = r7310C1WestWallBeamShadowHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310SwColumnInnerShadowHybridFirstHit)
						r7310WestJoinRadiance = r7310C1SwColumnInnerShadowHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310WestBeamInnerShadowHybridFirstHit)
						r7310WestJoinRadiance = r7310C1WestBeamInnerShadowHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310WestBeamUnderShadowHybridFirstHit)
						r7310WestJoinRadiance = r7310C1WestBeamUnderShadowHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310WestJoinStructuralIslandId > 0.5)
					{
						vec2 r7310WestJoinStructuralUv = vec2(0.0);
						if (r7310C1StructuralBeamColumnDiffuseUv(hitType, hitObjectID, nl, x, r7310WestJoinStructuralUv))
							r7310WestJoinRadiance = r7310C1FullRoomDiffuseSampleRectLinear(r7310WestJoinStructuralUv, 6.0, r7310C1StructuralBeamColumnAtlasRectForPoint(r7310WestJoinStructuralIslandId, x));
					}
					accumCol = clamp(r7310WestJoinRadiance, vec3(0.0), vec3(1.0));
				}
				break;
			}
				if (bounces == 0 &&
					r7310C1RuntimeProbeMode > 26.5 &&
					r7310C1RuntimeProbeMode < 30.5)
				{
				float r7310EastJoinRouteId = 0.0;
				float r7310EastJoinTargetOffset = 0.0;
				float r7310EastJoinStructuralIslandId = r7310C1StructuralBeamColumnIslandId(hitType, hitObjectID, nl, x);
				if (r7310SeColumnNorthHybridFirstHit)
				{
					r7310EastJoinRouteId = 1.0;
					r7310EastJoinTargetOffset = 8.0;
				}
				else if (r7310SeColumnWestHybridFirstHit)
				{
					r7310EastJoinRouteId = 2.0;
					r7310EastJoinTargetOffset = 9.0;
				}
				else if (r7310EastWallBeamHybridFirstHit)
				{
					r7310EastJoinRouteId = 3.0;
					r7310EastJoinTargetOffset = 11.0;
				}
				else if (r7310EastWallHybridFirstHit)
				{
					r7310EastJoinRouteId = 4.0;
					r7310EastJoinTargetOffset = 3.0;
				}
				else if (r7310EastJoinStructuralIslandId > 0.5)
				{
					r7310EastJoinRouteId = 5.0;
					r7310EastJoinTargetOffset = 6.0;
				}

				if (r7310C1RuntimeProbeMode > 26.5 && r7310C1RuntimeProbeMode < 27.5)
				{
					accumCol = vec3(r7310EastJoinRouteId / 255.0, r7310EastJoinStructuralIslandId / 255.0, r7310EastJoinTargetOffset / 255.0);
				}
				else if (r7310C1RuntimeProbeMode > 27.5 && r7310C1RuntimeProbeMode < 28.5)
				{
					vec2 r7310CoverageUv = vec2(0.0);
					vec3 r7310Coverage = vec3(0.0);
					if (r7310SeColumnNorthHybridFirstHit &&
						r7310C1SeColumnNorthShadowDiffuseUv(hitType, hitObjectID, nl, x, r7310CoverageUv))
						r7310Coverage = r7310C1PatchCoverageProbe(r7310CoverageUv, uR7310C1SeColumnNorthShadowResolution, 7.0, 1.0);
					else if (r7310SeColumnWestHybridFirstHit &&
						r7310C1SeColumnWestShadowDiffuseUv(hitType, hitObjectID, nl, x, r7310CoverageUv))
						r7310Coverage = r7310C1PatchCoverageProbe(r7310CoverageUv, uR7310C1SeColumnWestShadowResolution, 8.0, 2.0);
					else if (r7310EastWallBeamHybridFirstHit &&
						r7310C1EastWallBeamShadowDiffuseUv(hitType, hitObjectID, nl, x, r7310CoverageUv))
						r7310Coverage = r7310C1PatchCoverageProbe(r7310CoverageUv, uR7310C1EastWallBeamShadowResolution, 10.0, 3.0);
					else if (r7310EastWallHybridFirstHit)
						r7310Coverage = r7310C1FullAtlasCoverageProbe(4.0);
					else if (r7310SwColumnNorthHybridFirstHit &&
						r7310C1SwColumnNorthShadowDiffuseUv(hitType, hitObjectID, nl, x, r7310CoverageUv))
						r7310Coverage = r7310C1PatchCoverageProbe(r7310CoverageUv, uR7310C1SwColumnNorthShadowResolution, 11.0, 5.0);
					else if (r7310WestWallBeamHybridFirstHit &&
						r7310C1WestWallBeamShadowDiffuseUv(hitType, hitObjectID, nl, x, r7310CoverageUv))
						r7310Coverage = r7310C1PatchCoverageProbe(r7310CoverageUv, uR7310C1WestWallBeamShadowResolution, 12.0, 6.0);
					else if (r7310WestWallHybridFirstHit)
						r7310Coverage = r7310C1FullAtlasCoverageProbe(7.0);
					else if (r7310SwColumnInnerShadowHybridFirstHit &&
						r7310C1SwColumnInnerShadowDiffuseUv(hitType, hitObjectID, nl, x, r7310CoverageUv))
						r7310Coverage = r7310C1PatchCoverageProbe(r7310CoverageUv, uR7310C1SwColumnInnerShadowResolution, 13.0, 8.0);
					accumCol = r7310Coverage;
				}
				else if (r7310C1RuntimeProbeMode > 28.5 && r7310C1RuntimeProbeMode < 29.5)
				{
					accumCol = vec3(
						uXrayEnabled > 0.5 ? 1.0 : 0.0,
						r7310C1StructuralSeColumnNorthHiddenByEastBeam(x.x, x.y) ? 1.0 : 0.0,
						r7310C1StructuralSeColumnInnerHiddenByBookshelf(x.z, x.y) ? 1.0 : 0.0
					);
				}
				else
				{
					vec3 r7310JoinRadiance = vec3(0.0);
					if (r7310SeColumnNorthHybridFirstHit)
						r7310JoinRadiance = r7310C1SeColumnNorthShadowHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310SeColumnWestHybridFirstHit)
						r7310JoinRadiance = r7310C1SeColumnWestShadowHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310EastWallBeamHybridFirstHit)
						r7310JoinRadiance = r7310C1EastWallBeamShadowHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310EastWallHybridFirstHit)
						r7310JoinRadiance = r7310C1EastWallHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310SwColumnNorthHybridFirstHit)
						r7310JoinRadiance = r7310C1SwColumnNorthShadowHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310WestWallBeamHybridFirstHit)
						r7310JoinRadiance = r7310C1WestWallBeamShadowHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310WestWallHybridFirstHit)
						r7310JoinRadiance = r7310C1WestWallHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310SwColumnInnerShadowHybridFirstHit)
						r7310JoinRadiance = r7310C1SwColumnInnerShadowHybridRadiance(hitType, hitObjectID, nl, x);
					accumCol = clamp(r7310JoinRadiance, vec3(0.0), vec3(1.0));
				}
					break;
				}
				if (bounces == 0 &&
					r7310C1RuntimeProbeMode > 30.5 &&
					r7310C1RuntimeProbeMode < 36.5)
				{
					float r7310NorthBeamRouteId = 0.0;
					float r7310NorthBeamTargetOffset = 0.0;
					float r7310NorthBeamStructuralIslandId = r7310C1StructuralBeamColumnIslandId(hitType, hitObjectID, nl, x);
					if (r7310NorthWallHybridFirstHit)
					{
						r7310NorthBeamRouteId = 1.0;
						r7310NorthBeamTargetOffset = 2.0;
					}
					else if (r7310WestBeamInnerShadowHybridFirstHit)
					{
						r7310NorthBeamRouteId = 2.0;
						r7310NorthBeamTargetOffset = 15.0;
					}
					else if (r7310WestBeamUnderShadowHybridFirstHit)
					{
						r7310NorthBeamRouteId = 3.0;
						r7310NorthBeamTargetOffset = 16.0;
					}
					else if (r7310EastBeamInnerShadowHybridFirstHit)
					{
						r7310NorthBeamRouteId = 4.0;
						r7310NorthBeamTargetOffset = 17.0;
					}
					else if (r7310EastBeamUnderShadowHybridFirstHit)
					{
						r7310NorthBeamRouteId = 5.0;
						r7310NorthBeamTargetOffset = 18.0;
					}
					else if (r7310NorthBeamStructuralIslandId > 0.5)
					{
						r7310NorthBeamRouteId = 6.0;
						r7310NorthBeamTargetOffset = 6.0;
					}

					if (r7310C1RuntimeProbeMode > 30.5 && r7310C1RuntimeProbeMode < 31.5)
						accumCol = vec3(r7310NorthBeamRouteId / 255.0, r7310NorthBeamStructuralIslandId / 255.0, r7310NorthBeamTargetOffset / 255.0);
					else if (r7310C1RuntimeProbeMode > 31.5 && r7310C1RuntimeProbeMode < 32.5)
						accumCol = vec3(
							clamp((x.x + 2.2) / 4.4, 0.0, 1.0),
							clamp((x.y + 0.1) / 3.2, 0.0, 1.0),
							clamp((x.z + 2.1) / 5.4, 0.0, 1.0)
						);
					else if (r7310C1RuntimeProbeMode > 32.5 && r7310C1RuntimeProbeMode < 33.5)
						accumCol = nl * 0.5 + 0.5;
					else if (r7310C1RuntimeProbeMode > 33.5 && r7310C1RuntimeProbeMode < 34.5)
					{
						float h = float(hitType);
						float oid = hitObjectID;
						accumCol = vec3(
							clamp(h / 255.0, 0.0, 1.0),
							clamp(mod(oid, 256.0) / 255.0, 0.0, 1.0),
							clamp(floor(oid / 256.0) / 255.0, 0.0, 1.0)
						);
					}
					else if (r7310C1RuntimeProbeMode > 34.5 && r7310C1RuntimeProbeMode < 35.5)
					{
						vec2 r7310NorthBeamCoverageUv = vec2(0.0);
						if (r7310NorthWallHybridFirstHit &&
							r7310C1NorthWallDiffuseUv(x, r7310NorthBeamCoverageUv))
							accumCol = r7310C1PatchCoverageProbe(r7310NorthBeamCoverageUv, uR7310C1RuntimeAtlasPatchResolution, 1.0, 1.0);
						else if (r7310WestBeamInnerShadowHybridFirstHit &&
							r7310C1WestBeamInnerShadowDiffuseUv(hitType, hitObjectID, nl, x, r7310NorthBeamCoverageUv))
							accumCol = r7310C1PatchCoverageProbe(r7310NorthBeamCoverageUv, uR7310C1WestBeamInnerShadowResolution, 14.0, 2.0);
						else if (r7310WestBeamUnderShadowHybridFirstHit &&
							r7310C1WestBeamUnderShadowDiffuseUv(hitType, hitObjectID, nl, x, r7310NorthBeamCoverageUv))
							accumCol = r7310C1PatchCoverageProbe(r7310NorthBeamCoverageUv, uR7310C1WestBeamUnderShadowResolution, 15.0, 3.0);
						else if (r7310EastBeamInnerShadowHybridFirstHit &&
							r7310C1EastBeamInnerShadowDiffuseUv(hitType, hitObjectID, nl, x, r7310NorthBeamCoverageUv))
							accumCol = r7310C1PatchCoverageProbe(r7310NorthBeamCoverageUv, uR7310C1EastBeamInnerShadowResolution, 16.0, 4.0);
						else if (r7310EastBeamUnderShadowHybridFirstHit &&
							r7310C1EastBeamUnderShadowDiffuseUv(hitType, hitObjectID, nl, x, r7310NorthBeamCoverageUv))
							accumCol = r7310C1PatchCoverageProbe(r7310NorthBeamCoverageUv, uR7310C1EastBeamUnderShadowResolution, 17.0, 5.0);
						else if (r7310NorthBeamStructuralIslandId > 0.5)
							accumCol = r7310C1FullAtlasCoverageProbe(6.0);
						else
							accumCol = vec3(0.0);
					}
					else
					{
						vec3 r7310NorthBeamRadiance = vec3(0.0);
						if (r7310NorthWallHybridFirstHit)
							r7310NorthBeamRadiance = r7310C1NorthWallHybridRadiance(hitType, hitObjectID, nl, x, hitColor);
						else if (r7310WestBeamInnerShadowHybridFirstHit)
							r7310NorthBeamRadiance = r7310C1WestBeamInnerShadowHybridRadiance(hitType, hitObjectID, nl, x);
						else if (r7310WestBeamUnderShadowHybridFirstHit)
							r7310NorthBeamRadiance = r7310C1WestBeamUnderShadowHybridRadiance(hitType, hitObjectID, nl, x);
						else if (r7310EastBeamInnerShadowHybridFirstHit)
							r7310NorthBeamRadiance = r7310C1EastBeamInnerShadowHybridRadiance(hitType, hitObjectID, nl, x);
						else if (r7310EastBeamUnderShadowHybridFirstHit)
							r7310NorthBeamRadiance = r7310C1EastBeamUnderShadowHybridRadiance(hitType, hitObjectID, nl, x);
						else if (r7310NorthBeamStructuralIslandId > 0.5)
						{
							vec2 r7310NorthBeamStructuralUv = vec2(0.0);
							if (r7310C1StructuralBeamColumnDiffuseUv(hitType, hitObjectID, nl, x, r7310NorthBeamStructuralUv))
								r7310NorthBeamRadiance = r7310C1FullRoomDiffuseSampleRectLinear(r7310NorthBeamStructuralUv, 6.0, r7310C1StructuralBeamColumnAtlasRectForPoint(r7310NorthBeamStructuralIslandId, x));
						}
						accumCol = clamp(r7310NorthBeamRadiance, vec3(0.0), vec3(1.0));
					}
					break;
				}
				if (bounces == 0 &&
					r7310C1RuntimeProbeMode > 10.5 &&
					r7310C1RuntimeProbeMode < 14.5)
				{
				float r7310BeamUnderRouteId = 0.0;
				float r7310BeamUnderTargetOffset = 0.0;
				float r7310BeamUnderStructuralIslandId = r7310C1StructuralBeamColumnIslandId(hitType, hitObjectID, nl, x);
				bool r7310WestBeamUnderGeometryHit = r7310C1RuntimeSurfaceIsWestBeamUnderShadow(hitType, hitObjectID, nl, x);
				bool r7310EastBeamUnderGeometryHit = r7310C1RuntimeSurfaceIsEastBeamUnderShadow(hitType, hitObjectID, nl, x);
				if (r7310WestBeamUnderShadowHybridFirstHit)
				{
					r7310BeamUnderRouteId = 1.0;
					r7310BeamUnderTargetOffset = 16.0;
				}
				else if (r7310EastBeamUnderShadowHybridFirstHit)
				{
					r7310BeamUnderRouteId = 2.0;
					r7310BeamUnderTargetOffset = 18.0;
				}
				else if (r7310WestBeamUnderGeometryHit)
				{
					r7310BeamUnderRouteId = 3.0;
					r7310BeamUnderTargetOffset = 16.0;
				}
				else if (r7310EastBeamUnderGeometryHit)
				{
					r7310BeamUnderRouteId = 4.0;
					r7310BeamUnderTargetOffset = 18.0;
				}
				else if (r7310BeamUnderStructuralIslandId > 1.5 && r7310BeamUnderStructuralIslandId < 2.5)
				{
					r7310BeamUnderRouteId = 5.0;
					r7310BeamUnderTargetOffset = 16.0;
				}
				else if (r7310BeamUnderStructuralIslandId > 3.5 && r7310BeamUnderStructuralIslandId < 4.5)
				{
					r7310BeamUnderRouteId = 6.0;
					r7310BeamUnderTargetOffset = 18.0;
				}
				if (r7310C1RuntimeProbeMode > 10.5 && r7310C1RuntimeProbeMode < 11.5)
					accumCol = vec3(r7310BeamUnderRouteId / 255.0, r7310BeamUnderStructuralIslandId / 255.0, r7310BeamUnderTargetOffset / 255.0);
				else if (r7310C1RuntimeProbeMode > 11.5 && r7310C1RuntimeProbeMode < 12.5)
					accumCol = nl * 0.5 + 0.5;
				else if (r7310C1RuntimeProbeMode > 12.5 && r7310C1RuntimeProbeMode < 13.5)
					accumCol = vec3(
						clamp((x.x + 2.2) / 4.4, 0.0, 1.0),
						clamp((x.y + 0.1) / 3.2, 0.0, 1.0),
						clamp((x.z + 2.1) / 5.4, 0.0, 1.0)
					);
				else if (r7310C1RuntimeProbeMode > 13.5 && r7310C1RuntimeProbeMode < 14.5)
				{
					float h = float(hitType);
					float oid = hitObjectID;
					accumCol = vec3(
						clamp(h / 255.0, 0.0, 1.0),
						clamp(mod(oid, 256.0) / 255.0, 0.0, 1.0),
						clamp(floor(oid / 256.0) / 255.0, 0.0, 1.0)
					);
				}
				break;
			}
			if (bounces == 0 &&
				r7310C1RuntimeProbeMode > 16.5 &&
				r7310C1RuntimeProbeMode < 21.5)
			{
				// Phase 2B route labels: sw_column_inner_shadow_hybrid, south_window_left_reveal_shadow_hybrid, west_beam_inner_shadow_hybrid.
				float r7310Phase2BRouteId = 0.0;
				float r7310Phase2BTargetOffset = 0.0;
				float r7310Phase2BStructuralIslandId = r7310C1StructuralBeamColumnIslandId(hitType, hitObjectID, nl, x);
				bool r7310Phase2BSwColumnGeometryHit = r7310C1RuntimeSurfaceIsSwColumnInnerShadow(hitType, hitObjectID, nl, x);
				bool r7310Phase2BSouthWindowLeftGeometryHit = r7310C1RuntimeSurfaceIsSouthWindowLeftRevealShadow(hitType, hitObjectID, nl, x);
				bool r7310Phase2BWestBeamGeometryHit = r7310C1RuntimeSurfaceIsWestBeamInnerShadow(hitType, hitObjectID, nl, x);
				if (r7310SwColumnInnerShadowHybridFirstHit)
				{
					r7310Phase2BRouteId = 1.0;
					r7310Phase2BTargetOffset = 14.0;
				}
				else if (r7310SouthWindowLeftRevealShadowHybridFirstHit)
				{
					r7310Phase2BRouteId = 2.0;
					r7310Phase2BTargetOffset = 19.0;
				}
				else if (r7310WestBeamInnerShadowHybridFirstHit)
				{
					r7310Phase2BRouteId = 6.0;
					r7310Phase2BTargetOffset = 15.0;
				}
				else if (r7310Phase2BSwColumnGeometryHit)
				{
					r7310Phase2BRouteId = 3.0;
					r7310Phase2BTargetOffset = 14.0;
				}
				else if (r7310Phase2BSouthWindowLeftGeometryHit)
				{
					r7310Phase2BRouteId = 4.0;
					r7310Phase2BTargetOffset = 19.0;
				}
				else if (r7310Phase2BWestBeamGeometryHit)
				{
					r7310Phase2BRouteId = 7.0;
					r7310Phase2BTargetOffset = 15.0;
				}
				else if (r7310Phase2BStructuralIslandId > 4.5 && r7310Phase2BStructuralIslandId < 5.5)
				{
					r7310Phase2BRouteId = 5.0;
					r7310Phase2BTargetOffset = 14.0;
				}
				if (r7310C1RuntimeProbeMode > 16.5 && r7310C1RuntimeProbeMode < 17.5)
					accumCol = vec3(r7310Phase2BRouteId / 255.0, r7310Phase2BStructuralIslandId / 255.0, r7310Phase2BTargetOffset / 255.0);
				else if (r7310C1RuntimeProbeMode > 17.5 && r7310C1RuntimeProbeMode < 18.5)
					accumCol = nl * 0.5 + 0.5;
				else if (r7310C1RuntimeProbeMode > 18.5 && r7310C1RuntimeProbeMode < 19.5)
					accumCol = vec3(
						clamp((x.x + 2.2) / 4.4, 0.0, 1.0),
						clamp((x.y + 0.1) / 3.2, 0.0, 1.0),
						clamp((x.z + 2.1) / 5.4, 0.0, 1.0)
					);
				else if (r7310C1RuntimeProbeMode > 19.5 && r7310C1RuntimeProbeMode < 20.5)
				{
					float h = float(hitType);
					float oid = hitObjectID;
					accumCol = vec3(
						clamp(h / 255.0, 0.0, 1.0),
						clamp(mod(oid, 256.0) / 255.0, 0.0, 1.0),
						clamp(floor(oid / 256.0) / 255.0, 0.0, 1.0)
					);
				}
				else if (r7310C1RuntimeProbeMode > 20.5 && r7310C1RuntimeProbeMode < 21.5)
				{
					vec3 r7310Phase2BRadiance = vec3(0.0);
					if (r7310Phase2BSwColumnGeometryHit)
						r7310Phase2BRadiance = r7310C1SwColumnInnerShadowHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310Phase2BSouthWindowLeftGeometryHit)
						r7310Phase2BRadiance = r7310C1SouthWindowLeftRevealShadowHybridRadiance(hitType, hitObjectID, nl, x);
					else if (r7310Phase2BWestBeamGeometryHit)
						r7310Phase2BRadiance = r7310C1WestBeamInnerShadowHybridRadiance(hitType, hitObjectID, nl, x);
					accumCol = clamp(r7310Phase2BRadiance, vec3(0.0), vec3(1.0));
				}
				break;
			}
			if (bounces == 0 &&
				r7310C1RuntimeProbeMode > 0.5 &&
				r7310C1RuntimeProbeMode < 1.5 &&
				(r7310FloorHybridFirstHit || r7310CeilingHybridFirstHit))
			{
				accumCol = r7310CeilingHybridFirstHit ? vec3(1.0, 1.0, 1.0) : vec3(0.0, 1.0, 0.0);
				break;
			}
			if (bounces == 0 &&
				r7310C1RuntimeProbeMode > 53.5 &&
				r7310C1RuntimeProbeMode < 54.5)
				{
					float r7310FinalRuntimeSourceId = 4.0;
					if (r7310XatlasRuntimeFirstHit)
						r7310FinalRuntimeSourceId = 1.0;
					else if (r7310NorthWallHybridFirstHit)
						r7310FinalRuntimeSourceId = 2.0;
				else if (r7310WestBeamInnerShadowHybridFirstHit || r7310WestBeamUnderShadowHybridFirstHit)
					r7310FinalRuntimeSourceId = 3.0;
				else if (r7310FloorHybridFirstHit || r7310CeilingHybridFirstHit || r7310EastWallHybridFirstHit || r7310SeColumnNorthHybridFirstHit || r7310SeColumnWestHybridFirstHit || r7310SouthWallAcHybridFirstHit || r7310EastWallBeamHybridFirstHit || r7310SwColumnNorthHybridFirstHit || r7310WestWallHybridFirstHit || r7310WestWallBeamHybridFirstHit || r7310SwColumnInnerShadowHybridFirstHit || r7310EastBeamInnerShadowHybridFirstHit || r7310EastBeamUnderShadowHybridFirstHit || r7310SouthWindowLeftRevealShadowHybridFirstHit || r7310SouthWindowRightRevealShadowHybridFirstHit || r7310SouthWindowBottomRevealShadowHybridFirstHit || r7310SouthWindowTopRevealShadowHybridFirstHit || r7310IronDoorRevealHybridFirstHit)
					r7310FinalRuntimeSourceId = 5.0;
					else
					{
						vec2 r7310FinalRuntimeAtlasUv = vec2(0.0);
						if (uR7310C1NorthWallDiffuseMode > 0.5 &&
							r7310C1RuntimeSurfaceIsNorthWall(hitType, hitObjectID, nl, x) &&
							r7310C1NorthWallDiffuseUv(x, r7310FinalRuntimeAtlasUv))
							r7310FinalRuntimeSourceId = 2.0;
					}

				vec3 r7310FinalRuntimeSourceColor = vec3(0.45);
				if (r7310FinalRuntimeSourceId < 1.5)
					r7310FinalRuntimeSourceColor = vec3(1.0, 0.0, 0.0);
				else if (r7310FinalRuntimeSourceId < 2.5)
					r7310FinalRuntimeSourceColor = vec3(0.0, 1.0, 1.0);
				else if (r7310FinalRuntimeSourceId < 3.5)
					r7310FinalRuntimeSourceColor = vec3(1.0, 0.5, 0.0);
				else if (r7310FinalRuntimeSourceId < 4.5)
					r7310FinalRuntimeSourceColor = vec3(0.45);
				else
					r7310FinalRuntimeSourceColor = vec3(0.7, 0.0, 1.0);
					accumCol = r7310FinalRuntimeSourceColor;
					break;
				}
				if (bounces == 0 &&
					r7310C1RuntimeProbeMode > 54.5 &&
					r7310C1RuntimeProbeMode < 56.5)
				{
					vec2 r7310XatlasProbeUv = vec2(0.0);
					bool r7310XatlasProbeMapped = r7310C1XatlasNorthWallUv(hitType, hitObjectID, nl, x, r7310XatlasProbeUv);
					if (!r7310XatlasProbeMapped)
					{
						accumCol = vec3(0.08);
					}
					else if (r7310C1RuntimeProbeMode < 55.5)
					{
						accumCol = r7310C1XatlasNorthWallTriangleProbeColor(r7310C1XatlasNorthWallTriangleId(x));
					}
					else
					{
						vec2 r7310XatlasProbeAtlasSize = max(uR7310C1XatlasRuntimeAtlasSize, vec2(1.0));
						vec2 r7310XatlasProbePixel = clamp(r7310XatlasProbeUv * r7310XatlasProbeAtlasSize - vec2(0.5), vec2(0.0), r7310XatlasProbeAtlasSize - vec2(1.0));
						vec4 r7310XatlasProbeTexel = r7310C1XatlasRuntimeSampleTexel(floor(r7310XatlasProbePixel + vec2(0.5)));
						float r7310XatlasProbeLuma = dot(max(r7310XatlasProbeTexel.rgb, vec3(0.0)), vec3(0.2126, 0.7152, 0.0722));
						if (r7310XatlasProbeTexel.a <= 0.5)
							accumCol = vec3(0.0, 0.2, 1.0); // alpha=0：xatlas 不應取這格
						else if (r7310XatlasProbeLuma < 0.00001)
							accumCol = vec3(1.0, 0.0, 0.0); // alpha=1 且黑：問題候選
						else
							accumCol = vec3(0.0, clamp(0.25 + r7310XatlasProbeLuma * 8.0, 0.0, 1.0), 0.0);
					}
					break;
				}
#endif
						if (r7310XatlasRuntimeFullBakeRouteMissIsDebugError)
						{
							accumCol = vec3(1.0, 0.0, 1.0);
							break;
					}
					if (r7310XatlasRuntimeFirstHit)
					{
						float r7310XatlasRuntimeSurfaceSeparatedAlbedo = r7310XatlasRuntimeFloorFirstHit
							? uR7310C1XatlasRuntimeFullFloorSeparatedAlbedo
							: uR7310C1XatlasRuntimeSeparatedAlbedo;
						accumCol += mask * (r7310XatlasRuntimeSurfaceSeparatedAlbedo > 0.5
							? r7310XatlasRuntimeRadiance * hitColor
							: r7310XatlasRuntimeRadiance);
						if (uR7310C1XatlasRuntimeFullWestWallDirectIncluded > 0.5 &&
							r7310XatlasRuntimeWestFirstHit)
						{
							// West full-radiance package already contains first-hit direct light.
							break;
						}
						if (uR7310C1XatlasRuntimeWestThresholdTopDirectIncluded > 0.5 &&
							r7310XatlasRuntimeWestThresholdTopFirstHit)
						{
							break;
						}
						if (uR7310C1XatlasRuntimeWestThresholdFrontDirectIncluded > 0.5 &&
							r7310XatlasRuntimeWestThresholdFrontFirstHit)
						{
							break;
						}
							if (uR7310C1XatlasRuntimeFullNorthWallDirectIncluded > 0.5 &&
								r7310XatlasRuntimeNorthFirstHit)
							{
								break;
							}
							if (uR7310C1XatlasRuntimeFullEastWallDirectIncluded > 0.5 &&
								r7310XatlasRuntimeEastFirstHit)
							{
								break;
							}
							if (uR7310C1XatlasRuntimeFullSouthWallDirectIncluded > 0.5 &&
								r7310XatlasRuntimeSouthFirstHit)
							{
								break;
							}
							if (uR7310C1XatlasRuntimeFullCeilingDirectIncluded > 0.5 &&
								r7310XatlasRuntimeCeilingFirstHit)
							{
								break;
							}
							if (uR7310C1XatlasRuntimeDepthH2DirectIncluded > 0.5 &&
								r7310XatlasRuntimeDepthH2FirstHit)
							{
								break;
							}
							if (uR7310C1XatlasRuntimeFullFloorDirectIncluded > 0.5 &&
								r7310XatlasRuntimeFloorFirstHit)
							{
								break;
							}
							if (uR7310C1XatlasRuntimeCentralDeskDirectIncluded > 0.5 &&
								r7310XatlasRuntimeCentralDeskFirstHit)
							{
								break;
							}
							if (uR7310C1XatlasRuntimeStructuralDirectIncluded > 0.5 &&
								r7310XatlasRuntimeStructuralFirstHit)
							{
								break;
							}
							if (uR7310C1XatlasRuntimeSouthWindowRevealsDirectIncluded > 0.5 &&
								r7310XatlasRuntimeSouthWindowRevealsFirstHit)
							{
								break;
							}
							if (uR7310C1XatlasRuntimeWestWallSwitchDirectIncluded > 0.5 &&
								r7310XatlasRuntimeWestWallSwitchFirstHit)
							{
								break;
							}
							// Indirect XATLAS packages continue to the shared direct-light path.
						}
				if (r7310FloorHybridFirstHit && !r7310XatlasRuntimeMapped)
					accumCol += mask * r7310C1FloorHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310CeilingHybridFirstHit && !r7310XatlasRuntimeMapped)
				accumCol += mask * r7310C1CeilingHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310NorthWallHybridFirstHit && !r7310XatlasRuntimeMapped)
				accumCol += mask * r7310C1NorthWallHybridRadiance(hitType, hitObjectID, nl, x, hitColor);
			if (r7310EastWallHybridFirstHit && !r7310XatlasRuntimeMapped)
				accumCol += mask * r7310C1EastWallHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310SeColumnNorthHybridFirstHit)
				accumCol += mask * r7310C1SeColumnNorthShadowHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310SeColumnWestHybridFirstHit)
				accumCol += mask * r7310C1SeColumnWestShadowHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310SouthWallAcHybridFirstHit)
				accumCol += mask * r7310C1SouthWallAcShadowHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310EastWallBeamHybridFirstHit)
				accumCol += mask * r7310C1EastWallBeamShadowHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310SwColumnNorthHybridFirstHit)
				accumCol += mask * r7310C1SwColumnNorthShadowHybridRadiance(hitType, hitObjectID, nl, x);
				if (r7310WestWallHybridFirstHit && !r7310XatlasRuntimeMapped)
					accumCol += mask * r7310C1WestWallHybridRadiance(hitType, hitObjectID, nl, x);
				if (r7310WestWallBeamHybridFirstHit)
					accumCol += mask * r7310C1WestWallBeamShadowHybridRadiance(hitType, hitObjectID, nl, x);
				if (r7310SwColumnInnerShadowHybridFirstHit)
					accumCol += mask * r7310C1SwColumnInnerShadowHybridRadiance(hitType, hitObjectID, nl, x);
				if (r7310WestBeamInnerShadowHybridFirstHit)
					accumCol += mask * r7310C1WestBeamInnerShadowHybridRadiance(hitType, hitObjectID, nl, x);
				if (r7310WestBeamUnderShadowHybridFirstHit)
					accumCol += mask * r7310C1WestBeamUnderShadowHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310EastBeamInnerShadowHybridFirstHit)
				accumCol += mask * r7310C1EastBeamInnerShadowHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310EastBeamUnderShadowHybridFirstHit)
				accumCol += mask * r7310C1EastBeamUnderShadowHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310SouthWindowLeftRevealShadowHybridFirstHit)
				accumCol += mask * r7310C1SouthWindowLeftRevealShadowHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310SouthWindowRightRevealShadowHybridFirstHit)
				accumCol += mask * r7310C1SouthWindowRightRevealShadowHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310SouthWindowBottomRevealShadowHybridFirstHit)
				accumCol += mask * r7310C1SouthWindowBottomRevealShadowHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310SouthWindowTopRevealShadowHybridFirstHit)
				accumCol += mask * r7310C1SouthWindowTopRevealShadowHybridRadiance(hitType, hitObjectID, nl, x);
			if (r7310IronDoorRevealHybridFirstHit)
				accumCol += mask * r7310C1IronDoorRevealHybridRadiance(hitType, hitObjectID, nl, x);
#if defined(R7310_INCLUDE_DEBUG_PROBES)
			if (bounces == 0 &&
				r7310C1RuntimeProbeMode > 14.5 &&
				r7310C1RuntimeProbeMode < 16.5)
			{
				float r7310BeamUnderDirectProbeRouteId = 0.0;
				if (r7310WestBeamUnderShadowHybridFirstHit)
					r7310BeamUnderDirectProbeRouteId = 1.0;
				else if (r7310EastBeamUnderShadowHybridFirstHit)
					r7310BeamUnderDirectProbeRouteId = 2.0;

				if (r7310BeamUnderDirectProbeRouteId > 0.5)
				{
					vec3 r7310BeamUnderDirectProbeWeight;
					float r7310BeamUnderDirectProbePdf;
					int r7310BeamUnderDirectProbePickedIdx;
					int r7310BeamUnderDirectProbeZeroClass;
					int r7310BeamUnderDirectProbeThetaBin;
					vec3 r7310BeamUnderDirectProbeFacingDiagnostic;
					vec3 r7310BeamUnderDirectProbeDirection = sampleStochasticLightDynamic(
						x,
						nl,
						light,
						r7310BeamUnderDirectProbeWeight,
						r7310BeamUnderDirectProbePdf,
						r7310BeamUnderDirectProbePickedIdx,
						r7310BeamUnderDirectProbeZeroClass,
						r7310BeamUnderDirectProbeThetaBin,
						r7310BeamUnderDirectProbeFacingDiagnostic
					);
					vec3 r7310BeamUnderDirectProbeContribution = max(mask * hitColor * r7310BeamUnderDirectProbeWeight * uLegacyGain, vec3(0.0));
					float r7310BeamUnderDirectProbeLuma = dot(r7310BeamUnderDirectProbeContribution, vec3(0.2126, 0.7152, 0.0722));
					float r7310BeamUnderDirectProbeSourceFacing = max(0.0, dot(nl, r7310BeamUnderDirectProbeDirection));
					if (r7310C1RuntimeProbeMode > 14.5 && r7310C1RuntimeProbeMode < 15.5)
						accumCol = vec3(
							r7310BeamUnderDirectProbeRouteId / 255.0,
							clamp(r7310BeamUnderDirectProbeLuma, 0.0, 1.0),
							clamp((float(r7310BeamUnderDirectProbePickedIdx) + 1.0) / 255.0, 0.0, 1.0)
						);
					else
						accumCol = vec3(
							r7310BeamUnderDirectProbeRouteId / 255.0,
							clamp(r7310BeamUnderDirectProbeSourceFacing, 0.0, 1.0),
							clamp(float(r7310BeamUnderDirectProbeZeroClass) / 255.0, 0.0, 1.0)
						);
				}
				else
					accumCol = vec3(0.0);
				break;
			}
#endif
					if (!r7310XatlasRuntimeMapped &&
							!(r7310FloorHybridFirstHit || r7310CeilingHybridFirstHit || r7310NorthWallHybridFirstHit || r7310EastWallHybridFirstHit || r7310SeColumnNorthHybridFirstHit || r7310SeColumnWestHybridFirstHit || r7310SouthWallAcHybridFirstHit || r7310EastWallBeamHybridFirstHit || r7310SwColumnNorthHybridFirstHit || r7310WestWallHybridFirstHit || r7310WestWallBeamHybridFirstHit || r7310SwColumnInnerShadowHybridFirstHit || r7310WestBeamInnerShadowHybridFirstHit || r7310WestBeamUnderShadowHybridFirstHit || r7310EastBeamInnerShadowHybridFirstHit || r7310EastBeamUnderShadowHybridFirstHit || r7310SouthWindowLeftRevealShadowHybridFirstHit || r7310SouthWindowRightRevealShadowHybridFirstHit || r7310SouthWindowBottomRevealShadowHybridFirstHit || r7310SouthWindowTopRevealShadowHybridFirstHit || r7310IronDoorRevealHybridFirstHit) &&
					r7310C1RuntimeFirstHitBakeAllowed(bounces) &&
					r7310C1FullRoomDiffuseShortCircuit(hitType, hitObjectID, nl, x, hitIsRayExiting, hitColor, r7310BakedRadiance))
			{
#if defined(R7310_INCLUDE_DEBUG_PROBES)
				vec2 r7310RuntimeProbeAtlasUv = vec2(0.0);
				if (r7310C1RuntimeProbeMode > 0.5 && r7310C1RuntimeProbeMode < 1.5)
				{
					vec3 r7310ProbeClassColor = vec3(0.0, 1.0, 0.0);
					if (uR7310C1StructuralDiffuseMode > 0.5 &&
						r7310C1RuntimeSurfaceIsStructuralBeamColumn(hitType, hitObjectID, nl, x))
						r7310ProbeClassColor = vec3(1.0, 0.0, 0.0);
					else if (uR7310C1CeilingDiffuseMode > 0.5 &&
						r7310C1RuntimeSurfaceIsCeiling(hitType, hitObjectID, nl, x))
						r7310ProbeClassColor = vec3(1.0, 1.0, 1.0);
					else if (uR7310C1SouthWallDiffuseMode > 0.5 &&
						r7310C1SouthWallWindowRevealDiffuseUv(x, nl, r7310RuntimeProbeAtlasUv))
						r7310ProbeClassColor = vec3(0.0, 0.0, 1.0);
					else if (r7310C1RuntimeSurfaceIsSouthWall(hitType, hitObjectID, nl, x))
						r7310ProbeClassColor = vec3(0.0, 0.0, 1.0);
					else if (r7310C1RuntimeSurfaceIsWestWall(hitType, hitObjectID, nl, x))
						r7310ProbeClassColor = vec3(1.0, 1.0, 0.0);
					else if (r7310C1RuntimeSurfaceIsEastWall(hitType, hitObjectID, nl, x))
						r7310ProbeClassColor = vec3(1.0, 0.0, 1.0);
					else if (r7310C1RuntimeSurfaceIsNorthWall(hitType, hitObjectID, nl, x))
						r7310ProbeClassColor = vec3(0.0, 1.0, 1.0);
					accumCol += r7310ProbeClassColor;
				}
				else if (r7310C1RuntimeProbeMode > 1.5 && r7310C1RuntimeProbeMode < 2.5)
					accumCol += nl * 0.5 + 0.5;
				else if (r7310C1RuntimeProbeMode > 2.5 && r7310C1RuntimeProbeMode < 3.5)
					accumCol += vec3(clamp((x.y + 0.05) / 0.10, 0.0, 1.0), 0.0, 0.0);
				else if (r7310C1RuntimeProbeMode > 3.5 && r7310C1RuntimeProbeMode < 4.5)
					accumCol += vec3(clamp((rayDirection.y + 1.0) / 2.0, 0.0, 1.0), 0.0, 0.0);
				else if (r7310C1RuntimeProbeMode > 4.5 && r7310C1RuntimeProbeMode < 5.5)
					accumCol += hitIsRayExiting == TRUE ? vec3(1.0, 0.0, 0.0) : vec3(0.0);
				else if (r7310C1RuntimeProbeMode > 5.5 && r7310C1RuntimeProbeMode < 6.5)
					accumCol += vec3(clamp((uCamPos.y - 0.5) / 3.0, 0.0, 1.0), 0.0, 0.0);
				else if (r7310C1RuntimeProbeMode > 6.5 && r7310C1RuntimeProbeMode < 7.5)
				{
					// R7-3.10 H5 / H3' 黑線專項 Part 2 probe（readback-only，不改 short-circuit）：
					// 在命中處重算 nearest atlas row / col + hit world 座標。
					// R = row/res、G = col/res、B = hit world 座標 raw（Float32 readback 直接讀）。
					// floor 與 north 由相機分兩次 probe（per-surface mode flag 各自開），不需在像素編 kind。
					vec2 r7310ProbeLuv = vec2(0.0);
					float r7310ProbeWorld = 0.0;
					if (uR7310C1FloorDiffuseMode > 0.5 &&
						r7310C1RuntimeSurfaceIsTrueFloor(hitType, hitObjectID, nl, x) &&
						r7310C1BakePastePreviewUv(x, r7310ProbeLuv))
						r7310ProbeWorld = x.z;
					else if (uR7310C1NorthWallDiffuseMode > 0.5 &&
						r7310C1RuntimeSurfaceIsNorthWall(hitType, hitObjectID, nl, x) &&
						r7310C1NorthWallDiffuseUv(x, r7310ProbeLuv))
						r7310ProbeWorld = x.y;
					float r7310ProbeRes = max(1.0, uR7310C1RuntimeAtlasPatchResolution);
					vec2 r7310ProbeSafe = (clamp(r7310ProbeLuv, vec2(0.0), vec2(1.0)) * (r7310ProbeRes - 1.0) + 0.5) / r7310ProbeRes;
					float r7310ProbeRow = floor(r7310ProbeSafe.y * r7310ProbeRes);
					float r7310ProbeCol = floor(r7310ProbeSafe.x * r7310ProbeRes);
					// CODEX P1：診斷覆寫，不可用 += （否則混入前面已累積的 radiance，污染 row/col/world readback）
					accumCol = vec3(r7310ProbeRow / r7310ProbeRes, r7310ProbeCol / r7310ProbeRes, r7310ProbeWorld);
				}
				else if (r7310C1RuntimeProbeMode > 7.5 && r7310C1RuntimeProbeMode < 8.5)
				{
					vec2 r7310StructuralIslandUv = vec2(0.0);
					float r7310StructuralIslandId = r7310C1StructuralBeamColumnIslandId(hitType, hitObjectID, nl, x);
					if (uR7310C1StructuralDiffuseMode > 0.5 &&
						r7310StructuralIslandId > 0.5 &&
						r7310C1StructuralBeamColumnDiffuseUv(hitType, hitObjectID, nl, x, r7310StructuralIslandUv))
						accumCol = vec3(r7310StructuralIslandId / 255.0, r7310StructuralIslandUv.x, r7310StructuralIslandUv.y);
					else
						accumCol = vec3(0.0);
				}
				else if (r7310C1RuntimeProbeMode > 8.5 && r7310C1RuntimeProbeMode < 9.5)
				{
					if (uR7310C1StructuralDiffuseMode > 0.5 &&
						r7310C1RuntimeSurfaceIsStructuralBeamColumn(hitType, hitObjectID, nl, x))
						accumCol = x;
					else
						accumCol = vec3(0.0);
				}
				else if (r7310C1RuntimeProbeMode > 9.5 && r7310C1RuntimeProbeMode < 10.5)
				{
					if (uR7310C1EastWallDiffuseMode > 0.5 &&
						r7310C1RuntimeSurfaceIsEastWall(hitType, hitObjectID, nl, x))
						accumCol = x;
					else
						accumCol = vec3(0.0);
				}
				else
#endif
					accumCol += mask * r7310BakedRadiance;
				break;
			}
			diffuseCount++;

			// R7-3.10 全域 albedo-free 契約（CODEX 2026-06-16）：以 --r7310-separated-irradiance-bake 宣告的 dedicated 烤
			// 一律 albedo-free（北牆 patchId 1002、H2 patchId 1022 共用同一條，不再寫死單面，避免下一個 owner surface 重蹈雙乘）。
			bool r7310AlbedoFreeBakeFirstHit =
				(uR7310C1SeparatedBakeMode > 0.5 && r7310SeparatedDedicatedBakeFirstHit) ||
				r7310XatlasIndirectBakeFirstHit;
			if (!r7310AlbedoFreeBakeFirstHit)
				mask *= hitColor;
			
			bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear

			rayOrigin = x + nl * uEPS_intersect;

			if (float(diffuseCount) < uMaxBounces &&
				!r7310XatlasRuntimeMapped &&
					!(r7310FloorHybridFirstHit || r7310CeilingHybridFirstHit || r7310NorthWallHybridFirstHit || r7310EastWallHybridFirstHit || r7310SeColumnNorthHybridFirstHit || r7310SeColumnWestHybridFirstHit || r7310SouthWallAcHybridFirstHit || r7310EastWallBeamHybridFirstHit || r7310SwColumnNorthHybridFirstHit || r7310WestWallHybridFirstHit || r7310WestWallBeamHybridFirstHit || r7310SwColumnInnerShadowHybridFirstHit || r7310WestBeamInnerShadowHybridFirstHit || r7310WestBeamUnderShadowHybridFirstHit || r7310EastBeamInnerShadowHybridFirstHit || r7310EastBeamUnderShadowHybridFirstHit || r7310SouthWindowLeftRevealShadowHybridFirstHit || r7310SouthWindowRightRevealShadowHybridFirstHit || r7310SouthWindowBottomRevealShadowHybridFirstHit || r7310SouthWindowTopRevealShadowHybridFirstHit || r7310IronDoorRevealHybridFirstHit) &&
				r7310FloorHybridGuard &&
				r7310CeilingHybridGuard &&
				r7310NorthWallHybridGuard &&
				r7310EastWallHybridGuard &&
				r7310SeColumnNorthHybridGuard &&
				r7310SeColumnWestHybridGuard &&
				r7310SouthWallAcHybridGuard &&
				r7310EastWallBeamHybridGuard &&
				r7310SwColumnNorthHybridGuard &&
				r7310WestWallHybridGuard &&
				r7310WestWallBeamHybridGuard &&
				r7310SwColumnInnerShadowHybridGuard &&
				r7310WestBeamInnerShadowHybridGuard &&
				r7310WestBeamUnderShadowHybridGuard &&
				r7310EastBeamInnerShadowHybridGuard &&
				r7310EastBeamUnderShadowHybridGuard &&
				r7310SouthWindowLeftRevealShadowHybridGuard &&
				r7310SouthWindowRightRevealShadowHybridGuard &&
				r7310SouthWindowBottomRevealShadowHybridGuard &&
				r7310SouthWindowTopRevealShadowHybridGuard &&
				r7310IronDoorRevealHybridGuard)
        {
				diffuseBounceMask = mask;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				diffuseBounceRayOrigin = r7310XatlasIndirectBakeFirstHit
					? r7310C1XatlasBakeSecondaryRayOrigin(
						hitType,
						hitObjectID,
						nl,
						x,
						diffuseBounceRayDirection)
					: rayOrigin;
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			if (uR738C1BakeDiffuseOnlyMode > 0.5 &&
				r7310FloorIndirectBakeFirstHit &&
				willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310CeilingIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310NorthWallIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310EastWallIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310SeColumnNorthIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310SeColumnWestIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310SouthWallAcIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310EastWallBeamIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310SwColumnNorthIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310WestWallIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310WestWallBeamIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310SwColumnInnerShadowIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310WestBeamInnerShadowIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310WestBeamUnderShadowIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310EastBeamInnerShadowIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			if (r7310EastBeamUnderShadowIndirectBakeFirstHit && willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
				if ((r7310SouthWindowLeftRevealShadowIndirectBakeFirstHit ||
				r7310SouthWindowRightRevealShadowIndirectBakeFirstHit ||
				r7310SouthWindowBottomRevealShadowIndirectBakeFirstHit ||
				r7310SouthWindowTopRevealShadowIndirectBakeFirstHit ||
				r7310IronDoorRevealIndirectBakeFirstHit) &&
				willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
				indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
					diffuseCount++;
					continue;
				}
					if (r7310XatlasIndirectBakeFirstHit &&
						uR7310C1XatlasBakeFullRadianceMode < 0.5 &&
						willNeedDiffuseBounceRay == TRUE)
				{
					mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier);
					indirectMultApplied = true;
					rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
					diffuseCount++;
					continue;
				}
				// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
				float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
				vec3 r7310XatlasNeeSourcePosition = x;
				rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
#if defined(R7310_INCLUDE_BAKE_CAPTURE)
				if (uR7310C1XatlasBakeMode > 0.5)
				{
					if (uR7310R42aBakeWitness < -0.5) { rayOrigin += vec3(1.0); } // R4-2A keep-alive：保見證 uniform 在 bake/debug 變體 active
					r7310XatlasNeeSourcePosition = r7310C1XatlasBakeNeeShadowRayOrigin(
						hitType,
						hitObjectID,
						nl,
						x,
						rayDirection
					);
					if (length(r7310XatlasNeeSourcePosition - x) > 0.0)
					{
						rayDirection = sampleStochasticLightDynamic(r7310XatlasNeeSourcePosition, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
					}
					rayOrigin = r7310XatlasNeeSourcePosition + nl * uEPS_intersect;
				}
#endif
				lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
				lastNeeProbeThetaBin = neeProbeThetaBin;
				lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
				lastNeeSourceObjectID = hitObjectID;
				lastNeeSourceHitType = hitType;
				lastNeeSourceNormal = nl;
				lastNeeSourcePosition = r7310XatlasNeeSourcePosition;
				continue;

    }

    if (hitType == SPEC)
	{
		mask *= hitColor;

		rayDirection = reflect(rayDirection, nl);
		rayOrigin = x + nl * uEPS_intersect;

		continue;
	}

	}

	if (uCloudMisWeightProbeMode > 0)
		return max(vec3(0), accumCol);

	// R6 LGG-r15 B1 / r16 J3：Terminal 注入兩個來源
	//   uIsBorrowPass < 0.5  → 主 pass：可同時用 borrow 採樣 + constant ambient 保底
	//   uIsBorrowPass > 0.5  → 借光 pass 自身：跳過所有 terminal 注入，避免遞迴自我餵食
	// borrow      該像素 14 彈累積色 / sampleCounter，給暗角「來自場景反彈」的真實光
	// ambient     中性常數，給 borrow 0 或想要保底時用
	// 兩者皆 mask × value，path 越深 mask 越小，亮區自動衰減
	if (reachedMaxBounces && uIsBorrowPass < 0.5)
	{
		// R6 LGG-r28：拆掉 darkGate，只留 positionGate
		//
		// r20~r27 共 8 輪 darkGate 失敗紀錄（這次有實證根因）：
		//   darkGate = exp(-accumLuma × 100) 是 per-frame 0/1 機率分類
		//   但 pixel 多 frame 平均 E[darkGate] = (沒撞光機率) × 1 + (撞光機率) × ~0
		//   → E[darkGate] 直接等於該 pixel 的「沒撞光機率」
		//   → 牆面不同高度的沒撞光機率隨 NEE 幾何漸變
		//   → contribution = mask × borrow × strength × E[darkGate] × positionGate
		//                    形成沿 NEE 機率等高線的水平 banding
		//   → 不是雜訊、是真實空間結構、無法靠採樣消除
		//
		// 拆掉 darkGate 後 contribution = mask × borrow × strength × positionGate
		//   positionGate 用 borrow_luma 收斂後是 stable 空間平滑值
		//   不再有 per-frame 隨機性 → 無 banding
		//   AO 帶用 positionGate 微擋（borrow_luma 0.5 → gate 0.25 → 弱 lift）
		//   亮面 positionGate 0 → 完全不影響
		//   深暗角 positionGate ≈ 1 → 全套
		#if !defined(R7310_BAKE_ONLY_NO_BORROW) && !defined(R7310_RUNTIME_NO_BORROW_TEXTURE)
			if (uBorrowStrength > 0.0)
			{
				// R6 LGG-r29：positionGate 收緊到 (0.0, 0.3)
				// r28 範圍 (0.2, 0.6) 讓亮面（borrow_luma 0.4~0.6）也有 0.5 級 gate
				//   → contribution 受 1/8 borrow per-texel variance 影響、向外擴散變髒
				// 收緊到 (0.0, 0.3) 後 borrow_luma > 0.3 全擋（牆面/天花板/亮區乾淨）
				// 只剩深暗角與接觸暗角 borrow_luma < 0.3 時放行
				vec2 borrowUv = gl_FragCoord.xy / uResolution;
				vec3 borrowedSum = texture(tBorrowTexture, borrowUv).rgb;
				vec3 borrowedAvg = borrowedSum / max(uSampleCounter, 1.0);
				borrowedAvg = min(borrowedAvg, vec3(1.0));
				float borrowLuma = dot(borrowedAvg, vec3(0.299, 0.587, 0.114));
				float positionGate = 1.0 - smoothstep(0.0, 0.3, borrowLuma);
				accumCol += mask * borrowedAvg * uBorrowStrength * positionGate;
			}
		#endif
		if (uR73QuickPreviewTerminalMode > 0.5 && uR73QuickPreviewTerminalStrength > 0.0)
		{
			float r73QuickPreviewSampleFade = 1.0 - smoothstep(4.0, 24.0, uSampleCounter);
			vec3 r73QuickPreviewTerminalColor = vec3(0.075, 0.066, 0.054);
			float r73QuickPreviewSkyFacing = clamp(nl.y * 0.5 + 0.5, 0.0, 1.0);
			r73QuickPreviewTerminalColor *= mix(0.72, 1.18, r73QuickPreviewSkyFacing);
			accumCol += mask * r73QuickPreviewTerminalColor * uR73QuickPreviewTerminalStrength * r73QuickPreviewSampleFade;
		}
	}

	// R7-3.10 Phase 2 第三刀 H7' / sprout-paste-inside-guard：
	// uCamPos.y >= 0.025 確保相機在地板上方才套用 R7-3.8 嫩芽 paste。
	// normal view cam y≈1.45 通過；相機進入地板實體（inside view cam y≈-0.08）被擋。
	// follow-up probe 已證實此條件可完美區分兩種視角，且不依賴
	// firstVisibleIsRayExiting / firstVisibleHitType / firstVisibleObjectID。
	if (uR738C1BakeCaptureMode == 0 &&
		uR738C1BakePastePreviewMode > 0.5 &&
		uR738C1BakePastePreviewReady > 0.5 &&
		uCamPos.y >= 0.025 &&
		cloudVisibleSurfaceIsFloor(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition) &&
		!r739C1CurrentViewReflectionActiveForTarget(r739C1ReflectionTargetId(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition), firstVisiblePosition))
	{
		vec2 r738BakedPatchUv = vec2(0.0);
		if (r738C1BakePastePreviewUv(firstVisiblePosition, r738BakedPatchUv))
		{
			// R7-3.10 Phase 2 H7' / sprout-paste-inside-guard probe：
			// probe mode > 0 時覆寫 fragment 為 diagnostic 顏色，正常 mix 跳過。
			// probe mode = 0 時保持原本 100% 行為；外層 camera-y guard 仍正常生效。
			// 2026-05-15 follow-up probe 擴充 L5（hitType + objectID）/ L6（cameraPos.y）。
			float r738SproutPasteProbeMode = uR738C1SproutPasteProbeMode;
			if (r738SproutPasteProbeMode > 0.5 && r738SproutPasteProbeMode < 1.5)
				accumCol = vec3(1.0, 0.0, 0.0); // L1: paste-pass surface class
			else if (r738SproutPasteProbeMode > 1.5 && r738SproutPasteProbeMode < 2.5)
				accumCol = firstVisibleNormal * 0.5 + 0.5; // L2: firstVisibleNormal
			else if (r738SproutPasteProbeMode > 2.5 && r738SproutPasteProbeMode < 3.5)
				accumCol = vec3(clamp((firstVisiblePosition.y + 0.05) / 0.10, 0.0, 1.0), 0.0, 0.0); // L3: firstVisiblePosition.y
			else if (r738SproutPasteProbeMode > 3.5 && r738SproutPasteProbeMode < 4.5)
				accumCol = firstVisibleIsRayExiting == TRUE ? vec3(1.0, 0.0, 0.0) : vec3(0.0); // L4: firstVisibleIsRayExiting
			else if (r738SproutPasteProbeMode > 4.5 && r738SproutPasteProbeMode < 5.5)
			{
				// L5: firstVisibleHitType (R 通道) + firstVisibleObjectID 高低 8 bit (G/B 通道)
				// decode：hitType = round(R*255); objectID = round(B*255)*256 + round(G*255)
				float h = float(firstVisibleHitType);
				float oid = firstVisibleObjectID;
				accumCol = vec3(
					clamp(h / 255.0, 0.0, 1.0),
					clamp(mod(oid, 256.0) / 255.0, 0.0, 1.0),
					clamp(floor(oid / 256.0) / 255.0, 0.0, 1.0)
				);
			}
			else if (r738SproutPasteProbeMode > 5.5 && r738SproutPasteProbeMode < 6.5)
			{
				// L6: cameraPos.y 編碼到 [0, 1]，範圍 [-1.0, +4.0]
				// decode：cameraPosY = R * 5.0 - 1.0；normal cam=1.45→R≈0.49；inside cam=-0.08→R≈0.184
				accumCol = vec3(clamp((uCamPos.y + 1.0) / 5.0, 0.0, 1.0), 0.0, 0.0);
			}
			else
			{
				vec3 r738BakedPatchColor = r738C1BakePastePreviewSample(r738BakedPatchUv);
				accumCol = mix(accumCol, r738BakedPatchColor, clamp(uR738C1BakePastePreviewStrength, 0.0, 1.0));
			}
		}
	}

	if (uR738C1BakeCaptureMode == 0 &&
		uR739C1ReflectionReferenceMode < 0.5 &&
		uR739C1ReflectionSurfaceMaskMode < 0.5 &&
		uR739C1AccurateReflectionMode > 0.5 &&
		uR739C1ReflectionReady > 0.5)
	{
		accumCol += r739SampleAccurateSurfaceReflection(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition);
	}

	// R3-1 DCE-proof sink: 保留 uniform reference 但恆不貢獻 accumCol。
	// R3-3 fix02：原以 uR3EmissionGate 作係數──R3-1/R3-2 gate=0 時碰巧=0，但 R3-3 gate 翻成 1 後
	// sink = Σ(uCloudEmission) ≈ (40, 31, 22) 直接累加每個 pixel→全白。
	// 改 runtime-false guard：uR3EmissionGate ∈ {0, 1}，永不會 < -0.5；compiler 無法證明 false→uniform 不被 DCE。
	if (uR3EmissionGate < -0.5)
	{
		accumCol += uCloudEmission[0] + uCloudEmission[1] + uCloudEmission[2] + uCloudEmission[3] +
			uTrackEmission[0] + uTrackEmission[1] + uTrackEmission[2] + uTrackEmission[3] +
			uTrackWideEmission[0] + uTrackWideEmission[1] +
			vec3(uCloudObjIdBase + uCloudFaceArea[0] + uCloudFaceArea[1] + uCloudFaceArea[2] + uCloudFaceArea[3] + uEmissiveClamp) +
			vec3(uTrackWideBeamCos[0].x + uTrackWideBeamCos[0].y + uTrackWideBeamCos[1].x + uTrackWideBeamCos[1].y + uTrackWideLampIdBase);
		accumCol += uCloudRodCenter[0] + uCloudRodCenter[1] + uCloudRodCenter[2] + uCloudRodCenter[3] +
			uCloudRodHalfExtent[0] + uCloudRodHalfExtent[1] + uCloudRodHalfExtent[2] + uCloudRodHalfExtent[3];

	}
	return max(vec3(0), accumCol);

}


void SetupScene(void)
{
	vec3 z = vec3(0);
	vec3 L1 = uLightEmission;

	// R2-11 中央吸頂燈 — 向下的矩形 PDF 目標（僅作為 importance sampling 用，不在 SceneIntersect 中）
	// 可見幾何由圓柱承載，圓柱底面為 LIGHT、頂/側為 DIFF 白色外殼
	// 矩形外接圓柱底面圓（47×47cm at y=uCeilingLampPos.y - uCeilingLampHalfH，朝下）
	// R2-16：座標改由 uCeilingLampPos 動態計算，隨 uCloudPanelEnabled 聯動南北移動
	float _rq = uCeilingLampRadius;
	float _yq = uCeilingLampPos.y - uCeilingLampHalfH;
	float _xc = uCeilingLampPos.x;
	float _zc = uCeilingLampPos.z;
	ceilingLampQuad = Quad( vec3(0.0, -1.0, 0.0),
	                        vec3(_xc - _rq, _yq, _zc - _rq),
	                        vec3(_xc + _rq, _yq, _zc - _rq),
	                        vec3(_xc + _rq, _yq, _zc + _rq),
	                        vec3(_xc - _rq, _yq, _zc + _rq),
	                        L1, z, LIGHT);
}


#include <pathtracing_main>
