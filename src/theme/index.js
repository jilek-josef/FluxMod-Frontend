import { extendTheme } from "@chakra-ui/react";

// Professional color palette
const colors = {
  brand: {
    50: "#f0f9ff",
    100: "#e0f2fe",
    200: "#bae6fd",
    300: "#7dd3fc",
    400: "#38bdf8",
    500: "#0ea5e9",
    600: "#0284c7",
    700: "#0369a1",
    800: "#075985",
    900: "#0c4a6e",
  },
  accent: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
  },
  danger: {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
  },
  warning: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
  },
  slate: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },
};

const fonts = {
  heading: "'Inter Variable', -apple-system, BlinkMacSystemFont, sans-serif",
  body: "'Inter Variable', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', monospace",
};

const config = {
  initialColorMode: "system",
  useSystemColorMode: true,
};

const styles = {
  global: (props) => ({
    body: {
      bg: props.colorMode === "dark" ? "slate.950" : "slate.50",
      color: props.colorMode === "dark" ? "slate.100" : "slate.900",
    },
    "::selection": {
      bg: props.colorMode === "dark" ? "brand.500" : "brand.200",
      color: props.colorMode === "dark" ? "white" : "slate.900",
    },
  }),
};

const components = {
  Button: {
    baseStyle: {
      fontWeight: "600",
      borderRadius: "lg",
    },
    variants: {
      solid: (props) => ({
        bg: props.colorScheme === "brand" ? "brand.500" : undefined,
        _hover: {
          bg: props.colorScheme === "brand" ? "brand.600" : undefined,
          transform: "translateY(-1px)",
          boxShadow: "md",
        },
        _active: {
          transform: "translateY(0)",
        },
        transition: "all 0.2s",
      }),
      ghost: {
        _hover: {
          bg: "transparent",
        },
      },
    },
  },
  Card: {
    baseStyle: (props) => ({
      container: {
        bg: props.colorMode === "dark" ? "slate.900" : "white",
        borderColor: props.colorMode === "dark" ? "slate.800" : "slate.200",
        borderWidth: "1px",
        borderRadius: "xl",
        boxShadow: props.colorMode === "dark" 
          ? "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)"
          : "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
      },
    }),
  },
  Input: {
    variants: {
      outline: (props) => ({
        field: {
          bg: props.colorMode === "dark" ? "slate.900" : "white",
          borderColor: props.colorMode === "dark" ? "slate.700" : "slate.300",
          _hover: {
            borderColor: props.colorMode === "dark" ? "slate.600" : "slate.400",
          },
          _focus: {
            borderColor: "brand.500",
            boxShadow: `0 0 0 1px ${props.theme.colors.brand[500]}`,
          },
        },
      }),
    },
    defaultProps: {
      variant: "outline",
    },
  },
  Badge: {
    baseStyle: {
      borderRadius: "full",
      px: 2,
      py: 0.5,
    },
  },
  Tooltip: {
    baseStyle: (props) => ({
      bg: props.colorMode === "dark" ? "slate.800" : "slate.900",
      color: "white",
      borderRadius: "md",
      px: 3,
      py: 2,
    }),
  },
};

const theme = extendTheme({
  colors,
  fonts,
  config,
  styles,
  components,
});

export default theme;
