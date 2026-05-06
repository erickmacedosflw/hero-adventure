/**
 * Bestiário dos Monstros GLTF — Lendas do Abismo
 *
 * Estes monstros substituem o sistema de classes por ELEMENTOS naturais:
 * agua | terra | fogo | vento | sombrio
 *
 * São intencionalmente mais fracos que os inimigos esqueléticos existentes
 * (que serão usados como chefes de fase). Servem como encontros de campo.
 *
 * Categorias de rig:
 *  - Big    → animações: Idle, Punch, Duck, HitReact, Jump_Idle, Yes, No, Wave, Death…
 *  - Flying → animações: Flying_Idle, Headbutt, Fast_Flying, HitReact, No, Yes, Death…
 */

import { GltfMonsterTemplate, GltfMonsterBodyType, MonsterElementType, PlayerAnimationAction } from '../../types';

// ── Helpers de URL ──────────────────────────────────────────────────────────
const bigUrl  = (file: string) =>
  new URL(`../assets/Characters/Monsters/Monsters/Big/${file}`,    import.meta.url).href;
const flyUrl  = (file: string) =>
  new URL(`../assets/Characters/Monsters/Monsters/Flying/${file}`, import.meta.url).href;

/** Maps PlayerAnimationAction → actual GLTF clip name per body type.
 *  Exported so the battle scene can look up the clip at render time. */
export type GltfAnimationMap = Partial<Record<PlayerAnimationAction, string>>;

export const GLTF_BODY_ANIMATION_MAP: Record<GltfMonsterBodyType, GltfAnimationMap> = {
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

// ── Bestiário ───────────────────────────────────────────────────────────────
export const GLTF_MONSTER_BESTIARY: GltfMonsterTemplate[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // ÁGUA  — criativas de lagos, mares e gelo; altos em velocidade e magia
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'mst_big_fish',
    name: 'Peixe-Abismo',
    lore: 'Peixe predatório das profundezas que salta para atacar presas em terra.',
    element: 'agua', bodyType: 'Big', gltfFile: 'Fish.gltf',
    baseStats: { hp: 42, maxHp: 42, mp: 0,  maxMp: 0,  atk: 5, def: 2, speed: 5, luck: 2, magic: 2 },
    xpReward: 18, goldReward: 8, color: '#38bdf8', scale: 0.9, attackStyle: 'unarmed',
    rareDrops: [{ itemId: 'mat_slime', chance: 0.20 }],
  },
  {
    id: 'mst_big_frog',
    name: 'Sapo-Fel',
    lore: 'Anfíbio das pântanos malditas cuja pele secreta veneno paralisante.',
    element: 'agua', bodyType: 'Big', gltfFile: 'Frog.gltf',
    baseStats: { hp: 50, maxHp: 50, mp: 12, maxMp: 12, atk: 4, def: 3, speed: 3, luck: 2, magic: 5 },
    xpReward: 22, goldReward: 10, color: '#4ade80', scale: 1.0, attackStyle: 'unarmed',
    rareDrops: [{ itemId: 'mat_slime', chance: 0.25 }, { itemId: 'pot_1', chance: 0.06 }],
  },
  {
    id: 'mst_big_yeti',
    name: 'Yeti das Neves',
    lore: 'Colossus branco das montanhas geladas; seus punhos congelam o que tocam.',
    element: 'agua', bodyType: 'Big', gltfFile: 'Yeti.gltf',
    baseStats: { hp: 65, maxHp: 65, mp: 0,  maxMp: 0,  atk: 7, def: 4, speed: 2, luck: 1, magic: 3 },
    xpReward: 30, goldReward: 15, color: '#bae6fd', scale: 1.1, attackStyle: 'unarmed',
    archetipo: 'barbaro',
    rareDrops: [{ itemId: 'mat_cloth', chance: 0.15 }],
  },
  {
    id: 'mst_fly_glub',
    name: 'Glubin',
    lore: 'Pequeno espírito aquático que flutua emitindo borbulhas encantadas.',
    element: 'agua', bodyType: 'Flying', gltfFile: 'Glub.gltf',
    baseStats: { hp: 35, maxHp: 35, mp: 15, maxMp: 15, atk: 3, def: 2, speed: 4, luck: 3, magic: 6 },
    xpReward: 16, goldReward: 7, color: '#7dd3fc', scale: 0.85, attackStyle: 'unarmed',
    rareDrops: [{ itemId: 'mat_slime', chance: 0.22 }],
  },
  {
    id: 'mst_fly_glub_evolved',
    name: 'Glubin das Profundezas',
    lore: 'Forma evoluída do Glubin; absorveu energia de antigas ruínas submarinas.',
    element: 'agua', bodyType: 'Flying', gltfFile: 'Glub_Evolved.gltf',
    baseStats: { hp: 55, maxHp: 55, mp: 20, maxMp: 20, atk: 5, def: 3, speed: 4, luck: 3, magic: 8 },
    xpReward: 28, goldReward: 14, color: '#0ea5e9', scale: 0.95, attackStyle: 'unarmed',
    rareDrops: [{ itemId: 'mat_slime', chance: 0.18 }, { itemId: 'pot_2', chance: 0.08 }],
  },
  {
    id: 'mst_fly_squidle',
    name: 'Tentacula',
    lore: 'Lula dimensional que navega entre planos usando tentáculos de energia.',
    element: 'agua', bodyType: 'Flying', gltfFile: 'Squidle.gltf',
    baseStats: { hp: 45, maxHp: 45, mp: 10, maxMp: 10, atk: 6, def: 2, speed: 3, luck: 2, magic: 5 },
    xpReward: 20, goldReward: 9, color: '#38bdf8', scale: 0.9, attackStyle: 'unarmed',
    rareDrops: [{ itemId: 'mat_slime', chance: 0.20 }],
  },
  {
    id: 'mst_fly_pigeon',
    name: 'Pombo Cristalino',
    lore: 'Ave mensageira das tempestades; suas asas produzem chuva ao bater.',
    element: 'agua', bodyType: 'Flying', gltfFile: 'Pigeon.gltf',
    baseStats: { hp: 32, maxHp: 32, mp: 8,  maxMp: 8,  atk: 3, def: 2, speed: 5, luck: 3, magic: 3 },
    xpReward: 14, goldReward: 6, color: '#e0f2fe', scale: 0.8, attackStyle: 'unarmed',
    rareDrops: [{ itemId: 'mat_cloth', chance: 0.12 }],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TERRA — robustos com alta defesa e HP, lentos
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'mst_big_bunny',
    name: 'Coelho Pedregoso',
    lore: 'Roedor blindado das cavernas; sua carapaça rochosa embota qualquer lâmina.',
    element: 'terra', bodyType: 'Big', gltfFile: 'Bunny.gltf',
    baseStats: { hp: 48, maxHp: 48, mp: 0,  maxMp: 0,  atk: 5, def: 3, speed: 4, luck: 2, magic: 1 },
    xpReward: 20, goldReward: 9, color: '#a16207', scale: 0.95, attackStyle: 'unarmed',
    archetipo: 'guerreiro',
    rareDrops: [{ itemId: 'mat_bone', chance: 0.15 }],
  },
  {
    id: 'mst_big_mushroomking',
    name: 'Rei-Cogumelo',
    lore: 'Monarca fúngico das florestas encantadas; libera esporos que curam aliados.',
    element: 'terra', bodyType: 'Big', gltfFile: 'MushroomKing.gltf',
    baseStats: { hp: 60, maxHp: 60, mp: 18, maxMp: 18, atk: 4, def: 4, speed: 2, luck: 2, magic: 6 },
    xpReward: 28, goldReward: 13, color: '#65a30d', scale: 1.05, attackStyle: 'unarmed',
    archetipo: 'mago',
    rareDrops: [{ itemId: 'mat_wood', chance: 0.20 }, { itemId: 'pot_1', chance: 0.08 }],
  },
  {
    id: 'mst_big_monkroose',
    name: 'Mangoste',
    lore: 'Mamífero territorial e ágil das planícies áridas; ataca em golpes rápidos.',
    element: 'terra', bodyType: 'Big', gltfFile: 'Monkroose.gltf',
    baseStats: { hp: 52, maxHp: 52, mp: 6,  maxMp: 6,  atk: 6, def: 3, speed: 4, luck: 3, magic: 2 },
    xpReward: 24, goldReward: 11, color: '#78716c', scale: 1.0, attackStyle: 'unarmed',
    archetipo: 'guerreiro',
    rareDrops: [{ itemId: 'mat_bone', chance: 0.12 }],
  },
  {
    id: 'mst_big_dino',
    name: 'Dino Ancestral',
    lore: 'Lagarto colossal das ruínas antigas; sobreviveu eras consumindo energia elemental.',
    element: 'terra', bodyType: 'Big', gltfFile: 'Dino.gltf',
    baseStats: { hp: 62, maxHp: 62, mp: 0,  maxMp: 0,  atk: 7, def: 3, speed: 3, luck: 1, magic: 2 },
    xpReward: 27, goldReward: 13, color: '#84cc16', scale: 1.1, attackStyle: 'unarmed',
    archetipo: 'barbaro',
    rareDrops: [{ itemId: 'mat_bone', chance: 0.18 }],
  },
  {
    id: 'mst_big_orc',
    name: 'Orc Bruto',
    lore: 'Guerreiro primitivo das terras áridas; sua força bruta compensa a falta de agilidade.',
    element: 'terra', bodyType: 'Big', gltfFile: 'Orc.gltf',
    baseStats: { hp: 58, maxHp: 58, mp: 4,  maxMp: 4,  atk: 7, def: 4, speed: 2, luck: 1, magic: 2 },
    xpReward: 25, goldReward: 12, color: '#78716c', scale: 1.05, attackStyle: 'unarmed',
    archetipo: 'orc',
    rareDrops: [{ itemId: 'mat_iron', chance: 0.10 }],
  },
  {
    id: 'mst_fly_goleling',
    name: 'Goleling',
    lore: 'Pequeno golem de pedra que ganhou vida e voa usando chamas internas.',
    element: 'terra', bodyType: 'Flying', gltfFile: 'Goleling.gltf',
    baseStats: { hp: 45, maxHp: 45, mp: 8,  maxMp: 8,  atk: 5, def: 5, speed: 2, luck: 1, magic: 3 },
    xpReward: 22, goldReward: 11, color: '#a16207', scale: 0.85, attackStyle: 'unarmed',
    archetipo: 'guerreiro',
    rareDrops: [{ itemId: 'mat_iron', chance: 0.12 }],
  },
  {
    id: 'mst_fly_goleling_evolved',
    name: 'Goleling Ancião',
    lore: 'Golem de pedra ancestral imbuído de memórias de batalhas milenares.',
    element: 'terra', bodyType: 'Flying', gltfFile: 'Goleling_Evolved.gltf',
    baseStats: { hp: 62, maxHp: 62, mp: 12, maxMp: 12, atk: 6, def: 6, speed: 2, luck: 1, magic: 4 },
    xpReward: 30, goldReward: 15, color: '#78716c', scale: 0.95, attackStyle: 'unarmed',
    archetipo: 'guerreiro',
    rareDrops: [{ itemId: 'mat_iron', chance: 0.15 }, { itemId: 'mat_dg_dark_clay', chance: 0.18 }],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FOGO — alto ATK e magia; baixo HP e defesa
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'mst_big_demon',
    name: 'Demônio Ígneo',
    lore: 'Entidade infernal forjada nas brasas eternas do abismo mais profundo.',
    element: 'fogo', bodyType: 'Big', gltfFile: 'Demon.gltf',
    baseStats: { hp: 55, maxHp: 55, mp: 16, maxMp: 16, atk: 8, def: 3, speed: 3, luck: 2, magic: 7 },
    xpReward: 28, goldReward: 14, color: '#ef4444', scale: 1.05, attackStyle: 'unarmed',
    archetipo: 'demonio',
    rareDrops: [{ itemId: 'mat_dg_sulfur_powder', chance: 0.20 }],
  },
  {
    id: 'mst_big_bluedemon',
    name: 'Demônio Azulino',
    lore: 'Variante arcana do Demônio Ígneo; substitui chamas por raios mágicos gelados.',
    element: 'fogo', bodyType: 'Big', gltfFile: 'BlueDemon.gltf',
    baseStats: { hp: 48, maxHp: 48, mp: 22, maxMp: 22, atk: 6, def: 2, speed: 3, luck: 3, magic: 9 },
    xpReward: 26, goldReward: 13, color: '#a855f7', scale: 1.0, attackStyle: 'unarmed',
    archetipo: 'demonio',
    rareDrops: [{ itemId: 'pot_2', chance: 0.10 }, { itemId: 'mat_dg_sulfur_powder', chance: 0.15 }],
  },
  {
    id: 'mst_big_cactoro',
    name: 'Cactoro Ardente',
    lore: 'Cacto sensitivo das terras vulcânicas; seus espinhos lançam chamas ao girar.',
    element: 'fogo', bodyType: 'Big', gltfFile: 'Cactoro.gltf',
    baseStats: { hp: 44, maxHp: 44, mp: 0,  maxMp: 0,  atk: 6, def: 4, speed: 2, luck: 2, magic: 4 },
    xpReward: 20, goldReward: 10, color: '#f97316', scale: 0.95, attackStyle: 'unarmed',
    rareDrops: [{ itemId: 'mat_wood', chance: 0.15 }],
  },
  {
    id: 'mst_fly_demon',
    name: 'Demônio Etéreo',
    lore: 'Demônio das chamas que transcendeu o corpo físico e voa em forma de brasa.',
    element: 'fogo', bodyType: 'Flying', gltfFile: 'Demon.gltf',
    baseStats: { hp: 52, maxHp: 52, mp: 20, maxMp: 20, atk: 7, def: 2, speed: 4, luck: 2, magic: 8 },
    xpReward: 27, goldReward: 14, color: '#dc2626', scale: 0.95, attackStyle: 'unarmed',
    archetipo: 'demonio',
    rareDrops: [{ itemId: 'mat_dg_sulfur_powder', chance: 0.18 }],
  },
  {
    id: 'mst_fly_dragon',
    name: 'Dragão das Chamas',
    lore: 'Dragão de fogo que guarda territórios ancestrais; seu sopro calcina armaduras.',
    element: 'fogo', bodyType: 'Flying', gltfFile: 'Dragon.gltf',
    baseStats: { hp: 70, maxHp: 70, mp: 18, maxMp: 18, atk: 8, def: 4, speed: 3, luck: 2, magic: 8 },
    xpReward: 35, goldReward: 18, color: '#f97316', scale: 1.0, attackStyle: 'unarmed',
    archetipo: 'dragao',
    rareDrops: [{ itemId: 'mat_iron', chance: 0.15 }, { itemId: 'mat_dg_sulfur_powder', chance: 0.22 }],
  },
  {
    id: 'mst_fly_dragon_evolved',
    name: 'Dragão Evoluído',
    lore: 'Dragão ancião corrompido pelo fogo eterno; seus olhos brilham como estrelas cadentes.',
    element: 'fogo', bodyType: 'Flying', gltfFile: 'Dragon_Evolved.gltf',
    baseStats: { hp: 80, maxHp: 80, mp: 24, maxMp: 24, atk: 10, def: 5, speed: 3, luck: 2, magic: 10 },
    xpReward: 42, goldReward: 22, color: '#dc2626', scale: 1.05, attackStyle: 'unarmed',
    archetipo: 'dragao',
    rareDrops: [{ itemId: 'mat_dg_amber_resin', chance: 0.16 }, { itemId: 'mat_gold', chance: 0.06 }],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VENTO — alta velocidade e sorte; defesa baixa
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'mst_big_birb',
    name: 'Birbão',
    lore: 'Ave gigante dos ventos que usa turbilhões de penas para desorientar inimigos.',
    element: 'vento', bodyType: 'Big', gltfFile: 'Birb.gltf',
    baseStats: { hp: 40, maxHp: 40, mp: 6,  maxMp: 6,  atk: 5, def: 2, speed: 6, luck: 4, magic: 3 },
    xpReward: 18, goldReward: 8, color: '#a3e635', scale: 0.95, attackStyle: 'unarmed',
    archetipo: 'atirador',
    rareDrops: [{ itemId: 'mat_cloth', chance: 0.18 }],
  },
  {
    id: 'mst_fly_alpaking',
    name: 'Alpaking',
    lore: 'Lhama voadora lider do bando; controla correntes de ar com seu canto agudo.',
    element: 'vento', bodyType: 'Flying', gltfFile: 'Alpaking.gltf',
    baseStats: { hp: 45, maxHp: 45, mp: 8,  maxMp: 8,  atk: 5, def: 3, speed: 5, luck: 3, magic: 3 },
    xpReward: 22, goldReward: 10, color: '#e2e8f0', scale: 0.9, attackStyle: 'unarmed',
    rareDrops: [{ itemId: 'mat_cloth', chance: 0.15 }],
  },
  {
    id: 'mst_fly_alpaking_evolved',
    name: 'Alpaking Ancestral',
    lore: 'Lhama ancestral mestre dos ventos; dizem que seu sopro pode mover montanhas.',
    element: 'vento', bodyType: 'Flying', gltfFile: 'Alpaking_Evolved.gltf',
    baseStats: { hp: 60, maxHp: 60, mp: 14, maxMp: 14, atk: 6, def: 4, speed: 5, luck: 3, magic: 5 },
    xpReward: 30, goldReward: 15, color: '#cbd5e1', scale: 1.0, attackStyle: 'unarmed',
    rareDrops: [{ itemId: 'mat_cloth', chance: 0.18 }, { itemId: 'pot_1', chance: 0.08 }],
  },
  {
    id: 'mst_fly_armabee',
    name: 'Abelha Blindada',
    lore: 'Abelha guerreira das nuvens; sua armadura natural resiste a flechas e lâminas.',
    element: 'vento', bodyType: 'Flying', gltfFile: 'Armabee.gltf',
    baseStats: { hp: 38, maxHp: 38, mp: 0,  maxMp: 0,  atk: 6, def: 3, speed: 6, luck: 3, magic: 2 },
    xpReward: 18, goldReward: 8, color: '#fcd34d', scale: 0.85, attackStyle: 'unarmed',
    archetipo: 'atirador',
    rareDrops: [{ itemId: 'mat_dg_cracked_shell', chance: 0.20 }],
  },
  {
    id: 'mst_fly_armabee_evolved',
    name: 'Abelha Rainha',
    lore: 'Rainha das abelhas blindadas; seu ferrão libera veneno de vento cortante.',
    element: 'vento', bodyType: 'Flying', gltfFile: 'Armabee_Evolved.gltf',
    baseStats: { hp: 55, maxHp: 55, mp: 10, maxMp: 10, atk: 7, def: 4, speed: 5, luck: 3, magic: 4 },
    xpReward: 27, goldReward: 14, color: '#fbbf24', scale: 0.95, attackStyle: 'unarmed',
    archetipo: 'atirador',
    rareDrops: [{ itemId: 'mat_dg_cracked_shell', chance: 0.22 }, { itemId: 'mat_iron', chance: 0.08 }],
  },
  {
    id: 'mst_fly_hywirl',
    name: 'Hywirl',
    lore: 'Espiral de vento que ganhou consciência; invisível até o momento do impacto.',
    element: 'vento', bodyType: 'Flying', gltfFile: 'Hywirl.gltf',
    baseStats: { hp: 35, maxHp: 35, mp: 12, maxMp: 12, atk: 4, def: 1, speed: 7, luck: 5, magic: 5 },
    xpReward: 16, goldReward: 7, color: '#93c5fd', scale: 0.85, attackStyle: 'unarmed',
    archetipo: 'atirador',
    rareDrops: [{ itemId: 'mat_cloth', chance: 0.14 }],
  },
  {
    id: 'mst_fly_tribal_flying',
    name: 'Tribal Aéreo',
    lore: 'Xamã tribal das correntes de ar; invoca tempestades rituais para proteger o bando.',
    element: 'vento', bodyType: 'Flying', gltfFile: 'Tribal.gltf',
    baseStats: { hp: 44, maxHp: 44, mp: 20, maxMp: 20, atk: 4, def: 2, speed: 5, luck: 4, magic: 7 },
    xpReward: 22, goldReward: 11, color: '#a3e635', scale: 0.9, attackStyle: 'unarmed',
    rareDrops: [{ itemId: 'mat_cloth', chance: 0.15 }, { itemId: 'pot_2', chance: 0.07 }],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOMBRIO — alta magia e sorte; físicamente frágeis
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'mst_big_alien',
    name: 'Entidade Alienígena',
    lore: 'Ser das dimensões proibidas; sua mera presença distorce a realidade ao redor.',
    element: 'sombrio', bodyType: 'Big', gltfFile: 'Alien.gltf',
    baseStats: { hp: 50, maxHp: 50, mp: 18, maxMp: 18, atk: 6, def: 3, speed: 4, luck: 2, magic: 8 },
    xpReward: 26, goldReward: 13, color: '#7c3aed', scale: 1.0, attackStyle: 'unarmed',
    archetipo: 'mago',
    rareDrops: [{ itemId: 'mat_dg_salt_crystal', chance: 0.18 }],
  },
  {
    id: 'mst_big_ninja',
    name: 'Ninja das Sombras',
    lore: 'Assassino das trevas treinado em artes proibidas; golpeia e some antes de ser visto.',
    element: 'sombrio', bodyType: 'Big', gltfFile: 'Ninja.gltf',
    baseStats: { hp: 44, maxHp: 44, mp: 12, maxMp: 12, atk: 7, def: 2, speed: 6, luck: 5, magic: 4 },
    xpReward: 24, goldReward: 12, color: '#1e293b', scale: 0.95, attackStyle: 'unarmed',
    archetipo: 'ladino',
    rareDrops: [{ itemId: 'mat_dg_rusty_chain', chance: 0.15 }],
  },
  {
    id: 'mst_big_orc_skull',
    name: 'Orc Amaldiçoado',
    lore: 'Orc corrompido pela sombra ancestral; carrega o peso de mil maldições.',
    element: 'sombrio', bodyType: 'Big', gltfFile: 'Orc_Skull.gltf',
    baseStats: { hp: 55, maxHp: 55, mp: 8,  maxMp: 8,  atk: 7, def: 3, speed: 3, luck: 2, magic: 5 },
    xpReward: 24, goldReward: 12, color: '#581c87', scale: 1.0, attackStyle: 'unarmed',
    archetipo: 'orc',
    rareDrops: [{ itemId: 'mat_bone', chance: 0.18 }, { itemId: 'mat_dg_salt_crystal', chance: 0.12 }],
  },
  {
    id: 'mst_big_tribal',
    name: 'Xamã Sombrio',
    lore: 'Xamã das artes proibidas que alimenta seu poder com almas coletadas.',
    element: 'sombrio', bodyType: 'Big', gltfFile: 'Tribal.gltf',
    baseStats: { hp: 48, maxHp: 48, mp: 22, maxMp: 22, atk: 5, def: 2, speed: 3, luck: 3, magic: 8 },
    xpReward: 24, goldReward: 12, color: '#3b0764', scale: 0.95, attackStyle: 'unarmed',
    archetipo: 'mago',
    rareDrops: [{ itemId: 'mat_dg_salt_crystal', chance: 0.20 }, { itemId: 'pot_2', chance: 0.08 }],
  },
  {
    id: 'mst_fly_ghost',
    name: 'Espectro',
    lore: 'Fantasma errante de um guerreiro que recusou a morte; ataca com ira espectral.',
    element: 'sombrio', bodyType: 'Flying', gltfFile: 'Ghost.gltf',
    baseStats: { hp: 35, maxHp: 35, mp: 20, maxMp: 20, atk: 4, def: 1, speed: 5, luck: 4, magic: 8 },
    xpReward: 20, goldReward: 10, color: '#6d28d9', scale: 0.9, attackStyle: 'unarmed',
    archetipo: 'ladino',
    rareDrops: [{ itemId: 'mat_dg_fossil_bone', chance: 0.16 }],
  },
  {
    id: 'mst_fly_ghost_skull',
    name: 'Crânio Espectral',
    lore: 'Fantasma que perdeu todo o ser exceto o crânio; concentra a morte em magia pura.',
    element: 'sombrio', bodyType: 'Flying', gltfFile: 'Ghost_Skull.gltf',
    baseStats: { hp: 40, maxHp: 40, mp: 24, maxMp: 24, atk: 5, def: 1, speed: 4, luck: 3, magic: 9 },
    xpReward: 24, goldReward: 12, color: '#4c1d95', scale: 0.9, attackStyle: 'unarmed',
    archetipo: 'ladino',
    rareDrops: [{ itemId: 'mat_dg_fossil_bone', chance: 0.18 }, { itemId: 'mat_dg_salt_crystal', chance: 0.14 }],
  },
];

// ── Helpers de consulta ─────────────────────────────────────────────────────

export const getGltfMonsterById = (id: string) =>
  GLTF_MONSTER_BESTIARY.find((m) => m.id === id);

export const getGltfMonstersByElement = (element: MonsterElementType) =>
  GLTF_MONSTER_BESTIARY.filter((m) => m.element === element);

export const getGltfMonstersByBodyType = (bodyType: GltfMonsterBodyType) =>
  GLTF_MONSTER_BESTIARY.filter((m) => m.bodyType === bodyType);

/**
 * Returns the monster pool eligible for a given hunt stage.
 * Stages 1-4   → agua + terra (weaker, familiar monsters)
 * Stages 5-8   → fogo + vento (mid-tier)
 * Stages 9+    → sombrio + all (strongest, includes evolved variants)
 */
export const getGltfMonsterPoolForStage = (stage: number): GltfMonsterTemplate[] => {
  if (stage <= 4)  return GLTF_MONSTER_BESTIARY.filter((m) => m.element === 'agua' || m.element === 'terra');
  if (stage <= 8)  return GLTF_MONSTER_BESTIARY.filter((m) => m.element === 'fogo' || m.element === 'vento');
  return GLTF_MONSTER_BESTIARY; // all elements available at high stages
};

// Re-export type for convenience
export type { GltfMonsterTemplate };
