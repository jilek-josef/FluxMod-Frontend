import {
  escapeHtml,
  getGuildId,
  getGuildName,
  getGuildIconUrl,
  getStatusGroup,
  getStatusMessage,
  getUserName,
  getUserPfpUrl,
  hasAdministratorPermission,
  isGuildOwner,
  normalizeStatusCode,
} from "./helpers.js";

export function isRouteActive(routePath, exact, currentPathname) {
  const normalizedPathname =
    currentPathname === "/index.html" || currentPathname === "/pages/index.html"
      ? "/"
      : currentPathname;

  if (exact) {
    return normalizedPathname === routePath;
  }

  return normalizedPathname.startsWith(routePath);
}

export function renderLayout({ appRoot, navLinks, pathname, isAuthLoading, user, contentHtml, contentFluid }) {
  const isAuthenticated = Boolean(user);
  const authArea = isAuthLoading
    ? `<span class="user-info">Checking session...</span>`
    : isAuthenticated
      ? `<button type="button" id="logout" class="auth-btn logout-btn">Logout</button>`
      : `<button type="button" id="login" class="auth-btn">Login</button>`;

  const dashboardLink = isAuthenticated
    ? `<a class="nav-link ${isRouteActive("/pages/dashboard.html", false, pathname) ? "active" : ""}" href="/pages/dashboard.html">Dashboard</a>`
    : "";

  const linksHtml = navLinks
    .map((link) => {
      const active = isRouteActive(link.path, link.exact, pathname) ? "active" : "";
      return `<a class="nav-link ${active}" href="${link.path}">${link.label}</a>`;
    })
    .join("");

  appRoot.innerHTML = `
    <div class="app-shell">
      <header>
        <div class="header-content">
          <a class="brand" href="/">FluxMod</a>
          <nav class="nav-links" aria-label="Main navigation">
            ${linksHtml}
            ${dashboardLink}
            <div class="login" id="auth-area">${authArea}</div>
          </nav>
        </div>
      </header>
      <main class="content ${contentFluid ? "content-fluid" : ""}" id="app-content">${contentHtml}</main>

      <footer class="site-footer" aria-label="Open source links">
        <div class="site-footer-inner">
          <p class="site-footer-title">FluxMod is open source on GitHub</p>
          <div class="site-footer-links">
            <a href="https://github.com/BlixedBox/FluxMod-Frontend" target="_blank" rel="noreferrer noopener">Frontend</a>
            <a href="https://github.com/BlixedBox/FluxMod-Backend" target="_blank" rel="noreferrer noopener">Backend</a>
            <a href="https://github.com/BlixedBox/FluxMod-Bot" target="_blank" rel="noreferrer noopener">Bot</a>
          </div>
        </div>
      </footer>
    </div>
  `;
}

export function renderHomePage({ isAuthenticated, fluxmodLogo }) {
  return `
    <div class="home-layout">
      <section class="title-card">
        <img class="fluxmod-logo" src="${fluxmodLogo}" alt="FluxMod Logo" />
        <h1>FluxMod / Dashboard</h1>
        <p class="title-desc">Your AutoMod solution for Fluxer guilds.</p>

        <div class="hero-actions">
          <button type="button" class="login-w-fluxer" id="home-login">
            <i class="fa-solid fa-arrow-right-to-bracket"></i>
            ${isAuthenticated ? "Switch Account" : "Login with Fluxer"}
          </button>

          <a
            class="hero-link-btn hero-link-btn-primary"
            href="https://web.fluxer.app/oauth2/authorize?client_id=1475487256413421606&scope=bot&permissions=4504699407788166"
            target="_blank"
            rel="noreferrer noopener"
          >
            <i class="fa-solid fa-user-plus"></i>
            Invite the Bot
          </a>

          <a
            class="hero-link-btn hero-link-btn-secondary"
            href="https://fluxer.gg/cTPTpEsu"
            target="_blank"
            rel="noreferrer noopener"
          >
            <i class="fa-solid fa-life-ring"></i>
            Support Server
          </a>
        </div>
      </section>

      <div class="dashboard-grid">
        <div class="dashboard-card">
          <div class="card-icon servers-icon"><i class="fa-solid fa-server"></i></div>
          <h3>Servers</h3>
          <p class="card-stat" id="home-guild-count">0</p>
          <p class="card-label">Active</p>
        </div>

        <div class="dashboard-card">
          <div class="card-icon analytics-icon"><i class="fa-solid fa-gauge"></i></div>
          <h3>Uptime</h3>
          <p class="card-stat" id="home-uptime-display">-</p>
          <p class="card-label" id="home-uptime-label">Current health</p>
        </div>

        <div class="dashboard-card">
          <div class="card-icon logs-icon"><i class="fa-solid fa-file-alt"></i></div>
          <h3>Commits</h3>
          <p class="card-stat" id="home-commit-count">0</p>
          <p class="card-label">Within the last 24 hours</p>
        </div>
      </div>
    </div>
  `;
}

export function renderTermsPage() {
  return `
    <section class="legal-page">
      <h2>FluxMod Terms of Service</h2>
      <p class="muted">Last Updated: March 4, 2026</p>
      <p>Welcome to <strong>FluxMod</strong>, an open-source moderation bot and dashboard built for the Fluxer platform.</p>
      <p>By adding FluxMod to your server or using the FluxMod dashboard, you agree to the following Terms of Service.</p>
      <h3>1. Acceptance of Terms</h3>
      <p>By using FluxMod, you agree to:</p>
      <ul>
        <li>Comply with these Terms of Service</li>
        <li>Comply with Fluxer's platform rules and policies</li>
      </ul>
      <p>If you do not agree, you must discontinue use of the service.</p>
      <h3>2. Description of Service</h3>
      <p>FluxMod provides moderation commands, warning systems, AutoMod configuration, storage, and dashboard access via Fluxer OAuth.</p>
      <h3>3. Proper Use</h3>
      <p>You agree not to violate platform policies, abuse auth systems, disrupt service, or access data without permission.</p>
      <h3>4. Service Availability</h3>
      <p>FluxMod is provided "as is" without guaranteed uptime.</p>
      <h3>5. Limitation of Liability</h3>
      <p>Server owners are responsible for how they configure and use FluxMod.</p>
      <h3>6. Termination</h3>
      <p>Access may be suspended for abuse or Terms violations.</p>
      <h3>7. Changes to Terms</h3>
      <p>Continued use after updates means you accept revised terms.</p>
      <h3>8. Contact</h3>
      <p>Questions can be sent through the official GitHub repositories.</p>
    </section>
  `;
}

export function renderPrivacyPage() {
  return `
    <section class="legal-page">
      <h2>FluxMod Privacy Policy</h2>
      <p class="muted">Last Updated: March 4, 2026</p>
      <p>FluxMod is designed with transparency and data minimization in mind.</p>
      <h3>1. Information We Collect</h3>
      <p>Only data needed for moderation and dashboard functionality is stored.</p>
      <h3>2. How We Use Information</h3>
      <p>Data is used to provide moderation features and secure dashboard sessions.</p>
      <h3>3. Data Retention</h3>
      <p>Warnings are deleted after one year; inactive data after two years.</p>
      <h3>4. Data Security</h3>
      <p>Reasonable safeguards are used, but absolute security cannot be guaranteed.</p>
      <h3>5. Data Sharing</h3>
      <p>FluxMod does not sell or share data with advertisers.</p>
      <h3>6. User Rights</h3>
      <p>Users may request access and deletion where applicable.</p>
      <h3>7. Open Source Transparency</h3>
      <p>All data handling logic is publicly auditable via project repositories.</p>
      <h3>8. Changes to This Policy</h3>
      <p>Continued use after updates means you accept the updated policy.</p>
    </section>
  `;
}

export function renderStatusPage(pathname, search) {
  const params = new URLSearchParams(search);
  const pathParts = pathname.split("/").filter(Boolean);
  const pathCode = pathParts.length >= 2 && pathParts[0] === "status" ? pathParts[1] : "";
  const queryCode = params.get("code");

  const statusCode = normalizeStatusCode(pathCode || queryCode);
  const message = getStatusMessage(statusCode);
  const group = getStatusGroup(statusCode);

  return {
    title: `${statusCode} ${message} • FluxMod`,
    html: `
      <main class="container landing-main">
        <section class="page-card hero-stat">
          <p><strong>${statusCode}</strong> <span id="protected-guilds-count">${escapeHtml(message)}</span></p>
          <p class="muted">${escapeHtml(group)}</p>
        </section>

        <section class="page-card" style="width:min(860px,100%);text-align:center;">
          <p class="muted">Try going back to the homepage.</p>
          <p><br /><a class="nav-link active" href="/">Go Home</a></p>
        </section>
      </main>
    `,
  };
}

export function renderContributorsPage() {
  return `
    <section class="page-card">
      <h2>Contributors</h2><br />
      <p class="muted">People helping build FluxMod.</p>
      <div class="grid-container" id="contributors-grid" aria-live="polite"></div>
      <p class="muted" id="contributors-error"></p>
    </section>
  `;
}

export function renderDashboardPage(user, defaultImage) {
  const username = getUserName(user || {});
  const currentUserId = String(user?.id || "");
  const guilds = Array.isArray(user?.guilds) ? user.guilds : [];

  const sortedGuilds = guilds
    .map((guild, originalIndex) => {
      const canOpenGuild = isGuildOwner(guild, currentUserId) || hasAdministratorPermission(guild);
      return { guild, originalIndex, canOpenGuild };
    })
    .sort((left, right) => {
      if (left.canOpenGuild === right.canOpenGuild) {
        return left.originalIndex - right.originalIndex;
      }

      return left.canOpenGuild ? -1 : 1;
    });

  const cards = sortedGuilds
    .map(({ guild, canOpenGuild }) => {
      const guildId = getGuildId(guild);
      const guildName = getGuildName(guild);
      const disabledClass = canOpenGuild ? "" : "dashboard-card-disabled";
      const blockedReason = !canOpenGuild
        ? `<p class="card-label blocked-reason">Owner/Admin required</p>`
        : "";

      return `
        <div class="dashboard-card ${disabledClass}" data-guild-id="${escapeHtml(guildId)}" data-open="${canOpenGuild}" aria-disabled="${!canOpenGuild}">
          <img class="guild-icon-image" src="${getGuildIconUrl(guild, defaultImage)}" alt="${escapeHtml(guildName)} icon" loading="lazy" data-fallback-image="true" />
          <h3>${escapeHtml(guildName)}</h3>
          <p class="card-label">ID: ${escapeHtml(guildId || "Unavailable")}</p>
          ${blockedReason}
        </div>
      `;
    })
    .join("");

  const empty = guilds.length === 0 ? `<p class="subtitle">No guilds found for this account.</p>` : "";

  return `
    <section class="dashboard">
      <aside class="sidebar">
        <nav class="sidebar-nav">
          <div class="nav-section">
            <p class="nav-label">Welcome back</p>
            <div class="user-profile">
              <img class="user-pfp" src="${getUserPfpUrl(user || {}, defaultImage)}" alt="${escapeHtml(username)} profile" loading="lazy" data-fallback-image="true" />
              <p class="user-greeting">${escapeHtml(username)}</p>
            </div>
          </div>

          <div class="nav-section">
            <span class="section-title">General</span>
            <ul>
              <li><a class="sidebar-active"><i class="fa-solid fa-server"></i><span>Servers</span></a></li>
            </ul>
            <span class="section-title">AutoMod Features</span>
            <a class="sidebar-nav"><i class="fa-solid fa-file-shield"></i><span>Audit Logs</span></a>
          </div>
        </nav>
      </aside>

      <main class="main-content">
        <div class="dashboard-grid" id="dashboard-guild-grid">
          ${empty}
          ${cards}
        </div>
      </main>
    </section>
  `;
}

export function renderGuildDashboardPage() {
  return `
    <section class="dashboard guild-dashboard-layout">
      <main class="main-content guild-settings-page" id="guild-dashboard-root"></main>
    </section>
  `;
}

export function renderRuleEditorPage() {
  return `
    <section class="dashboard guild-dashboard-layout">
      <main class="main-content guild-settings-page" id="guild-rule-editor-root"></main>
    </section>
  `;
}
