import type { ReactNode } from 'react';

type Status = 'disponible' | 'confirmee' | 'honoree' | 'en-attente' | 'en-maintenance' | 'hors-service' | 'epuisee' | 'echouee' | 'annulee';

interface BadgeProps {
  status: Status | string;
  children?: ReactNode;
}

const statusClasses: Record<Status, { bg: string; text: string }> = {
  disponible: { bg: 'bg-sage bg-opacity-15', text: 'text-sage' },
  confirmee: { bg: 'bg-sage bg-opacity-15', text: 'text-sage' },
  honoree: { bg: 'bg-sage bg-opacity-15', text: 'text-sage' },
  'en-attente': { bg: 'bg-amber bg-opacity-15', text: 'text-amber' },
  'en-maintenance': { bg: 'bg-amber bg-opacity-15', text: 'text-amber' },
  'hors-service': { bg: 'bg-terracotta bg-opacity-15', text: 'text-terracotta' },
  epuisee: { bg: 'bg-terracotta bg-opacity-15', text: 'text-terracotta' },
  echouee: { bg: 'bg-terracotta bg-opacity-15', text: 'text-terracotta' },
  annulee: { bg: 'bg-terracotta bg-opacity-15', text: 'text-terracotta' },
};

const statusLabels: Record<Status, string> = {
  disponible: 'Disponible',
  confirmee: 'Confirmée',
  honoree: 'Honorée',
  'en-attente': 'En attente',
  'en-maintenance': 'En maintenance',
  'hors-service': 'Hors service',
  epuisee: 'Épuisé',
  echouee: 'Échouée',
  annulee: 'Annulée',
};

export default function Badge({ status, children }: BadgeProps) {
  const normalizedStatus = (status.toLowerCase().replace('_', '-') as Status);
  const classes = statusClasses[normalizedStatus] || statusClasses['en-attente'];
  const label = children || statusLabels[normalizedStatus] || status;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${classes.bg} ${classes.text}`}>
      {label}
    </span>
  );
}
