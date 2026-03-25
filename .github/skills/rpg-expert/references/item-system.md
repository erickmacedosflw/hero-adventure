# Sistema de Itens — Lendas do Abismo

## Arquivos Principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `constants.ts` | `SHOP_ITEMS`, `MATERIALS`, `ALL_ITEMS`, `INITIAL_PLAYER` |
| `types.ts` | Interfaces `Item`, `Player`, `Skill`, `EquippedItems` |
| `components/Scene3D.tsx` | Modelos 3D: `WeaponModel`, `ShieldModel`, `PotionModel`, `MaterialModel`, `HelmetModel`, `ArmorModel`, `LegsModel`, `ItemPreviewCanvas` |
| `components/GameUI.tsx` | `KillLootOverlay`, `ItemTypeIcon`, exibição no inventário/loja |

## Tipo `Item` (types.ts)

```ts
interface Item {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: 'weapon' | 'armor' | 'helmet' | 'legs' | 'shield' | 'potion' | 'material';
  value: number;           // ATK/DEF/HP conforme tipo
  icon: string;            // emoji fallback
  rarity: 'bronze' | 'silver' | 'gold';
  minLevel: number;
  duration?: number;       // turnos para poções de buff
}
```

## Inventário do Jogador

```ts
inventory: Record<string, number>  // itemId → quantidade
equippedWeapon: string | null
equippedArmor: string | null
equippedHelmet: string | null
equippedLegs: string | null
equippedShield: string | null
```

## Slots de Equipamento e Stat Aplicado

| Tipo | Slot | Stat | Soma/Substitui |
|------|------|------|----------------|
| weapon | equippedWeapon | atk | substitui (maior) |
| armor | equippedArmor | def | soma |
| helmet | equippedHelmet | def | soma |
| legs | equippedLegs | def | soma |
| shield | equippedShield | def | soma |

## Todos os IDs Existentes

### Armas
`wep_b1` Adaga de Cobre (+6 ATK, Lvl1) · `wep_b2` Machadinha Velha (+10, Lvl2)
`wep_s1` Espada de Aço (+18, Lvl4) · `wep_s2` Lança de Mithril (+25, Lvl6)
`wep_g1` Katana do Vazio (+45, Lvl8) · `wep_g2` Excalibur Pixel (+70, Lvl12)

### Armaduras
`arm_b1` Túnica de Couro (+4 DEF, Lvl1) · `arm_s1` Cota de Malha (+12, Lvl4) · `arm_g1` Peitoral Rúnico (+30, Lvl9)

### Capacetes
`hlm_b1` Capuz de Viajante (+2 DEF, Lvl1) · `hlm_s1` Elmo de Gladiador (+8, Lvl5) · `hlm_g1` Coroa do Rei Lich (+20, Lvl10)

### Pernas
`leg_b1` Botas de Pano (+1 DEF, Lvl1) · `leg_s1` Grevas de Ferro (+6 DEF, Lvl4)

### Escudos
`shd_b1` Tábua de Madeira (+3 DEF, Lvl1) · `shd_s1` Escudo Torre (+10, Lvl5) · `shd_g1` Égide Sagrada (+25, Lvl9)

### Poções
`pot_1` Menor (+50 HP, 30g) · `pot_2` Mana (+30 MP, 40g)
`pot_atk` Fúria (+50% ATK/3t, 120g) · `pot_def` Tônico Ferro (+50% DEF/3t, 120g)
`pot_3` Elixir Prateado (+150 HP, 150g) · `pot_4` Ambrosia Dourada (+500 HP, 600g)

### Materiais de Drop
`mat_wood` Madeira (10g) · `mat_bone` Osso (15g) · `mat_slime` Gosma (12g)
`mat_cloth` Retalho de Pano (8g) · `mat_iron` Fragmento de Ferro (25g) · `mat_gold` Pepita de Ouro (100g)

## Adicionar Novo Item — Template Rápido

```ts
// Em constants.ts, dentro de SHOP_ITEMS:
{ id: 'wep_s3', name: 'Martelo de Guerra', description: 'Esmaga crânios. +22 ATK',
  cost: 900, type: 'weapon', value: 22, icon: '🔨', rarity: 'silver', minLevel: 5 },
```

Depois adicionar case no `WeaponModel` em `Scene3D.tsx`:
```tsx
if (type === 'wep_s3') {
  return (
    <group>
      <VoxelPart position={[0, -0.2, 0]} size={[0.08, 0.7, 0.08]} color="#4a2c0a" material="leather" />
      <VoxelPart position={[0,  0.22, 0]} size={[0.36, 0.28, 0.20]} color="#6b7280" material="metal" />
      {/* ... mais detalhes ... */}
    </group>
  );
}
```
