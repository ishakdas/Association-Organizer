import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Link,
} from '@react-email/components';

const colors = {
  primary: '#FCC200',
  primaryDark: '#E5AD00',
  bg: '#f0efe8',
  cardBg: '#ffffff',
  headerBg: '#1a1a1a',
  textPrimary: '#1a1a1a',
  textSecondary: '#555555',
  textMuted: '#888888',
  border: '#e0ddd5',
  footerBg: '#f5f5f0',
  accentBar: '#FCC200',
};

interface BaseTemplateProps {
  preview?: string;
  children: React.ReactNode;
}

export function BaseTemplate({ preview, children }: BaseTemplateProps) {
  return (
    <Html lang="tr">
      <Head />
      {preview && <Preview>{preview}</Preview>}
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={logoStyle}>Defter-i Hilal</Text>
            <Text style={taglineStyle}>Organizasyon Yönetim Sistemi</Text>
          </Section>

          <Section style={accentBarStyle} />

          <Section style={bodyContentStyle}>{children}</Section>

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Bu e-posta Defter-i Hilal Organizasyon Yönetim Sistemi tarafından otomatik olarak gönderilmiştir.
              <br />
              Lütfen bu e-postayı yanıtlamayın.
            </Text>
            <Text style={footerDomainStyle}>
              defterihilal.com
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

interface ContentBlockProps {
  heading: string;
  greeting?: string;
  children: React.ReactNode;
  note?: string;
}

export function ContentBlock({ heading, greeting, children, note }: ContentBlockProps) {
  return (
    <>
      <Heading style={headingStyle}>{heading}</Heading>
      {greeting && <Text style={textStyle}>{greeting}</Text>}
      {children}
      {note && (
        <>
          <Hr style={hrStyle} />
          <Text style={noteStyle}>{note}</Text>
        </>
      )}
    </>
  );
}

export function CtaButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section style={buttonSectionStyle}>
      <Link href={href} style={buttonStyle}>
        {children}
      </Link>
    </Section>
  );
}

export function FallbackLink({ href }: { href: string }) {
  return (
    <>
      <Text style={fallbackLabelStyle}>
        Buton çalışmazsa aşağıdaki bağlantıyı tarayıcınıza kopyalayabilirsiniz:
      </Text>
      <Text style={linkStyle}>
        <Link href={href} style={linkAnchorStyle}>
          {href}
        </Link>
      </Text>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const bodyStyle: React.CSSProperties = {
  margin: 0,
  padding: '40px 16px',
  backgroundColor: colors.bg,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 560,
  margin: '0 auto',
  backgroundColor: colors.cardBg,
  borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  backgroundColor: colors.headerBg,
  padding: '32px 40px 24px',
  textAlign: 'center',
};

const logoStyle: React.CSSProperties = {
  margin: 0,
  color: colors.primary,
  fontSize: 26,
  fontWeight: 800,
  letterSpacing: '0.04em',
};

const taglineStyle: React.CSSProperties = {
  margin: '6px 0 0',
  color: '#cccccc',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
};

const accentBarStyle: React.CSSProperties = {
  height: 4,
  backgroundColor: colors.accentBar,
};

const bodyContentStyle: React.CSSProperties = {
  padding: '40px',
  color: colors.textPrimary,
  fontSize: 15,
  lineHeight: 1.6,
};

const footerStyle: React.CSSProperties = {
  backgroundColor: colors.footerBg,
  padding: '24px 40px',
  borderTop: `1px solid ${colors.border}`,
  textAlign: 'center',
};

const footerTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: colors.textMuted,
};

const footerDomainStyle: React.CSSProperties = {
  margin: '8px 0 0',
  fontSize: 11,
  color: colors.primaryDark,
  fontWeight: 600,
  letterSpacing: '0.06em',
};

const headingStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: colors.textPrimary,
  margin: '0 0 16px',
};

const textStyle: React.CSSProperties = {
  margin: '0 0 14px',
  color: colors.textPrimary,
};

const hrStyle: React.CSSProperties = {
  borderColor: colors.border,
  margin: '20px 0',
};

const noteStyle: React.CSSProperties = {
  fontSize: 13,
  color: colors.textSecondary,
  margin: 0,
};

const buttonSectionStyle: React.CSSProperties = {
  textAlign: 'center',
  margin: '32px 0',
};

const buttonStyle: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: colors.primary,
  color: '#0E0E0E',
  fontSize: 16,
  fontWeight: 700,
  textDecoration: 'none',
  padding: '14px 40px',
  borderRadius: 8,
  letterSpacing: '0.02em',
};

const fallbackLabelStyle: React.CSSProperties = {
  fontSize: 14,
  color: colors.textSecondary,
  marginBottom: 16,
};

const linkStyle: React.CSSProperties = {
  margin: '0 0 24px',
};

const linkAnchorStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#c59600',
  wordBreak: 'break-all',
};
