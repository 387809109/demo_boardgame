/**
 * Chat Panel Component
 * AI rule Q&A chat interface in a modal panel
 * @module components/chat-panel
 */

import {
  sendChatMessage, isApiConfigured, ApiError
} from '../utils/api-client.js';
import { createSpinner } from './loading.js';

/**
 * Chat Panel for AI-powered board game rule Q&A
 */
export class ChatPanel {
  constructor() {
    this._backdrop = null;
    this._container = null;
    this._messagesEl = null;
    this._inputEl = null;
    this._sendBtn = null;
    this._isOpen = false;
    this._sessionId = null;
    this._messages = [];
    this._sending = false;

    this._init();
  }

  /**
   * Initialize panel DOM
   * @private
   */
  _init() {
    // Backdrop
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'chat-panel-backdrop';
    this._backdrop.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: var(--bg-overlay);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal);
      animation: fadeIn var(--transition-fast) forwards;
    `;

    // Container
    this._container = document.createElement('div');
    this._container.className = 'chat-panel-container';
    this._container.style.cssText = `
      background: var(--bg-primary);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-xl);
      width: 90vw;
      max-width: 600px;
      height: 80vh;
      max-height: 700px;
      display: flex;
      flex-direction: column;
      animation: slideUp var(--transition-base) forwards;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-4) var(--spacing-6);
      border-bottom: 1px solid var(--border-light);
      flex-shrink: 0;
    `;

    const titleArea = document.createElement('div');
    titleArea.style.cssText = `
      display: flex; align-items: center; gap: var(--spacing-3);
    `;

    const title = document.createElement('h3');
    title.textContent = '规则问答';
    title.style.cssText = `
      margin: 0;
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
    `;
    titleArea.appendChild(title);

    // New chat button
    const newChatBtn = document.createElement('button');
    newChatBtn.className = 'btn btn-ghost btn-sm';
    newChatBtn.textContent = '新对话';
    newChatBtn.style.cssText = `
      font-size: var(--text-xs);
      padding: var(--spacing-1) var(--spacing-2);
    `;
    newChatBtn.addEventListener('click', () => this._newChat());
    titleArea.appendChild(newChatBtn);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      background: none; border: none;
      font-size: var(--text-2xl);
      color: var(--text-secondary);
      cursor: pointer; padding: 0; line-height: 1;
    `;
    closeBtn.addEventListener('click', () => this.hide());

    header.appendChild(titleArea);
    header.appendChild(closeBtn);

    // Messages area
    this._messagesEl = document.createElement('div');
    this._messagesEl.className = 'chat-messages';
    this._messagesEl.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: var(--spacing-4) var(--spacing-6);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-3);
    `;

    // Input area
    const inputArea = document.createElement('div');
    inputArea.style.cssText = `
      display: flex;
      gap: var(--spacing-2);
      padding: var(--spacing-4) var(--spacing-6);
      border-top: 1px solid var(--border-light);
      flex-shrink: 0;
    `;

    this._inputEl = document.createElement('input');
    this._inputEl.type = 'text';
    this._inputEl.className = 'input';
    this._inputEl.placeholder = '输入桌游规则问题...';
    this._inputEl.maxLength = 1000;
    this._inputEl.style.cssText = 'flex: 1;';
    this._inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._send();
      }
    });

    this._sendBtn = document.createElement('button');
    this._sendBtn.className = 'btn btn-primary btn-sm';
    this._sendBtn.textContent = '发送';
    this._sendBtn.addEventListener('click', () => this._send());

    inputArea.appendChild(this._inputEl);
    inputArea.appendChild(this._sendBtn);

    // Assemble
    this._container.appendChild(header);
    this._container.appendChild(this._messagesEl);
    this._container.appendChild(inputArea);
    this._backdrop.appendChild(this._container);
    document.body.appendChild(this._backdrop);

    // Close on backdrop click
    this._backdrop.addEventListener('click', (e) => {
      if (e.target === this._backdrop) this.hide();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._isOpen) this.hide();
    });

    // Show welcome
    this._renderWelcome();
  }

  /**
   * Show the panel
   */
  show() {
    this._backdrop.style.display = 'flex';
    this._isOpen = true;
    document.body.style.overflow = 'hidden';
    this._inputEl.focus();
  }

  /**
   * Hide the panel
   */
  hide() {
    this._backdrop.style.display = 'none';
    this._isOpen = false;
    document.body.style.overflow = '';
  }

  /**
   * Check if panel is open
   * @returns {boolean}
   */
  isOpen() {
    return this._isOpen;
  }

  /**
   * Start a new chat session
   * @private
   */
  _newChat() {
    this._sessionId = null;
    this._messages = [];
    this._renderWelcome();
    this._inputEl.value = '';
    this._inputEl.focus();
  }

  /**
   * Send a message
   * @private
   */
  async _send() {
    const text = this._inputEl.value.trim();
    if (!text || this._sending) return;

    if (!isApiConfigured()) {
      this._appendSystem('API 未配置。请在 .env 中设置 VITE_API_URL');
      return;
    }

    // Add user message
    this._messages.push({ role: 'user', content: text });
    this._appendBubble('user', text);
    this._inputEl.value = '';

    // Show typing indicator
    this._sending = true;
    this._setSendEnabled(false);
    const typingEl = this._appendTyping();

    try {
      const result = await sendChatMessage(text, this._sessionId);
      const { sessionId, reply } = result.data;
      this._sessionId = sessionId;

      // Remove typing, add reply
      typingEl.remove();
      this._messages.push({ role: 'assistant', content: reply });
      this._appendBubble('assistant', reply);
    } catch (err) {
      typingEl.remove();
      const msg = err instanceof ApiError
        ? this._mapErrorMessage(err)
        : '网络错误，请检查连接';
      this._appendSystem(msg);
    } finally {
      this._sending = false;
      this._setSendEnabled(true);
      this._inputEl.focus();
    }
  }

  /**
   * Map API error to user-friendly message
   * @param {ApiError} err
   * @returns {string}
   * @private
   */
  _mapErrorMessage(err) {
    const map = {
      AI_NOT_CONFIGURED: 'AI 服务未配置，请联系管理员',
      AI_SERVICE_ERROR: 'AI 服务暂时不可用，请稍后重试',
      SESSION_TOKEN_LIMIT: '本次对话已达到限制，请开始新对话',
      RATE_LIMIT_EXCEEDED: '请求过于频繁，请稍后再试',
      SESSION_NOT_FOUND: '对话已过期，已自动开始新对话',
    };
    if (err.code === 'SESSION_NOT_FOUND') {
      this._sessionId = null;
    }
    return map[err.code] || `请求失败: ${err.message}`;
  }

  /**
   * Render welcome state
   * @private
   */
  _renderWelcome() {
    this._messagesEl.innerHTML = '';

    const welcome = document.createElement('div');
    welcome.style.cssText = `
      text-align: center;
      padding: var(--spacing-8) var(--spacing-4);
      color: var(--text-secondary);
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--spacing-3);
    `;

    welcome.innerHTML = `
      <div style="font-size: 48px;">🎲</div>
      <div style="font-size: var(--text-lg); font-weight: var(--font-semibold);
                  color: var(--text-primary);">
        桌游规则问答助手
      </div>
      <div style="font-size: var(--text-sm); max-width: 320px; line-height: 1.6;">
        我可以回答关于桌游规则的问题，例如：
      </div>
      <div style="
        display: flex; flex-direction: column; gap: var(--spacing-2);
        width: 100%; max-width: 320px;
      ">
        ${this._renderSuggestion('UNO 的出牌规则是什么？')}
        ${this._renderSuggestion('狼人杀中预言家的技能如何使用？')}
        ${this._renderSuggestion('UNO 万能牌可以在什么时候出？')}
      </div>
    `;

    this._messagesEl.appendChild(welcome);

    // Bind suggestion clicks
    welcome.querySelectorAll('.chat-suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        this._inputEl.value = btn.dataset.text;
        this._send();
      });
    });
  }

  /**
   * Render a suggestion button HTML
   * @param {string} text
   * @returns {string}
   * @private
   */
  _renderSuggestion(text) {
    return `
      <button class="chat-suggestion" data-text="${text}" style="
        background: var(--bg-secondary);
        border: 1px solid var(--border-light);
        border-radius: var(--radius-base);
        padding: var(--spacing-2) var(--spacing-3);
        font-size: var(--text-sm);
        color: var(--text-primary);
        cursor: pointer;
        text-align: left;
        transition: background var(--transition-fast);
      ">${text}</button>
    `;
  }

  /**
   * Append a chat bubble
   * @param {'user'|'assistant'} role
   * @param {string} content
   * @private
   */
  _appendBubble(role, content) {
    // Clear welcome if first message
    if (this._messages.length === 1) {
      this._messagesEl.innerHTML = '';
    }

    const isUser = role === 'user';
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      display: flex;
      justify-content: ${isUser ? 'flex-end' : 'flex-start'};
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      max-width: 80%;
      padding: var(--spacing-3) var(--spacing-4);
      border-radius: var(--radius-lg);
      font-size: var(--text-sm);
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      ${isUser
        ? `background: var(--primary-500); color: white;
           border-bottom-right-radius: var(--radius-sm);`
        : `background: var(--bg-secondary); color: var(--text-primary);
           border: 1px solid var(--border-light);
           border-bottom-left-radius: var(--radius-sm);`
      }
    `;
    bubble.textContent = content;

    wrapper.appendChild(bubble);
    this._messagesEl.appendChild(wrapper);
    this._scrollToBottom();
  }

  /**
   * Append a system/error message
   * @param {string} message
   * @private
   */
  _appendSystem(message) {
    const el = document.createElement('div');
    el.style.cssText = `
      text-align: center;
      padding: var(--spacing-2) var(--spacing-4);
      font-size: var(--text-xs);
      color: var(--error-500);
      background: var(--error-50, #fef2f2);
      border-radius: var(--radius-base);
    `;
    el.textContent = message;
    this._messagesEl.appendChild(el);
    this._scrollToBottom();
  }

  /**
   * Append typing indicator and return the element for removal
   * @returns {HTMLElement}
   * @private
   */
  _appendTyping() {
    const wrapper = document.createElement('div');
    wrapper.className = 'chat-typing';
    wrapper.style.cssText = `
      display: flex;
      justify-content: flex-start;
      align-items: center;
      gap: var(--spacing-2);
    `;

    const bubble = document.createElement('div');
    bubble.style.cssText = `
      padding: var(--spacing-3) var(--spacing-4);
      background: var(--bg-secondary);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-lg);
      border-bottom-left-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
    `;

    bubble.appendChild(createSpinner('14px'));

    const text = document.createElement('span');
    text.textContent = '思考中...';
    text.style.cssText = `
      font-size: var(--text-xs);
      color: var(--text-tertiary);
    `;
    bubble.appendChild(text);

    wrapper.appendChild(bubble);
    this._messagesEl.appendChild(wrapper);
    this._scrollToBottom();
    return wrapper;
  }

  /**
   * Enable/disable send button and input
   * @param {boolean} enabled
   * @private
   */
  _setSendEnabled(enabled) {
    this._sendBtn.disabled = !enabled;
    this._inputEl.disabled = !enabled;
    this._sendBtn.style.opacity = enabled ? '1' : '0.5';
  }

  /**
   * Scroll messages to bottom
   * @private
   */
  _scrollToBottom() {
    requestAnimationFrame(() => {
      this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
    });
  }
}

// Singleton
let panelInstance = null;

/**
 * Get or create chat panel instance
 * @returns {ChatPanel}
 */
export function getChatPanel() {
  if (!panelInstance) {
    panelInstance = new ChatPanel();
  }
  return panelInstance;
}

/**
 * Show chat panel
 */
export function showChatPanel() {
  getChatPanel().show();
}

/**
 * Hide chat panel
 */
export function hideChatPanel() {
  getChatPanel().hide();
}

export default ChatPanel;
