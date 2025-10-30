import React from 'react';
import { ArrowLeft, ExternalLink, Mail, FileText, Shield, Calendar, X } from 'lucide-react';

interface MoreProps {
  onBack: () => void;
}

interface FeatureCard {
  id: string;
  icon: string;
  title: string;
  description: string;
  status?: 'coming-soon' | 'available' | 'beta';
  externalLink?: string;
  onClick?: () => void;
}

const More: React.FC<MoreProps> = ({ onBack }) => {
  const [showTos, setShowTos] = React.useState(false); // <-- TOS modal state
  const [showCookies, setShowCookies] = React.useState(false);
  const [showSecurity, setShowSecurity] = React.useState(false);
  const [showPrivacy, setShowPrivacy] = React.useState(false);


  const features: FeatureCard[] = [
    { id: 'analytics', icon: '📊', title: 'Advanced Analytics', description: 'Deep insights into agent performance and market trends', status: 'coming-soon' },
    { id: 'api', icon: '🔗', title: 'Developer API', description: 'Integrate Ursus agents into your applications', status: 'coming-soon', /*externalLink: 'https://docs.ursus.ai'*/ },
    { id: 'marketplace', icon: '🏪', title: 'Agent Templates', description: 'Pre-built agent configurations for quick deployment', status: 'coming-soon' },
    { id: 'staking', icon: '💎', title: 'Stake & Earn', description: 'Stake agent tokens for passive income and benefits', status: 'coming-soon' },
    { id: 'community', icon: '💬', title: 'Community', description: 'Connect with other creators and share strategies', status: 'beta', externalLink: 'https://t.me/Ursus_AI' },
    { id: 'support', icon: '❓', title: 'Support', description: 'Documentation, tutorials, and customer support', status: 'coming-soon', /*externalLink: 'https://help.ursus.ai'*/ },
    { id: 'stats', icon: '📈', title: 'Platform Metrics', description: 'Real-time platform statistics and growth metrics', status: 'coming-soon' },
    { id: 'bugs', icon: '🐛', title: 'Report Issues', description: 'Help us improve by reporting bugs and feedback', status: 'available', externalLink: 'https://github.com/ursusai/issues' },
    { id: 'roadmap', icon: '🗺️', title: 'Roadmap', description: 'See what features are coming next to Ursus', status: 'coming-soon', /*externalLink: 'https://roadmap.ursus.ai'*/ }
  ];

  const platformInfo = {
    version: 'v1.2.0',
    lastUpdate: 'December 15, 2024',
    contact: 'support@ursus.ai',
    github: 'https://github.com/ursusai'
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'coming-soon': return 'bg-[#f59e0b] text-black';
      case 'beta': return 'bg-[#d8e9ea] text-black';
      case 'available': return 'bg-[#10b981] text-white';
      default: return 'bg-[#2a2a2a] text-[#a0a0a0]';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'coming-soon': return 'Coming Soon';
      case 'beta': return 'Beta';
      case 'available': return 'Available';
      default: return 'Unknown';
    }
  };

  const handleCardClick = (feature: FeatureCard) => {
    if (feature.externalLink) {
      window.open(feature.externalLink, '_blank');
    } else if (feature.onClick) {
      feature.onClick();
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] ml-[200px]">
      <div className="p-8">
        {/* Header Section */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#a0a0a0] hover:text-white mb-6 transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back to Home</span>
          </button>

          <h1 className="text-white text-4xl font-bold mb-3 bg-gradient-to-r from-white to-[#d8e9ea] bg-clip-text text-transparent">
            More Features
          </h1>
          <p className="text-[#e5e5e5] text-lg">
            Explore additional tools, resources, and platform information
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature) => (
            <div
              key={feature.id}
              onClick={() => handleCardClick(feature)}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8 hover:border-[#d8e9ea] hover:scale-[1.02] transition-all duration-300 cursor-pointer group relative"
              style={{ minHeight: '200px' }}
            >
              {feature.status && (
                <div className={`absolute top-4 right-4 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(feature.status)}`}>
                  {getStatusText(feature.status)}
                </div>
              )}

              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>

              <div className="space-y-3">
                <h3 className="text-white text-xl font-semibold group-hover:text-[#d8e9ea] transition-colors">
                  {feature.title}
                </h3>
                <p className="text-[#a0a0a0] text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>

              {feature.externalLink && (
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <ExternalLink size={16} className="text-[#d8e9ea]" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Platform Information Section */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#a0a0a0] text-sm">
                <Shield size={16} />
                <span>Version</span>
              </div>
              <div className="text-white font-medium">{platformInfo.version}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#a0a0a0] text-sm">
                <Calendar size={16} />
                <span>Last Update</span>
              </div>
              <div className="text-white font-medium">{platformInfo.lastUpdate}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#a0a0a0] text-sm">
                <Mail size={16} />
                <span>Contact</span>
              </div>
              <a href={`mailto:${platformInfo.contact}`} className="text-[#d8e9ea] font-medium hover:text-[#b8d4d6] transition-colors">
                {platformInfo.contact}
              </a>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#a0a0a0] text-sm">
                <ExternalLink size={16} />
                <span>GitHub</span>
              </div>
              <a
                href={platformInfo.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#d8e9ea] font-medium hover:text-[#b8d4d6] transition-colors flex items-center gap-1"
              >
                View Source
                <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Legal Links */}
          <div className="border-t border-[#2a2a2a] mt-8 pt-8">
            <div className="flex flex-wrap gap-6 text-sm">
              {/* Terms now opens modal */}
              <button
                type="button"
                onClick={() => setShowTos(true)}
                className="text-[#a0a0a0] hover:text-[#d8e9ea] transition-colors flex items-center gap-2"
              >
                <FileText size={14} />
                Terms of Service
              </button>

              {/* Diğerleri dış link kalabilir */}
              <button
                type="button"
                onClick={() => setShowPrivacy(true)}
                className="text-[#a0a0a0] hover:text-[#d8e9ea] transition-colors flex items-center gap-2"
              >
                <Shield size={14} />
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => setShowCookies(true)}
                className="text-[#a0a0a0] hover:text-[#d8e9ea] transition-colors flex items-center gap-2"
              >
                <FileText size={14} />
                Cookie Policy
              </button>
              <button
                type="button"
                onClick={() => setShowSecurity(true)}
                className="text-[#a0a0a0] hover:text-[#d8e9ea] transition-colors flex items-center gap-2"
              >
                <Shield size={14} />
                Security
              </button>
            </div>
          </div>

          <div className="border-t border-[#2a2a2a] mt-6 pt-6">
            <p className="text-[#666] text-sm text-center">
              © 2024 Ursus. All rights reserved. Built with ❤️ for the decentralized AI community.
            </p>
          </div>
        </div>
      </div>

      {/* TOS Modal */}
      <TermsOfServiceModal open={showTos} onClose={() => setShowTos(false)} />
      <CookiePolicyModal open={showCookies} onClose={() => setShowCookies(false)} />
      <SecurityModal open={showSecurity} onClose={() => setShowSecurity(false)} />
      <PrivacyPolicyModal open={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </div>
  );
};

export default More;

/* ---------- Modal Component (inline) ---------- */
function TermsOfServiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[92vw] max-w-3xl bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="text-white text-lg font-semibold">Terms of Service</h3>
          <button onClick={onClose} className="p-2 text-[#a0a0a0] hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto text-sm leading-6 text-[#e5e5e5] space-y-4">
          <p>
            These Terms of Use constitute a legally binding agreement between you ("you" or "your") and UrsusAI
            ("UrsusAI", "Entities or affiliates", "we", "our" or "us"). These Terms govern your use of all UrsusAI
            Services made available to you on or through the UrsusAI Platform or otherwise. UrsusAI Services may be
            developed, maintained, and/or provided by UrsusAI Entities or affiliates.
          </p>
          <p>
            By accessing the UrsusAI Platform and/or using the UrsusAI Services, you agree that you have read,
            understood, and accepted these Terms, together with any additional documents referenced herein. You
            acknowledge and agree that you will be bound by and will comply with these Terms, as updated and amended
            from time to time.
          </p>
          <p className="font-semibold">
            BY ACCESSING THE URSUSAI PLATFORM AND USING URSUSAI SERVICES, YOU IRREVOCABLY WAIVE YOUR RIGHT TO
            PARTICIPATE IN A CLASS ACTION OR SIMILAR MASS ACTION IN ANY JURISDICTION OR BEFORE ANY TRIBUNAL. YOU ALSO
            EXPRESSLY AGREE THAT ANY CLAIMS AGAINST ANY URSUSAI-RELATED ENTITY OR AFFILIATE WILL BE SUBJECT TO
            MANDATORY, BINDING ARBITRATION.
          </p>
          <p>
            If you do not understand and accept these Terms in their entirety, you should not use the UrsusAI Platform.
          </p>

          <h4 className="text-white font-semibold mt-2">Risk Warning</h4>
          <p>
            The UrsusAI Platform and UrsusAI Services involve deploying, interacting with, and transacting in AI Agents
            and tokenized AI assets. Neither UrsusAI Entities nor affiliates are responsible for AI Agents, models, or
            tokenized assets created or deployed by other users that you may engage with on the UrsusAI Platform. Please
            ensure you fully understand the risks before using UrsusAI Services.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><span className="font-medium">Capital Loss Risk:</span> Tokenized AI assets are highly volatile and may result in the total loss of your investment.</li>
            <li><span className="font-medium">Smart Contract Risk:</span> Vulnerabilities or exploits may lead to irreversible loss of funds.</li>
            <li><span className="font-medium">Performance Risk:</span> Poor or malicious AI Agent performance may result in operational failure or economic loss.</li>
            <li><span className="font-medium">Market Risk:</span> Demand for AI-powered services may fluctuate unpredictably.</li>
            <li><span className="font-medium">Regulatory Risk:</span> Legal or regulatory changes may impact UrsusAI operations or your ability to use the platform.</li>
          </ul>
          <p>
            UrsusAI is not your broker, advisor, or fiduciary. No communication or information from UrsusAI should be
            considered investment, legal, or tax advice. You are solely responsible for evaluating whether deploying,
            using, or investing in AI Agents and tokenized assets aligns with your risk tolerance and financial
            situation.
          </p>

          <h4 className="text-white font-semibold mt-2">1. Introduction</h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li>UrsusAI Entities and their affiliates develop, maintain, operate, and provide access to the UrsusAI Platform and UrsusAI Services.</li>
            <li>By using the UrsusAI Platform or Services, you enter into a legally binding agreement with all UrsusAI Entities and affiliates.</li>
            <li>You acknowledge that you must read these Terms carefully and are responsible for informing us if you do not understand any part.</li>
            <li>You agree to comply with any additional terms applicable to specific UrsusAI Services.</li>
          </ol>

          <h4 className="text-white font-semibold mt-2">2. Eligibility</h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li>To use UrsusAI Services, you must be of legal age and capacity, have full authority to enter these Terms, and not be in a prohibited jurisdiction or on any sanctions list.</li>
            <li>UrsusAI may change eligibility criteria at its sole discretion without prior notice.</li>
          </ol>

          <h4 className="text-white font-semibold mt-2">3. Platform Use</h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li>UrsusAI may refuse, limit, or terminate your access for any reason.</li>
            <li>You must not upload or distribute any harmful, fraudulent, or illegal content through UrsusAI.</li>
            <li>Misuse of AI Agents or tokenized assets for illegal purposes is strictly prohibited.</li>
          </ol>

          <h4 className="text-white font-semibold mt-2">4. Fees</h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Fees for UrsusAI Services will be displayed before use and must be paid in full.</li>
            <li>UrsusAI reserves the right to modify fees at any time.</li>
          </ol>

          <h4 className="text-white font-semibold mt-2">5. Transactions</h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li>All blockchain transactions through UrsusAI are final and irreversible.</li>
            <li>UrsusAI is not responsible for failed transactions due to network issues, insufficient funds, or user error.</li>
          </ol>

          <h4 className="text-white font-semibold mt-2">6. Security</h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li>You are responsible for securing your wallet, API keys, and account credentials.</li>
            <li>UrsusAI will never ask for your private keys or passwords.</li>
          </ol>

          <h4 className="text-white font-semibold mt-2">7. Intellectual Property</h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li>UrsusAI retains ownership of all platform IP, branding, and software.</li>
            <li>You retain ownership of AI Agents you create but grant UrsusAI a license to host and display them as necessary for platform operation.</li>
          </ol>

          <h4 className="text-white font-semibold mt-2">8. Prohibited Use</h4>
          <ul className="list-disc pl-5 space-y-2">
            <li>Violate laws or regulations.</li>
            <li>Deploy AI Agents for fraudulent, harmful, or illegal activities.</li>
            <li>Manipulate token markets artificially.</li>
          </ul>

          <h4 className="text-white font-semibold mt-2">9. Disclaimers & Limitation of Liability</h4>
          <ol className="list-decimal pl-5 space-y-2">
            <li>UrsusAI Services are provided "as is" without warranties.</li>
            <li>UrsusAI is not liable for losses arising from use of the platform, except as required by law.</li>
          </ol>

          <h4 className="text-white font-semibold mt-2">10. Governing Law & Dispute Resolution</h4>
          <p>These Terms are governed by [Jurisdiction]. Disputes will be resolved through binding arbitration.</p>

          <h4 className="text-white font-semibold mt-2">11. Contact</h4>
          <p>For questions, contact UrsusAI Support at [support link].</p>
        </div>
      </div>
    </div>
  );
}
function CookiePolicyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[92vw] max-w-3xl bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="text-white text-lg font-semibold">Cookie Policy</h3>
          <button onClick={onClose} className="p-2 text-[#a0a0a0] hover:text-white" aria-label="Close">
            {/* X ikonu için lucide-react'tan X import'lu olmalı */}
            {/* import { X } from 'lucide-react' */}
            <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current text-[#a0a0a0]"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto text-sm leading-6 text-[#e5e5e5] space-y-4">
          <p><strong>Last updated:</strong> 15 Aug 2025</p>

          <p>
            This Cookie Policy explains how <strong>UrsusAI</strong> (“UrsusAI”, “we”, “us”, or “our”) uses cookies and
            similar technologies on the UrsusAI Platform and related services. It should be read together with our Terms
            of Service and Privacy Policy.
          </p>

          <h4 className="text-white font-semibold mt-2">What are cookies?</h4>
          <p>
            Cookies are small text files stored on your device when you visit a website. We also use localStorage and
            similar technologies that serve comparable purposes.
          </p>

          <h4 className="text-white font-semibold mt-2">Types of cookies we use</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Strictly Necessary</li>
            <li>Functional</li>
            <li>Performance &amp; Analytics</li>
            <li>Security &amp; Fraud Prevention</li>
            <li>Advertising/Marketing (if enabled)</li>
          </ul>

          <h4 className="text-white font-semibold mt-2">What we collect &amp; why</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead className="text-[#a0a0a0] text-xs">
                <tr>
                  <th className="pr-4">Category</th>
                  <th className="pr-4">Examples</th>
                  <th className="pr-4">Purpose</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                <tr>
                  <td>Strictly Necessary</td>
                  <td>session_id, csrf_token</td>
                  <td>Authentication, routing, abuse prevention</td>
                  <td>Session to 1 year</td>
                </tr>
                <tr>
                  <td>Functional</td>
                  <td>theme, locale, walletAddress (localStorage)</td>
                  <td>Remember settings and web3 connection state</td>
                  <td>Until cleared</td>
                </tr>
                <tr>
                  <td>Performance/Analytics*</td>
                  <td>_ga, _gid (if enabled)</td>
                  <td>Usage metrics to improve Services</td>
                  <td>Session to 24 months</td>
                </tr>
                <tr>
                  <td>Security/Fraud*</td>
                  <td>__cf_bm (if enabled)</td>
                  <td>Bot mitigation, edge security</td>
                  <td>&lt; 30 days</td>
                </tr>
                <tr>
                  <td>Marketing*</td>
                  <td>Ad pixels/cookies (if enabled)</td>
                  <td>Measure/limit ads, retargeting</td>
                  <td>Varies</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[#a0a0a0] text-xs">
            *Third-party tools are used only if enabled in our stack and may change over time.
          </p>

          <h4 className="text-white font-semibold mt-2">Your choices</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Manage non-essential cookies via available in-app settings (where provided).</li>
            <li>Use your browser settings to block or delete cookies (may affect functionality).</li>
            <li>For Google Analytics (if enabled), use Google’s opt-out tools.</li>
            <li>We honor applicable Global Privacy Control/Do Not Track signals where required.</li>
          </ul>

          <h4 className="text-white font-semibold mt-2">Legal bases (EEA/UK)</h4>
          <p>
            Strictly necessary cookies rely on legitimate interests; others rely on your consent, which you can withdraw
            at any time through available controls.
          </p>

          <h4 className="text-white font-semibold mt-2">California (CCPA/CPRA)</h4>
          <p>
            We do not “sell” personal information. If marketing cookies are enabled, some may constitute “sharing” for
            cross-context behavioral advertising. You can exercise your rights via available preference controls.
          </p>

          <h4 className="text-white font-semibold mt-2">Retention &amp; updates</h4>
          <p>
            Cookie data persists for the durations above unless you delete it earlier. We may update this Policy, and
            changes will be posted here with an updated date.
          </p>

          <h4 className="text-white font-semibold mt-2">Contact</h4>
          <p>Questions? Contact <a href="mailto:support@ursus.ai" className="text-[#d8e9ea] underline">support@ursus.ai</a>.</p>
        </div>
      </div>
    </div>
  );
}
function SecurityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[92vw] max-w-3xl bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="text-white text-lg font-semibold">Security</h3>
          <button onClick={onClose} className="p-2 text-[#a0a0a0] hover:text-white" aria-label="Close">
            {/* küçük X - inline svg, ekstra import gerekmez */}
            <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current text-[#a0a0a0]">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto text-sm leading-6 text-[#e5e5e5] space-y-4">
          <p><strong>Last updated:</strong> 15 Aug 2025</p>

          <p>
            At <strong>UrsusAI</strong>, we prioritize the security of our users, infrastructure, and smart contracts.
            This Security Notice summarizes our current practices and your responsibilities when using the platform.
          </p>

          <h4 className="text-white font-semibold mt-2">Infrastructure & Data</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Hardened cloud environments with network segmentation and least-privilege IAM.</li>
            <li>Encryption in transit (TLS) and at rest for supported data stores.</li>
            <li>Backups and disaster recovery procedures for critical systems.</li>
            <li>Continuous logging & monitoring for anomaly detection.</li>
          </ul>

          <h4 className="text-white font-semibold mt-2">Smart Contracts & Web3</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>On-chain interactions are immutable and public—always verify contract addresses.</li>
            <li>Independent audits and formal reviews may be performed before major releases.</li>
            <li>Bug bounty / responsible disclosure channel available (see “Report a Vulnerability”).</li>
          </ul>

          <h4 className="text-white font-semibold mt-2">AI & Application Security</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Dependency management with routine updates and vulnerability scanning.</li>
            <li>Secrets kept outside source control; no private keys are ever requested by UrsusAI.</li>
            <li>Role-based access and least-privilege for sensitive operational tools.</li>
          </ul>

          <h4 className="text-white font-semibold mt-2">Authentication & Accounts</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Support for wallet-based authentication; never share seed phrases or private keys.</li>
            <li>Optional MFA/2FA for supported accounts where applicable.</li>
          </ul>

          <h4 className="text-white font-semibold mt-2">Your Responsibilities</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Secure your wallet, devices, and API keys; beware of phishing.</li>
            <li>Verify URLs and contract addresses; use official sources.</li>
            <li>Understand risks of interacting with AI Agents and tokenized assets.</li>
          </ul>

          <h4 className="text-white font-semibold mt-2">Report a Vulnerability</h4>
          <p>
            If you discover a security issue, please email
            {' '}<a href="mailto:security@ursus.ai" className="text-[#d8e9ea] underline">security@ursus.ai</a>{' '}
            with details and steps to reproduce. We appreciate responsible disclosure and will work to address valid reports promptly.
          </p>

          <h4 className="text-white font-semibold mt-2">Changes</h4>
          <p>
            We may update this notice periodically. Material changes will be reflected here with an updated date.
          </p>
        </div>
      </div>
    </div>
  );
}
function PrivacyPolicyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[92vw] max-w-3xl bg-[#111] border border-[#2a2a2a] rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h3 className="text-white text-lg font-semibold">Privacy Policy</h3>
          <button onClick={onClose} className="p-2 text-[#a0a0a0] hover:text-white" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current text-[#a0a0a0]">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto text-sm leading-6 text-[#e5e5e5] space-y-4">
          <p><strong>Last updated:</strong> 15 Aug 2025</p>

          <p>
            This Privacy Policy explains how <strong>UrsusAI</strong> (“we”, “us”, “our”) collects, uses, and protects
            your information when you use the UrsusAI Platform and Services.
          </p>

          <h4 className="text-white font-semibold mt-2">1. Information We Collect</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Wallet data:</strong> public addresses, on-chain interactions relevant to the platform.</li>
            <li><strong>Usage data:</strong> pages visited, feature interactions, diagnostics, crash logs.</li>
            <li><strong>Optional data:</strong> email, social links (Twitter/Discord/GitHub) if you provide them.</li>
            <li><strong>Cookies & similar:</strong> see our Cookie Policy for details.</li>
          </ul>

          <h4 className="text-white font-semibold mt-2">2. How We Use Information</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Operate and improve the platform and Services.</li>
            <li>Provide features such as profiles, notifications, and agent analytics.</li>
            <li>Security, fraud prevention, and compliance.</li>
            <li>Communications about updates, features, and support (where permitted).</li>
          </ul>

          <h4 className="text-white font-semibold mt-2">3. Legal Bases</h4>
          <p>
            Where applicable (e.g., EEA/UK), we process data based on performance of a contract, legitimate interests,
            legal obligations, and consent (for optional features/marketing).
          </p>

          <h4 className="text-white font-semibold mt-2">4. Sharing & Disclosure</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Service providers (infrastructure, analytics, customer support) under contractual safeguards.</li>
            <li>Legal requests and enforcement where required by law.</li>
            <li>Mergers, acquisitions, or reorganization, subject to continued protection of personal data.</li>
            <li>Public blockchain data is inherently public and outside our control.</li>
          </ul>

          <h4 className="text-white font-semibold mt-2">5. International Transfers</h4>
          <p>
            Data may be processed globally. Where required, we use appropriate safeguards (e.g., SCCs) for transfers.
          </p>

          <h4 className="text-white font-semibold mt-2">6. Data Retention</h4>
          <p>
            We retain information only as long as necessary for the purposes described or as required by law. You may
            request deletion subject to legal/operational constraints.
          </p>

          <h4 className="text-white font-semibold mt-2">7. Your Rights</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access, correction, deletion, portability (subject to jurisdiction).</li>
            <li>Object or restrict certain processing.</li>
            <li>Withdraw consent where processing relies on consent.</li>
            <li>To exercise rights, contact: <a href="mailto:privacy@ursus.ai" className="text-[#d8e9ea] underline">privacy@ursus.ai</a></li>
          </ul>

          <h4 className="text-white font-semibold mt-2">8. Children</h4>
          <p>
            The Services are not directed to children under the age required by local law. Do not use the platform if
            you do not meet the minimum age.
          </p>

          <h4 className="text-white font-semibold mt-2">9. Security</h4>
          <p>
            We implement technical and organizational measures to protect information. No method of transmission or
            storage is 100% secure. See our Security notice for more details.
          </p>

          <h4 className="text-white font-semibold mt-2">10. Cookies</h4>
          <p>
            We use cookies and similar technologies. For details and choices, see the Cookie Policy.
          </p>

          <h4 className="text-white font-semibold mt-2">11. Changes</h4>
          <p>
            We may update this Policy periodically. Material changes will be reflected here with an updated date.
          </p>

          <h4 className="text-white font-semibold mt-2">12. Contact</h4>
          <p>
            Questions? Contact <a href="mailto:privacy@ursus.ai" className="text-[#d8e9ea] underline">privacy@ursus.ai</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
