# Sprite Animations (Battle)

Save all generated sprite animation JSON files here.

Recommended flow:
1. Generate JSON in `Sprite Animation Lab`.
2. Save the file in `game/data/sprite-animations/generated/`.
3. Register the animation in `registry.ts` with `id`, `nome`, `arquivo`.
4. Link the animation ID in entities (`animacaoExecucao` and/or `animacaoImpacto`).

Notes:
- Everything runs by ID reference.
- Battle runtime reads animation timing directly from each animation JSON file.
- Default unarmed animation IDs are centralized in `COMBAT_SPRITE_ANIMATION_DEFAULTS`.
