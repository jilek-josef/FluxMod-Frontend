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

export function splitRegexPatterns(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  const raw = String(value || "").trim();
  if (!raw) {
    return [];
  }

  if (raw.includes("\n")) {
    return raw
      .split(/\r?\n/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const segments = [];
  let current = "";
  let escaped = false;
  let inCharClass = false;
  let parenDepth = 0;
  let braceDepth = 0;

  for (const char of raw) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }

    if (char === "[" && !inCharClass) {
      inCharClass = true;
      current += char;
      continue;
    }

    if (char === "]" && inCharClass) {
      inCharClass = false;
      current += char;
      continue;
    }

    if (!inCharClass) {
      if (char === "(") {
        parenDepth += 1;
      } else if (char === ")" && parenDepth > 0) {
        parenDepth -= 1;
      } else if (char === "{") {
        braceDepth += 1;
      } else if (char === "}" && braceDepth > 0) {
        braceDepth -= 1;
      }

      if (char === "," && parenDepth === 0 && braceDepth === 0) {
        const cleaned = current.trim();
        if (cleaned) {
          segments.push(cleaned);
        }
        current = "";
        continue;
      }
    }

    current += char;
  }

  const cleaned = current.trim();
  if (cleaned) {
    segments.push(cleaned);
  }

  return segments;
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

function pickDefinedValue(...candidates) {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      return candidate;
    }
  }

  return undefined;
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
  const escalation = rule?.escalation || rule?.offense_escalation || rule?.offenseEscalation || {};
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

  const allowedKeywords = pickRuleText(
    rule?.allowed_keywords,
    rule?.allowed_patterns,
    rule?.allowedKeywords,
    rule?.allowedPatterns,
    rule?.allow_keywords,
    rule?.allow_patterns,
    rule?.match?.allowed_keywords,
    rule?.match?.allowed_patterns,
    rule?.filters?.allowed_keywords,
    rule?.filters?.allowed_patterns
  );

  return {
    ...rule,
    keyword,
    allowedKeywords,
    pattern,
    timeoutDuration: Number(
      rule?.timeout_duration ?? rule?.timeoutDuration ?? 10
    ) || 10,
    escalationEnabled: Boolean(
      rule?.escalation_enabled ??
        rule?.escalationEnabled ??
        rule?.offense_escalation_enabled ??
        rule?.offenseEscalationEnabled ??
        escalation?.enabled ??
        escalation?.is_enabled ??
        false
    ),
    escalationWarnThreshold: Math.max(1, Number(
      rule?.escalation_warn_threshold ??
        rule?.escalationWarnThreshold ??
        rule?.warn_threshold ??
        rule?.warnThreshold ??
        escalation?.warn_threshold ??
        escalation?.warnThreshold ??
        1
    ) || 1),
    escalationAction: String(
      rule?.escalation_action ??
        rule?.escalationAction ??
        rule?.offense_escalation_action ??
        rule?.offenseEscalationAction ??
        escalation?.action ??
        "timeout"
    ),
    escalationTimeoutDuration: Number(
      rule?.escalation_timeout_duration ??
        rule?.escalationTimeoutDuration ??
        rule?.timeout_duration ??
        rule?.timeoutDuration ??
        escalation?.timeout_duration ??
        escalation?.timeoutDuration ??
        10
    ) || 10,
    escalationResetMinutes: Math.max(0, Number(
      rule?.escalation_reset_minutes ??
        rule?.escalationResetMinutes ??
        rule?.reset_minutes ??
        rule?.resetMinutes ??
        escalation?.reset_minutes ??
        escalation?.resetMinutes ??
        0
    ) || 0),
  };
}

export function getRuleId(rule = {}) {
  return rule?.id || rule?.rule_id || rule?.ruleId || "";
}

export function normalizeAutomodSettings(payload = {}) {
  const root = payload || {};
  const data = root?.data || {};
  const settings = root?.settings || {};
  const automodSettings = {
    ...(root?.automod_settings || root?.automodSettings || {}),
    ...(data?.automod_settings || data?.automodSettings || {}),
    ...(settings?.automod_settings || settings?.automodSettings || {}),
  };
  const legacyAutomod = {
    ...(root?.automod || {}),
    ...(data?.automod || {}),
    ...(settings?.automod || {}),
  };

  // Some endpoints return settings under different wrappers; merge all common layers.
  const source = {
    ...root,
    ...data,
    ...settings,
    ...automodSettings,
    ...legacyAutomod,
  };

  const commandSettings = {
    ...(root?.command_settings || root?.commandSettings || {}),
    ...(data?.command_settings || data?.commandSettings || {}),
    ...(settings?.command_settings || settings?.commandSettings || {}),
    ...(source?.command_settings || source?.commandSettings || {}),
  };

  const logChannelId = pickDefinedValue(
    source?.log_channel_id,
    source?.logChannelId,
    source?.automod_log_channel_id,
    source?.automodLogChannelId,
    source?.automod_log_channel,
    source?.automodLogChannel,
    source?.log_channel,
    source?.logChannel,
    commandSettings?.automod_log_channel,
    commandSettings?.automodLogChannel,
    ""
  );

  const exemptRoles = pickDefinedValue(
    source?.exempt_role_ids,
    source?.exemptRoleIds,
    source?.exempt_roles,
    source?.exemptRoles,
    source?.ignored_role_ids,
    source?.ignoredRoleIds,
    []
  );

  const staffRoles = pickDefinedValue(
    source?.staff_role_ids,
    source?.staffRoleIds,
    source?.staff_roles,
    source?.staffRoles,
    source?.staff_ping_role_ids,
    source?.staffPingRoleIds,
    source?.automod_ping_role_ids,
    source?.automodPingRoleIds,
    commandSettings?.staff_role_ids,
    commandSettings?.staffRoleIds,
    commandSettings?.staff_roles,
    commandSettings?.staffRoles,
    commandSettings?.staff_ping_role_ids,
    commandSettings?.staffPingRoleIds,
    commandSettings?.automod_ping_role_ids,
    commandSettings?.automodPingRoleIds,
    []
  );

  const exemptChannels = pickDefinedValue(
    source?.exempt_channel_ids,
    source?.exemptChannelIds,
    source?.exempt_channels,
    source?.exemptChannels,
    source?.ignored_channel_ids,
    source?.ignoredChannelIds,
    []
  );

  const exemptUsers = pickDefinedValue(
    source?.exempt_user_ids,
    source?.exemptUserIds,
    source?.exempt_users,
    source?.exemptUsers,
    source?.ignored_user_ids,
    source?.ignoredUserIds,
    []
  );

  const antiSpamEnabled = pickDefinedValue(
    source?.antispam_enabled,
    source?.anti_spam_enabled,
    source?.antispam?.enabled,
    source?.anti_spam?.enabled,
    source?.antispam_settings?.enabled,
    source?.anti_spam_settings?.enabled,
    commandSettings?.antispam_enabled,
    commandSettings?.anti_spam_enabled,
    commandSettings?.antispam?.enabled,
    commandSettings?.anti_spam?.enabled,
    commandSettings?.antispam_settings?.enabled,
    commandSettings?.anti_spam_settings?.enabled,
    true
  );

  const antiSpamMaxMessages = pickDefinedValue(
    source?.antispam_max_messages,
    source?.anti_spam_max_messages,
    source?.antispam?.max_messages,
    source?.anti_spam?.max_messages,
    source?.antispam_settings?.max_messages,
    source?.anti_spam_settings?.max_messages,
    commandSettings?.antispam_max_messages,
    commandSettings?.anti_spam_max_messages,
    commandSettings?.antispam?.max_messages,
    commandSettings?.anti_spam?.max_messages,
    commandSettings?.antispam_settings?.max_messages,
    commandSettings?.anti_spam_settings?.max_messages,
    5
  );

  const antiSpamWindowSeconds = pickDefinedValue(
    source?.antispam_window_seconds,
    source?.anti_spam_window_seconds,
    source?.antispam?.window_seconds,
    source?.anti_spam?.window_seconds,
    source?.antispam_settings?.window_seconds,
    source?.anti_spam_settings?.window_seconds,
    commandSettings?.antispam_window_seconds,
    commandSettings?.anti_spam_window_seconds,
    commandSettings?.antispam?.window_seconds,
    commandSettings?.anti_spam?.window_seconds,
    commandSettings?.antispam_settings?.window_seconds,
    commandSettings?.anti_spam_settings?.window_seconds,
    3
  );

  const antiSpamAlertCooldown = pickDefinedValue(
    source?.antispam_alert_cooldown,
    source?.anti_spam_alert_cooldown,
    source?.antispam?.alert_cooldown,
    source?.anti_spam?.alert_cooldown,
    source?.antispam_settings?.alert_cooldown,
    source?.anti_spam_settings?.alert_cooldown,
    commandSettings?.antispam_alert_cooldown,
    commandSettings?.anti_spam_alert_cooldown,
    commandSettings?.antispam?.alert_cooldown,
    commandSettings?.anti_spam?.alert_cooldown,
    commandSettings?.antispam_settings?.alert_cooldown,
    commandSettings?.anti_spam_settings?.alert_cooldown,
    10
  );

  const antiSpamTimeoutEnabled = pickDefinedValue(
    source?.antispam_timeout_enabled,
    source?.anti_spam_timeout_enabled,
    source?.antispam?.timeout_enabled,
    source?.anti_spam?.timeout_enabled,
    source?.antispam_settings?.timeout_enabled,
    source?.anti_spam_settings?.timeout_enabled,
    commandSettings?.antispam_timeout_enabled,
    commandSettings?.anti_spam_timeout_enabled,
    commandSettings?.antispam?.timeout_enabled,
    commandSettings?.anti_spam?.timeout_enabled,
    commandSettings?.antispam_settings?.timeout_enabled,
    commandSettings?.anti_spam_settings?.timeout_enabled,
    true
  );

  const antiSpamTimeoutDuration = pickDefinedValue(
    source?.antispam_timeout_duration,
    source?.anti_spam_timeout_duration,
    source?.antispam?.timeout_duration,
    source?.anti_spam?.timeout_duration,
    source?.antispam_settings?.timeout_duration,
    source?.anti_spam_settings?.timeout_duration,
    commandSettings?.antispam_timeout_duration,
    commandSettings?.anti_spam_timeout_duration,
    commandSettings?.antispam?.timeout_duration,
    commandSettings?.anti_spam?.timeout_duration,
    commandSettings?.antispam_settings?.timeout_duration,
    commandSettings?.anti_spam_settings?.timeout_duration,
    30
  );

  const antiSpamLogChannelId = pickDefinedValue(
    source?.antispam_log_channel_id,
    source?.anti_spam_log_channel_id,
    source?.antispam_log_channel,
    source?.anti_spam_log_channel,
    source?.antispam?.log_channel_id,
    source?.anti_spam?.log_channel_id,
    source?.antispam_settings?.log_channel_id,
    source?.anti_spam_settings?.log_channel_id,
    commandSettings?.antispam_log_channel_id,
    commandSettings?.anti_spam_log_channel_id,
    commandSettings?.antispam_log_channel,
    commandSettings?.anti_spam_log_channel,
    ""
  );

  const antiSpamStaffRoles = pickDefinedValue(
    source?.antispam_staff_role_ids,
    source?.anti_spam_staff_role_ids,
    source?.antispam_staff_roles,
    source?.anti_spam_staff_roles,
    source?.antispam?.staff_role_ids,
    source?.anti_spam?.staff_role_ids,
    commandSettings?.antispam_staff_role_ids,
    commandSettings?.anti_spam_staff_role_ids,
    commandSettings?.antispam_staff_roles,
    commandSettings?.anti_spam_staff_roles,
    []
  );

  const antiRaidEnabled = pickDefinedValue(
    source?.antiraid_enabled,
    source?.anti_raid_enabled,
    source?.antiraid?.enabled,
    source?.anti_raid?.enabled,
    source?.antiraid_settings?.enabled,
    source?.anti_raid_settings?.enabled,
    commandSettings?.antiraid_enabled,
    commandSettings?.anti_raid_enabled,
    commandSettings?.antiraid?.enabled,
    commandSettings?.anti_raid?.enabled,
    commandSettings?.antiraid_settings?.enabled,
    commandSettings?.anti_raid_settings?.enabled,
    true
  );

  const antiRaidJoinThreshold = pickDefinedValue(
    source?.antiraid_join_threshold,
    source?.anti_raid_join_threshold,
    source?.antiraid?.join_threshold,
    source?.anti_raid?.join_threshold,
    source?.antiraid_settings?.join_threshold,
    source?.anti_raid_settings?.join_threshold,
    commandSettings?.antiraid_join_threshold,
    commandSettings?.anti_raid_join_threshold,
    commandSettings?.antiraid?.join_threshold,
    commandSettings?.anti_raid?.join_threshold,
    commandSettings?.antiraid_settings?.join_threshold,
    commandSettings?.anti_raid_settings?.join_threshold,
    8
  );

  const antiRaidWindowSeconds = pickDefinedValue(
    source?.antiraid_window_seconds,
    source?.anti_raid_window_seconds,
    source?.antiraid?.window_seconds,
    source?.anti_raid?.window_seconds,
    source?.antiraid_settings?.window_seconds,
    source?.anti_raid_settings?.window_seconds,
    commandSettings?.antiraid_window_seconds,
    commandSettings?.anti_raid_window_seconds,
    commandSettings?.antiraid?.window_seconds,
    commandSettings?.anti_raid?.window_seconds,
    commandSettings?.antiraid_settings?.window_seconds,
    commandSettings?.anti_raid_settings?.window_seconds,
    12
  );

  const antiRaidAlertCooldown = pickDefinedValue(
    source?.antiraid_alert_cooldown,
    source?.anti_raid_alert_cooldown,
    source?.antiraid?.alert_cooldown,
    source?.anti_raid?.alert_cooldown,
    source?.antiraid_settings?.alert_cooldown,
    source?.anti_raid_settings?.alert_cooldown,
    commandSettings?.antiraid_alert_cooldown,
    commandSettings?.anti_raid_alert_cooldown,
    commandSettings?.antiraid?.alert_cooldown,
    commandSettings?.anti_raid?.alert_cooldown,
    commandSettings?.antiraid_settings?.alert_cooldown,
    commandSettings?.anti_raid_settings?.alert_cooldown,
    30
  );

  const antiRaidTimeoutEnabled = pickDefinedValue(
    source?.antiraid_timeout_enabled,
    source?.anti_raid_timeout_enabled,
    source?.antiraid?.timeout_enabled,
    source?.anti_raid?.timeout_enabled,
    source?.antiraid_settings?.timeout_enabled,
    source?.anti_raid_settings?.timeout_enabled,
    commandSettings?.antiraid_timeout_enabled,
    commandSettings?.anti_raid_timeout_enabled,
    commandSettings?.antiraid?.timeout_enabled,
    commandSettings?.anti_raid?.timeout_enabled,
    commandSettings?.antiraid_settings?.timeout_enabled,
    commandSettings?.anti_raid_settings?.timeout_enabled,
    true
  );

  const antiRaidTimeoutDuration = pickDefinedValue(
    source?.antiraid_timeout_duration,
    source?.anti_raid_timeout_duration,
    source?.antiraid?.timeout_duration,
    source?.anti_raid?.timeout_duration,
    source?.antiraid_settings?.timeout_duration,
    source?.anti_raid_settings?.timeout_duration,
    commandSettings?.antiraid_timeout_duration,
    commandSettings?.anti_raid_timeout_duration,
    commandSettings?.antiraid?.timeout_duration,
    commandSettings?.anti_raid?.timeout_duration,
    commandSettings?.antiraid_settings?.timeout_duration,
    commandSettings?.anti_raid_settings?.timeout_duration,
    30
  );

  const antiRaidLogChannelId = pickDefinedValue(
    source?.antiraid_log_channel_id,
    source?.anti_raid_log_channel_id,
    source?.antiraid_log_channel,
    source?.anti_raid_log_channel,
    source?.antiraid?.log_channel_id,
    source?.anti_raid?.log_channel_id,
    source?.antiraid_settings?.log_channel_id,
    source?.anti_raid_settings?.log_channel_id,
    commandSettings?.antiraid_log_channel_id,
    commandSettings?.anti_raid_log_channel_id,
    commandSettings?.antiraid_log_channel,
    commandSettings?.anti_raid_log_channel,
    ""
  );

  const antiRaidStaffRoles = pickDefinedValue(
    source?.antiraid_staff_role_ids,
    source?.anti_raid_staff_role_ids,
    source?.antiraid_staff_roles,
    source?.anti_raid_staff_roles,
    source?.antiraid?.staff_role_ids,
    source?.anti_raid?.staff_role_ids,
    commandSettings?.antiraid_staff_role_ids,
    commandSettings?.anti_raid_staff_role_ids,
    commandSettings?.antiraid_staff_roles,
    commandSettings?.anti_raid_staff_roles,
    []
  );

  const antiNukeEnabled = pickDefinedValue(
    source?.antinuke_enabled,
    source?.anti_nuke_enabled,
    source?.antinuke?.enabled,
    source?.anti_nuke?.enabled,
    source?.antinuke_settings?.enabled,
    source?.anti_nuke_settings?.enabled,
    commandSettings?.antinuke_enabled,
    commandSettings?.anti_nuke_enabled,
    commandSettings?.antinuke?.enabled,
    commandSettings?.anti_nuke?.enabled,
    commandSettings?.antinuke_settings?.enabled,
    commandSettings?.anti_nuke_settings?.enabled,
    true
  );

  const antiNukeActionThreshold = pickDefinedValue(
    source?.antinuke_action_threshold,
    source?.anti_nuke_action_threshold,
    source?.antinuke?.action_threshold,
    source?.anti_nuke?.action_threshold,
    source?.antinuke_settings?.action_threshold,
    source?.anti_nuke_settings?.action_threshold,
    commandSettings?.antinuke_action_threshold,
    commandSettings?.anti_nuke_action_threshold,
    commandSettings?.antinuke?.action_threshold,
    commandSettings?.anti_nuke?.action_threshold,
    commandSettings?.antinuke_settings?.action_threshold,
    commandSettings?.anti_nuke_settings?.action_threshold,
    3
  );

  const antiNukeWindowSeconds = pickDefinedValue(
    source?.antinuke_window_seconds,
    source?.anti_nuke_window_seconds,
    source?.antinuke?.window_seconds,
    source?.anti_nuke?.window_seconds,
    source?.antinuke_settings?.window_seconds,
    source?.anti_nuke_settings?.window_seconds,
    commandSettings?.antinuke_window_seconds,
    commandSettings?.anti_nuke_window_seconds,
    commandSettings?.antinuke?.window_seconds,
    commandSettings?.anti_nuke?.window_seconds,
    commandSettings?.antinuke_settings?.window_seconds,
    commandSettings?.anti_nuke_settings?.window_seconds,
    15
  );

  const antiNukeAlertCooldown = pickDefinedValue(
    source?.antinuke_alert_cooldown,
    source?.anti_nuke_alert_cooldown,
    source?.antinuke?.alert_cooldown,
    source?.anti_nuke?.alert_cooldown,
    source?.antinuke_settings?.alert_cooldown,
    source?.anti_nuke_settings?.alert_cooldown,
    commandSettings?.antinuke_alert_cooldown,
    commandSettings?.anti_nuke_alert_cooldown,
    commandSettings?.antinuke?.alert_cooldown,
    commandSettings?.anti_nuke?.alert_cooldown,
    commandSettings?.antinuke_settings?.alert_cooldown,
    commandSettings?.anti_nuke_settings?.alert_cooldown,
    20
  );

  const antiNukeTimeoutEnabled = pickDefinedValue(
    source?.antinuke_timeout_enabled,
    source?.anti_nuke_timeout_enabled,
    source?.antinuke?.timeout_enabled,
    source?.anti_nuke?.timeout_enabled,
    source?.antinuke_settings?.timeout_enabled,
    source?.anti_nuke_settings?.timeout_enabled,
    commandSettings?.antinuke_timeout_enabled,
    commandSettings?.anti_nuke_timeout_enabled,
    commandSettings?.antinuke?.timeout_enabled,
    commandSettings?.anti_nuke?.timeout_enabled,
    commandSettings?.antinuke_settings?.timeout_enabled,
    commandSettings?.anti_nuke_settings?.timeout_enabled,
    true
  );

  const antiNukeTimeoutDuration = pickDefinedValue(
    source?.antinuke_timeout_duration,
    source?.anti_nuke_timeout_duration,
    source?.antinuke?.timeout_duration,
    source?.anti_nuke?.timeout_duration,
    source?.antinuke_settings?.timeout_duration,
    source?.anti_nuke_settings?.timeout_duration,
    commandSettings?.antinuke_timeout_duration,
    commandSettings?.anti_nuke_timeout_duration,
    commandSettings?.antinuke?.timeout_duration,
    commandSettings?.anti_nuke?.timeout_duration,
    commandSettings?.antinuke_settings?.timeout_duration,
    commandSettings?.anti_nuke_settings?.timeout_duration,
    30
  );

  const antiNukeLogChannelId = pickDefinedValue(
    source?.antinuke_log_channel_id,
    source?.anti_nuke_log_channel_id,
    source?.antinuke_log_channel,
    source?.anti_nuke_log_channel,
    source?.antinuke?.log_channel_id,
    source?.anti_nuke?.log_channel_id,
    source?.antinuke_settings?.log_channel_id,
    source?.anti_nuke_settings?.log_channel_id,
    commandSettings?.antinuke_log_channel_id,
    commandSettings?.anti_nuke_log_channel_id,
    commandSettings?.antinuke_log_channel,
    commandSettings?.anti_nuke_log_channel,
    ""
  );

  const antiNukeStaffRoles = pickDefinedValue(
    source?.antinuke_staff_role_ids,
    source?.anti_nuke_staff_role_ids,
    source?.antinuke_staff_roles,
    source?.anti_nuke_staff_roles,
    source?.antinuke?.staff_role_ids,
    source?.anti_nuke?.staff_role_ids,
    commandSettings?.antinuke_staff_role_ids,
    commandSettings?.anti_nuke_staff_role_ids,
    commandSettings?.antinuke_staff_roles,
    commandSettings?.anti_nuke_staff_roles,
    []
  );

  return {
    logChannelId: String(logChannelId || "").trim(),
    staffRoleIds: normalizeIdList(staffRoles),
    exemptRoleIds: normalizeIdList(exemptRoles),
    exemptChannelIds: normalizeIdList(exemptChannels),
    exemptUserIds: normalizeIdList(exemptUsers),
    antiSpamEnabled: Boolean(antiSpamEnabled),
    antiSpamMaxMessages: Math.max(1, Number(antiSpamMaxMessages || 5)),
    antiSpamWindowSeconds: Math.max(1, Number(antiSpamWindowSeconds || 3)),
    antiSpamAlertCooldown: Math.max(1, Number(antiSpamAlertCooldown || 10)),
    antiSpamTimeoutEnabled: Boolean(antiSpamTimeoutEnabled),
    antiSpamTimeoutDuration: Math.max(5, Number(antiSpamTimeoutDuration || 30)),
    antiSpamLogChannelId: String(antiSpamLogChannelId || "").trim(),
    antiSpamStaffRoleIds: normalizeIdList(antiSpamStaffRoles),
    antiRaidEnabled: Boolean(antiRaidEnabled),
    antiRaidJoinThreshold: Math.max(1, Number(antiRaidJoinThreshold || 8)),
    antiRaidWindowSeconds: Math.max(1, Number(antiRaidWindowSeconds || 12)),
    antiRaidAlertCooldown: Math.max(1, Number(antiRaidAlertCooldown || 30)),
    antiRaidTimeoutEnabled: Boolean(antiRaidTimeoutEnabled),
    antiRaidTimeoutDuration: Math.max(5, Number(antiRaidTimeoutDuration || 30)),
    antiRaidLogChannelId: String(antiRaidLogChannelId || "").trim(),
    antiRaidStaffRoleIds: normalizeIdList(antiRaidStaffRoles),
    antiNukeEnabled: Boolean(antiNukeEnabled),
    antiNukeActionThreshold: Math.max(1, Number(antiNukeActionThreshold || 3)),
    antiNukeWindowSeconds: Math.max(1, Number(antiNukeWindowSeconds || 15)),
    antiNukeAlertCooldown: Math.max(1, Number(antiNukeAlertCooldown || 20)),
    antiNukeTimeoutEnabled: Boolean(antiNukeTimeoutEnabled),
    antiNukeTimeoutDuration: Math.max(5, Number(antiNukeTimeoutDuration || 30)),
    antiNukeLogChannelId: String(antiNukeLogChannelId || "").trim(),
    antiNukeStaffRoleIds: normalizeIdList(antiNukeStaffRoles),
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
