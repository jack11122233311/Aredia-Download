"""Shared provider, cookie and JavaScript settings for every yt-dlp operation."""

import os
import shutil
from typing import Any, Dict

from app.config import COOKIES_FILE


def common_ytdlp_options() -> Dict[str, Any]:
    # Native development uses a locally running provider; Compose overrides this.
    options: Dict[str, Any] = {
        "extractor_args": {
            "youtubepot-bgutilhttp": {
                "base_url": [os.getenv("POT_PROVIDER_URL", "http://127.0.0.1:4416")]
            }
        }
    }
    runtimes = {name: {} for name in ("node", "deno") if shutil.which(name)}
    if runtimes:
        options["js_runtimes"] = runtimes
        options["remote_components"] = ["ejs:github"]

    if COOKIES_FILE.exists() and COOKIES_FILE.stat().st_size > 0:
        options["cookiefile"] = str(COOKIES_FILE)

    return options
