/** Scenario definition for battle arenas */

export interface ScenarioDefinition {
  id: string;
  name: string;
  groundColor: string;
  groundColorAlt: string;
}

export const SCENARIOS: Record<string, ScenarioDefinition> = {
  forest: {
    id: 'forest',
    name: 'Floresta',
    groundColor: '#1a5c2a',
    groundColorAlt: '#14532d',
  },
};

export const getScenario = (id: string): ScenarioDefinition =>
  SCENARIOS[id] ?? SCENARIOS.forest;

export const SCENARIO_LIST = Object.values(SCENARIOS);
