import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white p-8 md:p-16 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-[#FCE14B] mb-8">
          Privacy Policy
        </h1>
        
        <p className="text-sm text-white/70">
          Last updated: June 15, 2026
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">1. Information We Collect</h2>
          <p className="text-white/70 leading-relaxed">
            When you log in via a third-party authentication provider on mobileseries.xyz, we only request access to your basic public profile information, specifically your account identifier and display name. We do not have access to your email address, password, payment information, or any other private account details.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">2. How We Use Your Information</h2>
          <p className="text-white/70 leading-relaxed">
            Your display name and account identifier are used solely to verify your identity and allow you to interact with the interactive drop map feature on mobileseries.xyz. This ensures that only qualified players can place their drop spots and prevents impersonation.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">3. Data Storage and Security</h2>
          <p className="text-white/70 leading-relaxed">
            Your account identifier and display name are stored securely in our database to save your drop map selections. We implement industry-standard security measures to protect your data. Your data is never sold or shared with any third parties.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">4. Third-Party Services</h2>
          <p className="text-white/70 leading-relaxed">
            Our site uses third-party authentication providers for login. When you choose to log in, you are redirected to the respective provider's login page. We encourage you to review the privacy policies of any third-party services you use in connection with our site.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">5. Data Deletion</h2>
          <p className="text-white/70 leading-relaxed">
            You may request the deletion of all data associated with your account at any time by contacting us. Upon receiving your request, we will permanently remove all stored information tied to your account within 30 days.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">6. Contact Us</h2>
          <p className="text-white/70 leading-relaxed">
            If you have any questions about this Privacy Policy, wish to have your data removed, or have any other inquiries, please contact us at <a href="mailto:babylionbiz@gmail.com" className="text-[#98D8C8] hover:underline">babylionbiz@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
