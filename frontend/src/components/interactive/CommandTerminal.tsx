import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import type { ReactElement } from 'react';
import { sendCommand } from '../../services/instrumentService';

interface CommandTerminalProps {
  instrument: {
    id: number;
    name: string;
    address: string;
  };
}

interface CommandHistoryEntry {
  type: 'command' | 'response' | 'error';
  text: string;
  timestamp: Date;
}

export function CommandTerminal({ instrument }: CommandTerminalProps): ReactElement {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<CommandHistoryEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Scroll to bottom when history changes
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    // Add welcome message when instrument changes
    setHistory([
      {
        type: 'response',
        text: `Connected to ${instrument.name} (${instrument.address})`,
        timestamp: new Date(),
      },
    ]);
  }, [instrument.id, instrument.name, instrument.address]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!command.trim() || loading) return;

    const cmd = command.trim();
    
    // Add to command history
    setCommandHistory((prev: string[]) => [...prev, cmd]);
    setHistoryIndex(-1);

    // Add command to display history
    setHistory((prev: CommandHistoryEntry[]) => [
      ...prev,
      { type: 'command', text: cmd, timestamp: new Date() },
    ]);

    setCommand('');
    setLoading(true);

    try {
      const response = await sendCommand(instrument.id, cmd);
      setHistory((prev: CommandHistoryEntry[]) => [
        ...prev,
        { type: 'response', text: response.response || 'OK', timestamp: new Date() },
      ]);
    } catch (err: unknown) {
      let errorText = 'Command failed';
      if (err instanceof Error) {
        errorText = err.message;
      } else if (typeof err === 'object' && err !== null && 'response' in err) {
        // best-effort extraction for axios-like errors without using `any`
        const maybeResp = (err as unknown as Record<string, unknown>)['response'];
        if (maybeResp && typeof maybeResp === 'object') {
          const data = (maybeResp as Record<string, unknown>)['data'];
          const detail = data && typeof data === 'object' ? (data as Record<string, unknown>)['detail'] : undefined;
          if (typeof detail === 'string') {
            errorText = detail;
          } else {
            try {
              errorText = JSON.stringify(maybeResp);
            } catch (_) {
              // ignore
            }
          }
        }
      }

      setHistory((prev: CommandHistoryEntry[]) => [
        ...prev,
        {
          type: 'error',
          text: errorText,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 
          ? commandHistory.length - 1 
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCommand(commandHistory[newIndex]);
        }
      }
    }
  };

  const clearHistory = () => {
    setHistory([
      {
        type: 'response',
        text: `Connected to ${instrument.name} (${instrument.address})`,
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <h2 className="text-lg font-medium text-slate-100">SCPI Command Terminal</h2>
        <button
          type="button"
          onClick={clearHistory}
          className="rounded px-3 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          Clear
        </button>
      </div>

      {/* Terminal Output */}
      <div
        ref={terminalRef}
        className="h-80 overflow-y-auto bg-slate-950 p-4 font-mono text-sm"
      >
        {history.map((entry, index) => (
          <div key={index} className="mb-2">
            {entry.type === 'command' && (
              <div className="text-primary-light">
                <span className="text-slate-500">
                  {entry.timestamp.toLocaleTimeString()}
                </span>{' '}
                <span className="text-emerald-400">&gt;</span> {entry.text}
              </div>
            )}
            {entry.type === 'response' && (
              <div className="text-slate-300">
                <span className="text-slate-500">
                  {entry.timestamp.toLocaleTimeString()}
                </span>{' '}
                {entry.text}
              </div>
            )}
            {entry.type === 'error' && (
              <div className="text-red-400">
                <span className="text-slate-500">
                  {entry.timestamp.toLocaleTimeString()}
                </span>{' '}
                Error: {entry.text}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-slate-500">
            <span className="animate-pulse">Executing command...</span>
          </div>
        )}
      </div>

      {/* Command Input */}
      <form onSubmit={handleSubmit} className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-emerald-400">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter SCPI command (e.g., *IDN? or MEAS:VOLT?)"
            disabled={loading}
            className="flex-1 bg-transparent font-mono text-slate-100 placeholder-slate-600 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !command.trim()}
            className="rounded bg-primary-light px-4 py-1 text-sm font-medium text-slate-900 hover:bg-primary-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Tip: Use ↑/↓ arrow keys to navigate command history
        </p>
      </form>
    </div>
  );
}
