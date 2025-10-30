import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Privacy Policy",
    description: "Privacy Policy for our service",
  };
}

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-4xl font-bold">Privacy Policy</h1>

      <div className="text-muted-foreground space-y-6">
        <p className="text-sm">
          <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
        </p>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Introduction
          </h2>
          <p>
            This Privacy Policy describes how we collect, use, and protect your
            information when you use our service. By using our service, you
            agree to the collection and use of information in accordance with
            this policy.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Information We Collect
          </h2>
          <p className="mb-3">We collect the following types of information:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Account Information:</strong> When you create an account,
              we collect authentication information through third-party
              providers (e.g., Google OAuth).
            </li>
            <li>
              <strong>Conversation Data:</strong> We store conversations and
              messages you create while using the service to provide core
              functionality.
            </li>
            <li>
              <strong>Usage Information:</strong> We may collect information
              about how you interact with our service for improving user
              experience.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Google Analytics Integration
          </h2>
          <p>
            Our service integrates with Google Analytics to provide analytics
            insights. Important points regarding this integration:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>We do not store your Google Analytics data on our servers.</li>
            <li>
              Access to your Google Analytics data requires your active OAuth
              authorization.
            </li>
            <li>
              We only access your Google Analytics data when you explicitly
              request insights through our service.
            </li>
            <li>
              You can revoke our access to your Google Analytics data at any
              time through your Google account settings.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            How We Use Your Information
          </h2>
          <p className="mb-3">We use collected information to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Provide and maintain our service</li>
            <li>Process your requests and queries</li>
            <li>Improve and personalize user experience</li>
            <li>Communicate with you about service updates or issues</li>
            <li>Ensure security and prevent fraud</li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Data Storage and Security
          </h2>
          <p>
            We implement reasonable security measures to protect your
            information. However, no method of transmission over the Internet or
            electronic storage is 100% secure. While we strive to protect your
            data, we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Third-Party Services
          </h2>
          <p>
            Our service uses third-party services (such as Google OAuth and
            Google Analytics API) that may collect information used to identify
            you. These services have their own privacy policies which govern
            their use of your information.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Data Retention
          </h2>
          <p>
            We retain your conversation data for as long as your account is
            active or as needed to provide you services. You may request
            deletion of your data by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Your Rights
          </h2>
          <p className="mb-3">You have the right to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Access your personal information</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Revoke OAuth permissions at any time</li>
            <li>Export your data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Changes to This Policy
          </h2>
          <p>
            We may update our Privacy Policy from time to time. We will notify
            you of any changes by posting the new Privacy Policy on this page
            and updating the &ldquo;Last Updated&rdquo; date.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Contact Us
          </h2>
          <p>
            If you have questions about this Privacy Policy, please contact us
            at:{" "}
            <a
              href="mailto:bastien.geneix@hint.work"
              className="text-primary hover:underline"
            >
              bastien.geneix@hint.work
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
