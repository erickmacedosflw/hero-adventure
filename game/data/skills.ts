import { Skill } from '../../types';

export const SKILLS: Skill[] = [
  { id: 'skl_1', name: 'Corte Voxel', cost: 0, damageMult: 1.5, minLevel: 2, description: 'Golpe fisico preciso. 8 MP', manaCost: 8, type: 'physical' },
  { id: 'skl_2', name: 'Luz Sagrada', cost: 0, damageMult: 0, minLevel: 3, description: 'Cura feridas. 15 MP', manaCost: 15, type: 'heal' },
  { id: 'skl_3', name: 'Bola de Fogo', cost: 0, damageMult: 2.2, minLevel: 5, description: 'Queima o alvo. 20 MP', manaCost: 20, type: 'magic' },
  { id: 'skl_4', name: 'Lamina do Dragao', cost: 0, damageMult: 3.5, minLevel: 8, description: 'Dano massivo. 45 MP', manaCost: 45, type: 'physical' },
];
