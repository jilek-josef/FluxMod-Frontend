import { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardBody,
  Heading,
  SimpleGrid,
  Text,
  useColorModeValue,
  VStack,
  HStack,
  Avatar,
  Badge,
  Skeleton,
  Alert,
  AlertIcon,
  Link,
} from "@chakra-ui/react";
import { fetchContributors } from "@/utils/api";

function ContributorCard({ contributor }) {
  const bg = useColorModeValue("white", "slate.800");
  const borderColor = useColorModeValue("slate.200", "slate.700");

  return (
    <Card bg={bg} borderColor={borderColor} borderWidth="1px" h="full">
      <CardBody>
        <HStack spacing={4} align="start">
          <Avatar
            size="lg"
            src={contributor.avatarUrl}
            name={contributor.name || contributor.login}
          />
          <VStack align="start" spacing={1} flex={1}>
            <HStack spacing={2}>
              <Heading size="sm">
                {contributor.name || contributor.login}
              </Heading>
              <Badge
                colorScheme={contributor.role === "Maintainer" ? "brand" : "gray"}
                size="sm"
              >
                {contributor.role}
              </Badge>
            </HStack>
            <Text fontSize="sm" color="muted">
              @{contributor.login}
            </Text>
            <Text fontSize="sm" fontWeight="600" color="brand.500">
              {contributor.contributions} commits
            </Text>
          </VStack>
        </HStack>
      </CardBody>
    </Card>
  );
}

export function ContributorsPage() {
  const [contributors, setContributors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchContributors();
        setContributors(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Box maxW="900px" mx="auto">
      <VStack align="stretch" spacing={6}>
        <Box textAlign="center">
          <Heading size="xl" mb={2}>
            Contributors
          </Heading>
          <Text color="muted">
            People helping build FluxMod
          </Text>
        </Box>

        {error && (
          <Alert status="error" rounded="xl">
            <AlertIcon />
            {error}
          </Alert>
        )}

        {isLoading ? (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} height="120px" rounded="xl" />
            ))}
          </SimpleGrid>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            {contributors.map((contributor) => (
              <ContributorCard key={contributor.login} contributor={contributor} />
            ))}
          </SimpleGrid>
        )}

        <Text textAlign="center" fontSize="sm" color="muted">
          Want to contribute? Check out our{" "}
          <Link
            href="https://github.com/BlixedBox"
            color="brand.500"
            isExternal
          >
            GitHub repositories
          </Link>
        </Text>
      </VStack>
    </Box>
  );
}
