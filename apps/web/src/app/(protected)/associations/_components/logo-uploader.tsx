'use client';

import { ImageIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  value: string | undefined;
  onChange: (value: string) => void;
  id?: string;
}

export function LogoUploader({ value, onChange, id }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30">
        {value ? (
          <img
            src={value}
            alt="Logo önizleme"
            className="h-full w-full object-contain"
          />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
        )}
      </div>
      <div className="flex-1 space-y-2">
        <Input
          id={id}
          type="url"
          placeholder="https://cdn.example.com/logo.png"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] text-muted-foreground">
            PNG veya SVG önerilir. Maks. 256×256 px.
          </p>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onChange('')}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              Kaldır
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
