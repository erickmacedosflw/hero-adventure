import { Player } from '../../types';

interface CalculateDamageInput {
  attackerAtk: number;
  defenderDef: number;
  multiplier?: number;
  luck?: number;
  isPlayerAttacking?: boolean;
  playerBuffs: Player['buffs'];
}

export const calculateDamage = ({
  attackerAtk,
  defenderDef,
  multiplier = 1,
  luck = 0,
  isPlayerAttacking = false,
  playerBuffs,
}: CalculateDamageInput) => {
  let finalAtk = attackerAtk;
  let finalDef = defenderDef;

  if (isPlayerAttacking) {
    if (playerBuffs.atkTurns > 0) {
      finalAtk *= 1 + playerBuffs.atkMod;
    }
  } else if (playerBuffs.defTurns > 0) {
    finalDef *= 1 + playerBuffs.defMod;
  }

  const base = Math.max(1, finalAtk - finalDef * 0.3);
  const variance = Math.random() * 0.2 + 0.9;
  const critChance = luck * 0.02;
  const isCrit = Math.random() < 0.05 + critChance;
  const critMult = isCrit ? 1.5 : 1;

  return {
    damage: Math.floor(base * multiplier * variance * critMult),
    isCrit,
  };
};
