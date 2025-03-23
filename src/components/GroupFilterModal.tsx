import { useState, useMemo } from 'react';
import { MonitorGroup } from '../types';
import { X, CheckSquare, Square } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface GroupFilterModalProps {
  groups: MonitorGroup[];
  selectedGroups: string[];
  onClose: () => void;
  onApply: (selectedGroups: string[]) => void;
}

export function GroupFilterModal({ groups, selectedGroups, onClose, onApply }: GroupFilterModalProps) {
  const [tempSelectedGroups, setTempSelectedGroups] = useState<string[]>(selectedGroups);
  const [showError, setShowError] = useState(false);

  // Sort groups alphabetically
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => a.name.localeCompare(b.name));
  }, [groups]);

  const handleToggleGroup = (groupId: string) => {
    setTempSelectedGroups((prev: string[]) => 
      prev.includes(groupId) 
        ? prev.filter((id: string) => id !== groupId)
        : [...prev, groupId]
    );
    setShowError(false);
  };

  const handleSelectAll = () => {
    setTempSelectedGroups(groups.map(group => group.id.toString()));
    setShowError(false);
  };

  const handleUnselectAll = () => {
    setTempSelectedGroups([]);
    setShowError(true);
  };

  const handleApply = () => {
    if (tempSelectedGroups.length === 0) {
      setShowError(true);
      toast.error('Please select at least one group', { position: 'bottom-right' });
      return;
    }
    onApply(tempSelectedGroups);
    onClose();
  };

  const isAllSelected = tempSelectedGroups.length === groups.length;
  const isSomeSelected = tempSelectedGroups.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-gray-700 border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold dark:text-white text-gray-900">Filter Groups</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Select the groups you want to display
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Selection Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 
                         hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                Select All
              </button>
              <button
                onClick={handleUnselectAll}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 
                         hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Square className="w-4 h-4" />
                Unselect All
              </button>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {tempSelectedGroups.length} of {groups.length} selected
            </span>
          </div>

          {showError && (
            <div className="mb-4 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
              Please select at least one group
            </div>
          )}

          {/* Groups List */}
          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
            {sortedGroups.map(group => (
              <label
                key={group.id}
                className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 
                         rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-center w-5 h-5">
                  <input
                    type="checkbox"
                    checked={tempSelectedGroups.includes(group.id.toString())}
                    onChange={() => handleToggleGroup(group.id.toString())}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 
                             dark:border-gray-600 dark:bg-gray-700"
                  />
                </div>
                <span className="flex-1 text-sm dark:text-white text-gray-900">{group.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {group.monitors.length} monitors
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-gray-700 border-gray-200 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors
                       ${!isSomeSelected 
                         ? 'bg-blue-300 dark:bg-blue-700 cursor-not-allowed' 
                         : 'bg-blue-500 hover:bg-blue-600'}`}
              disabled={!isSomeSelected}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 