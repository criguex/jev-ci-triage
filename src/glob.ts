const cache = new Map<string, RegExp>();

function compile(pattern: string): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i]!;
    if (char === '*' && pattern[i + 1] === '*') {
      const slash = pattern[i + 2] === '/';
      source += slash ? '(?:.*/)?' : '.*';
      i += slash ? 2 : 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

export function matches(path: string, pattern: string): boolean {
  let regex = cache.get(pattern);
  if (!regex) {
    regex = compile(pattern);
    cache.set(pattern, regex);
  }
  return regex.test(path);
}

export function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matches(path, pattern));
}
