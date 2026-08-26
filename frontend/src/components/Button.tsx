import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'disabled';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-terracotta hover:bg-burgundy text-white font-medium shadow-sm transition-colors',
  secondary: 'border-2 border-terracotta text-terracotta hover:bg-warm-gray-100 font-medium transition-colors',
  disabled: 'bg-warm-gray-300 text-warm-gray-500 cursor-not-allowed',
};

export default function Button({
  variant = 'primary',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const effectiveVariant = disabled ? 'disabled' : variant;

  return (
    <button
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${variantClasses[effectiveVariant]} ${className}`}
      disabled={disabled || effectiveVariant === 'disabled'}
      {...props}
    >
      {children}
    </button>
  );
}
