import { useControlField, useFormContext } from "@carbon/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  useDebounce,
  VStack,
} from "@carbon/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGooglePlaces } from "~/hooks/useGooglePlaces";
import { Input } from ".";
import Country from "./Country";

type AddressFields = {
  autocomplete: React.ReactNode;
  addressLine2: React.ReactNode;
  city: React.ReactNode;
  stateProvince: React.ReactNode;
  postalCode: React.ReactNode;
  country: React.ReactNode;
};

type AddressAutocompleteProps = {
  name?: string;
  label?: string;
  // Optional field name overrides
  addressLine1Name?: string;
  addressLine2Name?: string;
  cityName?: string;
  stateProvinceName?: string;
  postalCodeName?: string;
  countryCodeName?: string;
  // Control which fields to show
  showAddressLine2?: boolean;
  showCity?: boolean;
  showStateProvince?: boolean;
  showPostalCode?: boolean;
  showCountryCode?: boolean;
  // Custom layout via children function
  children?: (fields: AddressFields) => React.ReactNode;
};

const AddressAutocomplete = ({
  name,
  label = "Address Line 1",
  addressLine1Name = "addressLine1",
  addressLine2Name = "addressLine2",
  cityName = "city",
  stateProvinceName = "stateProvince",
  postalCodeName = "postalCode",
  countryCodeName = "countryCode",
  showAddressLine2 = true,
  showCity = true,
  showStateProvince = true,
  showPostalCode = true,
  showCountryCode = true,
  children,
}: AddressAutocompleteProps) => {
  // Use provided name or default to addressLine1Name
  const fieldName = name ?? addressLine1Name;

  const [value, setValue] = useControlField<string>(fieldName);
  const { clearError } = useFormContext();
  const [open, setOpen] = useState(false);
  const [justSelected, setJustSelected] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const addressLine2Ref = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateProvinceRef = useRef<HTMLInputElement>(null);
  const postalCodeRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);

  const {
    suggestions,
    loading,
    getSuggestions,
    selectPlace,
    clearSuggestions,
  } = useGooglePlaces();

  const handleInputChange = useCallback(
    (input: string) => {
      if (input && !justSelected && userInteracted) {
        getSuggestions(input);
        setOpen(true);
      } else {
        clearSuggestions();
        setOpen(false);
      }
    },
    [getSuggestions, clearSuggestions, justSelected, userInteracted]
  );

  const debouncedGetSuggestions = useDebounce(handleInputChange, 300);

  useEffect(() => {
    if (userInteracted) {
      debouncedGetSuggestions(value || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, userInteracted]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = useCallback(
    async (placeId: string) => {
      setOpen(false);
      clearSuggestions();
      setJustSelected(true);

      const address = await selectPlace(placeId);
      if (!address) return;

      setValue(address.addressLine1);

      // Populate remaining address fields via refs
      if (addressLine2Ref.current)
        addressLine2Ref.current.value = address.addressLine2;
      if (cityRef.current) cityRef.current.value = address.city;
      if (stateProvinceRef.current)
        stateProvinceRef.current.value = address.stateProvince;
      if (postalCodeRef.current)
        postalCodeRef.current.value = address.postalCode;
      if (countryRef.current) countryRef.current.value = address.countryCode;

      clearError(
        fieldName,
        addressLine2Name,
        cityName,
        stateProvinceName,
        postalCodeName,
        countryCodeName
      );
    },
    [
      clearSuggestions,
      selectPlace,
      setValue,
      clearError,
      fieldName,
      addressLine2Name,
      cityName,
      stateProvinceName,
      postalCodeName,
      countryCodeName,
    ]
  );

  const handleInputFocus = useCallback(() => {
    setUserInteracted(true);
    if ((value || "").length >= 3 && !justSelected) {
      setOpen(true);
    }
  }, [value, justSelected]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUserInteracted(true);
      setJustSelected(false);
      setValue(e.target.value);
    },
    [setValue]
  );

  const fields: AddressFields = {
    autocomplete: (
      <div className="relative w-full" ref={containerRef}>
        <Input
          name={fieldName}
          label={label}
          value={value || ""}
          onChange={handleChange}
          onFocus={handleInputFocus}
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <div className="absolute w-full mt-1 z-[9999]">
            <div className="rounded-md border bg-popover text-popover-foreground shadow-md p-0">
              <Command shouldFilter={false}>
                <CommandList>
                  <CommandEmpty>
                    {loading ? "Loading..." : "No addresses found"}
                  </CommandEmpty>
                  <CommandGroup>
                    {suggestions.map((suggestion) => (
                      <CommandItem
                        key={suggestion.placeId}
                        value={suggestion.placeId}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelect(suggestion.placeId);
                        }}
                      >
                        {suggestion.text}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          </div>
        )}
      </div>
    ),
    addressLine2: showAddressLine2 ? (
      <Input
        ref={addressLine2Ref}
        name={addressLine2Name}
        label="Address Line 2"
      />
    ) : null,
    city: showCity ? (
      <Input ref={cityRef} name={cityName} label="City" />
    ) : null,
    stateProvince: showStateProvince ? (
      <Input
        ref={stateProvinceRef}
        name={stateProvinceName}
        label="State / Province"
      />
    ) : null,
    postalCode: showPostalCode ? (
      <Input ref={postalCodeRef} name={postalCodeName} label="Postal Code" />
    ) : null,
    country: showCountryCode ? <Country name={countryCodeName} /> : null,
  };

  // If children function provided, use it for custom layout
  if (children) {
    return <>{children(fields)}</>;
  }

  // Default vertical layout
  return (
    <VStack spacing={4}>
      {fields.autocomplete}
      {fields.addressLine2}
      {fields.city}
      {fields.stateProvince}
      {fields.postalCode}
      {fields.country}
    </VStack>
  );
};

export default AddressAutocomplete;
