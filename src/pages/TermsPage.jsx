import "../Styles/defaults.css";
import "../Styles/legal.css";

export default function TermsPage() {
  return (
    <section className="legal-page">
      <h2>FluxMod Terms of Service</h2>
      <p className="muted">Last Updated: March 4, 2026</p>

      <p>
        Welcome to <strong>FluxMod</strong>, an open-source moderation bot and
        dashboard built for the Fluxer platform.
      </p>
      <p>
        By adding FluxMod to your server or using the FluxMod dashboard, you agree
        to the following Terms of Service.
      </p>

      <h3>1. Acceptance of Terms</h3>
      <p>By using FluxMod, you agree to:</p>
      <ul>
        <li>Comply with these Terms of Service</li>
        <li>Comply with Fluxer&apos;s platform rules and policies</li>
      </ul>
      <p>If you do not agree, you must discontinue use of the service.</p>

      <h3>2. Description of Service</h3>
      <p>FluxMod provides:</p>
      <ul>
        <li>Moderation commands</li>
        <li>Warning systems</li>
        <li>AutoMod configuration</li>
        <li>Server configuration storage</li>
        <li>A web dashboard using Fluxer OAuth authentication</li>
      </ul>
      <p>FluxMod is fully open source. Source code is publicly available:</p>
      <ul>
        <li>
          Frontend:{" "}
          <a
            href="https://github.com/BlixedBox/FluxMod-Frontend"
            target="_blank"
            rel="noreferrer"
          >
            https://github.com/BlixedBox/FluxMod-Frontend
          </a>
        </li>
        <li>
          Backend:{" "}
          <a
            href="https://github.com/BlixedBox/FluxMod-Backend"
            target="_blank"
            rel="noreferrer"
          >
            https://github.com/BlixedBox/FluxMod-Backend
          </a>
        </li>
        <li>
          Bot:{" "}
          <a
            href="https://github.com/BlixedBox/FluxMod-Bot"
            target="_blank"
            rel="noreferrer"
          >
            https://github.com/BlixedBox/FluxMod-Bot
          </a>
        </li>
      </ul>

      <h3>3. Proper Use</h3>
      <p>You agree not to:</p>
      <ul>
        <li>Use FluxMod to violate Fluxer&apos;s policies</li>
        <li>Attempt to exploit or disrupt the service</li>
        <li>Abuse authentication systems</li>
        <li>Attempt unauthorized access to stored data</li>
      </ul>
      <p>
        We reserve the right to restrict or terminate access for abuse or misuse.
      </p>

      <h3>4. Service Availability</h3>
      <p>
        FluxMod is provided &ldquo;as is&rdquo; without guarantees of uptime or
        uninterrupted availability.
      </p>
      <p>We may:</p>
      <ul>
        <li>Modify features</li>
        <li>Perform maintenance</li>
        <li>Temporarily suspend service</li>
        <li>Update functionality</li>
      </ul>

      <h3>5. Limitation of Liability</h3>
      <p>FluxMod is provided without warranties of any kind.</p>
      <p>We are not liable for:</p>
      <ul>
        <li>Data loss</li>
        <li>Moderation outcomes</li>
        <li>Configuration errors</li>
        <li>Service interruptions</li>
      </ul>
      <p>
        Server owners are responsible for how they configure and use FluxMod.
      </p>

      <h3>6. Termination</h3>
      <p>
        We reserve the right to suspend or terminate access to FluxMod for users
        or servers that violate these Terms or abuse the service.
      </p>

      <h3>7. Changes to Terms</h3>
      <p>
        These Terms may be updated at any time. Continued use of FluxMod after
        updates constitutes acceptance of the revised Terms.
      </p>

      <h3>8. Contact</h3>
      <p>
        For questions regarding these Terms, please contact the project maintainers
        through the official GitHub repositories.
      </p>
    </section>
  );
}