import React from 'react';
import { VoxelPart } from './VoxelPart';

// WeaponModel is kept as a generic placeholder � all purchasable weapons now
// use FBX models (see weaponCatalog.ts and EquippedWeaponAttachment in Scene3D).
export const WeaponModel = ({ type: _type }: { type: string }) => (
  <VoxelPart position={[0, 0.2, 0]} size={[0.1, 0.6, 0.1]} color="#94a3b8" material="metal" />
);
