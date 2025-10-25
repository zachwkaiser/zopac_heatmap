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

Figma
- Link: [https://www.figma.com/design/fIM7rssNkcTu8GlbzKSGCP/Client_Wireframe_ZOPAC?node-id=3311-98&t=oJRJBoHaypjnCWg6-1](https://www.figma.com/design/fIM7rssNkcTu8GlbzKSGCP/Client_Wireframe_ZOPAC?node-id=3311-98&t=oJRJBoHaypjnCWg6-1)

## Directions For Running Client & Linter

First, install updated versions of npm and node:
- Make sure to cd into the client folder first
- run npm install
- run sudo apt-get install -y nodejs
- npm -v and node -v to check versions (must be using updated versions)

Running Project:
- While in the client folder, run "npm run dev" in the terminal, then click on the link provided.

Using ESLint:
- We are using ESLint for this project. In order to run it properly, make sure to be in the client directory and use the "npm run lint" command. This will check hook usage, unused variables and imports, and code formatting issues.

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


## Wi-Fi Packet Fields
| Field                            | Functionality                          | Notes                      |
|----------------------------------|----------------------------------------|----------------------------|
| 1758170264.362535                 | Capture Timestamp                      | All use this               |
| 4674162us tsft                    | Time Synchronization Function Timer    | All use this               |
| 11.0 Mb/s                         | Transmission rate                      | All use this               |
| 2412 MHz                          | Frequency                              | All use this               |
| 11b                               | Modulation                             | All use this               |
| -51dBm signal                     | RSSI                                   | All use this               |
| antenna 0/1                       | Which antenna received the data        | All use this               |
| Protected                         | The data is encrypted                  | All use this               |
| 0us                               | Radiotap Timing Field                  | All use this               |
| DA:01:00:5e:00:00:01              | Destination address                    | All use this               |
| BSSID:4a:d9:e7:b3:73:16           | AP MAC address                         | All use this               |
| SA:c8:94:02:6f:cc:9f              | Source of the data                     | All use this               |
| Data IV:b42a Pad 20 KeyID 1       | Padding, encryption type, key info     | All use this               |
| Beacon (RAG XT)                   | Name of the beacon                     | Beacon only                |
| ESS CH: 1                         | Infrastructure and channel number      | Beacon only                |
| PRIVACY                           | Encryption required                    | Beacon only                |
| Probe Request (MySpectrumWiFiD0-2G)| Client searching for an AP            | Probe only (probe asking)  |
that name

**Sources**
- [Cisco: Network Security Guide](https://www.cisco.com/en/US/docs/wireless/wlan_adapter/secure_client/5.1.0/administration/guide/C1_Network_Security.html)  
- [How I WiFi: 802.11 Frame Types and Formats](https://howiwifi.com/2020/07/13/802-11-frame-types-and-formats/)  
- [AskUbuntu: Simple Script for Monitoring Wireless Status](https://askubuntu.com/questions/751547/simple-script-for-monitoring-wireless-status)  
- Google AI overview was used while researching
- ChatGPT was used to explain specific questions while researching

## Endpoint Linter
The linter being used for the endpoint is Ruff and Black.

## Endpoint Configuration
The endpoint repo contains all components needed to deploy a Raspberry Pi endpoint to capture Wi-Fi data.

###  .env Establishment 
1. Within the endpoint, copy the .env.example template to /etc/wifi-endpoint/.env and enter the fields with device specific information. 
2. Secure the changes within the CLI using:
- sudo chown root:root /etc/wifi-endpoint/.env
- sudo chmod 600 /etc/wifi-endpoint/.env
This ensures that only the root can read and write to these variables.

### Set Wi-Fi Adapter in Monitor Mode
1. Within the endpoint, create a directory and paste the setup_monitor.sh script.
2. In the CLI, navigate to the directory containing the script and use the command:
- ./setup_monitor.sh wlan1
3. Wi-Fi adapter is now in monitor mode.

### Capture packets with tcpdump
Note: Ensure that tcpdump is installed on the local device by first executing:
- sudo tcpdump
If an error occurs, install tcpdump using:
- sudo apt-get install -y tcpdump iw

1. Within the endpoint, create a directory and paste the capture_wifi.sh script.
2. In the CLI, navigate to the directory containing the script and use the command:
- ./capture_wifi.sh wlan1 ./captures
3. The dongle will begin the capture Wi-Fi packets and save them to a log file within the /captures directory. 
4. Use CTRL + C to terminate.


## Enable Endpoint to Scan immediately on Boot
You need to create a .service file located in the system directory. To create this:
1. Open CLI
2. navigate to root
3. navigate to the system directory using:
    cd etc/systemd/system
4. create the .system file using:
    sudo nano wifi-capture.service (NOTE: This name can be anything; its just the title of the service being created)
5. Insert all of the code found within scan_on_boot.txt
6. After saving and exiting, run the following commands:
    sudo systemctl daemon-reload
    sudo systemctl restart wifi-capture.service
    systemctl status wifi-capture.service
7. The .sh scripts within the project are now running on boot

### Key Notes:
1. This service file calls both the setup_monitor.sh and capture_wifi.sh files in this order. So, anything other files (.sh, .json, .py, etc) that are involved with these scripts will consequently execute
2. All logs are written to /home/pi instead of the dedicated WiFi_Project directory. Im doing this in attempt to keep the Projected Directory clean of constant log files- I want it to be purely code
3. HIGH IMPORTANCE: To terminate the scanning process initiated by the .service file, run the following command after booting the system:
    sudo systemctl stop wifi-capture.service
Confirm the service was terminated using:
    sudo systemctl status wifi-capture.service
Look for a line containing: wifi-capture.service: Deactivated successfully
This will suspend the program during this session and it will resume on the next boot. 
4. Recently created: wifi_status.py! This script will display the current information of the .service function.
5. MAKE SURE ALL FILES USE LF LINE SEQUENCE. This has caused more trouble on the Pi's than it should have. 
Any further questions and or troubleshooting will have to be resolve with the internet/AI.
6. How to edit .env on endpoint:
    nano /home/pi/WiFi_Project/.env
