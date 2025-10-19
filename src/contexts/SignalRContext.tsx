import React, { createContext, useContext, ReactNode } from 'react';
import { useSignalR } from '../hooks/useSignalR';
import { SignalRNotification } from '../types';
import * as signalR from '@microsoft/signalr';

interface SignalRContextType {
  connectionState: signalR.HubConnectionState | null;
  isConnected: boolean;
  lastNotification: SignalRNotification | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  joinGroup: (groupName: string) => Promise<void>;
  leaveGroup: (groupName: string) => Promise<void>;
  joinMonitorGroup: (monitorId: number) => Promise<void>;
  leaveMonitorGroup: (monitorId: number) => Promise<void>;
  joinEnvironmentGroup: (environment: number) => Promise<void>;
  leaveEnvironmentGroup: (environment: number) => Promise<void>;
  joinRegionGroup: (region: number) => Promise<void>;
  leaveRegionGroup: (region: number) => Promise<void>;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

interface SignalRProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
  onNotification?: (notification: SignalRNotification) => void;
}

export function SignalRProvider({ 
  children, 
  autoConnect = true, 
  onNotification 
}: SignalRProviderProps) {
  const signalR = useSignalR({
    autoConnect,
    onNotification
  });

  return (
    <SignalRContext.Provider value={signalR}>
      {children}
    </SignalRContext.Provider>
  );
}

export function useSignalRContext(): SignalRContextType {
  const context = useContext(SignalRContext);
  if (context === undefined) {
    throw new Error('useSignalRContext must be used within a SignalRProvider');
  }
  return context;
}
