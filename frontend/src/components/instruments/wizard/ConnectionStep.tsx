import type { ReactElement } from 'react';

interface Props {
  name: string;
  address: string;
  description: string;
  onChange: (field: string, value: string) => void;
}

export function ConnectionStep({ name, address, description, onChange }: Props): ReactElement {
  const host = address.split('/')[0] ? address.split('/')[0].split(':')[0] : '';
  const identifier = address.split('/')[1] || '';
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="instrument-name" className="block text-sm font-medium text-slate-300">
          Instrument Name <span className="text-red-400">*</span>
        </label>
        <input
          id="instrument-name"
          type="text"
          value={name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="e.g., HP 3456A DMM"
          className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="instrument-ip" className="block text-sm font-medium text-slate-300">
            IP Address <span className="text-red-400">*</span>
          </label>
          <input
            id="instrument-ip"
            type="text"
            value={host}
            onChange={(e) => {
              const newHost = e.target.value;
              onChange('address', `${newHost}/${identifier}`);
            }}
            placeholder="e.g., 127.0.0.1"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
          />
        </div>
        <div>
          <label htmlFor="instrument-identifier" className="block text-sm font-medium text-slate-300">
            Identifier <span className="text-red-400">*</span>
          </label>
          <input
            id="instrument-identifier"
            type="text"
            value={identifier}
            onChange={(e) => {
              const newId = e.target.value;
              onChange('address', `${host}/${newId}`);
            }}
            placeholder="e.g., loopback0"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
          />
          <p className="mt-1 text-xs text-slate-500">Use the device name reported by your VXI-11 server (e.g., inst0, gpib0, loopback0).</p>
        </div>
      </div>

      <div>
        <label htmlFor="instrument-description" className="block text-sm font-medium text-slate-300">
          Description (optional)
        </label>
        <textarea
          id="instrument-description"
          value={description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Additional notes about this instrument"
          rows={3}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
        />
      </div>
    </div>
  );
}
