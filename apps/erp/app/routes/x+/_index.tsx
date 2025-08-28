import { Button, Heading, cn } from "@carbon/react";
import { useMode } from "@carbon/remix";
import { getLocalTimeZone } from "@internationalized/date";
import { useLocale } from "@react-aria/i18n";
import { Link } from "@remix-run/react";
import { useMemo, type ComponentProps } from "react";
import { usePermissions, useUser } from "~/hooks";
import { path } from "~/utils/path";

export default function AppIndexRoute() {
  const user = useUser();

  const { locale } = useLocale();
  const date = new Date();

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "full",
        timeZone: getLocalTimeZone(),
      }),
    [locale]
  );

  const { company } = useUser();
  const mode = useMode();
  const permissions = usePermissions();
  let logo = mode === "dark" ? company?.logoDark : company?.logoLight;
  let hasCustomLogo = !!logo;
  if (!logo) {
    logo =
      mode === "dark"
        ? "/carbon-word-only-dark.svg"
        : "/carbon-word-only-light.svg";
  }

  return (
    <div className="p-8 w-full flex flex-col h-[calc(100dvh-var(--header-height)*2)] bg-muted">
      <Heading size="h3">Hello, {user.firstName}</Heading>
      <Subheading>{formatter.format(date)}</Subheading>
      <div className="flex flex-col flex-grow items-center justify-center p-8">
        <div className="flex flex-col items-center justify-center gap-3  -mt-[var(--header-height)] ml-0 md:-ml-[30px]">
          <img src={logo} alt="Carbon" className="max-w-full lg:max-w-lg" />
          {!hasCustomLogo && permissions.can("update", "settings") && (
            <Button asChild size="sm" variant="secondary">
              <Link to={path.to.logos}>Update Logo</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const Subheading = ({ children, className }: ComponentProps<"p">) => (
  <p className={cn("text-muted-foreground text-base font-light", className)}>
    {children}
  </p>
);
