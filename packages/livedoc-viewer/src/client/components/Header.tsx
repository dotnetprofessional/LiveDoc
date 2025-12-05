import { ConnectionStatus } from '../store';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
}

export function Header({ connectionStatus }: HeaderProps) {
  // Header is minimal now since sidebar has the branding
  return null;
}
