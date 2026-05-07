/**
 * battleLogStore — zustand store for battle log entries.
 *
 * Moves `logs` OUT of App.tsx so that every `setLogs` call does NOT
 * cause a full re-render of the 5800-line App component tree.
 * BattleHUD subscribes via the hook and re-renders only when the
 * actual logs slice changes.
 */
import { create } from 'zustand';
import type { BattleLog } from '../../types';

const MAX_LOGS = 30;

interface BattleLogState {
  logs: BattleLog[];
  /** Append one log; oldest logs are dropped beyond MAX_LOGS. */
  addLog: (entry: BattleLog) => void;
  /** Append a batch atomically (used by App.tsx's microtask batcher). */
  addLogBatch: (entries: BattleLog[]) => void;
  /** Replace the full log list (used on battle start/load). */
  setLogs: (entries: BattleLog[]) => void;
  /** Clear all logs. */
  clearLogs: () => void;
}

export const useBattleLogStore = create<BattleLogState>((set) => ({
  logs: [],

  addLog: (entry) =>
    set((s) => ({ logs: [entry, ...s.logs].slice(0, MAX_LOGS) })),

  addLogBatch: (entries) => {
    if (!entries || entries.length === 0) return;
    set((s) => ({ logs: [...entries, ...s.logs].slice(0, MAX_LOGS) }));
  },

  setLogs: (entries) => set({ logs: (entries ?? []).slice(0, MAX_LOGS) }),

  clearLogs: () => set({ logs: [] }),
}));
