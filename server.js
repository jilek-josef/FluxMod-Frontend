const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG_ENABLED = process.env.DEBUG === 'true';

function debugLog(scope, details) {
  if (!DEBUG_ENABLED) {
    return;
  }

  if (details === undefined) {
    console.debug(`[FluxMod:${scope}]`);
    return;
  }

  console.debug(`[FluxMod:${scope}]`, details);
}

debugLog('server', { PORT, cwd: process.cwd() });


// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));
debugLog('server', { staticDir: path.join(__dirname, 'dist') });

// Unknown routes go to dedicated status page.
app.get('*', (req, res) => {
  debugLog('server', { route: req.originalUrl, status: 302, redirect: '/pages/status.html?code=404' });
  res.redirect('/pages/status.html?code=404');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on port ${PORT}`);
  debugLog('server', { host: '0.0.0.0', port: PORT });
});
