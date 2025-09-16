import { Toaster } from "@carbon/react";
import { Outlet, useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@vercel/remix";
import { json, redirect } from "@vercel/remix";

import {
  CarbonProvider,
  getAppUrl,
  getCarbon,
  getCompanies,
  getUser,
} from "@carbon/auth";
import {
  destroyAuthSession,
  requireAuthSession,
} from "@carbon/auth/session.server";
import { useNProgress } from "@carbon/remix";

export async function loader({ request }: LoaderFunctionArgs) {
  const { accessToken, companyId, expiresAt, expiresIn, userId } =
    await requireAuthSession(request, { verify: true });

  // share a client between requests
  const client = getCarbon(accessToken);

  // parallelize the requests
  const [companies, user] = await Promise.all([
    getCompanies(client, userId),
    getUser(client, userId),
  ]);

  if (user.error || !user.data) {
    await destroyAuthSession(request);
  }

  const company = companies.data?.find((c) => c.companyId === companyId);
  if (!company) {
    throw redirect(getAppUrl());
  }

  return json({
    session: {
      accessToken,
      expiresIn,
      expiresAt,
    },
    company,
    companies: companies.data ?? [],
    user: user.data,
  });
}

export default function AuthenticatedRoute() {
  const { session } = useLoaderData<typeof loader>();

  useNProgress();

  return (
    <CarbonProvider session={session}>
      <Outlet />
      <Toaster position="bottom-right" />
    </CarbonProvider>
  );
}
