import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/layout/Brand";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="mt-20 border-t border-navy/5 bg-white/55">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark className="h-9 w-9 rounded-xl" />
            <div>
              <p className="font-heading text-base font-bold text-navy">{t("brand.name")}</p>
              <p className="text-xs font-medium text-teal">{t("brand.tagline")}</p>
            </div>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-navy-soft">{t("footer.disclaimer")}</p>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-navy-soft/80">{t("footer.madeWith")}</p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <Link
            to="/privacy"
            className="inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal-50/70 px-4 py-2 text-sm font-semibold text-teal-dark transition hover:border-teal/40 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-saffron/30"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {t("footer.privacy")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
