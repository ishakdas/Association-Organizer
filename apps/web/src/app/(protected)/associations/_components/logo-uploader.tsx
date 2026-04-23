'use client';

import { Image as ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Props {
  value: string | undefined;
  onChange: (value: string) => void;
  id?: string;
}

// Sprint-1: URL input + preview only. Storage upload is a follow-up sprint.
export function LogoUploader({ value, onChange, id }: Props) {
  return (
    <div className="space-y-2">
      <Input
        id={id}
        type="url"
        placeholder="https://cdn.example.com/logo.png"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/30">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Logo önizleme" className="h-full w-full object-contain" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
