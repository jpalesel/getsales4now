/**
 * /criar-conta — Formulário de criação de conta GetSales4Now
 * Fluxo: Dados pessoais → Dados da empresa → Escolha do plano → Checkout Stripe → Wizard Onboarding
 * NOTA: O token GS4N é interno da agência (API_KEY no servidor). O cliente NÃO precisa fornecer token.
 */
import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2, User, Mail, Lock, Phone, Globe, MapPin,
  Zap, CheckCircle2, ArrowRight, Eye, EyeOff,
  ChevronRight, Star, Shield, Headphones,
} from "lucide-react";

// ─── Validation schema ────────────────────────────────────────────────────────
const schema = z.object({
  // Step 1 — Dados pessoais
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  confirmPassword: z.string(),
  phone: z.string().min(8, "Telefone inválido"),
  // Step 2 — Dados da empresa
  companyName: z.string().min(2, "Nome da empresa obrigatório"),
  segment: z.string().min(1, "Selecione um segmento"),
  website: z.string().optional(),
  country: z.string().min(2, "Selecione um país"),
  state: z.string().optional(),
  city: z.string().optional(),
  // Step 3 — Plano
  plan: z.enum(["basic", "business"]),
}).refine((d) => d.password === d.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

// ─── Data ─────────────────────────────────────────────────────────────────────
const SEGMENTS = [
  "Agência de Marketing Digital",
  "Consultoria Empresarial",
  "E-commerce / Varejo",
  "Imobiliária / Corretora",
  "Educação / Cursos Online",
  "Saúde / Clínica / Medicina",
  "Advocacia / Jurídico",
  "Tecnologia / SaaS",
  "Serviços Financeiros",
  "Construção / Engenharia",
  "Alimentação / Restaurante",
  "Beleza / Estética",
  "Fitness / Academia",
  "Outro",
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
];

const PLANS = [
  {
    id: "basic" as const,
    name: "Basic",
    price: "US$ 118",
    period: "/mês",
    description: "Pare de perder clientes e responda na hora — sem precisar mexer em tecnologia",
    features: ["Respostas automáticas 24h", "WhatsApp e SMS em um só lugar", "Follow-up automático", "Agenda automática", "Publicação nas mídias sociais"],
    color: "from-orange-500 to-orange-600",
    border: "border-orange-500/40",
    bg: "bg-orange-500/10",
    badge: null,
  },
  {
    id: "business" as const,
    name: "Business",
    price: "US$ 248",
    period: "/mês",
    description: "Organize, automatize e escale seus clientes — sem perder oportunidades",
    features: ["Tudo do Basic", "Até 5 números de WhatsApp", "Pipeline de vendas completo", "Chamadas de vídeo", "Múltiplos usuários"],
    color: "from-red-500 to-red-600",
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    badge: "Mais completo",
  },
];

const STEP_LABELS = ["Seus dados", "Empresa", "Plano"];

function StepDot({ num, active, done }: { num: number; active: boolean; done: boolean }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
      ${done ? "bg-green-500 text-white" : active ? "bg-orange-500 text-white ring-4 ring-orange-500/30" : "bg-white/10 text-white/40"}`}>
      {done ? <CheckCircle2 className="w-4 h-4" /> : num}
    </div>
  );
}

export default function CriarConta() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const planFromUrl = new URLSearchParams(search).get("plan") as "basic" | "business" | null;
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const registerMutation = trpc.authOwn.register.useMutation();
  const checkoutMutation = trpc.billing.createCheckout.useMutation();
  const updateOnboardingMutation = trpc.authOwn.updateGhlOnboarding.useMutation();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      plan: (planFromUrl === "business" ? "business" : "basic") as "basic" | "business",
      country: "BR",
    },
  });

  const selectedPlan = watch("plan");

  const stepFields: Record<number, (keyof FormData)[]> = {
    1: ["name", "email", "password", "confirmPassword", "phone"],
    2: ["companyName", "segment", "country"],
    3: ["plan"],
  };

  const handleNext = async () => {
    const valid = await trigger(stepFields[step]);
    if (valid) setStep((s) => s + 1);
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // 1. Register user account
      await registerMutation.mutateAsync({
        name: data.name,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        plan: data.plan,
      });

      // 2. Persist company data to backend before checkout
      await updateOnboardingMutation.mutateAsync({
        step: 1,
        data: {
          companyName: data.companyName,
          companyPhone: data.phone,
          companyWebsite: data.website,
          country: data.country,
          state: data.state,
          city: data.city,
          businessType: data.segment,
        },
      });

      // 3. Open Stripe checkout in new tab, navigate to onboarding wizard
      const result = await checkoutMutation.mutateAsync({
        plan: data.plan,
        billing: "monthly",
      });

      if (result.url) {
        toast.success("Redirecionando para o pagamento seguro...");
        // Redirecionar na mesma aba — Stripe vai redirecionar de volta para /ghl-onboarding?paid=true
        window.location.href = result.url;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao criar conta";
      if (message.includes("already exists") || message.includes("CONFLICT")) {
        toast.error("Este e-mail já possui uma conta. Faça login.");
        navigate("/login");
      } else {
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex">
      {/* ── Left panel (branding) ── */}
      <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-[#0d1526] to-[#0a0f1e] border-r border-white/5 flex-col justify-between p-10">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl">GetSales4Now</span>
          </div>

          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Sua plataforma de vendas<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
              começa aqui
            </span>
          </h2>
          <p className="text-white/50 text-base mb-10">
            Preencha o formulário e sua conta no GS4N será criada automaticamente em minutos.
          </p>

          <div className="space-y-4">
            {[
              { icon: CheckCircle2, text: "Conta GS4N criada automaticamente" },
              { icon: Shield, text: "14 dias de trial gratuito" },
              { icon: Zap, text: "CRM + Automações prontos para usar" },
              { icon: Headphones, text: "Suporte em português" },
              { icon: Star, text: "Sem contrato de fidelidade" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-orange-400" />
                </div>
                <span className="text-white/70 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <p className="text-white/70 text-sm italic mb-3">
            "Em menos de 10 minutos minha conta estava configurada e já estava captando leads."
          </p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold">
              M
            </div>
            <div>
              <p className="text-white text-xs font-semibold">Marcos Silva</p>
              <p className="text-white/40 text-xs">Agência Digital, São Paulo</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">GetSales4Now</span>
          </div>
          <div className="hidden lg:block" />
          <a href="/login" className="text-white/40 hover:text-white/70 text-sm transition-colors">
            Já tenho conta → Entrar
          </a>
        </div>

        <div className="flex-1 flex items-start justify-center p-6 pt-10">
          <div className="w-full max-w-lg">
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-3 mb-10">
              {STEP_LABELS.map((label, idx) => {
                const num = idx + 1;
                const active = step === num;
                const done = step > num;
                return (
                  <div key={num} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <StepDot num={num} active={active} done={done} />
                      <span className={`text-xs ${active ? "text-orange-400 font-semibold" : done ? "text-green-400" : "text-white/30"}`}>
                        {label}
                      </span>
                    </div>
                    {idx < STEP_LABELS.length - 1 && (
                      <div className={`w-12 h-px mb-5 ${done ? "bg-green-500/50" : "bg-white/10"}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
              {/* ── STEP 1: Dados pessoais ── */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Seus dados pessoais</h2>
                    <p className="text-white/50 text-sm">Vamos criar seu acesso à plataforma</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-sm">Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        {...register("name")}
                        placeholder="João Silva"
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-orange-500/50 h-11"
                      />
                    </div>
                    {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-sm">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        {...register("email")}
                        type="email"
                        placeholder="joao@empresa.com"
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-orange-500/50 h-11"
                      />
                    </div>
                    {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-sm">Telefone / WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        {...register("phone")}
                        placeholder="+55 11 99999-9999"
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-orange-500/50 h-11"
                      />
                    </div>
                    {errors.phone && <p className="text-red-400 text-xs">{errors.phone.message}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-white/70 text-sm">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input
                          {...register("password")}
                          type={showPassword ? "text" : "password"}
                          placeholder="Mín. 8 caracteres"
                          className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-orange-500/50 h-11"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-white/70 text-sm">Confirmar senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input
                          {...register("confirmPassword")}
                          type={showConfirm ? "text" : "password"}
                          placeholder="Repita a senha"
                          className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-orange-500/50 h-11"
                        />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword.message}</p>}
                    </div>
                  </div>

                  <Button type="button" onClick={handleNext}
                    className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold rounded-xl">
                    Continuar <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>

                  <p className="text-center text-white/30 text-xs">
                    Já tem uma conta?{" "}
                    <a href="/login" className="text-orange-400 hover:underline">Fazer login</a>
                  </p>
                </div>
              )}

              {/* ── STEP 2: Dados da empresa ── */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Dados da sua empresa</h2>
                    <p className="text-white/50 text-sm">Usaremos para configurar sua conta automaticamente</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-sm">Nome da empresa</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        {...register("companyName")}
                        placeholder="Minha Empresa Ltda"
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-orange-500/50 h-11"
                      />
                    </div>
                    {errors.companyName && <p className="text-red-400 text-xs">{errors.companyName.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-sm">Segmento de atuação</Label>
                    <Select onValueChange={(v) => setValue("segment", v)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white h-11 focus:border-orange-500/50">
                        <SelectValue placeholder="Selecione seu segmento..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0d1526] border-white/10">
                        {SEGMENTS.map((s) => (
                          <SelectItem key={s} value={s} className="text-white hover:bg-white/10 focus:bg-white/10">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.segment && <p className="text-red-400 text-xs">{errors.segment.message}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-white/70 text-sm">Website <span className="text-white/30">(opcional)</span></Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        {...register("website")}
                        placeholder="https://www.minhaempresa.com"
                        className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-orange-500/50 h-11"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-white/70 text-sm">País</Label>
                      <Select defaultValue="BR" onValueChange={(v) => setValue("country", v)}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white h-11 focus:border-orange-500/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0d1526] border-white/10">
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c.code} value={c.code} className="text-white hover:bg-white/10 focus:bg-white/10">{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.country && <p className="text-red-400 text-xs">{errors.country.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/70 text-sm">Estado</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input
                          {...register("state")}
                          placeholder="SP"
                          className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-orange-500/50 h-11"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/70 text-sm">Cidade</Label>
                      <Input
                        {...register("city")}
                        placeholder="São Paulo"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-orange-500/50 h-11"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}
                      className="flex-1 h-12 border-white/10 text-white/60 hover:text-white hover:bg-white/5 rounded-xl">
                      Voltar
                    </Button>
                    <Button type="button" onClick={handleNext}
                      className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold rounded-xl">
                      Continuar <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Plano + Resumo + Submit ── */}
              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">Escolha seu plano</h2>
                    <p className="text-white/50 text-sm">14 dias grátis — sem cobrança hoje</p>
                  </div>

                  <div className="space-y-3">
                    {PLANS.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setValue("plan", plan.id)}
                        className={`w-full text-left rounded-2xl border-2 p-5 transition-all relative ${
                          selectedPlan === plan.id
                            ? `${plan.border} ${plan.bg} ring-2 ring-orange-500/20`
                            : "border-white/10 bg-white/[0.03] hover:border-white/20"
                        }`}
                      >
                        {plan.badge && (
                          <span className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                            {plan.badge}
                          </span>
                        )}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedPlan === plan.id ? "border-orange-500 bg-orange-500" : "border-white/30"}`}>
                                {selectedPlan === plan.id && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <span className="text-white font-bold text-lg">{plan.name}</span>
                            </div>
                            <p className="text-white/50 text-xs ml-6">{plan.description}</p>
                          </div>
                          <div className="text-right ml-4">
                            <span className={`text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r ${plan.color}`}>
                              {plan.price}
                            </span>
                            <span className="text-white/40 text-xs">{plan.period}</span>
                          </div>
                        </div>
                        <div className="ml-6 grid grid-cols-2 gap-1">
                          {plan.features.map((f) => (
                            <div key={f} className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                              <span className="text-white/60 text-xs">{f}</span>
                            </div>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Order summary */}
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-5 space-y-3">
                    <h3 className="text-white font-semibold text-sm">Resumo do pedido</h3>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Plano</span>
                      <span className="text-white font-medium capitalize">{selectedPlan === "basic" ? "Basic" : "Business"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Valor mensal</span>
                      <span className="text-white font-medium">{selectedPlan === "basic" ? "US$ 118" : "US$ 248"}/mês</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Trial gratuito</span>
                      <span className="text-green-400 font-medium">14 dias</span>
                    </div>
                    <div className="border-t border-white/10 pt-3 flex justify-between">
                      <span className="text-white/50 text-sm">Cobrado hoje</span>
                      <span className="text-green-400 font-bold text-lg">$0,00</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(2)}
                      className="flex-1 h-12 border-white/10 text-white/60 hover:text-white hover:bg-white/5 rounded-xl">
                      Voltar
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold text-base rounded-xl shadow-lg shadow-orange-500/20"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Criando conta...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Criar Minha Conta <ArrowRight className="w-4 h-4" />
                        </span>
                      )}
                    </Button>
                  </div>

                  <p className="text-center text-white/30 text-xs">
                    Ao criar sua conta você concorda com os{" "}
                    <span className="text-orange-400 cursor-pointer hover:underline">Termos de Uso</span>
                    {" "}e a{" "}
                    <span className="text-orange-400 cursor-pointer hover:underline">Política de Privacidade</span>
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
