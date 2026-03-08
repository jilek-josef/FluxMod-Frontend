import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getBackendUrl } from "../JS/api";
import "../Styles/dashboard.css";
import "../Styles/guild-dashboard.css";
import "../Styles/defaults.css";
import Default from"./static-imgs/default.png";

const MAX_AUTOMOD_RULES = 5;
const MAX_WORDS = 250;
const MAX_REGEXES = 10;

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

function normalizeRulesResponse(payload) {
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

function getRuleId(rule = {}) {
  return rule?.id || rule?.rule_id || rule?.ruleId || "";
}

function parseCommaSeparated(value) {
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

function normalizeRule(rule = {}) {
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

function getRuleKeywordsValue(rule = {}) {
  return normalizeRule(rule).keyword;
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

  const [automodForm, setAutomodForm] = useState({
    name: "AutoMod Rule",
    keyword: "",
    pattern: "",
    action: "warn",
    threshold: 1,
  });
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmittingRule, setIsSubmittingRule] = useState(false);
  const [automodRules, setAutomodRules] = useState([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState("");
  const [editingRuleForm, setEditingRuleForm] = useState({
    name: "",
    keyword: "",
    pattern: "",
    action: "warn",
    threshold: 1,
    enabled: true,
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState("");
  const keywordOverridesRef = useRef({});
  const visibleRules = automodRules.slice(0, MAX_AUTOMOD_RULES);
  const hasReachedRuleLimit = automodRules.length >= MAX_AUTOMOD_RULES;
  const keywordTokens = useMemo(() => parseCommaSeparated(automodForm.keyword), [automodForm.keyword]);
  const regexTokens = useMemo(() => parseCommaSeparated(automodForm.pattern), [automodForm.pattern]);
  const editKeywordTokens = useMemo(
    () => parseCommaSeparated(editingRuleForm.keyword),
    [editingRuleForm.keyword]
  );
  const editRegexTokens = useMemo(
    () => parseCommaSeparated(editingRuleForm.pattern),
    [editingRuleForm.pattern]
  );
  const isCreateLimitExceeded = keywordTokens.length > MAX_WORDS || regexTokens.length > MAX_REGEXES;
  const isEditLimitExceeded = editKeywordTokens.length > MAX_WORDS || editRegexTokens.length > MAX_REGEXES;

  const loadAutomodRules = async () => {
    if (!guildId) {
      setAutomodRules([]);
      return;
    }

    setIsLoadingRules(true);

    try {
      const response = await fetch(
        `${backendUrl}/api/guilds/rules?guild_id=${encodeURIComponent(guildId)}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load rules (${response.status})`);
      }

      const payload = await response.json();
      const normalizedRules = normalizeRulesResponse(payload).map((rule) => normalizeRule(rule));
      const withOverrides = normalizedRules.map((rule) => {
        const ruleId = getRuleId(rule);
        const keywordOverride = keywordOverridesRef.current[ruleId];

        if (!rule?.keyword && keywordOverride) {
          return {
            ...rule,
            keyword: keywordOverride,
          };
        }

        return rule;
      });

      setAutomodRules(withOverrides);
    } catch (error) {
      setAutomodRules([]);
      setStatusMessage(error?.message || "Failed to load AutoMod rules.");
    } finally {
      setIsLoadingRules(false);
    }
  };

  useEffect(() => {
    loadAutomodRules();
  }, [guildId, backendUrl]);

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

    if (hasReachedRuleLimit) {
      setStatusMessage(`This guild already has ${MAX_AUTOMOD_RULES} AutoMod rules.`);
      return;
    }

    if (keywordTokens.length > MAX_WORDS) {
      setStatusMessage(`Keywords exceed max limit (${MAX_WORDS}).`);
      return;
    }

    if (regexTokens.length > MAX_REGEXES) {
      setStatusMessage(`Regex patterns exceed max limit (${MAX_REGEXES}).`);
      return;
    }

    setIsSubmittingRule(true);
    setStatusMessage("");

    try {
      const submittedKeyword = automodForm.keyword.trim();
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
            keyword: automodForm.keyword,
            keywords: keywordTokens,
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

      let createdRule = null;
      try {
        createdRule = await response.json();
      } catch {
        createdRule = null;
      }

      const createdRuleId = getRuleId(createdRule || {});
      if (createdRuleId && submittedKeyword) {
        keywordOverridesRef.current[createdRuleId] = submittedKeyword;
      }

      setStatusMessage("AutoMod rule created successfully.");
      setAutomodForm((prev) => ({
        ...prev,
        keyword: "",
        pattern: "",
        threshold: 1,
      }));
      await loadAutomodRules();
    } catch (error) {
      setStatusMessage(error?.message || "Failed to create AutoMod rule.");
    } finally {
      setIsSubmittingRule(false);
    }
  };

  const beginEditRule = (rule) => {
    setEditingRuleId(getRuleId(rule));
    setEditingRuleForm({
      name: rule?.name || "",
      keyword: getRuleKeywordsValue(rule),
      pattern: rule?.pattern || "",
      action: rule?.action || "warn",
      threshold: Number(rule?.threshold || 1),
      enabled: rule?.enabled !== false,
    });
  };

  const cancelEditRule = () => {
    setEditingRuleId("");
  };

  const handleEditRuleChange = (event) => {
    const { name, type, checked, value } = event.target;
    setEditingRuleForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : name === "threshold"
            ? Math.max(1, Number(value) || 1)
            : value,
    }));
  };

  const saveEditedRule = async () => {
    if (!guildId || !editingRuleId) {
      return;
    }

    if (editKeywordTokens.length > MAX_WORDS) {
      setStatusMessage(`Keywords exceed max limit (${MAX_WORDS}).`);
      return;
    }

    if (editRegexTokens.length > MAX_REGEXES) {
      setStatusMessage(`Regex patterns exceed max limit (${MAX_REGEXES}).`);
      return;
    }

    const payload = {
      name: editingRuleForm.name,
      keyword: editingRuleForm.keyword,
      keywords: editKeywordTokens,
      pattern: editingRuleForm.pattern,
      action: editingRuleForm.action,
      threshold: editingRuleForm.threshold,
      enabled: editingRuleForm.enabled,
    };

    const candidates = [
      `${backendUrl}/api/guilds/rules/${encodeURIComponent(editingRuleId)}?guild_id=${encodeURIComponent(guildId)}`,
      `${backendUrl}/api/guilds/rules?guild_id=${encodeURIComponent(guildId)}&rule_id=${encodeURIComponent(editingRuleId)}`,
    ];

    setIsSavingEdit(true);

    try {
      const editedKeyword = editingRuleForm.keyword.trim();
      let lastError = null;

      for (const url of candidates) {
        const response = await fetch(url, {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          if (editingRuleId && editedKeyword) {
            keywordOverridesRef.current[editingRuleId] = editedKeyword;
          }

          setStatusMessage("AutoMod rule updated successfully.");
          setEditingRuleId("");
          await loadAutomodRules();
          return;
        }

        if (response.status !== 404) {
          lastError = new Error(`Failed to update rule (${response.status})`);
          break;
        }
      }

      throw lastError || new Error("Failed to update AutoMod rule.");
    } catch (error) {
      setStatusMessage(error?.message || "Failed to update AutoMod rule.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const deleteRule = async (ruleId) => {
    if (!guildId || !ruleId) {
      return;
    }

    const candidates = [
      `${backendUrl}/api/guilds/rules/${encodeURIComponent(ruleId)}?guild_id=${encodeURIComponent(guildId)}`,
      `${backendUrl}/api/guilds/rules?guild_id=${encodeURIComponent(guildId)}&rule_id=${encodeURIComponent(ruleId)}`,
    ];

    setDeletingRuleId(ruleId);

    try {
      let lastError = null;

      for (const url of candidates) {
        const response = await fetch(url, {
          method: "DELETE",
          credentials: "include",
        });

        if (response.ok) {
          setStatusMessage("AutoMod rule deleted successfully.");
          if (editingRuleId === ruleId) {
            setEditingRuleId("");
          }
          await loadAutomodRules();
          return;
        }

        if (response.status !== 404) {
          lastError = new Error(`Failed to delete rule (${response.status})`);
          break;
        }
      }

      throw lastError || new Error("Failed to delete AutoMod rule.");
    } catch (error) {
      setStatusMessage(error?.message || "Failed to delete AutoMod rule.");
    } finally {
      setDeletingRuleId("");
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
          <h3>AutoMod Setup</h3>
          <form className="automod-form" onSubmit={handleAutomodSubmit}>
            <label className="automod-rule-label">
              Rule Name
              <input
                name="name"
                value={automodForm.name}
                onChange={handleAutomodChange}
                required
              />
            </label>

            <label className="automod-rule-label">
              Keyword
              <input
                name="keyword"
                value={automodForm.keyword}
                onChange={handleAutomodChange}
                placeholder="badword, badword2"
                required
              />
              <span className="token-counter">
                {keywordTokens.length} / {MAX_WORDS} words
              </span>
              {keywordTokens.length > 0 && (
                <span className="token-chip-list">
                  {keywordTokens.map((token, index) => (
                    <span className="token-chip" key={`kw-${token}-${index}`}>
                      {token}
                    </span>
                  ))}
                </span>
              )}
            </label>

            <label className="automod-rule-label">
              Pattern (Optional)
              <input
                name="pattern"
                value={automodForm.pattern}
                onChange={handleAutomodChange}
                placeholder="\\b(badword)\\b, (https?:\\/\\/\\S+)"
              />
              <span className="token-counter">
                {regexTokens.length} / {MAX_REGEXES} regexes
              </span>
              {regexTokens.length > 0 && (
                <span className="token-chip-list">
                  {regexTokens.map((token, index) => (
                    <span className="token-chip" key={`rx-${token}-${index}`}>
                      {token}
                    </span>
                  ))}
                </span>
              )}
            </label>

            <label className="automod-rule-label">
              Action
              <select name="action" value={automodForm.action} onChange={handleAutomodChange}>
                <option value="warn">Warn</option>
              </select>
            </label>

            <button
              type="submit"
              disabled={isSubmittingRule || hasReachedRuleLimit || isCreateLimitExceeded}
            >
              {isSubmittingRule ? "Saving..." : "Create AutoMod Rule"}
            </button>
          </form>

          {hasReachedRuleLimit && (
            <p className="subtitle">Rule limit reached: {MAX_AUTOMOD_RULES} / {MAX_AUTOMOD_RULES}</p>
          )}

          <div className="automod-rules-list">
            {isLoadingRules && <p className="subtitle">Loading AutoMod rules...</p>}

            {!isLoadingRules && visibleRules.length === 0 && (
              <p className="subtitle">No AutoMod rules yet. Create one above.</p>
            )}

            {!isLoadingRules && visibleRules.length > 0 && (
              <>
                <h4 className="automod-rules-title">Existing Rules</h4>
                <div className="automod-rules-grid">
                {visibleRules.map((rule) => {
                  const ruleId = getRuleId(rule);
                  const isEditing = editingRuleId === ruleId;
                  const isDeleting = deletingRuleId === ruleId;

                  return (
                    <article className="automod-rule-card" key={ruleId || `${rule.name}-${rule.pattern}`}>
                      {!isEditing && (
                        <>
                          <div className="automod-rule-info">
                            <h5>{rule?.name || "Unnamed Rule"}</h5>
                            <div>
                              <p><strong>Keywords</strong></p>
                              <div className="token-chip-list">
                                {parseCommaSeparated(getRuleKeywordsValue(rule)).length > 0 ? (
                                  parseCommaSeparated(getRuleKeywordsValue(rule)).map((token, index) => (
                                    <span className="token-chip" key={`${ruleId}-kw-${token}-${index}`}>
                                      {token}
                                    </span>
                                  ))
                                ) : (
                                  <span className="token-chip muted">-</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <p><strong>Regex</strong></p>
                              <div className="token-chip-list">
                                {parseCommaSeparated(rule?.pattern).length > 0 ? (
                                  parseCommaSeparated(rule?.pattern).map((token, index) => (
                                    <span className="token-chip" key={`${ruleId}-rx-${token}-${index}`}>
                                      {token}
                                    </span>
                                  ))
                                ) : (
                                  <span className="token-chip muted">-</span>
                                )}
                              </div>
                            </div>
                            <p>
                              <strong>Action:</strong> {rule?.action || "warn"}
                            </p>
                            <p>
                              <strong>Status:</strong> {rule?.enabled === false ? "Disabled" : "Enabled"}
                            </p>
                          </div>

                          <div className="automod-rule-actions">
                            <button
                              className="action-btn secondary"
                              type="button"
                              onClick={() => beginEditRule(rule)}
                            >
                              Edit
                            </button>
                            <button
                              className="action-btn danger"
                              type="button"
                              onClick={() => deleteRule(ruleId)}
                              disabled={isDeleting || !ruleId}
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </>
                      )}

                      {isEditing && (
                        <div className="automod-rule-edit">
                          <label className="automod-rule-label">
                            Rule Name
                            <input
                              name="name"
                              value={editingRuleForm.name}
                              onChange={handleEditRuleChange}
                            />
                          </label>

                          <label className="automod-rule-label">
                            Keyword
                            <input
                              name="keyword"
                              value={editingRuleForm.keyword}
                              onChange={handleEditRuleChange}
                            />
                            <span className="token-counter">
                              {editKeywordTokens.length} / {MAX_WORDS} words
                            </span>
                          </label>

                          <label className="automod-rule-label">
                            Pattern
                            <input
                              name="pattern"
                              value={editingRuleForm.pattern}
                              onChange={handleEditRuleChange}
                            />
                            <span className="token-counter">
                              {editRegexTokens.length} / {MAX_REGEXES} regexes
                            </span>
                          </label>

                          <label className="automod-rule-label">
                            Action
                            <select
                              name="action"
                              value={editingRuleForm.action}
                              onChange={handleEditRuleChange}
                            >
                              <option value="warn">Warn</option>
                            </select>
                          </label>

                          <label className="automod-enabled-label">
                            <input
                              type="checkbox"
                              name="enabled"
                              checked={editingRuleForm.enabled}
                              onChange={handleEditRuleChange}
                            />
                            Enabled
                          </label>

                          <div className="automod-rule-actions">
                            <button
                              className="action-btn"
                              type="button"
                              onClick={saveEditedRule}
                              disabled={isSavingEdit || isEditLimitExceeded}
                            >
                              {isSavingEdit ? "Saving..." : "Save"}
                            </button>
                            <button
                              className="action-btn secondary"
                              type="button"
                              onClick={cancelEditRule}
                              disabled={isSavingEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
                </div>
              </>
            )}
          </div>
        </section>

        {statusMessage && <p className="subtitle">{statusMessage}</p>}
      </main>
    </section>
  );
}
