import React, { useMemo, useState } from 'react';
import { CircleHelp, Coins, Crosshair, Heart, Lock, Orbit, Shield, Sparkles, Star, Sword, WandSparkles, X, Zap } from 'lucide-react';
import { ALL_CARDS } from '../../game/data/cards';
import { getConstellationByClassId } from '../../game/data/classTalents';
import { getPlayerClassById } from '../../game/data/classes';
import { canUnlockTalentNode } from '../../game/mechanics/classProgression';
import { SKILLS } from '../../constants';
import { ClassTalentTrail, Item, Player, PlayerClassId, ProgressionCard, TalentNode } from '../../types';
import { DeveloperHeroScene } from '../Scene3D';
import { GameAssetIcon } from '../ui/game-asset-icon';
import { getCardEffectPreview, getRarityColor, getRarityLabel, ItemTypeIcon } from '../ui/game-display';
import { RpgMenuSectionTitle, RpgMenuShell, RpgMenuStat, RpgMenuTab } from '../ui/rpg-menu-shell';
import { ScrollArea } from '../ui/scroll-area';

type CharacterSheetModalProps = {
  player: Player;
  shopItems: Item[];
  onClose: () => void;
  onOpenInventory: () => void;
  onUnlockTalent: (nodeId: string) => void;
};

type ProfileTab = 'overview' | 'cards' | 'skills' | 'constellation';

type ClassGuideDefinition = {
  title: string;
  summary: string;
  gameplayLoop: string[];
  uniqueAbilities: Array<{
    name: string;
    detail: string;
  }>;
};

const CLASS_GUIDES: Record<PlayerClassId, ClassGuideDefinition> = {
  knight: {
    title: 'Knight: muralha e controle',
    summary: 'O Knight gira em torno de Valor, defesa consistente e punicao de alvos marcados. Ele cresce quando voce segura o ritmo da luta.',
    gameplayLoop: [
      'Ataque e defesa geram Valor para preparar as skills da constelacao.',
      'A classe aguenta bem a linha de frente e converte seguranca em pressao.',
      'Quando o alvo fica marcado, varias ferramentas do Knight rendem melhor.',
    ],
    uniqueAbilities: [
      { name: 'Valor', detail: 'Recurso proprio da classe. Serve para alimentar skills da constelacao e alguns picos de defesa ou dano.' },
      { name: 'Postura defensiva', detail: 'O Knight aproveita muito bem o comando Defender e talentos que reduzem dano recebido.' },
      { name: 'Marcacao sagrada', detail: 'Parte das skills e trilhas melhora o dano em inimigos marcados e pune chefes com mais consistencia.' },
    ],
  },
  barbarian: {
    title: 'Barbarian: furia e explosao',
    summary: 'O Barbarian quer gerar Furia rapido e transformar isso em burst, sangramento e trocas agressivas de curto prazo.',
    gameplayLoop: [
      'Ataques e talentos acumulam Furia para preparar finalizadores.',
      'A classe troca vida por pressao e encaixa muito bem roubo de vida.',
      'Quanto melhor voce sincroniza gasto de Furia, maior o impacto dos golpes chave.',
    ],
    uniqueAbilities: [
      { name: 'Furia', detail: 'Recurso proprio que acelera o dano da classe e habilita finalizadores mais violentos.' },
      { name: 'Sangramento', detail: 'Algumas trilhas fortalecem bleed e fazem o Barbarian pressionar mesmo depois do golpe.' },
      { name: 'Consume-all finisher', detail: 'Certas skills convertem toda a Furia acumulada em um pico grande de dano.' },
    ],
  },
  mage: {
    title: 'Mage: mana e escala arcana',
    summary: 'O Mage joga com mana alta, geracao de Arcano e dano magico sustentado. E mais fragil, mas recompensa setup e leitura de combate.',
    gameplayLoop: [
      'As trilhas fazem skills gerarem Arcano e ampliam magia, marca e queimadura.',
      'A classe vive de sequenciar casts com seguranca e nao de trocar dano bruto na linha de frente.',
      'Quanto melhor o giro de recurso, mais facil alternar entre dano e suporte.',
    ],
    uniqueAbilities: [
      { name: 'Arcano', detail: 'Recurso da classe usado para fortalecer casts e sustentar a rotacao magica.' },
      { name: 'Status magicos', detail: 'Mage cresce bastante com burn, marca e bonus de dano magico.' },
      { name: 'Reserva de mana', detail: 'As trilhas aumentam MP maximo, cura e o teto do recurso magico secundario.' },
    ],
  },
  ranger: {
    title: 'Ranger: foco e precisao',
    summary: 'O Ranger usa Foco como um recurso tatico. Ele acumula durante a luta e gasta no momento certo para transformar consistencia em dano preciso.',
    gameplayLoop: [
      'Atacar, defender e algumas skills geram Foco durante a batalha.',
      'O Foco nao fica permanente no heroi: ele e uma reserva usada so no combate atual.',
      'Voce gasta Foco em skills da constelacao para liberar efeitos ou aumentar o dano.',
    ],
    uniqueAbilities: [
      { name: 'Foco', detail: 'Barra propria do Ranger. Normalmente comeca vazia e vai enchendo ao longo da luta.' },
      { name: 'Pressao de alvo marcado', detail: 'A trilha Vendaval aumenta o ganho de Foco por ataque e melhora dano em marcados.' },
      { name: 'Conversao em skill', detail: 'Skills como Saraivada de Espinhos gastam Foco e ainda escalam o dano com o que foi consumido.' },
    ],
  },
  rogue: {
    title: 'Rogue: sombra, critico e burst',
    summary: 'O Rogue gira em torno de velocidade, Sombra e explosoes curtas. E uma classe de janela: entra, pressiona, sai.',
    gameplayLoop: [
      'A classe gera Sombra para abastecer skills agressivas e de ritmo rapido.',
      'Critico, alvo marcado e bleed trabalham juntos para abrir janelas de burst.',
      'Voce rende mais quando escolhe bem o momento de acelerar a ofensiva.',
    ],
    uniqueAbilities: [
      { name: 'Sombra', detail: 'Recurso proprio que habilita skills etereas e aumenta a pressao em combo.' },
      { name: 'Criticos frequentes', detail: 'Velocidade e sorte alta ajudam o Rogue a capitalizar janelas curtas.' },
      { name: 'Burst hibrido', detail: 'A classe mistura ferramentas fisicas, bleed, marca e ate dano magico em algumas trilhas.' },
    ],
  },
};

const SummaryCard = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <RpgMenuStat label={label} value={<span className={tone}>{value}</span>} />
);

const ResourceBar = ({
  label,
  value,
  max,
  track,
}: {
  label: string;
  value: number;
  max: number;
  track: string;
}) => {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[#9a7068]">{label}</div>
        <div className="text-xs font-black text-[#6b3141]">{value}/{max}</div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e9d7c2]">
        <div className={`h-full rounded-full ${track}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const EquipmentCard = ({ label, item, type }: { label: string; item: Item | null; type: Item['type'] }) => (
  <div className={`flex items-center gap-3 rounded-[18px] border px-3 py-3 ${item ? `${getRarityColor(item.rarity)} bg-[#f4e5d4]` : 'border-[#cfab91] bg-[#f7ecdd] text-[#8f6c67]'}`}>
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#dcc0aa] bg-[#f8eddf]">
      {item ? <span className="text-2xl leading-none">{item.icon}</span> : <ItemTypeIcon type={type} size={18} />}
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[8px] font-black uppercase tracking-[0.14em] text-[#8a5a57]">{label}</div>
      <div className="mt-0.5 truncate text-sm font-black text-[#6b3141]">{item ? item.name : 'Vazio'}</div>
    </div>
  </div>
);

const getCardCategoryBadge = (card: ProgressionCard) => {
  if (card.category === 'economia') return { icon: <Coins size={14} />, label: 'Economia', color: 'text-amber-700 border-amber-300 bg-amber-100' };
  if (card.category === 'atributo') return { icon: <Heart size={14} />, label: 'Atributos', color: 'text-emerald-700 border-emerald-300 bg-emerald-100' };
  if (card.category === 'batalha') return { icon: <Crosshair size={14} />, label: 'Combate', color: 'text-rose-700 border-rose-300 bg-rose-100' };
  return { icon: <Sparkles size={14} />, label: 'Especial', color: 'text-sky-700 border-sky-300 bg-sky-100' };
};

const ConstellationNodeCard = ({
  node,
  player,
  onUnlockTalent,
}: {
  node: TalentNode;
  player: Player;
  onUnlockTalent: (nodeId: string) => void;
}) => {
  const isUnlocked = player.unlockedTalentNodeIds.includes(node.id);
  const unlockState = canUnlockTalentNode(player, node.id);
  const isAvailable = unlockState.ok;
  const unlockedSkillId = node.effects.find((effect) => Boolean(effect.unlockSkillId))?.unlockSkillId;
  const unlockedSkill = unlockedSkillId ? SKILLS.find((skill) => skill.id === unlockedSkillId) : null;
  const resourceCost = unlockedSkill?.resourceEffect?.cost ?? 0;
  const consumeAllResource = Boolean(unlockedSkill?.resourceEffect?.consumeAll);
  const hasResourceCost = consumeAllResource || resourceCost > 0;
  const resourceLabel = unlockedSkill?.resourceLabel ?? player.classResource.name;

  return (
    <button
      onClick={() => isAvailable && onUnlockTalent(node.id)}
      disabled={!isAvailable}
      className={`rounded-[20px] border p-3 text-left transition-all ${isUnlocked
        ? 'border-transparent text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)]'
        : isAvailable
          ? 'border-[#cfab91] bg-[#fff7ed] text-[#6b3141] hover:-translate-y-0.5 hover:border-[#b98774]'
          : 'border-[#dcc0aa] bg-[#f4e7d5] text-[#8f6c67]'}`}
      style={isUnlocked ? { background: `linear-gradient(135deg, ${node.color}, #6b3141)` } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-xl ${isUnlocked ? 'border-white/25 bg-white/10' : 'border-[#dcc0aa] bg-[#f8eddf]'}`}>
            {node.icon}
          </div>
          <div>
            <div className={`text-[9px] font-black uppercase tracking-[0.22em] ${isUnlocked ? 'text-white/70' : 'text-[#9a7068]'}`}>Tier {node.tier}</div>
            <div className={`mt-1 text-base font-black ${isUnlocked ? 'text-white' : 'text-[#6b3141]'}`}>{node.title}</div>
            <div className={`mt-1 text-xs leading-snug ${isUnlocked ? 'text-white/80' : 'text-[#7f5b56]'}`}>{node.description}</div>
          </div>
        </div>
        <div className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${isUnlocked ? 'border-white/25 bg-white/10 text-white' : isAvailable ? 'border-emerald-400/35 bg-emerald-50 text-emerald-700' : 'border-[#dcc0aa] bg-[#f8eddf] text-[#8f6c67]'}`}>
          {isUnlocked ? 'Ativo' : isAvailable ? 'Liberar' : `Nv ${node.requiredLevel}`}
        </div>
      </div>
      {!isUnlocked && node.prerequisites.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a7068]">
          <Lock size={12} />
          Segue a trilha
        </div>
      )}
      {hasResourceCost && (
        <div className={`mt-2 inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${isUnlocked ? 'text-white border-white/35 bg-white/10' : ''}`} style={isUnlocked ? undefined : { borderColor: `${player.classResource.color}66`, backgroundColor: `${player.classResource.color}1f`, color: player.classResource.color }}>
          {resourceLabel} {consumeAllResource ? 'Total' : resourceCost}
        </div>
      )}
    </button>
  );
};

const TrailSection = ({
  trail,
  player,
  onUnlockTalent,
}: {
  trail: ClassTalentTrail;
  player: Player;
  onUnlockTalent: (nodeId: string) => void;
}) => (
  <section className="rounded-[24px] border border-[#cfab91] bg-[#fff7ed] p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: trail.color }}>{trail.name}</div>
        <h3 className="mt-1 text-lg font-black text-[#6b3141]">{trail.description}</h3>
      </div>
      <div className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]" style={{ borderColor: `${trail.color}55`, backgroundColor: `${trail.color}18`, color: trail.color }}>
        Trilha
      </div>
    </div>
    <div className="mt-4 grid gap-3">
      {trail.nodes.map((node) => (
        <ConstellationNodeCard key={node.id} node={node} player={player} onUnlockTalent={onUnlockTalent} />
      ))}
    </div>
  </section>
);

const ClassGuideModal = ({
  player,
  onClose,
}: {
  player: Player;
  onClose: () => void;
}) => {
  const currentClass = getPlayerClassById(player.classId);
  const constellation = getConstellationByClassId(player.classId);
  const guide = CLASS_GUIDES[player.classId];
  const constellationSkills = player.skills.filter((skill) => skill.source === 'constellation');

  return (
    <div className="absolute inset-0 z-[120] flex items-center justify-center bg-[#2e1820]/52 p-3 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[28px] border border-[#c59d82] bg-[#f8eddf] shadow-[0_28px_80px_rgba(54,26,33,0.28)]">
        <div
          className="flex items-start justify-between gap-4 px-5 py-5 text-white"
          style={{ background: `linear-gradient(135deg, ${currentClass.visualProfile.secondaryColor}, ${constellation.resource.color}, #6b3141)` }}
        >
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/75">Guia da classe</div>
            <h3 className="mt-2 text-2xl font-black">{guide.title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85">{guide.summary}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/18"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(92vh-7.5rem)] overflow-y-auto p-5 custom-scrollbar">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Classe" value={currentClass.name} tone="text-[#6b3141]" />
            <SummaryCard label="Recurso unico" value={constellation.resource.name} tone="text-[#346c7f]" />
            <SummaryCard label="Skills da constelacao" value={constellationSkills.length} tone="text-[#7c4c76]" />
          </div>

          <section className="mt-4 rounded-[24px] border border-[#cfab91] bg-[#fff7ed] p-4">
            <div className="flex items-center gap-2 text-sm font-black text-[#6b3141]">
              <WandSparkles size={18} />
              Como essa classe joga
            </div>
            <div className="mt-3 grid gap-2">
              {guide.gameplayLoop.map((entry) => (
                <div key={entry} className="rounded-[16px] border border-[#dcc0aa] bg-[#f8eddf] px-3 py-2 text-sm leading-relaxed text-[#7f5b56]">
                  {entry}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-[24px] border border-[#cfab91] bg-[#fff7ed] p-4">
            <div className="flex items-center gap-2 text-sm font-black text-[#6b3141]">
              <Sparkles size={18} />
              Habilidades unicas da classe
            </div>
            <div className="mt-3 grid gap-3">
              {guide.uniqueAbilities.map((ability) => (
                <article key={ability.name} className="rounded-[18px] border border-[#dcc0aa] bg-[#f8eddf] p-4">
                  <div className="text-sm font-black text-[#6b3141]">{ability.name}</div>
                  <p className="mt-2 text-sm leading-relaxed text-[#7f5b56]">{ability.detail}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export const CharacterSheetModal = ({ player, shopItems: _shopItems, onClose, onOpenInventory, onUnlockTalent }: CharacterSheetModalProps) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [showClassGuide, setShowClassGuide] = useState(false);
  const currentClass = getPlayerClassById(player.classId);
  const constellation = getConstellationByClassId(player.classId);
  const classGuide = CLASS_GUIDES[player.classId];

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
      .filter((entry): entry is { card: ProgressionCard; count: number } => Boolean(entry.card));
  }, [player.chosenCards]);

  const profileTabs: Array<{ id: ProfileTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Status', icon: <GameAssetIcon name="heart" size={20} /> },
    { id: 'cards', label: 'Cartas', icon: <GameAssetIcon name="scroll" size={20} /> },
    { id: 'skills', label: 'Skills', icon: <GameAssetIcon name="bookAlt" size={20} /> },
    { id: 'constellation', label: 'Constelacao', icon: <Orbit size={18} /> },
  ];

  const unlockedNodes = constellation.trails.flatMap((trail) => trail.nodes).filter((node) => player.unlockedTalentNodeIds.includes(node.id));
  const constellationSkills = player.skills.filter((skill) => skill.source === 'constellation');

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
      <div className="flex flex-col gap-3 pb-14 md:pb-0">
        <div className="hidden flex-wrap gap-2 px-1 md:flex">
          {profileTabs.map((tab) => (
            <RpgMenuTab key={tab.id} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className="inline-flex items-center gap-2">
              {tab.icon} {tab.label}
            </RpgMenuTab>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid gap-3 rounded-[24px] border border-[#c59d82] bg-[#f8eddf] p-4 lg:grid-cols-[15rem_minmax(0,1fr)_15rem]">
            <div className="grid content-start gap-3">
              <div className="rounded-[20px] border border-[#cfab91] bg-[#fff7ed] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7068]">Heroi</div>
                <h3 className="mt-1 text-lg font-black text-[#6b3141]">{player.name}</h3>
                <div className="mt-1 text-xs font-bold text-[#8a5a57]">{currentClass.name} • {currentClass.title}</div>
                <div className="mt-3 grid gap-3 border-t border-[#dcc0aa] pt-3">
                  <ResourceBar label="XP" value={player.xp} max={player.xpToNext} track="bg-[linear-gradient(90deg,#7d3d4d,#c89a66)]" />
                  <ResourceBar label="HP" value={player.stats.hp} max={player.stats.maxHp} track="bg-[linear-gradient(90deg,#8d2f46,#d17482)]" />
                  <ResourceBar label="Mana" value={player.stats.mp} max={player.stats.maxMp} track="bg-[linear-gradient(90deg,#2b6878,#66b8d2)]" />
                  <ResourceBar label={player.classResource.name} value={player.classResource.value} max={player.classResource.max} track="bg-[linear-gradient(90deg,#4c1d95,#c084fc)]" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <SummaryCard label="Ataque" value={player.stats.atk} tone="text-[#b83a4b]" />
                <SummaryCard label="Defesa" value={player.stats.def} tone="text-[#4d6780]" />
                <SummaryCard label="Veloc." value={player.stats.speed} tone="text-[#7c4c76]" />
                <SummaryCard label="Sorte" value={player.stats.luck} tone="text-[#b26a2e]" />
              </div>
            </div>

            <div className="flex min-h-[24rem] items-center justify-center rounded-[24px] border border-[#cfab91] bg-[#fff7ed] p-2">
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
                />
              </div>
            </div>

            <div className="grid content-start gap-2.5">
              <RpgMenuSectionTitle className="px-1">Equipamentos</RpgMenuSectionTitle>
              {equipmentSlots.map((slot) => (
                <EquipmentCard key={slot.label} label={slot.label} item={slot.item} type={slot.type} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'cards' && (
          <ScrollArea className="h-full" viewportClassName="p-1 sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <SummaryCard label="Escolhas" value={player.chosenCards.length} tone="text-[#6b3141]" />
                <SummaryCard label="Unicas" value={selectedCards.length} tone="text-[#346c7f]" />
                <SummaryCard label="Skills" value={player.skills.length} tone="text-[#7c4c76]" />
              </div>

              {selectedCards.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {selectedCards.map(({ card, count }) => {
                    const category = getCardCategoryBadge(card);
                    return (
                    <article key={card.id} className="rounded-[20px] border border-[#cfab91] bg-[#f7ecdd] p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.35em] text-[#9a7068]">{getRarityLabel(card.rarity)}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${category.color}`}>
                              {category.icon}
                              {category.label}
                            </span>
                            {count > 1 && <span className="rounded-md border border-amber-400/40 bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-700">x{count}</span>}
                          </div>
                          <h3 className="mt-2 text-lg font-black text-[#6b3141]">{card.name}</h3>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-[#7f5b56]">{card.description}</p>
                      <div className="mt-3 rounded-xl border border-[#dcc0aa] bg-[#f4e5d4] px-3 py-2 text-sm font-semibold text-[#6b3141]">
                        {getCardEffectPreview(card)}
                      </div>
                    </article>
                  )})}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#c59d82] bg-[#f4e7d5] px-6 py-12 text-center text-[#8f6c67]">
                  Nenhuma carta registrada ainda.
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {activeTab === 'skills' && (
          <ScrollArea className="h-full" viewportClassName="p-1 sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <SummaryCard label="Total" value={player.skills.length} tone="text-[#7c4c76]" />
                <SummaryCard label="Classe" value={constellationSkills.length} tone="text-[#8d5e29]" />
                <SummaryCard label="Mana" value={player.stats.mp} tone="text-[#346c7f]" />
                <SummaryCard label="Classe" value={currentClass.name} tone="text-[#6b3141]" />
              </div>

              {player.skills.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {player.skills.map((skill) => (
                    <article key={skill.id} className="flex items-start gap-4 rounded-[20px] border border-[#cfab91] bg-[#f7ecdd] p-4 shadow-sm">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: skill.trailColor ?? '#c4b5fd', backgroundColor: `${skill.trailColor ?? '#ede9fe'}22`, color: skill.trailColor ?? '#7c3aed' }}>
                        <Sparkles size={28} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-base font-black text-[#6b3141]">{skill.name}</span>
                          <span className="shrink-0 rounded-md border border-[#8eb4c0] bg-[#dceff2] px-2 py-0.5 text-xs font-black text-[#346c7f]">{skill.manaCost} MP</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ borderColor: skill.trailColor ?? '#c4b5fd', backgroundColor: `${skill.trailColor ?? '#ede9fe'}22`, color: skill.trailColor ?? '#7c3aed' }}>{skill.type}</span>
                          <span className="rounded-full border border-[#cfab91] bg-[#f7ecdd] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#9a7068]">Lvl {skill.minLevel}+</span>
                          {skill.source === 'constellation' && <span className="rounded-full border border-[#cfab91] bg-[#f4e5d4] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#8d5e29]">Constelacao</span>}
                        </div>
                        <p className="mt-2 text-sm leading-snug text-[#7f5b56]">{skill.description}</p>
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

        {activeTab === 'constellation' && (
          <ScrollArea className="h-full" viewportClassName="p-1 sm:p-6">
            <div className="flex flex-col gap-4">
              <section className="overflow-hidden rounded-[28px] border border-[#cfab91] bg-[#fff7ed] shadow-sm">
                <div className="px-5 py-5 text-white" style={{ background: `linear-gradient(135deg, ${constellation.trails[0]?.color ?? '#6b3141'}, ${player.classResource.color}, #6b3141)` }}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/75">Constelacao de Classe</div>
                      <h3 className="mt-2 text-2xl font-black">{currentClass.name}</h3>
                      <p className="mt-2 max-w-2xl text-sm text-white/80">{constellation.subtitle}</p>
                    </div>
                    <button
                      onClick={() => setShowClassGuide(true)}
                      className="inline-flex items-center gap-2 rounded-[16px] border border-white/18 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-white/18"
                    >
                      <CircleHelp size={16} />
                      Ver guia da classe
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 px-4 py-4 sm:grid-cols-4">
                  <div className="sm:col-span-4 flex flex-wrap gap-1.5">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#8d5e29]">
                      <span className="text-[#9a7068]">Pontos</span>
                      <span className="text-[#6b3141]">{player.talentPoints}</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#6b3141]">
                      <span className="text-[#9a7068]">Nodos</span>
                      <span>{unlockedNodes.length}</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#7c4c76]">
                      <span className="text-[#9a7068]">Skills</span>
                      <span>{constellationSkills.length}</span>
                    </div>
                    <div
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
                      style={{ borderColor: `${player.classResource.color}66`, backgroundColor: `${player.classResource.color}1a`, color: player.classResource.color }}
                    >
                      <span className="text-[#9a7068]">{player.classResource.name}</span>
                      <span>{player.classResource.value}/{player.classResource.max}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-[#cfab91] bg-[#fff7ed] p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-2 text-sm font-black text-[#6b3141]">
                      <CircleHelp size={18} />
                      {player.classId === 'ranger' ? 'Guia da classe Ranger' : `Habilidades unicas de ${currentClass.name}`}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#7f5b56]">{classGuide.summary}</p>
                  </div>
                  <button
                    onClick={() => setShowClassGuide(true)}
                    className="rounded-[16px] border border-[#cfab91] bg-[#f4e5d4] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#6b3141] transition-colors hover:bg-[#ead8c6]"
                  >
                    Abrir explicacao completa
                  </button>
                </div>

                {player.classId !== 'ranger' && (
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {classGuide.uniqueAbilities.map((ability) => (
                      <article key={ability.name} className="rounded-[18px] border border-[#dcc0aa] bg-[#f8eddf] p-4">
                        <div className="text-sm font-black text-[#6b3141]">{ability.name}</div>
                        <p className="mt-2 text-sm leading-relaxed text-[#7f5b56]">{ability.detail}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <div className="rounded-[24px] border border-[#cfab91] bg-[#f4e5d4] p-4">
                <div className="flex items-center gap-2 text-sm font-black text-[#6b3141]">
                  <Orbit size={18} />
                  Trilhas cromaticas da build
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#7f5b56]">
                  Cada nivel rende pontos de constelacao. Misture nodos entre trilhas para criar sua assinatura de batalha sem perder cartas, equipamentos e habilidades que o jogo ja possui.
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {constellation.trails.map((trail) => (
                  <TrailSection key={trail.id} trail={trail} player={player} onUnlockTalent={onUnlockTalent} />
                ))}
              </div>
            </div>
          </ScrollArea>
        )}

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
                  <span className={`transition-all duration-200 ${isActive ? 'scale-105' : 'opacity-80'}`}>{tab.icon}</span>
                  {!isActive && <span className="mt-0.5 text-[9px] font-black uppercase tracking-[0.12em] opacity-70">{tab.label}</span>}
                </button>
              );
            })}

            <div className="mx-0.5 h-6 w-px bg-[#c59d82]/40" />

            <button onClick={onOpenInventory} className="flex flex-col items-center justify-center rounded-[14px] px-3 py-1.5 text-[#8f6c67] transition-all duration-200">
              <GameAssetIcon name="bag" size={20} className="opacity-80" />
              <span className="mt-0.5 text-[9px] font-black uppercase tracking-[0.12em] opacity-70">Mochila</span>
            </button>
          </div>
        </div>

        {showClassGuide && <ClassGuideModal player={player} onClose={() => setShowClassGuide(false)} />}
      </div>
    </RpgMenuShell>
  );
};
