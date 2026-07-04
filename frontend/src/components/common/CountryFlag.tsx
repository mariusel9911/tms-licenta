interface CountryFlagProps {
  countryCode: string;
  className?: string;
}

function toFlagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

export function CountryFlag({ countryCode, className }: CountryFlagProps) {
  return (
    <span title={countryCode} className={className}>
      {toFlagEmoji(countryCode)}
    </span>
  );
}
