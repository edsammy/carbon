import {
  Button,
  HStack,
  ModalDrawer,
  ModalDrawerBody,
  ModalDrawerContent,
  ModalDrawerFooter,
  ModalDrawerHeader,
  ModalDrawerProvider,
  ModalDrawerTitle,
  VStack,
} from "@carbon/react";

import { ValidatedForm } from "@carbon/form";
import { useFetcher } from "@remix-run/react";
import type { z } from "zod";
import {
  AddressAutocomplete,
  CustomFormFields,
  Hidden,
  Input,
  Submit,
} from "~/components/Form";
import { usePermissions } from "~/hooks";
import { path } from "~/utils/path";
import { customerLocationValidator } from "../../sales.models";

type CustomerLocationFormProps = {
  customerId: string;
  initialValues: z.infer<typeof customerLocationValidator>;
  type?: "modal" | "drawer";
  open?: boolean;
  onClose: () => void;
};

const CustomerLocationForm = ({
  customerId,
  initialValues,
  open = true,
  type = "drawer",
  onClose,
}: CustomerLocationFormProps) => {
  const fetcher = useFetcher<{}>();

  const permissions = usePermissions();
  const isEditing = !!initialValues?.id;
  const isDisabled = isEditing
    ? !permissions.can("update", "sales")
    : !permissions.can("create", "sales");

  return (
    <ModalDrawerProvider type={type}>
      <ModalDrawer
        open={open}
        onOpenChange={(open) => {
          if (!open) onClose?.();
        }}
      >
        <ModalDrawerContent>
          <ValidatedForm
            validator={customerLocationValidator}
            method="post"
            action={
              isEditing
                ? path.to.customerLocation(customerId, initialValues.id!)
                : path.to.newCustomerLocation(customerId)
            }
            defaultValues={initialValues}
            fetcher={fetcher}
            onSubmit={() => {
              if (type === "modal") {
                onClose?.();
              }
            }}
            className="flex flex-col h-full"
          >
            <ModalDrawerHeader>
              <ModalDrawerTitle>
                {isEditing ? "Edit" : "New"} Location
              </ModalDrawerTitle>
            </ModalDrawerHeader>
            <ModalDrawerBody>
              <Hidden name="id" />
              <Hidden name="type" value={type} />
              <Hidden name="addressId" />
              <VStack spacing={4}>
                <Input name="name" label="Name" />
                <AddressAutocomplete />
                <CustomFormFields table="customerLocation" />
              </VStack>
            </ModalDrawerBody>
            <ModalDrawerFooter>
              <HStack>
                <Submit isDisabled={isDisabled}>Save</Submit>
                <Button size="md" variant="solid" onClick={onClose}>
                  Cancel
                </Button>
              </HStack>
            </ModalDrawerFooter>
          </ValidatedForm>
        </ModalDrawerContent>
      </ModalDrawer>
    </ModalDrawerProvider>
  );
};

export default CustomerLocationForm;
