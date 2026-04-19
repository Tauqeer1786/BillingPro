export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string) {
  const [y, m, d] = dateString.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}
