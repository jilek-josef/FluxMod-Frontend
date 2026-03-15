import {
  Box,
  Card,
  CardBody,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FiShield, FiDatabase, FiClock, FiLock, FiUsers, FiEye, FiCode } from "react-icons/fi";

export function PrivacyPage() {
  return (
    <Box maxW="800px" mx="auto">
      <Card>
        <CardBody>
          <VStack align="stretch" spacing={6}>
            <Box>
              <Heading size="xl" mb={2}>
                Privacy Policy
              </Heading>
              <Text color="muted">Last Updated: March 4, 2026</Text>
            </Box>

            <Text>
              FluxMod is designed with transparency and data minimization in mind.
            </Text>

            <Box>
              <Heading size="md" mb={2} display="flex" alignItems="center" gap={2}>
                <FiDatabase />
                1. Information We Collect
              </Heading>
              <Text>
                Only data needed for moderation and dashboard functionality is stored.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2} display="flex" alignItems="center" gap={2}>
                <FiShield />
                2. How We Use Information
              </Heading>
              <Text>
                Data is used to provide moderation features and secure dashboard sessions.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2} display="flex" alignItems="center" gap={2}>
                <FiClock />
                3. Data Retention
              </Heading>
              <Text>
                Warnings are deleted after one year; inactive data after two years.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2} display="flex" alignItems="center" gap={2}>
                <FiLock />
                4. Data Security
              </Heading>
              <Text>
                Reasonable safeguards are used, but absolute security cannot be guaranteed.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2} display="flex" alignItems="center" gap={2}>
                <FiUsers />
                5. Data Sharing
              </Heading>
              <Text>
                FluxMod does not sell or share data with advertisers.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2} display="flex" alignItems="center" gap={2}>
                <FiEye />
                6. User Rights
              </Heading>
              <Text>
                Users may request access and deletion where applicable.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2} display="flex" alignItems="center" gap={2}>
                <FiCode />
                7. Open Source Transparency
              </Heading>
              <Text>
                All data handling logic is publicly auditable via project repositories.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2} display="flex" alignItems="center" gap={2}>
                <FiShield />
                8. Changes to This Policy
              </Heading>
              <Text>
                Continued use after updates means you accept the updated policy.
              </Text>
            </Box>
          </VStack>
        </CardBody>
      </Card>
    </Box>
  );
}
