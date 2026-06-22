import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  Check, X, Zap, Building2, Globe, ArrowRight, Shield, Phone, Star, BarChart3
} from "lucide-react";
import { getLoginUrl } from "@/const";

// ─── Plan data ────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "basic" as const,
    name: "Basic",
    tagline: "Pare de perder clientes e responda na hora — sem precisar mexer em tecnologia.",
    price: 118,
    setupFee: 120,
    yearlyPrice: Math.round(118 * 12 * 0.8),
    highlighted: false,
    contactSales: false,
    badge: null as string | null,
    color: "orange" as const,
    idealFor: "Profissionais autônomos, pequenos negócios e prestadores de serviço que querem atender melhor sem contratar mais.",
    features: [
      "Respostas automáticas para seus clientes (24h)",
      "Todas as mensagens em um só lugar (WhatsApp e SMS)",
      "Follow-up automático para não perder clientes",
      "Ligações direto do sistema",
      "Organização simples dos seus clientes",
      "Agenda e calendário configurado automático ou manual",
      "Sistema de publicação nas mídias sociais",
      "Tudo configurado para você — sem precisar de tecnologia",
    ],
    notIncluded: [
      "Múltiplos números de WhatsApp",
      "Chamadas de vídeo com clientes",
      "Plataforma de treinamento",
      "Acesso para múltiplos usuários",
      "Pipeline de vendas avançado",
    ],
    summary: "Um sistema completo de atendimento e vendas configurado pela nossa equipe. Você só precisa usar.",
  },
  {
    id: "business" as const,
    name: "Business",
    tagline: "Um sistema completo para organizar, automatizar e escalar seus clientes — sem perder oportunidades.",
    price: 248,
    setupFee: 250,
    yearlyPrice: Math.round(248 * 12 * 0.8),
    highlighted: true,
    contactSales: false,
    badge: "Mais completo" as string | null,
    color: "red" as const,
    idealFor: "Empresas em crescimento, equipes de vendas e negócios que precisam escalar o atendimento sem perder qualidade.",
    features: [
      "Tudo do Basic, mais:",
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
    notIncluded: [],
    summary: "O sistema mais completo para empresas que querem crescer com organização, automação e atendimento de qualidade.",
  },
  {
    id: "corp" as const,
    name: "Corp",
    tagline: "Flexibilidade, personalização e governança operacional em nível superior.",
    price: 0,
    yearlyPrice: 0,
    highlighted: false,
    contactSales: true,
    badge: "Sob consulta" as string | null,
    color: "purple" as const,
    idealFor: "Empresas com múltiplas unidades, maior volume de leads, necessidade de personalização, integrações avançadas ou suporte consultivo.",
    features: [
      "Estrutura multiunidade",
      "Operações com maior volume",
      "Automação avançada",
      "Integrações via API",
      "Processos personalizados por departamento",
      "Suporte consultivo",
      "Arquitetura operacional sob medida",
      "Possibilidade de SLA",
    ],
    notIncluded: [],
    summary: "Um plano desenhado para empresas que precisam de flexibilidade, personalização e governança operacional em nível superior.",
  },
];

const ADDONS = [
  "SMS e MMS", "Ligações inbound e outbound", "Números telefônicos", "WhatsApp",
  "E-mail em volume", "Verificação de e-mail", "IP dedicado", "Hospedagem WordPress",
  "Online Listings", "AI Employee / Voice AI / Workflow AI",
  "Aplicativo white-label", "Ações premium de automação", "Serviços personalizados",
];

const COLOR_MAP = {
  orange: {
    border: "border-orange-500/40",
    ring: "ring-1 ring-orange-500/20",
    badgeCls: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    btn: "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white",
    iconBg: "bg-orange-500/10 text-orange-400",
    check: "text-orange-400",
  },
  red: {
    border: "border-red-500",
    ring: "ring-1 ring-red-500/30",
    badgeCls: "bg-red-500/20 text-red-300 border-red-500/30",
    btn: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white",
    iconBg: "bg-red-500/10 text-red-400",
    check: "text-red-400",
  },
  purple: {
    border: "border-purple-500/40",
    ring: "",
    badgeCls: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    btn: "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white",
    iconBg: "bg-purple-500/10 text-purple-400",
    check: "text-purple-400",
  },
};

const PLAN_ICONS = { basic: Zap, business: Building2, corp: Globe };

export default function Pricing() {
  const [, navigate] = useLocation();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const { user, isAuthenticated } = useAuth();
  const { data: subscription } = trpc.billing.getSubscription.useQuery(undefined, { enabled: isAuthenticated });

  const createCheckout = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
        toast.info("Checkout Stripe aberto em nova aba. Conclua o pagamento lá.");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSelectPlan = (planId: "basic" | "business" | "corp") => {
    if (planId === "corp") {
      window.location.href = "mailto:contato@getsales4now.agency?subject=Plano Corp - Consulta";
      return;
    }
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    createCheckout.mutate({ plan: planId as "basic" | "business", billing });
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white">GetSales4Now</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="border-white/20 text-white/70 hover:text-white">
                Dashboard
              </Button>
            </Link>
          ) : (
            <a href={getLoginUrl()}>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
                Entrar
              </Button>
            </a>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs px-3 py-1">
            Nossos Planos
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Escolha o plano certo<br />para o seu momento
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Estrutura transparente, sem custos escondidos. Recursos variáveis cobrados separadamente para garantir que você pague apenas pelo que usa.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === "monthly" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBilling(billing === "monthly" ? "yearly" : "monthly")}
              className={`relative w-12 h-6 rounded-full transition-all ${billing === "yearly" ? "bg-orange-500" : "bg-white/10"}`}
            >
              <span className={`block w-4 h-4 bg-white rounded-full transition-all absolute top-1 ${billing === "yearly" ? "left-7" : "left-1"}`} />
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === "yearly" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
            >
              Anual
              <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">-20%</span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {PLANS.map((plan) => {
            const colors = COLOR_MAP[plan.color];
            const PlanIcon = PLAN_ICONS[plan.id];
            const isCurrentPlan = subscription?.plan === plan.id;
            const displayPrice = billing === "yearly" && !plan.contactSales
              ? Math.round(plan.yearlyPrice / 12)
              : plan.price;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border ${colors.border} ${plan.highlighted ? colors.ring : ""} bg-[#0d1526] flex flex-col overflow-hidden transition-all hover:border-white/30`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute top-4 right-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${colors.badgeCls}`}>
                      {plan.badge}
                    </span>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute top-4 left-4">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-green-500/20 text-green-300 border-green-500/30">
                      Plano atual
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="p-6 border-b border-white/10">
                  <div className={`w-10 h-10 rounded-xl ${colors.iconBg} flex items-center justify-center mb-4`}>
                    <PlanIcon className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-1">{plan.name}</h2>
                  <p className="text-white/40 text-sm leading-relaxed">{plan.tagline}</p>

                  {/* Price */}
                  <div className="mt-5">
                    {plan.contactSales ? (
                      <div>
                        <span className="text-2xl font-black text-white">Sob consulta</span>
                        <p className="text-white/40 text-xs mt-1">Definido conforme escopo e volume</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-white/40 text-sm">US$</span>
                          <span className="text-4xl font-black text-white">{displayPrice}</span>
                          <span className="text-white/40 text-sm">/mês</span>
                        </div>
                        {billing === "yearly" && (
                          <p className="text-green-400 text-xs mt-1">
                            US$ {plan.yearlyPrice}/ano · 20% de desconto
                          </p>
                        )}
                        <p className="text-white/30 text-xs mt-1">14 dias de trial grátis</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ideal for */}
                <div className="px-6 pt-5 pb-2">
                  <p className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-1.5">Ideal para</p>
                  <p className="text-white/55 text-sm leading-relaxed">{plan.idealFor}</p>
                </div>

                {/* Features */}
                <div className="px-6 pb-4 flex-1">
                  <p className="text-white/30 text-xs font-semibold uppercase tracking-wider mb-3 mt-4">
                    {plan.id === "corp" ? "Pode incluir" : "Inclui"}
                  </p>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                        <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* Not included */}
                  {plan.notIncluded.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/5">
                      <p className="text-white/20 text-xs font-semibold uppercase tracking-wider mb-2">Não incluído no valor mensal</p>
                      <ul className="space-y-1.5">
                        {plan.notIncluded.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-xs text-white/30">
                            <X className="w-3 h-3 text-white/20 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="px-6 pb-3">
                  <p className="text-white/30 text-xs italic leading-relaxed">{plan.summary}</p>
                </div>

                {/* CTA */}
                <div className="p-6 pt-2">
                  <Button
                    className={`w-full font-semibold rounded-xl ${
                      isCurrentPlan
                        ? "bg-green-700 hover:bg-green-800 text-white cursor-default"
                        : colors.btn
                    }`}
                    onClick={() => !isCurrentPlan && handleSelectPlan(plan.id)}
                    disabled={isCurrentPlan || createCheckout.isPending}
                  >
                    {isCurrentPlan ? (
                      "Plano Atual"
                    ) : plan.contactSales ? (
                      <span className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Falar com consultor
                      </span>
                    ) : createCheckout.isPending ? (
                      "Processando..."
                    ) : (
                      <span className="flex items-center gap-2">
                        Começar agora
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add-ons */}
        <div className="bg-[#0d1526] border border-white/10 rounded-2xl p-8 mb-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Itens cobrados à parte</h2>
              <p className="text-white/50 text-sm max-w-2xl">
                Alguns recursos são cobrados separadamente conforme uso ou contratação adicional, para garantir transparência e evitar que clientes com perfis muito diferentes sejam tratados de forma distorcida.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {ADDONS.map((addon) => (
              <div key={addon} className="flex items-center gap-2 text-sm text-white/50 bg-white/5 rounded-lg px-3 py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/50 shrink-0" />
                {addon}
              </div>
            ))}
          </div>
        </div>

        {/* Conditions + Differentials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-[#0d1526] border border-white/10 rounded-2xl p-6">
            <h3 className="font-bold text-white mb-4">Condições comerciais</h3>
            <ul className="space-y-2.5 text-sm text-white/55">
              {[
                "Cobrança mensal recorrente",
                "Serviços variáveis e add-ons cobrados separadamente quando aplicável",
                "Plano Corp definido após análise de escopo",
                "Setup, onboarding avançado e personalizações podem ser cobrados à parte",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#0d1526] border border-white/10 rounded-2xl p-6">
            <h3 className="font-bold text-white mb-4">Diferenciais da nossa proposta</h3>
            <ul className="space-y-2.5 text-sm text-white/55">
              {[
                "Plataforma centralizada",
                "Menos dependência de múltiplas ferramentas",
                "Mais velocidade comercial",
                "Melhor controle de leads e oportunidades",
                "Automação para reduzir falhas manuais",
                "Estrutura escalável e modelo transparente de crescimento",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-8 text-white/30 text-sm mb-6">
          <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-green-500" />Pagamento seguro via Stripe</div>
          <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />Cancele a qualquer momento</div>
          <div className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" />Suporte em PT-BR, EN e ES</div>
        </div>
        {/* Test cards link */}
        <div className="flex justify-center mb-10">
          <a href="/test-cards" className="inline-flex items-center gap-2 text-xs text-white/30 hover:text-orange-400 transition-colors border border-white/10 hover:border-orange-500/30 rounded-full px-4 py-1.5">
            <span>💳</span> Ambiente de testes? Veja os cartões de teste do Stripe
          </a>
        </div>

        {/* Closing CTA */}
        <div className="text-center bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl p-10">
          <h2 className="text-2xl font-bold text-white mb-3">Pronto para começar?</h2>
          <p className="text-white/50 text-sm max-w-xl mx-auto mb-6">
            Nossa proposta foi desenhada para combinar eficiência operacional, previsibilidade comercial e escalabilidade. Em vez de mascarar custos variáveis dentro de um plano fixo, adotamos uma estrutura mais transparente e sustentável.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => handleSelectPlan("basic")}
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold px-8"
            >
              Começar com Basic — US$ 118/mês
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = "mailto:contato@getsales4now.agency?subject=Plano Corp - Consulta"}
              className="border-white/20 text-white/70 hover:text-white hover:border-white/40"
            >
              Falar sobre o plano Corp
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
