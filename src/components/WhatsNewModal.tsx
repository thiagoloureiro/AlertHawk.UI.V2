import { X, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

interface WhatsNewModalProps {
  onClose: () => void;
}

interface Update {
  title: string;
  description: string;
  date: string;
  features: string[];
}

const updates: Update[] = [
  {
    title: "Kubernetes Support (Beta)",
    description: "New features and bug fixing",
    date: "March 9th, 2025",
    features: [
      "Kubernetes Support (Beta)",
      "Fixed issue when user from different region cannot see the monitor",
      "Fixed issue when user without groups tries to load groups page"
    ]
  },
  {
    title: "Enhanced Monitoring Dashboard",
    description: "We've completely revamped the monitoring dashboard with new features and improved visualization.",
    date: "March 1st, 2025",
    features: [
      "Real-time status updates with live indicators",
      "Advanced filtering and sorting capabilities",
      "Added Support to Kubernetes (Beta)",
      "Integration with AI for predictive alerts",
      "Improved user interface for better navigation"
    ]
  },
  {
    title: "New UI! - V2",
    description: "A completely redesigned UI.",
    date: "February 10th, 2025",
    features: [
      "Better user experience",
      "Improved charts and monitor details",
      "Improved Alert details"
    ]
  }
];

export function WhatsNewModal({ onClose }: WhatsNewModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl dark:bg-gray-800 bg-white rounded-lg shadow-lg max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <h2 className="text-xl font-semibold dark:text-white">What's New</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="space-y-8">
            {updates.map((update, index) => (
              <div key={index} className="relative pl-8 border-l-2 border-blue-500 dark:border-blue-400">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 dark:bg-blue-400" />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium dark:text-white">{update.title}</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{update.date}</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300">{update.description}</p>
                  <ul className="space-y-2 mt-4">
                    {update.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600
                     transition-colors flex items-center justify-center gap-2"
          >
            Got it
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
} 