import { useState, useEffect } from "react";
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
  SimpleGrid,
  Text,
  useColorModeValue,
  VStack,
  Badge,
  Skeleton,
} from "@chakra-ui/react";
import {
  FiServer,
  FiActivity,
  FiGitCommit,
  FiArrowRight,
  FiUserPlus,
  FiLifeBuoy,
  FiShield,
  FiZap,
  FiLock,
} from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { fetchGuildCount, fetchHealth, fetchRecentCommits, getLoginUrl } from "@/utils/api";

function FeatureCard({ icon, title, description }) {
  const bg = useColorModeValue("white", "slate.800");
  const borderColor = useColorModeValue("slate.200", "slate.700");

  return (
    <Card bg={bg} borderColor={borderColor} borderWidth="1px" h="full">
      <CardBody>
        <VStack align="start" spacing={3}>
          <Box
            p={2}
            rounded="lg"
            bg={useColorModeValue("brand.50", "brand.900")}
            color={useColorModeValue("brand.600", "brand.400")}
          >
            <Icon as={icon} boxSize={5} />
          </Box>
          <Heading size="sm">{title}</Heading>
          <Text fontSize="sm" color="muted">
            {description}
          </Text>
        </VStack>
      </CardBody>
    </Card>
  );
}

function StatsCard({ icon, label, value, subValue, isLoading }) {
  const bg = useColorModeValue("white", "slate.800");
  const borderColor = useColorModeValue("slate.200", "slate.700");
  const iconBg = useColorModeValue("slate.100", "slate.700");

  return (
    <Card bg={bg} borderColor={borderColor} borderWidth="1px">
      <CardBody>
        <HStack spacing={4}>
          <Box p={3} rounded="xl" bg={iconBg}>
            <Icon as={icon} boxSize={6} color="brand.500" />
          </Box>
          <Box>
            <Text fontSize="sm" color="muted">
              {label}
            </Text>
            <Skeleton isLoaded={!isLoading}>
              <Text fontSize="2xl" fontWeight="700">
                {value}
              </Text>
            </Skeleton>
            {subValue && (
              <Text fontSize="xs" color="muted" mt={1}>
                {subValue}
              </Text>
            )}
          </Box>
        </HStack>
      </CardBody>
    </Card>
  );
}

export function HomePage() {
  const { isAuthenticated, login, isDev } = useAuth();
  const [stats, setStats] = useState({
    guildCount: 0,
    uptime: null,
    commits: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const heroBg = useColorModeValue(
    "linear(to-br, brand.50, slate.50)",
    "linear(to-br, slate.900, slate.950)"
  );
  const heroBorderColor = useColorModeValue("brand.200", "slate.700");
  const mutedColor = useColorModeValue("slate.600", "slate.400");

  useEffect(() => {
    let mounted = true;

    async function loadStats() {
      try {
        const [guildCount, health, commits] = await Promise.all([
          fetchGuildCount(),
          fetchHealth(),
          fetchRecentCommits(),
        ]);

        if (mounted) {
          setStats({
            guildCount,
            uptime: health.uptime,
            commits,
          });
        }
      } catch (error) {
        console.error("Failed to load stats:", error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadStats();

    const interval = setInterval(loadStats, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const uptimeDisplay = stats.uptime !== null 
    ? `${stats.uptime.toFixed(2)}%` 
    : "-";
  const uptimeLabel = stats.uptime !== null 
    ? "Within the last 24 hours" 
    : "Current health unavailable";

  return (
    <VStack spacing={12} align="stretch">
      {/* Hero Section */}
      <Box
        rounded="2xl"
        bgGradient={heroBg}
        border="1px"
        borderColor={heroBorderColor}
        p={{ base: 8, md: 12 }}
        textAlign="center"
      >
        <VStack spacing={6} maxW="2xl" mx="auto">
          <Badge
            colorScheme="brand"
            variant="subtle"
            px={3}
            py={1}
            rounded="full"
            textTransform="none"
            fontSize="sm"
          >
            {isDev ? "Development Mode" : "Production Ready"}
          </Badge>

          <Heading
            size="2xl"
            bgGradient={useColorModeValue(
              "linear(to-r, brand.600, accent.600)",
              "linear(to-r, brand.400, accent.400)"
            )}
            bgClip="text"
          >
            FluxMod Dashboard
          </Heading>

          <Text fontSize="xl" color={mutedColor}>
            Professional AutoMod solution for Fluxer guilds. Protect your community 
            with powerful moderation tools, customizable rules, and real-time monitoring.
          </Text>

          <HStack spacing={4} pt={2}>
            <Button
              size="lg"
              colorScheme="brand"
              onClick={isAuthenticated ? undefined : login}
              leftIcon={<FiArrowRight />}
              as={isAuthenticated ? undefined : "button"}
            >
              {isAuthenticated ? "Go to Dashboard" : "Login with Fluxer"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              as="a"
              href="https://web.fluxer.app/oauth2/authorize?client_id=1475487256413421606&scope=bot&permissions=4504699407788166"
              target="_blank"
              rel="noopener noreferrer"
              leftIcon={<FiUserPlus />}
            >
              Invite Bot
            </Button>
          </HStack>

          <Button
            variant="ghost"
            size="sm"
            as="a"
            href="https://fluxer.gg/cTPTpEsu"
            target="_blank"
            rel="noopener noreferrer"
            leftIcon={<FiLifeBuoy />}
          >
            Join Support Server
          </Button>
        </VStack>
      </Box>

      {/* Stats Grid */}
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        <StatsCard
          icon={FiServer}
          label="Active Servers"
          value={stats.guildCount.toLocaleString()}
          subValue="Protected communities"
          isLoading={isLoading}
        />
        <StatsCard
          icon={FiActivity}
          label="Uptime"
          value={uptimeDisplay}
          subValue={uptimeLabel}
          isLoading={isLoading}
        />
        <StatsCard
          icon={FiGitCommit}
          label="Recent Commits"
          value={stats.commits}
          subValue="Within the last 24 hours"
          isLoading={isLoading}
        />
      </SimpleGrid>

      {/* Features Grid */}
      <Box>
        <Heading size="lg" mb={6} textAlign="center">
          Built for Professional Moderation
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
          <FeatureCard
            icon={FiShield}
            title="AutoMod Rules"
            description="Create custom keyword filters, regex patterns, and automated responses to keep your server clean."
          />
          <FeatureCard
            icon={FiZap}
            title="Anti-Spam Protection"
            description="Intelligent spam detection with configurable thresholds and automatic timeout enforcement."
          />
          <FeatureCard
            icon={FiActivity}
            title="Anti-Raid Defense"
            description="Detect and respond to raid attempts with join rate limiting and automatic countermeasures."
          />
          <FeatureCard
            icon={FiLock}
            title="Anti-Nuke Security"
            description="Protect against destructive admin actions with monitoring and automatic role recovery."
          />
        </SimpleGrid>
      </Box>
    </VStack>
  );
}
