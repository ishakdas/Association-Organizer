import { Text, Section } from '@react-email/components';
import { BaseTemplate, ContentBlock, CtaButton, FallbackLink } from './base';

export interface WelcomeTemplateProps {
  fullName: string;
  loginUrl: string;
  associationName?: string;
}

export function WelcomeTemplate({ fullName, loginUrl, associationName }: WelcomeTemplateProps) {
  const heading = associationName
    ? `${associationName} — Hoş Geldiniz!`
    : "Defter-i Hilal'e Hoş Geldiniz!";

  return (
    <BaseTemplate preview="Sisteme hoş geldiniz — giriş bilgileriniz">
      <ContentBlock
        heading={heading}
        greeting={`Merhaba ${fullName},`}
        note="Bu e-postayı beklemiyordunuz lütfen sistem yöneticinizle iletişime geçin."
      >
        <Text style={{ margin: '0 0 14px' }}>
          Defter-i Hilal Organizasyon Yönetim Sistemi'ne üyelik başvurunuz onaylandı. Aşağıdaki bilgilerle giriş yapabilirsiniz.
        </Text>

        <Section
          style={{
            margin: '24px 0',
            padding: 20,
            backgroundColor: '#f5f5f0',
            borderRadius: 8,
            textAlign: 'center',
            border: '1px solid #e0ddd5',
          }}
        >
          <Text
            style={{
              margin: '0 0 8px',
              fontSize: 13,
              color: '#c59600',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Giriş Yap
          </Text>
        </Section>

        <CtaButton href={loginUrl}>Sisteme Giriş Yap</CtaButton>

        <FallbackLink href={loginUrl} />

        <Text style={{ fontSize: 14, color: '#555555', margin: '16px 0 0' }}>
          Giriş yaptıktan sonra <strong>Ayarlar → Hesabım</strong> bölümünden şifrenizi değiştirmenizi öneririz.
        </Text>
      </ContentBlock>
    </BaseTemplate>
  );
}
