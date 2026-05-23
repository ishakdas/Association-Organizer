# AI

Swappable AI provider abstraction. Varsayılan olarak **Groq** (Llama modelleri); OpenAI, DeepInfra, OpenRouter veya herhangi bir OpenAI-uyumlu endpoint ile kullanılabilir.

## Sağlayıcılar

| Provider | Ne zaman | Notlar |
|---|---|---|
| `GenericAiProvider` | `AI_API_KEY` (veya fallback `GROQ_API_KEY`) set ise | `AI_PROVIDER_TYPE` preset'ine göre baseURL otomatik ayarlanır. Desteklenen: `groq`, `openai`, `deepinfra`, `openrouter`. Özel endpoint için `AI_PROVIDER_BASE_URL` kullan. |
| `UnconfiguredAiProvider` | API key yoksa | AI çağıran endpoint'lere 503 + Türkçe hata mesajı döner. API başlamayı bloklamaz. |
| `FakeAiProvider` | Sadece testlerde | Önceden ayarlanan response'ları `setResponse(schemaName, value)` ile döner. |

## Ortam Değişkenleri

```bash
# Primary — herhangi bir sağlayıcı ile çalışır
AI_API_KEY="your-api-key"

# Sağlayıcı seçimi: groq | openai | deepinfra | openrouter
AI_PROVIDER_TYPE="groq"

# Opsiyonel override'lar (set edilmezse preset defaults kullanılır)
AI_PROVIDER_BASE_URL="https://custom-endpoint.com/v1"  # custom provider için
AI_MODEL="llama-3.3-70b-versatile"
AI_TEMPERATURE=0.85
AI_MAX_TOKENS=2048

# Backward compatibility — AI_API_KEY yoksa fallback
# GROQ_API_KEY="gsk_..."
```

### Preset Varsayılanları

| Provider | baseURL | defaultModel |
|---|---|---|
| `groq` | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| `openai` | `https://api.openai.com/v1` | `gpt-4o` |
| `deepinfra` | `https://api.deepinfra.com/v1/openai` | `anthropic/claude-4-sonnet` |
| `openrouter` | `https://openrouter.ai/api/v1` | `deepseek/deepseek-chat` |

## Sözleşme

```typescript
interface AiProvider {
  generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T>;
  generateText(options: GenerateTextOptions): Promise<string>;
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

Provider seçimi `AiModule`'deki factory ile yapılır (`AI_API_KEY` → fallback `GROQ_API_KEY`, `AI_PROVIDER_TYPE` preset'leri).
