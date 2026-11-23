/**
 * The fixed recipient fields of a payout (mobile kept each in its own
 * useState). Held together so the form clears in one go after a send.
 */
export interface PayoutFields {
  usPaymentRail: "ACH" | "WIRE";
  beneficiaryName: string;
  routingNumber: string;
  /** China: the bank the card or account belongs to. */
  recipientBank: string;
  accountNumber: string;
  sortCode: string;
  transitNumber: string;
  institutionNumber: string;
  /** The recipient's own address, for corridors whose partner registers the
   * account with one (corridor.addressFields). */
  street: string;
  city: string;
  state: string;
  postal: string;
}

export const EMPTY_PAYOUT_FIELDS: PayoutFields = {
  usPaymentRail: "ACH",
  beneficiaryName: "",
  routingNumber: "",
  recipientBank: "",
  accountNumber: "",
  sortCode: "",
  transitNumber: "",
  institutionNumber: "",
  street: "",
  city: "",
  state: "",
  postal: "",
};

/** Countries with a dedicated, hand-built recipient form. */
export const FIXED_FORM_COUNTRIES = ["US", "GB", "CA", "CN"];

/**
 * The label/placeholder for the one generic "account number" field every
 * corridor without its own dedicated form (US/GB/CA/CN) falls back to. Keyed
 * by currency, not by country: SEPA/CLABE/Pix are standard rail identifiers,
 * the same closed set regardless of which country sends to them.
 */
export const accountNumberLabel = (currency?: string): string => {
  switch (currency) {
    case "EUR":
      return "IBAN";
    case "MXN":
      return "CLABE";
    case "BRL":
      return "Pix Key";
    default:
      return "Account Number";
  }
};

export const accountNumberPlaceholder = (currency?: string): string => {
  switch (currency) {
    case "EUR":
      return "e.g. DE89 3704 0044 0532 0130 00";
    case "MXN":
      return "18-digit CLABE";
    case "BRL":
      return "Pix key: CPF, phone, email, or random key";
    default:
      return "Beneficiary's account number";
  }
};
