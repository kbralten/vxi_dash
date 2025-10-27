import asyncio
import logging
import os
import traceback
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


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


class TCPVXI11Client:
    """Minimal async TCP SCPI client for devices speaking raw SCPI over TCP.

    This is provided as a compatibility fallback for devices that do not expose
    VXI-11 RPC/portmapper but do accept SCPI on a fixed TCP port.
    """

    def __init__(self, host: str, port: int, *, timeout: float = 5.0) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout

    async def _open(self):
        return await asyncio.open_connection(self.host, self.port)

    async def query(self, command: str) -> str:
        reader, writer = await asyncio.wait_for(self._open(), timeout=self.timeout)
        try:
            cmd = command if command.endswith("\n") else command + "\n"
            writer.write(cmd.encode("utf-8"))
            await writer.drain()

            # Try to read a line; if not line-terminated, do a short read.
            try:
                data = await asyncio.wait_for(reader.readuntil(b"\n"), timeout=self.timeout)
            except Exception:
                data = await asyncio.wait_for(reader.read(4096), timeout=self.timeout)
            return data.decode("utf-8", errors="replace").strip()
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass

    async def write(self, command: str, parameters: Optional[Dict[str, Any]] = None) -> None:
        reader, writer = await asyncio.wait_for(self._open(), timeout=self.timeout)
        try:
            cmd = command if command.endswith("\n") else command + "\n"
            writer.write(cmd.encode("utf-8"))
            await writer.drain()
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass


class VXI11RPCClient:
    """Async adapter for python-vxi11's synchronous Instrument API (true VXI-11 RPC)."""

    def __init__(self, host: str, device: str = "inst0", *, timeout: float = 5.0, auto_unlock: bool = True) -> None:
        self.host = host
        self.device = device
        self.timeout = timeout
        self._auto_unlock = auto_unlock
        # Lazy init to avoid import at import-time if package is missing
        self._inst = None  # type: ignore[var-annotated]
        self._locked = False

    def _ensure_inst(self):
        if self._inst is None:
            import vxi11  # type: ignore

            logger.debug("Initializing VXI11 Instrument for host=%s device=%s", self.host, self.device)
            try:
                inst = vxi11.Instrument(self.host, self.device)
            except Exception as e:
                logger.exception("Failed to create vxi11.Instrument for %s/%s: %s", self.host, self.device, e)
                raise
            # python-vxi11 timeout is in seconds
            try:
                inst.timeout = self.timeout
            except Exception:
                pass
            try:
                # configure lock timeout (seconds) to match our client timeout
                inst.lock_timeout = int(self.timeout)
            except Exception:
                pass
            self._inst = inst
        return self._inst

    async def query(self, command: str) -> str:
        loop = asyncio.get_running_loop()
        inst = self._ensure_inst()
        def _do():
            logger.debug("VXI11 query: host=%s device=%s command=%s", self.host, self.device, command)
            # Some VXI-11 servers require a device lock before I/O
            if not self._locked:
                try:
                    logger.debug("Attempting lock for host=%s device=%s", self.host, self.device)
                    inst.lock()
                    self._locked = True
                    logger.debug("Lock acquired for host=%s device=%s", self.host, self.device)
                except Exception as le:
                    logger.exception("Lock failed for %s/%s: %s", self.host, self.device, le)
                    # re-raise to let caller decide (we may want to see PROG_UNAVAIL etc.)
                    raise
            try:
                resp = inst.ask(command)
                logger.debug("Received response from %s/%s: %s", self.host, self.device, resp)
                return resp
            except Exception as e:
                logger.exception("ask() failed for %s/%s cmd=%s: %s", self.host, self.device, command, e)
                # If the server reports no lock held, try to re-acquire and retry once.
                msg = str(e)
                if 'No lock held' in msg or 'No lock' in msg or 'lock' in msg.lower():
                    try:
                        logger.debug("Retrying lock after ask failure for %s/%s", self.host, self.device)
                        inst.lock()
                        self._locked = True
                        resp = inst.ask(command)
                        logger.debug("Received response after retry from %s/%s: %s", self.host, self.device, resp)
                        return resp
                    except Exception as re:
                        logger.exception("Retry ask after lock failed for %s/%s: %s", self.host, self.device, re)
                raise
            finally:
                if self._auto_unlock and self._locked:
                    try:
                        inst.unlock()
                        logger.debug("Unlocked device for %s/%s after query", self.host, self.device)
                    except Exception:
                        logger.debug("Unlock after query ignored for %s/%s", self.host, self.device)
                    self._locked = False
        return await loop.run_in_executor(None, _do)

    async def write(self, command: str, parameters: Optional[Dict[str, Any]] = None) -> None:
        loop = asyncio.get_running_loop()
        inst = self._ensure_inst()
        def _do():
            logger.debug("VXI11 write: host=%s device=%s command=%s", self.host, self.device, command)
            if not self._locked:
                try:
                    logger.debug("Attempting lock before write for %s/%s", self.host, self.device)
                    inst.lock()
                    self._locked = True
                except Exception as le:
                    logger.exception("Lock failed before write for %s/%s: %s", self.host, self.device, le)
                    raise
            try:
                inst.write(command)
                logger.debug("Write succeeded for %s/%s", self.host, self.device)
            except Exception as e:
                logger.exception("write() failed for %s/%s cmd=%s: %s", self.host, self.device, command, e)
                msg = str(e)
                if 'No lock held' in msg or 'No lock' in msg or 'lock' in msg.lower():
                    try:
                        logger.debug("Reacquiring lock and retrying write for %s/%s", self.host, self.device)
                        inst.lock()
                        self._locked = True
                        inst.write(command)
                        logger.debug("Write succeeded after retry for %s/%s", self.host, self.device)
                    except Exception as re:
                        logger.exception("Retry write after lock failed for %s/%s: %s", self.host, self.device, re)
                        raise
                else:
                    raise
            finally:
                if self._auto_unlock and self._locked:
                    try:
                        inst.unlock()
                        logger.debug("Unlocked device for %s/%s after write", self.host, self.device)
                    except Exception:
                        logger.debug("Unlock after write ignored for %s/%s", self.host, self.device)
                    self._locked = False
        await loop.run_in_executor(None, _do)


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

    # For VXI-11 RPC, if a port was provided in the address, include it in the
    # host string passed to python-vxi11 (e.g. "127.0.0.1:1024") so that the
    # underlying library connects to the correct RPC endpoint.
    # Optional compatibility: if a port is provided and VXI11_ALLOW_TCP_SCPI=true,
    # use raw TCP SCPI client instead of VXI-11 RPC.
    allow_tcp_scpi = os.getenv("VXI11_ALLOW_TCP_SCPI", "false").lower() in {"1", "true", "yes"}
    if port is not None and allow_tcp_scpi:
        logger.info("Using TCP SCPI client for %s (host=%s port=%s)", address, host, port)
        return TCPVXI11Client(host, port, timeout=timeout)

    # For true VXI-11 RPC, do NOT pass an explicit port; let portmapper resolve it.
    host_arg = host

    try:
        auto_unlock = os.getenv("VXI11_AUTO_UNLOCK", "true").lower() in {"1", "true", "yes"}
        logger.info(
            "Using VXI-11 RPC client for %s (host=%s device=%s auto_unlock=%s)",
            address,
            host_arg,
            device or "inst0",
            auto_unlock,
        )
        return VXI11RPCClient(host_arg, device or "inst0", timeout=timeout, auto_unlock=auto_unlock)
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
