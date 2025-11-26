import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, ArrowRight, LineChart, Package } from 'lucide-react';
import { Switch } from './ui/switch';

interface WelcomeMetricsModalProps {
  onClose: () => void;
}

const STORAGE_KEY = 'metricsWelcomeDismissed';

export function WelcomeMetricsModal({ onClose }: WelcomeMetricsModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const navigate = useNavigate();

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onClose();
  };

  const handleGetStarted = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    onClose();
    navigate('/metrics');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl dark:bg-gray-900 bg-gray-50 rounded-lg shadow-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700 border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <LineChart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold dark:text-white text-gray-900">Welcome to Kubernetes Metrics!</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                New features to monitor your Kubernetes infrastructure
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 dark:text-gray-400 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-8">
            {/* Introduction */}
            <div className="text-center space-y-2">
              <p className="text-lg text-gray-700 dark:text-gray-300">
                We're excited to introduce comprehensive Kubernetes metrics monitoring! 
                Now you can track CPU and memory usage across your cluster nodes and application namespaces.
                To access the metrics, you can click on the "Application Metrics or Cluster Metrics" tab in the navigation bar.
              </p>
            </div>

            {/* Cluster Metrics Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <LineChart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold dark:text-white text-gray-900">Cluster Metrics</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Monitor node-level CPU and memory usage across your Kubernetes clusters. Get real-time insights into your cluster's resource utilization.
              </p>
              
              {/* Cluster Metrics Screenshot */}
              <div className="rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img 
                  src="/screenshots/cluster-metrics.png" 
                  alt="Cluster Metrics Dashboard"
                  className="w-full h-auto"
                  onError={(e) => {
                    // Fallback if image doesn't exist
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="aspect-video hidden items-center justify-center">
                  <div className="text-center p-8">
                    <LineChart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Cluster Metrics Screenshot
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                      Add screenshot at /public/screenshots/cluster-metrics.png
                    </p>
                  </div>
                </div>
              </div>

              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-gray-600 dark:text-gray-300">View CPU and memory usage percentages for each node</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-gray-600 dark:text-gray-300">Filter by cluster and time range (1 hour to 7 days)</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-gray-600 dark:text-gray-300">Interactive charts showing usage trends over time</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-gray-600 dark:text-gray-300">Detailed node information with capacity and usage breakdown</span>
                </li>
              </ul>
            </div>

            {/* Application Metrics Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold dark:text-white text-gray-900">Application Metrics</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Track pod and container resource consumption by namespace. Monitor CPU cores and memory usage at the application level.
              </p>
              
              {/* Application Metrics Screenshot */}
              <div className="rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img 
                  src="/screenshots/application-metrics.png" 
                  alt="Application Metrics Dashboard"
                  className="w-full h-auto"
                  onError={(e) => {
                    // Fallback if image doesn't exist
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="aspect-video hidden items-center justify-center">
                  <div className="text-center p-8">
                    <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Application Metrics Screenshot
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">
                      Add screenshot at /public/screenshots/application-metrics.png
                    </p>
                  </div>
                </div>
              </div>

              <ul className="space-y-2 ml-4">
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-gray-600 dark:text-gray-300">Monitor CPU usage in cores and memory in MB for containers</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-gray-600 dark:text-gray-300">Filter by namespace, pod, and container</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-gray-600 dark:text-gray-300">Search and select specific pods for detailed monitoring</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-gray-600 dark:text-gray-300">View comprehensive pod and container details with resource limits</span>
                </li>
              </ul>
            </div>

            {/* Key Features */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Key Features:</h4>
              <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
                <li>• Real-time metrics collection from Kubernetes clusters</li>
                <li>• Historical data visualization with interactive charts</li>
                <li>• Multiple time range options (1 hour to 7 days)</li>
                <li>• Fullscreen chart view for detailed analysis</li>
                <li>• Color-coded usage indicators for quick status assessment</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="p-6 border-t dark:border-gray-700 border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={dontShowAgain}
                onCheckedChange={setDontShowAgain}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Don't show this again
              </span>
            </label>
          </div>
          <button
            onClick={handleGetStarted}
            className="w-full px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600
                     transition-colors flex items-center justify-center gap-2"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function to check if welcome should be shown
export function shouldShowMetricsWelcome(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== 'true';
}

