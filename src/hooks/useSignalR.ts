import { useEffect, useState, useCallback } from 'react';
import { signalRService, SignalRNotification } from '../services/signalRService';
import * as signalR from '@microsoft/signalr';

export interface UseSignalROptions {
  autoConnect?: boolean;
  onNotification?: (notification: SignalRNotification) => void;
  onConnectionStateChange?: (state: signalR.HubConnectionState | null) => void;
}

export function useSignalR(options: UseSignalROptions = {}) {
  const {
    autoConnect = true,
    onNotification,
    onConnectionStateChange
  } = options;

  const [connectionState, setConnectionState] = useState<signalR.HubConnectionState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<SignalRNotification | null>(null);

  // Connect to SignalR
  const connect = useCallback(async () => {
    try {
      await signalRService.connect();
    } catch (error) {
      console.error('Failed to connect to SignalR:', error);
    }
  }, []);

  // Disconnect from SignalR
  const disconnect = useCallback(async () => {
    try {
      await signalRService.disconnect();
    } catch (error) {
      console.error('Failed to disconnect from SignalR:', error);
    }
  }, []);

  // Group management methods
  const joinGroup = useCallback(async (groupName: string) => {
    await signalRService.joinGroup(groupName);
  }, []);

  const leaveGroup = useCallback(async (groupName: string) => {
    await signalRService.leaveGroup(groupName);
  }, []);

  const joinMonitorGroup = useCallback(async (monitorId: number) => {
    await signalRService.joinMonitorGroup(monitorId);
  }, []);

  const leaveMonitorGroup = useCallback(async (monitorId: number) => {
    await signalRService.leaveMonitorGroup(monitorId);
  }, []);

  const joinEnvironmentGroup = useCallback(async (environment: number) => {
    await signalRService.joinEnvironmentGroup(environment);
  }, []);

  const leaveEnvironmentGroup = useCallback(async (environment: number) => {
    await signalRService.leaveEnvironmentGroup(environment);
  }, []);

  const joinRegionGroup = useCallback(async (region: number) => {
    await signalRService.joinRegionGroup(region);
  }, []);

  const leaveRegionGroup = useCallback(async (region: number) => {
    await signalRService.leaveRegionGroup(region);
  }, []);

  // Monitor connection state
  useEffect(() => {
    const checkConnectionState = () => {
      const state = signalRService.getConnectionState();
      const connected = signalRService.isConnectionActive();
      
      setConnectionState(state);
      setIsConnected(connected);
      
      if (onConnectionStateChange) {
        onConnectionStateChange(state);
      }
    };

    // Check initial state
    checkConnectionState();

    // Set up interval to monitor connection state
    const interval = setInterval(checkConnectionState, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [onConnectionStateChange]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      if (autoConnect) {
        disconnect();
      }
    };
  }, [autoConnect, connect, disconnect]);

  // Set up notification handler
  useEffect(() => {
    if (onNotification) {
      // Override the default notification handler in the service
      // This is a simplified approach - in a real app you might want to use an event emitter
      const originalHandler = signalRService['handleNotification'];
      signalRService['handleNotification'] = (notification: SignalRNotification) => {
        setLastNotification(notification);
        onNotification(notification);
        // Still call the original handler for toast display
        originalHandler.call(signalRService, notification);
      };

      return () => {
        // Restore original handler
        signalRService['handleNotification'] = originalHandler;
      };
    }
  }, [onNotification]);

  return {
    connectionState,
    isConnected,
    lastNotification,
    connect,
    disconnect,
    joinGroup,
    leaveGroup,
    joinMonitorGroup,
    leaveMonitorGroup,
    joinEnvironmentGroup,
    leaveEnvironmentGroup,
    joinRegionGroup,
    leaveRegionGroup
  };
}
