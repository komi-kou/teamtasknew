# データ同期問題のデバッグ手順

## 🔍 原因特定のためのチェックリスト

ブラウザ別のスクリーンショットを確認する際に、以下のポイントを確認してください：

### 1. サーバー側のログ（Renderのログ）を確認

#### タスクを保存した時のログ
以下のログが表示されているか確認：

```
📤 [API] Sending data-updated event to team xhu8o6s40
   - dataType: tasksData
   - userId: [ユーザーID]
   - Connected clients: [数値]
   - Client IDs: [Socket IDのリスト]
   - All rooms: [ルームのリスト]
```

**重要なポイント：**
- `Connected clients: 0` の場合 → **ルームに誰も接続していない**
- `Connected clients: 1` の場合 → **保存した本人だけが接続している（他のブラウザが接続していない）**
- `Connected clients: 2以上` の場合 → **正常（複数のブラウザが接続している）**

#### ルーム参加時のログ
以下のログが表示されているか確認：

```
👥 User [Socket ID] joined team xhu8o6s40
📊 Team xhu8o6s40 now has [数値] connected clients
   Client IDs: [Socket IDのリスト]
   Socket ID: [Socket ID]
   Is socket in room? true
   All rooms: [ルームのリスト]
```

**重要なポイント：**
- `Is socket in room? false` の場合 → **ルームに参加できていない**
- `All rooms` に `xhu8o6s40` が含まれていない場合 → **ルームが作成されていない**

### 2. クライアント側のログ（ブラウザのコンソール）を確認

#### Socket.io接続時のログ
以下のログが表示されているか確認：

```
✅ Socket.io接続成功, teamId: xhu8o6s40
   - Socket ID: [Socket ID]
   - Transport: polling または websocket
✅ [SocketService] チーム参加確認:
   - teamId: xhu8o6s40
   - socketId: [Socket ID]
```

**重要なポイント：**
- `Transport: polling` の場合 → **ポーリングで接続（正常）**
- `Transport: websocket` の場合 → **WebSocketで接続（正常）**
- `チーム参加確認` が表示されない場合 → **サーバー側でルーム参加が失敗している**

#### データ保存時のログ
タスクを保存した時に以下のログが表示されているか確認：

```
💾 [Tasks] タスクをサーバーに保存開始: [数値] 件
サーバーへの保存を開始: tasksData [数値] 件
サーバーへの保存が成功しました: tasksData
✅ [Tasks] タスクの保存が成功しました
```

#### データ受信時のログ
他のブラウザでタスクを追加した時に、以下のログが表示されているか確認：

```
📥 [SocketService] data-updated event received: [データ]
   - Full data object: [JSON]
   - dataType: tasksData
   - userId: [ユーザーID]
   - timestamp: [タイムスタンプ]
   - data: [データ配列]
   - data length: [数値]
📥 [Tasks] Real-time data update received: [データ]
   - dataType: tasksData
   - Expected: tasksData
   - Match: true
   - userId: [ユーザーID]
   - timestamp: [タイムスタンプ]
   - Data length: [数値]
✅ [Tasks] Applying tasks update
```

**重要なポイント：**
- `📥 [SocketService] data-updated event received` が表示されない場合 → **Socket.ioイベントが届いていない**
- `📥 [Tasks] Real-time data update received` が表示されない場合 → **SocketServiceから各ページへのイベント転送が失敗している**

### 3. よくある問題と解決策

#### 問題1: `Connected clients: 0`
**原因：**
- 他のブラウザがSocket.ioに接続していない
- ルームに参加できていない
- Renderの無料プランで複数のインスタンスが起動し、別のインスタンスに接続している

**解決策：**
- ブラウザのコンソールで `✅ Socket.io接続成功` が表示されているか確認
- `✅ [SocketService] チーム参加確認` が表示されているか確認
- Renderのログで `👥 User [Socket ID] joined team` が表示されているか確認

#### 問題2: `📥 [SocketService] data-updated event received` が表示されない
**原因：**
- Socket.ioイベントが届いていない
- イベント名が一致していない
- ルームに参加していない

**解決策：**
- サーバー側のログで `✅ [API] Data-updated event sent` が表示されているか確認
- クライアント側のログで `✅ Socket.io接続成功` が表示されているか確認
- `✅ [SocketService] チーム参加確認` が表示されているか確認

#### 問題3: `📥 [Tasks] Real-time data update received` が表示されない
**原因：**
- SocketServiceから各ページへのイベント転送が失敗している
- イベントリスナーが正しく登録されていない

**解決策：**
- `SocketService.on('dataUpdated', handleDataUpdate)` が呼び出されているか確認
- `useEffect` の依存配列が正しいか確認

## 📋 デバッグ手順

1. **ブラウザAでタスクを追加**
   - コンソールで `💾 [Tasks] タスクをサーバーに保存開始` が表示されるか確認
   - Renderのログで `📤 [API] Sending data-updated event` が表示されるか確認
   - Renderのログで `Connected clients: [数値]` を確認

2. **ブラウザBで確認**
   - コンソールで `✅ Socket.io接続成功` が表示されているか確認
   - コンソールで `✅ [SocketService] チーム参加確認` が表示されているか確認
   - コンソールで `📥 [SocketService] data-updated event received` が表示されるか確認
   - コンソールで `📥 [Tasks] Real-time data update received` が表示されるか確認

3. **10秒待つ**
   - ポーリング機能により、10秒以内にデータが同期されるか確認
   - コンソールで `🔄 [Tasks] Polling: Socket.io未接続、サーバーからデータを取得` が表示されるか確認

## 🎯 次のステップ

ブラウザ別のスクリーンショットを確認した後、以下の情報を共有してください：

1. **サーバー側のログ（Renderのログ）**
   - タスクを保存した時のログ
   - ルーム参加時のログ

2. **クライアント側のログ（ブラウザのコンソール）**
   - Socket.io接続時のログ
   - データ保存時のログ
   - データ受信時のログ（または受信していない場合）

これらの情報があれば、問題の原因を特定できます。

