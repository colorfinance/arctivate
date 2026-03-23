import Head from 'next/head'
import Link from 'next/link'

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — Arctivate</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#d1d5db',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '2rem 1.5rem',
        lineHeight: 1.8,
      }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <Link href="/" style={{ color: '#2dd4bf', textDecoration: 'none', fontSize: '0.9rem' }}>
            &larr; Back to Arctivate
          </Link>

          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: 800, margin: '2rem 0 0.5rem' }}>
            Privacy Policy
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
            Last updated: March 23, 2026
          </p>

          <Section title="1. Information We Collect">
            <p><strong style={{ color: '#fff' }}>Account Information:</strong> When you create an account, we collect your email address for authentication.</p>
            <p><strong style={{ color: '#fff' }}>Wearable Data:</strong> If you connect a Garmin or other wearable device, we receive workout data including activity type, duration, heart rate, steps, and calories burned. This data is synced automatically with your consent.</p>
            <p><strong style={{ color: '#fff' }}>Usage Data:</strong> We collect information about how you use the app, including features accessed, challenges completed, and streaks maintained.</p>
            <p><strong style={{ color: '#fff' }}>Photos:</strong> If you use the camera or photo library features (food scanning, progress photos), images are processed on-device or sent to our servers for AI analysis. Photos are not stored longer than necessary for processing.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul style={{ paddingLeft: '1.25rem' }}>
              <li>To provide and maintain the Arctivate service</li>
              <li>To track your workouts, habits, and challenge progress</li>
              <li>To calculate reward points and partner discounts</li>
              <li>To provide AI-powered fitness and nutrition insights</li>
              <li>To send you notifications about your progress and streaks</li>
              <li>To improve the app and develop new features</li>
            </ul>
          </Section>

          <Section title="3. Data Sharing">
            <p>We do not sell your personal data. We may share limited data with:</p>
            <ul style={{ paddingLeft: '1.25rem' }}>
              <li><strong style={{ color: '#fff' }}>Partner Businesses:</strong> When you redeem rewards, we share only the minimum information needed to process the redemption (e.g., eligibility confirmation).</li>
              <li><strong style={{ color: '#fff' }}>Service Providers:</strong> We use Supabase for authentication and data storage, and Google AI for nutrition analysis. These providers process data on our behalf.</li>
              <li><strong style={{ color: '#fff' }}>Social Sharing:</strong> When you voluntarily share progress, only the content you choose to share is visible to others.</li>
            </ul>
          </Section>

          <Section title="4. Data Storage & Security">
            <p>Your data is stored securely using Supabase (hosted on AWS). We use encryption in transit (TLS) and at rest. Authentication is handled via secure magic link email verification — we never store passwords.</p>
          </Section>

          <Section title="5. Your Rights">
            <p>You have the right to:</p>
            <ul style={{ paddingLeft: '1.25rem' }}>
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Disconnect your wearable device at any time</li>
              <li>Opt out of non-essential notifications</li>
            </ul>
          </Section>

          <Section title="6. Third-Party Services">
            <p>Arctivate integrates with third-party services that have their own privacy policies:</p>
            <ul style={{ paddingLeft: '1.25rem' }}>
              <li>Garmin Connect (wearable data sync)</li>
              <li>Supabase (authentication and data storage)</li>
              <li>Google Generative AI (nutrition analysis)</li>
            </ul>
          </Section>

          <Section title="7. Children's Privacy">
            <p>Arctivate is not intended for children under 13. We do not knowingly collect personal information from children under 13.</p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.</p>
          </Section>

          <Section title="9. Contact Us">
            <p>If you have questions about this privacy policy or your data, please contact us through the app or visit our website at arctivate-repo.vercel.app.</p>
          </Section>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '3rem', paddingTop: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
            <p>&copy; 2026 Arctivate. All rights reserved.</p>
          </div>
        </div>
      </div>
    </>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
        {title}
      </h2>
      <div style={{ color: '#9ca3af', fontSize: '0.95rem' }}>
        {children}
      </div>
    </div>
  )
}
