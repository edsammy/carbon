import { ValidatedForm } from "@carbon/form";
import { VStack } from "@carbon/react";
import type { z } from "zod";
import { Currency, Hidden, Input, Submit } from "~/components/Form";
import AddressAutocomplete from "~/components/Form/AddressAutocomplete";
import { companyValidator } from "~/modules/settings";
import { path } from "~/utils/path";

type CompanyFormProps = {
  company: z.infer<typeof companyValidator>;
};

const CompanyForm = ({ company }: CompanyFormProps) => {
  return (
    <>
      <ValidatedForm
        method="post"
        action={path.to.company}
        validator={companyValidator}
        defaultValues={company}
      >
        <Hidden name="intent" value="about" />

        <VStack spacing={4}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <Input name="name" label="Company Name" />
            <Input name="taxId" label="Tax ID" />
            <AddressAutocomplete>
              {({
                autocomplete,
                addressLine2,
                city,
                stateProvince,
                postalCode,
                country,
              }) => (
                <>
                  {autocomplete}
                  {addressLine2}
                  {city}
                  {stateProvince}
                  {postalCode}
                  {country}
                </>
              )}
            </AddressAutocomplete>
            <Currency
              name="baseCurrencyCode"
              label="Base Currency"
              disabled={true}
            />
            <Input name="phone" label="Phone Number" />
            <Input name="fax" label="Fax Number" />
            <Input name="email" label="Email" />
            <Input name="website" label="Website" />
          </div>
          <Submit>Save</Submit>
        </VStack>
      </ValidatedForm>
    </>
  );
};

export default CompanyForm;
