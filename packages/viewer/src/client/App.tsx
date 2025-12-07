import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { useWebSocket } from './hooks/useWebSocket';

export default function App() {
  // Connect to WebSocket for real-time updates
  useWebSocket();

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <MainContent />
    </div>
  );
}
