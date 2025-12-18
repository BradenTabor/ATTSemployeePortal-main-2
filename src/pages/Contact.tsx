import { useMemo, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  MapPin,
  Headphones,
  Clock4,
  Send,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
} from "../components/admin/AdminPremiumScaffold";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { logger } from "../lib/logger";

const COMPANY_EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const CONTACT_CHANNELS = [
  {
    title: "General Management",
    owner: "Steve Curtis",
    phone: "(870) 280-9951",
    phoneHref: "tel:8702809951",
    email: "Steve@alltts.com",
    emailHref: "mailto:Steve@alltts.com",
  },
  {
    title: "Human Resources",
    owner: "Shane Flud",
    phone: "(870) 688-0398",
    phoneHref: "tel:8706880398",
    email: "Shane@alltts.com",
    emailHref: "mailto:Shane@alltts.com",
  },
  {
    title: "Safety & Field Ops",
    owner: "Ops Hotline",
    phone: "(870) 930-8000",
    phoneHref: "tel:8709308000",
    email: "safety@alltts.com",
    emailHref: "mailto:safety@alltts.com",
  },
];

export default function Contact() {
  const { user } = useAuth();

  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "People & Support",
      eyebrowIcon: <Headphones className="w-4 h-4 text-[#7ef2c8]" />,
      heading: "Connect with ATTS leadership",
      description:
        "One touch to reach management, human resources, or the safety desk. We respond to most requests within 24–48 hours.",
      badges: [
        {
          label: "Live support weekdays · 7a–6p CT",
          icon: <Clock4 className="w-4 h-4 text-[#7ef2c8]" />,
          variant: "solid",
        },
        {
          label: "Emergency hotline 24/7",
          icon: <Phone className="w-4 h-4 text-[#7ef2c8]" />,
          variant: "outline",
        },
      ],
    }),
    []
  );

  const sidePanel = (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/15 bg-[#03150f]/85 p-5 space-y-3">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
          Quick access
        </p>
        <p className="text-lg font-semibold text-white">
          ATTS Support Desk
        </p>
        <p className="text-sm text-white/70">
          We aim to confirm every message within one business day. Emergency
          calls are routed instantly.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href="tel:8709308000"
            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 min-h-[44px]"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(52, 211, 153, 1) 0%, rgba(5, 5, 5, 0.5) 100%)',
              boxShadow: '0px 10px 15px -0.54px rgba(16, 185, 129, 0.45), 0px 4px 6px -4px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Phone className="w-4 h-4" />
            Call emergency hotline
          </a>
          <a
            href="mailto:support@alltts.com"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/90 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 min-h-[44px]"
          >
            <Mail className="w-4 h-4" />
            Email support@alltts.com
          </a>
        </div>
        <p className="text-xs text-white/60">
          Response window: <span className="font-semibold">24–48h.</span> Please
          note urgent items in the subject line.
        </p>
      </div>

      <div 
        className="rounded-3xl border border-white/10 bg-[#041b14]/85 p-5 space-y-3"
        style={{ boxShadow: 'inset 0px 4px 20px 15px rgba(0, 0, 0, 0.45)' }}
      >
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
          HQ & mail
        </p>
        <div className="flex items-start gap-3 text-white/80">
          <MapPin className="w-5 h-5 text-emerald-300" />
          <div>
            <p>5399 US-65</p>
            <p>Harrison, AR 72601</p>
          </div>
        </div>
        <p className="text-xs text-white/60">
          Deliveries accepted weekdays 8a–5p. Call ahead for oversized freight.
        </p>
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Contact Management & HR">
      <AdminPremiumScaffold
        hero={heroConfig}
        theme="emerald"
        sidePanel={sidePanel}
      >
        <div className="space-y-10">
          <section 
            className="rounded-3xl border border-white/10 bg-[#03150f]/80 p-6 backdrop-blur"
            style={{
              background: 'linear-gradient(90deg, rgba(3, 21, 15, 0.8) 0%, rgba(16, 66, 42, 1) 100%)',
              boxShadow: '0px 4px 25px 8px rgba(0, 0, 0, 0.85)'
            }}
          >
            <div className="grid gap-6 md:grid-cols-2">
              {CONTACT_CHANNELS.map((channel) => (
                <article
                  key={channel.title}
                  className="rounded-2xl border border-white/10 bg-black/30 p-5 text-white/90 hover:border-emerald-400/40 transition"
                  style={{
                    boxShadow: '0px 4px 25px 20px rgba(0, 0, 0, 0.75)'
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
                        {channel.owner}
                      </p>
                      <h3 className="text-xl font-semibold text-white">
                        {channel.title}
                      </h3>
                    </div>
                    <Headphones className="w-8 h-8 text-emerald-200" />
                  </div>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <dt className="text-white/60 mt-1">
                        <Phone className="w-4 h-4" />
                      </dt>
                      <dd>
                        <p className="text-white/60 text-xs uppercase">
                          Phone
                        </p>
                        <a
                          href={channel.phoneHref}
                          className="text-base font-semibold text-emerald-200 hover:text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 min-h-[44px] inline-flex items-center gap-2"
                        >
                          {channel.phone}
                        </a>
                      </dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <dt className="text-white/60 mt-1">
                        <Mail className="w-4 h-4" />
                      </dt>
                      <dd>
                        <p className="text-white/60 text-xs uppercase">
                          Email
                        </p>
                        <a
                          href={channel.emailHref}
                          className="break-all text-base font-semibold text-emerald-200 hover:text-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 min-h-[44px] inline-flex items-center gap-2"
                        >
                          {channel.email}
                        </a>
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <ContactForm userId={user?.id ?? null} />
          <LazyMap />
        </div>
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}

interface ContactFormProps {
  userId: string | null;
}

function ContactForm({ userId }: ContactFormProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    topic: "general",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [showConfetti, setShowConfetti] = useState(false);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Please enter your first and last name.";
    if (!form.email.trim()) nextErrors.email = "Email is required.";
    if (form.email && !COMPANY_EMAIL_REGEX.test(form.email.trim())) {
      nextErrors.email = "Enter a valid company email (name@alltts.com).";
    }
    if (!form.message.trim()) nextErrors.message = "Tell us a little about the request.";
    return nextErrors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setStatus("loading");
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        topic: form.topic,
        message: form.message.trim(),
        user_id: userId,
        submitted_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("contact_requests").insert(payload);
      if (error) throw error;

      setStatus("success");
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
      setForm({ name: "", email: "", topic: "general", message: "" });
    } catch (err) {
      logger.error("[Contact] failed to submit request", err);
      setStatus("error");
      setErrors({
        form: "Unable to send your message right now. Please try again or use the hotline.",
      });
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  return (
    <section 
      className="rounded-3xl border border-white/10 bg-[#04150f]/85 p-6 space-y-6"
      style={{
        background: 'linear-gradient(90deg, rgba(4, 21, 15, 0.85) 0%, rgba(16, 66, 42, 0.85) 100%)',
        boxShadow: 'inset 0px 4px 35px 15px rgba(0, 0, 0, 0.85), 0px 4px 25px 8px rgba(0, 0, 0, 0.85)'
      }}
    >
      <div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Mail className="w-5 h-5 text-emerald-300" />
          Send a note to the team
        </h3>
        <p className="text-sm text-white/70">
          We route requests automatically. Expect a confirmation email shortly
          after sending.
        </p>
      </div>
      {errors.form && (
        <p className="text-sm text-red-300" role="alert">
          {errors.form}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-semibold text-white/80 mb-1"
          >
            Full name
          </label>
          <input
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white placeholder:text-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            placeholder="Jane Crewlead"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <p id="name-error" className="mt-1 text-sm text-red-300">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-white/80 mb-1"
          >
            Company email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white placeholder:text-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            placeholder="name@alltts.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-sm text-red-300">
              {errors.email}
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="topic"
              className="block text-sm font-semibold text-white/80 mb-1"
            >
              Topic
            </label>
            <select
              id="topic"
              name="topic"
              value={form.topic}
              onChange={handleChange}
              className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              <option value="general">General question</option>
              <option value="hr">Human Resources</option>
              <option value="safety">Safety or field ops</option>
              <option value="payroll">Payroll / benefits</option>
            </select>
          </div>
          <div className="text-sm text-white/70">
            <p className="font-semibold text-white">Response time</p>
            <p>Most messages see a reply in 24–48 hours.</p>
            <p className="mt-1">
              Emergencies? Call the hotline for immediate routing.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="message"
            className="block text-sm font-semibold text-white/80 mb-1"
          >
            Message
          </label>
          <textarea
            id="message"
            name="message"
            value={form.message}
            onChange={handleChange}
            rows={5}
            className="w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-white placeholder:text-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            placeholder="Share details so we can route your request."
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? "message-error" : undefined}
          />
          {errors.message && (
            <p id="message-error" className="mt-1 text-sm text-red-300">
              {errors.message}
            </p>
          )}
        </div>

        <div className="relative">
          <button
            type="submit"
            disabled={status === "loading"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-[#02150d] shadow-lg shadow-emerald-500/40 transition hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
            style={{
              background: 'linear-gradient(90deg, rgba(16, 66, 42, 0.85) 5%, rgba(52, 211, 153, 1) 50%, rgba(16, 66, 42, 1) 100%)'
            }}
          >
            {status === "loading" ? (
              "Sending..."
            ) : status === "success" ? (
              <>
                <span>Sent!</span>
              </>
            ) : status === "error" ? (
              "Retry"
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send message
              </>
            )}
          </button>
          {showConfetti && <ConfettiBurst />}
        </div>
        {status === "success" && (
          <p className="text-sm text-emerald-200" role="status">
            Thanks! We&apos;ll confirm by email and follow up shortly.
          </p>
        )}
      </form>
    </section>
  );
}

function ConfettiBurst() {
  const colors = ["#34d399", "#6ee7b7", "#bef264", "#fef3c7", "#bae6fd"];
  const pieces = useMemo(
    () =>
      Array.from({ length: 14 }).map(() => ({
        left: Math.random() * 100,
        distance: 60 + Math.random() * 40,
        rotation: Math.random() * 160,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece, index) => (
        <motion.span
          key={index}
          className="absolute block rounded-full"
          style={{
            width: 6,
            height: 12,
            left: `${piece.left}%`,
            top: 0,
            backgroundColor: colors[index % colors.length],
          }}
          initial={{ opacity: 1, y: 0, rotate: 0 }}
          animate={{
            opacity: 0,
            y: piece.distance,
            rotate: piece.rotation,
          }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function LazyMap() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="rounded-3xl border border-white/10 bg-[#03150f]/85 p-6 space-y-4"
      style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(3, 21, 15, 0.85) 60%, rgba(26, 102, 74, 1) 100%)',
        boxShadow: 'inset 0px 4px 25px 15px rgba(0, 0, 0, 0.85), 0px 4px 25px 8px rgba(0, 0, 0, 0.85)'
      }}
    >
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-emerald-300" />
        <h3 className="text-lg font-bold text-white">HQ map</h3>
      </div>
      {visible ? (
        <div className="h-72 w-full overflow-hidden rounded-2xl border border-white/15">
          <iframe
            title="ATTS HQ map"
            src="https://maps.google.com/maps?q=5399%20US-65%20Harrison%20AR%2072601&t=&z=13&ie=UTF8&iwloc=&output=embed"
            loading="lazy"
            className="h-full w-full"
          />
        </div>
      ) : (
        <div className="h-72 w-full rounded-2xl border border-white/15 bg-black/30 animate-pulse" />
      )}
      <p className="text-sm text-white/70">
        Tap “Directions” inside the map to open in your default navigation app.
      </p>
    </section>
  );
}
