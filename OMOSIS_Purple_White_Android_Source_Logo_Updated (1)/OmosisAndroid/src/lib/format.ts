export const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const niceCategory = (value: string) => (value || 'other').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
