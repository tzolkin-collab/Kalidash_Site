import type { PartyRef } from './PartySheets';
import { NewCompanyPanel, NewPersonPanel } from './NewPartyPanels';

type Props = {
  creating: 'person' | 'company' | null;
  onClose: () => void;
  onCreated: (ref: NonNullable<PartyRef>, message: string) => void;
  asLegacy?: boolean;
};

/** Escolhe qual painel de cadastro mostrar. */
export default function NewPartyHost({ creating, onClose, onCreated, asLegacy }: Props) {
  if (creating === 'person') return <NewPersonPanel onClose={onClose} onCreated={onCreated} asLegacy={asLegacy} />;
  if (creating === 'company') return <NewCompanyPanel onClose={onClose} onCreated={onCreated} asLegacy={asLegacy} />;
  return null;
}
