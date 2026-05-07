import React, { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { AlertTriangle, Crown, Home, LogOut, Play, Sparkles, Sword, Zap } from 'lucide-react';
import { ALL_ITEMS } from '../../constants';
import type { BossVictoryContext, CardRewardOffer, DungeonResult, Item, Player, ProgressionCard } from '../../types';
import { getNewlyUnlockedShopRarityByStage } from '../../game/mechanics/shopProgression';
import { uiSfx } from '../../game/audio/uiSfx';
import { InventoryScreen as InventoryModal } from '../profile/InventoryScreen';
import { ShopMenuScreen } from '../shop/ShopMenuScreen';
import { GameAssetIcon } from '../ui/game-asset-icon';
import { describeCardEffect, getCardCategoryBadge } from './cardPresentation';

const MENU_BACKGROUND_IMAGE_URL = new URL('../../game/assets/Imagens/Menu_Screen.png', import.meta.url).href;
const MENU_LOGO_IMAGE_URL = new URL('../../game/assets/Imagens/Logo_Hero_Tower.png', import.meta.url).href;

export const MenuScreen: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="absolute inset-0 z-50 overflow-hidden pointer-events-auto hero-brand-root">
    <div className="hero-brand-background" style={{ backgroundImage: `url(${MENU_BACKGROUND_IMAGE_URL})` }} />
    <div className="hero-brand-vignette" />
    <div className="hero-brand-noise" />

    <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
      <img
        src={MENU_LOGO_IMAGE_URL}
        alt="Hero Tower"
        className="w-full max-w-[300px] sm:max-w-[410px] hero-brand-logo-shadow hero-brand-logo-intro"
        draggable={false}
      />
      <p className="mt-4 mb-8 text-[10px] font-black uppercase tracking-[0.26em] text-[#f7d6ae] sm:text-xs">RPG tatico de aventura em 3D</p>

      <button
        onClick={onStart}
        className="hero-menu-action hero-menu-action-primary w-full max-w-xs sm:max-w-sm"
      >
        <Play size={18} fill="currentColor" className="shrink-0" /> Iniciar jornada
      </button>
    </div>
  </div>
);

export const CardChoiceScreen: React.FC<{
  offer: CardRewardOffer;
  cards: ProgressionCard[];
  onSelect: (card: ProgressionCard) => void;
}> = ({ offer, cards, onSelect }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isPickingRef = useRef(false);

  const { contextSafe } = useGSAP(() => {
    // Entry animations — run once on mount
    gsap.fromTo(containerRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power1.out' });
    gsap.fromTo(panelRef.current, { opacity: 0, scale: 0.92, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'power2.out' });
  }, { scope: containerRef });

  const handlePick = contextSafe((card: ProgressionCard) => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    uiSfx.play('card_select_evolution');
    setSelectedId(card.id);

    const selectedEl = containerRef.current?.querySelector<HTMLElement>(`[data-card-id="${card.id}"]`);
    const otherEls = containerRef.current?.querySelectorAll<HTMLElement>(`[data-card-id]:not([data-card-id="${card.id}"])`);
    const tl = gsap.timeline({ onComplete: () => onSelect(card) });

    if (selectedEl) {
      tl.to(selectedEl, { scale: 1.04, boxShadow: '0 0 40px 8px rgba(250,204,21,0.5)', duration: 0.27, ease: 'power2.out' }, 0);
      tl.to(selectedEl, { scale: 1.02, boxShadow: '0 0 60px 16px rgba(250,204,21,0.3)', duration: 0.3 }, 0.27);
      tl.to(selectedEl, { scale: 1.0, boxShadow: '0 0 80px 24px rgba(250,204,21,0)', duration: 0.33, ease: 'power1.in' }, 0.57);
    }
    if (otherEls && otherEls.length > 0) {
      tl.to(otherEls, { opacity: 0.3, scale: 0.95, filter: 'grayscale(0.6)', duration: 0.5, ease: 'power1.out' }, 0.1);
    }
    tl.to(containerRef.current, { opacity: 0, duration: 0.5, ease: 'power2.in' }, 0.9);
  });

  return (
    <div ref={containerRef} className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 pointer-events-auto">
      <div ref={panelRef} className="w-full max-w-6xl max-h-[95vh] sm:max-h-none overflow-y-auto rounded-2xl sm:rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_30px_120px_rgba(107,49,65,0.18)]">
        <div className="border-b border-[#dcc0aa] px-4 py-3 sm:px-8 sm:py-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cfab91] bg-[#f4e5d4] px-3 py-1 sm:px-4 sm:py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-[#8d5e29]">
            <Sparkles size={12} /> {selectedId ? 'Carta Selecionada!' : 'Escolha uma carta'}
          </div>
          <h2 className="mt-2 sm:mt-4 text-xl sm:text-4xl font-black text-[#6b3141]">{offer.source === 'boss' ? 'Recompensa do Chefao' : 'Recompensa de Evolucao'}</h2>
          <p className="mt-1 sm:mt-2 text-xs sm:text-base text-[#7f5b56]">{offer.reason}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5 p-3 sm:p-8">
          {cards.map((card) => {
            const category = getCardCategoryBadge(card);
            const effectLines = describeCardEffect(card);
            const isThis = selectedId === card.id;
            const isOther = selectedId !== null && selectedId !== card.id;

            return (
              <button
                key={card.id}
                data-card-id={card.id}
                onClick={() => handlePick(card)}
                disabled={!!selectedId}
                className={`group text-left rounded-[16px] sm:rounded-[20px] border p-3.5 sm:p-6 shadow-sm transition-all duration-200 relative overflow-hidden
                  ${isThis ? 'border-amber-400 bg-amber-50/80 ring-2 ring-amber-400/50' : 'border-[#cfab91] bg-[#f7ecdd]'}
                  ${!selectedId ? 'hover:-translate-y-1 hover:shadow-xl hover:border-[#c59d82] cursor-pointer' : ''}
                  ${isOther ? 'cursor-default' : ''}
                `}
              >
                {isThis ? (
                  <div
                    className="absolute inset-0 rounded-[16px] sm:rounded-[20px] pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle at center, rgba(250,204,21,0.25) 0%, transparent 70%)',
                    }}
                  />
                ) : null}
                <div className="relative flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-4">
                  <div>
                    <div className="rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.35em] text-[#9a7068] inline-block mb-1 sm:mb-2">{card.rarity}</div>
                    <h3 className="text-lg sm:text-2xl font-black text-[#6b3141] leading-tight">{card.name}</h3>
                  </div>
                  <div className={`inline-flex items-center gap-1 rounded-full border px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold shrink-0 ${category.color}`}>
                    {category.icon}
                    <span>{category.label}</span>
                  </div>
                </div>

                <p className="relative text-xs sm:text-sm text-[#7f5b56] leading-relaxed min-h-8 sm:min-h-12">{card.description}</p>

                <div className="relative mt-3 sm:mt-5 space-y-1.5 sm:space-y-2">
                  {effectLines.map((line) => (
                    <div key={line} className="rounded-xl border border-[#dcc0aa] bg-[#f4e5d4] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#6b3141]">
                      {line}
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const DungeonResultScreen: React.FC<{ result: DungeonResult; onContinue: () => void }> = ({ result, onContinue }) => {
  const rewardItems = Object.entries(result.rewards.drops)
    .map(([itemId, quantity]) => ({ item: ALL_ITEMS.find((entry) => entry.id === itemId), quantity }))
    .filter((entry): entry is { item: Item; quantity: number } => Boolean(entry.item));
  const isPositiveOutcome = result.outcome !== 'defeat';
  const title = result.outcome === 'victory' ? 'Dungeon Concluida' : result.outcome === 'withdrawal' ? 'Retirada Segura' : 'Dungeon Fracassada';
  const badgeLabel = result.outcome === 'withdrawal' ? 'Extracao' : 'Dungeon';
  const frameClasses = isPositiveOutcome
    ? 'border-[#7fb0d3] bg-[#e7f4ff] shadow-[0_30px_120px_rgba(31,79,120,0.24)]'
    : 'border-[#d3a0a0] bg-[#fdecec] shadow-[0_30px_120px_rgba(120,31,31,0.26)]';
  const headerClasses = isPositiveOutcome ? 'bg-[#1f4f78]' : 'bg-[#7a2525]';
  const headerTextClass = isPositiveOutcome ? 'text-[#bfdcf2]' : 'text-[#f0c5c5]';
  const statCardClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#dff0ff]' : 'border-[#dfb3b3] bg-[#fbe1e1]';
  const statLabelClass = isPositiveOutcome ? 'text-[#557f9f]' : 'text-[#9f5757]';
  const statValueClass = isPositiveOutcome ? 'text-[#214f70]' : 'text-[#7a2525]';
  const lootPanelClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#dff0ff]' : 'border-[#dfb3b3] bg-[#fbe1e1]';
  const lootChipClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#f0f8ff] text-[#4f7694]' : 'border-[#dfb3b3] bg-[#fdecec] text-[#9f5757]';
  const lootItemClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#f0f8ff]' : 'border-[#dfb3b3] bg-[#fdecec]';
  const lootItemInnerClasses = isPositiveOutcome ? 'border-[#b5d2e8] bg-[#dff0ff]' : 'border-[#ebc3c3] bg-[#fbe1e1]';
  const lootItemTextClass = isPositiveOutcome ? 'text-[#214f70]' : 'text-[#7a2525]';
  const emptyLootClasses = isPositiveOutcome ? 'border-[#9bc2de] bg-[#f0f8ff] text-[#4f7694]' : 'border-[#dfb3b3] bg-[#fdecec] text-[#9f5757]';

  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
      <div className={`w-full max-w-4xl rounded-[28px] border overflow-hidden ${frameClasses}`}>
        <div className={`px-6 py-5 sm:px-8 sm:py-6 text-center ${headerClasses}`}>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.3em] text-[#e6f4ff]">
            {isPositiveOutcome ? <Sparkles size={14} /> : <AlertTriangle size={14} />} {badgeLabel}
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl font-black text-white">{title}</h2>
          <p className={`mt-2 text-sm sm:text-base ${headerTextClass}`}>{result.reason}</p>
          {result.outcome === 'victory' && result.nextEvolution !== undefined && result.nextTotalMonsters !== undefined ? (
            <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs sm:text-sm font-black text-[#e6f4ff]">
              <span>Proxima evolucao: {result.nextEvolution}</span>
              <span className="text-[#bfdcf2]/70">-</span>
              <span>{result.nextTotalMonsters} encontros ate o chefao</span>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-6 sm:p-8">
          <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
            <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>Encontros</div>
            <div className={`text-2xl font-black ${statValueClass}`}>{result.rewards.clearedMonsters}<span className={`text-sm ${statLabelClass}`}>/{result.rewards.totalMonsters}</span></div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
            <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>Ouro</div>
            <div className="flex items-center gap-1.5 text-2xl font-black text-amber-700">
              <GameAssetIcon name="coin" size={18} />
              {isPositiveOutcome ? '+' : ''}{result.rewards.gold}
            </div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
            <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>XP</div>
            <div className={`flex items-center gap-1.5 text-2xl font-black ${isPositiveOutcome ? 'text-[#2d5f85]' : 'text-[#8f3535]'}`}>
              <Zap size={16} className="shrink-0" />
              {isPositiveOutcome ? '+' : ''}{result.rewards.xp}
            </div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
            <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>Diamantes</div>
            <div className="flex items-center gap-1.5 text-2xl font-black text-[#346c7f]">
              <GameAssetIcon name="diamond" size={18} />
              {isPositiveOutcome ? '+' : ''}{result.rewards.diamonds}
            </div>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${statCardClasses}`}>
            <div className={`text-[10px] uppercase tracking-[0.24em] mb-1 ${statLabelClass}`}>Chefao</div>
            <div className={`text-lg font-black ${result.rewards.bossDefeated ? (isPositiveOutcome ? 'text-[#2c6a92]' : 'text-[#9f5757]') : statLabelClass}`}>{result.rewards.bossDefeated ? 'Derrotado' : 'Intacto'}</div>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-6 sm:pb-8">
          <div className={`rounded-2xl border p-5 ${lootPanelClasses}`}>
            <div className={`text-[11px] font-black uppercase tracking-[0.3em] mb-3 ${statLabelClass}`}>
              {isPositiveOutcome ? 'Espolio da dungeon' : 'Itens acumulados'}
              {rewardItems.length > 0 ? <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] ${lootChipClasses}`}>{rewardItems.length}</span> : null}
            </div>
            {rewardItems.length > 0 ? (
              <div className="flex flex-wrap gap-2 max-h-[28vh] overflow-y-auto pr-1">
                {rewardItems.map(({ item, quantity }) => (
                  <div key={item.id} className={`flex items-center gap-1.5 rounded-full border pl-1.5 pr-3 py-1.5 shrink-0 ${lootItemClasses}`}>
                    <div className={`h-7 w-7 rounded-full border flex items-center justify-center text-sm leading-none ${lootItemInnerClasses}`}>{item.iconImage ? <img src={item.iconImage} className="w-5 h-5 object-contain" draggable={false} alt={item.name} /> : item.icon}</div>
                    <span className={`text-sm font-black ${lootItemTextClass}`}>{item.name}</span>
                    {quantity > 1 ? <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-black ${lootChipClasses}`}>x{quantity}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className={`rounded-2xl border border-dashed px-6 py-8 text-center ${emptyLootClasses}`}>Nenhum item ou material foi acumulado.</div>
            )}
          </div>

          <button onClick={onContinue} className={`mt-6 w-full py-4 rounded-xl font-black text-lg text-white transition-all ${isPositiveOutcome ? 'bg-[#2b6b96] hover:bg-[#327aa9] shadow-[0_12px_30px_rgba(43,107,150,0.35)]' : 'bg-[#2c5f82] hover:bg-[#346f97] shadow-[0_12px_30px_rgba(44,95,130,0.35)]'}`}>
            {result.outcome === 'victory' ? 'Receber espolio e continuar' : result.outcome === 'withdrawal' ? 'Receber espolio e voltar' : 'Voltar para o acampamento'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const BossVictoryModal: React.FC<{
  context: BossVictoryContext;
  narration?: string;
  onContinue: () => void;
  onExit: () => void;
}> = ({ context, narration, onContinue, onExit }) => {
  const rewardItems = Object.entries(context.rewards?.drops ?? {})
    .map(([itemId, quantity]) => ({ item: ALL_ITEMS.find((entry) => entry.id === itemId), quantity }))
    .filter((entry): entry is { item: Item; quantity: number } => Boolean(entry.item));

  const isDungeon = context.mode === 'dungeon';
  const newlyUnlockedShopRarity = !isDungeon
    ? (context.newlyUnlockedShopRarity ?? getNewlyUnlockedShopRarityByStage(context.nextStage ?? 0))
    : null;
  const unlockBadgeClass = newlyUnlockedShopRarity === 'gold'
    ? 'border-[#dcb570] bg-[#f3e3c3] text-[#7a5733]'
    : 'border-[#b8becb] bg-[#e9edf4] text-[#4f5d76]';
  const unlockLabel = newlyUnlockedShopRarity === 'gold' ? 'Lendario' : 'Raro';

  return (
    <div className="absolute inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
      <div className="w-full max-w-4xl rounded-[28px] border border-[#cfab91] bg-[#f7ecdd] overflow-hidden shadow-[0_30px_120px_rgba(107,49,65,0.22)]">
        <div className="bg-[#6b3141] px-6 py-5 sm:px-8 sm:py-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.3em] text-[#f6eadc]">
            <Crown size={14} /> Chefao derrotado
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl font-black text-white">
            {isDungeon ? 'Dungeon concluida' : 'Fase concluida'}
          </h2>
          <p className="mt-2 text-sm sm:text-base text-[#dcc0aa]">
            {isDungeon
              ? `${context.bossName} caiu. Voce domina a dungeon e decide seu proximo passo.`
              : `${context.bossName} foi vencido. Sua proxima fase esta liberada.`}
          </p>
          {narration && !isDungeon ? (
            <p className="mt-2 text-sm text-[#f6eadc] italic">&ldquo;{narration}&rdquo;</p>
          ) : null}
        </div>

        {!isDungeon ? (
          <div className="px-6 py-5 sm:px-8 sm:py-6">
            <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-5 py-4 text-center">
              <div className="text-[10px] font-black uppercase tracking-[0.26em] text-[#9a7068]">Proxima fase</div>
              <div className="mt-1 text-4xl font-black text-[#6b3141]">{context.nextStage ?? '-'}</div>
              <div className="mt-1 text-xs text-[#8f6c67]">Inimigos mais fortes aguardam</div>
            </div>
            {newlyUnlockedShopRarity ? (
              <div className="mt-3 rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9a7068]">Mercador</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-black text-[#6b3141]">
                      <GameAssetIcon name="chest" size={18} />
                      Novos itens liberados no mercador
                    </div>
                  </div>
                  <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${unlockBadgeClass}`}>
                    {unlockLabel}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {isDungeon && context.rewards ? (
          <div className="px-6 py-5 sm:px-8 sm:py-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">Encontros</div>
                <div className="text-2xl font-black text-[#6b3141]">{context.rewards.clearedMonsters}<span className="text-sm text-[#9a7068]">/{context.rewards.totalMonsters}</span></div>
              </div>
              <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">Ouro</div>
                <div className="flex items-center gap-1.5 text-2xl font-black text-amber-700">
                  <GameAssetIcon name="coin" size={18} />+{context.rewards.gold}
                </div>
              </div>
              <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">XP</div>
                <div className="flex items-center gap-1.5 text-2xl font-black text-[#7d3d4d]">
                  <Zap size={16} className="shrink-0" />+{context.rewards.xp}
                </div>
              </div>
              <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">Diamantes</div>
                <div className="flex items-center gap-1.5 text-2xl font-black text-[#346c7f]">
                  <GameAssetIcon name="diamond" size={18} />+{context.rewards.diamonds}
                </div>
              </div>
              <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[#9a7068] mb-1">Prox. evolucao</div>
                <div className="text-lg font-black text-[#4d7a96]">Nv. {context.nextEvolution ?? context.rewards.evolution}</div>
              </div>
            </div>

            {context.nextTotalMonsters !== undefined ? (
              <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3 text-sm font-black text-[#6b3141] text-center">
                {context.nextTotalMonsters} encontros para o proximo chefao
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#cfab91] bg-[#f4e5d4] p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-[#9a7068] mb-3">
                Espolio conquistado
                {rewardItems.length > 0 ? <span className="ml-2 rounded-full border border-[#cfab91] bg-[#f7ecdd] px-2 py-0.5 text-[10px] text-[#8f6c67]">{rewardItems.length}</span> : null}
              </div>
              {rewardItems.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-[22vh] overflow-y-auto pr-1">
                  {rewardItems.map(({ item, quantity }) => (
                    <div key={item.id} className="flex items-center gap-1.5 rounded-full border border-[#cfab91] bg-[#f7ecdd] pl-1.5 pr-3 py-1.5 shrink-0">
                      <div className="h-7 w-7 rounded-full border border-[#dcc0aa] bg-[#f4e5d4] flex items-center justify-center text-sm leading-none">{item.iconImage ? <img src={item.iconImage} className="w-5 h-5 object-contain" draggable={false} alt={item.name} /> : item.icon}</div>
                      <span className="text-sm font-black text-[#6b3141]">{item.name}</span>
                      {quantity > 1 ? <span className="rounded-full border border-[#cfab91] bg-[#f4e5d4] px-1.5 py-0.5 text-[10px] font-black text-[#8f6c67]">x{quantity}</span> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#cfab91] bg-[#f7ecdd] px-6 py-6 text-center text-[#8f6c67]">Nenhum item adicional foi acumulado.</div>
              )}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 px-6 pb-6 sm:px-8 sm:pb-8">
          <button
            onClick={onExit}
            className="flex items-center justify-center gap-2 rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-3 font-black text-[#6b3141] transition-colors hover:bg-[#e9d7c2]"
          >
            {isDungeon ? <LogOut size={15} /> : <Home size={15} />}
            Descansar
          </button>
          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#b87a3a] px-4 py-3 font-black text-white shadow-[0_8px_24px_rgba(184,122,58,0.3)] transition-all hover:bg-[#c88a4a]"
          >
            <Sword size={15} /> Continuar
          </button>
        </div>
      </div>
    </div>
  );
};

export const ShopScreen: React.FC<{
  player: Player;
  items: Item[];
  huntStage: number;
  onBuy: (item: Item, quantity: number) => void;
  onSell: (item: Item, quantity: number) => void;
  onEquip: (item: Item) => void;
  onUnequip: (item: Item) => void;
  onUse?: (itemId: string) => void;
  onLeave: () => void;
}> = ({ player, items, huntStage, onBuy, onSell, onEquip, onUnequip, onUse, onLeave }) => {
  const [showShopInventory, setShowShopInventory] = useState(false);

  return (
    <>
      <ShopMenuScreen
        player={player}
        items={items}
        huntStage={huntStage}
        onBuy={onBuy}
        onSell={onSell}
        onEquip={onEquip}
        onLeave={onLeave}
        onOpenInventory={() => setShowShopInventory(true)}
        inventoryOpen={showShopInventory}
      />
      {showShopInventory ? (
        <div className="absolute inset-0 z-50">
          <InventoryModal
            player={player}
            shopItems={items}
            onClose={() => setShowShopInventory(false)}
            onEquip={onEquip}
            onUnequip={onUnequip}
            onUse={onUse ?? (() => {})}
            onSell={onSell}
            isBattleContext={false}
            inShopContext={true}
          />
        </div>
      ) : null}
    </>
  );
};
