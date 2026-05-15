import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

let dracoLoader: DRACOLoader | null = null;
let ktx2Loader: KTX2Loader | null = null;

const getDecoderBasePath = () => {
  const baseUrl = import.meta.env.BASE_URL || './';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBaseUrl}draco/gltf/`;
};

const getBasisBasePath = () => {
  const baseUrl = import.meta.env.BASE_URL || './';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBaseUrl}basis/`;
};

const getDracoLoader = () => {
  if (dracoLoader) return dracoLoader;
  dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(getDecoderBasePath());
  dracoLoader.setDecoderConfig({ type: 'wasm' });
  return dracoLoader;
};

const getKtx2Loader = () => {
  if (ktx2Loader) return ktx2Loader;
  ktx2Loader = new KTX2Loader();
  ktx2Loader.setTranscoderPath(getBasisBasePath());
  return ktx2Loader;
};

export const configureGltfLoader = (loader: GLTFLoader) => {
  loader.setDRACOLoader(getDracoLoader());
  loader.setKTX2Loader(getKtx2Loader());
  loader.setMeshoptDecoder(MeshoptDecoder);
};

// A 1×1 transparent PNG used as a placeholder so the FBX loader never issues
// real HTTP requests for textures that are embedded by filename inside FBX files.
// In production, Vite hashes asset filenames (e.g. knight_texture-abc12345.webp),
// but the FBX binary still references the original bare name (knight_texture.png),
// which resolves to a non-existent path and produces a 404. Textures are always
// applied manually via useTexture/drei after the model loads, so it is safe to
// discard the FBX-embedded texture loads entirely.
const BLANK_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=';

const fbxEmbeddedTextureManager = new THREE.LoadingManager();
fbxEmbeddedTextureManager.setURLModifier((url: string) => {
  if (/\.(png|jpg|jpeg|tga|bmp|gif|webp|ktx2)(\?.*)?$/i.test(url)) {
    return BLANK_PNG_DATA_URL;
  }
  return url;
});

/** Pass as the `extensions` callback to useLoader(FBXLoader, ...) so that
 *  textures embedded inside FBX files are silently discarded. */
export const configureFBXLoader = (loader: FBXLoader) => {
  loader.manager = fbxEmbeddedTextureManager;
};

/** FBX loader that ALLOWS texture loading — use for display-only viewers where
 *  the FBX contains embedded textures that should be shown (e.g. developer biped viewer).
 *  Uses a fresh dedicated LoadingManager per call so FBX sub-resource loading is
 *  properly coordinated and never races with the global DefaultLoadingManager. */
export const configureFBXLoaderDisplay = (loader: FBXLoader) => {
  loader.manager = new THREE.LoadingManager();
};
