---
name: rpg-expert
description: 'Especialista em mecânicas RPG e sistemas de itens para o projeto Lendas do Abismo. Use para: criar novos itens (armas, armaduras, poções, materiais, gemas); balancear stats de inimigos e jogador; projetar sistemas de loot/drop; definir progressão de níveis; criar mecânicas de combate por turno; adicionar efeitos de status (buff/debuff/veneno); projetar sistemas de crafting; definir raridades (bronze/silver/gold); criar novos tipos de inimigos; equilibrar economia de ouro/XP. Gera código TypeScript para constants.ts, enemies.ts, types.ts e combat logic. Aplica as convenções do projeto: VoxelPart 3D models, raridade por tier, ids padronizados.'
argument-hint: 'Descreva o item, inimigo ou mecânica que deseja criar ou modificar'
---

# RPG Expert — Lendas do Abismo

## Escopo
Este skill cobre design e implementação de sistemas RPG neste projeto React/Three.js voxel RPG. Consulte as referências abaixo para detalhes técnicos.

- [Sistema de Itens e Raridades](./references/item-system.md)
- [Balanceamento de Combate](./references/combat-balance.md)

---

## Quando Usar

| Trigger | Ação |
|---------|------|
| "crie um item", "adiciona arma/armadura/poção" | → Gera entrada em `constants.ts` + modelo 3D |
| "novo inimigo", "adiciona boss" | → Gera entrada em `enemies.ts` + lógica de combate |
| "balancear stats", "ajustar dano" | → Revisa curvas em `constants.ts` e combat engine |
| "sistema de crafting", "receita" | → Adiciona tipos/lógica usando `MATERIALS` existentes |
| "novo efeito de status", "buff/debuff" | → Estende `types.ts` + lógica de aplicação |
| "recompensa de drop", "loot table" | → Modifica `handleVictory` em `App.tsx` |
| "gems RPG", "gema de equipamento" | → Segue o padrão gem material com emissive glow |

---

## Procedimento Geral

### 1. Entender o Pedido
- Identificar: tipo (item/inimigo/mecânica/balanceamento)
- Verificar nível/raridade adequados para o tier
- Checar IDs existentes para não colidir (`wep_`, `arm_`, `hlm_`, `leg_`, `shd_`, `pot_`, `mat_`)

### 2. Aplicar Convenções do Projeto

**IDs de item** — prefixo por categoria:
```
wep_b1/s1/g1   arma    bronze/silver/gold
arm_b1/s1/g1   armadura
hlm_b1/s1/g1   capacete
leg_b1/s1      pernas
shd_b1/s1/g1   escudo
pot_1..4/atk/def  poção
mat_wood/bone/slime/cloth/iron/gold  material
gem_*          gema (futuro)
```

**Raridades e tiers de level**:
- `bronze` → minLevel 1–3, custo 30–300 ouro
- `silver` → minLevel 4–7, custo 350–1500 ouro
- `gold`   → minLevel 8–12, custo 2000–9000 ouro

**Curva de stats de arma** (ATK por nível recomendado):
```
Lvl 1: +5–8    Lvl 3: +10–16   Lvl 5: +18–26
Lvl 7: +28–40  Lvl 9: +42–60   Lvl 12: +65–80
```

**Curva de stats de armadura/escudo** (DEF):
```
bronze: 1–5    silver: 6–15    gold: 18–35
```

### 3. Criar o Item em `constants.ts`
```ts
{ id: 'wep_s3', name: 'Nome', description: 'Lore. +X ATK',
  cost: N, type: 'weapon', value: X, icon: '⚔️',
  rarity: 'silver', minLevel: 5 }
```

### 4. Criar Modelo 3D em `components/Scene3D.tsx`
- Localizar o componente correto (`WeaponModel`, `ArmorModel`, etc.)
- Adicionar `if (type === 'wep_s3') { return <group>...</group> }`
- Usar `VoxelPart` com `material` apropriado (ver tabela abaixo)
- Incluir 8–18 partes para itens silver/gold, 5–10 para bronze

**Materiais VoxelPart disponíveis**:
| `material=` | Uso ideal | Efeito visual |
|------------|-----------|---------------|
| `"metal"` | Aço, ferro, mithril | roughness 0.2, metalness 0.8 |
| `"gem"` | Gemas, cristais, magia | emissive glow automático |
| `"leather"` | Couro, madeira velha | roughness 0.6 |
| `"cloth"` | Tecido, seda, capa | roughness 1.0 |
| `"bone"` | Osso, marfim | roughness 0.5 |
| `"skin"` | Carne, pele | roughness 0.8 |
| `"standard"` | Genérico | roughness 0.7 |

**Paleta por tier**:
- Bronze: `#b45309` `#7c4820` `#c47c1e`
- Silver: `#4b5563` `#94a3b8` `#e2e8f0`
- Gold: `#facc15` `#fbbf24` `#6366f1` `#4f46e5`

### 5. Criar Inimigo em `game/data/enemies.ts`
```ts
{ name: 'Nome Voxel', type: 'beast' | 'humanoid' | 'undead' | 'elemental' | 'boss' }
```
Tipos têm implicações nas resistências e no modelo 3D:
- `beast` → cores naturais (verde, marrom, cinza)
- `humanoid` → cores de armadura/roupa
- `undead` → roxo/preto/branco frio, emissive nos olhos
- `elemental` → emissive forte matchando o elemento

### 6. Balancear Loot
Em `App.tsx` → função `handleVictory`:
- Inimigos bronze: 5–30 ouro, mat_wood/bone/slime
- Inimigos silver: 30–120 ouro, mat_iron/cloth
- Inimigos gold/boss: 100–400 ouro, mat_gold + equipamentos raros

### 7. Validar Build
```bash
cd "D:\GITHUB\3DGAME\RPG-Game-3D-win"
npm run build
```
Sem erros TypeScript → merge.

---

## Gemas RPG (Sistema Futuro)

Quando implementar gemas encaixáveis em equipamentos:

**Tipos canônicos**:
| Gema | Cor | Atributo | `material` |
|------|-----|---------|------------|
| Rubi | `#dc2626` | +ATK% | `gem` emissive red |
| Safira | `#2563eb` | +DEF% | `gem` emissive blue |
| Esmeralda | `#10b981` | +HP | `gem` emissive green |
| Ametista | `#7c3aed` | +Luck/Magic | `gem` emissive purple |
| Topázio | `#f59e0b` | +Speed/Gold | `gem` emissive amber |
| Diamante | `#e0f2fe` | +All% | `gem` emissive white |

**ID padrão sugerido**: `gem_ruby`, `gem_sapphire`, etc.
**Slot**: adicionar campo `gemSlots?: number` ao tipo `Item` em `types.ts`.
**Efeito**: multiplicador sobre o valor base do item.

---

## Checklist de Qualidade

- [ ] ID único e segue convenção de prefixo
- [ ] `minLevel` compatível com raridade
- [ ] `cost` proporcional ao tier (ver curva)
- [ ] Modelo 3D com material correto para lore do item
- [ ] Itens gold têm pelo menos 1 `VoxelPart` material `"gem"`
- [ ] Build passa sem erros TypeScript
- [ ] Nenhum item `mat_*` com `value > 0` (materiais não dão stats)
