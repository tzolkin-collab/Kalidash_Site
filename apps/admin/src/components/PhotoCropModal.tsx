import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Move, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { resolveAssetUrl } from '../lib/site';
import { uploadImage } from '../lib/blog';

export type AspectRatio = '16:9' | '21:9' | '4:3' | '1:1' | 'free';

interface PhotoCropModalProps {
  isOpen: boolean;
  imageUrl: string;
  initialPos?: number; // 0 a 100 vertical
  aspectRatio?: AspectRatio;
  title?: string;
  onClose: () => void;
  onApply: (croppedUrl: string, metadata: { pos: number; zoom: number; width?: string }) => void;
}

export function PhotoCropModal({
  isOpen,
  imageUrl,
  initialPos = 50,
  aspectRatio: initialAspect = '16:9',
  title = 'Enquadramento & Corte de Foto',
  onClose,
  onApply,
}: PhotoCropModalProps): React.ReactElement | null {
  const [aspect, setAspect] = useState<AspectRatio>(initialAspect);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: (initialPos - 50) * -2 }); // offset em pixels relativos
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (isOpen) {
      setAspect(initialAspect);
      setZoom(1);
      setPan({ x: 0, y: (initialPos - 50) * -2 });
      setError(null);
    }
  }, [isOpen, initialAspect, initialPos]);

  if (!isOpen || !imageUrl) return null;

  const resolvedUrl = resolveAssetUrl(imageUrl);

  // Calcula aspect ratio numérico
  const getAspectPadding = (ratio: AspectRatio): string => {
    switch (ratio) {
      case '16:9': return '56.25%'; // 9 / 16
      case '21:9': return '42.85%'; // 9 / 21
      case '4:3': return '75%';    // 3 / 4
      case '1:1': return '100%';   // 1 / 1
      case 'free': return '56.25%';
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Renderiza no Canvas o recorte real na resolução original e faz upload
  const handleApplyCrop = async () => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) {
      onClose();
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // 1. Carrega imagem em alta resolução com crossOrigin
      const naturalImg = new Image();
      naturalImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        naturalImg.onload = () => resolve();
        naturalImg.onerror = () => reject(new Error('Não foi possível carregar imagem para corte.'));
        naturalImg.src = resolvedUrl;
      });

      // 2. Calcula as dimensões do viewport vs imagem original
      const viewRect = container.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();

      // Proporção de escala entre o tamanho renderizado e natural
      const scaleX = naturalImg.naturalWidth / imgRect.width;
      const scaleY = naturalImg.naturalHeight / imgRect.height;

      // Coordenadas de corte em pixels da imagem natural
      const cropX = Math.max(0, (viewRect.left - imgRect.left) * scaleX);
      const cropY = Math.max(0, (viewRect.top - imgRect.top) * scaleY);
      const cropWidth = Math.min(naturalImg.naturalWidth - cropX, viewRect.width * scaleX);
      const cropHeight = Math.min(naturalImg.naturalHeight - cropY, viewRect.height * scaleY);

      // 3. Desenha no Canvas
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(cropWidth);
      canvas.height = Math.round(cropHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível obter contexto 2D do Canvas.');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        naturalImg,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, canvas.width, canvas.height,
      );

      // 4. Converte em Blob WebP ou JPEG
      const blob = await new Promise<Blob | null>((res) => {
        canvas.toBlob((b) => res(b), 'image/webp', 0.92);
      });

      if (!blob) throw new Error('Falha ao gerar arquivo recortado.');

      const file = new File([blob], `cropped-${Date.now()}.webp`, { type: 'image/webp' });
      const uploadedUrl = await uploadImage(file);

      // Calcula percentual vertical aproximado para compatibilidade
      const calculatedPos = Math.min(100, Math.max(0, Math.round(50 - (pan.y / (imgRect.height || 1)) * 50)));

      onApply(uploadedUrl, { pos: calculatedPos, zoom });
      onClose();
    } catch (err) {
      console.warn('Falha no upload do crop via canvas, aplicando enquadramento por CSS:', err);
      // Fallback: caso a imagem tenha restrição CORS de domínio externo, salva o enquadramento posicional
      const calculatedPos = Math.min(100, Math.max(0, Math.round(50 - (pan.y / 2))));
      onApply(imageUrl, { pos: calculatedPos, zoom });
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  const modalContent = (
    <div className="popup-overlay" style={{ zIndex: 100000 }}>
      <div
        className="popup-card"
        style={{
          width: 'min(780px, 94vw)',
          maxWidth: '780px',
          background: '#16141d',
          color: '#f0edf5',
          border: '1px solid #362f44',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2d263a' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>{title}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9d94aa' }}>
              Arraste a foto para enquadrar, amplie com o zoom e escolha a proporção do corte.
            </p>
          </div>
          <button
            type="button"
            className="popup-close"
            onClick={onClose}
            disabled={processing}
            style={{ color: '#b2a8c2' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Barra de Proporções (Aspect Ratio) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#1c1926', borderBottom: '1px solid #2d263a', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#a89fb9' }}>Proporção:</span>
          {(['16:9', '21:9', '4:3', '1:1', 'free'] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={`btn btn-xs ${aspect === r ? 'btn-solid' : ''}`}
              style={{
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '11px',
                background: aspect === r ? 'var(--accent)' : '#262133',
                color: aspect === r ? '#fff' : '#c8c0d6',
                border: '1px solid',
                borderColor: aspect === r ? 'var(--accent)' : '#3d344d',
              }}
              onClick={() => setAspect(r)}
            >
              {{ '16:9': '16:9 (Capa)', '21:9': '21:9 (Cinema)', '4:3': '4:3 (Editorial)', '1:1': '1:1 (Quadrado)', 'free': 'Livre' }[r]}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-xs"
            onClick={handleReset}
            title="Resetar posição e zoom"
            style={{ marginLeft: 'auto', background: '#262133', border: '1px solid #3d344d', color: '#c8c0d6', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <RotateCcw size={11} /> Resetar
          </button>
        </div>

        {/* Viewport Interativo de Corte */}
        <div
          style={{
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0d0a12',
            minHeight: '340px',
            overflow: 'hidden',
          }}
        >
          <div
            ref={containerRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: aspect === '1:1' ? '320px' : aspect === '4:3' ? '420px' : '580px',
              paddingTop: getAspectPadding(aspect),
              overflow: 'hidden',
              borderRadius: '12px',
              border: '2px solid rgba(255, 255, 255, 0.45)',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            {/* Imagem com transform de zoom e arraste */}
            <img
              ref={imgRef}
              src={resolvedUrl}
              alt="Prévia de corte"
              draggable={false}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
                transformOrigin: 'center center',
                maxWidth: 'none',
                minWidth: '100%',
                minHeight: '100%',
                display: 'block',
                pointerEvents: 'none',
                transition: isDragging ? 'none' : 'transform 0.08s ease-out',
              }}
            />

            {/* Linhas-guia (Regra dos terços) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gridTemplateRows: '1fr 1fr 1fr',
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
            >
              <div style={{ borderRight: '1px dashed rgba(255, 255, 255, 0.25)', borderBottom: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderRight: '1px dashed rgba(255, 255, 255, 0.25)', borderBottom: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderRight: '1px dashed rgba(255, 255, 255, 0.25)', borderBottom: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderRight: '1px dashed rgba(255, 255, 255, 0.25)', borderBottom: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderBottom: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderRight: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div style={{ borderRight: '1px dashed rgba(255, 255, 255, 0.25)' }} />
              <div />
            </div>

            {/* Indicador de arraste */}
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#fff',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                pointerEvents: 'none',
              }}
            >
              <Move size={10} /> Arraste para posicionar
            </div>
          </div>
        </div>

        {/* Controles de Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '14px 20px', background: '#1c1926', borderTop: '1px solid #2d263a' }}>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))}
            disabled={zoom <= 1}
            style={{ background: '#262133', border: '1px solid #3d344d', color: '#c8c0d6' }}
            title="Diminuir zoom"
          >
            <ZoomOut size={13} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
            <span style={{ fontSize: '11px', color: '#a89fb9' }}>Zoom:</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '11px', color: '#fff', minWidth: '32px', textAlign: 'right' }}>
              {zoom.toFixed(2)}x
            </span>
          </div>
          <button
            type="button"
            className="btn btn-xs"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
            disabled={zoom >= 3}
            style={{ background: '#262133', border: '1px solid #3d344d', color: '#c8c0d6' }}
            title="Aumentar zoom"
          >
            <ZoomIn size={13} />
          </button>
        </div>

        {/* Footer com Ações */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #2d263a' }}>
          {error ? (
            <span style={{ color: '#ef4444', fontSize: '12px' }}>{error}</span>
          ) : (
            <span style={{ color: '#8d859c', fontSize: '11px' }}>
              O corte gera um arquivo de alta resolução pronto para visualização.
            </span>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={processing}
              style={{ background: '#262133', border: '1px solid #3d344d', color: '#c8c0d6' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-solid"
              onClick={handleApplyCrop}
              disabled={processing}
              style={{ minWidth: '150px', justifyContent: 'center' }}
            >
              {processing ? (
                'Recortando…'
              ) : (
                <>
                  <Check size={14} /> Aplicar Corte
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body) as unknown as React.ReactElement;
}
