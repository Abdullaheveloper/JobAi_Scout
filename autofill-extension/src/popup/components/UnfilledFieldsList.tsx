import type { ClassifiedField } from "../../lib/types";

interface UnfilledFieldsListProps {
  fields: ClassifiedField[];
}

export function UnfilledFieldsList({ fields }: UnfilledFieldsListProps) {
  if (fields.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Unfilled Fields ({fields.length})
      </h3>
      <ul className="space-y-1">
        {fields.map((field, i) => (
          <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0" />
            <span>{field.category.replace(/_/g, " ").toLowerCase()}</span>
            {field.labelText && (
              <span className="text-gray-400 text-xs truncate">
                ({field.labelText})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
