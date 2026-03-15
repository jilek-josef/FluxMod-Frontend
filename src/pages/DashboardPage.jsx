import { useMemo, memo } from "react";
import {
  Box,
  Card,
  CardBody,
  Flex,
  Grid,
  Heading,
  HStack,
  Icon,
  Image,
  SimpleGrid,
  Text,
  useColorModeValue,
  VStack,
  Badge,
  Button,
  Skeleton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import {
  FiServer,
  FiUser,
  FiArrowRight,
  FiPlus,
  FiLock,
  FiShield,
  FiAlertCircle,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getGuildIconUrl, canManageGuild, getGuildId, getGuildName } from "@/utils/helpers";
import { staggerContainer, fadeUpItem, scaleItem } from "@/utils/animations";

const MotionBox = motion(Box);
const MotionCard = motion(Card);
const MotionSimpleGrid = motion(SimpleGrid);
const MotionVStack = motion(VStack);

function GuildCard({ guild, userId, botGuildIds, index }) {
  const canManage = canManageGuild(guild, userId);
  const guildId = getGuildId(guild);
  const hasBot = botGuildIds.has(guildId);

  const cardContent = (
    <MotionCard
      variant={canManage ? "elevated" : "outline"}
      borderWidth="2px"
      borderColor={
        canManage
          ? hasBot
            ? "accent.500"
            : "warning.500"
          : useColorModeValue("slate.200", "slate.700")
      }
      h="full"
      opacity={canManage ? 1 : 0.6}
      cursor={canManage && hasBot ? "pointer" : "default"}
      whileHover={
        canManage && hasBot
          ? {
              y: -4,
              transition: { duration: 0.2 },
            }
          : {}
      }
    >
      <CardBody p={6}>
        <VStack spacing={4} align="center" textAlign="center">
          <Box position="relative">
            <Image
              src={getGuildIconUrl(guild, "/default-guild.png")}
              alt={getGuildName(guild)}
              boxSize={16}
              rounded="2xl"
              objectFit="cover"
              fallback={
                <Box
                  boxSize={16}
                  rounded="2xl"
                  bg={useColorModeValue("slate.200", "slate.700")}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <FiServer size={24} color={useColorModeValue("#94a3b8", "#64748b")} />
                </Box>
              }
              boxShadow="0 4px 12px rgba(0, 0, 0, 0.1)"
            />
            {hasBot && (
              <Badge
                position="absolute"
                bottom={-2}
                right={-2}
                colorScheme="accent"
                rounded="full"
                px={2}
                py={0.5}
                fontSize="xs"
                boxShadow="0 4px 10px rgba(34, 197, 94, 0.4)"
              >
                <Icon as={FiShield} boxSize={3} mr={1} />
                Active
              </Badge>
            )}
          </Box>

          <Box>
            <Heading size="sm" noOfLines={1} mb={1} fontWeight="700">
              {getGuildName(guild)}
            </Heading>
            <Text fontSize="xs" color="muted" fontFamily="mono">
              {guildId}
            </Text>
          </Box>

          {!canManage && (
            <HStack
              fontSize="xs"
              color="danger.500"
              spacing={1}
              bg={useColorModeValue("danger.50", "danger.900")}
              px={3}
              py={1}
              rounded="full"
            >
              <FiLock />
              <Text>Owner/Admin required</Text>
            </HStack>
          )}

          {canManage && !hasBot && (
            <Button
              as="a"
              href={`https://web.fluxer.app/oauth2/authorize?client_id=1475487256413421606&scope=bot&permissions=4504699407788166&guild_id=${guildId}`}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              colorScheme="accent"
              leftIcon={<FiPlus />}
              w="full"
              rounded="full"
              fontWeight="600"
              _hover={{
                boxShadow: "0 10px 20px -5px rgba(34, 197, 94, 0.4)",
              }}
            >
              Add FluxMod
            </Button>
          )}

          {canManage && hasBot && (
            <Button
              size="sm"
              colorScheme="brand"
              rightIcon={<FiArrowRight />}
              w="full"
              as={Link}
              to={`/pages/guild-dashboard.html?guild_id=${guildId}`}
              rounded="full"
              fontWeight="600"
              bgGradient="linear(135deg, brand.500, brand.600)"
              _hover={{
                bgGradient: "linear(135deg, brand.600, brand.700)",
                boxShadow: "0 10px 20px -5px rgba(14, 165, 233, 0.4)",
              }}
            >
              Manage
            </Button>
          )}
        </VStack>
      </CardBody>
    </MotionCard>
  );

  if (canManage && hasBot) {
    return (
      <Box
        as={Link}
        to={`/pages/guild-dashboard.html?guild_id=${guildId}`}
        _hover={{ textDecoration: "none" }}
        h="full"
      >
        {cardContent}
      </Box>
    );
  }

  return cardContent;
}

// Memoized Sidebar to prevent re-animation on re-renders
const Sidebar = memo(function Sidebar({ user }) {
  return (
    <Card
      variant="elevated"
      h="fit-content"
      position="sticky"
      top={24}
    >
      <CardBody p={6}>
        <VStack align="stretch" spacing={8}>
          <Box>
            <Text
              fontSize="xs"
              fontWeight="800"
              textTransform="uppercase"
              letterSpacing="wider"
              color="muted"
              mb={4}
            >
              User
            </Text>
            <HStack spacing={4}>
              <Image
                src={
                  user?.avatar_url
                    ? `https://fluxerusercontent.com/avatars/${user.id}/${user.avatar_url}.png`
                    : undefined
                }
                fallback={
                  <Box
                    boxSize={14}
                    rounded="xl"
                    bg={useColorModeValue("slate.200", "slate.700")}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <FiUser size={24} color={useColorModeValue("#94a3b8", "#64748b")} />
                  </Box>
                }
                alt={user?.username}
                boxSize={14}
                rounded="xl"
                objectFit="cover"
                boxShadow="0 4px 12px rgba(0, 0, 0, 0.1)"
              />
              <Box>
                <Text fontWeight="700" fontSize="lg">
                  {user?.username || "User"}
                </Text>
                <Text fontSize="sm" color="muted">
                  {user?.email}
                </Text>
              </Box>
            </HStack>
          </Box>

          <Box>
            <Text
              fontSize="xs"
              fontWeight="800"
              textTransform="uppercase"
              letterSpacing="wider"
              color="muted"
              mb={4}
            >
              General
            </Text>
            <VStack align="stretch" spacing={2}>
              <Button
                variant="ghost"
                justifyContent="flex-start"
                leftIcon={<FiServer />}
                colorScheme="brand"
                isActive
                rounded="lg"
                py={3}
                fontWeight="600"
                _hover={{
                  bg: useColorModeValue("brand.50", "brand.900"),
                }}
              >
                Servers
              </Button>
            </VStack>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
});

export function DashboardPage() {
  const { user, isAuthenticated, isLoading, botGuilds } = useAuth();

  const sortedGuilds = useMemo(() => {
    if (!user?.guilds) return [];

    const userId = String(user?.id || "");
    return [...user.guilds].sort((a, b) => {
      const aCanManage = canManageGuild(a, userId);
      const bCanManage = canManageGuild(b, userId);
      if (aCanManage === bCanManage) return 0;
      return aCanManage ? -1 : 1;
    });
  }, [user]);

  const botGuildIds = useMemo(() => {
    return new Set((botGuilds || []).map((g) => String(g?.id || "")));
  }, [botGuilds]);

  if (isLoading) {
    return (
      <Grid templateColumns={{ base: "1fr", lg: "280px 1fr" }} gap={8}>
        <MotionBox
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Skeleton height="300px" rounded="2xl" speed={1.2} />
        </MotionBox>
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
          {[...Array(4)].map((_, i) => (
            <MotionBox
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
            >
              <Skeleton height="220px" rounded="2xl" speed={1.2} />
            </MotionBox>
          ))}
        </SimpleGrid>
      </Grid>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const userId = String(user?.id || "");

  return (
    <Grid templateColumns={{ base: "1fr", lg: "280px 1fr" }} gap={8} alignItems="start">
      <Sidebar user={user} />

      <Box>
        <MotionBox
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          mb={8}
        >
          <Heading size="xl" fontWeight="800" letterSpacing="-0.02em">
            Your Servers
          </Heading>
          <Text color="muted" mt={2}>
            Select a server to manage AutoMod settings
          </Text>
        </MotionBox>

        {sortedGuilds.length === 0 ? (
          <Alert
            status="info"
            rounded="2xl"
            variant="subtle"
            py={6}
            bg={useColorModeValue("brand.50", "brand.900")}
            borderWidth="1px"
            borderColor={useColorModeValue("brand.200", "brand.700")}
          >
            <AlertIcon boxSize={6} />
            <Box>
              <AlertTitle fontSize="lg" mb={1}>
                No servers found
              </AlertTitle>
              <AlertDescription>
                You don&apos;t appear to be a member of any Fluxer servers.
              </AlertDescription>
            </Box>
          </Alert>
        ) : (
          <MotionSimpleGrid
            columns={{ base: 1, sm: 2, md: 3 }}
            spacing={6}
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {sortedGuilds.map((guild, index) => (
              <MotionBox key={getGuildId(guild)} variants={fadeUpItem}>
                <GuildCard
                  guild={guild}
                  userId={userId}
                  botGuildIds={botGuildIds}
                  index={index}
                />
              </MotionBox>
            ))}
          </MotionSimpleGrid>
        )}
      </Box>
    </Grid>
  );
}
