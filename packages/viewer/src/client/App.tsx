import { Layout } from './components/Layout';
import { MainContent } from './components/MainContent';
import { useWebSocket } from './hooks/useWebSocket';
import { useVsCodeMessage } from './hooks/useVsCodeMessage';
import { useStaticData } from './hooks/useStaticData';
import { useDeepLink } from './hooks/useDeepLink';

export default function App() {
  // Hydrate store from embedded data when in static mode
  const isStatic = useStaticData();
  // Connect to WebSocket for real-time updates (skipped in static mode)
  useWebSocket(isStatic);
  // Listen for VS Code messages
  useVsCodeMessage();
  // Sync URL hash with navigation state (deep linking)
  useDeepLink();

  return (
    <Layout>
      <MainContent />
    </Layout>
  );
}
