# AI

Swappable AI provider abstraction. Production'da **Groq** (OpenAI uyumlu API üzerinden, Llama modelleri); test ortamında `FakeAiProvider`.

## Sağlayıcılar

| Provider | Ne zaman | Notlar |
|---|---|---|
| `OpenAiProvider` | `GROQ_API_KEY` set ise | `baseURL: https://api.groq.com/openai/v1` — yani aslında Groq'a gidiyor. İsim "OpenAI" çünkü API yüzeyi OpenAI uyumlu. |
| `UnconfiguredAiProvider` | `GROQ_API_KEY` yoksa | AI çağıran endpoint'lere 503 + Türkçe hata mesajı döner. API başlamayı bloklamaz. |
| `FakeAiProvider` | Sadece testlerde | Önceden ayarlanan response'ları `setResponse(schemaName, value)` ile döner. |

## Sözleşme

```typescript
interface AiProvider {
  generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T>;
}
```

Yapılandırılmış output: model'in cevabı bir Zod schema'sına validate edilir; parse hatasında 1 retry (parser hatası prompt'a feedback olarak), sonra hata fırlatır.

## Live Akışlar

| Endpoint | Prompt |
|---|---|
| `POST /associations/:id/meetings/analyze` | `extract-action-items` — toplantı içeriğinden başlık/açıklama/atanan kişi/Türkçe due date metni çıkarır |

Prompt tanımları: `src/prompts/`. Yeni bir prompt eklerken Zod output schema'sı ile birlikte tanımla.

## Modül Kullanımı

```typescript
// apps/api'de constructor injection
constructor(private readonly aiService: AiService) {}

const result = await this.aiService.extractActionItems(content, membersContext);
```

Provider seçimi `AiModule`'deki factory ile yapılır (`process.env.GROQ_API_KEY` kontrolü).
