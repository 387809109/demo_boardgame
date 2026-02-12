/**
 * App online room methods
 * @module app/app-online-room-methods
 */

/**
 * Register online-room-related methods on App prototype.
 *
 * @param {Function} App - App class constructor
 * @param {Object} deps - External dependencies
 */
export function registerAppOnlineRoomMethods(App, deps) {
  const {
    NetworkClient,
    CloudNetworkClient,
    getSupabaseClient,
    createGame,
    WaitingRoom,
    GameBoard,
    getModal,
    showLoading,
    hideLoading,
    showNotification,
    showToast,
    DEFAULT_LOCAL_SERVER_URL
  } = deps;

  Object.assign(App.prototype, {
    /**
     * Show create room dialog
     * @private
     */
    async _showCreateRoomDialog(gameType, settings = {}, gameConfig = {}, cachedPreset = null) {
      const modal = getModal();
      const content = document.createElement('div');

      const minP = gameConfig.minPlayers || 2;
      const maxP = gameConfig.maxPlayers || 10;
      const hasRoleSetup = !!gameConfig.defaultRoleCounts;

      // For role-setup games, compute maxPlayers from roleCounts sum
      let roleTotal = 0;
      if (hasRoleSetup && settings.roleCounts) {
        roleTotal = Object.values(settings.roleCounts).reduce((s, v) => s + v, 0);
      }

      const playerCountHtml = hasRoleSetup
        ? `<div class="input" style="background: var(--bg-tertiary); cursor: default;">
             ${roleTotal || minP} 人（由角色配置决定）
           </div>`
        : (() => {
            const defaultMaxPlayers = Number.isFinite(cachedPreset?.maxPlayers)
              ? Math.max(minP, Math.min(maxP, cachedPreset.maxPlayers))
              : minP;
            const playerOptions = Array.from(
              { length: maxP - minP + 1 },
              (_, i) => {
                const n = minP + i;
                return `<option value="${n}" ${n === defaultMaxPlayers ? 'selected' : ''}>${n} 人</option>`;
              }
            ).join('');
            return `<select class="input max-players-select">${playerOptions}</select>`;
          })();

      const isCloud = this.mode === 'cloud';
      const cloudNickname = isCloud
        ? (this.authService?.getCurrentUser()?.nickname || '')
        : '';
      const defaultNickname = isCloud
        ? cloudNickname
        : this.config.game.defaultNickname;
      const defaultServerUrl = (!isCloud && cachedPreset?.serverUrl)
        ? cachedPreset.serverUrl
        : DEFAULT_LOCAL_SERVER_URL;

      content.innerHTML = `
        ${!isCloud ? `
          <div class="input-group" style="margin-bottom: var(--spacing-4);">
            <label class="input-label">服务器地址</label>
            <input type="text" class="input server-input" value="${defaultServerUrl}" placeholder="ws://IP:端口">
          </div>
        ` : ''}
        <div class="input-group" style="margin-bottom: var(--spacing-4);">
          <label class="input-label">房间 ID</label>
          <input type="text" class="input room-input" value="room-${Date.now().toString(36)}" placeholder="房间ID">
        </div>
        <div class="input-group" style="margin-bottom: var(--spacing-4);">
          <label class="input-label">你的昵称</label>
          <input type="text" class="input nickname-input" value="${defaultNickname}" placeholder="昵称">
        </div>
        <div class="input-group" style="margin-bottom: var(--spacing-4);">
          <label class="input-label">玩家人数</label>
          ${playerCountHtml}
        </div>
        <button class="btn btn-primary create-btn" style="width: 100%;">创建房间</button>
      `;

      const title = isCloud ? '创建云端房间' : '创建在线房间';
      modal.show(content, { title, width: '360px' });

      content.querySelector('.create-btn').addEventListener('click', async () => {
        const serverUrl = isCloud
          ? ''
          : content.querySelector('.server-input')?.value.trim();
        const roomId = content.querySelector('.room-input').value.trim();
        const nickname = content.querySelector('.nickname-input').value.trim();

        let maxPlayers;
        if (hasRoleSetup && settings.roleCounts) {
          maxPlayers = Object.values(settings.roleCounts).reduce((s, v) => s + v, 0);
        } else {
          maxPlayers = parseInt(content.querySelector('.max-players-select')?.value || minP, 10);
        }

        if ((!isCloud && !serverUrl) || !roomId || !nickname) {
          showToast('请填写所有字段');
          return;
        }

        this._saveRoomCreatePreset(gameType, {
          settings,
          maxPlayers,
          serverUrl: isCloud ? '' : serverUrl
        });

        modal.hide();
        // Store settings and config for when game starts
        this._pendingGameSettings = settings;
        this._pendingGameConfig = gameConfig;
        const supportsAI = gameConfig.supportsAI !== false;
        await this._connectAndCreateRoom(serverUrl, roomId, nickname, gameType, maxPlayers, supportsAI);
      });
    },

    /**
     * Show join room dialog
     * @private
     */
    async _showJoinRoomDialog() {
      const modal = getModal();
      const content = document.createElement('div');
      const prefill = this._joinRoomPrefill;
      this._joinRoomPrefill = null;

      const isCloud = this.mode === 'cloud';
      const defaultServerUrl = prefill?.serverUrl || DEFAULT_LOCAL_SERVER_URL;
      const defaultRoomId = prefill?.roomId || '';
      const defaultNickname = isCloud
        ? (this.authService?.getCurrentUser()?.nickname || '')
        : (prefill?.nickname || this.config.game.defaultNickname);

      content.innerHTML = `
        ${!isCloud ? `
          <div class="input-group" style="margin-bottom: var(--spacing-4);">
            <label class="input-label">服务器地址</label>
            <input type="text" class="input server-input" value="${defaultServerUrl}" placeholder="ws://IP:端口">
          </div>
        ` : ''}
        <div class="input-group" style="margin-bottom: var(--spacing-4);">
          <label class="input-label">房间 ID</label>
          <input type="text" class="input room-input" value="${defaultRoomId}" placeholder="输入房间ID">
        </div>
        <div class="input-group" style="margin-bottom: var(--spacing-4);">
          <label class="input-label">你的昵称</label>
          <input type="text" class="input nickname-input" value="${defaultNickname}" placeholder="昵称">
        </div>
        <button class="btn btn-primary join-btn" style="width: 100%;">加入房间</button>
      `;

      const title = isCloud ? '加入云端房间' : '加入在线房间';
      modal.show(content, { title, width: '360px' });

      content.querySelector('.join-btn').addEventListener('click', async () => {
        const serverUrl = isCloud
          ? ''
          : content.querySelector('.server-input')?.value.trim();
        const roomId = content.querySelector('.room-input').value.trim();
        const nickname = content.querySelector('.nickname-input').value.trim();

        if ((!isCloud && !serverUrl) || !roomId || !nickname) {
          showToast('请填写所有字段');
          return;
        }

        modal.hide();
        await this._connectAndJoinRoom(serverUrl, roomId, nickname);
      });
    },

    /**
     * Connect and create room
     * @private
     */
    async _connectAndCreateRoom(serverUrl, roomId, nickname, gameType, maxPlayers = 4, supportsAI = true) {
      showLoading('连接服务器...');

      try {
        if (this.mode === 'local') {
          this._refreshSessionId();
        }
        if (this.mode === 'cloud') {
          this.network = new CloudNetworkClient(getSupabaseClient());
        } else {
          this.network = new NetworkClient(serverUrl);
        }
        this.network.playerId = this.playerId;

        await this.network.connect();

        this._setupNetworkHandlers();

        const reconnectSessionId = this.mode === 'local' ? this.sessionId : null;
        this.network.joinRoom(roomId, nickname, gameType, reconnectSessionId);

        this.currentRoom = {
          id: roomId,
          gameType,
          maxPlayers,
          supportsAI,
          nickname,
          players: [{ id: this.playerId, nickname, isHost: true }],
          aiPlayers: [], // AI players managed by host
          gameConfig: this._pendingGameConfig || this._getGameConfig(gameType),
          gameSettings: this._pendingGameSettings || {},
          returnToRoomPhase: false,
          returnStatus: { [this.playerId]: true },
          allPlayersReturned: true
        };
        this._saveReconnectContext();

        hideLoading();
        this._showWaitingRoom();

      } catch (err) {
        hideLoading();
        showNotification('连接失败: ' + err.message, 'error');
      }
    },

    /**
     * Connect and join room
     * @private
     */
    async _connectAndJoinRoom(serverUrl, roomId, nickname) {
      showLoading('连接服务器...');

      try {
        if (this.mode === 'local') {
          this._refreshSessionId();
        }
        if (this.mode === 'cloud') {
          this.network = new CloudNetworkClient(getSupabaseClient());
        } else {
          this.network = new NetworkClient(serverUrl);
        }
        this.network.playerId = this.playerId;

        await this.network.connect();

        this._setupNetworkHandlers();

        const reconnectSessionId = this.mode === 'local' ? this.sessionId : null;
        this.network.joinRoom(roomId, nickname, 'unknown', reconnectSessionId);

        this.currentRoom = {
          id: roomId,
          gameType: 'unknown',
          nickname,
          players: [],
          returnToRoomPhase: false,
          returnStatus: {},
          allPlayersReturned: true
        };
        this._saveReconnectContext();

        hideLoading();
        // Waiting room will be shown when PLAYER_JOINED is received

      } catch (err) {
        hideLoading();
        showNotification('连接失败: ' + err.message, 'error');
      }
    },

    /**
     * Setup network event handlers
     * @private
     */
    _setupNetworkHandlers() {
      const net = this.network;

      net.onMessage('PLAYER_JOINED', (data) => {
        // Preserve existing gameSettings (host is source of truth);
        // only accept server settings when we have none yet (non-host joining)
        const existingSettings = this.currentRoom?.gameSettings;
        const hasLocalSettings = existingSettings
          && Object.keys(existingSettings).length > 0;
        const gameSettings = hasLocalSettings
          ? existingSettings
          : (data.gameSettings || {});
        const wasReturnToRoomPhase = !!this.currentRoom?.returnToRoomPhase;
        const previousReturnStatus = this.currentRoom?.returnStatus || {};
        const nextReturnStatus = {};
        (data.players || []).forEach((player) => {
          if (Object.prototype.hasOwnProperty.call(previousReturnStatus, player.id)) {
            nextReturnStatus[player.id] = !!previousReturnStatus[player.id];
            return;
          }
          // New players in non-started room are considered already back in room.
          nextReturnStatus[player.id] = true;
        });
        const allPlayersReturned = wasReturnToRoomPhase
          ? (data.players || []).length > 0
            && (data.players || []).every(player => !!nextReturnStatus[player.id])
          : true;

        this.currentRoom = {
          ...this.currentRoom,
          players: data.players,
          aiPlayers: data.aiPlayers || this.currentRoom?.aiPlayers || [],
          gameSettings,
          returnToRoomPhase: wasReturnToRoomPhase,
          returnStatus: nextReturnStatus,
          allPlayersReturned
        };
        this._saveReconnectContext();

        if (!this.currentView || !(this.currentView instanceof WaitingRoom)) {
          this._showWaitingRoom();
        } else {
          this.currentView.updatePlayers(data.players);
          if (this.currentRoom.returnToRoomPhase) {
            this.currentView.updateReturnStatus(
              this.currentRoom.returnStatus || {},
              this.currentRoom.allPlayersReturned
            );
          }
          // Sync AI players if provided
          if (data.aiPlayers) {
            this.currentView.updateAIPlayers(data.aiPlayers);
          }
          // Only sync game settings for non-host (who doesn't have settings yet)
          if (data.gameSettings && !hasLocalSettings) {
            this.currentView.updateGameSettings(data.gameSettings);
          }
          this.currentView.addSystemMessage(`${data.nickname} 加入了房间`);

          // Host re-sends settings so new player receives full room info
          if (this._isHost() && this.network?.isConnected()) {
            const settings = this.currentRoom.gameSettings || {};
            this.network.send('GAME_SETTINGS_UPDATE', {
              gameSettings: {
                ...settings,
                _gameType: this.currentRoom.gameType,
                _maxPlayers: this.currentRoom.maxPlayers
              }
            });
          }
        }
      });

      net.onMessage('PLAYER_LEFT', (data) => {
        if (this.currentRoom) {
          this.currentRoom.players = data.players;
          if (this.currentRoom.returnToRoomPhase) {
            const nextReturnStatus = {};
            const previousReturnStatus = this.currentRoom.returnStatus || {};
            (data.players || []).forEach((player) => {
              nextReturnStatus[player.id] = !!previousReturnStatus[player.id];
            });
            this.currentRoom.returnStatus = nextReturnStatus;
            this.currentRoom.allPlayersReturned = (data.players || []).length > 0
              && (data.players || []).every(player => !!nextReturnStatus[player.id]);
          }
        }

        if (this.currentView instanceof WaitingRoom) {
          this.currentView.updatePlayers(data.players);
          if (this.currentRoom?.returnToRoomPhase) {
            this.currentView.updateReturnStatus(
              this.currentRoom.returnStatus || {},
              this.currentRoom.allPlayersReturned
            );
          }
          this.currentView.addSystemMessage(`玩家离开了房间`);
        }
      });

      net.onMessage('ROOM_DESTROYED', (data) => {
        const message = data.message || '房间已解散';
        showToast(message, 'warning');

        // Disconnect and return to lobby
        if (this.network) {
          this._manualDisconnect = true;
          this.network.disconnect();
        }
        this._cancelReconnectTimers();
        this._clearReconnectContext();
        this.currentRoom = null;
        this.currentGame = null;
        this.showLobby();
      });

      net.onMessage('AI_PLAYER_UPDATE', (data) => {
        const aiPlayers = data.aiPlayers || [];
        if (this.currentRoom) {
          this.currentRoom.aiPlayers = aiPlayers;
        }

        if (this.currentView instanceof WaitingRoom) {
          this.currentView.updateAIPlayers(aiPlayers);
        }
      });

      net.onMessage('GAME_SETTINGS_UPDATE', (data) => {
        const gameSettings = data.gameSettings || {};
        const metaGameType = gameSettings._gameType;
        const metaMaxPlayers = gameSettings._maxPlayers;

        if (this.currentRoom) {
          this.currentRoom.gameSettings = gameSettings;

          // Non-host: upgrade room info from metadata when gameType is unknown
          if (metaGameType && this.currentRoom.gameType === 'unknown') {
            this.currentRoom.gameType = metaGameType;
            this.currentRoom.gameConfig = this._getGameConfig(metaGameType);
            this.currentRoom.maxPlayers = metaMaxPlayers
              || this.currentRoom.gameConfig.maxPlayers;
            this.currentRoom.supportsAI =
              !!this.currentRoom.gameConfig.supportsAI;

            // Re-create waiting room with full data
            if (this.currentView instanceof WaitingRoom) {
              this._showWaitingRoom();
              return;
            }
          }

          // Update maxPlayers from metadata (host may have changed role counts)
          if (metaMaxPlayers) {
            this.currentRoom.maxPlayers = metaMaxPlayers;
          }
        }
        this._saveReconnectContext({ gameType: this.currentRoom?.gameType || 'unknown' });

        if (this.currentView instanceof WaitingRoom) {
          this.currentView.updateGameSettings(gameSettings);
        }
      });

      net.onMessage('GAME_STARTED', (data) => {
        showToast('游戏开始!');
        // Get players from initial state (includes AI players)
        const players = data.initialState?.players || this.currentRoom?.players || [];
        // Store AI players info for simulation
        this._aiPlayers = data.aiPlayers || [];
        // Use gameSettings from host if provided, otherwise use local pending settings
        const settings = data.gameSettings || this._pendingGameSettings || {};
        // Store for display in GameBoard
        this._currentGameSettings = settings;
        this._saveReconnectContext({ gameType: data.gameType });
        // Use initialState from host if provided
        this._startGame(data.gameType, players, 'online', settings, data.initialState);
      });

      net.onMessage('RETURN_TO_ROOM_STATUS', (data) => {
        if (!this.currentRoom) {
          return;
        }

        const statusPlayers = Array.isArray(data?.players) ? data.players : [];
        const roomPlayers = statusPlayers.map(player => ({
          id: player.id,
          nickname: player.nickname,
          isHost: player.isHost
        }));
        const statusByPlayer = {};
        roomPlayers.forEach((player, index) => {
          statusByPlayer[player.id] = !!statusPlayers[index]?.returned;
        });

        this.currentRoom.players = roomPlayers;
        this.currentRoom.returnToRoomPhase = true;
        this.currentRoom.returnStatus = statusByPlayer;
        this.currentRoom.allPlayersReturned = typeof data?.allReturned === 'boolean'
          ? data.allReturned
          : roomPlayers.length > 0 && roomPlayers.every(player => !!statusByPlayer[player.id]);

        if (this.currentView instanceof WaitingRoom) {
          this.currentView.updatePlayers(roomPlayers);
          this.currentView.updateReturnStatus(statusByPlayer, this.currentRoom.allPlayersReturned);
        }

        this._promptReturnToRoomIfNeeded();
      });

      net.onMessage('GAME_STATE_UPDATE', (data) => {
        if (this.currentGame && data.lastAction) {
          // Apply the action from another player (or AI controlled by host)
          const action = data.lastAction;
          // Skip only if the action is from ourselves (already applied locally).
          // AI actions sent by the host must be applied by non-host clients.
          if (action.playerId !== this.playerId) {
            this.currentGame.executeMove(action);
          }
          // Trigger AI simulation if host and game has AI players
          if (this._isHost() && this._aiPlayers?.length > 0) {
            setTimeout(() => this._simulateAITurn(), 500);
          }
        }
      });

      net.onMessage('CHAT_MESSAGE_BROADCAST', (data) => {
        if (this.currentView instanceof WaitingRoom) {
          this.currentView.addChatMessage(data);
        } else if (this.currentView instanceof GameBoard) {
          this.currentView.addChatMessage(data);
        }
      });

      net.onMessage('ERROR', (data) => {
        showNotification(data.message, 'error');
      });

      net.onMessage('RECONNECT_ACCEPTED', () => {
        this._handleReconnectAccepted();
      });

      net.onMessage('RECONNECT_REJECTED', (data) => {
        if (!this._isReconnecting) return;
        this._handleReconnectFailure(data?.message || data?.reasonCode || '服务器拒绝重连');
      });

      net.onMessage('GAME_SNAPSHOT', (data) => {
        this._handleGameSnapshot(data);
      });

      net.onMessage('PLAYER_RECONNECTED', (data, message) => {
        if (this.currentRoom && Array.isArray(data?.players)) {
          this.currentRoom.players = data.players;
        }
        if (message?.playerId && message.playerId !== this.playerId) {
          showToast(`玩家 ${message.playerId.slice(0, 8)} 已重连`);
        }
      });

      net.on('disconnected', () => {
        if (this._manualDisconnect) {
          this._manualDisconnect = false;
          return;
        }

        if (this._canAttemptReconnect()) {
          showNotification('与服务器断开连接，正在尝试重连', 'warning');
          this._attemptReconnect();
          return;
        }

        this._cancelReconnectTimers();
        this._clearReconnectContext();
        this.currentRoom = null;
        this.currentGame = null;
        showNotification('与服务器断开连接', 'warning');
        this.showLobby();
      });

      net.on('serverError', (data) => {
        showNotification(data.message, data.severity === 'fatal' ? 'error' : 'warning');
      });
    },

    /**
     * Show waiting room
     * @private
     */
    _showWaitingRoom() {
      this._clearView();
      const canSyncRoomSettings = () => {
        if (!this.currentRoom?.returnToRoomPhase) {
          return true;
        }
        return !!this.currentRoom?.allPlayersReturned;
      };

      this.currentView = new WaitingRoom({
        room: this.currentRoom,
        playerId: this.playerId,
        onStartGame: () => {
          if (this.network?.isConnected()) {
            // Verify player count matches required number
            const humanPlayers = this.currentRoom.players || [];
            const aiPlayers = this.currentRoom.aiPlayers || [];
            const totalPlayers = humanPlayers.length + aiPlayers.length;
            const requiredPlayers = this.currentRoom.maxPlayers || totalPlayers;

            if (totalPlayers !== requiredPlayers) {
              showToast(`需要 ${requiredPlayers} 名玩家才能开始（当前 ${totalPlayers} 人）`);
              return;
            }

            const returnStatus = this.currentRoom.returnStatus || {};
            const allPlayersReturned = !this.currentRoom.returnToRoomPhase
              || humanPlayers.every(player => !!returnStatus[player.id]);
            if (this.currentRoom.returnToRoomPhase && !allPlayersReturned) {
              showToast('等待所有玩家返回房间后可开始新一局');
              return;
            }

            // Host initializes the game and sends initial state to all players
            const gameType = this.currentRoom.gameType;
            // Combine human players and AI players
            const allPlayers = [...humanPlayers, ...aiPlayers];
            // Get settings from WaitingRoom (includes any edits made)
            const settings = this.currentView.getGameSettings();

            // Create temporary game to generate initial state
            const tempGame = createGame(gameType, 'online');
            tempGame.start({ players: allPlayers, gameType, options: settings });
            const initialState = tempGame.getState();

            // Send START_GAME with initial state, AI players, and game settings
            this.network.startGame(gameType, { initialState, aiPlayers, gameSettings: settings });
          }
        },
        onLeave: () => {
          if (this.network) {
            this._manualDisconnect = true;
            this.network.leaveRoom();
            this.network.disconnect();
          }
          this._cancelReconnectTimers();
          this._clearReconnectContext();
          this.currentRoom = null;
          this.showLobby();
        },
        onSendChat: (message) => {
          if (this.network?.isConnected()) {
            this.network.sendChat(message);
          }
        },
        onAddAI: () => {
          const totalPlayers = (this.currentRoom.players?.length || 0) + (this.currentRoom.aiPlayers?.length || 0);
          const maxPlayers = this.currentRoom.maxPlayers || 10;

          if (totalPlayers >= maxPlayers) {
            showToast('已达到人数上限');
            return;
          }

          const aiCount = (this.currentRoom.aiPlayers?.length || 0) + 1;
          const aiPlayer = {
            id: `ai-${Date.now()}-${aiCount}`,
            nickname: `AI 玩家 ${aiCount}`,
            isHost: false,
            isAI: true
          };

          // WaitingRoom.addAIPlayer handles adding to the room's aiPlayers array
          // (room object is shared by reference)
          if (this.currentView instanceof WaitingRoom) {
            this.currentView.addAIPlayer(aiPlayer);
            this.currentView.addSystemMessage(`AI 玩家 ${aiCount} 已加入`);
          } else {
            // Fallback for non-WaitingRoom contexts
            if (!this.currentRoom.aiPlayers) this.currentRoom.aiPlayers = [];
            this.currentRoom.aiPlayers.push(aiPlayer);
          }

          // Sync AI players to server for other players
          if (this.network?.isConnected()) {
            this.network.send('AI_PLAYER_UPDATE', {
              aiPlayers: this.currentRoom.aiPlayers || []
            });
          }
        },
        onRemoveAI: () => {
          if (!this.currentRoom.aiPlayers || this.currentRoom.aiPlayers.length === 0) {
            showToast('没有 AI 玩家可移除');
            return;
          }

          // WaitingRoom.removeLastAIPlayer handles removing from the room's aiPlayers array
          // (room object is shared by reference)
          if (this.currentView instanceof WaitingRoom) {
            const removed = this.currentView.removeLastAIPlayer();
            if (removed) {
              this.currentView.addSystemMessage(`${removed.nickname} 已移除`);
            }
          } else {
            // Fallback for non-WaitingRoom contexts
            this.currentRoom.aiPlayers.pop();
          }

          // Sync AI players to server for other players
          if (this.network?.isConnected()) {
            this.network.send('AI_PLAYER_UPDATE', {
              aiPlayers: this.currentRoom.aiPlayers || []
            });
          }
        },
        onSettingsChange: (settings) => {
          // Update local room settings
          this.currentRoom.gameSettings = settings;
          if (!canSyncRoomSettings()) {
            showToast('请等待所有玩家返回房间后再修改设置');
            return;
          }
          // Sync to server for other players (include room metadata)
          if (this.network?.isConnected()) {
            this.network.send('GAME_SETTINGS_UPDATE', {
              gameSettings: {
                ...settings,
                _gameType: this.currentRoom.gameType,
                _maxPlayers: this.currentRoom.maxPlayers
              }
            });
          }
        }
      });

      this.currentView.mount(this.root);

      // Host sends initial GAME_SETTINGS_UPDATE so server persists settings
      // and late-joining players receive them
      if (this._isHost() && this.network?.isConnected() && canSyncRoomSettings()) {
        const settings = this.currentRoom.gameSettings || {};
        this.network.send('GAME_SETTINGS_UPDATE', {
          gameSettings: {
            ...settings,
            _gameType: this.currentRoom.gameType,
            _maxPlayers: this.currentRoom.maxPlayers
          }
        });
      }
    }
  });
}

export default registerAppOnlineRoomMethods;
