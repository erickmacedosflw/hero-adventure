import { Player } from '../../types';
import { createClassBaseStats, DEFAULT_PLAYER_CLASS_ID } from './classes';

export const INITIAL_PLAYER: Player = {
  name: 'Heroi',
  classId: DEFAULT_PLAYER_CLASS_ID,
  level: 1,
  xp: 0,
  xpToNext: 100,
  gold: 150,
  diamonds: 0,
  stats: createClassBaseStats(DEFAULT_PLAYER_CLASS_ID),
  inventory: {
    pot_1: 2,
  },
  equippedWeapon: null,
  equippedArmor: null,
  equippedHelmet: null,
  equippedLegs: null,
  equippedShield: null,
  skills: [],
  chosenCards: [],
  cardBonuses: {
    goldGainMultiplier: 0,
    xpGainMultiplier: 0,
    bossDamageMultiplier: 0,
    healingMultiplier: 0,
    openingAtkBuff: 0,
    openingDefBuff: 0,
    defendManaRestore: 0,
    hpRegenPerTurn: 0,
    mpRegenPerTurn: 0,
  },
  isDefending: false,
  limitMeter: 0,
  buffs: {
    atkMod: 0,
    defMod: 0,
    atkTurns: 0,
    defTurns: 0,
    perfectEvadeTurns: 0,
    doubleAttackTurns: 0,
  },
};
