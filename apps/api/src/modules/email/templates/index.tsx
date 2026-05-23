import { render } from '@react-email/render';
import { MagicLinkTemplate, type MagicLinkTemplateProps } from './magic-link';
import { WelcomeTemplate, type WelcomeTemplateProps } from './welcome';
import { TelegramLinkTemplate, type TelegramLinkTemplateProps } from './telegram-link';

export type { MagicLinkTemplateProps } from './magic-link';
export type { WelcomeTemplateProps } from './welcome';
export type { TelegramLinkTemplateProps } from './telegram-link';

export async function renderMagicLinkTemplate(props: MagicLinkTemplateProps): Promise<string> {
  return render(<MagicLinkTemplate {...props} />);
}

export async function renderWelcomeTemplate(props: WelcomeTemplateProps): Promise<string> {
  return render(<WelcomeTemplate {...props} />);
}

export async function renderTelegramLinkTemplate(props: TelegramLinkTemplateProps): Promise<string> {
  return render(<TelegramLinkTemplate {...props} />);
}
