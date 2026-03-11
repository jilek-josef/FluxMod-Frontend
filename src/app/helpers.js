import { STATUS_TEXT } from "./constants.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function parseCommaSeparated(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeIdList(value) {
  return parseCommaSeparated(value).join(", ");
}

export function normalizeRulesResponse(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.rules)) {
    return payload.rules;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

function pickRuleText(...candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
    }

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

export function normalizeRule(rule = {}) {
  const keyword = pickRuleText(
    rule?.keyword,
    rule?.keywords,
    rule?.words,
    rule?.word_list,
    rule?.keyword_list,
    rule?.blocked_words,
    rule?.blockedWords,
    rule?.banned_words,
    rule?.bannedWords,
    rule?.blacklist,
    rule?.trigger_words,
    rule?.triggerWords,
    rule?.match?.keyword,
    rule?.match?.keywords,
    rule?.filters?.keyword,
    rule?.filters?.keywords,
    rule?.trigger?.keyword,
    rule?.trigger?.keywords
  );

  const pattern = pickRuleText(
    rule?.pattern,
    rule?.patterns,
    rule?.regex,
    rule?.regexes,
    rule?.regex_list,
    rule?.regexList,
    rule?.regex_patterns,
    rule?.regexPatterns,
    rule?.match?.pattern,
    rule?.match?.patterns,
    rule?.match?.regex,
    rule?.match?.regexes,
    rule?.filters?.pattern,
    rule?.filters?.patterns,
    rule?.filters?.regex,
    rule?.filters?.regexes
  );

  return {
    ...rule,
    keyword,
    pattern,
  };
}

export function getRuleId(rule = {}) {
  return rule?.id || rule?.rule_id || rule?.ruleId || "";
}

export function normalizeAutomodSettings(payload = {}) {
  const root = payload || {};
  const data = root?.data || {};
  const settings = root?.settings || {};

  // Some endpoints return settings under different wrappers; merge all common layers.
  const source = {
    ...root,
    ...data,
    ...settings,
  };

  const commandSettings = {
    ...(root?.command_settings || root?.commandSettings || {}),
    ...(data?.command_settings || data?.commandSettings || {}),
    ...(settings?.command_settings || settings?.commandSettings || {}),
    ...(source?.command_settings || source?.commandSettings || {}),
  };

  const logChannelId =
    source?.log_channel_id ||
    source?.logChannelId ||
    source?.automod_log_channel_id ||
    source?.automodLogChannelId ||
    source?.automod_log_channel ||
    source?.automodLogChannel ||
    source?.log_channel ||
    source?.logChannel ||
    commandSettings?.automod_log_channel ||
    commandSettings?.automodLogChannel ||
    "";

  const exemptRoles =
    source?.exempt_role_ids ||
    source?.exemptRoleIds ||
    source?.exempt_roles ||
    source?.exemptRoles ||
    source?.ignored_role_ids ||
    source?.ignoredRoleIds ||
    [];

  const exemptChannels =
    source?.exempt_channel_ids ||
    source?.exemptChannelIds ||
    source?.exempt_channels ||
    source?.exemptChannels ||
    source?.ignored_channel_ids ||
    source?.ignoredChannelIds ||
    [];

  const exemptUsers =
    source?.exempt_user_ids ||
    source?.exemptUserIds ||
    source?.exempt_users ||
    source?.exemptUsers ||
    source?.ignored_user_ids ||
    source?.ignoredUserIds ||
    [];

  return {
    logChannelId: String(logChannelId || "").trim(),
    exemptRoleIds: normalizeIdList(exemptRoles),
    exemptChannelIds: normalizeIdList(exemptChannels),
    exemptUserIds: normalizeIdList(exemptUsers),
  };
}

export function getGuildId(guild = {}) {
  return guild?.id || guild?.guild_id || guild?.guildId || guild?.discord_id || "";
}

export function getGuildName(guild = {}) {
  return guild?.name || guild?.guild_name || guild?.guildName || "Unnamed Guild";
}

export function getGuildMeta(guild = {}) {
  return {
    guildId: getGuildId(guild),
    guildName: getGuildName(guild),
    guildIcon: guild?.icon || "",
  };
}

export function getUserName(user = {}) {
  return user?.username || user?.id || "User";
}

export function getUserPfpUrl(user = {}, fallback) {
  if (!user?.id || !user?.avatar_url) {
    return fallback;
  }

  const isAnimated = user.avatar_url.startsWith("a_");
  const format = isAnimated ? "gif" : "png";
  return `https://fluxerusercontent.com/avatars/${user.id}/${user.avatar_url}.${format}`;
}

export function getGuildIconUrl(guild = {}, fallback) {
  const guildId = getGuildId(guild);
  const guildIcon = String(guild?.icon || "").trim();

  if (!guildId || !guildIcon || guildIcon.toLowerCase() === "none") {
    return fallback;
  }

  const isAnimated = guildIcon.startsWith("a_");
  const format = isAnimated ? "gif" : "png";
  return `https://fluxerusercontent.com/icons/${guildId}/${guildIcon}.${format}`;
}

export function hasAdministratorPermission(guild = {}) {
  const rawPermissions = guild?.permissions ?? guild?.permissions_raw ?? guild?.permissionBits;
  if (rawPermissions === undefined || rawPermissions === null) {
    return false;
  }

  try {
    const permissions = BigInt(rawPermissions);
    const ADMINISTRATOR = 0x8n;
    return (permissions & ADMINISTRATOR) === ADMINISTRATOR;
  } catch {
    const permissions = Number(rawPermissions);
    const ADMINISTRATOR = 0x8;
    return Number.isFinite(permissions) && (permissions & ADMINISTRATOR) === ADMINISTRATOR;
  }
}

export function isGuildOwner(guild = {}, currentUserId) {
  const ownerId = String(
    guild?.owner_id || guild?.ownerId || guild?.guild_owner_id || guild?.guildOwnerId || ""
  );

  return Boolean(ownerId) && Boolean(currentUserId) && ownerId === currentUserId;
}

export function normalizeStatusCode(value) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isInteger(parsed) && parsed >= 100 && parsed <= 599) {
    return parsed;
  }

  return 500;
}

export function getStatusGroup(code) {
  if (code >= 100 && code <= 199) return "Informational response";
  if (code >= 200 && code <= 299) return "Success response";
  if (code >= 300 && code <= 399) return "Redirection response";
  if (code >= 400 && code <= 499) return "Client error response";
  return "Server error response";
}

export function getStatusMessage(code) {
  if (STATUS_TEXT[code]) {
    return STATUS_TEXT[code];
  }

  if (code >= 400 && code <= 499) return "Unknown Client Error";
  if (code >= 500 && code <= 599) return "Unknown Server Error";
  return "Unknown HTTP Status";
}

export function resolveGuildId(search) {
  const params = new URLSearchParams(search);
  const fromNamedKey = params.get("guild_id") || params.get("id");
  if (fromNamedKey) {
    return fromNamedKey;
  }

  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw || raw.includes("=")) {
    return "";
  }

  return decodeURIComponent(raw);
}

export function isLocalPage() {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}
