function normalizeDocument(value: string, allowLetters: boolean): string | null {
  const normalized = value.trim().toUpperCase();
  const allowedCharacters = allowLetters ? /^[A-Z0-9./-]+$/ : /^[0-9./-]+$/;
  if (!allowedCharacters.test(normalized)) return null;
  return normalized.replace(/[./-]/g, "");
}

function calculateCpfDigit(value: string): string {
  const sum = [...value].reduce(
    (total, digit, index) => total + Number(digit) * (value.length + 1 - index),
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? "0" : String(11 - remainder);
}

export function isValidCpf(value: string): boolean {
  const digits = normalizeDocument(value, false);
  if (!digits || !/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  return digits[9] === calculateCpfDigit(digits.slice(0, 9)) &&
    digits[10] === calculateCpfDigit(digits.slice(0, 10));
}

function calculateCnpjDigit(value: string): string {
  let sum = 0;
  let weight = 2;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    sum += (value.charCodeAt(index) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  return remainder < 2 ? "0" : String(11 - remainder);
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeDocument(value, true);
  if (!cnpj || !/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^([A-Z0-9])\1{13}$/.test(cnpj)) {
    return false;
  }
  const firstDigit = calculateCnpjDigit(cnpj.slice(0, 12));
  const secondDigit = calculateCnpjDigit(`${cnpj.slice(0, 12)}${firstDigit}`);
  return cnpj.slice(12) === `${firstDigit}${secondDigit}`;
}

export function isValidCpfOrCnpj(value: string): boolean {
  const document = normalizeDocument(value, true);
  if (!document) return false;
  return document.length === 11
    ? isValidCpf(document)
    : document.length === 14 && isValidCnpj(document);
}
