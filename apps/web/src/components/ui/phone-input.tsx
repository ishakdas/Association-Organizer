'use client';

import * as React from 'react';
import {
  formatTrPhoneDisplay,
  normalizeTrPhoneInput,
} from '@ticketbot/shared-validation';

import { Input } from './input';

type PhoneInputProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type'
> & {
  // The form holds the digits-only subscriber number (e.g. "5551112233" — no
  // leading 0, no country code). Display formatting ("555 111 22 33") and the
  // visible "+90" prefix are handled here.
  value?: string;
  onChange?: (digits: string) => void;
};

function PhoneInput({
  value,
  onChange,
  inputMode,
  placeholder,
  className,
  ...rest
}: PhoneInputProps) {
  const digits = normalizeTrPhoneInput(value ?? '');
  const display = formatTrPhoneDisplay(digits);

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[13px] font-medium text-muted-foreground"
      >
        +90
      </span>
      <Input
        {...rest}
        type="tel"
        inputMode={inputMode ?? 'numeric'}
        autoComplete="tel-national"
        placeholder={placeholder ?? '555 111 22 33'}
        value={display}
        onChange={(e) => {
          const next = normalizeTrPhoneInput(e.target.value);
          onChange?.(next);
        }}
        className={`pl-12 ${className ?? ''}`.trim()}
      />
    </div>
  );
}

export { PhoneInput };
