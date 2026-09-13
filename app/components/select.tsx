"use client";
import ReactSelect, { type GroupBase, type StylesConfig } from "react-select";
import "./select.css";

export type SelectOption = { value: string; label: string; isDisabled?: boolean };
export type SelectGroup = { label: string; options: SelectOption[] };

const noStyles: StylesConfig<SelectOption, false, GroupBase<SelectOption>> = {
  control: (base) => ({ ...base, minHeight: 0 }),
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
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: (SelectOption | SelectGroup)[];
  placeholder?: string;
  ariaLabel?: string;
  isClearable?: boolean;
  className?: string;
}) {
  const flat: SelectOption[] = options.flatMap((entry) => ("options" in entry ? entry.options : [entry]));
  const selected = flat.find((option) => option.value === value) ?? null;
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
      isSearchable
      unstyled
      styles={noStyles}
      noOptionsMessage={() => "ไม่พบตัวเลือก"}
    />
  );
}
