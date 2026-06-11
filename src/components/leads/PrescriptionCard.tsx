import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Camera, ScanLine, Loader2, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  uploadPrescription,
  getPrescriptionSignedUrl,
  runPrescriptionOcr,
} from '@/lib/prescription.functions';
import { DBLead } from '@/hooks/use-leads';

/** Compacta imagem para no máx 1600px no maior lado e devolve data URL JPEG. */
async function fileToCompressedDataUrl(file: File, maxSide = 1600, quality = 0.85): Promise<string> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

export function PrescriptionCard({ lead }: { lead: DBLead }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const upload = useServerFn(uploadPrescription);
  const getUrl = useServerFn(getPrescriptionSignedUrl);
  const ocr = useServerFn(runPrescriptionOcr);

  const signedQ = useQuery({
    queryKey: ['prescription-url', lead.id, lead.prescription_image_path],
    enabled: !!lead.prescription_image_path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => (await getUrl({ data: { leadId: lead.id } })).signedUrl,
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const dataUrl = await fileToCompressedDataUrl(file);
      setLocalPreview(dataUrl);
      return upload({ data: { leadId: lead.id, dataUrl } });
    },
    onSuccess: () => {
      toast.success('Foto da receita salva');
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['prescription-url', lead.id] });
    },
    onError: (e) => {
      setLocalPreview(null);
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar foto');
    },
  });

  const ocrMut = useMutation({
    mutationFn: async () => ocr({ data: { leadId: lead.id } }),
    onSuccess: (r) => {
      const bits = [r.grau ? `Grau: ${r.grau}` : null, r.validade ? `Validade: ${r.validade}` : null].filter(Boolean);
      toast.success(`Receita extraída — ${bits.join(' • ') || 'dados atualizados'}`);
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Falha no OCR'),
  });

  useEffect(() => {
    if (lead.prescription_image_path) setLocalPreview(null);
  }, [lead.prescription_image_path]);

  const previewSrc = localPreview ?? signedQ.data ?? null;
  const hasImage = !!lead.prescription_image_path || !!localPreview;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Camera className="w-3.5 h-3.5 text-primary" />
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Receita</h4>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3">
        {previewSrc ? (
          <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
            <img src={previewSrc} alt="Receita do lead" className="w-full h-full object-contain" />
            {uploadMut.isPending && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}
          </div>
        ) : (
          <div className="w-full aspect-[4/3] rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-1">
            <Camera className="w-6 h-6" />
            <span className="text-[11px] font-bold">Nenhuma foto da receita ainda</span>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) uploadMut.mutate(f);
          }}
        />

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 text-xs font-bold rounded-lg"
            onClick={() => fileRef.current?.click()}
            disabled={uploadMut.isPending}
          >
            {uploadMut.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : hasImage ? (
              <RotateCw className="w-3.5 h-3.5 mr-1.5" />
            ) : (
              <Camera className="w-3.5 h-3.5 mr-1.5" />
            )}
            {hasImage ? 'Trocar foto' : 'Tirar foto'}
          </Button>
          <Button
            type="button"
            className="h-10 text-xs font-bold rounded-lg bg-primary hover:bg-primary/90"
            onClick={() => ocrMut.mutate()}
            disabled={!hasImage || ocrMut.isPending || uploadMut.isPending}
          >
            {ocrMut.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <ScanLine className="w-3.5 h-3.5 mr-1.5" />
            )}
            {ocrMut.isPending ? 'Lendo…' : 'Extrair dados (OCR)'}
          </Button>
        </div>

        {lead.prescription_ocr_at && (
          <p className="text-[10px] text-gray-400 font-medium text-center">
            OCR executado em {new Date(lead.prescription_ocr_at).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
    </div>
  );
}
