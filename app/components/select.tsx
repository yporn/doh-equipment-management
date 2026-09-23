"use client";
import { useEffect, useState } from "react";
import ReactSelect, { type GroupBase, type StylesConfig } from "react-select";
import "./select.css";

export type SelectOption = { value: string; label: string; isDisabled?: boolean };
export type SelectGroup = { label: string; options: SelectOption[] };

const noStyles: StylesConfig<SelectOption, false, GroupBase<SelectOption>> = {
  control: (base) => ({ ...base, minHeight: 0 }),
};
const portalStyles: StylesConfig<SelectOption, false, GroupBase<SelectOption>> = {
  ...noStyles,
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

/**
 * Drop-in replacement for a single-value native <select>, styled to match
 * the app's filter/form inputs. Searchable, supports groups and disabled
 * options. Value/onChange work with plain strings, same as a native select.
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  isClearable = false,
  isSearchable = false,
  className,
  menuPortal = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | SelectGroup)[];
  placeholder?: string;
  ariaLabel?: string;
  isClearable?: boolean;
  isSearchable?: boolean;
  className?: string;
  /** Render the open menu into document.body instead of inline — use inside scrollable/overflow-clipped containers (e.g. a table header) so the list isn't cut off. */
  menuPortal?: boolean;
}) {
  const flat: SelectOption[] = options.flatMap((entry) => ("options" in entry ? entry.options : [entry]));
  const selected = flat.find((option) => option.value === value) ?? null;
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { if (menuPortal) setPortalTarget(document.body); }, [menuPortal]);
  return (
    <ReactSelect<SelectOption, false, GroupBase<SelectOption>>
      aria-label={ariaLabel}
      className={`app-select${className ? ` ${className}` : ""}`}
      classNamePrefix="app-select"
      value={selected}
      onChange={(option) => onChange(option?.value ?? "")}
      options={options}
      placeholder={placeholder ?? "เลือก"}
      isClearable={isClearable}
      isSearchable={isSearchable}
      unstyled
      styles={menuPortal ? portalStyles : noStyles}
      menuPortalTarget={portalTarget}
      menuPosition={menuPortal ? "fixed" : undefined}
      noOptionsMessage={() => "ไม่พบตัวเลือก"}
    />
  );
}
