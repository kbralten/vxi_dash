import type { ReactElement } from 'react';

interface Props {
  name: string;
  address: string;
  description: string;
  onChange: (field: string, value: string) => void;
}

export function ConnectionStep({ name, address, description, onChange }: Props): ReactElement {
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

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label htmlFor="instrument-ip" className="block text-sm font-medium text-slate-300">
            IP Address <span className="text-red-400">*</span>
          </label>
          <input
            id="instrument-ip"
            type="text"
            value={address.split(':')[0] || ''}
            onChange={(e) => {
              const [, portAndId = ''] = address.split(':');
              onChange('address', `${e.target.value}:${portAndId}`);
            }}
            placeholder="e.g., 127.0.0.1"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
          />
        </div>
        <div>
          <label htmlFor="instrument-port" className="block text-sm font-medium text-slate-300">
            Port <span className="text-red-400">*</span>
          </label>
          <input
            id="instrument-port"
            type="text"
            value={(() => {
              const [, portAndId = ''] = address.split(':');
              const [port] = portAndId.split('/');
              return port || '';
            })()}
            onChange={(e) => {
              const [ip = ''] = address.split(':');
              const [, id = ''] = address.split('/');
              onChange('address', `${ip}:${e.target.value}/${id}`);
            }}
            placeholder="1024"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
          />
        </div>
      </div>

      <div>
        <label htmlFor="instrument-identifier" className="block text-sm font-medium text-slate-300">
          Identifier <span className="text-red-400">*</span>
        </label>
        <input
          id="instrument-identifier"
          type="text"
          value={address.split('/')[1] || ''}
          onChange={(e) => {
            const [ipAndPort = ''] = address.split('/');
            onChange('address', `${ipAndPort}/${e.target.value}`);
          }}
          placeholder="e.g., power"
          className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
        />
        <p className="mt-1 text-xs text-slate-500">
          Multiple instruments can share the same IP/Port if using a composite instrument or gateway
        </p>
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
