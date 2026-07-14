/**
 * GetSales4Now — Landing Page
 * Nova copy focada em benefícios: "Pare de perder clientes por não responder rápido"
 */
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, ArrowRight, MessageSquare, Clock, Users,
  Zap, Phone, Calendar, TrendingUp, Star, Shield,
  ChevronRight, Play, Bot, Repeat2,
  HeadphonesIcon, Building2, Sparkles,
} from "lucide-react";

// ─── Planos ───────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "basic",
    name: "Basic",
    tagline: "Pare de perder clientes e responda na hora",
    setupFee: 120,
    price: 118,
    url: "https://getsales4now-cu7el4pz.manus.space/purchase/growth",
    highlight: false,
    cta: "Começar com Basic",
    benefits: [
      "Respostas automáticas para seus clientes (24h)",
      "Todas as mensagens em um só lugar (WhatsApp e SMS)",
      "Follow-up automático para não perder clientes",
      "Ligações direto do sistema",
      "Organização simples dos seus clientes",
      "Agenda e calendário configurado automático ou manual",
      "Publicação nas mídias sociais",
      "Tudo configurado para você — sem precisar de tecnologia",
    ],
  },
  {
    id: "business",
    name: "Business",
    tagline: "Organize, automatize e escale — sem perder oportunidades",
    setupFee: 250,
    price: 248,
    url: "https://getsales4now-cu7el4pz.manus.space/purchase",
    highlight: true,
    cta: "Começar com Business",
    benefits: [
      "Gerencie todos seus clientes em um só lugar (WhatsApp, SMS, Mídias Sociais e mais)",
      "Até 5 números de WhatsApp — Voz e texto para sua equipe",
      "Respostas automáticas + conversas automatizadas avançadas",
      "Sistema de agenda e agendamento personalizado",
      "Follow-ups automáticos para aumentar conversões",
      "Pipeline de vendas com controle total",
      "Chamadas de vídeo integradas com clientes",
      "Plataforma de treinamento para equipe ou clientes",
      "Acesso para múltiplos usuários",
      "Tudo configurado e pronto para uso",
    ],
  },
];

// ─── Depoimentos ──────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    name: "Carlos Mendes",
    role: "Corretor de Imóveis",
    country: "🇧🇷 Brasil",
    text: "Antes eu perdia clientes porque demorava para responder. Agora o sistema responde na hora e eu só entro na conversa quando o cliente já está quente.",
    stars: 5,
  },
  {
    name: "Ana Luiza Ferreira",
    role: "Clínica de Estética",
    country: "🇧🇷 Brasil",
    text: "Minha agenda encheu em 2 semanas. O sistema agenda automaticamente e ainda manda lembrete pro cliente. Não perco mais consulta por esquecimento.",
    stars: 5,
  },
  {
    name: "Roberto Silva",
    role: "Agência de Marketing",
    country: "🇲🇽 México",
    text: "Gerencio 12 clientes com a equipe inteira no mesmo sistema. Cada um vê só o que precisa. Economizei 3 ferramentas diferentes.",
    stars: 5,
  },
];

// ─── Problemas que resolvemos ─────────────────────────────────────────────────
const PROBLEMS = [
  {
    icon: <Clock className="w-6 h-6" />,
    problem: "Cliente manda mensagem e você demora para responder",
    solution: "Resposta automática imediata — 24h por dia, 7 dias por semana",
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    problem: "Mensagens espalhadas em WhatsApp, Instagram, e-mail...",
    solution: "Tudo centralizado em um único lugar — sem perder nada",
  },
  {
    icon: <Repeat2 className="w-6 h-6" />,
    problem: "Clientes somem e você esquece de fazer o follow-up",
    solution: "Follow-up automático que traz o cliente de volta sem esforço",
  },
  {
    icon: <Calendar className="w-6 h-6" />,
    problem: "Agenda bagunçada e clientes faltando em compromissos",
    solution: "Agendamento automático com lembretes que reduzem faltas em 80%",
  },
];

// ─── Como funciona ────────────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  { n: "1", label: "Escolha seu plano", desc: "Basic ou Business — de acordo com o tamanho do seu negócio" },
  { n: "2", label: "Nós configuramos tudo", desc: "Nossa equipe monta e personaliza o sistema para você" },
  { n: "3", label: "Seu sistema entra no ar", desc: "Em até 48h seu sistema está funcionando e respondendo clientes" },
  { n: "4", label: "Você vende mais", desc: "Enquanto o sistema trabalha, você foca no que importa: fechar negócios" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">

      {/* ─── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">GS</div>
            <span className="text-white font-bold text-xl">GetSales4Now</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-white/60">
            <a href="#como-funciona" className="hover:text-white transition-colors">Como funciona</a>
            <a href="#planos" className="hover:text-white transition-colors">Planos</a>
            <a href="#depoimentos" className="hover:text-white transition-colors">Resultados</a>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://app.getsales4now.com/?url=%252Fagency_launchpad" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">Entrar</Button>
            </a>
            <a href="https://getsales4now-cu7el4pz.manus.space/purchase" target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold shadow-lg shadow-orange-500/20">
                Começar agora <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
        </div>
      </nav>

      {/* ─── HERO ────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-2 text-orange-400 text-sm font-medium mb-8">
            <Bot className="w-4 h-4" />
            Assistente de atendimento e vendas — 24h por dia, 7 dias por semana
          </div>

          <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
            Pare de perder clientes<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
              por não responder rápido
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-white/70 mb-4 max-w-2xl mx-auto leading-relaxed">
            Nós configuramos um sistema simples que responde seus clientes automaticamente enquanto você trabalha.
          </p>
          <p className="text-lg text-white/50 mb-10 max-w-xl mx-auto">
            Sem precisar mexer em tecnologia. Sem contratar mais funcionários. Sem perder oportunidades.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <a href="https://getsales4now-cu7el4pz.manus.space/purchase" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-lg rounded-2xl shadow-2xl shadow-orange-500/30">
                Quero meu sistema agora <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
            <a href="#como-funciona">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 border-white/20 text-white hover:bg-white/5 rounded-2xl text-lg">
                <Play className="w-5 h-5 mr-2 text-orange-400" /> Ver como funciona
              </Button>
            </a>
            <a href="https://getsales4now-cu7el4pz.manus.space/consultation" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 border-white/20 text-white hover:bg-white/5 rounded-2xl text-lg">
                <Calendar className="w-5 h-5 mr-2 text-orange-400" /> Agende uma consulta
              </Button>
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/40">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-green-400" /> Sem contrato de fidelidade</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400" /> Configuração incluída</span>
            <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-orange-400" /> Funcionando em até 48h</span>
            <span className="flex items-center gap-1.5"><HeadphonesIcon className="w-4 h-4 text-blue-400" /> Suporte em português</span>
          </div>
        </div>
      </section>

      {/* ─── PROBLEMAS QUE RESOLVEMOS ────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Reconhece algum desses problemas?</h2>
            <p className="text-white/50 text-lg">Se sim, o GetSales4Now foi feito para você.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {PROBLEMS.map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-orange-500/30 transition-all">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-white/40 text-sm mb-2 line-through">{item.problem}</p>
                    <p className="text-white font-semibold flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      {item.solution}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── COMO FUNCIONA ───────────────────────────────────────────────── */}
      <section id="como-funciona" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simples assim — em 4 passos</h2>
            <p className="text-white/50 text-lg">Você não precisa entender de tecnologia. Nós cuidamos de tudo.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="text-center relative">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] right-[-50%] h-px bg-gradient-to-r from-orange-500/40 to-transparent" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-black text-2xl mx-auto mb-4 shadow-xl shadow-orange-500/20">
                  {step.n}
                </div>
                <h3 className="font-bold text-white mb-2">{step.label}</h3>
                <p className="text-white/50 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BENEFÍCIOS VISUAIS ──────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">O que muda na sua empresa</h2>
            <p className="text-white/50 text-lg">Resultados reais que nossos clientes já estão vivendo</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Bot className="w-8 h-8" />, title: "Atendimento 24/7", desc: "Seu negócio responde clientes às 3h da manhã, no fim de semana, no feriado — sem você precisar estar online.", color: "orange" },
              { icon: <MessageSquare className="w-8 h-8" />, title: "Zero mensagem perdida", desc: "WhatsApp, SMS, Instagram, Facebook — tudo em um único lugar. Nenhum cliente fica sem resposta.", color: "blue" },
              { icon: <Repeat2 className="w-8 h-8" />, title: "Follow-up automático", desc: "O sistema lembra automaticamente dos clientes que não responderam. Você recupera vendas que perderia.", color: "green" },
              { icon: <Calendar className="w-8 h-8" />, title: "Agenda cheia", desc: "Clientes agendam sozinhos, recebem lembretes e confirmam. Faltas caem até 80%.", color: "purple" },
              { icon: <TrendingUp className="w-8 h-8" />, title: "Pipeline de vendas", desc: "Veja exatamente onde cada cliente está no processo de compra. Sem surpresas, sem perder negócios.", color: "yellow" },
              { icon: <Users className="w-8 h-8" />, title: "Equipe alinhada", desc: "Toda a equipe no mesmo sistema. Cada um vê o que precisa. Sem duplicar contatos ou perder histórico.", color: "red" },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
                <div className={`w-14 h-14 rounded-xl mb-4 flex items-center justify-center ${
                  item.color === "orange" ? "bg-orange-500/10 text-orange-400" :
                  item.color === "blue" ? "bg-blue-500/10 text-blue-400" :
                  item.color === "green" ? "bg-green-500/10 text-green-400" :
                  item.color === "purple" ? "bg-purple-500/10 text-purple-400" :
                  item.color === "yellow" ? "bg-yellow-500/10 text-yellow-400" :
                  "bg-red-500/10 text-red-400"
                }`}>
                  {item.icon}
                </div>
                <h3 className="font-bold text-white text-lg mb-2">{item.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PLANOS ──────────────────────────────────────────────────────── */}
      <section id="planos" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Escolha o plano certo para você</h2>
            <p className="text-white/50 text-lg">Sem contrato de fidelidade. Cancele quando quiser.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {PLANS.map((plan) => (
              <div key={plan.id} className={`relative rounded-3xl p-8 border transition-all ${
                plan.highlight
                  ? "bg-gradient-to-b from-orange-500/10 to-red-600/5 border-orange-500/40 shadow-2xl shadow-orange-500/10"
                  : "bg-white/5 border-white/10 hover:border-white/20"
              }`}>
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                    MAIS COMPLETO
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-2xl font-black text-white mb-2">{plan.name}</h3>
                  <p className="text-white/60 text-sm mb-4">{plan.tagline}</p>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-black text-white">US$ {plan.price}</span>
                    <span className="text-white/40">/mês</span>
                  </div>
                  <p className="text-white/40 text-xs">+ US$ {plan.setupFee} taxa de configuração (única vez)</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.benefits.map((b, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                <a href={plan.url} target="_blank" rel="noopener noreferrer">
                  <Button className={`w-full h-12 font-bold rounded-xl ${
                    plan.highlight
                      ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white shadow-xl shadow-orange-500/30"
                      : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  }`}>
                    {plan.cta} <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </a>
              </div>
            ))}
          </div>
          <p className="text-center text-white/30 text-sm mt-8">
            Precisa de algo maior?{" "}
            <a href="mailto:contato@getsales4now.agency" className="text-orange-400 hover:underline">
              Fale com nossa equipe
            </a>{" "}
            sobre planos corporativos.
          </p>
        </div>
      </section>

      {/* ─── DEPOIMENTOS ─────────────────────────────────────────────────── */}
      <section id="depoimentos" className="py-20 px-4 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Quem já usa, não quer mais voltar atrás</h2>
            <p className="text-white/50 text-lg">Resultados reais de clientes reais</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, s) => (
                    <Star key={s} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{t.name}</p>
                    <p className="text-white/40 text-xs">{t.role} · {t.country}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ───────────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-orange-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl md:text-5xl font-black mb-6 leading-tight">
            Cada minuto sem responder<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
              é um cliente indo para o concorrente
            </span>
          </h2>
          <p className="text-white/60 text-lg mb-10 max-w-xl mx-auto">
            Comece hoje. Nossa equipe configura tudo para você. Em até 48h seu sistema está funcionando — respondendo, agendando e vendendo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://getsales4now-cu7el4pz.manus.space/purchase" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="w-full sm:w-auto h-14 px-10 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-lg rounded-2xl shadow-2xl shadow-orange-500/30">
                Quero começar agora <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
            <a href="https://getsales4now-cu7el4pz.manus.space/purchase" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-10 border-white/20 text-white hover:bg-white/5 rounded-2xl text-lg">
                Ver plano Business <ChevronRight className="w-5 h-5 ml-1" />
              </Button>
            </a>
            <a href="https://getsales4now-cu7el4pz.manus.space/consultation" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-10 border-white/20 text-white hover:bg-white/5 rounded-2xl text-lg">
                <Calendar className="w-5 h-5 mr-2" /> Agende uma consulta
              </Button>
            </a>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-white/30">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> Sem fidelidade</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Configuração incluída</span>
            <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> Suporte em português</span>
            <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" /> Para qualquer negócio</span>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-xs">GS</div>
            <span className="text-white/60 text-sm">GetSales4Now — Assistente de vendas 24/7</span>
          </div>
          <div className="flex gap-6 text-sm text-white/30">
            <Link href="/termos"><span className="hover:text-white/60 cursor-pointer transition-colors">Termos de Uso</span></Link>
            <Link href="/privacidade"><span className="hover:text-white/60 cursor-pointer transition-colors">Privacidade</span></Link>
            <a href="https://app.getsales4now.com/?url=%252Fagency_launchpad" target="_blank" rel="noopener noreferrer"><span className="hover:text-white/60 cursor-pointer transition-colors">Entrar</span></a>
          </div>
        </div>
      </footer>

    </div>
  );
}
