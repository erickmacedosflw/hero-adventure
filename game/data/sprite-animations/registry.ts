export interface SpriteAnimationRegistryEntry {
  id: string;
  nome: string;
  arquivo: string;
}

export const SPRITE_ANIMATION_IDS = {
  execAuraVida1: 'anim_exec_aura_vida_1',
  execAuraVida2: 'anim_exec_aura_vida_2',
  execAuraMana1: 'anim_exec_aura_mana_1',
  execAuraUp1: 'anim_exec_aura_up_1',
  execFlash: 'anim_exec_flash',
  execFire: 'anim_exec_fire',
  execMagic: 'anim_exec_magic',
  execAbsorb: 'anim_exec_absorb',
  execAbsorb2: 'anim_exec_absorb_2',
  execImpulse: 'anim_exec_impulse',
  execImpulsePulse: 'anim_exec_impulse_pulse',
  hitUnarmed: 'anim_hit_unarmed',
  hitBladeSlash: 'anim_hit_blade_slash',
  hitPesado: 'anim_hit_pesado',
  hitBlock: 'anim_hit_block',
} as const;

export const SPRITE_ANIMATION_REGISTRY: SpriteAnimationRegistryEntry[] = [
  {
    id: SPRITE_ANIMATION_IDS.execAuraVida1,
    nome: 'Execucao Aura Vida 1',
    arquivo: 'game/data/sprite-animations/generated/aura-vida-1.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.execAuraVida2,
    nome: 'Execucao Aura Vida 2',
    arquivo: 'game/data/sprite-animations/generated/aura-vida-2.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.execAuraMana1,
    nome: 'Execucao Aura Mana 1',
    arquivo: 'game/data/sprite-animations/generated/aura-mana-1.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.execAuraUp1,
    nome: 'Execucao Aura Up 1',
    arquivo: 'game/data/sprite-animations/generated/aura-up-1.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.execFlash,
    nome: 'Execucao Flash',
    arquivo: 'game/data/sprite-animations/generated/flash.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.execFire,
    nome: 'Execucao Fire',
    arquivo: 'game/data/sprite-animations/generated/fire.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.execMagic,
    nome: 'Execucao Magic',
    arquivo: 'game/data/sprite-animations/generated/magic.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.execAbsorb,
    nome: 'Execucao Absorb',
    arquivo: 'game/data/sprite-animations/generated/absorb.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.execAbsorb2,
    nome: 'Execucao Absorb 2',
    arquivo: 'game/data/sprite-animations/generated/absorb-2.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.execImpulse,
    nome: 'Execucao Impulse',
    arquivo: 'game/data/sprite-animations/generated/impulse.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.execImpulsePulse,
    nome: 'Execucao Impulse Pulse',
    arquivo: 'game/data/sprite-animations/generated/impulso-pulse.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.hitUnarmed,
    nome: 'Hit Desarmado',
    arquivo: 'game/data/sprite-animations/generated/hit.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.hitBladeSlash,
    nome: 'Hit Lamina Slash',
    arquivo: 'game/data/sprite-animations/generated/slash.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.hitPesado,
    nome: 'Hit Pesado',
    arquivo: 'game/data/sprite-animations/generated/hit-pesado.json',
  },
  {
    id: SPRITE_ANIMATION_IDS.hitBlock,
    nome: 'Hit Block',
    arquivo: 'game/data/sprite-animations/generated/hit-block.json',
  },
];

const REGISTRY_BY_ID = new Map(
  SPRITE_ANIMATION_REGISTRY.map((entry) => [entry.id, entry]),
);

export const getSpriteAnimationRegistryEntry = (animationId?: string | null) => (
  animationId ? REGISTRY_BY_ID.get(animationId) : undefined
);

export const getSpriteAnimationFileById = (animationId?: string | null) => (
  getSpriteAnimationRegistryEntry(animationId)?.arquivo
);

export const COMBAT_SPRITE_ANIMATION_DEFAULTS = {
  unarmedExecutionAnimationId: SPRITE_ANIMATION_IDS.execAuraVida1,
  unarmedImpactAnimationId: SPRITE_ANIMATION_IDS.hitUnarmed,
  armedImpactAnimationId: SPRITE_ANIMATION_IDS.hitBladeSlash,
} as const;
