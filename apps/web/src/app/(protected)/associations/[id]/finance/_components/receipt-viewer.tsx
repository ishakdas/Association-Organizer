'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink, X } from 'lucide-react';

interface Props {
  receiptUrl: string | null;
  description?: string | null;
}

export function ReceiptViewer({ receiptUrl, description }: Props) {
  const [open, setOpen] = useState(false);

  if (!receiptUrl) return null;

  const isImage = receiptUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isPdf = receiptUrl.match(/\.(pdf)$/i);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => setOpen(true)}
        title="Fiş/Fatura Görüntüle"
      >
        <FileText className="h-3.5 w-3.5 text-primary" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Fiş / Fatura
            </DialogTitle>
            {description && (
              <DialogDescription className="text-xs">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="mt-2 space-y-3">
            {isImage && (
              <div className="overflow-hidden rounded-lg border">
                <img
                  src={receiptUrl}
                  alt="Fiş/Fatura"
                  className="w-full h-auto max-h-[60vh] object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {isPdf && (
              <div className="rounded-lg border p-4 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  Bu dosya PDF formatındadır.
                </p>
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  PDF'i Yeni Sekmede Aç
                </a>
              </div>
            )}

            {!isImage && !isPdf && (
              <div className="rounded-lg border p-4 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  Bu dosyayı görüntülemek için aşağıdaki bağlantıya tıklayın.
                </p>
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Dosyayı Aç
                </a>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                <X className="mr-1 h-3.5 w-3.5" />
                Kapat
              </Button>
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Yeni Sekmede Aç
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
