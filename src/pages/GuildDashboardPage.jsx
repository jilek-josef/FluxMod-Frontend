import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getBackendUrl } from "../JS/api";
import "../Styles/dashboard.css";
import "../Styles/guild-dashboard.css";
import "../Styles/defaults.css";
import Default from"./static-imgs/default.png";

const COMMANDS = [
  { key: "kick", name: "Kick", description: "Allow moderators to remove members." },
  { key: "ban", name: "Ban", description: "Allow permanent member bans." },
  { key: "mute", name: "Mute", description: "Allow temporary member timeouts." },
  { key: "warn", name: "Warn", description: "Allow warning actions for violations." },
  { key: "purge", name: "Purge", description: "Allow bulk message cleanup." },
];

function resolveGuildId(search) {
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

function extractGuildMeta(guild = {}) {
  const guildId = guild?.id || guild?.guild_id || guild?.guildId || guild?.discord_id || "";
  const guildName = guild?.name || guild?.guild_name || guild?.guildName || "Unnamed Guild";
  const guildIcon = guild?.icon || "";
  return { guildId, guildName, guildIcon };
}

export default function GuildDashboardPage({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const backendUrl = useMemo(() => getBackendUrl(), []);

  const guildId = resolveGuildId(location.search);
  const userGuilds = Array.isArray(user?.guilds) ? user.guilds : [];

  const selectedGuild = useMemo(() => {
    return userGuilds.find((guild) => {
      const current = extractGuildMeta(guild);
      return current.guildId === guildId;
    });
  }, [guildId, userGuilds]);

  const { guildName, guildIcon } = extractGuildMeta(selectedGuild);

  const guildIconUrl = useMemo(() => {
    if (!guildId || !guildIcon) {
      return Default;
    }

    const isAnimated = guildIcon.startsWith("a_");
    const format = isAnimated ? "gif" : "png";
    return `https://fluxerusercontent.com/icons/${guildId}/${guildIcon}.${format}`;
  }, [guildIcon, guildId]);

  const [commandStates, setCommandStates] = useState({
    kick: true,
    ban: true,
    mute: true,
    warn: true,
    purge: true,
  });
  const [automodForm, setAutomodForm] = useState({
    name: "AutoMod Rule",
    pattern: "",
    action: "warn",
    threshold: 1,
  });
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);

  const toggleCommand = async (commandKey) => {
    if (!guildId) {
      return;
    }

    const nextValue = !commandStates[commandKey];
    setCommandStates((prev) => ({
      ...prev,
      [commandKey]: nextValue,
    }));

    try {
      await fetch(`${backendUrl}/api/update-command`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guildId,
          command: commandKey,
          enabled: nextValue,
        }),
      });
      setStatusMessage("Command settings updated.");
    } catch {
      setStatusMessage("Command toggle saved locally, backend update failed.");
    }
  };

  const handleAutomodChange = (event) => {
    const { name, value } = event.target;
    setAutomodForm((prev) => ({
      ...prev,
      [name]: name === "threshold" ? Number(value) : value,
    }));
  };

  const handleAutomodSubmit = async (event) => {
    event.preventDefault();

    if (!guildId) {
      setStatusMessage("Missing guild id in URL.");
      return;
    }

    setIsSubmittingRule(true);
    setStatusMessage("");

    try {
      const response = await fetch(
        `${backendUrl}/api/guilds/rules?guild_id=${encodeURIComponent(guildId)}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: automodForm.name,
            pattern: automodForm.pattern,
            action: automodForm.action,
            threshold: automodForm.threshold,
            enabled: true,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create rule (${response.status})`);
      }

      setStatusMessage("AutoMod rule created successfully.");
    } catch (error) {
      setStatusMessage(error?.message || "Failed to create AutoMod rule.");
    } finally {
      setIsSubmittingRule(false);
    }
  };

  if (!guildId) {
    return (
      <section className="dashboard guild-dashboard-layout">
        <main className="main-content">
          <p className="subtitle">Missing guild id. Open a guild from the dashboard list.</p>
        </main>
      </section>
    );
  }

  return (
    <section className="dashboard guild-dashboard-layout">
      <main className="main-content guild-settings-page">
        <div className="guild-page-header">
          <button
            className="action-btn secondary"
            type="button"
            onClick={() => navigate("/dashboard")}
          >
            <i className="fa-solid fa-arrow-left"></i>
            Back to Guilds
          </button>
        </div>

        <section className="dashboard-card guild-summary-card">
          <img
            className="guild-icon-image"
            src={guildIconUrl}
            alt={`${guildName} icon`}
            loading="lazy"
            onError={(event) => {
              event.target.src = Default;
            }}
          />
          <h3>{guildName}</h3>
          <p className="card-label">Guild ID: {guildId}</p>
        </section>

        <section className="content-section">
          <h3>Command Toggles</h3>
          <div className="commands-list">
            {COMMANDS.map((command) => (
              <div className="command-card" key={command.key}>
                <div className="command-left">
                  <div className="command-info">
                    <h3>{command.name}</h3>
                    <p className="command-description">{command.description}</p>
                  </div>
                </div>

                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={Boolean(commandStates[command.key])}
                    onChange={() => toggleCommand(command.key)}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            ))}
          </div>
        </section>

        <section className="content-section">
          <h3>AutoMod Setup</h3>
          <form className="automod-form" onSubmit={handleAutomodSubmit}>
            <label>
              Rule Name
              <input
                name="name"
                value={automodForm.name}
                onChange={handleAutomodChange}
                required
              />
            </label>

            <label>
              Pattern / Keyword
              <input
                name="pattern"
                value={automodForm.pattern}
                onChange={handleAutomodChange}
                placeholder="badword|spam-link"
                required
              />
            </label>

            <label>
              Action
              <select name="action" value={automodForm.action} onChange={handleAutomodChange}>
                <option value="warn">Warn</option>
                <option value="mute">Mute</option>
                <option value="delete">Delete Message</option>
              </select>
            </label>

            <label>
              Threshold
              <input
                type="number"
                min="1"
                name="threshold"
                value={automodForm.threshold}
                onChange={handleAutomodChange}
              />
            </label>

            <button type="submit" disabled={isSubmittingRule}>
              {isSubmittingRule ? "Saving..." : "Create AutoMod Rule"}
            </button>
          </form>
        </section>

        {statusMessage && <p className="subtitle">{statusMessage}</p>}
      </main>
    </section>
  );
}
