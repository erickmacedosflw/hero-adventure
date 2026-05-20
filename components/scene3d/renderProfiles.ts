import type { RenderQualityProfile } from './types';
import type { RenderPlatform, RenderQualityPreset } from './environment';

const DESKTOP_PERFORMANCE_PROFILE: RenderQualityProfile = {
  isLowQuality: true,
  dpr: [0.5, 0.7],
  shadowMapSize: 384,
  starsCount: 140,
  contactShadowResolution: 44,
  antialias: false,
};

const DESKTOP_BALANCED_PROFILE: RenderQualityProfile = {
  isLowQuality: false,
  dpr: [0.75, 0.9],
  shadowMapSize: 512,
  starsCount: 460,
  contactShadowResolution: 72,
  antialias: false,
};

const DESKTOP_QUALITY_PROFILE: RenderQualityProfile = {
  isLowQuality: false,
  dpr: [1.0, 1.0],
  shadowMapSize: 768,
  starsCount: 760,
  contactShadowResolution: 100,
  antialias: false,
};

const MOBILE_PERFORMANCE_PROFILE: RenderQualityProfile = {
  isLowQuality: true,
  dpr: [0.65, 0.85],
  shadowMapSize: 384,
  starsCount: 140,
  contactShadowResolution: 44,
  antialias: false,
};

const MOBILE_BALANCED_PROFILE: RenderQualityProfile = {
  isLowQuality: false,
  dpr: [0.85, 1.1],
  shadowMapSize: 512,
  starsCount: 460,
  contactShadowResolution: 72,
  antialias: false,
};

const MOBILE_QUALITY_PROFILE: RenderQualityProfile = {
  isLowQuality: false,
  dpr: [1.0, 1.0],
  shadowMapSize: 768,
  starsCount: 700,
  contactShadowResolution: 100,
  antialias: false,
};

const ELECTRON_QUALITY_PROFILE: RenderQualityProfile = {
  isLowQuality: false,
  dpr: [1.0, 1.0],
  shadowMapSize: 2048,
  starsCount: 900,
  contactShadowResolution: 100,
  antialias: true,
};

export const cloneRenderQualityProfile = (profile: RenderQualityProfile): RenderQualityProfile => ({
  ...profile,
  dpr: [profile.dpr[0], profile.dpr[1]],
});

export const getRenderProfileForPlatform = ({
  platform,
  preset,
  isElectron,
}: {
  platform: RenderPlatform;
  preset: RenderQualityPreset;
  isElectron: boolean;
}): RenderQualityProfile => {
  if (isElectron) {
    return cloneRenderQualityProfile(ELECTRON_QUALITY_PROFILE);
  }

  if (platform === 'mobile') {
    if (preset === 'quality') return cloneRenderQualityProfile(MOBILE_QUALITY_PROFILE);
    if (preset === 'balanced') return cloneRenderQualityProfile(MOBILE_BALANCED_PROFILE);
    return cloneRenderQualityProfile(MOBILE_PERFORMANCE_PROFILE);
  }

  if (preset === 'quality') return cloneRenderQualityProfile(DESKTOP_QUALITY_PROFILE);
  if (preset === 'performance') return cloneRenderQualityProfile(DESKTOP_PERFORMANCE_PROFILE);
  return cloneRenderQualityProfile(DESKTOP_BALANCED_PROFILE);
};