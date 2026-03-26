import React, { useMemo, useState } from 'react';
import { Coins, Droplets, FlaskConical, Shield, Sparkles, Star, Sword, Zap } from 'lucide-react';
import { ALL_CARDS } from '../../game/data/cards';
import { getPlayerClassById } from '../../game/data/classes';
import { Item, Player, ProgressionCard } from '../../types';
import { DeveloperHeroScene } from '../Scene3D';
import { GameAssetIcon, GameAssetIconName } from '../ui/game-asset-icon';
import { getCardCategoryMeta, getCardEffectPreview, getRarityColor, getRarityLabel, ItemTypeIcon } from '../ui/game-display';
import { RpgMenuPanel, RpgMenuSectionTitle, RpgMenuShell, RpgMenuStat, RpgMenuTab } from '../ui/rpg-menu-shell';
import { ScrollArea } from '../ui/scroll-area';
import { Tooltip } from '../ui/tooltip';

type CharacterSheetModalProps = {
  player: Player;
  shopItems: Item[];
  onClose: () => void;
  onOpenInventory: () => void;
};

type ProfileTab = 'overview' | 'cards' | 'skills';

const SummaryCard = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <RpgMenuStat label={label} value={<span className={tone}>{value}</span>} />
);

const ResourceBar = ({
  label,
  value,
  max,
  tone,
  track,
  compact = false,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
  track: string;
  compact?: boolean;
}) => {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[#9a7068]">{label}</div>
        <div className={`${compact ? 'text-[11px]' : 'text-xs'} font-black text-[#6b3141]`}>{value}/{max}</div>
      </div>
      <div className={`${compact ? 'mt-1.5 h-1.5' : 'mt-2 h-2'} overflow-hidden rounded-full bg-[#e9d7c2]`}>
        <div className={`h-full rounded-full ${track}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const EquipmentStatusCard = ({
  label,
  item,
  type,
  compact = false,
}: {
  label: string;
  item: Item | null;
  type: Item['type'];
  compact?: boolean;
}) => (
  <Tooltip
    content={
      <div>
        <div className="font-black text-white">{label}</div>
        <div className="mt-1 text-slate-400">{item ? item.name : 'Slot vazio'}</div>
      </div>
    }
  >
    {compact ? (
      <button className={`group flex w-full items-center gap-1.5 rounded-[12px] border px-2 py-1.5 text-left shadow-[0_6px_16px_rgba(107,49,65,0.06)] transition-all ${item ? `${getRarityColor(item.rarity)} bg-[#f4e5d4]` : 'border-[#cfab91] bg-[#f7ecdd] text-[#8f6c67]'}`}>
        <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-[#dcc0aa] bg-[#f8eddf]">
          {item ? (
            <span className="text-base leading-none">{item.icon}</span>
          ) : (
            <ItemTypeIcon type={type} size={14} />
          )}
        </span>
        <span className="min-w-0 flex-1 leading-none">
          <span className="block truncate text-[8px] font-black uppercase tracking-[0.14em] text-[#9a7068]">{label}</span>
          <span className="mt-0.5 block truncate text-[12px] font-black text-[#6b3141]">{item ? item.name : 'Vazio'}</span>
        </span>
      </button>
    ) : (
      <button className={`group flex w-full items-center gap-3 rounded-[20px] border px-3.5 py-3 text-left transition-all ${item ? `${getRarityColor(item.rarity)} bg-[#f4e5d4] hover:-translate-y-0.5` : 'border-[#cfab91] bg-[#f7ecdd] text-[#8f6c67] hover:border-[#b98774]'}`}>
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#dcc0aa] bg-[#f8eddf]">
          {item ? (
            <>
              <span className="text-2xl leading-none">{item.icon}</span>
              <span className="absolute -bottom-1 -right-1 game-icon-badge h-3.5 w-3.5 text-cyan-300"><ItemTypeIcon type={type} size={7} /></span>
            </>
          ) : (
            <ItemTypeIcon type={type} size={18} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[8px] font-black uppercase tracking-[0.14em] text-[#8a5a57] truncate">{label}</span>
          <span className="mt-0.5 block truncate text-sm font-black text-[#6b3141]">{item ? item.name : 'Vazio'}</span>
        </span>
      </button>
    )}
  </Tooltip>
);

const HeroIdentityCard = ({
  name,
  className,
  level,
  xp,
  xpToNext,
  hp,
  maxHp,
  mp,
  maxMp,
  attributes,
  showAttributes = true,
  compact = false,
}: {
  name: string;
  className: string;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attributes: Array<{ label: string; value: React.ReactNode; icon: React.ReactNode; tone?: string }>;
  showAttributes?: boolean;
  compact?: boolean;
}) => (
  <div className={`rpg-menu-stat rounded-[18px] ${compact ? 'px-3 py-2.5' : 'px-3 py-3'}`}>
    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7068]">Heroi</div>
    <div className={`flex items-start justify-between gap-3 ${compact ? 'mt-0.5' : 'mt-1'}`}>
      <div className="min-w-0">
        <h3 className={`truncate font-black text-[#6b3141] ${compact ? 'text-base' : 'text-lg'}`}>{name}</h3>
        <div className={`truncate font-bold text-[#8a5a57] ${compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-xs'}`}>{className}</div>
      </div>
      <div className={`shrink-0 rounded-full border border-[#d6b9a3] bg-[#f4e5d4] font-black uppercase tracking-[0.14em] text-[#8d5e29] ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}`}>
        Nv. {level}
      </div>
    </div>
    <div className={compact ? 'mt-2' : 'mt-3'}>
      <ResourceBar label="XP" value={xp} max={xpToNext} tone="text-[#8d5e29]" track="bg-[linear-gradient(90deg,#7d3d4d,#c89a66)]" compact={compact} />
    </div>
    <div className={`grid gap-2 border-t border-[#dcc0aa] ${compact ? 'mt-2 pt-2' : 'mt-3 pt-3'}`}>
      <ResourceBar label="HP" value={hp} max={maxHp} tone="text-[#9a4151]" track="bg-[linear-gradient(90deg,#8d2f46,#d17482)]" compact={compact} />
      <ResourceBar label="Mana" value={mp} max={maxMp} tone="text-[#346c7f]" track="bg-[linear-gradient(90deg,#2b6878,#66b8d2)]" compact={compact} />
    </div>
    {showAttributes && (
      <div className={`grid grid-cols-2 gap-2 border-t border-[#dcc0aa] ${compact ? 'mt-2 pt-2' : 'mt-3 pt-3'}`}>
        {attributes.map((attribute) => (
          <div key={attribute.label} className="flex items-center gap-2 rounded-[14px] border border-[#d6b9a3] bg-[#f4e5d4] px-2.5 py-2">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center ${attribute.tone ?? 'text-[#7d3d4d]'}`}>
              {attribute.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9a7068]">{attribute.label}</div>
              <div className={`mt-0.5 text-sm font-black ${attribute.tone ?? 'text-[#6b3141]'}`}>{attribute.value}</div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const MobileStatusPill = ({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone?: string;
}) => (
  <div className="flex items-center gap-1.5 rounded-[12px] border border-[#cfab91] bg-[#f7ecdd] px-2 py-1.5 shadow-[0_6px_16px_rgba(107,49,65,0.06)]">
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[#f8eddf] ${tone ?? 'text-[#7d3d4d]'}`}>
      <div className="scale-90">{icon}</div>
    </div>
    <div className="min-w-0 leading-none">
      <div className="text-[8px] font-black uppercase tracking-[0.14em] text-[#9a7068] truncate">{label}</div>
      <div className={`mt-0.5 text-[12px] font-black ${tone ?? 'text-[#6b3141]'}`}>{value}</div>
    </div>
  </div>
);

export const CharacterSheetModal = ({ player, shopItems, onClose, onOpenInventory }: CharacterSheetModalProps) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [mobileSideTab, setMobileSideTab] = useState<'equipment' | 'attributes'>('equipment');
  const currentClass = getPlayerClassById(player.classId);

  const equipmentSlots: Array<{ label: string; item: Item | null; type: Item['type'] }> = [
    { label: 'Arma', item: player.equippedWeapon, type: 'weapon' },
    { label: 'Escudo', item: player.equippedShield, type: 'shield' },
    { label: 'Capacete', item: player.equippedHelmet, type: 'helmet' },
    { label: 'Armadura', item: player.equippedArmor, type: 'armor' },
    { label: 'Pernas', item: player.equippedLegs, type: 'legs' },
  ];

  const selectedCards = useMemo(() => {
    return Object.entries(
      player.chosenCards.reduce<Record<string, number>>((accumulator, cardId) => {
        accumulator[cardId] = (accumulator[cardId] || 0) + 1;
        return accumulator;
      }, {}),
    )
      .map(([cardId, count]) => ({
        card: ALL_CARDS.find((entry) => entry.id === cardId),
        count,
      }))
      .filter((entry): entry is { card: ProgressionCard; count: number } => Boolean(entry.card))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        const rarityWeight = { bronze: 1, silver: 2, gold: 3 };
        const rarityDifference = rarityWeight[right.card.rarity] - rarityWeight[left.card.rarity];
        if (rarityDifference !== 0) {
          return rarityDifference;
        }

        return left.card.name.localeCompare(right.card.name);
      });
  }, [player.chosenCards]);

  const repeatedStacks = selectedCards.filter((entry) => entry.count > 1).length;
  const totalCardPicks = player.chosenCards.length;
  const statusCards = [
    { label: 'Ataque', value: player.stats.atk, icon: <Sword size={18} />, tone: 'text-[#b83a4b]' },
    { label: 'Defesa', value: player.stats.def, icon: <Shield size={18} />, tone: 'text-[#4d6780]' },
    { label: 'Veloc.', value: player.stats.speed, icon: <Zap size={18} />, tone: 'text-[#7c4c76]' },
    { label: 'Sorte', value: player.stats.luck, icon: <Star size={18} />, tone: 'text-[#b26a2e]' },
  ];
  const profileTabs: Array<{ id: ProfileTab; label: string; icon: GameAssetIconName }> = [
    { id: 'overview', label: 'Status', icon: 'heart' },
    { id: 'cards', label: 'Cartas', icon: 'scroll' },
    { id: 'skills', label: 'Skills', icon: 'bookAlt' },
  ];

  return (
    <RpgMenuShell
      title="Perfil"
      subtitle={`${currentClass.name} • Nivel ${player.level}`}
      onClose={onClose}
      accent="wine"
      valueBadge={<><GameAssetIcon name="book" size={24} /> {player.name}</>}
      headerAction={
        <button onClick={onOpenInventory} className="rpg-menu-tab rpg-menu-tab-active hidden items-center gap-2.5 md:inline-flex">
          <GameAssetIcon name="bag" size={24} /> Mochila
        </button>
      }
    >
      <div className="relative flex flex-col gap-3 pb-14 md:pb-0">
        <div className="hidden flex-wrap gap-2 px-1 md:flex">
          {profileTabs.map((tab) => (
            <RpgMenuTab key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className="inline-flex items-center gap-2">
              <GameAssetIcon name={tab.icon} size={20} /> {tab.label}
            </RpgMenuTab>
          ))}
        </div>

        <div className="lg:min-h-0 lg:flex-1">
                  {activeTab === 'overview' && (
                    <div className="flex flex-col gap-2 px-3 pb-16 pt-3 lg:h-full lg:min-h-0 lg:grid lg:gap-3 lg:overflow-hidden lg:rounded-[24px] lg:border lg:border-[#c59d82] lg:bg-[#f8eddf] lg:p-4 lg:pb-4">
                      <div className="border-b border-[#dcc0aa] border-opacity-60 pb-3 lg:hidden">
                        <HeroIdentityCard
                          name={player.name}
                          className={currentClass.name}
                          level={player.level}
                          xp={player.xp}
                          xpToNext={player.xpToNext}
                          hp={player.stats.hp}
                          maxHp={player.stats.maxHp}
                          mp={player.stats.mp}
                          maxMp={player.stats.maxMp}
                          attributes={statusCards}
                          compact
                          showAttributes={false}
                        />
                      </div>

                        <div className="flex w-full flex-col gap-2 overflow-x-hidden lg:hidden">
                        {/* Top row: 3D model + attributes side by side */}
                        <div className="relative flex w-full items-stretch gap-2.5" style={{ height: 'clamp(16rem, 42dvh, 22rem)' }}>
                          <div className="rpg-hero-stage relative min-w-0 flex-[1.35] overflow-hidden" style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
                            <div className="absolute left-1 top-1 z-[2] rounded-full border border-[#d6b9a3] bg-[#fff7ed]/90 px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-[#8a5a57] shadow-[0_8px_18px_rgba(107,49,65,0.1)]">
                              Girar
                            </div>
                            <div className="h-full w-full">
                              <DeveloperHeroScene
                                classId={player.classId}
                                animationAction="idle"
                                equippedWeaponId={player.equippedWeapon?.id}
                                equippedArmorId={player.equippedArmor?.id}
                                equippedHelmetId={player.equippedHelmet?.id}
                                equippedLegsId={player.equippedLegs?.id}
                                equippedShieldId={player.equippedShield?.id}
                                transparent
                                enableManualRotate
                                transparentCameraZoom={0.95}
                                transparentModelScale={0.98}
                                transparentModelOffsetY={0.35}
                              />
                            </div>
                          </div>
                          <div className="flex w-[40%] max-w-[10.5rem] min-w-[7.5rem] shrink-0 flex-col gap-1 py-1 overflow-hidden">
                            <div className="flex w-full rounded-full border border-[#dcc0aa] bg-[#f8eddf] p-0.5 shadow-inner">
                              <button
                                onClick={() => setMobileSideTab('equipment')}
                                className={`flex-1 rounded-full py-1 text-center text-[9px] font-bold uppercase tracking-wider transition-colors ${mobileSideTab === 'equipment' ? 'bg-[#c59d82] text-white shadow-sm' : 'text-[#8a5a57]'}`}
                              >
                                Equip.
                              </button>
                              <button
                                onClick={() => setMobileSideTab('attributes')}
                                className={`flex-1 rounded-full py-1 text-center text-[9px] font-bold uppercase tracking-wider transition-colors ${mobileSideTab === 'attributes' ? 'bg-[#c59d82] text-white shadow-sm' : 'text-[#8a5a57]'}`}
                              >
                                Atrib.
                              </button>
                            </div>
                            
                            <div className="flex min-h-0 flex-1 flex-col gap-[3px] overflow-y-auto">
                              {mobileSideTab === 'attributes' ? (
                                statusCards.map((attribute) => (
                                  <MobileStatusPill key={attribute.label} label={attribute.label} value={attribute.value} icon={attribute.icon} tone={attribute.tone} />
                                ))
                              ) : (
                                equipmentSlots.map((slot) => (
                                  <EquipmentStatusCard key={slot.label} label={slot.label} item={slot.item} type={slot.type} compact />
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)_14rem] lg:items-stretch lg:gap-3">
                        <div className="grid content-start gap-2.5">
                          <HeroIdentityCard
                            name={player.name}
                            className={currentClass.name}
                            level={player.level}
                            xp={player.xp}
                            xpToNext={player.xpToNext}
                            hp={player.stats.hp}
                            maxHp={player.stats.maxHp}
                            mp={player.stats.mp}
                            maxMp={player.stats.maxMp}
                            attributes={statusCards}
                          />
                        </div>

                        <div className="flex min-h-0 items-center justify-center">
                          <div className="rpg-hero-stage relative h-full min-h-[22rem] w-full">
                            <div className="h-full">
                              <DeveloperHeroScene
                                classId={player.classId}
                                animationAction="idle"
                                equippedWeaponId={player.equippedWeapon?.id}
                                equippedArmorId={player.equippedArmor?.id}
                                equippedHelmetId={player.equippedHelmet?.id}
                                equippedLegsId={player.equippedLegs?.id}
                                equippedShieldId={player.equippedShield?.id}
                                transparent
                                enableManualRotate
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div className="grid content-start gap-2.5">
                            <RpgMenuSectionTitle className="px-1">Equipamentos</RpgMenuSectionTitle>
                            {equipmentSlots.map((slot) => (
                              <EquipmentStatusCard key={slot.label} label={slot.label} item={slot.item} type={slot.type} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'cards' && (
                    <ScrollArea className="h-full" viewportClassName="p-1 sm:p-6">
                      <div className="flex flex-col gap-3 sm:gap-5">
                        {/* Summary pills - single horizontal row */}
                        <div className="flex items-center gap-1.5 overflow-x-auto sm:gap-3">
                          {[
                            { label: 'Escolhas', value: totalCardPicks, tone: 'text-[#6b3141]' },
                            { label: 'Únicas', value: selectedCards.length, tone: 'text-[#346c7f]' },
                            { label: 'Repetidas', value: repeatedStacks, tone: 'text-[#8d5e29]' },
                            { label: 'Skills', value: player.skills.length, tone: 'text-[#7c4c76]' },
                          ].map((s) => (
                            <div key={s.label} className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#cfab91] bg-[#f7ecdd] px-2.5 py-1 shadow-sm sm:px-3 sm:py-1.5">
                              <span className="text-[9px] font-bold uppercase tracking-wide text-[#9a7068] sm:text-[10px]">{s.label}</span>
                              <span className={`text-xs font-black sm:text-sm ${s.tone}`}>{s.value}</span>
                            </div>
                          ))}
                        </div>

                        {selectedCards.length > 0 ? (
                          <div className="grid grid-cols-1 gap-2.5 sm:gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                            {selectedCards.map(({ card, count }) => {
                              const categoryBg = card.category === 'economia' ? 'text-amber-700 border-amber-300 bg-amber-100' : card.category === 'atributo' ? 'text-emerald-700 border-emerald-300 bg-emerald-100' : card.category === 'batalha' ? 'text-rose-700 border-rose-300 bg-rose-100' : 'text-sky-700 border-sky-300 bg-sky-100';
                              const categoryIcon = card.category === 'economia' ? <Coins size={14} /> : card.category === 'atributo' ? <Zap size={14} /> : card.category === 'batalha' ? <Sword size={14} /> : <Sparkles size={14} />;
                              const categoryLabel = card.category === 'economia' ? 'Economia' : card.category === 'atributo' ? 'Atributos' : card.category === 'batalha' ? 'Combate' : 'Especial';

                              return (
                                <article key={card.id} className="rounded-[16px] sm:rounded-[20px] border border-[#cfab91] bg-[#f7ecdd] p-3.5 sm:p-5 shadow-sm transition-all hover:-translate-y-0.5">
                                  <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
                                    <div>
                                      <div className="flex items-center gap-2 mb-1 sm:mb-2">
                                        <span className="rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.35em] text-[#9a7068]">{getRarityLabel(card.rarity)}</span>
                                        {count > 1 && <span className="rounded-md border border-amber-400/40 bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-700">x{count}</span>}
                                      </div>
                                      <h3 className="text-base sm:text-lg font-black text-[#6b3141] leading-tight">{card.name}</h3>
                                    </div>
                                    <div className={`inline-flex items-center gap-1 rounded-full border px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold shrink-0 ${categoryBg}`}>
                                      {categoryIcon}
                                      <span>{categoryLabel}</span>
                                    </div>
                                  </div>

                                  <p className="text-xs sm:text-sm text-[#7f5b56] leading-relaxed">{card.description}</p>

                                  <div className="mt-2.5 sm:mt-4">
                                    <div className="rounded-xl border border-[#dcc0aa] bg-[#f4e5d4] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-[#6b3141]">
                                      {getCardEffectPreview(card)}
                                    </div>
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-[24px] border border-dashed border-[#c59d82] bg-[#f4e7d5] px-6 py-12 text-center">
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-[#c59d82] bg-[#f7eddf] text-[#7d3d4d]"><GameAssetIcon name="scroll" size={42} /></div>
                            <h3 className="mt-4 text-lg font-black text-[#6b3141]">Nenhuma carta registrada</h3>
                            <p className="mt-2 text-sm text-[#8f6c67]">As escolhas de level up e chefes vao aparecer aqui para leitura da build.</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}

                  {activeTab === 'skills' && (
                    <ScrollArea className="h-full" viewportClassName="p-1 sm:p-6">
                      <div className="flex flex-col gap-3 sm:gap-5">
                        {/* Summary pills - single horizontal row */}
                        <div className="flex items-center gap-1.5 overflow-x-auto sm:gap-3">
                          {[
                            { label: 'Skills', value: player.skills.length, tone: 'text-[#7c4c76]' },
                            { label: 'Nível', value: player.level, tone: 'text-[#8d5e29]' },
                            { label: 'Mana', value: player.stats.mp, tone: 'text-[#346c7f]' },
                            { label: 'Classe', value: currentClass.name, tone: 'text-[#6b3141]' },
                          ].map((s) => (
                            <div key={s.label} className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#cfab91] bg-[#f7ecdd] px-2.5 py-1 shadow-sm sm:px-3 sm:py-1.5">
                              <span className="text-[9px] font-bold uppercase tracking-wide text-[#9a7068] sm:text-[10px]">{s.label}</span>
                              <span className={`text-xs font-black sm:text-sm ${s.tone}`}>{s.value}</span>
                            </div>
                          ))}
                        </div>

                        {player.skills.length > 0 ? (
                          <div className="grid grid-cols-1 gap-2.5 sm:gap-4 lg:grid-cols-2">
                            {player.skills.map((skill) => (
                              <article key={skill.id} className="flex items-start gap-3 rounded-[16px] border border-[#cfab91] bg-[#f7ecdd] p-3 shadow-sm transition-all hover:-translate-y-0.5 sm:gap-4 sm:rounded-[20px] sm:p-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-300 bg-violet-100 text-violet-700 sm:h-14 sm:w-14 sm:rounded-2xl">
                                  <Sparkles size={20} className="sm:hidden" />
                                  <Sparkles size={28} className="hidden sm:block" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="min-w-0 flex-1 truncate text-sm font-black text-[#6b3141] sm:text-base">{skill.name}</span>
                                    <span className="shrink-0 rounded-md border border-[#8eb4c0] bg-[#dceff2] px-2 py-0.5 text-xs font-black text-[#346c7f]">{skill.manaCost} MP</span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-violet-700">{skill.type}</span>
                                    <span className="rounded-full border border-[#cfab91] bg-[#f7ecdd] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#9a7068]">Lvl {skill.minLevel}+</span>
                                  </div>
                                  <p className="mt-1.5 text-[11px] leading-snug text-[#7f5b56] sm:text-xs sm:mt-2">{skill.description}</p>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-[24px] border border-dashed border-[#c59d82] bg-[#f4e7d5] px-6 py-12 text-center text-[#8f6c67]">
                            Nenhuma habilidade aprendida ainda.
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4 md:hidden">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[#c59d82] bg-[#f7eddc]/92 px-3 py-1.5 shadow-[0_14px_28px_rgba(54,26,33,0.18)] backdrop-blur-md">
            {profileTabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center rounded-[14px] px-3 py-1.5 transition-all duration-200 ${isActive ? 'bg-[#fff4e7] text-[#6b3141] shadow-sm' : 'text-[#8f6c67]'}`}
                >
                  <GameAssetIcon name={tab.icon} size={isActive ? 24 : 20} className={`transition-all duration-200 ${isActive ? 'scale-105' : 'opacity-80'}`} />
                  {!isActive && (
                    <span className="mt-0.5 text-[9px] font-black uppercase tracking-[0.12em] opacity-70">
                      {tab.label}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="mx-0.5 h-6 w-px bg-[#c59d82]/40" />

            <button
              onClick={onOpenInventory}
              className="flex flex-col items-center justify-center rounded-[14px] px-3 py-1.5 text-[#8f6c67] transition-all duration-200"
            >
              <GameAssetIcon name="bag" size={20} className="opacity-80" />
              <span className="mt-0.5 text-[9px] font-black uppercase tracking-[0.12em] opacity-70">
                Mochila
              </span>
            </button>
          </div>
        </div>
      </div>
    </RpgMenuShell>
  );
};