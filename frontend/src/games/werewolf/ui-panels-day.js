/**
 * Werewolf UI Day Panels
 * @module games/werewolf/ui-panels-day
 *
 * Day phase panel rendering functions
 */

import { ACTION_TYPES, PHASES, TEAMS } from './index.js';
import {
  TEAM_COLORS,
  ROLE_NAMES,
  escapeHtml,
  createInfoBox,
  createButton,
  getDeathCauseText,
  findPlayer,
  getDisplayName
} from './ui-helpers.js';
import { renderSeerResult } from './ui-panels-night.js';

/**
 * Render day announce panel
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderAnnouncePanel(ctx) {
  const { state, playerId } = ctx;
  const el = document.createElement('div');
  el.className = 'ww-announce-panel';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  const deaths = state.nightDeaths || [];
  const announcements = state.dayAnnouncements || [];

  if (deaths.length === 0) {
    el.appendChild(createInfoBox('昨晚是平安夜，没有人死亡'));
  } else {
    const deathBox = document.createElement('div');
    deathBox.style.cssText = `
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    `;

    deathBox.innerHTML = `
      <div style="
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        margin-bottom: var(--spacing-2);
      ">昨晚死亡的玩家：</div>
    `;

    for (const death of deaths) {
      const player = findPlayer(state.players, death.playerId);
      const causeText = getDeathCauseText(death.cause);
      const row = document.createElement('div');
      row.style.cssText = `
        padding: var(--spacing-1) 0;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
      `;
      row.innerHTML = `
        <span style="color: var(--error-500);">✕</span>
        <span style="font-weight: var(--font-medium);">
          ${getDisplayName(player, playerId, state.seerChecks, death.playerId)}
        </span>
        <span style="color: var(--text-tertiary); font-size: var(--text-sm);">
          (${causeText})
        </span>
      `;
      deathBox.appendChild(row);
    }

    el.appendChild(deathBox);
  }

  // Private seer result
  const seerResult = announcements.find(
    a => a.type === 'seer_result' && a.playerId === playerId
  );
  if (seerResult) {
    el.appendChild(renderSeerResult(ctx, seerResult));
  }

  // Show hunter-shot / last words / first speaker prompt
  if (state.hunterPendingShoot) {
    el.appendChild(createInfoBox('等待猎人开枪...'));
  } else if (state.lastWordsPlayerId) {
    const lastWordsPlayer = findPlayer(state.players, state.lastWordsPlayerId);
    const isMe = state.lastWordsPlayerId === playerId;
    const promptBox = createInfoBox(
      isMe
        ? '请发表你的遗言，完成后点击"结束遗言"'
        : `${getDisplayName(lastWordsPlayer, playerId, state.seerChecks, state.lastWordsPlayerId)} 正在发表遗言...`
    );
    el.appendChild(promptBox);
  } else if (state.awaitingFirstSpeaker) {
    const firstSpeaker = findPlayer(state.players, state.firstSpeakerId);
    const isMe = state.firstSpeakerId === playerId;
    const promptBox = document.createElement('div');
    promptBox.style.cssText = `
      padding: var(--spacing-3);
      background: var(--primary-50);
      border-radius: var(--radius-md);
      border-left: 3px solid var(--primary-500);
    `;
    promptBox.innerHTML = `
      <div style="font-weight: var(--font-semibold); color: var(--primary-700); margin-bottom: var(--spacing-1);">
        ${isMe ? '你是第一位发言人' : `第一位发言人: ${getDisplayName(firstSpeaker, playerId, state.seerChecks, state.firstSpeakerId)}`}
      </div>
      <div style="font-size: var(--text-sm); color: var(--text-secondary);">
        ${isMe ? '点击"开始发言"进入讨论阶段' : '等待第一位发言人开始讨论...'}
      </div>
    `;
    el.appendChild(promptBox);
  }

  return el;
}

/**
 * Render discussion panel with speaker queue
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderDiscussionPanel(ctx) {
  const { state, playerId } = ctx;
  const el = document.createElement('div');
  el.className = 'ww-discussion-panel';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  const queue = state.speakerQueue || [];
  const currentSpeaker = state.currentSpeaker;
  const isTieSpeech = state.voteRound === 2 && state.tiedCandidates?.length > 0;

  // Tie speech header
  if (isTieSpeech) {
    const tieHeader = document.createElement('div');
    tieHeader.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--warning-100);
      border-radius: var(--radius-md);
      color: var(--warning-700);
      font-weight: var(--font-semibold);
      text-align: center;
    `;
    tieHeader.textContent = '平票发言';
    el.appendChild(tieHeader);
  }

  el.appendChild(createInfoBox(
    currentSpeaker === playerId
      ? '轮到你发言了，完成后点击"发言结束"'
      : '等待其他玩家发言...'
  ));

  // Speaker queue list
  const list = document.createElement('div');
  list.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
    padding: var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
  `;

  const listTitle = isTieSpeech ? '平票候选人发言顺序' : '发言顺序';
  list.innerHTML = `
    <div style="
      font-weight: var(--font-semibold);
      color: var(--text-primary);
      margin-bottom: var(--spacing-2);
    ">${listTitle}</div>
  `;

  for (let i = 0; i < queue.length; i++) {
    const speakerId = queue[i];
    const player = findPlayer(state.players, speakerId);
    const isCurrent = speakerId === currentSpeaker;
    const isDone = i < (state.speakerQueue.indexOf(currentSpeaker));

    const row = document.createElement('div');
    row.style.cssText = `
      padding: var(--spacing-1) var(--spacing-2);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      ${isCurrent
        ? 'background: var(--primary-100); border-left: 3px solid var(--primary-500);'
        : ''}
      ${isDone ? 'opacity: 0.5;' : ''}
    `;
    row.innerHTML = `
      <span style="
        width: 20px;
        text-align: center;
        font-size: var(--text-sm);
        color: var(--text-tertiary);
      ">${i + 1}</span>
      <span style="
        color: ${isCurrent ? 'var(--primary-700)' : 'var(--text-primary)'};
        font-weight: ${isCurrent ? 'var(--font-semibold)' : 'var(--font-normal)'};
      ">${getDisplayName(player, playerId, state.seerChecks, speakerId)}</span>
      ${isCurrent ? '<span style="color: var(--primary-500); font-size: var(--text-xs);">发言中</span>' : ''}
      ${isDone ? '<span style="color: var(--text-tertiary); font-size: var(--text-xs);">已发言</span>' : ''}
    `;
    list.appendChild(row);
  }

  el.appendChild(list);
  return el;
}

/**
 * Render vote panel with sequential voting
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderVotePanel(ctx) {
  const { state, playerId, updateSelectionMode } = ctx;
  const el = document.createElement('div');
  el.className = 'ww-vote-panel';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  const voteRound = state.voteRound || 1;
  const tiedCandidates = state.tiedCandidates;
  const currentVoter = state.currentVoter;
  const isMyTurn = currentVoter === playerId;
  const hasVoted = state.votes?.[playerId] !== undefined;
  const isIdiotWithoutVote = (state.roleStates?.idiotRevealedIds || []).includes(playerId);

  // Info text based on state
  let infoText;
  if (isIdiotWithoutVote) {
    infoText = '你已翻牌为白痴，当前无法参与投票，等待其他玩家...';
  } else if (isMyTurn) {
    infoText = voteRound === 2 && tiedCandidates?.length > 0
      ? '轮到你投票了，点击平票候选人的头像进行投票'
      : '轮到你投票了，点击环形布局中的玩家头像选择要放逐的玩家';
  } else if (hasVoted) {
    infoText = '你已投票，等待其他玩家...';
  } else {
    infoText = '等待其他玩家投票...';
  }

  el.appendChild(createInfoBox(infoText));

  // Enable selection mode for voting only when it's my turn
  if (isMyTurn && updateSelectionMode) {
    updateSelectionMode();
  }

  // Show tied candidates indicator
  if (voteRound === 2 && tiedCandidates?.length > 0) {
    const tiedBox = document.createElement('div');
    tiedBox.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--warning-100);
      border-radius: var(--radius-md);
      color: var(--warning-700);
      font-size: var(--text-sm);
    `;
    const names = tiedCandidates
      .map(id => getDisplayName(findPlayer(state.players, id), playerId, state.seerChecks, id))
      .join('、');
    tiedBox.textContent = `平票候选人：${names}`;
    el.appendChild(tiedBox);
  }

  // Voter queue list
  const voterQueue = state.voterQueue || [];
  if (voterQueue.length > 0) {
    const list = document.createElement('div');
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    `;

    list.innerHTML = `
      <div style="
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        margin-bottom: var(--spacing-2);
      ">投票顺序</div>
    `;

    const votes = state.votes || {};
    for (let i = 0; i < voterQueue.length; i++) {
      const voterId = voterQueue[i];
      const player = findPlayer(state.players, voterId);
      const isCurrent = voterId === currentVoter;
      const hasVotedAlready = votes[voterId] !== undefined;
      const voteTarget = votes[voterId];

      const row = document.createElement('div');
      row.style.cssText = `
        padding: var(--spacing-1) var(--spacing-2);
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        ${isCurrent
          ? 'background: var(--primary-100); border-left: 3px solid var(--primary-500);'
          : ''}
        ${hasVotedAlready ? 'opacity: 0.7;' : ''}
      `;

      let statusText = '';
      if (isCurrent) {
        statusText = '<span style="color: var(--primary-500); font-size: var(--text-xs);">投票中</span>';
      } else if (hasVotedAlready) {
        const targetName = voteTarget
          ? getDisplayName(findPlayer(state.players, voteTarget), playerId, state.seerChecks, voteTarget)
          : '弃票';
        statusText = `<span style="color: var(--text-tertiary); font-size: var(--text-xs);">→ ${targetName}</span>`;
      }

      row.innerHTML = `
        <span style="
          width: 20px;
          text-align: center;
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">${i + 1}</span>
        <span style="
          color: ${isCurrent ? 'var(--primary-700)' : 'var(--text-primary)'};
          font-weight: ${isCurrent ? 'var(--font-semibold)' : 'var(--font-normal)'};
          flex: 1;
        ">${getDisplayName(player, playerId, state.seerChecks, voterId)}</span>
        ${statusText}
      `;
      list.appendChild(row);
    }

    el.appendChild(list);
  }

  return el;
}

/**
 * Render ended panel with winner and role reveal
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderEndedPanel(ctx) {
  const { state, playerId } = ctx;
  const el = document.createElement('div');
  el.className = 'ww-ended-panel';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
    align-items: center;
  `;

  // Winner banner
  const winner = state.winner;
  const winnerLabel = winner === TEAMS.WEREWOLF ? '狼人阵营获胜'
    : winner === TEAMS.VILLAGE ? '好人阵营获胜'
      : winner === 'jester' ? '小丑获胜'
        : '游戏结束';
  const winnerColor = TEAM_COLORS[winner] || 'var(--text-primary)';

  const banner = document.createElement('div');
  banner.style.cssText = `
    padding: var(--spacing-4) var(--spacing-6);
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    text-align: center;
    border: 2px solid ${winnerColor};
    width: 100%;
  `;
  banner.innerHTML = `
    <div style="
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      color: ${winnerColor};
    ">${winnerLabel}</div>
  `;
  el.appendChild(banner);

  // Full role reveal table
  const table = document.createElement('div');
  table.style.cssText = `
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
    padding: var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
  `;

  table.innerHTML = `
    <div style="
      font-weight: var(--font-semibold);
      color: var(--text-primary);
      margin-bottom: var(--spacing-2);
    ">玩家身份揭示</div>
  `;

  const players = state.players || [];
  for (const player of players) {
    const roleName = ROLE_NAMES[player.roleId] || player.roleId || '?';
    const teamColor = TEAM_COLORS[player.team] || 'var(--text-secondary)';
    const isAlive = player.alive;

    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      padding: var(--spacing-1) var(--spacing-2);
      border-radius: var(--radius-sm);
      ${!isAlive ? 'opacity: 0.6;' : ''}
    `;
    row.innerHTML = `
      <span style="
        width: 8px; height: 8px;
        border-radius: var(--radius-full);
        background: ${isAlive ? 'var(--success-500)' : 'var(--error-500)'};
        display: inline-block;
        flex-shrink: 0;
      "></span>
      <span style="
        flex: 1;
        color: var(--text-primary);
      ">${getDisplayName(player, playerId, {})}</span>
      <span style="
        color: ${teamColor};
        font-weight: var(--font-medium);
        font-size: var(--text-sm);
      ">${roleName}</span>
      <span style="
        font-size: var(--text-xs);
        color: var(--text-tertiary);
      ">${isAlive ? '存活' : '死亡'}</span>
    `;
    table.appendChild(row);
  }

  el.appendChild(table);
  return el;
}

/**
 * Render hunter shoot panel
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderHunterShoot(ctx) {
  const el = document.createElement('div');
  el.className = 'ww-hunter-shoot';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  el.appendChild(createInfoBox('你是猎人！点击环形布局中的玩家头像选择开枪目标'));

  return el;
}

/**
 * Render dead chat box
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderDeadChat(ctx) {
  const { state, playerId, onAction } = ctx;
  const el = document.createElement('div');
  el.className = 'ww-dead-chat';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    padding: var(--spacing-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border-top: 2px solid var(--neutral-300);
  `;

  // Header
  const header = document.createElement('h4');
  header.style.cssText = `
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    font-weight: var(--font-semibold);
  `;
  header.textContent = '亡者聊天';
  el.appendChild(header);

  // Messages container
  const messages = document.createElement('div');
  messages.className = 'ww-dead-chat__messages';
  messages.style.cssText = `
    max-height: 150px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  `;

  const chatMessages = state.deadChat || [];
  if (chatMessages.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = `
      color: var(--text-tertiary);
      font-size: var(--text-sm);
      text-align: center;
      padding: var(--spacing-2);
    `;
    empty.textContent = '暂无消息';
    messages.appendChild(empty);
  } else {
    for (const msg of chatMessages) {
      const msgEl = document.createElement('div');
      msgEl.className = 'ww-dead-chat__msg';
      msgEl.style.cssText = `
        font-size: var(--text-sm);
        display: flex;
        gap: var(--spacing-1);
      `;
      msgEl.innerHTML = `
        <span class="ww-dead-chat__name" style="
          color: var(--primary-500);
          font-weight: var(--font-medium);
          flex-shrink: 0;
        ">${msg.playerId === playerId && msg.nickname
            ? `${msg.nickname}（我）` : msg.nickname}:</span>
        <span class="ww-dead-chat__text" style="
          color: var(--text-primary);
          word-break: break-all;
        ">${escapeHtml(msg.message)}</span>
      `;
      messages.appendChild(msgEl);
    }
  }

  el.appendChild(messages);

  // Input area (only for dead viewers, not in ended phase)
  const viewer = findPlayer(state.players, playerId);
  if (viewer && !viewer.alive && state.phase !== PHASES.ENDED) {
    const inputRow = document.createElement('div');
    inputRow.className = 'ww-dead-chat__input';
    inputRow.style.cssText = `
      display: flex;
      gap: var(--spacing-2);
    `;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '发送消息...';
    input.style.cssText = `
      flex: 1;
      padding: var(--spacing-1) var(--spacing-2);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      font-size: var(--text-sm);
      background: var(--bg-primary);
      color: var(--text-primary);
      outline: none;
    `;

    const sendBtn = document.createElement('button');
    sendBtn.textContent = '发送';
    sendBtn.style.cssText = `
      padding: var(--spacing-1) var(--spacing-3);
      background: var(--primary-500);
      color: var(--text-inverse);
      border: none;
      border-radius: var(--radius-sm);
      font-size: var(--text-sm);
      cursor: pointer;
    `;

    const sendMessage = () => {
      const message = input.value.trim();
      if (message && onAction) {
        onAction({
          actionType: ACTION_TYPES.DEAD_CHAT,
          actionData: { message }
        });
        input.value = '';
      }
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);
    el.appendChild(inputRow);
  }

  // Auto-scroll to bottom
  requestAnimationFrame(() => {
    messages.scrollTop = messages.scrollHeight;
  });

  return el;
}

/**
 * Render captain register panel (上警阶段)
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderCaptainRegisterPanel(ctx) {
  const { state, playerId } = ctx;
  const el = document.createElement('div');
  el.className = 'ww-captain-register-panel';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  const viewer = findPlayer(state.players, playerId);
  const isAlive = viewer?.alive !== false;
  const hasRegistered = (state.captainCandidates || []).includes(playerId);

  // Info prompt
  if (!isAlive) {
    el.appendChild(createInfoBox('你已死亡，无法参与警长竞选'));
  } else if (hasRegistered) {
    el.appendChild(createInfoBox('你已上警，等待其他玩家...'));
  } else {
    el.appendChild(createInfoBox('警长竞选开始！点击下方按钮上警参与竞选'));
  }

  // Current candidates list
  const candidates = state.captainCandidates || [];
  if (candidates.length > 0) {
    const list = document.createElement('div');
    list.style.cssText = `
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    `;
    list.innerHTML = `
      <div style="
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        margin-bottom: var(--spacing-2);
      ">已上警候选人（${candidates.length}人）</div>
    `;

    for (const cid of candidates) {
      const player = findPlayer(state.players, cid);
      const row = document.createElement('div');
      row.style.cssText = `
        padding: var(--spacing-1) var(--spacing-2);
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
      `;
      row.innerHTML = `
        <span style="
          width: 8px; height: 8px;
          border-radius: var(--radius-full);
          background: var(--primary-500);
          display: inline-block;
        "></span>
        <span style="color: var(--text-primary);">
          ${getDisplayName(player, playerId, state.seerChecks, cid)}
        </span>
      `;
      list.appendChild(row);
    }

    el.appendChild(list);
  }

  return el;
}

/**
 * Render captain speech panel (竞选发言阶段)
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderCaptainSpeechPanel(ctx) {
  const { state, playerId } = ctx;
  const el = document.createElement('div');
  el.className = 'ww-captain-speech-panel';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  const isRunoff = state.phase === PHASES.CAPTAIN_RUNOFF_SPEECH;
  const currentSpeaker = state.captainCurrentSpeaker;
  const isMyTurn = currentSpeaker === playerId;

  // Runoff header
  if (isRunoff) {
    const header = document.createElement('div');
    header.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--warning-100);
      border-radius: var(--radius-md);
      color: var(--warning-700);
      font-weight: var(--font-semibold);
      text-align: center;
    `;
    header.textContent = '平票二次发言';
    el.appendChild(header);
  }

  // Info prompt
  el.appendChild(createInfoBox(
    isMyTurn
      ? '轮到你竞选发言了，完成后点击"发言结束"'
      : '等待候选人发言...'
  ));

  // Speaker queue
  const queue = state.captainSpeakerQueue || [];
  if (queue.length > 0) {
    const list = document.createElement('div');
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    `;

    list.innerHTML = `
      <div style="
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        margin-bottom: var(--spacing-2);
      ">${isRunoff ? '平票候选人发言顺序' : '候选人发言顺序'}</div>
    `;

    for (let i = 0; i < queue.length; i++) {
      const speakerId = queue[i];
      const player = findPlayer(state.players, speakerId);
      const isCurrent = speakerId === currentSpeaker;
      const isDone = i < queue.indexOf(currentSpeaker);
      const isCandidate = (state.captainCandidates || []).includes(speakerId);

      const row = document.createElement('div');
      row.style.cssText = `
        padding: var(--spacing-1) var(--spacing-2);
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        ${isCurrent
          ? 'background: var(--primary-100); border-left: 3px solid var(--primary-500);'
          : ''}
        ${isDone ? 'opacity: 0.5;' : ''}
        ${!isCandidate ? 'text-decoration: line-through; opacity: 0.4;' : ''}
      `;
      row.innerHTML = `
        <span style="
          width: 20px;
          text-align: center;
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">${i + 1}</span>
        <span style="
          color: ${isCurrent ? 'var(--primary-700)' : 'var(--text-primary)'};
          font-weight: ${isCurrent ? 'var(--font-semibold)' : 'var(--font-normal)'};
        ">${getDisplayName(player, playerId, state.seerChecks, speakerId)}</span>
        ${isCurrent ? '<span style="color: var(--primary-500); font-size: var(--text-xs);">发言中</span>' : ''}
        ${isDone ? '<span style="color: var(--text-tertiary); font-size: var(--text-xs);">已发言</span>' : ''}
        ${!isCandidate ? '<span style="color: var(--warning-500); font-size: var(--text-xs);">已退水</span>' : ''}
      `;
      list.appendChild(row);
    }

    el.appendChild(list);
  }

  return el;
}

/**
 * Render captain vote panel (竞选投票阶段)
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderCaptainVotePanel(ctx) {
  const { state, playerId, updateSelectionMode } = ctx;
  const el = document.createElement('div');
  el.className = 'ww-captain-vote-panel';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  const isRunoff = state.phase === PHASES.CAPTAIN_RUNOFF_VOTE;
  const currentVoter = state.captainCurrentVoter;
  const isMyTurn = currentVoter === playerId;
  const hasVoted = state.captainVotes?.[playerId] !== undefined;

  // Runoff header
  if (isRunoff) {
    const header = document.createElement('div');
    header.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--warning-100);
      border-radius: var(--radius-md);
      color: var(--warning-700);
      font-weight: var(--font-semibold);
      text-align: center;
    `;
    header.textContent = '平票二次投票';
    el.appendChild(header);
  }

  // Info prompt
  let infoText;
  if (isMyTurn) {
    infoText = '轮到你投票了，点击环形布局中的候选人头像进行投票';
  } else if (hasVoted) {
    infoText = '你已投票，等待其他玩家...';
  } else {
    infoText = '等待其他玩家投票...';
  }
  el.appendChild(createInfoBox(infoText));

  if (isMyTurn && updateSelectionMode) {
    updateSelectionMode();
  }

  // Candidates list
  const candidates = isRunoff
    ? (state.captainRunoffCandidates || [])
    : (state.captainCandidates || []);
  if (candidates.length > 0) {
    const candBox = document.createElement('div');
    candBox.style.cssText = `
      padding: var(--spacing-2) var(--spacing-3);
      background: var(--primary-50);
      border-radius: var(--radius-md);
      border-left: 3px solid var(--primary-500);
    `;
    const names = candidates
      .map(id => getDisplayName(findPlayer(state.players, id), playerId, state.seerChecks, id))
      .join('、');
    candBox.innerHTML = `
      <div style="font-weight: var(--font-semibold); color: var(--primary-700); margin-bottom: var(--spacing-1);">
        候选人
      </div>
      <div style="color: var(--text-primary); font-size: var(--text-sm);">${names}</div>
    `;
    el.appendChild(candBox);
  }

  // Voter queue
  const voterQueue = state.captainVoterQueue || [];
  if (voterQueue.length > 0) {
    const list = document.createElement('div');
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: var(--spacing-1);
      padding: var(--spacing-3);
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
    `;

    list.innerHTML = `
      <div style="
        font-weight: var(--font-semibold);
        color: var(--text-primary);
        margin-bottom: var(--spacing-2);
      ">投票顺序</div>
    `;

    const votes = state.captainVotes || {};
    for (let i = 0; i < voterQueue.length; i++) {
      const voterId = voterQueue[i];
      const player = findPlayer(state.players, voterId);
      const isCurrent = voterId === currentVoter;
      const hasVotedAlready = votes[voterId] !== undefined;
      const voteTarget = votes[voterId];

      const row = document.createElement('div');
      row.style.cssText = `
        padding: var(--spacing-1) var(--spacing-2);
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        ${isCurrent
          ? 'background: var(--primary-100); border-left: 3px solid var(--primary-500);'
          : ''}
        ${hasVotedAlready ? 'opacity: 0.7;' : ''}
      `;

      let statusText = '';
      if (isCurrent) {
        statusText = '<span style="color: var(--primary-500); font-size: var(--text-xs);">投票中</span>';
      } else if (hasVotedAlready) {
        const targetName = voteTarget
          ? getDisplayName(findPlayer(state.players, voteTarget), playerId, state.seerChecks, voteTarget)
          : '弃票';
        statusText = `<span style="color: var(--text-tertiary); font-size: var(--text-xs);">→ ${targetName}</span>`;
      }

      row.innerHTML = `
        <span style="
          width: 20px;
          text-align: center;
          font-size: var(--text-sm);
          color: var(--text-tertiary);
        ">${i + 1}</span>
        <span style="
          color: ${isCurrent ? 'var(--primary-700)' : 'var(--text-primary)'};
          font-weight: ${isCurrent ? 'var(--font-semibold)' : 'var(--font-normal)'};
          flex: 1;
        ">${getDisplayName(player, playerId, state.seerChecks, voterId)}</span>
        ${statusText}
      `;
      list.appendChild(row);
    }

    el.appendChild(list);
  }

  return el;
}

/**
 * Render captain transfer panel (警徽移交阶段)
 * @param {Object} ctx - Rendering context
 * @returns {HTMLElement}
 */
export function renderCaptainTransferPanel(ctx) {
  const { state, playerId } = ctx;
  const el = document.createElement('div');
  el.className = 'ww-captain-transfer-panel';
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  `;

  const isCaptain = state.captainPlayerId === playerId;

  if (isCaptain) {
    el.appendChild(createInfoBox(
      '你是警长，请选择一名存活玩家移交警徽，或选择撕毁警徽'
    ));
  } else {
    const captain = findPlayer(state.players, state.captainPlayerId);
    el.appendChild(createInfoBox(
      `等待警长 ${getDisplayName(captain, playerId, state.seerChecks, state.captainPlayerId)} 移交警徽...`
    ));
  }

  return el;
}

export default {
  renderAnnouncePanel,
  renderDiscussionPanel,
  renderVotePanel,
  renderEndedPanel,
  renderHunterShoot,
  renderDeadChat,
  renderCaptainRegisterPanel,
  renderCaptainSpeechPanel,
  renderCaptainVotePanel,
  renderCaptainTransferPanel
};
