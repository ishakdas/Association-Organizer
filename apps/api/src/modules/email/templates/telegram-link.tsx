import { Text, Link } from '@react-email/components';
import { BaseTemplate, ContentBlock, CtaButton } from './base';

export interface TelegramLinkTemplateProps {
  fullName: string;
  botUsername: string;
  deepLinkUrl: string;
  tgDirectUrl: string;
  token: string;
  expiresAt: string;
  connectUrl?: string;
}

export function TelegramLinkTemplate({
  fullName,
  botUsername,
  deepLinkUrl,
  tgDirectUrl,
  token,
  expiresAt,
  connectUrl,
}: TelegramLinkTemplateProps) {
  const expiresLabel = new Date(expiresAt).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <BaseTemplate preview="Telegram hesabınızı bağlayın">
      <ContentBlock
        heading="Telegram Hesabınızı Bağlayın"
        greeting={`Merhaba ${fullName},`}
        note="Bu bağlantıyı beklemiyorsanız lütfen bu e-postayı dikkate almayın. Herhangi bir sorun için sistem yöneticinizle iletişime geçebilirsiniz."
      >
        <Text style={{ margin: '0 0 14px' }}>
          Defter-i Hilal bildirimlerini Telegram üzerinden alabilmek için
          aşağıdaki butona tıklayın. Telegram açıldıktan sonra <strong>START</strong> butonuna
          basın ve ardından telefon numaranızı paylaşın.
        </Text>

        <CtaButton href={tgDirectUrl}>Telegram'da Bağlantıyı Başlat</CtaButton>

        <Text style={{ fontSize: 14, color: '#555555', margin: '16px 0 8px' }}>
          <strong>Buton çalışmazsa</strong> Telegram'ı açıp{' '}
          <Link href={`https://t.me/${botUsername}`} style={{ color: '#c59600', textDecoration: 'none' }}>
            @{botUsername}
          </Link>{' '}
          botuna aşağıdaki komutu yazın:
        </Text>

        <Text
          style={{
            fontFamily: 'monospace',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '0.04em',
            backgroundColor: '#f5f5f0',
            border: '1px solid #e0ddd5',
            borderRadius: 6,
            padding: '10px 16px',
            margin: '0 0 16px',
            color: '#c59600',
          }}
        >
          /link {token}
        </Text>

        <Text style={{ fontSize: 13, color: '#555555', margin: '0 0 8px' }}>
          Bu kod tek kullanımlıktır ve <strong>{expiresLabel}</strong> tarihine kadar geçerlidir.
        </Text>
      </ContentBlock>
    </BaseTemplate>
  );
}
