# Balanceamento de Combate — Lendas do Abismo

## Fórmula de Combate (turn-based)

```
dano_base    = atacante.atk - defensor.def * 0.5
dano_final   = dano_base * (rand(0.85, 1.15))
critico      = luck/100 de chance → dano * 1.5
```
Mínimo de 1 de dano por acerto.

## Curva de Stats do Jogador por Nível

| Nível | MaxHP | ATK base | DEF base | LUK |
|-------|-------|----------|----------|-----|
| 1     | 120   | 12       | 5        | 5   |
| 3     | 160   | 18       | 8        | 7   |
| 5     | 220   | 25       | 12       | 9   |
| 8     | 320   | 38       | 18       | 12  |
| 12    | 500   | 60       | 30       | 18  |

Cada level-up concede: +20 HP, +2 ATK, +1 DEF, +1 ponto de stat livre.

## Curva de Stats de Inimigos

**Regra geral**: inimigo de nível N deve ser derrotado em ~4 turnos pelo jogador do mesmo nível sem equipamento.

| Tier inimigo | HP       | ATK     | DEF    | XP drop | Ouro drop |
|-------------|----------|---------|--------|---------|-----------|
| Fraco (1-3) | 40–100   | 8–20    | 2–8    | 20–50   | 5–30      |
| Médio (4-6) | 100–250  | 18–40   | 8–18   | 50–120  | 30–80     |
| Forte (7-9) | 250–600  | 38–70   | 16–30  | 120–300 | 80–200    |
| Boss (10+)  | 600–2000 | 60–120  | 28–50  | 300–800 | 200–500   |

## Tipos de Inimigo e Resistências

| Tipo | Fraqueza | Resistência | Cor temática voxel |
|------|----------|-------------|-------------------|
| `beast` | fire/físico | nature | verde, marrom, cinza natural |
| `humanoid` | magic/poison | físico | tons de pele, roupa, metal |
| `undead` | holy/fire | dark/ice | roxo, preto, branco frio |
| `elemental` | oposto | próprio | emissive forte no elemento |
| `boss` | — | — | cores únicas + emissive |

## Inimigos Existentes (enemies.ts)

**Beast**: Slime Voxel · Lobo LowPoly · Javali Cubico · Urso de Blocos
**Humanoid**: Goblin Cubico · Orc Blocado · Cavaleiro 8-Bits · Bandido Voxel
**Undead**: Esqueleto Pixel · Lich Renderizado · Fantasma Glitch · Sombra Digital

## Adicionar Novo Inimigo — Template

```ts
// Em game/data/enemies.ts
{ name: 'Dragão Voxel', type: 'elemental' },
```

Para inimigos com stats customizados, revisar como `App.tsx` gera o inimigo na batalha (buscar `generateEnemy` ou `ENEMY_DATA`).

## Efeitos de Status Ativos

| ID | Efeito | Duração padrão |
|----|--------|---------------|
| `buff_atk` | +50% ATK | 3 turnos |
| `buff_def` | +50% DEF | 3 turnos |

Para adicionar novos (ex: veneno, paralisia, regen):
1. Adicionar tipo no union de `types.ts`
2. Adicionar lógica de aplicação/subtração em `App.tsx` na função `processTurnEffects`
3. Adicionar ícone/texto no `BattleHUD` em `GameUI.tsx`

## Economia de XP

```
xpToNext(nivel) = nivel * 100
```

Para rebalancear progressão, modificar `INITIAL_PLAYER.xpToNext` e o cálculo de level-up em `App.tsx`.

## Drop de Materiais por Tipo de Inimigo

| Inimigo | Drops comuns | Drop raro |
|---------|-------------|-----------|
| Slime | mat_slime | mat_cloth |
| Lobo/Javali/Urso | mat_bone, mat_cloth | mat_iron |
| Goblin/Bandido | mat_wood, mat_cloth | mat_iron |
| Orc/Cavaleiro | mat_iron | mat_gold |
| Esqueleto/Fantasma | mat_bone | mat_cloth |
| Lich/Sombra | mat_bone, mat_iron | mat_gold |
