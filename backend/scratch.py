from app.config import get_settings
from langchain_openai import ChatOpenAI

settings = get_settings()
print(f'API Key: {settings.model_api_key}')
print(f'Model Name: {settings.model_name}')
print(f'Base URL: {settings.model_base_url}')

llm_kwargs = {
    'model': settings.model_name,
    'api_key': settings.model_api_key or 'dummy',
}
if settings.model_base_url:
    llm_kwargs['base_url'] = settings.model_base_url

try:
    print('Kh?i t?o ChatOpenAI...')
    llm = ChatOpenAI(**llm_kwargs)
    print('Ðang g?i request test...')
    res = llm.invoke('Hello, are you working?')
    print('Ph?n h?i thành công:', res.content)
except Exception as e:
    print('L?i k?t n?i ho?c x? lý:', type(e).__name__)
    print(e)
