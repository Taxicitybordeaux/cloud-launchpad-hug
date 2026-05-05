// Shared brand styles for Taxi City Bordeaux auth emails.
// Body background is always white per Lovable email guidelines.
export const BRAND = {
  primary: '#c9a34d', // taxi-city gold
  primaryDark: '#0a0a0a',
  textDark: '#0a0a0a',
  textBody: '#444',
  textMuted: '#999',
  divider: '#eee',
}

export const main = { backgroundColor: '#ffffff', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }
export const container = { padding: '32px 28px', maxWidth: '560px' }
export const brandBar = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: '20px',
  fontWeight: 800 as const,
  letterSpacing: '0.04em',
  color: BRAND.primary,
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
}
export const brandTag = {
  fontSize: '11px',
  letterSpacing: '0.3em',
  color: BRAND.textMuted,
  textTransform: 'uppercase' as const,
  margin: '0 0 28px',
}
export const h1 = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: '26px',
  fontWeight: 700 as const,
  color: BRAND.textDark,
  margin: '0 0 18px',
}
export const text = {
  fontSize: '15px',
  color: BRAND.textBody,
  lineHeight: '1.6',
  margin: '0 0 22px',
}
export const link = { color: BRAND.primary, textDecoration: 'underline' }
export const button = {
  backgroundColor: BRAND.primary,
  color: '#0a0a0a',
  fontSize: '14px',
  fontWeight: 700 as const,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  borderRadius: '6px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
export const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '28px',
  fontWeight: 700 as const,
  color: BRAND.textDark,
  letterSpacing: '0.2em',
  margin: '8px 0 28px',
  padding: '14px 18px',
  background: '#f6f1e3',
  borderRadius: '6px',
  display: 'inline-block',
}
export const divider = {
  borderTop: `1px solid ${BRAND.divider}`,
  margin: '32px 0 16px',
}
export const footer = {
  fontSize: '12px',
  color: BRAND.textMuted,
  lineHeight: '1.6',
  margin: '0',
}
