import asyncio

from app.config import get_settings
from app.services.llm_client import groq_chat_completion


async def main() -> None:
    settings = get_settings()
    print("groq_enabled", settings.groq_enabled, "model", settings.groq_chat_model)
    completion = await groq_chat_completion(
        settings,
        model=settings.groq_chat_model,
        messages=[{"role": "user", "content": "Say hi in 3 words"}],
        max_tokens=20,
    )
    if completion is None:
        print("completion None")
    else:
        print("completion", completion.choices[0].message.content)


if __name__ == "__main__":
    asyncio.run(main())
