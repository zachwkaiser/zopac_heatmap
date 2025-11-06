/**
 * Generic function to get data from the server using axios
 * @param url - The URL to get data from
 * @param params - The parameters to pass to the server
 * @returns The data from the server
 */
import axios from 'axios';


interface DataResponse {
  success: boolean;
  data: WifiScan[];
  error?: string;
  // ? means that the property is optional
}


const getData = async (url: string): Promise<DataResponse> => {

    // Promise means that the function will return a promise that will be resolved or rejected
    // DataResponse is an interface to form the response data, comes with success, data, and error
    // async means that the function is non blocking, meaning other code can run while it is waiting for a response
    // only export the function if it is going to be used outside of this file

  try {
    const response = await axios.get(url);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('Error getting data:', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

interface WifiScan {
    id: number;
    endpoint_id: string;
    mac: string;
    rssi: number;
    timestamp: string;
    created_at: string;
}


export async function getScanData(): Promise<WifiScan[]> {
    // Use the secure proxy route instead of calling the endpoint directly
    // The proxy route handles API key authentication server-side
    const response = await getData('http://localhost:3000/api/client/scan-data');

    if (response.success) {
        const result = response.data as WifiScan[];
        return result;
        // response.data is the data from the response variable, but since
        // the getData function returns a DataResponse interface, we need to
        // use the data of the DataResponse interface to get the data
    }
    return [];
}