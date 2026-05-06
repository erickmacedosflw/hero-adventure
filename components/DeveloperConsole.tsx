import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Boxes, Bug, Layers3, Swords, Users, WandSparkles } from 'lucide-react';
import { ALL_ITEMS, DUNGEON_BOSS, DUNGEON_ENEMY_DATA, ENEMY_DATA } from '../constants';
import { getRegisteredWeapon3DByItemId, REGISTERED_WEAPON_ITEMS } from '../game/data/weaponCatalog';
import { getPlayerClassById, PLAYER_CLASSES } from '../game/data/classes';
import { DungeonBossTemplate, DungeonEnemyTemplate, EnemyTemplate, PlayerAnimationAction, PlayerClassId, Rarity } from '../types';
import { DeveloperBipedCharacterScene, DeveloperClassBuilderScene, DeveloperGltfMonsterScene, DeveloperKitbashScene, DeveloperMonsterScene, DeveloperScenarioComposerScene, DeveloperWeaponCalibrationScene } from './scene3d/DeveloperSceneAdapters';
import { SpriteAnimationLab } from './SpriteAnimationLab';
import type {
  DeveloperAnimationRuntimeDiagnostic,
  DeveloperKitbashAnalysis,
  DeveloperKitbashMainSlot,
  DeveloperKitbashPartSource,
  DeveloperKitbashSlot,
  DeveloperScenarioComposerConfig,
  DeveloperScenarioComposerExportPayload,
  DeveloperScenarioComposerHeroSlot,
  DeveloperScenarioComposerId,
  DeveloperScenarioComposerSceneObject,
  DeveloperScenarioComposerSelectionTarget,
  DeveloperScenarioComposerTransformMode,
  DeveloperWeaponTransformControlMode,
  DeveloperWeaponTransformOverride,
} from './scene3d/types';
import { ItemPreviewThree } from './items/ItemPreviewThree';
import { getRuntimeMenuPortalPreset, MENU_NAVIGATION_PORTAL_MODEL_URL, type RuntimeMenuPortalTransform } from '../game/data/runtimeMenuPortal';

type DeveloperTab = 'overview' | 'animation-lab' | 'monster-lab' | 'item-lab' | 'kitbash-lab' | 'sprite-lab' | 'scenario-lab' | 'gltf-monster-viewer' | 'biped-character-viewer';
type WeaponCalibrationViewMode = 'sandbox' | 'attached';

const animationActions: PlayerAnimationAction[] = ['idle', 'battle-idle', 'attack', 'defend', 'defend-hit', 'hit', 'critical-hit', 'item', 'heal', 'skill', 'evade', 'death'];
const automaticClipValue = '__automatic__';
const allBundlesValue = '__all__';
const defaultKitbashSlots: DeveloperKitbashSlot[] = ['head', 'torso', 'arms', 'legs'];
const mainKitbashSlots: DeveloperKitbashSlot[] = ['head', 'torso', 'arms', 'legs'];
const headAccessoryKitbashSlots: DeveloperKitbashSlot[] = ['hat', 'helmet', 'visor', 'mask', 'hood', 'beard'];
const otherAccessoryKitbashSlots: DeveloperKitbashSlot[] = ['cape', 'quiver', 'shoulders', 'accessory'];
const accessoryKitbashSlots: DeveloperKitbashSlot[] = [...headAccessoryKitbashSlots, ...otherAccessoryKitbashSlots];
const defaultKitbashAssignments: Partial<Record<DeveloperKitbashSlot, DeveloperKitbashPartSource>> = {
  head: 'base',
  torso: 'base',
  arms: 'base',
  legs: 'base',
  hat: 'none',
  helmet: 'none',
  visor: 'none',
  cape: 'none',
  quiver: 'none',
  mask: 'none',
  hood: 'none',
  beard: 'none',
  shoulders: 'none',
  accessory: 'none',
};
const kitbashSlotLabels: Record<DeveloperKitbashSlot, string> = {
  head: 'Cabeca',
  torso: 'Tronco',
  arms: 'Bracos',
  legs: 'Pernas',
  hat: 'Chapeu',
  helmet: 'Capacete',
  visor: 'Viseira',
  cape: 'Capa',
  quiver: 'Aljava',
  mask: 'Mascara',
  hood: 'Capuz',
  beard: 'Barba',
  shoulders: 'Ombreiras',
  accessory: 'Acessorio',
};

const createBuilderPartSelections = (classId: PlayerClassId): Record<DeveloperKitbashMainSlot, PlayerClassId> => ({
  head: classId,
  torso: classId,
  arms: classId,
  legs: classId,
});

const rarityTone: Record<Rarity, string> = {
  bronze: 'text-orange-200 border-orange-500/20 bg-orange-500/10',
  silver: 'text-slate-200 border-slate-400/20 bg-slate-400/10',
  gold: 'text-amber-200 border-amber-400/20 bg-amber-400/10',
};

const DEVELOPER_SCENARIO_CATALOG: Record<DeveloperScenarioComposerId, {
  id: DeveloperScenarioComposerId;
  label: string;
  modelUrl: string;
}> = {
  tower: {
    id: 'tower',
    label: 'Tower',
    modelUrl: new URL('../game/assets/ScenarioOptimized/Tower/cenario_3d_torre.draco.glb', import.meta.url).href,
  },
  forest: {
    id: 'forest',
    label: 'Florest',
    modelUrl: new URL('../game/assets/ScenarioOptimized/Florest/cenario_3d_floresta.draco.glb', import.meta.url).href,
  },
  dungeon: {
    id: 'dungeon',
    label: 'Dungeon',
    modelUrl: new URL('../game/assets/ScenarioOptimized/Dungeon/cenario_3d_dungeon.draco.glb', import.meta.url).href,
  },
  moutain: {
    id: 'moutain',
    label: 'Mountain',
    modelUrl: new URL('../game/assets/ScenarioOptimized/Moutain/cenario_3d_montanha.draco.glb', import.meta.url).href,
  },
  'hero-selection': {
    id: 'hero-selection',
    label: 'Hero Selection',
    modelUrl: new URL('../game/assets/ScenarioOptimized/Tower/cenario_3d_torre.draco.glb', import.meta.url).href,
  },
};

type DeveloperScenarioObjectTemplateId = DeveloperScenarioComposerId | 'tower-object';

const DEVELOPER_SCENE_OBJECT_TEMPLATE_CATALOG: Record<DeveloperScenarioObjectTemplateId, {
  id: DeveloperScenarioObjectTemplateId;
  label: string;
  modelUrl: string;
}> = {
  tower: {
    id: 'tower',
    label: 'Tower',
    modelUrl: DEVELOPER_SCENARIO_CATALOG.tower.modelUrl,
  },
  forest: {
    id: 'forest',
    label: 'Florest',
    modelUrl: DEVELOPER_SCENARIO_CATALOG.forest.modelUrl,
  },
  dungeon: {
    id: 'dungeon',
    label: 'Dungeon',
    modelUrl: DEVELOPER_SCENARIO_CATALOG.dungeon.modelUrl,
  },
  moutain: {
    id: 'moutain',
    label: 'Mountain',
    modelUrl: DEVELOPER_SCENARIO_CATALOG.moutain.modelUrl,
  },
  'hero-selection': {
    id: 'hero-selection',
    label: 'Hero Selection',
    modelUrl: DEVELOPER_SCENARIO_CATALOG['hero-selection'].modelUrl,
  },
  'tower-object': {
    id: 'tower-object',
    label: 'Tower Object',
    modelUrl: new URL('../game/assets/ScenarioOptimized/Tower/cenario_3d_torre_objeto.draco.glb', import.meta.url).href,
  },
};

type GltfMonsterCategory = 'Big' | 'Blob' | 'Flying';

const BIPED_ANIMATION_URL = new URL('../game/assets/Characters/Modelos/Exemplo/Meshy_AI_Animacoes.glb', import.meta.url).href;
const BIPED_CHARACTER_CATALOG = [
  { id: 'orc-normal',       label: 'Orc Normal',       characterUrl: new URL('../game/assets/Characters/Modelos/Exemplo/Orc_Normal.glb',       import.meta.url).href },
  { id: 'orc-pesado',       label: 'Orc Pesado',       characterUrl: new URL('../game/assets/Characters/Modelos/Exemplo/Orc_Pesado.glb',       import.meta.url).href },
  { id: 'orc-ladrao',       label: 'Orc Ladrão',       characterUrl: new URL('../game/assets/Characters/Modelos/Exemplo/Orc_Ladrao.glb',       import.meta.url).href },
  { id: 'orc-shaman',       label: 'Orc Xamã',         characterUrl: new URL('../game/assets/Characters/Modelos/Exemplo/Orc_Shaman.glb',       import.meta.url).href },
  { id: 'orc-arqueiro',     label: 'Orc Arqueiro',     characterUrl: new URL('../game/assets/Characters/Modelos/Exemplo/Orc_Arqueiro.glb',     import.meta.url).href },
  { id: 'orc-guerreiro',    label: 'Orc Guerreiro',    characterUrl: new URL('../game/assets/Characters/Modelos/Exemplo/Orc_Guerreiro.glb',    import.meta.url).href },
  { id: 'orc-lord-guereiro',label: 'Orc Lord Guereiro',characterUrl: new URL('../game/assets/Characters/Modelos/Exemplo/Orc_Lord_Guereiro.glb',import.meta.url).href },
] as const;

const ATLAS_MONSTERS_TEXTURE_URL = new URL('../game/assets/Characters/Monsters/Monsters/Big/Atlas_Monsters.png', import.meta.url).href;

const GLTF_MONSTER_CATALOG: Record<GltfMonsterCategory, Array<{ id: string; label: string; url: string }>> = {
  Big: [
    { id: 'big-Alien',       label: 'Alien',        url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Alien.gltf',       import.meta.url).href },
    { id: 'big-Birb',        label: 'Birb',         url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Birb.gltf',        import.meta.url).href },
    { id: 'big-BlueDemon',   label: 'Blue Demon',   url: new URL('../game/assets/Characters/Monsters/Monsters/Big/BlueDemon.gltf',   import.meta.url).href },
    { id: 'big-Bunny',       label: 'Bunny',        url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Bunny.gltf',       import.meta.url).href },
    { id: 'big-Cactoro',     label: 'Cactoro',      url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Cactoro.gltf',     import.meta.url).href },
    { id: 'big-Demon',       label: 'Demon',        url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Demon.gltf',       import.meta.url).href },
    { id: 'big-Dino',        label: 'Dino',         url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Dino.gltf',        import.meta.url).href },
    { id: 'big-Fish',        label: 'Fish',         url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Fish.gltf',        import.meta.url).href },
    { id: 'big-Frog',        label: 'Frog',         url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Frog.gltf',        import.meta.url).href },
    { id: 'big-Monkroose',   label: 'Monkroose',    url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Monkroose.gltf',   import.meta.url).href },
    { id: 'big-MushroomKing',label: 'MushroomKing', url: new URL('../game/assets/Characters/Monsters/Monsters/Big/MushroomKing.gltf',import.meta.url).href },
    { id: 'big-Ninja',       label: 'Ninja',        url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Ninja.gltf',       import.meta.url).href },
    { id: 'big-Orc',         label: 'Orc',          url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Orc.gltf',         import.meta.url).href },
    { id: 'big-Orc_Skull',   label: 'Orc Skull',    url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Orc_Skull.gltf',   import.meta.url).href },
    { id: 'big-Tribal',      label: 'Tribal',       url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Tribal.gltf',      import.meta.url).href },
    { id: 'big-Yeti',        label: 'Yeti',         url: new URL('../game/assets/Characters/Monsters/Monsters/Big/Yeti.gltf',        import.meta.url).href },
  ],
  Blob: [
    { id: 'blob-Alien',          label: 'Alien',          url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Alien.gltf',          import.meta.url).href },
    { id: 'blob-Birb',           label: 'Birb',           url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Birb.gltf',           import.meta.url).href },
    { id: 'blob-Cactoro',        label: 'Cactoro',        url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Cactoro.gltf',        import.meta.url).href },
    { id: 'blob-Cat',            label: 'Cat',            url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Cat.gltf',            import.meta.url).href },
    { id: 'blob-Chicken',        label: 'Chicken',        url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Chicken.gltf',        import.meta.url).href },
    { id: 'blob-Dog',            label: 'Dog',            url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Dog.gltf',            import.meta.url).href },
    { id: 'blob-Fish',           label: 'Fish',           url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Fish.gltf',           import.meta.url).href },
    { id: 'blob-GreenBlob',      label: 'Green Blob',     url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/GreenBlob.gltf',      import.meta.url).href },
    { id: 'blob-GreenSpikyBlob', label: 'Green Spiky',    url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/GreenSpikyBlob.gltf', import.meta.url).href },
    { id: 'blob-Mushnub',        label: 'Mushnub',        url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Mushnub.gltf',        import.meta.url).href },
    { id: 'blob-Mushnub_Evolved',label: 'Mushnub Evolved',url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Mushnub_Evolved.gltf',import.meta.url).href },
    { id: 'blob-Ninja',          label: 'Ninja',          url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Ninja.gltf',          import.meta.url).href },
    { id: 'blob-Orc',            label: 'Orc',            url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Orc.gltf',            import.meta.url).href },
    { id: 'blob-Pigeon',         label: 'Pigeon',         url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Pigeon.gltf',         import.meta.url).href },
    { id: 'blob-PinkBlob',       label: 'Pink Blob',      url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/PinkBlob.gltf',       import.meta.url).href },
    { id: 'blob-Wizard',         label: 'Wizard',         url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Wizard.gltf',         import.meta.url).href },
    { id: 'blob-Yeti',           label: 'Yeti',           url: new URL('../game/assets/Characters/Monsters/Monsters/Blob/Yeti.gltf',           import.meta.url).href },
  ],
  Flying: [
    { id: 'fly-Alpaking',         label: 'Alpaking',        url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Alpaking.gltf',         import.meta.url).href },
    { id: 'fly-Alpaking_Evolved', label: 'Alpaking Evolved',url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Alpaking_Evolved.gltf', import.meta.url).href },
    { id: 'fly-Armabee',          label: 'Armabee',         url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Armabee.gltf',          import.meta.url).href },
    { id: 'fly-Armabee_Evolved',  label: 'Armabee Evolved', url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Armabee_Evolved.gltf',  import.meta.url).href },
    { id: 'fly-Demon',            label: 'Demon',           url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Demon.gltf',            import.meta.url).href },
    { id: 'fly-Dragon',           label: 'Dragon',          url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Dragon.gltf',           import.meta.url).href },
    { id: 'fly-Dragon_Evolved',   label: 'Dragon Evolved',  url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Dragon_Evolved.gltf',   import.meta.url).href },
    { id: 'fly-Ghost',            label: 'Ghost',           url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Ghost.gltf',            import.meta.url).href },
    { id: 'fly-Ghost_Skull',      label: 'Ghost Skull',     url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Ghost_Skull.gltf',      import.meta.url).href },
    { id: 'fly-Glub',             label: 'Glub',            url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Glub.gltf',             import.meta.url).href },
    { id: 'fly-Glub_Evolved',     label: 'Glub Evolved',    url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Glub_Evolved.gltf',     import.meta.url).href },
    { id: 'fly-Goleling',         label: 'Goleling',        url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Goleling.gltf',         import.meta.url).href },
    { id: 'fly-Goleling_Evolved', label: 'Goleling Evolved',url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Goleling_Evolved.gltf', import.meta.url).href },
    { id: 'fly-Hywirl',           label: 'Hywirl',          url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Hywirl.gltf',           import.meta.url).href },
    { id: 'fly-Pigeon',           label: 'Pigeon',          url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Pigeon.gltf',           import.meta.url).href },
    { id: 'fly-Squidle',          label: 'Squidle',         url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Squidle.gltf',          import.meta.url).href },
    { id: 'fly-Tribal',           label: 'Tribal',          url: new URL('../game/assets/Characters/Monsters/Monsters/Flying/Tribal.gltf',           import.meta.url).href },
  ],
};

const GLTF_MONSTER_TOTAL = Object.values(GLTF_MONSTER_CATALOG).reduce((sum, list) => sum + list.length, 0);

/** Maps each PlayerAnimationAction to the corresponding GLTF clip name per monster category. */
type GltfMonsterAnimationMap = Partial<Record<PlayerAnimationAction, string>>;

const GLTF_MONSTER_ANIMATION_MAP: Record<GltfMonsterCategory, GltfMonsterAnimationMap> = {
  Big: {
    'idle':         'Idle',
    'battle-idle':  'Idle',
    'attack':       'Punch',
    'skill':        'Yes',
    'defend':       'Duck',
    'defend-hit':   'Duck',
    'hit':          'HitReact',
    'critical-hit': 'HitReact',
    'item':         'Yes',
    'heal':         'Yes',
    'evade':        'Jump_Idle',
    'death':        'Death',
  },
  Blob: {
    'idle':         'Idle',
    'battle-idle':  'Idle',
    'attack':       'Bite_Front',
    'skill':        'Yes',
    'defend':       'No',
    'defend-hit':   'HitRecieve',
    'hit':          'HitRecieve',
    'critical-hit': 'HitRecieve',
    'item':         'Yes',
    'heal':         'Yes',
    'evade':        'Jump',
    'death':        'Death',
  },
  Flying: {
    'idle':         'Flying_Idle',
    'battle-idle':  'Flying_Idle',
    'attack':       'Headbutt',
    'skill':        'Yes',
    'defend':       'Fast_Flying',
    'defend-hit':   'No',
    'hit':          'HitReact',
    'critical-hit': 'HitReact',
    'item':         'Yes',
    'heal':         'Yes',
    'evade':        'Fast_Flying',
    'death':        'Death',
  },
};

const GLTF_ACTION_LABELS: Partial<Record<PlayerAnimationAction, string>> = {
  'idle':         'Idle',
  'battle-idle':  'Battle Idle',
  'attack':       'Atacar',
  'skill':        'Habilidade',
  'defend':       'Defender',
  'defend-hit':   'Bloquear Golpe',
  'hit':          'Receber Golpe',
  'critical-hit': 'Crítico',
  'item':         'Usar Item',
  'heal':         'Curar',
  'evade':        'Esquivar',
  'death':        'Morte',
};

const DEFAULT_HERO_SELECTION_SLOTS: DeveloperScenarioComposerHeroSlot[] = [
  { classId: 'knight', position: [-5.065875029255851, -1.02, 3.0315979913560533], rotationY: 0.34 },
  { classId: 'barbarian', position: [-2.796920010942409, -1.02, -0.12], rotationY: 0.2 },
  { classId: 'mage', position: [0.15859680243079177, -1.02, 2.176172139616071], rotationY: 0.06 },
  { classId: 'ranger', position: [3.2778408920796833, -1.02, -0.12], rotationY: -0.2 },
  { classId: 'rogue', position: [5.642212994468803, -1.02, 2.6744567347513666], rotationY: -0.34 },
];

const createDefaultScenarioComposerConfig = (scenarioId: DeveloperScenarioComposerId): DeveloperScenarioComposerConfig => {
  if (scenarioId === 'tower') {
    // Synchronized with runtimeScenarios.ts tower preset (exportedAt: 2026-04-21T05:34:03.223Z)
    return {
      scenarioId,
      scenarioTransform: {
        position: [-1.0421131349766313, 5.338599053769031, -0.20450430643063555],
        rotation: [0, -1.4152377086023438, 0],
        scale: 17.658567621858744,
      },
      sceneObjects: [],
      heroBasePosition: [-2.1, -1, 0],
      enemyBasePosition: [2.1, -1, 0],
      menuPortalTransform: {
        position: [-4.22, -0.97, 0.58],
        rotation: [0, 1.36, 0],
        scale: 1.0596,
      },
      lighting: {
        ambientColor: '#fffff5',
        ambientIntensity: 0.58,
        directionalColor: '#ac97e2',
        directionalIntensity: 1.12,
        directionalPosition: [3.2, 6.1, 5.2],
      },
      atmosphere: {
        fogEnabled: true,
        fogColor: '#7d6991',
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
        position: [1.761540986929978, 2.892757405084535, 11.962994558348678],
        target: [0, 0.2, 0],
        fov: 45,
      },
    };
  }

  if (scenarioId === 'forest') {
    return {
      scenarioId,
      scenarioTransform: {
        position: [0, -1.15, -0.2],
        rotation: [0, 0, 0],
        scale: 1,
      },
      sceneObjects: [],
      heroBasePosition: [-2.05, -1, 0],
      enemyBasePosition: [2.05, -1, 0],
      lighting: {
        ambientColor: '#dcfce7',
        ambientIntensity: 0.64,
        directionalColor: '#fef9c3',
        directionalIntensity: 1.04,
        directionalPosition: [3, 6, 5],
      },
      atmosphere: {
        fogEnabled: true,
        fogColor: '#84cc16',
        fogNear: 16,
        fogFar: 46,
      },
      particles: {
        dustEnabled: true,
        mistEnabled: true,
        density: 0.55,
        speed: 0.4,
        opacity: 0.2,
      },
      cameraMode: 'battle-sim',
      cameraState: {
        position: [0, 2.2, 11],
        target: [0, 0.2, 0],
        fov: 45,
      },
    };
  }

  if (scenarioId === 'moutain') {
    return {
      scenarioId,
      scenarioTransform: {
        position: [-0.622838181152414, 1.7740583891503867, -1.4063092684384098],
        rotation: [-1.5921513204638782, -1.5621957698879716, -1.5882422593282355],
        scale: 20.51690457362007,
      },
      sceneObjects: [
        {
          id: 'scene-object-mo0vplfk-m95cre',
          label: 'Tower Object 1',
          modelUrl: new URL('../game/assets/ScenarioOptimized/Tower/cenario_3d_torre_objeto.draco.glb', import.meta.url).href,
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
        mistEnabled: true,
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
    };
  }

  if (scenarioId === 'hero-selection') {
    return {
      scenarioId,
      scenarioTransform: {
        position: [-0.8782786604688742, 5.484000234294957, -0.20775746777177284],
        rotation: [0.028583256286450552, -1.5498129813442971, 0],
        scale: 17.882588560424573,
      },
      sceneObjects: [],
      heroSelectionSlots: DEFAULT_HERO_SELECTION_SLOTS.map((entry) => ({
        classId: entry.classId,
        position: [...entry.position] as [number, number, number],
        rotationY: entry.rotationY,
      })),
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
    };
  }

  return {
    scenarioId,
    scenarioTransform: {
      position: [0, -1.15, 0],
      rotation: [0, 0, 0],
      scale: 1,
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
      fogColor: '#0f172a',
      fogNear: 10,
      fogFar: 34,
    },
    particles: {
      dustEnabled: true,
      mistEnabled: true,
      density: 0.62,
      speed: 0.5,
      opacity: 0.25,
    },
    cameraMode: 'battle-sim',
    cameraState: {
      position: [0, 2.2, 11],
      target: [0, 0.2, 0],
      fov: 45,
    },
  };
};

const createDefaultScenarioComposerState = (): Record<DeveloperScenarioComposerId, DeveloperScenarioComposerConfig> => ({
  tower: createDefaultScenarioComposerConfig('tower'),
  forest: createDefaultScenarioComposerConfig('forest'),
  dungeon: createDefaultScenarioComposerConfig('dungeon'),
  moutain: createDefaultScenarioComposerConfig('moutain'),
  'hero-selection': createDefaultScenarioComposerConfig('hero-selection'),
});

const normalizeHexColor = (value: string, fallback: string) => {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
};

const createScenarioSceneObjectId = () => (
  `scene-object-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
);

const toSceneObjectSelectionTarget = (objectId: string): DeveloperScenarioComposerSelectionTarget => (
  `scene-object:${objectId}` as DeveloperScenarioComposerSelectionTarget
);

const parseSceneObjectSelectionTarget = (target: DeveloperScenarioComposerSelectionTarget): string | null => (
  target.startsWith('scene-object:') ? target.slice('scene-object:'.length) : null
);

const createDefaultMenuPortalTransform = (): RuntimeMenuPortalTransform => {
  const preset = getRuntimeMenuPortalPreset();
  return {
    position: [...preset.transform.position] as [number, number, number],
    rotation: [...preset.transform.rotation] as [number, number, number],
    scale: preset.transform.scale,
  };
};

const createMenuPortalExportPayload = (transform: RuntimeMenuPortalTransform) => ({
  version: 1,
  exportedAt: new Date().toISOString(),
  transform,
});

const SelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) => (
  <label className="flex flex-col gap-2 text-sm">
    <span className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100 outline-none transition-colors focus:border-cyan-400/40"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </label>
);

const NumberField = ({
  label,
  value,
  onChange,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) => (
  <label className="flex flex-col gap-2 text-sm">
    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</span>
    <input
      type="number"
      value={value}
      step={step}
      onChange={(event) => {
        const normalized = event.target.value.replace(',', '.');
        onChange(Number(normalized));
      }}
      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition-colors focus:border-cyan-400/40"
    />
  </label>
);

const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-2 text-sm">
    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</span>
    <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-2 py-2">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-slate-700 bg-transparent"
      />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-slate-100 outline-none"
      />
    </div>
  </label>
);

export const DeveloperConsole: React.FC = () => {
  const [tab, setTab] = useState<DeveloperTab>('overview');
  const [classId, setClassId] = useState<PlayerClassId>('knight');
  const [animationAction, setAnimationAction] = useState<PlayerAnimationAction>('idle');
  const [isHit, setIsHit] = useState(false);
  const [builderWeaponId, setBuilderWeaponId] = useState('none');
  const [builderPartSelections, setBuilderPartSelections] = useState<Record<DeveloperKitbashMainSlot, PlayerClassId>>(createBuilderPartSelections('knight'));
  const [builderRuntimeDiagnostics, setBuilderRuntimeDiagnostics] = useState<Record<string, DeveloperAnimationRuntimeDiagnostic>>({});
  const [availableAnimationClips, setAvailableAnimationClips] = useState<string[]>([]);
  const [selectedAnimationBundle, setSelectedAnimationBundle] = useState(allBundlesValue);
  const [selectedAnimationClip, setSelectedAnimationClip] = useState(automaticClipValue);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [weaponTransformCopyStatus, setWeaponTransformCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [weaponTransformGizmoEnabled, setWeaponTransformGizmoEnabled] = useState(false);
  const [weaponTransformControlMode, setWeaponTransformControlMode] = useState<DeveloperWeaponTransformControlMode>('translate');
  const [weaponCalibrationViewMode, setWeaponCalibrationViewMode] = useState<WeaponCalibrationViewMode>('attached');
  const [monsterAnimationAction, setMonsterAnimationAction] = useState<PlayerAnimationAction>('battle-idle');
  const [monsterHit, setMonsterHit] = useState(false);
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'weapon' | 'armor' | 'potion' | 'helmet' | 'legs' | 'shield' | 'material'>('all');
  const [weaponTransformOverride, setWeaponTransformOverride] = useState<DeveloperWeaponTransformOverride>({
    position: [0.006, 0.119, -0.059],
    rotation: [0.288, -0.394, 0.243],
    scale: 0.600,
  });
  const [scenarioEditorScenarioId, setScenarioEditorScenarioId] = useState<DeveloperScenarioComposerId>('hero-selection');
  const [scenarioEditorConfigs, setScenarioEditorConfigs] = useState<Record<DeveloperScenarioComposerId, DeveloperScenarioComposerConfig>>(createDefaultScenarioComposerState);
  const [scenarioHeroClassId, setScenarioHeroClassId] = useState<PlayerClassId>('knight');
  const [scenarioSelectedHeroSlotClassId, setScenarioSelectedHeroSlotClassId] = useState<PlayerClassId>('knight');
  const [scenarioSelectionTarget, setScenarioSelectionTarget] = useState<DeveloperScenarioComposerSelectionTarget>('scenario');
  const [scenarioTransformMode, setScenarioTransformMode] = useState<DeveloperScenarioComposerTransformMode>('translate');
  const [scenarioTransformControlsEnabled, setScenarioTransformControlsEnabled] = useState(true);
  const [scenarioObjectTemplateId, setScenarioObjectTemplateId] = useState<DeveloperScenarioObjectTemplateId>('forest');
  const [scenarioSelectedObjectId, setScenarioSelectedObjectId] = useState('');
  const [scenarioExportStatus, setScenarioExportStatus] = useState<'idle' | 'copied' | 'downloaded' | 'error'>('idle');
  const [menuPortalExportStatus, setMenuPortalExportStatus] = useState<'idle' | 'copied' | 'downloaded' | 'error'>('idle');
  const selectedClass = useMemo(() => getPlayerClassById(classId), [classId]);
  const monsterCatalog = useMemo(() => {
    const entries: Array<{ id: string; label: string; family: string; enemy: EnemyTemplate | DungeonEnemyTemplate | DungeonBossTemplate }> = [];

    ENEMY_DATA.forEach((enemy) => {
      entries.push({ id: `hunt:${enemy.name}`, label: enemy.name, family: 'hunt', enemy });
    });

    DUNGEON_ENEMY_DATA.forEach((enemy) => {
      entries.push({ id: `dungeon:${enemy.name}`, label: enemy.name, family: 'dungeon', enemy });
    });

    entries.push({ id: `boss:${DUNGEON_BOSS.name}`, label: DUNGEON_BOSS.name, family: 'boss', enemy: DUNGEON_BOSS });
    return entries;
  }, []);
  const [selectedMonsterId, setSelectedMonsterId] = useState(monsterCatalog[0]?.id ?? '');
  const [scenarioMonsterId, setScenarioMonsterId] = useState(monsterCatalog[0]?.id ?? '');
  const [gltfMonsterCategory, setGltfMonsterCategory] = useState<GltfMonsterCategory>('Big');
  const [gltfMonsterIndex, setGltfMonsterIndex] = useState(0);
  const [gltfMonsterAnimationIndex, setGltfMonsterAnimationIndex] = useState(0);
  const [gltfMonsterAvailableAnimations, setGltfMonsterAvailableAnimations] = useState<string[]>([]);
  const [gltfMonsterSelectedAction, setGltfMonsterSelectedAction] = useState<PlayerAnimationAction | null>('battle-idle');
  // ─── Biped Character Viewer ───────────────────────────────────────────────────
  const [bipedCharacterIndex, setBipedCharacterIndex] = useState(0);
  const [bipedClipName, setBipedClipName] = useState<string | undefined>(undefined);
  const [bipedAvailableAnimations, setBipedAvailableAnimations] = useState<string[]>([]);
  const selectedBipedCharacter = BIPED_CHARACTER_CATALOG[bipedCharacterIndex];
  const gltfCategoryList = GLTF_MONSTER_CATALOG[gltfMonsterCategory];
  const selectedGltfMonster = gltfCategoryList[gltfMonsterIndex] ?? gltfCategoryList[0];
  const gltfCurrentAnimMap = GLTF_MONSTER_ANIMATION_MAP[gltfMonsterCategory];
  const gltfCurrentClipName = gltfMonsterSelectedAction ? (gltfCurrentAnimMap[gltfMonsterSelectedAction] ?? null) : null;
  const selectedMonsterEntry = useMemo(
    () => monsterCatalog.find((entry) => entry.id === selectedMonsterId) ?? monsterCatalog[0],
    [monsterCatalog, selectedMonsterId],
  );
  const selectedScenarioMonsterEntry = useMemo(
    () => monsterCatalog.find((entry) => entry.id === scenarioMonsterId) ?? monsterCatalog[0],
    [monsterCatalog, scenarioMonsterId],
  );
  const activeScenarioConfig = scenarioEditorConfigs[scenarioEditorScenarioId];
  const activeScenarioCatalogEntry = DEVELOPER_SCENARIO_CATALOG[scenarioEditorScenarioId];
  // menuPortalTransform is stored per-scenario inside activeScenarioConfig so it gets
  // included in the scenario JSON export automatically.
  const menuPortalTransform: RuntimeMenuPortalTransform =
    activeScenarioConfig.menuPortalTransform ?? createDefaultMenuPortalTransform();
  const activeScenarioSelectedObject = useMemo(
    () => activeScenarioConfig?.sceneObjects.find((entry) => entry.id === scenarioSelectedObjectId),
    [activeScenarioConfig?.sceneObjects, scenarioSelectedObjectId],
  );
  const activeScenarioSelectedHeroSlot = useMemo(
    () => activeScenarioConfig?.heroSelectionSlots?.find((entry) => entry.classId === scenarioSelectedHeroSlotClassId),
    [activeScenarioConfig?.heroSelectionSlots, scenarioSelectedHeroSlotClassId],
  );
  const kitbashDonorCatalog = useMemo(() => {
    const classEntries = PLAYER_CLASSES.map((playerClass) => ({
      id: `class:${playerClass.id}`,
      label: playerClass.name,
      sourceType: 'class' as const,
      assets: playerClass.assets,
      color: playerClass.visualProfile.primaryColor,
      scale: 1,
      attackStyle: 'armed' as const,
    }));

    const monsterEntries = monsterCatalog.map((entry) => ({
      id: `enemy:${entry.id}`,
      label: entry.label,
      sourceType: 'enemy' as const,
      assets: entry.enemy.assets,
      color: entry.enemy.color ?? '#e2e8f0',
      scale: entry.enemy.scale ?? 1,
      attackStyle: entry.enemy.attackStyle ?? 'armed',
    }));

    return [...classEntries, ...monsterEntries];
  }, [monsterCatalog]);
  const [kitbashBaseClassId, setKitbashBaseClassId] = useState<PlayerClassId>('knight');
  const [kitbashDonorId, setKitbashDonorId] = useState(kitbashDonorCatalog[1]?.id ?? kitbashDonorCatalog[0]?.id ?? '');
  const [kitbashAnimationAction, setKitbashAnimationAction] = useState<PlayerAnimationAction>('battle-idle');
  const [kitbashAnalysis, setKitbashAnalysis] = useState<DeveloperKitbashAnalysis | null>(null);
  const [kitbashSlotAssignments, setKitbashSlotAssignments] = useState<Partial<Record<DeveloperKitbashSlot, DeveloperKitbashPartSource>>>(defaultKitbashAssignments);
  const selectedKitbashDonor = useMemo(
    () => kitbashDonorCatalog.find((entry) => entry.id === kitbashDonorId) ?? kitbashDonorCatalog[0],
    [kitbashDonorCatalog, kitbashDonorId],
  );
  const availableKitbashSlots = useMemo(
    (): DeveloperKitbashSlot[] => kitbashAnalysis?.availableSlots ?? defaultKitbashSlots,
    [kitbashAnalysis],
  );
  const availableMainKitbashSlots = useMemo(
    () => availableKitbashSlots.filter((slot) => mainKitbashSlots.includes(slot)),
    [availableKitbashSlots],
  );
  const availableAccessoryKitbashSlots = useMemo(
    () => availableKitbashSlots.filter((slot) => accessoryKitbashSlots.includes(slot)),
    [availableKitbashSlots],
  );
  const mainPartDescriptors = useMemo(
    () => (kitbashAnalysis?.donorPartDescriptors ?? []).filter((descriptor) => descriptor.tags.some((tag) => mainKitbashSlots.includes(tag))),
    [kitbashAnalysis],
  );
  const accessoryPartDescriptors = useMemo(
    () => (kitbashAnalysis?.donorPartDescriptors ?? []).filter((descriptor) => descriptor.tags.some((tag) => accessoryKitbashSlots.includes(tag))),
    [kitbashAnalysis],
  );
  const headAccessoryPartDescriptors = useMemo(
    () => accessoryPartDescriptors.filter((descriptor) => descriptor.tags.some((tag) => headAccessoryKitbashSlots.includes(tag))),
    [accessoryPartDescriptors],
  );
  const otherAccessoryPartDescriptors = useMemo(
    () => accessoryPartDescriptors.filter((descriptor) => descriptor.tags.some((tag) => otherAccessoryKitbashSlots.includes(tag))),
    [accessoryPartDescriptors],
  );

  const itemOptions = useMemo(() => (
    ALL_ITEMS.filter((item) => itemTypeFilter === 'all' ? true : item.type === itemTypeFilter)
  ), [itemTypeFilter]);
  const builderWeaponOptions = useMemo(() => ([
    { value: 'none', label: 'Nenhuma' },
    ...REGISTERED_WEAPON_ITEMS.map((item) => ({ value: item.id, label: item.name })),
  ]), []);
  const [selectedItemId, setSelectedItemId] = useState(itemOptions[0]?.id ?? ALL_ITEMS[0]?.id ?? '');

  const selectedItem = useMemo(() => (
    itemOptions.find((item) => item.id === selectedItemId) ?? ALL_ITEMS.find((item) => item.id === selectedItemId) ?? itemOptions[0] ?? ALL_ITEMS[0]
  ), [itemOptions, selectedItemId]);
  const selectedRegisteredWeapon = useMemo(
    () => (builderWeaponId === 'none' ? undefined : getRegisteredWeapon3DByItemId(builderWeaponId)),
    [builderWeaponId],
  );

  const animationBundleOptions = useMemo(() => ([
    { value: allBundlesValue, label: 'Todos os pacotes' },
    ...selectedClass.assets.animationFiles.map((fileName) => ({
      value: fileName.replace(/\.fbx$/i, ''),
      label: fileName.replace(/\.fbx$/i, ''),
    })),
  ]), [selectedClass.assets.animationFiles]);

  const filteredAnimationClipOptions = useMemo(() => {
    const filteredClips = availableAnimationClips.filter((clipName) => (
      selectedAnimationBundle === allBundlesValue
        ? true
        : clipName.startsWith(`${selectedAnimationBundle}:`)
    ));

    return [
      { value: automaticClipValue, label: 'Mapeamento automatico por acao' },
      ...filteredClips.map((clipName) => ({
        value: clipName,
        label: clipName.includes(':') ? clipName.replace(':', ' -> ') : clipName,
      })),
    ];
  }, [availableAnimationClips, selectedAnimationBundle]);

  const shouldLoadAllAnimationBundles = selectedAnimationBundle === allBundlesValue;

  useEffect(() => {
    setSelectedAnimationBundle(allBundlesValue);
    setSelectedAnimationClip(automaticClipValue);
    setAvailableAnimationClips([]);
  }, [classId]);

  useEffect(() => {
    setBuilderPartSelections(createBuilderPartSelections(classId));
    setBuilderWeaponId('none');
    setWeaponTransformGizmoEnabled(false);
    setWeaponCalibrationViewMode('attached');
  }, [classId]);

  useEffect(() => {
    setBuilderRuntimeDiagnostics({});
  }, [animationAction, classId, selectedAnimationBundle, selectedAnimationClip, builderPartSelections.arms, builderPartSelections.head, builderPartSelections.legs, builderPartSelections.torso]);

  useEffect(() => {
    if (selectedAnimationClip === automaticClipValue) {
      return;
    }

    const clipStillAvailable = filteredAnimationClipOptions.some((option) => option.value === selectedAnimationClip);

    if (!clipStillAvailable) {
      setSelectedAnimationClip(automaticClipValue);
    }
  }, [filteredAnimationClipOptions, selectedAnimationClip]);

  useEffect(() => {
    if (copyStatus === 'idle') {
      return;
    }

    const timer = window.setTimeout(() => setCopyStatus('idle'), 1800);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  useEffect(() => {
    if (weaponTransformCopyStatus === 'idle') {
      return;
    }

    const timer = window.setTimeout(() => setWeaponTransformCopyStatus('idle'), 1800);
    return () => window.clearTimeout(timer);
  }, [weaponTransformCopyStatus]);

  useEffect(() => {
    if (scenarioExportStatus === 'idle') {
      return;
    }

    const timer = window.setTimeout(() => setScenarioExportStatus('idle'), 1800);
    return () => window.clearTimeout(timer);
  }, [scenarioExportStatus]);

  useEffect(() => {
    if (menuPortalExportStatus === 'idle') {
      return;
    }

    const timer = window.setTimeout(() => setMenuPortalExportStatus('idle'), 1800);
    return () => window.clearTimeout(timer);
  }, [menuPortalExportStatus]);

  useEffect(() => {
    if (!activeScenarioConfig) {
      if (scenarioSelectedObjectId !== '') {
        setScenarioSelectedObjectId('');
      }
      if (parseSceneObjectSelectionTarget(scenarioSelectionTarget)) {
        setScenarioSelectionTarget('scenario');
      }
      return;
    }

    if (activeScenarioConfig.sceneObjects.length === 0) {
      if (scenarioSelectedObjectId !== '') {
        setScenarioSelectedObjectId('');
      }
      if (parseSceneObjectSelectionTarget(scenarioSelectionTarget)) {
        setScenarioSelectionTarget('scenario');
      }
      return;
    }

    const stillExists = activeScenarioConfig.sceneObjects.some((entry) => entry.id === scenarioSelectedObjectId);
    if (!stillExists) {
      const fallbackId = activeScenarioConfig.sceneObjects[0].id;
      setScenarioSelectedObjectId(fallbackId);
      if (parseSceneObjectSelectionTarget(scenarioSelectionTarget)) {
        setScenarioSelectionTarget(toSceneObjectSelectionTarget(fallbackId));
      }
    }
  }, [activeScenarioConfig, scenarioSelectedObjectId, scenarioSelectionTarget]);

  useEffect(() => {
    const slots = activeScenarioConfig?.heroSelectionSlots;
    const selectedSlotFromTarget = scenarioSelectionTarget.startsWith('hero-slot:')
      ? (scenarioSelectionTarget.slice('hero-slot:'.length) as PlayerClassId)
      : null;

    if (selectedSlotFromTarget && (!slots || !slots.some((entry) => entry.classId === selectedSlotFromTarget))) {
      setScenarioSelectionTarget('scenario');
    }

    if (!slots || slots.length === 0) {
      return;
    }

    const selectedStillExists = slots.some((entry) => entry.classId === scenarioSelectedHeroSlotClassId);
    if (!selectedStillExists) {
      setScenarioSelectedHeroSlotClassId(slots[0].classId);
    }
  }, [activeScenarioConfig, scenarioSelectedHeroSlotClassId, scenarioSelectionTarget]);

  useEffect(() => {
    if (!selectedRegisteredWeapon) {
      setWeaponTransformGizmoEnabled(false);
      return;
    }

    setWeaponTransformGizmoEnabled(false);
    setWeaponCalibrationViewMode('attached');
    setWeaponTransformOverride({
      position: [...selectedRegisteredWeapon.handTransform.position] as [number, number, number],
      rotation: [...selectedRegisteredWeapon.handTransform.rotation] as [number, number, number],
      scale: selectedRegisteredWeapon.handTransform.scale,
    });
  }, [selectedRegisteredWeapon]);

  useEffect(() => {
    setGltfMonsterIndex(0);
    setGltfMonsterAnimationIndex(0);
    setGltfMonsterAvailableAnimations([]);
    setGltfMonsterSelectedAction('battle-idle');
  }, [gltfMonsterCategory]);

  useEffect(() => {
    setGltfMonsterAnimationIndex(0);
    setGltfMonsterAvailableAnimations([]);
  }, [gltfMonsterIndex]);

  useEffect(() => {
    setKitbashSlotAssignments((previousAssignments) => {
      const nextAssignments: Partial<Record<DeveloperKitbashSlot, DeveloperKitbashPartSource>> = {};

      availableKitbashSlots.forEach((slot) => {
        nextAssignments[slot] = previousAssignments[slot] ?? defaultKitbashAssignments[slot] ?? (mainKitbashSlots.includes(slot) ? 'base' : 'none');
      });

      return nextAssignments;
    });
  }, [availableKitbashSlots, kitbashDonorId]);

  const handleCopySelectedClip = async () => {
    const selectedClipLabel = selectedAnimationClip === automaticClipValue ? 'automatico' : selectedAnimationClip;
    const payload = [
      `baseClassId=${classId}`,
      `action=${animationAction}`,
      `bundle=${selectedAnimationBundle === allBundlesValue ? 'all' : selectedAnimationBundle}`,
      `clip=${selectedClipLabel}`,
      `head=${builderPartSelections.head}`,
      `torso=${builderPartSelections.torso}`,
      `arms=${builderPartSelections.arms}`,
      `legs=${builderPartSelections.legs}`,
      `weapon=${builderWeaponId}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };

  const handleCopyWeaponTransform = async () => {
    const payload = `handTransform: { position: [${weaponTransformOverride.position.map((value) => value.toFixed(3)).join(', ')}], rotation: [${weaponTransformOverride.rotation.map((value) => value.toFixed(3)).join(', ')}], scale: ${weaponTransformOverride.scale.toFixed(3)} },`;

    try {
      await navigator.clipboard.writeText(payload);
      setWeaponTransformCopyStatus('copied');
    } catch {
      setWeaponTransformCopyStatus('error');
    }
  };

  const updateActiveScenarioConfig = (
    updater: (current: DeveloperScenarioComposerConfig) => DeveloperScenarioComposerConfig,
  ) => {
    setScenarioEditorConfigs((current) => ({
      ...current,
      [scenarioEditorScenarioId]: updater(current[scenarioEditorScenarioId]),
    }));
  };

  const handleSceneScenarioTransformChange = (transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  }) => {
    updateActiveScenarioConfig((current) => ({
      ...current,
      scenarioTransform: {
        position: [...transform.position] as [number, number, number],
        rotation: [...transform.rotation] as [number, number, number],
        scale: Number.isFinite(transform.scale) ? Math.max(0.001, transform.scale) : current.scenarioTransform.scale,
      },
    }));
  };

  const handleSceneHeroPositionChange = (position: [number, number, number]) => {
    updateActiveScenarioConfig((current) => ({
      ...current,
      heroBasePosition: [...position] as [number, number, number],
    }));
  };

  const handleSceneEnemyPositionChange = (position: [number, number, number]) => {
    updateActiveScenarioConfig((current) => ({
      ...current,
      enemyBasePosition: [...position] as [number, number, number],
    }));
  };

  const handleSceneHeroSelectionSlotChange = (classId: PlayerClassId, position: [number, number, number], rotationY: number) => {
    updateActiveScenarioConfig((current) => ({
      ...current,
      heroSelectionSlots: (current.heroSelectionSlots ?? []).map((entry) => (
        entry.classId === classId
          ? {
              ...entry,
              position: [...position] as [number, number, number],
              rotationY: Number.isFinite(rotationY) ? rotationY : entry.rotationY,
            }
          : entry
      )),
    }));
  };

  const handleSceneCameraStateChange = (cameraState: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
  }) => {
    updateActiveScenarioConfig((current) => ({
      ...current,
      cameraState: {
        position: [...cameraState.position] as [number, number, number],
        target: [...cameraState.target] as [number, number, number],
        fov: Number.isFinite(cameraState.fov) ? Math.max(1, cameraState.fov) : current.cameraState.fov,
      },
    }));
  };

  const handleSceneObjectTransformChange = (
    objectId: string,
    transform: {
      position: [number, number, number];
      rotation: [number, number, number];
      scale: number;
    },
  ) => {
    updateActiveScenarioConfig((current) => ({
      ...current,
      sceneObjects: current.sceneObjects.map((entry) => (
        entry.id === objectId
          ? {
              ...entry,
              transform: {
                position: [...transform.position] as [number, number, number],
                rotation: [...transform.rotation] as [number, number, number],
                scale: Number.isFinite(transform.scale) ? Math.max(0.001, transform.scale) : entry.transform.scale,
              },
            }
          : entry
      )),
    }));
  };

  const handleSceneMenuPortalTransformChange = (transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  }) => {
    updateActiveScenarioConfig((current) => ({
      ...current,
      menuPortalTransform: {
        position: [...transform.position] as [number, number, number],
        rotation: [...transform.rotation] as [number, number, number],
        scale: Number.isFinite(transform.scale) ? Math.max(0.0001, transform.scale) : (current.menuPortalTransform?.scale ?? 1),
      },
    }));
  };

  const handleAddScenarioObject = () => {
    const template = DEVELOPER_SCENE_OBJECT_TEMPLATE_CATALOG[scenarioObjectTemplateId];
    if (!template) {
      return;
    }

    const sameModelCount = activeScenarioConfig.sceneObjects.filter((entry) => entry.modelUrl === template.modelUrl).length;
    const nextObject: DeveloperScenarioComposerSceneObject = {
      id: createScenarioSceneObjectId(),
      label: `${template.label} ${sameModelCount + 1}`,
      modelUrl: template.modelUrl,
      transform: {
        position: [0, -1.15, 0],
        rotation: [0, 0, 0],
        scale: 1,
      },
    };

    updateActiveScenarioConfig((current) => ({
      ...current,
      sceneObjects: [...current.sceneObjects, nextObject],
    }));
    setScenarioSelectedObjectId(nextObject.id);
    setScenarioSelectionTarget(toSceneObjectSelectionTarget(nextObject.id));
  };

  const handleRemoveSelectedScenarioObject = () => {
    if (!scenarioSelectedObjectId) {
      return;
    }

    updateActiveScenarioConfig((current) => ({
      ...current,
      sceneObjects: current.sceneObjects.filter((entry) => entry.id !== scenarioSelectedObjectId),
    }));

    if (parseSceneObjectSelectionTarget(scenarioSelectionTarget) === scenarioSelectedObjectId) {
      setScenarioSelectionTarget('scenario');
    }
  };

  const updateSelectedScenarioObject = (
    updater: (entry: DeveloperScenarioComposerSceneObject) => DeveloperScenarioComposerSceneObject,
  ) => {
    if (!scenarioSelectedObjectId) {
      return;
    }

    updateActiveScenarioConfig((current) => ({
      ...current,
      sceneObjects: current.sceneObjects.map((entry) => (
        entry.id === scenarioSelectedObjectId ? updater(entry) : entry
      )),
    }));
  };

  const buildScenarioExportPayload = (): DeveloperScenarioComposerExportPayload => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    scenarioId: scenarioEditorScenarioId,
    scenarioName: activeScenarioCatalogEntry.label,
    scenarioModelUrl: activeScenarioCatalogEntry.modelUrl,
    config: activeScenarioConfig,
  });

  const handleCopyScenarioJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildScenarioExportPayload(), null, 2));
      setScenarioExportStatus('copied');
    } catch {
      setScenarioExportStatus('error');
    }
  };

  const handleDownloadScenarioJson = () => {
    try {
      const payload = JSON.stringify(buildScenarioExportPayload(), null, 2);
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `scenario-${scenarioEditorScenarioId}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(href);
      setScenarioExportStatus('downloaded');
    } catch {
      setScenarioExportStatus('error');
    }
  };

  const handleCopyMenuPortalJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(createMenuPortalExportPayload(menuPortalTransform), null, 2));
      setMenuPortalExportStatus('copied');
    } catch {
      setMenuPortalExportStatus('error');
    }
  };

  const handleDownloadMenuPortalJson = () => {
    try {
      const payload = JSON.stringify(createMenuPortalExportPayload(menuPortalTransform), null, 2);
      const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = 'runtime-menu-portal.json';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(href);
      setMenuPortalExportStatus('downloaded');
    } catch {
      setMenuPortalExportStatus('error');
    }
  };

  const handleResetMenuPortalTransform = () => {
    updateActiveScenarioConfig((current) => {
      const next = { ...current };
      delete next.menuPortalTransform;
      return next;
    });
    setMenuPortalExportStatus('idle');
  };

  const handleResetScenarioConfig = () => {
    setScenarioEditorConfigs((current) => ({
      ...current,
      [scenarioEditorScenarioId]: createDefaultScenarioComposerConfig(scenarioEditorScenarioId),
    }));
    setScenarioExportStatus('idle');
  };

  const tabs: Array<{ id: DeveloperTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Hub', icon: <Bug size={16} /> },
    { id: 'animation-lab', label: 'Animacao', icon: <WandSparkles size={16} /> },
    { id: 'scenario-lab', label: 'Cenarios', icon: <Layers3 size={16} /> },
    { id: 'sprite-lab', label: 'Sprite Lab', icon: <WandSparkles size={16} /> },
    { id: 'monster-lab', label: 'Monstros 3D', icon: <Swords size={16} /> },
    { id: 'gltf-monster-viewer', label: 'Novos Monstros', icon: <Swords size={16} /> },
    { id: 'biped-character-viewer', label: 'Personagens GLB', icon: <Users size={16} /> },
    { id: 'item-lab', label: 'Itens 3D', icon: <Boxes size={16} /> },
    { id: 'kitbash-lab', label: 'Kitbash', icon: <Layers3 size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_30%),linear-gradient(180deg,#020617_0%,#030712_45%,#000000_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="game-surface panel-glow flex flex-col gap-5 rounded-[2rem] border border-cyan-400/10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300/75">Developer Route</div>
              <h1 className="mt-2 font-gamer text-3xl sm:text-4xl font-black text-white">Hero Tower Dev Console</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">Ferramentas internas para validar animações de classes, pré-visualizar itens 3D e inspecionar assets do jogo sem entrar no fluxo normal da campanha.</p>
            </div>
            <a href="/" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-200 transition-colors hover:border-cyan-400/30 hover:text-white">
              <ArrowLeft size={16} /> Voltar ao jogo
            </a>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setTab(entry.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition-colors ${tab === entry.id ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
              >
                {entry.icon}
                {entry.label}
              </button>
            ))}
          </div>
        </header>

        {tab === 'overview' && (
          <section className="mt-6 grid gap-4 lg:grid-cols-4">
            <button onClick={() => setTab('animation-lab')} className="game-surface rounded-[1.75rem] border border-indigo-400/15 p-6 text-left transition-transform hover:-translate-y-1">
              <div className="game-icon-badge h-12 w-12 text-cyan-300"><WandSparkles size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Laboratorio de Animacao</h2>
              <p className="mt-3 text-sm text-slate-400">Teste `idle`, `attack`, `defend`, `item`, `heal` e `skill` com o modelo real da classe e combinações de equipamento.</p>
            </button>

            <button onClick={() => setTab('sprite-lab')} className="game-surface rounded-[1.75rem] border border-cyan-400/15 p-6 text-left transition-transform hover:-translate-y-1">
              <div className="game-icon-badge h-12 w-12 text-cyan-300"><WandSparkles size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Sprite Animation Lab</h2>
              <p className="mt-3 text-sm text-slate-400">Monte animacoes por sprite sheet com varias tracks em paralelo, preview normal/loop e exportacao JSON.</p>
            </button>
            <button onClick={() => setTab('item-lab')} className="game-surface rounded-[1.75rem] border border-emerald-400/15 p-6 text-left transition-transform hover:-translate-y-1">
              <div className="game-icon-badge h-12 w-12 text-emerald-300"><Boxes size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Inspecao de Itens 3D</h2>
              <p className="mt-3 text-sm text-slate-400">Abra qualquer arma, armadura, escudo, poção ou material em preview 3D isolado para revisar proporção e acabamento.</p>
            </button>

            <button onClick={() => setTab('monster-lab')} className="game-surface rounded-[1.75rem] border border-cyan-400/15 p-6 text-left transition-transform hover:-translate-y-1">
              <div className="game-icon-badge h-12 w-12 text-cyan-300"><Swords size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Monstros 3D</h2>
              <p className="mt-3 text-sm text-slate-400">Selecione os esqueletos do jogo para validar modelo, escala e animação de combate no preview dedicado.</p>
            </button>

            <button onClick={() => setTab('gltf-monster-viewer')} className="game-surface rounded-[1.75rem] border border-emerald-400/15 p-6 text-left transition-transform hover:-translate-y-1">
              <div className="game-icon-badge h-12 w-12 text-emerald-300"><Swords size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Novos Monstros GLTF</h2>
              <p className="mt-3 text-sm text-slate-400">Visualize os {GLTF_MONSTER_TOTAL} novos modelos GLTF com animações em loop, textura Atlas e controles de câmera livres.</p>
            </button>

            <button onClick={() => setTab('biped-character-viewer')} className="game-surface rounded-[1.75rem] border border-indigo-400/15 p-6 text-left transition-transform hover:-translate-y-1">
              <div className="game-icon-badge h-12 w-12 text-indigo-300"><Users size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Personagens GLB</h2>
              <p className="mt-3 text-sm text-slate-400">Visualize os modelos biped Meshy AI com animações separadas. Teste retargeting cruzado de animações entre personagens.</p>
            </button>

            <button onClick={() => setTab('kitbash-lab')} className="game-surface rounded-[1.75rem] border border-fuchsia-400/15 p-6 text-left transition-transform hover:-translate-y-1">
              <div className="game-icon-badge h-12 w-12 text-fuchsia-300"><Layers3 size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Kitbash de Armaduras</h2>
              <p className="mt-3 text-sm text-slate-400">Compare a rig de duas fontes e valide se partes do corpo podem virar armadura ou equipamento reaproveitavel.</p>
            </button>

            <button onClick={() => setTab('scenario-lab')} className="game-surface rounded-[1.75rem] border border-cyan-400/15 p-6 text-left transition-transform hover:-translate-y-1">
              <div className="game-icon-badge h-12 w-12 text-cyan-300"><Layers3 size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Scenario Lab</h2>
              <p className="mt-3 text-sm text-slate-400">Monte os cenarios GLB de batalha com camera simulada, ajuste de luz/atmosfera e posicao base de heroi e inimigo.</p>
            </button>

            <div className="game-surface rounded-[1.75rem] border border-amber-400/15 p-6">
              <div className="game-icon-badge h-12 w-12 text-amber-300"><Swords size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Cobertura Atual</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Classes</div>
                  <div className="mt-1 text-2xl font-black text-cyan-200">{PLAYER_CLASSES.length}</div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Itens</div>
                  <div className="mt-1 text-2xl font-black text-emerald-200">{ALL_ITEMS.length}</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === 'kitbash-lab' && selectedKitbashDonor && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">base: {kitbashBaseClassId}</span>
                <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-100">doador: {selectedKitbashDonor.label}</span>
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">tipo: {selectedKitbashDonor.sourceType}</span>
                <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-indigo-100">acao: {kitbashAnimationAction}</span>
              </div>
              <div className="h-[360px] sm:h-[420px] lg:h-[520px] min-[1600px]:h-[620px] rounded-[1.5rem] border border-slate-800 bg-slate-950/60">
                <DeveloperKitbashScene
                  baseClassId={kitbashBaseClassId}
                  donorLabel={selectedKitbashDonor.label}
                  animationAction={kitbashAnimationAction}
                  donorAssets={selectedKitbashDonor.assets}
                  donorColor={selectedKitbashDonor.color}
                  donorScale={selectedKitbashDonor.scale}
                  donorAttackStyle={selectedKitbashDonor.attackStyle}
                  donorType={selectedKitbashDonor.sourceType}
                  slotAssignments={kitbashSlotAssignments}
                  analysis={kitbashAnalysis}
                  onAnalysisChange={setKitbashAnalysis}
                />
              </div>
            </div>

            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5 sm:p-6 xl:sticky xl:top-6">
              <h2 className="font-gamer text-2xl font-black text-white">Teste de Kitbash</h2>
              <p className="mt-2 text-sm text-slate-400">Use uma classe como base e compare com outra classe ou inimigo para medir reaproveitamento de cabeca, tronco, bracos e pernas como armadura.</p>

              <div className="mt-6 space-y-4">
                <SelectField
                  label="Classe Base"
                  value={kitbashBaseClassId}
                  onChange={(value) => setKitbashBaseClassId(value as PlayerClassId)}
                  options={PLAYER_CLASSES.map((playerClass) => ({ value: playerClass.id, label: playerClass.name }))}
                />
                <SelectField
                  label="Modelo Doador"
                  value={kitbashDonorId}
                  onChange={setKitbashDonorId}
                  options={kitbashDonorCatalog.map((entry) => ({ value: entry.id, label: `${entry.label} (${entry.sourceType})` }))}
                />
                <SelectField
                  label="Acao"
                  value={kitbashAnimationAction}
                  onChange={(value) => setKitbashAnimationAction(value as PlayerAnimationAction)}
                  options={animationActions.map((action) => ({ value: action, label: action }))}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Montador de Novo Modelo</div>
                <div className="mt-3 space-y-3">
                  {availableMainKitbashSlots.map((slot) => (
                    <div key={slot} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{kitbashSlotLabels[slot]}</div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {([
                          { value: 'base', label: 'Base' },
                          { value: 'donor', label: 'Doador' },
                          { value: 'none', label: 'Ocultar' },
                        ] as Array<{ value: DeveloperKitbashPartSource; label: string }>).map((option) => {
                          const isActive = (kitbashSlotAssignments[slot] ?? 'base') === option.value;

                          return (
                            <button
                              key={`${slot}-${option.value}`}
                              onClick={() => setKitbashSlotAssignments((current) => ({
                                ...current,
                                [slot]: option.value,
                              }))}
                              className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${isActive ? 'border-fuchsia-400/30 bg-fuchsia-500/14 text-fuchsia-100' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {availableAccessoryKitbashSlots.length ? (
                    <div className="rounded-xl border border-amber-400/20 bg-amber-500/8 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Itens Extras do Modelo</div>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {availableAccessoryKitbashSlots.map((slot) => (
                          <div key={slot} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{kitbashSlotLabels[slot]}</div>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              {([
                                { value: 'base', label: 'Base' },
                                { value: 'donor', label: 'Doador' },
                                { value: 'none', label: 'Ocultar' },
                              ] as Array<{ value: DeveloperKitbashPartSource; label: string }>).map((option) => {
                                const isActive = (kitbashSlotAssignments[slot] ?? 'base') === option.value;

                                return (
                                  <button
                                    key={`${slot}-${option.value}`}
                                    onClick={() => setKitbashSlotAssignments((current) => ({
                                      ...current,
                                      [slot]: option.value,
                                    }))}
                                    className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${isActive ? 'border-amber-400/30 bg-amber-500/14 text-amber-100' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 text-[11px] leading-5 text-slate-400">Os dois modelos ficam visiveis nas laterais. O modelo do meio nasce das escolhas que voce fizer em cada parte.</div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Compatibilidade</div>
                <div className="mt-2 flex items-end gap-3">
                  <div className="text-3xl font-black text-fuchsia-100">{kitbashAnalysis?.compatibilityScore ?? 0}%</div>
                  <div className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-100">{kitbashAnalysis?.compatibilityLabel ?? 'aguardando'}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="uppercase tracking-[0.18em] text-slate-500">Bones Base</div>
                    <div className="mt-1 text-lg font-black text-cyan-100">{kitbashAnalysis?.baseBoneCount ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="uppercase tracking-[0.18em] text-slate-500">Bones Doador</div>
                    <div className="mt-1 text-lg font-black text-amber-100">{kitbashAnalysis?.donorBoneCount ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="uppercase tracking-[0.18em] text-slate-500">Meshes Base</div>
                    <div className="mt-1 text-lg font-black text-cyan-100">{kitbashAnalysis?.baseMeshNames.length ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="uppercase tracking-[0.18em] text-slate-500">Meshes Doador</div>
                    <div className="mt-1 text-lg font-black text-amber-100">{kitbashAnalysis?.donorMeshNames.length ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Cobertura de Regioes</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[
                    { key: 'head', label: 'Cabeca' },
                    { key: 'torso', label: 'Tronco' },
                    { key: 'arms', label: 'Bracos' },
                    { key: 'legs', label: 'Pernas' },
                  ].map((entry) => (
                    <div key={entry.key} className={`rounded-xl border px-3 py-2 ${kitbashAnalysis?.regionCoverage[entry.key as keyof DeveloperKitbashAnalysis['regionCoverage']] ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100' : 'border-slate-800 bg-slate-900/70 text-slate-500'}`}>
                      {entry.label}: {kitbashAnalysis?.regionCoverage[entry.key as keyof DeveloperKitbashAnalysis['regionCoverage']] ? 'ok' : 'fraco'}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Diagnostico</div>
                <div className="mt-3 leading-5 text-slate-400">
                  {kitbashAnalysis
                    ? `Se a compatibilidade ficar alta e as regioes principais estiverem cobertas, o modelo doador e um bom candidato para virar armadura modular. Compatibilidade atual: ${kitbashAnalysis.compatibilityLabel}.`
                    : 'Selecione um modelo base e um doador para gerar o relatorio.'}
                </div>
                {kitbashAnalysis?.selectedSlotFitDiagnostics.length ? (
                  <div className={`mt-3 rounded-xl border px-3 py-2 ${kitbashAnalysis.hasFloatingRisk ? 'border-amber-400/20 bg-amber-500/10 text-amber-100' : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'}`}>
                    {kitbashAnalysis.hasFloatingRisk ? 'Algumas partes ainda tem risco de flutuar. O sistema aplicou ajuste automatico, mas essa combinacao merece revisao.' : 'Encaixe automatico dentro do esperado para as partes escolhidas.'}
                  </div>
                ) : null}
                <div className="mt-4 text-slate-500">Bones ausentes no doador: {kitbashAnalysis?.missingInDonor.length ?? 0}</div>
                <div className="mt-1 text-slate-500">Bones extras no doador: {kitbashAnalysis?.extraInDonor.length ?? 0}</div>
                <div className="mt-3 max-h-32 overflow-auto rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-[11px] leading-5 text-slate-400">
                  {(kitbashAnalysis?.missingInDonor.slice(0, 18) ?? []).join(', ') || 'Nenhum bone ausente relevante.'}
                </div>
                <div className="mt-3 max-h-32 overflow-auto rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-[11px] leading-5 text-slate-400">
                  {(kitbashAnalysis?.selectedSlotFitDiagnostics ?? []).map((diagnostic) => (
                    <div key={diagnostic.slot} className="mb-2 last:mb-0">
                      <span className="font-black text-slate-200">{kitbashSlotLabels[diagnostic.slot]}</span>
                      <span className={`ml-2 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${diagnostic.risk === 'high' ? 'border-rose-400/20 bg-rose-500/10 text-rose-100' : diagnostic.risk === 'warning' ? 'border-amber-400/20 bg-amber-500/10 text-amber-100' : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'}`}>{diagnostic.risk}</span>
                      <div>offset: {(diagnostic.offsetDistance * 100).toFixed(0)} | size mismatch: {(diagnostic.sizeMismatch * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                  {(kitbashAnalysis?.selectedSlotFitDiagnostics.length ?? 0) === 0 ? 'Escolha partes do doador para gerar a validacao de encaixe.' : null}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Partes Principais Detectadas</div>
                <div className="mt-3 max-h-48 overflow-auto rounded-xl border border-slate-800 bg-slate-900/70 p-3 leading-5 text-slate-400">
                  {mainPartDescriptors.slice(0, 24).map((descriptor) => (
                    <div key={`${descriptor.meshName}-${descriptor.tags.join('-')}`} className="mb-2 last:mb-0">
                      <span className="font-black text-slate-200">{descriptor.meshName}</span>
                      <span className="ml-2 text-slate-500">{descriptor.skinned ? 'skinned' : 'mesh'}</span>
                      <div>{descriptor.tags.filter((slot) => mainKitbashSlots.includes(slot)).map((slot) => kitbashSlotLabels[slot]).join(', ')}</div>
                    </div>
                  ))}
                  {mainPartDescriptors.length === 0 ? 'Nenhuma parte principal detectada ainda.' : null}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-amber-400/20 bg-slate-950/70 p-4 text-xs text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">Itens Extras Detectados</div>
                <div className="mt-2 text-[11px] leading-5 text-slate-400">Aqui ficam partes opcionais do modelo, como chapeu, bearhat, capacete, viseira, barba, mascara, capa e aljava. Elas ficam separadas da cabeca base e das partes principais.</div>
                <div className="mt-3 max-h-48 overflow-auto rounded-xl border border-slate-800 bg-slate-900/70 p-3 leading-5 text-slate-400">
                  <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Acessorios de Cabeca</div>
                  {headAccessoryPartDescriptors.slice(0, 24).map((descriptor) => (
                    <div key={`${descriptor.meshName}-${descriptor.tags.join('-')}`} className="mb-2 last:mb-0">
                      <span className="font-black text-slate-200">{descriptor.meshName}</span>
                      <span className="ml-2 text-slate-500">{descriptor.skinned ? 'skinned' : 'mesh'}</span>
                      <div>{descriptor.tags.filter((slot) => headAccessoryKitbashSlots.includes(slot)).map((slot) => kitbashSlotLabels[slot]).join(', ')}</div>
                    </div>
                  ))}
                  {headAccessoryPartDescriptors.length === 0 ? 'Nenhum acessorio de cabeca detectado neste modelo.' : null}
                  <div className="mb-3 mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Outros Itens Extras</div>
                  {otherAccessoryPartDescriptors.slice(0, 24).map((descriptor) => (
                    <div key={`${descriptor.meshName}-${descriptor.tags.join('-')}`} className="mb-2 last:mb-0">
                      <span className="font-black text-slate-200">{descriptor.meshName}</span>
                      <span className="ml-2 text-slate-500">{descriptor.skinned ? 'skinned' : 'mesh'}</span>
                      <div>{descriptor.tags.filter((slot) => otherAccessoryKitbashSlots.includes(slot)).map((slot) => kitbashSlotLabels[slot]).join(', ')}</div>
                    </div>
                  ))}
                  {otherAccessoryPartDescriptors.length === 0 ? 'Nenhum outro item extra detectado neste modelo.' : null}
                </div>
              </div>

            </div>
          </section>
        )}

        {tab === 'animation-lab' && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">base: {classId}</span>
                <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-indigo-100">acao: {animationAction}</span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                  clip: {selectedAnimationClip === automaticClipValue ? 'automatico' : selectedAnimationClip}
                </span>
                <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-100">cabeca: {builderPartSelections.head}</span>
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">tronco: {builderPartSelections.torso}</span>
                <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-sky-100">bracos: {builderPartSelections.arms}</span>
                <span className="rounded-full border border-lime-400/20 bg-lime-500/10 px-3 py-1 text-lime-100">pernas: {builderPartSelections.legs}</span>
              </div>
              <div className="h-[360px] sm:h-[420px] lg:h-[520px] min-[1600px]:h-[620px] rounded-[1.5rem] border border-slate-800 bg-slate-950/60">
                {selectedRegisteredWeapon && weaponCalibrationViewMode === 'sandbox' ? (
                  <DeveloperWeaponCalibrationScene
                    weaponId={selectedRegisteredWeapon.item.id}
                    weaponTransformOverride={weaponTransformOverride}
                    transformControlMode={weaponTransformControlMode}
                    onWeaponTransformOverrideChange={setWeaponTransformOverride}
                  />
                ) : (
                  <DeveloperClassBuilderScene
                    baseClassId={classId}
                    animationAction={animationAction}
                    partSelections={builderPartSelections}
                    equippedWeaponId={builderWeaponId === 'none' ? undefined : builderWeaponId}
                    weaponTransformOverride={builderWeaponId === 'none' ? undefined : weaponTransformOverride}
                    showWeaponAnchorHelper={builderWeaponId !== 'none'}
                    showWeaponTransformControls={builderWeaponId !== 'none' && weaponTransformGizmoEnabled}
                    weaponTransformControlMode={weaponTransformControlMode}
                    onWeaponTransformOverrideChange={setWeaponTransformOverride}
                    animationClipName={selectedAnimationClip === automaticClipValue ? undefined : selectedAnimationClip}
                    preferredAnimationBundle={shouldLoadAllAnimationBundles ? undefined : selectedAnimationBundle}
                    loadAllAnimationBundles={shouldLoadAllAnimationBundles}
                    loadSecondaryAnimationBundles={shouldLoadAllAnimationBundles}
                    onAvailableAnimationClipsChange={setAvailableAnimationClips}
                    onRuntimeDiagnosticsChange={setBuilderRuntimeDiagnostics}
                    isHit={isHit}
                  />
                )}
              </div>
            </div>

            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5 sm:p-6 xl:sticky xl:top-6">
              <h2 className="font-gamer text-2xl font-black text-white">Montador Modular</h2>
              <p className="mt-2 text-sm text-slate-400">Escolha a classe base que fornece o rig e troque cabeca, tronco, bracos e pernas de forma independente usando apenas modelos de classe.</p>

              <div className="mt-6 space-y-4">
                <SelectField label="Classe Base" value={classId} onChange={(value) => setClassId(value as PlayerClassId)} options={PLAYER_CLASSES.map((playerClass) => ({ value: playerClass.id, label: playerClass.name }))} />
                <SelectField label="Arma" value={builderWeaponId} onChange={setBuilderWeaponId} options={builderWeaponOptions} />
                <SelectField label="Cabeca" value={builderPartSelections.head} onChange={(value) => setBuilderPartSelections((current) => ({ ...current, head: value as PlayerClassId }))} options={PLAYER_CLASSES.map((playerClass) => ({ value: playerClass.id, label: playerClass.name }))} />
                <SelectField label="Tronco" value={builderPartSelections.torso} onChange={(value) => setBuilderPartSelections((current) => ({ ...current, torso: value as PlayerClassId }))} options={PLAYER_CLASSES.map((playerClass) => ({ value: playerClass.id, label: playerClass.name }))} />
                <SelectField label="Bracos" value={builderPartSelections.arms} onChange={(value) => setBuilderPartSelections((current) => ({ ...current, arms: value as PlayerClassId }))} options={PLAYER_CLASSES.map((playerClass) => ({ value: playerClass.id, label: playerClass.name }))} />
                <SelectField label="Pernas" value={builderPartSelections.legs} onChange={(value) => setBuilderPartSelections((current) => ({ ...current, legs: value as PlayerClassId }))} options={PLAYER_CLASSES.map((playerClass) => ({ value: playerClass.id, label: playerClass.name }))} />
                <SelectField
                  label="Acao"
                  value={animationAction}
                  onChange={(value) => setAnimationAction(value as PlayerAnimationAction)}
                  options={animationActions.map((action) => ({ value: action, label: action }))}
                />
                <SelectField
                  label="Pacote FBX"
                  value={selectedAnimationBundle}
                  onChange={setSelectedAnimationBundle}
                  options={animationBundleOptions}
                />
                <SelectField
                  label="Clip"
                  value={selectedAnimationClip}
                  onChange={setSelectedAnimationClip}
                  options={filteredAnimationClipOptions}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Clips carregados</div>
                <div className="mt-2 text-2xl font-black text-cyan-100">{availableAnimationClips.length}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">
                  {selectedAnimationClip === automaticClipValue
                    ? 'Modo atual: usando o mapeamento automatico baseado na acao selecionada.'
                    : `Modo atual: preview manual do clip ${selectedAnimationClip}.`}
                </div>
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs leading-5 text-slate-400">
                  Rig base: <span className="font-black text-slate-100">{classId}</span><br />
                  Mistura atual: <span className="font-black text-fuchsia-100">{builderPartSelections.head}</span> / <span className="font-black text-amber-100">{builderPartSelections.torso}</span> / <span className="font-black text-sky-100">{builderPartSelections.arms}</span> / <span className="font-black text-lime-100">{builderPartSelections.legs}</span>
                  <br />Arma ativa: <span className="font-black text-cyan-100">{builderWeaponId === 'none' ? 'nenhuma' : builderWeaponId}</span>
                </div>
                {selectedRegisteredWeapon ? (
                  <div className="mt-3 rounded-xl border border-cyan-400/20 bg-slate-900/70 p-3 text-xs leading-5 text-slate-300">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Calibrador de Mão</div>
                    <div className="mt-2 text-[11px] text-slate-400">Use Bancada para calibrar a arma isolada na origem. Depois troque para Na mao apenas para conferir o encaixe final no personagem.</div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <SelectField
                        label="Visualizacao"
                        value={weaponCalibrationViewMode}
                        onChange={(value) => setWeaponCalibrationViewMode(value as WeaponCalibrationViewMode)}
                        options={[
                          { value: 'sandbox', label: 'Bancada' },
                          { value: 'attached', label: 'Na mao' },
                        ]}
                      />
                      <button
                        onClick={() => setWeaponTransformGizmoEnabled((current) => !current)}
                        disabled={weaponCalibrationViewMode === 'sandbox'}
                        className={`rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-[0.18em] transition-colors ${weaponCalibrationViewMode === 'sandbox' ? 'cursor-not-allowed border-slate-800 bg-slate-950/70 text-slate-600' : weaponTransformGizmoEnabled ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-100' : 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/18'}`}
                      >
                        {weaponCalibrationViewMode === 'sandbox' ? 'Gizmo na bancada' : weaponTransformGizmoEnabled ? 'Desativar gizmo' : 'Ativar gizmo'}
                      </button>
                      <SelectField
                        label="Gizmo"
                        value={weaponTransformControlMode}
                        onChange={(value) => setWeaponTransformControlMode(value as DeveloperWeaponTransformControlMode)}
                        options={[
                          { value: 'translate', label: 'Mover' },
                          { value: 'rotate', label: 'Rotacionar' },
                          { value: 'scale', label: 'Escalar' },
                        ]}
                      />
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-[11px] text-slate-400">
                        Bancada: arma isolada na origem. Na mao: preview no personagem para validacao final.
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-[11px] text-slate-400">
                        Ajuste no 3D e solte o mouse para atualizar os valores abaixo.
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 font-mono text-[11px] text-slate-300">
                      handTransform: {'{'} position: [{weaponTransformOverride.position.map((value) => value.toFixed(3)).join(', ')}], rotation: [{weaponTransformOverride.rotation.map((value) => value.toFixed(3)).join(', ')}], scale: {weaponTransformOverride.scale.toFixed(3)} {'}'}
                    </div>
                    <button
                      onClick={() => { void handleCopyWeaponTransform(); }}
                      className="mt-3 w-full rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:bg-cyan-500/18"
                    >
                      {weaponTransformCopyStatus === 'copied' ? 'Hand transform copiado' : weaponTransformCopyStatus === 'error' ? 'Falha ao copiar' : 'Copiar handTransform'}
                    </button>
                  </div>
                ) : null}
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs leading-5 text-slate-400">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Status das partes</div>
                  <div className="mt-2 space-y-2">
                    {(['head', 'torso', 'arms', 'legs'] as DeveloperKitbashMainSlot[]).map((slot) => {
                      const diagnostic = builderRuntimeDiagnostics[`modular-${slot}`];
                      const statusTone = diagnostic?.status === 'playing'
                        ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                        : diagnostic?.status
                          ? 'border-rose-400/20 bg-rose-500/10 text-rose-100'
                          : 'border-slate-800 bg-slate-950/70 text-slate-500';

                      return (
                        <div key={slot} className={`rounded-lg border px-3 py-2 ${statusTone}`}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-black uppercase tracking-[0.14em]">{slot}</span>
                            <span>{diagnostic?.status ?? 'aguardando'}</span>
                          </div>
                          <div className="mt-1 text-[11px] opacity-80">
                            {diagnostic?.targetClipName ?? 'sem clip alvo'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={() => { void handleCopySelectedClip(); }}
                  className="mt-4 w-full rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:bg-cyan-500/18"
                >
                  {copyStatus === 'copied' ? 'Clip copiado' : copyStatus === 'error' ? 'Falha ao copiar' : 'Copiar clip selecionado'}
                </button>
              </div>

              <button
                onClick={() => {
                  setIsHit(true);
                  window.setTimeout(() => setIsHit(false), 220);
                }}
                className="mt-6 w-full rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-rose-100 transition-colors hover:bg-rose-500/18"
              >
                Disparar hit flash
              </button>
            </div>
          </section>
        )}

        {tab === 'scenario-lab' && activeScenarioConfig && selectedScenarioMonsterEntry && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">cenario: {activeScenarioCatalogEntry.label}</span>
                <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-indigo-100">camera: {activeScenarioConfig.cameraMode}</span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">heroi: {scenarioHeroClassId}</span>
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">inimigo: {selectedScenarioMonsterEntry.label}</span>
              </div>
              <div className="h-[380px] sm:h-[440px] lg:h-[560px] min-[1600px]:h-[650px] rounded-[1.5rem] border border-slate-800 bg-slate-950/60">
                <DeveloperScenarioComposerScene
                  scenarioModelUrl={activeScenarioCatalogEntry.modelUrl}
                  scenarioTransform={activeScenarioConfig.scenarioTransform}
                  menuPortalModelUrl={MENU_NAVIGATION_PORTAL_MODEL_URL}
                  menuPortalTransform={menuPortalTransform}
                  sceneObjects={activeScenarioConfig.sceneObjects}
                  heroClassId={scenarioHeroClassId}
                  heroSelectionSlots={activeScenarioConfig.heroSelectionSlots}
                  heroPosition={activeScenarioConfig.heroBasePosition}
                  enemyPosition={activeScenarioConfig.enemyBasePosition}
                  enemyName={selectedScenarioMonsterEntry.enemy.name}
                  enemyAssets={selectedScenarioMonsterEntry.enemy.assets}
                  enemyType={selectedScenarioMonsterEntry.enemy.type}
                  enemyColor={selectedScenarioMonsterEntry.enemy.color}
                  enemyScale={selectedScenarioMonsterEntry.enemy.scale}
                  enemyAttackStyle={selectedScenarioMonsterEntry.enemy.attackStyle}
                  lighting={activeScenarioConfig.lighting}
                  atmosphere={activeScenarioConfig.atmosphere}
                  particles={activeScenarioConfig.particles}
                  cameraMode={activeScenarioConfig.cameraMode}
                  cameraState={activeScenarioConfig.cameraState}
                  selectionTarget={scenarioSelectionTarget}
                  transformMode={scenarioTransformMode}
                  transformControlsEnabled={scenarioTransformControlsEnabled}
                  onSelectionTargetChange={setScenarioSelectionTarget}
                  onScenarioTransformChange={handleSceneScenarioTransformChange}
                  onSceneObjectTransformChange={handleSceneObjectTransformChange}
                  onMenuPortalTransformChange={handleSceneMenuPortalTransformChange}
                  onCameraStateChange={handleSceneCameraStateChange}
                  onHeroPositionChange={handleSceneHeroPositionChange}
                  onEnemyPositionChange={handleSceneEnemyPositionChange}
                  onHeroSelectionSlotChange={handleSceneHeroSelectionSlotChange}
                />
              </div>
            </div>

            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5 sm:p-6 xl:sticky xl:top-6">
              <h2 className="font-gamer text-2xl font-black text-white">Scenario Lab</h2>
              <p className="mt-2 text-sm text-slate-400">Posicione o cenario GLB, heroi e inimigo, simule a camera real da batalha e exporte JSON para cada cenario.</p>
              <p className="mt-2 text-xs text-slate-500">Editor livre: clique direto no modelo do cenario, heroi ou inimigo para selecionar o alvo e mover no gizmo (inclui eixo Y para subir/descer). A camera orbit fica livre quando nao esta arrastando o gizmo. Atalhos de movimento relativo a camera: W/A/S/D (frente/lado), Q/E (desce/sobe), Shift para passo maior.</p>

              <div className="mt-6 space-y-4">
                <SelectField
                  label="Cenario"
                  value={scenarioEditorScenarioId}
                  onChange={(value) => {
                    setScenarioEditorScenarioId(value as DeveloperScenarioComposerId);
                    setScenarioExportStatus('idle');
                  }}
                  options={Object.values(DEVELOPER_SCENARIO_CATALOG).map((entry) => ({ value: entry.id, label: entry.label }))}
                />
                <SelectField
                  label="Classe Heroi"
                  value={scenarioHeroClassId}
                  onChange={(value) => setScenarioHeroClassId(value as PlayerClassId)}
                  options={PLAYER_CLASSES.map((playerClass) => ({ value: playerClass.id, label: playerClass.name }))}
                />
                <SelectField
                  label="Inimigo"
                  value={scenarioMonsterId}
                  onChange={setScenarioMonsterId}
                  options={monsterCatalog.map((entry) => ({ value: entry.id, label: entry.label }))}
                />
                <SelectField
                  label="Camera"
                  value={activeScenarioConfig.cameraMode}
                  onChange={(value) => updateActiveScenarioConfig((current) => ({
                    ...current,
                    cameraMode: value as DeveloperScenarioComposerConfig['cameraMode'],
                  }))}
                  options={[
                    { value: 'battle-sim', label: 'Simular batalha' },
                    { value: 'free', label: 'Livre (Orbit)' },
                  ]}
                />
                <SelectField
                  label="Alvo do Gizmo"
                  value={scenarioSelectionTarget}
                  onChange={(value) => {
                    const nextTarget = value as DeveloperScenarioComposerSelectionTarget;
                    setScenarioSelectionTarget(nextTarget);
                    const selectedObjectId = parseSceneObjectSelectionTarget(nextTarget);
                    if (selectedObjectId) {
                      setScenarioSelectedObjectId(selectedObjectId);
                    }
                    if (nextTarget.startsWith('hero-slot:')) {
                      const classId = nextTarget.slice('hero-slot:'.length) as PlayerClassId;
                      setScenarioSelectedHeroSlotClassId(classId);
                    }
                  }}
                  options={[
                    { value: 'scenario', label: 'Cenario (transform completo)' },
                    { value: 'menu-portal', label: 'Portal global (todas cenas)' },
                    { value: 'hero', label: 'Heroi (posicao)' },
                    { value: 'enemy', label: 'Inimigo (posicao)' },
                    ...(activeScenarioConfig.heroSelectionSlots ?? []).map((entry) => ({
                      value: `hero-slot:${entry.classId}`,
                      label: `Slot selecao: ${entry.classId}`,
                    })),
                    ...activeScenarioConfig.sceneObjects.map((entry) => ({
                      value: toSceneObjectSelectionTarget(entry.id),
                      label: `Objeto extra: ${entry.label}`,
                    })),
                  ]}
                />
                <SelectField
                  label="Modo do Gizmo"
                  value={scenarioTransformMode}
                  onChange={(value) => setScenarioTransformMode(value as DeveloperScenarioComposerTransformMode)}
                  options={[
                    { value: 'translate', label: 'Mover' },
                    { value: 'rotate', label: 'Rotacionar' },
                    { value: 'scale', label: 'Escalar' },
                  ]}
                />
                <button
                  onClick={() => setScenarioTransformControlsEnabled((current) => !current)}
                  className={`rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-[0.18em] transition-colors ${scenarioTransformControlsEnabled ? 'border-cyan-400/30 bg-cyan-500/12 text-cyan-100' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                >
                  {scenarioTransformControlsEnabled ? 'Gizmo ativo na cena' : 'Ativar gizmo na cena'}
                </button>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Transform do Cenario</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <NumberField
                    label="Pos X"
                    value={activeScenarioConfig.scenarioTransform.position[0]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.scenarioTransform.position] as [number, number, number];
                      next[0] = Number.isFinite(value) ? value : 0;
                      return { ...current, scenarioTransform: { ...current.scenarioTransform, position: next } };
                    })}
                  />
                  <NumberField
                    label="Pos Y"
                    value={activeScenarioConfig.scenarioTransform.position[1]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.scenarioTransform.position] as [number, number, number];
                      next[1] = Number.isFinite(value) ? value : 0;
                      return { ...current, scenarioTransform: { ...current.scenarioTransform, position: next } };
                    })}
                  />
                  <NumberField
                    label="Pos Z"
                    value={activeScenarioConfig.scenarioTransform.position[2]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.scenarioTransform.position] as [number, number, number];
                      next[2] = Number.isFinite(value) ? value : 0;
                      return { ...current, scenarioTransform: { ...current.scenarioTransform, position: next } };
                    })}
                  />
                  <NumberField
                    label="Escala"
                    value={activeScenarioConfig.scenarioTransform.scale}
                    onChange={(value) => updateActiveScenarioConfig((current) => ({
                      ...current,
                      scenarioTransform: {
                        ...current.scenarioTransform,
                        scale: Number.isFinite(value) ? Math.max(0.001, value) : current.scenarioTransform.scale,
                      },
                    }))}
                  />
                  <NumberField
                    label="Rot X"
                    value={activeScenarioConfig.scenarioTransform.rotation[0]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.scenarioTransform.rotation] as [number, number, number];
                      next[0] = Number.isFinite(value) ? value : 0;
                      return { ...current, scenarioTransform: { ...current.scenarioTransform, rotation: next } };
                    })}
                  />
                  <NumberField
                    label="Rot Y"
                    value={activeScenarioConfig.scenarioTransform.rotation[1]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.scenarioTransform.rotation] as [number, number, number];
                      next[1] = Number.isFinite(value) ? value : 0;
                      return { ...current, scenarioTransform: { ...current.scenarioTransform, rotation: next } };
                    })}
                  />
                  <NumberField
                    label="Rot Z"
                    value={activeScenarioConfig.scenarioTransform.rotation[2]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.scenarioTransform.rotation] as [number, number, number];
                      next[2] = Number.isFinite(value) ? value : 0;
                      return { ...current, scenarioTransform: { ...current.scenarioTransform, rotation: next } };
                    })}
                  />
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Objetos Extras do Cenario</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <SelectField
                    label="Modelo extra"
                    value={scenarioObjectTemplateId}
                    onChange={(value) => setScenarioObjectTemplateId(value as DeveloperScenarioObjectTemplateId)}
                    options={Object.values(DEVELOPER_SCENE_OBJECT_TEMPLATE_CATALOG).map((entry) => ({ value: entry.id, label: entry.label }))}
                  />
                  <button
                    onClick={handleAddScenarioObject}
                    className="self-end rounded-xl border border-cyan-400/30 bg-cyan-500/12 px-3 py-3 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:bg-cyan-500/18"
                  >
                    Adicionar objeto
                  </button>
                </div>

                {activeScenarioConfig.sceneObjects.length > 0 ? (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <SelectField
                        label="Objeto selecionado"
                        value={scenarioSelectedObjectId}
                        onChange={(value) => {
                          setScenarioSelectedObjectId(value);
                          setScenarioSelectionTarget(toSceneObjectSelectionTarget(value));
                        }}
                        options={activeScenarioConfig.sceneObjects.map((entry) => ({ value: entry.id, label: entry.label }))}
                      />
                      <button
                        onClick={handleRemoveSelectedScenarioObject}
                        className="self-end rounded-xl border border-rose-400/30 bg-rose-500/12 px-3 py-3 text-xs font-black uppercase tracking-[0.18em] text-rose-100 transition-colors hover:bg-rose-500/18"
                      >
                        Remover objeto
                      </button>
                    </div>

                    {activeScenarioSelectedObject ? (
                      <>
                        <label className="mt-4 flex flex-col gap-2 text-sm">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Nome do objeto</span>
                          <input
                            type="text"
                            value={activeScenarioSelectedObject.label}
                            onChange={(event) => updateSelectedScenarioObject((entry) => ({ ...entry, label: event.target.value }))}
                            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition-colors focus:border-cyan-400/40"
                          />
                        </label>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <NumberField
                            label="Pos X"
                            value={activeScenarioSelectedObject.transform.position[0]}
                            onChange={(value) => updateSelectedScenarioObject((entry) => {
                              const next = [...entry.transform.position] as [number, number, number];
                              next[0] = Number.isFinite(value) ? value : 0;
                              return { ...entry, transform: { ...entry.transform, position: next } };
                            })}
                          />
                          <NumberField
                            label="Pos Y"
                            value={activeScenarioSelectedObject.transform.position[1]}
                            onChange={(value) => updateSelectedScenarioObject((entry) => {
                              const next = [...entry.transform.position] as [number, number, number];
                              next[1] = Number.isFinite(value) ? value : 0;
                              return { ...entry, transform: { ...entry.transform, position: next } };
                            })}
                          />
                          <NumberField
                            label="Pos Z"
                            value={activeScenarioSelectedObject.transform.position[2]}
                            onChange={(value) => updateSelectedScenarioObject((entry) => {
                              const next = [...entry.transform.position] as [number, number, number];
                              next[2] = Number.isFinite(value) ? value : 0;
                              return { ...entry, transform: { ...entry.transform, position: next } };
                            })}
                          />
                          <NumberField
                            label="Escala"
                            value={activeScenarioSelectedObject.transform.scale}
                            onChange={(value) => updateSelectedScenarioObject((entry) => ({
                              ...entry,
                              transform: {
                                ...entry.transform,
                                scale: Number.isFinite(value) ? Math.max(0.001, value) : entry.transform.scale,
                              },
                            }))}
                          />
                          <NumberField
                            label="Rot X"
                            value={activeScenarioSelectedObject.transform.rotation[0]}
                            onChange={(value) => updateSelectedScenarioObject((entry) => {
                              const next = [...entry.transform.rotation] as [number, number, number];
                              next[0] = Number.isFinite(value) ? value : 0;
                              return { ...entry, transform: { ...entry.transform, rotation: next } };
                            })}
                          />
                          <NumberField
                            label="Rot Y"
                            value={activeScenarioSelectedObject.transform.rotation[1]}
                            onChange={(value) => updateSelectedScenarioObject((entry) => {
                              const next = [...entry.transform.rotation] as [number, number, number];
                              next[1] = Number.isFinite(value) ? value : 0;
                              return { ...entry, transform: { ...entry.transform, rotation: next } };
                            })}
                          />
                          <NumberField
                            label="Rot Z"
                            value={activeScenarioSelectedObject.transform.rotation[2]}
                            onChange={(value) => updateSelectedScenarioObject((entry) => {
                              const next = [...entry.transform.rotation] as [number, number, number];
                              next[2] = Number.isFinite(value) ? value : 0;
                              return { ...entry, transform: { ...entry.transform, rotation: next } };
                            })}
                          />
                        </div>
                      </>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-4 text-xs text-slate-500">Nenhum objeto extra adicionado. Use o seletor acima para inserir quantos modelos quiser no mesmo cenario.</p>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Portal Global (todas cenas)</div>
                <p className="mt-2 text-xs text-slate-500">Transform unico para o portal de navegacao no acampamento. Esse JSON e separado e vale para qualquer cenario.</p>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <NumberField
                    label="Pos X"
                    value={menuPortalTransform.position[0]}
                    onChange={(value) => setMenuPortalTransform((current) => ({
                      ...current,
                      position: [Number.isFinite(value) ? value : 0, current.position[1], current.position[2]],
                    }))}
                  />
                  <NumberField
                    label="Pos Y"
                    value={menuPortalTransform.position[1]}
                    onChange={(value) => setMenuPortalTransform((current) => ({
                      ...current,
                      position: [current.position[0], Number.isFinite(value) ? value : 0, current.position[2]],
                    }))}
                  />
                  <NumberField
                    label="Pos Z"
                    value={menuPortalTransform.position[2]}
                    onChange={(value) => setMenuPortalTransform((current) => ({
                      ...current,
                      position: [current.position[0], current.position[1], Number.isFinite(value) ? value : 0],
                    }))}
                  />
                  <NumberField
                    label="Escala"
                    value={menuPortalTransform.scale}
                    onChange={(value) => setMenuPortalTransform((current) => ({
                      ...current,
                      scale: Number.isFinite(value) ? Math.max(0.0001, value) : current.scale,
                    }))}
                  />
                  <NumberField
                    label="Rot X"
                    value={menuPortalTransform.rotation[0]}
                    onChange={(value) => setMenuPortalTransform((current) => ({
                      ...current,
                      rotation: [Number.isFinite(value) ? value : 0, current.rotation[1], current.rotation[2]],
                    }))}
                  />
                  <NumberField
                    label="Rot Y"
                    value={menuPortalTransform.rotation[1]}
                    onChange={(value) => setMenuPortalTransform((current) => ({
                      ...current,
                      rotation: [current.rotation[0], Number.isFinite(value) ? value : 0, current.rotation[2]],
                    }))}
                  />
                  <NumberField
                    label="Rot Z"
                    value={menuPortalTransform.rotation[2]}
                    onChange={(value) => setMenuPortalTransform((current) => ({
                      ...current,
                      rotation: [current.rotation[0], current.rotation[1], Number.isFinite(value) ? value : 0],
                    }))}
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={handleResetMenuPortalTransform}
                    className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
                  >
                    Resetar
                  </button>
                  <button
                    onClick={() => { void handleCopyMenuPortalJson(); }}
                    className="rounded-xl border border-cyan-400/30 bg-cyan-500/12 px-3 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 transition-colors hover:bg-cyan-500/18"
                  >
                    {menuPortalExportStatus === 'copied' ? 'JSON copiado' : 'Copiar JSON'}
                  </button>
                  <button
                    onClick={handleDownloadMenuPortalJson}
                    className="rounded-xl border border-emerald-400/30 bg-emerald-500/12 px-3 py-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-100 transition-colors hover:bg-emerald-500/18"
                  >
                    {menuPortalExportStatus === 'downloaded' ? 'Baixado' : 'Baixar JSON'}
                  </button>
                </div>

                {menuPortalExportStatus === 'error' ? (
                  <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                    Nao foi possivel exportar o JSON do portal. Tente novamente.
                  </div>
                ) : null}
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Posicao de Combate</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <NumberField
                    label="Heroi X"
                    value={activeScenarioConfig.heroBasePosition[0]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.heroBasePosition] as [number, number, number];
                      next[0] = Number.isFinite(value) ? value : 0;
                      return { ...current, heroBasePosition: next };
                    })}
                  />
                  <NumberField
                    label="Heroi Y"
                    value={activeScenarioConfig.heroBasePosition[1]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.heroBasePosition] as [number, number, number];
                      next[1] = Number.isFinite(value) ? value : 0;
                      return { ...current, heroBasePosition: next };
                    })}
                  />
                  <NumberField
                    label="Heroi Z"
                    value={activeScenarioConfig.heroBasePosition[2]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.heroBasePosition] as [number, number, number];
                      next[2] = Number.isFinite(value) ? value : 0;
                      return { ...current, heroBasePosition: next };
                    })}
                  />
                  <NumberField
                    label="Inimigo X"
                    value={activeScenarioConfig.enemyBasePosition[0]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.enemyBasePosition] as [number, number, number];
                      next[0] = Number.isFinite(value) ? value : 0;
                      return { ...current, enemyBasePosition: next };
                    })}
                  />
                  <NumberField
                    label="Inimigo Y"
                    value={activeScenarioConfig.enemyBasePosition[1]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.enemyBasePosition] as [number, number, number];
                      next[1] = Number.isFinite(value) ? value : 0;
                      return { ...current, enemyBasePosition: next };
                    })}
                  />
                  <NumberField
                    label="Inimigo Z"
                    value={activeScenarioConfig.enemyBasePosition[2]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.enemyBasePosition] as [number, number, number];
                      next[2] = Number.isFinite(value) ? value : 0;
                      return { ...current, enemyBasePosition: next };
                    })}
                  />
                </div>
              </div>

              {activeScenarioConfig.heroSelectionSlots && activeScenarioConfig.heroSelectionSlots.length > 0 ? (
                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Slots da Tela de Selecao (5 Herois)</div>
                  <p className="mt-2 text-xs text-slate-500">Ajuste cada slot para definir onde cada heroi nasce na tela inicial.</p>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <SelectField
                      label="Slot do heroi"
                      value={scenarioSelectedHeroSlotClassId}
                      onChange={(value) => {
                        const classId = value as PlayerClassId;
                        setScenarioSelectedHeroSlotClassId(classId);
                        setScenarioSelectionTarget(`hero-slot:${classId}` as DeveloperScenarioComposerSelectionTarget);
                      }}
                      options={activeScenarioConfig.heroSelectionSlots.map((entry) => ({ value: entry.classId, label: entry.classId }))}
                    />
                    <button
                      onClick={() => setScenarioSelectionTarget(`hero-slot:${scenarioSelectedHeroSlotClassId}` as DeveloperScenarioComposerSelectionTarget)}
                      className="self-end rounded-xl border border-cyan-400/30 bg-cyan-500/12 px-3 py-3 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:bg-cyan-500/18"
                    >
                      Selecionar no gizmo
                    </button>
                  </div>

                  {activeScenarioSelectedHeroSlot ? (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <NumberField
                        label="Pos X"
                        value={activeScenarioSelectedHeroSlot.position[0]}
                        onChange={(value) => updateActiveScenarioConfig((current) => ({
                          ...current,
                          heroSelectionSlots: (current.heroSelectionSlots ?? []).map((entry) => (
                            entry.classId === scenarioSelectedHeroSlotClassId
                              ? { ...entry, position: [Number.isFinite(value) ? value : 0, entry.position[1], entry.position[2]] }
                              : entry
                          )),
                        }))}
                      />
                      <NumberField
                        label="Pos Y"
                        value={activeScenarioSelectedHeroSlot.position[1]}
                        onChange={(value) => updateActiveScenarioConfig((current) => ({
                          ...current,
                          heroSelectionSlots: (current.heroSelectionSlots ?? []).map((entry) => (
                            entry.classId === scenarioSelectedHeroSlotClassId
                              ? { ...entry, position: [entry.position[0], Number.isFinite(value) ? value : 0, entry.position[2]] }
                              : entry
                          )),
                        }))}
                      />
                      <NumberField
                        label="Pos Z"
                        value={activeScenarioSelectedHeroSlot.position[2]}
                        onChange={(value) => updateActiveScenarioConfig((current) => ({
                          ...current,
                          heroSelectionSlots: (current.heroSelectionSlots ?? []).map((entry) => (
                            entry.classId === scenarioSelectedHeroSlotClassId
                              ? { ...entry, position: [entry.position[0], entry.position[1], Number.isFinite(value) ? value : 0] }
                              : entry
                          )),
                        }))}
                      />
                      <NumberField
                        label="Rot Y"
                        value={activeScenarioSelectedHeroSlot.rotationY}
                        onChange={(value) => updateActiveScenarioConfig((current) => ({
                          ...current,
                          heroSelectionSlots: (current.heroSelectionSlots ?? []).map((entry) => (
                            entry.classId === scenarioSelectedHeroSlotClassId
                              ? { ...entry, rotationY: Number.isFinite(value) ? value : entry.rotationY }
                              : entry
                          )),
                        }))}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Luzes</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <ColorField
                    label="Cor ambiente"
                    value={activeScenarioConfig.lighting.ambientColor}
                    onChange={(value) => updateActiveScenarioConfig((current) => ({
                      ...current,
                      lighting: {
                        ...current.lighting,
                        ambientColor: normalizeHexColor(value, current.lighting.ambientColor),
                      },
                    }))}
                  />
                  <NumberField
                    label="Int. ambiente"
                    value={activeScenarioConfig.lighting.ambientIntensity}
                    onChange={(value) => updateActiveScenarioConfig((current) => ({
                      ...current,
                      lighting: {
                        ...current.lighting,
                        ambientIntensity: Number.isFinite(value) ? Math.max(0, value) : current.lighting.ambientIntensity,
                      },
                    }))}
                  />
                  <ColorField
                    label="Cor direcional"
                    value={activeScenarioConfig.lighting.directionalColor}
                    onChange={(value) => updateActiveScenarioConfig((current) => ({
                      ...current,
                      lighting: {
                        ...current.lighting,
                        directionalColor: normalizeHexColor(value, current.lighting.directionalColor),
                      },
                    }))}
                  />
                  <NumberField
                    label="Int. direcional"
                    value={activeScenarioConfig.lighting.directionalIntensity}
                    onChange={(value) => updateActiveScenarioConfig((current) => ({
                      ...current,
                      lighting: {
                        ...current.lighting,
                        directionalIntensity: Number.isFinite(value) ? Math.max(0, value) : current.lighting.directionalIntensity,
                      },
                    }))}
                  />
                  <NumberField
                    label="Dir X"
                    value={activeScenarioConfig.lighting.directionalPosition[0]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.lighting.directionalPosition] as [number, number, number];
                      next[0] = Number.isFinite(value) ? value : 0;
                      return { ...current, lighting: { ...current.lighting, directionalPosition: next } };
                    })}
                  />
                  <NumberField
                    label="Dir Y"
                    value={activeScenarioConfig.lighting.directionalPosition[1]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.lighting.directionalPosition] as [number, number, number];
                      next[1] = Number.isFinite(value) ? value : 0;
                      return { ...current, lighting: { ...current.lighting, directionalPosition: next } };
                    })}
                  />
                  <NumberField
                    label="Dir Z"
                    value={activeScenarioConfig.lighting.directionalPosition[2]}
                    onChange={(value) => updateActiveScenarioConfig((current) => {
                      const next = [...current.lighting.directionalPosition] as [number, number, number];
                      next[2] = Number.isFinite(value) ? value : 0;
                      return { ...current, lighting: { ...current.lighting, directionalPosition: next } };
                    })}
                  />
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Atmosfera e Particulas</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => updateActiveScenarioConfig((current) => ({
                      ...current,
                      atmosphere: {
                        ...current.atmosphere,
                        fogEnabled: !current.atmosphere.fogEnabled,
                      },
                    }))}
                    className={`rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-[0.18em] transition-colors ${activeScenarioConfig.atmosphere.fogEnabled ? 'border-cyan-400/30 bg-cyan-500/12 text-cyan-100' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                  >
                    {activeScenarioConfig.atmosphere.fogEnabled ? 'Fog ligado' : 'Fog desligado'}
                  </button>
                  <ColorField
                    label="Cor fog"
                    value={activeScenarioConfig.atmosphere.fogColor}
                    onChange={(value) => updateActiveScenarioConfig((current) => ({
                      ...current,
                      atmosphere: {
                        ...current.atmosphere,
                        fogColor: normalizeHexColor(value, current.atmosphere.fogColor),
                      },
                    }))}
                  />
                  <NumberField
                    label="Fog near"
                    value={activeScenarioConfig.atmosphere.fogNear}
                    onChange={(value) => updateActiveScenarioConfig((current) => ({
                      ...current,
                      atmosphere: {
                        ...current.atmosphere,
                        fogNear: Number.isFinite(value) ? Math.max(0.5, value) : current.atmosphere.fogNear,
                      },
                    }))}
                  />
                  <NumberField
                    label="Fog far"
                    value={activeScenarioConfig.atmosphere.fogFar}
                    onChange={(value) => updateActiveScenarioConfig((current) => ({
                      ...current,
                      atmosphere: {
                        ...current.atmosphere,
                        fogFar: Number.isFinite(value) ? Math.max(current.atmosphere.fogNear + 1, value) : current.atmosphere.fogFar,
                      },
                    }))}
                  />
                  <button
                    onClick={() => updateActiveScenarioConfig((current) => ({
                      ...current,
                      particles: {
                        ...current.particles,
                        mistEnabled: !current.particles.mistEnabled,
                      },
                    }))}
                    className={`rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-[0.18em] transition-colors ${activeScenarioConfig.particles.mistEnabled ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-100' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                  >
                    {activeScenarioConfig.particles.mistEnabled ? 'Neblina on' : 'Neblina off'}
                  </button>
                  <button
                    onClick={() => updateActiveScenarioConfig((current) => ({
                      ...current,
                      particles: {
                        ...current.particles,
                        dustEnabled: !current.particles.dustEnabled,
                      },
                    }))}
                    className={`rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-[0.18em] transition-colors ${activeScenarioConfig.particles.dustEnabled ? 'border-amber-400/30 bg-amber-500/12 text-amber-100' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                  >
                    {activeScenarioConfig.particles.dustEnabled ? 'Poeira on' : 'Poeira off'}
                  </button>
                  <NumberField
                    label="Densidade"
                    value={activeScenarioConfig.particles.density}
                    onChange={(value) => updateActiveScenarioConfig((current) => ({
                      ...current,
                      particles: {
                        ...current.particles,
                        density: Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : current.particles.density,
                      },
                    }))}
                  />
                  <NumberField
                    label="Velocidade"
                    value={activeScenarioConfig.particles.speed}
                    onChange={(value) => updateActiveScenarioConfig((current) => ({
                      ...current,
                      particles: {
                        ...current.particles,
                        speed: Number.isFinite(value) ? Math.min(2, Math.max(0, value)) : current.particles.speed,
                      },
                    }))}
                  />
                  <NumberField
                    label="Opacidade"
                    value={activeScenarioConfig.particles.opacity}
                    onChange={(value) => updateActiveScenarioConfig((current) => ({
                      ...current,
                      particles: {
                        ...current.particles,
                        opacity: Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : current.particles.opacity,
                      },
                    }))}
                  />
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs leading-5 text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Resumo atual</div>
                <div className="mt-2 font-mono text-[11px] text-slate-300">
                  hero: [{activeScenarioConfig.heroBasePosition.map((value) => value.toFixed(2)).join(', ')}]<br />
                  enemy: [{activeScenarioConfig.enemyBasePosition.map((value) => value.toFixed(2)).join(', ')}]<br />
                  scenario position: [{activeScenarioConfig.scenarioTransform.position.map((value) => value.toFixed(2)).join(', ')}]<br />
                  scenario rotation: [{activeScenarioConfig.scenarioTransform.rotation.map((value) => value.toFixed(2)).join(', ')}] / scale {activeScenarioConfig.scenarioTransform.scale.toFixed(3)}<br />
                  portal global: pos [{menuPortalTransform.position.map((value) => value.toFixed(2)).join(', ')}], rot [{menuPortalTransform.rotation.map((value) => value.toFixed(2)).join(', ')}], scale {menuPortalTransform.scale.toFixed(4)}<br />
                  objetos extras: {activeScenarioConfig.sceneObjects.length}<br />
                  slots selecao: {activeScenarioConfig.heroSelectionSlots?.length ?? 0}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <button
                  onClick={handleResetScenarioConfig}
                  className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
                >
                  Resetar
                </button>
                <button
                  onClick={() => { void handleCopyScenarioJson(); }}
                  className="rounded-xl border border-cyan-400/30 bg-cyan-500/12 px-3 py-3 text-xs font-black uppercase tracking-[0.16em] text-cyan-100 transition-colors hover:bg-cyan-500/18"
                >
                  {scenarioExportStatus === 'copied' ? 'JSON copiado' : 'Copiar JSON'}
                </button>
                <button
                  onClick={handleDownloadScenarioJson}
                  className="rounded-xl border border-emerald-400/30 bg-emerald-500/12 px-3 py-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-100 transition-colors hover:bg-emerald-500/18"
                >
                  {scenarioExportStatus === 'downloaded' ? 'Baixado' : 'Baixar JSON'}
                </button>
              </div>
              {scenarioExportStatus === 'error' ? (
                <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  Nao foi possivel exportar o JSON. Tente novamente.
                </div>
              ) : null}
            </div>
          </section>
        )}

        {tab === 'sprite-lab' && (
          <SpriteAnimationLab />
        )}

        {tab === 'item-lab' && selectedItem && (
          <section className="mt-6 grid gap-6 2xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5 sm:p-6">
              <h2 className="font-gamer text-2xl font-black text-white">Inspecao de Itens</h2>
              <p className="mt-2 text-sm text-slate-400">Escolha o tipo e o item para abrir o preview 3D isolado.</p>

              <div className="mt-6 space-y-4">
                <SelectField
                  label="Filtro"
                  value={itemTypeFilter}
                  onChange={(value) => {
                    const nextFilter = value as typeof itemTypeFilter;
                    setItemTypeFilter(nextFilter);
                    const nextItems = ALL_ITEMS.filter((item) => nextFilter === 'all' ? true : item.type === nextFilter);
                    if (nextItems[0]) {
                      setSelectedItemId(nextItems[0].id);
                    }
                  }}
                  options={[
                    { value: 'all', label: 'Todos' },
                    { value: 'weapon', label: 'Armas' },
                    { value: 'armor', label: 'Armaduras' },
                    { value: 'helmet', label: 'Capacetes' },
                    { value: 'legs', label: 'Pernas' },
                    { value: 'shield', label: 'Escudos' },
                    { value: 'potion', label: 'Pocoes' },
                    { value: 'material', label: 'Materiais' },
                  ]}
                />
                <SelectField
                  label="Item"
                  value={selectedItem.id}
                  onChange={setSelectedItemId}
                  options={itemOptions.map((item) => ({ value: item.id, label: item.name }))}
                />
              </div>

              <div className={`mt-6 rounded-2xl border p-4 ${rarityTone[selectedItem.rarity]}`}>
                <div className="text-[10px] font-black uppercase tracking-[0.24em]">{selectedItem.rarity}</div>
                <div className="mt-2 text-xl font-black text-white">{selectedItem.name}</div>
                <div className="mt-1 text-sm text-slate-300">{selectedItem.description}</div>
                <div className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-400">{selectedItem.type} • id {selectedItem.id}</div>
              </div>
            </div>

            <div className="game-surface order-first rounded-[1.75rem] border border-slate-700 p-4 sm:p-5 2xl:order-none">
              <div className="h-[360px] sm:h-[420px] lg:h-[520px] min-[1600px]:h-[620px] rounded-[1.5rem] border border-slate-800 bg-slate-950/60 overflow-hidden">
                <ItemPreviewThree item={selectedItem} />
              </div>
            </div>
          </section>
        )}

        {tab === 'monster-lab' && selectedMonsterEntry && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">monstro: {selectedMonsterEntry.label}</span>
                <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-indigo-100">acao: {monsterAnimationAction}</span>
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">grupo: {selectedMonsterEntry.family}</span>
              </div>
              <div className="h-[360px] sm:h-[420px] lg:h-[520px] min-[1600px]:h-[620px] rounded-[1.5rem] border border-slate-800 bg-slate-950/60">
                <DeveloperMonsterScene
                  enemyName={selectedMonsterEntry.enemy.name}
                  enemyAssets={selectedMonsterEntry.enemy.assets}
                  enemyColor={selectedMonsterEntry.enemy.color}
                  enemyScale={selectedMonsterEntry.enemy.scale}
                  enemyAttackStyle={selectedMonsterEntry.enemy.attackStyle}
                  animationAction={monsterAnimationAction}
                  isHit={monsterHit}
                />
              </div>
            </div>

            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5 sm:p-6 xl:sticky xl:top-6">
              <h2 className="font-gamer text-2xl font-black text-white">Teste de Monstro</h2>
              <p className="mt-2 text-sm text-slate-400">Escolha o modelo 3D do monstro e visualize como ele se comporta com as animações padrão de combate.</p>

              <div className="mt-6 space-y-4">
                <SelectField
                  label="Monstro"
                  value={selectedMonsterId}
                  onChange={setSelectedMonsterId}
                  options={monsterCatalog.map((entry) => ({ value: entry.id, label: entry.label }))}
                />
                <SelectField
                  label="Acao"
                  value={monsterAnimationAction}
                  onChange={(value) => setMonsterAnimationAction(value as PlayerAnimationAction)}
                  options={animationActions.map((action) => ({ value: action, label: action }))}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Dados do monstro</div>
                <div className="mt-3 text-lg font-black text-white">{selectedMonsterEntry.enemy.name}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{selectedMonsterEntry.enemy.type} • escala {selectedMonsterEntry.enemy.scale ?? 1}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">
                  estilo de ataque: {selectedMonsterEntry.enemy.attackStyle ?? 'armed'}
                </div>
              </div>

              <button
                onClick={() => {
                  setMonsterHit(true);
                  window.setTimeout(() => setMonsterHit(false), 220);
                }}
                className="mt-6 w-full rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-rose-100 transition-colors hover:bg-rose-500/18"
              >
                Disparar hit flash
              </button>
            </div>
          </section>
        )}

        {tab === 'gltf-monster-viewer' && selectedGltfMonster && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
            {/* 3D viewport */}
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">categoria: {gltfMonsterCategory}</span>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">monstro: {selectedGltfMonster.label}</span>
                <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-indigo-100">herói: {classId}</span>
                {(gltfMonsterSelectedAction || gltfMonsterAvailableAnimations.length > 0) && (
                  <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">
                    {gltfMonsterSelectedAction && gltfCurrentClipName
                      ? `${gltfMonsterSelectedAction} → ${gltfCurrentClipName}`
                      : (gltfMonsterAvailableAnimations[gltfMonsterAnimationIndex] ?? '—')}
                  </span>
                )}
                <span className="rounded-full border border-slate-600 bg-slate-800/60 px-3 py-1 text-slate-300">{gltfCategoryList.length} na categoria</span>
              </div>
              <div className="h-[400px] sm:h-[480px] lg:h-[580px] min-[1600px]:h-[680px] rounded-[1.5rem] border border-slate-800 bg-slate-950/60">
                <DeveloperGltfMonsterScene
                  key={selectedGltfMonster.id}
                  modelUrl={selectedGltfMonster.url}
                  animationIndex={gltfMonsterAnimationIndex}
                  clipName={gltfCurrentClipName ?? undefined}
                  heroClassId={classId}
                  onAnimationsLoaded={setGltfMonsterAvailableAnimations}
                />
              </div>
            </div>

            {/* Controls sidebar */}
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5 sm:p-6 xl:sticky xl:top-6 space-y-5">
              <div>
                <h2 className="font-gamer text-2xl font-black text-white">Novos Monstros GLTF</h2>
                <p className="mt-2 text-sm text-slate-400">Monstro e herói lado a lado para comparar tamanho. Selecione categoria, monstro, animação e classe do herói.</p>
              </div>

              {/* Category buttons */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 mb-2">Categoria</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['Big', 'Blob', 'Flying'] as GltfMonsterCategory[]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setGltfMonsterCategory(cat)}
                      className={`rounded-xl border px-3 py-2.5 text-xs font-black uppercase tracking-[0.16em] transition-colors ${gltfMonsterCategory === cat ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                    >
                      {cat}
                      <span className="ml-1.5 text-[10px] font-normal opacity-60">({GLTF_MONSTER_CATALOG[cat].length})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Monster selector */}
              <SelectField
                label="Monstro"
                value={String(gltfMonsterIndex)}
                onChange={(v) => setGltfMonsterIndex(Number(v))}
                options={gltfCategoryList.map((entry, idx) => ({ value: String(idx), label: entry.label }))}
              />

              {/* Hero class selector — reuses classId state already in scope */}
              <SelectField
                label="Classe do Herói (referência de tamanho)"
                value={classId}
                onChange={(v) => setClassId(v as PlayerClassId)}
                options={PLAYER_CLASSES.map((pc) => ({ value: pc.id, label: pc.name }))}
              />

              {/* Animation selector — action-based when mapping defined, raw clips as fallback */}
              {Object.keys(gltfCurrentAnimMap).length > 0 ? (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 mb-2">
                    Ação → Clipe GLTF
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.entries(gltfCurrentAnimMap) as [PlayerAnimationAction, string][]).map(([action, clip]) => (
                      <button
                        key={action}
                        onClick={() => setGltfMonsterSelectedAction(action)}
                        className={`flex flex-col rounded-xl border px-2.5 py-2 text-left transition-colors ${gltfMonsterSelectedAction === action ? 'border-cyan-400/40 bg-cyan-500/15' : 'border-slate-700 bg-slate-950/70 hover:border-slate-500'}`}
                      >
                        <span className={`text-[10px] font-black uppercase tracking-[0.14em] ${gltfMonsterSelectedAction === action ? 'text-cyan-100' : 'text-slate-300'}`}>
                          {GLTF_ACTION_LABELS[action] ?? action}
                        </span>
                        <span className="mt-0.5 text-[9px] font-normal text-slate-500">{clip}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : gltfMonsterAvailableAnimations.length > 0 ? (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 mb-2">
                    Clipes ({gltfMonsterAvailableAnimations.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {gltfMonsterAvailableAnimations.map((name, idx) => (
                      <button
                        key={name}
                        onClick={() => { setGltfMonsterAnimationIndex(idx); setGltfMonsterSelectedAction(null); }}
                        className={`rounded-lg border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] transition-colors ${gltfMonsterAnimationIndex === idx && !gltfMonsterSelectedAction ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-500">
                  Carregando animações…
                </div>
              )}

              {/* Texture atlas preview */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 mb-2">Textura Atlas</div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                  <img
                    src={ATLAS_MONSTERS_TEXTURE_URL}
                    alt="Atlas Monsters"
                    className="w-full object-contain"
                    style={{ imageRendering: 'pixelated', maxHeight: 180 }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Resumo</div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  {(['Big', 'Blob', 'Flying'] as GltfMonsterCategory[]).map((cat) => (
                    <div key={cat} className="rounded-xl border border-slate-800 bg-slate-900/70 p-2">
                      <div className="text-[9px] uppercase tracking-widest text-slate-500">{cat}</div>
                      <div className="mt-1 text-xl font-black text-emerald-200">{GLTF_MONSTER_CATALOG[cat].length}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-center text-2xl font-black text-white">
                  {GLTF_MONSTER_TOTAL} <span className="text-sm font-normal text-slate-400">total</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── Biped Character Viewer ────────────────────────────────────────── */}
        {tab === 'biped-character-viewer' && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
            {/* 3D viewport */}
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-indigo-100">
                  {selectedBipedCharacter.label}
                </span>
                {bipedClipName && (
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">
                    {bipedClipName}
                  </span>
                )}
                <span className="rounded-full border border-slate-600 bg-slate-800/60 px-3 py-1 text-slate-300">
                  {bipedAvailableAnimations.length} clips
                </span>
              </div>
              <div className="h-[400px] sm:h-[480px] lg:h-[580px] min-[1600px]:h-[680px] rounded-[1.5rem] border border-slate-800 bg-slate-950/60">
                <DeveloperBipedCharacterScene
                  key={selectedBipedCharacter.id}
                  characterUrl={selectedBipedCharacter.characterUrl}
                  animationUrl={BIPED_ANIMATION_URL}
                  clipName={bipedClipName}
                  onAnimationsLoaded={(names) => {
                    setBipedAvailableAnimations(names);
                    setBipedClipName(names[0]);
                  }}
                />
              </div>
            </div>

            {/* Controls sidebar */}
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5 sm:p-6 xl:sticky xl:top-6 space-y-5">
              <div>
                <h2 className="font-gamer text-2xl font-black text-white">Personagens GLB</h2>
                <p className="mt-2 text-sm text-slate-400">Modelos biped Meshy AI com malha e animações em arquivos GLB separados. Teste retargeting cruzado de animações entre personagens.</p>
              </div>

              {/* Character selector */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 mb-2">Personagem</div>
                <div className="grid grid-cols-2 gap-2">
                  {BIPED_CHARACTER_CATALOG.map((char, idx) => (
                    <button
                      key={char.id}
                      onClick={() => {
                        setBipedCharacterIndex(idx);
                        setBipedClipName(undefined);
                        setBipedAvailableAnimations([]);
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-xs font-black uppercase tracking-[0.14em] transition-colors ${bipedCharacterIndex === idx ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-100' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                    >
                      {char.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clip list */}
              {bipedAvailableAnimations.length > 0 && (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 mb-2">
                    Clips ({bipedAvailableAnimations.length})
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                    {bipedAvailableAnimations.map((clip) => (
                      <button
                        key={clip}
                        onClick={() => setBipedClipName(clip)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-[11px] font-semibold transition-colors ${bipedClipName === clip ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100' : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                      >
                        {clip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Model info */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Arquivos GLB</div>
                <div className="mt-3 space-y-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Malha</div>
                    <div className="mt-0.5 truncate text-[11px] text-indigo-200">{selectedBipedCharacter.label}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Animações (compartilhado)</div>
                    <div className="mt-0.5 truncate text-[11px] text-indigo-200">Meshy_AI_Animacoes.glb</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

