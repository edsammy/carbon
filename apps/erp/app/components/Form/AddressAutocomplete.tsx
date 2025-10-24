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
import { useEffect, useState, useCallback, useRef } from "react";
import { useGooglePlaces } from "~/hooks/useGooglePlaces";
import { Input } from ".";
import Country from "./Country";

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
}: AddressAutocompleteProps) => {
  // Use provided name or default to addressLine1Name
  const fieldName = name ?? addressLine1Name;

  const [value, setValue] = useControlField<string>(fieldName);
  const { clearError } = useFormContext();
  const [open, setOpen] = useState(false);
  const [justSelected, setJustSelected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs to access the input elements directly
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

  // Memoize the callback to prevent recreating the debounced function
  const handleInputChange = useCallback(
    (input: string) => {
      if (input && !justSelected) {
        getSuggestions(input);
        setOpen(true);
      } else {
        clearSuggestions();
        setOpen(false);
      }
    },
    [getSuggestions, clearSuggestions, justSelected]
  );

  // Debounce the API calls to avoid excessive requests
  const debouncedGetSuggestions = useDebounce(handleInputChange, 300);

  // Watch for changes to trigger API calls
  useEffect(() => {
    debouncedGetSuggestions(value || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Handle clicks outside the component
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleSelect = async (placeId: string) => {
    // Close dropdown and clear suggestions immediately
    setOpen(false);
    clearSuggestions();
    setJustSelected(true);

    const address = await selectPlace(placeId);

    if (address) {
      // Populate all address fields
      setValue(address.addressLine1);

      // Set values directly on the input elements
      if (addressLine2Ref.current)
        addressLine2Ref.current.value = address.addressLine2;
      if (cityRef.current) cityRef.current.value = address.city;
      if (stateProvinceRef.current)
        stateProvinceRef.current.value = address.stateProvince;
      if (postalCodeRef.current)
        postalCodeRef.current.value = address.postalCode;
      if (countryRef.current) countryRef.current.value = address.countryCode;

      // Clear validation errors for all populated fields
      clearError(
        fieldName,
        addressLine2Name,
        cityName,
        stateProvinceName,
        postalCodeName,
        countryCodeName
      );
    }
  };

  return (
    <VStack spacing={4}>
      <div className="relative w-full" ref={containerRef}>
        <Input
          name={fieldName}
          label={label}
          value={value || ""}
          onChange={(e) => {
            setJustSelected(false); // Allow new searches when user types
            setValue(e.target.value);
          }}
          onFocus={() => {
            if ((value || "").length >= 3 && !justSelected) {
              setOpen(true);
            }
          }}
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <div className="absolute w-full mt-1" style={{ zIndex: 9999 }}>
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

      {showAddressLine2 && (
        <Input
          ref={addressLine2Ref}
          name={addressLine2Name}
          label="Address Line 2"
        />
      )}
      {showCity && <Input ref={cityRef} name={cityName} label="City" />}
      {showStateProvince && (
        <Input
          ref={stateProvinceRef}
          name={stateProvinceName}
          label="State / Province"
        />
      )}
      {showPostalCode && (
        <Input ref={postalCodeRef} name={postalCodeName} label="Postal Code" />
      )}
      {showCountryCode && <Country name={countryCodeName} />}
    </VStack>
  );
};

export default AddressAutocomplete;
