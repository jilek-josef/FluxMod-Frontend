import {
  Box,
  Container,
  Flex,
  HStack,
  Link,
  Button,
  useColorMode,
  useColorModeValue,
  IconButton,
  Avatar,
  Text,
  Badge,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spacer,
} from "@chakra-ui/react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import { FiGithub, FiShield, FiUsers, FiFileText, FiHome, FiLayout, FiLogOut, FiCode } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";

const NAV_LINKS = [
  { path: "/", label: "Home", icon: FiHome },
  { path: "/pages/terms.html", label: "Terms", icon: FiFileText },
  { path: "/pages/privacy.html", label: "Privacy", icon: FiShield },
  { path: "/pages/contributors.html", label: "Contributors", icon: FiUsers },
];

function NavLink({ to, icon: Icon, children, isActive }) {
  const activeBg = useColorModeValue("brand.50", "brand.900");
  const activeColor = useColorModeValue("brand.700", "brand.200");
  const hoverBg = useColorModeValue("slate.100", "slate.800");

  return (
    <Link
      as={RouterLink}
      to={to}
      px={3}
      py={2}
      rounded="lg"
      display="flex"
      alignItems="center"
      gap={2}
      fontSize="sm"
      fontWeight="500"
      color={isActive ? activeColor : undefined}
      bg={isActive ? activeBg : undefined}
      _hover={{ bg: isActive ? undefined : hoverBg, textDecoration: "none" }}
      transition="all 0.2s"
    >
      {Icon && <Icon size={16} />}
      {children}
    </Link>
  );
}

export function Layout({ children, maxW = "1140px" }) {
  const { colorMode, toggleColorMode } = useColorMode();
  const { user, isAuthenticated, isLoading, isDev, login, logout } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  const bg = useColorModeValue("white", "slate.900");
  const borderColor = useColorModeValue("slate.200", "slate.800");
  const footerBg = useColorModeValue("slate.50", "slate.900");

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      {/* Header */}
      <Box
        as="header"
        position="sticky"
        top={0}
        zIndex={50}
        bg={bg}
        borderBottom="1px"
        borderColor={borderColor}
        backdropFilter="blur(12px)"
      >
        <Container maxW={maxW} py={3}>
          <Flex align="center" justify="space-between" gap={4}>
            {/* Logo */}
            <Link
              as={RouterLink}
              to="/"
              display="flex"
              alignItems="center"
              gap={2}
              fontSize="xl"
              fontWeight="700"
              color={useColorModeValue("brand.600", "brand.400")}
              _hover={{ textDecoration: "none" }}
            >
              <Box as={FiShield} boxSize={6} />
              FluxMod
            </Link>

            {/* Navigation */}
            <HStack spacing={1} display={{ base: "none", md: "flex" }}>
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  icon={link.icon}
                  isActive={pathname === link.path}
                >
                  {link.label}
                </NavLink>
              ))}
              {isAuthenticated && (
                <NavLink
                  to="/pages/dashboard.html"
                  icon={FiLayout}
                  isActive={pathname === "/pages/dashboard.html"}
                >
                  Dashboard
                </NavLink>
              )}
            </HStack>

            <Spacer display={{ base: "flex", md: "none" }} />

            {/* Actions */}
            <HStack spacing={2}>
              <IconButton
                aria-label="Toggle color mode"
                icon={colorMode === "dark" ? <SunIcon /> : <MoonIcon />}
                onClick={toggleColorMode}
                variant="ghost"
                size="sm"
              />

              {isLoading ? (
                <Text fontSize="sm" color="muted">
                  Loading...
                </Text>
              ) : isAuthenticated ? (
                <Menu>
                  <MenuButton
                    as={Button}
                    variant="ghost"
                    size="sm"
                    rightIcon={<Box as={FiLogOut} />}
                    leftIcon={
                      isDev ? (
                        <Badge colorScheme="purple" size="sm">
                          DEV
                        </Badge>
                      ) : undefined
                    }
                  >
                    <HStack spacing={2}>
                      <Avatar
                        size="xs"
                        name={user?.username}
                        src={user?.avatar_url}
                      />
                      <Text fontSize="sm">{user?.username || "User"}</Text>
                    </HStack>
                  </MenuButton>
                  <MenuList>
                    <MenuItem onClick={logout} icon={<FiLogOut />}>
                      Logout
                    </MenuItem>
                  </MenuList>
                </Menu>
              ) : (
                <Button
                  size="sm"
                  colorScheme="brand"
                  onClick={login}
                  leftIcon={<FiLayout />}
                >
                  Login
                </Button>
              )}
            </HStack>
          </Flex>

          {/* Mobile Navigation */}
          <HStack
            spacing={1}
            mt={3}
            pt={3}
            borderTop="1px"
            borderColor={borderColor}
            display={{ base: "flex", md: "none" }}
            overflowX="auto"
            pb={1}
          >
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                icon={link.icon}
                isActive={pathname === link.path}
              >
                {link.label}
              </NavLink>
            ))}
            {isAuthenticated && (
              <NavLink
                to="/pages/dashboard.html"
                icon={FiLayout}
                isActive={pathname === "/pages/dashboard.html"}
              >
                Dashboard
              </NavLink>
            )}
          </HStack>
        </Container>
      </Box>

      {/* Main Content */}
      <Box as="main" flex={1} py={6}>
        <Container maxW={maxW}>{children}</Container>
      </Box>

      {/* Footer */}
      <Box
        as="footer"
        mt="auto"
        py={4}
        bg={footerBg}
        borderTop="1px"
        borderColor={borderColor}
      >
        <Container maxW={maxW}>
          <Flex
            direction={{ base: "column", sm: "row" }}
            justify="space-between"
            align="center"
            gap={3}
          >
            <Text fontSize="sm" color="muted">
              FluxMod is open source on GitHub
            </Text>
            <HStack spacing={2}>
              {["Frontend", "Backend", "Bot"].map((repo) => (
                <Button
                  key={repo}
                  as="a"
                  href={`https://github.com/BlixedBox/FluxMod-${repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                  variant="outline"
                  leftIcon={<FiGithub />}
                >
                  {repo}
                </Button>
              ))}
            </HStack>
          </Flex>
        </Container>
      </Box>
    </Box>
  );
}
