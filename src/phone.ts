export const normalizePhone = (value: string) => value.replaceAll('-', '')

export function formatPhone(value: string) {
 const digits = normalizePhone(value)
 if (/^02\d{8}$/.test(digits)) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '$1-$2-$3')
 if (/^0\d{10}$/.test(digits)) return digits.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3')
 if (/^0\d{9}$/.test(digits)) return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')
 return value
}
