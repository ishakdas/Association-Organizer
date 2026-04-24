'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  copyToClipboard,
  evaluatePasswordStrength,
  generatePassword,
} from '@/lib/password';

const TONE_BAR: Record<'destructive' | 'warning' | 'success', string> = {
  destructive: 'bg-destructive',
  warning: 'bg-warning',
  success: 'bg-success',
};

const TONE_TEXT: Record<'destructive' | 'warning' | 'success', string> = {
  destructive: 'text-destructive',
  warning: 'text-warning',
  success: 'text-success',
};

export function PasswordField({
  value,
  onChange,
  onBlur,
  name,
  placeholder = 'En az 8 karakter',
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const strength = useMemo(() => evaluatePasswordStrength(value), [value]);
  const filled = Math.max(1, strength.score);

  async function handleGenerate() {
    const next = generatePassword(16);
    onChange(next);
    setReveal(true);
    const ok = await copyToClipboard(next);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleCopy() {
    if (!value) return;
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type={reveal ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete="new-password"
          disabled={disabled}
          className="pr-20 font-mono"
        />
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            disabled={disabled}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            aria-label={reveal ? 'Şifreyi gizle' : 'Şifreyi göster'}
          >
            {reveal ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={disabled || !value}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            aria-label="Şifreyi kopyala"
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-1">
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i <= filled && value
                  ? TONE_BAR[strength.tone]
                  : 'bg-muted',
              )}
            />
          ))}
        </div>
        <span
          className={cn(
            'text-[11px] font-semibold uppercase tracking-widest',
            value ? TONE_TEXT[strength.tone] : 'text-muted-foreground',
          )}
        >
          {value ? strength.label : '—'}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={disabled}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Otomatik şifre oluştur
        </Button>
        <p className="text-[11.5px] text-muted-foreground">
          Bu şifre sadece şimdi gösterilecek; başkana güvenli şekilde iletin.
        </p>
      </div>
    </div>
  );
}
