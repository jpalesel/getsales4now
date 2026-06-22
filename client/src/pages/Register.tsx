import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Check, Zap, Building2, ArrowRight, Shield, Clock, CreditCard, AlertCircle, LogIn } from "lucide-react";

// ─── Validation ───────────────────────────────────────────────────────────────
const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  plan: z.enum(["basic", "business"]),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

// ─── Plan definitions ─────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "basic" as const,
    name: "Basic",
    price: "US$ 118",
    period: "/mês",
    description: "Pare de perder clientes e responda na hora — sem precisar mexer em tecnologia.",
    color: "from-orange-500 to-orange-600",
    borderColor: "border-orange-500",
    bgColor: "bg-orange-500/10",
    features: [
      "Respostas automáticas 24h",
      "WhatsApp, SMS em um só lugar",
      "Follow-up automático",
      "Ligações direto do sistema",
      "Agenda automática ou manual",
      "Publicação nas mídias sociais",
      "Tudo configurado pela nossa equipe",
    ],
  },
  {
    id: "business" as const,
    name: "Business",
    price: "US$ 248",
    period: "/mês",
    description: "Organize, automatize e escale seus clientes — sem perder oportunidades.",
    color: "from-red-500 to-red-600",
    borderColor: "border-red-500",
    bgColor: "bg-red-500/10",
    badge: "Mais Completo",
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
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function Register() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const planFromUrl = params.get("plan") as "basic" | "business" | null;

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // Se o plano veio na URL, pula direto para o formulário
  const [step, setStep] = useState<"plan" | "form">(planFromUrl ? "form" : "plan");
  const [emailAlreadyExists, setEmailAlreadyExists] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { plan: planFromUrl ?? "basic" },
  });

  // Sincroniza o plano da URL com o formulário
  useEffect(() => {
    if (planFromUrl && (planFromUrl === "basic" || planFromUrl === "business")) {
      setValue("plan", planFromUrl);
    }
  }, [planFromUrl, setValue]);

  const selectedPlan = watch("plan");

  const registerMutation = trpc.authOwn.register.useMutation({
    onSuccess: (data) => {
      setEmailAlreadyExists(false);
      toast.success(`Bem-vindo, ${data.name}! Seu trial de 14 dias foi iniciado.`);
      navigate("/checkout?plan=" + data.plan + "&trial=true");
    },
    onError: (err) => {
      const msg = err.message ?? "";
      if (msg.includes("already exists") || msg.includes("já existe") || err.data?.code === "CONFLICT") {
        setEmailAlreadyExists(true);
      } else {
        setEmailAlreadyExists(false);
        toast.error(msg || "Falha no cadastro. Tente novamente.");
      }
    },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  const handlePlanSelect = (planId: "basic" | "business") => {
    setValue("plan", planId);
    setStep("form");
  };

  // ── Step 1: Plan Selection ──────────────────────────────────────────────────
  if (step === "plan") {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm">GS</div>
              <span className="text-white font-bold text-lg">GetSales4Now</span>
            </div>
          </Link>
          <span className="text-white/50 text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-orange-400 hover:text-orange-300 font-medium">Sign in</Link>
          </span>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          {/* Title */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-1.5 text-orange-400 text-sm font-medium mb-4">
              <Clock className="w-4 h-4" />
              14-day free trial — no charge today
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Escolha seu plano</h1>
            <p className="text-white/60 text-lg">14 dias grátis. Cancele a qualquer momento.</p>
          </div>

          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                onClick={() => handlePlanSelect(plan.id)}
                className={`relative text-left rounded-2xl border-2 p-6 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl ${plan.borderColor} ${plan.bgColor} bg-[#0d1526]`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <p className="text-white/50 text-sm mt-1">{plan.description}</p>
                </div>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-4xl font-black bg-gradient-to-r ${plan.color} bg-clip-text text-transparent`}>
                    {plan.price}
                  </span>
                  <span className="text-white/50 text-sm">{plan.period}</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-white/80 text-sm">
                      <Check className="w-4 h-4 text-green-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className={`w-full py-3 rounded-xl font-semibold text-white text-center bg-gradient-to-r ${plan.color} flex items-center justify-center gap-2`}>
                  Começar trial {plan.name}
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-white/40 text-sm">
            <div className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> Pagamento seguro SSL</div>
            <div className="flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> Sem cobrança por 14 dias</div>
            <div className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> Cancele a qualquer momento</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Registration Form ───────────────────────────────────────────────
  const currentPlan = PLANS.find((p) => p.id === selectedPlan)!;

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm">GS</div>
            <span className="text-white font-bold text-lg">GetSales4Now</span>
          </div>
        </Link>
        <span className="text-white/50 text-sm">
          Já tem uma conta?{" "}
          <Link href="/login" className="text-orange-400 hover:text-orange-300 font-medium">Entrar</Link>
        </span>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Plan badge */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setStep("plan")}
              className="text-white/50 hover:text-white text-sm flex items-center gap-1 transition-colors"
            >
              ← Trocar plano
            </button>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${currentPlan.borderColor} ${currentPlan.bgColor}`}>
              {selectedPlan === "basic" ? <Zap className="w-3.5 h-3.5 text-orange-400" /> : <Building2 className="w-3.5 h-3.5 text-red-400" />}
              <span className="text-white text-xs font-semibold">{currentPlan.name} — {currentPlan.price}/mo</span>
            </div>
          </div>

          {/* Form card */}
          <div className="bg-[#0d1526] border border-white/10 rounded-2xl p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">Crie sua conta</h1>
              <p className="text-white/50 text-sm mt-1">
                Trial de 14 dias grátis — sem cobrança hoje
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Nome completo</Label>
                <Input
                  {...register("name")}
                  placeholder="João Silva"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500 focus:ring-orange-500/20 h-11"
                />
                {errors.name && <p className="text-red-400 text-xs">{errors.name.message}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">E-mail</Label>
                <Input
                  {...register("email")}
                  type="email"
                  placeholder="voce@empresa.com"
                  onChange={() => setEmailAlreadyExists(false)}
                  className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500 focus:ring-orange-500/20 h-11 ${
                    emailAlreadyExists ? "border-red-500 focus:border-red-500" : ""
                  }`}
                />
                {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
                {/* E-mail duplicado — banner com link para login */}
                {emailAlreadyExists && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 mt-1">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-red-300 text-xs font-semibold">Este e-mail já possui uma conta.</p>
                      <p className="text-red-300/70 text-xs mt-0.5">
                        Deseja entrar na sua conta existente?
                      </p>
                      <Link href="/login">
                        <button className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors px-3 py-1.5 rounded-lg">
                          <LogIn className="w-3.5 h-3.5" />
                          Fazer login agora
                        </button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Senha</Label>
                <div className="relative">
                  <Input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500 focus:ring-orange-500/20 h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label className="text-white/70 text-sm">Confirmar Senha</Label>
                <div className="relative">
                  <Input
                    {...register("confirmPassword")}
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repita sua senha"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-orange-500 focus:ring-orange-500/20 h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword.message}</p>}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={registerMutation.isPending}
                className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold text-base rounded-xl mt-2"
              >
                {registerMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Criando conta...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Iniciar Trial Grátis
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>

              {/* Trial note */}
              <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-xl p-3 mt-2">
                <Clock className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                <p className="text-green-300 text-xs leading-relaxed">
                  <strong>14 dias grátis.</strong> Após o cadastro, você adicionará seu cartão para garantir o plano — mas não haverá cobrança até o fim do trial.
                </p>
              </div>

              {/* Terms */}
              <p className="text-white/30 text-xs text-center">
                Ao criar uma conta você concorda com nossos{" "}
                <span className="text-orange-400 cursor-pointer hover:underline">Termos de Serviço</span>{" "}
                e{" "}
                <span className="text-orange-400 cursor-pointer hover:underline">Política de Privacidade</span>.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
