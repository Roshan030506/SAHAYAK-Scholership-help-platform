import { useTranslation } from "react-i18next";
import { ArrowLeft, Sprout } from "lucide-react";

import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FadeIn } from "@/components/ui/Motion";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="relative mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-16 sm:px-6">
      <FadeIn className="w-full">
        <Card tone="glass" padding="lg" className="relative overflow-hidden text-center">
          <div
            className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full bg-teal/10 blur-3xl"
            aria-hidden="true"
          />
          <p className="font-heading text-[5rem] font-extrabold leading-none tracking-[-0.08em] text-navy/[0.08]">
            404
          </p>
          <span className="mx-auto -mt-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-saffron/20 to-teal/10 text-teal ring-1 ring-teal/10">
            <Sprout className="h-8 w-8" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-heading text-2xl font-bold tracking-tight text-navy sm:text-3xl">
            {t("notFound.title")}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-navy-soft">{t("notFound.body")}</p>
          <LinkButton
            to="/"
            className="mt-6"
            iconLeft={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            {t("notFound.cta")}
          </LinkButton>
        </Card>
      </FadeIn>
    </div>
  );
}
