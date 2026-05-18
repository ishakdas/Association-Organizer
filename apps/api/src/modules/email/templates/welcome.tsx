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
    : "Yedimuîn'e Hoş Geldiniz!";

  return (
    <BaseTemplate preview="Sisteme hoş geldiniz — giriş bilgileriniz">
      <ContentBlock
        heading={heading}
        greeting={`Merhaba ${fullName},`}
        note="Bu e-postayı beklemiyordunuz lütfen sistem yöneticinizle iletişime geçin."
      >
        <Text style={{ margin: '0 0 14px' }}>
          Dernek yönetim sistemine üyelik başvurunuz onaylandı. Aşağıdaki bilgilerle giriş yapabilirsiniz.
        </Text>

        <Section
          style={{
            margin: '24px 0',
            padding: 20,
            backgroundColor: '#f3f4f6',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text
            style={{
              margin: '0 0 8px',
              fontSize: 13,
              color: '#6b7280',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Giriş Yap
          </Text>
        </Section>

        <CtaButton href={loginUrl}>Sisteme Giriş Yap</CtaButton>

        <FallbackLink href={loginUrl} />

        <Text style={{ fontSize: 14, color: '#374151', margin: '16px 0 0' }}>
          Giriş yaptıktan sonra <strong>Ayarlar → Hesabım</strong> bölümünden şifrenizi değiştirmenizi öneririz.
        </Text>
      </ContentBlock>
    </BaseTemplate>
  );
}
