import {
  Box,
  Card,
  CardBody,
  Heading,
  Text,
  VStack,
  List,
  ListItem,
  ListIcon,
} from "@chakra-ui/react";
import { FiCheckCircle } from "react-icons/fi";

export function TermsPage() {
  return (
    <Box maxW="800px" mx="auto">
      <Card>
        <CardBody>
          <VStack align="stretch" spacing={6}>
            <Box>
              <Heading size="xl" mb={2}>
                Terms of Service
              </Heading>
              <Text color="muted">Last Updated: March 4, 2026</Text>
            </Box>

            <Text>
              Welcome to <strong>FluxMod</strong>, an open-source moderation bot and 
              dashboard built for the Fluxer platform.
            </Text>

            <Text>
              By adding FluxMod to your server or using the FluxMod dashboard, you 
              agree to the following Terms of Service.
            </Text>

            <Box>
              <Heading size="md" mb={2}>
                1. Acceptance of Terms
              </Heading>
              <Text mb={2}>By using FluxMod, you agree to:</Text>
              <List spacing={2}>
                <ListItem>
                  <ListIcon as={FiCheckCircle} color="brand.500" />
                  Comply with these Terms of Service
                </ListItem>
                <ListItem>
                  <ListIcon as={FiCheckCircle} color="brand.500" />
                  Comply with Fluxer&apos;s platform rules and policies
                </ListItem>
              </List>
              <Text mt={2}>
                If you do not agree, you must discontinue use of the service.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2}>
                2. Description of Service
              </Heading>
              <Text>
                FluxMod provides moderation commands, warning systems, AutoMod 
                configuration, storage, and dashboard access via Fluxer OAuth.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2}>
                3. Proper Use
              </Heading>
              <Text>
                You agree not to violate platform policies, abuse auth systems, 
                disrupt service, or access data without permission.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2}>
                4. Service Availability
              </Heading>
              <Text>
                FluxMod is provided &quot;as is&quot; without guaranteed uptime.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2}>
                5. Limitation of Liability
              </Heading>
              <Text>
                Server owners are responsible for how they configure and use FluxMod.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2}>
                6. Termination
              </Heading>
              <Text>
                Access may be suspended for abuse or Terms violations.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2}>
                7. Changes to Terms
              </Heading>
              <Text>
                Continued use after updates means you accept revised terms.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb={2}>
                8. Contact
              </Heading>
              <Text>
                Questions can be sent through the official GitHub repositories.
              </Text>
            </Box>
          </VStack>
        </CardBody>
      </Card>
    </Box>
  );
}
