import { Heading, cn } from "@carbon/react";
import { useMode } from "@carbon/remix";
import { getLocalTimeZone } from "@internationalized/date";
import { useLocale } from "@react-aria/i18n";
import { useMemo, type ComponentProps } from "react";
import { useUser } from "~/hooks";

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
  let logo = mode === "dark" ? company?.logoDark : company?.logoLight;
  if (!logo) {
    logo = mode === "dark" ? "/carbon-word-dark.svg" : "/carbon-word-light.svg";
  }

  return (
    <div className="p-8 w-full flex flex-col h-[calc(100dvh-var(--header-height)*2)] bg-muted">
      <Heading size="h3">Hello, {user.firstName}</Heading>
      <Subheading>{formatter.format(date)}</Subheading>
      <div className="flex flex-col flex-grow items-center justify-center p-8">
        <img
          src={logo}
          alt="Carbon"
          className="max-w-lg -mt-[var(--header-height)]"
        />
      </div>
    </div>
  );
}

const Subheading = ({ children, className }: ComponentProps<"p">) => (
  <p className={cn("text-muted-foreground text-base font-light", className)}>
    {children}
  </p>
);
