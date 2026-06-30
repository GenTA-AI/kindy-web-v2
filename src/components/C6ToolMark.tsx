import type { C6ToolKey } from '@/lib/game/c6-profile';

type C6ToolMarkProps = {
  toolKey: C6ToolKey | string;
  className?: string;
};

const TOOL_LABELS: Record<C6ToolKey, string> = {
  observe: '보기',
  imagine: '잇기',
  pattern: '규칙',
  transform: '나눔',
  design: '꾸밈',
  compose: '만듦',
};

export default function C6ToolMark({ toolKey, className = '' }: C6ToolMarkProps) {
  const key = isC6ToolKey(toolKey) ? toolKey : 'observe';

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-[10px] font-black text-saged shadow-sm ring-1 ring-line ${className}`}
    >
      <span className="absolute left-1 top-1 rounded-full bg-sagebg px-1.5 py-0.5 leading-none">
        {TOOL_LABELS[key]}
      </span>
      <C6Shape toolKey={key} />
    </span>
  );
}

function C6Shape({ toolKey }: { toolKey: C6ToolKey }) {
  if (toolKey === 'observe') {
    return (
      <span className="absolute bottom-2 right-2 h-5 w-5 rounded-full border-2 border-sage">
        <span className="absolute -bottom-1 -right-1 h-2 w-1.5 rotate-[-42deg] rounded-full bg-sage" />
      </span>
    );
  }

  if (toolKey === 'imagine') {
    return (
      <span className="absolute bottom-2 right-2 h-6 w-6">
        <span className="absolute left-0 top-2 h-4 w-4 rounded-full border-2 border-clay" />
        <span className="absolute right-0 top-0 h-4 w-4 rounded-full border-2 border-sage" />
      </span>
    );
  }

  if (toolKey === 'pattern') {
    return (
      <span className="absolute bottom-2 right-2 flex h-6 w-6 items-end gap-1">
        <span className="h-3 w-1.5 rounded-full bg-sage" />
        <span className="h-5 w-1.5 rounded-full bg-clay" />
        <span className="h-3 w-1.5 rounded-full bg-sage" />
      </span>
    );
  }

  if (toolKey === 'transform') {
    return (
      <span className="absolute bottom-2 right-2 h-5 w-5 rotate-45 rounded-md border-2 border-sage">
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-clay" />
      </span>
    );
  }

  if (toolKey === 'design') {
    return (
      <span className="absolute bottom-2 right-2 grid h-6 w-6 grid-cols-2 gap-1">
        <span className="rounded-md bg-sage" />
        <span className="rounded-md bg-honey" />
        <span className="rounded-md bg-clay" />
        <span className="rounded-md bg-mint" />
      </span>
    );
  }

  return (
    <span className="absolute bottom-2 right-2 h-6 w-6">
      <span className="absolute left-1/2 top-0 h-full w-2 -translate-x-1/2 rounded-full bg-sage" />
      <span className="absolute left-0 top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-clay" />
    </span>
  );
}

function isC6ToolKey(value: string): value is C6ToolKey {
  return value === 'observe'
    || value === 'imagine'
    || value === 'pattern'
    || value === 'transform'
    || value === 'design'
    || value === 'compose';
}
