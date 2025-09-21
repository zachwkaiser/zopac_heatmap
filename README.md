# ZOPAC Server

## Database Management System
We are starting with **SQLite** for development and will switch to **PostgreSQL** for production.  
- PostgreSQL: [https://www.postgresql.org/](https://www.postgresql.org/)

## Back-end Application Framework
We are using **Next.js** for the back-end server.  
- Next.js website: [https://nextjs.org/](https://nextjs.org/)  
- Getting Started tutorial: [https://nextjs.org/learn](https://nextjs.org/learn)  
- Video tutorial: [Next.js 14 App Router Crash Course (Net Ninja)](https://www.youtube.com/watch?v=VE8BkImUciY)

## Client Framework
We are using **React.js** as the client-side framework.
- React website: [https://react.dev/](https://react.dev/)
- Getting started: [https://react.dev/learn](https://react.dev/learn)
- Tutorial: [https://www.youtube.com/watch?v=SqcY0GlETPk&t=1880s](https://www.youtube.com/watch?v=SqcY0GlETPk&t=1880s)


## Wi-Fi scanning script
Disclaimer:
This script is designed to work on devices with multiple network adapters, i.e. there are multiple WLAN interfaces. In most cases, the onboard Wi-Fi chip will be read first by the operating system and be assigned WLAN0, and an external Wi-Fi adapter will be recognized after and be assigned WLAN1. This script uses this logic and is designed to monitor WLAN1 (the Wi-Fi extender/dongle) to collect data.

How to run the script:
1. Insert usb/pull onto your local device
2. Double click the .sh file and select "run in terminal" option
3. Script will begin to execute

## Wi-Fi script Data Dictionary
The endpoint acts as a "listening device" and does not directly communicate with the client (a persons phone, tablet, laptop, etc.) or the access point (Wi-Fi router or hotspot). It instead only captures the communication between the client and AP. This communication consists of three main types of data: a **Data Frame** a **Probe Request** and a **Beacon**

**Probe Request:**
 A probe request can be thought of as the client reaching out to see if there are any devices nearby. This can be used to passively detect new devices in the area, or any devices not connected to the AP (Wi-Fi). This is the best type of data to obtain for the project.
 * Probe Request Example
1758170265.013122 5323932us tsft 1.0 Mb/s 2412 MHz 11b -83dBm signal -83dBm signal antenna 0 0dBm signal antenna 1 0us BSSID:ff:ff:ff:ff:ff:ff DA:ff:ff:ff:ff:ff:ff SA:34:7e:5c:7b:b8:d2 Probe Request (MySpectrumWiFiD0-2G) [1.0 2.0 5.5 11.0 Mbit]


**Data Frame:**
A data frame is the actual traffic/communication between the client and AP. This can be used to show connected devices to a network.
* Data Frame Example
1758170264.362535 4674162us tsft 11.0 Mb/s 2412 MHz 11b -51dBm signal -51dBm signal antenna 0 0dBm signal antenna 1 Protected 0us DA:01:00:5e:00:00:01 BSSID:4a:d9:e7:b3:73:16 SA:c8:94:02:6f:cc:9f Data IV:b42a Pad 20 KeyID 1


**Beacon**
A Beacon is a signal sent out from the AP, to notify all other devices of its presence in an area. This can be used to identify how many AP's are in an area, map out an area, and be used to calibrate the endpoints RSSI readings. 
* Beacon Example
1758170263.747783 4057875us tsft 1.0 Mb/s 2412 MHz 11b -47dBm signal -47dBm signal antenna 0 0dBm signal antenna 1 0us BSSID:4a:d9:e7:b3:73:16 DA:ff:ff:ff:ff:ff:ff SA:4a:d9:e7:b3:73:16 Beacon (RAG XT) [1.0* 2.0* 5.5* 11.0* 6.0* 9.0 12.0* 18.0 Mbit] ESS CH: 1, PRIVACY


    Field                           |    Functionality                              | Notes
------------------------------------|-----------------------------------------------|--------------
1758170264.362535                   | Capture Timestamp                             | All use this
------------------------------------|-----------------------------------------------|--------------
4674162us tsft                      | Time Synchronization Function Timer           | All use this
------------------------------------|-----------------------------------------------|--------------
11.0 Mb/s                           | Transmission fate                             | All use this
------------------------------------|-----------------------------------------------|--------------
2412 MHz                            | Frequency                                     | All use this
------------------------------------|-----------------------------------------------|--------------
11b                                 | modulation                                    | All use this
------------------------------------|-----------------------------------------------|--------------
-51dBm signal                       | RSSI                                          | All use this
------------------------------------|-----------------------------------------------|--------------
antenna 0/1                         | What received the data                        | All use this
------------------------------------|-----------------------------------------------|--------------
Protected                           | The data is encrypted                         | All use this
------------------------------------|-----------------------------------------------|--------------
0us                                 | Radiotap Timing Field                         | All use this
------------------------------------|-----------------------------------------------|--------------
DA:01:00:5e:00:00:01|               | Destination address                           | All use this
------------------------------------|-----------------------------------------------|--------------
BSSID:4a:d9:e7:b3:73:16             | AP MAC address                                | All use this
------------------------------------|-----------------------------------------------|--------------
SA:c8:94:02:6f:cc:9f                | Source of the data                            | All use this
------------------------------------|-----------------------------------------------|--------------
Data IV:b42a Pad 20 KeyID 1         | Padding, encryption type, key                 | All use this
------------------------------------|-----------------------------------------------|--------------
Beacon (RAG XT)                     | Name of the beacon                            | Beacon only
------------------------------------|-----------------------------------------------|--------------
ESS CH: 1                           | Infrastructure and channel number             | Beacon only
------------------------------------|-----------------------------------------------|--------------
PRIVACY                             | Encryption required                           | Beacon only
------------------------------------|-----------------------------------------------|--------------
Probe Request (MySpectrumWiFiD0-2G) | Client searching for an AP                    | Probe only; this is the probe asking if there is an AP with that name

**Sources**
https://www.cisco.com/en/US/docs/wireless/wlan_adapter/secure_client/5.1.0/administration/guide/C1_Network_Security.html
https://howiwifi.com/2020/07/13/802-11-frame-types-and-formats/
https://askubuntu.com/questions/751547/simple-script-for-monitoring-wireless-status
Google AI overview was read for most searches preformed
ChatGPT was used to explain specific questions