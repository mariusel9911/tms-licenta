import axios from 'axios';

export interface ViesResult {
  name: string;
  address: string;
}

interface ViesApiResponse {
  isValid: boolean;
  name: string;
  address: string;
  userError?: string;
}

const VAT_REGEX = /^[A-Z]{2}[A-Z0-9]{2,12}$/i;

export async function lookupVies(vat: string): Promise<ViesResult | null> {
  if (!vat || !VAT_REGEX.test(vat)) {
    return null;
  }

  const countryCode = vat.slice(0, 2).toUpperCase();
  const bareVat = vat.slice(2);

  try {
    const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${bareVat}`;

    const response = await axios.get<ViesApiResponse>(url, {
      timeout: 10000,
    });

    const data = response.data;

    if (!data.isValid) {
      return null;
    }

    return {
      name: data.name ?? '',
      address: data.address ?? '',
    };
  } catch {
    // VIES can be slow or unavailable — graceful fallback
    return null;
  }
}
