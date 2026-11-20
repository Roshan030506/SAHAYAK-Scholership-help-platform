import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  Database,
  FileClock,
  Fingerprint,
  LockKeyhole,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FadeIn, SectionHeading } from "@/components/ui/Motion";
import { Pill } from "@/components/ui/Badge";
import { useAppStore } from "@/store/app";
import { useToastStore } from "@/store/toast";

export function PrivacyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const deleteMyData = useAppStore((state) => state.deleteMyData);
  const bootstrap = useAppStore((state) => state.bootstrap);
  const pushToast = useToastStore((state) => state.push);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteMyData();
      pushToast(t("toasts.deleteSuccess"), "success");
      setConfirmOpen(false);
      await bootstrap();
      navigate("/");
    } catch {
      pushToast(t("toasts.deleteFailed"), "error");
    } finally {
      setDeleting(false);
    }
  }

  const cards = [
    {
      icon: FileClock,
      title: t("privacy.cards.expiry.title"),
      body: t("privacy.cards.expiry.body"),
      tone: "bg-amber-50 text-amber-700",
    },
    {
      icon: Fingerprint,
      title: t("privacy.cards.noAadhaar.title"),
      body: t("privacy.cards.noAadhaar.body"),
      tone: "bg-teal-50 text-teal-700",
    },
    {
      icon: BadgeCheck,
      title: t("privacy.cards.consent.title"),
      body: t("privacy.cards.consent.body"),
      tone: "bg-emerald-50 text-emerald-700",
    },
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[24rem] garden-sky opacity-60" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <FadeIn className="max-w-3xl">
          <Pill tone="teal" className="bg-white/70 backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t("privacy.eyebrow")}
          </Pill>
          <h1 className="mt-4 font-heading text-[2.2rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-navy sm:text-5xl">
            {t("privacy.title")}
          </h1>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-navy-soft sm:text-base">
            {t("privacy.subtitle")}
          </p>
        </FadeIn>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {cards.map((card, index) => (
            <FadeIn key={card.title} delay={index * 0.06}>
              <Card tone="glass" padding="lg" className="h-full">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.tone}`}>
                  <card.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 font-heading text-base font-bold text-navy">{card.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-navy-soft">{card.body}</p>
              </Card>
            </FadeIn>
          ))}
        </div>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <FadeIn delay={0.08}>
            <Card padding="lg" className="h-full">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy/[0.04] text-navy">
                  <Database className="h-5 w-5" aria-hidden="true" />
                </span>
                <SectionHeading title={t("privacy.whatTitle")} subtitle={t("privacy.whatBody")} />
              </div>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {[
                  { icon: LockKeyhole, label: t("privacy.cards.noAadhaar.title") },
                  { icon: FileClock, label: t("privacy.cards.expiry.title") },
                  { icon: BadgeCheck, label: t("privacy.cards.consent.title") },
                  { icon: ShieldCheck, label: t("footer.privacy") },
                ].map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-2 rounded-xl border border-navy/[0.06] bg-navy/[0.02] px-3 py-2.5 text-xs font-semibold text-navy-soft"
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden="true" />
                    {item.label}
                  </li>
                ))}
              </ul>
            </Card>
          </FadeIn>

          <FadeIn delay={0.12}>
            <Card tone="warm" padding="lg" className="relative overflow-hidden">
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-red-100/60 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 font-heading text-xl font-bold tracking-tight text-navy">
                  {t("privacy.deleteTitle")}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-navy-soft">{t("privacy.deleteBody")}</p>
                <Button
                  variant="danger"
                  className="mt-5"
                  onClick={() => setConfirmOpen(true)}
                  iconLeft={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                >
                  {t("actions.delete")}
                </Button>
                <p className="mt-3 text-[0.68rem] font-medium leading-relaxed text-navy-soft/75">
                  {t("privacy.confirmBody")}
                </p>
              </div>
            </Card>
          </FadeIn>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t("privacy.confirmTitle")}
        body={t("privacy.confirmBody")}
        confirmLabel={deleting ? t("privacy.deleting") : t("privacy.confirmDelete")}
        cancelLabel={t("actions.cancel")}
        busy={deleting}
        onCancel={() => {
          if (!deleting) setConfirmOpen(false);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
