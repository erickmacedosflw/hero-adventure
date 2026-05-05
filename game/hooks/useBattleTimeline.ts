import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BattleActorGauge, BattleActorGaugeMap, BattleActorKind, BattleTimelineState, PlayerClassId } from '../../types';

export const ATB_GAUGE_MAX = 100;
export const ATB_MAX_FRAME_DELTA_SECONDS = 0.1;

const ATB_KNIGHT_SPEED_TIME_ANCHORS = [
  { speed: 0, seconds: 9 },
  { speed: 5, seconds: 7 },
  { speed: 10, seconds: 6 },
  { speed: 20, seconds: 5 },
  { speed: 30, seconds: 4 },
] as const;

const ATB_MAGE_SPEED_TIME_ANCHORS = [
  { speed: 0, seconds: 8 },
  { speed: 5, seconds: 6 },
  { speed: 10, seconds: 5 },
  { speed: 20, seconds: 4 },
  { speed: 30, seconds: 3 },
] as const;

const ATB_ROGUE_SPEED_TIME_ANCHORS = [
  { speed: 0, seconds: 7 },
  { speed: 5, seconds: 5 },
  { speed: 10, seconds: 4 },
  { speed: 20, seconds: 3 },
  { speed: 30, seconds: 2 },
] as const;

const ATB_SPEED_TIME_ANCHORS_BY_CLASS: Record<PlayerClassId, readonly { speed: number; seconds: number }[]> = {
  knight: ATB_KNIGHT_SPEED_TIME_ANCHORS,
  barbarian: ATB_KNIGHT_SPEED_TIME_ANCHORS,
  mage: ATB_MAGE_SPEED_TIME_ANCHORS,
  ranger: ATB_MAGE_SPEED_TIME_ANCHORS,
  rogue: ATB_ROGUE_SPEED_TIME_ANCHORS,
};

const DEFAULT_ATB_CLASS_ID: PlayerClassId = 'knight';

export interface BattleTimelineActor {
  id: string;
  kind: BattleActorKind;
  label: string;
  classId?: PlayerClassId;
  speed: number;
  hp: number;
  priority: number;
}

interface UseBattleTimelineParams {
  isActive: boolean;
  actors: BattleTimelineActor[];
  timelineState: BattleTimelineState;
  activeActorId: string | null;
  onActorReady: (actorId: string) => void;
}

const clampGauge = (value: number) => Math.max(0, Math.min(ATB_GAUGE_MAX, value));

const lerp = (start: number, end: number, factor: number) => start + ((end - start) * factor);

const getAtbTimeToReadySeconds = (speed: number, classId?: PlayerClassId) => {
  const normalizedSpeed = Math.max(0, speed);
  const anchors = ATB_SPEED_TIME_ANCHORS_BY_CLASS[classId ?? DEFAULT_ATB_CLASS_ID] ?? ATB_SPEED_TIME_ANCHORS_BY_CLASS[DEFAULT_ATB_CLASS_ID];

  for (let index = 1; index < anchors.length; index += 1) {
    const previous = anchors[index - 1];
    const current = anchors[index];

    if (normalizedSpeed <= current.speed) {
      const range = current.speed - previous.speed;
      if (range <= 0) {
        return current.seconds;
      }
      const factor = (normalizedSpeed - previous.speed) / range;
      return lerp(previous.seconds, current.seconds, factor);
    }
  }

  return anchors[anchors.length - 1].seconds;
};

const getAtbChargePerSecond = (speed: number, classId?: PlayerClassId) => ATB_GAUGE_MAX / getAtbTimeToReadySeconds(speed, classId);

const createGaugeFromActor = (actor: BattleTimelineActor, tempoDeAtaque = 0): BattleActorGauge => ({
  id: actor.id,
  kind: actor.kind,
  label: actor.label,
  speed: actor.speed,
  tempoDeAtaque: clampGauge(tempoDeAtaque),
  state: tempoDeAtaque >= ATB_GAUGE_MAX ? 'pronto' : 'carregando',
});

const chooseReadyActor = (readyActors: BattleTimelineActor[]) => (
  [...readyActors].sort((left, right) => {
    const speedDelta = right.speed - left.speed;
    if (speedDelta !== 0) return speedDelta;
    return left.priority - right.priority;
  })[0] ?? null
);

export const useBattleTimeline = ({
  isActive,
  actors,
  timelineState,
  activeActorId,
  onActorReady,
}: UseBattleTimelineParams) => {
  const [gauges, setGauges] = useState<BattleActorGaugeMap>({});
  const gaugesRef = useRef<BattleActorGaugeMap>({});
  const actorsRef = useRef<BattleTimelineActor[]>(actors);
  const onActorReadyRef = useRef(onActorReady);
  const readyDispatchRef = useRef<string | null>(null);

  const aliveActors = useMemo(
    () => actors.filter((actor) => actor.hp > 0),
    [actors],
  );

  useEffect(() => {
    actorsRef.current = aliveActors;
  }, [aliveActors]);

  useEffect(() => {
    onActorReadyRef.current = onActorReady;
  }, [onActorReady]);

  useEffect(() => {
    if (!isActive) {
      readyDispatchRef.current = null;
      gaugesRef.current = {};
      setGauges({});
      return;
    }

    const next: BattleActorGaugeMap = {};
    for (const actor of aliveActors) {
      const previousGauge = gaugesRef.current[actor.id];
      const previousTempo = previousGauge?.tempoDeAtaque ?? 0;
      next[actor.id] = {
        ...createGaugeFromActor(actor, previousTempo),
        state: actor.id === activeActorId
          ? 'executando'
          : previousTempo >= ATB_GAUGE_MAX
            ? 'pronto'
            : 'carregando',
      };
    }
    gaugesRef.current = next;
    setGauges(next);
  }, [activeActorId, aliveActors, isActive]);

  useEffect(() => {
    if (!isActive || timelineState !== 'RUNNING') {
      return undefined;
    }

    readyDispatchRef.current = null;
    let rafId = 0;
    let lastFrameTime: number | null = null;

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (lastFrameTime === null) {
        lastFrameTime = now;
        return;
      }

      const deltaSeconds = Math.min((now - lastFrameTime) / 1000, ATB_MAX_FRAME_DELTA_SECONDS);
      lastFrameTime = now;
      if (deltaSeconds <= 0) return;
      if (readyDispatchRef.current) return;

      const currentActors = actorsRef.current.filter((actor) => actor.hp > 0);
      if (currentActors.length === 0) return;

      const next: BattleActorGaugeMap = {};
      const readyActors: BattleTimelineActor[] = [];

      for (const actor of currentActors) {
        const previousGauge = gaugesRef.current[actor.id];
        const currentTempo = previousGauge?.tempoDeAtaque ?? 0;
        const chargeGain = deltaSeconds * getAtbChargePerSecond(actor.speed, actor.classId);
        const tempoDeAtaque = clampGauge(currentTempo + chargeGain);
        if (tempoDeAtaque >= ATB_GAUGE_MAX) {
          readyActors.push(actor);
        }
        next[actor.id] = {
          ...createGaugeFromActor(actor, tempoDeAtaque),
          state: tempoDeAtaque >= ATB_GAUGE_MAX ? 'pronto' : 'carregando',
        };
      }

      const selectedActor = chooseReadyActor(readyActors);
      if (selectedActor) {
        for (const actorId of Object.keys(next)) {
          next[actorId] = {
            ...next[actorId],
            state: actorId === selectedActor.id ? 'executando' : next[actorId].state,
          };
        }
      }

      gaugesRef.current = next;
      setGauges(next);

      if (selectedActor && readyDispatchRef.current !== selectedActor.id) {
        readyDispatchRef.current = selectedActor.id;
        onActorReadyRef.current(selectedActor.id);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [isActive, timelineState]);

  const resetActorGauge = useCallback((actorId: string) => {
    readyDispatchRef.current = null;
    const gauge = gaugesRef.current[actorId];
    if (!gauge) return;

    const next = {
      ...gaugesRef.current,
      [actorId]: {
        ...gauge,
        tempoDeAtaque: 0,
        state: 'carregando' as const,
      },
    };
    gaugesRef.current = next;
    setGauges(next);
  }, []);

  const removeActorGauge = useCallback((actorId: string) => {
    readyDispatchRef.current = readyDispatchRef.current === actorId ? null : readyDispatchRef.current;
    if (!gaugesRef.current[actorId]) return;

    const { [actorId]: _removed, ...rest } = gaugesRef.current;
    gaugesRef.current = rest;
    setGauges(rest);
  }, []);

  const clearGauges = useCallback(() => {
    readyDispatchRef.current = null;
    gaugesRef.current = {};
    setGauges({});
  }, []);

  return {
    gauges,
    resetActorGauge,
    removeActorGauge,
    clearGauges,
  };
};
