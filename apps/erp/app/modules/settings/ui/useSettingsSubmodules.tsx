import {
  LuBarcode,
  LuCreditCard,
  LuCrown,
  LuFactory,
  LuImage,
  LuLayoutDashboard,
  LuSheet,
  LuShoppingCart,
  LuSquareStack,
  LuWebhook,
  LuWorkflow,
} from "react-icons/lu";
import { usePermissions } from "~/hooks";
import type { AuthenticatedRouteGroup } from "~/types";
import { path } from "~/utils/path";

const settingsRoutes: AuthenticatedRouteGroup[] = [
  {
    name: "Company",
    routes: [
      {
        name: "Company",
        to: path.to.company,
        role: "employee",
        icon: <LuFactory />,
      },
      {
        name: "Payment",
        to: path.to.settingsPayment,
        role: "employee",
        icon: <LuCreditCard />,
        requiresOwnership: true,
      },
      {
        name: "Labels",
        to: path.to.labelsSettings,
        role: "employee",
        icon: <LuBarcode />,
      },
      {
        name: "Logos",
        to: path.to.logos,
        role: "employee",
        icon: <LuImage />,
      },
    ],
  },
  {
    name: "Modules",
    routes: [
      {
        name: "Items",
        to: path.to.itemsSettings,
        role: "employee",
        icon: <LuSquareStack />,
      },
      {
        name: "Purchasing",
        to: path.to.purchasingSettings,
        role: "employee",
        icon: <LuShoppingCart />,
      },
      {
        name: "Production",
        to: path.to.productionSettings,
        role: "employee",
        icon: <LuFactory />,
      },
      {
        name: "Sales",
        to: path.to.salesSettings,
        role: "employee",
        icon: <LuCrown />,
      },
    ],
  },
  {
    name: "System",
    routes: [
      {
        name: "Custom Fields",
        to: path.to.customFields,
        role: "employee",
        icon: <LuLayoutDashboard />,
      },
      {
        name: "Integrations",
        to: path.to.integrations,
        role: "employee",
        icon: <LuWorkflow />,
      },
      {
        name: "Sequences",
        to: path.to.sequences,
        role: "employee",
        icon: <LuSheet />,
      },
      {
        name: "Webhooks",
        to: path.to.webhooks,
        role: "employee",
        icon: <LuWebhook />,
      },
    ],
  },
];

export default function useSettingsSubmodules() {
  const permissions = usePermissions();

  return {
    groups: settingsRoutes
      .filter((group) => {
        const filteredRoutes = group.routes.filter((route) => {
          // Check role permission
          if (route.role && !permissions.is(route.role)) {
            return false;
          }

          return true;
        });

        return filteredRoutes.length > 0;
      })
      .map((group) => ({
        ...group,
        routes: group.routes.filter((route) => {
          // Check role permission
          if (route.role && !permissions.is(route.role)) {
            return false;
          }

          // Check ownership requirement
          if (route.requiresOwnership && !permissions.isOwner()) {
            return false;
          }

          return true;
        }),
      })),
  };
}
