import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Boxes, Bug, Layers3, Swords, WandSparkles } from 'lucide-react';
import { ALL_ITEMS, DUNGEON_BOSS, DUNGEON_ENEMY_DATA, ENEMY_DATA } from '../constants';
import { getRegisteredWeapon3DByItemId, REGISTERED_WEAPON_ITEMS } from '../game/data/weaponCatalog';
import { getPlayerClassById, PLAYER_CLASSES } from '../game/data/classes';
import { DungeonBossTemplate, DungeonEnemyTemplate, EnemyTemplate, PlayerAnimationAction, PlayerClassId, Rarity } from '../types';
import { DeveloperClassBuilderScene, DeveloperKitbashScene, DeveloperMonsterScene, DeveloperWeaponCalibrationScene } from './Scene3D';
import { SpriteAnimationLab } from './SpriteAnimationLab';
import type {
  DeveloperAnimationRuntimeDiagnostic,
  DeveloperKitbashAnalysis,
  DeveloperKitbashMainSlot,
  DeveloperKitbashPartSource,
  DeveloperKitbashSlot,
  DeveloperWeaponTransformControlMode,
  DeveloperWeaponTransformOverride,
} from './scene3d/types';
import { ItemPreviewThree } from './items/ItemPreviewThree';

type DeveloperTab = 'overview' | 'animation-lab' | 'monster-lab' | 'item-lab' | 'kitbash-lab' | 'sprite-lab';
type WeaponCalibrationViewMode = 'sandbox' | 'attached';

const animationActions: PlayerAnimationAction[] = ['idle', 'battle-idle', 'attack', 'defend', 'defend-hit', 'hit', 'critical-hit', 'item', 'heal', 'skill', 'evade', 'death'];
const automaticClipValue = '__automatic__';
const allBundlesValue = '__all__';
const defaultKitbashSlots: DeveloperKitbashSlot[] = ['head', 'torso', 'arms', 'legs'];
const mainKitbashSlots: DeveloperKitbashSlot[] = ['head', 'torso', 'arms', 'legs'];
const headAccessoryKitbashSlots: DeveloperKitbashSlot[] = ['hat', 'helmet', 'visor', 'mask', 'hood', 'beard'];
const otherAccessoryKitbashSlots: DeveloperKitbashSlot[] = ['cape', 'quiver', 'shoulders', 'accessory'];
const accessoryKitbashSlots: DeveloperKitbashSlot[] = [...headAccessoryKitbashSlots, ...otherAccessoryKitbashSlots];
const defaultKitbashAssignments: Partial<Record<DeveloperKitbashSlot, DeveloperKitbashPartSource>> = {
  head: 'base',
  torso: 'base',
  arms: 'base',
  legs: 'base',
  hat: 'none',
  helmet: 'none',
  visor: 'none',
  cape: 'none',
  quiver: 'none',
  mask: 'none',
  hood: 'none',
  beard: 'none',
  shoulders: 'none',
  accessory: 'none',
};
const kitbashSlotLabels: Record<DeveloperKitbashSlot, string> = {
  head: 'Cabeca',
  torso: 'Tronco',
  arms: 'Bracos',
  legs: 'Pernas',
  hat: 'Chapeu',
  helmet: 'Capacete',
  visor: 'Viseira',
  cape: 'Capa',
  quiver: 'Aljava',
  mask: 'Mascara',
  hood: 'Capuz',
  beard: 'Barba',
  shoulders: 'Ombreiras',
  accessory: 'Acessorio',
};

const createBuilderPartSelections = (classId: PlayerClassId): Record<DeveloperKitbashMainSlot, PlayerClassId> => ({
  head: classId,
  torso: classId,
  arms: classId,
  legs: classId,
});

const rarityTone: Record<Rarity, string> = {
  bronze: 'text-orange-200 border-orange-500/20 bg-orange-500/10',
  silver: 'text-slate-200 border-slate-400/20 bg-slate-400/10',
  gold: 'text-amber-200 border-amber-400/20 bg-amber-400/10',
};

const SelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) => (
  <label className="flex flex-col gap-2 text-sm">
    <span className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100 outline-none transition-colors focus:border-cyan-400/40"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </label>
);

const NumberField = ({
  label,
  value,
  onChange,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) => (
  <label className="flex flex-col gap-2 text-sm">
    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</span>
    <input
      type="number"
      value={value}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition-colors focus:border-cyan-400/40"
    />
  </label>
);

export const DeveloperConsole: React.FC = () => {
  const [tab, setTab] = useState<DeveloperTab>('overview');
  const [classId, setClassId] = useState<PlayerClassId>('knight');
  const [animationAction, setAnimationAction] = useState<PlayerAnimationAction>('idle');
  const [isHit, setIsHit] = useState(false);
  const [builderWeaponId, setBuilderWeaponId] = useState('none');
  const [builderPartSelections, setBuilderPartSelections] = useState<Record<DeveloperKitbashMainSlot, PlayerClassId>>(createBuilderPartSelections('knight'));
  const [builderRuntimeDiagnostics, setBuilderRuntimeDiagnostics] = useState<Record<string, DeveloperAnimationRuntimeDiagnostic>>({});
  const [availableAnimationClips, setAvailableAnimationClips] = useState<string[]>([]);
  const [selectedAnimationBundle, setSelectedAnimationBundle] = useState(allBundlesValue);
  const [selectedAnimationClip, setSelectedAnimationClip] = useState(automaticClipValue);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [weaponTransformCopyStatus, setWeaponTransformCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [weaponTransformGizmoEnabled, setWeaponTransformGizmoEnabled] = useState(false);
  const [weaponTransformControlMode, setWeaponTransformControlMode] = useState<DeveloperWeaponTransformControlMode>('translate');
  const [weaponCalibrationViewMode, setWeaponCalibrationViewMode] = useState<WeaponCalibrationViewMode>('attached');
  const [monsterAnimationAction, setMonsterAnimationAction] = useState<PlayerAnimationAction>('battle-idle');
  const [monsterHit, setMonsterHit] = useState(false);
  const [itemTypeFilter, setItemTypeFilter] = useState<'all' | 'weapon' | 'armor' | 'potion' | 'helmet' | 'legs' | 'shield' | 'material'>('all');
  const [weaponTransformOverride, setWeaponTransformOverride] = useState<DeveloperWeaponTransformOverride>({
    position: [0.006, 0.119, -0.059],
    rotation: [0.288, -0.394, 0.243],
    scale: 0.600,
  });
  const selectedClass = useMemo(() => getPlayerClassById(classId), [classId]);
  const monsterCatalog = useMemo(() => {
    const entries: Array<{ id: string; label: string; family: string; enemy: EnemyTemplate | DungeonEnemyTemplate | DungeonBossTemplate }> = [];

    ENEMY_DATA.forEach((enemy) => {
      entries.push({ id: `hunt:${enemy.name}`, label: enemy.name, family: 'hunt', enemy });
    });

    DUNGEON_ENEMY_DATA.forEach((enemy) => {
      entries.push({ id: `dungeon:${enemy.name}`, label: enemy.name, family: 'dungeon', enemy });
    });

    entries.push({ id: `boss:${DUNGEON_BOSS.name}`, label: DUNGEON_BOSS.name, family: 'boss', enemy: DUNGEON_BOSS });
    return entries;
  }, []);
  const [selectedMonsterId, setSelectedMonsterId] = useState(monsterCatalog[0]?.id ?? '');
  const selectedMonsterEntry = useMemo(
    () => monsterCatalog.find((entry) => entry.id === selectedMonsterId) ?? monsterCatalog[0],
    [monsterCatalog, selectedMonsterId],
  );
  const kitbashDonorCatalog = useMemo(() => {
    const classEntries = PLAYER_CLASSES.map((playerClass) => ({
      id: `class:${playerClass.id}`,
      label: playerClass.name,
      sourceType: 'class' as const,
      assets: playerClass.assets,
      color: playerClass.visualProfile.primaryColor,
      scale: 1,
      attackStyle: 'armed' as const,
    }));

    const monsterEntries = monsterCatalog.map((entry) => ({
      id: `enemy:${entry.id}`,
      label: entry.label,
      sourceType: 'enemy' as const,
      assets: entry.enemy.assets,
      color: entry.enemy.color ?? '#e2e8f0',
      scale: entry.enemy.scale ?? 1,
      attackStyle: entry.enemy.attackStyle ?? 'armed',
    }));

    return [...classEntries, ...monsterEntries];
  }, [monsterCatalog]);
  const [kitbashBaseClassId, setKitbashBaseClassId] = useState<PlayerClassId>('knight');
  const [kitbashDonorId, setKitbashDonorId] = useState(kitbashDonorCatalog[1]?.id ?? kitbashDonorCatalog[0]?.id ?? '');
  const [kitbashAnimationAction, setKitbashAnimationAction] = useState<PlayerAnimationAction>('battle-idle');
  const [kitbashAnalysis, setKitbashAnalysis] = useState<DeveloperKitbashAnalysis | null>(null);
  const [kitbashSlotAssignments, setKitbashSlotAssignments] = useState<Partial<Record<DeveloperKitbashSlot, DeveloperKitbashPartSource>>>(defaultKitbashAssignments);
  const selectedKitbashDonor = useMemo(
    () => kitbashDonorCatalog.find((entry) => entry.id === kitbashDonorId) ?? kitbashDonorCatalog[0],
    [kitbashDonorCatalog, kitbashDonorId],
  );
  const availableKitbashSlots = useMemo(
    (): DeveloperKitbashSlot[] => kitbashAnalysis?.availableSlots ?? defaultKitbashSlots,
    [kitbashAnalysis],
  );
  const availableMainKitbashSlots = useMemo(
    () => availableKitbashSlots.filter((slot) => mainKitbashSlots.includes(slot)),
    [availableKitbashSlots],
  );
  const availableAccessoryKitbashSlots = useMemo(
    () => availableKitbashSlots.filter((slot) => accessoryKitbashSlots.includes(slot)),
    [availableKitbashSlots],
  );
  const mainPartDescriptors = useMemo(
    () => (kitbashAnalysis?.donorPartDescriptors ?? []).filter((descriptor) => descriptor.tags.some((tag) => mainKitbashSlots.includes(tag))),
    [kitbashAnalysis],
  );
  const accessoryPartDescriptors = useMemo(
    () => (kitbashAnalysis?.donorPartDescriptors ?? []).filter((descriptor) => descriptor.tags.some((tag) => accessoryKitbashSlots.includes(tag))),
    [kitbashAnalysis],
  );
  const headAccessoryPartDescriptors = useMemo(
    () => accessoryPartDescriptors.filter((descriptor) => descriptor.tags.some((tag) => headAccessoryKitbashSlots.includes(tag))),
    [accessoryPartDescriptors],
  );
  const otherAccessoryPartDescriptors = useMemo(
    () => accessoryPartDescriptors.filter((descriptor) => descriptor.tags.some((tag) => otherAccessoryKitbashSlots.includes(tag))),
    [accessoryPartDescriptors],
  );

  const itemOptions = useMemo(() => (
    ALL_ITEMS.filter((item) => itemTypeFilter === 'all' ? true : item.type === itemTypeFilter)
  ), [itemTypeFilter]);
  const builderWeaponOptions = useMemo(() => ([
    { value: 'none', label: 'Nenhuma' },
    ...REGISTERED_WEAPON_ITEMS.map((item) => ({ value: item.id, label: item.name })),
  ]), []);
  const [selectedItemId, setSelectedItemId] = useState(itemOptions[0]?.id ?? ALL_ITEMS[0]?.id ?? '');

  const selectedItem = useMemo(() => (
    itemOptions.find((item) => item.id === selectedItemId) ?? ALL_ITEMS.find((item) => item.id === selectedItemId) ?? itemOptions[0] ?? ALL_ITEMS[0]
  ), [itemOptions, selectedItemId]);
  const selectedRegisteredWeapon = useMemo(
    () => (builderWeaponId === 'none' ? undefined : getRegisteredWeapon3DByItemId(builderWeaponId)),
    [builderWeaponId],
  );

  const animationBundleOptions = useMemo(() => ([
    { value: allBundlesValue, label: 'Todos os pacotes' },
    ...selectedClass.assets.animationFiles.map((fileName) => ({
      value: fileName.replace(/\.fbx$/i, ''),
      label: fileName.replace(/\.fbx$/i, ''),
    })),
  ]), [selectedClass.assets.animationFiles]);

  const filteredAnimationClipOptions = useMemo(() => {
    const filteredClips = availableAnimationClips.filter((clipName) => (
      selectedAnimationBundle === allBundlesValue
        ? true
        : clipName.startsWith(`${selectedAnimationBundle}:`)
    ));

    return [
      { value: automaticClipValue, label: 'Mapeamento automatico por acao' },
      ...filteredClips.map((clipName) => ({
        value: clipName,
        label: clipName.includes(':') ? clipName.replace(':', ' -> ') : clipName,
      })),
    ];
  }, [availableAnimationClips, selectedAnimationBundle]);

  const shouldLoadAllAnimationBundles = selectedAnimationBundle === allBundlesValue;

  useEffect(() => {
    setSelectedAnimationBundle(allBundlesValue);
    setSelectedAnimationClip(automaticClipValue);
    setAvailableAnimationClips([]);
  }, [classId]);

  useEffect(() => {
    setBuilderPartSelections(createBuilderPartSelections(classId));
    setBuilderWeaponId('none');
    setWeaponTransformGizmoEnabled(false);
    setWeaponCalibrationViewMode('attached');
  }, [classId]);

  useEffect(() => {
    setBuilderRuntimeDiagnostics({});
  }, [animationAction, classId, selectedAnimationBundle, selectedAnimationClip, builderPartSelections.arms, builderPartSelections.head, builderPartSelections.legs, builderPartSelections.torso]);

  useEffect(() => {
    if (selectedAnimationClip === automaticClipValue) {
      return;
    }

    const clipStillAvailable = filteredAnimationClipOptions.some((option) => option.value === selectedAnimationClip);

    if (!clipStillAvailable) {
      setSelectedAnimationClip(automaticClipValue);
    }
  }, [filteredAnimationClipOptions, selectedAnimationClip]);

  useEffect(() => {
    if (copyStatus === 'idle') {
      return;
    }

    const timer = window.setTimeout(() => setCopyStatus('idle'), 1800);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  useEffect(() => {
    if (weaponTransformCopyStatus === 'idle') {
      return;
    }

    const timer = window.setTimeout(() => setWeaponTransformCopyStatus('idle'), 1800);
    return () => window.clearTimeout(timer);
  }, [weaponTransformCopyStatus]);

  useEffect(() => {
    if (!selectedRegisteredWeapon) {
      setWeaponTransformGizmoEnabled(false);
      return;
    }

    setWeaponTransformGizmoEnabled(false);
    setWeaponCalibrationViewMode('attached');
    setWeaponTransformOverride({
      position: [...selectedRegisteredWeapon.handTransform.position] as [number, number, number],
      rotation: [...selectedRegisteredWeapon.handTransform.rotation] as [number, number, number],
      scale: selectedRegisteredWeapon.handTransform.scale,
    });
  }, [selectedRegisteredWeapon]);

  useEffect(() => {
    setKitbashSlotAssignments((previousAssignments) => {
      const nextAssignments: Partial<Record<DeveloperKitbashSlot, DeveloperKitbashPartSource>> = {};

      availableKitbashSlots.forEach((slot) => {
        nextAssignments[slot] = previousAssignments[slot] ?? defaultKitbashAssignments[slot] ?? (mainKitbashSlots.includes(slot) ? 'base' : 'none');
      });

      return nextAssignments;
    });
  }, [availableKitbashSlots, kitbashDonorId]);

  const handleCopySelectedClip = async () => {
    const selectedClipLabel = selectedAnimationClip === automaticClipValue ? 'automatico' : selectedAnimationClip;
    const payload = [
      `baseClassId=${classId}`,
      `action=${animationAction}`,
      `bundle=${selectedAnimationBundle === allBundlesValue ? 'all' : selectedAnimationBundle}`,
      `clip=${selectedClipLabel}`,
      `head=${builderPartSelections.head}`,
      `torso=${builderPartSelections.torso}`,
      `arms=${builderPartSelections.arms}`,
      `legs=${builderPartSelections.legs}`,
      `weapon=${builderWeaponId}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };

  const handleCopyWeaponTransform = async () => {
    const payload = `handTransform: { position: [${weaponTransformOverride.position.map((value) => value.toFixed(3)).join(', ')}], rotation: [${weaponTransformOverride.rotation.map((value) => value.toFixed(3)).join(', ')}], scale: ${weaponTransformOverride.scale.toFixed(3)} },`;

    try {
      await navigator.clipboard.writeText(payload);
      setWeaponTransformCopyStatus('copied');
    } catch {
      setWeaponTransformCopyStatus('error');
    }
  };

  const tabs: Array<{ id: DeveloperTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Hub', icon: <Bug size={16} /> },
    { id: 'animation-lab', label: 'Animacao', icon: <WandSparkles size={16} /> },
    { id: 'sprite-lab', label: 'Sprite Lab', icon: <WandSparkles size={16} /> },
    { id: 'monster-lab', label: 'Monstros 3D', icon: <Swords size={16} /> },
    { id: 'item-lab', label: 'Itens 3D', icon: <Boxes size={16} /> },
    { id: 'kitbash-lab', label: 'Kitbash', icon: <Layers3 size={16} /> },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_30%),linear-gradient(180deg,#020617_0%,#030712_45%,#000000_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="game-surface panel-glow flex flex-col gap-5 rounded-[2rem] border border-cyan-400/10 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300/75">Developer Route</div>
              <h1 className="mt-2 font-gamer text-3xl sm:text-4xl font-black text-white">Hero Adventure Dev Console</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">Ferramentas internas para validar animações de classes, pré-visualizar itens 3D e inspecionar assets do jogo sem entrar no fluxo normal da campanha.</p>
            </div>
            <a href="/" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-200 transition-colors hover:border-cyan-400/30 hover:text-white">
              <ArrowLeft size={16} /> Voltar ao jogo
            </a>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setTab(entry.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition-colors ${tab === entry.id ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
              >
                {entry.icon}
                {entry.label}
              </button>
            ))}
          </div>
        </header>

        {tab === 'overview' && (
          <section className="mt-6 grid gap-4 lg:grid-cols-4">
            <button onClick={() => setTab('animation-lab')} className="game-surface rounded-[1.75rem] border border-indigo-400/15 p-6 text-left transition-transform hover:-translate-y-1">
              <div className="game-icon-badge h-12 w-12 text-cyan-300"><WandSparkles size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Laboratorio de Animacao</h2>
              <p className="mt-3 text-sm text-slate-400">Teste `idle`, `attack`, `defend`, `item`, `heal` e `skill` com o modelo real da classe e combinações de equipamento.</p>
            </button>

            <button onClick={() => setTab('sprite-lab')} className="game-surface rounded-[1.75rem] border border-cyan-400/15 p-6 text-left transition-transform hover:-translate-y-1">
              <div className="game-icon-badge h-12 w-12 text-cyan-300"><WandSparkles size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Sprite Animation Lab</h2>
              <p className="mt-3 text-sm text-slate-400">Monte animacoes por sprite sheet com varias tracks em paralelo, preview normal/loop e exportacao JSON.</p>
            </button>
            <button onClick={() => setTab('item-lab')} className="game-surface rounded-[1.75rem] border border-emerald-400/15 p-6 text-left transition-transform hover:-translate-y-1">
              <div className="game-icon-badge h-12 w-12 text-emerald-300"><Boxes size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Inspecao de Itens 3D</h2>
              <p className="mt-3 text-sm text-slate-400">Abra qualquer arma, armadura, escudo, poção ou material em preview 3D isolado para revisar proporção e acabamento.</p>
            </button>

            <button onClick={() => setTab('monster-lab')} className="game-surface rounded-[1.75rem] border border-cyan-400/15 p-6 text-left transition-transform hover:-translate-y-1">
              <div className="game-icon-badge h-12 w-12 text-cyan-300"><Swords size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Monstros 3D</h2>
              <p className="mt-3 text-sm text-slate-400">Selecione os esqueletos do jogo para validar modelo, escala e animação de combate no preview dedicado.</p>
            </button>

            <button onClick={() => setTab('kitbash-lab')} className="game-surface rounded-[1.75rem] border border-fuchsia-400/15 p-6 text-left transition-transform hover:-translate-y-1">
              <div className="game-icon-badge h-12 w-12 text-fuchsia-300"><Layers3 size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Kitbash de Armaduras</h2>
              <p className="mt-3 text-sm text-slate-400">Compare a rig de duas fontes e valide se partes do corpo podem virar armadura ou equipamento reaproveitavel.</p>
            </button>

            <div className="game-surface rounded-[1.75rem] border border-amber-400/15 p-6">
              <div className="game-icon-badge h-12 w-12 text-amber-300"><Swords size={22} /></div>
              <h2 className="mt-4 font-gamer text-2xl font-black text-white">Cobertura Atual</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Classes</div>
                  <div className="mt-1 text-2xl font-black text-cyan-200">{PLAYER_CLASSES.length}</div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Itens</div>
                  <div className="mt-1 text-2xl font-black text-emerald-200">{ALL_ITEMS.length}</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === 'kitbash-lab' && selectedKitbashDonor && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">base: {kitbashBaseClassId}</span>
                <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-100">doador: {selectedKitbashDonor.label}</span>
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">tipo: {selectedKitbashDonor.sourceType}</span>
                <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-indigo-100">acao: {kitbashAnimationAction}</span>
              </div>
              <div className="h-[360px] sm:h-[420px] lg:h-[520px] min-[1600px]:h-[620px] rounded-[1.5rem] border border-slate-800 bg-slate-950/60">
                <DeveloperKitbashScene
                  baseClassId={kitbashBaseClassId}
                  donorLabel={selectedKitbashDonor.label}
                  animationAction={kitbashAnimationAction}
                  donorAssets={selectedKitbashDonor.assets}
                  donorColor={selectedKitbashDonor.color}
                  donorScale={selectedKitbashDonor.scale}
                  donorAttackStyle={selectedKitbashDonor.attackStyle}
                  donorType={selectedKitbashDonor.sourceType}
                  slotAssignments={kitbashSlotAssignments}
                  analysis={kitbashAnalysis}
                  onAnalysisChange={setKitbashAnalysis}
                />
              </div>
            </div>

            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5 sm:p-6 xl:sticky xl:top-6">
              <h2 className="font-gamer text-2xl font-black text-white">Teste de Kitbash</h2>
              <p className="mt-2 text-sm text-slate-400">Use uma classe como base e compare com outra classe ou inimigo para medir reaproveitamento de cabeca, tronco, bracos e pernas como armadura.</p>

              <div className="mt-6 space-y-4">
                <SelectField
                  label="Classe Base"
                  value={kitbashBaseClassId}
                  onChange={(value) => setKitbashBaseClassId(value as PlayerClassId)}
                  options={PLAYER_CLASSES.map((playerClass) => ({ value: playerClass.id, label: playerClass.name }))}
                />
                <SelectField
                  label="Modelo Doador"
                  value={kitbashDonorId}
                  onChange={setKitbashDonorId}
                  options={kitbashDonorCatalog.map((entry) => ({ value: entry.id, label: `${entry.label} (${entry.sourceType})` }))}
                />
                <SelectField
                  label="Acao"
                  value={kitbashAnimationAction}
                  onChange={(value) => setKitbashAnimationAction(value as PlayerAnimationAction)}
                  options={animationActions.map((action) => ({ value: action, label: action }))}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Montador de Novo Modelo</div>
                <div className="mt-3 space-y-3">
                  {availableMainKitbashSlots.map((slot) => (
                    <div key={slot} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{kitbashSlotLabels[slot]}</div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {([
                          { value: 'base', label: 'Base' },
                          { value: 'donor', label: 'Doador' },
                          { value: 'none', label: 'Ocultar' },
                        ] as Array<{ value: DeveloperKitbashPartSource; label: string }>).map((option) => {
                          const isActive = (kitbashSlotAssignments[slot] ?? 'base') === option.value;

                          return (
                            <button
                              key={`${slot}-${option.value}`}
                              onClick={() => setKitbashSlotAssignments((current) => ({
                                ...current,
                                [slot]: option.value,
                              }))}
                              className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${isActive ? 'border-fuchsia-400/30 bg-fuchsia-500/14 text-fuchsia-100' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {availableAccessoryKitbashSlots.length ? (
                    <div className="rounded-xl border border-amber-400/20 bg-amber-500/8 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Itens Extras do Modelo</div>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {availableAccessoryKitbashSlots.map((slot) => (
                          <div key={slot} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{kitbashSlotLabels[slot]}</div>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              {([
                                { value: 'base', label: 'Base' },
                                { value: 'donor', label: 'Doador' },
                                { value: 'none', label: 'Ocultar' },
                              ] as Array<{ value: DeveloperKitbashPartSource; label: string }>).map((option) => {
                                const isActive = (kitbashSlotAssignments[slot] ?? 'base') === option.value;

                                return (
                                  <button
                                    key={`${slot}-${option.value}`}
                                    onClick={() => setKitbashSlotAssignments((current) => ({
                                      ...current,
                                      [slot]: option.value,
                                    }))}
                                    className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${isActive ? 'border-amber-400/30 bg-amber-500/14 text-amber-100' : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 text-[11px] leading-5 text-slate-400">Os dois modelos ficam visiveis nas laterais. O modelo do meio nasce das escolhas que voce fizer em cada parte.</div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Compatibilidade</div>
                <div className="mt-2 flex items-end gap-3">
                  <div className="text-3xl font-black text-fuchsia-100">{kitbashAnalysis?.compatibilityScore ?? 0}%</div>
                  <div className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-100">{kitbashAnalysis?.compatibilityLabel ?? 'aguardando'}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="uppercase tracking-[0.18em] text-slate-500">Bones Base</div>
                    <div className="mt-1 text-lg font-black text-cyan-100">{kitbashAnalysis?.baseBoneCount ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="uppercase tracking-[0.18em] text-slate-500">Bones Doador</div>
                    <div className="mt-1 text-lg font-black text-amber-100">{kitbashAnalysis?.donorBoneCount ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="uppercase tracking-[0.18em] text-slate-500">Meshes Base</div>
                    <div className="mt-1 text-lg font-black text-cyan-100">{kitbashAnalysis?.baseMeshNames.length ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="uppercase tracking-[0.18em] text-slate-500">Meshes Doador</div>
                    <div className="mt-1 text-lg font-black text-amber-100">{kitbashAnalysis?.donorMeshNames.length ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Cobertura de Regioes</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[
                    { key: 'head', label: 'Cabeca' },
                    { key: 'torso', label: 'Tronco' },
                    { key: 'arms', label: 'Bracos' },
                    { key: 'legs', label: 'Pernas' },
                  ].map((entry) => (
                    <div key={entry.key} className={`rounded-xl border px-3 py-2 ${kitbashAnalysis?.regionCoverage[entry.key as keyof DeveloperKitbashAnalysis['regionCoverage']] ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100' : 'border-slate-800 bg-slate-900/70 text-slate-500'}`}>
                      {entry.label}: {kitbashAnalysis?.regionCoverage[entry.key as keyof DeveloperKitbashAnalysis['regionCoverage']] ? 'ok' : 'fraco'}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Diagnostico</div>
                <div className="mt-3 leading-5 text-slate-400">
                  {kitbashAnalysis
                    ? `Se a compatibilidade ficar alta e as regioes principais estiverem cobertas, o modelo doador e um bom candidato para virar armadura modular. Compatibilidade atual: ${kitbashAnalysis.compatibilityLabel}.`
                    : 'Selecione um modelo base e um doador para gerar o relatorio.'}
                </div>
                {kitbashAnalysis?.selectedSlotFitDiagnostics.length ? (
                  <div className={`mt-3 rounded-xl border px-3 py-2 ${kitbashAnalysis.hasFloatingRisk ? 'border-amber-400/20 bg-amber-500/10 text-amber-100' : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'}`}>
                    {kitbashAnalysis.hasFloatingRisk ? 'Algumas partes ainda tem risco de flutuar. O sistema aplicou ajuste automatico, mas essa combinacao merece revisao.' : 'Encaixe automatico dentro do esperado para as partes escolhidas.'}
                  </div>
                ) : null}
                <div className="mt-4 text-slate-500">Bones ausentes no doador: {kitbashAnalysis?.missingInDonor.length ?? 0}</div>
                <div className="mt-1 text-slate-500">Bones extras no doador: {kitbashAnalysis?.extraInDonor.length ?? 0}</div>
                <div className="mt-3 max-h-32 overflow-auto rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-[11px] leading-5 text-slate-400">
                  {(kitbashAnalysis?.missingInDonor.slice(0, 18) ?? []).join(', ') || 'Nenhum bone ausente relevante.'}
                </div>
                <div className="mt-3 max-h-32 overflow-auto rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-[11px] leading-5 text-slate-400">
                  {(kitbashAnalysis?.selectedSlotFitDiagnostics ?? []).map((diagnostic) => (
                    <div key={diagnostic.slot} className="mb-2 last:mb-0">
                      <span className="font-black text-slate-200">{kitbashSlotLabels[diagnostic.slot]}</span>
                      <span className={`ml-2 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${diagnostic.risk === 'high' ? 'border-rose-400/20 bg-rose-500/10 text-rose-100' : diagnostic.risk === 'warning' ? 'border-amber-400/20 bg-amber-500/10 text-amber-100' : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'}`}>{diagnostic.risk}</span>
                      <div>offset: {(diagnostic.offsetDistance * 100).toFixed(0)} | size mismatch: {(diagnostic.sizeMismatch * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                  {(kitbashAnalysis?.selectedSlotFitDiagnostics.length ?? 0) === 0 ? 'Escolha partes do doador para gerar a validacao de encaixe.' : null}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Partes Principais Detectadas</div>
                <div className="mt-3 max-h-48 overflow-auto rounded-xl border border-slate-800 bg-slate-900/70 p-3 leading-5 text-slate-400">
                  {mainPartDescriptors.slice(0, 24).map((descriptor) => (
                    <div key={`${descriptor.meshName}-${descriptor.tags.join('-')}`} className="mb-2 last:mb-0">
                      <span className="font-black text-slate-200">{descriptor.meshName}</span>
                      <span className="ml-2 text-slate-500">{descriptor.skinned ? 'skinned' : 'mesh'}</span>
                      <div>{descriptor.tags.filter((slot) => mainKitbashSlots.includes(slot)).map((slot) => kitbashSlotLabels[slot]).join(', ')}</div>
                    </div>
                  ))}
                  {mainPartDescriptors.length === 0 ? 'Nenhuma parte principal detectada ainda.' : null}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-amber-400/20 bg-slate-950/70 p-4 text-xs text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">Itens Extras Detectados</div>
                <div className="mt-2 text-[11px] leading-5 text-slate-400">Aqui ficam partes opcionais do modelo, como chapeu, bearhat, capacete, viseira, barba, mascara, capa e aljava. Elas ficam separadas da cabeca base e das partes principais.</div>
                <div className="mt-3 max-h-48 overflow-auto rounded-xl border border-slate-800 bg-slate-900/70 p-3 leading-5 text-slate-400">
                  <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Acessorios de Cabeca</div>
                  {headAccessoryPartDescriptors.slice(0, 24).map((descriptor) => (
                    <div key={`${descriptor.meshName}-${descriptor.tags.join('-')}`} className="mb-2 last:mb-0">
                      <span className="font-black text-slate-200">{descriptor.meshName}</span>
                      <span className="ml-2 text-slate-500">{descriptor.skinned ? 'skinned' : 'mesh'}</span>
                      <div>{descriptor.tags.filter((slot) => headAccessoryKitbashSlots.includes(slot)).map((slot) => kitbashSlotLabels[slot]).join(', ')}</div>
                    </div>
                  ))}
                  {headAccessoryPartDescriptors.length === 0 ? 'Nenhum acessorio de cabeca detectado neste modelo.' : null}
                  <div className="mb-3 mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Outros Itens Extras</div>
                  {otherAccessoryPartDescriptors.slice(0, 24).map((descriptor) => (
                    <div key={`${descriptor.meshName}-${descriptor.tags.join('-')}`} className="mb-2 last:mb-0">
                      <span className="font-black text-slate-200">{descriptor.meshName}</span>
                      <span className="ml-2 text-slate-500">{descriptor.skinned ? 'skinned' : 'mesh'}</span>
                      <div>{descriptor.tags.filter((slot) => otherAccessoryKitbashSlots.includes(slot)).map((slot) => kitbashSlotLabels[slot]).join(', ')}</div>
                    </div>
                  ))}
                  {otherAccessoryPartDescriptors.length === 0 ? 'Nenhum outro item extra detectado neste modelo.' : null}
                </div>
              </div>

            </div>
          </section>
        )}

        {tab === 'animation-lab' && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">base: {classId}</span>
                <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-indigo-100">acao: {animationAction}</span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                  clip: {selectedAnimationClip === automaticClipValue ? 'automatico' : selectedAnimationClip}
                </span>
                <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-100">cabeca: {builderPartSelections.head}</span>
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">tronco: {builderPartSelections.torso}</span>
                <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-sky-100">bracos: {builderPartSelections.arms}</span>
                <span className="rounded-full border border-lime-400/20 bg-lime-500/10 px-3 py-1 text-lime-100">pernas: {builderPartSelections.legs}</span>
              </div>
              <div className="h-[360px] sm:h-[420px] lg:h-[520px] min-[1600px]:h-[620px] rounded-[1.5rem] border border-slate-800 bg-slate-950/60">
                {selectedRegisteredWeapon && weaponCalibrationViewMode === 'sandbox' ? (
                  <DeveloperWeaponCalibrationScene
                    weaponId={selectedRegisteredWeapon.item.id}
                    weaponTransformOverride={weaponTransformOverride}
                    transformControlMode={weaponTransformControlMode}
                    onWeaponTransformOverrideChange={setWeaponTransformOverride}
                  />
                ) : (
                  <DeveloperClassBuilderScene
                    baseClassId={classId}
                    animationAction={animationAction}
                    partSelections={builderPartSelections}
                    equippedWeaponId={builderWeaponId === 'none' ? undefined : builderWeaponId}
                    weaponTransformOverride={builderWeaponId === 'none' ? undefined : weaponTransformOverride}
                    showWeaponAnchorHelper={builderWeaponId !== 'none'}
                    showWeaponTransformControls={builderWeaponId !== 'none' && weaponTransformGizmoEnabled}
                    weaponTransformControlMode={weaponTransformControlMode}
                    onWeaponTransformOverrideChange={setWeaponTransformOverride}
                    animationClipName={selectedAnimationClip === automaticClipValue ? undefined : selectedAnimationClip}
                    preferredAnimationBundle={shouldLoadAllAnimationBundles ? undefined : selectedAnimationBundle}
                    loadAllAnimationBundles={shouldLoadAllAnimationBundles}
                    loadSecondaryAnimationBundles={shouldLoadAllAnimationBundles}
                    onAvailableAnimationClipsChange={setAvailableAnimationClips}
                    onRuntimeDiagnosticsChange={setBuilderRuntimeDiagnostics}
                    isHit={isHit}
                  />
                )}
              </div>
            </div>

            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5 sm:p-6 xl:sticky xl:top-6">
              <h2 className="font-gamer text-2xl font-black text-white">Montador Modular</h2>
              <p className="mt-2 text-sm text-slate-400">Escolha a classe base que fornece o rig e troque cabeca, tronco, bracos e pernas de forma independente usando apenas modelos de classe.</p>

              <div className="mt-6 space-y-4">
                <SelectField label="Classe Base" value={classId} onChange={(value) => setClassId(value as PlayerClassId)} options={PLAYER_CLASSES.map((playerClass) => ({ value: playerClass.id, label: playerClass.name }))} />
                <SelectField label="Arma" value={builderWeaponId} onChange={setBuilderWeaponId} options={builderWeaponOptions} />
                <SelectField label="Cabeca" value={builderPartSelections.head} onChange={(value) => setBuilderPartSelections((current) => ({ ...current, head: value as PlayerClassId }))} options={PLAYER_CLASSES.map((playerClass) => ({ value: playerClass.id, label: playerClass.name }))} />
                <SelectField label="Tronco" value={builderPartSelections.torso} onChange={(value) => setBuilderPartSelections((current) => ({ ...current, torso: value as PlayerClassId }))} options={PLAYER_CLASSES.map((playerClass) => ({ value: playerClass.id, label: playerClass.name }))} />
                <SelectField label="Bracos" value={builderPartSelections.arms} onChange={(value) => setBuilderPartSelections((current) => ({ ...current, arms: value as PlayerClassId }))} options={PLAYER_CLASSES.map((playerClass) => ({ value: playerClass.id, label: playerClass.name }))} />
                <SelectField label="Pernas" value={builderPartSelections.legs} onChange={(value) => setBuilderPartSelections((current) => ({ ...current, legs: value as PlayerClassId }))} options={PLAYER_CLASSES.map((playerClass) => ({ value: playerClass.id, label: playerClass.name }))} />
                <SelectField
                  label="Acao"
                  value={animationAction}
                  onChange={(value) => setAnimationAction(value as PlayerAnimationAction)}
                  options={animationActions.map((action) => ({ value: action, label: action }))}
                />
                <SelectField
                  label="Pacote FBX"
                  value={selectedAnimationBundle}
                  onChange={setSelectedAnimationBundle}
                  options={animationBundleOptions}
                />
                <SelectField
                  label="Clip"
                  value={selectedAnimationClip}
                  onChange={setSelectedAnimationClip}
                  options={filteredAnimationClipOptions}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Clips carregados</div>
                <div className="mt-2 text-2xl font-black text-cyan-100">{availableAnimationClips.length}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">
                  {selectedAnimationClip === automaticClipValue
                    ? 'Modo atual: usando o mapeamento automatico baseado na acao selecionada.'
                    : `Modo atual: preview manual do clip ${selectedAnimationClip}.`}
                </div>
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs leading-5 text-slate-400">
                  Rig base: <span className="font-black text-slate-100">{classId}</span><br />
                  Mistura atual: <span className="font-black text-fuchsia-100">{builderPartSelections.head}</span> / <span className="font-black text-amber-100">{builderPartSelections.torso}</span> / <span className="font-black text-sky-100">{builderPartSelections.arms}</span> / <span className="font-black text-lime-100">{builderPartSelections.legs}</span>
                  <br />Arma ativa: <span className="font-black text-cyan-100">{builderWeaponId === 'none' ? 'nenhuma' : builderWeaponId}</span>
                </div>
                {selectedRegisteredWeapon ? (
                  <div className="mt-3 rounded-xl border border-cyan-400/20 bg-slate-900/70 p-3 text-xs leading-5 text-slate-300">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Calibrador de Mão</div>
                    <div className="mt-2 text-[11px] text-slate-400">Use Bancada para calibrar a arma isolada na origem. Depois troque para Na mao apenas para conferir o encaixe final no personagem.</div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <SelectField
                        label="Visualizacao"
                        value={weaponCalibrationViewMode}
                        onChange={(value) => setWeaponCalibrationViewMode(value as WeaponCalibrationViewMode)}
                        options={[
                          { value: 'sandbox', label: 'Bancada' },
                          { value: 'attached', label: 'Na mao' },
                        ]}
                      />
                      <button
                        onClick={() => setWeaponTransformGizmoEnabled((current) => !current)}
                        disabled={weaponCalibrationViewMode === 'sandbox'}
                        className={`rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-[0.18em] transition-colors ${weaponCalibrationViewMode === 'sandbox' ? 'cursor-not-allowed border-slate-800 bg-slate-950/70 text-slate-600' : weaponTransformGizmoEnabled ? 'border-emerald-400/30 bg-emerald-500/12 text-emerald-100' : 'border-cyan-400/25 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/18'}`}
                      >
                        {weaponCalibrationViewMode === 'sandbox' ? 'Gizmo na bancada' : weaponTransformGizmoEnabled ? 'Desativar gizmo' : 'Ativar gizmo'}
                      </button>
                      <SelectField
                        label="Gizmo"
                        value={weaponTransformControlMode}
                        onChange={(value) => setWeaponTransformControlMode(value as DeveloperWeaponTransformControlMode)}
                        options={[
                          { value: 'translate', label: 'Mover' },
                          { value: 'rotate', label: 'Rotacionar' },
                          { value: 'scale', label: 'Escalar' },
                        ]}
                      />
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-[11px] text-slate-400">
                        Bancada: arma isolada na origem. Na mao: preview no personagem para validacao final.
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-[11px] text-slate-400">
                        Ajuste no 3D e solte o mouse para atualizar os valores abaixo.
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 font-mono text-[11px] text-slate-300">
                      handTransform: {'{'} position: [{weaponTransformOverride.position.map((value) => value.toFixed(3)).join(', ')}], rotation: [{weaponTransformOverride.rotation.map((value) => value.toFixed(3)).join(', ')}], scale: {weaponTransformOverride.scale.toFixed(3)} {'}'}
                    </div>
                    <button
                      onClick={() => { void handleCopyWeaponTransform(); }}
                      className="mt-3 w-full rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:bg-cyan-500/18"
                    >
                      {weaponTransformCopyStatus === 'copied' ? 'Hand transform copiado' : weaponTransformCopyStatus === 'error' ? 'Falha ao copiar' : 'Copiar handTransform'}
                    </button>
                  </div>
                ) : null}
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs leading-5 text-slate-400">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Status das partes</div>
                  <div className="mt-2 space-y-2">
                    {(['head', 'torso', 'arms', 'legs'] as DeveloperKitbashMainSlot[]).map((slot) => {
                      const diagnostic = builderRuntimeDiagnostics[`modular-${slot}`];
                      const statusTone = diagnostic?.status === 'playing'
                        ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                        : diagnostic?.status
                          ? 'border-rose-400/20 bg-rose-500/10 text-rose-100'
                          : 'border-slate-800 bg-slate-950/70 text-slate-500';

                      return (
                        <div key={slot} className={`rounded-lg border px-3 py-2 ${statusTone}`}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-black uppercase tracking-[0.14em]">{slot}</span>
                            <span>{diagnostic?.status ?? 'aguardando'}</span>
                          </div>
                          <div className="mt-1 text-[11px] opacity-80">
                            {diagnostic?.targetClipName ?? 'sem clip alvo'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={() => { void handleCopySelectedClip(); }}
                  className="mt-4 w-full rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:bg-cyan-500/18"
                >
                  {copyStatus === 'copied' ? 'Clip copiado' : copyStatus === 'error' ? 'Falha ao copiar' : 'Copiar clip selecionado'}
                </button>
              </div>

              <button
                onClick={() => {
                  setIsHit(true);
                  window.setTimeout(() => setIsHit(false), 220);
                }}
                className="mt-6 w-full rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-rose-100 transition-colors hover:bg-rose-500/18"
              >
                Disparar hit flash
              </button>
            </div>
          </section>
        )}

        {tab === 'sprite-lab' && (
          <SpriteAnimationLab />
        )}

        {tab === 'item-lab' && selectedItem && (
          <section className="mt-6 grid gap-6 2xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5 sm:p-6">
              <h2 className="font-gamer text-2xl font-black text-white">Inspecao de Itens</h2>
              <p className="mt-2 text-sm text-slate-400">Escolha o tipo e o item para abrir o preview 3D isolado.</p>

              <div className="mt-6 space-y-4">
                <SelectField
                  label="Filtro"
                  value={itemTypeFilter}
                  onChange={(value) => {
                    const nextFilter = value as typeof itemTypeFilter;
                    setItemTypeFilter(nextFilter);
                    const nextItems = ALL_ITEMS.filter((item) => nextFilter === 'all' ? true : item.type === nextFilter);
                    if (nextItems[0]) {
                      setSelectedItemId(nextItems[0].id);
                    }
                  }}
                  options={[
                    { value: 'all', label: 'Todos' },
                    { value: 'weapon', label: 'Armas' },
                    { value: 'armor', label: 'Armaduras' },
                    { value: 'helmet', label: 'Capacetes' },
                    { value: 'legs', label: 'Pernas' },
                    { value: 'shield', label: 'Escudos' },
                    { value: 'potion', label: 'Pocoes' },
                    { value: 'material', label: 'Materiais' },
                  ]}
                />
                <SelectField
                  label="Item"
                  value={selectedItem.id}
                  onChange={setSelectedItemId}
                  options={itemOptions.map((item) => ({ value: item.id, label: item.name }))}
                />
              </div>

              <div className={`mt-6 rounded-2xl border p-4 ${rarityTone[selectedItem.rarity]}`}>
                <div className="text-[10px] font-black uppercase tracking-[0.24em]">{selectedItem.rarity}</div>
                <div className="mt-2 text-xl font-black text-white">{selectedItem.name}</div>
                <div className="mt-1 text-sm text-slate-300">{selectedItem.description}</div>
                <div className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-400">{selectedItem.type} • id {selectedItem.id}</div>
              </div>
            </div>

            <div className="game-surface order-first rounded-[1.75rem] border border-slate-700 p-4 sm:p-5 2xl:order-none">
              <div className="h-[360px] sm:h-[420px] lg:h-[520px] min-[1600px]:h-[620px] rounded-[1.5rem] border border-slate-800 bg-slate-950/60 overflow-hidden">
                <ItemPreviewThree item={selectedItem} />
              </div>
            </div>
          </section>
        )}

        {tab === 'monster-lab' && selectedMonsterEntry && (
          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">monstro: {selectedMonsterEntry.label}</span>
                <span className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-indigo-100">acao: {monsterAnimationAction}</span>
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">grupo: {selectedMonsterEntry.family}</span>
              </div>
              <div className="h-[360px] sm:h-[420px] lg:h-[520px] min-[1600px]:h-[620px] rounded-[1.5rem] border border-slate-800 bg-slate-950/60">
                <DeveloperMonsterScene
                  enemyName={selectedMonsterEntry.enemy.name}
                  enemyAssets={selectedMonsterEntry.enemy.assets}
                  enemyColor={selectedMonsterEntry.enemy.color}
                  enemyScale={selectedMonsterEntry.enemy.scale}
                  enemyAttackStyle={selectedMonsterEntry.enemy.attackStyle}
                  animationAction={monsterAnimationAction}
                  isHit={monsterHit}
                />
              </div>
            </div>

            <div className="game-surface rounded-[1.75rem] border border-slate-700 p-5 sm:p-6 xl:sticky xl:top-6">
              <h2 className="font-gamer text-2xl font-black text-white">Teste de Monstro</h2>
              <p className="mt-2 text-sm text-slate-400">Escolha o modelo 3D do monstro e visualize como ele se comporta com as animações padrão de combate.</p>

              <div className="mt-6 space-y-4">
                <SelectField
                  label="Monstro"
                  value={selectedMonsterId}
                  onChange={setSelectedMonsterId}
                  options={monsterCatalog.map((entry) => ({ value: entry.id, label: entry.label }))}
                />
                <SelectField
                  label="Acao"
                  value={monsterAnimationAction}
                  onChange={(value) => setMonsterAnimationAction(value as PlayerAnimationAction)}
                  options={animationActions.map((action) => ({ value: action, label: action }))}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Dados do monstro</div>
                <div className="mt-3 text-lg font-black text-white">{selectedMonsterEntry.enemy.name}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{selectedMonsterEntry.enemy.type} • escala {selectedMonsterEntry.enemy.scale ?? 1}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">
                  estilo de ataque: {selectedMonsterEntry.enemy.attackStyle ?? 'armed'}
                </div>
              </div>

              <button
                onClick={() => {
                  setMonsterHit(true);
                  window.setTimeout(() => setMonsterHit(false), 220);
                }}
                className="mt-6 w-full rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-rose-100 transition-colors hover:bg-rose-500/18"
              >
                Disparar hit flash
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

