import React from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/dashboard.css";
import "../Styles/defaults.css";
import Default from"./static-imgs/default.png";

export default function DashboardPage({ user }) {
  const navigate = useNavigate();
  const username = user?.username || user?.id || "User";
  const currentUserId = String(user?.id || "");
  const guilds = Array.isArray(user?.guilds) ? user.guilds : [];

  const DEFAULT_USER_PFP = Default; // fallback avatar
  const DEFAULT_GUILD_ICON = Default; // fallback guild icon

  const getGuildId = (guild) =>
    guild?.id || guild?.guild_id || guild?.guildId || guild?.discord_id || "";

  const getGuildName = (guild) =>
    guild?.name || guild?.guild_name || guild?.guildName || "Unnamed Guild";

  const isGuildOwner = (guild) => {
    const ownerId = String(
      guild?.owner_id || guild?.ownerId || guild?.guild_owner_id || guild?.guildOwnerId || ""
    );

    return Boolean(ownerId) && Boolean(currentUserId) && ownerId === currentUserId;
  };

  const hasAdministratorPermission = (guild) => {
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
  };

  const getGuildIconUrl = (guild) => {
    const guildId = getGuildId(guild);
    const guildIcon = String(guild?.icon || "").trim();

    if (!guild || !guildId) return DEFAULT_GUILD_ICON;
    if (!guildIcon || guildIcon.toLowerCase() === "none") return DEFAULT_GUILD_ICON;

    if (guildIcon) {
      const isAnimated = guildIcon.startsWith("a_");
        const format = isAnimated ? "gif" : "png";
      return `https://fluxerusercontent.com/icons/${guildId}/${guildIcon}.${format}`;
    }
    return DEFAULT_GUILD_ICON;
    };

  const getUserPfpUrl = (user) => {
    if (!user || !user.id) return DEFAULT_USER_PFP;
    if (user.avatar_url) {
        const isAnimated = user.avatar_url.startsWith("a_");
        const format = isAnimated ? "gif" : "png";
        return `https://fluxerusercontent.com/avatars/${user.id}/${user.avatar_url}.${format}`;
    }
    return DEFAULT_USER_PFP; // fallback
    };

  const handleGuildClick = (guildId) => {
    if (!guildId) {
      return;
    }

    navigate(`/dashboard/guild?guild_id=${encodeURIComponent(guildId)}`);
  };

  const sortedGuilds = guilds
    .map((guild, originalIndex) => {
      const canOpenGuild = isGuildOwner(guild) || hasAdministratorPermission(guild);
      return { guild, originalIndex, canOpenGuild };
    })
    .sort((left, right) => {
      if (left.canOpenGuild === right.canOpenGuild) {
        return left.originalIndex - right.originalIndex;
      }

      return left.canOpenGuild ? -1 : 1;
    });

  return (
    <section className="dashboard">
      <aside className="sidebar">
        <nav className="sidebar-nav">
          <div className="nav-section">
            <p className="nav-label">Welcome back</p>
            <div className="user-profile">
              <img
                className="user-pfp"
                src={getUserPfpUrl(user)}
                alt={`${username} profile`}
                loading="lazy"
                onError={(e) => (e.target.src = DEFAULT_USER_PFP)}
              />
              <p className="user-greeting">{username}</p>
            </div>
          </div>

          <div className="nav-section">
            <span className="section-title">General</span>
            <ul>
              <li>
                <a className="sidebar-active">
                  <i className="fa-solid fa-server"></i>
                  <span>Servers</span>
                </a>
              </li>
            </ul>
            <span className="section-title">AutoMod Features</span>
            <a className="sidebar-nav">
              <i className="fa-solid fa-file-shield"></i>
              <span>Audit Logs</span>
            </a>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <div className="dashboard-grid">
          {guilds.length === 0 && (
            <p className="subtitle">No guilds found for this account.</p>
          )}

          {sortedGuilds.map(({ guild, originalIndex, canOpenGuild }) => {
            const guildIconUrl = getGuildIconUrl(guild);
            const guildId = getGuildId(guild);
            const guildName = getGuildName(guild);
            const guildKey = guildId || `guild-${originalIndex}`;

            let blockedReason = "";
            if (!canOpenGuild) {
              blockedReason = "Owner/Admin required";
            }

            return (
              <div
                className={`dashboard-card ${canOpenGuild ? "" : "dashboard-card-disabled"}`.trim()}
                key={guildKey}
                onClick={() => {
                  if (canOpenGuild) {
                    handleGuildClick(guildId);
                  }
                }}
                aria-disabled={!canOpenGuild}
              >
                {guildIconUrl ? (
                  <img
                    className="guild-icon-image"
                    src={guildIconUrl}
                    alt={`${guildName || "Guild"} icon`}
                    loading="lazy"
                    onError={(e) => (e.target.src = DEFAULT_GUILD_ICON)}
                  />
                ) : (
                  <div className="card-icon servers-icon">
                    <i className="fa-solid fa-server"></i>
                  </div>
                )}
                <h3>{guildName}</h3>
                <p className="card-label">ID: {guildId || "Unavailable"}</p>
                {!canOpenGuild && <p className="card-label blocked-reason">{blockedReason}</p>}
              </div>
            );
          })}
        </div>
      </main>
    </section>
  );
}