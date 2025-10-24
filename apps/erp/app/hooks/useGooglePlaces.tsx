import { useState, useCallback, useRef } from "react";
import { nanoid } from "nanoid";
import { GOOGLE_PLACES_API_KEY } from "@carbon/auth";

interface PlaceSuggestion {
  placeId: string;
  text: string;
}

interface AddressComponents {
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
}

interface GooglePlacesApiResponse {
  suggestions?: Array<{
    placePrediction?: {
      place: string;
      placeId: string;
      text: {
        text: string;
      };
    };
  }>;
}

interface PlaceDetailsResponse {
  addressComponents?: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }>;
}

export const useGooglePlaces = () => {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef = useRef<string>(nanoid());

  const getSuggestions = useCallback(async (input: string) => {
    if (!GOOGLE_PLACES_API_KEY) {
      setError("Google Places API key not configured");
      return;
    }

    if (!input) {
      setSuggestions([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
          },
          body: JSON.stringify({
            input,
            includedPrimaryTypes: ["street_address"],
            languageCode: "en",
            sessionToken: sessionTokenRef.current,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status}`);
      }

      const data: GooglePlacesApiResponse = await response.json();

      const placeSuggestions: PlaceSuggestion[] = (data.suggestions || [])
        .map((suggestion) => {
          const prediction = suggestion.placePrediction;
          if (!prediction) return null;

          return {
            placeId: prediction.placeId,
            text: prediction.text.text,
          };
        })
        .filter(
          (suggestion): suggestion is PlaceSuggestion => suggestion !== null
        );

      setSuggestions(placeSuggestions);
    } catch (err) {
      console.error("Google Places API error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch suggestions"
      );
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<AddressComponents | null> => {
      if (!GOOGLE_PLACES_API_KEY) {
        setError("Google Places API key not configured");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `https://places.googleapis.com/v1/places/${placeId}?sessionToken=${sessionTokenRef.current}`,
          {
            headers: {
              "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
              "X-Goog-FieldMask": "addressComponents",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Google Places API error: ${response.status}`);
        }

        const data: PlaceDetailsResponse = await response.json();

        if (!data.addressComponents) {
          throw new Error("No address components found");
        }

        return parseAddressComponents(data.addressComponents);
      } catch (err) {
        console.error("Google Places API error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch place details"
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const parseAddressComponents = (
    components: Array<{ longText: string; shortText: string; types: string[] }>
  ): AddressComponents => {
    // console.debug("components");
    // console.debug(components);
    if (!components) {
      return {
        addressLine1: "",
        addressLine2: "",
        city: "",
        stateProvince: "",
        postalCode: "",
        countryCode: "",
      };
    }

    const addressMap: Record<string, string> = {};

    components.forEach((component) => {
      const types = component.types;

      if (types.includes("street_number")) {
        addressMap.streetNumber = component.longText;
      }
      if (types.includes("route")) {
        addressMap.route = component.longText;
      }
      if (types.includes("subpremise")) {
        addressMap.subpremise = component.longText;
      }
      if (types.includes("locality")) {
        addressMap.city = component.longText;
      }
      if (types.includes("sublocality")) {
        addressMap.sublocality = component.longText;
      }
      if (types.includes("administrative_area_level_1")) {
        addressMap.stateProvince = component.shortText;
      }
      if (types.includes("postal_code")) {
        addressMap.postalCode = component.longText;
      }
      if (types.includes("country")) {
        addressMap.countryCode = component.shortText;
      }
    });

    return {
      addressLine1: `${addressMap.streetNumber || ""} ${
        addressMap.route || ""
      }`.trim(),
      addressLine2: addressMap.subpremise || "",
      city: addressMap.city || addressMap.sublocality || "",
      stateProvince: addressMap.stateProvince || "",
      postalCode: addressMap.postalCode || "",
      countryCode: addressMap.countryCode || "",
    };
  };

  const selectPlace = useCallback(
    async (placeId: string): Promise<AddressComponents | null> => {
      const addressComponents = await getPlaceDetails(placeId);
      setSuggestions([]); // Clear suggestions after selection

      // Generate a new session token for the next autocomplete session
      sessionTokenRef.current = nanoid();

      return addressComponents;
    },
    [getPlaceDetails]
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
  }, []);

  return {
    suggestions,
    loading,
    error,
    getSuggestions,
    selectPlace,
    clearSuggestions,
  };
};
