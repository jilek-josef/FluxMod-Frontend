import { MAX_AUTOMOD_RULES, MAX_REGEXES, MAX_WORDS } from "./constants.js";
import {
  escapeHtml,
  getGuildIconUrl,
  getGuildId,
  getGuildMeta,
  getRuleId,
  normalizeIdList,
  normalizeAutomodSettings,
  normalizeRule,
  normalizeRulesResponse,
  parseCommaSeparated,
  splitRegexPatterns,
  resolveGuildId,
} from "./helpers.js";

function resolveRuleId(search) {
  const params = new URLSearchParams(search);
  return params.get("rule_id") || params.get("id") || "";
}

const RULE_PRESET_TEMPLATES = {
  "Emoji Caps": {
    name: "Emoji Caps",
    type: "emoji",
    keyword: "",
    allowedKeywords: [],
    severity: 2,
    action: "delete",
    pattern: "(?:<(?:a)?:[a-zA-Z0-9_]{2,32}:[0-9]{17,20}>\\s*){1,}",
  },

  "Caps Lock": {
    name: "Caps Lock",
    type: "caps",
    keyword: "",
    allowedKeywords: [],
    severity: 1,
    action: "warn",
    pattern: "\\b[A-Z]{6,}\\b",
  },

  "Spam Detection": {
    name: "Spam Detection",
    type: "spam",
    keyword: "",
    allowedKeywords: [],
    severity: 2,
    action: "delete",
    pattern: "(.)\\1{6,}|(\\b\\w+\\b)(?:\\s+\\1){3,}",
  },

  "Mention Spam Detection": {
    name: "Mention Spam Detection",
    type: "mention",
    keyword: "",
    allowedKeywords: [],
    severity: 3,
    action: "timeout",
    pattern:
      "(?:<@!?\\d+>|<@&\\d+>|@everyone|@here)(?:\\s*(?:<@!?\\d+>|<@&\\d+>|@everyone|@here)){4,}",
  },

  "Media Filters": {
    name: "Media Filters",
    type: "media",
    keyword: "",
    allowedKeywords: [
      "youtube.com",
      "youtu.be",
      "tenor.com",
      "imgur.com",
      "spotify.com",
    ],
    severity: 1,
    action: "delete",
    pattern:
      "https?:\\/\\/[^\\s]+\\.(?:png|jpe?g|gif|webp|mp4|mov|webm)(?:\\?[^\\s]*)?",
  },

  "Invite Link Detection": {
    name: "Invite Link Detection",
    type: "invite",
    keyword: "",
    allowedKeywords: [],
    severity: 2,
    action: "delete",
    pattern:
      "(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite|fluxer\.gg)\/[A-Za-z0-9]+",
  },

  "URL Spam": {
    name: "URL Spam",
    type: "link",
    keyword: "",
    allowedKeywords: [],
    severity: 2,
    action: "delete",
    pattern:
      "(?:https?:\\/\\/[^\\s]+)(?:\\s*(?:https?:\\/\\/[^\\s]+)){2,}",
  },

  "Excessive Symbols": {
    name: "Excessive Symbols",
    type: "symbols",
    keyword: "",
    allowedKeywords: [],
    severity: 1,
    action: "delete",
    pattern:
      "[!@#$%^&*()_+=\\-\\[\\]{};':\"\\\\|,.<>/?]{8,}",
  },

  "Zalgo / Unicode Spam": {
    name: "Zalgo / Unicode Spam",
    type: "unicode",
    keyword: "",
    allowedKeywords: [],
    severity: 1,
    action: "delete",
    pattern:
      "[\\u0300-\\u036F]{5,}",
  },
};

const RULE_NAME_PRESETS = Object.keys(RULE_PRESET_TEMPLATES);
const RULE_ACTION_OPTIONS = ["no_action", "warn", "delete", "timeout", "mute", "kick", "ban"];
const MAX_STAFF_PING_ROLES = 5;
const RULE_SEVERITY_OPTIONS = [
  { value: 1, label: "Low (log only)" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
];

export function createGuildDashboardController({ backendUrl, appState, defaultImage, navigate }) {
  function formatActionLabel(action) {
    if (action === "no_action") {
      return "No Action";
    }

    return String(action || "")
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function uniqueStrings(values) {
    return Array.from(
      new Set(
        values
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    );
  }

  function applyRulePresets(targetForm, presetNames) {
    if (!targetForm || !Array.isArray(presetNames) || presetNames.length === 0) {
      return false;
    }

    const selectedNames = presetNames.filter((presetName) => Boolean(RULE_PRESET_TEMPLATES[presetName]));
    if (selectedNames.length === 0) {
      return false;
    }

    const mergedKeywords = [];
    const mergedAllowedKeywords = [];
    const mergedPatterns = [];
    let mergedAction = "warn";
    let mergedSeverity = 1;

    selectedNames.forEach((presetName) => {
      const template = RULE_PRESET_TEMPLATES[presetName];
      if (!template) {
        return;
      }

      mergedKeywords.push(...parseCommaSeparated(template.keyword || ""));
      mergedAllowedKeywords.push(...parseCommaSeparated(template.allowedKeywords || []));
      mergedPatterns.push(...splitRegexPatterns(template.pattern || ""));
      mergedAction = String(template.action || mergedAction);
      mergedSeverity = Math.max(mergedSeverity, Number(template.severity || 1));
    });

    targetForm.name =
      selectedNames.length === 1
        ? String(RULE_PRESET_TEMPLATES[selectedNames[0]]?.name || targetForm.name || "")
        : "Combined Presets Rule";
    targetForm.keyword = uniqueStrings(mergedKeywords).join(", ");
    targetForm.allowedKeywords = uniqueStrings(mergedAllowedKeywords).join(", ");
    targetForm.pattern = uniqueStrings(mergedPatterns).join("\n");
    targetForm.action = mergedAction;
    targetForm.severity = Math.max(1, Math.min(3, Number(mergedSeverity || 1)));
    return true;
  }

  function buildPatternForApi(rawPattern) {
    const parts = splitRegexPatterns(rawPattern);
    if (parts.length === 0) {
      return "";
    }

    if (parts.length === 1) {
      return parts[0];
    }

    return parts.map((part) => `(?:${part})`).join("|");
  }

  function captureFocusedInput() {
    const active = document.activeElement;
    if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement)) {
      return null;
    }

    const container = active.closest("form, [data-rule-id], #rule-editor-form, #guild-dashboard-root, #guild-rule-editor-root");
    return {
      id: active.id || "",
      name: active.getAttribute("name") || "",
      type: active instanceof HTMLInputElement ? active.type : "",
      hasEditInputAttr: active.hasAttribute("data-edit-input"),
      containerId: container?.id || "",
      selectionStart:
        active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
          ? active.selectionStart
          : null,
      selectionEnd:
        active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
          ? active.selectionEnd
          : null,
    };
  }

  function restoreFocusedInput(snapshot) {
    if (!snapshot) {
      return;
    }

    let target = null;

    if (snapshot.id) {
      target = document.getElementById(snapshot.id);
    }

    if (!target && snapshot.containerId && snapshot.name) {
      const container = document.getElementById(snapshot.containerId);
      if (container) {
        const selector = snapshot.hasEditInputAttr
          ? `[name="${CSS.escape(snapshot.name)}"][data-edit-input]`
          : `[name="${CSS.escape(snapshot.name)}"]`;
        target = container.querySelector(selector);
      }
    }

    if (!target && snapshot.name) {
      const selector = snapshot.hasEditInputAttr
        ? `[name="${CSS.escape(snapshot.name)}"][data-edit-input]`
        : `[name="${CSS.escape(snapshot.name)}"]`;
      target = document.querySelector(selector);
    }

    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
      return;
    }

    target.focus();

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
      snapshot.selectionStart !== null &&
      snapshot.selectionEnd !== null &&
      snapshot.type !== "number"
    ) {
      try {
        target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
      } catch {
        // Some input types do not support selection ranges.
      }
    }
  }

  function rerenderKeepingInput(renderFn) {
    const snapshot = captureFocusedInput();
    renderFn();
    restoreFocusedInput(snapshot);
  }

  function getInitialState() {
    return {
      automodForm: {
        name: "AutoMod Rule",
        keyword: "",
        allowedKeywords: "",
        pattern: "",
        action: "warn",
        severity: 2,
        threshold: 1,
      },
      statusMessage: "",
      isSubmittingRule: false,
      automodRules: [],
      isLoadingRules: false,
      editingRuleId: "",
      editingRuleForm: {
        name: "",
        keyword: "",
        allowedKeywords: "",
        pattern: "",
        action: "warn",
        severity: 2,
        threshold: 1,
        enabled: true,
        exemptRoleIds: "",
        exemptChannelIds: "",
        exemptUserIds: "",
      },
      editingOriginalForm: null,
      isSavingEdit: false,
      togglingRuleId: "",
      deletingRuleId: "",
      automodSettingsForm: {
        logChannelId: "",
        staffRoleIds: "",
        exemptRoleIds: "",
        exemptChannelIds: "",
        exemptUserIds: "",
      },
      automodSettingsOriginal: {
        logChannelId: "",
        staffRoleIds: "",
        exemptRoleIds: "",
        exemptChannelIds: "",
        exemptUserIds: "",
      },
      isLoadingSettings: false,
      isSavingSettings: false,
      keywordOverrides: {},
      presetSelections: {
        create: [],
        inlineEdit: [],
        editor: [],
      },
    };
  }

  function ensureState() {
    if (!appState.guildDashboardState) {
      appState.guildDashboardState = getInitialState();
    }

    return appState.guildDashboardState;
  }

  function firstDefined(...candidates) {
    for (const candidate of candidates) {
      if (candidate !== undefined && candidate !== null) {
        return candidate;
      }
    }

    return undefined;
  }

  function toRuleEditForm(rule = {}) {
    return {
      name: rule?.name || "",
      keyword: rule?.keyword || "",
      allowedKeywords: normalizeIdList(
        firstDefined(
          rule?.allowed_patterns,
          rule?.allowed_keywords,
          rule?.allowedPatterns,
          rule?.allowedKeywords,
          []
        )
      ),
      pattern: rule?.pattern || "",
      action: rule?.action || "warn",
      severity: Math.max(1, Math.min(3, Number(rule?.severity || 2))),
      threshold: Math.max(1, Number(rule?.threshold || 1)),
      enabled: rule?.enabled !== false,
      exemptRoleIds: normalizeIdList(
        firstDefined(
          rule?.exempt_roles,
          rule?.exempt_role_ids,
          rule?.exemptRoleIds,
          rule?.exemptRoles,
          []
        )
      ),
      exemptChannelIds: normalizeIdList(
        firstDefined(
          rule?.exempt_channels,
          rule?.exempt_channel_ids,
          rule?.exemptChannelIds,
          rule?.exemptChannels,
          []
        )
      ),
      exemptUserIds: normalizeIdList(
        firstDefined(
          rule?.exempt_users,
          rule?.exempt_user_ids,
          rule?.exemptUserIds,
          rule?.exemptUsers,
          []
        )
      ),
    };
  }

  function toComparableEditForm(form = {}) {
    return {
      name: String(form.name || "").trim(),
      keyword: String(form.keyword || "").trim(),
      allowedKeywords: String(form.allowedKeywords || "").trim(),
      pattern: String(form.pattern || "").trim(),
      action: String(form.action || "warn"),
      severity: Math.max(1, Math.min(3, Number(form.severity || 2))),
      threshold: Math.max(1, Number(form.threshold || 1)),
      enabled: Boolean(form.enabled),
      exemptRoleIds: String(form.exemptRoleIds || "").trim(),
      exemptChannelIds: String(form.exemptChannelIds || "").trim(),
      exemptUserIds: String(form.exemptUserIds || "").trim(),
    };
  }

  function hasEditChanges(state) {
    if (!state.editingRuleId || !state.editingOriginalForm) {
      return false;
    }

    const current = toComparableEditForm(state.editingRuleForm);
    const original = toComparableEditForm(state.editingOriginalForm);
    return JSON.stringify(current) !== JSON.stringify(original);
  }

  function getChangedEditFields(state) {
    if (!state.editingRuleId || !state.editingOriginalForm) {
      return [];
    }

    const current = toComparableEditForm(state.editingRuleForm);
    const original = toComparableEditForm(state.editingOriginalForm);
    const changed = [];

    [
      "name",
      "keyword",
      "allowedKeywords",
      "pattern",
      "action",
      "severity",
      "threshold",
      "enabled",
      "exemptRoleIds",
      "exemptChannelIds",
      "exemptUserIds",
    ].forEach((key) => {
      if (current[key] !== original[key]) {
        changed.push(key);
      }
    });

    return changed;
  }

  function formatChangedFieldName(field) {
    switch (field) {
      case "name":
        return "rule name";
      case "keyword":
        return "keywords";
      case "allowedKeywords":
        return "allowed keywords";
      case "pattern":
        return "patterns";
      case "action":
        return "action";
      case "severity":
        return "severity";
      case "threshold":
        return "threshold";
      case "enabled":
        return "status";
      case "exemptRoleIds":
        return "exempt roles";
      case "exemptChannelIds":
        return "exempt channels";
      case "exemptUserIds":
        return "exempt users";
      default:
        return field;
    }
  }

  function normalizeIdSet(value) {
    return Array.from(new Set(parseCommaSeparated(value))).sort();
  }

  function areIdListsEqual(left, right) {
    const leftIds = normalizeIdSet(left);
    const rightIds = normalizeIdSet(right);
    return JSON.stringify(leftIds) === JSON.stringify(rightIds);
  }

  function didSettingsPersist(expected, actual) {
    return (
      String(expected.logChannelId || "").trim() === String(actual.logChannelId || "").trim() &&
      areIdListsEqual(expected.staffRoleIds, actual.staffRoleIds) &&
      areIdListsEqual(expected.exemptRoleIds, actual.exemptRoleIds) &&
      areIdListsEqual(expected.exemptChannelIds, actual.exemptChannelIds) &&
      areIdListsEqual(expected.exemptUserIds, actual.exemptUserIds)
    );
  }

  function toComparableSettingsForm(form = {}) {
    return {
      logChannelId: String(form.logChannelId || "").trim(),
      staffRoleIds: String(form.staffRoleIds || "").trim(),
      exemptRoleIds: String(form.exemptRoleIds || "").trim(),
      exemptChannelIds: String(form.exemptChannelIds || "").trim(),
      exemptUserIds: String(form.exemptUserIds || "").trim(),
    };
  }

  function hasSettingsChanges(state) {
    const current = toComparableSettingsForm(state.automodSettingsForm);
    const original = toComparableSettingsForm(state.automodSettingsOriginal);
    return JSON.stringify(current) !== JSON.stringify(original);
  }

  function canAbandonEdit(state, nextActionLabel = "continue") {
    if (!hasEditChanges(state)) {
      return true;
    }

    return window.confirm(`You have unsaved rule edits. Discard them and ${nextActionLabel}?`);
  }

  function beginEditRule(state, rule) {
    const form = toRuleEditForm(rule);
    state.editingRuleId = getRuleId(rule);
    state.editingRuleForm = { ...form };
    state.editingOriginalForm = { ...form };
  }

  function cancelEditRule(state) {
    state.editingRuleId = "";
    state.editingOriginalForm = null;
  }

  function renderContent() {
    const root = document.getElementById("guild-dashboard-root");
    if (!root) {
      return;
    }

    const user = appState.user || {};
    const guilds = Array.isArray(user?.guilds) ? user.guilds : [];
    const guildId = resolveGuildId(window.location.search);
    const selectedGuild = guilds.find((guild) => getGuildId(guild) === guildId);
    const state = ensureState();

    if (!guildId) {
      root.innerHTML = `<p class="subtitle">Missing guild id. Open a guild from the dashboard list.</p>`;
      return;
    }

    const meta = getGuildMeta(selectedGuild || {});
    const guildName = meta.guildName;
    const guildIconUrl = selectedGuild ? getGuildIconUrl(selectedGuild, defaultImage) : defaultImage;
    const visibleRules = state.automodRules.slice(0, MAX_AUTOMOD_RULES);
    const hasReachedRuleLimit = state.automodRules.length >= MAX_AUTOMOD_RULES;
    const keywordTokens = parseCommaSeparated(state.automodForm.keyword);
    const allowedKeywordTokens = parseCommaSeparated(state.automodForm.allowedKeywords);
    const regexTokens = splitRegexPatterns(state.automodForm.pattern);
    const editKeywordTokens = parseCommaSeparated(state.editingRuleForm.keyword);
    const editAllowedKeywordTokens = parseCommaSeparated(state.editingRuleForm.allowedKeywords);
    const editRegexTokens = splitRegexPatterns(state.editingRuleForm.pattern);
    const createSelectedPresets = Array.isArray(state.presetSelections?.create) ? state.presetSelections.create : [];
    const inlineEditSelectedPresets = Array.isArray(state.presetSelections?.inlineEdit)
      ? state.presetSelections.inlineEdit
      : [];
    const isCreateLimitExceeded = keywordTokens.length > MAX_WORDS || regexTokens.length > MAX_REGEXES;
    const isEditLimitExceeded = editKeywordTokens.length > MAX_WORDS || editRegexTokens.length > MAX_REGEXES;
    const editHasChanges = hasEditChanges(state);
    const changedFields = getChangedEditFields(state);

    const rulesHtml =
      visibleRules.length === 0
        ? `<p class="subtitle">No AutoMod rules yet. Create one above.</p>`
        : `
          <h4 class="automod-rules-title">Existing Rules</h4>
          <div class="automod-rules-grid">
            ${visibleRules
              .map((rule) => {
                const ruleId = getRuleId(rule);
                const isEditing = state.editingRuleId === ruleId;
                const isDeleting = state.deletingRuleId === ruleId;
                const isToggling = state.togglingRuleId === ruleId;

                if (isEditing) {
                  return `
                    <article class="automod-rule-card">
                      <div class="automod-rule-edit" data-rule-id="${escapeHtml(ruleId)}">
                        <div class="automod-edit-meta" aria-live="polite">
                          ${
                            editHasChanges
                              ? `<span class="automod-edit-dirty">Unsaved changes: ${changedFields
                                  .map((field) => formatChangedFieldName(field))
                                  .join(", ")}</span>`
                              : '<span class="automod-edit-clean">No changes yet</span>'
                          }
                        </div>

                        <label class="automod-rule-label">
                          Rule Name
                          <input name="name" value="${escapeHtml(state.editingRuleForm.name)}" data-edit-input />
                        </label>

                        <label class="automod-rule-label automod-preset-control">
                          Presets
                          <div class="preset-toggle-list" role="group" aria-label="Inline edit presets">
                            ${RULE_NAME_PRESETS.map(
                              (name) =>
                                `<button class="preset-toggle-btn ${inlineEditSelectedPresets.includes(name) ? "is-active" : ""}" type="button" data-preset-toggle data-preset-context="inlineEdit" data-preset-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`
                            ).join("")}
                          </div>
                          <span class="field-hint">Click presets to toggle them on or off.</span>
                        </label>

                        <label class="automod-rule-label">
                          Keyword
                          <input name="keyword" value="${escapeHtml(state.editingRuleForm.keyword)}" data-edit-input />
                          <span class="token-counter">${editKeywordTokens.length} / ${MAX_WORDS} words</span>
                        </label>

                        <label class="automod-rule-label">
                          Allowed Keywords
                          <input name="allowedKeywords" value="${escapeHtml(state.editingRuleForm.allowedKeywords)}" data-edit-input />
                          <span class="token-counter">${editAllowedKeywordTokens.length} allowed</span>
                        </label>

                        <label class="automod-rule-label">
                          Pattern
                          <textarea name="pattern" rows="4" data-edit-input>${escapeHtml(state.editingRuleForm.pattern)}</textarea>
                          <span class="field-hint">Use one regex per line for clear separation.</span>
                          <span class="token-counter">${editRegexTokens.length} / ${MAX_REGEXES} regexes</span>
                        </label>

                        <label class="automod-rule-label">
                          Action
                          <select name="action" data-edit-input>
                            ${RULE_ACTION_OPTIONS.map(
                              (action) =>
                                `<option value="${escapeHtml(action)}" ${state.editingRuleForm.action === action ? "selected" : ""}>${escapeHtml(formatActionLabel(action))}</option>`
                            ).join("")}
                          </select>
                        </label>

                        <label class="automod-rule-label">
                          Severity
                          <select name="severity" data-edit-input>
                            ${RULE_SEVERITY_OPTIONS.map(
                              (option) =>
                                `<option value="${option.value}" ${Number(state.editingRuleForm.severity || 2) === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
                            ).join("")}
                          </select>
                        </label>

                        <label class="automod-rule-label">
                          Threshold
                          <input name="threshold" type="number" min="1" step="1" value="${escapeHtml(
                            state.editingRuleForm.threshold
                          )}" data-edit-input />
                        </label>

                        <label class="automod-enabled-label">
                          <input type="checkbox" name="enabled" ${state.editingRuleForm.enabled ? "checked" : ""} data-edit-input />
                          Enabled
                        </label>

                        <div class="automod-rule-actions">
                          <button class="action-btn" type="button" data-save-edit ${state.isSavingEdit || isEditLimitExceeded || !editHasChanges ? "disabled" : ""}>
                            ${state.isSavingEdit ? "Saving..." : "Save"}
                          </button>
                          <button class="action-btn secondary" type="button" data-reset-edit ${state.isSavingEdit || !editHasChanges ? "disabled" : ""}>Reset</button>
                          <button class="action-btn secondary" type="button" data-cancel-edit ${state.isSavingEdit ? "disabled" : ""}>Cancel</button>
                        </div>

                        ${
                          isEditLimitExceeded
                            ? `<p class="subtitle">Cannot save: max ${MAX_WORDS} keywords and ${MAX_REGEXES} regex patterns.</p>`
                            : ""
                        }
                      </div>
                    </article>
                  `;
                }

                return `
                  <article class="automod-rule-card">
                    <div class="automod-rule-info">
                      <h5>${escapeHtml(rule?.name || "Unnamed Rule")}</h5>
                    </div>

                    <div class="automod-rule-actions">
                      <button class="action-btn secondary" type="button" data-open-editor="${escapeHtml(ruleId)}">Edit</button>
                      <button class="action-btn secondary" type="button" data-toggle-enabled="${escapeHtml(ruleId)}" ${isToggling || !ruleId ? "disabled" : ""}>
                        ${isToggling ? "Working..." : rule?.enabled === false ? "Enable" : "Disable"}
                      </button>
                      <button class="action-btn danger" type="button" data-delete-rule="${escapeHtml(ruleId)}" ${isDeleting || !ruleId ? "disabled" : ""}>
                        ${isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>
        `;

    root.innerHTML = `
      <div class="guild-page-header">
        <button class="action-btn secondary" type="button" id="back-to-guilds">
          <i class="fa-solid fa-arrow-left"></i>
          Back to Guilds
        </button>
      </div>

      <section class="dashboard-card guild-summary-card">
        <img class="guild-icon-image" src="${guildIconUrl}" alt="${escapeHtml(guildName)} icon" loading="lazy" data-fallback-image="true" />
        <h3>${escapeHtml(guildName)}</h3>
        <p class="card-label">Guild ID: ${escapeHtml(guildId)}</p>
      </section>

      <section class="content-section">
        <h3>AutoMod Setup</h3>

        <section class="automod-settings-form" id="automod-settings-form">
          <h4 class="automod-rules-title">Global AutoMod Settings</h4>

          <label class="automod-rule-label">
            AutoMod Log Channel ID
            <input name="logChannelId" value="${escapeHtml(state.automodSettingsForm.logChannelId)}" placeholder="123456789012345678" />
          </label>

          <label class="automod-rule-label">
            Staff Ping Role IDs (max 5, comma-separated)
            <input name="staffRoleIds" value="${escapeHtml(state.automodSettingsForm.staffRoleIds)}" placeholder="111111111111111111, 222222222222222222" />
            <span class="token-counter">${parseCommaSeparated(state.automodSettingsForm.staffRoleIds).length} / ${MAX_STAFF_PING_ROLES} roles</span>
          </label>

          <label class="automod-rule-label">
            Exempt Role IDs (comma-separated)
            <input name="exemptRoleIds" value="${escapeHtml(state.automodSettingsForm.exemptRoleIds)}" placeholder="111111111111111111, 222222222222222222" />
          </label>

          <label class="automod-rule-label">
            Exempt Channel IDs (comma-separated)
            <input name="exemptChannelIds" value="${escapeHtml(state.automodSettingsForm.exemptChannelIds)}" placeholder="333333333333333333, 444444444444444444" />
          </label>

          <label class="automod-rule-label">
            Exempt User IDs (comma-separated)
            <input name="exemptUserIds" value="${escapeHtml(state.automodSettingsForm.exemptUserIds)}" placeholder="555555555555555555, 666666666666666666" />
          </label>
        </section>

        <form class="automod-form" id="automod-create-form">
          <label class="automod-rule-label">
            Rule Name
            <input name="name" value="${escapeHtml(state.automodForm.name)}" list="automod-rule-name-presets" required />
          </label>

          <label class="automod-rule-label automod-preset-control">
            Presets
            <div class="preset-toggle-list" role="group" aria-label="Create presets">
              ${RULE_NAME_PRESETS.map(
                (name) =>
                  `<button class="preset-toggle-btn ${createSelectedPresets.includes(name) ? "is-active" : ""}" type="button" data-preset-toggle data-preset-context="create" data-preset-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`
              ).join("")}
            </div>
            <span class="field-hint">Click presets to toggle them on or off.</span>
          </label>

          <label class="automod-rule-label">
            Keyword
            <input name="keyword" value="${escapeHtml(state.automodForm.keyword)}" placeholder="badword, badword2" />
            <span class="token-counter">${keywordTokens.length} / ${MAX_WORDS} words</span>
            ${
              keywordTokens.length > 0
                ? `<span class="token-chip-list">${keywordTokens.map((token) => `<span class="token-chip">${escapeHtml(token)}</span>`).join("")}</span>`
                : ""
            }
          </label>

          <label class="automod-rule-label">
            Allowed Keywords
            <input name="allowedKeywords" value="${escapeHtml(state.automodForm.allowedKeywords)}" placeholder="example.com, trusted phrase" />
            <span class="token-counter">${allowedKeywordTokens.length} allowed</span>
            ${
              allowedKeywordTokens.length > 0
                ? `<span class="token-chip-list">${allowedKeywordTokens
                    .map((token) => `<span class="token-chip muted">${escapeHtml(token)}</span>`)
                    .join("")}</span>`
                : ""
            }
          </label>

          <label class="automod-rule-label">
            Pattern (Optional)
            <textarea name="pattern" rows="5" placeholder="\\b(badword)\\b&#10;(https?:\\/\\/\\S+)">${escapeHtml(state.automodForm.pattern)}</textarea>
            <span class="field-hint">Use one regex per line for clear separation.</span>
            <span class="token-counter">${regexTokens.length} / ${MAX_REGEXES} regexes</span>
            ${
              regexTokens.length > 0
                ? `<span class="token-chip-list">${regexTokens.map((token) => `<span class="token-chip">${escapeHtml(token)}</span>`).join("")}</span>`
                : ""
            }
          </label>

          <label class="automod-rule-label">
            Action
            <select name="action">
              ${RULE_ACTION_OPTIONS.map(
                (action) =>
                  `<option value="${escapeHtml(action)}" ${state.automodForm.action === action ? "selected" : ""}>${escapeHtml(formatActionLabel(action))}</option>`
              ).join("")}
            </select>
          </label>

          <label class="automod-rule-label">
            Severity
            <select name="severity">
              ${RULE_SEVERITY_OPTIONS.map(
                (option) =>
                  `<option value="${option.value}" ${Number(state.automodForm.severity || 2) === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
              ).join("")}
            </select>
            <span class="field-hint">Low severity only logs to staff and will not delete the message.</span>
          </label>

          <button type="submit" ${state.isSubmittingRule || hasReachedRuleLimit || isCreateLimitExceeded ? "disabled" : ""}>
            ${state.isSubmittingRule ? "Saving..." : "Create AutoMod Rule"}
          </button>
        </form>

        ${hasReachedRuleLimit ? `<p class="subtitle">Rule limit reached: ${MAX_AUTOMOD_RULES} / ${MAX_AUTOMOD_RULES}</p>` : ""}

        <div class="automod-rules-list">
          ${state.isLoadingRules ? '<p class="subtitle">Loading AutoMod rules...</p>' : rulesHtml}
        </div>

        <datalist id="automod-rule-name-presets">
          ${RULE_NAME_PRESETS.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("")}
        </datalist>
      </section>

      ${state.statusMessage ? `<p class="subtitle">${escapeHtml(state.statusMessage)}</p>` : ""}
    `;

    const backButton = document.getElementById("back-to-guilds");
    if (backButton) {
      backButton.addEventListener("click", () => navigate("/pages/dashboard.html"));
    }

    root.querySelectorAll("[data-preset-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const context = button.getAttribute("data-preset-context") || "";
        const presetName = button.getAttribute("data-preset-name") || "";
        if (!context || !presetName || !Object.hasOwn(state.presetSelections, context)) {
          return;
        }

        const selected = Array.isArray(state.presetSelections[context])
          ? [...state.presetSelections[context]]
          : [];
        const existingIndex = selected.indexOf(presetName);
        if (existingIndex >= 0) {
          selected.splice(existingIndex, 1);
        } else {
          selected.push(presetName);
        }

        state.presetSelections[context] = selected;

        if (context === "create" && selected.length > 0) {
          applyRulePresets(state.automodForm, selected);
        }
        if (context === "inlineEdit" && selected.length > 0) {
          applyRulePresets(state.editingRuleForm, selected);
        }

        rerenderKeepingInput(renderContent);
      });
    });

    wireEvents(guildId, state, isCreateLimitExceeded, isEditLimitExceeded);
  }

  function wireEvents(guildId, state, isCreateLimitExceeded, isEditLimitExceeded) {
    const settingsForm = document.getElementById("automod-settings-form");
    const createForm = document.getElementById("automod-create-form");
    const root = document.getElementById("guild-dashboard-root");

    if (settingsForm) {
      settingsForm.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }

        state.automodSettingsForm[target.name] = target.value;
      });
    }

    if (createForm) {
      createForm.addEventListener("input", () => {
        const formData = new FormData(createForm);
        state.automodForm.name = String(formData.get("name") || "");
        state.automodForm.keyword = String(formData.get("keyword") || "");
        state.automodForm.allowedKeywords = String(formData.get("allowedKeywords") || "");
        state.automodForm.pattern = String(formData.get("pattern") || "");
        state.automodForm.action = String(formData.get("action") || "warn");
        state.automodForm.severity = Math.max(1, Math.min(3, Number(formData.get("severity") || 2)));
        rerenderKeepingInput(renderContent);
      });

      createForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (isCreateLimitExceeded) {
          return;
        }

        await saveSettings(guildId, state);
        await createRule(guildId, state);
        renderContent();
      });

    }

    if (!root) {
      return;
    }

    root.querySelectorAll("[data-open-editor]").forEach((button) => {
      button.addEventListener("click", () => {
        const ruleId = button.getAttribute("data-open-editor") || "";
        if (!ruleId || !guildId) {
          return;
        }

        navigate(`/pages/rule-editor.html?guild_id=${encodeURIComponent(guildId)}&rule_id=${encodeURIComponent(ruleId)}`);
      });
    });

    root.querySelectorAll("[data-toggle-enabled]").forEach((button) => {
      button.addEventListener("click", async () => {
        const ruleId = button.getAttribute("data-toggle-enabled") || "";
        const targetRule = state.automodRules.find((rule) => getRuleId(rule) === ruleId);
        if (!targetRule) {
          return;
        }

        if (state.editingRuleId && state.editingRuleId !== ruleId && !canAbandonEdit(state, "toggle another rule")) {
          return;
        }

        await toggleRuleEnabled(guildId, targetRule, state);
        renderContent();
      });
    });

    root.querySelectorAll("[data-delete-rule]").forEach((button) => {
      button.addEventListener("click", async () => {
        const ruleId = button.getAttribute("data-delete-rule") || "";

        if (state.editingRuleId && state.editingRuleId !== ruleId && !canAbandonEdit(state, "delete another rule")) {
          return;
        }

        await deleteRule(guildId, ruleId, state);
        renderContent();
      });
    });

    const editContainer = root.querySelector("[data-rule-id]");
    if (!editContainer) {
      return;
    }

    editContainer.querySelectorAll("[data-edit-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const name = input.getAttribute("name") || "";
        if (input instanceof HTMLInputElement && input.type === "checkbox") {
          state.editingRuleForm[name] = input.checked;
        } else if (input instanceof HTMLInputElement && input.type === "number") {
          state.editingRuleForm[name] = Math.max(1, Number(input.value || 1));
        } else {
          state.editingRuleForm[name] = input.value;
        }
        rerenderKeepingInput(renderContent);
      });
    });

    const saveEditButton = editContainer.querySelector("[data-save-edit]");
    if (saveEditButton) {
      saveEditButton.addEventListener("click", async () => {
        if (isEditLimitExceeded) {
          return;
        }

        await saveEditedRule(guildId, state);
        renderContent();
      });
    }

    const cancelButton = editContainer.querySelector("[data-cancel-edit]");
    if (cancelButton) {
      cancelButton.addEventListener("click", () => {
        if (!canAbandonEdit(state, "cancel editing")) {
          return;
        }

        cancelEditRule(state);
        renderContent();
      });
    }

    const resetButton = editContainer.querySelector("[data-reset-edit]");
    if (resetButton) {
      resetButton.addEventListener("click", () => {
        if (!state.editingOriginalForm) {
          return;
        }

        state.editingRuleForm = { ...state.editingOriginalForm };
        renderContent();
      });
    }

    editContainer.addEventListener("keydown", async (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!isEditLimitExceeded && !state.isSavingEdit && hasEditChanges(state)) {
          await saveEditedRule(guildId, state);
          renderContent();
        }
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (canAbandonEdit(state, "exit edit mode")) {
          cancelEditRule(state);
          renderContent();
        }
      }
    });
  }

  async function loadSettings(guildId, state) {
    if (!guildId) {
      return;
    }

    async function fetchNormalizedSettings() {
      const candidates = [
        `${backendUrl}/api/guilds/automod-settings?guild_id=${encodeURIComponent(guildId)}`,
        `${backendUrl}/api/guilds/settings/automod?guild_id=${encodeURIComponent(guildId)}`,
        `${backendUrl}/api/guilds/settings?guild_id=${encodeURIComponent(guildId)}`,
      ];

      const isSettingsEmpty = (settings) => {
        return (
          !settings.logChannelId &&
          !settings.exemptRoleIds &&
          !settings.exemptChannelIds &&
          !settings.exemptUserIds
        );
      };

      let fallbackSettings = null;

      for (const url of candidates) {
        const response = await fetch(url, { method: "GET", credentials: "include" });
        if (response.ok) {
          const payload = await response.json();
          const normalized = normalizeAutomodSettings(payload);

          if (!fallbackSettings) {
            fallbackSettings = normalized;
          }

          if (!isSettingsEmpty(normalized)) {
            return normalized;
          }

          continue;
        }

        if (response.status !== 404) {
          throw new Error(`Failed to load AutoMod settings (${response.status})`);
        }
      }

      return (
        fallbackSettings || {
          logChannelId: "",
          staffRoleIds: "",
          exemptRoleIds: "",
          exemptChannelIds: "",
          exemptUserIds: "",
        }
      );
    }

    state.isLoadingSettings = true;
    state.statusMessage = "";
    renderContent();

    try {
      state.automodSettingsForm = await fetchNormalizedSettings();
      state.automodSettingsOriginal = { ...state.automodSettingsForm };
    } catch (error) {
      state.statusMessage = error?.message || "Failed to load AutoMod settings.";
    } finally {
      state.isLoadingSettings = false;
      renderContent();
    }
  }

  async function saveSettings(guildId, state) {
    if (!guildId) {
      state.statusMessage = "Missing guild id in URL.";
      return;
    }

    const logChannelId = state.automodSettingsForm.logChannelId.trim();
    const logChannelIdNullable = logChannelId || null;
    const requestedStaffRoleIds = parseCommaSeparated(state.automodSettingsForm.staffRoleIds);
    if (requestedStaffRoleIds.length > MAX_STAFF_PING_ROLES) {
      state.statusMessage = `Staff ping roles exceed max limit (${MAX_STAFF_PING_ROLES}).`;
      return;
    }
    const staffRoleIdsCsv = state.automodSettingsForm.staffRoleIds.trim();
    const staffRoleIds = requestedStaffRoleIds.slice(0, MAX_STAFF_PING_ROLES);
    const staffRoleIdsNullable = staffRoleIds.length > 0 ? staffRoleIds : null;
    const exemptRoleIdsCsv = state.automodSettingsForm.exemptRoleIds.trim();
    const exemptRoleIds = parseCommaSeparated(state.automodSettingsForm.exemptRoleIds);
    const exemptRoleIdsNullable = exemptRoleIds.length > 0 ? exemptRoleIds : null;
    const exemptChannelIdsCsv = state.automodSettingsForm.exemptChannelIds.trim();
    const exemptChannelIds = parseCommaSeparated(state.automodSettingsForm.exemptChannelIds);
    const exemptChannelIdsNullable = exemptChannelIds.length > 0 ? exemptChannelIds : null;
    const exemptUserIdsCsv = state.automodSettingsForm.exemptUserIds.trim();
    const exemptUserIds = parseCommaSeparated(state.automodSettingsForm.exemptUserIds);
    const exemptUserIdsNullable = exemptUserIds.length > 0 ? exemptUserIds : null;

    const payload = {
      guild_id: String(guildId || "").trim(),
      guildId: String(guildId || "").trim(),
      log_channel_id: logChannelId,
      log_channel: logChannelId,
      automod_log_channel_id: logChannelId,
      automod_log_channel: logChannelId,
      logChannelId: logChannelId,
      // Nullable aliases help backends clear saved channel values when user removes them.
      log_channel_id_nullable: logChannelIdNullable,
      automod_log_channel_nullable: logChannelIdNullable,
      staff_role_ids: staffRoleIds,
      staff_roles: staffRoleIds,
      staff_ping_role_ids: staffRoleIds,
      automod_ping_role_ids: staffRoleIds,
      staff_role_ids_csv: staffRoleIdsCsv,
      staff_roles_csv: staffRoleIdsCsv,
      staff_role_ids_nullable: staffRoleIdsNullable,
      staff_roles_nullable: staffRoleIdsNullable,
      staffRoleIds,
      exempt_role_ids: exemptRoleIds,
      exempt_roles: exemptRoleIds,
      exempt_role_ids_csv: exemptRoleIdsCsv,
      exempt_roles_csv: exemptRoleIdsCsv,
      exempt_role_ids_nullable: exemptRoleIdsNullable,
      exempt_roles_nullable: exemptRoleIdsNullable,
      exemptRoleIds,
      ignored_role_ids: exemptRoleIds,
      ignored_roles: exemptRoleIds,
      ignored_role_ids_csv: exemptRoleIdsCsv,
      ignored_role_ids_nullable: exemptRoleIdsNullable,
      exempt_channel_ids: exemptChannelIds,
      exempt_channels: exemptChannelIds,
      exempt_channel_ids_csv: exemptChannelIdsCsv,
      exempt_channels_csv: exemptChannelIdsCsv,
      exempt_channel_ids_nullable: exemptChannelIdsNullable,
      exempt_channels_nullable: exemptChannelIdsNullable,
      exemptChannelIds,
      ignored_channel_ids: exemptChannelIds,
      ignored_channels: exemptChannelIds,
      ignored_channel_ids_csv: exemptChannelIdsCsv,
      ignored_channel_ids_nullable: exemptChannelIdsNullable,
      exempt_user_ids: exemptUserIds,
      exempt_users: exemptUserIds,
      exempt_user_ids_csv: exemptUserIdsCsv,
      exempt_users_csv: exemptUserIdsCsv,
      exempt_user_ids_nullable: exemptUserIdsNullable,
      exempt_users_nullable: exemptUserIdsNullable,
      exemptUserIds,
      ignored_user_ids: exemptUserIds,
      ignored_users: exemptUserIds,
      ignored_user_ids_csv: exemptUserIdsCsv,
      ignored_user_ids_nullable: exemptUserIdsNullable,
      command_settings: {
        automod_log_channel: logChannelId,
        automod_log_channel_id: logChannelId,
        staff_role_ids: staffRoleIds,
        staff_roles: staffRoleIds,
        staff_ping_role_ids: staffRoleIds,
        automod_ping_role_ids: staffRoleIds,
        exempt_role_ids: exemptRoleIds,
        exempt_channel_ids: exemptChannelIds,
        exempt_user_ids: exemptUserIds,
        ignored_role_ids: exemptRoleIds,
        ignored_channel_ids: exemptChannelIds,
        ignored_user_ids: exemptUserIds,
      },
    };

    const expectedSettings = {
      logChannelId,
      staffRoleIds,
      exemptRoleIds,
      exemptChannelIds,
      exemptUserIds,
    };

    const candidates = [
      `${backendUrl}/api/guilds/automod-settings?guild_id=${encodeURIComponent(guildId)}`,
      `${backendUrl}/api/guilds/settings/automod?guild_id=${encodeURIComponent(guildId)}`,
      `${backendUrl}/api/guilds/settings?guild_id=${encodeURIComponent(guildId)}`,
    ];

    state.isSavingSettings = true;

    try {
      let lastError = null;

      for (const url of candidates) {
        const response = await fetch(url, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          // Read-after-write verification confirms whether backend actually persisted the values.
          await loadSettings(guildId, state);
          const persisted = didSettingsPersist(expectedSettings, state.automodSettingsForm);

          state.statusMessage = persisted
            ? "AutoMod settings updated successfully."
            : "Save request succeeded, but server returned different settings. Backend persistence may be failing.";
          return;
        }

        if (response.status !== 404) {
          lastError = new Error(`Failed to update AutoMod settings (${response.status})`);
          break;
        }
      }

      throw lastError || new Error("Failed to update AutoMod settings.");
    } catch (error) {
      state.statusMessage = error?.message || "Failed to update AutoMod settings.";
    } finally {
      state.isSavingSettings = false;
    }
  }

  async function loadRules(guildId, state) {
    if (!guildId) {
      state.automodRules = [];
      return;
    }

    state.isLoadingRules = true;
    state.statusMessage = "";
    renderContent();

    try {
      const response = await fetch(`${backendUrl}/api/guilds/rules?guild_id=${encodeURIComponent(guildId)}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to load rules (${response.status})`);
      }

      const payload = await response.json();
      const normalizedRules = normalizeRulesResponse(payload).map((rule) => normalizeRule(rule));

      state.automodRules = normalizedRules.map((rule) => {
        const ruleId = getRuleId(rule);
        const keywordOverride = state.keywordOverrides[ruleId];

        if (!rule?.keyword && keywordOverride) {
          return { ...rule, keyword: keywordOverride };
        }

        return rule;
      });
    } catch (error) {
      state.automodRules = [];
      state.statusMessage = error?.message || "Failed to load AutoMod rules.";
    } finally {
      state.isLoadingRules = false;
      renderContent();
    }
  }

  async function createRule(guildId, state) {
    const keywordTokens = parseCommaSeparated(state.automodForm.keyword);
    const allowedKeywordTokens = parseCommaSeparated(state.automodForm.allowedKeywords);
    const regexTokens = splitRegexPatterns(state.automodForm.pattern);
    const compiledPattern = buildPatternForApi(state.automodForm.pattern);

    if (!guildId) {
      state.statusMessage = "Missing guild id in URL.";
      return;
    }

    if (state.automodRules.length >= MAX_AUTOMOD_RULES) {
      state.statusMessage = `This guild already has ${MAX_AUTOMOD_RULES} AutoMod rules.`;
      return;
    }

    if (keywordTokens.length === 0 && regexTokens.length === 0) {
      state.statusMessage = "Add at least one keyword or one regex pattern.";
      return;
    }

    if (keywordTokens.length > MAX_WORDS) {
      state.statusMessage = `Keywords exceed max limit (${MAX_WORDS}).`;
      return;
    }

    if (regexTokens.length > MAX_REGEXES) {
      state.statusMessage = `Regex patterns exceed max limit (${MAX_REGEXES}).`;
      return;
    }

    state.isSubmittingRule = true;
    state.statusMessage = "";

    try {
      const submittedKeyword = state.automodForm.keyword.trim();
      const response = await fetch(`${backendUrl}/api/guilds/rules?guild_id=${encodeURIComponent(guildId)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.automodForm.name,
          keyword: state.automodForm.keyword,
          keywords: keywordTokens,
          allowed_keywords: allowedKeywordTokens,
          allowed_patterns: allowedKeywordTokens,
          allowedKeywords: allowedKeywordTokens,
          pattern: compiledPattern,
          action: state.automodForm.action,
          severity: Math.max(1, Math.min(3, Number(state.automodForm.severity || 2))),
          threshold: state.automodForm.threshold,
          enabled: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create rule (${response.status})`);
      }

      let createdRule = null;
      try {
        createdRule = await response.json();
      } catch {
        createdRule = null;
      }

      const createdRuleId = getRuleId(createdRule || {});
      if (createdRuleId && submittedKeyword) {
        state.keywordOverrides[createdRuleId] = submittedKeyword;
      }

      state.statusMessage = "AutoMod rule created successfully.";
      state.automodForm.keyword = "";
      state.automodForm.allowedKeywords = "";
      state.automodForm.pattern = "";
      state.automodForm.threshold = 1;
      await loadRules(guildId, state);
    } catch (error) {
      state.statusMessage = error?.message || "Failed to create AutoMod rule.";
    } finally {
      state.isSubmittingRule = false;
    }
  }

  async function saveEditedRule(guildId, state) {
    if (!guildId || !state.editingRuleId) {
      return;
    }

    if (!hasEditChanges(state)) {
      state.statusMessage = "No changes to save.";
      return;
    }

    const editKeywordTokens = parseCommaSeparated(state.editingRuleForm.keyword);
    const editAllowedKeywordTokens = parseCommaSeparated(state.editingRuleForm.allowedKeywords);
    const editRegexTokens = splitRegexPatterns(state.editingRuleForm.pattern);
    const compiledPattern = buildPatternForApi(state.editingRuleForm.pattern);

    if (editKeywordTokens.length > MAX_WORDS) {
      state.statusMessage = `Keywords exceed max limit (${MAX_WORDS}).`;
      return;
    }

    if (editRegexTokens.length > MAX_REGEXES) {
      state.statusMessage = `Regex patterns exceed max limit (${MAX_REGEXES}).`;
      return;
    }

    if (editKeywordTokens.length === 0 && editRegexTokens.length === 0) {
      state.statusMessage = "Add at least one keyword or one regex pattern before saving.";
      return;
    }

    const exemptRoleIdsCsv = state.editingRuleForm.exemptRoleIds.trim();
    const exemptRoleIds = parseCommaSeparated(state.editingRuleForm.exemptRoleIds);
    const exemptRoleIdsNullable = exemptRoleIds.length > 0 ? exemptRoleIds : null;
    const exemptChannelIdsCsv = state.editingRuleForm.exemptChannelIds.trim();
    const exemptChannelIds = parseCommaSeparated(state.editingRuleForm.exemptChannelIds);
    const exemptChannelIdsNullable = exemptChannelIds.length > 0 ? exemptChannelIds : null;
    const exemptUserIdsCsv = state.editingRuleForm.exemptUserIds.trim();
    const exemptUserIds = parseCommaSeparated(state.editingRuleForm.exemptUserIds);
    const exemptUserIdsNullable = exemptUserIds.length > 0 ? exemptUserIds : null;

    const payload = {
      guild_id: guildId,
      name: String(state.editingRuleForm.name || "").trim(),
      keyword: String(state.editingRuleForm.keyword || "").trim(),
      keywords: editKeywordTokens,
      allowed_keywords: editAllowedKeywordTokens,
      allowed_patterns: editAllowedKeywordTokens,
      allowedKeywords: editAllowedKeywordTokens,
      pattern: compiledPattern,
      action: state.editingRuleForm.action,
      severity: Math.max(1, Math.min(3, Number(state.editingRuleForm.severity || 2))),
      threshold: Math.max(1, Number(state.editingRuleForm.threshold || 1)),
      enabled: state.editingRuleForm.enabled,
      exempt_role_ids: exemptRoleIds,
      exempt_roles: exemptRoleIds,
      exempt_role_ids_csv: exemptRoleIdsCsv,
      exempt_roles_csv: exemptRoleIdsCsv,
      exempt_role_ids_nullable: exemptRoleIdsNullable,
      exempt_roles_nullable: exemptRoleIdsNullable,
      exemptRoleIds,
      ignored_role_ids: exemptRoleIds,
      ignored_roles: exemptRoleIds,
      ignored_role_ids_csv: exemptRoleIdsCsv,
      ignored_role_ids_nullable: exemptRoleIdsNullable,
      exempt_channel_ids: exemptChannelIds,
      exempt_channels: exemptChannelIds,
      exempt_channel_ids_csv: exemptChannelIdsCsv,
      exempt_channels_csv: exemptChannelIdsCsv,
      exempt_channel_ids_nullable: exemptChannelIdsNullable,
      exempt_channels_nullable: exemptChannelIdsNullable,
      exemptChannelIds,
      ignored_channel_ids: exemptChannelIds,
      ignored_channels: exemptChannelIds,
      ignored_channel_ids_csv: exemptChannelIdsCsv,
      ignored_channel_ids_nullable: exemptChannelIdsNullable,
      exempt_user_ids: exemptUserIds,
      exempt_users: exemptUserIds,
      exempt_user_ids_csv: exemptUserIdsCsv,
      exempt_users_csv: exemptUserIdsCsv,
      exempt_user_ids_nullable: exemptUserIdsNullable,
      exempt_users_nullable: exemptUserIdsNullable,
      exemptUserIds,
      ignored_user_ids: exemptUserIds,
      ignored_users: exemptUserIds,
      ignored_user_ids_csv: exemptUserIdsCsv,
      ignored_user_ids_nullable: exemptUserIdsNullable,
    };

    const expectedRuleFields = {
      name: String(state.editingRuleForm.name || "").trim(),
      keyword: String(state.editingRuleForm.keyword || "").trim(),
      keywords: editKeywordTokens,
      allowedKeywords: editAllowedKeywordTokens,
      pattern: compiledPattern,
      action: String(state.editingRuleForm.action || "warn"),
      severity: Math.max(1, Math.min(3, Number(state.editingRuleForm.severity || 2))),
      threshold: Math.max(1, Number(state.editingRuleForm.threshold || 1)),
      enabled: Boolean(state.editingRuleForm.enabled),
      exemptRoleIds,
      exemptChannelIds,
      exemptUserIds,
    };

    const editingRuleId = state.editingRuleId;

    const candidates = [
      `${backendUrl}/api/guilds/rules/${encodeURIComponent(state.editingRuleId)}?guild_id=${encodeURIComponent(guildId)}`,
      `${backendUrl}/api/guilds/rules?guild_id=${encodeURIComponent(guildId)}&rule_id=${encodeURIComponent(state.editingRuleId)}`,
    ];

    state.isSavingEdit = true;

    try {
      const editedKeyword = state.editingRuleForm.keyword.trim();
      let lastError = null;

      const didRulePersist = (rule) => {
        const updatedComparable = toRuleEditForm(rule || {});
        return (
          String(updatedComparable.name || "").trim() === expectedRuleFields.name &&
          String(updatedComparable.keyword || "").trim() === expectedRuleFields.keyword &&
          areIdListsEqual(updatedComparable.allowedKeywords, expectedRuleFields.allowedKeywords) &&
          String(updatedComparable.pattern || "").trim() === expectedRuleFields.pattern &&
          String(updatedComparable.action || "warn") === expectedRuleFields.action &&
          Math.max(1, Math.min(3, Number(updatedComparable.severity || 2))) === expectedRuleFields.severity &&
          Math.max(1, Number(updatedComparable.threshold || 1)) === expectedRuleFields.threshold &&
          Boolean(updatedComparable.enabled) === expectedRuleFields.enabled &&
          areIdListsEqual(updatedComparable.exemptRoleIds, expectedRuleFields.exemptRoleIds) &&
          areIdListsEqual(updatedComparable.exemptChannelIds, expectedRuleFields.exemptChannelIds) &&
          areIdListsEqual(updatedComparable.exemptUserIds, expectedRuleFields.exemptUserIds)
        );
      };

      const fallbackPersistRuleViaSettings = async () => {
        const guildIdAsString = String(guildId || "").trim();
        const inMemoryRules = Array.isArray(state.automodRules) ? state.automodRules : [];
        const settingsCandidates = [
          `${backendUrl}/api/guilds/settings?guild_id=${encodeURIComponent(guildId)}`,
          `${backendUrl}/api/guilds/settings/automod?guild_id=${encodeURIComponent(guildId)}`,
          `${backendUrl}/api/guilds/automod-settings?guild_id=${encodeURIComponent(guildId)}`,
        ];

        for (const url of settingsCandidates) {
          let payloadFromServer = {};
          const response = await fetch(url, { method: "GET", credentials: "include" });
          if (response.ok) {
            payloadFromServer = (await response.json().catch(() => null)) || {};
          }

          const automodRules =
            (Array.isArray(payloadFromServer?.automod_rules) && payloadFromServer.automod_rules) ||
            (Array.isArray(payloadFromServer?.settings?.automod_rules) && payloadFromServer.settings.automod_rules) ||
            (Array.isArray(payloadFromServer?.data?.automod_rules) && payloadFromServer.data.automod_rules) ||
            inMemoryRules;

          const ruleIndex = automodRules.findIndex((rule) => getRuleId(rule) === editingRuleId);
          const existingRule = ruleIndex >= 0 ? automodRules[ruleIndex] || {} : {};
          const updatedRule = {
            ...existingRule,
            id: existingRule.id || editingRuleId,
            rule_id: existingRule.rule_id || editingRuleId,
            name: expectedRuleFields.name,
            rule_name: expectedRuleFields.name || existingRule.rule_name || "AutoMod Rule",
            keyword: expectedRuleFields.keyword,
            keywords: expectedRuleFields.keywords,
            allowed_patterns: expectedRuleFields.allowedKeywords,
            allowed_keywords: expectedRuleFields.allowedKeywords,
            allowedPatterns: expectedRuleFields.allowedKeywords,
            allowedKeywords: expectedRuleFields.allowedKeywords,
            pattern: expectedRuleFields.pattern,
            action: expectedRuleFields.action,
            severity: expectedRuleFields.severity,
            threshold: expectedRuleFields.threshold,
            enabled: expectedRuleFields.enabled,
            exempt_roles: expectedRuleFields.exemptRoleIds,
            exempt_channels: expectedRuleFields.exemptChannelIds,
            exempt_users: expectedRuleFields.exemptUserIds,
            exempt_role_ids: expectedRuleFields.exemptRoleIds,
            exempt_channel_ids: expectedRuleFields.exemptChannelIds,
            exempt_user_ids: expectedRuleFields.exemptUserIds,
          };

          const updatedRules =
            ruleIndex >= 0
              ? automodRules.map((rule, index) => (index === ruleIndex ? updatedRule : rule))
              : [...automodRules, updatedRule];
          const commandSettings = {
            ...(payloadFromServer?.command_settings || {}),
            automod_log_channel: String(state.automodSettingsForm.logChannelId || "").trim(),
          };

          const bodyCandidates = [
            {
              guild_id: guildIdAsString,
              automod_rules: updatedRules,
              command_settings: commandSettings,
            },
            {
              guildId: guildIdAsString,
              settings: {
                automod_rules: updatedRules,
                command_settings: commandSettings,
              },
            },
            {
              guild_id: guildIdAsString,
              data: {
                automod_rules: updatedRules,
                command_settings: commandSettings,
              },
            },
            {
              guild_id: guildIdAsString,
              rule_id: editingRuleId,
              rule: updatedRule,
              command_settings: commandSettings,
            },
            {
              guild_id: guildIdAsString,
              rule_id: editingRuleId,
              exempt_roles: expectedRuleFields.exemptRoleIds,
              exempt_channels: expectedRuleFields.exemptChannelIds,
              exempt_users: expectedRuleFields.exemptUserIds,
              exempt_role_ids: expectedRuleFields.exemptRoleIds,
              exempt_channel_ids: expectedRuleFields.exemptChannelIds,
              exempt_user_ids: expectedRuleFields.exemptUserIds,
              command_settings: commandSettings,
            },
          ];

          for (const method of ["PUT", "PATCH"]) {
            for (const saveBody of bodyCandidates) {
              const saveResponse = await fetch(url, {
                method,
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(saveBody),
              });

              if (saveResponse.ok) {
                return true;
              }
            }
          }
        }

        return false;
      };

      for (const url of candidates) {
        const response = await fetch(url, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          if (state.editingRuleId && editedKeyword) {
            state.keywordOverrides[state.editingRuleId] = editedKeyword;
          }

          await loadRules(guildId, state);

          const updatedRule = state.automodRules.find((rule) => getRuleId(rule) === editingRuleId);
          let persisted = didRulePersist(updatedRule);

          if (!persisted) {
            const fallbackSaved = await fallbackPersistRuleViaSettings();
            if (fallbackSaved) {
              await loadRules(guildId, state);
              const retryRule = state.automodRules.find((rule) => getRuleId(rule) === editingRuleId);
              persisted = didRulePersist(retryRule);
            }
          }

          state.statusMessage = persisted
            ? "AutoMod rule updated successfully."
            : "Save request succeeded, but server returned different rule values. Backend persistence may be failing.";

          cancelEditRule(state);
          return;
        }

        if (response.status !== 404) {
          lastError = new Error(`Failed to update rule (${response.status})`);
          break;
        }
      }

      throw lastError || new Error("Failed to update AutoMod rule.");
    } catch (error) {
      state.statusMessage = error?.message || "Failed to update AutoMod rule.";
    } finally {
      state.isSavingEdit = false;
    }
  }

  async function toggleRuleEnabled(guildId, rule, state) {
    const ruleId = getRuleId(rule);
    if (!guildId || !ruleId) {
      return;
    }

    const ruleKeywords = parseCommaSeparated(
      firstDefined(rule?.keywords, rule?.keyword, [])
    );
    const ruleAllowedKeywords = parseCommaSeparated(
      firstDefined(
        rule?.allowed_patterns,
        rule?.allowed_keywords,
        rule?.allowedPatterns,
        rule?.allowedKeywords,
        []
      )
    );
    const ruleExemptRoleIds = parseCommaSeparated(
      firstDefined(
        rule?.exempt_role_ids,
        rule?.exempt_roles,
        rule?.exemptRoleIds,
        rule?.exemptRoles,
        []
      )
    );
    const ruleExemptChannelIds = parseCommaSeparated(
      firstDefined(
        rule?.exempt_channel_ids,
        rule?.exempt_channels,
        rule?.exemptChannelIds,
        rule?.exemptChannels,
        []
      )
    );
    const ruleExemptUserIds = parseCommaSeparated(
      firstDefined(
        rule?.exempt_user_ids,
        rule?.exempt_users,
        rule?.exemptUserIds,
        rule?.exemptUsers,
        []
      )
    );

    const payload = {
      name: String(rule?.name || "").trim(),
      keyword: String(rule?.keyword || "").trim(),
      keywords: ruleKeywords,
      allowed_keywords: ruleAllowedKeywords,
      allowed_patterns: ruleAllowedKeywords,
      allowedKeywords: ruleAllowedKeywords,
      pattern: String(rule?.pattern || "").trim(),
      action: String(rule?.action || "warn"),
      severity: Math.max(1, Math.min(3, Number(rule?.severity || 2))),
      threshold: Math.max(1, Number(rule?.threshold || 1)),
      exempt_role_ids: ruleExemptRoleIds,
      exempt_roles: ruleExemptRoleIds,
      exemptRoleIds: ruleExemptRoleIds,
      exempt_channel_ids: ruleExemptChannelIds,
      exempt_channels: ruleExemptChannelIds,
      exemptChannelIds: ruleExemptChannelIds,
      exempt_user_ids: ruleExemptUserIds,
      exempt_users: ruleExemptUserIds,
      exemptUserIds: ruleExemptUserIds,
      enabled: rule?.enabled === false,
    };

    const candidates = [
      `${backendUrl}/api/guilds/rules/${encodeURIComponent(ruleId)}?guild_id=${encodeURIComponent(guildId)}`,
      `${backendUrl}/api/guilds/rules?guild_id=${encodeURIComponent(guildId)}&rule_id=${encodeURIComponent(ruleId)}`,
    ];

    state.togglingRuleId = ruleId;

    try {
      let lastError = null;

      for (const url of candidates) {
        const response = await fetch(url, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          state.statusMessage = payload.enabled
            ? "AutoMod rule enabled successfully."
            : "AutoMod rule disabled successfully.";

          if (state.editingRuleId === ruleId) {
            cancelEditRule(state);
          }

          await loadRules(guildId, state);
          return;
        }

        if (response.status !== 404) {
          lastError = new Error(`Failed to toggle rule (${response.status})`);
          break;
        }
      }

      throw lastError || new Error("Failed to toggle AutoMod rule.");
    } catch (error) {
      state.statusMessage = error?.message || "Failed to toggle AutoMod rule.";
    } finally {
      state.togglingRuleId = "";
    }
  }

  async function deleteRule(guildId, ruleId, state) {
    if (!guildId || !ruleId) {
      return;
    }

    const candidates = [
      `${backendUrl}/api/guilds/rules/${encodeURIComponent(ruleId)}?guild_id=${encodeURIComponent(guildId)}`,
      `${backendUrl}/api/guilds/rules?guild_id=${encodeURIComponent(guildId)}&rule_id=${encodeURIComponent(ruleId)}`,
    ];

    state.deletingRuleId = ruleId;

    try {
      let lastError = null;

      for (const url of candidates) {
        const response = await fetch(url, { method: "DELETE", credentials: "include" });

        if (response.ok) {
          state.statusMessage = "AutoMod rule deleted successfully.";
          if (state.editingRuleId === ruleId) {
            cancelEditRule(state);
          }
          await loadRules(guildId, state);
          return;
        }

        if (response.status !== 404) {
          lastError = new Error(`Failed to delete rule (${response.status})`);
          break;
        }
      }

      throw lastError || new Error("Failed to delete AutoMod rule.");
    } catch (error) {
      state.statusMessage = error?.message || "Failed to delete AutoMod rule.";
    } finally {
      state.deletingRuleId = "";
    }
  }

  function renderRuleEditorContent() {
    const root = document.getElementById("guild-rule-editor-root");
    if (!root) {
      return;
    }

    const state = ensureState();
    const guildId = resolveGuildId(window.location.search);
    const ruleId = resolveRuleId(window.location.search);
    const user = appState.user || {};
    const guilds = Array.isArray(user?.guilds) ? user.guilds : [];
    const selectedGuild = guilds.find((guild) => getGuildId(guild) === guildId);
    const meta = getGuildMeta(selectedGuild || {});
    const guildName = meta.guildName;
    const guildIconUrl = selectedGuild ? getGuildIconUrl(selectedGuild, defaultImage) : defaultImage;

    if (!guildId) {
      root.innerHTML = `<section class="page-card"><p class="subtitle">Missing guild id.</p></section>`;
      return;
    }

    if (!ruleId) {
      root.innerHTML = `
        <section class="page-card">
          <p class="subtitle">Missing rule id.</p>
          <p><button class="action-btn secondary" type="button" id="editor-back-rules">Back to Rules</button></p>
        </section>
      `;

      const back = document.getElementById("editor-back-rules");
      if (back) {
        back.addEventListener("click", () => navigate(`/pages/guild-dashboard.html?guild_id=${encodeURIComponent(guildId)}`));
      }
      return;
    }

    const targetRule = state.automodRules.find((rule) => getRuleId(rule) === ruleId);

    if (!targetRule) {
      root.innerHTML = `
        <section class="page-card">
          <p class="subtitle">Rule not found in this guild.</p>
          <p><button class="action-btn secondary" type="button" id="editor-back-rules">Back to Rules</button></p>
        </section>
      `;

      const back = document.getElementById("editor-back-rules");
      if (back) {
        back.addEventListener("click", () => navigate(`/pages/guild-dashboard.html?guild_id=${encodeURIComponent(guildId)}`));
      }
      return;
    }

    if (state.editingRuleId !== ruleId) {
      beginEditRule(state, targetRule);
    }

    const editKeywordTokens = parseCommaSeparated(state.editingRuleForm.keyword);
    const editAllowedKeywordTokens = parseCommaSeparated(state.editingRuleForm.allowedKeywords);
    const editRegexTokens = splitRegexPatterns(state.editingRuleForm.pattern);
    const editorSelectedPresets = Array.isArray(state.presetSelections?.editor) ? state.presetSelections.editor : [];
    const isEditLimitExceeded = editKeywordTokens.length > MAX_WORDS || editRegexTokens.length > MAX_REGEXES;
    const editHasChanges = hasEditChanges(state);
    const settingsHasChanges = hasSettingsChanges(state);
    const changedFields = getChangedEditFields(state);

    root.innerHTML = `
      <div class="guild-page-header">
        <button class="action-btn secondary" type="button" id="editor-back-rules">
          <i class="fa-solid fa-arrow-left"></i>
          Back to Rules
        </button>
      </div>

      <section class="dashboard-card guild-summary-card">
        <img class="guild-icon-image" src="${guildIconUrl}" alt="${escapeHtml(guildName)} icon" loading="lazy" data-fallback-image="true" />
        <h3>${escapeHtml(guildName)}</h3>
        <p class="card-label">Editing Rule: ${escapeHtml(targetRule?.name || "Unnamed Rule")}</p>
      </section>

      <section class="content-section rule-editor-page">
        <h3>Rule Editor</h3>
        <div class="automod-rule-edit" id="rule-editor-form" data-rule-id="${escapeHtml(ruleId)}">
          <div class="automod-edit-meta" aria-live="polite">
            ${
              editHasChanges
                ? `<span class="automod-edit-dirty">Unsaved changes: ${changedFields
                    .map((field) => formatChangedFieldName(field))
                    .join(", ")}</span>`
                : '<span class="automod-edit-clean">No changes yet</span>'
            }
          </div>

          <label class="automod-rule-label">
            Rule Name
            <input name="name" value="${escapeHtml(state.editingRuleForm.name)}" list="automod-rule-name-presets" data-edit-input />
          </label>

          <label class="automod-rule-label automod-preset-control">
            Presets
            <div class="preset-toggle-list" role="group" aria-label="Editor presets">
              ${RULE_NAME_PRESETS.map(
                (name) =>
                  `<button class="preset-toggle-btn ${editorSelectedPresets.includes(name) ? "is-active" : ""}" type="button" data-preset-toggle data-preset-context="editor" data-preset-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`
              ).join("")}
            </div>
            <span class="field-hint">Click presets to toggle them on or off.</span>
          </label>

          <label class="automod-rule-label">
            Keywords (comma-separated)
            <input name="keyword" value="${escapeHtml(state.editingRuleForm.keyword)}" data-edit-input />
            <span class="token-counter">${editKeywordTokens.length} / ${MAX_WORDS} words</span>
          </label>

          <label class="automod-rule-label">
            Allowed Keywords (comma-separated)
            <input name="allowedKeywords" value="${escapeHtml(state.editingRuleForm.allowedKeywords)}" data-edit-input />
            <span class="token-counter">${editAllowedKeywordTokens.length} allowed</span>
          </label>

          <label class="automod-rule-label">
            Regex Patterns (comma-separated or one per line)
            <textarea name="pattern" rows="5" data-edit-input>${escapeHtml(state.editingRuleForm.pattern)}</textarea>
            <span class="field-hint">Use one regex per line for clear separation.</span>
            <span class="token-counter">${editRegexTokens.length} / ${MAX_REGEXES} regexes</span>
          </label>

          <label class="automod-rule-label">
            Action
            <select name="action" data-edit-input>
              ${RULE_ACTION_OPTIONS.map(
                (action) =>
                  `<option value="${escapeHtml(action)}" ${state.editingRuleForm.action === action ? "selected" : ""}>${escapeHtml(formatActionLabel(action))}</option>`
              ).join("")}
            </select>
          </label>

          <label class="automod-rule-label">
            Severity
            <select name="severity" data-edit-input>
              ${RULE_SEVERITY_OPTIONS.map(
                (option) =>
                  `<option value="${option.value}" ${Number(state.editingRuleForm.severity || 2) === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
              ).join("")}
            </select>
            <span class="field-hint">Low severity only logs to staff and will not delete the message.</span>
          </label>

          <label class="automod-rule-label">
            Threshold
            <input name="threshold" type="number" min="1" step="1" value="${escapeHtml(state.editingRuleForm.threshold)}" data-edit-input />
          </label>

          <label class="automod-rule-label">
            Exempt Role IDs (comma-separated)
            <input name="exemptRoleIds" value="${escapeHtml(state.editingRuleForm.exemptRoleIds)}" data-edit-input />
          </label>

          <label class="automod-rule-label">
            Exempt Channel IDs (comma-separated)
            <input name="exemptChannelIds" value="${escapeHtml(state.editingRuleForm.exemptChannelIds)}" data-edit-input />
          </label>

          <label class="automod-rule-label">
            Exempt User IDs (comma-separated)
            <input name="exemptUserIds" value="${escapeHtml(state.editingRuleForm.exemptUserIds)}" data-edit-input />
          </label>

          <label class="automod-rule-label">
            AutoMod Log Channel ID
            <input
              name="logChannelId"
              value="${escapeHtml(state.automodSettingsForm.logChannelId)}"
              data-editor-setting
              placeholder="123456789012345678"
            />
          </label>

          <label class="automod-rule-label">
            Staff Ping Role IDs (max 5, comma-separated)
            <input
              name="staffRoleIds"
              value="${escapeHtml(state.automodSettingsForm.staffRoleIds)}"
              data-editor-setting
              placeholder="111111111111111111, 222222222222222222"
            />
            <span class="token-counter">${parseCommaSeparated(state.automodSettingsForm.staffRoleIds).length} / ${MAX_STAFF_PING_ROLES} roles</span>
          </label>

          <label class="automod-enabled-label">
            <input type="checkbox" name="enabled" ${state.editingRuleForm.enabled ? "checked" : ""} data-edit-input />
            Enabled
          </label>

          <div class="automod-rule-actions automod-rule-actions-full">
            <button class="action-btn" type="button" data-save-edit ${state.isSavingEdit || state.isSavingSettings || isEditLimitExceeded || (!editHasChanges && !settingsHasChanges) ? "disabled" : ""}>
              ${state.isSavingEdit ? "Saving..." : "Save Rule"}
            </button>
            <button class="action-btn secondary" type="button" data-save-settings ${state.isSavingSettings ? "disabled" : ""}>
              ${state.isSavingSettings ? "Saving..." : "Save Log Channel"}
            </button>
            <button class="action-btn secondary" type="button" data-reset-edit ${state.isSavingEdit || !editHasChanges ? "disabled" : ""}>Reset</button>
            <button class="action-btn secondary" type="button" data-cancel-edit ${state.isSavingEdit ? "disabled" : ""}>Discard Changes</button>
          </div>

          ${
            isEditLimitExceeded
              ? `<p class="subtitle">Cannot save: max ${MAX_WORDS} keywords and ${MAX_REGEXES} regex patterns.</p>`
              : ""
          }
        </div>

        <datalist id="automod-rule-name-presets">
          ${RULE_NAME_PRESETS.map((name) => `<option value="${escapeHtml(name)}"></option>`).join("")}
        </datalist>
      </section>

      ${state.statusMessage ? `<p class="subtitle">${escapeHtml(state.statusMessage)}</p>` : ""}
    `;

    wireRuleEditorEvents(guildId, ruleId, state, isEditLimitExceeded);
  }

  function wireRuleEditorEvents(guildId, ruleId, state, isEditLimitExceeded) {
    const root = document.getElementById("guild-rule-editor-root");
    if (!root) {
      return;
    }

    root.querySelectorAll("[data-preset-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const context = button.getAttribute("data-preset-context") || "";
        const presetName = button.getAttribute("data-preset-name") || "";
        if (context !== "editor" || !presetName) {
          return;
        }

        const selected = Array.isArray(state.presetSelections.editor)
          ? [...state.presetSelections.editor]
          : [];
        const existingIndex = selected.indexOf(presetName);
        if (existingIndex >= 0) {
          selected.splice(existingIndex, 1);
        } else {
          selected.push(presetName);
        }

        state.presetSelections.editor = selected;
        if (selected.length > 0) {
          applyRulePresets(state.editingRuleForm, selected);
        }

        rerenderKeepingInput(renderRuleEditorContent);
      });
    });

    const backButton = document.getElementById("editor-back-rules");
    if (backButton) {
      backButton.addEventListener("click", () => {
        if (!canAbandonEdit(state, "go back")) {
          return;
        }

        cancelEditRule(state);
        navigate(`/pages/guild-dashboard.html?guild_id=${encodeURIComponent(guildId)}`);
      });
    }

    root.querySelectorAll("[data-edit-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const name = input.getAttribute("name") || "";
        if (input instanceof HTMLInputElement && input.type === "checkbox") {
          state.editingRuleForm[name] = input.checked;
        } else if (input instanceof HTMLInputElement && input.type === "number") {
          state.editingRuleForm[name] = Math.max(1, Number(input.value || 1));
        } else {
          state.editingRuleForm[name] = input.value;
        }

        rerenderKeepingInput(renderRuleEditorContent);
      });
    });

    root.querySelectorAll("[data-editor-setting]").forEach((input) => {
      input.addEventListener("input", () => {
        const name = input.getAttribute("name") || "";
        if (!name) {
          return;
        }

        state.automodSettingsForm[name] = input.value;
        rerenderKeepingInput(renderRuleEditorContent);
      });
    });

    const saveButton = root.querySelector("[data-save-edit]");
    if (saveButton) {
      saveButton.addEventListener("click", async () => {
        if (isEditLimitExceeded) {
          return;
        }

        const shouldSaveRule = hasEditChanges(state);
        const shouldSaveSettings = hasSettingsChanges(state);

        if (shouldSaveSettings) {
          await saveSettings(guildId, state);
        }

        if (shouldSaveRule) {
          await saveEditedRule(guildId, state);
        }

        renderRuleEditorContent();
      });
    }

    const resetButton = root.querySelector("[data-reset-edit]");
    if (resetButton) {
      resetButton.addEventListener("click", () => {
        if (!state.editingOriginalForm) {
          return;
        }

        state.editingRuleForm = { ...state.editingOriginalForm };
        renderRuleEditorContent();
      });
    }

    const cancelButton = root.querySelector("[data-cancel-edit]");
    if (cancelButton) {
      cancelButton.addEventListener("click", () => {
        if (!canAbandonEdit(state, "discard changes")) {
          return;
        }

        cancelEditRule(state);
        navigate(`/pages/guild-dashboard.html?guild_id=${encodeURIComponent(guildId)}`);
      });
    }

    const saveSettingsButton = root.querySelector("[data-save-settings]");
    if (saveSettingsButton) {
      saveSettingsButton.addEventListener("click", async () => {
        await saveSettings(guildId, state);
        renderRuleEditorContent();
      });
    }

    root.addEventListener("keydown", async (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        const shouldSaveRule = hasEditChanges(state);
        const shouldSaveSettings = hasSettingsChanges(state);
        if (!isEditLimitExceeded && !state.isSavingEdit && (shouldSaveRule || shouldSaveSettings)) {
          if (shouldSaveSettings) {
            await saveSettings(guildId, state);
          }

          if (shouldSaveRule) {
            await saveEditedRule(guildId, state);
          }

          renderRuleEditorContent();
        }
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (!canAbandonEdit(state, "exit")) {
          return;
        }

        cancelEditRule(state);
        navigate(`/pages/guild-dashboard.html?guild_id=${encodeURIComponent(guildId)}`);
      }
    });
  }

  async function mountRuleEditor() {
    const state = ensureState();
    const guildId = resolveGuildId(window.location.search);

    renderRuleEditorContent();
    await Promise.all([loadRules(guildId, state), loadSettings(guildId, state)]);
    renderRuleEditorContent();
  }

  async function mount() {
    const state = ensureState();
    const guildId = resolveGuildId(window.location.search);

    renderContent();
    await Promise.all([loadRules(guildId, state), loadSettings(guildId, state)]);
  }

  return {
    mount,
    mountRuleEditor,
    renderContent,
    ensureState,
  };
}
