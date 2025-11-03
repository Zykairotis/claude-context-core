"""Sitemap parsing helpers."""

from __future__ import annotations

import asyncio
import logging
from typing import Iterable, List, Optional

import httpx
from xml.etree import ElementTree as ET

from ..helpers import normalize_url


LOGGER = logging.getLogger(__name__)


async def parse_sitemap(
    sitemap_url: str,
    *,
    client: Optional[httpx.AsyncClient] = None,
    cancel_event: Optional[asyncio.Event] = None,
) -> List[str]:
    try:
        if client is None:
            async with httpx.AsyncClient(follow_redirects=True, timeout=20.0) as owned_client:
                response = await owned_client.get(sitemap_url)
        else:
            response = await client.get(sitemap_url)
    except httpx.HTTPError as exc:
        LOGGER.warning("Failed to download sitemap %s: %s", sitemap_url, exc)
        return []

    if cancel_event and cancel_event.is_set():
        raise asyncio.CancelledError()

    try:
        tree = ET.fromstring(response.text)
    except ET.ParseError:
        return []

    urls: List[str] = []
    for loc in tree.iterfind(".//{*}loc"):
        if cancel_event and cancel_event.is_set():
            raise asyncio.CancelledError()
        if loc.text:
            urls.append(normalize_url(loc.text.strip()))

    return urls


__all__ = ["parse_sitemap"]

