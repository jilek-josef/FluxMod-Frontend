import "../Styles/defaults.css";
import "../Styles/legal.css";

export default function PrivacyPage() {
  return (
    <section className="legal-page">
      <h2>FluxMod Privacy Policy</h2>
      <p className="muted">Last Updated: March 4, 2026</p>

      <p>
        FluxMod is designed with transparency and data minimization in mind. The
        entire project is open source and publicly auditable.
      </p>

      <h3>1. Information We Collect</h3>
      <p>
        FluxMod stores only the data necessary to operate its moderation and
        dashboard features.
      </p>

      <h4>Platform Identifiers</h4>
      <ul>
        <li>User ID</li>
        <li>Server (Guild) ID</li>
        <li>Role IDs</li>
        <li>Channel IDs</li>
      </ul>

      <h4>Moderation Data</h4>
      <ul>
        <li>Warning records</li>
        <li>AutoMod rules</li>
        <li>Server configuration settings</li>
      </ul>

      <h4>Authentication Data</h4>
      <ul>
        <li>Fluxer OAuth session data</li>
        <li>Secure session cookies for dashboard login</li>
      </ul>

      <p>FluxMod does <strong>not</strong> store:</p>
      <ul>
        <li>User passwords</li>
        <li>Payment information</li>
        <li>Unnecessary personal information</li>
      </ul>

      <h3>2. How We Use Information</h3>
      <p>Stored data is used solely to:</p>
      <ul>
        <li>Provide moderation functionality</li>
        <li>Maintain server configuration</li>
        <li>Authenticate dashboard sessions</li>
        <li>Maintain service stability</li>
      </ul>
      <p>We do not sell, rent, or monetize user data.</p>

      <h3>3. Data Retention</h3>
      <p>FluxMod follows strict automatic deletion policies.</p>

      <h4>Warning Records</h4>
      <ul>
        <li>Automatically deleted <strong>1 year</strong> after creation</li>
        <li>May be deleted earlier upon user request</li>
      </ul>

      <h4>Inactive Data</h4>
      <p>
        Server configuration and related stored data are automatically deleted
        after <strong>2 years of inactivity</strong>.
      </p>
      <p>Inactivity may include:</p>
      <ul>
        <li>Removal of the bot from a server</li>
        <li>No command usage</li>
        <li>No dashboard interaction</li>
      </ul>

      <h4>Dashboard Sessions</h4>
      <ul>
        <li>
          Dashboard sessions expire automatically after <strong>30 days</strong>
        </li>
        <li>Users must re-authenticate after expiration</li>
      </ul>

      <h4>Backups</h4>
      <p>
        Deleted data may temporarily persist in secure backups before permanent
        removal.
      </p>

      <h3>4. Data Security</h3>
      <p>
        We implement reasonable technical safeguards to protect stored data.
      </p>
      <p>However, no system can guarantee absolute security.</p>

      <h3>5. Data Sharing</h3>
      <p>FluxMod does not:</p>
      <ul>
        <li>Sell data</li>
        <li>Share data with advertisers</li>
        <li>Provide data to third parties</li>
      </ul>
      <p>Data is disclosed only if legally required.</p>

      <h3>6. User Rights</h3>
      <p>Users may request:</p>
      <ul>
        <li>Access to their stored data</li>
        <li>Early deletion of warnings</li>
        <li>Removal of stored user data where applicable</li>
      </ul>
      <p>Requests can be made through official project support channels.</p>

      <h3>7. Open Source Transparency</h3>
      <p>
        FluxMod is fully open source. All data handling logic can be reviewed
        publicly:
      </p>
      <ul>
        <li>
          <a
            href="https://github.com/BlixedBox/FluxMod-Frontend"
            target="_blank"
            rel="noreferrer"
          >
            https://github.com/BlixedBox/FluxMod-Frontend
          </a>
        </li>
        <li>
          <a
            href="https://github.com/BlixedBox/FluxMod-Backend"
            target="_blank"
            rel="noreferrer"
          >
            https://github.com/BlixedBox/FluxMod-Backend
          </a>
        </li>
        <li>
          <a
            href="https://github.com/BlixedBox/FluxMod-Bot"
            target="_blank"
            rel="noreferrer"
          >
            https://github.com/BlixedBox/FluxMod-Bot
          </a>
        </li>
      </ul>
      <p>Transparency is a core principle of this project.</p>

      <h3>8. Changes to This Policy</h3>
      <p>
        This Privacy Policy may be updated from time to time. Continued use of
        FluxMod after changes constitutes acceptance of the updated policy.
      </p>
    </section>
  );
}