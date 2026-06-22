/**
 * GetSales4Now — Formulário de Criação de Sub-Conta
 *
 * Tela pós-pagamento: formulário único onde o cliente preenche
 * os dados da empresa e a sub-conta GS4N é criada automaticamente
 * dentro da plataforma SaaS app.getsales4now.com
 *
 * Correções aplicadas:
 *  1. Verifica autenticação — redireciona para /login se não logado
 *  2. Aguarda assinatura ser processada pelo webhook Stripe (retry com polling)
 *  3. Botão de sucesso redireciona para app.getsales4now.com (painel SaaS)
 *  4. Mensagens de erro claras e recuperáveis
 */
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2, Phone, Mail, MapPin, Globe,
  CheckCircle2, Rocket, Loader2, ArrowRight,
  Briefcase, Target, Zap, Check, Lock,
  ExternalLink, CreditCard, AlertTriangle,
} from "lucide-react";

/// ─── URL do painel SaaS GS4N ──────────────────────────────────────────
const GHL_SAAS_URL = "https://app.getsales4now.com";

// ─── Confetti ─────────────────────────────────────────────────────────────────
function Confetti() {
  const pieces = Array.from({ length: 50 }).map((_, i) => ({
    left: `${(i * 7.3) % 100}%`,
    top: `${(i * 13.7) % 80}%`,
    background: ["#f97316", "#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#eab308", "#06b6d4"][i % 7],
    animationDelay: `${(i * 0.07) % 1.2}s`,
    animationDuration: `${0.8 + (i * 0.09) % 1}s`,
    transform: `rotate(${(i * 47) % 360}deg)`,
    width: i % 3 === 0 ? "12px" : "7px",
    height: i % 3 === 0 ? "12px" : "7px",
    borderRadius: i % 2 === 0 ? "3px" : "50%",
  }));
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((s, i) => (
        <div key={i} className="absolute animate-bounce" style={s} />
      ))}
    </div>
  );
}

// ─── Dados do formulário ──────────────────────────────────────────────────────
const BUSINESS_TYPES = [
  { id: "services", label: "Serviços Profissionais", icon: "💼" },
  { id: "health", label: "Saúde & Bem-estar", icon: "🏥" },
  { id: "beauty", label: "Beleza & Estética", icon: "💄" },
  { id: "real_estate", label: "Imóveis", icon: "🏠" },
  { id: "insurance", label: "Seguros & Finanças", icon: "🛡️" },
  { id: "legal", label: "Jurídico & Contabilidade", icon: "⚖️" },
  { id: "education", label: "Educação & Coaching", icon: "🎓" },
  { id: "ecommerce", label: "E-commerce & Varejo", icon: "🛒" },
  { id: "agency", label: "Agência de Marketing", icon: "📣" },
  { id: "restaurant", label: "Restaurante & Food", icon: "🍽️" },
  { id: "auto", label: "Automotivo", icon: "🚗" },
  { id: "other", label: "Outro", icon: "🔧" },
];

const COUNTRIES = [
  { code: "BR", name: "Brasil" },
  { code: "US", name: "Estados Unidos" },
  { code: "MX", name: "México" },
  { code: "CO", name: "Colômbia" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "PE", name: "Peru" },
  { code: "PT", name: "Portugal" },
  { code: "ES", name: "Espanha" },
  { code: "PA", name: "Panamá" },
  { code: "CA", name: "Canadá" },
];

const TIMEZONE_BY_COUNTRY: Record<string, string> = {
  BR: "America/Sao_Paulo",
  US: "America/New_York",
  MX: "America/Mexico_City",
  CO: "America/Bogota",
  AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago",
  PE: "America/Lima",
  PT: "Europe/Lisbon",
  ES: "Europe/Madrid",
  PA: "America/Panama",
  CA: "America/Toronto",
};

const formSchema = z.object({
  companyName: z.string().min(2, "Informe o nome da empresa"),
  companyEmail: z.string().email("E-mail inválido"),
  companyPhone: z.string().min(8, "Informe o telefone com DDD"),
  companyWebsite: z.string().optional(),
  country: z.string().min(2, "Selecione o país"),
  state: z.string().optional(),
  city: z.string().optional(),
  businessType: z.string().min(1, "Selecione o segmento do negócio"),
});
type FormData = z.infer<typeof formSchema>;

// ─── Tela de loading ──────────────────────────────────────────────────────────
function CreatingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = [
    "Validando dados da empresa...",
    "Criando sub-conta na plataforma GetSales4Now...",
    "Configurando usuário administrador...",
    "Finalizando configurações...",
  ];

  useEffect(() => {
    const timers = steps.map((_, i) =>
      setTimeout(() => setCurrentStep(i), i * 2500)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/30 animate-pulse">
          <Rocket className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Criando sua conta...</h2>
        <p className="text-white/50 text-sm mb-8">Isso pode levar alguns segundos. Não feche esta página.</p>
        <div className="space-y-3">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all duration-500 ${
                i < currentStep
                  ? "bg-green-500/10 border-green-500/30"
                  : i === currentStep
                  ? "bg-orange-500/10 border-orange-500/30"
                  : "bg-white/5 border-white/10 opacity-40"
              }`}
            >
              {i < currentStep ? (
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              ) : i === currentStep ? (
                <Loader2 className="w-4 h-4 text-orange-400 animate-spin shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-white/20 shrink-0" />
              )}
              <span className={`text-sm text-left ${i <= currentStep ? "text-white/80" : "text-white/30"}`}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tela de sucesso ──────────────────────────────────────────────────────────
function SuccessScreen({ companyName, locationId }: { companyName?: string; locationId?: string }) {
  const handleGoToPanel = () => {
    // Redirecionar para o painel SaaS da plataforma getsales4now.com
    window.location.href = GHL_SAAS_URL;
  };

  return (
    <>
      <Confetti />
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
        <div className="text-center max-w-lg w-full">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/30">
            <Check className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Conta criada com sucesso!</h2>
          <p className="text-white/60 text-base mb-2">
            {companyName ? (
              <><strong className="text-white">{companyName}</strong> está pronta para vender.</>
            ) : (
              "Sua sub-conta está pronta para vender."
            )}
          </p>
          <p className="text-white/40 text-sm mb-8">
            Acesse o painel da plataforma para configurar seus canais, campanhas e automações.
          </p>

          {/* Próximos passos */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { icon: "📱", label: "WhatsApp", desc: "Conecte agora" },
              { icon: "📧", label: "E-mail", desc: "Configure SMTP" },
              { icon: "🤖", label: "Automações", desc: "Crie fluxos" },
            ].map((item) => (
              <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-white text-xs font-semibold">{item.label}</div>
                <div className="text-white/40 text-xs">{item.desc}</div>
              </div>
            ))}
          </div>

          {/* Botão principal — vai para app.getsales4now.com */}
          <Button
            onClick={handleGoToPanel}
            className="w-full h-14 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-xl text-lg shadow-2xl shadow-orange-500/30 mb-3"
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Acessar minha conta em GetSales4Now
          </Button>

          <p className="text-white/30 text-xs">
            Você será redirecionado para <span className="text-orange-400">app.getsales4now.com</span>
            {locationId && <> — ID da conta: <span className="font-mono">{locationId}</span></>}
          </p>
        </div>
      </div>
    </>
  );
}

// ─── Tela de aguardando pagamento ─────────────────────────────────────────────
function WaitingPaymentScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-yellow-500/30 animate-pulse">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Confirmando pagamento...</h2>
        <p className="text-white/50 text-sm mb-6">
          Estamos aguardando a confirmação do seu pagamento. Isso pode levar alguns instantes.
        </p>
        <Button
          onClick={onRetry}
          variant="outline"
          className="border-white/20 text-white/70 hover:text-white hover:border-white/40"
        >
          Verificar novamente
        </Button>
      </div>
    </div>
  );
}

// ─── Tela de pagamento necessário ────────────────────────────────────────────
function PaymentRequiredScreen({ plan, onGoToCheckout }: { plan?: string; onGoToCheckout: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-orange-500/30">
          <CreditCard className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Pagamento necessário</h2>
        <p className="text-white/60 text-sm mb-2">
          Para criar sua conta GetSales4Now, você precisa completar o pagamento via Stripe.
        </p>
        <p className="text-white/40 text-xs mb-8">
          Você terá <strong className="text-orange-400">14 dias grátis</strong> — nenhuma cobrança hoje. O cartão é necessário apenas para ativar o trial.
        </p>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-white/70 text-sm font-medium mb-1">Por que preciso do cartão?</p>
              <p className="text-white/40 text-xs">
                O Stripe exige um cartão de crédito para ativar o período de trial. Você não será cobrado durante os 14 dias. Pode cancelar a qualquer momento.
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={onGoToCheckout}
          className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-xl shadow-2xl shadow-orange-500/30 mb-3"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Ir para o checkout — 14 dias grátis
        </Button>
        <p className="text-white/30 text-xs">
          Plano {plan === "business" ? "Business — US$ 248/mês" : "Basic — US$ 118/mês"} após o trial
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMULÁRIO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function GhlOnboarding() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const isPaid = params.get("paid") === "true";

  const { user, loading: authLoading } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [locationId, setLocationId] = useState<string | undefined>();
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [selectedPlan] = useState<string>(
    new URLSearchParams(search).get("plan") ?? "basic"
  );

  // Verificar status da assinatura (polling para aguardar webhook Stripe)
  const subscriptionStatus = trpc.gs4nProvisioning.getStatus.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: isSuccess ? false : 5000, // Polling a cada 5s
  });

  // Mutation para criar checkout Stripe
  const checkoutMutation = trpc.billing.createCheckout.useMutation();

  const handleGoToCheckout = async () => {
    try {
      const result = await checkoutMutation.mutateAsync({
        plan: (selectedPlan === "business" ? "business" : "basic") as "basic" | "business",
        billing: "monthly",
      });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      toast.error("Erro ao abrir o checkout. Tente novamente.");
    }
  };

  // Redirecionar para login se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      toast.error("Faça login para continuar a configuração da sua conta.");
      const returnTo = encodeURIComponent("/ghl-onboarding" + (isPaid ? "?paid=true" : ""));
      navigate(`/login?returnTo=${returnTo}`);
    }
  }, [user, authLoading, navigate, isPaid]);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { country: "BR", businessType: "" },
  });

  const selectedBusinessType = watch("businessType");
  const selectedCountry = watch("country");

  const updateMutation = trpc.authOwn.updateGhlOnboarding.useMutation();
  const provisionMutation = trpc.gs4nProvisioning.triggerProvisioning.useMutation({
    onSuccess: (data) => {
      setIsCreating(false);
      setLocationId(data.locationId);
      setIsSuccess(true);
    },
    onError: (err) => {
      setIsCreating(false);
      const msg = err.message || "Erro ao criar sub-conta.";
      // Verificar se é erro de pagamento não confirmado
      if (msg.includes("Pagamento não confirmado") || msg.includes("Complete o checkout")) {
        setPaymentRequired(true);
      } else if (msg.includes("assinatura") || msg.includes("plano") || msg.includes("FORBIDDEN")) {
        toast.error("Aguardando confirmação do pagamento. Tente novamente em alguns instantes.");
        setCheckingSubscription(true);
      } else {
        toast.error(msg + " Tente novamente ou entre em contato com o suporte.");
      }
    },
  });

  const onSubmit = async (data: FormData) => {
    setCompanyName(data.companyName);
    setIsCreating(true);
    setCheckingSubscription(false);

    // Salvar dados no perfil
    try {
      await updateMutation.mutateAsync({
        step: 1,
        data: {
          companyName: data.companyName,
          companyPhone: data.companyPhone,
          companyWebsite: data.companyWebsite,
          country: data.country,
          state: data.state,
          city: data.city,
          businessType: data.businessType,
        },
        completed: true,
      });
    } catch {
      // Continua mesmo se falhar o update de perfil
    }

    // Criar sub-conta GS4N usando a chave da agência
    provisionMutation.mutate({
      businessName: data.companyName,
      businessEmail: data.companyEmail,
      businessPhone: data.companyPhone,
      country: data.country,
      timezone: TIMEZONE_BY_COUNTRY[data.country] ?? "America/Sao_Paulo",
    });
  };

  // Estados de carregamento
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (!user) return null; // Será redirecionado pelo useEffect

  if (isCreating) return <CreatingScreen />;
  if (isSuccess) return <SuccessScreen companyName={companyName} locationId={locationId} />;
  if (checkingSubscription) return (
    <WaitingPaymentScreen onRetry={() => {
      setCheckingSubscription(false);
      subscriptionStatus.refetch();
    }} />
  );

  // Verificar se o pagamento foi confirmado antes de mostrar o formulário
  // A verificação real é feita via banco/Stripe no backend (getStatus).
  // O parâmetro ?paid=true da URL serve apenas para exibir o badge visual.
  // Enquanto o status ainda está carregando, aguardar.
  const statusData = subscriptionStatus.data;

  // Se ainda está carregando o status, mostrar loading
  if (subscriptionStatus.isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
          <p className="text-white/50 text-sm">Verificando pagamento...</p>
        </div>
      </div>
    );
  }

  // Verificar pagamento: banco confirma (stripeSubscriptionId presente) OU veio do Stripe agora (?paid=true)
  // O ?paid=true é aceito como indicação temporária pois o webhook pode ainda não ter processado
  const paymentIsConfirmed = (statusData?.paymentConfirmed === true) || isPaid;
  if (!paymentIsConfirmed && !paymentRequired) {
    return <PaymentRequiredScreen plan={selectedPlan} onGoToCheckout={handleGoToCheckout} />;
  }

  if (paymentRequired) {
    return <PaymentRequiredScreen plan={selectedPlan} onGoToCheckout={handleGoToCheckout} />;
  }

  // ─── Formulário principal ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-start px-4 py-10">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">GS</div>
            <span className="text-white font-bold text-xl">GetSales4Now</span>
          </div>
          <div className="flex items-center gap-2">
            {isPaid && (
              <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 rounded-full px-3 py-1.5 text-green-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Pagamento confirmado
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-white/50 text-xs">
              <Lock className="w-3 h-3" /> Conexão segura
            </div>
          </div>
        </div>

        {/* Título */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-xl shadow-orange-500/20">
              <Rocket className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Configure sua conta</h1>
              <p className="text-white/50 text-sm">Preencha os dados e sua sub-conta será criada automaticamente</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            {[
              { icon: Building2, label: "Dados da empresa" },
              { icon: MapPin, label: "Localização" },
              { icon: Briefcase, label: "Segmento" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 text-white/40 text-xs">
                <item.icon className="w-3.5 h-3.5 text-orange-400" />
                {item.label}
                {i < 2 && <span className="ml-1.5 text-white/20">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Seção: Dados da empresa */}
          <div className="bg-[#0d1526] border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-5">
              <Building2 className="w-5 h-5 text-orange-400" />
              <h2 className="text-white font-semibold text-base">Dados da Empresa</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-white/60 text-sm">Nome da empresa *</Label>
                <Input
                  {...register("companyName")}
                  placeholder="Ex: Clínica Saúde Total"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-orange-500 h-11"
                />
                {errors.companyName && <p className="text-red-400 text-xs">{errors.companyName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-sm flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> E-mail comercial *
                </Label>
                <Input
                  {...register("companyEmail")}
                  type="email"
                  placeholder="contato@suaempresa.com"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-orange-500 h-11"
                />
                {errors.companyEmail && <p className="text-red-400 text-xs">{errors.companyEmail.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-sm flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Telefone / WhatsApp *
                </Label>
                <Input
                  {...register("companyPhone")}
                  placeholder="+55 11 99999-9999"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-orange-500 h-11"
                />
                {errors.companyPhone && <p className="text-red-400 text-xs">{errors.companyPhone.message}</p>}
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-white/60 text-sm flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Site <span className="text-white/30 text-xs">(opcional)</span>
                </Label>
                <Input
                  {...register("companyWebsite")}
                  placeholder="https://suaempresa.com.br"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-orange-500 h-11"
                />
              </div>
            </div>
          </div>

          {/* Seção: Localização */}
          <div className="bg-[#0d1526] border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-5">
              <MapPin className="w-5 h-5 text-orange-400" />
              <h2 className="text-white font-semibold text-base">Localização</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/60 text-sm">País *</Label>
                <select
                  {...register("country")}
                  className="w-full h-11 bg-white/5 border border-white/10 text-white rounded-md px-3 text-sm focus:outline-none focus:border-orange-500"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#0d1526]">{c.name}</option>
                  ))}
                </select>
                {errors.country && <p className="text-red-400 text-xs">{errors.country.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-sm">Estado / Província</Label>
                <Input
                  {...register("state")}
                  placeholder={selectedCountry === "BR" ? "Ex: São Paulo" : "Ex: California"}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-orange-500 h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-sm">Cidade</Label>
                <Input
                  {...register("city")}
                  placeholder={selectedCountry === "BR" ? "Ex: São Paulo" : "Ex: Los Angeles"}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-orange-500 h-11"
                />
              </div>
            </div>
          </div>

          {/* Seção: Segmento */}
          <div className="bg-[#0d1526] border border-white/10 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-5">
              <Target className="w-5 h-5 text-orange-400" />
              <h2 className="text-white font-semibold text-base">Segmento do Negócio *</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {BUSINESS_TYPES.map((bt) => {
                const isSelected = selectedBusinessType === bt.id;
                return (
                  <button
                    key={bt.id}
                    type="button"
                    onClick={() => setValue("businessType", bt.id, { shouldValidate: true })}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-center ${
                      isSelected
                        ? "border-orange-500 bg-orange-500/10 text-white"
                        : "border-white/10 bg-white/5 text-white/50 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    <span className="text-2xl">{bt.icon}</span>
                    <span className="text-xs font-medium leading-tight">{bt.label}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-orange-400" />}
                  </button>
                );
              })}
            </div>
            {errors.businessType && <p className="text-red-400 text-xs mt-2">{errors.businessType.message}</p>}
          </div>

          {/* Aviso */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-start gap-3">
            <Zap className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-orange-300 text-sm font-semibold mb-1">O que acontece ao criar a conta:</p>
              <ul className="text-orange-200/70 text-xs space-y-1">
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-green-400" /> Criamos sua sub-conta em <strong>app.getsales4now.com</strong> automaticamente</li>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-green-400" /> Configuramos seu acesso de administrador</li>
                <li className="flex items-center gap-1.5"><Check className="w-3 h-3 text-green-400" /> Você é redirecionado para o painel pronto para usar</li>
              </ul>
            </div>
          </div>

          {/* Botão de submit */}
          <Button
            type="submit"
            disabled={isCreating || provisionMutation.isPending}
            className="w-full h-14 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-xl text-lg shadow-2xl shadow-orange-500/30"
          >
            {isCreating || provisionMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Criando sua conta...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Rocket className="w-5 h-5" /> Criar Minha Conta GetSales4Now
                <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </Button>

          <p className="text-center text-white/30 text-xs pb-4">
            Ao criar sua conta, você concorda com os{" "}
            <a href="https://getsales4now.com/termos" target="_blank" rel="noreferrer" className="text-orange-400/70 hover:text-orange-400 underline">
              Termos de Uso
            </a>{" "}
            e a{" "}
            <a href="https://getsales4now.com/privacidade" target="_blank" rel="noreferrer" className="text-orange-400/70 hover:text-orange-400 underline">
              Política de Privacidade
            </a>{" "}
            do GetSales4Now.
          </p>
        </form>
      </div>
    </div>
  );
}
