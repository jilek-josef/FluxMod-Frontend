import "@fortawesome/fontawesome-free/css/all.min.css";
import "./Styles/defaults.css";
import "./Styles/navbar.css";
import "./Styles/landing.css";
import "./Styles/dashboard.css";
import "./Styles/guild-dashboard.css";
import "./Styles/contributors.css";
import "./Styles/legal.css";
import "./Styles/status.css";
import { getBackendUrl } from "./JS/api.js";
import defaultImage from "./pages/static-imgs/default.png";
import fluxmodLogo from "./pages/static-imgs/fluxmod.png";
import { NAV_LINKS } from "./app/constants.js";
import { escapeHtml, isLocalPage } from "./app/helpers.js";
import {
  renderContributorsPage,
  renderDashboardPage,
  renderGuildDashboardPage,
  renderHomePage,
  renderLayout,
  renderPrivacyPage,
  renderRuleEditorPage,
  renderStatusPage,
  renderTermsPage,
} from "./app/renderers.js";
import { createGuildDashboardController } from "./app/guild-dashboard.js";
import { isDevMode, getMockUser, getMockGuilds } from "./JS/dev-mode.js";

const backendUrl = getBackendUrl();
const appRoot = document.getElementById("root");

const appState = {
  isAuthLoading: true,
  user: null,
  guildDashboardState: null,
};

let renderToken = 0;
const GUILD_COUNT_REFRESH_MS = 10_000;
let homeGuildCountIntervalId = null;

const guildDashboardController = createGuildDashboardController({
  backendUrl,
  appState,
  defaultImage,
  navigate,
  isDevMode: isDevMode(),
});

async function fetchWithAuthFallback(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
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

  for (let index = 0; index < candidates.length; index += 1) {
    const url = candidates[index];

    try {
      const response = await fetch(url, {
        credentials: "include",
        ...options,
      });

      if ((response.status === 404 || response.status === 405) && index < candidates.length - 1) {
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Request failed for ${normalizedPath}`);
}

async function hydrateAuth() {
  appState.isAuthLoading = true;
  render();

  // Check for developer mode (bypass OAuth)
  if (isDevMode()) {
    console.log('[FluxMod] Developer mode enabled - using mock user');
    appState.user = getMockUser();
    appState.isAuthLoading = false;
    render();
    return;
  }

  try {
    const response = await fetchWithAuthFallback("/api/me");

    if (response.status === 401) {
      appState.user = null;
      appState.botGuilds = [];
      return;
    }

    if (!response.ok) {
      throw new Error(`Auth check failed: ${response.status}`);
    }

    appState.user = await response.json();

    // Fetch guild list from backend to detect guilds where FluxMod is already installed
    const botGuildsResponse = await fetchWithAuthFallback("/api/guilds");
    if (botGuildsResponse.ok) {
      appState.botGuilds = await botGuildsResponse.json();
    } else {
      appState.botGuilds = [];
    }

    if (appState.user) {
      appState.user.botGuilds = appState.botGuilds;
    }
  } catch (error) {
    console.error(error);
    appState.user = null;
    appState.botGuilds = [];
  } finally {
    appState.isAuthLoading = false;
    render();
  }
}

function login() {
  // In dev mode, just reload to trigger dev mode again
  if (isDevMode()) {
    window.location.reload();
    return;
  }
  const frontendUrl = encodeURIComponent(window.location.origin);
  window.location.href = `${backendUrl}/login?frontendUrl=${frontendUrl}`;
}

async function logout() {
  // In dev mode, just reload
  if (isDevMode()) {
    window.location.reload();
    return;
  }

  try {
    await fetchWithAuthFallback("/logout");
  } catch (error) {
    console.error(error);
  }

  appState.user = null;
  navigate("/");
}

function navigate(path) {
  window.location.assign(path);
}

function clearHomeGuildCountPolling() {
  if (homeGuildCountIntervalId !== null) {
    window.clearInterval(homeGuildCountIntervalId);
    homeGuildCountIntervalId = null;
  }
}

async function mountHomePage(token) {
  clearHomeGuildCountPolling();

  const homeLogin = document.getElementById("home-login");
  if (homeLogin) {
    homeLogin.addEventListener("click", login);
  }

  const guildCountEl = document.getElementById("home-guild-count");
  const uptimeDisplayEl = document.getElementById("home-uptime-display");
  const uptimeLabelEl = document.getElementById("home-uptime-label");
  const commitCountEl = document.getElementById("home-commit-count");

  async function refreshGuildCount() {
    try {
      const guildEndpoint = "https://api.fluxmod.app/api/guild-count";
      const guildResponse = await fetch(guildEndpoint);
      if (token !== renderToken) {
        return;
      }

      if (guildResponse.ok) {
        const payload = await guildResponse.json();
        const count = Number(payload?.guild_count ?? payload?.count);
        if (Number.isFinite(count) && guildCountEl) {
          guildCountEl.textContent = String(count);
        }
      }
    } catch {
      // Keep fallback value
    }
  }

  void refreshGuildCount();
  homeGuildCountIntervalId = window.setInterval(() => {
    void refreshGuildCount();
  }, GUILD_COUNT_REFRESH_MS);

  try {
    const uptimeEndpoint = isLocalPage() ? "http://localhost:8000/healthz" : "https://api.fluxmod.app/healthz";
    const uptimeResponse = await fetch(uptimeEndpoint, { credentials: "include" });
    if (token !== renderToken) {
      return;
    }

    if (!uptimeResponse.ok) {
      if (uptimeDisplayEl) {
        uptimeDisplayEl.textContent = "Down";
      }
      if (uptimeLabelEl) {
        uptimeLabelEl.textContent = "Current health";
      }
    } else {
      const payload = await uptimeResponse.json().catch(() => null);
      const rawPercent =
        payload?.uptime24h ?? payload?.uptime_24h ?? payload?.uptimePercent ?? payload?.uptime_percent;
      const parsedPercent = Number(rawPercent);

      if (Number.isFinite(parsedPercent)) {
        if (uptimeDisplayEl) {
          uptimeDisplayEl.textContent = `${parsedPercent.toFixed(2)}%`;
        }
        if (uptimeLabelEl) {
          uptimeLabelEl.textContent = "Within the last 24 hours";
        }
      } else {
        const statusValue = String(payload?.status || "").toLowerCase();
        if (uptimeDisplayEl) {
          uptimeDisplayEl.textContent = statusValue === "ok" ? "Up" : "Down";
        }
        if (uptimeLabelEl) {
          uptimeLabelEl.textContent = "Current health";
        }
      }
    }
  } catch {
    if (uptimeDisplayEl) {
      uptimeDisplayEl.textContent = "-";
    }
    if (uptimeLabelEl) {
      uptimeLabelEl.textContent = "Current health unavailable";
    }
  }

  try {
    const owner = "BlixedBox";
    const repos = ["FluxMod-Frontend", "FluxMod-Backend", "FluxMod-Bot"];
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    async function fetchRepoCommitCount(repo) {
      let page = 1;
      let count = 0;
      const perPage = 100;

      while (page <= 10) {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits?since=${encodeURIComponent(since)}&per_page=${perPage}&page=${page}`
        );

        if (!response.ok) {
          return count;
        }

        const commits = await response.json();
        if (!Array.isArray(commits) || commits.length === 0) {
          break;
        }

        count += commits.length;
        if (commits.length < perPage) {
          break;
        }

        page += 1;
      }

      return count;
    }

    const counts = await Promise.all(repos.map((repo) => fetchRepoCommitCount(repo)));
    if (token !== renderToken) {
      return;
    }

    const total = counts.reduce((sum, value) => sum + value, 0);
    if (Number.isFinite(total) && commitCountEl) {
      commitCountEl.textContent = String(total);
    }
  } catch {
    // Keep fallback value
  }
}

async function mountContributorsPage(token) {
  const owner = "BlixedBox";
  const repos = ["FluxMod-Frontend", "FluxMod-Backend", "FluxMod-Bot"];
  const maintainers = ["unclemelo", "pitr1010", "2chainzz", "8-bit-ball", "Bunn001"];

  const grid = document.getElementById("contributors-grid");
  const errorNode = document.getElementById("contributors-error");

  if (!grid || !errorNode) {
    return;
  }

  try {
    errorNode.textContent = "";

    const repoContributors = await Promise.all(
      repos.map(async (repo) => {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`);
        if (!response.ok) {
          throw new Error(`Contributors fetch failed for ${repo}: ${response.status}`);
        }

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
      (left, right) => right.contributions - left.contributions
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

    if (token !== renderToken) {
      return;
    }

    grid.innerHTML = profiles
      .map((contributor) => {
        const normalizedLogin = contributor.login.toLowerCase();
        const role = maintainers.includes(normalizedLogin) ? "Maintainer" : "Contributor";

        return `
          <article class="contributor-card">
            <div style="display:flex;align-items:center;gap:8px;">
              <img src="${escapeHtml(contributor.avatarUrl)}" alt="${escapeHtml(contributor.login)}" />
              <div>
                <div class="contributor-name">${escapeHtml(contributor.name || contributor.login)}</div>
                <div class="contributor-role">${role}</div>
              </div>
            </div>
            <div style="margin-top:8px;color:var(--text-muted);font-size:0.85rem;">
              Commits: ${contributor.contributions}
            </div>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Error loading contributors:", error);
    if (token === renderToken) {
      errorNode.textContent = "Unable to load contributors. Please try again later.";
    }
  }
}

function mountDashboardPage() {
  const grid = document.getElementById("dashboard-guild-grid");
  if (!grid) {
    return;
  }

  grid.querySelectorAll(".dashboard-card").forEach((card) => {
    const hasInviteButton = Boolean(card.querySelector(".dashboard-card-add-btn"));
    const open = card.getAttribute("data-open") === "true";

    if (open && !hasInviteButton) {
      card.addEventListener("click", () => {
        const guildId = card.getAttribute("data-guild-id") || "";
        if (!guildId) {
          return;
        }

        navigate(`/pages/guild-dashboard.html?guild_id=${encodeURIComponent(guildId)}`);
      });
    }
  });
}

function wireGlobalEvents() {
  appRoot.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) {
        return;
      }

      if (target.dataset.fallbackImage === "true" && target.src !== defaultImage) {
        target.src = defaultImage;
      }
    },
    true
  );
}

function resolveRoute() {
  const pathname =
    window.location.pathname === "/index.html" || window.location.pathname === "/pages/index.html"
      ? "/"
      : window.location.pathname;
  const isAuthenticated = Boolean(appState.user);

  if (pathname === "/") return { page: "home", contentFluid: false };

  if (pathname === "/pages/dashboard.html") {
    if (appState.isAuthLoading) {
      return {
        page: "loading",
        contentFluid: false,
        html: `<section class="page-card"><p class="muted">Checking session...</p></section>`,
      };
    }

    if (!isAuthenticated) return { redirect: "/" };
    return { page: "dashboard", contentFluid: true };
  }

  if (pathname === "/pages/guild-dashboard.html") {
    if (appState.isAuthLoading) {
      return {
        page: "loading",
        contentFluid: false,
        html: `<section class="page-card"><p class="muted">Checking session...</p></section>`,
      };
    }

    if (!isAuthenticated) return { redirect: "/" };
    return { page: "guild-dashboard", contentFluid: true };
  }

  if (pathname === "/pages/rule-editor.html") {
    if (appState.isAuthLoading) {
      return {
        page: "loading",
        contentFluid: false,
        html: `<section class="page-card"><p class="muted">Checking session...</p></section>`,
      };
    }

    if (!isAuthenticated) return { redirect: "/" };
    return { page: "rule-editor", contentFluid: true };
  }

  if (pathname === "/pages/info.html") return { page: "info", contentFluid: false };
  if (pathname === "/pages/contributors.html") return { page: "contributors", contentFluid: false };
  if (pathname === "/pages/terms.html") return { page: "terms", contentFluid: false };
  if (pathname === "/pages/privacy.html") return { page: "privacy", contentFluid: false };
  if (pathname === "/pages/status.html") {
    return { page: "status", contentFluid: false };
  }

  return { redirect: "/pages/status.html?code=404" };
}

function mountRoute(route, token) {
  switch (route.page) {
    case "home":
      mountHomePage(token);
      break;
    case "contributors":
      mountContributorsPage(token);
      break;
    case "dashboard":
      mountDashboardPage();
      break;
    case "guild-dashboard":
      guildDashboardController.mount();
      break;
    case "rule-editor":
      guildDashboardController.mountRuleEditor();
      break;
    default:
      break;
  }
}

function render() {
  renderToken += 1;
  const token = renderToken;
  const route = resolveRoute();

  if (route.page !== "home") {
    clearHomeGuildCountPolling();
  }

  if (route.redirect) {
    navigate(route.redirect);
    return;
  }

  let pageHtml = "";
  let pageTitle = "FluxMod";

  switch (route.page) {
    case "home":
      pageHtml = renderHomePage({ isAuthenticated: Boolean(appState.user), fluxmodLogo });
      break;
    case "dashboard":
      pageTitle = "Dashboard • FluxMod";
      pageHtml = renderDashboardPage(appState.user, defaultImage);
      break;
    case "guild-dashboard":
      pageTitle = "Guild Dashboard • FluxMod";
      pageHtml = renderGuildDashboardPage();
      break;
    case "rule-editor":
      pageTitle = "Rule Editor • FluxMod";
      pageHtml = renderRuleEditorPage();
      break;
    case "contributors":
      pageTitle = "Contributors • FluxMod";
      pageHtml = renderContributorsPage();
      break;
    case "terms":
      pageTitle = "Terms • FluxMod";
      pageHtml = renderTermsPage();
      break;
    case "privacy":
      pageTitle = "Privacy • FluxMod";
      pageHtml = renderPrivacyPage();
      break;
    case "status": {
      const statusPage = renderStatusPage(window.location.pathname, window.location.search);
      pageTitle = statusPage.title;
      pageHtml = statusPage.html;
      break;
    }
    default:
      pageHtml = route.html || "";
      break;
  }

  document.title = pageTitle;

  renderLayout({
    appRoot,
    navLinks: NAV_LINKS,
    pathname: window.location.pathname,
    isAuthLoading: appState.isAuthLoading,
    user: appState.user,
    contentHtml: pageHtml,
    contentFluid: route.contentFluid,
    isDevMode: isDevMode(),
  });

  const loginButton = document.getElementById("login");
  if (loginButton) {
    loginButton.addEventListener("click", login);
  }

  const logoutButton = document.getElementById("logout");
  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }

  mountRoute(route, token);
}

wireGlobalEvents();
hydrateAuth();
render();
