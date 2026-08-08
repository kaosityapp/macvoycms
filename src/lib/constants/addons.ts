/**
 * Registration add-ons (spec §5 field 11). Prices are ⚠ PLACEHOLDERS — confirm
 * with Debbie. Stored per selection into `order_items` as a one-time charge.
 */
export type AddonChoice = 'none' | 't-shirt' | 'socks' | 't-shirt+socks';

export interface AddonOption {
  value: AddonChoice;
  label: string;
  /** order_items.item_type; null for "none". */
  itemType: string | null;
  amount: number;
}

export const ADDON_OPTIONS: AddonOption[] = [
  { value: 'none', label: 'No add-ons', itemType: null, amount: 0 },
  { value: 't-shirt', label: 'T-shirt', itemType: 't-shirt', amount: 20 },
  { value: 'socks', label: 'Socks', itemType: 'socks', amount: 10 },
  { value: 't-shirt+socks', label: 'T-shirt + Socks', itemType: 't-shirt+socks', amount: 28 },
];

export function getAddon(value: string): AddonOption | undefined {
  return ADDON_OPTIONS.find((o) => o.value === value);
}
