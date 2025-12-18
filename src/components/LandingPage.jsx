import React from 'react';
import {
  Trophy,
  BarChart3,
  Users,
  Zap,
  CheckCircle,
  QrCode,
  FileSpreadsheet,
  PieChart,
  ArrowRight,
  Sparkles,
  Globe,
  Lock,
  Smartphone
} from 'lucide-react';

const LandingPage = ({ onLogin }) => {
  const features = [
    {
      icon: Trophy,
      title: "Yarışma",
      description: "Gerçek zamanlı bilgi yarışmaları düzenleyin. Skor tablosu ve anlık sonuçlar.",
      color: "from-amber-500 to-orange-600",
      bgColor: "bg-amber-50"
    },
    {
      icon: BarChart3,
      title: "Anket",
      description: "Hızlı anketler oluşturun, canlı oy takibi yapın. Sonuçları anında görün.",
      color: "from-emerald-500 to-teal-600",
      bgColor: "bg-emerald-50"
    },
    {
      icon: Zap,
      title: "Quiz",
      description: "Eğitim amaçlı quizler hazırlayın. Öğrenci başarısını takip edin.",
      color: "from-violet-500 to-purple-600",
      bgColor: "bg-violet-50"
    },
    {
      icon: FileSpreadsheet,
      title: "Sınav",
      description: "Çoktan seçmeli ve açık uçlu sorularla kapsamlı sınavlar oluşturun.",
      color: "from-rose-500 to-pink-600",
      bgColor: "bg-rose-50"
    }
  ];

  const highlights = [
    { icon: QrCode, text: "QR Kod ile Kolay Katılım" },
    { icon: Smartphone, text: "Mobil Uyumlu Tasarım" },
    { icon: Globe, text: "Anlık Senkronizasyon" },
    { icon: Lock, text: "Güvenli Altyapı" },
    { icon: PieChart, text: "Detaylı Analiz ve Raporlar" },
    { icon: Users, text: "Sınırsız Katılımcı" }
  ];

  return (
    <div className="h-full w-full bg-[#0a0a0f] text-white overflow-hidden flex flex-col">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Animated Background */}
        {/* Animated Background - Simplified for Mobile Performance */}
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-transparent to-purple-950/50" />
          {/* Heavy blur effects removed for mobile stability 
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-600/10 rounded-full blur-3xl" />
        */}
        </div>

        {/* Header */}
        <header className="relative z-10 border-b border-white/10 backdrop-blur-xl shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 sm:h-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Trophy size={22} className="text-white" />
                </div>
                <span className="text-xl sm:text-2xl font-black tracking-tight">
                  Open<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Quiz</span>
                </span>
              </div>

              <button
                onClick={onLogin}
                className="group px-4 sm:px-6 py-2.5 bg-white text-slate-900 rounded-full font-bold text-sm hover:bg-indigo-100 transition-all shadow-lg shadow-white/20 flex items-center gap-2"
              >
                <span className="hidden sm:inline">Giriş Yap</span>
                <span className="sm:hidden">Giriş</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative z-10 pt-16 sm:pt-24 lg:pt-32 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm text-indigo-300 border border-indigo-500/30 mb-6 sm:mb-8">
              <Sparkles size={16} />
              <span>Ücretsiz & Açık Kaynak</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight mb-6 sm:mb-8">
              <span className="block">Etkileşimli</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                Yarışma & Anket
              </span>
              <span className="block">Platformu</span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 sm:mb-12 leading-relaxed">
              Yarışmalar, anketler, quizler ve sınavlar oluşturun.
              <br className="hidden sm:block" />
              Katılımcılar QR kod ile anında bağlansın. Sonuçları canlı takip edin.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onLogin}
                className="group px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl font-bold text-lg hover:from-indigo-600 hover:to-purple-700 transition-all shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-3"
              >
                Hemen Başla
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <a
                href="#features"
                className="px-8 py-4 border-2 border-white/20 rounded-2xl font-bold text-lg hover:bg-white/10 transition-all flex items-center justify-center gap-3"
              >
                Özellikleri Keşfet
              </a>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        < section id="features" className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 lg:px-8" >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 sm:mb-6">
                Her İhtiyaca <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Özel Çözümler</span>
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Eğitimden eğlenceye, toplantılardan konferanslara kadar her ortamda kullanın
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 sm:p-8 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-2"
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                    <feature.icon size={26} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section >

        {/* Highlights */}
        < section className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-y border-white/10" >
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
              {highlights.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center text-center p-4 sm:p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-3 border border-indigo-500/30">
                    <item.icon size={24} className="text-indigo-400" />
                  </div>
                  <span className="text-sm font-medium text-slate-300">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section >

        {/* How it Works */}
        < section className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 lg:px-8" >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 sm:mb-6">
                Nasıl <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Çalışır?</span>
              </h2>
              <p className="text-slate-400 text-lg">3 kolay adımda etkileşimli deneyimler yaratın</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: "01", title: "Oluşturun", desc: "Yarışma, anket, quiz veya sınav oluşturun. Sorularınızı ekleyin." },
                { step: "02", title: "Paylaşın", desc: "QR kodu veya linki katılımcılarla paylaşın. Giriş yapmalarına gerek yok." },
                { step: "03", title: "Takip Edin", desc: "Canlı sonuçları izleyin. Analiz raporlarını indirin." }
              ].map((item, index) => (
                <div key={index} className="relative">
                  <div className="text-7xl sm:text-8xl font-black text-white/5 absolute -top-4 -left-2">{item.step}</div>
                  <div className="relative pt-8 sm:pt-12">
                    <h3 className="text-2xl font-bold mb-3">{item.title}</h3>
                    <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section >

        {/* CTA Section */}
        < section className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 lg:px-8" >
          <div className="max-w-4xl mx-auto">
            <div className="relative bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 sm:p-12 lg:p-16 text-center overflow-hidden">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

              <div className="relative z-10">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 sm:mb-6">
                  Hemen Ücretsiz Başlayın
                </h2>
                <p className="text-lg text-indigo-100 max-w-2xl mx-auto mb-8 sm:mb-10">
                  Kredi kartı gerektirmez. Sınırsız yarışma, anket ve quiz oluşturun.
                  Binlerce kullanıcı zaten Open Quiz ile etkileşimli etkinlikler düzenliyor.
                </p>

                <button
                  onClick={onLogin}
                  className="group inline-flex items-center gap-3 px-8 sm:px-10 py-4 sm:py-5 bg-white text-indigo-600 rounded-2xl font-bold text-lg hover:bg-indigo-50 transition-all shadow-xl"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google ile Giriş Yap
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </section >

        {/* Footer */}
        {/* Footer */}
        <footer className="relative z-10 border-t border-white/10 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Trophy size={16} className="text-white" />
              </div>
              <span className="font-bold">OpenQuiz</span>
            </div>
            <p className="text-slate-500 text-sm">© 2024 Open Quiz. Tüm hakları saklıdır.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
