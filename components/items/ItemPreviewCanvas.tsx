import React from 'react';
import { ALL_ITEMS } from '../../constants';
import { ItemPreviewThree } from './ItemPreviewThree';

export const ItemPreviewCanvas = ({ itemType, itemId }: { itemType: string, itemId: string }) => {
  const item = ALL_ITEMS.find(entry => entry.id === itemId && entry.type === itemType);

  if (!item) {
    return (
      <div className="w-full h-full min-h-40 flex items-center justify-center border-2 border-dashed border-slate-600 rounded-lg bg-slate-900/50 text-slate-300 text-sm">
        Sem preview 3D
      </div>
    );
  }

  return <ItemPreviewThree item={item} />;
};
