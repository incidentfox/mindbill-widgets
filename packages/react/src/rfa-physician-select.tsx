"use client";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type { RfaClient, RfaCreationProvider } from "@mindbill/browser";
import { Select, type SelectOption } from "./form-controls";

/** How a treating physician reads in every physician list: name, then specialty and NPI. */
export function rfaPhysicianOptions(providers: readonly RfaCreationProvider[]): SelectOption[] {
  return providers.map(provider => {
    const detail = [provider.specialty, provider.npi ? `NPI ${provider.npi}` : ""].filter(Boolean).join(" · ");
    return { value: provider.id, label: provider.name, ...(detail ? { description: detail } : {}) };
  });
}

type Props = {
  /** The chosen physician's id, or with `allowCustom` a name typed for a physician outside the list. */ value: string;
  onChange: (value: string, provider: RfaCreationProvider | undefined) => void;
  /** Physicians the host already loaded. Leave out and pass `client` to search the organization's saved physicians. */ providers?: readonly RfaCreationProvider[] | undefined;
  client?: Pick<RfaClient, "getCreationContext"> | undefined;
  /** Search the host's list (with `providers`); called as the search text changes. */ onSearch?: ((query: string) => void) | undefined;
  loading?: boolean | undefined; error?: string | undefined;
  /** Allow a physician who is not saved; the typed name becomes the value. */ allowCustom?: boolean | undefined;
  label?: string | undefined; "aria-label"?: string | undefined; placeholder?: string | undefined; searchable?: boolean | undefined;
  disabled?: boolean | undefined; required?: boolean | undefined; name?: string | undefined; id?: string | undefined;
};

/** The organization's treating (rendering) physicians as one searchable list, used wherever a physician is chosen. */
export function RfaPhysicianSelect({ value, onChange, providers, client, onSearch, loading, error, allowCustom, label = "Physician", placeholder = "Choose a physician", searchable = true, ...rest }: Props): ReactElement {
  const [query, setQuery] = useState(""); const [loaded, setLoaded] = useState<RfaCreationProvider[]>([]);
  const [busy, setBusy] = useState(false); const [failure, setFailure] = useState("");
  const known = useRef(new Map<string, RfaCreationProvider>());
  useEffect(() => {
    if (providers || !client) return;
    let active = true; setBusy(true);
    const timer = setTimeout(() => {
      client.getCreationContext({ limit: 100, providerSearch: query.trim() })
        .then(context => { if (active) { setLoaded(context.renderingProviders); setFailure(""); } })
        .catch(() => { if (active) setFailure("Saved physicians could not be loaded. Type the physician's name instead."); })
        .finally(() => { if (active) setBusy(false); });
    }, query ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [client, providers, query]);
  const list = providers ?? loaded;
  for (const provider of list) known.current.set(provider.id, provider);
  const options = useMemo(() => {
    const shown = rfaPhysicianOptions(list);
    // Keep the chosen physician readable when a search no longer lists them.
    const chosen = known.current.get(value);
    if (chosen && !list.some(provider => provider.id === value)) shown.push({ ...rfaPhysicianOptions([chosen])[0]!, hidden: true });
    return shown;
  }, [list, value]);
  return <Select {...rest} label={label} placeholder={placeholder} searchable={searchable} allowEmpty allowCustom={allowCustom} value={value} options={options}
    searchPlaceholder={allowCustom ? "Search physicians or type a name" : "Search physicians by name or NPI"}
    loading={loading ?? busy} error={error ?? (failure && !allowCustom ? failure : undefined)}
    onSearch={providers ? onSearch : setQuery} {...(providers && !onSearch ? { filter: true } : {})}
    onChange={next => onChange(next, known.current.get(next))} />;
}
