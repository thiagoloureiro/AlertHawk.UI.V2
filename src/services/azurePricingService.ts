import { metricsHttp } from './httpClient';

interface AzurePriceItem {
  currencyCode: string;
  tierMinimumUnits: number;
  retailPrice: number;
  unitPrice: number;
  armRegionName: string;
  location: string;
  effectiveStartDate: string;
  meterId: string;
  meterName: string;
  productId: string;
  skuId: string;
  productName: string;
  skuName: string;
  serviceName: string;
  serviceId: string;
  serviceFamily: string;
  unitOfMeasure: string;
  type: string;
  isPrimaryMeterRegion: boolean;
  armSkuName: string;
  effectiveEndDate: string | null;
}

interface AzurePriceResponse {
  BillingCurrency: string;
  CustomerEntityId: string;
  CustomerEntityType: string;
  Items: AzurePriceItem[];
  NextPageLink: string | null;
  Count: number;
}

interface AzurePriceRequest {
  currencyCode: string;
  serviceName: string;
  armSkuName: string;
  armRegionName: string;
  type: string;
  OperatingSystem: string;
}

class AzurePricingService {
  private cache: Map<string, { price: number | null; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get Azure VM pricing for a specific instance type and region
   * @param instanceType - Azure VM SKU (e.g., "Standard_D2s_v5")
   * @param region - Azure region (e.g., "eastus2")
   * @param operatingSystem - Operating system (e.g., "Linux" or "Windows"), defaults to "Linux"
   * @returns Price per hour in USD, or null if not found
   */
  async getVmPrice(instanceType: string, region: string, operatingSystem: string = 'Linux'): Promise<number | null> {
    if (!instanceType || !region) {
      return null;
    }

    // Normalize operating system to exactly "Linux" or "Windows"
    let normalizedOS = 'Linux'; // Default to Linux
    if (operatingSystem) {
      const osLower = operatingSystem.toLowerCase().trim();
      if (osLower === 'windows') {
        normalizedOS = 'Windows';
      } else if (osLower === 'linux') {
        normalizedOS = 'Linux';
      } else {
        // Default to Linux if unrecognized
        normalizedOS = 'Linux';
      }
    }
    
    const cacheKey = `${instanceType}-${region}-${normalizedOS}`;
    const cached = this.cache.get(cacheKey);
    
    // Check cache
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.price;
    }

    try {
      // Prepare request payload
      const payload: AzurePriceRequest = {
        currencyCode: 'USD',
        serviceName: 'Virtual Machines',
        armSkuName: instanceType,
        armRegionName: region.toLowerCase(),
        type: 'Consumption',
        OperatingSystem: normalizedOS
      };

      // Call backend API
      const response = await metricsHttp.post<AzurePriceResponse>('/api/azure-prices', payload);
      const data = response.data;

      // Check for API errors
      if ((data as any).Error) {
        const error = (data as any).Error;
        console.warn(`Azure pricing API error: ${error.Code} - ${error.Message}`);
        this.cache.set(cacheKey, { price: null, timestamp: Date.now() });
        return null;
      }

      if (!data.Items || data.Items.length === 0) {
        console.warn(`No pricing data found for ${instanceType} in ${region}`);
        this.cache.set(cacheKey, { price: null, timestamp: Date.now() });
        return null;
      }

      // Find the best price item (prefer Linux/Compute)
      const linuxPrice = data.Items.find(item => 
        item.meterName?.toLowerCase().includes('linux') || 
        item.meterName?.toLowerCase().includes('compute')
      );
      
      const priceItem = linuxPrice || data.Items.find(item => 
        item.meterName?.toLowerCase().includes('windows')
      ) || data.Items[0];

      const price = priceItem?.retailPrice || null;

      // Cache the result
      this.cache.set(cacheKey, { price, timestamp: Date.now() });
      
      return price;
    } catch (error) {
      console.error(`Failed to fetch Azure pricing for ${instanceType} in ${region}:`, error);
      // Cache null result to avoid repeated failed requests
      this.cache.set(cacheKey, { price: null, timestamp: Date.now() });
      return null;
    }
  }

  /**
   * Normalize region name for Azure API
   * Azure API uses format like "US East 2" instead of "eastus2"
   */
  private normalizeRegion(region: string): string {
    // Common region mappings
    const regionMap: Record<string, string> = {
      'eastus': 'US East',
      'eastus2': 'US East 2',
      'westus': 'US West',
      'westus2': 'US West 2',
      'westus3': 'US West 3',
      'centralus': 'US Central',
      'southcentralus': 'US South Central',
      'northcentralus': 'US North Central',
      'westcentralus': 'US West Central',
      'canadacentral': 'Canada Central',
      'canadaeast': 'Canada East',
      'brazilsouth': 'Brazil South',
      'brazilsoutheast': 'Brazil Southeast',
      'northeurope': 'North Europe',
      'westeurope': 'West Europe',
      'uksouth': 'UK South',
      'ukwest': 'UK West',
      'francecentral': 'France Central',
      'francesouth': 'France South',
      'germanywestcentral': 'Germany West Central',
      'germanynorth': 'Germany North',
      'switzerlandnorth': 'Switzerland North',
      'switzerlandwest': 'Switzerland West',
      'norwayeast': 'Norway East',
      'norwaywest': 'Norway West',
      'swedencentral': 'Sweden Central',
      'polandcentral': 'Poland Central',
      'italynorth': 'Italy North',
      'southafricanorth': 'South Africa North',
      'southafricawest': 'South Africa West',
      'uaenorth': 'UAE North',
      'uaecentral': 'UAE Central',
      'southeastasia': 'Southeast Asia',
      'eastasia': 'East Asia',
      'japaneast': 'Japan East',
      'japanwest': 'Japan West',
      'koreacentral': 'Korea Central',
      'koreasouth': 'Korea South',
      'australiaeast': 'Australia East',
      'australiasoutheast': 'Australia Southeast',
      'australiacentral': 'Australia Central',
      'australiacentral2': 'Australia Central 2',
      'chinanorth': 'China North',
      'chinaeast': 'China East',
      'chinanorth2': 'China North 2',
      'chinaeast2': 'China East 2',
      'indiacentral': 'India Central',
      'indiasouth': 'India South',
      'indiawest': 'India West',
    };

    // Check if we have a mapping
    if (regionMap[region.toLowerCase()]) {
      return regionMap[region.toLowerCase()];
    }

    // Try to convert format: eastus2 -> US East 2
    const parts = region.toLowerCase().match(/^([a-z]+)(\d*)$/);
    if (parts) {
      const name = parts[1];
      const num = parts[2];
      const regionNames: Record<string, string> = {
        'east': 'East',
        'west': 'West',
        'north': 'North',
        'south': 'South',
        'central': 'Central',
      };
      
      const direction = regionNames[name] || name.charAt(0).toUpperCase() + name.slice(1);
      return `US ${direction}${num ? ' ' + num : ''}`;
    }

    // Fallback: return as-is (might work for some regions)
    return region;
  }

  /**
   * Format price for display
   */
  formatPrice(price: number | null): string {
    if (price === null) return 'N/A';
    return `$${price.toFixed(4)}/hr`;
  }

  /**
   * Calculate monthly price (hourly price * hours per month)
   * Uses 730 hours per month (average: 30.42 days * 24 hours)
   */
  calculateMonthlyPrice(hourlyPrice: number | null): number | null {
    if (hourlyPrice === null) return null;
    const HOURS_PER_MONTH = 730; // Average month: 30.42 days * 24 hours
    return hourlyPrice * HOURS_PER_MONTH;
  }

  /**
   * Format monthly price for display
   */
  formatMonthlyPrice(price: number | null): string {
    if (price === null) return 'N/A';
    return `$${price.toFixed(2)}/mo`;
  }
}

const azurePricingService = new AzurePricingService();
export default azurePricingService;

