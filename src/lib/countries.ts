// Supported (KYC-covered) countries for onboarding. Public endpoint, so it
// works pre-auth on the registration screen.
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface Country {
  code: string;
  name: string;
  currency: string;
}

export function useCountries() {
  return useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn: async () => {
      const res = await api.get<{ data?: { countries?: Country[] } }>(
        '/countries',
      );
      return res.data?.countries ?? [];
    },
    staleTime: 24 * 60 * 60 * 1000, // rarely changes
  });
}

/**
 * The fiat currency of a country, read off the server's own country list
 * (`GET /countries`, the same table the backend prices and pays out from)
 * rather than a copy kept in the app. Null when the country is unknown or not
 * one we support -- callers must not substitute a default for that.
 */
export function fiatForCountry(
  countries: readonly Country[],
  country: string | null | undefined,
): string | null {
  if (!country) return null;
  const code = country.toUpperCase();
  return countries.find((c) => c.code.toUpperCase() === code)?.currency ?? null;
}

/** fiatForCountry() over the cached country list. */
export function useFiatForCountry(
  country: string | null | undefined,
): string | null {
  const { data: countries = [] } = useCountries();
  return fiatForCountry(countries, country);
}
