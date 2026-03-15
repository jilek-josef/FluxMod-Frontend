import { isDevMode } from "./devMode";

const BACKEND_URL_KEY = "fluxmod_backend_url";
const DEFAULT_BACKEND_URL = "http://localhost:8000";

export function getBackendUrl() {
  const stored = localStorage.getItem(BACKEND_URL_KEY);
  return stored || DEFAULT_BACKEND_URL;
}

export function setBackendUrl(url) {
  localStorage.setItem(BACKEND_URL_KEY, url);
}

export function isLocalPage() {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function normalizePath(path) {
  return path.startsWith("/") ? path : `/${path}`;
}

export async function fetchWithAuth(path, options = {}) {
  const backendUrl = getBackendUrl();
  const normalizedPath = normalizePath(path);
  const candidates = [];

  try {
    const backendOrigin = new URL(backendUrl).origin;
    if (backendOrigin !== window.location.origin) {
      candidates.push(`${backendUrl}${normalizedPath}`);
      if (isLocalPage()) {
        candidates.push(normalizedPath);
      }
    } else {
      candidates.push(normalizedPath);
    }
  } catch {
    candidates.push(`${backendUrl}${normalizedPath}`);
    if (isLocalPage()) {
      candidates.push(normalizedPath);
    }
  }

  let lastError = null;

  for (let i = 0; i < candidates.length; i++) {
    const url = candidates[i];
    try {
      const response = await fetch(url, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      if ((response.status === 404 || response.status === 405) && i < candidates.length - 1) {
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Request failed for ${normalizedPath}`);
}

export async function getMe() {
  if (isDevMode()) {
    const { getMockUser } = await import("./devMode");
    return getMockUser();
  }
  const response = await fetchWithAuth("/api/me");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Failed to fetch user");
  return response.json();
}

export async function getGuilds() {
  const response = await fetchWithAuth("/api/guilds");
  if (!response.ok) throw new Error("Failed to fetch guilds");
  return response.json();
}

// Mock rules for dev mode
const MOCK_RULES = [
  {
    id: "rule_1",
    name: "Spam Detection",
    keyword: ["spam", "buy now", "click here"],
    allowed_keywords: [],
    pattern: [],
    action: "delete",
    severity: 2,
    enabled: true,
    timeout_duration: 10,
    escalation_enabled: true,
    escalation_warn_threshold: 2,
    escalation_action: "timeout",
    escalation_timeout_duration: 30,
    escalation_reset_minutes: 60,
  },
  {
    id: "rule_2",
    name: "Profanity Filter",
    keyword: ["badword1", "badword2"],
    allowed_keywords: ["class"],
    pattern: [],
    action: "warn",
    severity: 1,
    enabled: true,
    timeout_duration: 5,
    escalation_enabled: false,
  },
  {
    id: "rule_3",
    name: "Invite Link Blocker",
    keyword: [],
    allowed_keywords: [],
    pattern: ["discord\\.gg\\/[a-zA-Z0-9]+", "discord\\.com\\/invite\\/[a-zA-Z0-9]+"],
    action: "delete",
    severity: 2,
    enabled: false,
    timeout_duration: 10,
    escalation_enabled: true,
    escalation_warn_threshold: 3,
    escalation_action: "kick",
  },
];

// Mock LHS settings for dev mode
const MOCK_LHS_SETTINGS = {
  enabled: false,
  global_threshold: 0.55,
  categories: {
    dangerous_content: { enabled: true, threshold: 0.55 },
    hate_speech: { enabled: true, threshold: 0.55 },
    harassment: { enabled: true, threshold: 0.55 },
    sexually_explicit: { enabled: true, threshold: 0.55 },
    toxicity: { enabled: true, threshold: 0.55 },
    severe_toxicity: { enabled: true, threshold: 0.55 },
    threat: { enabled: true, threshold: 0.55 },
    insult: { enabled: false, threshold: 0.55 },
    identity_attack: { enabled: true, threshold: 0.55 },
    phish: { enabled: true, threshold: 0.55 },
    spam: { enabled: true, threshold: 0.55 },
  },
  exempt_roles: [],
  exempt_channels: [],
  exempt_users: [],
  action: "delete",
  severity: 2,
  log_only_mode: false,
  channel_overrides: {},
  image_moderation: {
    enabled: false,
    scan_attachments: true,
    scan_embeds: true,
    filters: {
      general: { enabled: false, threshold: 0.2, action: "delete" },
      sensitive: { enabled: false, threshold: 0.8, action: "delete" },
      questionable: { enabled: false, threshold: 0.2, action: "delete" },
      explicit: { enabled: false, threshold: 0.2, action: "delete" },
      guro: { enabled: false, threshold: 0.3, action: "delete" },
      realistic: { enabled: false, threshold: 0.25, action: "delete" },
      csam_check: { enabled: false, threshold: 0.09, action: "ban" },
    },
    log_only_mode: false,
  },
};

export async function getGuildRules(guildId) {
  if (isDevMode()) {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    return [...MOCK_RULES];
  }
  const response = await fetchWithAuth(`/api/guilds/${guildId}/rules`);
  if (!response.ok) throw new Error("Failed to fetch rules");
  return response.json();
}

export async function createGuildRule(guildId, rule) {
  const response = await fetchWithAuth(`/api/guilds/${guildId}/rules`, {
    method: "POST",
    body: JSON.stringify(rule),
  });
  if (!response.ok) throw new Error("Failed to create rule");
  return response.json();
}

export async function updateGuildRule(guildId, ruleId, rule) {
  const response = await fetchWithAuth(`/api/guilds/${guildId}/rules/${ruleId}`, {
    method: "PUT",
    body: JSON.stringify(rule),
  });
  if (!response.ok) throw new Error("Failed to update rule");
  return response.json();
}

export async function deleteGuildRule(guildId, ruleId) {
  const response = await fetchWithAuth(`/api/guilds/${guildId}/rules/${ruleId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete rule");
  return response.json();
}

export async function toggleGuildRule(guildId, ruleId, enabled) {
  const response = await fetchWithAuth(`/api/guilds/${guildId}/rules/${ruleId}/toggle`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
  if (!response.ok) throw new Error("Failed to toggle rule");
  return response.json();
}

export async function getGuildSettings(guildId) {
  const response = await fetchWithAuth(`/api/guilds/${guildId}/settings`);
  if (!response.ok) throw new Error("Failed to fetch settings");
  return response.json();
}

export async function updateGuildSettings(guildId, settings) {
  const response = await fetchWithAuth(`/api/guilds/${guildId}/settings`, {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error("Failed to update settings");
  return response.json();
}

export async function logout() {
  if (isDevMode()) {
    window.location.reload();
    return;
  }
  try {
    await fetchWithAuth("/logout", { method: "POST" });
  } catch (error) {
    console.error("Logout error:", error);
  }
}

export function getLoginUrl() {
  const backendUrl = getBackendUrl();
  const frontendUrl = encodeURIComponent(window.location.origin);
  return `${backendUrl}/login?frontendUrl=${frontendUrl}`;
}

export async function fetchGuildCount() {
  try {
    const response = await fetch("https://api.fluxmod.app/api/guild-count");
    if (response.ok) {
      const data = await response.json();
      return data?.guild_count ?? data?.count ?? 0;
    }
  } catch {
    // Fallback
  }
  return 0;
}

export async function fetchHealth() {
  try {
    const endpoint = isLocalPage() 
      ? "http://localhost:8000/healthz" 
      : "https://api.fluxmod.app/healthz";
    const response = await fetch(endpoint, { credentials: "include" });
    if (response.ok) {
      const data = await response.json();
      return {
        uptime: data?.uptime24h ?? data?.uptime_24h ?? null,
        status: data?.status || "unknown",
      };
    }
  } catch {
    // Fallback
  }
  return { uptime: null, status: "unknown" };
}

export async function fetchRecentCommits() {
  const owner = "BlixedBox";
  const repos = ["FluxMod-Frontend", "FluxMod-Backend", "FluxMod-Bot"];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  async function fetchRepoCommitCount(repo) {
    let page = 1;
    let count = 0;
    const perPage = 100;

    while (page <= 10) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits?since=${encodeURIComponent(since)}&per_page=${perPage}&page=${page}`
        );
        if (!response.ok) return count;
        const commits = await response.json();
        if (!Array.isArray(commits) || commits.length === 0) break;
        count += commits.length;
        if (commits.length < perPage) break;
        page++;
      } catch {
        break;
      }
    }
    return count;
  }

  try {
    const counts = await Promise.all(repos.map((repo) => fetchRepoCommitCount(repo)));
    return counts.reduce((sum, value) => sum + value, 0);
  } catch {
    return 0;
  }
}

export async function getLHSSettings(guildId) {
  if (isDevMode()) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return { ...MOCK_LHS_SETTINGS };
  }
  const response = await fetchWithAuth(`/api/guilds/lhs-settings?guild_id=${guildId}`);
  if (!response.ok) throw new Error("Failed to fetch LHS settings");
  return response.json();
}

export async function updateLHSSettings(guildId, settings) {
  if (isDevMode()) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { ...settings };
  }
  const response = await fetchWithAuth(`/api/guilds/lhs-settings?guild_id=${guildId}`, {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error("Failed to update LHS settings");
  return response.json();
}

export async function fetchContributors() {
  const owner = "BlixedBox";
  const repos = ["FluxMod-Frontend", "FluxMod-Backend", "FluxMod-Bot"];
  const maintainers = ["unclemelo", "pitr1010", "2chainzz", "8-bit-ball", "Bunn001"];

  try {
    const repoContributors = await Promise.all(
      repos.map(async (repo) => {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`);
        if (!response.ok) throw new Error(`Contributors fetch failed for ${repo}`);
        return response.json();
      })
    );

    const merged = new Map();
    for (const contributorsForRepo of repoContributors) {
      for (const contributor of contributorsForRepo) {
        const existing = merged.get(contributor.login);
        if (existing) {
          existing.contributions += contributor.contributions || 0;
        } else {
          merged.set(contributor.login, {
            login: contributor.login,
            contributions: contributor.contributions || 0,
            avatar_url: contributor.avatar_url,
            url: contributor.url,
          });
        }
      }
    }

    const contributors = Array.from(merged.values()).sort(
      (a, b) => b.contributions - a.contributions
    );

    const profiles = await Promise.all(
      contributors.map(async (contributor) => {
        try {
          const profileResponse = await fetch(contributor.url);
          if (!profileResponse.ok) {
            return {
              login: contributor.login,
              contributions: contributor.contributions,
              name: null,
              avatarUrl: contributor.avatar_url,
            };
          }
          const profile = await profileResponse.json();
          return {
            login: contributor.login,
            contributions: contributor.contributions,
            name: profile.name || null,
            avatarUrl: profile.avatar_url,
          };
        } catch {
          return {
            login: contributor.login,
            contributions: contributor.contributions,
            name: null,
            avatarUrl: contributor.avatar_url,
          };
        }
      })
    );

    return profiles.map((c) => ({
      ...c,
      role: maintainers.includes(c.login.toLowerCase()) ? "Maintainer" : "Contributor",
    }));
  } catch (error) {
    console.error("Error loading contributors:", error);
    return [];
  }
}
