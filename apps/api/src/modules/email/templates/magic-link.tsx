import { Text } from '@react-email/components';
import { BaseTemplate, ContentBlock, CtaButton, FallbackLink } from './base';

export interface MagicLinkTemplateProps {
  fullName: string;
  magicLink: string;
  associationName?: string;
}

export function MagicLinkTemplate({ fullName, magicLink, associationName }: MagicLinkTemplateProps) {
  const heading = associationName
    ? `${associationName} — Davet`
    : "Defter-i Hilal'e Davet Edildiniz!";

  const greeting = `Merhaba ${fullName},`;

  const bodyText = associationName
    ? `${associationName} Organizasyon Yönetim Sistemi'ne davet edildiniz. Aşağıdaki butona tıklayarak hesabınızı aktifleştirebilir ve şubenizi yönetmeye başlayabilirsiniz.`
    : "Defter-i Hilal Organizasyon Yönetim Sistemi'ne davet edildiniz. Aşağıdaki butona tıklayarak hesabınızı aktifleştirebilir ve şubenizi yönetmeye başlayabilirsiniz.";

  return (
    <BaseTemplate preview="Hesabınızı aktifleştirmek için davet bağlantınız">
      <ContentBlock
        heading={heading}
        greeting={greeting}
        note="Bu daveti beklemiyorsanız lütfen bu e-postayı dikkate almayın. Herhangi bir sorun için sistem yöneticinizle iletişime geçebilirsiniz."
      >
        <Text style={{ margin: '0 0 14px' }}>{bodyText}</Text>

        <CtaButton href={magicLink}>Hesabımı Aktifleştir</CtaButton>

        <FallbackLink href={magicLink} />

        <Text style={{ fontSize: 14, color: '#555555', margin: '16px 0 0' }}>
          İlk girişin ardından profil bilgilerinizi tamamlamanızı öneririz.
        </Text>
      </ContentBlock>
    </BaseTemplate>
  );
}
