import { useMemo } from "react";
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
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getGuildIconUrl, canManageGuild, getGuildId, getGuildName } from "@/utils/helpers";

function GuildCard({ guild, userId, botGuildIds }) {
  const bg = useColorModeValue("white", "slate.800");
  const borderColor = useColorModeValue("slate.200", "slate.700");
  const canManage = canManageGuild(guild, userId);
  const guildId = getGuildId(guild);
  const hasBot = botGuildIds.has(guildId);

  const cardContent = (
    <Card
      bg={bg}
      borderColor={canManage ? (hasBot ? "accent.500" : "warning.500") : borderColor}
      borderWidth="2px"
      h="full"
      transition="all 0.2s"
      _hover={canManage && hasBot ? { transform: "translateY(-2px)", boxShadow: "lg" } : undefined}
      opacity={canManage ? 1 : 0.7}
      cursor={canManage && hasBot ? "pointer" : "default"}
    >
      <CardBody>
        <VStack spacing={4} align="center" textAlign="center">
          <Box position="relative">
            <Image
              src={getGuildIconUrl(guild, "/default-guild.png")}
              alt={getGuildName(guild)}
              boxSize={16}
              rounded="xl"
              objectFit="cover"
              fallback={<Box boxSize={16} rounded="xl" bg="slate.700" />}
            />
            {hasBot && (
              <Badge
                position="absolute"
                bottom={-1}
                right={-1}
                colorScheme="accent"
                rounded="full"
                size="sm"
              >
                <Icon as={FiShield} mr={1} />
                Active
              </Badge>
            )}
          </Box>

          <Box>
            <Heading size="sm" noOfLines={1} mb={1}>
              {getGuildName(guild)}
            </Heading>
            <Text fontSize="xs" color="muted" fontFamily="mono">
              {guildId}
            </Text>
          </Box>

          {!canManage && (
            <HStack fontSize="xs" color="danger.500" spacing={1}>
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
            >
              Manage
            </Button>
          )}
        </VStack>
      </CardBody>
    </Card>
  );

  if (canManage && hasBot) {
    return (
      <Box as={Link} to={`/pages/guild-dashboard.html?guild_id=${guildId}`} _hover={{ textDecoration: "none" }}>
        {cardContent}
      </Box>
    );
  }

  return cardContent;
}

function Sidebar({ user }) {
  const bg = useColorModeValue("white", "slate.800");
  const borderColor = useColorModeValue("slate.200", "slate.700");

  return (
    <Card bg={bg} borderColor={borderColor} borderWidth="1px" h="fit-content" position="sticky" top={20}>
      <CardBody>
        <VStack align="stretch" spacing={6}>
          <Box>
            <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="wider" color="muted" mb={3}>
              User
            </Text>
            <HStack spacing={3}>
              <Image
                src={user?.avatar_url ? `https://fluxerusercontent.com/avatars/${user.id}/${user.avatar_url}.png` : undefined}
                fallback={<Box boxSize={12} rounded="lg" bg="slate.700" />}
                alt={user?.username}
                boxSize={12}
                rounded="lg"
                objectFit="cover"
              />
              <Box>
                <Text fontWeight="600">{user?.username || "User"}</Text>
                <Text fontSize="sm" color="muted">
                  {user?.email}
                </Text>
              </Box>
            </HStack>
          </Box>

          <Box>
            <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="wider" color="muted" mb={3}>
              General
            </Text>
            <VStack align="stretch" spacing={1}>
              <Button
                variant="ghost"
                justifyContent="flex-start"
                leftIcon={<FiServer />}
                colorScheme="brand"
                isActive
              >
                Servers
              </Button>
            </VStack>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
}

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
      <Grid templateColumns={{ base: "1fr", lg: "280px 1fr" }} gap={6}>
        <Skeleton height="300px" rounded="xl" />
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={4}>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height="200px" rounded="xl" />
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
    <Grid templateColumns={{ base: "1fr", lg: "280px 1fr" }} gap={6} alignItems="start">
      <Sidebar user={user} />

      <Box>
        <Heading size="lg" mb={6}>
          Your Servers
        </Heading>

        {sortedGuilds.length === 0 ? (
          <Alert status="info" rounded="xl">
            <AlertIcon />
            <AlertTitle>No servers found</AlertTitle>
            <AlertDescription>
              You don&apos;t appear to be a member of any Fluxer servers.
            </AlertDescription>
          </Alert>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
            {sortedGuilds.map((guild) => (
              <GuildCard
                key={getGuildId(guild)}
                guild={guild}
                userId={userId}
                botGuildIds={botGuildIds}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>
    </Grid>
  );
}
