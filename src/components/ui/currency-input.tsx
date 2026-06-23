import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  autoFocus?: boolean;
  className?: string;
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CurrencyInput({ value, onChange, autoFocus, className }: CurrencyInputProps) {
  const [digits, setDigits] = useState(() => String(Math.round(value * 100)));

  useEffect(() => {
    const external = Math.round(value * 100);
    const internal = parseInt(digits || '0', 10);
    if (external !== internal) {
      setDigits(String(external));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const limited = raw.slice(0, 10);
    setDigits(limited);
    onChange(parseInt(limited || '0', 10) / 100);
  };

  const cents = parseInt(digits || '0', 10);
  const display = centsToDisplay(cents);

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#9CA3AF] pointer-events-none select-none">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        autoFocus={autoFocus}
        className={cn(
          'flex h-9 w-full rounded-[6px] border border-[#E5E7EB] bg-white py-1 text-sm text-[#1A1A1A] shadow-none transition-all',
          'placeholder:text-[#9CA3AF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC400]/40 focus-visible:border-[#FFC400]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'pl-9 pr-3 text-right',
          className
        )}
      />
    </div>
  );
}
