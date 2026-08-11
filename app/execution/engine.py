"""Backend selection.

``EXECUTION_BACKEND`` decides which sandbox the judge uses:

``docker``
    Force the container sandbox.  Runs fail loudly if the daemon is missing.
``local``
    Force the rlimit subprocess sandbox.
``auto`` (default)
    Use Docker when the daemon answers a ping, otherwise fall back to local.
    The probe result is cached, so the daemon is contacted once per process.
"""

from __future__ import annotations

import logging
import threading

from app.config import settings
from app.execution.base import SandboxBackend
from app.execution.docker_backend import DockerBackend
from app.execution.local_backend import LocalBackend

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_backend: SandboxBackend | None = None


def get_backend(force_refresh: bool = False) -> SandboxBackend:
    global _backend

    with _lock:
        if _backend is not None and not force_refresh:
            return _backend

        choice = settings.EXECUTION_BACKEND

        if choice == "local":
            _backend = LocalBackend()
        elif choice == "docker":
            _backend = DockerBackend()
        else:
            docker = DockerBackend()
            if docker.is_available():
                _backend = docker
            else:
                logger.warning(
                    "EXECUTION_BACKEND=auto: Docker unavailable, using the local "
                    "sandbox. Untrusted code will NOT be container-isolated."
                )
                _backend = LocalBackend()

        logger.info("Execution backend selected: %s", _backend.name)
        return _backend


def backend_status() -> dict:
    """Capability report for the ``/health`` endpoint."""
    backend = get_backend()
    return {
        "configured": settings.EXECUTION_BACKEND,
        "active": backend.name,
        **backend.describe(),
    }
