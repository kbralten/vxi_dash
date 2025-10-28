"""Route modules for the VXI-11 dashboard API."""

from . import dashboard, health, instruments, monitoring, state_machine

__all__ = [
	"dashboard",
	"health",
	"instruments",
	"monitoring",
	"state_machine",
]
