import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { useWebSocket } from './hooks/useWebSocket';
import { useVsCodeMessage } from './hooks/useVsCodeMessage';
import { isEmbedded } from './config';

export default function App() {
  // Connect to WebSocket for real-time updates
  useWebSocket();
  // Listen for VS Code messages
  useVsCodeMessage();

  const embedded = isEmbedded();

  return (
    <div className="flex h-screen bg-bg">
      {!embedded && <Sidebar />}
      <MainContent />
    </div>
  );
}
