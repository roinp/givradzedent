const MONTHS = [
  "იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი",
  "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი",
];
export const WEEKDAYS_SHORT = ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვი"];

export function monthName(m: number) {
  return MONTHS[m];
}

/** Local date as YYYY-MM-DD (avoids UTC shifts from toISOString). */
export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}, ${y}`;
}

export function formatTime(t: string | null) {
  return t ? t.slice(0, 5) : "—";
}

export function formatPrice(p: number | null) {
  return `${Number(p ?? 0).toFixed(2)} ₾`;
}

export function fullName(p?: { first_name: string; last_name: string } | null) {
  return p ? `${p.first_name} ${p.last_name}` : "—";
}

export function age(dob: string | null) {
  if (!dob) return null;
  const b = new Date(dob);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}
