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
    title: "Dashboard Builder & Custom Widgets",
    description: "Revolutionary dashboard builder with drag-and-drop widgets, real-time data visualization, and customizable monitoring dashboards.",
    date: "October 4th, 2025",
    features: [
      "Interactive Dashboard Builder accessible from the sidebar with drag-and-drop functionality",
      "Customizable widget library with 6 widget types: Uptime Summary, Alert Timeline, Group Summary, Monitor Status, SSL Status, and Status Blocks",
      "Real-time data integration with monitor groups and alert data sources",
      "Widget configuration with settings panels for each widget type",
      "Save and load dashboard functionality with local storage persistence",
      "URL-based dashboard sharing with unique dashboard IDs",
      "Auto-refresh settings with configurable intervals (10s, 20s, 30s, 1min, 5min)",
      "Widget limit of 15 widgets per dashboard for optimal performance",
      "Responsive grid layout with fixed widget heights and internal scrolling",
      "Dark theme support with consistent styling across all widgets",
      "Widget renaming with pencil icon and keyboard shortcuts (Enter to save)",
      "Preview mode for clean dashboard viewing without edit controls"
    ]
  },
  {
    title: "SSL Certificate Monitor",
    description: "New dedicated page for monitoring SSL certificate expiration status across all environments with advanced filtering and sorting capabilities.",
    date: "September 27th, 2025",
    features: [
      "Dedicated SSL Certificate Monitor page accessible from the sidebar",
      "Environment selector to view certificates across Development, Staging, QA, Testing, PreProd, and Production",
      "Smart filtering to show only active HTTP monitors with certificate monitoring enabled",
      "Color-coded status indicators: Critical (≤7 days), Warning (8-30 days), Healthy (>30 days)",
      "Sortable table columns for Status, Monitor Name, URL, and Days to Expire",
      "One-click URL opening to visit monitored sites directly",
      "Dark theme support with responsive design",
      "Automatic exclusion of paused monitors and monitors without certificate monitoring"
    ]
  },
  {
    title: "HTTP Response Code Range Configuration",
    description: "Enhanced HTTP monitor configuration with customizable response code range validation for more precise monitoring control.",
    date: "September 12th, 2025",
    features: [
      "Added configurable HTTP response code range fields (From/To) for HTTP monitors",
      "Default range set to 200-299 for standard successful responses",
      "Real-time form validation with proper min/max constraints (100-599)",
      "Seamless integration with existing monitor creation and editing workflows",
      "Improved monitor accuracy by allowing custom success criteria beyond standard HTTP codes",
      "Enhanced editing experience with proper field population from existing monitor data"
    ]
  },
  {
    title: "Environment Selection Persistence",
    description: "Enhanced environment selection with persistent storage and real-time updates across components.",
    date: "August 8th, 2025",
    features: [
      "Environment selection is now saved to localStorage and persists across page refreshes",
      "TopBar monitor status automatically updates when environment changes",
      "Real-time synchronization between MetricsList and TopBar components",
      "Default environment set to Production when no selection is stored",
      "Improved user experience with consistent environment state across the application"
    ]
  },
  {
    title: "Certificate Expiration Warnings",
    description: "New proactive monitoring feature to alert users about expiring SSL certificates.",
    date: "August 1st, 2025",
    features: [
      "Automatic detection of monitors with certificates expiring in less than 30 days",
      "Smart filtering to only show HTTP monitors (monitorTypeId = 1)",
      "Visual indicators with color-coded urgency levels",
      "User preference option to dismiss warnings permanently",
      "Responsive modal design with dark mode support"
    ]
  },
  {
    title: "Enhanced Group Filtering",
    description: "New filtering capabilities and improvements to the monitoring interface.",
    date: "March 19th, 2025",
    features: [
      "Added group filtering with multi-select support",
      "Improved search functionality",
      "Added Select All/Unselect All options for groups",
      "Fixed various UI/UX issues in the monitoring dashboard",
      "Improved button layouts and responsiveness"
    ]
  },
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
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
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