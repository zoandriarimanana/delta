import type { ReactNode } from 'react';

interface CardProps {
  image?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function Card({
  image,
  title,
  description,
  children,
  footer,
  onClick,
  className = '',
}: CardProps) {
  const isClickable = !!onClick;

  return (
    <div
      className={`
        bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow
        overflow-hidden ${isClickable ? 'cursor-pointer hover:shadow-xl' : ''}
        ${className}
      `}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {image && (
        <div className="w-full h-48 overflow-hidden bg-warm-gray-200">
          <img src={image} alt={title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-warm-gray-700 mb-2">{title}</h3>
        {description && <p className="text-sm text-warm-gray-500 mb-3">{description}</p>}
        {children}
      </div>
      {footer && <div className="px-4 pb-4">{footer}</div>}
    </div>
  );
}
