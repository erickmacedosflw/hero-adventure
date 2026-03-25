import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Item } from '../../types';
import { ItemPreviewCanvas } from './ItemPreviewCanvas';

type AnchorRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function ItemPreviewPortal({ item, anchorRef }: { item: Item | null; anchorRef: React.RefObject<HTMLDivElement | null> }) {
  const [rect, setRect] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (!item || typeof window === 'undefined' || typeof document === 'undefined') {
      setRect(null);
      return;
    }

    const anchor = anchorRef.current;

    if (!anchor) {
      setRect(null);
      return;
    }

    const updateRect = () => {
      const nextRect = anchor.getBoundingClientRect();
      setRect({
        top: nextRect.top,
        left: nextRect.left,
        width: nextRect.width,
        height: nextRect.height,
      });
    };

    updateRect();

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          updateRect();
        })
      : null;

    resizeObserver?.observe(anchor);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      resizeObserver?.disconnect();
    };
  }, [anchorRef, item]);

  if (!item || typeof window === 'undefined' || typeof document === 'undefined' || !anchorRef.current || !rect) {
    return null;
  }

  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return createPortal(
    <div
      className="fixed pointer-events-none"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        zIndex: 85,
      }}
    >
      <div className="absolute inset-0 pointer-events-auto rounded-3xl overflow-hidden shadow-[0_20px_60px_rgba(2,6,23,0.65)] ring-1 ring-white/10">
        <ItemPreviewCanvas key={`${item.type}-${item.id}`} itemType={item.type} itemId={item.id} />
      </div>
    </div>,
    document.body,
  );
}