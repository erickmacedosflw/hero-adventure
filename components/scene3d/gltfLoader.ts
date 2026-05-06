import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

let dracoLoader: DRACOLoader | null = null;

const getDecoderBasePath = () => {
  const baseUrl = import.meta.env.BASE_URL || './';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBaseUrl}draco/gltf/`;
};

const getDracoLoader = () => {
  if (dracoLoader) {
    return dracoLoader;
  }

  dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(getDecoderBasePath());
  dracoLoader.setDecoderConfig({ type: 'wasm' });
  return dracoLoader;
};

export const configureGltfLoader = (loader: GLTFLoader) => {
  loader.setDRACOLoader(getDracoLoader());
  loader.setMeshoptDecoder(MeshoptDecoder);
};
