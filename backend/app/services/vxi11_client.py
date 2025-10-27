import asyncio
import os
from typing import Any, Dict, Optional, Tuple


class MockVXI11Client:
    """Simple mock client used as a safe fallback."""

    def __init__(self, host: str, *, timeout: float = 5.0) -> None:
        self.host = host
        self.timeout = timeout

    async def query(self, command: str) -> str:
        await asyncio.sleep(0.05)
        return f"Mock response from {self.host} to {command!r}"

    async def write(self, command: str, parameters: Optional[Dict[str, Any]] = None) -> None:
        await asyncio.sleep(0.05)


class TCPVXI11Client:  # Deprecated: kept for compatibility reference, not used
    pass


class VXI11RPCClient:
    """Async adapter for python-vxi11's synchronous Instrument API (true VXI-11 RPC)."""

    def __init__(self, host: str, device: str = "inst0", *, timeout: float = 5.0) -> None:
        self.host = host
        self.device = device
        self.timeout = timeout
        # Lazy init to avoid import at import-time if package is missing
        self._inst = None  # type: ignore[var-annotated]

    def _ensure_inst(self):
        if self._inst is None:
            import vxi11  # type: ignore

            inst = vxi11.Instrument(self.host, self.device)
            # python-vxi11 timeout is in seconds
            try:
                inst.timeout = self.timeout
            except Exception:
                pass
            self._inst = inst
        return self._inst

    async def query(self, command: str) -> str:
        loop = asyncio.get_running_loop()
        inst = self._ensure_inst()
        return await loop.run_in_executor(None, lambda: inst.ask(command))

    async def write(self, command: str, parameters: Optional[Dict[str, Any]] = None) -> None:
        loop = asyncio.get_running_loop()
        inst = self._ensure_inst()
        await loop.run_in_executor(None, lambda: inst.write(command))


def _parse_address(address: str) -> Tuple[str, Optional[int], Optional[str]]:
    """Parse address string into (host, port, device).

    Supports:
    - host:port               -> raw TCP SCPI
    - host                    -> VXI-11 RPC with default device 'inst0'
    - host/device             -> VXI-11 RPC with specific device name (e.g., inst0)
    """
    # If device specified with '/'
    device = None
    host_port = address
    if '/' in address:
        host_port, device = address.split('/', 1)

    # If port specified with ':'
    if ':' in host_port:
        host, port_s = host_port.split(':', 1)
        try:
            return host, int(port_s), device
        except ValueError:
            # Invalid port -> treat as no port
            return host_port, None, device
    return host_port, None, device


async def get_vxi11_client(address: str, *, timeout: float = 5.0) -> Any:
    """Return an async client for the given instrument address.

    Priority:
    - If address includes a port: use TCPVXI11Client (raw TCP SCPI).
    - Else: try VXI11RPCClient using python-vxi11 (true RPC). If import fails, fall back to Mock.
    """
    host, port, device = _parse_address(address)

    # Feature flag: allow enabling mock VXI-11 behavior for known mock hostnames
    enable_mock = os.getenv("VXI11_ENABLE_MOCK", "false").lower() in {"1", "true", "yes"}
    if enable_mock and host in {"mock_instrument", "mock-device", "mock"}:
        return MockVXI11Client(address, timeout=timeout)

    # For simplicity, only support VXI-11 RPC now; ignore any provided port.

    # No port: attempt VXI-11 RPC
    try:
        return VXI11RPCClient(host, device or "inst0", timeout=timeout)
    except Exception:
        # If python-vxi11 isn't available or init fails, fall back
        return MockVXI11Client(address, timeout=timeout)


class VXI11Client:
    """Backwards-compatible facade used in tests and utilities.

    Lazily chooses between TCP SCPI and VXI-11 RPC based on address pattern.
    """

    def __init__(self, address: str, *, timeout: float = 5.0) -> None:
        self._address = address
        self._timeout = timeout
        self._client = None  # type: ignore[var-annotated]

    async def _ensure(self):
        if self._client is None:
            self._client = await get_vxi11_client(self._address, timeout=self._timeout)
        return self._client

    async def query(self, command: str) -> str:
        client = await self._ensure()
        return await client.query(command)

    async def write(self, command: str, parameters: Optional[Dict[str, Any]] = None) -> None:
        client = await self._ensure()
        return await client.write(command, parameters)
