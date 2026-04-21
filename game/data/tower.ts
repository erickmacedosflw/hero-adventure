import { RunCard, TowerEvent, TowerNodeType, TowerSanctuaryOption } from '../../types';

// ─── ENEMY POOLS ─────────────────────────────────────────────────────────────

/** Enemy template names per act (used by towerEngine to pick random enemies). */
export const TOWER_ENEMY_POOL_BY_ACT: Record<number, string[]> = {
  1: ['Goblin Scout', 'Forest Wolf', 'Bandit Thug', 'Skeleton Guard'],
  2: ['Orc Brute', 'Dark Knight', 'Shadow Archer', 'Venomous Spider'],
  3: ['Demon Soldier', 'Lich Acolyte', 'Blood Golem', 'Phantom Assassin'],
};

/** Boss names per act. */
export const TOWER_BOSS_POOL_BY_ACT: Record<number, string> = {
  1: 'Forest Warden',
  2: 'Obsidian Warlord',
  3: 'Abyssal Sovereign',
};

// ─── NODE TYPE WEIGHTS ────────────────────────────────────────────────────────

/**
 * Probability weights for random node type assignment per act.
 * Each entry is [nodeType, weight]. Weights are relative (not percentages).
 */
export const NODE_TYPE_WEIGHTS_BY_ACT: Record<number, [TowerNodeType, number][]> = {
  1: [
    [TowerNodeType.COMBAT,  40],
    [TowerNodeType.ELITE,    8],
    [TowerNodeType.EVENT,   16],
    [TowerNodeType.CHEST,   10],
    [TowerNodeType.UPGRADE, 10],
    [TowerNodeType.SHOP,    10],
    [TowerNodeType.HEAL,    16],
    [TowerNodeType.RANDOM,   5],
  ],
  2: [
    [TowerNodeType.COMBAT,  35],
    [TowerNodeType.ELITE,   14],
    [TowerNodeType.EVENT,   14],
    [TowerNodeType.CHEST,   10],
    [TowerNodeType.UPGRADE, 12],
    [TowerNodeType.SHOP,     8],
    [TowerNodeType.HEAL,    12],
    [TowerNodeType.RANDOM,   5],
  ],
  3: [
    [TowerNodeType.COMBAT,  30],
    [TowerNodeType.ELITE,   20],
    [TowerNodeType.EVENT,   12],
    [TowerNodeType.CHEST,   10],
    [TowerNodeType.UPGRADE, 12],
    [TowerNodeType.SHOP,     6],
    [TowerNodeType.HEAL,     8],
    [TowerNodeType.RANDOM,   5],
  ],
};

// ─── RUN CARDS ───────────────────────────────────────────────────────────────

export const TOWER_RUN_CARDS: RunCard[] = [
  // ATTACK
  {
    id: 'rc_atk_edge',
    name: 'Fio Afiado',
    description: '+8 ATK enquanto durar a run.',
    icon: '⚔️',
    type: 'attack',
    rarity: 'bronze',
    effects: [{ stat: 'atk', statBonus: 8 }],
  },
  {
    id: 'rc_atk_fury',
    name: 'Fúria de Batalha',
    description: '+16 ATK. Cada andar aumenta o bônus em +2.',
    icon: '🔥',
    type: 'attack',
    rarity: 'silver',
    effects: [{ stat: 'atk', statBonus: 16 }],
  },
  {
    id: 'rc_atk_executioner',
    name: 'Lâmina do Executor',
    description: '+24 ATK e +5% de chance de crítico.',
    icon: '💀',
    type: 'attack',
    rarity: 'gold',
    effects: [{ stat: 'atk', statBonus: 24 }, { stat: 'luck', statBonus: 5 }],
  },
  {
    id: 'rc_atk_magic',
    name: 'Canalização Arcana',
    description: '+12 Magia enquanto durar a run.',
    icon: '🔮',
    type: 'attack',
    rarity: 'bronze',
    effects: [{ stat: 'magic', statBonus: 12 }],
  },
  // DEFENSE
  {
    id: 'rc_def_iron',
    name: 'Pele de Ferro',
    description: '+8 DEF enquanto durar a run.',
    icon: '🛡️',
    type: 'defense',
    rarity: 'bronze',
    effects: [{ stat: 'def', statBonus: 8 }],
  },
  {
    id: 'rc_def_fortress',
    name: 'Fortaleza Viva',
    description: '+16 DEF e +40 HP Máximo.',
    icon: '🏰',
    type: 'defense',
    rarity: 'silver',
    effects: [{ stat: 'def', statBonus: 16 }, { stat: 'maxHp', statBonus: 40 }],
  },
  {
    id: 'rc_def_blessing',
    name: 'Bênção Protetora',
    description: '+24 DEF e +80 HP Máximo.',
    icon: '✨',
    type: 'defense',
    rarity: 'gold',
    effects: [{ stat: 'def', statBonus: 24 }, { stat: 'maxHp', statBonus: 80 }],
  },
  {
    id: 'rc_def_vitality',
    name: 'Reserva de Vitalidade',
    description: '+80 HP Máximo. HP atual restaurado em 40.',
    icon: '💚',
    type: 'defense',
    rarity: 'bronze',
    effects: [{ stat: 'maxHp', statBonus: 80 }],
  },
  // PASSIVE
  {
    id: 'rc_pas_swiftness',
    name: 'Passo Ligeiro',
    description: '+4 Velocidade. Age antes dos inimigos com mais frequência.',
    icon: '💨',
    type: 'passive',
    rarity: 'bronze',
    effects: [{ stat: 'speed', statBonus: 4 }],
  },
  {
    id: 'rc_pas_gold',
    name: 'Instinto Mercantil',
    description: '+30% ouro ganho em combate nesta run.',
    icon: '💰',
    type: 'passive',
    rarity: 'silver',
    effects: [{ goldGainBonus: 0.3 }],
  },
  {
    id: 'rc_pas_mana',
    name: 'Reserva de Mana',
    description: '+40 MP Máximo.',
    icon: '💧',
    type: 'passive',
    rarity: 'bronze',
    effects: [{ stat: 'maxMp', statBonus: 40 }],
  },
  // SPECIAL
  {
    id: 'rc_spc_second_wind',
    name: 'Segundo Fôlego',
    description: 'Uma vez por andar, sobrevive com 1 HP se receber golpe fatal.',
    icon: '🌬️',
    type: 'special',
    rarity: 'gold',
    effects: [{ bonusKey: 'secondWind', bonusValue: 1 }],
  },
  {
    id: 'rc_spc_bloodthirst',
    name: 'Sede de Sangue',
    description: 'Recupera 10% do dano causado como HP.',
    icon: '🩸',
    type: 'special',
    rarity: 'silver',
    effects: [{ bonusKey: 'lifeSteal', bonusValue: 0.10 }],
  },
  {
    id: 'rc_spc_echo',
    name: 'Eco de Batalha',
    description: '20% de chance de atacar duas vezes no mesmo turno.',
    icon: '⚡',
    type: 'special',
    rarity: 'gold',
    effects: [{ bonusKey: 'doubleAttackChance', bonusValue: 0.20 }],
  },
];

// ─── TOWER EVENTS ─────────────────────────────────────────────────────────────

export const TOWER_EVENTS: TowerEvent[] = [
  {
    id: 'ev_wandering_merchant',
    title: 'Mercador Errante',
    description: 'Um mercador mascarado aparece de um beco escuro. "Tenho algo para você... por um preço."',
    icon: '🛒',
    options: [
      { label: 'Comprar Poção (50 ouro)', description: 'Ganha uma Poção de Vida.', effect: { type: 'item', itemId: 'pot_3' } },
      { label: 'Ignorar', description: 'Segue em frente.', effect: { type: 'nothing' } },
    ],
  },
  {
    id: 'ev_shrine_of_war',
    title: 'Santuário da Guerra',
    description: 'Uma estátua antiga emana energia bélica. Você pode absorvê-la... mas há um custo.',
    icon: '⚔️',
    options: [
      { label: 'Absorver energia (perde 15% HP)', description: '+12 ATK pelo resto da run.', effect: { type: 'hp_loss', percent: 15 } },
      { label: 'Seguir em frente', description: 'Não arrisca o HP.', effect: { type: 'nothing' } },
    ],
  },
  {
    id: 'ev_old_chest',
    title: 'Baú Antigo',
    description: 'Um baú enferrujado no corredor. Pode conter tesouros ou uma armadilha.',
    icon: '🎁',
    options: [
      { label: 'Abrir o baú', description: 'Ganha 80 de ouro.', effect: { type: 'gold', amount: 80 } },
      { label: 'Ignorar', description: 'Não vale o risco.', effect: { type: 'nothing' } },
    ],
  },
  {
    id: 'ev_healing_spring',
    title: 'Fonte Sagrada',
    description: 'Água cristalina brota do chão da torre. Você sente sua energia se restaurar.',
    icon: '💧',
    options: [
      { label: 'Beber da fonte', description: 'Restaura 25% do HP máximo.', effect: { type: 'heal', percent: 25 } },
      { label: 'Seguir em frente', description: 'Preserva a fonte para outros.', effect: { type: 'nothing' } },
    ],
  },
  {
    id: 'ev_cursed_altar',
    title: 'Altar Amaldiçoado',
    description: 'Escrituras ilegíveis cobrem um altar negro. Uma voz sussurra promessas de poder.',
    icon: '💀',
    options: [
      { label: 'Fazer o pacto (perde 20% HP)', description: 'Ganha uma carta de corrida aleatória.', effect: { type: 'hp_loss', percent: 20 } },
      { label: 'Recusar', description: 'Não negocia com forças sombrias.', effect: { type: 'nothing' } },
    ],
  },
  {
    id: 'ev_wounded_warrior',
    title: 'Guerreiro Ferido',
    description: 'Um guerreiro caído pede ajuda. Ele parece ter informações sobre o boss deste andar.',
    icon: '🩹',
    options: [
      { label: 'Usar uma poção (se tiver)', description: 'Recupera HP e recebe informação.', effect: { type: 'nothing' } },
      { label: 'Dar ouro (30 ouro)', description: 'Ele te conta os pontos fracos do boss.', effect: { type: 'gold', amount: -30 } },
      { label: 'Seguir em frente', description: 'Não te importa.', effect: { type: 'nothing' } },
    ],
  },
  {
    id: 'ev_magic_portal',
    title: 'Portal Mágico',
    description: 'Um portal instável pulsa na sua frente. Passá-lo pode levar a algum lugar vantajoso... ou não.',
    icon: '🌀',
    options: [
      { label: 'Entrar no portal', description: 'Chance de teletransportar para um baú de ouro.', effect: { type: 'gold', amount: 120 } },
      { label: 'Ignorar', description: 'Portais instáveis são perigosos.', effect: { type: 'nothing' } },
    ],
  },
  {
    id: 'ev_ancient_library',
    title: 'Biblioteca Antiga',
    description: 'Prateleiras de tomos empoeirados enchem o corredor. Um livro brilhante se destaca.',
    icon: '📚',
    options: [
      { label: 'Estudar o tomo (5 min)', description: 'Ganha uma carta de corrida.', effect: { type: 'card', cardId: 'rc_atk_edge' } },
      { label: 'Seguir em frente', description: 'Sem tempo para leitura.', effect: { type: 'nothing' } },
    ],
  },
];

// ─── SANCTUARY OPTIONS POOL ───────────────────────────────────────────────────

/** Safe option: always a heal. */
export const SANCTUARY_HEAL_OPTIONS: TowerSanctuaryOption[] = [
  { id: 'sanc_heal_30', kind: 'heal', label: 'Curar Ferimentos', description: 'Recupera 30% do HP máximo.', icon: '💚', healPercent: 30 },
  { id: 'sanc_heal_50', kind: 'heal', label: 'Banho de Luz', description: 'Recupera 50% do HP máximo.', icon: '🌟', healPercent: 50 },
  { id: 'sanc_heal_80', kind: 'heal', label: 'Restauração Total', description: 'Recupera 80% do HP máximo.', icon: '✨', healPercent: 80 },
  { id: 'sanc_heal_full', kind: 'heal', label: 'Milagre Sagrado', description: 'Recupera HP máximo completamente.', icon: '🙏', healPercent: 100 },
];

/** Build option: always a run card. */
export const SANCTUARY_CARD_OPTIONS: TowerSanctuaryOption[] = [
  { id: 'sanc_card_atk', kind: 'card', label: 'Poder Ofensivo', description: 'Escolhe uma carta de ataque.', icon: '⚔️', cardId: 'rc_atk_edge' },
  { id: 'sanc_card_def', kind: 'card', label: 'Poder Defensivo', description: 'Escolhe uma carta de defesa.', icon: '🛡️', cardId: 'rc_def_iron' },
  { id: 'sanc_card_pas', kind: 'card', label: 'Habilidade Passiva', description: 'Escolhe uma carta passiva.', icon: '💫', cardId: 'rc_pas_swiftness' },
  { id: 'sanc_card_spc', kind: 'card', label: 'Dom Especial', description: 'Escolhe uma carta especial rara.', icon: '🌀', cardId: 'rc_spc_second_wind' },
];

/** Variable option: gold, relic, or tradeoff. */
export const SANCTUARY_VARIABLE_OPTIONS: TowerSanctuaryOption[] = [
  { id: 'sanc_gold_60',    kind: 'gold',     label: 'Tesouro Escondido',  description: 'Ganha 60 de ouro.',           icon: '💰', goldAmount: 60 },
  { id: 'sanc_gold_120',   kind: 'gold',     label: 'Saco de Moedas',     description: 'Ganha 120 de ouro.',          icon: '💰', goldAmount: 120 },
  { id: 'sanc_relic',      kind: 'relic',    label: 'Relíquia da Torre',  description: 'Carta especial temporária.',  icon: '🔮', relicCardId: 'rc_spc_bloodthirst' },
  { id: 'sanc_tradeoff',   kind: 'tradeoff', label: 'Pacto de Sangue',    description: 'Perde 20 HP máx; ganha +12 ATK.', icon: '🩸', tradeHpForAtk: 20 },
  { id: 'sanc_gold_200',   kind: 'gold',     label: 'Baú do Guardião',    description: 'Ganha 200 de ouro.',          icon: '🏆', goldAmount: 200 },
];
