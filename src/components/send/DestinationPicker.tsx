"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { countryDisplayName, countryName } from "@/lib/countryDisplay";
import type { GlobalSendCorridor } from "@/lib/globalSend";
import { REGION_LABEL, REGION_ORDER, regionOf } from "@/lib/regions";
import { OptionItem, PickerTrigger } from "./OptionList";

/** The destination country & currency: a trigger, and a searchable list of
 * the server's corridors grouped by continent. */
export function DestinationPicker({
  corridors,
  value,
  onChange,
}: {
  corridors: GlobalSendCorridor[];
  value: string;
  onChange: (country: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Destinations by continent, filtered by what the sender types: a country's
  // name or code, its currency, or the continent itself ("Africa").
  const [search, setSearch] = useState("");
  const corridor = corridors.find((c) => c.country === value);

  const sections = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = corridors.filter((c) => {
      if (!term) return true;
      const region = REGION_LABEL[regionOf(c.country, c.region)];
      return [countryDisplayName(c.country), c.country, c.currency, region].some((text) =>
        text.toLowerCase().includes(term),
      );
    });
    return REGION_ORDER.map((region) => ({
      region,
      items: matches
        .filter((c) => regionOf(c.country, c.region) === region)
        .sort((a, b) => countryName(a.country).localeCompare(countryName(b.country))),
    })).filter((section) => section.items.length > 0);
  }, [corridors, search]);

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  return (
    <>
      <PickerTrigger
        label="Destination Country & Currency"
        value={value ? `${countryDisplayName(value)}${corridor ? ` (${corridor.currency})` : ""}` : null}
        placeholder="Select destination"
        onClick={() => setOpen(true)}
      />
      <Modal open={open} onClose={close} title="Select Destination Country">
        <input
          className="input mb-3"
          type="search"
          placeholder="Search a country, currency or continent"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoCorrect="off"
          aria-label="Search destinations"
        />
        {sections.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">No destination matches “{search.trim()}”.</p>
        )}
        {sections.map((section) => (
          <div key={section.region} className="mb-2">
            <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">
              {REGION_LABEL[section.region]}
            </p>
            {section.items.map((c) => (
              <OptionItem
                key={c.country}
                active={c.country === value}
                onClick={() => {
                  onChange(c.country);
                  close();
                }}
              >
                {countryDisplayName(c.country)} ({c.currency})
              </OptionItem>
            ))}
          </div>
        ))}
      </Modal>
    </>
  );
}
