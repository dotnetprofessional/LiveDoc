import { Layout } from './components/Layout';
import { MainContent } from './components/MainContent';
import { useWebSocket } from './hooks/useWebSocket';
import { useVsCodeMessage } from './hooks/useVsCodeMessage';

export default function App() {
  // Connect to WebSocket for real-time updates
  useWebSocket();
  // Listen for VS Code messages
  useVsCodeMessage();

  return (
    <Layout>
      <MainContent />
    </Layout>
  );
}
