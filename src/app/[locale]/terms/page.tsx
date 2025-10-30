import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Terms of Service",
    description: "Terms of Service for our service",
  };
}

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-4xl font-bold">Terms of Service</h1>

      <div className="text-muted-foreground space-y-6">
        <p className="text-sm">
          <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
        </p>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Acceptance of Terms
          </h2>
          <p>
            By accessing and using this service, you accept and agree to be
            bound by the terms and provisions of this agreement. If you do not
            agree to these terms, please do not use this service.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Description of Service
          </h2>
          <p>
            Our service provides analytics insights and conversational AI
            assistance related to Google Analytics data. The service requires
            connection to third-party services including Google Analytics
            through OAuth authentication.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            User Accounts
          </h2>
          <p className="mb-3">When you create an account with us:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              You are responsible for maintaining the security of your account
              credentials.
            </li>
            <li>
              You are responsible for all activities that occur under your
              account.
            </li>
            <li>
              You must notify us immediately of any unauthorized use of your
              account.
            </li>
            <li>
              You must provide accurate and complete information during
              registration.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Google Analytics Access
          </h2>
          <p>By connecting your Google Analytics account:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              You authorize us to access your Google Analytics data through
              Google's API on your behalf.
            </li>
            <li>
              We only access your data when you make specific requests through
              our service.
            </li>
            <li>We do not store your Google Analytics data on our servers.</li>
            <li>
              You can revoke this access at any time through your Google account
              settings.
            </li>
            <li>
              You must have appropriate permissions to the Google Analytics
              properties you connect.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Acceptable Use
          </h2>
          <p className="mb-3">You agree not to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Use the service for any unlawful purpose</li>
            <li>
              Attempt to gain unauthorized access to any part of the service
            </li>
            <li>Interfere with or disrupt the service or servers</li>
            <li>Upload or transmit malicious code or viruses</li>
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe on the rights of others</li>
            <li>Misrepresent your identity or affiliation</li>
            <li>Attempt to reverse engineer any part of the service</li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Service Availability
          </h2>
          <p>
            We strive to provide reliable service, but we do not guarantee that:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>The service will be available at all times or uninterrupted</li>
            <li>The service will be error-free or bug-free</li>
            <li>Any defects will be corrected</li>
            <li>The service will meet your specific requirements</li>
          </ul>
          <p className="mt-3">
            We reserve the right to modify, suspend, or discontinue the service
            at any time without prior notice.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Data and Content
          </h2>
          <p>
            You retain ownership of any content you create using our service. By
            using our service, you grant us a limited license to store and
            process your conversations to provide the service functionality.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Intellectual Property
          </h2>
          <p>
            The service and its original content (excluding user content),
            features, and functionality are owned by us and are protected by
            international copyright, trademark, patent, trade secret, and other
            intellectual property laws.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Disclaimer of Warranties
          </h2>
          <p>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ANY
            WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT
            THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. WE DO NOT
            WARRANT THE ACCURACY OR RELIABILITY OF ANY INFORMATION, DATA, OR
            INSIGHTS PROVIDED THROUGH THE SERVICE.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Limitation of Liability
          </h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
            DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED
            DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER
            INTANGIBLE LOSSES RESULTING FROM:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Your use or inability to use the service</li>
            <li>Any unauthorized access to or use of our servers</li>
            <li>
              Any interruption or cessation of transmission to or from the
              service
            </li>
            <li>Any bugs, viruses, or other harmful code</li>
            <li>Any errors or omissions in any content or information</li>
            <li>
              Any decisions made based on insights provided by the service
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Third-Party Services
          </h2>
          <p>
            Our service relies on third-party services (including Google OAuth,
            Google Analytics API, and others). We are not responsible for the
            availability, accuracy, or functionality of these third-party
            services. Your use of third-party services is governed by their
            respective terms and policies.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Termination
          </h2>
          <p>
            We reserve the right to terminate or suspend your account and access
            to the service at our sole discretion, without notice, for any
            reason, including breach of these Terms. Upon termination, your
            right to use the service will immediately cease.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Indemnification
          </h2>
          <p>
            You agree to indemnify and hold harmless the service, its
            affiliates, and their respective officers, directors, employees, and
            agents from any claims, damages, losses, liabilities, and expenses
            (including legal fees) arising from your use of the service or
            violation of these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Changes to Terms
          </h2>
          <p>
            We reserve the right to modify or replace these Terms at any time.
            We will provide notice of any material changes by posting the new
            Terms on this page and updating the &ldquo;Last Updated&rdquo; date.
            Your continued use of the service after such changes constitutes
            acceptance of the new Terms.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Governing Law
          </h2>
          <p>
            These Terms shall be governed by and construed in accordance with
            applicable laws, without regard to conflict of law provisions. Any
            disputes arising from these Terms or use of the service shall be
            resolved in accordance with applicable jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Severability
          </h2>
          <p>
            If any provision of these Terms is found to be unenforceable or
            invalid, that provision shall be limited or eliminated to the
            minimum extent necessary so that these Terms shall otherwise remain
            in full force and effect.
          </p>
        </section>

        <section>
          <h2 className="text-foreground mb-3 text-2xl font-semibold">
            Contact Information
          </h2>
          <p>
            If you have any questions about these Terms, please contact us at:{" "}
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
