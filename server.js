const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG_ENABLED = process.env.DEBUG === 'true';
const FLUXER_VERIFY = process.env.FLUXER_VERIFY;

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

function serveFluxerVerification(req, res) {
  if (!FLUXER_VERIFY) {
    debugLog('server', {
      route: req.originalUrl,
      status: 404,
      reason: 'FLUXER_VERIFY not configured',
    });
    res.status(404).type('text/plain').send('FLUXER_VERIFY not configured');
    return;
  }

  debugLog('server', {
    route: req.originalUrl,
    status: 200,
    source: 'env:FLUXER_VERIFY',
  });
  res.type('text/plain').send(FLUXER_VERIFY);
}

app.get('/.well-known/fluxer-verification', serveFluxerVerification);
app.get('/.well-known/fluxer-verification.txt', serveFluxerVerification);

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));
debugLog('server', { staticDir: path.join(__dirname, 'dist') });

// Return custom 404 page for unknown routes
app.get('*', (req, res) => {
  debugLog('server', { route: req.originalUrl, status: 404 });
  res.status(404).sendFile(path.join(__dirname, 'dist', '404.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on port ${PORT}`);
  debugLog('server', { host: '0.0.0.0', port: PORT });
});
