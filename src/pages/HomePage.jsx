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
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { fetchGuildCount, fetchHealth, fetchRecentCommits } from "@/utils/api";
import { staggerContainer, fadeUpItem, scaleItem } from "@/utils/animations";

const MotionBox = motion(Box);
const MotionCard = motion(Card);
const MotionVStack = motion(VStack);
const MotionSimpleGrid = motion(SimpleGrid);



function FeatureCard({ icon, title, description }) {
  return (
    <MotionCard
      variants={fadeUpItem}
      whileHover={{ 
        y: -4,
        transition: { duration: 0.2 }
      }}
      variant="elevated"
      h="full"
    >
      <CardBody p={6}>
        <VStack align="start" spacing={4}>
          <Box
            p={3}
            rounded="xl"
            bgGradient="linear(135deg, brand.500, brand.600)"
            color="white"
            boxShadow="0 4px 12px rgba(14, 165, 233, 0.3)"
          >
            <Icon as={icon} boxSize={6} />
          </Box>
          <Heading size="md" fontWeight="700">
            {title}
          </Heading>
          <Text fontSize="sm" color="muted" lineHeight="1.7">
            {description}
          </Text>
        </VStack>
      </CardBody>
    </MotionCard>
  );
}

function StatsCard({ icon, label, value, subValue, isLoading }) {
  const iconBg = useColorModeValue(
    "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
    "linear-gradient(135deg, #1e293b 0%, #334155 100%)"
  );

  return (
    <MotionCard
      variants={scaleItem}
      whileHover={{ 
        y: -2,
        transition: { duration: 0.2 }
      }}
      variant="elevated"
    >
      <CardBody p={6}>
        <HStack spacing={4}>
          <Box
            p={3}
            rounded="2xl"
            bg={iconBg}
          >
            <Icon as={icon} boxSize={7} color="brand.500" />
          </Box>
          <Box>
            <Text fontSize="sm" color="muted" fontWeight="600" textTransform="uppercase" letterSpacing="wider">
              {label}
            </Text>
            <Skeleton isLoaded={!isLoading} height={isLoading ? "36px" : "auto"} fadeDuration={0.5}>
              <Text fontSize="3xl" fontWeight="800" bgGradient="linear(135deg, brand.500, accent.500)" bgClip="text">
                {value}
              </Text>
            </Skeleton>
            {subValue && (
              <Text fontSize="xs" color="muted" mt={1} fontWeight="500">
                {subValue}
              </Text>
            )}
          </Box>
        </HStack>
      </CardBody>
    </MotionCard>
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

  const heroGradient = useColorModeValue(
    "linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(34,197,94,0.1) 100%)",
    "linear-gradient(135deg, rgba(14,165,233,0.2) 0%, rgba(34,197,94,0.2) 100%)"
  );
  const heroBorder = useColorModeValue(
    "rgba(14, 165, 233, 0.3)",
    "rgba(14, 165, 233, 0.3)"
  );

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
    <MotionVStack
      spacing={16}
      align="stretch"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Hero Section */}
      <MotionBox
        variants={fadeUpItem}
        rounded="3xl"
        bg={heroGradient}
        border="2px"
        borderColor={heroBorder}
        p={{ base: 8, md: 16 }}
        textAlign="center"
        position="relative"
        overflow="hidden"
        backdropFilter="blur(10px)"
        boxShadow={useColorModeValue(
          "0 25px 50px -12px rgba(14, 165, 233, 0.15)",
          "0 25px 50px -12px rgba(14, 165, 233, 0.2)"
        )}
        _before={{
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: "radial-gradient(circle at 20% 50%, rgba(14,165,233,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(34,197,94,0.15) 0%, transparent 50%)",
          pointerEvents: "none",
        }}
      >
        <VStack spacing={8} maxW="3xl" mx="auto" position="relative" zIndex={1}>
          <MotionBox
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <Badge
              colorScheme={isDev ? "purple" : "brand"}
              variant="subtle"
              px={4}
              py={1.5}
              rounded="full"
              textTransform="none"
              fontSize="sm"
              fontWeight="600"
              boxShadow="0 4px 15px rgba(14, 165, 233, 0.3)"
            >
              {isDev ? "🚀 Development Mode" : "✨ Production Ready"}
            </Badge>
          </MotionBox>

          <MotionBox
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <Heading
              size="2xl"
              fontWeight="800"
              letterSpacing="-0.03em"
              lineHeight="1.2"
            >
              <Box
                as="span"
                bgGradient="linear(135deg, brand.500 0%, brand.600 50%, accent.500 100%)"
                bgClip="text"
              >
                FluxMod Dashboard
              </Box>
            </Heading>
          </MotionBox>

          <MotionBox
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <Text fontSize="xl" color="muted" maxW="2xl" lineHeight="1.8">
              Professional AutoMod solution for Fluxer guilds. Protect your community 
              with powerful moderation tools, customizable rules, and real-time monitoring.
            </Text>
          </MotionBox>

          <MotionBox
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <HStack spacing={4} pt={2} flexWrap="wrap" justify="center">
              <MotionBox
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  colorScheme="brand"
                  onClick={isAuthenticated ? undefined : login}
                  leftIcon={<FiArrowRight />}
                  rounded="full"
                  px={8}
                  py={6}
                  fontSize="md"
                  fontWeight="600"
                  bgGradient="linear(135deg, brand.500, brand.600)"
                  _hover={{
                    bgGradient: "linear(135deg, brand.600, brand.700)",
                    boxShadow: "0 20px 40px -10px rgba(14, 165, 233, 0.5)",
                  }}
                >
                  {isAuthenticated ? "Go to Dashboard" : "Login with Fluxer"}
                </Button>
              </MotionBox>
              <MotionBox
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="lg"
                  variant="outline"
                  as="a"
                  href="https://web.fluxer.app/oauth2/authorize?client_id=1475487256413421606&scope=bot&permissions=4504699407788166"
                  target="_blank"
                  rel="noopener noreferrer"
                  leftIcon={<FiUserPlus />}
                  rounded="full"
                  px={8}
                  py={6}
                  fontSize="md"
                  fontWeight="600"
                  borderWidth="2px"
                  borderColor="brand.500"
                  color="brand.500"
                  _hover={{
                    bg: "brand.50",
                    borderColor: "brand.600",
                    color: "brand.600",
                  }}
                >
                  Invite Bot
                </Button>
              </MotionBox>
            </HStack>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <Button
              variant="ghost"
              size="sm"
              as="a"
              href="https://fluxer.gg/cTPTpEsu"
              target="_blank"
              rel="noopener noreferrer"
              leftIcon={<FiLifeBuoy />}
              rounded="full"
              color="muted"
              _hover={{ color: "brand.500" }}
            >
              Join Support Server
            </Button>
          </MotionBox>
        </VStack>
      </MotionBox>

      {/* Stats Grid */}
      <MotionSimpleGrid
        columns={{ base: 1, md: 3 }}
        spacing={6}
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
      >
        <StatsCard
          icon={FiServer}
          label="Active Servers"
          value={stats.guildCount.toLocaleString()}
          subValue="Protected communities"
          isLoading={isLoading}
          index={0}
        />
        <StatsCard
          icon={FiActivity}
          label="Uptime"
          value={uptimeDisplay}
          subValue={uptimeLabel}
          isLoading={isLoading}
          index={1}
        />
        <StatsCard
          icon={FiGitCommit}
          label="Recent Commits"
          value={stats.commits}
          subValue="Within the last 24 hours"
          isLoading={isLoading}
          index={2}
        />
      </MotionSimpleGrid>

      {/* Features Grid */}
      <Box>
        <MotionBox
          textAlign="center"
          mb={10}
          variants={fadeUpItem}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          <Heading
            size="lg"
            mb={3}
            fontWeight="700"
            bgGradient="linear(135deg, brand.500, accent.500)"
            bgClip="text"
          >
            Built for Professional Moderation
          </Heading>
          <Text fontSize="lg" color="muted">
            Powerful tools to keep your community safe
          </Text>
        </MotionBox>

        <MotionSimpleGrid
          columns={{ base: 1, md: 2, lg: 4 }}
          spacing={6}
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
        >
          <FeatureCard
            icon={FiShield}
            title="AutoMod Rules"
            description="Create custom keyword filters, regex patterns, and automated responses to keep your server clean."
            index={0}
          />
          <FeatureCard
            icon={FiZap}
            title="Anti-Spam Protection"
            description="Intelligent spam detection with configurable thresholds and automatic timeout enforcement."
            index={1}
          />
          <FeatureCard
            icon={FiActivity}
            title="Anti-Raid Defense"
            description="Detect and respond to raid attempts with join rate limiting and automatic countermeasures."
            index={2}
          />
          <FeatureCard
            icon={FiLock}
            title="Anti-Nuke Security"
            description="Protect against destructive admin actions with monitoring and automatic role recovery."
            index={3}
          />
        </MotionSimpleGrid>
      </Box>
    </MotionVStack>
  );
}
