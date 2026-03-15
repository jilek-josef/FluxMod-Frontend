import { useMemo } from "react";
import {
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { FiHome, FiAlertCircle } from "react-icons/fi";
import { Link, useLocation } from "react-router-dom";
import { normalizeStatusCode, getStatusMessage, getStatusGroup } from "@/utils/helpers";

export function StatusPage() {
  const location = useLocation();
  
  const { code, message, group } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const pathParts = location.pathname.split("/").filter(Boolean);
    const pathCode = pathParts.length >= 2 && pathParts[0] === "status" ? pathParts[1] : "";
    const queryCode = params.get("code");

    const statusCode = normalizeStatusCode(pathCode || queryCode);
    return {
      code: statusCode,
      message: getStatusMessage(statusCode),
      group: getStatusGroup(statusCode),
    };
  }, [location]);

  const bg = useColorModeValue("white", "slate.800");
  const borderColor = useColorModeValue("slate.200", "slate.700");

  const isError = code >= 400;

  return (
    <Box maxW="600px" mx="auto" py={10}>
      <VStack spacing={6}>
        <Card bg={bg} borderColor={borderColor} borderWidth="1px" w="full" textAlign="center">
          <CardBody py={10}>
            <VStack spacing={4}>
              <Box
                p={4}
                rounded="full"
                bg={isError ? "danger.500" : "brand.500"}
                color="white"
              >
                <FiAlertCircle size={48} />
              </Box>

              <Heading size="4xl" fontFamily="mono">
                {code}
              </Heading>

              <Heading size="lg">{message}</Heading>

              <Text color="muted">{group}</Text>
            </VStack>
          </CardBody>
        </Card>

        <Card bg={bg} borderColor={borderColor} borderWidth="1px" w="full">
          <CardBody textAlign="center">
            <VStack spacing={4}>
              <Text color="muted">
                Try going back to the homepage
              </Text>
              <Button
                as={Link}
                to="/"
                colorScheme="brand"
                leftIcon={<FiHome />}
              >
                Go Home
              </Button>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
}
