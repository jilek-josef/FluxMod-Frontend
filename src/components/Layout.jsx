import { useState } from "react";
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
import { motion, AnimatePresence } from "framer-motion";
import { FiGithub, FiShield, FiUsers, FiFileText, FiHome, FiLayout, FiLogOut, FiCode } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import { staggerContainer, fadeUpItem } from "@/utils/animations";

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

const NAV_LINKS = [
  { path: "/", label: "Home", icon: FiHome },
  { path: "/pages/terms.html", label: "Terms", icon: FiFileText },
  { path: "/pages/privacy.html", label: "Privacy", icon: FiShield },
  { path: "/pages/contributors.html", label: "Contributors", icon: FiUsers },
];



function NavLink({ to, icon: Icon, children, isActive, onClick }) {
  const activeBg = useColorModeValue("brand.50", "brand.900");
  const activeColor = useColorModeValue("brand.700", "brand.200");
  const hoverBg = useColorModeValue("slate.100", "slate.800");

  return (
    <Link
      as={RouterLink}
      to={to}
      onClick={onClick}
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
      _hover={{ 
        bg: isActive ? undefined : hoverBg, 
        textDecoration: "none",
      }}
      transition="background 0.15s ease"
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const bg = useColorModeValue(
    "rgba(255, 255, 255, 0.8)",
    "rgba(15, 23, 42, 0.8)"
  );
  const borderColor = useColorModeValue(
    "rgba(226, 232, 240, 0.8)",
    "rgba(51, 65, 85, 0.5)"
  );
  const footerBg = useColorModeValue(
    "rgba(248, 250, 252, 0.8)",
    "rgba(15, 23, 42, 0.8)"
  );
  const gradientText = useColorModeValue(
    "linear-gradient(135deg, #0ea5e9 0%, #22c55e 100%)",
    "linear-gradient(135deg, #38bdf8 0%, #4ade80 100%)"
  );

  return (
    <Box
      minH="100vh"
      display="flex"
      flexDirection="column"
      position="relative"
      overflow="hidden"
    >
      {/* Background gradient orbs */}
      <Box
        position="fixed"
        top="-20%"
        left="-10%"
        width="50%"
        height="50%"
        borderRadius="full"
        filter="blur(120px)"
        opacity={useColorModeValue(0.3, 0.1)}
        bg="brand.500"
        zIndex={0}
      />
      <Box
        position="fixed"
        bottom="-20%"
        right="-10%"
        width="40%"
        height="40%"
        borderRadius="full"
        filter="blur(100px)"
        opacity={useColorModeValue(0.2, 0.08)}
        bg="accent.500"
        zIndex={0}
      />

      {/* Header */}
      <MotionBox
        as="header"
        position="sticky"
        top={0}
        zIndex={50}
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        bg={bg}
        backdropFilter="blur(20px)"
        borderBottom="1px"
        borderColor={borderColor}
        boxShadow={useColorModeValue(
          "0 4px 30px rgba(0, 0, 0, 0.05)",
          "0 4px 30px rgba(0, 0, 0, 0.2)"
        )}
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
              fontWeight="800"
              bgGradient={gradientText}
              bgClip="text"
              _hover={{ textDecoration: "none", opacity: 0.8 }}
              transition="opacity 0.2s ease"
            >
              <Box
                p={1.5}
                rounded="lg"
                bgGradient="linear(135deg, brand.500, accent.500)"
                color="white"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <FiShield size={20} />
              </Box>
              FluxMod
            </Link>

            {/* Desktop Navigation */}
            <MotionFlex
              as="nav"
              spacing={1}
              display={{ base: "none", md: "flex" }}
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {NAV_LINKS.map((link) => (
                <MotionBox key={link.path} variants={fadeUpItem}>
                  <NavLink
                    to={link.path}
                    icon={link.icon}
                    isActive={pathname === link.path}
                  >
                    {link.label}
                  </NavLink>
                </MotionBox>
              ))}
              {isAuthenticated && (
                <MotionBox variants={fadeUpItem}>
                  <NavLink
                    to="/pages/dashboard.html"
                    icon={FiLayout}
                    isActive={pathname === "/pages/dashboard.html"}
                  >
                    Dashboard
                  </NavLink>
                </MotionBox>
              )}
            </MotionFlex>

            <Spacer display={{ base: "flex", md: "none" }} />

            {/* Actions */}
            <HStack spacing={2}>
              <IconButton
                aria-label="Toggle color mode"
                icon={colorMode === "dark" ? <SunIcon /> : <MoonIcon />}
                onClick={toggleColorMode}
                variant="ghost"
                size="sm"
                rounded="full"
                _hover={{
                  bg: useColorModeValue("slate.200", "slate.700"),
                }}
                transition="background 0.15s ease"
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
                    rounded="full"
                    pl={2}
                    pr={3}
                    leftIcon={
                      <Avatar
                        size="xs"
                        name={user?.username}
                        src={user?.avatar_url}
                        border="2px solid"
                        borderColor={useColorModeValue("brand.500", "brand.400")}
                      />
                    }
                    rightIcon={
                      isDev ? (
                        <Badge colorScheme="purple" size="sm" variant="solid">
                          DEV
                        </Badge>
                      ) : undefined
                    }
                  >
                    <Text fontSize="sm" fontWeight="600">
                      {user?.username || "User"}
                    </Text>
                  </MenuButton>
                  <MenuList
                    bg={bg}
                    backdropFilter="blur(16px)"
                    borderColor={borderColor}
                    boxShadow="0 20px 25px -5px rgba(0, 0, 0, 0.2)"
                    rounded="xl"
                    py={2}
                  >
                    <MenuItem
                      onClick={logout}
                      icon={<FiLogOut />}
                      _hover={{
                        bg: useColorModeValue("danger.50", "danger.900"),
                        color: useColorModeValue("danger.600", "danger.300"),
                      }}
                    >
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
                  rounded="full"
                  px={4}
                  bgGradient="linear(135deg, brand.500, brand.600)"
                  _hover={{
                    bgGradient: "linear(135deg, brand.600, brand.700)",
                    boxShadow: "0 8px 16px -4px rgba(14, 165, 233, 0.3)",
                  }}
                  transition="all 0.2s ease"
                >
                  Login
                </Button>
              )}
            </HStack>
          </Flex>

          {/* Mobile Navigation */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <MotionBox
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                overflow="hidden"
              >
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
                      onClick={() => setMobileMenuOpen(false)}
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
              </MotionBox>
            )}
          </AnimatePresence>
        </Container>
      </MotionBox>

      {/* Main Content */}
      <Box
        as="main"
        flex={1}
        py={8}
        position="relative"
        zIndex={1}
      >
        <Container maxW={maxW}>
          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {children}
          </MotionBox>
        </Container>
      </Box>

      {/* Footer */}
      <MotionBox
        as="footer"
        mt="auto"
        py={6}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        bg={footerBg}
        backdropFilter="blur(12px)"
        borderTop="1px"
        borderColor={borderColor}
        position="relative"
        zIndex={1}
      >
        <Container maxW={maxW}>
          <Flex
            direction={{ base: "column", sm: "row" }}
            justify="space-between"
            align="center"
            gap={4}
          >
            <Text fontSize="sm" color="muted" fontWeight="500">
              FluxMod is open source on GitHub
            </Text>
            <HStack spacing={3}>
              {["Frontend", "Backend", "Bot"].map((repo) => (
              <Button
                key={repo}
                as="a"
                href={`https://github.com/BlixedBox/FluxMod-${repo}`}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                variant="ghost"
                leftIcon={<FiGithub />}
                rounded="full"
                _hover={{
                  bg: useColorModeValue("slate.200", "slate.700"),
                }}
                transition="background 0.15s ease"
              >
                {repo}
              </Button>
            ))}
            </HStack>
          </Flex>
        </Container>
      </MotionBox>
    </Box>
  );
}
