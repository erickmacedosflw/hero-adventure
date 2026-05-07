import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

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
