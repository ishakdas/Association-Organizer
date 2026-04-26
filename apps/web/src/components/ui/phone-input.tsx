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
  // The form holds the digits-only normalized value (e.g. "05551112233").
  // Display formatting ("0 555 111 22 33") is handled here.
  value?: string;
  onChange?: (digits: string) => void;
};

function PhoneInput({
  value,
  onChange,
  inputMode,
  placeholder,
  ...rest
}: PhoneInputProps) {
  const digits = normalizeTrPhoneInput(value ?? '');
  const display = formatTrPhoneDisplay(digits);

  return (
    <Input
      {...rest}
      type="tel"
      inputMode={inputMode ?? 'numeric'}
      autoComplete="tel-national"
      placeholder={placeholder ?? '0 555 111 22 33'}
      value={display}
      onChange={(e) => {
        const next = normalizeTrPhoneInput(e.target.value);
        onChange?.(next);
      }}
    />
  );
}

export { PhoneInput };
