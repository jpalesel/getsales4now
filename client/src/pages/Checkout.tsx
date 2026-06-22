/**
 * GetSales4Now — Checkout Page
 *
 * FIX APPLIED:
 *  Changed window.open(url, "_blank") to window.location.href = url
 *  so Stripe opens in the SAME tab. This is critical because Stripe's
 *  success_url redirect (/ghl-onboarding?paid=true) only works when
 *  the checkout is in the same tab. Opening in a new tab means the
 *  success redirect goes to the new tab, not the original tab, and
 *  the user ends up confused with two tabs open.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreditCard, Clock, Shield, Check, ArrowRight, Zap, Building2 } from "lucide-react";

type PlanKey = "basic" | "business";

const PLAN_DETAILS: Record<PlanKey, {
  name: string;
  price: string;
  period: string;
  icon: typeof Zap;
  color: string;
  borderColor: string;
  bgColor: string;
  features: string[];
}> = {
  basic: {
    name: "Basic",
    price: "US$ 118",
    period: "/mês",
    icon: Zap,
    color: "text-orange-400",
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/10",
    features: [
      "Respostas automáticas para seus clientes (24h)",
      "WhatsApp e SMS em um só lugar",
      "Follow-up automático para não perder clientes",
      "Ligações direto do sistema",
      "Agenda automática ou manual",
      "Publicação nas mídias sociais",
      "Tudo configurado pela nossa equipe",
    ],
  },
  business: {
    name: "Business",
    price: "US$ 248",
    period: "/mês",
    icon: Building2,
    color: "text-red-400",
    borderColor: "border-red-500/30",
    bgColor: "bg-red-500/10",
    features: [
      "Tudo do Basic, mais:",
      "Até 5 números de WhatsApp",
      "Pipeline de vendas completo",
      "Chamadas de vídeo com clientes",
      "Plataforma de treinamento",
      "Múltiplos usuários",
      "Automação avançada",
    ],
  },
};

function normalizePlan(raw: string): PlanKey {
  if (raw === "business") return "business";
  return "basic";
}

export default function Checkout() {
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  // Parse plan from URL
  const params = new URLSearchParams(window.location.search);
  const planParam = params.get("plan") ?? "basic";
  const isTrial = params.get("trial") === "true";

  const planKey = normalizePlan(planParam);
  const plan = PLAN_DETAILS[planKey];
  const PlanIcon = plan.icon;

  const createCheckoutMutation = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        // FIX: Use window.location.href (same tab) instead of window.open (new tab).
        // Stripe's success_url redirect only works correctly in the same tab.
        // Opening in a new tab breaks the post-payment flow to /ghl-onboarding.
        window.location.href = data.url;
        // Note: setIsLoading(false) is intentionally NOT called here because
        // the page will navigate away. Keeping the loading state prevents double-clicks.
      } else {
        toast.error("Stripe não retornou uma URL de checkout. Tente novamente.");
        setIsLoading(false);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Falha ao iniciar checkout. Tente novamente.");
      setIsLoading(false);
    },
  });

  const handleCheckout = () => {
    setIsLoading(true);
    createCheckoutMutation.mutate({
      plan: planKey,
      billing: "monthly",
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm">GS</div>
          <span className="text-white font-bold text-lg">GetSales4Now</span>
        </div>
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <Shield className="w-4 h-4" />
          Protegido pelo Stripe
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Trial badge */}
          {isTrial && (
            <div className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2 text-green-400 text-sm font-medium mb-6 w-fit mx-auto">
              <Clock className="w-4 h-4" />
              14 dias grátis — sem cobrança hoje
            </div>
          )}

          <div className="bg-[#0d1526] border border-white/10 rounded-2xl overflow-hidden">
            {/* Plan summary */}
            <div className={`p-6 border-b border-white/10 ${plan.bgColor}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl ${plan.bgColor} border ${plan.borderColor} flex items-center justify-center`}>
                  <PlanIcon className={`w-5 h-5 ${plan.color}`} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">Plano {plan.name}</h2>
                  <p className="text-white/50 text-sm">CRM, Automação e Crescimento</p>
                </div>
              </div>

              <div className="flex items-baseline gap-1">
                <span className={`text-4xl font-black ${plan.color}`}>{plan.price}</span>
                <span className="text-white/40 text-sm">{plan.period}</span>
              </div>

              {isTrial && (
                <div className="mt-3 text-white/60 text-sm">
                  Primeira cobrança: <strong className="text-white">após o período de 14 dias de trial</strong>
                </div>
              )}
            </div>

            {/* Features included */}
            <div className="p-6 border-b border-white/10">
              <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">O que está incluído</h3>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-white/80 text-sm">
                    <Check className="w-4 h-4 text-green-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* What happens next */}
            <div className="p-6 border-b border-white/10">
              <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Próximos passos</h3>
              <ol className="space-y-3">
                {[
                  { step: "1", text: "Clique abaixo para abrir o checkout seguro do Stripe" },
                  { step: "2", text: "Adicione seu cartão — sem cobrança por 14 dias" },
                  { step: "3", text: "Volte aqui para configurar sua conta GS4N" },
                  { step: "4", text: "Comece a usar todos os recursos imediatamente" },
                ].map((item) => (
                  <li key={item.step} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {item.step}
                    </span>
                    <span className="text-white/60 text-sm">{item.text}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* CTA */}
            <div className="p-6 space-y-3">
              <Button
                onClick={handleCheckout}
                disabled={isLoading || createCheckoutMutation.isPending}
                className="w-full h-13 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold text-base rounded-xl"
              >
                {isLoading || createCheckoutMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Abrindo Stripe...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Adicionar Forma de Pagamento
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>

              <div className="flex items-center justify-center gap-4 text-white/30 text-xs pt-2">
                <div className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> SSL Seguro</div>
                <div className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Powered by Stripe</div>
                <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Cancele quando quiser</div>
              </div>
            </div>
          </div>

          {/* Test card hint */}
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-blue-300 text-xs text-center">
              <strong>Modo teste:</strong> Use o cartão <code className="bg-blue-500/20 px-1 rounded">4242 4242 4242 4242</code> com qualquer data futura e qualquer CVC.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
