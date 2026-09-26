const RULES: [RegExp, string][] = [
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, '$1 [redacted]'],
  [/\b(api[_-]?key|token|secret|password|passwd|pwd)(["'\s:=]+)[^\s"',;]{4,}/gi, '$1$2[redacted]'],
  [/\b(sk|pk|vck|ghp|gho|xox[abp])[-_][A-Za-z0-9_-]{10,}/g, '[redacted-key]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, '[redacted-jwt]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]'],
  [/\b(?:\d[ -]?){13,19}\b/g, '[redacted-number]'],
  [/\/(Users|home)\/[^/\s]+/g, '/$1/[user]'],
];

export function redact(text: string): string {
  return RULES.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}
