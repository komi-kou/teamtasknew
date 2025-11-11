import { io, Socket } from 'socket.io-client';
import { LocalStorage } from '../utils/storage';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private currentTeamId: string | null = null;
  private eventListenersSetup: boolean = false; // イベントリスナーが設定済みかどうか

  // イベントリスナーを一度だけ設定する
  private setupEventListeners() {
    if (!this.socket) {
      return;
    }

    // 既存のリスナーを削除（重複を防ぐ）
    this.socket.off('data-updated');
    this.socket.off('data-deleted');

    console.log('🔧 [SocketService] Setting up event listeners');

    // Handle data updates
    this.socket.on('data-updated', (data: any) => {
      console.log('📥 [SocketService] data-updated event received:', data);
      console.log('   - Full data object:', JSON.stringify(data, null, 2));
      console.log('   - dataType:', data.dataType);
      console.log('   - userId:', data.userId);
      console.log('   - timestamp:', data.timestamp);
      console.log('   - data:', data.data);
      console.log('   - data length:', Array.isArray(data.data) ? data.data.length : 'N/A');
      // LocalStorage への無差別保存は行わず、各ページ側のハンドラで必要なキーのみ保存する
      this.emit('dataUpdated', data);
    });

    this.socket.on('data-deleted', (data: any) => {
      console.log('📥 [SocketService] data-deleted event received:', data);
      // LocalStorage の操作は各ページ側に委譲
      this.emit('dataDeleted', data);
    });

    this.eventListenersSetup = true;
    console.log('✅ [SocketService] Event listeners setup complete');
  }

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
    this.eventListenersSetup = false; // リセット
    this.socket = io(SOCKET_URL, {
      // Renderの無料プランではWebSocketが不安定な場合があるため、ポーリングを優先
      transports: ['polling', 'websocket'], // pollingを優先に変更
      upgrade: true, // ポーリングからWebSocketへのアップグレードを許可
      reconnection: true,
      reconnectionAttempts: Infinity, // 無限に再接続を試みる
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      // ポーリングの設定
      forceNew: false, // 既存の接続を再利用
      // Renderの無料プランでの接続安定性を向上
      autoConnect: true,
    });

    // イベントリスナーを設定（接続前に設定）
    this.setupEventListeners();

    this.socket.on('connect', () => {
      console.log('✅ Socket.io接続成功, teamId:', teamId);
      console.log('   - Socket ID:', this.socket?.id);
      console.log('   - Transport:', this.socket?.io.engine.transport.name);
      
      // 接続後にイベントリスナーを再設定（念のため）
      this.setupEventListeners();
      
      if (teamId) {
        this.joinTeam(teamId);
        console.log('👥 チームに参加:', teamId);
      }
      // 接続成功イベントを発火
      this.emit('connected', { teamId });
    });
    
    // チーム参加確認
    this.socket.on('team-joined', (data: any) => {
      console.log('✅ [SocketService] チーム参加確認:', data);
      console.log('   - teamId:', data.teamId);
      console.log('   - socketId:', data.socketId);
    });

    // 接続エラーのハンドリング
    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket.io接続エラー:', error.message);
      console.error('   接続先URL:', SOCKET_URL);
      console.error('   エラー詳細:', error);
      console.error('   エラータイプ:', error.type);
      // エラーイベントを発火
      this.emit('disconnected', { reason: error.message });
    });

    // 再接続時にもルームに参加
    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Reconnected after', attemptNumber, 'attempts');
      // 再接続時にもイベントリスナーを再設定
      this.setupEventListeners();
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

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.eventListenersSetup = false; // リセット
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