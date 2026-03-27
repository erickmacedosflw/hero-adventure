import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { ArrowRight, Heart, Shield, Sparkles, Star, Swords, WandSparkles, Zap } from 'lucide-react';
import { CONSTELLATION_SKILLS, getConstellationByClassId } from '../game/data/classTalents';
import { getPlayerClassById } from '../game/data/classes';
import { AnimatedClassHero } from './scene3d/characters';
import { hasRuntimeFbxAssets } from './scene3d/animation';
import { PlayerClassDefinition, PlayerClassId, Skill } from '../types';

interface ClassSelectionScreenProps {
  classes: PlayerClassDefinition[];
  selectedClassId: PlayerClassId;
  onSelect: (classId: PlayerClassId) => void;
  onConfirm: (classId: PlayerClassId) => void;
}

const utf8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;

const repairGameText = (value: string) => {
  if (!value || !utf8Decoder || !/[Ãâð]/.test(value)) {
    return value;
  }

  try {
    return utf8Decoder.decode(Uint8Array.from(value, (char) => char.charCodeAt(0)));
  } catch {
    return value;
  }
};

const CLASS_COPY: Record<PlayerClassId, { role: string; pitch: string; highlights: string[] }> = {
  knight: {
    role: 'Linha de frente',
    pitch: 'Seguro, resistente e excelente para quem quer entrar na jornada com controle do ritmo e boa margem para erro.',
    highlights: ['Alta sobrevivencia', 'Defesa confiavel', 'Boa resposta contra chefes'],
  },
  barbarian: {
    role: 'Dano bruto',
    pitch: 'Uma classe agressiva, focada em pancadas pesadas, pressao curta e finalizadores explosivos.',
    highlights: ['Muito HP', 'Ataque elevado', 'Escala bem em burst'],
  },
  mage: {
    role: 'Caster arcano',
    pitch: 'Fragil na frente, mas devastador quando consegue girar mana e recursos para dominar o combate a distancia.',
    highlights: ['Mana abundante', 'Magia forte', 'Escala bem com constelacoes'],
  },
  ranger: {
    role: 'Pressao tecnica',
    pitch: 'Classe equilibrada e agil, muito boa para jogadores que gostam de mobilidade, consistencia e precisao.',
    highlights: ['Alta velocidade', 'Boa versatilidade', 'Controle de alvo marcado'],
  },
  rogue: {
    role: 'Burst e sorte',
    pitch: 'Ritmo rapido, criticos frequentes e janelas curtas de explosao para quem gosta de jogadas agressivas.',
    highlights: ['Velocidade altissima', 'Sorte elevada', 'Combo de burst'],
  },
};

const STAT_ITEMS = [
  { key: 'maxHp', label: 'HP', icon: Heart, color: '#b83a4b', bg: 'rgba(184,58,75,0.12)' },
  { key: 'maxMp', label: 'MP', icon: WandSparkles, color: '#346c7f', bg: 'rgba(52,108,127,0.12)' },
  { key: 'atk', label: 'ATK', icon: Swords, color: '#a35324', bg: 'rgba(163,83,36,0.12)' },
  { key: 'def', label: 'DEF', icon: Shield, color: '#4d6780', bg: 'rgba(77,103,128,0.12)' },
  { key: 'speed', label: 'VEL', icon: Zap, color: '#7c4c76', bg: 'rgba(124,76,118,0.12)' },
  { key: 'luck', label: 'SRT', icon: Star, color: '#b26a2e', bg: 'rgba(178,106,46,0.12)' },
] as const;

const PreviewHero = ({ classId, isSelected }: { classId: PlayerClassId; isSelected: boolean }) => {
  const groupRef = useRef<THREE.Group>(null);
  const playerClass = getPlayerClassById(classId);
  const runtimeAssets = hasRuntimeFbxAssets(playerClass.assets) ? playerClass.assets : null;

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    const idleBob = Math.sin(state.clock.elapsedTime * 1.8) * 0.03;
    groupRef.current.position.y = -1.02 + idleBob;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      isSelected ? 0.46 : 0.28,
      0.05,
    );
  });

  if (!runtimeAssets) {
    return null;
  }

  return (
    <group ref={groupRef} position={[0, -1.02, 0]} rotation={[0, 0.34, 0]}>
      <Suspense fallback={null}>
        <AnimatedClassHero assets={runtimeAssets} animationAction="idle" />
      </Suspense>
      <ContactShadows opacity={0.34} scale={4.2} blur={2.4} far={3} resolution={256} />
    </group>
  );
};

const ClassPreviewCanvas = ({ classId, isSelected }: { classId: PlayerClassId; isSelected: boolean }) => {
  const playerClass = getPlayerClassById(classId);

  return (
    <Canvas dpr={[1, 1.5]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}>
      <PerspectiveCamera makeDefault position={[0, 1.05, 4.4]} fov={28} />
      <ambientLight intensity={1.4} />
      <hemisphereLight intensity={1} groundColor="#c59d82" color="#fff7ed" />
      <directionalLight position={[4, 5, 5]} intensity={1.6} color="#fff4d6" />
      <pointLight position={[-3, 2, 3]} intensity={1.1} color={playerClass.visualProfile.auraColor} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.34, 0]}>
        <circleGeometry args={[1.2, 40]} />
        <meshStandardMaterial color="#f3dfca" transparent opacity={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.33, 0]}>
        <ringGeometry args={[1.18, 1.32, 48]} />
        <meshStandardMaterial color={playerClass.visualProfile.auraColor} emissive={playerClass.visualProfile.auraColor} emissiveIntensity={0.4} transparent opacity={0.38} />
      </mesh>
      <PreviewHero classId={classId} isSelected={isSelected} />
    </Canvas>
  );
};

const describeSkillResource = (skill: Skill, resourceName: string) => {
  if (skill.resourceEffect?.consumeAll) {
    return `Consome toda ${resourceName}`;
  }

  if (skill.resourceEffect?.cost) {
    return `Custa ${skill.resourceEffect.cost} ${resourceName}`;
  }

  if (skill.resourceEffect?.gain) {
    return `Gera ${skill.resourceEffect.gain} ${resourceName}`;
  }

  return resourceName;
};

export const ClassSelectionScreen: React.FC<ClassSelectionScreenProps> = ({
  classes,
  selectedClassId,
  onSelect,
  onConfirm,
}) => {
  const selectedClass = useMemo(
    () => classes.find((playerClass) => playerClass.id === selectedClassId) ?? classes[0],
    [classes, selectedClassId],
  );
  const classCopy = CLASS_COPY[selectedClass.id];
  const constellation = useMemo(() => getConstellationByClassId(selectedClass.id), [selectedClass.id]);
  const futureSkills = useMemo(
    () => CONSTELLATION_SKILLS
      .filter((skill) => skill.classId === selectedClass.id)
      .sort((left, right) => left.minLevel - right.minLevel || left.name.localeCompare(right.name)),
    [selectedClass.id],
  );

  return (
    <div className="absolute inset-0 z-[120] overflow-y-auto bg-[#ead6c2] text-[#6b3141] pointer-events-auto">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,247,237,0.88),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(244,114,182,0.10),transparent_20%),linear-gradient(180deg,#ead6c2_0%,#f3e1cf_22%,#f7ecdd_58%,#efe0cd_100%)]" />
      <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.56),transparent_62%)] pointer-events-none" />

      <div className="relative mx-auto flex min-h-full w-full max-w-[1500px] flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="animate-fade-in-down">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#cfab91] bg-[#fff6ec]/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#8d5e29] shadow-[0_8px_24px_rgba(107,49,65,0.08)] sm:text-xs">
            <Sparkles size={13} />
            Escolha sua classe inicial
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="font-gamer text-3xl font-black tracking-tight text-[#6b3141] sm:text-5xl lg:text-6xl">
                Defina quem vai atravessar esta jornada
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#7f5b56] sm:text-base">
                Veja os cinco herois com seus modelos 3D, compare os atributos iniciais e escolha a classe que mais combina com o estilo de jogo que voce quer construir.
              </p>
            </div>

            <div className="rounded-[20px] border border-[#cfab91] bg-[#fff7ef]/80 px-4 py-3 shadow-[0_12px_34px_rgba(107,49,65,0.10)]">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7068]">Classe selecionada</div>
              <div className="mt-1 font-gamer text-lg font-black sm:text-2xl">{selectedClass.name}</div>
              <div className="text-sm text-[#8a5a57]">{repairGameText(selectedClass.title)}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 hidden gap-4 lg:grid lg:grid-cols-5">
          {classes.map((playerClass) => {
            const isSelected = playerClass.id === selectedClassId;

            return (
              <button
                key={playerClass.id}
                onClick={() => onSelect(playerClass.id)}
                className={`group overflow-hidden rounded-[26px] border text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-[#b66a75] bg-[#fff8f1] shadow-[0_18px_42px_rgba(107,49,65,0.16)] -translate-y-1'
                    : 'border-[#d6b9a3] bg-[#f8eddf]/92 shadow-[0_12px_26px_rgba(107,49,65,0.08)] hover:-translate-y-1 hover:border-[#c59d82] hover:shadow-[0_18px_34px_rgba(107,49,65,0.12)]'
                }`}
                style={{
                  boxShadow: isSelected
                    ? `0 18px 42px rgba(107,49,65,0.16), 0 0 0 1px ${playerClass.visualProfile.auraColor}55`
                    : undefined,
                }}
              >
                <div
                  className="h-56 border-b border-[#e0c6b2]"
                  style={{
                    background: `radial-gradient(circle at 50% 0%, ${playerClass.visualProfile.detailColor}cc 0%, transparent 55%), linear-gradient(180deg, #fff9f2 0%, #f2dfcb 100%)`,
                  }}
                >
                  <ClassPreviewCanvas classId={playerClass.id} isSelected={isSelected} />
                </div>

                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-gamer text-xl font-black text-[#6b3141]">{playerClass.name}</div>
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a5a57]">{repairGameText(playerClass.title)}</div>
                    </div>
                    <span
                      className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                      style={{
                        borderColor: `${playerClass.visualProfile.secondaryColor}44`,
                        color: playerClass.visualProfile.secondaryColor,
                        backgroundColor: `${playerClass.visualProfile.secondaryColor}14`,
                      }}
                    >
                      {CLASS_COPY[playerClass.id].role}
                    </span>
                  </div>

                  <p className="min-h-16 text-sm leading-relaxed text-[#7f5b56]">
                    {repairGameText(playerClass.description)}
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    {STAT_ITEMS.slice(0, 3).map(({ key, label }) => (
                      <div key={`${playerClass.id}-${key}`} className="rounded-[14px] border border-[#dcc0aa] bg-[#fff8f1] px-3 py-2">
                        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9a7068]">{label}</div>
                        <div className="mt-1 text-sm font-black text-[#6b3141]">{playerClass.baseStats[key]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex gap-4 overflow-x-auto pb-2 lg:hidden custom-scrollbar snap-x snap-mandatory">
          {classes.map((playerClass) => {
            const isSelected = playerClass.id === selectedClassId;

            return (
              <button
                key={playerClass.id}
                onClick={() => onSelect(playerClass.id)}
                className={`min-w-[76vw] snap-center overflow-hidden rounded-[24px] border text-left shadow-[0_12px_26px_rgba(107,49,65,0.08)] sm:min-w-[46vw] ${
                  isSelected ? 'border-[#b66a75] bg-[#fff8f1]' : 'border-[#d6b9a3] bg-[#f8eddf]/92'
                }`}
                style={{
                  boxShadow: isSelected
                    ? `0 18px 42px rgba(107,49,65,0.14), 0 0 0 1px ${playerClass.visualProfile.auraColor}55`
                    : undefined,
                }}
              >
                <div
                  className="h-52 border-b border-[#e0c6b2]"
                  style={{
                    background: `radial-gradient(circle at 50% 0%, ${playerClass.visualProfile.detailColor}cc 0%, transparent 55%), linear-gradient(180deg, #fff9f2 0%, #f2dfcb 100%)`,
                  }}
                >
                  <ClassPreviewCanvas classId={playerClass.id} isSelected={isSelected} />
                </div>

                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-gamer text-lg font-black">{playerClass.name}</div>
                    <span
                      className="rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                      style={{
                        borderColor: `${playerClass.visualProfile.secondaryColor}44`,
                        color: playerClass.visualProfile.secondaryColor,
                        backgroundColor: `${playerClass.visualProfile.secondaryColor}14`,
                      }}
                    >
                      {CLASS_COPY[playerClass.id].role}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-[#7f5b56]">{repairGameText(playerClass.description)}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="rounded-[30px] border border-[#cfab91] bg-[#fff8f1]/88 p-4 shadow-[0_18px_42px_rgba(107,49,65,0.10)] sm:p-6">
            <div className="flex flex-col gap-4 border-b border-[#e0c6b2] pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#9a7068]">Visao geral</div>
                <h2 className="mt-2 font-gamer text-2xl font-black sm:text-3xl">{selectedClass.name}</h2>
                <p className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-[#8a5a57]">{repairGameText(selectedClass.title)}</p>
              </div>

              <div
                className="rounded-[18px] border px-4 py-3"
                style={{
                  borderColor: `${constellation.resource.color}44`,
                  background: `linear-gradient(180deg, ${constellation.resource.color}12 0%, rgba(255,248,241,0.92) 100%)`,
                }}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7068]">Recurso da classe</div>
                <div className="mt-1 font-gamer text-xl font-black" style={{ color: constellation.resource.color }}>
                  {repairGameText(constellation.resource.name)}
                </div>
                <div className="text-sm text-[#7f5b56]">Capacidade inicial: {constellation.resource.max}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-5">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7068]">Estilo de jogo</div>
                  <p className="mt-2 text-sm leading-relaxed text-[#7f5b56]">{classCopy.pitch}</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#7f5b56]">{repairGameText(selectedClass.description)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {classCopy.highlights.map((highlight) => (
                    <span
                      key={highlight}
                      className="rounded-full border border-[#d6b9a3] bg-[#f7ecdd] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#6b3141]"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>

                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7068]">Atributos iniciais</div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {STAT_ITEMS.map(({ key, label, icon: Icon, color, bg }) => (
                      <div key={key} className="rounded-[18px] border border-[#dcc0aa] bg-[#fffdf9] p-3 shadow-[inset_0_1px_0_rgba(255,248,238,0.72)]">
                        <div className="flex items-center gap-2">
                          <span className="flex h-9 w-9 items-center justify-center rounded-[12px]" style={{ color, backgroundColor: bg }}>
                            <Icon size={18} />
                          </span>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a7068]">{label}</div>
                            <div className="text-lg font-black text-[#6b3141]">{selectedClass.baseStats[key]}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7068]">Habilidades futuras</div>
                    <p className="mt-1 text-sm text-[#7f5b56]">O que essa classe pode desbloquear conforme a constelacao evolui.</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3">
                  {futureSkills.map((skill) => (
                    <div key={skill.id} className="rounded-[20px] border border-[#dcc0aa] bg-[#fffdf9] p-4 shadow-[0_8px_20px_rgba(107,49,65,0.06)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-gamer text-lg font-black text-[#6b3141]">{repairGameText(skill.name)}</div>
                          <p className="mt-1 text-sm leading-relaxed text-[#7f5b56]">{repairGameText(skill.description)}</p>
                        </div>
                        <span
                          className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                          style={{
                            borderColor: `${skill.trailColor ?? selectedClass.visualProfile.secondaryColor}44`,
                            color: skill.trailColor ?? selectedClass.visualProfile.secondaryColor,
                            backgroundColor: `${skill.trailColor ?? selectedClass.visualProfile.secondaryColor}14`,
                          }}
                        >
                          Nv. {skill.minLevel}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#6b3141]">
                        <span className="rounded-full border border-[#d6b9a3] bg-[#f7ecdd] px-2.5 py-1">MP {skill.manaCost}</span>
                        <span className="rounded-full border border-[#d6b9a3] bg-[#f7ecdd] px-2.5 py-1">{describeSkillResource(skill, repairGameText(skill.resourceLabel ?? constellation.resource.name))}</span>
                        <span className="rounded-full border border-[#d6b9a3] bg-[#f7ecdd] px-2.5 py-1">{skill.type === 'heal' ? 'Suporte' : skill.type === 'magic' ? 'Magia' : 'Fisico'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-[#cfab91] bg-[#fff8f1]/88 p-4 shadow-[0_18px_42px_rgba(107,49,65,0.10)] sm:p-6">
            <div className="flex flex-col gap-2 border-b border-[#e0c6b2] pb-4">
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#9a7068]">Arvore de habilidades</div>
              <h2 className="font-gamer text-2xl font-black sm:text-3xl">{repairGameText(constellation.name)}</h2>
              <p className="text-sm leading-relaxed text-[#7f5b56]">{repairGameText(constellation.subtitle)}</p>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              {constellation.trails.map((trail) => (
                <div
                  key={trail.id}
                  className="rounded-[24px] border border-[#dcc0aa] bg-[#fffdf9] p-4 shadow-[0_10px_24px_rgba(107,49,65,0.06)]"
                >
                  <div
                    className="inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]"
                    style={{
                      color: trail.color,
                      borderColor: `${trail.color}44`,
                      backgroundColor: `${trail.color}12`,
                    }}
                  >
                    {repairGameText(trail.name)}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[#7f5b56]">{repairGameText(trail.description)}</p>

                  <div className="mt-4 space-y-3">
                    {trail.nodes.map((node, index) => {
                      const unlockSkill = futureSkills.find((skill) => skill.id === node.effects.find((effect) => effect.unlockSkillId)?.unlockSkillId);

                      return (
                        <div key={node.id} className="relative">
                          {index < trail.nodes.length - 1 && (
                            <div className="absolute left-5 top-11 h-[calc(100%+0.5rem)] w-px bg-[#dcc0aa]" />
                          )}
                          <div className="flex gap-3">
                            <div
                              className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black"
                              style={{
                                borderColor: `${trail.color}66`,
                                backgroundColor: `${trail.color}16`,
                                color: trail.color,
                              }}
                            >
                              {node.tier}
                            </div>
                            <div className="min-w-0 flex-1 rounded-[18px] border border-[#dcc0aa] bg-[#fdf6ee] p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-bold text-[#6b3141]">{repairGameText(node.title)}</div>
                                  <div className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-[#9a7068]">Nivel {node.requiredLevel}</div>
                                </div>
                                {unlockSkill ? (
                                  <span
                                    className="rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em]"
                                    style={{
                                      color: trail.color,
                                      borderColor: `${trail.color}44`,
                                      backgroundColor: `${trail.color}14`,
                                    }}
                                  >
                                    Skill
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-[#7f5b56]">{repairGameText(node.description)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-[28px] border border-[#cfab91] bg-[#fff6ec]/90 p-4 shadow-[0_18px_40px_rgba(107,49,65,0.10)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9a7068]">Pronto para comecar</div>
            <div className="mt-1 text-lg font-black text-[#6b3141]">
              Iniciar aventura com <span className="font-gamer">{selectedClass.name}</span>
            </div>
            <p className="mt-1 text-sm text-[#7f5b56]">Voce entra na taverna ja com os atributos base e a progressao dessa classe preparada.</p>
          </div>

          <button
            onClick={() => onConfirm(selectedClassId)}
            className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-[#8d5e29] bg-[linear-gradient(180deg,#8d5e29_0%,#6f4737_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_14px_28px_rgba(107,49,65,0.22)] transition-all hover:-translate-y-0.5 hover:brightness-105 sm:px-6"
          >
            Comecar jornada
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
