import { extendTheme } from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";

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
  glass: {
    light: "rgba(255, 255, 255, 0.7)",
    dark: "rgba(15, 23, 42, 0.7)",
    borderLight: "rgba(255, 255, 255, 0.3)",
    borderDark: "rgba(255, 255, 255, 0.1)",
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
      bg: mode("slate.50", "slate.950")(props),
      color: mode("slate.900", "slate.100")(props),
      backgroundImage: mode(
        "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
        "linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e293b 100%)"
      )(props),
      backgroundAttachment: "fixed",
      minHeight: "100vh",
    },
    "::selection": {
      bg: mode("brand.200", "brand.500")(props),
      color: mode("slate.900", "white")(props),
    },
    "::-webkit-scrollbar": {
      width: "8px",
      height: "8px",
    },
    "::-webkit-scrollbar-track": {
      bg: mode("slate.200", "slate.800")(props),
    },
    "::-webkit-scrollbar-thumb": {
      bg: mode("slate.400", "slate.600")(props),
      borderRadius: "4px",
    },
    "::-webkit-scrollbar-thumb:hover": {
      bg: mode("slate.500", "slate.500")(props),
    },
  }),
};

const components = {
  Button: {
    baseStyle: {
      fontWeight: "600",
      borderRadius: "lg",
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    },
    variants: {
      solid: (props) => ({
        bg: props.colorScheme === "brand" ? "brand.500" : undefined,
        backgroundImage: props.colorScheme === "brand" 
          ? "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)" 
          : undefined,
        _hover: {
          bg: props.colorScheme === "brand" ? "brand.600" : undefined,
          transform: "translateY(-2px)",
          boxShadow: "0 10px 20px -5px rgba(14, 165, 233, 0.4)",
        },
        _active: {
          transform: "translateY(0)",
          boxShadow: "none",
        },
      }),
      ghost: {
        _hover: {
          bg: "transparent",
          transform: "translateY(-1px)",
        },
      },
      outline: (props) => ({
        borderWidth: "2px",
        _hover: {
          bg: mode(
            `${props.colorScheme}.50`,
            `${props.colorScheme}.900`
          )(props),
          transform: "translateY(-1px)",
        },
      }),
      glass: (props) => ({
        bg: mode("glass.light", "glass.dark")(props),
        backdropFilter: "blur(12px)",
        borderWidth: "1px",
        borderColor: mode("glass.borderLight", "glass.borderDark")(props),
        color: mode("slate.800", "white")(props),
        _hover: {
          bg: mode("rgba(255,255,255,0.85)", "rgba(15,23,42,0.85)")(props),
          transform: "translateY(-2px)",
          boxShadow: mode(
            "0 8px 30px rgba(0,0,0,0.12)",
            "0 8px 30px rgba(0,0,0,0.4)"
          )(props),
        },
        _active: {
          transform: "translateY(0)",
        },
      }),
    },
  },
  Card: {
    baseStyle: (props) => ({
      container: {
        bg: mode("white", "slate.800")(props),
        borderColor: mode("slate.200", "slate.700")(props),
        borderWidth: "1px",
        borderRadius: "2xl",
        boxShadow: mode(
          "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
          "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)"
        )(props),
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
      },
    }),
    variants: {
      glass: (props) => ({
        container: {
          bg: mode("rgba(255,255,255,0.7)", "rgba(15,23,42,0.6)")(props),
          backdropFilter: "blur(16px)",
          borderWidth: "1px",
          borderColor: mode(
            "rgba(255,255,255,0.5)",
            "rgba(255,255,255,0.1)"
          )(props),
          boxShadow: mode(
            "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
            "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
          )(props),
        },
      }),
      elevated: (props) => ({
        container: {
          bg: mode("white", "slate.800")(props),
          borderWidth: "0",
          boxShadow: mode(
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)"
          )(props),
          _hover: {
            transform: "translateY(-4px)",
            boxShadow: mode(
              "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
              "0 25px 50px -12px rgba(0, 0, 0, 0.6)"
            )(props),
          },
        },
      }),
      gradient: (props) => ({
        container: {
          bg: "transparent",
          borderWidth: "0",
          backgroundImage: mode(
            "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
            "linear-gradient(135deg, rgba(14,165,233,0.15) 0%, rgba(2,132,199,0.15) 100%)"
          )(props),
          _hover: {
            backgroundImage: mode(
              "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
              "linear-gradient(135deg, rgba(14,165,233,0.25) 0%, rgba(2,132,199,0.25) 100%)"
            )(props),
          },
        },
      }),
    },
  },
  Input: {
    variants: {
      outline: (props) => ({
        field: {
          bg: mode("white", "slate.900")(props),
          borderColor: mode("slate.300", "slate.700")(props),
          borderWidth: "2px",
          borderRadius: "lg",
          transition: "all 0.2s",
          _hover: {
            borderColor: mode("slate.400", "slate.600")(props),
          },
          _focus: {
            borderColor: "brand.500",
            boxShadow: "0 0 0 3px rgba(14, 165, 233, 0.15)",
          },
        },
      }),
      glass: (props) => ({
        field: {
          bg: mode("rgba(255,255,255,0.5)", "rgba(15,23,42,0.5)")(props),
          backdropFilter: "blur(8px)",
          borderWidth: "1px",
          borderColor: mode("rgba(255,255,255,0.5)", "rgba(255,255,255,0.1)")(props),
          borderRadius: "lg",
          _hover: {
            bg: mode("rgba(255,255,255,0.7)", "rgba(15,23,42,0.7)")(props),
          },
          _focus: {
            bg: mode("white", "slate.800")(props),
            borderColor: "brand.500",
            boxShadow: "0 0 0 3px rgba(14, 165, 233, 0.2)",
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
      px: 2.5,
      py: 0.5,
      fontWeight: "600",
      fontSize: "xs",
      textTransform: "none",
    },
    variants: {
      subtle: (props) => ({
        bg: mode(`${props.colorScheme}.100`, `${props.colorScheme}.900`)(props),
        color: mode(`${props.colorScheme}.700`, `${props.colorScheme}.300`)(props),
      }),
      solid: (props) => ({
        bg: mode(`${props.colorScheme}.500`, `${props.colorScheme}.600`)(props),
        color: "white",
        boxShadow: mode(
          `0 2px 8px ${props.theme.colors[props.colorScheme]?.[300] || "#000"}`,
          "none"
        )(props),
      }),
      glass: (props) => ({
        bg: mode(
          `${props.colorScheme}.50`,
          `${props.colorScheme}.900`
        )(props),
        color: mode(`${props.colorScheme}.600`, `${props.colorScheme}.300`)(props),
        borderWidth: "1px",
        borderColor: mode(
          `${props.colorScheme}.200`,
          `${props.colorScheme}.700`
        )(props),
      }),
    },
  },
  Tooltip: {
    baseStyle: (props) => ({
      bg: mode("slate.800", "slate.100")(props),
      color: mode("white", "slate.900")(props),
      borderRadius: "md",
      px: 3,
      py: 2,
      fontSize: "sm",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
    }),
  },
  Heading: {
    baseStyle: {
      fontWeight: "700",
      letterSpacing: "-0.02em",
    },
  },
  Switch: {
    baseStyle: (props) => ({
      track: {
        bg: mode("slate.300", "slate.600")(props),
        _checked: {
          bg: "brand.500",
        },
      },
      thumb: {
        bg: "white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      },
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
