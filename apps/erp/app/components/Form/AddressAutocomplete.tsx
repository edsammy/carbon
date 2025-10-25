import { useControlField, useField, useFormContext } from "@carbon/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInputTextField,
  CommandItem,
  CommandList,
  FormControl,
  FormErrorMessage,
  FormLabel,
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
  children,
}: AddressAutocompleteProps) => {
  // Use provided name or default to addressLine1Name
  const fieldName = name ?? addressLine1Name;

  const [value, setValue] = useControlField<string>(fieldName);
  const { clearError } = useFormContext();
  const { error } = useField(fieldName);
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

  const handleValueChange = useCallback(
    (newValue: string) => {
      setUserInteracted(true);
      setJustSelected(false);
      setValue(newValue);
    },
    [setValue]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab") {
        setOpen(false);
      }
    },
    []
  );

  const fields: AddressFields = {
    autocomplete: (
      <FormControl isInvalid={!!error}>
        <FormLabel htmlFor={fieldName}>{label}</FormLabel>
        <div className="relative w-full" ref={containerRef}>
          <Command shouldFilter={false}>
            <CommandInputTextField
              id={fieldName}
              name={fieldName}
              value={value || ""}
              onValueChange={handleValueChange}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            {open && suggestions.length > 0 && (
              <CommandList className="absolute w-full top-10 z-[9999] rounded-md border bg-popover text-popover-foreground shadow-md p-0">
                <CommandEmpty>
                  {loading ? "Loading..." : "No addresses found"}
                </CommandEmpty>
                <CommandGroup>
                  {suggestions.map((suggestion) => (
                    <CommandItem
                      key={suggestion.placeId}
                      value={suggestion.placeId}
                      className="cursor-pointer"
                      onSelect={() => handleSelect(suggestion.placeId)}
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
            )}
          </Command>
        </div>
        {error && <FormErrorMessage>{error}</FormErrorMessage>}
      </FormControl>
    ),
    addressLine2: (
      <Input
        ref={addressLine2Ref}
        name={addressLine2Name}
        label="Address Line 2"
      />
    ),
    city: <Input ref={cityRef} name={cityName} label="City" />,
    stateProvince: (
      <Input
        ref={stateProvinceRef}
        name={stateProvinceName}
        label="State / Province"
      />
    ),
    postalCode: (
      <Input ref={postalCodeRef} name={postalCodeName} label="Postal Code" />
    ),
    country: <Country name={countryCodeName} />,
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
