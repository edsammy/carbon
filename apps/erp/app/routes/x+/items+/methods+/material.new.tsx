import { assertIsPost, error } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { flash } from "@carbon/auth/session.server";
import { validationError, validator } from "@carbon/form";
import { json, type ActionFunctionArgs } from "@vercel/remix";
import { methodMaterialValidator, upsertMethodMaterial } from "~/modules/items";
import { setCustomFields } from "~/utils/form";

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    create: "parts",
  });

  const formData = await request.formData();
  const validation = await validator(methodMaterialValidator).validate(
    formData
  );

  if (validation.error) {
    return validationError(validation.error);
  }

  const insertMethodMaterial = await upsertMethodMaterial(client, {
    ...validation.data,
    companyId,
    createdBy: userId,
    customFields: setCustomFields(formData),
  });

  if (insertMethodMaterial.error) {
    return json(
      {
        id: null,
      },
      await flash(
        request,
        error(insertMethodMaterial.error, "Failed to insert method material")
      )
    );
  }

  const methodMaterialId = insertMethodMaterial.data?.id;
  if (!methodMaterialId) {
    return json(
      {
        id: null,
      },
      await flash(
        request,
        error(insertMethodMaterial, "Failed to insert method material")
      )
    );
  }

  return json({ id: methodMaterialId });
}
