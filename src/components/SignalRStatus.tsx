import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useSignalRContext } from '../contexts/SignalRContext';
import * as signalR from '@microsoft/signalr';

export function SignalRStatus() {
  const { connectionState, isConnected } = useSignalRContext();

  const getStatusIcon = () => {
    if (!connectionState) {
      return <WifiOff className="w-4 h-4 text-gray-400" />;
    }

    switch (connectionState) {
      case signalR.HubConnectionState.Connected:
        return <Wifi className="w-4 h-4 text-green-500" />;
      case signalR.HubConnectionState.Connecting:
      case signalR.HubConnectionState.Reconnecting:
        return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
      case signalR.HubConnectionState.Disconnected:
      case signalR.HubConnectionState.Disconnecting:
      default:
        return <WifiOff className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = () => {
    if (!connectionState) {
      return 'Disconnected';
    }

    switch (connectionState) {
      case signalR.HubConnectionState.Connected:
        return 'Connected';
      case signalR.HubConnectionState.Connecting:
        return 'Connecting...';
      case signalR.HubConnectionState.Reconnecting:
        return 'Reconnecting...';
      case signalR.HubConnectionState.Disconnected:
        return 'Disconnected';
      case signalR.HubConnectionState.Disconnecting:
        return 'Disconnecting...';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    if (!connectionState) {
      return 'text-gray-400';
    }

    switch (connectionState) {
      case signalR.HubConnectionState.Connected:
        return 'text-green-500';
      case signalR.HubConnectionState.Connecting:
      case signalR.HubConnectionState.Reconnecting:
        return 'text-yellow-500';
      case signalR.HubConnectionState.Disconnected:
      case signalR.HubConnectionState.Disconnecting:
      default:
        return 'text-red-500';
    }
  };

  return (
    <div className="flex items-center space-x-2 text-sm">
      {getStatusIcon()}
      <span className={`${getStatusColor()} font-medium`}>
        {getStatusText()}
      </span>
    </div>
  );
}
