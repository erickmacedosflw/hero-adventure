import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { Item } from '../../types';
import { getRegisteredWeapon3DByItemId } from '../../game/data/weaponCatalog';

const createBox = (
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0]
) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const createCylinder = (
  radiusTop: number,
  radiusBottom: number,
  height: number,
  radialSegments: number,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0]
) => {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
    material
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const createSphere = (
  radius: number,
  widthSegments: number,
  heightSegments: number,
  material: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1]
) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, widthSegments, heightSegments), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const createTorus = (
  radius: number,
  tube: number,
  radialSegments: number,
  tubularSegments: number,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0]
) => {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments),
    material
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const createWeaponGroup = (itemId: string) => {
  const group = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: '#dbe4ee', metalness: 0.88, roughness: 0.18 });
  const steel = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.82, roughness: 0.25 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.72, roughness: 0.35 });
  const copper = new THREE.MeshStandardMaterial({ color: '#c47c1e', metalness: 0.7, roughness: 0.32 });
  const gold = new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.92, roughness: 0.2 });
  const voidMetal = new THREE.MeshStandardMaterial({ color: '#312e81', metalness: 0.8, roughness: 0.24, emissive: '#1e1b4b', emissiveIntensity: 0.35 });
  const mithril = new THREE.MeshStandardMaterial({ color: '#a5b4fc', metalness: 0.9, roughness: 0.14, emissive: '#3730a3', emissiveIntensity: 0.18 });
  const leather = new THREE.MeshStandardMaterial({ color: '#5b341c', roughness: 0.88, metalness: 0.06 });
  const darkLeather = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8, metalness: 0.05 });
  const blueGem = new THREE.MeshStandardMaterial({ color: '#60a5fa', emissive: '#2563eb', emissiveIntensity: 0.4, metalness: 0.45, roughness: 0.18 });
  const violetGem = new THREE.MeshStandardMaterial({ color: '#8b5cf6', emissive: '#4c1d95', emissiveIntensity: 0.45, metalness: 0.35, roughness: 0.15 });

  if (itemId === 'wep_b1') {
    group.add(createBox(0.18, 0.1, 0.16, copper, [0, -0.72, 0]));
    group.add(createBox(0.1, 0.46, 0.1, leather, [0, -0.42, 0]));
    group.add(createBox(0.38, 0.06, 0.08, copper, [0, -0.14, 0]));
    group.add(createBox(0.12, 0.08, 0.16, copper, [0, -0.14, 0]));
    group.add(createBox(0.11, 0.9, 0.03, copper, [0, 0.38, 0]));
    group.add(createBox(0.04, 0.82, 0.015, silver, [0.03, 0.38, 0.01]));
    group.add(createBox(0.05, 0.1, 0.022, gold, [0, 0.9, 0]));
  } else if (itemId === 'wep_b2') {
    group.add(createBox(0.1, 1.42, 0.1, leather, [0, -0.06, 0]));
    group.add(createBox(0.14, 0.08, 0.14, darkLeather, [0, 0.52, 0]));
    group.add(createBox(0.42, 0.58, 0.06, darkSteel, [0.24, 0.7, 0]));
    group.add(createBox(0.16, 0.68, 0.045, steel, [0.45, 0.74, 0.01], [0, 0, -0.18]));
    group.add(createBox(0.22, 0.2, 0.05, darkSteel, [0.18, 0.42, 0]));
    group.add(createBox(0.08, 0.12, 0.08, darkSteel, [0, -0.86, 0]));
  } else if (itemId === 'wep_s1') {
    group.add(createBox(0.18, 0.12, 0.16, darkSteel, [0, -0.86, 0]));
    group.add(createBox(0.1, 0.56, 0.1, darkLeather, [0, -0.5, 0]));
    group.add(createBox(0.58, 0.08, 0.08, steel, [0, -0.18, 0]));
    group.add(createBox(0.12, 0.08, 0.18, steel, [0, -0.16, 0]));
    group.add(createBox(0.14, 0.16, 0.04, steel, [0, 0, 0]));
    group.add(createBox(0.14, 1.5, 0.04, steel, [0, 0.88, 0]));
    group.add(createBox(0.05, 1.42, 0.055, darkSteel, [0, 0.88, 0.005]));
    group.add(createBox(0.03, 1.38, 0.012, silver, [0.05, 0.88, 0.01]));
    group.add(createBox(0.03, 1.38, 0.012, silver, [-0.05, 0.88, 0.01]));
    group.add(createBox(0.06, 0.14, 0.026, silver, [0, 1.68, 0]));
  } else if (itemId === 'wep_s2') {
    group.add(createBox(0.08, 1.86, 0.08, leather, [0, -0.06, 0]));
    group.add(createBox(0.12, 0.08, 0.12, darkLeather, [0, 0.84, 0]));
    group.add(createBox(0.1, 0.08, 0.1, mithril, [0, 1.0, 0]));
    group.add(createBox(0.12, 0.52, 0.05, mithril, [0, 1.34, 0]));
    group.add(createBox(0.05, 0.44, 0.08, silver, [0, 1.34, 0.01]));
    group.add(createBox(0.012, 0.34, 0.012, blueGem, [0.035, 1.3, 0.04]));
    group.add(createBox(0.012, 0.34, 0.012, blueGem, [-0.035, 1.3, 0.04]));
    group.add(createBox(0.018, 0.018, 0.018, blueGem, [0.035, 0.18, 0.04]));
    group.add(createBox(0.018, 0.018, 0.018, blueGem, [0.035, -0.12, 0.04]));
    group.add(createBox(0.018, 0.018, 0.018, blueGem, [0.035, -0.42, 0.04]));
    group.add(createBox(0.09, 0.08, 0.09, mithril, [0, -1.04, 0]));
  } else if (itemId === 'wep_g1') {
    group.add(createBox(0.14, 0.1, 0.12, voidMetal, [0, -0.82, 0]));
    group.add(createBox(0.09, 0.68, 0.09, darkLeather, [0, -0.44, 0]));
    [-0.22, -0.1, 0.02, 0.14].forEach((y) => {
      group.add(createBox(0.1, 0.035, 0.02, voidMetal, [0, y, 0.045], [0, 0, 0.38]));
    });
    group.add(createCylinder(0.16, 0.16, 0.05, 18, voidMetal, [0, -0.04, 0], [Math.PI / 2, 0, 0]));
    group.add(createBox(0.08, 0.1, 0.06, darkSteel, [0, 0.04, 0]));
    group.add(createBox(0.08, 1.72, 0.028, darkSteel, [0, 0.92, 0]));
    group.add(createBox(0.022, 1.66, 0.012, violetGem, [0.028, 0.92, 0.01]));
    group.add(createBox(0.014, 1.66, 0.01, silver, [-0.028, 0.92, 0.008]));
    group.add(createBox(0.05, 0.06, 0.01, violetGem, [0, 0.48, 0.015]));
    group.add(createBox(0.04, 0.05, 0.01, violetGem, [0, 0.86, 0.015]));
    group.add(createBox(0.03, 0.04, 0.01, silver, [0, 1.32, 0.015]));
    group.add(createBox(0.035, 0.12, 0.02, voidMetal, [0, 1.78, 0]));
  } else if (itemId === 'wep_g2') {
    group.add(createBox(0.2, 0.12, 0.18, blueGem, [0, -0.92, 0]));
    group.add(createBox(0.1, 0.56, 0.1, darkLeather, [0, -0.56, 0]));
    group.add(createBox(0.66, 0.08, 0.08, gold, [0, -0.22, 0]));
    group.add(createBox(0.1, 0.08, 0.2, gold, [0, -0.19, 0]));
    group.add(createBox(0.08, 0.08, 0.06, blueGem, [0, -0.14, 0.06]));
    group.add(createBox(0.14, 0.12, 0.04, silver, [0, -0.04, 0]));
    group.add(createBox(0.16, 1.65, 0.04, silver, [0, 0.94, 0]));
    group.add(createBox(0.045, 1.54, 0.055, steel, [0, 0.94, 0.005]));
    group.add(createBox(0.024, 1.56, 0.014, gold, [0.065, 0.94, 0.01]));
    group.add(createBox(0.024, 1.56, 0.014, gold, [-0.065, 0.94, 0.01]));
    group.add(createBox(0.06, 0.06, 0.01, blueGem, [0, 0.62, 0.018]));
    group.add(createBox(0.04, 0.04, 0.01, blueGem, [0, 0.98, 0.018]));
    group.add(createBox(0.06, 0.14, 0.026, silver, [0, 1.82, 0]));
  } else {
    group.add(createBox(0.12, 0.56, 0.1, leather, [0, -0.42, 0]));
    group.add(createBox(0.42, 0.08, 0.08, steel, [0, -0.12, 0]));
    group.add(createBox(0.12, 1.24, 0.04, silver, [0, 0.68, 0]));
  }

  return group;
};

const createShieldGroup = (itemId: string) => {
  const group = new THREE.Group();
  const woodA = new THREE.MeshStandardMaterial({ color: '#7c4820', roughness: 0.7, metalness: 0.05 });
  const woodB = new THREE.MeshStandardMaterial({ color: '#654215', roughness: 0.76, metalness: 0.05 });
  const woodDark = new THREE.MeshStandardMaterial({ color: '#5c3010', roughness: 0.82, metalness: 0.03 });
  const leather = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.88, metalness: 0.04 });
  const steel = new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.3, metalness: 0.88 });
  const steelLight = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.2, metalness: 0.92 });
  const slate = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.3, metalness: 0.85 });
  const slateDark = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.36, metalness: 0.78 });
  const slateTrim = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.22, metalness: 0.9 });
  const sacredBase = new THREE.MeshStandardMaterial({ color: '#1e1b4b', roughness: 0.24, metalness: 0.88 });
  const sacredGold = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.18, metalness: 0.95 });
  const sacredGoldLight = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.16, metalness: 0.95, emissive: '#a16207', emissiveIntensity: 0.15 });
  const sacredGem = new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.12, metalness: 0.42, emissive: '#1d4ed8', emissiveIntensity: 0.35 });
  const sacredGemLight = new THREE.MeshStandardMaterial({ color: '#60a5fa', roughness: 0.1, metalness: 0.32, emissive: '#2563eb', emissiveIntensity: 0.25 });
  const sacredGemCore = new THREE.MeshStandardMaterial({ color: '#bfdbfe', roughness: 0.08, metalness: 0.25, emissive: '#60a5fa', emissiveIntensity: 0.18 });

  if (itemId === 'shd_b1') {
    group.add(createBox(0.08, 0.8, 0.12, woodA, [0, 0, -0.18], [0, -0.3, 0]));
    group.add(createBox(0.08, 0.82, 0.13, woodB, [0.01, 0, 0], [0, -0.3, 0]));
    group.add(createBox(0.08, 0.8, 0.12, woodA, [0, 0, 0.18], [0, -0.3, 0]));
    group.add(createBox(0.01, 0.5, 0.03, woodDark, [0.041, 0.15, -0.18], [0, -0.3, 0]));
    group.add(createBox(0.01, 0.5, 0.03, woodDark, [0.041, 0.15, 0.18], [0, -0.3, 0]));
    group.add(createBox(0.12, 0.06, 0.56, steel, [0.05, 0.25, 0], [0, -0.3, 0]));
    group.add(createBox(0.12, 0.06, 0.56, steel, [0.05, -0.25, 0], [0, -0.3, 0]));
    [-0.18, 0, 0.18].forEach((z) => {
      group.add(createBox(0.025, 0.025, 0.025, steelLight, [0.09, 0.25, z], [0, -0.3, 0]));
      group.add(createBox(0.025, 0.025, 0.025, steelLight, [0.09, -0.25, z], [0, -0.3, 0]));
    });
    group.add(createBox(0.08, 0.22, 0.06, leather, [-0.04, 0, 0], [0, -0.3, 0]));
  } else if (itemId === 'shd_s1') {
    group.add(createBox(0.1, 1.0, 0.62, slate, [0, 0.05, 0], [0, -0.2, 0]));
    group.add(createBox(0.06, 0.9, 0.52, slateDark, [0.02, 0.05, 0], [0, -0.2, 0]));
    group.add(createBox(0.1, 0.06, 0.64, slateTrim, [0.04, 0.55, 0], [0, -0.2, 0]));
    group.add(createBox(0.1, 0.06, 0.64, slateTrim, [0.04, -0.46, 0], [0, -0.2, 0]));
    group.add(createBox(0.1, 1.04, 0.06, slateTrim, [0.04, 0.05, 0.3], [0, -0.2, 0]));
    group.add(createBox(0.1, 1.04, 0.06, slateTrim, [0.04, 0.05, -0.3], [0, -0.2, 0]));
    group.add(createBox(0.06, 0.96, 0.06, steel, [0.06, 0.05, 0], [0, -0.2, 0]));
    [0.4, 0.1, -0.2].forEach((y) => {
      group.add(createBox(0.025, 0.025, 0.025, steelLight, [0.06, y, 0.31], [0, -0.2, 0]));
    });
    group.add(createBox(0.1, 0.2, 0.2, slateTrim, [0.06, 0.05, 0], [0, -0.2, 0]));
    group.add(createBox(0.06, 0.1, 0.1, steelLight, [0.08, 0.05, 0], [0, -0.2, 0]));
    group.add(createBox(0.09, 0.12, 0.28, slate, [0, -0.55, 0], [0.4, -0.2, 0]));
    group.add(createBox(0.08, 0.08, 0.12, slate, [0, -0.64, 0], [0.5, -0.2, 0]));
  } else if (itemId === 'shd_g1') {
    group.add(createBox(0.1, 0.8, 0.8, sacredBase, [0, 0, 0], [0, -0.2, 0]));
    group.add(createBox(0.06, 0.7, 0.7, sacredBase, [0.01, 0, 0], [0, -0.2, 0]));
    group.add(createBox(0.1, 0.06, 0.82, sacredGold, [0.04, 0.38, 0], [0, -0.2, 0]));
    group.add(createBox(0.1, 0.06, 0.82, sacredGold, [0.04, -0.38, 0], [0, -0.2, 0]));
    group.add(createBox(0.1, 0.82, 0.06, sacredGold, [0.04, 0, 0.38], [0, -0.2, 0]));
    group.add(createBox(0.1, 0.82, 0.06, sacredGold, [0.04, 0, -0.38], [0, -0.2, 0]));
    [0, 0.785, 1.57, 2.355].forEach((a) => {
      group.add(createBox(0.06, 0.06, 0.18, sacredGoldLight, [0.05, Math.sin(a) * 0.22, Math.cos(a) * 0.22], [a, -0.2, 0]));
    });
    group.add(createBox(0.1, 0.22, 0.22, sacredGem, [0.07, 0, 0], [0, -0.2, 0]));
    group.add(createBox(0.06, 0.12, 0.12, sacredGemLight, [0.09, 0, 0], [0, -0.2, 0]));
    group.add(createBox(0.04, 0.06, 0.06, sacredGemCore, [0.1, 0, 0], [0, -0.2, 0]));
    group.add(createBox(0.08, 0.22, 0.06, leather, [-0.05, 0, 0], [0, -0.2, 0]));
  } else {
    group.add(createBox(0.1, 0.8, 0.6, slate, [0, 0, 0]));
    group.add(createBox(0.06, 0.1, 0.1, steel, [0.04, 0, 0]));
  }

  return group;
};

const createHelmetGroup = (itemId: string) => {
  const group = new THREE.Group();
  const bronzeCloth = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.95, metalness: 0.02 });
  const bronzeShade = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.95, metalness: 0.02 });
  const silverMetal = new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.34, metalness: 0.85 });
  const silverTrim = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.22, metalness: 0.92 });
  const darkPlate = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.5, metalness: 0.1 });
  const redCrest = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.88, metalness: 0.04 });
  const redCrestLight = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.84, metalness: 0.03 });
  const redCrestTip = new THREE.MeshStandardMaterial({ color: '#fca5a5', roughness: 0.8, metalness: 0.02 });
  const lichOuter = new THREE.MeshStandardMaterial({ color: '#1e1b4b', roughness: 0.26, metalness: 0.88 });
  const lichInner = new THREE.MeshStandardMaterial({ color: '#312e81', roughness: 0.22, metalness: 0.82 });
  const lichBand = new THREE.MeshStandardMaterial({ color: '#4c1d95', roughness: 0.2, metalness: 0.9 });
  const lichSpike = new THREE.MeshStandardMaterial({ color: '#6d28d9', roughness: 0.18, metalness: 0.92 });
  const lichGemA = new THREE.MeshStandardMaterial({ color: '#a78bfa', roughness: 0.12, metalness: 0.55, emissive: '#6d28d9', emissiveIntensity: 0.32 });
  const lichGemB = new THREE.MeshStandardMaterial({ color: '#7c3aed', roughness: 0.12, metalness: 0.55, emissive: '#4c1d95', emissiveIntensity: 0.32 });
  const lichEyeSocket = new THREE.MeshStandardMaterial({ color: '#000000', roughness: 1, metalness: 0 });
  const lichEyeGlow = new THREE.MeshStandardMaterial({ color: '#a855f7', roughness: 0.1, metalness: 0.2, emissive: '#7e22ce', emissiveIntensity: 0.48 });

  if (itemId === 'hlm_b1') {
    group.add(createBox(0.46, 0.5, 0.46, bronzeCloth, [0, 0.1, 0]));
    group.add(createBox(0.38, 0.4, 0.06, bronzeShade, [0, 0.08, 0.22]));
    group.add(createBox(0.4, 0.14, 0.52, bronzeCloth, [0, 0.38, -0.04], [-0.1, 0, 0]));
    group.add(createBox(0.3, 0.12, 0.4, bronzeShade, [0, 0.48, -0.12], [-0.2, 0, 0]));
    group.add(createBox(0.06, 0.32, 0.38, bronzeCloth, [-0.26, -0.08, -0.04]));
    group.add(createBox(0.06, 0.32, 0.38, bronzeCloth, [0.26, -0.08, -0.04]));
    group.add(createBox(0.42, 0.12, 0.36, bronzeShade, [0, -0.22, -0.08]));
    group.add(createBox(0.02, 0.5, 0.02, silverTrim, [0, 0.48, 0.04]));
  } else if (itemId === 'hlm_s1') {
    group.add(createBox(0.5, 0.44, 0.52, silverMetal, [0, 0.18, 0]));
    group.add(createBox(0.06, 0.32, 0.32, darkPlate, [-0.28, -0.02, 0.06]));
    group.add(createBox(0.06, 0.32, 0.32, darkPlate, [0.28, -0.02, 0.06]));
    group.add(createBox(0.5, 0.08, 0.08, silverTrim, [0, 0.06, 0.24]));
    group.add(createBox(0.1, 0.04, 0.04, darkPlate, [-0.14, 0.06, 0.28]));
    group.add(createBox(0.1, 0.04, 0.04, darkPlate, [0.14, 0.06, 0.28]));
    group.add(createBox(0.04, 0.14, 0.04, silverTrim, [0, -0.05, 0.26]));
    group.add(createBox(0.08, 0.08, 0.44, silverTrim, [0, 0.44, 0.02]));
    group.add(createBox(0.1, 0.16, 0.36, redCrest, [0, 0.56, 0.06]));
    group.add(createBox(0.08, 0.14, 0.28, redCrestLight, [0, 0.64, 0.04]));
    group.add(createBox(0.06, 0.08, 0.18, redCrestTip, [0, 0.68, 0.02]));
    group.add(createBox(0.54, 0.06, 0.54, silverTrim, [0, -0.2, 0]));
    group.add(createBox(0.5, 0.06, 0.5, silverTrim, [0, -0.28, 0]));
    group.add(createBox(0.025, 0.025, 0.025, silverTrim, [0.24, 0.18, 0.24]));
    group.add(createBox(0.025, 0.025, 0.025, silverTrim, [-0.24, 0.18, 0.24]));
  } else if (itemId === 'hlm_g1') {
    group.add(createBox(0.48, 0.36, 0.48, lichOuter, [0, 0.1, 0]));
    group.add(createBox(0.42, 0.3, 0.42, lichInner, [0, 0.1, 0]));
    group.add(createBox(0.54, 0.1, 0.54, lichBand, [0, -0.08, 0]));

    [0, 0.628, 1.257, 1.885, 2.513].forEach((angle, index) => {
      const radius = 0.2;
      const spikeHeight = index % 2 === 0 ? 0.42 : 0.26;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      group.add(createBox(0.06, spikeHeight, 0.06, lichSpike, [x, 0.04, z]));
      group.add(createBox(0.04, 0.06, 0.04, index % 2 === 0 ? lichGemA : lichGemB, [x, 0.04 + spikeHeight * 0.5 + 0.02, z]));
    });

    group.add(createBox(0.1, 0.1, 0.06, lichEyeSocket, [-0.14, 0.04, 0.22]));
    group.add(createBox(0.1, 0.1, 0.06, lichEyeSocket, [0.14, 0.04, 0.22]));
    group.add(createBox(0.06, 0.06, 0.04, lichEyeGlow, [-0.14, 0.04, 0.24]));
    group.add(createBox(0.06, 0.06, 0.04, lichEyeGlow, [0.14, 0.04, 0.24]));
    group.add(createBox(0.3, 0.1, 0.08, lichOuter, [0, -0.14, 0.16]));
  } else {
    group.add(createBox(0.46, 0.4, 0.46, silverMetal, [0, 0, 0]));
  }

  return group;
};

const createArmorGroup = (itemId: string) => {
  const group = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.82, metalness: 0.04 });
  const leatherDark = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.88, metalness: 0.03 });
  const leatherMid = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.58, metalness: 0.2 });
  const clothBrown = new THREE.MeshStandardMaterial({ color: '#6b3a1f', roughness: 0.96, metalness: 0.01 });
  const clothBrownLight = new THREE.MeshStandardMaterial({ color: '#7c4820', roughness: 0.96, metalness: 0.01 });
  const silverPlate = new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.28, metalness: 0.88 });
  const silverDark = new THREE.MeshStandardMaterial({ color: '#374151', roughness: 0.32, metalness: 0.84 });
  const silverLight = new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.18, metalness: 0.94 });
  const leatherBelt = new THREE.MeshStandardMaterial({ color: '#1c1414', roughness: 0.84, metalness: 0.04 });
  const voidPlate = new THREE.MeshStandardMaterial({ color: '#1e1b4b', roughness: 0.24, metalness: 0.9 });
  const voidInner = new THREE.MeshStandardMaterial({ color: '#2d2b6e', roughness: 0.2, metalness: 0.86 });
  const voidGem = new THREE.MeshStandardMaterial({ color: '#6366f1', roughness: 0.08, metalness: 0.28, emissive: '#4338ca', emissiveIntensity: 0.35 });
  const voidGemLight = new THREE.MeshStandardMaterial({ color: '#818cf8', roughness: 0.08, metalness: 0.22, emissive: '#4f46e5', emissiveIntensity: 0.25 });
  const voidGemCore = new THREE.MeshStandardMaterial({ color: '#a5b4fc', roughness: 0.06, metalness: 0.2, emissive: '#6366f1', emissiveIntensity: 0.2 });
  const voidBand = new THREE.MeshStandardMaterial({ color: '#7c3aed', roughness: 0.18, metalness: 0.9 });

  if (itemId === 'arm_b1') {
    group.add(createBox(0.52, 0.58, 0.3, leather, [0, 0.1, 0]));
    group.add(createBox(0.08, 0.4, 0.04, leatherDark, [0, 0.14, 0.15]));
    group.add(createBox(0.1, 0.06, 0.03, leatherMid, [0, 0.24, 0.16]));
    group.add(createBox(0.1, 0.06, 0.03, leatherMid, [0, 0.06, 0.16]));
    group.add(createBox(0.1, 0.18, 0.32, leatherMid, [-0.3, 0.3, 0]));
    group.add(createBox(0.1, 0.18, 0.32, leatherMid, [0.3, 0.3, 0]));
    group.add(createBox(0.06, 0.36, 0.28, leather, [-0.28, 0.1, 0]));
    group.add(createBox(0.06, 0.36, 0.28, leather, [0.28, 0.1, 0]));
    group.add(createBox(0.1, 0.12, 0.28, clothBrown, [-0.14, -0.22, 0.02]));
    group.add(createBox(0.1, 0.12, 0.28, clothBrown, [0.14, -0.22, 0.02]));
    group.add(createBox(0.1, 0.12, 0.28, clothBrownLight, [0, -0.24, 0.02]));
    group.add(createBox(0.44, 0.08, 0.22, clothBrown, [0, 0.42, 0.06]));
  } else if (itemId === 'arm_s1') {
    group.add(createBox(0.54, 0.62, 0.32, silverPlate, [0, 0.08, 0]));
    group.add(createBox(0.5, 0.56, 0.02, silverDark, [0, 0.08, 0.16]));
    [-0.16, 0, 0.16].forEach((x) => {
      [-0.12, 0.08, 0.28].forEach((y) => {
        group.add(createBox(0.06, 0.06, 0.02, silverLight, [x, y, 0.17], [0, 0, 0.785]));
      });
    });
    group.add(createBox(0.1, 0.2, 0.34, silverDark, [-0.32, 0.32, 0]));
    group.add(createBox(0.1, 0.2, 0.34, silverDark, [0.32, 0.32, 0]));
    group.add(createBox(0.12, 0.14, 0.28, silverLight, [-0.32, 0.34, 0.04]));
    group.add(createBox(0.12, 0.14, 0.28, silverLight, [0.32, 0.34, 0.04]));
    group.add(createBox(0.56, 0.08, 0.26, leatherBelt, [0, -0.24, 0.04]));
    group.add(createBox(0.1, 0.08, 0.04, silverLight, [0, -0.24, 0.16]));
    group.add(createBox(0.46, 0.1, 0.22, silverPlate, [0, 0.42, 0.06]));
  } else if (itemId === 'arm_g1') {
    group.add(createBox(0.56, 0.62, 0.3, voidPlate, [0, 0.1, 0]));
    group.add(createBox(0.48, 0.52, 0.04, voidInner, [0, 0.16, 0.15]));
    group.add(createBox(0.08, 0.18, 0.03, voidGem, [0, 0.24, 0.18]));
    group.add(createBox(0.22, 0.05, 0.03, voidGem, [0, 0.24, 0.18]));
    group.add(createBox(0.05, 0.12, 0.03, voidGemLight, [0.14, 0.1, 0.18]));
    group.add(createBox(0.05, 0.12, 0.03, voidGemLight, [-0.14, 0.1, 0.18]));
    group.add(createBox(0.1, 0.1, 0.04, voidGem, [0, 0.16, 0.18]));
    group.add(createBox(0.06, 0.06, 0.03, voidGemCore, [0, 0.16, 0.19]));
    group.add(createBox(0.12, 0.22, 0.32, voidPlate, [-0.32, 0.32, 0.02]));
    group.add(createBox(0.12, 0.22, 0.32, voidPlate, [0.32, 0.32, 0.02]));
    group.add(createBox(0.14, 0.1, 0.18, voidInner, [-0.32, 0.4, 0.12]));
    group.add(createBox(0.14, 0.1, 0.18, voidInner, [0.32, 0.4, 0.12]));
    group.add(createBox(0.56, 0.06, 0.07, voidBand, [0, 0.42, 0.14]));
    group.add(createBox(0.56, 0.06, 0.07, voidBand, [0, -0.18, 0.14]));
    group.add(createBox(0.4, 0.1, 0.24, voidInner, [0, 0.46, 0.06]));
  } else {
    group.add(createBox(0.52, 0.6, 0.3, silverPlate, [0, 0, 0]));
  }

  return group;
};

const createLegsGroup = (itemId: string) => {
  const group = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.96, metalness: 0.02 });
  const clothDark = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.96, metalness: 0.02 });
  const leather = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.88, metalness: 0.04 });
  const leatherLight = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.82, metalness: 0.04 });
  const metal = new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.3, metalness: 0.88 });
  const metalDark = new THREE.MeshStandardMaterial({ color: '#374151', roughness: 0.34, metalness: 0.84 });
  const metalLight = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.22, metalness: 0.92 });
  const rivet = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.18, metalness: 0.94 });

  if (itemId === 'leg_b1') {
    group.add(createBox(0.2, 0.54, 0.22, cloth, [-0.14, 0.28, 0]));
    group.add(createBox(0.22, 0.18, 0.28, leather, [-0.14, -0.04, 0.02]));
    group.add(createBox(0.2, 0.06, 0.32, leather, [-0.14, -0.14, 0.08]));
    group.add(createBox(0.2, 0.54, 0.22, cloth, [0.14, 0.28, 0]));
    group.add(createBox(0.22, 0.18, 0.28, leather, [0.14, -0.04, 0.02]));
    group.add(createBox(0.2, 0.06, 0.32, leather, [0.14, -0.14, 0.08]));
    group.add(createBox(0.08, 0.14, 0.02, leatherLight, [-0.14, 0.02, 0.16]));
    group.add(createBox(0.08, 0.14, 0.02, leatherLight, [0.14, 0.02, 0.16]));
    group.add(createBox(0.44, 0.08, 0.24, clothDark, [0, 0.57, 0]));
  } else if (itemId === 'leg_s1') {
    group.add(createBox(0.22, 0.46, 0.24, metal, [-0.15, 0.32, 0.02]));
    group.add(createBox(0.22, 0.46, 0.24, metal, [0.15, 0.32, 0.02]));
    group.add(createBox(0.24, 0.12, 0.1, metalLight, [-0.15, 0.08, 0.12]));
    group.add(createBox(0.24, 0.12, 0.1, metalLight, [0.15, 0.08, 0.12]));
    group.add(createBox(0.22, 0.32, 0.22, metalDark, [-0.15, -0.14, 0.04]));
    group.add(createBox(0.22, 0.32, 0.22, metalDark, [0.15, -0.14, 0.04]));
    group.add(createBox(0.18, 0.3, 0.04, metalLight, [-0.15, -0.14, 0.13]));
    group.add(createBox(0.18, 0.3, 0.04, metalLight, [0.15, -0.14, 0.13]));
    group.add(createBox(0.22, 0.1, 0.3, metal, [-0.15, -0.33, 0.06]));
    group.add(createBox(0.22, 0.1, 0.3, metal, [0.15, -0.33, 0.06]));
    group.add(createBox(0.2, 0.08, 0.08, metalLight, [-0.15, -0.36, 0.18], [0.3, 0, 0]));
    group.add(createBox(0.2, 0.08, 0.08, metalLight, [0.15, -0.36, 0.18], [0.3, 0, 0]));
    group.add(createBox(0.025, 0.025, 0.025, rivet, [-0.22, 0.22, 0.14]));
    group.add(createBox(0.025, 0.025, 0.025, rivet, [0.22, 0.22, 0.14]));
    group.add(createBox(0.46, 0.08, 0.26, metal, [0, 0.58, 0]));
  } else {
    group.add(createBox(0.36, 0.7, 0.22, metal, [0, 0, 0]));
  }

  return group;
};

const createPotionGroup = (itemId: string) => {
  const group = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: '#6b3a1f', roughness: 0.88, metalness: 0.03 });
  const leatherDark = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9, metalness: 0.03 });
  const leatherLight = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.82, metalness: 0.04 });
  const darkStone = new THREE.MeshStandardMaterial({ color: '#292524', roughness: 0.86, metalness: 0.02 });
  const silver = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.2, metalness: 0.92 });
  const silverPlate = new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.28, metalness: 0.88 });
  const silverDark = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.18, metalness: 0.9 });
  const silverLight = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.12, metalness: 0.95 });
  const steel = new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.3, metalness: 0.88 });
  const glassWhite = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.1, metalness: 0.08, transparent: true, opacity: 0.55, emissive: '#cbd5e1', emissiveIntensity: 0.12 });
  const glassBlue = new THREE.MeshStandardMaterial({ color: '#bfdbfe', roughness: 0.1, metalness: 0.08, transparent: true, opacity: 0.5, emissive: '#60a5fa', emissiveIntensity: 0.1 });
  const greenGlass = new THREE.MeshStandardMaterial({ color: '#d1fae5', roughness: 0.1, metalness: 0.06, transparent: true, opacity: 0.5, emissive: '#6ee7b7', emissiveIntensity: 0.12 });
  const redLiquid = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.8, emissive: '#b91c1c', emissiveIntensity: 0.32 });
  const redLiquidLight = new THREE.MeshStandardMaterial({ color: '#f87171', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.6, emissive: '#ef4444', emissiveIntensity: 0.18 });
  const blueLiquid = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.8, emissive: '#2563eb', emissiveIntensity: 0.3 });
  const blueLiquidLight = new THREE.MeshStandardMaterial({ color: '#93c5fd', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.6, emissive: '#60a5fa', emissiveIntensity: 0.18 });
  const blueLiquidSoft = new THREE.MeshStandardMaterial({ color: '#60a5fa', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.6, emissive: '#2563eb', emissiveIntensity: 0.16 });
  const orangeCore = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.8, emissive: '#ea580c', emissiveIntensity: 0.34 });
  const orangeLight = new THREE.MeshStandardMaterial({ color: '#fb923c', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.7, emissive: '#f97316', emissiveIntensity: 0.2 });
  const orangeFlame = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.55, emissive: '#f59e0b', emissiveIntensity: 0.24 });
  const greenCore = new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.8, emissive: '#059669', emissiveIntensity: 0.28 });
  const greenLight = new THREE.MeshStandardMaterial({ color: '#d1fae5', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.55, emissive: '#6ee7b7', emissiveIntensity: 0.14 });
  const greenBase = new THREE.MeshStandardMaterial({ color: '#065f46', roughness: 0.76, metalness: 0.02 });
  const greenBaseDark = new THREE.MeshStandardMaterial({ color: '#064e3b', roughness: 0.8, metalness: 0.02 });
  const glassGold = new THREE.MeshStandardMaterial({ color: '#fef9c3', roughness: 0.08, metalness: 0.06, transparent: true, opacity: 0.55, emissive: '#fde68a', emissiveIntensity: 0.14 });
  const goldMetal = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.16, metalness: 0.95 });
  const goldMetalLight = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.14, metalness: 0.95 });
  const goldGem = new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.06, metalness: 0.22, emissive: '#f59e0b', emissiveIntensity: 0.2 });
  const goldBody = new THREE.MeshStandardMaterial({ color: '#fffbeb', roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.42, emissive: '#fde68a', emissiveIntensity: 0.12 });
  const goldCore = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.65, emissive: '#facc15', emissiveIntensity: 0.18 });
  const goldCoreLight = new THREE.MeshStandardMaterial({ color: '#fff7ed', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.7, emissive: '#fde68a', emissiveIntensity: 0.12 });
  const amberMetal = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.18, metalness: 0.92 });
  const violetCore = new THREE.MeshStandardMaterial({ color: '#c084fc', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.75, emissive: '#9333ea', emissiveIntensity: 0.28 });
  const violetLight = new THREE.MeshStandardMaterial({ color: '#e9d5ff', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.55, emissive: '#c084fc', emissiveIntensity: 0.16 });
  const violetLight2 = new THREE.MeshStandardMaterial({ color: '#f5d0fe', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.6, emissive: '#e879f9', emissiveIntensity: 0.16 });
  const violetRune = new THREE.MeshStandardMaterial({ color: '#d8b4fe', roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.6, emissive: '#c084fc', emissiveIntensity: 0.12 });
  const darkOrangeGlass = new THREE.MeshStandardMaterial({ color: '#431407', roughness: 0.2, metalness: 0.02, transparent: true, opacity: 0.7 });
  const darkOrangeBody = new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.2, metalness: 0.02, transparent: true, opacity: 0.7 });

  if (itemId === 'pot_1') {
    group.add(createBox(0.14, 0.08, 0.14, leather, [0, 0.46, 0]));
    group.add(createBox(0.14, 0.14, 0.14, glassWhite, [0, 0.34, 0]));
    group.add(createBox(0.09, 0.1, 0.09, redLiquid, [0, 0.34, 0]));
    group.add(createBox(0.4, 0.4, 0.4, glassWhite, [0, 0.08, 0]));
    group.add(createBox(0.35, 0.35, 0.35, redLiquid, [0, 0.08, 0]));
    group.add(createBox(0.06, 0.18, 0.36, glassWhite, [0.18, 0.08, 0]));
    group.add(createBox(0.02, 0.12, 0.03, redLiquid, [0.205, 0.08, 0]));
    group.add(createBox(0.02, 0.03, 0.12, redLiquid, [0.205, 0.08, 0]));
    group.add(createBox(0.32, 0.06, 0.32, redLiquidLight, [0, -0.15, 0]));
  } else if (itemId === 'pot_2') {
    group.add(createBox(0.12, 0.1, 0.12, leather, [0, 0.6, 0]));
    group.add(createBox(0.14, 0.04, 0.14, darkStone, [0, 0.67, 0]));
    group.add(createBox(0.14, 0.24, 0.14, glassBlue, [0, 0.44, 0]));
    group.add(createBox(0.3, 0.62, 0.3, glassWhite, [0, 0.08, 0]));
    group.add(createBox(0.24, 0.56, 0.24, blueLiquid, [0, 0.08, 0]));
    group.add(createBox(0.04, 0.2, 0.04, blueLiquidLight, [0.1, 0.22, 0], [0, 0, 0.4]));
    group.add(createBox(0.04, 0.2, 0.04, blueLiquidSoft, [-0.1, 0.1, 0], [0, 0, -0.4]));
    group.add(createBox(0.02, 0.06, 0.06, glassBlue, [0.14, 0.12, 0]));
    group.add(createBox(0.02, 0.08, 0.02, glassBlue, [0.14, 0.12, 0]));
    group.add(createBox(0.28, 0.06, 0.28, blueLiquid, [0, -0.24, 0]));
  } else if (itemId === 'pot_atk') {
    group.add(createBox(0.1, 0.14, 0.1, darkStone, [0, 0.6, 0]));
    group.add(createBox(0.06, 0.1, 0.06, redLiquid, [0, 0.72, 0]));
    group.add(createBox(0.04, 0.08, 0.04, orangeCore, [0, 0.8, 0]));
    group.add(createBox(0.18, 0.18, 0.18, darkOrangeGlass, [0, 0.46, 0]));
    group.add(createBox(0.42, 0.5, 0.42, darkOrangeBody, [0, 0.12, 0]));
    group.add(createBox(0.36, 0.44, 0.36, orangeCore, [0, 0.12, 0]));
    group.add(createBox(0.08, 0.44, 0.08, orangeLight, [0.18, 0.12, 0.18]));
    group.add(createBox(0.08, 0.44, 0.08, orangeLight, [-0.18, 0.12, 0.18]));
    group.add(createBox(0.04, 0.14, 0.08, orangeFlame, [0.19, 0.28, 0]));
    group.add(createBox(0.04, 0.1, 0.06, redLiquid, [0.19, 0.08, 0]));
    group.add(createBox(0.4, 0.08, 0.4, darkOrangeGlass, [0, -0.14, 0]));
    group.add(createBox(0.3, 0.04, 0.3, leatherLight, [0, -0.19, 0]));
  } else if (itemId === 'pot_def') {
    group.add(createBox(0.2, 0.06, 0.2, silverDark, [0, 0.5, 0]));
    group.add(createBox(0.14, 0.08, 0.14, silverPlate, [0, 0.46, 0]));
    group.add(createBox(0.18, 0.12, 0.18, greenGlass, [0, 0.36, 0]));
    group.add(createBox(0.48, 0.5, 0.48, greenLight, [0, 0.06, 0]));
    group.add(createBox(0.42, 0.44, 0.42, greenCore, [0, 0.06, 0]));
    group.add(createBox(0.02, 0.18, 0.14, greenGlass, [0.215, 0.1, 0]));
    group.add(createBox(0.02, 0.08, 0.1, greenGlass, [0.215, 0.04, 0], [0.3, 0, 0]));
    group.add(createBox(0.12, 0.12, 0.12, steel, [0, 0.1, 0]));
    group.add(createBox(0.46, 0.06, 0.46, greenBase, [0, -0.2, 0]));
    group.add(createBox(0.36, 0.04, 0.36, greenBaseDark, [0, -0.24, 0]));
  } else if (itemId === 'pot_3') {
    group.add(createBox(0.16, 0.06, 0.16, silver, [0, 0.7, 0]));
    group.add(createBox(0.1, 0.06, 0.1, silverDark, [0, 0.76, 0]));
    group.add(createBox(0.06, 0.04, 0.06, silverLight, [0, 0.81, 0]));
    group.add(createBox(0.14, 0.22, 0.14, glassWhite, [0, 0.54, 0]));
    group.add(createBox(0.36, 0.72, 0.36, glassWhite, [0, 0.14, 0]));
    group.add(createBox(0.3, 0.66, 0.3, violetCore, [0, 0.14, 0]));
    group.add(createBox(0.14, 0.3, 0.14, violetLight, [0, 0.26, 0]));
    group.add(createBox(0.1, 0.14, 0.1, violetLight2, [0, 0.1, 0]));
    group.add(createBox(0.02, 0.4, 0.02, violetRune, [0.16, 0.3, 0]));
    group.add(createBox(0.02, 0.4, 0.02, violetRune, [0.16, 0.3, 0.1]));
    group.add(createBox(0.32, 0.06, 0.32, silverDark, [0, -0.25, 0]));
  } else if (itemId === 'pot_4') {
    group.add(createBox(0.22, 0.08, 0.22, goldMetal, [0, 0.66, 0]));
    group.add(createBox(0.14, 0.1, 0.14, goldMetalLight, [0, 0.72, 0]));
    [0, 0.785, 1.57, 2.355].forEach((a) => {
      group.add(createBox(0.04, 0.06, 0.04, goldGem, [Math.cos(a) * 0.09, 0.78, Math.sin(a) * 0.09]));
    });
    group.add(createBox(0.18, 0.2, 0.18, glassGold, [0, 0.5, 0]));
    group.add(createBox(0.22, 0.05, 0.22, goldMetal, [0, 0.41, 0]));
    group.add(createBox(0.54, 0.58, 0.54, goldBody, [0, 0.08, 0]));
    group.add(createBox(0.46, 0.5, 0.46, goldMetalLight, [0, 0.08, 0]));
    group.add(createBox(0.22, 0.24, 0.22, goldCore, [0, 0.16, 0]));
    group.add(createBox(0.16, 0.16, 0.16, goldCoreLight, [0, 0.06, 0]));
    group.add(createBox(0.56, 0.06, 0.56, goldMetal, [0, 0.08, 0]));
    group.add(createBox(0.02, 0.04, 0.04, goldGem, [0.26, 0.22, 0]));
    group.add(createBox(0.02, 0.04, 0.04, goldGem, [0.26, 0, 0.14]));
    group.add(createBox(0.46, 0.08, 0.46, amberMetal, [0, -0.24, 0]));
    group.add(createBox(0.52, 0.06, 0.52, goldMetal, [0, -0.3, 0]));
  } else {
    group.add(createBox(0.36, 0.36, 0.36, redLiquid, [0, 0, 0]));
    group.add(createBox(0.14, 0.2, 0.14, glassWhite, [0, 0.28, 0]));
    group.add(createBox(0.18, 0.06, 0.18, leatherDark, [0, 0.43, 0]));
  }

  return group;
};

const createMaterialGroup = (itemId: string) => {
  const group = new THREE.Group();

  if (itemId.includes('wood')) {
    const bark = new THREE.MeshStandardMaterial({ color: '#7c4820', roughness: 0.84, metalness: 0.03 });
    const barkDark = new THREE.MeshStandardMaterial({ color: '#5c3010', roughness: 0.88, metalness: 0.02 });
    const barkLight = new THREE.MeshStandardMaterial({ color: '#92500a', roughness: 0.82, metalness: 0.02 });
    const woodTop = new THREE.MeshStandardMaterial({ color: '#a16207', roughness: 0.72, metalness: 0.04 });
    const woodCore = new THREE.MeshStandardMaterial({ color: '#ca8a04', roughness: 0.7, metalness: 0.04 });
    const woodCoreLight = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.68, metalness: 0.04 });
    const moss = new THREE.MeshStandardMaterial({ color: '#4d7c0f', roughness: 0.96, metalness: 0.01, transparent: true, opacity: 0.75 });
    const mossLight = new THREE.MeshStandardMaterial({ color: '#65a30d', roughness: 0.96, metalness: 0.01, transparent: true, opacity: 0.65 });

    group.add(createBox(0.26, 0.54, 0.26, bark, [0, 0, 0], [0.2, 0.4, 0]));
    group.add(createBox(0.04, 0.54, 0.04, barkDark, [0.12, 0, 0.08], [0.2, 0.4, 0]));
    group.add(createBox(0.04, 0.46, 0.04, barkLight, [-0.1, 0.05, 0.12], [0.2, 0.4, 0]));
    group.add(createBox(0.04, 0.5, 0.04, barkDark, [0.06, -0.04, -0.12], [0.2, 0.4, 0]));
    group.add(createBox(0.24, 0.04, 0.24, woodTop, [0, 0.28, 0], [0.2, 0.4, 0]));
    group.add(createBox(0.12, 0.042, 0.12, woodCore, [0, 0.28, 0], [0.2, 0.4, 0]));
    group.add(createBox(0.04, 0.044, 0.04, woodCoreLight, [0, 0.28, 0], [0.2, 0.4, 0]));
    group.add(createBox(0.06, 0.1, 0.06, moss, [-0.12, 0.1, 0.1], [0.2, 0.4, 0]));
    group.add(createBox(0.05, 0.06, 0.05, mossLight, [0.08, -0.1, 0.12], [0.2, 0.4, 0]));
  } else if (itemId.includes('bone')) {
    const bone = new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.78, metalness: 0.02 });
    const boneLight = new THREE.MeshStandardMaterial({ color: '#f1ece0', roughness: 0.74, metalness: 0.02 });
    const boneTop = new THREE.MeshStandardMaterial({ color: '#f8f3ea', roughness: 0.72, metalness: 0.02 });
    const marrow = new THREE.MeshStandardMaterial({ color: '#d4a5a5', roughness: 0.9, metalness: 0.01, transparent: true, opacity: 0.4 });
    const crack = new THREE.MeshStandardMaterial({ color: '#c8bfad', roughness: 0.84, metalness: 0.01 });

    group.add(createBox(0.1, 0.55, 0.1, bone, [0, 0, 0], [0, 0, 0.3]));
    group.add(createBox(0.2, 0.16, 0.18, boneLight, [0, 0.32, 0], [0, 0, 0.3]));
    group.add(createBox(0.06, 0.1, 0.06, boneTop, [0.08, 0.38, 0.06], [0, 0, 0.3]));
    group.add(createBox(0.06, 0.1, 0.06, boneTop, [-0.08, 0.38, -0.06], [0, 0, 0.3]));
    group.add(createBox(0.2, 0.16, 0.18, boneLight, [0, -0.32, 0], [0, 0, 0.3]));
    group.add(createBox(0.06, 0.1, 0.06, boneTop, [0.08, -0.38, 0.06], [0, 0, 0.3]));
    group.add(createBox(0.03, 0.3, 0.03, marrow, [0.04, 0.1, 0.04], [0, 0, 0.3]));
    group.add(createBox(0.012, 0.2, 0.012, crack, [0.05, 0, 0.04], [0, 0, 0.3]));
  } else if (itemId.includes('slime')) {
    const slime = new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.22, metalness: 0.02, transparent: true, opacity: 0.8, emissive: '#059669', emissiveIntensity: 0.35 });
    const slimeLight = new THREE.MeshStandardMaterial({ color: '#34d399', roughness: 0.18, metalness: 0.02, transparent: true, opacity: 0.75, emissive: '#10b981', emissiveIntensity: 0.2 });
    const slimeBright = new THREE.MeshStandardMaterial({ color: '#6ee7b7', roughness: 0.14, metalness: 0.02, transparent: true, opacity: 0.65, emissive: '#34d399', emissiveIntensity: 0.16 });
    const slimeBubble = new THREE.MeshStandardMaterial({ color: '#a7f3d0', roughness: 0.12, metalness: 0.02, transparent: true, opacity: 0.55, emissive: '#6ee7b7', emissiveIntensity: 0.14 });
    const slimeBase = new THREE.MeshStandardMaterial({ color: '#059669', roughness: 0.18, metalness: 0.02, transparent: true, opacity: 0.65, emissive: '#047857', emissiveIntensity: 0.16 });
    const slimeHighlight = new THREE.MeshStandardMaterial({ color: '#ecfdf5', roughness: 0.08, metalness: 0.02, transparent: true, opacity: 0.8, emissive: '#bbf7d0', emissiveIntensity: 0.12 });

    group.add(createBox(0.44, 0.32, 0.44, slime, [0, -0.06, 0]));
    group.add(createBox(0.32, 0.22, 0.32, slimeLight, [0, 0.1, 0]));
    group.add(createBox(0.18, 0.14, 0.18, slimeBright, [0, 0.22, 0]));
    group.add(createBox(0.08, 0.08, 0.08, slimeBubble, [0.16, 0.24, 0.1]));
    group.add(createBox(0.06, 0.06, 0.06, slimeBubble, [-0.12, 0.18, 0.14]));
    group.add(createBox(0.05, 0.05, 0.05, slimeBubble, [0.05, 0.28, -0.12]));
    group.add(createBox(0.52, 0.06, 0.52, slimeBase, [0, -0.2, 0]));
    group.add(createBox(0.04, 0.04, 0.02, slimeHighlight, [0.12, 0.26, 0.1]));
  } else if (itemId.includes('cloth')) {
    const cloth = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.98, metalness: 0.01 });
    const clothMid = new THREE.MeshStandardMaterial({ color: '#7f8ea3', roughness: 0.98, metalness: 0.01 });
    const clothLight = new THREE.MeshStandardMaterial({ color: '#a8b5c4', roughness: 0.98, metalness: 0.01 });
    const threadDark = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.98, metalness: 0.01 });
    const thread = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.98, metalness: 0.01 });

    group.add(createBox(0.54, 0.06, 0.42, cloth, [0, 0.04, 0], [0, 0.5, 0.1]));
    group.add(createBox(0.46, 0.06, 0.38, clothMid, [0.04, 0.1, -0.04], [0, 0.6, 0.2]));
    group.add(createBox(0.42, 0.06, 0.36, clothLight, [-0.04, 0.16, 0.04], [-0.05, 0.4, 0.05]));
    group.add(createBox(0.04, 0.06, 0.04, threadDark, [0.25, 0.04, 0.12], [0, 0.5, 0.4]));
    group.add(createBox(0.03, 0.06, 0.05, threadDark, [0.28, 0.04, 0.04], [0, 0.5, -0.2]));
    group.add(createBox(0.04, 0.06, 0.04, threadDark, [0.26, 0.04, -0.1], [0, 0.5, 0.4]));
    group.add(createBox(0.4, 0.02, 0.02, thread, [0, 0.04, 0.22], [0, 0.5, 0.1]));
    group.add(createBox(0.02, 0.02, 0.4, thread, [-0.24, 0.04, 0.02], [0, 0.5, 0.1]));
  } else if (itemId.includes('iron')) {
    const iron = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.34, metalness: 0.9 });
    const ironLight = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.18, metalness: 0.95 });
    const ironDark = new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.36, metalness: 0.86 });
    const rustA = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.82, metalness: 0.02 });
    const rustB = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.84, metalness: 0.02 });
    const inclusion = new THREE.MeshStandardMaterial({ color: '#374151', roughness: 0.46, metalness: 0.8 });

    group.add(createBox(0.38, 0.22, 0.28, iron, [0, 0, 0], [0.2, 0.3, 0.1]));
    group.add(createBox(0.36, 0.04, 0.26, ironLight, [0, 0.12, 0], [0.2, 0.3, 0.1]));
    group.add(createBox(0.04, 0.2, 0.26, ironDark, [0.18, 0, 0], [0.2, 0.3, 0.1]));
    group.add(createBox(0.04, 0.18, 0.18, ironDark, [-0.18, 0, 0.06], [0.2, 0.3, 0.1]));
    group.add(createBox(0.08, 0.042, 0.06, rustA, [0.1, 0.12, 0.1], [0.2, 0.3, 0.1]));
    group.add(createBox(0.06, 0.042, 0.05, rustB, [-0.12, 0.12, -0.08], [0.2, 0.3, 0.1]));
    group.add(createBox(0.08, 0.12, 0.08, ironDark, [0.14, 0.06, 0.12], [0.5, 0.3, 0.4]));
    group.add(createBox(0.12, 0.042, 0.1, ironLight, [0, 0.12, 0], [0.2, 0.3, 0.1]));
    group.add(createBox(0.04, 0.04, 0.04, inclusion, [-0.06, 0, -0.1], [0.2, 0.3, 0.1]));
    group.add(createBox(0.04, 0.04, 0.04, inclusion, [0.08, -0.04, 0.08], [0.2, 0.3, 0.1]));
  } else {
    const gold = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.18, metalness: 0.98 });
    const goldLight = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.14, metalness: 0.98 });
    const goldDark = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.18, metalness: 0.95 });
    const goldAmber = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.18, metalness: 0.95 });
    const goldShine = new THREE.MeshStandardMaterial({ color: '#fef08a', roughness: 0.08, metalness: 0.4, emissive: '#facc15', emissiveIntensity: 0.12 });
    const goldShine2 = new THREE.MeshStandardMaterial({ color: '#fef9c3', roughness: 0.08, metalness: 0.35, emissive: '#fde68a', emissiveIntensity: 0.1 });
    const goldGem = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.06, metalness: 0.2, emissive: '#fbbf24', emissiveIntensity: 0.12 });
    const goldGem2 = new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.06, metalness: 0.2, emissive: '#facc15', emissiveIntensity: 0.1 });
    const crevice = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.86, metalness: 0.02, transparent: true, opacity: 0.4 });

    group.add(createBox(0.3, 0.24, 0.26, gold, [0, 0, 0], [0.1, 0.5, 0.15]));
    group.add(createBox(0.1, 0.12, 0.1, goldLight, [0.12, 0.08, 0.08], [0.1, 0.5, 0.15]));
    group.add(createBox(0.12, 0.1, 0.1, goldDark, [-0.1, 0.06, -0.1], [0.1, 0.5, 0.15]));
    group.add(createBox(0.12, 0.1, 0.08, goldAmber, [0.06, -0.08, 0.1], [0.1, 0.5, 0.15]));
    group.add(createBox(0.08, 0.04, 0.08, goldShine, [0.04, 0.14, 0.04], [0.1, 0.5, 0.15]));
    group.add(createBox(0.06, 0.04, 0.06, goldShine2, [-0.08, 0.1, -0.04], [0.1, 0.5, 0.15]));
    group.add(createBox(0.04, 0.04, 0.04, goldGem, [0.14, 0.12, 0.12], [0.1, 0.5, 0.15]));
    group.add(createBox(0.03, 0.03, 0.03, goldGem2, [-0.12, -0.05, 0.12], [0.1, 0.5, 0.15]));
    group.add(createBox(0.04, 0.14, 0.04, crevice, [0.02, -0.02, 0.02], [0.1, 0.5, 0.15]));
  }

  return group;
};

const createItemGroup = (item: Item) => {
  switch (item.type) {
    case 'weapon':
      return createWeaponGroup(item.id);
    case 'shield':
      return createShieldGroup(item.id);
    case 'helmet':
      return createHelmetGroup(item.id);
    case 'armor':
      return createArmorGroup(item.id);
    case 'legs':
      return createLegsGroup(item.id);
    case 'potion':
      return createPotionGroup(item.id);
    case 'material':
      return createMaterialGroup(item.id);
    default:
      return createMaterialGroup(item.id);
  }
};

type PreviewPose = {
  scaleTarget: number;
  positionY: number;
  rotation: [number, number, number];
  cameraZ: number;
  targetY: number;
};

const getPreviewPose = (item: Item): PreviewPose => {
  const registeredWeapon = getRegisteredWeapon3DByItemId(item.id);

  if (registeredWeapon) {
    return {
      scaleTarget: 1.7 * registeredWeapon.previewTransform.scaleMultiplier,
      positionY: registeredWeapon.previewTransform.positionY,
      rotation: registeredWeapon.previewTransform.rotation,
      cameraZ: 6.4,
      targetY: 0.05,
    };
  }

  switch (item.type) {
    case 'weapon':
      return { scaleTarget: 1.65, positionY: 0.05, rotation: [0.1, 0.35, -0.95], cameraZ: 6.4, targetY: 0.05 };
    case 'shield':
      return { scaleTarget: 1.9, positionY: 0.0, rotation: [0.08, 0.4, -0.05], cameraZ: 5.4, targetY: 0.1 };
    case 'helmet':
      return { scaleTarget: 1.9, positionY: 0.15, rotation: [0.08, 0.45, 0], cameraZ: 5.0, targetY: 0.2 };
    case 'armor':
      return { scaleTarget: 2.0, positionY: 0.0, rotation: [0.08, 0.45, 0], cameraZ: 5.4, targetY: 0.15 };
    case 'legs':
      return { scaleTarget: 1.95, positionY: -0.1, rotation: [0.05, 0.4, 0], cameraZ: 5.3, targetY: 0.0 };
    case 'potion':
      return { scaleTarget: 1.55, positionY: 0.0, rotation: [0.04, 0.5, 0], cameraZ: 4.7, targetY: 0.05 };
    case 'material':
    default:
      return { scaleTarget: 1.45, positionY: -0.05, rotation: [0.18, 0.65, -0.05], cameraZ: 4.8, targetY: 0.0 };
  }
};

const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }

  material.dispose();
};

const buildPreviewRuntimeMaterial = (material: THREE.Material, texture: THREE.Texture): THREE.Material => {
  const sourceMaterial = material as THREE.Material & {
    color?: THREE.Color;
    opacity?: number;
    transparent?: boolean;
    side?: THREE.Side;
    alphaTest?: number;
  };

  return new THREE.MeshStandardMaterial({
    color: sourceMaterial.color?.clone() ?? new THREE.Color('#ffffff'),
    map: texture,
    transparent: Boolean(sourceMaterial.transparent) || (sourceMaterial.opacity ?? 1) < 1,
    opacity: sourceMaterial.opacity ?? 1,
    side: sourceMaterial.side ?? THREE.FrontSide,
    alphaTest: sourceMaterial.alphaTest ?? 0,
    roughness: 0.82,
    metalness: 0.08,
  });
};

const prepareExternalTexture = (texture: THREE.Texture) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
};

const loadRegisteredWeaponPreviewGroup = async (item: Item): Promise<THREE.Group | null> => {
  const definition = getRegisteredWeapon3DByItemId(item.id);

  if (!definition) {
    return null;
  }

  const loader = new FBXLoader();
  const textureLoader = new THREE.TextureLoader();
  const [sourceModel, texture] = await Promise.all([
    loader.loadAsync(definition.modelUrl),
    textureLoader.loadAsync(definition.textureUrl),
  ]);

  const previewGroup = sourceModel.clone(true) as THREE.Group;
  prepareExternalTexture(texture);

  previewGroup.traverse((node) => {
    const mesh = node as THREE.Mesh;

    if (!mesh.isMesh) {
      return;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((entry) => buildPreviewRuntimeMaterial(entry, texture));
    } else if (mesh.material) {
      mesh.material = buildPreviewRuntimeMaterial(mesh.material, texture);
    }
  });

  return previewGroup;
};

const createFallbackItemGroup = () => {
  const group = new THREE.Group();
  const core = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.3, metalness: 0.82 });
  const accent = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.12, metalness: 0.18, emissive: '#0ea5e9', emissiveIntensity: 0.18 });

  group.add(createBox(0.46, 0.46, 0.46, core, [0, 0, 0], [0.25, 0.45, 0.15]));
  group.add(createBox(0.18, 0.18, 0.18, accent, [0, 0.18, 0.18], [0.25, 0.45, 0.15]));
  group.add(createBox(0.1, 0.52, 0.1, accent, [0, -0.12, 0], [0.3, 0.15, 0.2]));

  return group;
};

export function ItemPreviewThree({ item, variant = 'default' }: { item: Item; variant?: 'default' | 'menu' }) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const isMenuVariant = variant === 'menu';

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(isMenuVariant ? '#000000' : '#020617', isMenuVariant ? 0 : 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = isMenuVariant ? 3.1 : 2.5;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;

    const pose = getPreviewPose(item);
    camera.position.set(0, pose.targetY + 0.25, pose.cameraZ);

    scene.add(new THREE.AmbientLight('#cbd5e1', 1.2));

    const keyLight = new THREE.DirectionalLight('#f8fafc', 2.6);
    keyLight.position.set(4, 5, 6);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 1.4);
    rimLight.position.set(-4, 2.5, -3);
    scene.add(rimLight);

    const pointLight = new THREE.PointLight('#f59e0b', 1.4, 14, 2);
    pointLight.position.set(0, 2.2, 3.2);
    scene.add(pointLight);

    const pedestalGroup = new THREE.Group();
    if (!isMenuVariant) {
      const pedestalBase = new THREE.Mesh(
        new THREE.CylinderGeometry(1.75, 1.95, 0.38, 40),
        new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.55, roughness: 0.35 })
      );
      pedestalBase.position.y = -1.58;
      pedestalBase.receiveShadow = true;
      pedestalGroup.add(pedestalBase);

      const pedestalTop = new THREE.Mesh(
        new THREE.CylinderGeometry(1.25, 1.35, 0.1, 40),
        new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.45, roughness: 0.2, emissive: '#0f172a', emissiveIntensity: 0.5 })
      );
      pedestalTop.position.y = -1.28;
      pedestalTop.receiveShadow = true;
      pedestalGroup.add(pedestalTop);
    }

    const shadowPlane = new THREE.Mesh(
      new THREE.CircleGeometry(isMenuVariant ? 1.55 : 1.25, 40),
      new THREE.MeshBasicMaterial({ color: isMenuVariant ? '#4b2e2a' : '#000000', opacity: isMenuVariant ? 0.24 : 0.18, transparent: true })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = isMenuVariant ? -1.12 : -1.18;
    pedestalGroup.add(shadowPlane);

    if (isMenuVariant) {
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(1.42, 1.98, 48),
        new THREE.MeshBasicMaterial({ color: '#c08a52', transparent: true, opacity: 0.18, side: THREE.DoubleSide })
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -1.1;
      pedestalGroup.add(halo);
    } else {
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(3.6, 48),
        new THREE.MeshStandardMaterial({ color: '#020617', metalness: 0.1, roughness: 0.95 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.74;
      floor.receiveShadow = true;
      pedestalGroup.add(floor);
    }
    scene.add(pedestalGroup);

    const resize = () => {
      const width = Math.max(mount.clientWidth, 1);
      const height = Math.max(mount.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(() => {
      resize();
    });
    observer.observe(mount);

    let frameId = 0;
    let disposed = false;

    const initialize = async () => {
      let itemGroup: THREE.Group;

      try {
        itemGroup = await loadRegisteredWeaponPreviewGroup(item) ?? createItemGroup(item);
      } catch (error) {
        console.error(`Failed to render preview for item ${item.id}`, error);
        itemGroup = createFallbackItemGroup();
      }

      if (disposed) {
        itemGroup.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (mesh.geometry) {
            mesh.geometry.dispose();
          }
          if (mesh.material) {
            disposeMaterial(mesh.material);
          }
        });
        return;
      }

      const bounds = new THREE.Box3().setFromObject(itemGroup);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      itemGroup.position.set(-center.x, -center.y + pose.positionY, -center.z);

      const scaleTarget = pose.scaleTarget / Math.max(size.x, size.y, size.z, 1);
      itemGroup.scale.setScalar(scaleTarget);
      itemGroup.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
      if (isMenuVariant) {
        // Item previews in shop should start facing front.
        itemGroup.rotation.y += Math.PI;
      }
      scene.add(itemGroup);

      const fittedBounds = new THREE.Box3().setFromObject(itemGroup);
      const fittedCenter = fittedBounds.getCenter(new THREE.Vector3());
      const fittedSize = fittedBounds.getSize(new THREE.Vector3());
      const dominantSize = Math.max(fittedSize.x, fittedSize.y, fittedSize.z, 1);
      const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
      const fitDistance = dominantSize / (2 * Math.tan(halfFov));

      itemGroup.position.x -= fittedCenter.x;
      itemGroup.position.z -= fittedCenter.z;

      if (isMenuVariant) {
        itemGroup.position.y -= fittedCenter.y;
      } else {
        itemGroup.position.y += -1.02 - fittedBounds.min.y;
      }

      let framedBounds = new THREE.Box3().setFromObject(itemGroup);
      let framedCenter = framedBounds.getCenter(new THREE.Vector3());

      if (isMenuVariant) {
        itemGroup.position.x -= framedCenter.x;
        itemGroup.position.y -= framedCenter.y;
        itemGroup.position.z -= framedCenter.z;
        framedBounds = new THREE.Box3().setFromObject(itemGroup);
        framedCenter = framedBounds.getCenter(new THREE.Vector3());
      }

      const framedSize = framedBounds.getSize(new THREE.Vector3());
      if (isMenuVariant) {
        // Compensate persistent right-bias in menu composition.
        itemGroup.position.x -= Math.max(0.08, framedSize.x * 0.07);
        framedBounds = new THREE.Box3().setFromObject(itemGroup);
        framedCenter = framedBounds.getCenter(new THREE.Vector3());
      }
      const framedDistance = isMenuVariant
        ? Math.max(fitDistance * 1.95, framedSize.y * 1.2 + 2.7, 5.2)
        : Math.max(fitDistance * 1.65, framedSize.y * 1.1 + 2.4, 4.4);

      controls.target.set(framedCenter.x, framedCenter.y, framedCenter.z);
      camera.position.set(
        framedCenter.x,
        framedCenter.y + framedSize.y * (isMenuVariant ? 0.04 : 0.12),
        framedCenter.z + framedDistance
      );
      camera.near = 0.1;
      camera.far = Math.max(100, framedDistance * 8);
      camera.updateProjectionMatrix();

      resize();
      controls.update();
    };

    void initialize();

    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      scene.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          disposeMaterial(mesh.material);
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [item, variant]);

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-[inherit] ${variant === 'menu' ? 'rpg-3d-showcase' : ''}`}>
      {variant !== 'menu' && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-cyan-400/25 bg-slate-950/80 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100">
          <div>3D preview live</div>
          <div className="mt-1 text-[9px] tracking-[0.14em] text-cyan-200/80">{item.type} :: {item.id}</div>
        </div>
      )}
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
}
