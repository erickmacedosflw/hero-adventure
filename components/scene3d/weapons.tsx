import React, { useCallback, useMemo, useRef } from 'react';
import { TransformControls, useFBX, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  RIGHT_HAND_BONE_CANDIDATES,
  buildRuntimeMaterial,
  findAttachmentBone,
} from './animation';
import type {
  DeveloperWeaponTransformControlMode,
  DeveloperWeaponTransformOverride,
} from './types';
import {
  getRegisteredWeapon3DByItemId,
  RegisteredWeapon3DDefinition,
} from '../../game/data/weaponCatalog';

const WeaponAttachmentPreview = ({
  definition,
  transform,
}: {
  definition: RegisteredWeapon3DDefinition;
  transform: DeveloperWeaponTransformOverride;
}) => {
  const model = useFBX(definition.modelUrl);
  const texture = useTexture(definition.textureUrl);

  const preparedWeapon = useMemo(() => {
    const weaponClone = cloneSkeleton(model) as THREE.Group;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    weaponClone.traverse((node) => {
      const mesh = node as THREE.Mesh;

      if (!mesh.isMesh) {
        return;
      }

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material) => buildRuntimeMaterial(material, texture));
      } else if (mesh.material) {
        mesh.material = buildRuntimeMaterial(mesh.material, texture);
      }
    });

    // Normalize weapon size so imported FBX scale does not explode relative to the hero rig.
    const bounds = new THREE.Box3().setFromObject(weaponClone);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      weaponClone.scale.setScalar(1 / maxDim);
    }

    return weaponClone;
  }, [model, texture]);

  return (
    <group
      position={transform.position}
      rotation={transform.rotation}
      scale={[transform.scale, transform.scale, transform.scale]}
    >
      <primitive object={preparedWeapon} />
    </group>
  );
};

export const EquippedWeaponAttachment = ({
  characterModel,
  weaponId,
  weaponTransformOverride,
  showAnchorHelper = false,
  showTransformControls = false,
  transformControlMode = 'translate',
  onWeaponTransformChange,
}: {
  characterModel: THREE.Object3D;
  weaponId?: string;
  weaponTransformOverride?: DeveloperWeaponTransformOverride;
  showAnchorHelper?: boolean;
  showTransformControls?: boolean;
  transformControlMode?: DeveloperWeaponTransformControlMode;
  onWeaponTransformChange?: (transform: DeveloperWeaponTransformOverride) => void;
}) => {
  const definition = weaponId ? getRegisteredWeapon3DByItemId(weaponId) : null;
  const attachmentGroupRef = useRef<THREE.Group>(null);

  const transform = weaponTransformOverride ?? definition?.handTransform ?? {
    position: [0, 0, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    scale: 1,
  };

  const attachmentBone = useMemo(() => findAttachmentBone(characterModel, RIGHT_HAND_BONE_CANDIDATES), [characterModel]);

  const handleTransformObjectChange = useCallback(() => {
    if (!attachmentGroupRef.current || !onWeaponTransformChange) {
      return;
    }

    onWeaponTransformChange({
      position: [attachmentGroupRef.current.position.x, attachmentGroupRef.current.position.y, attachmentGroupRef.current.position.z],
      rotation: [attachmentGroupRef.current.rotation.x, attachmentGroupRef.current.rotation.y, attachmentGroupRef.current.rotation.z],
      scale: attachmentGroupRef.current.scale.x,
    });
  }, [onWeaponTransformChange]);

  // Keep the weapon in the R3F tree and copy only the bone world pose each frame.
  // This avoids inheriting the skeleton's scale and keeps calibration predictable.
  const boneWorldPosRef = useRef(new THREE.Vector3());
  const boneWorldQuatRef = useRef(new THREE.Quaternion());
  const offsetRef = useRef(new THREE.Vector3());
  const parentInverseRef = useRef(new THREE.Matrix4());
  const parentQuatRef = useRef(new THREE.Quaternion());
  const handRotQuatRef = useRef(new THREE.Quaternion());
  const eulerRef = useRef(new THREE.Euler());

  useFrame(() => {
    if (!attachmentGroupRef.current || !attachmentBone) {
      return;
    }

    const parent = attachmentGroupRef.current.parent;
    if (!parent) {
      return;
    }

    attachmentBone.updateWorldMatrix(true, false);
    parent.updateWorldMatrix(true, false);

    attachmentBone.getWorldPosition(boneWorldPosRef.current);
    attachmentBone.getWorldQuaternion(boneWorldQuatRef.current);

    offsetRef.current.set(transform.position[0], transform.position[1], transform.position[2]);
    offsetRef.current.applyQuaternion(boneWorldQuatRef.current);
    boneWorldPosRef.current.add(offsetRef.current);

    parentInverseRef.current.copy(parent.matrixWorld).invert();
    boneWorldPosRef.current.applyMatrix4(parentInverseRef.current);
    attachmentGroupRef.current.position.copy(boneWorldPosRef.current);

    eulerRef.current.set(transform.rotation[0], transform.rotation[1], transform.rotation[2]);
    handRotQuatRef.current.setFromEuler(eulerRef.current);
    const combinedQuat = boneWorldQuatRef.current.multiply(handRotQuatRef.current);

    parent.getWorldQuaternion(parentQuatRef.current);
    parentQuatRef.current.invert();
    parentQuatRef.current.multiply(combinedQuat);
    attachmentGroupRef.current.quaternion.copy(parentQuatRef.current);

    attachmentGroupRef.current.scale.setScalar(transform.scale);
  });

  if (!definition || !attachmentBone) {
    return null;
  }

  const content = (
    <group
      ref={attachmentGroupRef}
      position={transform.position}
      rotation={transform.rotation}
      scale={[transform.scale, transform.scale, transform.scale]}
    >
      {showAnchorHelper ? (
        <mesh>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={1.2} />
        </mesh>
      ) : null}
      <WeaponAttachmentPreview
        definition={definition}
        transform={{ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }}
      />
    </group>
  );

  if (!showTransformControls) {
    return content;
  }

  return (
    <TransformControls
      mode={transformControlMode}
      object={attachmentGroupRef.current ?? undefined}
      onObjectChange={handleTransformObjectChange}
    >
      {content}
    </TransformControls>
  );
};
