
export enum GameState {
  MENU,
  TAVERN,
  BATTLE,
  SHOP,
  ALCHEMIST,
  DUNGEON_RESULT,
  GAME_OVER,
  VICTORY,
  BOSS_VICTORY,
  CARD_REWARD,
  TOWER_HUB,
  TOWER_MAP,
  TOWER_SANCTUARY,
  TOWER_RESULT
}

export enum TowerNodeType {
  COMBAT = 'COMBAT',
  ELITE = 'ELITE',
  EVENT = 'EVENT',
  CHEST = 'CHEST',
  UPGRADE = 'UPGRADE',
  SHOP = 'SHOP',
  HEAL = 'HEAL',
  RANDOM = 'RANDOM'
}

export enum TurnState {
  PLAYER_INPUT,
  PLAYER_ANIMATION,
  ENEMY_TURN,
  PROCESSING
}

export type BattleTimelineState = 'RUNNING' | 'WAITING_INPUT' | 'EXECUTING';

export type BattleActorKind = 'player' | 'enemy';

export type TipoDefesa = 'FISICA' | 'MAGICA';

export type BattleActorChargeState = 'carregando' | 'pronto' | 'executando';

export interface BattleActorGauge {
  id: string;
  kind: BattleActorKind;
  label: string;
  speed: number;
  tempoDeAtaque: number;
  state: BattleActorChargeState;
}

export type BattleActorGaugeMap = Record<string, BattleActorGauge>;

/** Ação pendente que requer seleção de alvo em grupo de inimigos. */
export type PendingTargetAction =
  | { type: 'attack' }
  | { type: 'skill'; skill: Skill }
  | null;

export interface Stats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  magicDef?: number;
  speed: number;
  luck: number; // New stat for crit chance
  magic: number;
}

export type PlayerClassId = 'knight' | 'barbarian' | 'mage' | 'ranger' | 'rogue';
export type PlayerAnimationAction = 'idle' | 'battle-idle' | 'attack' | 'defend' | 'defend-hit' | 'hit' | 'critical-hit' | 'item' | 'heal' | 'skill' | 'evade' | 'death';

/** Elemento natural dos monstros GLTF — substitui a classe dos inimigos tradicionais. */
export type MonsterElementType = 'agua' | 'terra' | 'fogo' | 'vento' | 'sombrio';
/** Categoria de corpo dos monstros GLTF (define rig e animações disponíveis). */
export type GltfMonsterBodyType = 'Big' | 'Flying';
/** Arquétipo de classe dos monstros GLTF para missões de caça. */
export type MonsterArchetype = 'ladino' | 'barbaro' | 'mago' | 'guerreiro' | 'atirador' | 'dragao' | 'demonio' | 'orc';

export interface GltfMonsterTemplate {
  id: string;
  name: string;
  lore: string;
  element: MonsterElementType;
  bodyType: GltfMonsterBodyType;
  gltfFile: string;
  baseStats: {
    hp: number; maxHp: number;
    mp: number; maxMp: number;
    atk: number; def: number; magicDef?: number;
    speed: number; luck: number; magic: number;
  };
  xpReward: number;
  goldReward: number;
  color: string;
  scale: number;
  attackStyle: 'armed' | 'unarmed';
  rareDrops?: LootChance[];
  /** Arquétipo de classe para missões do Diário de Missões. */
  archetipo?: MonsterArchetype;
}

// ── Diário de Missões ──────────────────────────────────────────────────────
export type MissionActionType =
  | 'KILL_ENEMY'
  | 'KILL_FLYING'
  | 'KILL_ELEMENT_DARK'
  | 'KILL_ELEMENT_FIRE'
  | 'KILL_ELEMENT_TERRA'
  | 'KILL_ELEMENT_AGUA'
  | 'KILL_ELEMENT_VENTO'
  | 'KILL_ARCHETYPE_ROGUE'
  | 'KILL_ARCHETYPE_BARBARIAN'
  | 'KILL_ARCHETYPE_MAGE'
  | 'KILL_ARCHETYPE_WARRIOR'
  | 'KILL_ARCHETYPE_RANGER'
  | 'KILL_ARCHETYPE_DRAGON'
  | 'KILL_ARCHETYPE_DEMON'
  | 'KILL_ARCHETYPE_ORC'
  | 'KILL_BOSS'
  | 'REACH_STAGE';

export type MissionCategory = 'CAÇA' | 'ESPECIAL';

export interface Mission {
  id: string;
  tipoMissao: MissionActionType;
  categoria: MissionCategory;
  descricao: string;
  progressoAtual: number;
  metaAtual: number;
  nivelAtual: number;
  recompensaAtual: number;
  metaBase: number;
  metaIncrement: number;
  recompensaBase: number;
  recompensaIncrement: number;
}

export interface PlayerClassVisualProfile {
  silhouette: 'knight' | 'barbarian' | 'mage' | 'ranger' | 'rogue';
  primaryColor: string;
  secondaryColor: string;
  detailColor: string;
  auraColor: string;
}

export interface PlayerClassModelCalibration {
  scale: number;
  positionOffset: [number, number, number];
  rotationOffset: [number, number, number];
}

export interface PlayerClassAnimationMap {
  idle: string;
  battleIdle: string;
  attackWeapon: string;
  attackUnarmed: string;
  defend: string;
  defendHit: string;
  hit: string;
  criticalHit: string;
  item: string;
  heal: string;
  skill: string;
  evadeLeft: string;
  evadeRight: string;
  death: string;
  /** Override attack clip for a specific weapon grip type. Falls back to attackWeapon. */
  attackByGrip?: Partial<Record<string, string>>;
  /** Override battle-idle clip for a specific weapon grip type. Falls back to battleIdle. */
  battleIdleByGrip?: Partial<Record<string, string>>;
}

export interface PlayerClassAssets {
  modelPath: string;
  modelUrl?: string;
  texturePath?: string;
  textureUrl?: string;
  animationDirectory: string;
  animationFiles: string[];
  animationUrls?: string[];
  animationMap?: PlayerClassAnimationMap;
  implementationStatus: 'voxel' | 'planned-fbx' | 'fbx';
  calibration?: PlayerClassModelCalibration;
}

export interface PlayerClassAvatarAsset {
  path: string;
  url: string;
}

export interface PlayerClassAvatarSet {
  fullBody: PlayerClassAvatarAsset;
  fullBodyCloseUp: PlayerClassAvatarAsset;
  faceSquare: PlayerClassAvatarAsset;
}

export interface PlayerClassDefinition {
  id: PlayerClassId;
  name: string;
  title: string;
  description: string;
  baseStats: Stats;
  visualProfile: PlayerClassVisualProfile;
  weaponProficiencies: WeaponGripType[];
  weaponProficiencyBonuses?: WeaponProficiencyBonusMap;
  assets: PlayerClassAssets;
  avatars: PlayerClassAvatarSet;
}

export type WeaponGripType = 'dagger' | 'sword' | 'axe' | 'hammer' | 'wand' | 'staff' | 'spear' | 'halberd' | 'bow' | 'fist';
export type WeaponProficiencyBonusStat = 'atk' | 'def' | 'speed' | 'luck' | 'magic' | 'maxMp';
export type WeaponProficiencyBonusMap = Partial<Record<WeaponProficiencyBonusStat, number>>;

export type ItemType = 'weapon' | 'armor' | 'potion' | 'helmet' | 'legs' | 'shield' | 'material';
export type Rarity = 'bronze' | 'silver' | 'gold';
export type CardOfferSource = 'boss' | 'level-up';
export type CardCategory = 'economia' | 'atributo' | 'batalha' | 'especial';
export type CardEffectType =
  | 'gold_instant'
  | 'xp_instant'
  | 'max_hp'
  | 'max_mp'
  | 'atk'
  | 'magic'
  | 'def'
  | 'speed'
  | 'luck'
  | 'gold_gain_multiplier'
  | 'xp_gain_multiplier'
  | 'boss_damage_multiplier'
  | 'heal_multiplier'
  | 'opening_atk_buff'
  | 'opening_def_buff'
  | 'defend_mana_restore'
  | 'counter_attack_chance_bonus'
  | 'opening_counter_attack_boost'
  | 'hp_regen_per_turn'
  | 'mp_regen_per_turn'
  | 'unlock_skill';

export interface Item {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: ItemType;
  value: number; // Atk, Def, or Heal amount
  hpBonus?: number;
  mpBonus?: number;
  magicBonus?: number;
  magicDefBonus?: number;
  speedBonus?: number;
  luckBonus?: number;
  icon: string; // Icon helper
  iconImage?: string; // Official PNG icon URL
  rarity: Rarity;
  minLevel: number;
  source?: 'shop' | 'dungeon' | 'alchemist';
  duration?: number; // For buffs
  animacaoExecucao?: string;
  animacaoImpacto?: string;
  animacaoExecucaoCor?: string;
  animacaoImpactoCor?: string;
}

export interface LootChance {
  itemId: string;
  chance: number;
}

export interface EnemyTemplate {
  name: string;
  type: 'beast' | 'humanoid' | 'undead';
  enemyClassId?: PlayerClassId;
  baseStats?: Partial<Pick<Stats, 'hp' | 'maxHp' | 'mp' | 'maxMp' | 'atk' | 'def' | 'magicDef' | 'speed' | 'luck' | 'magic'>>;
  color?: string;
  scale?: number;
  assets?: PlayerClassAssets;
  attackStyle?: 'armed' | 'unarmed';
}

export interface DungeonEnemyTemplate extends EnemyTemplate {
  minEvolution: number;
  hpMultiplier?: number;
  atkMultiplier?: number;
  defMultiplier?: number;
  speedBonus?: number;
  guaranteedDrops?: string[];
  rareDrops?: LootChance[];
}

export interface DungeonBossTemplate extends EnemyTemplate {
  hpMultiplier?: number;
  atkMultiplier?: number;
  defMultiplier?: number;
  speedBonus?: number;
  guaranteedDrops?: string[];
  rareDrops?: LootChance[];
}

export type StatusEffectKind = 'burn' | 'bleed' | 'marked';
export type ClassResourceType = 'valor' | 'rage' | 'arcane' | 'focus' | 'shadow';
export type SkillVisualTheme =
  | 'steel'
  | 'solar'
  | 'ember'
  | 'rage'
  | 'storm'
  | 'frost'
  | 'arcane'
  | 'verdant'
  | 'thorn'
  | 'shadow'
  | 'blood'
  | 'lunar';
export type TalentTrailNodeEffectBonusKey =
  | 'critChance'
  | 'critDamage'
  | 'healPower'
  | 'physicalDamage'
  | 'magicDamage'
  | 'damageReduction'
  | 'defendMitigation'
  | 'statusPotency'
  | 'burnDamage'
  | 'bleedDamage'
  | 'markedDamage'
  | 'manaOnHit'
  | 'manaOnDefend'
  | 'lifeSteal'
  | 'counterOnDefendChance'
  | 'resourceOnAttack'
  | 'resourceOnSkill'
  | 'resourceCap'
  | 'resourceStart';

export interface StatusEffect {
  id: string;
  kind: StatusEffectKind;
  name: string;
  duration: number;
  potency: number;
  color: string;
  source: 'skill' | 'talent' | 'item';
}

export interface ClassResourceState {
  type: ClassResourceType;
  name: string;
  color: string;
  value: number;
  max: number;
}

export interface SkillStatusEffect {
  kind: StatusEffectKind;
  chance: number;
  duration: number;
  potency: number;
}

export interface SkillBuffEffect {
  target: 'player';
  kind: 'atk' | 'def';
  modifier: number;
  duration: number;
}

export interface SkillResourceEffect {
  gain?: number;
  cost?: number;
  consumeAll?: boolean;
  bonusDamagePerPoint?: number;
}

export interface Skill {
  id: string;
  name: string;
  cost: number; 
  damageMult: number;
  minLevel: number;
  description: string;
  manaCost: number;
  type: 'physical' | 'magic' | 'heal';
  classId?: PlayerClassId;
  source?: 'base' | 'card' | 'constellation';
  icon?: string;
  visualTheme?: SkillVisualTheme;
  trailId?: string;
  trailColor?: string;
  statusEffect?: SkillStatusEffect;
  buffEffect?: SkillBuffEffect;
  resourceEffect?: SkillResourceEffect;
  resourceLabel?: string;
  animacaoExecucao?: string;
  animacaoImpacto?: string;
  animacaoExecucaoCor?: string;
  animacaoImpactoCor?: string;
  animacaoImpactoAlvo?: 'self' | 'target';
  tipoAnimacao?: 'cura_status' | 'ataque' | 'magia';
}

export interface TalentNodeEffect {
  stats?: Partial<Pick<Stats, 'hp' | 'maxHp' | 'mp' | 'maxMp' | 'atk' | 'def' | 'magicDef' | 'speed' | 'luck' | 'magic'>>;
  bonuses?: Partial<Record<TalentTrailNodeEffectBonusKey, number>>;
  unlockSkillId?: string;
}

export type TalentNodeType = 'attribute' | 'passive' | 'skill';
export type TalentNodeShapeVariant = 'diamond' | 'hex' | 'star';

export interface TalentNode {
  id: string;
  classId: PlayerClassId;
  trailId: string;
  trailName: string;
  title: string;
  description: string;
  tier: number;
  stage: number;
  nodeType: TalentNodeType;
  shapeVariant: TalentNodeShapeVariant;
  cost: number;
  requiredLevel: number;
  color: string;
  icon: string;
  prerequisites: string[];
  effects: TalentNodeEffect[];
}

export interface ClassTalentTrail {
  id: string;
  name: string;
  description: string;
  color: string;
  glowColor: string;
  nodes: TalentNode[];
}

export interface ClassConstellationDefinition {
  classId: PlayerClassId;
  name: string;
  subtitle: string;
  resource: Omit<ClassResourceState, 'value'>;
  trails: ClassTalentTrail[];
}

export interface TalentCombatBonuses {
  critChance: number;
  critDamage: number;
  healPower: number;
  physicalDamage: number;
  magicDamage: number;
  damageReduction: number;
  defendMitigation: number;
  statusPotency: number;
  burnDamage: number;
  bleedDamage: number;
  markedDamage: number;
  manaOnHit: number;
  manaOnDefend: number;
  lifeSteal: number;
  counterOnDefendChance: number;
  resourceOnAttack: number;
  resourceOnSkill: number;
  resourceCap: number;
  resourceStart: number;
}

export interface CardEffect {
  type: CardEffectType;
  value: number;
  turns?: number;
  skillId?: string;
}

export interface ProgressionCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  minLevel: number;
  category: CardCategory;
  offerSources: CardOfferSource[];
  effects: CardEffect[];
}

export interface CardRewardOffer {
  source: CardOfferSource;
  reason: string;
  phaseLevel?: number;
}

export interface AlchemistCardOffer {
  id: string;
  cost: number;
  tagline: string;
  card: ProgressionCard;
}

export interface AlchemistItemOffer {
  id: string;
  cost: number;
  tagline: string;
  item: Item;
}

export interface DungeonRewards {
  gold: number;
  xp: number;
  diamonds: number;
  drops: Record<string, number>;
  clearedMonsters: number;
  totalMonsters: number;
  evolution: number;
  bossDefeated: boolean;
  subBossDefeatedInPhase: boolean;
}

export interface BossVictoryContext {
  mode: 'hunt' | 'dungeon';
  bossName: string;
  nextStage?: number;
  newlyUnlockedShopRarity?: Rarity;
  nextEvolution?: number;
  nextTotalMonsters?: number;
  rewards?: DungeonRewards;
}

export interface DungeonRunState {
  entrySnapshot: Player;
  rewards: DungeonRewards;
  evolution: number;
}

export interface DungeonResult {
  outcome: 'victory' | 'defeat' | 'withdrawal';
  rewards: DungeonRewards;
  reason: string;
  nextEvolution?: number;
  nextTotalMonsters?: number;
}

export interface PlayerCardBonuses {
  goldGainMultiplier: number;
  xpGainMultiplier: number;
  bossDamageMultiplier: number;
  healingMultiplier: number;
  openingAtkBuff: number;
  openingDefBuff: number;
  defendManaRestore: number;
  counterAttackChanceBonus: number;
  openingCounterAttackBoost: number;
  hpRegenPerTurn: number;
  mpRegenPerTurn: number;
}

export interface Player {
  name: string;
  classId: PlayerClassId;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  diamonds: number;
  stats: Stats;
  inventory: { [itemId: string]: number }; // Item ID -> Quantity
  equippedWeapon: Item | null;
  equippedArmor: Item | null;
  equippedHelmet: Item | null;
  equippedLegs: Item | null;
  equippedShield: Item | null;
  skills: Skill[];
  equippedSkillIds: string[]; // per-slot: '' = empty, 'skill_id' = assigned
  equippedItemSlots: Array<{ itemId: string; qty: number }>; // 4 slots, empty = { itemId: '', qty: 0 }
  talentPoints: number;
  unlockedTalentNodeIds: string[];
  classResource: ClassResourceState;
  statusEffects: StatusEffect[];
  chosenCards: string[];
  cardBonuses: PlayerCardBonuses;
  isDefending: boolean;
  isDefendendo?: boolean;
  tipoDefesaAtiva?: TipoDefesa | null;
  impulso: number; // 0-3 reserve charge
  impulsoAtivo: number; // 0-3 consumed by next attack/defend/skill
  limitMeter: number; // 0 to 100
  buffs: {
    atkMod: number;
    defMod: number;
    atkTurns: number;
    defTurns: number;
    autoGuardTurns: number;
    perfectEvadeTurns: number;
    doubleAttackTurns: number;
    riposteTurns: number;
    riposteArmed: boolean;
    counterChanceBoost: number;
    counterChanceBoostTurns: number;
    perfectGuardTurns: number;
    impulseDefenseBoostTurns: number;
    impulseDefenseLevel: number;
    guaranteedCounterTurns: number;
    skillEmpowerTurns: number;
  };
}

export type EnemyIntentType = 'attack' | 'defend' | 'impulse' | 'skill' | 'item';

export interface EnemyIntentPreview {
  type: EnemyIntentType;
  probability: number;
}

export interface Enemy {
  id: string;
  name: string;
  stats: Stats;
  level: number;
  xpReward: number;
  goldReward: number;
  color: string; 
  scale: number;
  type: 'beast' | 'humanoid' | 'undead';
  enemyClassId: PlayerClassId;
  isBoss: boolean;
  isSubBoss?: boolean;
  isDefending: boolean;
  isDefendendo?: boolean;
  tipoDefesaAtiva?: TipoDefesa | null;
  impulso: number;
  impulseGuardLevel?: number;
  statusEffects?: StatusEffect[];
  assets?: PlayerClassAssets;
  attackStyle?: 'armed' | 'unarmed';
  guaranteedDrops?: string[];
  rareDrops?: LootChance[];
  manaRegenOnDefend: number;
  potionCharges: number;
  potionHealValue: number;
  lastAction?: 'attack' | 'skill' | 'defend' | 'item' | 'steal' | 'none';
  aiTurnCounter: number;
  stealAttemptsUsed: number;
  maxStealAttempts: number;
  lastStealTurn: number;
  stolenGoldTotal: number;
  maxGoldStealPerBattle: number;
  stolenItems: string[];
  /** GLTF monster URL — when set, the battle scene renders the GLTF model instead of the FBX skeleton. */
  gltfModelUrl?: string;
  /** Elemental affinity of GLTF monsters. */
  element?: MonsterElementType;
  /** Body rig type of GLTF monster, determines which animation clip map is used. */
  gltfBodyType?: GltfMonsterBodyType;
  /** Arquétipo de classe para missões do Diário de Missões. */
  archetipo?: MonsterArchetype;
  aiProfile: {
    tier: number;
    lowHpThreshold: number;
    criticalHpThreshold: number;
    lowManaThreshold: number;
    defendBaseChance: number;
    reactToPlayerAction: boolean;
    critChanceBonus: number;
    critDamageBonus: number;
  };
  skillSet: Array<{
    id: string;
    name: string;
    type: 'magic' | 'special' | 'heal' | 'buff' | 'debuff';
    effect: 'damage' | 'heal' | 'buff_atk' | 'buff_def';
    attackKind: 'physical' | 'magic';
    damageMultiplier: number;
    healMultiplier?: number;
    buffModifier?: number;
    buffDuration?: number;
    manaCost: number;
    cooldown: number;
    currentCooldown: number;
  }>;
  combatBuffs: {
    atkMod: number;
    defMod: number;
    turns: number;
  };
}

export interface BattleLog {
  message: string;
  type: 'info' | 'damage' | 'heal' | 'crit' | 'evade' | 'buff';
}

export interface Particle {
  id: string;
  position: [number, number, number];
  color: string;
  scale: number;
  velocity: [number, number, number];
  life: number;
  ttl?: number;
  expiresAt?: number;
  renderMode?: 'sprite2d' | 'shard3d';
}

export interface FloatingText {
  id: string;
  text: string;
  iconImage?: string; // Optional PNG icon URL (overrides text display for 'item' type)
  type: 'damage' | 'heal' | 'crit' | 'buff' | 'skill' | 'item';
  target: 'player' | 'enemy'; // Determines screen position
  xOffset: number; // Random slight offset
  yOffset: number;
  durationMs?: number;
  expiresAt?: number;
  color?: string;
}

export type SpritePlaybackMode = 'one-shot' | 'loop';
export type SpriteTrackPlaybackStatus = 'idle' | 'playing' | 'finished';
export type SpriteTailLoopPattern = 'forward' | 'ping-pong';
export type SpriteMotionPreset = 'none' | 'rise' | 'orbit' | 'forward' | 'follow-target' | 'zigzag';
export type SpriteTrackAnchorTarget = 'hero' | 'enemy';
export type SpriteTrackAnchorPoint = 'root' | 'chest' | 'head' | 'feet';

export interface SpriteFrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpriteTrackDefinition {
  id: string;
  name: string;
  enabled: boolean;
  spriteSheetName?: string;
  spriteSheetPath?: string;
  spriteSheetUrl?: string;
  spriteSheetSize?: { width: number; height: number };
  spriteRows?: number;
  spriteCols?: number;
  invertRows?: boolean;
  preserveFrameAspect?: boolean;
  useOriginalFrameSize?: boolean;
  originalSizeScale?: number;
  rotationDeg?: number;
  playbackMode: SpritePlaybackMode;
  startEmptyFrame?: boolean;
  endEmptyFrame?: boolean;
  stopOnLastFrame?: boolean;
  tailLoopEnabled?: boolean;
  tailLoopFrameCount?: number;
  tailLoopRepeats?: number;
  tailLoopPattern?: SpriteTailLoopPattern;
  timelineStartFrame?: number;
  timelineEndFrame?: number;
  fps: number;
  frameIndices: number[];
  frameDurationOverridesMs?: Partial<Record<number, number>>;
  anchorTarget: SpriteTrackAnchorTarget;
  anchorPoint?: SpriteTrackAnchorPoint;
  offset3d: [number, number, number];
  size: [number, number];
  opacity?: number;
  tintColor?: string;
  blendMode?: 'normal' | 'additive';
  depthTest?: boolean;
  depthWrite?: boolean;
  renderPriority?: number;
  motionPreset?: SpriteMotionPreset;
  motionAmplitude?: number;
  motionSpeed?: number;
}

export interface SpriteOverlayAnimationDefinition {
  id: string;
  version: 1;
  name: string;
  spriteSheetName: string;
  spriteSheetUrl?: string;
  referencePreview?: {
    previewReference?: 'hero' | 'enemy';
    heroClassId?: PlayerClassId;
    enemyIndex?: number;
  };
  sheetSize: { width: number; height: number };
  frameSource: {
    rows: number;
    cols: number;
    frames: SpriteFrameRect[];
  };
  spriteTracks: SpriteTrackDefinition[];
}

// ─── TOWER / ROGUELIKE TYPES ────────────────────────────────────────────────

export interface TowerNode {
  id: string;
  type: TowerNodeType;
  column: number;
  row: number;
  connections: string[]; // IDs of nodes in next column this connects to
  completed: boolean;
  available: boolean;
  difficulty?: number; // 1-3 relative difficulty modifier
}

export interface TowerFloorMap {
  floorNumber: number;
  act: number;
  nodeColumns: TowerNode[][];  // array of columns, each column is an array of nodes
  bossNodeId: string;          // ID of the boss node (final column)
}

export interface ConsumableSlot {
  itemId: string | null;
  quantity: number;
  maxQuantity: number;
}

export type RunCardType = 'attack' | 'defense' | 'passive' | 'special';

export interface RunCardEffect {
  stat?: keyof Stats;
  statBonus?: number;
  bonusKey?: string;
  bonusValue?: number;
  goldGainBonus?: number;
  healBonus?: number;
  mpRegenBonus?: number;
  hpRegenBonus?: number;
}

export interface RunCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: RunCardType;
  rarity: Rarity;
  effects: RunCardEffect[];
}

export interface TowerRunRewards {
  gold: number;
  xp: number;
  essenceEarned: number;
  drops: Record<string, number>;
}

export type TowerRunPhase = 'map' | 'node' | 'sanctuary' | 'complete';

export interface TowerRunState {
  floor: number;
  act: number;
  loop: number;
  currentFloorMap: TowerFloorMap;
  completedNodeIds: string[];
  selectedNodeId: string | null;    // node currently being resolved
  entrySnapshot: Player;            // HUB equipment snapshot — restored on death/exit
  runEquipment: {
    weapon: Item | null;
    armor: Item | null;
    helmet: Item | null;
    legs: Item | null;
    shield: Item | null;
  };
  consumableSlots: ConsumableSlot[];
  runCards: RunCard[];
  accumulatedRewards: TowerRunRewards;
  phase: TowerRunPhase;
}

export interface TowerMeta {
  essence: number;
  consumableSlotsLevel: number;    // 1 = 3 slots, 2 = 4 slots, 3 = 5 slots
  highestFloor: number;
  highestLoop: number;
}

export type TowerSanctuaryOptionKind = 'heal' | 'card' | 'merchant' | 'gold' | 'relic' | 'tradeoff';

export interface TowerSanctuaryOption {
  id: string;
  kind: TowerSanctuaryOptionKind;
  label: string;
  description: string;
  icon: string;
  // Inline effect data
  healPercent?: number;         // for 'heal'
  cardId?: string;              // for 'card'
  goldAmount?: number;          // for 'gold'
  relicCardId?: string;         // for 'relic'
  tradeHpForAtk?: number;       // for 'tradeoff'
}

export type TowerEventOptionEffect =
  | { type: 'gold'; amount: number }
  | { type: 'heal'; percent: number }
  | { type: 'card'; cardId: string }
  | { type: 'item'; itemId: string }
  | { type: 'hp_loss'; percent: number }
  | { type: 'nothing' };

export interface TowerEventOption {
  label: string;
  description: string;
  effect: TowerEventOptionEffect;
}

export interface TowerEvent {
  id: string;
  title: string;
  description: string;
  icon: string;
  options: TowerEventOption[];
}
