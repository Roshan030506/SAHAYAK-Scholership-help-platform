"""Select the configured LLM provider."""

from __future__ import annotations

import logging
from functools import lru_cache

from app.config import settings
from app.llm.anthropic import AnthropicProvider
from app.llm.base import LLMProvider, LLMProviderError
from app.llm.mock import MockProvider
from app.llm.openai import OpenAIProvider

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_llm_provider() -> LLMProvider:
    """Return the cached provider selected by ``LLM_PROVIDER``."""
    provider = settings.llm_provider
    if provider == "mock":
        instance: LLMProvider = MockProvider()
    elif provider == "anthropic":
        instance = AnthropicProvider(settings.anthropic_api_key, settings.anthropic_model)
    elif provider == "openai":
        instance = OpenAIProvider(settings.openai_api_key, settings.openai_model)
    else:  # Defensive: settings validation should prevent this branch.
        raise LLMProviderError(f"Unknown LLM provider: {provider}")
    logger.info("Using LLM provider '%s'", provider)
    return instance


def reset_llm_provider_cache() -> None:
    """Clear the provider cache (used by tests and admin diagnostics)."""
    get_llm_provider.cache_clear()
