import type { RenderQualityPreset } from './environment';
import type { RenderQualityProfile } from './types';

export interface SceneRenderSettings {
  shouldUsePostProcessing: boolean;
  shouldUseBloomAndVignette: boolean;
  shouldUseVignette: boolean;
  postProcessingMultisampling: number;
  backfaceOutlineThickness: number;
  shouldRenderAmbientDrift: boolean;
  particleRenderCap: number;
  shouldUseDepthOfField: boolean;
  activeDepthOfFieldRange: number;
  activeDepthOfFieldBokeh: number;
  activeDepthOfFieldHeight: number;
  activeBloomIntensity: number;
  activeBloomThreshold: number;
  activeBloomSmoothing: number;
  activeVignetteOffset: number;
  activeVignetteDarkness: number;
  mainShadowUpdateFps: number;
  forestFogNear: number;
  forestFogFar: number;
  noMainShadow: boolean;
  shadowsEnabled: boolean;
  useAlwaysFrameloop: boolean;
  mobileFpsCap: number;
  battleContactShadowResolution: number;
}

export const createSceneRenderSettings = ({
  renderQualityPreset,
  quality,
  isMobileDevice,
  isElectronRuntime,
  prioritizeUiMotion,
  isDungeonRun,
  runtimeCameraMenuFocus,
  dungeonFocusRange,
  forestFocusRange,
}: {
  renderQualityPreset: RenderQualityPreset;
  quality: RenderQualityProfile;
  isMobileDevice: boolean;
  isElectronRuntime: boolean;
  prioritizeUiMotion: boolean;
  isDungeonRun: boolean;
  runtimeCameraMenuFocus: boolean;
  dungeonFocusRange: number;
  forestFocusRange: number;
}): SceneRenderSettings => {
  const isPerformanceMode = renderQualityPreset === 'performance';
  const isQualityMode = renderQualityPreset === 'quality';
  const shouldPrioritizeUiMotion = prioritizeUiMotion;
  const shouldUseForestDepthOfField = false;
  const shouldUseDungeonDepthOfField = false;
  const forestBloomIntensity = isQualityMode ? 0.5 : (isMobileDevice ? 0.34 : 0.44);
  const dungeonBloomIntensity = isQualityMode ? 0.34 : (isMobileDevice ? 0.22 : 0.28);
  const shouldUseDepthOfField = isDungeonRun ? shouldUseDungeonDepthOfField : shouldUseForestDepthOfField;

  return {
    shouldUsePostProcessing: isQualityMode && !shouldPrioritizeUiMotion,
    shouldUseBloomAndVignette: isQualityMode && !shouldPrioritizeUiMotion,
    shouldUseVignette: isQualityMode && !shouldPrioritizeUiMotion,
    postProcessingMultisampling: 0,
    backfaceOutlineThickness: isPerformanceMode
      ? (isMobileDevice ? 0.045 : 0.06)
      : (isMobileDevice ? 0.055 : 0.07),
    shouldRenderAmbientDrift: isQualityMode && !shouldPrioritizeUiMotion,
    particleRenderCap: isPerformanceMode
      ? (isMobileDevice ? 24 : 48)
      : shouldPrioritizeUiMotion
        ? (isMobileDevice ? 36 : 54)
      : isQualityMode
        ? (isMobileDevice ? 120 : 150)
        : (isMobileDevice ? 60 : 90),
    shouldUseDepthOfField,
    activeDepthOfFieldRange: isDungeonRun ? dungeonFocusRange : forestFocusRange,
    activeDepthOfFieldBokeh: isDungeonRun ? 1.7 : 0.5,
    activeDepthOfFieldHeight: isDungeonRun ? 440 : 360,
    activeBloomIntensity: isDungeonRun ? dungeonBloomIntensity : forestBloomIntensity,
    activeBloomThreshold: isDungeonRun ? 0.5 : (shouldUseDepthOfField ? 0.42 : 0.48),
    activeBloomSmoothing: isDungeonRun ? 0.85 : (shouldUseDepthOfField ? 0.8 : 0.82),
    activeVignetteOffset: isDungeonRun ? 0.1 : (shouldUseDepthOfField ? 0.06 : 0.08),
    activeVignetteDarkness: runtimeCameraMenuFocus ? 0 : (isDungeonRun ? 0.42 : (shouldUseDepthOfField ? 0.1 : 0.13)),
    mainShadowUpdateFps: 24,
    forestFogNear: quality.isLowQuality ? 6 : 5,
    forestFogFar: quality.isLowQuality ? 22 : 28,
    noMainShadow: !isQualityMode || shouldPrioritizeUiMotion,
    shadowsEnabled: isQualityMode && !shouldPrioritizeUiMotion,
    useAlwaysFrameloop: isElectronRuntime || (!isMobileDevice && !isQualityMode),
    mobileFpsCap: isQualityMode ? 30 : 45,
    battleContactShadowResolution: (isMobileDevice && !isQualityMode)
      ? Math.min(quality.contactShadowResolution, 48)
      : (isPerformanceMode ? 48 : quality.contactShadowResolution),
  };
};