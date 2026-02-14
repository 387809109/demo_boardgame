/**
 * App reconnect methods
 * @module app/app-reconnect-methods
 */

/**
 * Register reconnect-related methods on App prototype.
 *
 * @param {Function} App - App class constructor
 * @param {Object} deps - External dependencies
 */
export function registerAppReconnectMethods(App, deps) {
  const {
    NetworkClient,
    CloudNetworkClient,
    getSupabaseClient,
    hasGame,
    saveSessionData,
    loadSessionData,
    getModal,
    showLoading,
    hideLoading,
    updateLoadingMessage,
    showNotification,
    showToast,
    RECONNECT_CONTEXT_KEY,
    RECONNECT_RESPONSE_TIMEOUT_MS,
    DEFAULT_RECONNECT_DELAY_MS,
    MAX_RECONNECT_ATTEMPTS,
    RECONNECT_COUNTDOWN_STEP_MS
  } = deps;

  Object.assign(App.prototype, {
    /**
     * Save reconnect context to session storage
     * @private
     */
    _saveReconnectContext(overrides = {}) {
      if (!this.currentRoom?.id || !this.network) {
        return;
      }

      const self = this.currentRoom.players?.find(p => p.id === this.playerId);
      const context = {
        mode: this.mode,
        roomId: this.currentRoom.id,
        playerId: this.playerId,
        sessionId: this.sessionId,
        gameType: this.currentRoom.gameType || 'unknown',
        maxPlayers: this.currentRoom.maxPlayers,
        nickname: self?.nickname || this.currentRoom.nickname || this.config.game.defaultNickname,
        updatedAt: Date.now(),
        ...overrides
      };

      if (this.mode === 'local' && this.network instanceof NetworkClient) {
        context.serverUrl = this.network.serverUrl;
      }

      saveSessionData(RECONNECT_CONTEXT_KEY, context);
    },

    /**
     * Load reconnect context from session storage
     * @private
     */
    _loadReconnectContext() {
      return loadSessionData(RECONNECT_CONTEXT_KEY);
    },

    /**
     * Clear reconnect context and running reconnect timers
     * @private
     */
    _clearReconnectContext() {
      saveSessionData(RECONNECT_CONTEXT_KEY, null);
    },

    /**
     * Cancel pending reconnect timers
     * @private
     */
    _clearReconnectPendingTimers() {
      if (this._reconnectAttemptTimer) {
        clearTimeout(this._reconnectAttemptTimer);
        this._reconnectAttemptTimer = null;
      }
      if (this._reconnectResponseTimer) {
        clearTimeout(this._reconnectResponseTimer);
        this._reconnectResponseTimer = null;
      }
      if (this._reconnectCountdownTimer) {
        clearInterval(this._reconnectCountdownTimer);
        this._reconnectCountdownTimer = null;
      }
    },

    /**
     * Cancel pending reconnect timers and reset reconnect state
     * @private
     */
    _cancelReconnectTimers() {
      this._clearReconnectPendingTimers();
      this._isReconnecting = false;
      this._reconnectAttempts = 0;
      this._reconnectContext = null;
    },

    /**
     * Update reconnect loading text
     * @private
     */
    _updateReconnectLoadingMessage(nextAttempt, secondsLeft) {
      const base = `重连中（第 ${nextAttempt}/${MAX_RECONNECT_ATTEMPTS} 次）`;
      if (secondsLeft > 0) {
        updateLoadingMessage(`${base}，${secondsLeft}s 后重试...`);
      } else {
        updateLoadingMessage(`${base}，正在连接...`);
      }
    },

    /**
     * Schedule the next reconnect attempt with countdown
     * @private
     */
    _scheduleReconnectAttempt(delayMs) {
      if (!this._isReconnecting) return;

      const nextAttempt = this._reconnectAttempts + 1;
      let secondsLeft = Math.max(0, Math.ceil(delayMs / 1000));
      this._updateReconnectLoadingMessage(nextAttempt, secondsLeft);

      if (secondsLeft > 0) {
        this._reconnectCountdownTimer = setInterval(() => {
          if (!this._isReconnecting) return;
          secondsLeft = Math.max(0, secondsLeft - 1);
          this._updateReconnectLoadingMessage(nextAttempt, secondsLeft);
        }, RECONNECT_COUNTDOWN_STEP_MS);
      }

      this._reconnectAttemptTimer = setTimeout(() => {
        this._runReconnectAttempt();
      }, delayMs);
    },

    /**
     * Execute one reconnect attempt
     * @private
     */
    async _runReconnectAttempt() {
      if (!this._isReconnecting || !this._reconnectContext || !this.network) {
        return;
      }

      this._clearReconnectPendingTimers();
      this._reconnectAttempts += 1;
      updateLoadingMessage(`重连中（第 ${this._reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} 次），正在连接...`);

      const ctx = this._reconnectContext;

      try {
        if (this.network instanceof CloudNetworkClient) {
          // Cloud mode: requestReconnect handles subscribe + track + send in one call
          await this.network.connect();
          await this.network.requestReconnect(ctx.roomId);
        } else {
          // Local mode: connect then send reconnect request with sessionId
          await this.network.connect();
          this.network.requestReconnect(ctx.roomId, ctx.sessionId);
        }
        this._reconnectResponseTimer = setTimeout(() => {
          this._handleReconnectTransientFailure('重连请求超时');
        }, RECONNECT_RESPONSE_TIMEOUT_MS);
      } catch (err) {
        this._handleReconnectTransientFailure(err?.message || '连接失败');
      }
    },

    /**
     * Handle retryable reconnect failures
     * @private
     */
    _handleReconnectTransientFailure(reason) {
      if (!this._isReconnecting) return;

      this._clearReconnectPendingTimers();

      if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        this._handleReconnectFailure(reason);
        return;
      }

      const reconnectDelay = this.network?.getReconnectDelay?.() ?? DEFAULT_RECONNECT_DELAY_MS;
      showNotification(`重连失败（${reason}），准备重试`, 'warning', 2000);
      this._scheduleReconnectAttempt(reconnectDelay);
    },

    /**
     * Start reconnect flow from a known reconnect context
     * @private
     * @param {Object} ctx - Reconnect context
     * @param {number} [initialDelayMs=DEFAULT_RECONNECT_DELAY_MS] - Delay before first attempt
     */
    _startReconnectFlow(ctx, initialDelayMs = DEFAULT_RECONNECT_DELAY_MS) {
      if (!this.network) {
        return;
      }

      this._closeResultScreen(true);
      this._clearReconnectPendingTimers();
      this._isReconnecting = true;
      this._reconnectAttempts = 0;
      this._reconnectContext = ctx;
      showLoading('连接中，正在恢复对局...');
      this._scheduleReconnectAttempt(initialDelayMs);
    },

    /**
     * Manual retry reconnect after max attempts
     * @private
     * @param {Object} ctx - Reconnect context
     */
    _retryReconnectFromContext(ctx) {
      if (!ctx?.roomId) {
        showNotification('重连上下文缺失，请手动加入房间', 'warning');
        return;
      }

      const isCloud = ctx.mode === 'cloud';

      if (!isCloud && (!ctx.serverUrl || !ctx.sessionId)) {
        showNotification('重连上下文缺失，请手动加入房间', 'warning');
        return;
      }

      this.mode = isCloud ? 'cloud' : 'local';
      if (ctx.sessionId) {
        this.sessionId = ctx.sessionId;
        saveSessionData('sessionId', this.sessionId);
      }
      saveSessionData(RECONNECT_CONTEXT_KEY, ctx);

      const reconnectGameType = ctx.gameType || 'unknown';
      const reconnectGameConfig = this._getGameConfig(reconnectGameType);
      const reconnectMaxPlayers = Number.parseInt(ctx.maxPlayers, 10);
      this.currentRoom = {
        id: ctx.roomId,
        gameType: reconnectGameType,
        nickname: ctx.nickname || this.config.game.defaultNickname,
        players: [],
        gameConfig: reconnectGameConfig,
        maxPlayers: Number.isFinite(reconnectMaxPlayers) && reconnectMaxPlayers > 0
          ? reconnectMaxPlayers
          : reconnectGameConfig.maxPlayers,
        supportsAI: !!reconnectGameConfig.supportsAI,
        gameSettings: {}
      };

      if (isCloud) {
        this.network = new CloudNetworkClient(getSupabaseClient());
      } else {
        this.network = new NetworkClient(ctx.serverUrl);
      }
      this.network.playerId = this.playerId;
      this._setupNetworkHandlers();
      this._startReconnectFlow(ctx, 0);
    },

    /**
     * Whether current runtime state can attempt reconnect
     * @private
     */
    _canAttemptReconnect() {
      return !!this.network
        && !!this.currentGame
        && !!this.currentRoom?.id;
    },

    /**
     * Attempt reconnect and restore game state snapshot
     * @private
     */
    _attemptReconnect() {
      if (this._isReconnecting || !this.network) {
        return;
      }

      const ctx = this._loadReconnectContext();
      if (!ctx || ctx.playerId !== this.playerId || !ctx.roomId) {
        this._handleReconnectFailure('缺少重连上下文');
        return;
      }

      // Local mode requires sessionId and serverUrl
      if (ctx.mode === 'local' && (!ctx.sessionId || !ctx.serverUrl)) {
        this._handleReconnectFailure('缺少重连上下文');
        return;
      }

      const reconnectDelay = this.network.getReconnectDelay?.() ?? DEFAULT_RECONNECT_DELAY_MS;
      this._startReconnectFlow(ctx, reconnectDelay);
    },

    /**
     * Handle reconnect accepted signal
     * @private
     */
    _handleReconnectAccepted() {
      if (!this._isReconnecting) return;

      this._clearReconnectPendingTimers();
      updateLoadingMessage('重连已通过，正在同步对局快照...');

      // Snapshot is expected next; this fallback prevents indefinite loading.
      if (this._reconnectResponseTimer) {
        clearTimeout(this._reconnectResponseTimer);
      }

      this._reconnectResponseTimer = setTimeout(() => {
        this._cancelReconnectTimers();
        hideLoading();
        showToast('重连成功');
      }, 2000);

      showToast('重连成功，正在同步状态...');
    },

    /**
     * Handle snapshot after reconnect
     * @private
     */
    _handleGameSnapshot(data) {
      const snapshotState = data?.gameState;
      if (!snapshotState || typeof snapshotState !== 'object') {
        if (this._isReconnecting) {
          this._handleReconnectFailure('快照数据无效');
        }
        return;
      }

      const gameType = this.currentRoom?.gameType;
      if (!gameType || !hasGame(gameType)) {
        this._handleReconnectFailure('无法识别游戏类型');
        return;
      }

      const snapshotSettings = data?.gameSettings && typeof data.gameSettings === 'object'
        ? data.gameSettings
        : null;
      const fallbackSettings = snapshotState?.options && typeof snapshotState.options === 'object'
        ? snapshotState.options
        : null;
      const players = snapshotState.players || this.currentRoom?.players || [];
      const settings = snapshotSettings
        || fallbackSettings
        || this.currentRoom?.gameSettings
        || this._currentGameSettings
        || {};
      const gameConfig = this._getGameConfig(gameType);
      const snapshotMaxPlayersRaw = snapshotSettings?._maxPlayers ?? fallbackSettings?._maxPlayers;
      let snapshotMaxPlayers = Number.parseInt(snapshotMaxPlayersRaw, 10);
      if ((!Number.isFinite(snapshotMaxPlayers) || snapshotMaxPlayers <= 0) && settings?.roleCounts) {
        const roleTotal = Object.values(settings.roleCounts).reduce((sum, value) => {
          const count = Number.parseInt(value, 10);
          return Number.isFinite(count) && count > 0 ? sum + count : sum;
        }, 0);
        if (roleTotal > 0) {
          snapshotMaxPlayers = roleTotal;
        }
      }
      if (!Number.isFinite(snapshotMaxPlayers) || snapshotMaxPlayers <= 0) {
        const snapshotPlayerCount = Array.isArray(snapshotState.players) ? snapshotState.players.length : 0;
        if (snapshotPlayerCount > 0) {
          snapshotMaxPlayers = snapshotPlayerCount;
        }
      }

      if (this.currentRoom) {
        this.currentRoom.players = players;
        this.currentRoom.gameType = gameType;
        this.currentRoom.gameConfig = gameConfig;
        this.currentRoom.maxPlayers = Number.isFinite(snapshotMaxPlayers) && snapshotMaxPlayers > 0
          ? snapshotMaxPlayers
          : (this.currentRoom.maxPlayers || gameConfig.maxPlayers);
        this.currentRoom.supportsAI = !!gameConfig.supportsAI;
        if (snapshotSettings || fallbackSettings) {
          this.currentRoom.gameSettings = snapshotSettings || fallbackSettings;
        }
      }
      this._currentGameSettings = settings;

      this._startGame(gameType, players, 'online', settings, snapshotState);
      this._cancelReconnectTimers();
      hideLoading();
      showToast('已恢复到最新对局状态');
    },

    /**
     * Handle reconnect rejected/failed
     * @private
     */
    _handleReconnectFailure(reason = '重连失败') {
      const lastContext = this._reconnectContext || this._loadReconnectContext();
      this._cancelReconnectTimers();
      this._closeResultScreen(true);
      hideLoading();

      const hasValidContext = lastContext && lastContext.roomId
        && (lastContext.mode === 'cloud' || lastContext.serverUrl);

      const prefill = hasValidContext
        ? {
            serverUrl: lastContext.serverUrl || '',
            roomId: lastContext.roomId,
            nickname: lastContext.nickname || this.config.game.defaultNickname
          }
        : null;

      this._clearReconnectContext();
      this.currentRoom = null;
      this.currentGame = null;
      this.showLobby();

      if (prefill) {
        this._joinRoomPrefill = prefill;
        showNotification(`重连失败: ${reason}`, 'error');
        const modal = getModal();
        modal.confirm(
          '重连失败',
          '是否继续使用上次会话恢复对局？',
          { confirmText: '继续重连', cancelText: '稍后' }
        ).then((shouldJoin) => {
          if (shouldJoin) {
            this._retryReconnectFromContext(lastContext);
          }
        });
        return;
      }

      showNotification(`重连失败: ${reason}`, 'error');
    }
  });
}

export default registerAppReconnectMethods;
