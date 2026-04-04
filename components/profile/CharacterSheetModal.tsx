import React, { useEffect, useMemo, useState } from 'react';
import { CircleHelp, Coins, Crosshair, Heart, Lock, Orbit, RefreshCcw, Shield, Sparkles, Star, Sword, WandSparkles, X, Zap } from 'lucide-react';
import { ALL_CARDS } from '../../game/data/cards';
import { getConstellationByClassId } from '../../game/data/classTalents';
import { getPlayerClassById } from '../../game/data/classes';
import { canUnlockTalentNode } from '../../game/mechanics/classProgression';
import { getEquipmentBonuses } from '../../game/mechanics/equipmentBonuses';
import { SKILLS } from '../../constants';
import { ClassTalentTrail, Item, Player, PlayerClassId, ProgressionCard, TalentNode } from '../../types';
import { DeveloperHeroScene } from '../Scene3D';
import { GameAssetIcon } from '../ui/game-asset-icon';
import { getCardEffectPreview, getRarityColor, getRarityLabel, ItemTypeIcon } from '../ui/game-display';
import { RpgMenuSectionTitle, RpgMenuShell, RpgMenuTab } from '../ui/rpg-menu-shell';
import { ScrollArea } from '../ui/scroll-area';

type CharacterSheetModalProps = {
  player: Player;
  shopItems: Item[];
  onClose: () => void;
  onOpenInventory: (initialFilter?: 'all' | 'equipment' | 'potion' | 'material') => void;
  onUnlockTalent: (nodeId: string) => void;
  onResetTalents: () => void;
  isClosing?: boolean;
  restrictToStatusOnly?: boolean;
  allowInventory?: boolean;
  allowCardsTab?: boolean;
  allowSkillsTab?: boolean;
  allowConstellationTab?: boolean;
  initialTab?: ProfileTab;
  respecUnlockPromptActive?: boolean;
  onAcknowledgeRespecUnlock?: () => void;
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

const SummaryCard = ({
  label,
  value,
  tone,
  icon,
  panel,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  icon?: React.ReactNode;
  panel?: string;
}) => (
  <div className={`rounded-[16px] border px-3 py-2.5 ${panel ?? 'border-[#cfab91] bg-[#fff7ed]'}`}>
    <div className="flex items-center gap-1.5">
      {icon}
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a7068]">{label}</div>
    </div>
    <div className={`mt-1 text-xl font-black ${tone ?? 'text-[#6b3141]'}`}>{value}</div>
  </div>
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

const getEquipmentBonusMeta = (item: Item | null): Array<{ icon: React.ReactNode; label: string; value: string; chip: string; valueTone: string }> => {
  if (!item) return [];

  const bonuses = getEquipmentBonuses(item);
  const chips: Array<{ icon: React.ReactNode; label: string; value: string; chip: string; valueTone: string }> = [];

  if (bonuses.atk > 0) {
    chips.push({
      icon: <Sword size={12} />,
      label: 'ATK',
      value: `+${bonuses.atk}`,
      chip: 'border-[#e4adb6] bg-[#fbe9ec]',
      valueTone: 'text-[#b83a4b]',
    });
  }
  if (bonuses.def > 0) {
    chips.push({
      icon: <Shield size={12} />,
      label: 'DEF',
      value: `+${bonuses.def}`,
      chip: 'border-[#b9c8d7] bg-[#ebf2f8]',
      valueTone: 'text-[#4d6780]',
    });
  }
  if (bonuses.speed > 0) {
    chips.push({
      icon: <Zap size={12} />,
      label: 'VEL',
      value: `+${bonuses.speed}`,
      chip: 'border-[#d3bfd8] bg-[#f3eaf5]',
      valueTone: 'text-[#7c4c76]',
    });
  }
  if (bonuses.maxHp > 0) {
    chips.push({
      icon: <Heart size={12} />,
      label: 'HP',
      value: `+${bonuses.maxHp}`,
      chip: 'border-[#b9d8b9] bg-[#eaf8ea]',
      valueTone: 'text-[#2f7d32]',
    });
  }
  if (bonuses.maxMp > 0) {
    chips.push({
      icon: <WandSparkles size={12} />,
      label: 'MP',
      value: `+${bonuses.maxMp}`,
      chip: 'border-[#b9d1df] bg-[#e8f4fb]',
      valueTone: 'text-[#346c7f]',
    });
  }

  return chips;
};

const EquipmentCard = ({ label, item, type, onClick }: { label: string; item: Item | null; type: Item['type']; onClick?: () => void }) => {
  const bonuses = getEquipmentBonusMeta(item);
  const Component = onClick ? 'button' : 'div';

  return (
  <Component onClick={onClick} className={`relative flex w-full items-center gap-3 overflow-hidden rounded-[18px] border px-3 py-3 text-left transition-all duration-200 ${item ? `${getRarityColor(item.rarity)} bg-[#f4e5d4]` : 'border-[#cfab91] bg-[#f7ecdd] text-[#8f6c67]'} ${onClick ? 'group cursor-pointer hover:-translate-y-[1px] hover:border-[#b98774] hover:bg-[#efdfcd] hover:shadow-[0_10px_22px_rgba(107,49,65,0.14)] active:scale-[0.99]' : ''}`}>
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#dcc0aa] bg-[#f8eddf] transition-transform duration-200 ${onClick ? 'group-hover:scale-105 group-active:scale-95' : ''}`}>
      {item ? <span className="text-2xl leading-none">{item.icon}</span> : <ItemTypeIcon type={type} size={18} />}
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[8px] font-black uppercase tracking-[0.14em] text-[#8a5a57]">{label}</div>
      <div className="mt-0.5 truncate text-sm font-black text-[#6b3141]">{item ? item.name : 'Vazio'}</div>
      {bonuses.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {bonuses.map((bonus) => (
            <div key={`${bonus.label}-${bonus.value}`} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${bonus.chip} ${bonus.valueTone}`}>
              {bonus.icon}
              {bonus.label} {bonus.value}
            </div>
          ))}
        </div>
      )}
    </div>
    {onClick && (
      <span className="pointer-events-none absolute right-2 top-2 hidden items-center gap-1 rounded-full border border-[#d6b9a3] bg-[#f8eddf]/95 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#8a5a57] opacity-0 transition-opacity group-hover:opacity-100 lg:inline-flex">
        <GameAssetIcon name="bag" size={12} />
        Mochila
      </span>
    )}
  </Component>
  );
};

const getCardCategoryBadge = (card: ProgressionCard) => {
  if (card.category === 'economia') return { icon: <Coins size={14} />, label: 'Economia', color: 'text-amber-700 border-amber-300 bg-amber-100' };
  if (card.category === 'atributo') return { icon: <Heart size={14} />, label: 'Atributos', color: 'text-emerald-700 border-emerald-300 bg-emerald-100' };
  if (card.category === 'batalha') return { icon: <Crosshair size={14} />, label: 'Combate', color: 'text-rose-700 border-rose-300 bg-rose-100' };
  return { icon: <Sparkles size={14} />, label: 'Especial', color: 'text-sky-700 border-sky-300 bg-sky-100' };
};

const getProfileTabIconClass = (active: boolean) => {
  if (!active) return 'opacity-80';
  return 'rounded-full border-2 border-white bg-white/80 p-0.5 shadow-[0_4px_10px_rgba(40,20,25,0.2)]';
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
  const [unlockFlash, setUnlockFlash] = useState(false);
  const isUnlocked = player.unlockedTalentNodeIds.includes(node.id);
  const unlockState = canUnlockTalentNode(player, node.id);
  const isAvailable = unlockState.ok;
  const classAccentColor = getPlayerClassById(player.classId).visualProfile.secondaryColor;
  const unlockedSkillId = node.effects.find((effect) => Boolean(effect.unlockSkillId))?.unlockSkillId;
  const unlockedSkill = unlockedSkillId ? SKILLS.find((skill) => skill.id === unlockedSkillId) : null;
  const resourceCost = unlockedSkill?.resourceEffect?.cost ?? 0;
  const consumeAllResource = Boolean(unlockedSkill?.resourceEffect?.consumeAll);
  const hasResourceCost = consumeAllResource || resourceCost > 0;
  const resourceLabel = unlockedSkill?.resourceLabel ?? player.classResource.name;
  const availableCostStyle: React.CSSProperties = {
    borderColor: `${player.classResource.color}66`,
    backgroundColor: `${player.classResource.color}22`,
    color: player.classResource.color,
  };

  const handleUnlockClick = () => {
    if (!isAvailable) {
      return;
    }

    setUnlockFlash(true);
    window.setTimeout(() => {
      setUnlockFlash(false);
    }, 980);
    onUnlockTalent(node.id);
  };

  return (
    <button
      onClick={handleUnlockClick}
      disabled={!isAvailable}
      className={`relative overflow-hidden rounded-[20px] border p-3 text-left transition-all ${isUnlocked
        ? 'border-transparent text-white shadow-[0_16px_34px_rgba(15,23,42,0.18)]'
        : isAvailable
          ? 'border-[#cfab91] bg-[#fff7ed] text-[#6b3141] hover:-translate-y-0.5 hover:border-[#b98774] hover:shadow-[0_10px_24px_rgba(239,189,93,0.28)]'
          : 'border-[#dcc0aa] bg-[#f4e7d5] text-[#8f6c67]'}`}
      style={isUnlocked ? { background: `linear-gradient(135deg, ${node.color}, #6b3141)` } : undefined}
    >
      {unlockFlash && (
        <span
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            animation: 'constellationUnlockFlash 980ms ease-out forwards',
            background: `radial-gradient(circle at center, rgba(255,255,255,0.92) 0%, ${classAccentColor}bb 42%, transparent 84%)`,
          }}
        />
      )}
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
          {isUnlocked ? 'Ativo' : isAvailable ? 'Liberar' : 'Bloqueado'}
        </div>
      </div>
      <div
        className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
          isUnlocked
            ? 'border-white/30 bg-white/10 text-white'
            : isAvailable
              ? ''
              : 'border-[#cfab91] bg-[#f4e5d4] text-[#8d5e29]'
        }`}
        style={isUnlocked ? undefined : isAvailable ? availableCostStyle : undefined}
      >
        Custo {node.cost} PE
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
            <SummaryCard label="Habilidades da constelacao" value={constellationSkills.length} tone="text-[#7c4c76]" />
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

export const CharacterSheetModal = ({ player, shopItems: _shopItems, onClose, onOpenInventory, onUnlockTalent, onResetTalents, isClosing = false, restrictToStatusOnly = false, allowInventory = false, allowCardsTab = false, allowSkillsTab = false, allowConstellationTab = false, initialTab = 'overview', respecUnlockPromptActive = false, onAcknowledgeRespecUnlock }: CharacterSheetModalProps) => {
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [showClassGuide, setShowClassGuide] = useState(false);
  const [showRespecUnlockPrompt, setShowRespecUnlockPrompt] = useState(false);
  const [showRespecConfirm, setShowRespecConfirm] = useState(false);
  const isStatusOnlyMode = Boolean(restrictToStatusOnly);
  const canAccessCards = !isStatusOnlyMode || allowCardsTab;
  const canAccessSkills = !isStatusOnlyMode || allowSkillsTab;
  const canOpenInventory = !isStatusOnlyMode || allowInventory;
  const currentClass = getPlayerClassById(player.classId);
  const constellation = getConstellationByClassId(player.classId);
  const classGuide = CLASS_GUIDES[player.classId];
  const classAccentColor = currentClass.visualProfile.secondaryColor;

  useEffect(() => {
    if (isStatusOnlyMode && !allowCardsTab && !allowSkillsTab && !(allowConstellationTab && activeTab === 'constellation') && activeTab !== 'overview') {
      setActiveTab('overview');
    }
    if (isStatusOnlyMode && activeTab !== 'overview' && activeTab !== 'cards' && activeTab !== 'skills' && !(allowConstellationTab && activeTab === 'constellation')) {
      setActiveTab('overview');
    }
    if (isStatusOnlyMode && !allowCardsTab && activeTab === 'cards') {
      setActiveTab('overview');
    }
    if (isStatusOnlyMode && !allowSkillsTab && activeTab === 'skills') {
      setActiveTab('overview');
    }
  }, [activeTab, allowCardsTab, allowConstellationTab, allowSkillsTab, isStatusOnlyMode]);

  useEffect(() => {
    if (initialTab === 'cards' && canAccessCards) {
      setActiveTab('cards');
      return;
    }

    if (initialTab === 'skills' && canAccessSkills) {
      setActiveTab('skills');
      return;
    }

    if (initialTab === 'constellation' && (!isStatusOnlyMode || allowConstellationTab)) {
      setActiveTab('constellation');
      return;
    }

    setActiveTab('overview');
  }, [allowConstellationTab, canAccessCards, canAccessSkills, initialTab, isStatusOnlyMode]);

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
    { id: 'skills', label: 'Habilidades', icon: <GameAssetIcon name="bookAlt" size={20} /> },
    { id: 'constellation', label: 'Constelacao', icon: <Orbit size={18} /> },
  ];
  const visibleTabs = profileTabs.filter((tab) => {
    if (tab.id === 'overview') return true;
    if (tab.id === 'cards') return canAccessCards;
    if (tab.id === 'skills') return canAccessSkills;
    return !isStatusOnlyMode || allowConstellationTab;
  });

  const unlockedNodes = constellation.trails.flatMap((trail) => trail.nodes).filter((node) => player.unlockedTalentNodeIds.includes(node.id));
  const constellationSkills = player.skills.filter((skill) => skill.source === 'constellation');
  const canResetTalents = unlockedNodes.length >= 2;
  const panelMotionStyle: React.CSSProperties = {
    animation: 'profileTabPanelIn 340ms cubic-bezier(0.22, 1, 0.36, 1)',
    willChange: 'transform, opacity',
  };
  const handleOpenInventoryEquipment = () => onOpenInventory('equipment');

  useEffect(() => {
    if (!respecUnlockPromptActive) {
      return;
    }
    setShowRespecUnlockPrompt(true);
  }, [respecUnlockPromptActive]);

  return (
    <RpgMenuShell
      title="Perfil"
      subtitle={`${currentClass.name} • Nivel ${player.level}`}
      onClose={onClose}
      closing={isClosing}
      accent="wine"
      headerStyle={{ background: `linear-gradient(135deg, ${classAccentColor}, #6b3141)` }}
      valueBadge={<><GameAssetIcon name="book" size={24} /> {player.name}</>}
    >
      <div className="flex flex-col gap-3 pb-0">
        <style>{`
          @keyframes profileTabPanelIn {
            0% {
              opacity: 0;
              transform: translateY(14px) scale(0.982);
              filter: blur(1.2px);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }
          @keyframes constellationPointsPulse {
            0% {
              transform: translateY(0) scale(1);
              box-shadow: 0 10px 22px rgba(0, 0, 0, 0.16);
            }
            50% {
              transform: translateY(-2px) scale(1.03);
              box-shadow: 0 16px 30px rgba(0, 0, 0, 0.2);
            }
            100% {
              transform: translateY(0) scale(1);
              box-shadow: 0 10px 22px rgba(0, 0, 0, 0.16);
            }
          }
          @keyframes constellationActionPulse {
            0% {
              transform: scale(1);
              box-shadow: 0 10px 24px rgba(232, 168, 72, 0.34);
            }
            50% {
              transform: scale(1.03);
              box-shadow: 0 16px 32px rgba(232, 168, 72, 0.44);
            }
            100% {
              transform: scale(1);
              box-shadow: 0 10px 24px rgba(232, 168, 72, 0.34);
            }
          }
          @keyframes constellationUnlockFlash {
            0% {
              opacity: 0;
              transform: scale(0.72);
            }
            24% {
              opacity: 0.95;
              transform: scale(1.08);
            }
            100% {
              opacity: 0;
              transform: scale(1.32);
            }
          }
        `}</style>

        {visibleTabs.length > 1 && (
          <div className="hidden items-center justify-between gap-3 md:flex">
            <div className="flex flex-wrap gap-2">
              {visibleTabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <RpgMenuTab
                    key={tab.id}
                    active={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative inline-flex shrink-0 items-center gap-2 ${active ? '!text-white shadow-[0_12px_24px_rgba(40,20,25,0.34)]' : ''}`}
                    style={active ? { borderColor: classAccentColor, backgroundColor: classAccentColor } : undefined}
                  >
                    <span className={`${active ? 'rounded-full px-1.5 py-0.5' : ''}`} style={active ? { backgroundColor: 'rgba(255,255,255,0.16)' } : undefined}>
                      {React.cloneElement(tab.icon as React.ReactElement, { className: getProfileTabIconClass(active), size: active ? 24 : 22 })}
                    </span>
                    {tab.label}
                    {tab.id === 'constellation' && player.talentPoints > 0 && (
                      <span
                        className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border px-1 text-[10px] font-black text-white"
                        style={{ borderColor: `${classAccentColor}cc`, backgroundColor: classAccentColor, boxShadow: `0 4px 10px ${classAccentColor}55` }}
                      >
                        {player.talentPoints}
                      </span>
                    )}
                  </RpgMenuTab>
                );
              })}
            </div>
          </div>
        )}

        {visibleTabs.length > 1 && (
          <div className="md:hidden">
            <div className="mt-1 flex items-center gap-2 overflow-x-auto pb-1">
              {visibleTabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={`mobile-tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative inline-flex shrink-0 items-center justify-center rounded-full border transition-all ${active ? 'h-14 min-w-[5.25rem] px-3.5 text-white shadow-[0_10px_20px_rgba(40,20,25,0.3)]' : 'h-12 min-w-[3.2rem] border-[#d6b9a3] bg-[#f8eddf] px-2.5'}`}
                    style={active ? { borderColor: classAccentColor, backgroundColor: classAccentColor } : undefined}
                    aria-label={tab.label}
                    title={tab.label}
                  >
                    {React.cloneElement(tab.icon as React.ReactElement, { className: getProfileTabIconClass(active), size: active ? 28 : 24 })}
                    {active && <span className="ml-2 text-xs font-black uppercase tracking-[0.1em] text-white">{tab.label}</span>}
                    {tab.id === 'constellation' && player.talentPoints > 0 && (
                      <span
                        className="absolute right-1 top-1 inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full border px-1 text-[9px] font-black text-white"
                        style={{ borderColor: `${classAccentColor}cc`, backgroundColor: classAccentColor, boxShadow: `0 4px 10px ${classAccentColor}55` }}
                      >
                        {player.talentPoints}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="grid gap-2 rounded-[24px] bg-[#f8eddf] p-2 lg:grid-cols-[15rem_minmax(0,1fr)_15rem]" style={panelMotionStyle}>
            <div className="grid content-start gap-3">
              <div className="rounded-[20px] border border-[#cfab91] bg-[#fff7ed] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7068]">Heroi</div>
                <h3 className="mt-1 text-lg font-black text-[#6b3141]">{player.name}</h3>
                <div className="mt-1 text-xs font-bold text-[#8a5a57]">{currentClass.name} • {currentClass.title}</div>
                <div className="mt-3 grid gap-3 border-t border-[#dcc0aa] pt-3">
                  <ResourceBar label="XP" value={player.xp} max={player.xpToNext} track="bg-[linear-gradient(90deg,#7d3d4d,#c89a66)]" />
                  <ResourceBar label="HP" value={player.stats.hp} max={player.stats.maxHp} track="bg-[linear-gradient(90deg,#8d2f46,#d17482)]" />
                  <ResourceBar label="Mana" value={player.stats.mp} max={player.stats.maxMp} track="bg-[linear-gradient(90deg,#2b6878,#66b8d2)]" />
                  {player.classResource.max > 0 && (
                    <ResourceBar label={player.classResource.name} value={player.classResource.value} max={player.classResource.max} track="bg-[linear-gradient(90deg,#4c1d95,#c084fc)]" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <SummaryCard label="Ataque" value={player.stats.atk} tone="text-[#b83a4b]" icon={<Sword size={14} className="text-[#b83a4b]" />} panel="border-[#e4adb6] bg-[#fbe9ec]" />
                <SummaryCard label="Defesa" value={player.stats.def} tone="text-[#4d6780]" icon={<Shield size={14} className="text-[#4d6780]" />} panel="border-[#b9c8d7] bg-[#ebf2f8]" />
                <SummaryCard label="Veloc." value={player.stats.speed} tone="text-[#7c4c76]" icon={<Zap size={14} className="text-[#7c4c76]" />} panel="border-[#d3bfd8] bg-[#f3eaf5]" />
                <SummaryCard label="Sorte" value={player.stats.luck} tone="text-[#b26a2e]" icon={<Star size={14} className="text-[#b26a2e]" />} panel="border-[#dfc89e] bg-[#f9efdf]" />
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
                <EquipmentCard key={slot.label} label={slot.label} item={slot.item} type={slot.type} onClick={canOpenInventory ? handleOpenInventoryEquipment : undefined} />
              ))}
            </div>
          </div>
        )}

        {canAccessCards && activeTab === 'cards' && (
          <ScrollArea className="h-full" viewportClassName="p-1 sm:p-6" style={panelMotionStyle}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <SummaryCard label="Escolhas" value={player.chosenCards.length} tone="text-[#6b3141]" />
                <SummaryCard label="Unicas" value={selectedCards.length} tone="text-[#346c7f]" />
                <SummaryCard label="Habilidades" value={player.skills.length} tone="text-[#7c4c76]" />
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

        {canAccessSkills && activeTab === 'skills' && (
          <ScrollArea className="h-full" viewportClassName="p-1 sm:p-6" style={panelMotionStyle}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <SummaryCard label="Total" value={player.skills.length} tone="text-[#7c4c76]" />
                <SummaryCard label="Classe" value={constellationSkills.length} tone="text-[#8d5e29]" />
                <SummaryCard label="Mana" value={player.stats.mp} tone="text-[#346c7f]" />
                <SummaryCard label="Classe" value={currentClass.name} tone="text-[#6b3141]" />
              </div>

              {player.skills.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {player.skills.map((skill) => {
                    const skillTone = skill.trailColor ?? '#a855f7';
                    const resourceCost = skill.resourceEffect?.cost ?? 0;
                    const consumeAllResource = Boolean(skill.resourceEffect?.consumeAll);
                    const hasResourceCost = consumeAllResource || resourceCost > 0;
                    return (
                    <article key={skill.id} className="flex items-start gap-4 rounded-[20px] border p-4 shadow-sm" style={{ borderColor: `${skillTone}80`, backgroundColor: `${skillTone}16` }}>
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: `${skillTone}99`, backgroundColor: `${skillTone}24`, color: skillTone }}>
                        <Sparkles size={28} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-base font-black text-[#6b3141]">{skill.name}</span>
                          <span className="shrink-0 rounded-md border border-[#6aa9d4] bg-[#dff2ff] px-2 py-0.5 text-xs font-black text-[#1d5f86]">{skill.manaCost} MP</span>
                          {hasResourceCost && (
                            <span
                              className="shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-black"
                              style={{ borderColor: `${player.classResource.color}66`, backgroundColor: '#ffffff', color: player.classResource.color }}
                            >
                              {consumeAllResource ? `Toda ${skill.resourceLabel || player.classResource.name}` : `${resourceCost} ${skill.resourceLabel || player.classResource.name}`}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ borderColor: `${skillTone}80`, backgroundColor: `${skillTone}20`, color: skillTone }}>{skill.type}</span>
                          <span className="rounded-full border border-[#cfab91] bg-[#f7ecdd] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#9a7068]">Lvl {skill.minLevel}+</span>
                          {skill.source === 'constellation' && <span className="rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ borderColor: `${skillTone}70`, backgroundColor: `${skillTone}1a`, color: skillTone }}>Constelacao</span>}
                        </div>
                        <p className="mt-2 text-sm leading-snug text-[#7f5b56]">{skill.description}</p>
                      </div>
                    </article>
                  )})}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#c59d82] bg-[#f4e7d5] px-6 py-12 text-center text-[#8f6c67]">
                  Nenhuma habilidade aprendida ainda.
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {(!isStatusOnlyMode || allowConstellationTab) && activeTab === 'constellation' && (
          <ScrollArea className="h-full" viewportClassName="p-1 sm:p-6" style={panelMotionStyle}>
            <div className="flex flex-col gap-4">
              <section className="overflow-hidden rounded-[28px] border border-[#cfab91] bg-[#fff7ed] shadow-sm">
                <div className="px-5 py-5 text-white" style={{ background: `linear-gradient(135deg, ${constellation.trails[0]?.color ?? '#6b3141'}, ${player.classResource.color}, #6b3141)` }}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/75">Constelacao de Classe</div>
                      <h3 className="mt-2 text-2xl font-black">{currentClass.name}</h3>
                      <p className="mt-2 max-w-2xl text-sm text-white/80">{constellation.subtitle}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canResetTalents && (
                        <button
                          onClick={() => setShowRespecConfirm(true)}
                          className="inline-flex items-center gap-2 rounded-[16px] border border-[#f3d37e] bg-[linear-gradient(135deg,#f6c55e,#e8a848)] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#4d2a11] shadow-[0_10px_24px_rgba(232,168,72,0.38)] transition-all hover:brightness-105"
                          style={{ animation: 'constellationActionPulse 1.9s ease-in-out infinite' }}
                        >
                          <RefreshCcw size={15} />
                          Redistribuir
                        </button>
                      )}
                      <button
                        onClick={() => setShowClassGuide(true)}
                        className="inline-flex items-center gap-2 rounded-[16px] border border-white/18 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-white/18"
                      >
                        <CircleHelp size={16} />
                        Ver guia da classe
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 px-4 py-4 sm:grid-cols-4">
                  <div className="sm:col-span-4 flex flex-wrap gap-1.5">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#6b3141]">
                      <span className="text-[#9a7068]">Nodos</span>
                      <span>{unlockedNodes.length}</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-[#d6b9a3] bg-[#f8eddf] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#7c4c76]">
                        <span className="text-[#9a7068]">Habilidades</span>
                      <span>{constellationSkills.length}</span>
                    </div>
                    {player.classResource.max > 0 && (
                      <div
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
                        style={{ borderColor: `${player.classResource.color}66`, backgroundColor: `${player.classResource.color}1a`, color: player.classResource.color }}
                      >
                        <span className="text-[#9a7068]">{player.classResource.name}</span>
                        <span>{player.classResource.value}/{player.classResource.max}</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <div className="rounded-[24px] border border-[#cfab91] bg-[#f4e5d4] p-4">
                <p className="text-xs leading-relaxed text-[#7f5b56]">
                  Voce recebe 1 ponto de evolucao por nivel ganho. Cada trilha segue a ordem 1, depois 2 e depois 3, com custos de 1, 2 e 3 pontos.
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

        {/* Mobile tabs now use top selector; floating bottom tab menu removed. */}

        {showClassGuide && <ClassGuideModal player={player} onClose={() => setShowClassGuide(false)} />}
        {canOpenInventory && !showClassGuide && !showRespecUnlockPrompt && !showRespecConfirm && (
          <div className="pointer-events-none fixed bottom-4 right-4 z-[124] md:bottom-6 md:right-6">
            <button
              onClick={() => onOpenInventory('all')}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#b98774] bg-[linear-gradient(135deg,#6b3141,#7a3d4d)] px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#f7eadf] shadow-[0_14px_28px_rgba(107,49,65,0.35)] transition-all hover:-translate-y-0.5 hover:brightness-105 md:gap-2.5 md:px-5 md:py-3 md:text-sm"
              title="Abrir mochila"
            >
              <GameAssetIcon name="bag" size={18} />
              Mochila
            </button>
          </div>
        )}
        {player.talentPoints > 0 && (!isStatusOnlyMode || allowConstellationTab) && (
          <div className="pointer-events-none fixed bottom-4 left-1/2 z-[125] -translate-x-1/2 md:bottom-6 md:left-1/2 md:-translate-x-1/2">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-black uppercase tracking-[0.14em] text-white md:text-base"
              style={{
                borderColor: `${classAccentColor}cc`,
                backgroundColor: classAccentColor,
                boxShadow: `0 12px 24px ${classAccentColor}66`,
                animation: 'constellationPointsPulse 1.8s ease-in-out infinite',
              }}
            >
              <Orbit size={16} />
              <span>{player.talentPoints} PE</span>
            </div>
          </div>
        )}
        {showRespecUnlockPrompt && (
          <div className="absolute inset-0 z-[130] flex items-center justify-center bg-[#2e1820]/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(54,26,33,0.24)]" onClick={(event) => event.stopPropagation()}>
              <div className="bg-[#6b3141] px-5 py-4 text-[#f6eadc]">
                <div className="text-[10px] font-black uppercase tracking-[0.24em]">Constelacao</div>
                <h3 className="mt-1 text-2xl font-black text-white">Redistribuicao liberada</h3>
                <p className="mt-2 text-sm text-[#dcc0aa]">Voce desbloqueou o segundo nodo. Agora pode redistribuir seus pontos e testar novas rotas da classe.</p>
              </div>
              <div className="p-4">
                <button
                  onClick={() => {
                    setShowRespecUnlockPrompt(false);
                    onAcknowledgeRespecUnlock?.();
                  }}
                  className="w-full rounded-xl border border-[#7d3d4d] bg-[#6b3141] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#f7eadf] transition-colors hover:bg-[#7a3d4d]"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}
        {showRespecConfirm && (
          <div className="absolute inset-0 z-[130] flex items-center justify-center bg-[#2e1820]/55 p-4 backdrop-blur-sm" onClick={() => setShowRespecConfirm(false)}>
            <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#cfab91] bg-[#f7ecdd] shadow-[0_24px_80px_rgba(54,26,33,0.24)]" onClick={(event) => event.stopPropagation()}>
              <div className="border-b border-[#dcc0aa] px-5 py-4">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7068]">Constelacao</div>
                <h3 className="mt-1 text-2xl font-black text-[#6b3141]">Redistribuir pontos?</h3>
                <p className="mt-2 text-sm text-[#7f5b56]">Todos os nodos ativos serao resetados. Voce vai recuperar os pontos gastos para escolher novamente.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                <button
                  onClick={() => setShowRespecConfirm(false)}
                  className="rounded-xl border border-[#cfab91] bg-[#f4e5d4] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#6b3141] transition-colors hover:bg-[#e9d7c2]"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    onResetTalents();
                    setShowRespecConfirm(false);
                  }}
                  className="rounded-xl border border-[#c3903b] bg-[#eeb653] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#4d2a11] transition-colors hover:bg-[#f1bf66]"
                >
                  Redistribuir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RpgMenuShell>
  );
};
