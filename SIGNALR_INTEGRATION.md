# SignalR Integration for AlertHawk

This document describes the SignalR integration implemented in the AlertHawk frontend to receive real-time notifications.

## Overview

The SignalR integration provides real-time notifications through toast messages when monitors change status, alerts are triggered, or other important events occur.

## Frontend Implementation

### Files Added/Modified

1. **`src/services/signalRService.ts`** - Core SignalR service
2. **`src/hooks/useSignalR.ts`** - React hook for SignalR functionality
3. **`src/contexts/SignalRContext.tsx`** - React context for SignalR state management
4. **`src/components/SignalRStatus.tsx`** - Component to display connection status
5. **`src/types.ts`** - Added SignalR notification types
6. **`src/App.tsx`** - Integrated SignalR provider
7. **`src/components/TopBar.tsx`** - Added SignalR status display
8. **`src/pages/Dashboard.tsx`** - Added environment group management
9. **`src/components/MetricDetails.tsx`** - Added monitor group management

### Features

- **Automatic Connection**: Connects to SignalR when user is authenticated
- **Toast Notifications**: Displays real-time notifications as toast messages
- **Group Management**: Automatically joins/leaves groups based on:
  - Environment (Production, Staging, etc.)
  - Individual monitors
  - Regions
  - Custom groups
- **Connection Status**: Visual indicator of SignalR connection state
- **Auto-reconnection**: Handles connection drops with exponential backoff
- **Authentication**: Uses JWT token for secure connection

## Backend Integration

### Hub Methods Available

The frontend expects these methods to be available in your SignalR hub:

```csharp
public class NotificationHub : Hub
{
    // Group management
    public async Task JoinGroup(string groupName)
    public async Task LeaveGroup(string groupName)
    public async Task JoinMonitorGroup(int monitorId)
    public async Task LeaveMonitorGroup(int monitorId)
    public async Task JoinEnvironmentGroup(int environment)
    public async Task LeaveEnvironmentGroup(int environment)
    public async Task JoinRegionGroup(int region)
    public async Task LeaveRegionGroup(int region)
}
```

### Sending Notifications

To send notifications from your backend, use these client methods:

```csharp
// Send to all connected clients
await Clients.All.SendAsync("ReceiveNotification", notification);

// Send to specific monitor group
await Clients.Group($"Monitor_{monitorId}").SendAsync("ReceiveMonitorNotification", monitorId, notification);

// Send to environment group
await Clients.Group($"Environment_{environment}").SendAsync("ReceiveEnvironmentNotification", environment, notification);

// Send to region group
await Clients.Group($"Region_{region}").SendAsync("ReceiveRegionNotification", region, notification);

// Send to custom group
await Clients.Group(groupName).SendAsync("ReceiveGroupNotification", groupName, notification);
```

### Notification Object Structure

The notification object should match this structure:

```typescript
interface SignalRNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  monitorId?: number;
  environment?: number;
  region?: number;
  groupName?: string;
}
```

### Example Backend Usage

```csharp
public class MonitorService
{
    private readonly IHubContext<NotificationHub> _hubContext;

    public MonitorService(IHubContext<NotificationHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task UpdateMonitorStatus(int monitorId, bool isOnline)
    {
        // Update monitor status in database
        // ...

        // Send notification to monitor group
        var notification = new
        {
            id = Guid.NewGuid().ToString(),
            title = "Monitor Status Changed",
            message = $"Monitor {monitorId} is now {(isOnline ? "online" : "offline")}",
            type = isOnline ? "success" : "error",
            timestamp = DateTime.UtcNow.ToString("o"),
            monitorId = monitorId
        };

        await _hubContext.Clients.Group($"Monitor_{monitorId}")
            .SendAsync("ReceiveMonitorNotification", monitorId, notification);
    }

    public async Task SendEnvironmentAlert(int environment, string message)
    {
        var notification = new
        {
            id = Guid.NewGuid().ToString(),
            title = "Environment Alert",
            message = message,
            type = "warning",
            timestamp = DateTime.UtcNow.ToString("o"),
            environment = environment
        };

        await _hubContext.Clients.Group($"Environment_{environment}")
            .SendAsync("ReceiveEnvironmentNotification", environment, notification);
    }
}
```

## Configuration

### Environment Variables

Make sure these environment variables are set:

```env
VITE_APP_API_URL=https://your-api-url.com
```

The SignalR connection will be established at `{VITE_APP_API_URL}/notificationHub`.

### Authentication

The SignalR connection uses the JWT token stored in `localStorage.getItem('authToken')`. Make sure your backend validates this token for SignalR connections.

## Usage in Components

### Using the SignalR Context

```typescript
import { useSignalRContext } from '../contexts/SignalRContext';

function MyComponent() {
  const { 
    isConnected, 
    joinMonitorGroup, 
    leaveMonitorGroup,
    lastNotification 
  } = useSignalRContext();

  // Use SignalR functionality
}
```

### Using the Hook Directly

```typescript
import { useSignalR } from '../hooks/useSignalR';

function MyComponent() {
  const { isConnected, joinGroup } = useSignalR({
    autoConnect: true,
    onNotification: (notification) => {
      console.log('Received notification:', notification);
    }
  });
}
```

## Testing

1. Start your backend with SignalR hub
2. Start the frontend: `npm run dev`
3. Login to the application
4. Check the top-right corner for SignalR connection status
5. Send test notifications from your backend to see toast messages

## Troubleshooting

- **Connection Issues**: Check browser console for SignalR connection errors
- **Authentication**: Ensure JWT token is valid and backend accepts it
- **CORS**: Make sure CORS is configured for SignalR connections
- **WebSocket Support**: Ensure your server supports WebSocket connections

## Toast Notification Styling

The toast notifications are styled with different colors based on type:
- **Success**: Green background
- **Warning**: Yellow background  
- **Error**: Red background
- **Info**: Blue background

Notifications appear in the bottom-right corner and auto-dismiss after 5-8 seconds depending on type.
