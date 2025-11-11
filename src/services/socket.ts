import { io, Socket } from 'socket.io-client';
import { LocalStorage } from '../utils/storage';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private currentTeamId: string | null = null;

  connect(teamId: string) {
    // 既に同じteamIdで接続されている場合は再接続しない
    if (this.socket && this.socket.connected && this.currentTeamId === teamId) {
      console.log('Already connected to team:', teamId);
      return this.socket;
    }

    // 既存の接続がある場合は切断
    if (this.socket) {
      this.disconnect();
    }

    this.currentTeamId = teamId;
    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // pollingも追加して接続性を向上
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket.io接続成功, teamId:', teamId);
      if (teamId) {
        this.joinTeam(teamId);
        console.log('👥 チームに参加:', teamId);
      }
      // 接続成功イベントを発火
      this.emit('connected', { teamId });
    });

    // 接続エラーのハンドリング
    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket.io接続エラー:', error.message);
      console.error('   接続先URL:', SOCKET_URL);
      console.error('   エラー詳細:', error);
    });

    // 再接続時にもルームに参加
    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      if (teamId) {
        this.joinTeam(teamId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('👋 Socket.io切断:', reason);
      // 切断イベントを発火
      this.emit('disconnected', { reason });
      if (reason === 'io server disconnect') {
        // サーバー側で切断された場合、手動で再接続
        console.log('🔄 サーバー側で切断されたため、再接続を試みます...');
        this.socket?.connect();
      }
    });

    // Handle data updates
    this.socket.on('data-updated', (data: any) => {
      console.log('Data updated:', data);
      // LocalStorage への無差別保存は行わず、各ページ側のハンドラで必要なキーのみ保存する
      this.emit('dataUpdated', data);
    });

    this.socket.on('data-deleted', (data: any) => {
      console.log('Data deleted:', data);
      // LocalStorage の操作は各ページ側に委譲
      this.emit('dataDeleted', data);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinTeam(teamId: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join-team', teamId);
      console.log('Emitted join-team event for teamId:', teamId);
    } else {
      console.warn('Cannot join team: socket not connected');
      // 接続されていない場合、接続を再試行
      if (teamId) {
        this.connect(teamId);
      }
    }
  }

  sendDataUpdate(teamId: string, dataType: string, data: any, userId?: string) {
    if (this.socket && this.socket.connected) {
      console.log('Sending data update:', { teamId, dataType, userId, dataLength: Array.isArray(data) ? data.length : 'N/A' });
      this.socket.emit('data-update', {
        teamId,
        dataType,
        data,
        userId
      });
    } else {
      console.warn('Cannot send data update: socket not connected. Attempting to reconnect...');
      // 接続されていない場合、接続を再試行
      if (teamId) {
        this.connect(teamId);
        // 接続後に再送信を試みる
        setTimeout(() => {
          if (this.socket && this.socket.connected) {
            this.socket.emit('data-update', {
              teamId,
              dataType,
              data,
              userId
            });
          }
        }, 1000);
      }
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getCurrentTeamId(): string | null {
    return this.currentTeamId;
  }
}

export default new SocketService();