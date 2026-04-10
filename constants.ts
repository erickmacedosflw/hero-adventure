
import { Item, Skill, EnemyTemplate, DungeonEnemyTemplate, DungeonBossTemplate, AlchemistItemOffer } from './types';
import { REGISTERED_WEAPON_ITEMS } from './game/data/weaponCatalog';
import { CONSTELLATION_SKILLS } from './game/data/classTalents';
import { SPRITE_ANIMATION_IDS } from './game/data/sprite-animations/registry';
export { INITIAL_PLAYER } from './game/data/player';

const BASE_SHOP_ITEMS: Item[] = [
  // --- POTIONS & CONSUMABLES ---
  { id: 'pot_1', name: 'Poção Menor', description: 'Cura ferimentos leves. +25 HP', cost: 40, type: 'potion', value: 25, icon: '🧪', rarity: 'bronze', minLevel: 1, animacaoExecucao: SPRITE_ANIMATION_IDS.execAuraVida2 },
  { id: 'pot_3', name: 'Poção de Vida', description: 'Recuperação moderada. +50 HP', cost: 70, type: 'potion', value: 50, icon: '❤️', rarity: 'bronze', minLevel: 2, animacaoExecucao: SPRITE_ANIMATION_IDS.execAuraVida2 },
  { id: 'pot_5', name: 'Elixir Rubro', description: 'Cura poderosa. +100 HP', cost: 120, type: 'potion', value: 100, icon: '💖', rarity: 'silver', minLevel: 8, animacaoExecucao: SPRITE_ANIMATION_IDS.execAuraVida2 },
  { id: 'pot_4', name: 'Ambrosia Dourada', description: 'Restauração superior. +220 HP', cost: 300, type: 'potion', value: 220, icon: '🌟', rarity: 'gold', minLevel: 15, animacaoExecucao: SPRITE_ANIMATION_IDS.execAuraVida2 },

  { id: 'pot_2', name: 'Essência de Mana Menor', description: 'Recupera energia arcana. +20 MP', cost: 40, type: 'potion', value: 20, icon: '⚗️', rarity: 'bronze', minLevel: 1, animacaoExecucao: SPRITE_ANIMATION_IDS.execAuraMana1 },
  { id: 'pot_mana_2', name: 'Tônico Arcano', description: 'Recuperação de mana intermediária. +45 MP', cost: 75, type: 'potion', value: 45, icon: '🔵', rarity: 'silver', minLevel: 3, animacaoExecucao: SPRITE_ANIMATION_IDS.execAuraMana1 },
  { id: 'pot_mana_3', name: 'Néctar Astral', description: 'Recuperação de mana avançada. +90 MP', cost: 140, type: 'potion', value: 90, icon: '🔷', rarity: 'gold', minLevel: 6, animacaoExecucao: SPRITE_ANIMATION_IDS.execAuraMana1 },

  { id: 'pot_mix_1', name: 'Tônico Balanceado', description: 'Recupera 35 HP e 20 MP.', cost: 95, type: 'potion', value: 35, icon: '🧬', rarity: 'silver', minLevel: 3, animacaoExecucao: SPRITE_ANIMATION_IDS.execAuraVida2 },
  { id: 'pot_mix_2', name: 'Elixir Dual', description: 'Recupera 80 HP e 50 MP.', cost: 190, type: 'potion', value: 80, icon: '💠', rarity: 'gold', minLevel: 6, animacaoExecucao: SPRITE_ANIMATION_IDS.execAuraVida2 },
  
  // Buff Items
  { id: 'pot_atk', name: 'Poção da Fúria', description: '+50% de Ataque por 3 turnos.', cost: 150, type: 'potion', value: 0.5, icon: '🔥', rarity: 'silver', minLevel: 3, duration: 3 },
  { id: 'pot_def', name: 'Tônico de Ferro', description: '+50% de Defesa por 3 turnos.', cost: 150, type: 'potion', value: 0.5, icon: '🛡️', rarity: 'silver', minLevel: 3, duration: 3 },
  { id: 'pot_war_sigil', name: 'Selo Bélico', description: '+50% ATK e +50% DEF por 2 turnos.', cost: 260, type: 'potion', value: 0.5, icon: '⚔️', rarity: 'silver', minLevel: 8, duration: 2 },
  { id: 'pot_overclock', name: 'Overclock Bélico', description: '+60% ATK e +60% DEF por 2 turnos.', cost: 620, type: 'potion', value: 0.6, icon: '💥', rarity: 'gold', minLevel: 12, duration: 2 },

  // --- ARMOR (CHEST) ---
  { id: 'arm_b1', name: 'Túnica de Couro', description: 'Proteção básica. +4 DEF e +6 MP', cost: 180, type: 'armor', value: 4, mpBonus: 6, icon: '👕', rarity: 'bronze', minLevel: 1 },
  { id: 'arm_b2', name: 'Gibão Reforçado', description: 'Costuras duplas para absorver impacto. +5 DEF', cost: 170, type: 'armor', value: 5, icon: '🦺', rarity: 'bronze', minLevel: 2 },
  { id: 'arm_b3', name: 'Peitoral de Ferro Cru', description: 'Placas simples de ferro batido. +6 DEF e +8 MP', cost: 260, type: 'armor', value: 6, mpBonus: 8, icon: '🥋', rarity: 'bronze', minLevel: 3 },
  { id: 'arm_s1', name: 'Cota de Malha', description: 'Elos de aço entrelaçados. +12 DEF e +16 MP', cost: 1200, type: 'armor', value: 12, mpBonus: 16, icon: '⛓️', rarity: 'silver', minLevel: 4 },
  { id: 'arm_s2', name: 'Armadura de Sentinela', description: 'Proteção estável para caçadas longas. +14 DEF', cost: 1450, type: 'armor', value: 14, icon: '🛡️', rarity: 'silver', minLevel: 5 },
  { id: 'arm_s3', name: 'Couraça de Guarda Real', description: 'Aço lapidado para segurar ataques pesados. +16 DEF e +24 MP', cost: 1700, type: 'armor', value: 16, mpBonus: 24, icon: '🦾', rarity: 'silver', minLevel: 6 },
  { id: 'arm_g1', name: 'Peitoral Rúnico', description: 'Encantado com magia antiga. +30 DEF e +36 MP', cost: 3600, type: 'armor', value: 30, mpBonus: 36, icon: '🛡️', rarity: 'gold', minLevel: 9 },
  { id: 'arm_g2', name: 'Armadura do Arconte', description: 'Placas místicas que anulam impacto bruto. +34 DEF e +42 MP', cost: 4200, type: 'armor', value: 34, mpBonus: 42, icon: '🏛️', rarity: 'gold', minLevel: 10 },
  { id: 'arm_g3', name: 'Bastião Imperial', description: 'Forjada para a linha de frente absoluta. +38 DEF e +50 MP', cost: 5000, type: 'armor', value: 38, mpBonus: 50, icon: '👑', rarity: 'gold', minLevel: 12 },

  // --- HELMETS ---
  { id: 'hlm_b1', name: 'Capuz de Viajante', description: 'Protege do sol. +2 DEF e +10 HP', cost: 150, type: 'helmet', value: 2, hpBonus: 10, icon: '🧢', rarity: 'bronze', minLevel: 1 },
  { id: 'hlm_b2', name: 'Elmo de Couro', description: 'Leve e firme para iniciantes. +3 DEF', cost: 150, type: 'helmet', value: 3, icon: '⛑️', rarity: 'bronze', minLevel: 2 },
  { id: 'hlm_b3', name: 'Capacete de Vigia', description: 'Proteção frontal reforçada. +4 DEF e +16 HP', cost: 240, type: 'helmet', value: 4, hpBonus: 16, icon: '🪖', rarity: 'bronze', minLevel: 3 },
  { id: 'hlm_s1', name: 'Elmo de Gladiador', description: 'Intimidador. +8 DEF e +30 HP', cost: 1200, type: 'helmet', value: 8, hpBonus: 30, icon: '🪖', rarity: 'silver', minLevel: 5 },
  { id: 'hlm_s2', name: 'Visor de Aço Azul', description: 'Foco e proteção em lutas táticas. +10 DEF', cost: 1360, type: 'helmet', value: 10, icon: '🧲', rarity: 'silver', minLevel: 6 },
  { id: 'hlm_s3', name: 'Elmo de Comandante', description: 'Projeto fechado para combates intensos. +11 DEF e +42 HP', cost: 1560, type: 'helmet', value: 11, hpBonus: 42, icon: '🛡️', rarity: 'silver', minLevel: 7 },
  { id: 'hlm_g1', name: 'Coroa do Rei Lich', description: 'Gelada ao toque. +20 DEF e +68 HP', cost: 3600, type: 'helmet', value: 20, hpBonus: 68, icon: '👑', rarity: 'gold', minLevel: 10 },
  { id: 'hlm_g2', name: 'Elmo do Eclipse', description: 'Canaliza energia para resistir a golpes críticos. +23 DEF', cost: 4100, type: 'helmet', value: 23, icon: '🌘', rarity: 'gold', minLevel: 11 },
  { id: 'hlm_g3', name: 'Coroa de Aço Celeste', description: 'Proteção régia para mestres de guerra. +26 DEF e +90 HP', cost: 4700, type: 'helmet', value: 26, hpBonus: 90, icon: '✨', rarity: 'gold', minLevel: 12 },

  // --- LEGS ---
  { id: 'leg_b1', name: 'Botas de Pano', description: 'Confortáveis. +1 VEL', cost: 180, type: 'legs', value: 1, icon: '🧦', rarity: 'bronze', minLevel: 1 },
  { id: 'leg_b2', name: 'Botas de Couro', description: 'Firmes para marcha e esquiva. +2 VEL', cost: 260, type: 'legs', value: 2, icon: '👢', rarity: 'bronze', minLevel: 2 },
  { id: 'leg_b3', name: 'Grevas Curtas', description: 'Leves e ágeis para reposicionamento. +3 VEL', cost: 360, type: 'legs', value: 3, icon: '🥾', rarity: 'bronze', minLevel: 3 },
  { id: 'leg_s1', name: 'Grevas de Ferro', description: 'Ajustadas para corrida de combate. +4 VEL', cost: 1500, type: 'legs', value: 4, icon: '👢', rarity: 'silver', minLevel: 4 },
  { id: 'leg_s2', name: 'Botas de Sentinela', description: 'Passo sólido e resposta rápida. +5 VEL', cost: 1950, type: 'legs', value: 5, icon: '🥾', rarity: 'silver', minLevel: 5 },
  { id: 'leg_s3', name: 'Grevas de Patrulha', description: 'Mobilidade avançada para lutas longas. +6 VEL', cost: 2450, type: 'legs', value: 6, icon: '🦿', rarity: 'silver', minLevel: 6 },
  { id: 'leg_g1', name: 'Grevas Dracônicas', description: 'Ligas raras para arrancadas explosivas. +7 VEL', cost: 4300, type: 'legs', value: 7, icon: '🐉', rarity: 'gold', minLevel: 9 },
  { id: 'leg_g2', name: 'Botas do Guardião Solar', description: 'Impulso lendário com passada firme. +8 VEL', cost: 5600, type: 'legs', value: 8, icon: '☀️', rarity: 'gold', minLevel: 10 },
  { id: 'leg_g3', name: 'Passos do Colosso', description: 'Conjunto de elite para mobilidade máxima. +9 VEL', cost: 7200, type: 'legs', value: 9, icon: '🏛️', rarity: 'gold', minLevel: 12 },
  
  // --- SHIELDS ---
  { id: 'shd_b1', name: 'Tábua de Madeira', description: 'Melhor que nada. +3 DEF', cost: 140, type: 'shield', value: 3, icon: '🪵', rarity: 'bronze', minLevel: 1 },
  { id: 'shd_b2', name: 'Broquel de Bronze', description: 'Escudo curto para defesas rápidas. +4 DEF', cost: 170, type: 'shield', value: 4, icon: '🛡️', rarity: 'bronze', minLevel: 2 },
  { id: 'shd_b3', name: 'Escudo de Caravana', description: 'Modelo robusto usado em viagens longas. +5 DEF', cost: 240, type: 'shield', value: 5, icon: '🧱', rarity: 'bronze', minLevel: 3 },
  { id: 'shd_s1', name: 'Escudo Torre', description: 'Uma parede móvel. +10 DEF', cost: 1200, type: 'shield', value: 10, icon: '🚪', rarity: 'silver', minLevel: 5 },
  { id: 'shd_s2', name: 'Escudo Bastião', description: 'Largo e estável contra ataques diretos. +12 DEF', cost: 1400, type: 'shield', value: 12, icon: '🧲', rarity: 'silver', minLevel: 6 },
  { id: 'shd_s3', name: 'Escudo de Guerra', description: 'Estrutura reforçada para duelos brutais. +14 DEF', cost: 1650, type: 'shield', value: 14, icon: '⚔️', rarity: 'silver', minLevel: 7 },
  { id: 'shd_g1', name: 'Égide Sagrada', description: 'Reflete o mal. +25 DEF', cost: 3600, type: 'shield', value: 25, icon: '☀️', rarity: 'gold', minLevel: 9 },
  { id: 'shd_g2', name: 'Égide do Crepúsculo', description: 'Barreira mística para segurar explosões de dano. +28 DEF', cost: 4200, type: 'shield', value: 28, icon: '🌒', rarity: 'gold', minLevel: 10 },
  { id: 'shd_g3', name: 'Escudo do Trono', description: 'Defesa suprema usada por campeões veteranos. +31 DEF', cost: 5000, type: 'shield', value: 31, icon: '👑', rarity: 'gold', minLevel: 12 },
];

const EQUIPMENT_TYPES = new Set<Item['type']>(['armor', 'helmet', 'legs', 'shield']);
const EQUIPMENT_COST_MULTIPLIER_BY_RARITY: Record<Item['rarity'], number> = {
  bronze: 1.6,
  silver: 1.35,
  gold: 1.22,
};
const roundShopCost = (value: number) => Math.ceil(value / 10) * 10;
const rebalanceShopEquipmentPrice = (item: Item): Item => {
  if (!EQUIPMENT_TYPES.has(item.type)) {
    return item;
  }

  const multiplier = EQUIPMENT_COST_MULTIPLIER_BY_RARITY[item.rarity] ?? 1;
  const rebalancedCost = roundShopCost(item.cost * multiplier);
  return {
    ...item,
    cost: rebalancedCost,
  };
};

export const SHOP_ITEMS: Item[] = BASE_SHOP_ITEMS.map(rebalanceShopEquipmentPrice);

export const MATERIALS: Item[] = [
  { id: 'mat_wood', name: 'Madeira', description: 'Um pedaço de madeira comum.', cost: 10, type: 'material', value: 0, icon: '🪵', rarity: 'bronze', minLevel: 1 },
  { id: 'mat_bone', name: 'Osso', description: 'Um osso velho e ressecado.', cost: 15, type: 'material', value: 0, icon: '🦴', rarity: 'bronze', minLevel: 1 },
  { id: 'mat_slime', name: 'Gosma', description: 'Uma substância pegajosa e nojenta.', cost: 12, type: 'material', value: 0, icon: '💧', rarity: 'bronze', minLevel: 1 },
  { id: 'mat_cloth', name: 'Retalho de Pano', description: 'Um pedaço de tecido rasgado.', cost: 8, type: 'material', value: 0, icon: '🧻', rarity: 'bronze', minLevel: 1 },
  { id: 'mat_iron', name: 'Fragmento de Ferro', description: 'Um pedaço de metal enferrujado.', cost: 25, type: 'material', value: 0, icon: '🔩', rarity: 'silver', minLevel: 3 },
  { id: 'mat_gold', name: 'Pepita de Ouro', description: 'Pequena, mas valiosa.', cost: 100, type: 'material', value: 0, icon: '🪙', rarity: 'gold', minLevel: 5 },
];

export const DUNGEON_ITEMS: Item[] = [
  { id: 'mat_dg_coal', name: 'Carvão Impuro', description: 'Carvão poroso retirado das camadas rasas da dungeon.', cost: 18, type: 'material', value: 0, icon: '🪨', rarity: 'bronze', minLevel: 1, source: 'dungeon' },
  { id: 'mat_dg_copper_ore', name: 'Minério de Cobre', description: 'Veio metálico comum, útil para ligas iniciais.', cost: 22, type: 'material', value: 0, icon: '🟤', rarity: 'bronze', minLevel: 1, source: 'dungeon' },
  { id: 'mat_dg_limestone', name: 'Calcário Fraturado', description: 'Pedra sedimentar que se desfaz com pressão.', cost: 20, type: 'material', value: 0, icon: '🪨', rarity: 'bronze', minLevel: 1, source: 'dungeon' },
  { id: 'mat_dg_moss_fiber', name: 'Fibra de Musgo Abissal', description: 'Trama orgânica úmida que cresce entre ruínas.', cost: 24, type: 'material', value: 0, icon: '🌿', rarity: 'bronze', minLevel: 1, source: 'dungeon' },
  { id: 'mat_dg_fossil_bone', name: 'Osso Fossilizado', description: 'Fragmento endurecido de criatura antiga.', cost: 26, type: 'material', value: 0, icon: '🦴', rarity: 'bronze', minLevel: 1, source: 'dungeon' },
  { id: 'mat_dg_cracked_shell', name: 'Carapaça Quebrada', description: 'Casco mineralizado de monstro subterrâneo.', cost: 28, type: 'material', value: 0, icon: '🛡️', rarity: 'bronze', minLevel: 1, source: 'dungeon' },
  { id: 'mat_dg_salt_crystal', name: 'Cristal de Sal Sombrio', description: 'Cristal opaco formado em salões fechados.', cost: 30, type: 'material', value: 0, icon: '🧂', rarity: 'bronze', minLevel: 1, source: 'dungeon' },
  { id: 'mat_dg_rusty_chain', name: 'Elo Enferrujado', description: 'Restos de correntes antigas corroídas.', cost: 19, type: 'material', value: 0, icon: '⛓️', rarity: 'bronze', minLevel: 1, source: 'dungeon' },
  { id: 'mat_dg_dark_clay', name: 'Argila Escura', description: 'Argila densa com alta concentração mineral.', cost: 21, type: 'material', value: 0, icon: '🟫', rarity: 'bronze', minLevel: 1, source: 'dungeon' },
  { id: 'mat_dg_sulfur_powder', name: 'Pó de Enxofre', description: 'Resíduo inflamável coletado de fendas quentes.', cost: 23, type: 'material', value: 0, icon: '🟡', rarity: 'bronze', minLevel: 1, source: 'dungeon' },
  { id: 'mat_dg_silver_ore', name: 'Minério de Prata', description: 'Metal brilhante e estável para peças refinadas.', cost: 72, type: 'material', value: 0, icon: '⚪', rarity: 'silver', minLevel: 5, source: 'dungeon' },
  { id: 'mat_dg_moonstone', name: 'Pedra Lunar', description: 'Gema fria que pulsa com brilho azulado.', cost: 84, type: 'material', value: 0, icon: '🌙', rarity: 'silver', minLevel: 5, source: 'dungeon' },
  { id: 'mat_dg_amber_resin', name: 'Resina Âmbar', description: 'Seiva cristalizada de raízes antigas.', cost: 78, type: 'material', value: 0, icon: '🟠', rarity: 'silver', minLevel: 5, source: 'dungeon' },
  { id: 'mat_dg_shadow_ink', name: 'Tinta Sombria', description: 'Pigmento arcano usado em inscrições ocultas.', cost: 90, type: 'material', value: 0, icon: '🖤', rarity: 'silver', minLevel: 5, source: 'dungeon' },
  { id: 'mat_dg_arcane_dust', name: 'Pó Arcano', description: 'Partículas místicas deixadas por rituais antigos.', cost: 96, type: 'material', value: 0, icon: '✨', rarity: 'silver', minLevel: 5, source: 'dungeon' },
  { id: 'mat_dg_steel_nodule', name: 'Nódulo de Aço', description: 'Concreção metálica de altíssima dureza.', cost: 88, type: 'material', value: 0, icon: '🔩', rarity: 'silver', minLevel: 5, source: 'dungeon' },
  { id: 'mat_dg_cobalt_shard', name: 'Fragmento de Cobalto', description: 'Minério azul escuro encontrado em veios profundos.', cost: 94, type: 'material', value: 0, icon: '🔷', rarity: 'silver', minLevel: 5, source: 'dungeon' },
  { id: 'mat_dg_onyx_chip', name: 'Lasca de Ônix', description: 'Pedra negra compacta de corte preciso.', cost: 102, type: 'material', value: 0, icon: '🪨', rarity: 'silver', minLevel: 5, source: 'dungeon' },
  { id: 'mat_dg_ghost_essence', name: 'Essência Espectral', description: 'Névoa condensada em frasco lacrado.', cost: 110, type: 'material', value: 0, icon: '👻', rarity: 'silver', minLevel: 5, source: 'dungeon' },
  { id: 'mat_dg_lumen_pearl', name: 'Pérola de Lúmen', description: 'Nódulo luminescente cultivado em água parada.', cost: 118, type: 'material', value: 0, icon: '💠', rarity: 'silver', minLevel: 5, source: 'dungeon' },
  { id: 'mat_dg_emerald_cluster', name: 'Cacho de Esmeralda', description: 'Cristais verdes de alto valor alquímico.', cost: 240, type: 'material', value: 0, icon: '💚', rarity: 'gold', minLevel: 10, source: 'dungeon' },
  { id: 'mat_dg_ruby_prism', name: 'Prisma Rubi', description: 'Cristal rubro com núcleo incandescente.', cost: 260, type: 'material', value: 0, icon: '❤️', rarity: 'gold', minLevel: 10, source: 'dungeon' },
  { id: 'mat_dg_sapphire_core', name: 'Núcleo de Safira', description: 'Gema azul pura forjada sob alta pressão.', cost: 280, type: 'material', value: 0, icon: '💙', rarity: 'gold', minLevel: 10, source: 'dungeon' },
  { id: 'mat_dg_void_opal', name: 'Opala do Vazio', description: 'Pedra iridescente que distorce a luz ao redor.', cost: 320, type: 'material', value: 0, icon: '🌌', rarity: 'gold', minLevel: 10, source: 'dungeon' },
  { id: 'mat_dg_dragonite_heart', name: 'Coração de Dragonita', description: 'Núcleo mineral quase indestrutível.', cost: 360, type: 'material', value: 0, icon: '🐉', rarity: 'gold', minLevel: 10, source: 'dungeon' },
  { id: 'mat_dg_star_diamond', name: 'Diamante Estelar', description: 'Cristal lendário que brilha como constelação.', cost: 420, type: 'material', value: 0, icon: '💎', rarity: 'gold', minLevel: 10, source: 'dungeon' },
  { id: 'mat_ether_shard', name: 'Fragmento de Ether', description: 'Cristal instável recolhido das galerias da dungeon.', cost: 55, type: 'material', value: 0, icon: '🧿', rarity: 'silver', minLevel: 4, source: 'dungeon' },
  { id: 'mat_obsidian_heart', name: 'Coração de Obsidiana', description: 'Núcleo denso e quente arrancado de bestas abissais.', cost: 120, type: 'material', value: 0, icon: '🪨', rarity: 'gold', minLevel: 7, source: 'dungeon' },
  { id: 'mat_void_bloom', name: 'Flor do Vazio', description: 'Matéria viva que pulsa com energia da dungeon profunda.', cost: 180, type: 'material', value: 0, icon: '🌌', rarity: 'gold', minLevel: 9, source: 'dungeon' },
  { id: 'mat_nexus_core', name: 'Núcleo do Nexus', description: 'Relíquia absoluta deixada apenas pelo soberano da dungeon.', cost: 320, type: 'material', value: 0, icon: '💠', rarity: 'gold', minLevel: 12, source: 'dungeon' },
  { id: 'pot_dg_recall', name: 'Âncora de Retorno', description: 'Abre uma saída estável da dungeon e permite levar todo o espólio acumulado.', cost: 0, type: 'potion', value: 0, icon: '🧭', rarity: 'gold', minLevel: 1, source: 'dungeon' },
  { id: 'pot_alc_phantom_veil', name: 'Véu Fantasma', description: 'Reveste o corpo com névoa alquímica e garante evasão perfeita por 4 turnos em qualquer batalha.', cost: 0, type: 'potion', value: 1, icon: '👻', rarity: 'gold', minLevel: 1, source: 'alchemist', duration: 4 },
  { id: 'pot_alc_twin_fang', name: 'Presa Gêmea', description: 'Desperta um ritmo feroz e faz o comando Atacar acertar duas vezes por 6 turnos.', cost: 0, type: 'potion', value: 1, icon: '🦷', rarity: 'gold', minLevel: 1, source: 'alchemist', duration: 6 },
  { id: 'pot_dg_mana', name: 'Reserva de Mana Abissal', description: 'Energia condensada da dungeon. +80 MP', cost: 0, type: 'potion', value: 80, icon: '🔷', rarity: 'silver', minLevel: 6, source: 'dungeon', animacaoExecucao: SPRITE_ANIMATION_IDS.execAuraMana1 },
  { id: 'pot_dg_elixir', name: 'Elixir Abissal', description: 'Restauração reforçada da dungeon. +260 HP', cost: 0, type: 'potion', value: 260, icon: '🩸', rarity: 'gold', minLevel: 8, source: 'dungeon', animacaoExecucao: SPRITE_ANIMATION_IDS.execAuraVida2 },
  { id: 'pot_dg_ambrosia', name: 'Ambrosia do Nexus', description: 'Essência rara guardada no fundo da dungeon. +650 HP', cost: 0, type: 'potion', value: 650, icon: '🫧', rarity: 'gold', minLevel: 15, source: 'dungeon', animacaoExecucao: SPRITE_ANIMATION_IDS.execAuraVida2 },
  { id: 'wep_dg_nexus', name: 'Lâmina do Nexus', description: 'Arma exclusiva forjada com energia da dungeon. +58 ATK', cost: 0, type: 'weapon', value: 58, icon: '🗡️', rarity: 'gold', minLevel: 10, source: 'dungeon' },
  { id: 'arm_dg_abyss', name: 'Armadura do Abismo', description: 'Placas pesadas feitas para sobreviver aos ciclos profundos. +38 DEF e +54 MP', cost: 0, type: 'armor', value: 38, mpBonus: 54, icon: '🥋', rarity: 'gold', minLevel: 10, source: 'dungeon' },
  { id: 'shd_dg_eclipse', name: 'Escudo Eclipse', description: 'Barreira exclusiva da dungeon que segura impactos do chefão. +32 DEF', cost: 0, type: 'shield', value: 32, icon: '🌘', rarity: 'gold', minLevel: 11, source: 'dungeon' },
  { id: 'hlm_dg_oracle', name: 'Elmo do Oráculo Fendido', description: 'Capacete ritualístico encontrado apenas em profundezas evoluídas. +24 DEF e +82 HP', cost: 0, type: 'helmet', value: 24, hpBonus: 82, icon: '🔮', rarity: 'gold', minLevel: 10, source: 'dungeon' },
];

const NON_WEAPON_SHOP_ITEMS: Item[] = SHOP_ITEMS.filter((item) => item.type !== 'weapon');
const NON_WEAPON_DUNGEON_ITEMS: Item[] = DUNGEON_ITEMS.filter((item) => item.type !== 'weapon');

export const ALL_ITEMS: Item[] = [...NON_WEAPON_SHOP_ITEMS, ...REGISTERED_WEAPON_ITEMS, ...MATERIALS, ...NON_WEAPON_DUNGEON_ITEMS];

export const DUNGEON_ESCAPE_ITEM = DUNGEON_ITEMS.find(item => item.id === 'pot_dg_recall') as Item;

export const ALCHEMIST_ITEM_OFFERS: AlchemistItemOffer[] = [
  {
    id: 'alchemist_item_recall_anchor',
    cost: 3,
    tagline: 'Relíquia rara para abandonar a dungeon sem perder o espólio acumulado.',
    item: DUNGEON_ESCAPE_ITEM,
  },
  {
    id: 'alchemist_item_phantom_veil',
    cost: 2,
    tagline: 'Uma relíquia instável que torna o herói intocável por 4 turnos em qualquer batalha.',
    item: DUNGEON_ITEMS.find(item => item.id === 'pot_alc_phantom_veil') as Item,
  },
  {
    id: 'alchemist_item_twin_fang',
    cost: 2,
    tagline: 'Relíquia ofensiva que transforma seus ataques básicos em dois golpes por 6 turnos.',
    item: DUNGEON_ITEMS.find(item => item.id === 'pot_alc_twin_fang') as Item,
  },
];

const BASE_SKILLS: Skill[] = [
  { id: 'skl_1', name: 'Corte Voxel', cost: 0, damageMult: 1.5, minLevel: 1, description: 'Golpe físico preciso. 8 MP', manaCost: 8, type: 'physical' },
  {
    id: 'skl_2',
    name: 'Luz Sagrada',
    cost: 0,
    damageMult: 0.4,
    minLevel: 1,
    description: 'Cura 40% da vida maxima. 15 MP',
    manaCost: 15,
    type: 'heal',
    tipoAnimacao: 'cura_status',
    animacaoExecucao: SPRITE_ANIMATION_IDS.execFlash,
    animacaoExecucaoCor: '#fff476',
    animacaoImpacto: SPRITE_ANIMATION_IDS.execAuraVida1,
    animacaoImpactoAlvo: 'self',
  },
  {
    id: 'skl_3',
    name: 'Bola de Fogo',
    cost: 0,
    damageMult: 2.2,
    minLevel: 3,
    description: 'Projétil arcano em chamas. 20 MP',
    manaCost: 20,
    type: 'magic',
    tipoAnimacao: 'magia',
    animacaoExecucao: SPRITE_ANIMATION_IDS.execFlash,
    animacaoExecucaoCor: '#ff8f45',
    animacaoImpacto: SPRITE_ANIMATION_IDS.execFire,
    animacaoImpactoAlvo: 'target',
  },
  { id: 'skl_4', name: 'Lâmina do Dragão', cost: 0, damageMult: 3.5, minLevel: 8, description: 'Investida lendária devastadora. 45 MP', manaCost: 45, type: 'physical' },
  { id: 'skl_5', name: 'Tempestade Arcana', cost: 0, damageMult: 2.8, minLevel: 4, description: 'Explosão violeta que estilhaça o alvo. 24 MP', manaCost: 24, type: 'magic' },
  { id: 'skl_6', name: 'Quebraterra', cost: 0, damageMult: 2.9, minLevel: 5, description: 'Golpe bruto que faz a arena tremer. 26 MP', manaCost: 26, type: 'physical' },
  { id: 'skl_7', name: 'Nova Glacial', cost: 0, damageMult: 2.6, minLevel: 6, description: 'Rajada gelida de impacto concentrado. 28 MP', manaCost: 28, type: 'magic' },
  { id: 'skl_8', name: 'Cura Astral', cost: 0, damageMult: 0.65, minLevel: 6, description: 'Cura 65% da vida maxima. 30 MP', manaCost: 30, type: 'heal' },
  { id: 'skl_9', name: 'Lança Sombria', cost: 0, damageMult: 3.2, minLevel: 7, description: 'Perfuração sombria com rastro espectral. 34 MP', manaCost: 34, type: 'physical' },
  { id: 'skl_10', name: 'Julgamento Solar', cost: 0, damageMult: 4.1, minLevel: 9, description: 'Coluna sagrada de luz esmagadora. 52 MP', manaCost: 52, type: 'magic' },
  { id: 'skl_11', name: 'Muralha Instintiva', cost: 0, damageMult: 0, minLevel: 10, description: 'Ativa defesa automatica por 3 turnos. 15 MP', manaCost: 15, type: 'heal', source: 'card' },
];

export const SKILLS: Skill[] = [...BASE_SKILLS, ...CONSTELLATION_SKILLS];

const skeletonAnimationFiles = [
  'Rig_Medium_CombatMelee.fbx',
  'Rig_Medium_CombatRanged.fbx',
  'Rig_Medium_General.fbx',
  'Rig_Medium_MovementAdvanced.fbx',
  'Rig_Medium_MovementBasic.fbx',
  'Rig_Medium_Simulation.fbx',
  'Rig_Medium_Special.fbx',
  'Rig_Medium_Tools.fbx',
] as const;

const skeletonAnimationMap = {
  idle: 'Rig_Medium_General:Idle_A',
  battleIdle: 'Rig_Medium_CombatMelee:Melee_Unarmed_Idle',
  attackWeapon: 'Rig_Medium_CombatMelee:Melee_1H_Attack_Jump_Chop',
  attackUnarmed: 'Rig_Medium_CombatMelee:Melee_Unarmed_Attack_Punch_A',
  defend: 'Rig_Medium_CombatMelee:Melee_Blocking',
  defendHit: 'Rig_Medium_CombatMelee:Melee_Block_Hit',
  hit: 'Rig_Medium_General:Hit_A',
  criticalHit: 'Rig_Medium_General:Hit_B',
  item: 'Rig_Medium_General:Use_Item',
  heal: 'Rig_Medium_CombatRanged:Ranged_Magic_Raise',
  skill: 'Rig_Medium_CombatRanged:Ranged_Magic_Raise',
  evadeLeft: 'Rig_Medium_MovementAdvanced:Dodge_Left',
  evadeRight: 'Rig_Medium_MovementAdvanced:Dodge_Right',
  death: 'Rig_Medium_General:Death_A',
} as const;

const createSkeletonAssets = (modelFile: 'Skeleton_Minion.fbx' | 'Skeleton_Rogue.fbx' | 'Skeleton_Warrior.fbx' | 'Skeleton_Mage.fbx', scale: number) => ({
  modelPath: `game/assets/Characters/Monsters/Skeleton/${modelFile}`,
  modelUrl: new URL(`./game/assets/Characters/Monsters/Skeleton/${modelFile}`, import.meta.url).href,
  texturePath: 'game/assets/Characters/Monsters/Skeleton/skeleton_texture.png',
  textureUrl: new URL('./game/assets/Characters/Monsters/Skeleton/skeleton_texture.png', import.meta.url).href,
  animationDirectory: 'game/assets/Characters/Animations/Rig_Medium',
  animationFiles: [...skeletonAnimationFiles],
  animationUrls: [
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_CombatMelee.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_CombatRanged.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_General.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_MovementAdvanced.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_MovementBasic.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_Simulation.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_Special.fbx', import.meta.url).href,
    new URL('./game/assets/Characters/Animations/Rig_Medium/Rig_Medium_Tools.fbx', import.meta.url).href,
  ],
  animationMap: skeletonAnimationMap,
  implementationStatus: 'fbx' as const,
  calibration: {
    scale,
    positionOffset: [0, 0, 0] as [number, number, number],
    rotationOffset: [0, Math.PI, 0] as [number, number, number],
  },
});

export const ENEMY_DATA: EnemyTemplate[] = [
  {
    name: 'Skeleton Minion',
    type: 'undead',
    enemyClassId: 'ranger',
    baseStats: { hp: 98, maxHp: 98, mp: 24, maxMp: 24, atk: 8, magic: 8, def: 4, speed: 4, luck: 2 },
    color: '#d6d3d1',
    scale: 1.02,
    assets: createSkeletonAssets('Skeleton_Minion.fbx', 2.02),
    attackStyle: 'unarmed',
  },
  {
    name: 'Skeleton Rogue',
    type: 'undead',
    enemyClassId: 'rogue',
    baseStats: { hp: 98, maxHp: 98, mp: 24, maxMp: 24, atk: 10, magic: 8, def: 4, speed: 6, luck: 4 },
    color: '#cbd5e1',
    scale: 1.04,
    assets: createSkeletonAssets('Skeleton_Rogue.fbx', 2.06),
    attackStyle: 'unarmed',
  },
  {
    name: 'Skeleton Warrior',
    type: 'undead',
    enemyClassId: 'knight',
    baseStats: { hp: 120, maxHp: 120, mp: 18, maxMp: 18, atk: 14, magic: 6, def: 8, speed: 2, luck: 2 },
    color: '#e2e8f0',
    scale: 1.08,
    assets: createSkeletonAssets('Skeleton_Warrior.fbx', 2.14),
    attackStyle: 'unarmed',
  },
  {
    name: 'Skeleton Mage',
    type: 'undead',
    enemyClassId: 'mage',
    baseStats: { hp: 78, maxHp: 78, mp: 40, maxMp: 40, atk: 6, magic: 14, def: 4, speed: 4, luck: 2 },
    color: '#c4b5fd',
    scale: 1.06,
    assets: createSkeletonAssets('Skeleton_Mage.fbx', 2.1),
    attackStyle: 'unarmed',
  },
];

export const DUNGEON_ENEMY_DATA: DungeonEnemyTemplate[] = [
  { name: 'Bone Minion', type: 'undead', enemyClassId: 'ranger', minEvolution: 0, scale: 1.02, assets: createSkeletonAssets('Skeleton_Minion.fbx', 2.02), attackStyle: 'unarmed', hpMultiplier: 0.96, atkMultiplier: 1.05, rareDrops: [{ itemId: 'pot_dg_mana', chance: 0.08 }] },
  { name: 'Bone Rogue', type: 'undead', enemyClassId: 'rogue', minEvolution: 0, scale: 1.04, assets: createSkeletonAssets('Skeleton_Rogue.fbx', 2.06), attackStyle: 'unarmed', hpMultiplier: 1.02, atkMultiplier: 1.14, speedBonus: 1 },
  { name: 'Bone Warrior', type: 'undead', enemyClassId: 'knight', minEvolution: 1, scale: 1.08, assets: createSkeletonAssets('Skeleton_Warrior.fbx', 2.14), attackStyle: 'unarmed', hpMultiplier: 1.14, defMultiplier: 1.16 },
  { name: 'Bone Mage', type: 'undead', enemyClassId: 'mage', minEvolution: 1, scale: 1.06, assets: createSkeletonAssets('Skeleton_Mage.fbx', 2.1), attackStyle: 'unarmed', atkMultiplier: 1.22, speedBonus: 2, rareDrops: [{ itemId: 'mat_dg_silver_ore', chance: 0.14 }] },
  { name: 'Crypt Warrior', type: 'undead', enemyClassId: 'barbarian', minEvolution: 2, scale: 1.14, assets: createSkeletonAssets('Skeleton_Warrior.fbx', 2.2), attackStyle: 'unarmed', hpMultiplier: 1.2, atkMultiplier: 1.16, rareDrops: [{ itemId: 'pot_dg_elixir', chance: 0.12 }] },
  { name: 'Crypt Rogue', type: 'undead', enemyClassId: 'rogue', minEvolution: 3, scale: 1.06, assets: createSkeletonAssets('Skeleton_Rogue.fbx', 2.08), attackStyle: 'unarmed', atkMultiplier: 1.24, speedBonus: 2, rareDrops: [{ itemId: 'wep_3d_sword_d', chance: 0.08 }] },
  { name: 'Crypt Mage', type: 'undead', enemyClassId: 'mage', minEvolution: 4, scale: 1.08, assets: createSkeletonAssets('Skeleton_Mage.fbx', 2.14), attackStyle: 'unarmed', hpMultiplier: 1.08, atkMultiplier: 1.28, speedBonus: 3, rareDrops: [{ itemId: 'shd_dg_eclipse', chance: 0.08 }] },
  { name: 'Bone Champion', type: 'undead', enemyClassId: 'knight', minEvolution: 5, scale: 1.18, assets: createSkeletonAssets('Skeleton_Warrior.fbx', 2.26), attackStyle: 'unarmed', hpMultiplier: 1.26, defMultiplier: 1.2, rareDrops: [{ itemId: 'arm_dg_abyss', chance: 0.1 }, { itemId: 'mat_dg_onyx_chip', chance: 0.2 }] },
  { name: 'Catacomb Archmage', type: 'undead', enemyClassId: 'mage', minEvolution: 6, scale: 1.12, assets: createSkeletonAssets('Skeleton_Mage.fbx', 2.18), attackStyle: 'unarmed', hpMultiplier: 1.18, atkMultiplier: 1.32, speedBonus: 4, rareDrops: [{ itemId: 'pot_dg_ambrosia', chance: 0.14 }] },
];

export const DUNGEON_BOSS: DungeonBossTemplate = {
  name: 'Skeleton Overlord',
  type: 'undead' as const,
  enemyClassId: 'knight',
  color: '#67e8f9',
  scale: 1.26,
  assets: createSkeletonAssets('Skeleton_Warrior.fbx', 2.42),
  attackStyle: 'unarmed',
  hpMultiplier: 1.4,
  atkMultiplier: 1.24,
  defMultiplier: 1.2,
  speedBonus: 4,
  guaranteedDrops: ['mat_dg_void_opal'],
  rareDrops: [
    { itemId: 'pot_dg_recall', chance: 0.22 },
    { itemId: 'pot_dg_ambrosia', chance: 0.4 },
    { itemId: 'wep_3d_sword_e', chance: 0.24 },
    { itemId: 'arm_dg_abyss', chance: 0.24 },
    { itemId: 'shd_dg_eclipse', chance: 0.24 },
    { itemId: 'hlm_dg_oracle', chance: 0.24 },
  ],
};

export const ENEMY_COLORS = [
  "#4ade80", // green
  "#84cc16", // lime
  "#e2e8f0", // bone
  "#475569", // dark grey
  "#15803d", // dark green
  "#78716c", // stone
  "#0f172a", // black
  "#9333ea", // purple
  "#dc2626", // red
  "#f59e0b", // amber
];

