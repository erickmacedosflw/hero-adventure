export interface RuntimeMenuPortalTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export interface RuntimeMenuPortalPreset {
  version: number;
  exportedAt: string;
  transform: RuntimeMenuPortalTransform;
}

export const MENU_NAVIGATION_PORTAL_MODEL_URL = new URL('../assets/Objetos/Portal/Portal_01.fbx', import.meta.url).href;
export const MENU_NAVIGATION_PORTAL_ALBEDO_URL = new URL('../assets/Objetos/Portal/Fantasy Portal 3D LowPoly Model_Textures_01.png', import.meta.url).href;
export const MENU_NAVIGATION_PORTAL_EMISSIVE_URL = new URL('../assets/Objetos/Portal/Fantasy Portal 3D LowPoly Model_Textures_Emissive.png', import.meta.url).href;
export const MENU_NAVIGATION_PORTAL_METALLIC_URL = new URL('../assets/Objetos/Portal/Fantasy Portal 3D LowPoly Model_Textures_Metallic.png', import.meta.url).href;

const RUNTIME_MENU_PORTAL_PRESET: RuntimeMenuPortalPreset = {
  version: 1,
  exportedAt: '2026-04-16T00:00:00.000Z',
  transform: {
    position: [-4.22, -0.97, 0.58],
    rotation: [0, 1.36, 0],
    scale: 1.0596,
  },
};

export const getRuntimeMenuPortalPreset = (): RuntimeMenuPortalPreset => RUNTIME_MENU_PORTAL_PRESET;
