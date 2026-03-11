import { MAX_AUTOMOD_RULES, MAX_REGEXES, MAX_WORDS } from "./constants.js";
import {
  escapeHtml,
  getGuildIconUrl,
  getGuildId,
  getGuildMeta,
  getRuleId,
  normalizeAutomodSettings,
  normalizeRule,
  normalizeRulesResponse,
  parseCommaSeparated,
  resolveGuildId,
} from "./helpers.js";

function resolveRuleId(search) {
  const params = new URLSearchParams(search);
  return params.get("rule_id") || params.get("id") || "";
}

export function createGuildDashboardController({ backendUrl, appState, defaultImage, navigate }) {
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
        pattern: "",
        action: "warn",
        threshold: 1,
      },
      statusMessage: "",
      isSubmittingRule: false,
      automodRules: [],
      isLoadingRules: false,
      editingRuleId: "",
      editingRuleForm: {
        name: "",
        keyword: "",
        pattern: "",
        action: "warn",
        threshold: 1,
        enabled: true,
      },
      editingOriginalForm: null,
      isSavingEdit: false,
      togglingRuleId: "",
      deletingRuleId: "",
      automodSettingsForm: {
        logChannelId: "",
        exemptRoleIds: "",
        exemptChannelIds: "",
        exemptUserIds: "",
      },
      isLoadingSettings: false,
      isSavingSettings: false,
      keywordOverrides: {},
    };
  }

  function ensureState() {
    if (!appState.guildDashboardState) {
      appState.guildDashboardState = getInitialState();
    }

    return appState.guildDashboardState;
  }

  function toRuleEditForm(rule = {}) {
    return {
      name: rule?.name || "",
      keyword: rule?.keyword || "",
      pattern: rule?.pattern || "",
      action: rule?.action || "warn",
      threshold: Math.max(1, Number(rule?.threshold || 1)),
      enabled: rule?.enabled !== false,
    };
  }

  function toComparableEditForm(form = {}) {
    return {
      name: String(form.name || "").trim(),
      keyword: String(form.keyword || "").trim(),
      pattern: String(form.pattern || "").trim(),
      action: String(form.action || "warn"),
      threshold: Math.max(1, Number(form.threshold || 1)),
      enabled: Boolean(form.enabled),
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

    ["name", "keyword", "pattern", "action", "threshold", "enabled"].forEach((key) => {
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
      case "pattern":
        return "patterns";
      case "action":
        return "action";
      case "threshold":
        return "threshold";
      case "enabled":
        return "status";
      default:
        return field;
    }
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
    const visibleRules = state.automodRules.slice(0, MAX_AUTOMOD_RULES);
    const hasReachedRuleLimit = state.automodRules.length >= MAX_AUTOMOD_RULES;
    const keywordTokens = parseCommaSeparated(state.automodForm.keyword);
    const regexTokens = parseCommaSeparated(state.automodForm.pattern);
    const editKeywordTokens = parseCommaSeparated(state.editingRuleForm.keyword);
    const editRegexTokens = parseCommaSeparated(state.editingRuleForm.pattern);
    const isCreateLimitExceeded = keywordTokens.length > MAX_WORDS || regexTokens.length > MAX_REGEXES;
    const isEditLimitExceeded = editKeywordTokens.length > MAX_WORDS || editRegexTokens.length > MAX_REGEXES;
    const editHasChanges = hasEditChanges(state);
    const changedFields = getChangedEditFields(state);

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
                const keywordValues = parseCommaSeparated(rule?.keyword || "");
                const patternValues = parseCommaSeparated(rule?.pattern || "");

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

                        <label class="automod-rule-label">
                          Keyword
                          <input name="keyword" value="${escapeHtml(state.editingRuleForm.keyword)}" data-edit-input />
                          <span class="token-counter">${editKeywordTokens.length} / ${MAX_WORDS} words</span>
                        </label>

                        <label class="automod-rule-label">
                          Pattern
                          <input name="pattern" value="${escapeHtml(state.editingRuleForm.pattern)}" data-edit-input />
                          <span class="token-counter">${editRegexTokens.length} / ${MAX_REGEXES} regexes</span>
                        </label>

                        <label class="automod-rule-label">
                          Action
                          <select name="action" data-edit-input>
                            <option value="warn" ${state.editingRuleForm.action === "warn" ? "selected" : ""}>Warn</option>
                          </select>
                        </label>

                        <label class="automod-rule-label">
                          Threshold
                          <input name="threshold" type="number" min="1" step="1" value="${escapeHtml(
                            state.editingRuleForm.threshold
                          )}" data-edit-input />
                        </label>

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
                      <div>
                        <p><strong>Keywords</strong></p>
                        <div class="token-chip-list">
                          ${
                            keywordValues.length > 0
                              ? keywordValues.map((token) => `<span class="token-chip">${escapeHtml(token)}</span>`).join("")
                              : '<span class="token-chip muted">-</span>'
                          }
                        </div>
                      </div>
                      <div>
                        <p><strong>Regex</strong></p>
                        <div class="token-chip-list">
                          ${
                            patternValues.length > 0
                              ? patternValues.map((token) => `<span class="token-chip">${escapeHtml(token)}</span>`).join("")
                              : '<span class="token-chip muted">-</span>'
                          }
                        </div>
                      </div>
                      <p><strong>Action:</strong> ${escapeHtml(rule?.action || "warn")}</p>
                      <p><strong>Status:</strong> ${rule?.enabled === false ? "Disabled" : "Enabled"}</p>
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

    root.innerHTML = `
      <div class="guild-page-header">
        <button class="action-btn secondary" type="button" id="back-to-guilds">
          <i class="fa-solid fa-arrow-left"></i>
          Back to Guilds
        </button>
      </div>

      <section class="dashboard-card guild-summary-card">
        <img class="guild-icon-image" src="${guildIconUrl}" alt="${escapeHtml(guildName)} icon" loading="lazy" data-fallback-image="true" />
        <h3>${escapeHtml(guildName)}</h3>
        <p class="card-label">Guild ID: ${escapeHtml(guildId)}</p>
      </section>

      <section class="content-section">
        <h3>AutoMod Setup</h3>

        <form class="automod-settings-form" id="automod-settings-form">
          <h4 class="automod-rules-title">Global AutoMod Settings</h4>

          <label class="automod-rule-label">
            AutoMod Log Channel ID
            <input name="logChannelId" value="${escapeHtml(state.automodSettingsForm.logChannelId)}" placeholder="123456789012345678" />
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

          <button type="submit" ${state.isSavingSettings || state.isLoadingSettings ? "disabled" : ""}>
            ${state.isLoadingSettings ? "Loading..." : state.isSavingSettings ? "Saving..." : "Save AutoMod Settings"}
          </button>
        </form>

        <form class="automod-form" id="automod-create-form">
          <label class="automod-rule-label">
            Rule Name
            <input name="name" value="${escapeHtml(state.automodForm.name)}" required />
          </label>

          <label class="automod-rule-label">
            Keyword
            <input name="keyword" value="${escapeHtml(state.automodForm.keyword)}" placeholder="badword, badword2" required />
            <span class="token-counter">${keywordTokens.length} / ${MAX_WORDS} words</span>
            ${
              keywordTokens.length > 0
                ? `<span class="token-chip-list">${keywordTokens.map((token) => `<span class="token-chip">${escapeHtml(token)}</span>`).join("")}</span>`
                : ""
            }
          </label>

          <label class="automod-rule-label">
            Pattern (Optional)
            <input name="pattern" value="${escapeHtml(state.automodForm.pattern)}" placeholder="\\b(badword)\\b, (https?:\\/\\/\\S+)" />
            <span class="token-counter">${regexTokens.length} / ${MAX_REGEXES} regexes</span>
            ${
              regexTokens.length > 0
                ? `<span class="token-chip-list">${regexTokens.map((token) => `<span class="token-chip">${escapeHtml(token)}</span>`).join("")}</span>`
                : ""
            }
          </label>

          <label class="automod-rule-label">
            Action
            <select name="action">
              <option value="warn" ${state.automodForm.action === "warn" ? "selected" : ""}>Warn</option>
            </select>
          </label>

          <button type="submit" ${state.isSubmittingRule || hasReachedRuleLimit || isCreateLimitExceeded ? "disabled" : ""}>
            ${state.isSubmittingRule ? "Saving..." : "Create AutoMod Rule"}
          </button>
        </form>

        ${hasReachedRuleLimit ? `<p class="subtitle">Rule limit reached: ${MAX_AUTOMOD_RULES} / ${MAX_AUTOMOD_RULES}</p>` : ""}

        <div class="automod-rules-list">
          ${state.isLoadingRules ? '<p class="subtitle">Loading AutoMod rules...</p>' : rulesHtml}
        </div>
      </section>

      ${state.statusMessage ? `<p class="subtitle">${escapeHtml(state.statusMessage)}</p>` : ""}
    `;

    const backButton = document.getElementById("back-to-guilds");
    if (backButton) {
      backButton.addEventListener("click", () => navigate("/pages/dashboard.html"));
    }

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

        state.automodSettingsForm[target.name] = target.value;
      });

      settingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await saveSettings(guildId, state);
        renderContent();
      });
    }

    if (createForm) {
      createForm.addEventListener("input", () => {
        const formData = new FormData(createForm);
        state.automodForm.name = String(formData.get("name") || "");
        state.automodForm.keyword = String(formData.get("keyword") || "");
        state.automodForm.pattern = String(formData.get("pattern") || "");
        state.automodForm.action = String(formData.get("action") || "warn");
        rerenderKeepingInput(renderContent);
      });

      createForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (isCreateLimitExceeded) {
          return;
        }

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
          state.editingRuleForm[name] = Math.max(1, Number(input.value || 1));
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
  }

  async function loadSettings(guildId, state) {
    if (!guildId) {
      return;
    }

    const candidates = [
      `${backendUrl}/api/guilds/automod-settings?guild_id=${encodeURIComponent(guildId)}`,
      `${backendUrl}/api/guilds/settings/automod?guild_id=${encodeURIComponent(guildId)}`,
      `${backendUrl}/api/guilds/settings?guild_id=${encodeURIComponent(guildId)}`,
    ];

    state.isLoadingSettings = true;
    state.statusMessage = "";
    renderContent();

    try {
      for (const url of candidates) {
        const response = await fetch(url, { method: "GET", credentials: "include" });
        if (response.ok) {
          const payload = await response.json();
          state.automodSettingsForm = normalizeAutomodSettings(payload);
          return;
        }

        if (response.status !== 404) {
          throw new Error(`Failed to load AutoMod settings (${response.status})`);
        }
      }

      state.automodSettingsForm = {
        logChannelId: "",
        exemptRoleIds: "",
        exemptChannelIds: "",
        exemptUserIds: "",
      };
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

    const payload = {
      log_channel_id: state.automodSettingsForm.logChannelId.trim(),
      exempt_role_ids: parseCommaSeparated(state.automodSettingsForm.exemptRoleIds),
      exempt_channel_ids: parseCommaSeparated(state.automodSettingsForm.exemptChannelIds),
      exempt_user_ids: parseCommaSeparated(state.automodSettingsForm.exemptUserIds),
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
          state.statusMessage = "AutoMod settings updated successfully.";
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
    const regexTokens = parseCommaSeparated(state.automodForm.pattern);

    if (!guildId) {
      state.statusMessage = "Missing guild id in URL.";
      return;
    }

    if (state.automodRules.length >= MAX_AUTOMOD_RULES) {
      state.statusMessage = `This guild already has ${MAX_AUTOMOD_RULES} AutoMod rules.`;
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
      const response = await fetch(`${backendUrl}/api/guilds/rules?guild_id=${encodeURIComponent(guildId)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.automodForm.name,
          keyword: state.automodForm.keyword,
          keywords: keywordTokens,
          pattern: state.automodForm.pattern,
          action: state.automodForm.action,
          threshold: state.automodForm.threshold,
          enabled: true,
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
    const editRegexTokens = parseCommaSeparated(state.editingRuleForm.pattern);

    if (editKeywordTokens.length > MAX_WORDS) {
      state.statusMessage = `Keywords exceed max limit (${MAX_WORDS}).`;
      return;
    }

    if (editRegexTokens.length > MAX_REGEXES) {
      state.statusMessage = `Regex patterns exceed max limit (${MAX_REGEXES}).`;
      return;
    }

    const payload = {
      name: String(state.editingRuleForm.name || "").trim(),
      keyword: String(state.editingRuleForm.keyword || "").trim(),
      keywords: editKeywordTokens,
      pattern: String(state.editingRuleForm.pattern || "").trim(),
      action: state.editingRuleForm.action,
      threshold: Math.max(1, Number(state.editingRuleForm.threshold || 1)),
      enabled: state.editingRuleForm.enabled,
    };

    const candidates = [
      `${backendUrl}/api/guilds/rules/${encodeURIComponent(state.editingRuleId)}?guild_id=${encodeURIComponent(guildId)}`,
      `${backendUrl}/api/guilds/rules?guild_id=${encodeURIComponent(guildId)}&rule_id=${encodeURIComponent(state.editingRuleId)}`,
    ];

    state.isSavingEdit = true;

    try {
      const editedKeyword = state.editingRuleForm.keyword.trim();
      let lastError = null;

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

          state.statusMessage = "AutoMod rule updated successfully.";
          cancelEditRule(state);
          await loadRules(guildId, state);
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

    const payload = {
      name: String(rule?.name || "").trim(),
      keyword: String(rule?.keyword || "").trim(),
      keywords: parseCommaSeparated(rule?.keyword || ""),
      pattern: String(rule?.pattern || "").trim(),
      action: String(rule?.action || "warn"),
      threshold: Math.max(1, Number(rule?.threshold || 1)),
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
    const editRegexTokens = parseCommaSeparated(state.editingRuleForm.pattern);
    const isEditLimitExceeded = editKeywordTokens.length > MAX_WORDS || editRegexTokens.length > MAX_REGEXES;
    const editHasChanges = hasEditChanges(state);
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

          <label class="automod-rule-label">
            Keywords (comma-separated)
            <input name="keyword" value="${escapeHtml(state.editingRuleForm.keyword)}" data-edit-input />
            <span class="token-counter">${editKeywordTokens.length} / ${MAX_WORDS} words</span>
          </label>

          <label class="automod-rule-label">
            Regex Patterns (comma-separated)
            <input name="pattern" value="${escapeHtml(state.editingRuleForm.pattern)}" data-edit-input />
            <span class="token-counter">${editRegexTokens.length} / ${MAX_REGEXES} regexes</span>
          </label>

          <label class="automod-rule-label">
            Action
            <select name="action" data-edit-input>
              <option value="warn" ${state.editingRuleForm.action === "warn" ? "selected" : ""}>Warn</option>
            </select>
          </label>

          <label class="automod-rule-label">
            Threshold
            <input name="threshold" type="number" min="1" step="1" value="${escapeHtml(state.editingRuleForm.threshold)}" data-edit-input />
          </label>

          <label class="automod-enabled-label">
            <input type="checkbox" name="enabled" ${state.editingRuleForm.enabled ? "checked" : ""} data-edit-input />
            Enabled
          </label>

          <div class="automod-rule-actions automod-rule-actions-full">
            <button class="action-btn" type="button" data-save-edit ${state.isSavingEdit || isEditLimitExceeded || !editHasChanges ? "disabled" : ""}>
              ${state.isSavingEdit ? "Saving..." : "Save Rule"}
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
          state.editingRuleForm[name] = Math.max(1, Number(input.value || 1));
        } else {
          state.editingRuleForm[name] = input.value;
        }

        rerenderKeepingInput(renderRuleEditorContent);
      });
    });

    const saveButton = root.querySelector("[data-save-edit]");
    if (saveButton) {
      saveButton.addEventListener("click", async () => {
        if (isEditLimitExceeded) {
          return;
        }

        await saveEditedRule(guildId, state);
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

    root.addEventListener("keydown", async (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!isEditLimitExceeded && !state.isSavingEdit && hasEditChanges(state)) {
          await saveEditedRule(guildId, state);
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

  async function mountRuleEditor() {
    const state = ensureState();
    const guildId = resolveGuildId(window.location.search);

    renderRuleEditorContent();
    await loadRules(guildId, state);
    renderRuleEditorContent();
  }

  async function mount() {
    const state = ensureState();
    const guildId = resolveGuildId(window.location.search);

    renderContent();
    await Promise.all([loadRules(guildId, state), loadSettings(guildId, state)]);
  }

  return {
    mount,
    mountRuleEditor,
    renderContent,
    ensureState,
  };
}
