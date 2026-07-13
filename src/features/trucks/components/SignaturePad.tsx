import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export type SignaturePadHandle = {
  isEmpty: () => boolean;
  clear: () => void;
  toBlob: () => Promise<Blob | null>;
};

export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(
  ({ className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const emptyRef = useRef(true);
    const [isEmptyState, setIsEmptyState] = useState(true);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111827';
    }, []);

    const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      if (emptyRef.current) {
        emptyRef.current = false;
        setIsEmptyState(false);
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      drawingRef.current = false;
      canvasRef.current?.releasePointerCapture(e.pointerId);
    };

    useImperativeHandle(ref, () => ({
      isEmpty: () => emptyRef.current,
      clear: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
        emptyRef.current = true;
        setIsEmptyState(true);
      },
      toBlob: () =>
        new Promise((resolve) => {
          const canvas = canvasRef.current;
          if (!canvas || emptyRef.current) {
            resolve(null);
            return;
          }
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        }),
    }));

    return (
      <div className={className}>
        <canvas
          ref={canvasRef}
          className="h-40 w-full touch-none rounded-lg border border-white/10 bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {isEmptyState && (
          <p className="mt-1 text-[11px] text-slate-400">Firme dentro del recuadro (mouse o dedo).</p>
        )}
      </div>
    );
  },
);

SignaturePad.displayName = 'SignaturePad';
