import { Routes, Route, Navigate } from "react-router-dom";
import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import theme from "@/theme";
import { AuthProvider } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/pages/HomePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { GuildDashboardPage } from "@/pages/GuildDashboardPage";
import { ContributorsPage } from "@/pages/ContributorsPage";
import { TermsPage } from "@/pages/TermsPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { StatusPage } from "@/pages/StatusPage";

// Import fonts
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono";

function AppContent() {
  return (
    <Routes>
      <Route path="/" element={<Layout><HomePage /></Layout>} />
      <Route path="/pages/dashboard.html" element={<Layout maxW="1400px"><DashboardPage /></Layout>} />
      <Route path="/pages/guild-dashboard.html" element={<Layout maxW="1400px"><GuildDashboardPage /></Layout>} />
      <Route path="/pages/contributors.html" element={<Layout><ContributorsPage /></Layout>} />
      <Route path="/pages/terms.html" element={<Layout><TermsPage /></Layout>} />
      <Route path="/pages/privacy.html" element={<Layout><PrivacyPage /></Layout>} />
      <Route path="/pages/status.html" element={<Layout><StatusPage /></Layout>} />
      <Route path="/status/:code" element={<Layout><StatusPage /></Layout>} />
      <Route path="*" element={<Navigate to="/pages/status.html?code=404" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <ChakraProvider theme={theme}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ChakraProvider>
    </>
  );
}

export default App;
