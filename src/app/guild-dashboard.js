import {
  MAX_AUTOMOD_RULES,
  MAX_REGEXES,
  MAX_WORDS,
  LHS_CATEGORIES,
  DEFAULT_LHS_THRESHOLD,
  IMAGE_MOD_FILTERS,
  IMAGE_MOD_ACTIONS,
  DEFAULT_IMAGE_MOD_SETTINGS,
} from "./constants.js";
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
  normalizeLHSSettings,
  formatLHSCategoryName,
  formatLHSCategoryDescription,
  normalizeImageModSettings,
  formatImageModFilterName,
  formatImageModFilterDescription,
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
const ESCALATION_ACTION_OPTIONS = ["timeout", "kick", "ban"];
const MAX_STAFF_PING_ROLES = 5;
const RULE_SEVERITY_OPTIONS = [
  { value: 1, label: "Low (log only)" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
];

const SETTINGS_PAGE_DEFS = [
  { key: "automod", label: "AutoMod", icon: "fa-shield-halved" },
  { key: "antispam", label: "Anti Spam", icon: "fa-comment-slash" },
  { key: "antiraid", label: "Anti Raid", icon: "fa-user-shield" },
  { key: "antinuke", label: "Anti Nuke", icon: "fa-bomb" },
];

function resolveSettingsPage(search) {
  const params = new URLSearchParams(search);
  const raw = String(params.get("page") || params.get("section") || "automod")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  return SETTINGS_PAGE_DEFS.some((entry) => entry.key === raw) ? raw : "automod";
}

function buildGuildDashboardUrl(guildId, pageKey) {
  const params = new URLSearchParams();
  params.set("guild_id", String(guildId || "").trim());
  params.set("page", pageKey || "automod");
  return `/pages/guild-dashboard.html?${params.toString()}`;
}

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

    if (target instanceof HTMLInputElement && snapshot.type === "number") {
      // Number inputs do not reliably support setSelectionRange; reset value to keep caret at the end.
      const currentValue = target.value;
      target.value = "";
      target.value = currentValue;
      return;
    }

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
        timeoutDuration: 10,
        escalationEnabled: false,
        escalationWarnThreshold: 1,
        escalationAction: "timeout",
        escalationTimeoutDuration: 10,
        escalationResetMinutes: 0,
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
        timeoutDuration: 10,
        escalationEnabled: false,
        escalationWarnThreshold: 1,
        escalationAction: "timeout",
        escalationTimeoutDuration: 10,
        escalationResetMinutes: 0,
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
        antiSpamEnabled: true,
        antiSpamMaxMessages: 5,
        antiSpamWindowSeconds: 3,
        antiSpamAlertCooldown: 10,
        antiSpamTimeoutEnabled: true,
        antiSpamTimeoutDuration: 30,
        antiSpamLogChannelId: "",
        antiSpamStaffRoleIds: "",
        antiRaidEnabled: true,
        antiRaidJoinThreshold: 8,
        antiRaidWindowSeconds: 12,
        antiRaidAlertCooldown: 30,
        antiRaidTimeoutEnabled: true,
        antiRaidTimeoutDuration: 30,
        antiRaidLogChannelId: "",
        antiRaidStaffRoleIds: "",
        antiNukeEnabled: true,
        antiNukeActionThreshold: 3,
        antiNukeWindowSeconds: 15,
        antiNukeAlertCooldown: 20,
        antiNukeTimeoutEnabled: true,
        antiNukeTimeoutDuration: 30,
        antiNukeLogChannelId: "",
        antiNukeStaffRoleIds: "",
      },
      automodSettingsOriginal: {
        logChannelId: "",
        staffRoleIds: "",
        exemptRoleIds: "",
        exemptChannelIds: "",
        exemptUserIds: "",
        antiSpamEnabled: true,
        antiSpamMaxMessages: 5,
        antiSpamWindowSeconds: 3,
        antiSpamAlertCooldown: 10,
        antiSpamTimeoutEnabled: true,
        antiSpamTimeoutDuration: 30,
        antiSpamLogChannelId: "",
        antiSpamStaffRoleIds: "",
        antiRaidEnabled: true,
        antiRaidJoinThreshold: 8,
        antiRaidWindowSeconds: 12,
        antiRaidAlertCooldown: 30,
        antiRaidTimeoutEnabled: true,
        antiRaidTimeoutDuration: 30,
        antiRaidLogChannelId: "",
        antiRaidStaffRoleIds: "",
        antiNukeEnabled: true,
        antiNukeActionThreshold: 3,
        antiNukeWindowSeconds: 15,
        antiNukeAlertCooldown: 20,
        antiNukeTimeoutEnabled: true,
        antiNukeTimeoutDuration: 30,
        antiNukeLogChannelId: "",
        antiNukeStaffRoleIds: "",
      },
      isLoadingSettings: false,
      isSavingSettings: false,
      keywordOverrides: {},
      presetSelections: {
        create: [],
        inlineEdit: [],
        editor: [],
      },
      // LHS (AI Moderation) state
      lhsSettings: {
        enabled: false,
        global_threshold: DEFAULT_LHS_THRESHOLD,
        categories: {},
        exemptRoleIds: "",
        exemptChannelIds: "",
        exemptUserIds: "",
        action: "delete",
        severity: 2,
        logOnlyMode: false,
      },
      lhsSettingsOriginal: null,
      isLoadingLHS: false,
      isSavingLHS: false,
      lhsExpanded: false, // UI state for collapsible section
      // Image Moderation state
      imageModSettings: {
        enabled: false,
        scan_attachments: true,
        scan_embeds: true,
        filters: JSON.parse(JSON.stringify(DEFAULT_IMAGE_MOD_SETTINGS.filters)),
        log_only_mode: false,
      },
      imageModSettingsOriginal: null,
      isLoadingImageMod: false,
      isSavingImageMod: false,
      imageModExpanded: false, // UI state for collapsible section
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
    const escalation = rule?.escalation || rule?.offense_escalation || rule?.offenseEscalation || {};

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
      timeoutDuration: Math.max(1, Number(rule?.timeout_duration ?? rule?.timeoutDuration ?? 10) || 10),
      escalationEnabled: Boolean(
        rule?.escalation_enabled ??
          rule?.escalationEnabled ??
          rule?.offense_escalation_enabled ??
          rule?.offenseEscalationEnabled ??
          escalation?.enabled ??
          escalation?.is_enabled ??
          false
      ),
      escalationWarnThreshold: Math.max(
        1,
        Number(
          rule?.escalation_warn_threshold ??
            rule?.escalationWarnThreshold ??
            rule?.offense_escalation_warn_threshold ??
            rule?.offenseEscalationWarnThreshold ??
            rule?.warn_threshold ??
            rule?.warnThreshold ??
            escalation?.warn_threshold ??
            escalation?.warnThreshold ??
            1
        ) || 1
      ),
      escalationAction: String(
        rule?.escalation_action ??
          rule?.escalationAction ??
          rule?.offense_escalation_action ??
          rule?.offenseEscalationAction ??
          escalation?.action ??
          "timeout"
      ),
      escalationTimeoutDuration: Math.max(
        1,
        Number(
          rule?.escalation_timeout_duration ??
            rule?.escalationTimeoutDuration ??
            rule?.offense_escalation_timeout_duration ??
            rule?.offenseEscalationTimeoutDuration ??
            escalation?.timeout_duration ??
            escalation?.timeoutDuration ??
            10
        ) || 10
      ),
      escalationResetMinutes: Math.max(
        0,
        Number(
          rule?.escalation_reset_minutes ??
            rule?.escalationResetMinutes ??
            rule?.offense_escalation_reset_minutes ??
            rule?.offenseEscalationResetMinutes ??
            rule?.reset_minutes ??
            rule?.resetMinutes ??
            escalation?.reset_minutes ??
            escalation?.resetMinutes ??
            0
        ) || 0
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
      timeoutDuration: Math.max(1, Number(form.timeoutDuration || 10)),
      escalationEnabled: Boolean(form.escalationEnabled),
      escalationWarnThreshold: Math.max(1, Number(form.escalationWarnThreshold || 1)),
      escalationAction: String(form.escalationAction || "timeout"),
      escalationTimeoutDuration: Math.max(1, Number(form.escalationTimeoutDuration || 10)),
      escalationResetMinutes: Math.max(0, Number(form.escalationResetMinutes || 0)),
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
      "timeoutDuration",
      "escalationEnabled",
      "escalationWarnThreshold",
      "escalationAction",
      "escalationTimeoutDuration",
      "escalationResetMinutes",
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
      case "timeoutDuration":
        return "timeout duration";
      case "escalationEnabled":
        return "escalation";
      case "escalationWarnThreshold":
        return "warn threshold";
      case "escalationAction":
        return "escalation action";
      case "escalationTimeoutDuration":
        return "escalation timeout";
      case "escalationResetMinutes":
        return "offense reset window";
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
      areIdListsEqual(expected.exemptUserIds, actual.exemptUserIds) &&
      Boolean(expected.antiSpamEnabled) === Boolean(actual.antiSpamEnabled) &&
      Number(expected.antiSpamMaxMessages) === Number(actual.antiSpamMaxMessages) &&
      Number(expected.antiSpamWindowSeconds) === Number(actual.antiSpamWindowSeconds) &&
      Number(expected.antiSpamAlertCooldown) === Number(actual.antiSpamAlertCooldown) &&
      Boolean(expected.antiSpamTimeoutEnabled) === Boolean(actual.antiSpamTimeoutEnabled) &&
      Number(expected.antiSpamTimeoutDuration) === Number(actual.antiSpamTimeoutDuration) &&
      String(expected.antiSpamLogChannelId || "").trim() === String(actual.antiSpamLogChannelId || "").trim() &&
      areIdListsEqual(expected.antiSpamStaffRoleIds, actual.antiSpamStaffRoleIds) &&
      Boolean(expected.antiRaidEnabled) === Boolean(actual.antiRaidEnabled) &&
      Number(expected.antiRaidJoinThreshold) === Number(actual.antiRaidJoinThreshold) &&
      Number(expected.antiRaidWindowSeconds) === Number(actual.antiRaidWindowSeconds) &&
      Number(expected.antiRaidAlertCooldown) === Number(actual.antiRaidAlertCooldown) &&
      Boolean(expected.antiRaidTimeoutEnabled) === Boolean(actual.antiRaidTimeoutEnabled) &&
      Number(expected.antiRaidTimeoutDuration) === Number(actual.antiRaidTimeoutDuration) &&
      String(expected.antiRaidLogChannelId || "").trim() === String(actual.antiRaidLogChannelId || "").trim() &&
      areIdListsEqual(expected.antiRaidStaffRoleIds, actual.antiRaidStaffRoleIds) &&
      Boolean(expected.antiNukeEnabled) === Boolean(actual.antiNukeEnabled) &&
      Number(expected.antiNukeActionThreshold) === Number(actual.antiNukeActionThreshold) &&
      Number(expected.antiNukeWindowSeconds) === Number(actual.antiNukeWindowSeconds) &&
      Number(expected.antiNukeAlertCooldown) === Number(actual.antiNukeAlertCooldown) &&
      Boolean(expected.antiNukeTimeoutEnabled) === Boolean(actual.antiNukeTimeoutEnabled) &&
      Number(expected.antiNukeTimeoutDuration) === Number(actual.antiNukeTimeoutDuration) &&
      String(expected.antiNukeLogChannelId || "").trim() === String(actual.antiNukeLogChannelId || "").trim() &&
      areIdListsEqual(expected.antiNukeStaffRoleIds, actual.antiNukeStaffRoleIds)
    );
  }

  function toComparableSettingsForm(form = {}) {
    return {
      logChannelId: String(form.logChannelId || "").trim(),
      staffRoleIds: String(form.staffRoleIds || "").trim(),
      exemptRoleIds: String(form.exemptRoleIds || "").trim(),
      exemptChannelIds: String(form.exemptChannelIds || "").trim(),
      exemptUserIds: String(form.exemptUserIds || "").trim(),
      antiSpamEnabled: Boolean(form.antiSpamEnabled),
      antiSpamMaxMessages: Math.max(1, Number(form.antiSpamMaxMessages || 5)),
      antiSpamWindowSeconds: Math.max(1, Number(form.antiSpamWindowSeconds || 3)),
      antiSpamAlertCooldown: Math.max(1, Number(form.antiSpamAlertCooldown || 10)),
      antiSpamTimeoutEnabled: Boolean(form.antiSpamTimeoutEnabled),
      antiSpamTimeoutDuration: Math.max(5, Number(form.antiSpamTimeoutDuration || 30)),
      antiSpamLogChannelId: String(form.antiSpamLogChannelId || "").trim(),
      antiSpamStaffRoleIds: String(form.antiSpamStaffRoleIds || "").trim(),
      antiRaidEnabled: Boolean(form.antiRaidEnabled),
      antiRaidJoinThreshold: Math.max(1, Number(form.antiRaidJoinThreshold || 8)),
      antiRaidWindowSeconds: Math.max(1, Number(form.antiRaidWindowSeconds || 12)),
      antiRaidAlertCooldown: Math.max(1, Number(form.antiRaidAlertCooldown || 30)),
      antiRaidTimeoutEnabled: Boolean(form.antiRaidTimeoutEnabled),
      antiRaidTimeoutDuration: Math.max(5, Number(form.antiRaidTimeoutDuration || 30)),
      antiRaidLogChannelId: String(form.antiRaidLogChannelId || "").trim(),
      antiRaidStaffRoleIds: String(form.antiRaidStaffRoleIds || "").trim(),
      antiNukeEnabled: Boolean(form.antiNukeEnabled),
      antiNukeActionThreshold: Math.max(1, Number(form.antiNukeActionThreshold || 3)),
      antiNukeWindowSeconds: Math.max(1, Number(form.antiNukeWindowSeconds || 15)),
      antiNukeAlertCooldown: Math.max(1, Number(form.antiNukeAlertCooldown || 20)),
      antiNukeTimeoutEnabled: Boolean(form.antiNukeTimeoutEnabled),
      antiNukeTimeoutDuration: Math.max(5, Number(form.antiNukeTimeoutDuration || 30)),
      antiNukeLogChannelId: String(form.antiNukeLogChannelId || "").trim(),
      antiNukeStaffRoleIds: String(form.antiNukeStaffRoleIds || "").trim(),
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

  function renderLeftSidebar({
    guildId,
    guildName,
    guildIconUrl,
    activePage,
    sidebarId,
    activeRuleEditor,
    showRuleEditorLink,
    ruleEditorUrl,
  }) {
    const sidebar = document.getElementById(sidebarId);
    if (!sidebar) {
      return;
    }

    const editorActiveClass = activeRuleEditor ? "sidebar-active" : "";

    sidebar.innerHTML = `
      <nav class="sidebar-nav" aria-label="Guild settings navigation">
        <div class="nav-section">
          <p class="nav-label">Guild</p>
          <div class="user-profile">
            <img class="user-pfp" src="${guildIconUrl}" alt="${escapeHtml(guildName)} icon" loading="lazy" data-fallback-image="true" />
            <p class="user-greeting">${escapeHtml(guildName)}</p>
          </div>
          <ul>
            <li>
              <a href="/pages/dashboard.html">
                <i class="fa-solid fa-arrow-left"></i><span>Back to Guilds</span>
              </a>
            </li>
          </ul>
        </div>

        <div class="nav-section">
          <span class="section-title">Protection Pages</span>
          <ul>
            ${SETTINGS_PAGE_DEFS.map((entry) => {
              const activeClass = activePage === entry.key ? "sidebar-active" : "";
              return `
                <li>
                  <a class="${activeClass}" href="${buildGuildDashboardUrl(guildId, entry.key)}" data-settings-page-link="${entry.key}">
                    <i class="fa-solid ${entry.icon}"></i><span>${escapeHtml(entry.label)}</span>
                  </a>
                </li>
              `;
            }).join("")}
            ${
              showRuleEditorLink
                ? `<li>
              <a class="${editorActiveClass}" href="${ruleEditorUrl || `/pages/rule-editor.html?guild_id=${encodeURIComponent(String(guildId || "").trim())}`}">
                <i class="fa-solid fa-pen-to-square"></i><span>Rule Editor</span>
              </a>
            </li>`
                : ""
            }
          </ul>
        </div>
      </nav>
    `;
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
    const activeSettingsPage = resolveSettingsPage(window.location.search);
    const activePageLabel =
      SETTINGS_PAGE_DEFS.find((entry) => entry.key === activeSettingsPage)?.label || "AutoMod";
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

    renderLeftSidebar({
      guildId,
      guildName,
      guildIconUrl,
      activePage: activeSettingsPage,
      sidebarId: "guild-dashboard-sidebar",
      activeRuleEditor: false,
      showRuleEditorLink: false,
      ruleEditorUrl: "",
    });

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

                        ${state.editingRuleForm.action === "timeout" ? `
                        <label class="automod-rule-label">
                          Timeout Duration (minutes)
                          <input name="timeoutDuration" type="number" min="1" step="1" value="${escapeHtml(String(state.editingRuleForm.timeoutDuration || 10))}" data-edit-input />
                          <span class="field-hint">How long the user will be timed out when this rule triggers.</span>
                        </label>
                        ` : ""}

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
                          <input type="checkbox" name="escalationEnabled" ${state.editingRuleForm.escalationEnabled ? "checked" : ""} data-edit-input />
                          Enable offense escalation
                        </label>

                        ${state.editingRuleForm.escalationEnabled ? `
                        <label class="automod-rule-label">
                          Warn Threshold
                          <input name="escalationWarnThreshold" type="number" min="1" step="1" value="${escapeHtml(String(state.editingRuleForm.escalationWarnThreshold || 1))}" data-edit-input />
                          <span class="field-hint">Warnings before escalating to the action below.</span>
                        </label>
                        <label class="automod-rule-label">
                          Escalation Action
                          <select name="escalationAction" data-edit-input>
                            ${ESCALATION_ACTION_OPTIONS.map(
                              (action) =>
                                `<option value="${escapeHtml(action)}" ${state.editingRuleForm.escalationAction === action ? "selected" : ""}>${escapeHtml(formatActionLabel(action))}</option>`
                            ).join("")}
                          </select>
                        </label>
                        ${state.editingRuleForm.escalationAction === "timeout" ? `
                        <label class="automod-rule-label">
                          Escalation Timeout Duration (minutes)
                          <input name="escalationTimeoutDuration" type="number" min="1" step="1" value="${escapeHtml(String(state.editingRuleForm.escalationTimeoutDuration || 10))}" data-edit-input />
                        </label>
                        ` : ""}
                        <label class="automod-rule-label">
                          Offense Reset Window (minutes)
                          <input name="escalationResetMinutes" type="number" min="0" step="1" value="${escapeHtml(String(state.editingRuleForm.escalationResetMinutes ?? 0))}" data-edit-input />
                          <span class="field-hint">Set to 0 to never reset.</span>
                        </label>
                        ` : ""}

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

    const isAutomodPage = activeSettingsPage === "automod";
    const isAntiSpamPage = activeSettingsPage === "antispam";
    const isAntiRaidPage = activeSettingsPage === "antiraid";
    const isAntiNukePage = activeSettingsPage === "antinuke";

    const settingsFieldsHtml = `
      ${
        isAutomodPage
          ? `
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
          `
          : ""
      }

      ${
        isAntiSpamPage
          ? `
            <h4 class="automod-rules-title">Anti Spam Settings</h4>

            <div class="settings-hero-card">
              <div class="settings-hero-copy">
                <span class="settings-kicker">Protection Status</span>
                <strong>Anti Spam protection</strong>
                <p>Detect repeated message bursts, slow down alerts, and optionally auto-timeout the sender.</p>
              </div>

              <label class="automod-enabled-label settings-toggle-card">
                <input type="checkbox" name="antiSpamEnabled" ${state.automodSettingsForm.antiSpamEnabled ? "checked" : ""} />
                <span>Enable Anti Spam</span>
              </label>
            </div>

            <section class="settings-subgroup">
              <div class="settings-subgroup-header">
                <h5>Detection</h5>
                <p>Choose how aggressive the spam detector should be.</p>
              </div>
              <div class="settings-subgroup-grid">
                <label class="automod-rule-label">
                  Max Messages
                  <input name="antiSpamMaxMessages" type="number" min="1" step="1" value="${escapeHtml(state.automodSettingsForm.antiSpamMaxMessages)}" />
                </label>

                <label class="automod-rule-label">
                  Window Seconds
                  <input name="antiSpamWindowSeconds" type="number" min="1" step="1" value="${escapeHtml(state.automodSettingsForm.antiSpamWindowSeconds)}" />
                </label>
              </div>
            </section>
        //Merge conflict
        //   <label class="automod-rule-label">
        //     Exempt User IDs (comma-separated)
        //     <input name="exemptUserIds" value="${escapeHtml(state.automodSettingsForm.exemptUserIds)}" placeholder="555555555555555555, 666666666666666666" />
        //   </label>
        // </section>
        //
        // <!-- LHS (AI Moderation) Settings Section -->
        // <section class="lhs-settings-section content-section" id="lhs-settings-section">
        //   <div class="lhs-header" id="lhs-header-toggle">
        //     <h4 class="automod-rules-title">
        //       <i class="fa-solid fa-robot"></i>
        //       AI Moderation (LHS)
        //       <span class="lhs-status-badge ${state.lhsSettings.enabled ? 'enabled' : 'disabled'}">
        //         ${state.lhsSettings.enabled ? 'Enabled' : 'Disabled'}
        //       </span>
        //     </h4>
        //     <button type="button" class="action-btn secondary" id="lhs-toggle-expand">
        //       ${state.lhsExpanded ? 'Collapse' : 'Expand'}
        //     </button>
        //   </div>
        //
        //   ${state.lhsExpanded ? `
        //   <div class="lhs-content">
        //     <p class="field-hint lhs-description">
        //       LHS (Language Harm Scanner) uses AI to detect harmful content across 11 categories. 
        //       By default, this feature is disabled and must be explicitly enabled.
        //     </p>
        //
        //     ${state.isLoadingLHS ? '<p class="subtitle">Loading AI moderation settings...</p>' : ''}
        //
        //     <div class="lhs-form" id="lhs-form">
        //       <!-- Master Enable Toggle -->
        //       <label class="automod-enabled-label lhs-master-toggle">
        //         <input type="checkbox" name="lhsEnabled" ${state.lhsSettings.enabled ? "checked" : ""} />
        //         <strong>Enable AI Moderation</strong>
        //         <span class="field-hint">When enabled, messages will be analyzed by the AI model</span>
        //       </label>
        //
        //       <!-- Global Threshold -->
        //       <label class="automod-rule-label">
        //         Global Threshold
        //         <input 
        //           type="range" 
        //           name="lhsGlobalThreshold" 
        //           min="0" 
        //           max="1" 
        //           step="0.01" 
        //           value="${state.lhsSettings.global_threshold}" 
        //         />
        //         <span class="threshold-value">${(state.lhsSettings.global_threshold * 100).toFixed(0)}%</span>
        //         <span class="field-hint">Default: 55%. Lower values = more strict, higher values = more lenient</span>
        //       </label>
        //
        //       <!-- Action Settings -->
        //       <div class="lhs-action-settings">
        //         <label class="automod-rule-label">
        //           Default Action
        //           <select name="lhsAction">
        //             ${RULE_ACTION_OPTIONS.map(
        //               (action) =>
        //                 `<option value="${escapeHtml(action)}" ${state.lhsSettings.action === action ? "selected" : ""}>${escapeHtml(formatActionLabel(action))}</option>`
        //             ).join("")}
        //           </select>
        //         </label>
        //
        //         <label class="automod-rule-label">
        //           Severity Level
        //           <select name="lhsSeverity">
        //             ${RULE_SEVERITY_OPTIONS.map(
        //               (option) =>
        //                 `<option value="${option.value}" ${Number(state.lhsSettings.severity || 2) === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
        //             ).join("")}
        //           </select>
        //           <span class="field-hint">Low severity only logs violations without taking action</span>
        //         </label>
        //
        //         <label class="automod-enabled-label">
        //           <input type="checkbox" name="lhsLogOnlyMode" ${state.lhsSettings.logOnlyMode ? "checked" : ""} />
        //           Log Only Mode (no actions taken)
        //         </label>
        //       </div>
        //
        //       <!-- Exemptions -->
        //       <div class="lhs-exemptions">
        //         <h5>Exemptions</h5>
        //
        //         <label class="automod-rule-label">
        //           Exempt Role IDs (comma-separated)
        //           <input name="lhsExemptRoleIds" value="${escapeHtml(state.lhsSettings.exemptRoleIds)}" placeholder="111111111111111111, 222222222222222222" />
        //         </label>
        //
        //         <label class="automod-rule-label">
        //           Exempt Channel IDs (comma-separated)
        //           <input name="lhsExemptChannelIds" value="${escapeHtml(state.lhsSettings.exemptChannelIds)}" placeholder="333333333333333333, 444444444444444444" />
        //         </label>
        //
        //         <label class="automod-rule-label">
        //           Exempt User IDs (comma-separated)
        //           <input name="lhsExemptUserIds" value="${escapeHtml(state.lhsSettings.exemptUserIds)}" placeholder="555555555555555555, 666666666666666666" />
        //         </label>
        //       </div>
        //
        //       <!-- Category Toggles -->
        //       <div class="lhs-categories">
        //         <h5>Detection Categories</h5>
        //         <p class="field-hint">Enable/disable individual detection categories and set per-category thresholds</p>
        //
        //         <div class="lhs-category-grid">
        //           ${LHS_CATEGORIES.map((cat) => {
        //             const catSettings = state.lhsSettings.categories[cat.id] || { enabled: true, threshold: state.lhsSettings.global_threshold };
        //             return `
        //               <div class="lhs-category-item">
        //                 <label class="lhs-category-toggle">
        //                   <input type="checkbox" name="lhsCat_${cat.id}" ${catSettings.enabled !== false ? "checked" : ""} />
        //                   <span class="lhs-category-name">${escapeHtml(cat.name)}</span>
        //                 </label>
        //                 <label class="lhs-category-threshold">
        //                   <input 
        //                     type="range" 
        //                     name="lhsCatThreshold_${cat.id}" 
        //                     min="0" 
        //                     max="1" 
        //                     step="0.01" 
        //                     value="${catSettings.threshold || state.lhsSettings.global_threshold}" 
        //                     ${catSettings.enabled === false ? "disabled" : ""}
        //                   />
        //                   <span class="threshold-value">${((catSettings.threshold || state.lhsSettings.global_threshold) * 100).toFixed(0)}%</span>
        //                 </label>
        //                 <span class="field-hint">${escapeHtml(cat.description)}</span>
        //               </div>
        //             `;
        //           }).join("")}
        //         </div>
        //       </div>
        //
        //       <!-- Save Button -->
        //       <div class="lhs-actions">
        //         <button type="button" class="action-btn" id="lhs-save-btn" ${state.isSavingLHS ? "disabled" : ""}>
        //           ${state.isSavingLHS ? "Saving..." : "Save AI Moderation Settings"}
        //         </button>
        //         ${state.lhsSettingsOriginal ? `
        //           <button type="button" class="action-btn secondary" id="lhs-reset-btn">
        //             Reset Changes
        //           </button>
        //         ` : ""}
        //       </div>
        //
        //       ${isDevMode ? `
        //       <!-- Dev Mode Preview -->
        //       <div class="dev-mode-preview">
        //         <h5><i class="fa-solid fa-code"></i> Dev Mode: Settings Preview</h5>
        //         <pre class="preview-content">${escapeHtml(JSON.stringify({
        //           enabled: state.lhsSettings.enabled,
        //           global_threshold: state.lhsSettings.global_threshold,
        //           action: state.lhsSettings.action,
        //           severity: state.lhsSettings.severity,
        //           log_only_mode: state.lhsSettings.logOnlyMode,
        //           categories: state.lhsSettings.categories,
        //         }, null, 2))}</pre>
        //       </div>
        //       ` : ''}
        //     </div>
        //   </div>
        //   ` : ''}
        // </section>
        //
        // <!-- Image Moderation Settings Section -->
        // <section class="lhs-settings-section content-section image-mod-section" id="image-mod-section">
        //   <div class="lhs-header" id="image-mod-header-toggle">
        //     <h4 class="automod-rules-title">
        //       <i class="fa-solid fa-image"></i>
        //       AI Image Moderation
        //       <span class="lhs-status-badge ${state.imageModSettings.enabled ? 'enabled' : 'disabled'}">
        //         ${state.imageModSettings.enabled ? 'Enabled' : 'Disabled'}
        //       </span>
        //     </h4>
        //     <button type="button" class="action-btn secondary" id="image-mod-toggle-expand">
        //       ${state.imageModExpanded ? 'Collapse' : 'Expand'}
        //     </button>
        //   </div>
        //
        //   ${state.imageModExpanded ? `
        //   <div class="lhs-content">
        //     <p class="field-hint lhs-description">
        //       AI Image Moderation scans images, GIFs, and videos for NSFW content using machine learning classification.
        //       By default, this feature is disabled and must be explicitly enabled.
        //     </p>
        //
        //     ${state.isLoadingImageMod ? '<p class="subtitle">Loading image moderation settings...</p>' : ''}
        //
        //     <div class="lhs-form" id="image-mod-form">
        //       <!-- Master Enable Toggle -->
        //       <label class="automod-enabled-label lhs-master-toggle">
        //         <input type="checkbox" name="imgModEnabled" ${state.imageModSettings.enabled ? "checked" : ""} />
        //         <strong>Enable AI Image Moderation</strong>
        //         <span class="field-hint">When enabled, images and videos will be scanned by the AI model</span>
        //       </label>
        //
        //       <!-- Scan Settings -->
        //       <div class="lhs-action-settings">
        //         <label class="automod-enabled-label">
        //           <input type="checkbox" name="imgModScanAttachments" ${state.imageModSettings.scan_attachments ? "checked" : ""} />
        //           Scan Attachments
        //         </label>
        //         <label class="automod-enabled-label">
        //           <input type="checkbox" name="imgModScanEmbeds" ${state.imageModSettings.scan_embeds ? "checked" : ""} />
        //           Scan Embeds (Tenor, Imgur, etc.)
        //         </label>
        //         <label class="automod-enabled-label">
        //           <input type="checkbox" name="imgModLogOnly" ${state.imageModSettings.log_only_mode ? "checked" : ""} />
        //           Log Only Mode (no actions taken)
        //         </label>
        //       </div>
        //
        //       <!-- Detection Filters -->
        //       <div class="lhs-categories">
        //         <h5>Detection Filters</h5>
        //         <p class="field-hint">Enable filters, set threshold (lower = more strict), and choose action per filter.</p>
        //
        //         <div class="lhs-category-grid">
        //           ${IMAGE_MOD_FILTERS.map((filter) => {
        //             const filterSettings = state.imageModSettings.filters[filter.id] || { enabled: false, threshold: filter.defaultThreshold, action: "delete" };
        //             const isCsam = filter.id === 'csam_check';
        //             return `
        //               <div class="lhs-category-item ${isCsam ? 'critical' : ''}">
        //                 <label class="lhs-category-toggle">
        //                   <input type="checkbox" name="imgModFilter_${filter.id}" ${filterSettings.enabled ? "checked" : ""} />
        //                   <span class="lhs-category-name ${isCsam ? 'critical-label' : ''}">
        //                     ${isCsam ? '<i class="fa-solid fa-shield-halved"></i> ' : ''}${escapeHtml(filter.name)}
        //                   </span>
        //                 </label>
        //                 <label class="lhs-category-threshold">
        //                   <input 
        //                     type="range" 
        //                     name="imgModThreshold_${filter.id}" 
        //                     min="0" 
        //                     max="1" 
        //                     step="0.01" 
        //                     value="${filterSettings.threshold}" 
        //                     ${!filterSettings.enabled ? 'disabled' : ''}
        //                   />
        //                   <span class="threshold-value">${(filterSettings.threshold * 100).toFixed(0)}%</span>
        //                 </label>
        //                 <label class="automod-rule-label" style="margin-top: 0.5rem;">
        //                   <select name="imgModAction_${filter.id}" ${!filterSettings.enabled ? 'disabled' : ''}>
        //                     ${IMAGE_MOD_ACTIONS.map(
        //                       (action) =>
        //                         `<option value="${escapeHtml(action)}" ${filterSettings.action === action ? "selected" : ""}>${escapeHtml(formatActionLabel(action))}</option>`
        //                     ).join("")}
        //                   </select>
        //                 </label>
        //                 <span class="field-hint">${escapeHtml(filter.description)}</span>
        //               </div>
        //             `;
        //           }).join("")}
        //         </div>
        //       </div>
        //
        //       <!-- Save Button -->
        //       <div class="lhs-actions">
        //         <button type="button" class="action-btn" id="image-mod-save-btn" ${state.isSavingImageMod ? "disabled" : ""}>
        //           ${state.isSavingImageMod ? "Saving..." : "Save Image Moderation Settings"}
        //         </button>
        //         ${state.imageModSettingsOriginal ? `
        //           <button type="button" class="action-btn secondary" id="image-mod-reset-btn">
        //             Reset Changes
        //           </button>
        //         ` : ""}
        //       </div>
        //
        //       ${isDevMode ? `
        //       <!-- Dev Mode Preview -->
        //       <div class="dev-mode-preview">
        //         <h5><i class="fa-solid fa-code"></i> Dev Mode: Settings Preview</h5>
        //         <pre class="preview-content">${escapeHtml(JSON.stringify(state.imageModSettings, null, 2))}</pre>
        //       </div>
        //       ` : ''}
        //     </div>
        //   </div>
        //   ` : ''}

            <section class="settings-subgroup">
              <div class="settings-subgroup-header">
                <h5>Enforcement</h5>
                <p>Control alert throttling and whether offenders get timed out automatically.</p>
              </div>
              <div class="settings-subgroup-grid">
                <label class="automod-rule-label">
                  Alert Cooldown (seconds)
                  <input name="antiSpamAlertCooldown" type="number" min="1" step="1" value="${escapeHtml(state.automodSettingsForm.antiSpamAlertCooldown)}" />
                </label>

                <label class="automod-enabled-label settings-inline-toggle">
                  <input type="checkbox" name="antiSpamTimeoutEnabled" ${state.automodSettingsForm.antiSpamTimeoutEnabled ? "checked" : ""} />
                  <span>Timeout Enabled</span>
                </label>

                <label class="automod-rule-label settings-subgroup-wide">
                  Timeout Duration (seconds)
                  <input name="antiSpamTimeoutDuration" type="number" min="5" step="1" value="${escapeHtml(state.automodSettingsForm.antiSpamTimeoutDuration)}" />
                </label>
              </div>
            </section>

            <section class="settings-subgroup">
              <div class="settings-subgroup-header">
                <h5>Alert Routing</h5>
                <p>Pick where alerts go and which staff roles get pinged.</p>
              </div>
              <div class="settings-subgroup-grid">
                <label class="automod-rule-label">
                  Log Channel ID
                  <input name="antiSpamLogChannelId" value="${escapeHtml(state.automodSettingsForm.antiSpamLogChannelId)}" placeholder="123456789012345678" />
                </label>

                <label class="automod-rule-label">
                  Staff Ping Role IDs (max 5, comma-separated)
                  <input name="antiSpamStaffRoleIds" value="${escapeHtml(state.automodSettingsForm.antiSpamStaffRoleIds)}" placeholder="111111111111111111, 222222222222222222" />
                  <span class="token-counter">${parseCommaSeparated(state.automodSettingsForm.antiSpamStaffRoleIds).length} / ${MAX_STAFF_PING_ROLES} roles</span>
                </label>
              </div>
            </section>
          `
          : ""
      }

      ${
        isAntiRaidPage
          ? `
            <h4 class="automod-rules-title">Anti Raid Settings</h4>

            <div class="settings-hero-card">
              <div class="settings-hero-copy">
                <span class="settings-kicker">Protection Status</span>
                <strong>Anti Raid protection</strong>
                <p>Track suspicious join bursts, avoid noisy repeats, and escalate automatically when needed.</p>
              </div>

              <label class="automod-enabled-label settings-toggle-card">
                <input type="checkbox" name="antiRaidEnabled" ${state.automodSettingsForm.antiRaidEnabled ? "checked" : ""} />
                <span>Enable Anti Raid</span>
              </label>
            </div>

            <section class="settings-subgroup">
              <div class="settings-subgroup-header">
                <h5>Detection</h5>
                <p>Define what counts as a raid wave.</p>
              </div>
              <div class="settings-subgroup-grid">
                <label class="automod-rule-label">
                  Join Threshold
                  <input name="antiRaidJoinThreshold" type="number" min="1" step="1" value="${escapeHtml(state.automodSettingsForm.antiRaidJoinThreshold)}" />
                </label>

                <label class="automod-rule-label">
                  Window Seconds
                  <input name="antiRaidWindowSeconds" type="number" min="1" step="1" value="${escapeHtml(state.automodSettingsForm.antiRaidWindowSeconds)}" />
                </label>
              </div>
            </section>

            <section class="settings-subgroup">
              <div class="settings-subgroup-header">
                <h5>Enforcement</h5>
                <p>Control how often staff gets alerted and whether incoming raiders are timed out.</p>
              </div>
              <div class="settings-subgroup-grid">
                <label class="automod-rule-label">
                  Alert Cooldown (seconds)
                  <input name="antiRaidAlertCooldown" type="number" min="1" step="1" value="${escapeHtml(state.automodSettingsForm.antiRaidAlertCooldown)}" />
                </label>

                <label class="automod-enabled-label settings-inline-toggle">
                  <input type="checkbox" name="antiRaidTimeoutEnabled" ${state.automodSettingsForm.antiRaidTimeoutEnabled ? "checked" : ""} />
                  <span>Timeout Enabled</span>
                </label>

                <label class="automod-rule-label settings-subgroup-wide">
                  Timeout Duration (seconds)
                  <input name="antiRaidTimeoutDuration" type="number" min="5" step="1" value="${escapeHtml(state.automodSettingsForm.antiRaidTimeoutDuration)}" />
                </label>
              </div>
            </section>

            <section class="settings-subgroup">
              <div class="settings-subgroup-header">
                <h5>Alert Routing</h5>
                <p>Set a log channel and the roles that should be mentioned during a raid alert.</p>
              </div>
              <div class="settings-subgroup-grid">
                <label class="automod-rule-label">
                  Log Channel ID
                  <input name="antiRaidLogChannelId" value="${escapeHtml(state.automodSettingsForm.antiRaidLogChannelId)}" placeholder="123456789012345678" />
                </label>

                <label class="automod-rule-label">
                  Staff Ping Role IDs (max 5, comma-separated)
                  <input name="antiRaidStaffRoleIds" value="${escapeHtml(state.automodSettingsForm.antiRaidStaffRoleIds)}" placeholder="111111111111111111, 222222222222222222" />
                  <span class="token-counter">${parseCommaSeparated(state.automodSettingsForm.antiRaidStaffRoleIds).length} / ${MAX_STAFF_PING_ROLES} roles</span>
                </label>
              </div>
            </section>
          `
          : ""
      }

      ${
        isAntiNukePage
          ? `
            <h4 class="automod-rules-title">Anti Nuke Settings</h4>

            <div class="settings-hero-card">
              <div class="settings-hero-copy">
                <span class="settings-kicker">Protection Status</span>
                <strong>Anti Nuke protection</strong>
                <p>Detect destructive moderation bursts, rate-limit staff alerts, and optionally time out the actor.</p>
              </div>

              <label class="automod-enabled-label settings-toggle-card">
                <input type="checkbox" name="antiNukeEnabled" ${state.automodSettingsForm.antiNukeEnabled ? "checked" : ""} />
                <span>Enable Anti Nuke</span>
              </label>
            </div>

            <section class="settings-subgroup">
              <div class="settings-subgroup-header">
                <h5>Detection</h5>
                <p>Set how many destructive actions within a short period should trigger protection.</p>
              </div>
              <div class="settings-subgroup-grid">
                <label class="automod-rule-label">
                  Action Threshold
                  <input name="antiNukeActionThreshold" type="number" min="1" step="1" value="${escapeHtml(state.automodSettingsForm.antiNukeActionThreshold)}" />
                </label>

                <label class="automod-rule-label">
                  Window Seconds
                  <input name="antiNukeWindowSeconds" type="number" min="1" step="1" value="${escapeHtml(state.automodSettingsForm.antiNukeWindowSeconds)}" />
                </label>
              </div>
            </section>

            <section class="settings-subgroup">
              <div class="settings-subgroup-header">
                <h5>Enforcement</h5>
                <p>Throttle repeated alerts and decide whether the triggered user is timed out automatically.</p>
              </div>
              <div class="settings-subgroup-grid">
                <label class="automod-rule-label">
                  Alert Cooldown (seconds)
                  <input name="antiNukeAlertCooldown" type="number" min="1" step="1" value="${escapeHtml(state.automodSettingsForm.antiNukeAlertCooldown)}" />
                </label>

                <label class="automod-enabled-label settings-inline-toggle">
                  <input type="checkbox" name="antiNukeTimeoutEnabled" ${state.automodSettingsForm.antiNukeTimeoutEnabled ? "checked" : ""} />
                  <span>Timeout Enabled</span>
                </label>

                <label class="automod-rule-label settings-subgroup-wide">
                  Timeout Duration (seconds)
                  <input name="antiNukeTimeoutDuration" type="number" min="5" step="1" value="${escapeHtml(state.automodSettingsForm.antiNukeTimeoutDuration)}" />
                </label>
              </div>
            </section>

            <section class="settings-subgroup">
              <div class="settings-subgroup-header">
                <h5>Alert Routing</h5>
                <p>Set where anti-nuke alerts land and who gets pinged when protection triggers.</p>
              </div>
              <div class="settings-subgroup-grid">
                <label class="automod-rule-label">
                  Log Channel ID
                  <input name="antiNukeLogChannelId" value="${escapeHtml(state.automodSettingsForm.antiNukeLogChannelId)}" placeholder="123456789012345678" />
                </label>

                <label class="automod-rule-label">
                  Staff Ping Role IDs (max 5, comma-separated)
                  <input name="antiNukeStaffRoleIds" value="${escapeHtml(state.automodSettingsForm.antiNukeStaffRoleIds)}" placeholder="111111111111111111, 222222222222222222" />
                  <span class="token-counter">${parseCommaSeparated(state.automodSettingsForm.antiNukeStaffRoleIds).length} / ${MAX_STAFF_PING_ROLES} roles</span>
                </label>
              </div>
            </section>
          `
          : ""
      }
    `;

    root.innerHTML = `
      <section class="dashboard-card guild-summary-card">
        <img class="guild-icon-image" src="${guildIconUrl}" alt="${escapeHtml(guildName)} icon" loading="lazy" data-fallback-image="true" />
        <h3>${escapeHtml(guildName)}</h3>
        <p class="card-label">Guild ID: ${escapeHtml(guildId)}</p>
      </section>

      <section class="content-section">
        <h3>${escapeHtml(activePageLabel)} Page</h3>

        <section class="automod-settings-form" id="automod-settings-form">
          ${settingsFieldsHtml}

          ${
            isAutomodPage
              ? ""
              : `<button class="action-btn" type="button" id="save-page-settings" ${state.isSavingSettings ? "disabled" : ""}>${
                  state.isSavingSettings ? "Saving..." : "Save Settings"
                }</button>`
          }
        </section>

        ${
          isAutomodPage
            ? `
        <form class="automod-form" id="automod-create-form">
          <div class="settings-hero-card rule-builder-hero">
            <div class="settings-hero-copy">
              <span class="settings-kicker">Rule Builder</span>
              <strong>Create an AutoMod rule</strong>
              <p>Start from a preset or build your own rule with keywords, regex filters, and response settings.</p>
            </div>

            <label class="automod-rule-label settings-toggle-card rule-builder-name-card">
              Rule Name
              <input name="name" value="${escapeHtml(state.automodForm.name)}" list="automod-rule-name-presets" required />
            </label>
          </div>

          <section class="settings-subgroup">
            <div class="settings-subgroup-header">
              <h5>Presets</h5>
              <p>Use presets as a starting point, then refine the rule below.</p>
            </div>
            <label class="automod-rule-label automod-preset-control rule-builder-preset-control">
              Preset Library
              <div class="preset-toggle-list" role="group" aria-label="Create presets">
                ${RULE_NAME_PRESETS.map(
                  (name) =>
                    `<button class="preset-toggle-btn ${createSelectedPresets.includes(name) ? "is-active" : ""}" type="button" data-preset-toggle data-preset-context="create" data-preset-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`
                ).join("")}
              </div>
              <span class="field-hint">Click presets to toggle them on or off.</span>
            </label>
          </section>

          <section class="settings-subgroup">
            <div class="settings-subgroup-header">
              <h5>Matching Logic</h5>
              <p>Define what content should trigger this rule and what should be allowed through.</p>
            </div>
            <div class="settings-subgroup-grid">
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

              <label class="automod-rule-label settings-subgroup-wide">
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
            </div>
          </section>

          <section class="settings-subgroup">
            <div class="settings-subgroup-header">
              <h5>Response</h5>
              <p>Choose how the bot should react when the rule matches.</p>
            </div>
            <div class="settings-subgroup-grid">
              <label class="automod-rule-label">
                Action
                <select name="action">
                  ${RULE_ACTION_OPTIONS.map(
                    (action) =>
                      `<option value="${escapeHtml(action)}" ${state.automodForm.action === action ? "selected" : ""}>${escapeHtml(formatActionLabel(action))}</option>`
                  ).join("")}
                </select>
              </label>

              ${state.automodForm.action === "timeout" ? `
              <label class="automod-rule-label">
                Timeout Duration (minutes)
                <input name="timeoutDuration" type="number" min="1" step="1" value="${escapeHtml(String(state.automodForm.timeoutDuration || 10))}" />
                <span class="field-hint">How long the user will be timed out when this rule triggers.</span>
              </label>
              ` : ""}

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
            </div>
          </section>

          <section class="settings-subgroup">
            <div class="settings-subgroup-header">
              <h5>Offense Escalation</h5>
              <p>Automatically escalate repeat violations through a configurable punishment ladder.</p>
            </div>
            <div class="settings-subgroup-grid">
              <label class="automod-enabled-label">
                <input type="checkbox" name="escalationEnabled" ${state.automodForm.escalationEnabled ? "checked" : ""} />
                Enable offense escalation
              </label>
              ${state.automodForm.escalationEnabled ? `
              <label class="automod-rule-label">
                Warn Threshold
                <input name="escalationWarnThreshold" type="number" min="1" step="1" value="${escapeHtml(String(state.automodForm.escalationWarnThreshold || 1))}" />
                <span class="field-hint">Number of warnings to issue before escalating. After this many offenses the escalation action fires instead.</span>
              </label>
              <label class="automod-rule-label">
                Escalation Action
                <select name="escalationAction">
                  ${ESCALATION_ACTION_OPTIONS.map(
                    (action) =>
                      `<option value="${escapeHtml(action)}" ${state.automodForm.escalationAction === action ? "selected" : ""}>${escapeHtml(formatActionLabel(action))}</option>`
                  ).join("")}
                </select>
                <span class="field-hint">Action taken once the warn threshold is exceeded.</span>
              </label>
              ${state.automodForm.escalationAction === "timeout" ? `
              <label class="automod-rule-label">
                Escalation Timeout Duration (minutes)
                <input name="escalationTimeoutDuration" type="number" min="1" step="1" value="${escapeHtml(String(state.automodForm.escalationTimeoutDuration || 10))}" />
                <span class="field-hint">How long the timeout lasts when a user exceeds the warn threshold.</span>
              </label>
              ` : ""}
              <label class="automod-rule-label">
                Offense Reset Window (minutes)
                <input name="escalationResetMinutes" type="number" min="0" step="1" value="${escapeHtml(String(state.automodForm.escalationResetMinutes ?? 0))}" />
                <span class="field-hint">Minutes of good behaviour before a user's offense count resets. Set to 0 to never reset.</span>
              </label>
              ` : ""}
            </div>
          </section>

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
            `
            : ""
        }
      </section>

      ${state.statusMessage ? `<p class="subtitle">${escapeHtml(state.statusMessage)}</p>` : ""}
    `;

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

        if (target.type === "checkbox") {
          state.automodSettingsForm[target.name] = target.checked;
        } else if (target.type === "number") {
          const min = Number(target.min || 1);
          state.automodSettingsForm[target.name] = Math.max(min, Number(target.value || min));
        } else {
          state.automodSettingsForm[target.name] = target.value;
        }
      });
    }

    const savePageSettingsButton = document.getElementById("save-page-settings");
    if (savePageSettingsButton) {
      savePageSettingsButton.addEventListener("click", async () => {
        await saveSettings(guildId, state);
        renderContent();
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
        state.automodForm.timeoutDuration = Math.max(1, Number(formData.get("timeoutDuration") || 10));
        state.automodForm.escalationEnabled = formData.get("escalationEnabled") === "on";
        state.automodForm.escalationWarnThreshold = Math.max(1, Number(formData.get("escalationWarnThreshold") || 1));
        state.automodForm.escalationAction = String(formData.get("escalationAction") || "timeout");
        state.automodForm.escalationTimeoutDuration = Math.max(1, Number(formData.get("escalationTimeoutDuration") || 10));
        state.automodForm.escalationResetMinutes = Math.max(0, Number(formData.get("escalationResetMinutes") || 0));
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
          const min = Number(input.min || 1);
          state.editingRuleForm[name] = Math.max(min, Number(input.value || min));
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

    // LHS Event Handlers
    const lhsHeaderToggle = document.getElementById("lhs-header-toggle");
    if (lhsHeaderToggle) {
      lhsHeaderToggle.addEventListener("click", (e) => {
        // Don't toggle if clicking on the checkbox
        if (e.target.name === "lhsEnabled") return;
        state.lhsExpanded = !state.lhsExpanded;
        renderContent();
      });
    }

    const lhsToggleExpand = document.getElementById("lhs-toggle-expand");
    if (lhsToggleExpand) {
      lhsToggleExpand.addEventListener("click", (e) => {
        e.stopPropagation();
        state.lhsExpanded = !state.lhsExpanded;
        renderContent();
      });
    }

    const lhsForm = document.getElementById("lhs-form");
    if (lhsForm) {
      // Handle all LHS form inputs
      lhsForm.addEventListener("input", (event) => {
        const target = event.target;
        const name = target.name;
        
        if (!name) return;

        if (name === "lhsEnabled") {
          state.lhsSettings.enabled = target.checked;
        } else if (name === "lhsGlobalThreshold") {
          state.lhsSettings.global_threshold = parseFloat(target.value);
        } else if (name === "lhsAction") {
          state.lhsSettings.action = target.value;
        } else if (name === "lhsSeverity") {
          state.lhsSettings.severity = parseInt(target.value, 10);
        } else if (name === "lhsLogOnlyMode") {
          state.lhsSettings.logOnlyMode = target.checked;
        } else if (name === "lhsExemptRoleIds") {
          state.lhsSettings.exemptRoleIds = target.value;
        } else if (name === "lhsExemptChannelIds") {
          state.lhsSettings.exemptChannelIds = target.value;
        } else if (name === "lhsExemptUserIds") {
          state.lhsSettings.exemptUserIds = target.value;
        } else if (name.startsWith("lhsCat_")) {
          const catId = name.replace("lhsCat_", "");
          if (!state.lhsSettings.categories[catId]) {
            state.lhsSettings.categories[catId] = {};
          }
          state.lhsSettings.categories[catId].enabled = target.checked;
        } else if (name.startsWith("lhsCatThreshold_")) {
          const catId = name.replace("lhsCatThreshold_", "");
          if (!state.lhsSettings.categories[catId]) {
            state.lhsSettings.categories[catId] = {};
          }
          state.lhsSettings.categories[catId].threshold = parseFloat(target.value);
        }
        
        rerenderKeepingInput(renderContent);
      });

      // Save button
      const lhsSaveBtn = document.getElementById("lhs-save-btn");
      if (lhsSaveBtn) {
        lhsSaveBtn.addEventListener("click", async () => {
          await saveLHSSettings(guildId, state);
          renderContent();
        });
      }

      // Reset button
      const lhsResetBtn = document.getElementById("lhs-reset-btn");
      if (lhsResetBtn && state.lhsSettingsOriginal) {
        lhsResetBtn.addEventListener("click", () => {
          state.lhsSettings = JSON.parse(JSON.stringify(state.lhsSettingsOriginal));
          renderContent();
        });
      }
    }

    // Image Moderation Event Handlers
    const imageModHeaderToggle = document.getElementById("image-mod-header-toggle");
    if (imageModHeaderToggle) {
      imageModHeaderToggle.addEventListener("click", (e) => {
        // Don't toggle if clicking on the checkbox
        if (e.target.name === "imgModEnabled") return;
        state.imageModExpanded = !state.imageModExpanded;
        renderContent();
      });
    }

    const imageModToggleExpand = document.getElementById("image-mod-toggle-expand");
    if (imageModToggleExpand) {
      imageModToggleExpand.addEventListener("click", (e) => {
        e.stopPropagation();
        state.imageModExpanded = !state.imageModExpanded;
        renderContent();
      });
    }

    const imageModForm = document.getElementById("image-mod-form");
    if (imageModForm) {
      // Handle all image moderation form inputs
      imageModForm.addEventListener("input", (event) => {
        const target = event.target;
        const name = target.name;
        
        if (!name) return;

        if (name === "imgModEnabled") {
          state.imageModSettings.enabled = target.checked;
        } else if (name === "imgModScanAttachments") {
          state.imageModSettings.scan_attachments = target.checked;
        } else if (name === "imgModScanEmbeds") {
          state.imageModSettings.scan_embeds = target.checked;
        } else if (name === "imgModLogOnly") {
          state.imageModSettings.log_only_mode = target.checked;
        } else if (name.startsWith("imgModAction_")) {
          const filterId = name.replace("imgModAction_", "");
          if (!state.imageModSettings.filters[filterId]) {
            state.imageModSettings.filters[filterId] = { enabled: false, threshold: 0.2, action: "delete" };
          }
          state.imageModSettings.filters[filterId].action = target.value;
        } else if (name.startsWith("imgModFilter_")) {
          const filterId = name.replace("imgModFilter_", "");
          if (!state.imageModSettings.filters[filterId]) {
            state.imageModSettings.filters[filterId] = { enabled: false, threshold: 0.2 };
          }
          state.imageModSettings.filters[filterId].enabled = target.checked;
        } else if (name.startsWith("imgModThreshold_")) {
          const filterId = name.replace("imgModThreshold_", "");
          if (!state.imageModSettings.filters[filterId]) {
            state.imageModSettings.filters[filterId] = { enabled: false, threshold: 0.2 };
          }
          state.imageModSettings.filters[filterId].threshold = parseFloat(target.value);
        }
        
        rerenderKeepingInput(renderContent);
      });

      // Save button
      const imageModSaveBtn = document.getElementById("image-mod-save-btn");
      if (imageModSaveBtn) {
        imageModSaveBtn.addEventListener("click", async () => {
          await saveImageModSettings(guildId, state);
          renderContent();
        });
      }

      // Reset button
      const imageModResetBtn = document.getElementById("image-mod-reset-btn");
      if (imageModResetBtn && state.imageModSettingsOriginal) {
        imageModResetBtn.addEventListener("click", () => {
          state.imageModSettings = JSON.parse(JSON.stringify(state.imageModSettingsOriginal));
          renderContent();
        });
      }
    }
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
          antiSpamEnabled: true,
          antiSpamMaxMessages: 5,
          antiSpamWindowSeconds: 3,
          antiSpamAlertCooldown: 10,
          antiSpamTimeoutEnabled: true,
          antiSpamTimeoutDuration: 30,
          antiSpamLogChannelId: "",
          antiSpamStaffRoleIds: "",
          antiRaidEnabled: true,
          antiRaidJoinThreshold: 8,
          antiRaidWindowSeconds: 12,
          antiRaidAlertCooldown: 30,
          antiRaidTimeoutEnabled: true,
          antiRaidTimeoutDuration: 30,
          antiRaidLogChannelId: "",
          antiRaidStaffRoleIds: "",
          antiNukeEnabled: true,
          antiNukeActionThreshold: 3,
          antiNukeWindowSeconds: 15,
          antiNukeAlertCooldown: 20,
          antiNukeTimeoutEnabled: true,
          antiNukeTimeoutDuration: 30,
          antiNukeLogChannelId: "",
          antiNukeStaffRoleIds: "",
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
    const requestedStaffRoleIds = parseCommaSeparated(state.automodSettingsForm.staffRoleIds);
    if (requestedStaffRoleIds.length > MAX_STAFF_PING_ROLES) {
      state.statusMessage = `Staff ping roles exceed max limit (${MAX_STAFF_PING_ROLES}).`;
      return;
    }
    const staffRoleIds = requestedStaffRoleIds.slice(0, MAX_STAFF_PING_ROLES);
    const exemptRoleIds = parseCommaSeparated(state.automodSettingsForm.exemptRoleIds);
    const exemptChannelIds = parseCommaSeparated(state.automodSettingsForm.exemptChannelIds);
    const exemptUserIds = parseCommaSeparated(state.automodSettingsForm.exemptUserIds);
    const antiSpamEnabled = Boolean(state.automodSettingsForm.antiSpamEnabled);
    const antiSpamMaxMessages = Math.max(1, Number(state.automodSettingsForm.antiSpamMaxMessages || 5));
    const antiSpamWindowSeconds = Math.max(1, Number(state.automodSettingsForm.antiSpamWindowSeconds || 3));
    const antiSpamAlertCooldown = Math.max(1, Number(state.automodSettingsForm.antiSpamAlertCooldown || 10));
    const antiSpamTimeoutEnabled = Boolean(state.automodSettingsForm.antiSpamTimeoutEnabled);
    const antiSpamTimeoutDuration = Math.max(5, Number(state.automodSettingsForm.antiSpamTimeoutDuration || 30));
    const antiSpamLogChannelId = String(state.automodSettingsForm.antiSpamLogChannelId || "").trim();
    const antiSpamStaffRoleIdsRequested = parseCommaSeparated(state.automodSettingsForm.antiSpamStaffRoleIds);
    if (antiSpamStaffRoleIdsRequested.length > MAX_STAFF_PING_ROLES) {
      state.statusMessage = `Anti Spam staff ping roles exceed max limit (${MAX_STAFF_PING_ROLES}).`;
      return;
    }
    const antiSpamStaffRoleIds = antiSpamStaffRoleIdsRequested.slice(0, MAX_STAFF_PING_ROLES);

    const antiRaidEnabled = Boolean(state.automodSettingsForm.antiRaidEnabled);
    const antiRaidJoinThreshold = Math.max(1, Number(state.automodSettingsForm.antiRaidJoinThreshold || 8));
    const antiRaidWindowSeconds = Math.max(1, Number(state.automodSettingsForm.antiRaidWindowSeconds || 12));
    const antiRaidAlertCooldown = Math.max(1, Number(state.automodSettingsForm.antiRaidAlertCooldown || 30));
    const antiRaidTimeoutEnabled = Boolean(state.automodSettingsForm.antiRaidTimeoutEnabled);
    const antiRaidTimeoutDuration = Math.max(5, Number(state.automodSettingsForm.antiRaidTimeoutDuration || 30));
    const antiRaidLogChannelId = String(state.automodSettingsForm.antiRaidLogChannelId || "").trim();
    const antiRaidStaffRoleIdsRequested = parseCommaSeparated(state.automodSettingsForm.antiRaidStaffRoleIds);
    if (antiRaidStaffRoleIdsRequested.length > MAX_STAFF_PING_ROLES) {
      state.statusMessage = `Anti Raid staff ping roles exceed max limit (${MAX_STAFF_PING_ROLES}).`;
      return;
    }
    const antiRaidStaffRoleIds = antiRaidStaffRoleIdsRequested.slice(0, MAX_STAFF_PING_ROLES);

    const antiNukeEnabled = Boolean(state.automodSettingsForm.antiNukeEnabled);
    const antiNukeActionThreshold = Math.max(1, Number(state.automodSettingsForm.antiNukeActionThreshold || 3));
    const antiNukeWindowSeconds = Math.max(1, Number(state.automodSettingsForm.antiNukeWindowSeconds || 15));
    const antiNukeAlertCooldown = Math.max(1, Number(state.automodSettingsForm.antiNukeAlertCooldown || 20));
    const antiNukeTimeoutEnabled = Boolean(state.automodSettingsForm.antiNukeTimeoutEnabled);
    const antiNukeTimeoutDuration = Math.max(5, Number(state.automodSettingsForm.antiNukeTimeoutDuration || 30));
    const antiNukeLogChannelId = String(state.automodSettingsForm.antiNukeLogChannelId || "").trim();
    const antiNukeStaffRoleIdsRequested = parseCommaSeparated(state.automodSettingsForm.antiNukeStaffRoleIds);
    if (antiNukeStaffRoleIdsRequested.length > MAX_STAFF_PING_ROLES) {
      state.statusMessage = `Anti Nuke staff ping roles exceed max limit (${MAX_STAFF_PING_ROLES}).`;
      return;
    }
    const antiNukeStaffRoleIds = antiNukeStaffRoleIdsRequested.slice(0, MAX_STAFF_PING_ROLES);

    const canonicalAutomodSettings = {
      log_channel_id: logChannelId,
      staff_role_ids: staffRoleIds,
      exempt_role_ids: exemptRoleIds,
      exempt_channel_ids: exemptChannelIds,
      exempt_user_ids: exemptUserIds,
      antispam: {
        enabled: antiSpamEnabled,
        max_messages: antiSpamMaxMessages,
        window_seconds: antiSpamWindowSeconds,
        alert_cooldown: antiSpamAlertCooldown,
        timeout_enabled: antiSpamTimeoutEnabled,
        timeout_duration: antiSpamTimeoutDuration,
        log_channel_id: antiSpamLogChannelId,
        staff_role_ids: antiSpamStaffRoleIds,
      },
      antiraid: {
        enabled: antiRaidEnabled,
        join_threshold: antiRaidJoinThreshold,
        window_seconds: antiRaidWindowSeconds,
        alert_cooldown: antiRaidAlertCooldown,
        timeout_enabled: antiRaidTimeoutEnabled,
        timeout_duration: antiRaidTimeoutDuration,
        log_channel_id: antiRaidLogChannelId,
        staff_role_ids: antiRaidStaffRoleIds,
      },
      antinuke: {
        enabled: antiNukeEnabled,
        action_threshold: antiNukeActionThreshold,
        window_seconds: antiNukeWindowSeconds,
        alert_cooldown: antiNukeAlertCooldown,
        timeout_enabled: antiNukeTimeoutEnabled,
        timeout_duration: antiNukeTimeoutDuration,
        log_channel_id: antiNukeLogChannelId,
        staff_role_ids: antiNukeStaffRoleIds,
      },
      // Keep canonical flat aliases so older bot handlers continue reading the same values.
      antispam_enabled: antiSpamEnabled,
      antispam_max_messages: antiSpamMaxMessages,
      antispam_window_seconds: antiSpamWindowSeconds,
      antispam_alert_cooldown: antiSpamAlertCooldown,
      antispam_timeout_enabled: antiSpamTimeoutEnabled,
      antispam_timeout_duration: antiSpamTimeoutDuration,
      antispam_log_channel_id: antiSpamLogChannelId,
      antispam_staff_role_ids: antiSpamStaffRoleIds,
      antiraid_enabled: antiRaidEnabled,
      antiraid_join_threshold: antiRaidJoinThreshold,
      antiraid_window_seconds: antiRaidWindowSeconds,
      antiraid_alert_cooldown: antiRaidAlertCooldown,
      antiraid_timeout_enabled: antiRaidTimeoutEnabled,
      antiraid_timeout_duration: antiRaidTimeoutDuration,
      antiraid_log_channel_id: antiRaidLogChannelId,
      antiraid_staff_role_ids: antiRaidStaffRoleIds,
      antinuke_enabled: antiNukeEnabled,
      antinuke_action_threshold: antiNukeActionThreshold,
      antinuke_window_seconds: antiNukeWindowSeconds,
      antinuke_alert_cooldown: antiNukeAlertCooldown,
      antinuke_timeout_enabled: antiNukeTimeoutEnabled,
      antinuke_timeout_duration: antiNukeTimeoutDuration,
      antinuke_log_channel_id: antiNukeLogChannelId,
      antinuke_staff_role_ids: antiNukeStaffRoleIds,
    };

    const payload = {
      guild_id: String(guildId || "").trim(),
      command_settings: canonicalAutomodSettings,
      automod_settings: canonicalAutomodSettings,
    };

    const expectedSettings = {
      logChannelId,
      staffRoleIds,
      exemptRoleIds,
      exemptChannelIds,
      exemptUserIds,
      antiSpamEnabled,
      antiSpamMaxMessages,
      antiSpamWindowSeconds,
      antiSpamAlertCooldown,
      antiSpamTimeoutEnabled,
      antiSpamTimeoutDuration,
      antiSpamLogChannelId,
      antiSpamStaffRoleIds,
      antiRaidEnabled,
      antiRaidJoinThreshold,
      antiRaidWindowSeconds,
      antiRaidAlertCooldown,
      antiRaidTimeoutEnabled,
      antiRaidTimeoutDuration,
      antiRaidLogChannelId,
      antiRaidStaffRoleIds,
      antiNukeEnabled,
      antiNukeActionThreshold,
      antiNukeWindowSeconds,
      antiNukeAlertCooldown,
      antiNukeTimeoutEnabled,
      antiNukeTimeoutDuration,
      antiNukeLogChannelId,
      antiNukeStaffRoleIds,
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
      const escalationEnabled = Boolean(state.automodForm.escalationEnabled);
      const escalationWarnThreshold = Math.max(1, Number(state.automodForm.escalationWarnThreshold || 1));
      const escalationAction = String(state.automodForm.escalationAction || "timeout");
      const escalationTimeoutDuration = Math.max(1, Number(state.automodForm.escalationTimeoutDuration || 10));
      const escalationResetMinutes = Math.max(0, Number(state.automodForm.escalationResetMinutes || 0));
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
          timeout_duration: Math.max(1, Number(state.automodForm.timeoutDuration || 10)),
          escalation_enabled: escalationEnabled,
          escalation_warn_threshold: escalationWarnThreshold,
          escalation_action: escalationAction,
          escalation_timeout_duration: escalationTimeoutDuration,
          escalation_reset_minutes: escalationResetMinutes,
          escalationEnabled,
          escalationWarnThreshold,
          escalationAction,
          escalationTimeoutDuration,
          escalationResetMinutes,
          offense_escalation_enabled: escalationEnabled,
          offense_escalation_action: escalationAction,
          escalation: {
            enabled: escalationEnabled,
            warn_threshold: escalationWarnThreshold,
            action: escalationAction,
            timeout_duration: escalationTimeoutDuration,
            reset_minutes: escalationResetMinutes,
          },
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
      timeout_duration: Math.max(1, Number(state.editingRuleForm.timeoutDuration || 10)),
      escalation_enabled: Boolean(state.editingRuleForm.escalationEnabled),
      escalation_warn_threshold: Math.max(1, Number(state.editingRuleForm.escalationWarnThreshold || 1)),
      escalation_action: String(state.editingRuleForm.escalationAction || "timeout"),
      escalation_timeout_duration: Math.max(1, Number(state.editingRuleForm.escalationTimeoutDuration || 10)),
      escalation_reset_minutes: Math.max(0, Number(state.editingRuleForm.escalationResetMinutes || 0)),
      escalationEnabled: Boolean(state.editingRuleForm.escalationEnabled),
      escalationWarnThreshold: Math.max(1, Number(state.editingRuleForm.escalationWarnThreshold || 1)),
      escalationAction: String(state.editingRuleForm.escalationAction || "timeout"),
      escalationTimeoutDuration: Math.max(1, Number(state.editingRuleForm.escalationTimeoutDuration || 10)),
      escalationResetMinutes: Math.max(0, Number(state.editingRuleForm.escalationResetMinutes || 0)),
      offense_escalation_enabled: Boolean(state.editingRuleForm.escalationEnabled),
      offense_escalation_action: String(state.editingRuleForm.escalationAction || "timeout"),
      escalation: {
        enabled: Boolean(state.editingRuleForm.escalationEnabled),
        warn_threshold: Math.max(1, Number(state.editingRuleForm.escalationWarnThreshold || 1)),
        action: String(state.editingRuleForm.escalationAction || "timeout"),
        timeout_duration: Math.max(1, Number(state.editingRuleForm.escalationTimeoutDuration || 10)),
        reset_minutes: Math.max(0, Number(state.editingRuleForm.escalationResetMinutes || 0)),
      },
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

    renderLeftSidebar({
      guildId,
      guildName,
      guildIconUrl,
      activePage: "",
      sidebarId: "guild-rule-editor-sidebar",
      activeRuleEditor: true,
      showRuleEditorLink: true,
      ruleEditorUrl: `/pages/rule-editor.html?guild_id=${encodeURIComponent(String(guildId || "").trim())}&rule_id=${encodeURIComponent(String(ruleId || "").trim())}`,
    });

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
          <div class="settings-hero-card rule-builder-hero">
            <div class="settings-hero-copy">
              <span class="settings-kicker">Rule Editor</span>
              <strong>Refine this AutoMod rule</strong>
              <p>Adjust matching logic, severity, routing, and safety controls without leaving the editor.</p>
              <div class="automod-edit-meta" aria-live="polite">
                ${
                  editHasChanges
                    ? `<span class="automod-edit-dirty">Unsaved changes: ${changedFields
                        .map((field) => formatChangedFieldName(field))
                        .join(", ")}</span>`
                    : '<span class="automod-edit-clean">No changes yet</span>'
                }
              </div>
            </div>

            <div class="rule-builder-status-column">
              <label class="automod-rule-label settings-toggle-card rule-builder-name-card">
                Rule Name
                <input name="name" value="${escapeHtml(state.editingRuleForm.name)}" list="automod-rule-name-presets" data-edit-input />
              </label>

              <label class="automod-enabled-label settings-inline-toggle rule-builder-inline-toggle">
                <input type="checkbox" name="enabled" ${state.editingRuleForm.enabled ? "checked" : ""} data-edit-input />
                <span>Rule Enabled</span>
              </label>
            </div>
          </div>

          <section class="settings-subgroup">
            <div class="settings-subgroup-header">
              <h5>Presets</h5>
              <p>Apply a preset to quickly reshape the rule before making manual edits.</p>
            </div>
            <label class="automod-rule-label automod-preset-control rule-builder-preset-control">
              Preset Library
              <div class="preset-toggle-list" role="group" aria-label="Editor presets">
                ${RULE_NAME_PRESETS.map(
                  (name) =>
                    `<button class="preset-toggle-btn ${editorSelectedPresets.includes(name) ? "is-active" : ""}" type="button" data-preset-toggle data-preset-context="editor" data-preset-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`
                ).join("")}
              </div>
              <span class="field-hint">Click presets to toggle them on or off.</span>
            </label>
          </section>

          <section class="settings-subgroup">
            <div class="settings-subgroup-header">
              <h5>Matching Logic</h5>
              <p>Update the content filters this rule uses to decide when to trigger.</p>
            </div>
            <div class="settings-subgroup-grid">
              <label class="automod-rule-label">
                Keywords (comma-separated)
                <input name="keyword" value="${escapeHtml(state.editingRuleForm.keyword)}" placeholder="badword, badword2" data-edit-input />
                <span class="token-counter">${editKeywordTokens.length} / ${MAX_WORDS} words</span>
                ${
                  editKeywordTokens.length > 0
                    ? `<span class="token-chip-list">${editKeywordTokens.map((token) => `<span class="token-chip">${escapeHtml(token)}</span>`).join("")}</span>`
                    : ""
                }
              </label>

              <label class="automod-rule-label">
                Allowed Keywords (comma-separated)
                <input name="allowedKeywords" value="${escapeHtml(state.editingRuleForm.allowedKeywords)}" placeholder="example.com, trusted phrase" data-edit-input />
                <span class="token-counter">${editAllowedKeywordTokens.length} allowed</span>
                ${
                  editAllowedKeywordTokens.length > 0
                    ? `<span class="token-chip-list">${editAllowedKeywordTokens
                        .map((token) => `<span class="token-chip muted">${escapeHtml(token)}</span>`)
                        .join("")}</span>`
                    : ""
                }
              </label>

              <label class="automod-rule-label settings-subgroup-wide">
                Regex Patterns (comma-separated or one per line)
                <textarea name="pattern" rows="5" placeholder="\\b(badword)\\b&#10;(https?:\\/\\/\\S+)" data-edit-input>${escapeHtml(state.editingRuleForm.pattern)}</textarea>
                <span class="field-hint">Use one regex per line for clear separation.</span>
                <span class="token-counter">${editRegexTokens.length} / ${MAX_REGEXES} regexes</span>
                ${
                  editRegexTokens.length > 0
                    ? `<span class="token-chip-list">${editRegexTokens.map((token) => `<span class="token-chip">${escapeHtml(token)}</span>`).join("")}</span>`
                    : ""
                }
              </label>
            </div>
          </section>

          <section class="settings-subgroup">
            <div class="settings-subgroup-header">
              <h5>Response</h5>
              <p>Set the action, severity, and trigger threshold that define the rule response.</p>
            </div>
            <div class="settings-subgroup-grid">
              <label class="automod-rule-label">
                Action
                <select name="action" data-edit-input>
                  ${RULE_ACTION_OPTIONS.map(
                    (action) =>
                      `<option value="${escapeHtml(action)}" ${state.editingRuleForm.action === action ? "selected" : ""}>${escapeHtml(formatActionLabel(action))}</option>`
                  ).join("")}
                </select>
              </label>

              ${state.editingRuleForm.action === "timeout" ? `
              <label class="automod-rule-label">
                Timeout Duration (minutes)
                <input name="timeoutDuration" type="number" min="1" step="1" value="${escapeHtml(String(state.editingRuleForm.timeoutDuration || 10))}" data-edit-input />
                <span class="field-hint">How long the user will be timed out when this rule triggers.</span>
              </label>
              ` : ""}

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

              <label class="automod-rule-label settings-subgroup-wide">
                Threshold
                <input name="threshold" type="number" min="1" step="1" value="${escapeHtml(state.editingRuleForm.threshold)}" data-edit-input />
              </label>
            </div>
          </section>

          <section class="settings-subgroup">
            <div class="settings-subgroup-header">
              <h5>Offense Escalation</h5>
              <p>Automatically escalate repeat violations through a configurable punishment ladder.</p>
            </div>
            <div class="settings-subgroup-grid">
              <label class="automod-enabled-label">
                <input type="checkbox" name="escalationEnabled" ${state.editingRuleForm.escalationEnabled ? "checked" : ""} data-edit-input />
                Enable offense escalation
              </label>
              ${state.editingRuleForm.escalationEnabled ? `
              <label class="automod-rule-label">
                Warn Threshold
                <input name="escalationWarnThreshold" type="number" min="1" step="1" value="${escapeHtml(String(state.editingRuleForm.escalationWarnThreshold || 1))}" data-edit-input />
                <span class="field-hint">Number of warnings to issue before escalating. After this many offenses the escalation action fires instead.</span>
              </label>
              <label class="automod-rule-label">
                Escalation Action
                <select name="escalationAction" data-edit-input>
                  ${ESCALATION_ACTION_OPTIONS.map(
                    (action) =>
                      `<option value="${escapeHtml(action)}" ${state.editingRuleForm.escalationAction === action ? "selected" : ""}>${escapeHtml(formatActionLabel(action))}</option>`
                  ).join("")}
                </select>
                <span class="field-hint">Action taken once the warn threshold is exceeded.</span>
              </label>
              ${state.editingRuleForm.escalationAction === "timeout" ? `
              <label class="automod-rule-label">
                Escalation Timeout Duration (minutes)
                <input name="escalationTimeoutDuration" type="number" min="1" step="1" value="${escapeHtml(String(state.editingRuleForm.escalationTimeoutDuration || 10))}" data-edit-input />
                <span class="field-hint">How long the timeout lasts when a user exceeds the warn threshold.</span>
              </label>
              ` : ""}
              <label class="automod-rule-label">
                Offense Reset Window (minutes)
                <input name="escalationResetMinutes" type="number" min="0" step="1" value="${escapeHtml(String(state.editingRuleForm.escalationResetMinutes ?? 0))}" data-edit-input />
                <span class="field-hint">Minutes of good behaviour before a user's offense count resets. Set to 0 to never reset.</span>
              </label>
              ` : ""}
            </div>
          </section>

          <section class="settings-subgroup">
            <div class="settings-subgroup-header">
              <h5>Exemptions</h5>
              <p>Exclude trusted roles, channels, or users from this specific rule.</p>
            </div>
            <div class="settings-subgroup-grid">
              <label class="automod-rule-label">
                Exempt Role IDs (comma-separated)
                <input name="exemptRoleIds" value="${escapeHtml(state.editingRuleForm.exemptRoleIds)}" placeholder="111111111111111111, 222222222222222222" data-edit-input />
              </label>

              <label class="automod-rule-label">
                Exempt Channel IDs (comma-separated)
                <input name="exemptChannelIds" value="${escapeHtml(state.editingRuleForm.exemptChannelIds)}" placeholder="333333333333333333, 444444444444444444" data-edit-input />
              </label>

              <label class="automod-rule-label settings-subgroup-wide">
                Exempt User IDs (comma-separated)
                <input name="exemptUserIds" value="${escapeHtml(state.editingRuleForm.exemptUserIds)}" placeholder="555555555555555555, 666666666666666666" data-edit-input />
              </label>
            </div>
          </section>

          <section class="settings-subgroup">
            <div class="settings-subgroup-header">
              <h5>Alert Routing</h5>
              <p>These settings control where AutoMod alerts land while you work on the rule.</p>
            </div>
            <div class="settings-subgroup-grid">
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
            </div>
          </section>

          <div class="automod-rule-actions automod-rule-actions-full">
            <button class="action-btn primary" type="button" data-save-edit ${state.isSavingEdit || state.isSavingSettings || isEditLimitExceeded || !editHasChanges ? "disabled" : ""}>
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
          const min = Number(input.min || 1);
          state.editingRuleForm[name] = Math.max(min, Number(input.value || min));
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

  // LHS Settings Functions

  async function loadLHSSettings(guildId, state) {
    if (!guildId) {
      return;
    }

    state.isLoadingLHS = true;

    try {
      const response = await fetch(
        `${backendUrl}/api/guilds/lhs-settings?guild_id=${encodeURIComponent(guildId)}`,
        { method: "GET", credentials: "include" }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // LHS settings not found, use defaults
          state.lhsSettings = {
            enabled: false,
            global_threshold: DEFAULT_LHS_THRESHOLD,
            categories: {},
            exemptRoleIds: "",
            exemptChannelIds: "",
            exemptUserIds: "",
            action: "delete",
            severity: 2,
            logOnlyMode: false,
          };
          state.lhsSettingsOriginal = null;
          return;
        }
        throw new Error(`Failed to load LHS settings (${response.status})`);
      }

      const payload = await response.json();
      const normalized = normalizeLHSSettings(payload);

      // Convert arrays to comma-separated strings for form inputs
      state.lhsSettings = {
        enabled: normalized.enabled,
        global_threshold: normalized.global_threshold,
        categories: normalized.categories || {},
        exemptRoleIds: Array.isArray(normalized.exempt_roles) 
          ? normalized.exempt_roles.join(", ") 
          : "",
        exemptChannelIds: Array.isArray(normalized.exempt_channels) 
          ? normalized.exempt_channels.join(", ") 
          : "",
        exemptUserIds: Array.isArray(normalized.exempt_users) 
          ? normalized.exempt_users.join(", ") 
          : "",
        action: normalized.action,
        severity: normalized.severity,
        logOnlyMode: normalized.log_only_mode,
      };

      state.lhsSettingsOriginal = JSON.parse(JSON.stringify(state.lhsSettings));
    } catch (error) {
      console.error("Failed to load LHS settings:", error);
      state.statusMessage = error?.message || "Failed to load AI moderation settings.";
    } finally {
      state.isLoadingLHS = false;
    }
  }

  async function loadImageModSettings(guildId, state) {
    if (!guildId) {
      return;
    }

    state.isLoadingImageMod = true;

    try {
      const response = await fetch(
        `${backendUrl}/api/guilds/lhs-settings?guild_id=${encodeURIComponent(guildId)}`,
        { method: "GET", credentials: "include" }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // Image mod settings not found, use defaults (all filters disabled)
          state.imageModSettings = {
            enabled: false,
            scan_attachments: true,
            scan_embeds: true,
            filters: JSON.parse(JSON.stringify(DEFAULT_IMAGE_MOD_SETTINGS.filters)),
            log_only_mode: false,
          };
          state.imageModSettingsOriginal = null;
          return;
        }
        throw new Error(`Failed to load image moderation settings (${response.status})`);
      }

      const payload = await response.json();
      const normalized = normalizeImageModSettings(payload?.image_moderation || payload?.lhs_settings?.image_moderation);

      state.imageModSettings = {
        enabled: normalized.enabled,
        scan_attachments: normalized.scan_attachments,
        scan_embeds: normalized.scan_embeds,
        filters: normalized.filters,

        log_only_mode: normalized.log_only_mode,
      };

      state.imageModSettingsOriginal = JSON.parse(JSON.stringify(state.imageModSettings));
    } catch (error) {
      console.error("Failed to load image moderation settings:", error);
      // Don't show error for image moderation - it's optional
    } finally {
      state.isLoadingImageMod = false;
    }
  }

  async function saveLHSSettings(guildId, state) {
    if (!guildId) {
      state.statusMessage = "Missing guild id.";
      return;
    }

    // Build payload
    const categories = {};
    for (const cat of LHS_CATEGORIES) {
      const catSettings = state.lhsSettings.categories[cat.id] || {};
      categories[cat.id] = {
        enabled: catSettings.enabled !== false,
        threshold: catSettings.threshold || state.lhsSettings.global_threshold,
      };
    }

    const payload = {
      enabled: state.lhsSettings.enabled,
      global_threshold: state.lhsSettings.global_threshold,
      categories: categories,
      exempt_roles: parseCommaSeparated(state.lhsSettings.exemptRoleIds).map(id => parseInt(id, 10)).filter(Boolean),
      exempt_channels: parseCommaSeparated(state.lhsSettings.exemptChannelIds).map(id => parseInt(id, 10)).filter(Boolean),
      exempt_users: parseCommaSeparated(state.lhsSettings.exemptUserIds).map(id => parseInt(id, 10)).filter(Boolean),
      action: state.lhsSettings.action,
      severity: state.lhsSettings.severity,
      log_only_mode: state.lhsSettings.logOnlyMode,
    };

    state.isSavingLHS = true;

    try {
      const response = await fetch(
        `${backendUrl}/api/guilds/lhs-settings?guild_id=${encodeURIComponent(guildId)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save LHS settings (${response.status})`);
      }

      state.statusMessage = "AI Moderation settings saved successfully.";
      state.lhsSettingsOriginal = JSON.parse(JSON.stringify(state.lhsSettings));
    } catch (error) {
      state.statusMessage = error?.message || "Failed to save AI moderation settings.";
    } finally {
      state.isSavingLHS = false;
    }
  }

  async function saveImageModSettings(guildId, state) {
    if (!guildId) {
      state.statusMessage = "Missing guild id.";
      return;
    }

    const payload = {
      image_moderation: {
        enabled: state.imageModSettings.enabled,
        scan_attachments: state.imageModSettings.scan_attachments,
        scan_embeds: state.imageModSettings.scan_embeds,
        filters: state.imageModSettings.filters,

        log_only_mode: state.imageModSettings.log_only_mode,
      },
    };

    state.isSavingImageMod = true;

    try {
      const response = await fetch(
        `${backendUrl}/api/guilds/lhs-settings?guild_id=${encodeURIComponent(guildId)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save image moderation settings (${response.status})`);
      }

      state.statusMessage = "Image Moderation settings saved successfully.";
      state.imageModSettingsOriginal = JSON.parse(JSON.stringify(state.imageModSettings));
    } catch (error) {
      state.statusMessage = error?.message || "Failed to save image moderation settings.";
    } finally {
      state.isSavingImageMod = false;
    }
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
    await Promise.all([
      loadRules(guildId, state),
      loadSettings(guildId, state),
      loadLHSSettings(guildId, state),
      loadImageModSettings(guildId, state),
    ]);
    renderContent();
  }

  return {
    mount,
    mountRuleEditor,
    renderContent,
    ensureState,
  };
}
