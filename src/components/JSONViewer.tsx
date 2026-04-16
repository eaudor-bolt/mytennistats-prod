import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface JSONViewerProps {
  data: any;
  level?: number;
}

export function JSONViewer({ data, level = 0 }: JSONViewerProps) {
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});

  if (data === null || data === undefined) {
    return <span className="text-gray-400 italic">null</span>;
  }

  if (typeof data !== 'object') {
    return <span className="text-gray-700">{String(data)}</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-gray-400 italic">[]</span>;
    }

    return (
      <div className="space-y-1">
        {data.map((item, index) => (
          <div key={index} className="ml-4">
            <button
              onClick={() => setExpanded(prev => ({ ...prev, [`arr-${index}`]: !prev[`arr-${index}`] }))}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
            >
              {expanded[`arr-${index}`] ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span className="font-medium">Item {index + 1}</span>
            </button>
            {expanded[`arr-${index}`] && (
              <div className="ml-5 mt-1 border-l-2 border-gray-200 pl-2">
                <JSONViewer data={item} level={level + 1} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <span className="text-gray-400 italic">{'{}'}</span>;
  }

  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => {
        const isExpandable = value !== null && typeof value === 'object';
        const expandKey = `${level}-${key}`;

        return (
          <div key={key} className={level > 0 ? 'ml-4' : ''}>
            {isExpandable ? (
              <>
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [expandKey]: !prev[expandKey] }))}
                  className="flex items-center gap-1 text-xs hover:bg-gray-50 px-1 py-0.5 rounded transition-colors w-full text-left"
                >
                  {expanded[expandKey] ? (
                    <ChevronDown className="w-3 h-3 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-gray-500" />
                  )}
                  <span className="font-medium text-gray-700">{key}:</span>
                </button>
                {expanded[expandKey] && (
                  <div className="ml-5 mt-1 border-l-2 border-gray-200 pl-2">
                    <JSONViewer data={value} level={level + 1} />
                  </div>
                )}
              </>
            ) : (
              <div className="flex gap-2 text-xs px-1">
                <span className="font-medium text-gray-600">{key}:</span>
                <span className="text-gray-700">{String(value)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
