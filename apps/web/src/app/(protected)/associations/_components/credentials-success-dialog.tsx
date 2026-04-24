'use client';

import { useState } from 'react';
import { Check, Copy, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/password';

/**
 * Shown after a Supabase-backed account is provisioned (manager on
 * association create, secretary on member add). Cannot be dismissed
 * until the operator confirms — the temp password is only displayed
 * once and the operator must hand it off securely.
 */
export function CredentialsSuccessDialog({
  open,
  title,
  description,
  email,
  password,
  acknowledgeLabel = 'Anladım, kapat',
  onAcknowledge,
}: {
  open: boolean;
  title: string;
  description: string;
  email: string;
  password: string;
  acknowledgeLabel?: string;
  onAcknowledge: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyToClipboard(password);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        className="sm:max-w-[460px]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-md border border-border bg-muted/40 p-4">
          <Field label="E-posta" value={email} mono={false} />
          <Field
            label="Geçici şifre"
            value={password}
            mono
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-success" />
                    Kopyalandı
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Kopyala
                  </>
                )}
              </Button>
            }
          />
        </div>

        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Bu şifre yalnızca şimdi gösterilecek. Pencereyi kapatınca tekrar
          gösteremeyiz; lütfen güvenli bir kanaldan ilgili kişiye iletin.
        </p>

        <DialogFooter>
          <Button type="button" onClick={onAcknowledge}>
            {acknowledgeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  mono,
  action,
}: {
  label: string;
  value: string;
  mono?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span
          className={`break-all text-[14px] text-foreground ${
            mono ? 'font-mono tracking-tight' : ''
          }`}
        >
          {value}
        </span>
        {action}
      </div>
    </div>
  );
}
