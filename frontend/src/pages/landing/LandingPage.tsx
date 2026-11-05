import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  Trash2,
  Lock,
  Database,
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Globe,
  Bell,
  History,
  LayoutDashboard,
  ShieldCheck,
  KeyRound,
  FileCheck2,
  ChevronRight,
  Sparkles,
  BarChart3,
  Fingerprint,
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { PrivacyShield3D } from '../../components/landing/PrivacyShield3D';
import { Card3D } from '../../components/landing/Card3D';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col selection:bg-electric-600 selection:text-white antialiased overflow-x-hidden">
      <Navbar />

      {/* SECTION 2 – HERO */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 pb-20 sm:pb-28 px-4 sm:px-6 lg:px-8">
        {/* Subtle Cyber Ambient Lighting */}
        <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-electric-600/15 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[350px] h-[280px] bg-cyan-500/10 blur-[110px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-navy-900/90 border border-electric-500/30 text-electric-400 text-xs font-mono shadow-glow-purple">
              <Sparkles className="w-3.5 h-3.5 text-electric-400 animate-pulse" />
              <span>The Internet's Forget Button.</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
              TAKE CONTROL OF YOUR{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric-400 via-purple-300 to-cyan-400">
                DIGITAL FOOTPRINT.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Your personal information is scattered across websites and online platforms.
              OBLIVION gives you one secure place to discover, organize, and track your privacy
              exposure and removal requests.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Button
                size="lg"
                onClick={() => navigate('/register')}
                rightIcon={<ArrowRight className="w-5 h-5" />}
                className="w-full sm:w-auto text-sm sm:text-base px-8 py-3.5 shadow-glow-purple"
              >
                Get Started Free
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/login')}
                className="w-full sm:w-auto text-sm sm:text-base px-8 py-3.5 border-navy-700 hover:border-slate-500"
              >
                Sign In
              </Button>
            </div>
          </div>

          {/* Hero Right 3D Visual */}
          <div className="lg:col-span-5 flex items-center justify-center relative">
            <PrivacyShield3D className="w-full max-w-[460px]" />
          </div>
        </div>
      </section>

      {/* SECTION 3 – THE PROBLEM */}
      <section className="py-20 border-y border-navy-800/80 bg-navy-900/40 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-100 mb-4 tracking-tight">
              Your Personal Data Is Everywhere. Tracking It Is Broken.
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Without a centralized management platform, individuals face an uphill battle
              keeping track of where personal information is stored and how to exercise their privacy rights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-navy-900/80 border-navy-750 p-6 flex flex-col justify-between">
              <div>
                <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 w-fit mb-4">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-100 mb-2">Unchecked Data Exposure</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Online platforms and data brokers may retain personal information across multiple services,
                  accumulating composite records without continuous visibility or direct oversight.
                </p>
              </div>
            </Card>

            <Card className="bg-navy-900/80 border-navy-750 p-6 flex flex-col justify-between">
              <div>
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 w-fit mb-4">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-100 mb-2">Fragmented Removal Process</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tracking deletion requests across different platforms can be difficult. Varying requirements,
                  differing legal windows, and disparate contact points cause requests to stall.
                </p>
              </div>
            </Card>

            <Card className="bg-navy-900/80 border-navy-750 p-6 flex flex-col justify-between">
              <div>
                <div className="p-3 rounded-2xl bg-electric-500/10 text-electric-400 border border-electric-500/20 w-fit mb-4">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-100 mb-2">No Centralized Visibility</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Users need a central place to track exposure, removal progress, and recorded actions.
                  Having scattered notes or emails leads to abandoned follow-ups and incomplete removals.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* SECTION 4 – FEATURES */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-100 mb-4 tracking-tight">
              Everything You Need to Manage Your Digital Privacy.
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Seven purpose-built modules designed to catalog, monitor, and coordinate
              personal data erasure workflows across the modern web.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1: Website Management */}
            <Card3D className="bg-navy-900/90 border border-navy-750 p-6 hover:border-electric-500/40">
              <div className="p-3 rounded-2xl bg-electric-600/15 text-electric-400 border border-electric-500/30 w-fit mb-4">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">Website Management</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track platforms that hold your personal information. Organize domains by industry category
                and maintain an accurate inventory of third-party platforms.
              </p>
            </Card3D>

            {/* Feature 2: Exposure Tracking */}
            <Card3D className="bg-navy-900/90 border border-navy-750 p-6 hover:border-cyan-500/40">
              <div className="p-3 rounded-2xl bg-cyan-600/15 text-cyan-400 border border-cyan-500/30 w-fit mb-4">
                <Eye className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">Exposure Tracking</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Catalog exposed personal information and associated data categories. Track credentials,
                financial data, contact points, and identity attributes.
              </p>
            </Card3D>

            {/* Feature 3: Dynamic Risk Assessment */}
            <Card3D className="bg-navy-900/90 border border-navy-750 p-6 hover:border-amber-500/40">
              <div className="p-3 rounded-2xl bg-amber-600/15 text-amber-400 border border-amber-500/30 w-fit mb-4">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">Dynamic Risk Assessment</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Use backend-generated risk scores based on data category weights and sensitivity. Understand
                which exposures carry the highest risk profile to prioritize action.
              </p>
            </Card3D>

            {/* Feature 4: Removal Request Management */}
            <Card3D className="bg-navy-900/90 border border-navy-750 p-6 hover:border-emerald-500/40">
              <div className="p-3 rounded-2xl bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 w-fit mb-4">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">Removal Request Management</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Create and track erasure requests. Advance requests through structured lifecycles with
                verifiable status milestones from submission through completion.
              </p>
            </Card3D>

            {/* Feature 5: Reminders and Follow-ups */}
            <Card3D className="bg-navy-900/90 border border-purple-500/30 p-6 hover:border-purple-500/40">
              <div className="p-3 rounded-2xl bg-purple-600/15 text-purple-400 border border-purple-500/30 w-fit mb-4">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">Reminders and Follow-ups</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Organize follow-up activities. Schedule reminders for statutory 30-day response windows
                and periodic annual privacy audits.
              </p>
            </Card3D>

            {/* Feature 6: Audit History */}
            <Card3D className="bg-navy-900/90 border border-navy-750 p-6 hover:border-blue-500/40">
              <div className="p-3 rounded-2xl bg-blue-600/15 text-blue-400 border border-blue-500/30 w-fit mb-4">
                <History className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">Audit History</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Review recorded privacy operations. Capture operational logs and export comprehensive
                compliance reports supporting personal data portability.
              </p>
            </Card3D>

            {/* Feature 7: Privacy Dashboard */}
            <Card3D className="bg-navy-900/90 border border-navy-750 p-6 hover:border-electric-500/40 md:col-span-2 lg:col-span-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="p-3 rounded-2xl bg-electric-600/15 text-electric-400 border border-electric-500/30 w-fit shrink-0">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-100 mb-1">Privacy Dashboard</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    View actual tracked records, exposure metrics, and removal progress. High-level
                    aggregations synthesize your security status and pending statutory actions in a unified overview.
                  </p>
                </div>
              </div>
            </Card3D>
          </div>
        </div>
      </section>

      {/* SECTION 5 – HOW IT WORKS */}
      <section id="how-it-works" className="py-24 border-y border-navy-800/80 bg-navy-900/30 px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-100 mb-4 tracking-tight">
              How OBLIVION Puts You in Control.
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              A structured four-step methodology to identify exposures, assert your statutory rights, and monitor resolution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {[
              {
                step: '01',
                title: 'Catalog Websites',
                desc: 'Add platforms that hold your personal information to establish your tracking inventory.',
                icon: Globe,
                color: 'text-electric-400',
              },
              {
                step: '02',
                title: 'Record Exposures',
                desc: 'Identify the types of personal information and data categories associated with each platform.',
                icon: Eye,
                color: 'text-cyan-400',
              },
              {
                step: '03',
                title: 'Create Removal Requests',
                desc: 'Create and track requests based on applicable privacy frameworks such as GDPR Article 17 or CCPA.',
                icon: Trash2,
                color: 'text-emerald-400',
              },
              {
                step: '04',
                title: 'Track and Follow Up',
                desc: 'Monitor request statuses, reminders, and recorded operational audit activities until confirmed purged.',
                icon: CheckCircle2,
                color: 'text-purple-400',
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.step} className="bg-navy-900/90 border-navy-750 p-6 flex flex-col justify-between relative group hover:border-navy-600 transition-colors">
                  <div>
                    <div className="text-3xl font-black text-navy-750 font-mono mb-4 group-hover:text-electric-500/30 transition-colors">
                      {s.step}
                    </div>
                    <div className={`p-2.5 rounded-xl bg-navy-800/80 ${s.color} border border-navy-700 w-fit mb-3.5`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-100 mb-2">{s.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 6 – DASHBOARD PREVIEW */}
      <section id="preview" className="py-24 px-4 sm:px-6 lg:px-8 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-100 mb-4 tracking-tight">
              Your Privacy. One Dashboard.
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              Clear visual hierarchy and transparent metrics giving you instant insight into your privacy posture.
            </p>
          </div>

          {/* Static Illustrative Dashboard Mockup */}
          <div className="p-4 sm:p-8 rounded-3xl bg-navy-900 border border-navy-750/90 shadow-2xl max-w-5xl mx-auto relative overflow-hidden">
            {/* Top Mockup Window Header */}
            <div className="flex items-center justify-between pb-5 border-b border-navy-800 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Illustrative Dashboard Interface
              </div>
            </div>

            {/* 4 Dedicated Illustrative Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Panel 1: Website Inventory */}
              <div className="p-5 rounded-2xl bg-navy-850/70 border border-navy-750 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-electric-600/15 text-electric-400 border border-electric-500/30">
                        <Globe className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-100">Website Inventory</h4>
                    </div>
                    <span className="text-[10px] font-mono text-electric-400 bg-electric-950/80 border border-electric-500/30 px-2 py-0.5 rounded-full">
                      Cataloged
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Organize third-party platforms holding personal data by service domain and industry category.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-navy-900/80 border border-navy-750 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-medium text-slate-200">Social Media Services</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">Monitored</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-navy-900/80 border border-navy-750 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="font-medium text-slate-200">Online Retailers & Marketplaces</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">Monitored</span>
                  </div>
                </div>
              </div>

              {/* Panel 2: Exposure Overview */}
              <div className="p-5 rounded-2xl bg-navy-850/70 border border-navy-750 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-cyan-600/15 text-cyan-400 border border-cyan-500/30">
                        <Eye className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-100">Exposure Overview</h4>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                      Mapped
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Identify and classify exposed personal attributes across standardized privacy categories.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-navy-900/80 border border-navy-750 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-slate-200">Contact & Identity Points</span>
                      <span className="text-[11px] text-cyan-400 font-mono">High Priority</span>
                    </div>
                    <div className="w-full bg-navy-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-cyan-400 h-1.5 rounded-full w-3/4" />
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-navy-900/80 border border-navy-750 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-slate-200">Location & Browsing Metadata</span>
                      <span className="text-[11px] text-purple-400 font-mono">Medium Priority</span>
                    </div>
                    <div className="w-full bg-navy-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-purple-400 h-1.5 rounded-full w-1/2" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel 3: Privacy Risk Overview */}
              <div className="p-5 rounded-2xl bg-navy-850/70 border border-navy-750 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-amber-600/15 text-amber-400 border border-amber-500/30">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-100">Privacy Risk Overview</h4>
                    </div>
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 border border-amber-500/30 px-2 py-0.5 rounded-full">
                      Dynamic Score
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Synthesize data category weights and sensitivity levels into an actionable risk assessment.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-navy-900/80 border border-navy-750 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400">Illustrative Risk Index</div>
                    <div className="text-lg font-bold text-slate-100 font-mono mt-0.5">Calculated Rating</div>
                    <div className="text-[10px] text-amber-400 mt-0.5">Weighted by exposure severity</div>
                  </div>
                  <div className="text-right">
                    <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-semibold">
                      Action Recommended
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel 4: Removal Request Progress */}
              <div className="p-5 rounded-2xl bg-navy-850/70 border border-navy-750 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-600/15 text-emerald-400 border border-emerald-500/30">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-100">Removal Request Progress</h4>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      Pipeline
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Track statutory erasure requests from draft through acknowledgment, execution, and confirmation.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-navy-900/80 border border-navy-750">
                    <div className="text-[10px] text-slate-400">Step 1</div>
                    <div className="font-semibold text-slate-200 mt-0.5">Submitted</div>
                    <div className="text-[9px] text-electric-400 mt-0.5">Request Sent</div>
                  </div>
                  <div className="p-2 rounded-xl bg-navy-900/80 border border-navy-750">
                    <div className="text-[10px] text-slate-400">Step 2</div>
                    <div className="font-semibold text-slate-200 mt-0.5">In Progress</div>
                    <div className="text-[9px] text-amber-400 mt-0.5">Processing</div>
                  </div>
                  <div className="p-2 rounded-xl bg-navy-900/80 border border-navy-750">
                    <div className="text-[10px] text-slate-400">Step 3</div>
                    <div className="font-semibold text-slate-200 mt-0.5">Completed</div>
                    <div className="text-[9px] text-emerald-400 mt-0.5">Data Purged</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7 – SECURITY ARCHITECTURE */}
      <section id="security" className="py-24 px-4 sm:px-6 lg:px-8 border-t border-navy-800/80 bg-navy-900/20 scroll-mt-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-4xl font-bold text-slate-100 mb-4 tracking-tight">
              Security Built Into Every Layer.
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              We implement industry-standard cybersecurity practices to ensure your private records
              remain strictly isolated and accessible only to you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-navy-900/90 border-navy-750 p-6">
              <div className="p-3 rounded-2xl bg-electric-600/15 text-electric-400 border border-electric-500/30 w-fit mb-4">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">JWT Authentication</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cryptographically signed JSON Web Tokens authenticate every API interaction,
                strictly binding sessions to verified user accounts.
              </p>
            </Card>

            <Card className="bg-navy-900/90 border-navy-750 p-6">
              <div className="p-3 rounded-2xl bg-cyan-600/15 text-cyan-400 border border-cyan-500/30 w-fit mb-4">
                <Fingerprint className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">Password Hashing</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Credentials are salted and hashed using bcrypt. Plaintext passwords are never
                persisted in the database or written to logs.
              </p>
            </Card>

            <Card className="bg-navy-900/90 border-navy-750 p-6">
              <div className="p-3 rounded-2xl bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 w-fit mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">Tenant-Scoped Access</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                All database operations enforce strict tenant scoping, ensuring complete privacy
                isolation between user records.
              </p>
            </Card>

            <Card className="bg-navy-900/90 border-navy-750 p-6">
              <div className="p-3 rounded-2xl bg-purple-600/15 text-purple-400 border border-purple-500/30 w-fit mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">Ownership Validation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every operation verifies that records belong to the authenticated account before any
                modifications or related entries are committed.
              </p>
            </Card>

            <Card className="bg-navy-900/90 border-navy-750 p-6">
              <div className="p-3 rounded-2xl bg-blue-600/15 text-blue-400 border border-blue-500/30 w-fit mb-4">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">Parameterized Queries</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                All database queries use parameterized execution, protecting data retrieval
                and updates against SQL injection vulnerabilities.
              </p>
            </Card>

            <Card className="bg-navy-900/90 border-navy-750 p-6">
              <div className="p-3 rounded-2xl bg-rose-600/15 text-rose-400 border border-rose-500/30 w-fit mb-4">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">Audit Event Recording</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Critical lifecycle events—including sign-ins, exposure additions, and removal requests—are
                recorded in an activity history log.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* SECTION 8 – FINAL CTA */}
      <section className="py-24 border-t border-navy-800/80 bg-gradient-to-b from-navy-900/70 to-navy-950 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10 space-y-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Ready to Reclaim Your Digital Privacy?
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Start organizing your online exposure and managing your privacy removal requests in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              size="lg"
              onClick={() => navigate('/register')}
              rightIcon={<ChevronRight className="w-5 h-5" />}
              className="w-full sm:w-auto px-8 py-3.5 text-base shadow-glow-purple"
            >
              Create Account
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-8 py-3.5 text-base border-navy-700 hover:border-slate-500"
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* SECTION 9 – FOOTER */}
      <Footer />
    </div>
  );
};
