import type { PlayerClassId } from '../../types';

export interface RuntimeScenarioTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

export interface RuntimeScenarioLighting {
  ambientColor: string;
  ambientIntensity: number;
  directionalColor: string;
  directionalIntensity: number;
  directionalPosition: [number, number, number];
}

export interface RuntimeScenarioAtmosphere {
  fogEnabled: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
}

export interface RuntimeScenarioParticles {
  dustEnabled: boolean;
  mistEnabled: boolean;
  density: number;
  speed: number;
  opacity: number;
}

export interface RuntimeScenarioCameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface RuntimeScenarioConfig {
  scenarioId: string;
  scenarioTransform: RuntimeScenarioTransform;
  sceneObjects: RuntimeScenarioSceneObject[];
  heroSelectionSlots?: RuntimeScenarioHeroSlot[];
  heroBasePosition: [number, number, number];
  enemyBasePosition: [number, number, number];
  lighting: RuntimeScenarioLighting;
  atmosphere: RuntimeScenarioAtmosphere;
  particles: RuntimeScenarioParticles;
  cameraMode: 'battle-sim' | 'free';
  cameraState: RuntimeScenarioCameraState;
}

export interface RuntimeScenarioSceneObject {
  id: string;
  label: string;
  modelUrl: string;
  transform: RuntimeScenarioTransform;
}

export interface RuntimeScenarioHeroSlot {
  classId: PlayerClassId;
  position: [number, number, number];
  rotationY: number;
}

export interface RuntimeScenarioPreset {
  version: number;
  exportedAt: string;
  scenarioId: string;
  scenarioName: string;
  scenarioModelUrl: string;
  config: RuntimeScenarioConfig;
}

const RUNTIME_SCENARIO_PRESETS: Record<string, RuntimeScenarioPreset> = {
  'hero-selection': {
    version: 1,
    exportedAt: '2026-04-16T02:37:59.168Z',
    scenarioId: 'hero-selection',
    scenarioName: 'Hero Selection',
    scenarioModelUrl: new URL('../assets/Scenario/Tower/cenario_3d_torre.glb', import.meta.url).href,
    config: {
      scenarioId: 'hero-selection',
      scenarioTransform: {
        position: [-0.8782786604688742, 5.484000234294957, -0.20775746777177284],
        rotation: [0.028583256286450552, -1.5498129813442971, 0],
        scale: 17.882588560424573,
      },
      sceneObjects: [],
      heroSelectionSlots: [
        { classId: 'knight', position: [-5.065875029255851, -1.02, 3.0315979913560533], rotationY: 0.34 },
        { classId: 'barbarian', position: [-2.796920010942409, -1.02, -0.12], rotationY: 0.2 },
        { classId: 'mage', position: [0.15859680243079177, -1.02, 2.176172139616071], rotationY: 0.06 },
        { classId: 'ranger', position: [3.2778408920796833, -1.02, -0.12], rotationY: -0.2 },
        { classId: 'rogue', position: [5.642212994468803, -1.02, 2.6744567347513666], rotationY: -0.34 },
      ],
      heroBasePosition: [-2.1, -1, 0],
      enemyBasePosition: [2.1, -1, 0],
      lighting: {
        ambientColor: '#e5f1ff',
        ambientIntensity: 0.58,
        directionalColor: '#fefadc',
        directionalIntensity: 1.12,
        directionalPosition: [3.2, 6.1, 5.2],
      },
      atmosphere: {
        fogEnabled: true,
        fogColor: '#5a5735',
        fogNear: 12,
        fogFar: 42,
      },
      particles: {
        dustEnabled: true,
        mistEnabled: false,
        density: 0.5,
        speed: 0.42,
        opacity: 0.22,
      },
      cameraMode: 'free',
      cameraState: {
        position: [1.4059473017594344, 1.3084268926022895, 14.166037869265972],
        target: [1.1582310875212565, -0.4348756623832002, -0.17977113392723795],
        fov: 45,
      },
    },
  },
  tower: {
    version: 1,
    exportedAt: '2026-04-16T02:08:41.793Z',
    scenarioId: 'tower',
    scenarioName: 'Tower',
    scenarioModelUrl: new URL('../assets/Scenario/Tower/cenario_3d_torre.glb', import.meta.url).href,
    config: {
      scenarioId: 'tower',
      scenarioTransform: {
        position: [-0.8782786604688742, 5.484000234294957, -0.20775746777177284],
        rotation: [0.028583256286450552, -1.5498129813442971, 0],
        scale: 17.882588560424573,
      },
      sceneObjects: [],
      heroBasePosition: [-2.1, -1, 0],
      enemyBasePosition: [2.1, -1, 0],
      lighting: {
        ambientColor: '#e5f1ff',
        ambientIntensity: 0.58,
        directionalColor: '#fefadc',
        directionalIntensity: 1.12,
        directionalPosition: [3.2, 6.1, 5.2],
      },
      atmosphere: {
        fogEnabled: true,
        fogColor: '#5a5735',
        fogNear: 12,
        fogFar: 42,
      },
      particles: {
        dustEnabled: true,
        mistEnabled: false,
        density: 0.5,
        speed: 0.42,
        opacity: 0.22,
      },
      cameraMode: 'battle-sim',
      cameraState: {
        position: [0, 2.2, 11],
        target: [0, 0.2, 0],
        fov: 45,
      },
    },
  },
  dungeon: {
    version: 1,
    exportedAt: '2026-04-16T01:48:45.639Z',
    scenarioId: 'dungeon',
    scenarioName: 'Dungeon',
    scenarioModelUrl: new URL('../assets/Scenario/Dungeon/cenario_3d_dungeon.glb', import.meta.url).href,
    config: {
      scenarioId: 'dungeon',
      scenarioTransform: {
        position: [-0.14676935392444146, 4.166104885283986, -1.9197980601919153],
        rotation: [3.0124396829664177, -1.5234483725981338, 3.013498410924465],
        scale: 31.876938565784016,
      },
      sceneObjects: [],
      heroBasePosition: [-2.05, -1, 0],
      enemyBasePosition: [2.05, -1, 0],
      lighting: {
        ambientColor: '#dbeafe',
        ambientIntensity: 0.56,
        directionalColor: '#f8fafc',
        directionalIntensity: 0.98,
        directionalPosition: [2.8, 5.8, 4.8],
      },
      atmosphere: {
        fogEnabled: true,
        fogColor: '#517b7b',
        fogNear: 10,
        fogFar: 34,
      },
      particles: {
        dustEnabled: true,
        mistEnabled: false,
        density: 0.62,
        speed: 0.5,
        opacity: 0.25,
      },
      cameraMode: 'battle-sim',
      cameraState: {
        position: [-1.593434857170355, 1.9951470306593375, 13.548782476780294],
        target: [-0.2684385388874458, 0.515834782640783, -0.033319393714523686],
        fov: 45,
      },
    },
  },
  moutain: {
    version: 1,
    exportedAt: '2026-04-16T02:49:59.879Z',
    scenarioId: 'moutain',
    scenarioName: 'Mountain',
    scenarioModelUrl: new URL('../assets/Scenario/Moutain/cenario_3d_montanha.glb', import.meta.url).href,
    config: {
      scenarioId: 'moutain',
      scenarioTransform: {
        position: [-0.622838181152414, 1.7740583891503867, -1.4063092684384098],
        rotation: [-1.5921513204638782, -1.5621957698879716, -1.5882422593282355],
        scale: 20.51690457362007,
      },
      sceneObjects: [
        {
          id: 'scene-object-mo0vplfk-m95cre',
          label: 'Tower Object 1',
          modelUrl: new URL('../assets/Scenario/Tower/cenario_3d_torre_objeto.glb', import.meta.url).href,
          transform: {
            position: [-2.2268665940147696, 3.059670283458114, -22.43335412594464],
            rotation: [-3.141592653589793, -1.5094643673210264, -3.141592653589793],
            scale: 14.133388163415905,
          },
        },
      ],
      heroBasePosition: [-2.05, -1, 0],
      enemyBasePosition: [2.05, -1, 0],
      lighting: {
        ambientColor: '#dbeafe',
        ambientIntensity: 0.56,
        directionalColor: '#f8fafc',
        directionalIntensity: 0.98,
        directionalPosition: [2.8, 5.8, 4.8],
      },
      atmosphere: {
        fogEnabled: true,
        fogColor: '#94a3b8',
        fogNear: 8,
        fogFar: 26,
      },
      particles: {
        dustEnabled: true,
        mistEnabled: false,
        density: 0.55,
        speed: 0.45,
        opacity: 0.22,
      },
      cameraMode: 'free',
      cameraState: {
        position: [4.495909189342535, 5.478608540250615, 11.338752852228687],
        target: [1.643459977668827, 2.719083847608313, -0.39648318544302874],
        fov: 45,
      },
    },
  },
};

export const getRuntimeScenarioPreset = (scenarioId: string): RuntimeScenarioPreset | null => (
  RUNTIME_SCENARIO_PRESETS[scenarioId] ?? null
);
