export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getGuildId(guild = {}) {
  return guild?.id || guild?.guild_id || guild?.guildId || guild?.discord_id || "";
}

export function getGuildName(guild = {}) {
  return guild?.name || guild?.guild_name || guild?.guildName || "Unnamed Guild";
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

export function canManageGuild(guild, userId) {
  return isGuildOwner(guild, userId) || hasAdministratorPermission(guild);
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

export function resolveRuleId(search) {
  const params = new URLSearchParams(search);
  return params.get("rule_id") || params.get("id") || "";
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

const STATUS_TEXT = {
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Payload Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a teapot",
  421: "Misdirected Request",
  422: "Unprocessable Content",
  423: "Locked",
  424: "Failed Dependency",
  425: "Too Early",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  451: "Unavailable For Legal Reasons",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  508: "Loop Detected",
  510: "Not Extended",
  511: "Network Authentication Required",
};

export function getStatusMessage(code) {
  if (STATUS_TEXT[code]) {
    return STATUS_TEXT[code];
  }

  if (code >= 400 && code <= 499) return "Unknown Client Error";
  if (code >= 500 && code <= 599) return "Unknown Server Error";
  return "Unknown HTTP Status";
}

export function formatActionLabel(action) {
  if (action === "no_action") return "No Action";
  return String(action || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const RULE_ACTION_OPTIONS = [
  "no_action",
  "warn",
  "delete",
  "timeout",
  "mute",
  "kick",
  "ban",
];

export const ESCALATION_ACTION_OPTIONS = ["timeout", "kick", "ban"];

export const RULE_SEVERITY_OPTIONS = [
  { value: 1, label: "Low (log only)" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
];

export const MAX_AUTOMOD_RULES = 5;
export const MAX_WORDS = 250;
export const MAX_REGEXES = 10;
export const MAX_STAFF_PING_ROLES = 5;

// LHS (AI Moderation) constants
export const LHS_CATEGORIES = [
  { id: "dangerous_content", name: "Dangerous Content", description: "Content promoting dangerous or illegal activities" },
  { id: "hate_speech", name: "Hate Speech", description: "Content attacking protected groups" },
  { id: "harassment", name: "Harassment", description: "Content targeting individuals for harassment" },
  { id: "sexually_explicit", name: "Sexually Explicit", description: "Sexual or NSFW content" },
  { id: "toxicity", name: "Toxicity", description: "General toxic behavior" },
  { id: "severe_toxicity", name: "Severe Toxicity", description: "Extremely toxic or hateful content" },
  { id: "threat", name: "Threat", description: "Threats of violence or harm" },
  { id: "insult", name: "Insult", description: "Personal insults or attacks" },
  { id: "identity_attack", name: "Identity Attack", description: "Attacks based on identity characteristics" },
  { id: "phish", name: "Phishing", description: "Phishing attempts or suspicious links" },
  { id: "spam", name: "Spam", description: "Spam or repetitive unwanted content" },
];

export const DEFAULT_LHS_THRESHOLD = 0.55;
