using LiveDoc.Models;

namespace SweDevTools.LiveDoc.xUnit.src;
// =============================================================================
// Navigation / Hierarchy
// =============================================================================

public class HistoryRun
{
    public string RunId { get; set; }
    public string Timestamp { get; set; }
    public string Status { get; set; }
    public Statistics Summary { get; set; }
}

public class EnvironmentNode
{
    public string Name { get; set; }
    public TestRun LatestRun { get; set; }
    public int HistoryCount { get; set; }
    public List<HistoryRun> History { get; set; } = new List<HistoryRun>();
}

public class ProjectNode
{
    public string Name { get; set; }
    public List<EnvironmentNode> Environments { get; set; } = new List<EnvironmentNode>();
}

public class ProjectHierarchyResponse
{
    public List<ProjectNode> Projects { get; set; } = new List<ProjectNode>();
}

// =============================================================================
// Realtime Events (WebSocket)
// =============================================================================

public class WebSocketClientMessage
{
    public string Type { get; set; } // 'subscribe' | 'unsubscribe' | 'ping'
    public string RunId { get; set; }
    public string Project { get; set; }
    public string Environment { get; set; }
}

public class WebSocketEvent
{
    public string Type { get; set; }
    public string RunId { get; set; }

    // Fields for 'run:started'
    public string Project { get; set; }
    public string Environment { get; set; }
    public string Framework { get; set; }
    public string Timestamp { get; set; }

    // Fields for 'node:added'
    public string ParentId { get; set; }
    public TestCase Node { get; set; }

    // Fields for 'node:updated' / 'run:updated' / 'run:completed'
    public string NodeId { get; set; }
    public object Patch { get; set; } // Can be Partial<Node> or Partial<TestRun>
    public Status? Status { get; set; }
    public Statistics Summary { get; set; }
    public long? Duration { get; set; }
    public string Message { get; set; } // For 'error'
}
