import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white p-8 md:p-16 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-[#FCE14B] mb-8">
          Privacy Policy
        </h1>
        
        <p className="text-sm text-white/70">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">1. Information We Collect</h2>
          <p className="text-white/70 leading-relaxed">
            When you log in using Epic Games on our site (Mobile Series Leaderboard), we only request access to your basic profile information, which includes your Epic Account ID and Display Name. We do not have access to your email, password, payment information, or any other private account details.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">2. How We Use Your Information</h2>
          <p className="text-white/70 leading-relaxed">
            The collected information (Epic Display Name and Account ID) is strictly used to verify your identity to allow you to interact with the interactive drop map. This ensures that only qualified players can place their drop spots and prevents impersonation.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">3. Data Storage and Security</h2>
          <p className="text-white/70 leading-relaxed">
            Your Account ID and Display Name are stored securely in our database (Firebase) to save your drop map selections. We implement industry-standard security measures to protect your data. Your data is never sold or shared with any third parties.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">4. Third-Party Services</h2>
          <p className="text-white/70 leading-relaxed">
            Our authentication is handled securely by Epic Games. By using our login feature, you are also subject to the Epic Games Privacy Policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">5. Contact Us</h2>
          <p className="text-white/70 leading-relaxed">
            If you have any questions about this Privacy Policy or wish to have your data removed from our database, please contact us at <a href="mailto:babylionbiz@gmail.com" className="text-[#98D8C8] hover:underline">babylionbiz@gmail.com</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
