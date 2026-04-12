const BATTLE_OPENING_TEMPLATES = [
  'Um {enemyName} de nivel {level} avanca em sua direcao.',
  'As sombras se movem e {enemyName} de nivel {level} surge no caminho.',
  '{enemyName} de nivel {level} entra no campo de batalha com hostilidade.',
  'O ar pesa quando {enemyName} de nivel {level} prepara o ataque.',
] as const;

const VICTORY_TEMPLATES = [
  'Voce derrotou {enemyName} e manteve o controle da batalha.',
  '{enemyName} caiu. Sua vantagem no combate foi decisiva.',
  'Com tecnica e forca, voce superou {enemyName}.',
  '{enemyName} foi vencido. O caminho adiante esta livre.',
] as const;

const toSeed = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const pickBySeed = <T>(items: readonly T[], seedSource: string): T => {
  if (items.length === 0) {
    throw new Error('Template list cannot be empty.');
  }

  const seed = toSeed(seedSource);
  const index = seed % items.length;
  return items[index];
};

const applyTemplate = (template: string, enemyName: string, level?: number) => (
  template
    .replaceAll('{enemyName}', enemyName)
    .replaceAll('{level}', String(level ?? 1))
);

export const generateBattleDescription = async (enemyName: string, level: number): Promise<string> => {
  const template = pickBySeed(BATTLE_OPENING_TEMPLATES, `${enemyName}:${level}`);
  return applyTemplate(template, enemyName, level);
};

export const generateVictorySpeech = async (enemyName: string): Promise<string> => {
  const template = pickBySeed(VICTORY_TEMPLATES, enemyName);
  return applyTemplate(template, enemyName);
};
