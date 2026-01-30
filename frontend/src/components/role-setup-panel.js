/**
 * Role Setup Panel Component
 * @module components/role-setup-panel
 *
 * Reusable per-role count editor/display for games with role-based setup
 * (e.g. Werewolf). Detects role setup via gameConfig.defaultRoleCounts.
 */

/** Tier display labels */
const TIER_LABELS = {
  p0: '核心角色',
  p1: '进阶角色',
  p2: '扩展角色',
  p3: '稀有角色'
};

/** Team color CSS variable mapping */
const TEAM_COLORS = {
  werewolf: 'var(--error-500)',
  village: 'var(--success-500)',
  neutral: 'var(--warning-500)'
};

/**
 * Parse defaultRoleCounts to get the preset for the smallest player range
 * @param {Object} defaultRoleCounts - Range-keyed presets e.g. {"6-7": {...}, "8-9": {...}}
 * @returns {Object} The preset counts for the smallest range
 */
function getSmallestPreset(defaultRoleCounts) {
  const keys = Object.keys(defaultRoleCounts);
  if (keys.length === 0) return {};
  return { ...defaultRoleCounts[keys[0]] };
}

/**
 * Build a flat role map from tiered config.roles
 * @param {Object} roles - { p0: { roleId: roleObj, ... }, p1: {...}, ... }
 * @returns {Map<string, Object>} roleId -> role definition
 */
function buildRoleMap(roles) {
  const map = new Map();
  for (const tier of Object.values(roles || {})) {
    for (const [id, role] of Object.entries(tier)) {
      map.set(id, role);
    }
  }
  return map;
}

/**
 * Role Setup Panel - Display and edit per-role counts
 */
export class RoleSetupPanel {
  /**
   * @param {Object} options
   * @param {Object} options.roles - config.roles (tiers p0/p1/p2/p3)
   * @param {Object} options.defaultRoleCounts - config.defaultRoleCounts
   * @param {Object|null} options.roleCounts - Current counts; null = use defaults
   * @param {number} options.minPlayers - Game minimum players
   * @param {number} options.maxPlayers - Game maximum players
   * @param {number} [options.minTotal] - Floor for total (e.g. current humans)
   * @param {boolean} [options.editable=false]
   * @param {boolean} [options.compact=false]
   * @param {Function} [options.onChange] - (roleCounts, total) => void
   */
  constructor(options = {}) {
    this.roles = options.roles || {};
    this.defaultRoleCounts = options.defaultRoleCounts || {};
    this.minPlayers = options.minPlayers || 2;
    this.maxPlayers = options.maxPlayers || 20;
    this.minTotal = options.minTotal ?? this.minPlayers;
    this.editable = options.editable || false;
    this.compact = options.compact || false;
    this.onChange = options.onChange || null;

    this.roleMap = buildRoleMap(this.roles);
    this.roleCounts = this._initRoleCounts(options.roleCounts);
    this.collapsedTiers = new Set(['p1', 'p2', 'p3']);

    this.element = null;
    this._create();
  }

  /**
   * Initialize role counts from provided or default preset
   * @private
   */
  _initRoleCounts(provided) {
    if (provided && Object.keys(provided).length > 0) {
      return { ...provided };
    }
    const preset = getSmallestPreset(this.defaultRoleCounts);
    // Ensure every role in roleMap has an entry (0 if not in preset)
    const counts = {};
    for (const id of this.roleMap.keys()) {
      counts[id] = preset[id] || 0;
    }
    return counts;
  }

  /**
   * Get the current total player count
   * @returns {number}
   */
  getTotal() {
    return Object.values(this.roleCounts).reduce((s, v) => s + v, 0);
  }

  /**
   * Get current role counts
   * @returns {Object}
   */
  getRoleCounts() {
    return { ...this.roleCounts };
  }

  /**
   * Get DOM element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }

  /**
   * External update of role counts (e.g. network sync)
   * @param {Object} counts
   */
  updateRoleCounts(counts) {
    this.roleCounts = { ...counts };
    // Ensure every role in roleMap has an entry
    for (const id of this.roleMap.keys()) {
      if (this.roleCounts[id] === undefined) {
        this.roleCounts[id] = 0;
      }
    }
    this._render();
  }

  /**
   * Update minimum total (floor) - e.g. when players join/leave
   * @param {number} n
   */
  setMinTotal(n) {
    this.minTotal = n;
    if (this.editable) {
      this._updateButtonStates();
      this._updateTotalBar();
    }
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    this.element?.remove();
    this.element = null;
  }

  // --- Private methods ---

  /** @private */
  _create() {
    this.element = document.createElement('div');
    this.element.className = 'role-setup-panel';
    this._render();
  }

  /** @private */
  _render() {
    if (this.compact && !this.editable) {
      this._renderCompact();
    } else {
      this._renderFull();
    }
  }

  /**
   * Render read-only compact layout: only roles with count > 0
   * @private
   */
  _renderCompact() {
    const activeRoles = Object.entries(this.roleCounts)
      .filter(([, count]) => count > 0);

    if (activeRoles.length === 0) {
      this.element.innerHTML = `
        <p style="color: var(--text-tertiary); font-size: var(--text-sm); margin: 0;">
          未配置角色
        </p>
      `;
      return;
    }

    const total = this.getTotal();
    const roleChips = activeRoles.map(([id, count]) => {
      const role = this.roleMap.get(id);
      if (!role) return '';
      const teamColor = TEAM_COLORS[role.team] || 'var(--text-secondary)';
      return `
        <span style="
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: var(--bg-tertiary);
          border-radius: var(--radius-full);
          font-size: var(--text-sm);
          white-space: nowrap;
        ">
          <span style="
            width: 8px; height: 8px;
            border-radius: 50%;
            background: ${teamColor};
            flex-shrink: 0;
          "></span>
          ${role.name} x${count}
        </span>
      `;
    }).join('');

    this.element.innerHTML = `
      <div style="margin-bottom: var(--spacing-2); font-size: var(--text-sm); color: var(--text-secondary);">
        总人数: ${total}
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-1);">
        ${roleChips}
      </div>
    `;
  }

  /**
   * Render full editable/read-only layout with tier groups
   * @private
   */
  _renderFull() {
    const total = this.getTotal();
    const tiers = Object.keys(this.roles);

    const tierGroupsHtml = tiers.map(tier => {
      return this._renderTierGroup(tier);
    }).filter(Boolean).join('');

    this.element.innerHTML = `
      <div class="role-total-bar" style="
        padding: var(--spacing-2) var(--spacing-3);
        margin-bottom: var(--spacing-3);
        background: var(--bg-tertiary);
        border-radius: var(--radius-base);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        text-align: center;
      ">
        ${this._getTotalBarText(total)}
      </div>
      ${tierGroupsHtml}
    `;

    if (this.editable) {
      this._bindEditableEvents();
      this._updateButtonStates();
    }
  }

  /**
   * Get total bar display text with color feedback
   * @private
   */
  _getTotalBarText(total) {
    const inRange = total >= this.minPlayers && total <= this.maxPlayers;
    const belowMin = total < Math.max(this.minPlayers, this.minTotal);
    const color = inRange && !belowMin
      ? 'var(--success-500)'
      : 'var(--error-500)';

    return `
      <span style="color: ${color};">
        总人数: ${total}
      </span>
      <span style="color: var(--text-tertiary);">
        （需要 ${this.minPlayers}~${this.maxPlayers} 人）
      </span>
    `;
  }

  /**
   * Render a tier group (p0, p1, etc.)
   * @private
   */
  _renderTierGroup(tier) {
    const tierRoles = this.roles[tier];
    if (!tierRoles || Object.keys(tierRoles).length === 0) return '';

    const isCollapsed = this.collapsedTiers.has(tier);
    const label = TIER_LABELS[tier] || tier;

    // In read-only mode, only show roles with count > 0
    const roleEntries = Object.entries(tierRoles);
    const visibleEntries = this.editable
      ? roleEntries
      : roleEntries.filter(([id]) => (this.roleCounts[id] || 0) > 0);

    if (!this.editable && visibleEntries.length === 0) return '';

    const rowsHtml = visibleEntries.map(([id, role]) => {
      return this._renderRoleRow(id, role);
    }).join('');

    return `
      <div class="role-tier-group" data-tier="${tier}" style="margin-bottom: var(--spacing-2);">
        <div class="tier-header" data-tier-toggle="${tier}" style="
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-1);
          cursor: pointer;
          user-select: none;
          color: var(--text-secondary);
          font-size: var(--text-sm);
          font-weight: var(--font-medium);
          border-bottom: 1px solid var(--border-light);
        ">
          <span style="
            transition: transform 0.2s;
            transform: rotate(${isCollapsed ? '0deg' : '90deg'});
            font-size: 10px;
          ">&#9654;</span>
          ${label}
        </div>
        <div class="tier-body" style="
          ${isCollapsed ? 'display: none;' : ''}
          padding-left: var(--spacing-2);
        ">
          ${rowsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Render a single role row
   * @private
   */
  _renderRoleRow(id, role) {
    const count = this.roleCounts[id] || 0;
    const teamColor = TEAM_COLORS[role.team] || 'var(--text-secondary)';
    const desc = role.description || '';

    if (this.editable) {
      return `
        <div class="role-row" data-role-id="${id}" style="
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          padding: var(--spacing-2) 0;
          border-bottom: 1px solid var(--border-light);
        ">
          <span style="
            width: 10px; height: 10px;
            border-radius: 50%;
            background: ${teamColor};
            flex-shrink: 0;
          "></span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: var(--text-sm); font-weight: var(--font-medium);">
              ${role.name}
            </div>
            ${desc ? `
              <div style="font-size: var(--text-xs); color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${desc}
              </div>
            ` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: var(--spacing-1); flex-shrink: 0;">
            <button class="btn btn-secondary btn-sm role-minus-btn" data-role="${id}" style="
              width: 28px; height: 28px; padding: 0;
              display: flex; align-items: center; justify-content: center;
              font-size: 16px; line-height: 1;
            ">&minus;</button>
            <span class="role-count" data-role-count="${id}" style="
              min-width: 24px;
              text-align: center;
              font-weight: var(--font-bold);
              font-size: var(--text-sm);
            ">${count}</span>
            <button class="btn btn-secondary btn-sm role-plus-btn" data-role="${id}" style="
              width: 28px; height: 28px; padding: 0;
              display: flex; align-items: center; justify-content: center;
              font-size: 16px; line-height: 1;
            ">+</button>
          </div>
        </div>
      `;
    }

    // Read-only (non-compact) row
    return `
      <div class="role-row" style="
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-2) 0;
        border-bottom: 1px solid var(--border-light);
      ">
        <span style="
          width: 10px; height: 10px;
          border-radius: 50%;
          background: ${teamColor};
          flex-shrink: 0;
        "></span>
        <span style="flex: 1; font-size: var(--text-sm);">${role.name}</span>
        <span style="
          font-weight: var(--font-bold);
          font-size: var(--text-sm);
          min-width: 24px;
          text-align: center;
        ">${count}</span>
      </div>
    `;
  }

  /**
   * Bind events for editable mode
   * @private
   */
  _bindEditableEvents() {
    // Tier collapse/expand toggles
    this.element.querySelectorAll('[data-tier-toggle]').forEach(header => {
      header.addEventListener('click', () => {
        const tier = header.dataset.tierToggle;
        if (this.collapsedTiers.has(tier)) {
          this.collapsedTiers.delete(tier);
        } else {
          this.collapsedTiers.add(tier);
        }
        const group = this.element.querySelector(`.role-tier-group[data-tier="${tier}"]`);
        const body = group?.querySelector('.tier-body');
        const arrow = header.querySelector('span');
        if (body) {
          body.style.display = this.collapsedTiers.has(tier) ? 'none' : '';
        }
        if (arrow) {
          arrow.style.transform = this.collapsedTiers.has(tier)
            ? 'rotate(0deg)' : 'rotate(90deg)';
        }
      });
    });

    // Plus/minus buttons
    this.element.querySelectorAll('.role-minus-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const roleId = btn.dataset.role;
        this._adjustCount(roleId, -1);
      });
    });

    this.element.querySelectorAll('.role-plus-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const roleId = btn.dataset.role;
        this._adjustCount(roleId, 1);
      });
    });
  }

  /**
   * Adjust a role count by delta, with validation
   * @private
   */
  _adjustCount(roleId, delta) {
    const current = this.roleCounts[roleId] || 0;
    const newCount = current + delta;
    if (newCount < 0) return;

    const total = this.getTotal();
    const newTotal = total + delta;

    // Validate
    if (delta < 0) {
      if (newTotal < this.minPlayers) return;
      if (newTotal < this.minTotal) return;
      if (roleId === 'werewolf' && newCount < 1) return;
    }
    if (delta > 0) {
      if (newTotal > this.maxPlayers) return;
    }

    this.roleCounts[roleId] = newCount;

    // Update DOM without full re-render
    const countEl = this.element.querySelector(`[data-role-count="${roleId}"]`);
    if (countEl) countEl.textContent = newCount;

    this._updateTotalBar();
    this._updateButtonStates();

    this.onChange?.(this.getRoleCounts(), this.getTotal());
  }

  /**
   * Update total bar text
   * @private
   */
  _updateTotalBar() {
    const bar = this.element.querySelector('.role-total-bar');
    if (bar) {
      bar.innerHTML = this._getTotalBarText(this.getTotal());
    }
  }

  /**
   * Update +/- button disabled states
   * @private
   */
  _updateButtonStates() {
    const total = this.getTotal();

    this.element.querySelectorAll('.role-minus-btn').forEach(btn => {
      const roleId = btn.dataset.role;
      const count = this.roleCounts[roleId] || 0;
      const disabled = count === 0
        || total - 1 < this.minTotal
        || total - 1 < this.minPlayers
        || (roleId === 'werewolf' && count <= 1);
      btn.disabled = disabled;
    });

    this.element.querySelectorAll('.role-plus-btn').forEach(btn => {
      btn.disabled = total + 1 > this.maxPlayers;
    });
  }
}

export default RoleSetupPanel;
