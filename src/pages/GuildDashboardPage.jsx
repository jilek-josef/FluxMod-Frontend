import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Card,
  CardBody,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  Image,
  SimpleGrid,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useColorModeValue,
  VStack,
  Badge,
  Input,
  FormControl,
  FormLabel,
  Switch,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Textarea,
  Select,
  Checkbox,
  Divider,
  useToast,
  Skeleton,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import {
  FiArrowLeft,
  FiShield,
  FiMessageSquare,
  FiUsers,
  FiZap,
  FiSave,
  FiPlus,
  FiTrash2,
  FiEdit2,
  FiToggleRight,
  FiToggleLeft,
  FiCpu,
} from "react-icons/fi";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  getGuildRules,
  createGuildRule,
  updateGuildRule,
  deleteGuildRule,
  toggleGuildRule,
  getGuildSettings,
  updateGuildSettings,
  getLHSSettings,
  updateLHSSettings,
} from "@/utils/api";
import {
  resolveGuildId,
  getGuildIconUrl,
  getGuildName,
  canManageGuild,
  formatActionLabel,
  RULE_ACTION_OPTIONS,
  ESCALATION_ACTION_OPTIONS,
  RULE_SEVERITY_OPTIONS,
  MAX_AUTOMOD_RULES,
  MAX_WORDS,
  MAX_REGEXES,
  MAX_STAFF_PING_ROLES,
  parseCommaSeparated,
  LHS_CATEGORIES,
  DEFAULT_LHS_THRESHOLD,
} from "@/utils/helpers";

const SETTINGS_PAGES = [
  { key: "automod", label: "AutoMod", icon: FiShield },
  { key: "aimod", label: "AI Moderation", icon: FiCpu },
  { key: "antispam", label: "Anti Spam", icon: FiMessageSquare },
  { key: "antiraid", label: "Anti Raid", icon: FiUsers },
  { key: "antinuke", label: "Anti Nuke", icon: FiZap },
];

function Sidebar({ guild, activeTab, onTabChange }) {
  const bg = useColorModeValue("white", "slate.800");
  const borderColor = useColorModeValue("slate.200", "slate.700");
  const guildName = getGuildName(guild);
  const guildIcon = getGuildIconUrl(guild, "/default-guild.png");

  return (
    <Card bg={bg} borderColor={borderColor} borderWidth="1px" h="fit-content" position="sticky" top={20}>
      <CardBody>
        <VStack align="stretch" spacing={6}>
          <Box>
            <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="wider" color="muted" mb={3}>
              Guild
            </Text>
            <HStack spacing={3}>
              <Image
                src={guildIcon}
                alt={guildName}
                boxSize={12}
                rounded="lg"
                objectFit="cover"
                fallback={<Box boxSize={12} rounded="lg" bg="slate.700" />}
              />
              <Box overflow="hidden">
                <Text fontWeight="600" noOfLines={1}>
                  {guildName}
                </Text>
                <Text fontSize="xs" color="muted" fontFamily="mono">
                  {guild?.id}
                </Text>
              </Box>
            </HStack>
          </Box>

          <Button
            as={Link}
            to="/pages/dashboard.html"
            variant="ghost"
            justifyContent="flex-start"
            leftIcon={<FiArrowLeft />}
            size="sm"
          >
            Back to Guilds
          </Button>

          <Divider />

          <Box>
            <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="wider" color="muted" mb={3}>
              Protection Pages
            </Text>
            <VStack align="stretch" spacing={1}>
              {SETTINGS_PAGES.map((page) => (
                <Button
                  key={page.key}
                  variant={activeTab === page.key ? "solid" : "ghost"}
                  colorScheme={activeTab === page.key ? "brand" : undefined}
                  justifyContent="flex-start"
                  leftIcon={<Icon as={page.icon} />}
                  size="sm"
                  onClick={() => onTabChange(page.key)}
                >
                  {page.label}
                </Button>
              ))}
            </VStack>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
}

function RuleCard({ rule, onEdit, onToggle, onDelete, isLoading }) {
  const bg = useColorModeValue("white", "slate.800");
  const borderColor = useColorModeValue("slate.200", "slate.700");
  const isEnabled = rule?.enabled !== false;

  return (
    <Card bg={bg} borderColor={borderColor} borderWidth="1px">
      <CardBody>
        <VStack align="stretch" spacing={3}>
          <Flex justify="space-between" align="center">
            <Heading size="sm">{rule?.name || "Unnamed Rule"}</Heading>
            <Badge colorScheme={isEnabled ? "accent" : "gray"}>
              {isEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </Flex>

          <HStack spacing={4} fontSize="sm" color="muted">
            <Text>Action: {formatActionLabel(rule?.action)}</Text>
            <Text>Severity: {rule?.severity || 2}/3</Text>
          </HStack>

          <HStack spacing={2} pt={2}>
            <Button
              size="sm"
              leftIcon={<FiEdit2 />}
              onClick={() => onEdit(rule)}
              isDisabled={isLoading}
            >
              Edit
            </Button>
            <Button
              size="sm"
              leftIcon={isEnabled ? <FiToggleLeft /> : <FiToggleRight />}
              variant="outline"
              onClick={() => onToggle(rule)}
              isLoading={isLoading}
            >
              {isEnabled ? "Disable" : "Enable"}
            </Button>
            <Button
              size="sm"
              leftIcon={<FiTrash2 />}
              colorScheme="danger"
              variant="ghost"
              onClick={() => onDelete(rule)}
              isLoading={isLoading}
            >
              Delete
            </Button>
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  );
}

function AutoModTab({ guildId }) {
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    name: "",
    keyword: "",
    allowedKeywords: "",
    pattern: "",
    action: "warn",
    severity: 2,
    timeoutDuration: 10,
    escalationEnabled: false,
    escalationWarnThreshold: 1,
    escalationAction: "timeout",
    escalationTimeoutDuration: 10,
    escalationResetMinutes: 0,
  });

  const loadRules = useCallback(async () => {
    try {
      const data = await getGuildRules(guildId);
      setRules(Array.isArray(data) ? data : data?.rules || []);
    } catch (error) {
      toast({
        title: "Error loading rules",
        description: error.message,
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [guildId, toast]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const keywords = parseCommaSeparated(formData.keyword);
      const allowedKeywords = parseCommaSeparated(formData.allowedKeywords);
      const patterns = formData.pattern
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean);

      if (keywords.length > MAX_WORDS) {
        throw new Error(`Maximum ${MAX_WORDS} keywords allowed`);
      }
      if (patterns.length > MAX_REGEXES) {
        throw new Error(`Maximum ${MAX_REGEXES} regex patterns allowed`);
      }

      const ruleData = {
        name: formData.name,
        keyword: keywords,
        allowed_keywords: allowedKeywords,
        pattern: patterns,
        action: formData.action,
        severity: Number(formData.severity),
        timeout_duration: Number(formData.timeoutDuration),
        escalation_enabled: formData.escalationEnabled,
        escalation_warn_threshold: Number(formData.escalationWarnThreshold),
        escalation_action: formData.escalationAction,
        escalation_timeout_duration: Number(formData.escalationTimeoutDuration),
        escalation_reset_minutes: Number(formData.escalationResetMinutes),
      };

      if (editingRule) {
        await updateGuildRule(guildId, editingRule.id, ruleData);
        toast({ title: "Rule updated", status: "success" });
      } else {
        await createGuildRule(guildId, ruleData);
        toast({ title: "Rule created", status: "success" });
      }

      setFormData({
        name: "",
        keyword: "",
        allowedKeywords: "",
        pattern: "",
        action: "warn",
        severity: 2,
        timeoutDuration: 10,
        escalationEnabled: false,
        escalationWarnThreshold: 1,
        escalationAction: "timeout",
        escalationTimeoutDuration: 10,
        escalationResetMinutes: 0,
      });
      setEditingRule(null);
      await loadRules();
    } catch (error) {
      toast({
        title: "Error saving rule",
        description: error.message,
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name || "",
      keyword: Array.isArray(rule.keyword) ? rule.keyword.join(", ") : rule.keyword || "",
      allowedKeywords: Array.isArray(rule.allowed_keywords)
        ? rule.allowed_keywords.join(", ")
        : rule.allowed_keywords || "",
      pattern: Array.isArray(rule.pattern) ? rule.pattern.join("\n") : rule.pattern || "",
      action: rule.action || "warn",
      severity: rule.severity || 2,
      timeoutDuration: rule.timeout_duration || 10,
      escalationEnabled: rule.escalation_enabled || false,
      escalationWarnThreshold: rule.escalation_warn_threshold || 1,
      escalationAction: rule.escalation_action || "timeout",
      escalationTimeoutDuration: rule.escalation_timeout_duration || 10,
      escalationResetMinutes: rule.escalation_reset_minutes || 0,
    });
  };

  const handleToggle = async (rule) => {
    try {
      await toggleGuildRule(guildId, rule.id, !rule.enabled);
      await loadRules();
      toast({ title: `Rule ${rule.enabled ? "disabled" : "enabled"}`, status: "success" });
    } catch (error) {
      toast({ title: "Error toggling rule", description: error.message, status: "error" });
    }
  };

  const handleDelete = async (rule) => {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await deleteGuildRule(guildId, rule.id);
      await loadRules();
      toast({ title: "Rule deleted", status: "success" });
    } catch (error) {
      toast({ title: "Error deleting rule", description: error.message, status: "error" });
    }
  };

  const keywordCount = parseCommaSeparated(formData.keyword).length;
  const regexCount = formData.pattern.split("\n").filter(Boolean).length;
  const hasReachedLimit = rules.length >= MAX_AUTOMOD_RULES;

  return (
    <VStack align="stretch" spacing={6}>
      <Card>
        <CardBody>
          <VStack align="stretch" spacing={4} as="form" onSubmit={handleSubmit}>
            <Heading size="md">{editingRule ? "Edit Rule" : "Create AutoMod Rule"}</Heading>

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl isRequired>
                <FormLabel>Rule Name</FormLabel>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Spam Detection"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Action</FormLabel>
                <Select
                  value={formData.action}
                  onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                >
                  {RULE_ACTION_OPTIONS.map((action) => (
                    <option key={action} value={action}>
                      {formatActionLabel(action)}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </SimpleGrid>

            <FormControl>
              <FormLabel>Keywords ({keywordCount}/{MAX_WORDS})</FormLabel>
              <Input
                value={formData.keyword}
                onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                placeholder="badword, anotherword, spam"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Allowed Keywords</FormLabel>
              <Input
                value={formData.allowedKeywords}
                onChange={(e) => setFormData({ ...formData, allowedKeywords: e.target.value })}
                placeholder="trusted-site.com, safe phrase"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Regex Patterns ({regexCount}/{MAX_REGEXES})</FormLabel>
              <Textarea
                value={formData.pattern}
                onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                placeholder="\\b(badword)\\b&#10;(https?:\\/\\/\\S+)"
                rows={3}
              />
              <Text fontSize="xs" color="muted">
                One pattern per line
              </Text>
            </FormControl>

            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <FormControl>
                <FormLabel>Severity</FormLabel>
                <Select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: Number(e.target.value) })}
                >
                  {RULE_SEVERITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormControl>

              {formData.action === "timeout" && (
                <FormControl>
                  <FormLabel>Timeout (minutes)</FormLabel>
                  <NumberInput
                    value={formData.timeoutDuration}
                    onChange={(_, val) => setFormData({ ...formData, timeoutDuration: val })}
                    min={1}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
              )}
            </SimpleGrid>

            <FormControl>
              <Checkbox
                isChecked={formData.escalationEnabled}
                onChange={(e) => setFormData({ ...formData, escalationEnabled: e.target.checked })}
              >
                Enable offense escalation
              </Checkbox>
            </FormControl>

            {formData.escalationEnabled && (
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} pl={6}>
                <FormControl>
                  <FormLabel>Warn Threshold</FormLabel>
                  <NumberInput
                    value={formData.escalationWarnThreshold}
                    onChange={(_, val) => setFormData({ ...formData, escalationWarnThreshold: val })}
                    min={1}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Escalation Action</FormLabel>
                  <Select
                    value={formData.escalationAction}
                    onChange={(e) => setFormData({ ...formData, escalationAction: e.target.value })}
                  >
                    {ESCALATION_ACTION_OPTIONS.map((action) => (
                      <option key={action} value={action}>
                        {formatActionLabel(action)}
                      </option>
                    ))}
                  </Select>
                </FormControl>

                {formData.escalationAction === "timeout" && (
                  <FormControl>
                    <FormLabel>Escalation Timeout (minutes)</FormLabel>
                    <NumberInput
                      value={formData.escalationTimeoutDuration}
                      onChange={(_, val) =>
                        setFormData({ ...formData, escalationTimeoutDuration: val })
                      }
                      min={1}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                )}

                <FormControl>
                  <FormLabel>Reset Window (minutes)</FormLabel>
                  <NumberInput
                    value={formData.escalationResetMinutes}
                    onChange={(_, val) => setFormData({ ...formData, escalationResetMinutes: val })}
                    min={0}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <Text fontSize="xs" color="muted">
                    0 = never reset
                  </Text>
                </FormControl>
              </SimpleGrid>
            )}

            <HStack spacing={3} pt={2}>
              <Button
                type="submit"
                colorScheme="brand"
                leftIcon={<FiSave />}
                isLoading={isSaving}
                isDisabled={
                  hasReachedLimit && !editingRule ||
                  keywordCount > MAX_WORDS ||
                  regexCount > MAX_REGEXES
                }
              >
                {editingRule ? "Update Rule" : "Create Rule"}
              </Button>
              {editingRule && (
                <Button variant="ghost" onClick={() => setEditingRule(null)}>
                  Cancel
                </Button>
              )}
            </HStack>

            {hasReachedLimit && !editingRule && (
              <Alert status="warning" rounded="lg">
                <AlertIcon />
                Rule limit reached: {MAX_AUTOMOD_RULES} / {MAX_AUTOMOD_RULES}
              </Alert>
            )}
          </VStack>
        </CardBody>
      </Card>

      <Box>
        <Heading size="md" mb={4}>
          Existing Rules ({rules.length}/{MAX_AUTOMOD_RULES})
        </Heading>
        {isLoading ? (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} height="150px" rounded="xl" />
            ))}
          </SimpleGrid>
        ) : rules.length === 0 ? (
          <Text color="muted">No AutoMod rules yet. Create one above.</Text>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={handleEdit}
                onToggle={handleToggle}
                onDelete={handleDelete}
                isLoading={isSaving}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>
    </VStack>
  );
}

function AIModerationTab({ guildId }) {
  const [settings, setSettings] = useState({
    enabled: false,
    global_threshold: DEFAULT_LHS_THRESHOLD,
    categories: {},
    exempt_roles: [],
    exempt_channels: [],
    exempt_users: [],
    action: "delete",
    severity: 2,
    log_only_mode: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const loadSettings = useCallback(async () => {
    try {
      const data = await getLHSSettings(guildId);
      setSettings({
        enabled: data?.enabled ?? false,
        global_threshold: data?.global_threshold ?? DEFAULT_LHS_THRESHOLD,
        categories: data?.categories ?? {},
        exempt_roles: data?.exempt_roles ?? [],
        exempt_channels: data?.exempt_channels ?? [],
        exempt_users: data?.exempt_users ?? [],
        action: data?.action ?? "delete",
        severity: data?.severity ?? 2,
        log_only_mode: data?.log_only_mode ?? false,
      });
    } catch (error) {
      toast({ title: "Error loading AI moderation settings", description: error.message, status: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [guildId, toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateLHSSettings(guildId, settings);
      toast({ title: "AI moderation settings saved", status: "success" });
    } catch (error) {
      toast({ title: "Error saving settings", description: error.message, status: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const updateCategory = (catId, field, value) => {
    setSettings((prev) => ({
      ...prev,
      categories: {
        ...prev.categories,
        [catId]: {
          ...prev.categories[catId],
          [field]: value,
        },
      },
    }));
  };

  if (isLoading) {
    return <Skeleton height="400px" rounded="xl" />;
  }

  return (
    <VStack align="stretch" spacing={6}>
      <Card>
        <CardBody>
          <VStack align="stretch" spacing={6}>
            <Flex justify="space-between" align="center">
              <Box>
                <Heading size="md">AI Moderation Settings</Heading>
                <Text color="muted" fontSize="sm">
                  Uses AI to detect harmful content across 11 categories
                </Text>
              </Box>
              <FormControl display="flex" alignItems="center" w="auto">
                <FormLabel mb={0} mr={3}>
                  Enable AI Moderation
                </FormLabel>
                <Switch
                  isChecked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                />
              </FormControl>
            </Flex>

            <Divider />

            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <FormControl>
                <FormLabel>Global Threshold</FormLabel>
                <NumberInput
                  value={settings.global_threshold}
                  onChange={(_, val) => setSettings({ ...settings, global_threshold: val })}
                  min={0}
                  max={1}
                  step={0.01}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <Text fontSize="xs" color="muted">
                  {(settings.global_threshold * 100).toFixed(0)}% - Lower is more strict
                </Text>
              </FormControl>

              <FormControl>
                <FormLabel>Default Action</FormLabel>
                <Select
                  value={settings.action}
                  onChange={(e) => setSettings({ ...settings, action: e.target.value })}
                >
                  {RULE_ACTION_OPTIONS.filter(a => a !== "no_action").map((action) => (
                    <option key={action} value={action}>
                      {formatActionLabel(action)}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Severity</FormLabel>
                <Select
                  value={settings.severity}
                  onChange={(e) => setSettings({ ...settings, severity: Number(e.target.value) })}
                >
                  {RULE_SEVERITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </SimpleGrid>

            <FormControl display="flex" alignItems="center">
              <Checkbox
                isChecked={settings.log_only_mode}
                onChange={(e) => setSettings({ ...settings, log_only_mode: e.target.checked })}
              >
                Log Only Mode (no actions taken)
              </Checkbox>
            </FormControl>

            <Divider />

            <Heading size="sm">Detection Categories</Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              {LHS_CATEGORIES.map((cat) => {
                const catSettings = settings.categories[cat.id] || { enabled: true, threshold: settings.global_threshold };
                return (
                  <Card key={cat.id} variant="outline">
                    <CardBody py={3}>
                      <VStack align="stretch" spacing={2}>
                        <Flex justify="space-between" align="center">
                          <FormControl display="flex" alignItems="center" w="auto" mb={0}>
                            <Checkbox
                              isChecked={catSettings.enabled !== false}
                              onChange={(e) => updateCategory(cat.id, "enabled", e.target.checked)}
                            />
                            <FormLabel mb={0} ml={2} fontWeight="600">
                              {cat.name}
                            </FormLabel>
                          </FormControl>
                        </Flex>
                        <Text fontSize="xs" color="muted" pl={6}>
                          {cat.description}
                        </Text>
                        <FormControl pl={6}>
                          <FormLabel fontSize="xs">Threshold</FormLabel>
                          <NumberInput
                            value={catSettings.threshold ?? settings.global_threshold}
                            onChange={(_, val) => updateCategory(cat.id, "threshold", val)}
                            min={0}
                            max={1}
                            step={0.01}
                            isDisabled={catSettings.enabled === false}
                            size="sm"
                          >
                            <NumberInputField />
                            <NumberInputStepper>
                              <NumberIncrementStepper />
                              <NumberDecrementStepper />
                            </NumberInputStepper>
                          </NumberInput>
                        </FormControl>
                      </VStack>
                    </CardBody>
                  </Card>
                );
              })}
            </SimpleGrid>

            <Divider />

            <Heading size="sm">Exemptions</Heading>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <FormControl>
                <FormLabel>Exempt Role IDs</FormLabel>
                <Input
                  value={settings.exempt_roles.join(", ")}
                  onChange={(e) => setSettings({ ...settings, exempt_roles: parseCommaSeparated(e.target.value) })}
                  placeholder="111111111111, 222222222222"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Exempt Channel IDs</FormLabel>
                <Input
                  value={settings.exempt_channels.join(", ")}
                  onChange={(e) => setSettings({ ...settings, exempt_channels: parseCommaSeparated(e.target.value) })}
                  placeholder="333333333333, 444444444444"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Exempt User IDs</FormLabel>
                <Input
                  value={settings.exempt_users.join(", ")}
                  onChange={(e) => setSettings({ ...settings, exempt_users: parseCommaSeparated(e.target.value) })}
                  placeholder="555555555555, 666666666666"
                />
              </FormControl>
            </SimpleGrid>

            <Button
              colorScheme="brand"
              leftIcon={<FiSave />}
              onClick={handleSave}
              isLoading={isSaving}
              alignSelf="flex-start"
            >
              Save AI Moderation Settings
            </Button>
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
}

function ProtectionTab({ guildId, type }) {
  const [settings, setSettings] = useState({
    enabled: true,
    maxMessages: 5,
    windowSeconds: 3,
    alertCooldown: 10,
    timeoutEnabled: true,
    timeoutDuration: 30,
    logChannelId: "",
    staffRoleIds: "",
    joinThreshold: 8,
    actionThreshold: 3,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const loadSettings = useCallback(async () => {
    try {
      const data = await getGuildSettings(guildId);
      const prefix = type === "antispam" ? "antiSpam" : type === "antiraid" ? "antiRaid" : "antiNuke";
      setSettings({
        enabled: data?.[`${prefix}Enabled`] ?? true,
        maxMessages: data?.[`${prefix}MaxMessages`] ?? 5,
        windowSeconds: data?.[`${prefix}WindowSeconds`] ?? (type === "antinuke" ? 15 : type === "antiraid" ? 12 : 3),
        alertCooldown: data?.[`${prefix}AlertCooldown`] ?? (type === "antinuke" ? 20 : type === "antiraid" ? 30 : 10),
        timeoutEnabled: data?.[`${prefix}TimeoutEnabled`] ?? true,
        timeoutDuration: data?.[`${prefix}TimeoutDuration`] ?? 30,
        logChannelId: data?.[`${prefix}LogChannelId`] ?? "",
        staffRoleIds: data?.[`${prefix}StaffRoleIds`] ?? "",
        joinThreshold: data?.antiRaidJoinThreshold ?? 8,
        actionThreshold: data?.antiNukeActionThreshold ?? 3,
      });
    } catch (error) {
      toast({ title: "Error loading settings", description: error.message, status: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [guildId, type, toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const prefix = type === "antispam" ? "antiSpam" : type === "antiraid" ? "antiRaid" : "antiNuke";
      const updateData = {
        [`${prefix}Enabled`]: settings.enabled,
        [`${prefix}WindowSeconds`]: settings.windowSeconds,
        [`${prefix}AlertCooldown`]: settings.alertCooldown,
        [`${prefix}TimeoutEnabled`]: settings.timeoutEnabled,
        [`${prefix}TimeoutDuration`]: settings.timeoutDuration,
        [`${prefix}LogChannelId`]: settings.logChannelId,
        [`${prefix}StaffRoleIds`]: settings.staffRoleIds,
      };

      if (type === "antispam") {
        updateData.antiSpamMaxMessages = settings.maxMessages;
      } else if (type === "antiraid") {
        updateData.antiRaidJoinThreshold = settings.joinThreshold;
      } else if (type === "antinuke") {
        updateData.antiNukeActionThreshold = settings.actionThreshold;
      }

      await updateGuildSettings(guildId, updateData);
      toast({ title: "Settings saved", status: "success" });
    } catch (error) {
      toast({ title: "Error saving settings", description: error.message, status: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <Skeleton height="400px" rounded="xl" />;
  }

  const titles = {
    antispam: { title: "Anti Spam", desc: "Detect repeated message bursts and auto-timeout spammers" },
    antiraid: { title: "Anti Raid", desc: "Track suspicious join bursts and respond to raid attempts" },
    antinuke: { title: "Anti Nuke", desc: "Detect destructive moderation bursts and protect your server" },
  };

  const { title, desc } = titles[type];

  return (
    <VStack align="stretch" spacing={6}>
      <Card>
        <CardBody>
          <VStack align="stretch" spacing={6}>
            <Flex justify="space-between" align="center">
              <Box>
                <Heading size="md">{title} Settings</Heading>
                <Text color="muted" fontSize="sm">
                  {desc}
                </Text>
              </Box>
              <FormControl display="flex" alignItems="center" w="auto">
                <FormLabel mb={0} mr={3}>
                  Enable {title}
                </FormLabel>
                <Switch
                  isChecked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                />
              </FormControl>
            </Flex>

            <Divider />

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              {type === "antispam" && (
                <FormControl>
                  <FormLabel>Max Messages</FormLabel>
                  <NumberInput
                    value={settings.maxMessages}
                    onChange={(_, val) => setSettings({ ...settings, maxMessages: val })}
                    min={1}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
              )}

              {type === "antiraid" && (
                <FormControl>
                  <FormLabel>Join Threshold</FormLabel>
                  <NumberInput
                    value={settings.joinThreshold}
                    onChange={(_, val) => setSettings({ ...settings, joinThreshold: val })}
                    min={1}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
              )}

              {type === "antinuke" && (
                <FormControl>
                  <FormLabel>Action Threshold</FormLabel>
                  <NumberInput
                    value={settings.actionThreshold}
                    onChange={(_, val) => setSettings({ ...settings, actionThreshold: val })}
                    min={1}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
              )}

              <FormControl>
                <FormLabel>Window (seconds)</FormLabel>
                <NumberInput
                  value={settings.windowSeconds}
                  onChange={(_, val) => setSettings({ ...settings, windowSeconds: val })}
                  min={1}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl>
                <FormLabel>Alert Cooldown (seconds)</FormLabel>
                <NumberInput
                  value={settings.alertCooldown}
                  onChange={(_, val) => setSettings({ ...settings, alertCooldown: val })}
                  min={1}
                >
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
              </FormControl>

              <FormControl display="flex" alignItems="center">
                <FormLabel mb={0} mr={3}>
                  Timeout Enabled
                </FormLabel>
                <Switch
                  isChecked={settings.timeoutEnabled}
                  onChange={(e) => setSettings({ ...settings, timeoutEnabled: e.target.checked })}
                />
              </FormControl>

              {settings.timeoutEnabled && (
                <FormControl>
                  <FormLabel>Timeout Duration (seconds)</FormLabel>
                  <NumberInput
                    value={settings.timeoutDuration}
                    onChange={(_, val) => setSettings({ ...settings, timeoutDuration: val })}
                    min={5}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
              )}
            </SimpleGrid>

            <Divider />

            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl>
                <FormLabel>Log Channel ID</FormLabel>
                <Input
                  value={settings.logChannelId}
                  onChange={(e) => setSettings({ ...settings, logChannelId: e.target.value })}
                  placeholder="123456789012345678"
                />
              </FormControl>

              <FormControl>
                <FormLabel>Staff Role IDs (comma-separated, max 5)</FormLabel>
                <Input
                  value={settings.staffRoleIds}
                  onChange={(e) => setSettings({ ...settings, staffRoleIds: e.target.value })}
                  placeholder="111111111111111111, 222222222222222222"
                />
                <Text fontSize="xs" color="muted">
                  {parseCommaSeparated(settings.staffRoleIds).length} / {MAX_STAFF_PING_ROLES} roles
                </Text>
              </FormControl>
            </SimpleGrid>

            <Button
              colorScheme="brand"
              leftIcon={<FiSave />}
              onClick={handleSave}
              isLoading={isSaving}
              alignSelf="flex-start"
            >
              Save Settings
            </Button>
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
}

export function GuildDashboardPage() {
  const location = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("automod");

  const guildId = resolveGuildId(location.search);
  const guild = user?.guilds?.find((g) => String(g.id) === guildId);
  const canManage = canManageGuild(guild, String(user?.id || ""));

  if (isLoading) {
    return (
      <Container maxW="1400px">
        <Skeleton height="600px" rounded="xl" />
      </Container>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!guildId || !guild) {
    return (
      <Container maxW="800px" py={10}>
        <Alert status="error" rounded="xl">
          <AlertIcon />
          Guild not found. Please select a guild from the dashboard.
        </Alert>
        <Button as={Link} to="/pages/dashboard.html" mt={4} leftIcon={<FiArrowLeft />}>
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  if (!canManage) {
    return (
      <Container maxW="800px" py={10}>
        <Alert status="error" rounded="xl">
          <AlertIcon />
          You need to be the server owner or have Administrator permissions to manage this guild.
        </Alert>
        <Button as={Link} to="/pages/dashboard.html" mt={4} leftIcon={<FiArrowLeft />}>
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  return (
    <Grid templateColumns={{ base: "1fr", lg: "280px 1fr" }} gap={6} alignItems="start">
      <Sidebar guild={guild} activeTab={activeTab} onTabChange={setActiveTab} />

      <Box>
        {activeTab === "automod" && <AutoModTab guildId={guildId} />}
        {activeTab === "antispam" && <ProtectionTab guildId={guildId} type="antispam" />}
        {activeTab === "antiraid" && <ProtectionTab guildId={guildId} type="antiraid" />}
        {activeTab === "antinuke" && <ProtectionTab guildId={guildId} type="antinuke" />}
        {activeTab === "aimod" && <AIModerationTab guildId={guildId} />}
      </Box>
    </Grid>
  );
}
