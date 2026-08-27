import type { ReactNode } from 'react';

type Status = 'disponible' | 'confirmee' | 'honoree' | 'en-attente' | 'en-maintenance' | 'hors-service' | 'epuisee' | 'echouee' | 'annulee';

interface BadgeProps {
  status: Status | string;
  children?: ReactNode;
}

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

function getStatusClasses(status: Status): { bg: string; text: string } {
  switch (status) {
    case 'disponible':
    case 'confirmee':
    case 'honoree':
      return { bg: 'bg-sage/15', text: 'text-sage' };
    case 'en-attente':
    case 'en-maintenance':
      return { bg: 'bg-amber/15', text: 'text-amber' };
    case 'hors-service':
    case 'epuisee':
    case 'echouee':
    case 'annulee':
      return { bg: 'bg-terracotta/15', text: 'text-terracotta' };
    default:
      return { bg: 'bg-amber/15', text: 'text-amber' };
  }
}

export default function Badge({ status, children }: BadgeProps) {
  const normalizedStatus = (status.toLowerCase().replace('_', '-') as Status);
  const { bg, text } = getStatusClasses(normalizedStatus);
  const label = children || statusLabels[normalizedStatus] || status;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${bg} ${text}`}>
      {label}
    </span>
  );
}
